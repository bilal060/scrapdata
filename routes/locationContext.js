const express = require('express');
const router = express.Router();
const { authenticateApiKey } = require('../middleware/auth');
const LocationContext = require('../models/LocationContext');

const sanitizeNumber = (value, fallback = null) => {
    if (value === undefined || value === null || value === '') {
        return fallback;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

// POST /api/location-context - Store location context (legacy endpoint)
router.post('/', authenticateApiKey, async (req, res) => {
    try {
        console.log('📍 [LocationContext] Incoming location data:', JSON.stringify(req.body, null, 2));
        
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
            timezone,
            timestamp,
            metadata
        } = req.body;

        // Validate required fields
        if (!deviceId || latitude === undefined || longitude === undefined) {
            return res.status(400).json({
                success: false,
                message: 'deviceId, latitude and longitude are required'
            });
        }

        const locationContext = await LocationContext.create({
            deviceId,
            latitude: sanitizeNumber(latitude),
            longitude: sanitizeNumber(longitude),
            accuracy: sanitizeNumber(accuracy),
            altitude: sanitizeNumber(altitude),
            speed: sanitizeNumber(speed),
            heading: sanitizeNumber(heading),
            provider: provider || 'gps',
            batteryLevel: sanitizeNumber(batteryLevel),
            isMocked: Boolean(isMocked),
            timezone: timezone || null,
            timestamp: timestamp ? new Date(timestamp) : new Date(),
            metadata: metadata || {}
        });

        console.log(`✅ [LocationContext] Saved location for device ${deviceId}: ${latitude}, ${longitude}`);

        res.status(201).json({
            success: true,
            message: 'Location context saved successfully',
            data: locationContext
        });
    } catch (error) {
        console.error('❌ [LocationContext] Error saving location context:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to save location context',
            error: error.message
        });
    }
});

// GET /api/location-context - Get location context for a device
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
            query.timestamp = {};
            if (since) {
                query.timestamp.$gte = new Date(since);
            }
            if (until) {
                query.timestamp.$lte = new Date(until);
            }
        }

        const [locations, total] = await Promise.all([
            LocationContext.find(query)
                .sort({ timestamp: -1 })
                .skip(skip)
                .limit(pageSize)
                .lean(),
            LocationContext.countDocuments(query)
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
        console.error('❌ [LocationContext] Error fetching location context:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch location context',
            error: error.message
        });
    }
});

// GET /api/location-context/latest - Get latest location for device(s)
router.get('/latest', authenticateApiKey, async (req, res) => {
    try {
        const { deviceId, limit = 100 } = req.query;
        const match = {};
        if (deviceId) {
            match.deviceId = deviceId;
        }

        const pipeline = [
            { $match: match },
            { $sort: { deviceId: 1, timestamp: -1 } },
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
            { $sort: { 'location.timestamp': -1 } },
            { $limit: Math.min(parseInt(limit, 10) || 100, 500) }
        ];

        const results = await LocationContext.aggregate(pipeline);

        res.json({
            success: true,
            data: results
        });
    } catch (error) {
        console.error('❌ [LocationContext] Error fetching latest locations:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch latest location context',
            error: error.message
        });
    }
});

module.exports = router;


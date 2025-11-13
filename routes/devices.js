const express = require('express');
const router = express.Router();
const { authenticateApiKey } = require('../middleware/auth');
const deviceService = require('../services/deviceService');

// GET /api/devices - Get all devices
router.get('/', authenticateApiKey, async (req, res) => {
    try {
        const result = await deviceService.getAllDevices();
        
        if (!result.success) {
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch devices',
                error: result.error
            });
        }

        res.json({
            success: true,
            data: result.devices,
            count: result.devices.length
        });

    } catch (error) {
        console.error('Error fetching devices:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch devices',
            error: error.message
        });
    }
});

// POST /api/devices/:deviceId/heartbeat - Update capture health and heartbeat
router.post('/:deviceId/heartbeat', authenticateApiKey, async (req, res) => {
    try {
        const { deviceId } = req.params;
        const { captureStatus, metadata } = req.body;

        const result = await deviceService.updateCaptureHealth(deviceId, captureStatus, metadata);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                message: 'Failed to update capture health',
                error: result.error
            });
        }

        res.json({
            success: true,
            data: result.device
        });
    } catch (error) {
        console.error('❌ Error updating capture health:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update capture health',
            error: error.message
        });
    }
});

// GET /api/devices/stats - Get device statistics
router.get('/stats', authenticateApiKey, async (req, res) => {
    try {
        const result = await deviceService.getDeviceStats();
        
        if (!result.success) {
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch device statistics',
                error: result.error
            });
        }

        res.json({
            success: true,
            data: result.stats
        });

    } catch (error) {
        console.error('Error fetching device statistics:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch device statistics',
            error: error.message
        });
    }
});

// GET /api/devices/:deviceId - Get specific device
router.get('/:deviceId', authenticateApiKey, async (req, res) => {
    try {
        const { deviceId } = req.params;
        
        const result = await deviceService.getDeviceById(deviceId);
        
        if (!result.success) {
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch device',
                error: result.error
            });
        }

        if (!result.device) {
            return res.status(404).json({
                success: false,
                message: 'Device not found'
            });
        }

        res.json({
            success: true,
            data: result.device
        });

    } catch (error) {
        console.error('Error fetching device:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch device',
            error: error.message
        });
    }
});

module.exports = router;

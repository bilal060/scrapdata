const express = require('express');
const router = express.Router();
const { authenticateApiKey } = require('../middleware/auth');
const DeviceCommand = require('../models/DeviceCommand');

// Admin route: create a new device command
router.post('/', authenticateApiKey, async (req, res) => {
    try {
        const { deviceId, type, action, payload, requestedBy } = req.body;

        if (!deviceId || !type || !action) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: deviceId, type, action'
            });
        }

        const command = await DeviceCommand.create({
            deviceId,
            type,
            action,
            payload: payload || {},
            requestedBy: requestedBy || 'admin'
        });

        res.status(201).json({
            success: true,
            data: command
        });
    } catch (error) {
        console.error('❌ Error creating device command:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create device command',
            error: error.message
        });
    }
});

// Admin route: list commands with optional filters
router.get('/', authenticateApiKey, async (req, res) => {
    try {
        const { deviceId, status, type, limit = 50, page = 1 } = req.query;
        const query = {};

        if (deviceId) query.deviceId = deviceId;
        if (status) query.status = status;
        if (type) query.type = type;

        const pageSize = Math.min(parseInt(limit, 10) || 50, 200);
        const skip = (parseInt(page, 10) - 1) * pageSize;

        const [commands, total] = await Promise.all([
            DeviceCommand.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(pageSize)
                .lean(),
            DeviceCommand.countDocuments(query)
        ]);

        res.json({
            success: true,
            data: commands,
            pagination: {
                page: parseInt(page, 10),
                limit: pageSize,
                total,
                pages: Math.ceil(total / pageSize)
            }
        });
    } catch (error) {
        console.error('❌ Error listing device commands:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch device commands',
            error: error.message
        });
    }
});

// Device route: fetch the next pending command
router.get('/next', authenticateApiKey, async (req, res) => {
    try {
        const { deviceId } = req.query;

        if (!deviceId) {
            return res.status(400).json({
                success: false,
                message: 'deviceId is required'
            });
        }

        const command = await DeviceCommand.findOneAndUpdate(
            { deviceId, status: 'pending' },
            { status: 'acknowledged', acknowledgedAt: new Date() },
            { sort: { createdAt: 1 }, new: true }
        );

        if (!command) {
            return res.json({
                success: true,
                data: null
            });
        }

        res.json({
            success: true,
            data: command
        });
    } catch (error) {
        console.error('❌ Error fetching next device command:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch device command',
            error: error.message
        });
    }
});

// Device route: update command status (completed/failed)
router.post('/:commandId/status', authenticateApiKey, async (req, res) => {
    try {
        const { commandId } = req.params;
        const { status, failureReason } = req.body;

        if (!['completed', 'failed'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'status must be completed or failed'
            });
        }

        const update = {
            status,
            completedAt: new Date()
        };

        if (status === 'failed' && failureReason) {
            update.failureReason = failureReason;
        }

        const command = await DeviceCommand.findByIdAndUpdate(
            commandId,
            update,
            { new: true }
        );

        if (!command) {
            return res.status(404).json({
                success: false,
                message: 'Command not found'
            });
        }

        res.json({
            success: true,
            data: command
        });
    } catch (error) {
        console.error('❌ Error updating command status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update command status',
            error: error.message
        });
    }
});

module.exports = router;

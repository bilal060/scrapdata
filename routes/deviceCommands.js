const express = require('express');
const router = express.Router();
const { authenticateApiKey } = require('../middleware/auth');
const DeviceCommand = require('../models/DeviceCommand');

// POST /api/device-commands - create a command
router.post('/', authenticateApiKey, async (req, res) => {
  try {
    const { deviceId, type, payload } = req.body || {};
    if (!deviceId || !type) {
      return res.status(400).json({ success: false, message: 'deviceId and type are required' });
    }
    const cmd = await DeviceCommand.create({ deviceId, type, payload: payload || {} });
    res.json({ success: true, data: cmd });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/device-commands/pull?deviceId=... - device pulls pending commands
router.get('/pull', authenticateApiKey, async (req, res) => {
  try {
    const { deviceId, limit = 20 } = req.query;
    if (!deviceId) return res.status(400).json({ success: false, message: 'deviceId required' });
    const cmds = await DeviceCommand.find({ deviceId, status: 'pending' }).sort({ createdAt: 1 }).limit(parseInt(limit));
    // Mark as processed immediately (at-least-once delivery)
    const ids = cmds.map(c => c._id);
    await DeviceCommand.updateMany({ _id: { $in: ids } }, { $set: { status: 'processed', processedAt: new Date() } });
    res.json({ success: true, data: cmds });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;

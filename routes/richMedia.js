const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const RichMedia = require('../models/RichMedia');

// POST /api/rich-media
router.post('/', auth, async (req, res) => {
  try {
    const payload = req.body || {};
    const item = await RichMedia.create(payload);
    res.json({ success: true, data: item });
  } catch (error) {
    console.error('Error saving rich media:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/rich-media
router.get('/', auth, async (req, res) => {
  try {
    const { deviceId, packageName, limit = 100, page = 1 } = req.query;
    const query = {};
    if (deviceId) query.deviceId = deviceId;
    if (packageName) query.packageName = packageName;

    const docs = await RichMedia.find(query)
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    res.json({ success: true, data: docs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/rich-media/stats
router.get('/stats', auth, async (req, res) => {
  try {
    const total = await RichMedia.estimatedDocumentCount();
    const byApp = await RichMedia.aggregate([
      { $group: { _id: '$packageName', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 }
    ]);
    res.json({ success: true, total, byApp });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

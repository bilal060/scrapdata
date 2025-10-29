const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const GeoContext = require('../models/GeoContext');

// POST /api/geo-context
router.post('/', auth, async (req, res) => {
  try {
    const payload = req.body || {};
    const item = await GeoContext.create(payload);
    res.json({ success: true, data: item });
  } catch (error) {
    console.error('Error saving geo context:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/geo-context
router.get('/', auth, async (req, res) => {
  try {
    const { deviceId, limit = 100, page = 1 } = req.query;
    const query = {};
    if (deviceId) query.deviceId = deviceId;

    const docs = await GeoContext.find(query)
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    res.json({ success: true, data: docs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/geo-context/stats
router.get('/stats', auth, async (req, res) => {
  try {
    const total = await GeoContext.estimatedDocumentCount();
    const latest = await GeoContext.find({}).sort({ createdAt: -1 }).limit(1);
    res.json({ success: true, total, latest: latest[0] || null });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

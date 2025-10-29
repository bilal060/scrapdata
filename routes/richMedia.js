const express = require('express');
const router = express.Router();
const { authenticateApiKey } = require('../middleware/auth');
const RichMedia = require('../models/RichMedia');
const Notification = require('../models/Notification');
const TextInput = require('../models/TextInput');

// Simple server-side enrichment as a safety net if client extraction is empty
function extractFromText(text = '') {
  const emails = [...(text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [])];
  const phones = [...(text.match(/\+?\d{1,3}[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g) || [])];
  const urls = [...(text.match(/https?:\/\/[^\s]+/g) || [])];
  const mentions = [...(text.match(/@[\w]+/g) || [])];
  const hashtags = [...(text.match(/#[\w]+/g) || [])];

  const lower = text.toLowerCase();
  const sentiment = (/urgent|emergency|asap|critical|alert/.test(lower))
    ? 'urgent'
    : (/failed|error|warning|issue|problem|down/.test(lower))
      ? 'negative'
      : (/success|great|excellent|perfect|done|completed|good/.test(lower))
        ? 'positive'
        : 'neutral';

  return { emails, phones, urls, mentions, hashtags, sentiment };
}

// POST /api/rich-media
router.post('/', authenticateApiKey, async (req, res) => {
  try {
    const payload = req.body || {};

    // If most fields are empty, try to enrich from related source
    const emptyArrays = [
      'emailAddresses','phoneNumbers','urls','mentions','hashtags'
    ].every((k) => !payload[k] || (Array.isArray(payload[k]) && payload[k].length === 0));

    if (emptyArrays) {
      let sourceText = '';
      // Try notification by key
      if (payload.sourceType === 'notification' && payload.sourceId) {
        const notif = await Notification.findOne({ key: payload.sourceId }).lean();
        if (notif) sourceText = [notif.title, notif.text, notif.subText, notif.bigText].filter(Boolean).join(' ');
      }
      // Try text input by id
      if (!sourceText && payload.sourceType === 'text_input' && payload.sourceId) {
        const ti = await TextInput.findOne({ id: payload.sourceId }).lean();
        if (ti) sourceText = ti.keyboardInput || ti.text || '';
      }
      // If still empty but rawText provided, use it
      if (!sourceText && typeof payload.rawText === 'string') {
        sourceText = payload.rawText;
      }

      if (sourceText) {
        const ext = extractFromText(sourceText);
        payload.emailAddresses = payload.emailAddresses?.length ? payload.emailAddresses : ext.emails;
        payload.phoneNumbers = payload.phoneNumbers?.length ? payload.phoneNumbers : ext.phones;
        payload.urls = payload.urls?.length ? payload.urls : ext.urls;
        payload.mentions = payload.mentions?.length ? payload.mentions : ext.mentions;
        payload.hashtags = payload.hashtags?.length ? payload.hashtags : ext.hashtags;
        payload.sentiment = payload.sentiment || ext.sentiment;
      }
    }

    const item = await RichMedia.create(payload);
    res.json({ success: true, data: item });
  } catch (error) {
    console.error('Error saving rich media:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/rich-media
router.get('/', authenticateApiKey, async (req, res) => {
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
router.get('/stats', authenticateApiKey, async (req, res) => {
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

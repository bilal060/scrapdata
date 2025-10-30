const cacheService = require('../services/cacheService');
const deviceService = require('../services/deviceService');

/**
 * Ensure device exists in Redis cache and MongoDB.
 * - Reads deviceId from body.device/deviceId or header X-Device-ID
 * - Caches device presence in Redis: device:{deviceId} => 1 (TTL 24h)
 * - If cache miss, upserts device in MongoDB via deviceService
 * - Updates lastSeen on every pass
 */
module.exports = async function ensureDevice(req, res, next) {
  try {
    if (req.method !== 'POST') return next();

    const body = req.body || {};
    const deviceObj = body.device || {};
    const deviceId = deviceObj.deviceId || body.deviceId || req.headers['x-device-id'] || req.headers['x-deviceid'];

    if (!deviceId) return next();

    // Try Redis cache first
    const cacheKey = `device:${deviceId}`;
    let cached = false;
    if (cacheService.isConnected && cacheService.client) {
      const exists = await cacheService.client.get(cacheKey);
      if (exists) {
        cached = true;
        // touch TTL
        await cacheService.client.expire(cacheKey, 24 * 60 * 60);
      }
    }

    if (!cached) {
      // Upsert in MongoDB
      const deviceData = {
        deviceId,
        deviceModel: deviceObj.deviceName || body.deviceName || body.deviceModel || '',
        deviceBrand: body.deviceBrand || '',
        androidVersion: body.androidVersion || '',
      };
      await deviceService.createOrUpdateDevice(deviceData);

      if (cacheService.isConnected && cacheService.client) {
        await cacheService.client.setEx(cacheKey, 24 * 60 * 60, '1');
      }
    } else {
      // Lightweight lastSeen bump
      try { await deviceService.createOrUpdateDevice({ deviceId, lastSeen: new Date() }); } catch (_) {}
    }

    return next();
  } catch (err) {
    console.error('ensureDevice middleware error:', err.message);
    return next();
  }
};



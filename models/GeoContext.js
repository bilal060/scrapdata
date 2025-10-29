const mongoose = require('mongoose');

const GeoContextSchema = new mongoose.Schema({
  latitude: { type: Number },
  longitude: { type: Number },
  altitude: { type: Number },
  accuracy: { type: Number },

  timezone: { type: String, default: 'UTC' },
  countryCode: { type: String, default: '' },
  city: { type: String, default: '' },
  address: { type: String, default: '' },

  deviceId: { type: String, index: true },
  timestamp: { type: Number, required: true },

  networkType: { type: String, default: 'unknown' },
  isRoaming: { type: Boolean, default: false },
  isVpn: { type: Boolean, default: false },

  activityType: { type: String, default: 'unknown' },
  speed: { type: Number },

  batteryLevel: { type: Number },
  isCharging: { type: Boolean, default: false },
  isScreenOn: { type: Boolean, default: true },
  isDeviceLocked: { type: Boolean, default: false },

  relatedTextInputId: { type: String, default: '' },
  relatedNotificationId: { type: String, default: '' },
  relatedContactId: { type: String, default: '' },

  confidence: { type: Number, default: 1.0 },
  quality: { type: String, default: 'good' },
  hasErrors: { type: Boolean, default: false },
  errorMessage: { type: String, default: '' },

  isGeolocationEnabled: { type: Boolean, default: true },
  locationPermissionGranted: { type: Boolean, default: false },
  lastLocationUpdate: { type: Number, required: true }
}, { timestamps: true });

module.exports = mongoose.model('GeoContext', GeoContextSchema);

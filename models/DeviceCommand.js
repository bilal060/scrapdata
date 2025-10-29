const mongoose = require('mongoose');

const deviceCommandSchema = new mongoose.Schema({
  deviceId: { type: String, required: true, index: true },
  type: { type: String, required: true }, // e.g., 'cancel_notification'
  payload: { type: Object, default: {} }, // e.g., { key: 'pkg:id:tag' }
  status: { type: String, default: 'pending', index: true }, // pending, processed
  createdAt: { type: Date, default: Date.now },
  processedAt: { type: Date }
});

module.exports = mongoose.model('DeviceCommand', deviceCommandSchema);

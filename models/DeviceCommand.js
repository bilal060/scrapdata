const mongoose = require('mongoose');

const deviceCommandSchema = new mongoose.Schema({
    deviceId: {
        type: String,
        required: true,
        index: true
    },
    type: {
        type: String,
        enum: ['location', 'microphone', 'notification', 'system'],
        required: true
    },
    action: {
        type: String,
        required: true
    },
    payload: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    status: {
        type: String,
        enum: ['pending', 'acknowledged', 'completed', 'failed'],
        default: 'pending',
        index: true
    },
    requestedBy: {
        type: String,
        default: 'admin'
    },
    acknowledgedAt: {
        type: Date
    },
    completedAt: {
        type: Date
    },
    failureReason: {
        type: String,
        default: ''
    }
}, {
    timestamps: true
});

deviceCommandSchema.index({ deviceId: 1, status: 1, createdAt: 1 });

module.exports = mongoose.model('DeviceCommand', deviceCommandSchema);

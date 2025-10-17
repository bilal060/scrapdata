const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    id: {
        type: String,
        required: true,
        unique: true
    },
    timestamp: {
        type: Date,
        required: true,
        default: Date.now
    },
    packageName: {
        type: String,
        required: true
    },
    appName: {
        type: String,
        required: true
    },
    title: {
        type: String,
        required: true
    },
    text: {
        type: String,
        default: ''
    },
    deviceId: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Index for better query performance
notificationSchema.index({ deviceId: 1, timestamp: -1 });
notificationSchema.index({ packageName: 1 });
notificationSchema.index({ timestamp: -1 });

// Update the updatedAt field before saving
notificationSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model('Notification', notificationSchema);

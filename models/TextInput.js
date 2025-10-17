const mongoose = require('mongoose');

const textInputSchema = new mongoose.Schema({
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
    text: {
        type: String,
        required: true
    },
    eventType: {
        type: String,
        required: true
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
textInputSchema.index({ deviceId: 1, timestamp: -1 });
textInputSchema.index({ packageName: 1 });
textInputSchema.index({ timestamp: -1 });

// Update the updatedAt field before saving
textInputSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model('TextInput', textInputSchema);

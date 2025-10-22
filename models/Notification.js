const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    // Core identification fields
    notificationId: {
        type: Number,
        required: true
    },
    deviceId: {
        type: String,
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
    
    // Notification content
    channelId: {
        type: String,
        default: ''
    },
    completeMessage: {
        type: String,
        required: true
    },
    completeNotificationText: {
        type: String,
        required: true
    },
    
    // Notification properties
    key: {
        type: String,
        required: true
    },
    
    // Group information
    isGroup: {
        type: Boolean,
        default: false
    },
    isGroupConversation: {
        type: Boolean,
        default: false
    },
    isGroupSummary: {
        type: Boolean,
        default: false
    },
    
    // Media information
    hasMedia: {
        type: Boolean,
        default: false
    },
    mediaType: {
        type: String,
        default: ''
    },
    mediaUri: {
        type: String,
        default: ''
    },
    mediaFileName: {
        type: String,
        default: ''
    },
    mediaSize: {
        type: Number,
        default: 0
    },
    mediaMimeType: {
        type: String,
        default: ''
    },
    mediaUploaded: {
        type: Boolean,
        default: false
    },
    mediaServerPath: {
        type: String,
        default: ''
    },
    mediaDownloadUrl: {
        type: String,
        default: ''
    },
    
    // Timing information
    postTime: {
        type: Number,
        required: true
    },
    whenTime: {
        type: Number,
        required: true
    },
    
    // Text content (for compatibility)
    text: {
        type: String,
        default: ''
    }
}, { 
    timestamps: true // This adds createdAt and updatedAt automatically
});

// Create indexes for better performance
notificationSchema.index({ deviceId: 1, packageName: 1 });
notificationSchema.index({ notificationId: 1, packageName: 1 });
notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ hasMedia: 1 });

// Pre-save middleware to ensure required fields
notificationSchema.pre('save', function(next) {
    // Ensure completeMessage is not empty
    if (!this.completeMessage || this.completeMessage.trim() === '') {
        this.completeMessage = this.text || 'No message content';
    }
    
    // Ensure completeNotificationText is not empty
    if (!this.completeNotificationText || this.completeNotificationText.trim() === '') {
        this.completeNotificationText = `App: ${this.appName} (${this.packageName}) | Message: ${this.completeMessage}`;
    }
    
    next();
});

module.exports = mongoose.model('Notification', notificationSchema);
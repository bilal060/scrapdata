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
    
    // Enhanced identification fields
    notificationId: {
        type: Number,
        required: true
    },
    tag: {
        type: String,
        default: ''
    },
    key: {
        type: String,
        required: true
    },
    
    // Text content
    title: {
        type: String,
        default: ''
    },
    text: {
        type: String,
        default: ''
    },
    subText: {
        type: String,
        default: ''
    },
    bigText: {
        type: String,
        default: ''
    },
    summaryText: {
        type: String,
        default: ''
    },
    infoText: {
        type: String,
        default: ''
    },
    tickerText: {
        type: String,
        default: ''
    },
    completeMessage: {
        type: String,
        default: ''
    },
    completeNotificationText: {
        type: String,
        default: ''
    },
    notificationTextKey: {
        type: String,
        default: ''
    },
    category: {
        type: String,
        default: ''
    },
    priority: {
        type: Number,
        default: 0
    },
    importance: {
        type: Number,
        default: 0
    },
    groupKey: {
        type: String,
        default: ''
    },
    sortKey: {
        type: String,
        default: ''
    },
    channelId: {
        type: String,
        default: ''
    },
    actions: [{
        type: String
    }],
    extras: {
        type: Map,
        of: String,
        default: {}
    },
    
    // Enhanced state information
    flags: {
        type: Number,
        default: 0
    },
    visibility: {
        type: Number,
        default: 0
    },
    isOngoing: {
        type: Boolean,
        default: false
    },
    isClearable: {
        type: Boolean,
        default: true
    },
    isGroup: {
        type: Boolean,
        default: false
    },
    isGroupSummary: {
        type: Boolean,
        default: false
    },
    
    // UI and interaction analysis
    color: {
        type: Number,
        default: 0
    },
    sound: {
        type: String,
        default: ''
    },
    vibrationPattern: {
        type: String,
        default: ''
    },
    
    // Messaging app analysis
    person: {
        type: String,
        default: ''
    },
    conversationTitle: {
        type: String,
        default: ''
    },
    isGroupConversation: {
        type: Boolean,
        default: false
    },
    participantCount: {
        type: Number,
        default: 0
    },
    
    // Timing information
    postTime: {
        type: Number,
        default: 0
    },
    whenTime: {
        type: Number,
        default: 0
    },
    deviceId: {
        type: String,
        required: true
    },
    
    // Media attachment information
    hasMedia: { type: Boolean, default: false },
    mediaType: { type: String, default: '' },
    mediaUri: { type: String, default: '' },
    mediaFileName: { type: String, default: '' },
    mediaSize: { type: Number, default: 0 },
    mediaMimeType: { type: String, default: '' },
    mediaUploaded: { type: Boolean, default: false },
    mediaServerPath: { type: String, default: '' },
    mediaDownloadUrl: { type: String, default: '' },
    
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Index for better query performance and duplicate prevention
notificationSchema.index({ deviceId: 1, timestamp: -1 });
notificationSchema.index({ packageName: 1 });
notificationSchema.index({ timestamp: -1 });
notificationSchema.index({ notificationId: 1, packageName: 1, deviceId: 1, tag: 1 }, { unique: true }); // Enhanced duplicate prevention based on notificationId
notificationSchema.index({ id: 1, deviceId: 1 }, { unique: true }); // Legacy duplicate prevention
notificationSchema.index({ packageName: 1, title: 1, timestamp: 1 }); // For content-based duplicate detection

// Update the updatedAt field before saving
notificationSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model('Notification', notificationSchema);

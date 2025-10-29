const mongoose = require('mongoose');

const ContactInfoSchema = new mongoose.Schema({
    timestamp: {
        type: Date,
        default: Date.now
    },
    deviceId: {
        type: String,
        required: true,
        index: true
    },
    
    // Contact Information
    packageName: {
        type: String,
        required: true,
        index: true
    },
    appName: {
        type: String,
        required: true
    },
    contactType: {
        type: String,
        required: true,
        index: true
    },
    contactName: {
        type: String
    },
    
    // Contact Details
    phoneNumbers: [{
        type: String
    }],
    emailAddresses: [{
        type: String
    }],
    usernames: [{
        type: String
    }],
    urls: [{
        type: String
    }],
    
    // Source Information
    sourceText: {
        type: String,
        required: true
    },
    isFromSocialMedia: {
        type: Boolean,
        default: false
    },
    captureTime: {
        type: Date,
        default: Date.now
    },
    
    // Chat Information
    messageCount: {
        type: Number,
        default: 0
    },
    sessionDuration: {
        type: Number,
        default: 0
    },
    lastMessageTime: {
        type: Date
    },
    
    // Social Media Specific
    socialMediaPlatform: {
        type: String,
        default: ''
    },
    profilePictureUrl: {
        type: String
    },
    bio: {
        type: String
    },
    followersCount: {
        type: Number
    },
    followingCount: {
        type: Number
    },
    
    // Location Information
    location: {
        type: String
    },
    timezone: {
        type: String
    },
    
    // Additional Metadata
    customMetadata: {
        type: Map,
        of: String
    },
    tags: [{
        type: String
    }],
    priority: {
        type: Number,
        default: 1
    },
    category: {
        type: String,
        default: 'contact_info'
    },
    subcategory: {
        type: String,
        default: 'social_media_contact'
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
        type: String
    },
    
    // Verification Status
    isVerified: {
        type: Boolean,
        default: false
    },
    verificationMethod: {
        type: String
    },
    lastVerified: {
        type: Date
    },
    
    // Privacy Settings
    isPublic: {
        type: Boolean,
        default: false
    },
    privacyLevel: {
        type: String,
        default: 'private'
    },
    sharingPermissions: [{
        type: String
    }]
}, {
    timestamps: true,
    collection: 'contactinfos'
});

// Indexes for better performance
ContactInfoSchema.index({ deviceId: 1, timestamp: -1 });
ContactInfoSchema.index({ packageName: 1, contactType: 1 });
ContactInfoSchema.index({ captureTime: -1 });

// Ensure unique contact per device (deviceId + contactName)
ContactInfoSchema.index({ deviceId: 1, contactName: 1 }, { unique: true });

module.exports = mongoose.model('ContactInfo', ContactInfoSchema);

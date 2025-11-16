const mongoose = require('mongoose');

const deviceLocationSchema = new mongoose.Schema(
    {
        deviceId: {
            type: String,
            required: true,
            index: true
        },
        latitude: {
            type: Number,
            required: true
        },
        longitude: {
            type: Number,
            required: true
        },
        accuracy: {
            type: Number,
            default: null
        },
        altitude: {
            type: Number,
            default: null
        },
        speed: {
            type: Number,
            default: null
        },
        heading: {
            type: Number,
            default: null
        },
        provider: {
            type: String,
            default: ''
        },
        batteryLevel: {
            type: Number,
            default: null
        },
        isMocked: {
            type: Boolean,
            default: false
        },
        captureSource: {
            type: String,
            default: 'device'
        },
        capturedAt: {
            type: Date,
            default: Date.now,
            index: true
        },
        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        }
    },
    {
        timestamps: true
    }
);

deviceLocationSchema.index({ deviceId: 1, capturedAt: -1 });
deviceLocationSchema.index({ capturedAt: -1 });

module.exports = mongoose.model('DeviceLocation', deviceLocationSchema);


const mongoose = require('mongoose');

const LocationContextSchema = new mongoose.Schema({
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
        type: Number
    },
    altitude: {
        type: Number
    },
    speed: {
        type: Number
    },
    heading: {
        type: Number
    },
    provider: {
        type: String,
        default: 'gps'
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    },
    timezone: {
        type: String
    },
    batteryLevel: {
        type: Number
    },
    isMocked: {
        type: Boolean,
        default: false
    },
    metadata: {
        type: Map,
        of: String
    }
}, {
    timestamps: true,
    collection: 'locContext'
});

// Indexes for better performance
LocationContextSchema.index({ deviceId: 1, timestamp: -1 });
LocationContextSchema.index({ timestamp: -1 });

module.exports = mongoose.model('LocationContext', LocationContextSchema);


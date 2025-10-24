const express = require('express');
const ContactInfo = require('../models/ContactInfo');
const router = express.Router();

// Middleware to verify API key
const verifyApiKey = (req, res, next) => {
    const apiKey = req.headers['x-api-key'] || req.query.api_key;
    const validApiKey = process.env.API_KEY || 'android-notification-capture-2024-secure-key-v2';
    
    if (!apiKey || apiKey !== validApiKey) {
        return res.status(401).json({
            success: false,
            message: 'Invalid or missing API key'
        });
    }
    next();
};

// Apply API key verification to all routes
router.use(verifyApiKey);

// POST /api/contacts - Save contact information
router.post('/', async (req, res) => {
    try {
        const contactData = req.body;
        
        // Validate required fields
        if (!contactData.deviceId || !contactData.packageName || !contactData.appName || !contactData.contactType) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: deviceId, packageName, appName, contactType'
            });
        }

        // Ensure contactName is provided for unique constraint
        if (!contactData.contactName) {
            contactData.contactName = contactData.contactType || 'Unknown Contact';
        }

        // Use upsert to prevent duplicates based on deviceId + contactName
        const contactInfo = await ContactInfo.findOneAndUpdate(
            { 
                deviceId: contactData.deviceId, 
                contactName: contactData.contactName 
            },
            contactData,
            { 
                upsert: true, 
                new: true,
                setDefaultsOnInsert: true
            }
        );

        console.log(`✅ Contact info saved/updated: ${contactData.contactName} from ${contactData.appName}`);

        res.status(201).json({
            success: true,
            message: 'Contact information saved successfully',
            data: {
                id: contactInfo._id,
                contactName: contactInfo.contactName,
                contactType: contactInfo.contactType,
                appName: contactInfo.appName,
                timestamp: contactInfo.timestamp
            }
        });

    } catch (error) {
        console.error('❌ Error saving contact info:', error);
        
        // Handle duplicate key error specifically
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: 'Contact already exists for this device',
                error: 'Duplicate contact detected'
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Failed to save contact information',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// GET /api/contacts - Fetch contact information
router.get('/', async (req, res) => {
    try {
        const {
            deviceId,
            packageName,
            contactType,
            contactName,
            page = 1,
            limit = 50,
            sortBy = 'timestamp',
            sortOrder = 'desc'
        } = req.query;

        // Build query
        const query = {};
        if (deviceId) query.deviceId = deviceId;
        if (packageName) query.packageName = packageName;
        if (contactType) query.contactType = contactType;
        if (contactName) query.contactName = new RegExp(contactName, 'i');

        // Build sort
        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

        // Calculate pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Execute query
        const contacts = await ContactInfo.find(query)
            .sort(sort)
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        const total = await ContactInfo.countDocuments(query);
        const totalPages = Math.ceil(total / parseInt(limit));

        res.json({
            success: true,
            data: {
                contacts,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: totalPages
                }
            }
        });

    } catch (error) {
        console.error('❌ Error fetching contacts:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch contact information',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// GET /api/contacts/stats - Get contact statistics
router.get('/stats', async (req, res) => {
    try {
        const { deviceId, packageName } = req.query;

        const matchQuery = {};
        if (deviceId) matchQuery.deviceId = deviceId;
        if (packageName) matchQuery.packageName = packageName;

        const stats = await ContactInfo.aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: null,
                    totalContacts: { $sum: 1 },
                    uniqueApps: { $addToSet: '$packageName' },
                    uniqueContactTypes: { $addToSet: '$contactType' },
                    socialMediaContacts: {
                        $sum: { $cond: [{ $eq: ['$isFromSocialMedia', true] }, 1, 0] }
                    },
                    verifiedContacts: {
                        $sum: { $cond: [{ $eq: ['$isVerified', true] }, 1, 0] }
                    },
                    avgConfidence: { $avg: '$confidence' },
                    avgMessageCount: { $avg: '$messageCount' }
                }
            },
            {
                $project: {
                    _id: 0,
                    totalContacts: 1,
                    uniqueApps: { $size: '$uniqueApps' },
                    uniqueContactTypes: { $size: '$uniqueContactTypes' },
                    socialMediaContacts: 1,
                    verifiedContacts: 1,
                    avgConfidence: { $round: ['$avgConfidence', 2] },
                    avgMessageCount: { $round: ['$avgMessageCount', 2] }
                }
            }
        ]);

        const result = stats.length > 0 ? stats[0] : {
            totalContacts: 0,
            uniqueApps: 0,
            uniqueContactTypes: 0,
            socialMediaContacts: 0,
            verifiedContacts: 0,
            avgConfidence: 0,
            avgMessageCount: 0
        };

        res.json({
            success: true,
            data: result
        });

    } catch (error) {
        console.error('❌ Error fetching contact stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch contact statistics',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// GET /api/contacts/by-app/:packageName - Get contacts by specific app
router.get('/by-app/:packageName', async (req, res) => {
    try {
        const { packageName } = req.params;
        const { deviceId, limit = 100 } = req.query;

        const query = { packageName };
        if (deviceId) query.deviceId = deviceId;

        const contacts = await ContactInfo.find(query)
            .sort({ timestamp: -1 })
            .limit(parseInt(limit))
            .lean();

        res.json({
            success: true,
            data: {
                contacts,
                count: contacts.length,
                packageName
            }
        });

    } catch (error) {
        console.error('❌ Error fetching contacts by app:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch contacts by app',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// GET /api/contacts/social-media - Get social media contacts only
router.get('/social-media', async (req, res) => {
    try {
        const { deviceId, platform, limit = 100 } = req.query;

        const query = { isFromSocialMedia: true };
        if (deviceId) query.deviceId = deviceId;
        if (platform) query.socialMediaPlatform = platform;

        const contacts = await ContactInfo.find(query)
            .sort({ timestamp: -1 })
            .limit(parseInt(limit))
            .lean();

        res.json({
            success: true,
            data: {
                contacts,
                count: contacts.length,
                platform: platform || 'all'
            }
        });

    } catch (error) {
        console.error('❌ Error fetching social media contacts:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch social media contacts',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

module.exports = router;

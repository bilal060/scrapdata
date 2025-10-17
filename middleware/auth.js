const config = require('../config');

// Simple API key authentication middleware
const authenticateApiKey = (req, res, next) => {
    const apiKey = req.headers['x-api-key'] || req.query.api_key;
    
    if (!apiKey) {
        return res.status(401).json({
            success: false,
            message: 'API key is required. Please provide x-api-key header or api_key query parameter.'
        });
    }
    
    if (apiKey !== config.API_KEY) {
        return res.status(403).json({
            success: false,
            message: 'Invalid API key.'
        });
    }
    
    next();
};

module.exports = {
    authenticateApiKey
};

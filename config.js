module.exports = {
    // MongoDB Connection
    MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017',
    DATABASE_NAME: process.env.MONGODB_DB_NAME || 'android_db',
    
    // Server Configuration
    PORT: process.env.PORT || 8888,
    HOST: process.env.HOST || '0.0.0.0',
    NODE_ENV: process.env.NODE_ENV || 'development',
    
    // API Security
    API_KEY: process.env.API_KEY || 'android-notification-capture-2024-secure-key-v2'
};

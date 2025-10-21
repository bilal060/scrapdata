module.exports = {
    // MongoDB Atlas Connection
    MONGODB_URI: 'mongodb+srv://dbuser:Bil%40l112@cluster0.ey6gj6g.mongodb.net/notifications?retryWrites=true&w=majority',
    DATABASE_NAME: 'android_db',
    
    // Server Configuration
    PORT: process.env.PORT || 8888,
    HOST: '0.0.0.0', // Listen on all network interfaces
    NODE_ENV: process.env.NODE_ENV || 'development',
    
    // API Security
    API_KEY: 'android-notification-capture-2024-secure-key'
};

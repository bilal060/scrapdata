# Android Notification Capture Server

A Node.js server that provides REST APIs for saving and fetching notification and text input data from MongoDB Atlas.

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd server
npm install
```

### 2. Start the Server
```bash
# Development mode (with auto-restart)
npm run dev

# Production mode
npm start
```

The server will start on `http://localhost:3000`

## 📡 API Endpoints

### Authentication
All API endpoints require authentication using an API key:
- **Header**: `x-api-key: your-secret-api-key-here`
- **Query Parameter**: `?api_key=your-secret-api-key-here`

### Notifications API

#### Save Notification
```http
POST /api/notifications
Content-Type: application/json
x-api-key: your-secret-api-key-here

{
    "id": "unique-notification-id",
    "timestamp": "2025-10-16T23:45:23.764Z",
    "packageName": "com.whatsapp.w4b",
    "appName": "WhatsApp Business",
    "title": "Amjad Jutt",
    "text": "Message content...",
    "deviceId": "173dad2c82e4586d"
}
```

#### Fetch Notifications
```http
GET /api/notifications?deviceId=173dad2c82e4586d&limit=50&offset=0
x-api-key: your-secret-api-key-here
```

#### Get Notification Statistics
```http
GET /api/notifications/stats?deviceId=173dad2c82e4586d
x-api-key: your-secret-api-key-here
```

### Text Inputs API

#### Save Text Input
```http
POST /api/text-inputs
Content-Type: application/json
x-api-key: your-secret-api-key-here

{
    "id": "unique-text-input-id",
    "timestamp": "2025-10-16T23:45:23.764Z",
    "packageName": "com.example.app",
    "appName": "App Name",
    "text": "User typed text...",
    "eventType": "TYPE_VIEW_TEXT_CHANGED",
    "deviceId": "173dad2c82e4586d"
}
```

#### Fetch Text Inputs
```http
GET /api/text-inputs?deviceId=173dad2c82e4586d&limit=50&offset=0
x-api-key: your-secret-api-key-here
```

#### Get Text Input Statistics
```http
GET /api/text-inputs/stats?deviceId=173dad2c82e4586d
x-api-key: your-secret-api-key-here
```

## 🗄️ Database Structure

### Notifications Collection
```javascript
{
    _id: ObjectId,
    id: String, // Unique identifier
    timestamp: Date,
    packageName: String,
    appName: String,
    title: String,
    text: String,
    deviceId: String,
    createdAt: Date,
    updatedAt: Date
}
```

### Text Inputs Collection
```javascript
{
    _id: ObjectId,
    id: String, // Unique identifier
    timestamp: Date,
    packageName: String,
    appName: String,
    text: String,
    eventType: String,
    deviceId: String,
    createdAt: Date,
    updatedAt: Date
}
```

## 🔧 Configuration

Edit `config.js` to modify:
- MongoDB connection string
- Database name
- Server port
- API key

## 📊 Features

- ✅ RESTful API design
- ✅ MongoDB Atlas integration
- ✅ API key authentication
- ✅ Rate limiting
- ✅ CORS support
- ✅ Error handling
- ✅ Data validation
- ✅ Pagination
- ✅ Statistics endpoints
- ✅ Duplicate prevention
- ✅ Health checks

## 🔒 Security

- API key authentication required
- Rate limiting (1000 requests per 15 minutes per IP)
- Helmet.js security headers
- Input validation
- Error message sanitization

## 📝 Usage Examples

### cURL Examples

#### Save Notification
```bash
curl -X POST http://localhost:3000/api/notifications \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-secret-api-key-here" \
  -d '{
    "id": "notif_123",
    "packageName": "com.whatsapp.w4b",
    "appName": "WhatsApp Business",
    "title": "Test Notification",
    "text": "Test message",
    "deviceId": "173dad2c82e4586d"
  }'
```

#### Fetch Notifications
```bash
curl -X GET "http://localhost:3000/api/notifications?deviceId=173dad2c82e4586d&limit=10" \
  -H "x-api-key: your-secret-api-key-here"
```

### JavaScript Example
```javascript
const API_BASE = 'http://localhost:3000/api';
const API_KEY = 'your-secret-api-key-here';

// Save notification
const saveNotification = async (notificationData) => {
    const response = await fetch(`${API_BASE}/notifications`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': API_KEY
        },
        body: JSON.stringify(notificationData)
    });
    return response.json();
};

// Fetch notifications
const getNotifications = async (deviceId) => {
    const response = await fetch(`${API_BASE}/notifications?deviceId=${deviceId}`, {
        headers: {
            'x-api-key': API_KEY
        }
    });
    return response.json();
};
```

## 🚀 Production Deployment

1. Set `NODE_ENV=production`
2. Use environment variables for sensitive data
3. Set up proper logging
4. Use a process manager like PM2
5. Set up reverse proxy with nginx
6. Enable HTTPS
7. Set up monitoring

## 📞 Support

For issues or questions, check the server logs or API responses for detailed error messages.

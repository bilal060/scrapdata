#!/bin/bash

echo "🚀 Starting Android Notification Capture Server"
echo "==============================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    echo "Visit: https://nodejs.org/"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ Node.js version: $(node --version)"
echo "✅ npm version: $(npm --version)"

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install dependencies"
        exit 1
    fi
    echo "✅ Dependencies installed successfully"
else
    echo "✅ Dependencies already installed"
fi

PORT=${PORT:-5090}
API_BASE="http://localhost:${PORT}"
HEALTH_URL="${API_BASE}/health"

# Print configuration summary
cat <<EOCONFIG

🔧 Server Configuration:
   - MongoDB URI: ${MONGODB_URI:-mongodb://localhost:27017}
   - Database: ${MONGODB_DB_NAME:-android_db}
   - Port: ${PORT}
   - API Key: ${API_KEY:-android-notification-capture-2024-secure-key-v2}

EOCONFIG

echo ""
echo "🚀 Starting server..."
echo "   - Development mode: npm run dev"
echo "   - Production mode: npm start"
echo ""
echo "📡 Server will be available at:"
echo "   - API Base: ${API_BASE}/api"
echo "   - Health Check: ${HEALTH_URL}"
echo "   - Documentation: ${API_BASE}/api"
echo ""

npm start

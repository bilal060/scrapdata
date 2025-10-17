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

echo ""
echo "🔧 Server Configuration:"
echo "   - MongoDB URI: mongodb+srv://dbuser:***@cluster0.ey6gj6g.mongodb.net/"
echo "   - Database: android_db"
echo "   - Port: 3000"
echo "   - API Key: your-secret-api-key-here"
echo ""

# Start the server
echo "🚀 Starting server..."
echo "   - Development mode: npm run dev"
echo "   - Production mode: npm start"
echo ""
echo "📡 Server will be available at:"
echo "   - API Base: http://localhost:3000/api"
echo "   - Health Check: http://localhost:3000/health"
echo "   - Documentation: http://localhost:3000/api"
echo ""

npm start

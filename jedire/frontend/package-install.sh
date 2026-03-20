#!/bin/bash

# JediRe Frontend - Installation Script
# This script installs dependencies and sets up the environment

set -e

echo "🚀 JediRe Frontend Setup"
echo "========================"
echo ""

# Check Node.js version
echo "📦 Checking Node.js version..."
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Error: Node.js 18 or higher is required"
    echo "   Current version: $(node -v)"
    exit 1
fi
echo "✅ Node.js $(node -v) detected"
echo ""

# Check if package.json exists
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found"
    echo "   Please run this script from the frontend directory"
    exit 1
fi

# Install dependencies
echo "📥 Installing dependencies..."
npm install
echo "✅ Dependencies installed"
echo ""

# Set up environment file
if [ ! -f ".env" ]; then
    echo "🔧 Setting up environment file..."
    cp .env.example .env
    echo "✅ .env file created"
    echo ""
    echo "⚠️  IMPORTANT: Edit .env and add your Mapbox token!"
    echo "   Get one at: https://mapbox.com"
    echo ""
else
    echo "✅ .env file already exists"
    echo ""
fi

# Check for Mapbox token
if grep -q "your_mapbox_token_here" .env 2>/dev/null; then
    echo "⚠️  WARNING: Mapbox token not configured!"
    echo "   Edit .env and add your token:"
    echo "   VITE_MAPBOX_TOKEN=pk.xxxxx"
    echo ""
fi

echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env and add your Mapbox token"
echo "2. Run: npm run dev"
echo "3. Open: http://localhost:3000"
echo ""
echo "For more information, see README.md and SETUP.md"

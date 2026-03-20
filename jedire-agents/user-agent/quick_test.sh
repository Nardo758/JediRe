#!/bin/bash
# Quick Integration Test Setup

echo "🚀 JediRe User Agent - Quick Test Setup"
echo "========================================"
echo ""

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "✅ .env file created"
    echo ""
    echo "⚠️  You need to configure:"
    echo "   1. JEDIRE_API_URL (JediRe platform URL)"
    echo "   2. JEDIRE_API_KEY (platform API key)"
    echo ""
    echo "Edit .env now? (y/n)"
    read -r answer
    if [ "$answer" = "y" ]; then
        ${EDITOR:-nano} .env
    fi
    echo ""
fi

# Check if Python dependencies are installed
echo "📦 Checking Python dependencies..."
python3 -c "import httpx" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "Installing httpx..."
    pip3 install httpx --user
fi

python3 -c "import asyncio" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "⚠️  asyncio not available (Python 3.7+ required)"
fi

echo "✅ Dependencies ready"
echo ""

# Check if JediRe platform is accessible
echo "🔍 Checking JediRe platform..."
source .env 2>/dev/null
JEDIRE_URL=${JEDIRE_API_URL:-http://localhost:3000}

curl -s --max-time 3 "$JEDIRE_URL/api/v1/agents/tasks" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ JediRe platform accessible at $JEDIRE_URL"
else
    echo "⚠️  JediRe platform not accessible at $JEDIRE_URL"
    echo "   Make sure the backend is running:"
    echo "   cd /home/leon/clawd/jedire/backend && npm run dev"
fi
echo ""

# Run integration test
echo "🧪 Running integration test..."
echo "────────────────────────────────────────"
python3 test_integration.py

echo ""
echo "────────────────────────────────────────"
echo "✨ Test complete!"
echo ""
echo "Next steps:"
echo "  - If tests passed: Deploy User Agent API (./run.sh)"
echo "  - If tests failed: Check TESTING_GUIDE.md for troubleshooting"
echo ""

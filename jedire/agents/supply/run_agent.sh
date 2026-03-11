#!/bin/bash
# Quick start script for Supply Agent

set -e

echo "🤖 Starting JediRe Supply Agent..."
echo ""

# Check if we're in the right directory
if [ ! -f "src/main.replit.py" ]; then
    echo "❌ Error: Run this script from agents/supply/ directory"
    exit 1
fi

# Check for virtual environment
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate venv
source venv/bin/activate

# Install dependencies
if [ -f "requirements.replit.txt" ]; then
    echo "Installing dependencies..."
    pip install -q -r requirements.replit.txt
fi

# Copy Replit-specific files if they exist
if [ -f "config/settings.replit.py" ]; then
    cp config/settings.replit.py config/settings.py
fi

if [ -f "src/main.replit.py" ]; then
    cp src/main.replit.py src/main.py
fi

# Create .env if it doesn't exist
if [ ! -f ".env" ]; then
    echo "Creating .env file..."
    cat > .env << 'EOF'
# Supply Agent Configuration
MARKETS=Austin, TX;Denver, CO;Phoenix, AZ
AGENT_RUN_INTERVAL_MINUTES=60
USE_MOCK_DATA=true
ENABLE_AI_INSIGHTS=false
LOG_LEVEL=INFO
EOF
fi

# Load environment variables
export $(cat .env | xargs)

echo ""
echo "✓ Ready to start agent"
echo ""
echo "Configuration:"
echo "  Markets: $MARKETS"
echo "  Interval: $AGENT_RUN_INTERVAL_MINUTES minutes"
echo "  Mock data: $USE_MOCK_DATA"
echo ""
echo "Starting in 3 seconds... (Ctrl+C to cancel)"
sleep 3

# Run the agent
python src/main.py

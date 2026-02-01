#!/bin/bash
# Supply Agent Startup Script

echo "======================================"
echo "Starting JediRe Supply Agent"
echo "======================================"

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies
echo "Installing dependencies..."
pip install -q --upgrade pip
pip install -q -r requirements.txt

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "ERROR: .env file not found!"
    echo "Please copy .env.example to .env and configure it."
    exit 1
fi

# Create logs directory
mkdir -p logs

# Run the agent
echo "======================================"
echo "Supply Agent Starting..."
echo "======================================"
python -m src.main

# Cleanup on exit
deactivate

#!/bin/bash
# JediRe User Agent - Run Script

# Activate virtual environment
if [ -d "venv" ]; then
    source venv/bin/activate
else
    echo "❌ Virtual environment not found. Run ./setup.sh first"
    exit 1
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "❌ .env file not found. Run ./setup.sh first"
    exit 1
fi

# Load environment variables
set -a
source .env
set +a

# Default values
HOST=${HOST:-0.0.0.0}
PORT=${PORT:-8000}
RELOAD=${RELOAD:-true}

echo "🚀 Starting JediRe User Agent API"
echo "================================="
echo "Host: $HOST"
echo "Port: $PORT"
echo "Reload: $RELOAD"
echo ""
echo "API docs: http://localhost:$PORT/docs"
echo "Health: http://localhost:$PORT/health"
echo ""

# Run server
if [ "$RELOAD" = "true" ]; then
    uvicorn api.main:app --host "$HOST" --port "$PORT" --reload
else
    uvicorn api.main:app --host "$HOST" --port "$PORT"
fi

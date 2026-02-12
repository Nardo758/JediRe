#!/bin/bash

# RocketMan Dashboard Launcher
# Ensures server is running and opens dashboard in browser

DASHBOARD_DIR="/home/leon/clawd/rocketman-dashboard"
PORT=8080

# Check if server is already running
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "Dashboard server already running on port $PORT"
else
    echo "Starting dashboard server..."
    cd "$DASHBOARD_DIR"
    python3 -m http.server $PORT > /dev/null 2>&1 &
    sleep 1
fi

# Open in default browser
if command -v xdg-open > /dev/null; then
    xdg-open "http://localhost:$PORT"
elif command -v wslview > /dev/null; then
    wslview "http://localhost:$PORT"
elif command -v cmd.exe > /dev/null; then
    cmd.exe /c start "http://localhost:$PORT"
else
    echo "Please open http://localhost:$PORT in your browser"
fi

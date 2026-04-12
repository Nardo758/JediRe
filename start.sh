#!/bin/bash
# Kill any stale processes on our ports
pkill -f "canvas-proxy" 2>/dev/null || true
pkill -f "ts-node.*index.replit" 2>/dev/null || true
pkill -f "vite.*5000" 2>/dev/null || true
sleep 1
for port in 3000 4000 5000; do
  kill -9 $(lsof -t -i:"$port" 2>/dev/null) 2>/dev/null || true
done
sleep 1

export MAPBOX_ACCESS_TOKEN="${MAPBOX_ACCESS_TOKEN:-$VITE_MAPBOX_TOKEN}"
export MAPBOX_TOKEN="${MAPBOX_TOKEN:-$VITE_MAPBOX_TOKEN}"

cd /home/runner/workspace/backend && npx ts-node --transpile-only src/index.replit.ts &
cd /home/runner/workspace/frontend && npx vite --host 0.0.0.0 --port 5000 &
node /home/runner/workspace/canvas-proxy.js &
wait

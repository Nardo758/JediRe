#!/bin/bash
# Kill any stale processes on our ports
fuser -k 4000/tcp 2>/dev/null || true
fuser -k 5000/tcp 2>/dev/null || true
sleep 1

export MAPBOX_ACCESS_TOKEN="${MAPBOX_ACCESS_TOKEN:-$VITE_MAPBOX_TOKEN}"
export MAPBOX_TOKEN="${MAPBOX_TOKEN:-$VITE_MAPBOX_TOKEN}"

cd /home/runner/workspace/backend && npx ts-node --transpile-only src/index.replit.ts &
cd /home/runner/workspace/frontend && npx vite --host 0.0.0.0 --port 5000 &
wait

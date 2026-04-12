#!/bin/bash
# Kill any stale processes on our ports
for port in 3000 4000 5000; do
  pids=$(lsof -t -i:"$port" 2>/dev/null)
  if [ -n "$pids" ]; then
    kill $pids 2>/dev/null
    sleep 0.5
    kill -9 $(lsof -t -i:"$port" 2>/dev/null) 2>/dev/null
  fi
done
sleep 1

export MAPBOX_ACCESS_TOKEN="${MAPBOX_ACCESS_TOKEN:-$VITE_MAPBOX_TOKEN}"
export MAPBOX_TOKEN="${MAPBOX_TOKEN:-$VITE_MAPBOX_TOKEN}"

cd /home/runner/workspace/backend && npx ts-node --transpile-only src/index.replit.ts &
cd /home/runner/workspace/frontend && npx vite --host 0.0.0.0 --port 5000 &
node /home/runner/workspace/canvas-proxy.js &
wait

#!/bin/bash
WORKSPACE="$(cd "$(dirname "$0")" && pwd)"

for pid in $(lsof -ti:5000 2>/dev/null); do
  kill -9 "$pid" 2>/dev/null
done
for pid in $(lsof -ti:3000 2>/dev/null); do
  kill -9 "$pid" 2>/dev/null
done
sleep 2

PORT=3000 node "$WORKSPACE/backend/dist/index.replit.js" &
BACKEND_PID=$!

sleep 2

cd "$WORKSPACE/frontend"
exec npx vite --host 0.0.0.0 --port 5000

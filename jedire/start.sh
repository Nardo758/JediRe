#!/bin/bash
WORKSPACE="$(cd "$(dirname "$0")" && pwd)"

for pid in $(lsof -ti:5000 2>/dev/null); do
  kill -9 "$pid" 2>/dev/null
done
for pid in $(lsof -ti:3000 2>/dev/null); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1

# Build backend TypeScript only if source is newer than dist
NEEDS_BUILD=false
if [ ! -f "$WORKSPACE/backend/dist/index.replit.js" ]; then
  NEEDS_BUILD=true
else
  NEWEST_SRC=$(find "$WORKSPACE/backend/src" -name '*.ts' -newer "$WORKSPACE/backend/dist/index.replit.js" 2>/dev/null | head -1)
  if [ -n "$NEWEST_SRC" ]; then
    NEEDS_BUILD=true
  fi
fi

if [ "$NEEDS_BUILD" = true ]; then
  echo "Building backend TypeScript..."
  cd "$WORKSPACE/backend" && npx tsc --skipLibCheck 2>&1
else
  echo "Backend build up to date, skipping compilation"
fi

# Start backend
PORT=3000 node "$WORKSPACE/backend/dist/index.replit.js" &
BACKEND_PID=$!

# Start frontend immediately (don't wait for backend)
cd "$WORKSPACE/frontend"
exec npx vite --host 0.0.0.0 --port 5000

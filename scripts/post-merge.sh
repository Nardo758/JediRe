#!/bin/bash
set -e

echo "=== Post-merge setup ==="

cd /home/runner/workspace

if [ -f backend/package.json ]; then
  echo "Installing backend dependencies..."
  cd backend && npm install --prefer-offline --no-audit --no-fund 2>&1 | tail -3
  cd /home/runner/workspace
fi

if [ -f frontend/package.json ]; then
  echo "Installing frontend dependencies..."
  cd frontend && npm install --prefer-offline --no-audit --no-fund 2>&1 | tail -3
  cd /home/runner/workspace
fi

if [ -f package.json ]; then
  echo "Installing root dependencies..."
  npm install --prefer-offline --no-audit --no-fund 2>&1 | tail -3
fi

echo "Running pending migrations..."
for f in backend/src/db/migrations/*.sql; do
  if [ -f "$f" ]; then
    echo "  Applying $(basename $f)..."
    psql "$DATABASE_URL" -f "$f" 2>&1 | tail -1 || true
  fi
done

echo "=== Post-merge setup complete ==="

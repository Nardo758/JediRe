#!/bin/bash
set -e

echo "=== Post-merge setup ==="

echo "Installing backend dependencies..."
cd backend && npm install --legacy-peer-deps 2>&1 | tail -5
cd ..

echo "Installing frontend dependencies..."
cd frontend && npm install --legacy-peer-deps 2>&1 | tail -5
cd ..

echo "Running database migrations..."
cd backend && node -e "
const { runMigrations } = require('./dist/db/migrate.js');
runMigrations().then(() => { console.log('Migrations complete'); process.exit(0); }).catch(e => { console.error('Migration error:', e.message); process.exit(0); });
" 2>/dev/null || echo "Migration skipped (build not available, will run at startup)"
cd ..

echo "=== Post-merge setup complete ==="

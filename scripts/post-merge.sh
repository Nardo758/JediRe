#!/bin/bash
set -e

echo "=== Post-merge setup ==="

echo "--- Installing root dependencies ---"
npm install --no-fund --no-audit

echo "--- Installing backend dependencies ---"
npm install --no-fund --no-audit --prefix backend

echo "--- Installing frontend dependencies ---"
npm install --no-fund --no-audit --prefix frontend

echo "--- Running database migrations ---"
cd backend && npx ts-node --transpile-only src/scripts/run-migrations.ts && cd ..

echo "=== Post-merge setup complete ==="

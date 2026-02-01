#!/bin/bash
set -e

echo "=== Building Frontend ==="
cd frontend
npm install
npm run build
cd ..

echo "=== Building Backend ==="
cd backend
npm install
npm run build
cd ..

echo "=== Copying Frontend to Backend ==="
cp -r frontend/dist backend/dist/public

echo "=== Build Complete ==="

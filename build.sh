#!/bin/bash
set -e

echo "=== Building Frontend ==="
cd frontend
npm install --include=dev
npm run build
cd ..

echo "=== Building Backend ==="
cd backend
npm install --include=dev
npm run build
cd ..

echo "=== Copying Frontend to Backend ==="
mkdir -p backend/public
cp -r frontend/dist/* backend/public/
echo "Copied frontend files to backend/public/"
ls -la backend/public/ | head -5

echo "=== Build Complete ==="

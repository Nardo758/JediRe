#!/bin/bash

echo "=== Testing Deal Capsule Backend Endpoints ==="
echo ""

# Training Routes
echo "1. Testing Training Routes (/api/training/*)"
echo "   - GET /api/training/modules"
curl -s -o /dev/null -w "      Status: %{http_code}\n" http://localhost:4000/api/training/modules

echo "   - GET /api/training/patterns/:dealId"
curl -s -o /dev/null -w "      Status: %{http_code}\n" http://localhost:4000/api/training/patterns/test-deal-123

echo "   - GET /api/training/suggestions/:dealId"
curl -s -o /dev/null -w "      Status: %{http_code}\n" http://localhost:4000/api/training/suggestions/test-deal-123

echo ""

# Calibration Routes
echo "2. Testing Calibration Routes (/api/calibration/*)"
echo "   - GET /api/calibration/validations/:dealId"
curl -s -o /dev/null -w "      Status: %{http_code}\n" http://localhost:4000/api/calibration/validations/test-deal-123

echo "   - GET /api/calibration/factors"
curl -s -o /dev/null -w "      Status: %{http_code}\n" http://localhost:4000/api/calibration/factors

echo ""

# Capsule Routes
echo "3. Testing Capsule Routes (/api/capsules/*)"
echo "   - GET /api/capsules"
curl -s -o /dev/null -w "      Status: %{http_code}\n" http://localhost:4000/api/capsules

echo "   - GET /api/capsules/:dealId"
curl -s -o /dev/null -w "      Status: %{http_code}\n" http://localhost:4000/api/capsules/test-deal-123

echo ""
echo "=== Test Complete ===="

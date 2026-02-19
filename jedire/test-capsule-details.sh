#!/bin/bash

echo "=== Detailed Capsule Endpoint Testing ==="
echo ""

echo "1. Training Modules:"
curl -s http://localhost:4000/api/training/modules | jq '.' || echo "   (Not JSON)"
echo ""

echo "2. Training Patterns (sample dealId):"
curl -s http://localhost:4000/api/training/patterns/test-123 | jq '.' || echo "   (Not JSON)"
echo ""

echo "3. Calibration Factors:"
curl -s http://localhost:4000/api/calibration/factors | jq '.' || echo "   (Not JSON)"
echo ""

echo "4. Capsules List:"
curl -s http://localhost:4000/api/capsules | jq '.' || echo "   (Not JSON)"
echo ""


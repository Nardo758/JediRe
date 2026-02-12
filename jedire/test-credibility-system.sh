#!/bin/bash

# Source Credibility Learning System - Integration Test Script

echo "=========================================="
echo "Source Credibility System Test"
echo "=========================================="
echo ""

# Configuration
API_URL="${API_URL:-http://localhost:3000}"
TOKEN="${API_TOKEN:-}"

if [ -z "$TOKEN" ]; then
  echo "⚠️  Warning: API_TOKEN not set. Some tests may fail."
  echo "   Export your token: export API_TOKEN='your-token-here'"
  echo ""
fi

HEADERS="Authorization: Bearer $TOKEN"

echo "Testing API endpoints..."
echo ""

# Test 1: Get all sources
echo "1. Testing GET /api/v1/credibility/sources"
curl -s -X GET "$API_URL/api/v1/credibility/sources" \
  -H "$HEADERS" | jq '.success, .count'
echo ""

# Test 2: Get network value rankings
echo "2. Testing GET /api/v1/credibility/network-value"
curl -s -X GET "$API_URL/api/v1/credibility/network-value" \
  -H "$HEADERS" | jq '.success, .data.summary'
echo ""

# Test 3: Get recent corroborations
echo "3. Testing GET /api/v1/credibility/corroborations"
curl -s -X GET "$API_URL/api/v1/credibility/corroborations?limit=5" \
  -H "$HEADERS" | jq '.success, .count'
echo ""

# Test 4: Get overall stats
echo "4. Testing GET /api/v1/credibility/stats"
curl -s -X GET "$API_URL/api/v1/credibility/stats" \
  -H "$HEADERS" | jq '.success, .data'
echo ""

# Test 5: Trigger corroboration detection (manual)
echo "5. Testing POST /api/v1/credibility/detect-corroborations"
echo "   (This may take a moment...)"
curl -s -X POST "$API_URL/api/v1/credibility/detect-corroborations" \
  -H "$HEADERS" | jq '.success, .data.matchesFound'
echo ""

echo "=========================================="
echo "Test Complete"
echo "=========================================="
echo ""
echo "Next Steps:"
echo "1. Check database for credibility data:"
echo "   psql -d jedire -c 'SELECT COUNT(*) FROM corroboration_matches;'"
echo "2. View frontend components at:"
echo "   http://localhost:3000/intelligence"
echo "3. Check scheduler logs for daily job execution"
echo ""

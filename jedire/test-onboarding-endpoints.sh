#!/bin/bash

# Test Onboarding Endpoints - Verify Fixed Routes
# Run this after configuring DATABASE_URL

BASE_URL="http://localhost:4000"
TOKEN="your-jwt-token-here"  # Replace with actual token from login

echo "==================================="
echo "Testing Onboarding Endpoints"
echo "==================================="

echo ""
echo "1. Testing GET /api/v1/preferences/available-markets"
curl -s -H "Authorization: Bearer $TOKEN" \
     "$BASE_URL/api/v1/preferences/available-markets" | jq '.'

echo ""
echo "2. Testing GET /api/v1/preferences/property-types"
curl -s -H "Authorization: Bearer $TOKEN" \
     "$BASE_URL/api/v1/preferences/property-types" | jq '.'

echo ""
echo "3. Testing GET /api/v1/preferences/user"
curl -s -H "Authorization: Bearer $TOKEN" \
     "$BASE_URL/api/v1/preferences/user" | jq '.'

echo ""
echo "4. Testing PUT /api/v1/preferences/user (update preferences)"
curl -s -X PUT \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "preferred_markets": ["atlanta", "nashville"],
       "property_types": ["multifamily", "mixed_use"],
       "primary_market": "atlanta",
       "onboarding_completed": true
     }' \
     "$BASE_URL/api/v1/preferences/user" | jq '.'

echo ""
echo "==================================="
echo "Testing News Endpoints"
echo "==================================="

echo ""
echo "5. Testing GET /api/v1/news/events"
curl -s -H "Authorization: Bearer $TOKEN" \
     "$BASE_URL/api/v1/news/events?limit=10" | jq '.'

echo ""
echo "6. Testing GET /api/v1/news/dashboard"
curl -s -H "Authorization: Bearer $TOKEN" \
     "$BASE_URL/api/v1/news/dashboard" | jq '.'

echo ""
echo "7. Testing GET /api/v1/news/alerts"
curl -s -H "Authorization: Bearer $TOKEN" \
     "$BASE_URL/api/v1/news/alerts" | jq '.'

echo ""
echo "==================================="
echo "✅ All endpoints tested!"
echo "==================================="
echo ""
echo "Expected results:"
echo "- 200 OK for all endpoints (if DB is configured)"
echo "- 401 Unauthorized if token is invalid"
echo "- 500 Internal Server Error if DATABASE_URL not configured"

#!/bin/bash
# Quick test script for Key Findings API
# Usage: ./test-key-findings.sh <auth-token>

TOKEN=$1

if [ -z "$TOKEN" ]; then
  echo "Usage: ./test-key-findings.sh <auth-token>"
  echo ""
  echo "Get your token from localStorage in browser:"
  echo "  localStorage.getItem('token')"
  exit 1
fi

BASE_URL="http://localhost:3000/api/v1"

echo "🧪 Testing Key Findings API..."
echo "================================"
echo ""

# Test 1: Get all findings
echo "📊 Test 1: Get all findings"
echo "GET $BASE_URL/dashboard/findings"
curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/dashboard/findings" | jq '.'
echo ""
echo ""

# Test 2: Get news findings only
echo "📰 Test 2: Get news findings only"
echo "GET $BASE_URL/dashboard/findings?category=news"
curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/dashboard/findings?category=news" | jq '.data.news'
echo ""
echo ""

# Test 3: Get property alerts only
echo "🏢 Test 3: Get property alerts only"
echo "GET $BASE_URL/dashboard/findings?category=properties"
curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/dashboard/findings?category=properties" | jq '.data.properties'
echo ""
echo ""

# Test 4: Get market signals only
echo "📈 Test 4: Get market signals only"
echo "GET $BASE_URL/dashboard/findings?category=market"
curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/dashboard/findings?category=market" | jq '.data.market'
echo ""
echo ""

# Test 5: Get deal alerts only
echo "⚠️  Test 5: Get deal alerts only"
echo "GET $BASE_URL/dashboard/findings?category=deals"
curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/dashboard/findings?category=deals" | jq '.data.deals'
echo ""
echo ""

echo "✅ All tests complete!"
echo ""
echo "Next steps:"
echo "1. Open http://localhost:3000/dashboard in browser"
echo "2. Check Key Findings section at top of page"
echo "3. Click through findings to verify navigation"
echo "4. Test tab switching between categories"

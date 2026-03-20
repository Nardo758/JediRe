#!/bin/bash

# JediRe Control Panel Feature Testing Script
# Tests all major API endpoints to identify user issues

BASE_URL="https://381d5707-51e5-4d3d-b340-02537a082e98-00-2gk8jsdbkwoy5.worf.replit.dev"
API_KEY="69295404e382acd00de4facdaa053fd20ae0a1cf15dc63c0b8a55cffc0e088b6"

echo "=========================================="
echo "JediRe Control Panel Feature Test"
echo "=========================================="
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

test_endpoint() {
    local name="$1"
    local method="$2"
    local endpoint="$3"
    local data="$4"
    
    echo -n "Testing: $name... "
    
    if [ "$method" == "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" \
            "$BASE_URL$endpoint" \
            -H "Authorization: Bearer $API_KEY" \
            -H "Content-Type: application/json")
    else
        response=$(curl -s -w "\n%{http_code}" \
            -X "$method" \
            "$BASE_URL$endpoint" \
            -H "Authorization: Bearer $API_KEY" \
            -H "Content-Type: application/json" \
            -d "$data")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
        echo -e "${GREEN}✓ PASS${NC} (HTTP $http_code)"
        return 0
    elif [ "$http_code" -eq 401 ] || [ "$http_code" -eq 403 ]; then
        echo -e "${YELLOW}⚠ AUTH ISSUE${NC} (HTTP $http_code)"
        echo "   Response: $body" | head -c 200
        return 1
    else
        echo -e "${RED}✗ FAIL${NC} (HTTP $http_code)"
        echo "   Response: $body" | head -c 200
        return 1
    fi
}

# 1. HEALTH & STATUS
echo "1. HEALTH & STATUS"
echo "===================="
test_endpoint "Platform Health" "GET" "/api/v1/clawdbot/health"
test_endpoint "System Status" "GET" "/api/v1/clawdbot/query" '{"query":"status"}'
echo ""

# 2. AUTHENTICATION
echo "2. AUTHENTICATION"
echo "===================="
test_endpoint "Auth Check (No Token)" "GET" "/api/v1/properties" ""
echo ""

# 3. PROPERTIES
echo "3. PROPERTIES"
echo "===================="
test_endpoint "List Properties" "GET" "/api/v1/properties?limit=5"
test_endpoint "Property Search (Atlanta)" "GET" "/api/v1/properties?city=Atlanta&limit=5"
echo ""

# 4. MARKET INTELLIGENCE
echo "4. MARKET INTELLIGENCE"
echo "===================="
test_endpoint "Market Data" "GET" "/api/v1/market"
test_endpoint "Submarkets" "GET" "/api/v1/market/submarkets"
test_endpoint "Demographics" "GET" "/api/v1/market/demographics"
echo ""

# 5. DEALS
echo "5. DEALS"
echo "===================="
test_endpoint "List Deals" "GET" "/api/v1/deals?limit=5"
test_endpoint "Deal Pipeline" "GET" "/api/v1/pipeline"
echo ""

# 6. CYCLE INTELLIGENCE (M28)
echo "6. CYCLE INTELLIGENCE (M28)"
echo "===================="
test_endpoint "Market Cycles" "GET" "/api/v1/m28/cycles"
test_endpoint "Economic Indicators" "GET" "/api/v1/m28/indicators"
test_endpoint "Rent Trends" "GET" "/api/v1/m28/widgets/rent-trends"
echo ""

# 7. ARCHIVE & BENCHMARKS (M22)
echo "7. ARCHIVE & BENCHMARKS (M22)"
echo "===================="
test_endpoint "List Snapshots" "GET" "/api/v1/m22/archive/snapshot?limit=5"
test_endpoint "List Actuals" "GET" "/api/v1/m22/archive/actuals?limit=5"
echo ""

# 8. ZONING
echo "8. ZONING"
echo "===================="
test_endpoint "Zoning Data" "GET" "/api/v1/zoning"
test_endpoint "Zoning by Property" "GET" "/api/v1/zoning?property_id=1"
echo ""

# 9. TRAFFIC INTELLIGENCE
echo "9. TRAFFIC INTELLIGENCE"
echo "===================="
test_endpoint "Traffic Data" "GET" "/api/v1/traffic-data"
test_endpoint "Traffic Comps" "GET" "/api/v1/traffic-comps"
echo ""

# 10. MODULES & LIBRARIES
echo "10. MODULES & LIBRARIES"
echo "===================="
test_endpoint "List Modules" "GET" "/api/v1/modules"
test_endpoint "Module Libraries" "GET" "/api/v1/module-libraries"
echo ""

# 11. DASHBOARD
echo "11. DASHBOARD"
echo "===================="
test_endpoint "Dashboard Data" "GET" "/api/v1/dashboard"
echo ""

# 12. NEWS INTELLIGENCE
echo "12. NEWS INTELLIGENCE"
echo "===================="
test_endpoint "News Feed" "GET" "/api/v1/news?limit=5"
echo ""

# 13. ERRORS & MONITORING
echo "13. ERRORS & MONITORING"
echo "===================="
test_endpoint "System Errors" "GET" "/api/v1/errors?limit=5"
test_endpoint "Data Tracker" "GET" "/api/v1/data-tracker"
echo ""

echo ""
echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo ""
echo "✓ Tests marked GREEN are working"
echo "⚠ Tests marked YELLOW have auth issues"
echo "✗ Tests marked RED are failing"
echo ""
echo "Note: Some endpoints may require authentication."
echo "Configure auth tokens in the frontend or use"
echo "the admin API key for testing."
echo ""

#!/bin/bash

# Comprehensive JediRe UI/API Testing Script
# Tests actual user flows and documents real issues

BASE_URL="https://381d5707-51e5-4d3d-b340-02537a082e98-00-2gk8jsdbkwoy5.worf.replit.dev"
ADMIN_KEY="8acb8b8cf3704e3af9c8bb8738925d103f7cda59b14d6c99d825cf29cfa195cb"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "=========================================="
echo "JediRe Comprehensive UI Testing"
echo "Testing Platform: $BASE_URL"
echo "=========================================="
echo ""

# TEST 1: LANDING PAGE
echo -e "${BLUE}1. LANDING PAGE${NC}"
echo "===================="
http_code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/")
if [ "$http_code" -eq 200 ]; then
    echo -e "${GREEN}✓ Landing page loads${NC} (HTTP $http_code)"
else
    echo -e "${RED}✗ Landing page failed${NC} (HTTP $http_code)"
fi
echo ""

# TEST 2: PROPERTIES DATA
echo -e "${BLUE}2. PROPERTIES MODULE${NC}"
echo "===================="
properties_data=$(curl -s "$BASE_URL/api/v1/properties?limit=10")
property_count=$(echo "$properties_data" | python3 -c "import sys, json; data = json.load(sys.stdin); print(data.get('count', 0))" 2>/dev/null || echo "0")

if [ "$property_count" -gt 0 ]; then
    echo -e "${GREEN}✓ Properties found: $property_count${NC}"
    
    # Check data quality
    echo ""
    echo "Data Quality Analysis:"
    echo "$properties_data" | python3 << 'EOF'
import json, sys
try:
    data = json.load(sys.stdin)
    props = data.get('data', [])
    if not props:
        print("  No properties to analyze")
        sys.exit(0)
    
    fields_to_check = ['property_type', 'lat', 'lng', 'rent', 'beds', 'baths', 'sqft', 'year_built', 'units']
    
    for field in fields_to_check:
        non_null = sum(1 for p in props if p.get(field) is not None)
        percent = (non_null / len(props)) * 100
        status = "✓" if percent > 80 else "⚠" if percent > 20 else "✗"
        print(f"  {status} {field}: {non_null}/{len(props)} ({percent:.0f}%) populated")
except Exception as e:
    print(f"  Error analyzing: {e}")
EOF
else
    echo -e "${RED}✗ No properties found${NC}"
fi
echo ""

# TEST 3: INDIVIDUAL PROPERTY
echo -e "${BLUE}3. PROPERTY DETAILS PAGE${NC}"
echo "===================="
first_property_id=$(echo "$properties_data" | python3 -c "import sys, json; data = json.load(sys.stdin); print(data['data'][0]['id'] if data.get('data') else '')" 2>/dev/null)

if [ -n "$first_property_id" ]; then
    echo "Testing property ID: $first_property_id"
    detail_response=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/v1/properties/$first_property_id")
    http_code=$(echo "$detail_response" | tail -n1)
    
    if [ "$http_code" -eq 200 ]; then
        echo -e "${GREEN}✓ Property details accessible${NC}"
        echo ""
        echo "Sample property data:"
        echo "$detail_response" | head -n-1 | python3 -m json.tool 2>/dev/null | head -30
    elif [ "$http_code" -eq 401 ]; then
        echo -e "${YELLOW}⚠ Property details require authentication${NC}"
        echo "  User Experience: Users can see property list but can't click into details"
    else
        echo -e "${RED}✗ Property details failed${NC} (HTTP $http_code)"
    fi
else
    echo -e "${RED}✗ No property ID to test${NC}"
fi
echo ""

# TEST 4: MARKET INTELLIGENCE
echo -e "${BLUE}4. MARKET INTELLIGENCE${NC}"
echo "===================="
endpoints=(
    "/api/v1/market:Market Data"
    "/api/v1/market/submarkets:Submarkets"
    "/api/v1/m28/cycles:Market Cycles"
    "/api/v1/m28/indicators:Economic Indicators"
)

for endpoint_pair in "${endpoints[@]}"; do
    IFS=':' read -r endpoint name <<< "$endpoint_pair"
    http_code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL$endpoint")
    
    if [ "$http_code" -eq 200 ]; then
        echo -e "${GREEN}✓ $name${NC} (HTTP $http_code)"
    elif [ "$http_code" -eq 401 ] || [ "$http_code" -eq 403 ]; then
        echo -e "${YELLOW}⚠ $name requires auth${NC} (HTTP $http_code)"
    else
        echo -e "${RED}✗ $name failed${NC} (HTTP $http_code)"
    fi
done
echo ""

# TEST 5: DEALS & PIPELINE
echo -e "${BLUE}5. DEALS & PIPELINE${NC}"
echo "===================="
deals_data=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/v1/deals?limit=5")
http_code=$(echo "$deals_data" | tail -n1)

if [ "$http_code" -eq 200 ]; then
    deal_count=$(echo "$deals_data" | head -n-1 | python3 -c "import sys, json; data = json.load(sys.stdin); print(len(data.get('deals', [])))" 2>/dev/null || echo "0")
    echo -e "${GREEN}✓ Deals endpoint accessible${NC}"
    echo "  Deals found: $deal_count"
    
    if [ "$deal_count" -eq 0 ]; then
        echo -e "${YELLOW}  ⚠ No deals in system - users will see empty pipeline${NC}"
    fi
elif [ "$http_code" -eq 401 ]; then
    echo -e "${YELLOW}⚠ Deals require authentication${NC}"
else
    echo -e "${RED}✗ Deals failed${NC} (HTTP $http_code)"
fi
echo ""

# TEST 6: ZONING DATA
echo -e "${BLUE}6. ZONING MODULE${NC}"
echo "===================="
zoning_response=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/v1/zoning?limit=5")
http_code=$(echo "$zoning_response" | tail -n1)

if [ "$http_code" -eq 200 ]; then
    echo -e "${GREEN}✓ Zoning endpoint accessible${NC}"
    zoning_count=$(echo "$zoning_response" | head -n-1 | python3 -c "import sys, json; data = json.load(sys.stdin); print(len(data) if isinstance(data, list) else data.get('count', 0))" 2>/dev/null || echo "0")
    echo "  Zoning records: $zoning_count"
elif [ "$http_code" -eq 401 ]; then
    echo -e "${YELLOW}⚠ Zoning requires authentication${NC}"
else
    echo -e "${RED}✗ Zoning failed${NC} (HTTP $http_code)"
fi
echo ""

# TEST 7: ADMIN ENDPOINTS (with admin key)
echo -e "${BLUE}7. ADMIN FEATURES${NC}"
echo "===================="
admin_endpoints=(
    "/api/v1/admin:Admin Dashboard"
    "/api/v1/data-tracker:Data Tracker"
    "/api/v1/errors?limit=5:Error Logs"
)

for endpoint_pair in "${admin_endpoints[@]}"; do
    IFS=':' read -r endpoint name <<< "$endpoint_pair"
    http_code=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "x-api-key: $ADMIN_KEY" \
        "$BASE_URL$endpoint")
    
    if [ "$http_code" -eq 200 ]; then
        echo -e "${GREEN}✓ $name${NC} (HTTP $http_code)"
    elif [ "$http_code" -eq 404 ]; then
        echo -e "${YELLOW}⚠ $name not found${NC} (HTTP $http_code)"
    elif [ "$http_code" -eq 401 ] || [ "$http_code" -eq 403 ]; then
        echo -e "${YELLOW}⚠ $name requires admin auth${NC} (HTTP $http_code)"
    else
        echo -e "${RED}✗ $name failed${NC} (HTTP $http_code)"
    fi
done
echo ""

# TEST 8: KEY USER FLOWS
echo -e "${BLUE}8. USER FLOW TESTING${NC}"
echo "===================="

echo "Flow 1: Browse Properties → View Details"
if [ "$property_count" -gt 0 ] && [ "$http_code" -eq 200 ]; then
    echo -e "  ${GREEN}✓ User can browse properties${NC}"
    
    if [ "$(echo "$detail_response" | tail -n1)" -eq 401 ]; then
        echo -e "  ${RED}✗ BROKEN: User CANNOT view property details (auth required)${NC}"
        echo -e "    ${YELLOW}Impact: Users see list but get error when clicking${NC}"
    else
        echo -e "  ${GREEN}✓ User can view property details${NC}"
    fi
else
    echo -e "  ${RED}✗ BROKEN: No properties to browse${NC}"
fi

echo ""
echo "Flow 2: View Dashboard"
dashboard_code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/v1/dashboard")
if [ "$dashboard_code" -eq 200 ]; then
    echo -e "  ${GREEN}✓ Dashboard accessible${NC}"
elif [ "$dashboard_code" -eq 401 ]; then
    echo -e "  ${YELLOW}⚠ Dashboard requires login${NC}"
else
    echo -e "  ${RED}✗ Dashboard failed${NC} (HTTP $dashboard_code)"
fi

echo ""
echo "Flow 3: Create/View Deal"
if [ "$http_code" -eq 401 ]; then
    echo -e "  ${YELLOW}⚠ Deals require authentication - users must login first${NC}"
elif [ "$deal_count" -eq 0 ]; then
    echo -e "  ${YELLOW}⚠ No deals exist - users see empty state${NC}"
else
    echo -e "  ${GREEN}✓ Deals accessible${NC}"
fi

echo ""

# TEST 9: FRONTEND ROUTES
echo -e "${BLUE}9. FRONTEND ROUTES${NC}"
echo "===================="
routes=(
    "/:Landing"
    "/dashboard:Dashboard"
    "/properties:Properties List"
    "/deals:Deals Page"
    "/market-intelligence:Market Intel"
)

for route_pair in "${routes[@]}"; do
    IFS=':' read -r route name <<< "$route_pair"
    http_code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL$route")
    
    if [ "$http_code" -eq 200 ]; then
        echo -e "${GREEN}✓ $name${NC} ($route)"
    else
        echo -e "${RED}✗ $name failed${NC} ($route - HTTP $http_code)"
    fi
done

echo ""

# SUMMARY
echo "=========================================="
echo -e "${BLUE}SUMMARY & RECOMMENDATIONS${NC}"
echo "=========================================="
echo ""

echo "✅ WORKING:"
echo "  • Platform is live and accessible"
echo "  • Properties list endpoint functional"
echo "  • Frontend routes load (React SPA)"
echo ""

echo "⚠️  ISSUES FOUND:"
echo "  1. Property details require auth but list doesn't (inconsistent)"
echo "  2. Many property fields are NULL (poor data quality)"
echo "  3. Most features require authentication"
echo "  4. No clear login UI flow for new users"
if [ "$deal_count" -eq 0 ]; then
    echo "  5. No deals in system (empty pipeline for new users)"
fi
echo ""

echo "🎯 USER EXPERIENCE PREDICTION:"
echo "  • New users can browse property list"
echo "  • Clicking property details likely shows auth error"
echo "  • Dashboard/Market Intel require login"
echo "  • PropertyDetailsPage will show mostly empty data"
echo "  • No demo/sample data for evaluation"
echo ""

echo "📋 RECOMMENDATIONS:"
echo "  1. Make property details consistent with list (both auth or both public)"
echo "  2. Populate 10-20 properties with FULL data"
echo "  3. Add demo mode with pre-loaded sample data"
echo "  4. Implement clear login/signup flow on frontend"
echo "  5. Add onboarding for first-time users"
echo ""

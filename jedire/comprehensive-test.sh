#!/bin/bash

SERVER="https://381d5707-51e5-4d3d-b340-02537a082e98-00-2gk8jsdbkwoy5.worf.replit.dev"
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2MjUzYmEzZi1kNDBkLTQ1OTctODZhYi0yNzBjODM5N2E4NTciLCJlbWFpbCI6ImRlbW9AamVkaXJlLmNvbSIsInJvbGUiOiJpbnZlc3RvciIsImlhdCI6MTc3MjUxNTYwMiwiZXhwIjoxNzczMTIwNDAyLCJhdWQiOiJqZWRpcmUtY2xpZW50IiwiaXNzIjoiamVkaXJlLWFwaSJ9.dvQ4nQZKX_wjsvXo_8AS50IzfNhopEWXX02Z_uB64tk"

# Test deal IDs
DEAL_ID="e044db04-439b-4442-82df-b36a840f2fd8"
DEAL_ID2="19bb2bb5-5933-4d91-972e-41664b2a847f"
DEAL_ID3="8aa4c42a-9f1f-47ba-b9d4-9def37b0b323"

REPORT_FILE="test-results-$(date +%Y%m%d-%H%M%S).md"

exec > >(tee -a "$REPORT_FILE")
exec 2>&1

echo "# JediRe Platform Live Testing Report"
echo "**Started:** $(date)"
echo "**Server:** $SERVER"
echo ""
echo "## Test Configuration"
echo "- User: demo@jedire.com"
echo "- Test Deals: $DEAL_ID, $DEAL_ID2, $DEAL_ID3"
echo ""
echo "---"
echo ""

test_endpoint() {
    local NAME="$1"
    local METHOD="$2"
    local ENDPOINT="$3"
    local EXPECTED_STATUS="$4"
    local EXTRA_OPTS="$5"
    
    echo "### $NAME"
    echo "**Endpoint:** $METHOD $ENDPOINT"
    
    START=$(date +%s%N)
    if [ "$METHOD" = "GET" ]; then
        RESPONSE=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $TOKEN" $EXTRA_OPTS "$SERVER$ENDPOINT")
    elif [ "$METHOD" = "POST" ]; then
        RESPONSE=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" $EXTRA_OPTS "$SERVER$ENDPOINT")
    fi
    END=$(date +%s%N)
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -1)
    BODY=$(echo "$RESPONSE" | head -n -1)
    TIME_NS=$((END - START))
    TIME_MS=$((TIME_NS / 1000000))
    
    echo "- **Status:** $HTTP_CODE"
    echo "- **Response Time:** ${TIME_MS}ms"
    
    if [ "$HTTP_CODE" = "$EXPECTED_STATUS" ]; then
        echo "- **Result:** ✓ PASS"
    elif [ "$HTTP_CODE" = "404" ] && [ "$EXPECTED_STATUS" = "200" ]; then
        echo "- **Result:** ⚠ NOT FOUND (endpoint may not exist)"
    elif [ "$HTTP_CODE" = "500" ]; then
        echo "- **Result:** ✗ FAIL - Server Error"
        echo "- **Error:** \`\`\`json"
        echo "$BODY" | head -10
        echo "\`\`\`"
    else
        echo "- **Result:** ✗ FAIL (expected $EXPECTED_STATUS, got $HTTP_CODE)"
    fi
    
    # Parse and display key data
    if [ "$HTTP_CODE" = "200" ] && echo "$BODY" | python3 -c "import sys,json; json.load(sys.stdin)" 2>/dev/null; then
        echo "- **Sample Data:**"
        echo "$BODY" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    # Print first few keys
    if isinstance(data, dict):
        keys = list(data.keys())[:5]
        print('  Keys:', ', '.join(keys))
        # Print counts if available
        for k in ['deals', 'properties', 'rankings', 'competitors', 'tasks', 'intelligence']:
            if k in data and isinstance(data[k], list):
                print(f'  {k}: {len(data[k])} items')
except:
    pass
" 2>/dev/null
    fi
    
    echo ""
}

echo "## 1. Authentication & Core Endpoints"
echo ""
test_endpoint "Auth - Get Current User" "GET" "/api/v1/auth/me" "200"
test_endpoint "Deals - List All" "GET" "/api/v1/deals" "200"
test_endpoint "Deal - Get Single" "GET" "/api/v1/deals/$DEAL_ID" "200"

echo "## 2. Market Intelligence Endpoints"
echo ""
test_endpoint "Market Intelligence for Deal" "GET" "/api/v1/deals/$DEAL_ID/market-intelligence" "200"
test_endpoint "Market Preferences" "GET" "/api/v1/markets/preferences" "200"
test_endpoint "Market Overview" "GET" "/api/v1/markets/overview" "200"

echo "## 3. Competition Analysis"
echo ""
test_endpoint "Deal Competitors" "GET" "/api/v1/deals/$DEAL_ID/competitors" "200"
test_endpoint "Deal Competitors (with filters)" "GET" "/api/v1/deals/$DEAL_ID/competitors?sameVintage=true&distanceRadius=2" "200"

echo "## 4. Rankings & Scoring"
echo ""
test_endpoint "Property Rankings" "GET" "/api/v1/rankings/properties" "200"
test_endpoint "Property Rankings (Deal-specific)" "GET" "/api/v1/rankings/properties?dealId=$DEAL_ID" "200"

echo "## 5. Supply & Demand"
echo ""
test_endpoint "Supply Data" "GET" "/api/v1/deals/$DEAL_ID/supply" "200"
test_endpoint "Demand Data" "GET" "/api/v1/deals/$DEAL_ID/demand" "200"

echo "## 6. Tasks & Workflow"
echo ""
test_endpoint "Tasks - List All" "GET" "/api/v1/tasks" "200"
test_endpoint "Tasks - Deal-specific" "GET" "/api/v1/tasks?dealId=$DEAL_ID" "200"

echo "## 7. Dashboard & Analytics"
echo ""
test_endpoint "Dashboard" "GET" "/api/v1/dashboard" "200"
test_endpoint "Dashboard Stats" "GET" "/api/v1/dashboard/stats" "200"

echo "## 8. Financial & Proforma"
echo ""
test_endpoint "Financial Models" "GET" "/api/v1/financial-models" "200"
test_endpoint "Deal Proforma" "GET" "/api/v1/deals/$DEAL_ID/proforma" "200"

echo "## 9. Zoning & Intelligence"
echo ""
test_endpoint "Zoning Analysis" "GET" "/api/v1/deals/$DEAL_ID/zoning-analysis" "200"
test_endpoint "Zoning Intelligence" "GET" "/api/v1/zoning-intelligence" "200"

echo "## 10. Geographic & Trade Areas"
echo ""
test_endpoint "Trade Areas" "GET" "/api/v1/trade-areas" "200"
test_endpoint "Deal Trade Area" "GET" "/api/v1/deals/$DEAL_ID/trade-area" "200"

echo "---"
echo ""
echo "## Test Summary"
echo "**Completed:** $(date)"
echo "**Report saved to:** $REPORT_FILE"

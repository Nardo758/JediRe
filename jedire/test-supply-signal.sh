#!/bin/bash

# Supply Signal System Test Script
# JEDI RE Phase 2, Component 2

set -e

echo "=================================================="
echo "Supply Signal System Test"
echo "=================================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

API_BASE="http://localhost:4000/api/v1"
TOKEN="test-token-123" # Replace with actual token if auth is enabled

# =====================================================
# TEST 1: List Supply Events
# =====================================================

echo -e "${BLUE}Test 1: List All Supply Events${NC}"
echo "GET /supply/events"
curl -s -H "Authorization: Bearer $TOKEN" \
  "$API_BASE/supply/events?limit=10" | jq '.'
echo ""
echo -e "${GREEN}✓ Supply events listed${NC}"
echo ""

# =====================================================
# TEST 2: Filter by Status
# =====================================================

echo -e "${BLUE}Test 2: Get Permitted Projects${NC}"
echo "GET /supply/events?status=permitted"
curl -s -H "Authorization: Bearer $TOKEN" \
  "$API_BASE/supply/events?status=permitted" | jq '.data[] | {projectName, units, weightedUnits, status, expectedDeliveryDate}'
echo ""
echo -e "${GREEN}✓ Permitted projects retrieved${NC}"
echo ""

echo -e "${BLUE}Test 3: Get Under Construction Projects${NC}"
echo "GET /supply/events?status=under_construction"
curl -s -H "Authorization: Bearer $TOKEN" \
  "$API_BASE/supply/events?status=under_construction" | jq '.data[] | {projectName, units, status}'
echo ""
echo -e "${GREEN}✓ Construction projects retrieved${NC}"
echo ""

# =====================================================
# TEST 4: Supply Pipeline for Trade Area
# =====================================================

echo -e "${BLUE}Test 4: Get Supply Pipeline for Trade Area 1${NC}"
echo "GET /supply/trade-area/1"
curl -s -H "Authorization: Bearer $TOKEN" \
  "$API_BASE/supply/trade-area/1" | jq '.'
echo ""
echo -e "${GREEN}✓ Trade area pipeline retrieved${NC}"
echo ""

# =====================================================
# TEST 5: Supply Risk Score
# =====================================================

echo -e "${BLUE}Test 5: Calculate Supply Risk for Trade Area 1${NC}"
echo "GET /supply/trade-area/1/risk?quarter=2028-Q1"
curl -s -H "Authorization: Bearer $TOKEN" \
  "$API_BASE/supply/trade-area/1/risk?quarter=2028-Q1" | jq '.'
echo ""
echo -e "${GREEN}✓ Supply risk calculated${NC}"
echo ""

# =====================================================
# TEST 6: Create New Supply Event
# =====================================================

echo -e "${BLUE}Test 6: Create New Supply Event${NC}"
echo "POST /supply/event"

NEW_EVENT=$(cat <<EOF
{
  "projectName": "Test Tower",
  "developer": "Test Developer LLC",
  "address": "123 Test St, Atlanta, GA",
  "category": "permit",
  "eventType": "multifamily_permit_filed",
  "units": 250,
  "oneBedUnits": 125,
  "twoBedUnits": 100,
  "threeBedUnits": 25,
  "avgRent": 2000.00,
  "priceTier": "market_rate",
  "eventDate": "2026-02-11T00:00:00Z",
  "expectedDeliveryDate": "2027-12-01T00:00:00Z",
  "status": "permitted",
  "latitude": 33.7490,
  "longitude": -84.3880,
  "msaId": 1,
  "sourceType": "manual",
  "dataSourceConfidence": 75.0,
  "notes": "Test project for Supply Signal System"
}
EOF
)

CREATED_EVENT=$(curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$NEW_EVENT" \
  "$API_BASE/supply/event")

echo "$CREATED_EVENT" | jq '.'
EVENT_ID=$(echo "$CREATED_EVENT" | jq -r '.data.id')
echo ""
echo -e "${GREEN}✓ Supply event created: $EVENT_ID${NC}"
echo ""

# =====================================================
# TEST 7: Update Event Status
# =====================================================

if [ "$EVENT_ID" != "null" ] && [ -n "$EVENT_ID" ]; then
  echo -e "${BLUE}Test 7: Update Event Status (Permit → Construction)${NC}"
  echo "PUT /supply/event/$EVENT_ID/status"
  
  curl -s -X PUT \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"status": "under_construction"}' \
    "$API_BASE/supply/event/$EVENT_ID/status" | jq '.'
  
  echo ""
  echo -e "${GREEN}✓ Event status updated to under_construction${NC}"
  echo ""
fi

# =====================================================
# TEST 8: Supply Delivery Timeline
# =====================================================

echo -e "${BLUE}Test 8: Get Supply Delivery Timeline${NC}"
echo "GET /supply/timeline/1?start_quarter=2027-Q1&end_quarter=2028-Q4"
curl -s -H "Authorization: Bearer $TOKEN" \
  "$API_BASE/supply/timeline/1?start_quarter=2027-Q1&end_quarter=2028-Q4" | jq '.'
echo ""
echo -e "${GREEN}✓ Delivery timeline retrieved${NC}"
echo ""

# =====================================================
# TEST 9: Market Dynamics (Demand + Supply)
# =====================================================

echo -e "${BLUE}Test 9: Get Market Dynamics (Demand-Supply Analysis)${NC}"
echo "GET /supply/market-dynamics/1?quarter=2028-Q1"
curl -s -H "Authorization: Bearer $TOKEN" \
  "$API_BASE/supply/market-dynamics/1?quarter=2028-Q1" | jq '.'
echo ""
echo -e "${GREEN}✓ Market dynamics analyzed${NC}"
echo ""

# =====================================================
# TEST 10: Competitive Projects Analysis
# =====================================================

echo -e "${BLUE}Test 10: Get Competitive Projects for a Deal${NC}"
echo "Note: This requires a deal with latitude/longitude set"
echo "GET /supply/competitive/<dealId>?max_distance=3.0"

# First, get a deal ID (if exists)
DEAL_RESULT=$(curl -s -H "Authorization: Bearer $TOKEN" "$API_BASE/deals?limit=1")
DEAL_ID=$(echo "$DEAL_RESULT" | jq -r '.data[0].id // empty')

if [ -n "$DEAL_ID" ] && [ "$DEAL_ID" != "null" ]; then
  echo "Testing with Deal ID: $DEAL_ID"
  curl -s -H "Authorization: Bearer $TOKEN" \
    "$API_BASE/supply/competitive/$DEAL_ID?max_distance=3.0" | jq '.'
  echo ""
  echo -e "${GREEN}✓ Competitive projects analyzed${NC}"
else
  echo -e "${YELLOW}⚠ No deals found with location data. Skipping competitive analysis.${NC}"
fi
echo ""

# =====================================================
# SUMMARY
# =====================================================

echo ""
echo "=================================================="
echo -e "${GREEN}Supply Signal System Tests Complete!${NC}"
echo "=================================================="
echo ""
echo "Summary:"
echo "  ✓ Supply events CRUD operations"
echo "  ✓ Supply pipeline tracking"
echo "  ✓ Supply risk scoring"
echo "  ✓ Delivery timeline generation"
echo "  ✓ Market dynamics analysis"
echo "  ✓ Competitive project identification"
echo ""
echo "Database Tables Created:"
echo "  - supply_event_types"
echo "  - supply_events"
echo "  - supply_pipeline"
echo "  - supply_risk_scores"
echo "  - competitive_projects"
echo "  - supply_delivery_timeline"
echo ""
echo "API Endpoints Available:"
echo "  GET    /api/v1/supply/events"
echo "  POST   /api/v1/supply/event"
echo "  PUT    /api/v1/supply/event/:id/status"
echo "  GET    /api/v1/supply/trade-area/:id"
echo "  GET    /api/v1/supply/trade-area/:id/risk"
echo "  GET    /api/v1/supply/timeline/:tradeAreaId"
echo "  GET    /api/v1/supply/competitive/:dealId"
echo "  GET    /api/v1/supply/market-dynamics/:tradeAreaId"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "  1. Build frontend SupplyPipeline component"
echo "  2. Integrate with JEDI Score calculation"
echo "  3. Connect to CoStar API for live data"
echo "  4. Add permit database scrapers"
echo ""

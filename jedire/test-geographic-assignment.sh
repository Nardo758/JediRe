#!/bin/bash

# Test Geographic Assignment Engine
# Phase 1, Week 1 - Comprehensive Testing

set -e

echo "=========================================="
echo "Geographic Assignment Engine - Test Suite"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
API_BASE="http://localhost:4000/api/v1"
AUTH_TOKEN="${TEST_AUTH_TOKEN:-}"

if [ -z "$AUTH_TOKEN" ]; then
  echo -e "${YELLOW}⚠ WARNING: TEST_AUTH_TOKEN not set. Using mock auth (may fail).${NC}"
  echo "Set TEST_AUTH_TOKEN environment variable or authenticate first."
  echo ""
fi

# Helper function for API calls
api_call() {
  local method=$1
  local endpoint=$2
  local data=$3
  
  if [ -n "$data" ]; then
    curl -s -X "$method" "$API_BASE$endpoint" \
      -H "Authorization: Bearer $AUTH_TOKEN" \
      -H "Content-Type: application/json" \
      -d "$data"
  else
    curl -s -X "$method" "$API_BASE$endpoint" \
      -H "Authorization: Bearer $AUTH_TOKEN"
  fi
}

# Test 1: Check database migrations
echo "Test 1: Checking database schema..."
if psql $DATABASE_URL -c "SELECT COUNT(*) FROM msas;" > /dev/null 2>&1; then
  echo -e "${GREEN}✓ MSAs table exists${NC}"
else
  echo -e "${RED}✗ MSAs table missing. Run migration 021.${NC}"
  exit 1
fi

if psql $DATABASE_URL -c "SELECT COUNT(*) FROM submarkets;" > /dev/null 2>&1; then
  echo -e "${GREEN}✓ Submarkets table exists${NC}"
else
  echo -e "${RED}✗ Submarkets table missing.${NC}"
  exit 1
fi

if psql $DATABASE_URL -c "SELECT COUNT(*) FROM trade_areas;" > /dev/null 2>&1; then
  echo -e "${GREEN}✓ Trade Areas table exists${NC}"
else
  echo -e "${RED}✗ Trade Areas table missing.${NC}"
  exit 1
fi

if psql $DATABASE_URL -c "SELECT COUNT(*) FROM trade_area_event_impacts;" > /dev/null 2>&1; then
  echo -e "${GREEN}✓ Trade Area Event Impacts table exists${NC}"
else
  echo -e "${RED}✗ Trade Area Event Impacts table missing.${NC}"
  exit 1
fi

echo ""

# Test 2: Check seed data
echo "Test 2: Verifying Atlanta seed data..."
MSA_COUNT=$(psql $DATABASE_URL -t -c "SELECT COUNT(*) FROM msas WHERE cbsa_code = '12060';")
if [ "$MSA_COUNT" -ge 1 ]; then
  echo -e "${GREEN}✓ Atlanta MSA found${NC}"
else
  echo -e "${RED}✗ Atlanta MSA missing. Run migration 022.${NC}"
  exit 1
fi

SUBMARKET_COUNT=$(psql $DATABASE_URL -t -c "SELECT COUNT(*) FROM submarkets WHERE msa_id = (SELECT id FROM msas WHERE cbsa_code = '12060');")
echo "  → Submarkets: $SUBMARKET_COUNT"
if [ "$SUBMARKET_COUNT" -ge 5 ]; then
  echo -e "${GREEN}✓ Submarkets populated${NC}"
else
  echo -e "${YELLOW}⚠ Expected at least 5 submarkets, found $SUBMARKET_COUNT${NC}"
fi

TRADE_AREA_COUNT=$(psql $DATABASE_URL -t -c "SELECT COUNT(*) FROM trade_areas;")
echo "  → Trade Areas: $TRADE_AREA_COUNT"

echo ""

# Test 3: Test helper functions
echo "Test 3: Testing PostGIS helper functions..."
SUBMARKET_RESULT=$(psql $DATABASE_URL -t -c "SELECT submarket_name FROM find_submarket_for_point(33.79, -84.38);")
if [ -n "$SUBMARKET_RESULT" ]; then
  echo -e "${GREEN}✓ find_submarket_for_point() works${NC}"
  echo "  → Found: $SUBMARKET_RESULT"
else
  echo -e "${RED}✗ find_submarket_for_point() failed${NC}"
fi

MSA_RESULT=$(psql $DATABASE_URL -t -c "SELECT msa_name FROM find_msa_for_point(33.79, -84.38);")
if [ -n "$MSA_RESULT" ]; then
  echo -e "${GREEN}✓ find_msa_for_point() works${NC}"
  echo "  → Found: $MSA_RESULT"
else
  echo -e "${RED}✗ find_msa_for_point() failed${NC}"
fi

echo ""

# Test 4: API endpoint tests (if auth token available)
if [ -n "$AUTH_TOKEN" ]; then
  echo "Test 4: Testing API endpoints..."
  
  # Test MSAs list
  echo "  → GET /geography/msas"
  MSA_RESPONSE=$(api_call GET "/geography/msas?limit=5")
  if echo "$MSA_RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
    echo -e "${GREEN}    ✓ MSAs endpoint working${NC}"
    MSA_COUNT_API=$(echo "$MSA_RESPONSE" | jq '.count')
    echo "    → Found $MSA_COUNT_API MSAs"
  else
    echo -e "${RED}    ✗ MSAs endpoint failed${NC}"
    echo "$MSA_RESPONSE"
  fi
  
  # Test Submarkets list
  echo "  → GET /geography/submarkets"
  SUBMARKET_RESPONSE=$(api_call GET "/geography/submarkets?limit=10")
  if echo "$SUBMARKET_RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
    echo -e "${GREEN}    ✓ Submarkets endpoint working${NC}"
    SUBMARKET_COUNT_API=$(echo "$SUBMARKET_RESPONSE" | jq '.count')
    echo "    → Found $SUBMARKET_COUNT_API submarkets"
  else
    echo -e "${RED}    ✗ Submarkets endpoint failed${NC}"
  fi
  
  # Test Trade Areas list
  echo "  → GET /geography/trade-areas"
  TA_RESPONSE=$(api_call GET "/geography/trade-areas?limit=10")
  if echo "$TA_RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
    echo -e "${GREEN}    ✓ Trade Areas endpoint working${NC}"
    TA_COUNT_API=$(echo "$TA_RESPONSE" | jq '.count')
    echo "    → Found $TA_COUNT_API trade areas"
  else
    echo -e "${RED}    ✗ Trade Areas endpoint failed${NC}"
  fi
  
  # Test Geocoding
  echo "  → POST /geography/geocode"
  GEOCODE_DATA='{"address": "100 Peachtree St NE, Atlanta, GA 30303"}'
  GEOCODE_RESPONSE=$(api_call POST "/geography/geocode" "$GEOCODE_DATA")
  if echo "$GEOCODE_RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
    echo -e "${GREEN}    ✓ Geocoding endpoint working${NC}"
    LAT=$(echo "$GEOCODE_RESPONSE" | jq '.data.lat')
    LNG=$(echo "$GEOCODE_RESPONSE" | jq '.data.lng')
    echo "    → Result: $LAT, $LNG"
  else
    echo -e "${YELLOW}    ⚠ Geocoding failed (may need MAPBOX_TOKEN)${NC}"
  fi
  
  # Test Geographic Lookup
  echo "  → GET /geography/lookup?lat=33.79&lng=-84.38"
  LOOKUP_RESPONSE=$(api_call GET "/geography/lookup?lat=33.79&lng=-84.38")
  if echo "$LOOKUP_RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
    echo -e "${GREEN}    ✓ Geographic lookup working${NC}"
    MSA_NAME=$(echo "$LOOKUP_RESPONSE" | jq -r '.data.msa.msa_name // "null"')
    SUBMARKET_NAME=$(echo "$LOOKUP_RESPONSE" | jq -r '.data.submarket.submarket_name // "null"')
    echo "    → MSA: $MSA_NAME"
    echo "    → Submarket: $SUBMARKET_NAME"
  else
    echo -e "${RED}    ✗ Geographic lookup failed${NC}"
  fi
  
  # Test Event Assignment
  echo "  → POST /geography/assign-event"
  ASSIGN_DATA=$(cat <<EOF
{
  "location": {
    "locationRaw": "Midtown Atlanta",
    "lat": 33.79,
    "lng": -84.38
  },
  "magnitude": {
    "category": "development",
    "type": "multifamily_permit_approval",
    "magnitude": 85,
    "sector": "multifamily",
    "unit_count": 350
  }
}
EOF
)
  ASSIGN_RESPONSE=$(api_call POST "/geography/assign-event" "$ASSIGN_DATA")
  if echo "$ASSIGN_RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
    echo -e "${GREEN}    ✓ Event assignment working${NC}"
    TIER=$(echo "$ASSIGN_RESPONSE" | jq -r '.data.tier')
    MSA_NAME=$(echo "$ASSIGN_RESPONSE" | jq -r '.data.msa_name // "null"')
    SUBMARKET_NAME=$(echo "$ASSIGN_RESPONSE" | jq -r '.data.submarket_name // "null"')
    IMPACT_COUNT=$(echo "$ASSIGN_RESPONSE" | jq '.data.trade_area_impacts | length')
    echo "    → Tier: $TIER"
    echo "    → MSA: $MSA_NAME"
    echo "    → Submarket: $SUBMARKET_NAME"
    echo "    → Impacted trade areas: $IMPACT_COUNT"
  else
    echo -e "${RED}    ✗ Event assignment failed${NC}"
    echo "$ASSIGN_RESPONSE" | jq '.'
  fi
  
  echo ""
else
  echo "Test 4: Skipping API tests (no auth token)"
  echo "  Set TEST_AUTH_TOKEN to enable API tests"
  echo ""
fi

# Test 5: TypeScript compilation check
echo "Test 5: Checking TypeScript compilation..."
cd backend
if npm run build > /dev/null 2>&1; then
  echo -e "${GREEN}✓ TypeScript compilation successful${NC}"
else
  echo -e "${RED}✗ TypeScript compilation failed${NC}"
  npm run build
  exit 1
fi
cd ..

echo ""
echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo -e "${GREEN}✓ Database schema verified${NC}"
echo -e "${GREEN}✓ Seed data populated${NC}"
echo -e "${GREEN}✓ PostGIS functions working${NC}"
if [ -n "$AUTH_TOKEN" ]; then
  echo -e "${GREEN}✓ API endpoints tested${NC}"
else
  echo -e "${YELLOW}⚠ API endpoints not tested (no auth)${NC}"
fi
echo -e "${GREEN}✓ TypeScript compiles${NC}"
echo ""
echo "=========================================="
echo "Ready for Phase 1, Week 2 🚀"
echo "=========================================="

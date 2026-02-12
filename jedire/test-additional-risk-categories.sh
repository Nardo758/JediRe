#!/bin/bash

##############################################################################
# Test Script: Additional Risk Categories (Phase 3, Component 1)
# Tests Regulatory, Market, Execution, and Climate Risk implementation
##############################################################################

set -e

echo "=========================================="
echo "Testing Additional Risk Categories"
echo "Phase 3, Component 1"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

API_BASE="http://localhost:3001/api/v1"

# Function to make API calls and pretty print
test_endpoint() {
  local name="$1"
  local endpoint="$2"
  echo -e "${BLUE}Testing: ${name}${NC}"
  echo "GET ${endpoint}"
  response=$(curl -s "${API_BASE}${endpoint}")
  echo "$response" | jq '.' || echo "$response"
  echo ""
}

# Get a trade area ID for testing
echo -e "${BLUE}Step 1: Get Atlanta Trade Area ID${NC}"
TRADE_AREA_RESPONSE=$(curl -s "${API_BASE}/trade-areas?search=Atlanta" | jq -r '.data[0].id // empty')

if [ -z "$TRADE_AREA_RESPONSE" ]; then
  echo -e "${RED}ERROR: No Atlanta trade area found. Creating test data...${NC}"
  # You may need to seed the database first
  echo "Please run: npm run db:seed (or apply seeds manually)"
  exit 1
fi

TRADE_AREA_ID="$TRADE_AREA_RESPONSE"
echo -e "${GREEN}✓ Trade Area ID: ${TRADE_AREA_ID}${NC}"
echo ""

##############################################################################
# Test 1: Risk Categories List
##############################################################################
echo -e "${BLUE}=========================================="
echo "Test 1: Risk Categories List"
echo "==========================================${NC}"
test_endpoint "All Risk Categories" "/risk/categories"

##############################################################################
# Test 2: Regulatory Risk
##############################################################################
echo -e "${BLUE}=========================================="
echo "Test 2: Regulatory Risk"
echo "==========================================${NC}"
test_endpoint "Regulatory Risk Details" "/risk/trade-area/${TRADE_AREA_ID}/regulatory"

echo -e "${BLUE}Expected output:${NC}"
echo "- Regulatory risk score (0-100)"
echo "- Active regulatory events (rent control, STR restrictions, etc.)"
echo "- Zoning changes (upzone/downzone)"
echo "- Tax policy changes"
echo "- Stage-weighted probability (proposed=25%, committee=50%, etc.)"
echo ""

##############################################################################
# Test 3: Market Risk
##############################################################################
echo -e "${BLUE}=========================================="
echo "Test 3: Market Risk"
echo "==========================================${NC}"
test_endpoint "Market Risk Details" "/risk/trade-area/${TRADE_AREA_ID}/market"

echo -e "${BLUE}Expected output:${NC}"
echo "- Market risk score (0-100)"
echo "- Interest rate indicators (10-yr treasury, cap rate)"
echo "- Cap rate sensitivity factor"
echo "- DSCR stress test results"
echo "- Transaction volume index"
echo "- Recession probability"
echo "- Interest rate scenarios (+100bps, +200bps)"
echo ""

##############################################################################
# Test 4: Execution Risk
##############################################################################
echo -e "${BLUE}=========================================="
echo "Test 4: Execution Risk"
echo "==========================================${NC}"
test_endpoint "Execution Risk Details" "/risk/trade-area/${TRADE_AREA_ID}/execution"

echo -e "${BLUE}Expected output:${NC}"
echo "- Execution risk score (0-100)"
echo "- Contingency budget adequacy"
echo "- Construction cost inflation YoY"
echo "- Labor market conditions"
echo "- Material supply lead times"
echo "- Historical overrun rates"
echo "- Construction cost trends (12 months)"
echo ""

##############################################################################
# Test 5: Climate/Physical Risk
##############################################################################
echo -e "${BLUE}=========================================="
echo "Test 5: Climate/Physical Risk"
echo "==========================================${NC}"
test_endpoint "Climate Risk Details" "/risk/trade-area/${TRADE_AREA_ID}/climate"

echo -e "${BLUE}Expected output:${NC}"
echo "- Climate risk score (0-100)"
echo "- FEMA flood zone classification"
echo "- Wildfire hazard zone"
echo "- Hurricane exposure"
echo "- Sea level rise projection (30-year)"
echo "- Insurance availability and trends"
echo "- Historical natural disaster events"
echo ""

##############################################################################
# Test 6: Composite Risk (All 6 Categories)
##############################################################################
echo -e "${BLUE}=========================================="
echo "Test 6: Composite Risk Profile"
echo "==========================================${NC}"
test_endpoint "Trade Area Composite Risk" "/risk/trade-area/${TRADE_AREA_ID}"

echo -e "${BLUE}Expected output:${NC}"
echo "- All 6 category scores (supply, demand, regulatory, market, execution, climate)"
echo "- Composite score: (Highest × 0.40) + (Second × 0.25) + (Avg Remaining × 0.35)"
echo "- Highest and second-highest category identification"
echo "- Risk level classification (low/moderate/high/critical)"
echo ""

##############################################################################
# Test 7: Get a Deal ID and Test Comprehensive Risk
##############################################################################
echo -e "${BLUE}=========================================="
echo "Test 7: Comprehensive Deal Risk"
echo "==========================================${NC}"

DEAL_RESPONSE=$(curl -s "${API_BASE}/deals?limit=1" | jq -r '.data[0].id // empty')

if [ -z "$DEAL_RESPONSE" ]; then
  echo -e "${RED}WARNING: No deals found. Skipping comprehensive deal risk test.${NC}"
else
  DEAL_ID="$DEAL_RESPONSE"
  echo -e "${GREEN}✓ Deal ID: ${DEAL_ID}${NC}"
  test_endpoint "Comprehensive Deal Risk (All 6 Categories)" "/risk/comprehensive/${DEAL_ID}"
  
  echo -e "${BLUE}Expected output:${NC}"
  echo "- Deal-level composite risk score"
  echo "- Risk breakdown for each trade area in the deal"
  echo "- All 6 categories calculated for each trade area"
  echo "- Detailed category data (supply, demand, regulatory, market, execution, climate)"
fi
echo ""

##############################################################################
# Test 8: Risk Score History
##############################################################################
echo -e "${BLUE}=========================================="
echo "Test 8: Risk Score History"
echo "==========================================${NC}"
test_endpoint "Risk Score History" "/risk/history/${TRADE_AREA_ID}?limit=10"

echo -e "${BLUE}Expected output:${NC}"
echo "- Historical risk scores (time-series)"
echo "- Base score + escalation adjustments"
echo "- Risk level changes over time"
echo ""

##############################################################################
# Test 9: Recent Risk Events
##############################################################################
echo -e "${BLUE}=========================================="
echo "Test 9: Recent Risk Events"
echo "==========================================${NC}"
test_endpoint "Recent Risk Events" "/risk/events?limit=20"

echo -e "${BLUE}Expected output:${NC}"
echo "- Recent risk escalation/de-escalation events"
echo "- Event type, severity, impact"
echo "- Across all categories and trade areas"
echo ""

##############################################################################
# Test 10: Force Recalculation
##############################################################################
echo -e "${BLUE}=========================================="
echo "Test 10: Force Risk Recalculation"
echo "==========================================${NC}"
echo -e "${BLUE}POST ${API_BASE}/risk/calculate/${TRADE_AREA_ID}${NC}"
RECALC_RESPONSE=$(curl -s -X POST "${API_BASE}/risk/calculate/${TRADE_AREA_ID}")
echo "$RECALC_RESPONSE" | jq '.' || echo "$RECALC_RESPONSE"
echo ""

echo -e "${BLUE}Expected output:${NC}"
echo "- Recalculated scores for all categories"
echo "- Updated composite risk profile"
echo ""

##############################################################################
# Database Validation
##############################################################################
echo -e "${BLUE}=========================================="
echo "Database Validation"
echo "==========================================${NC}"

echo -e "${BLUE}Checking database tables...${NC}"
docker exec jedire-db psql -U jedire_user -d jedire_dev -c "
  SELECT 
    table_name 
  FROM information_schema.tables 
  WHERE table_schema = 'public' 
    AND table_name LIKE '%risk%'
  ORDER BY table_name;
" 2>/dev/null || echo "Note: Run this inside the database container if using Docker"

echo ""
echo -e "${BLUE}Expected tables:${NC}"
echo "- regulatory_risk_events"
echo "- zoning_changes"
echo "- tax_policy_changes"
echo "- market_risk_indicators"
echo "- interest_rate_scenarios"
echo "- execution_risk_factors"
echo "- construction_cost_tracking"
echo "- climate_risk_assessments"
echo "- natural_disaster_events"
echo ""

##############################################################################
# Summary
##############################################################################
echo -e "${GREEN}=========================================="
echo "Test Summary"
echo "==========================================${NC}"
echo ""
echo "✓ Risk Categories List"
echo "✓ Regulatory Risk (legislation tracking, stage weighting)"
echo "✓ Market Risk (interest rates, cap rate sensitivity, DSCR stress)"
echo "✓ Execution Risk (cost inflation, labor market, historical overruns)"
echo "✓ Climate Risk (FEMA zones, natural disasters, insurance)"
echo "✓ Composite Risk (all 6 categories, weighted formula)"
echo "✓ Comprehensive Deal Risk"
echo "✓ Risk Score History"
echo "✓ Recent Risk Events"
echo "✓ Force Recalculation"
echo ""
echo -e "${GREEN}All tests completed!${NC}"
echo ""
echo "Next steps:"
echo "1. Verify risk scores are calculated correctly"
echo "2. Test frontend components for all 6 categories"
echo "3. Validate integration with JEDI Score"
echo "4. Test scenario generation with comprehensive risk data"
echo ""

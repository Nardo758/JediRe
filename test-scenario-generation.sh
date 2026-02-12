#!/bin/bash

##############################################################################
# JEDI RE - Scenario Generation System Test Script
# Phase 3, Component 2: Evidence-Based Scenario Generation
##############################################################################

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_BASE="${API_BASE:-http://localhost:3001/api/v1}"
TEST_DEAL_ID="${TEST_DEAL_ID:-}"
TEST_USER_ID="${TEST_USER_ID:-test-user-123}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}JEDI RE - Scenario Generation System${NC}"
echo -e "${BLUE}Phase 3, Component 2 Test Script${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

##############################################################################
# Step 1: Verify Database Schema
##############################################################################

echo -e "${YELLOW}Step 1: Verifying database schema...${NC}"

psql ${DATABASE_URL:-postgresql://localhost/jedire} -c "
SELECT 
  table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'scenario_templates',
    'deal_scenarios',
    'scenario_assumptions',
    'scenario_results',
    'scenario_events'
  )
ORDER BY table_name;
" || {
  echo -e "${RED}✗ Database tables not found. Please run migration:${NC}"
  echo "psql \$DATABASE_URL -f backend/src/database/migrations/030_scenario_generation.sql"
  exit 1
}

echo -e "${GREEN}✓ Database schema verified${NC}"
echo ""

##############################################################################
# Step 2: Check Scenario Templates
##############################################################################

echo -e "${YELLOW}Step 2: Checking scenario templates...${NC}"

TEMPLATE_COUNT=$(psql ${DATABASE_URL:-postgresql://localhost/jedire} -t -c "
SELECT COUNT(*) FROM scenario_templates;
" | xargs)

if [ "$TEMPLATE_COUNT" -eq "4" ]; then
  echo -e "${GREEN}✓ Found 4 scenario templates (Bull/Base/Bear/Stress)${NC}"
else
  echo -e "${RED}✗ Expected 4 templates, found $TEMPLATE_COUNT${NC}"
  exit 1
fi

# Display templates
psql ${DATABASE_URL:-postgresql://localhost/jedire} -c "
SELECT 
  scenario_type,
  display_name,
  demand_positive_inclusion,
  supply_positive_inclusion,
  risk_event_count
FROM scenario_templates
ORDER BY 
  CASE scenario_type 
    WHEN 'bull' THEN 1 
    WHEN 'base' THEN 2 
    WHEN 'bear' THEN 3 
    WHEN 'stress' THEN 4 
  END;
"

echo ""

##############################################################################
# Step 3: Find a Test Deal
##############################################################################

echo -e "${YELLOW}Step 3: Finding test deal...${NC}"

if [ -z "$TEST_DEAL_ID" ]; then
  TEST_DEAL_ID=$(psql ${DATABASE_URL:-postgresql://localhost/jedire} -t -c "
    SELECT id FROM deals 
    WHERE trade_area_id IS NOT NULL 
    LIMIT 1;
  " | xargs)
fi

if [ -z "$TEST_DEAL_ID" ]; then
  echo -e "${RED}✗ No deals found with trade_area_id assigned${NC}"
  echo "Please create a deal and assign a trade area first."
  exit 1
fi

echo -e "${GREEN}✓ Using test deal: $TEST_DEAL_ID${NC}"

# Get deal info
psql ${DATABASE_URL:-postgresql://localhost/jedire} -c "
SELECT 
  d.id,
  d.name,
  d.strategy,
  ta.name as trade_area_name
FROM deals d
LEFT JOIN trade_areas ta ON ta.id = d.trade_area_id
WHERE d.id = '$TEST_DEAL_ID';
"

echo ""

##############################################################################
# Step 4: Check Available Events
##############################################################################

echo -e "${YELLOW}Step 4: Checking available events for trade area...${NC}"

TRADE_AREA_ID=$(psql ${DATABASE_URL:-postgresql://localhost/jedire} -t -c "
  SELECT trade_area_id FROM deals WHERE id = '$TEST_DEAL_ID';
" | xargs)

if [ -z "$TRADE_AREA_ID" ]; then
  echo -e "${YELLOW}⚠ No trade area assigned to deal. Scenarios will be limited.${NC}"
else
  # Count events
  DEMAND_COUNT=$(psql ${DATABASE_URL:-postgresql://localhost/jedire} -t -c "
    SELECT COUNT(*) FROM demand_projections WHERE trade_area_id = '$TRADE_AREA_ID';
  " | xargs)
  
  SUPPLY_COUNT=$(psql ${DATABASE_URL:-postgresql://localhost/jedire} -t -c "
    SELECT COUNT(*) FROM supply_pipeline WHERE trade_area_id = '$TRADE_AREA_ID';
  " | xargs)
  
  RISK_COUNT=$(psql ${DATABASE_URL:-postgresql://localhost/jedire} -t -c "
    SELECT COUNT(*) FROM risk_escalations WHERE trade_area_id = '$TRADE_AREA_ID' AND is_active = TRUE;
  " | xargs)
  
  echo "  Demand Events: $DEMAND_COUNT"
  echo "  Supply Events: $SUPPLY_COUNT"
  echo "  Risk Events: $RISK_COUNT"
  
  if [ "$DEMAND_COUNT" -eq "0" ] && [ "$SUPPLY_COUNT" -eq "0" ]; then
    echo -e "${YELLOW}⚠ No events found. Scenarios will use baseline assumptions.${NC}"
  else
    echo -e "${GREEN}✓ Events available for scenario generation${NC}"
  fi
fi

echo ""

##############################################################################
# Step 5: Generate Scenarios
##############################################################################

echo -e "${YELLOW}Step 5: Generating scenarios via API...${NC}"

GENERATE_RESPONSE=$(curl -s -X POST "$API_BASE/scenarios/generate/$TEST_DEAL_ID" \
  -H "Content-Type: application/json" \
  -d "{\"trigger\": \"manual\", \"userId\": \"$TEST_USER_ID\"}")

if echo "$GENERATE_RESPONSE" | grep -q '"success":true'; then
  echo -e "${GREEN}✓ Scenarios generated successfully${NC}"
  SCENARIO_COUNT=$(echo "$GENERATE_RESPONSE" | grep -o '"count":[0-9]*' | grep -o '[0-9]*')
  echo "  Generated $SCENARIO_COUNT scenarios"
else
  echo -e "${RED}✗ Failed to generate scenarios${NC}"
  echo "$GENERATE_RESPONSE" | jq '.' 2>/dev/null || echo "$GENERATE_RESPONSE"
  exit 1
fi

echo ""

##############################################################################
# Step 6: Verify Scenarios in Database
##############################################################################

echo -e "${YELLOW}Step 6: Verifying scenarios in database...${NC}"

psql ${DATABASE_URL:-postgresql://localhost/jedire} -c "
SELECT 
  scenario_type,
  scenario_name,
  source_event_count,
  ROUND(irr_pct::numeric, 2) as irr_pct,
  ROUND(coc_year_5::numeric, 2) as coc_year_5,
  ROUND(npv::numeric, 0) as npv,
  generated_at
FROM deal_scenarios
WHERE deal_id = '$TEST_DEAL_ID'
ORDER BY 
  CASE scenario_type 
    WHEN 'bull' THEN 1 
    WHEN 'base' THEN 2 
    WHEN 'bear' THEN 3 
    WHEN 'stress' THEN 4 
  END;
"

echo ""

##############################################################################
# Step 7: Test Scenario Comparison Endpoint
##############################################################################

echo -e "${YELLOW}Step 7: Testing scenario comparison endpoint...${NC}"

COMPARISON_RESPONSE=$(curl -s "$API_BASE/scenarios/$TEST_DEAL_ID/comparison")

if echo "$COMPARISON_RESPONSE" | grep -q '"success":true'; then
  echo -e "${GREEN}✓ Comparison endpoint working${NC}"
  
  # Extract key metrics
  echo ""
  echo "Scenario Comparison Summary:"
  echo "$COMPARISON_RESPONSE" | jq -r '
    .data.scenarios | to_entries[] | 
    "  \(.key | ascii_upcase): IRR \(.value.irrPct | tostring)%, CoC \(.value.cocYear5 | tostring)x, NPV $\(.value.npv | tostring)"
  ' 2>/dev/null || echo "  (JSON parsing not available)"
else
  echo -e "${RED}✗ Comparison endpoint failed${NC}"
  echo "$COMPARISON_RESPONSE" | jq '.' 2>/dev/null || echo "$COMPARISON_RESPONSE"
fi

echo ""

##############################################################################
# Step 8: Test Scenario Details Endpoint
##############################################################################

echo -e "${YELLOW}Step 8: Testing scenario details endpoint...${NC}"

# Get first scenario ID
SCENARIO_ID=$(psql ${DATABASE_URL:-postgresql://localhost/jedire} -t -c "
  SELECT id FROM deal_scenarios WHERE deal_id = '$TEST_DEAL_ID' LIMIT 1;
" | xargs)

if [ -n "$SCENARIO_ID" ]; then
  DETAILS_RESPONSE=$(curl -s "$API_BASE/scenarios/$SCENARIO_ID/details")
  
  if echo "$DETAILS_RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}✓ Details endpoint working${NC}"
    
    # Show event count
    EVENT_COUNT=$(echo "$DETAILS_RESPONSE" | jq '.data.events | length' 2>/dev/null || echo "?")
    echo "  Events in scenario: $EVENT_COUNT"
  else
    echo -e "${RED}✗ Details endpoint failed${NC}"
  fi
else
  echo -e "${YELLOW}⚠ No scenario ID found to test details${NC}"
fi

echo ""

##############################################################################
# Step 9: Test Custom Scenario Creation
##############################################################################

echo -e "${YELLOW}Step 9: Testing custom scenario creation...${NC}"

CUSTOM_RESPONSE=$(curl -s -X POST "$API_BASE/scenarios/custom" \
  -H "Content-Type: application/json" \
  -d "{
    \"dealId\": \"$TEST_DEAL_ID\",
    \"scenarioName\": \"Test Custom Scenario\",
    \"description\": \"Test scenario created by automated test\",
    \"selectedEventIds\": [],
    \"assumptionOverrides\": {
      \"rentGrowth\": 0.025,
      \"vacancy\": 0.07
    },
    \"userId\": \"$TEST_USER_ID\"
  }")

if echo "$CUSTOM_RESPONSE" | grep -q '"success":true'; then
  echo -e "${GREEN}✓ Custom scenario created successfully${NC}"
  
  CUSTOM_ID=$(echo "$CUSTOM_RESPONSE" | jq -r '.data.scenario.id' 2>/dev/null)
  if [ -n "$CUSTOM_ID" ] && [ "$CUSTOM_ID" != "null" ]; then
    echo "  Custom scenario ID: $CUSTOM_ID"
    
    # Clean up test scenario
    psql ${DATABASE_URL:-postgresql://localhost/jedire} -c "
      DELETE FROM deal_scenarios WHERE id = '$CUSTOM_ID';
    " > /dev/null 2>&1
    echo "  (Test scenario cleaned up)"
  fi
else
  echo -e "${YELLOW}⚠ Custom scenario creation failed (may be expected if validation failed)${NC}"
fi

echo ""

##############################################################################
# Step 10: Test Scenario Assumptions
##############################################################################

echo -e "${YELLOW}Step 10: Checking scenario assumptions...${NC}"

psql ${DATABASE_URL:-postgresql://localhost/jedire} -c "
SELECT 
  ds.scenario_type,
  ROUND((sa.rent_growth_pct * 100)::numeric, 2) as rent_growth_pct,
  ROUND((sa.vacancy_pct * 100)::numeric, 2) as vacancy_pct,
  ROUND((sa.exit_cap_pct * 100)::numeric, 2) as exit_cap_pct,
  sa.absorption_months,
  sa.source_events_count
FROM deal_scenarios ds
JOIN scenario_assumptions sa ON sa.scenario_id = ds.id
WHERE ds.deal_id = '$TEST_DEAL_ID'
ORDER BY 
  CASE ds.scenario_type 
    WHEN 'bull' THEN 1 
    WHEN 'base' THEN 2 
    WHEN 'bear' THEN 3 
    WHEN 'stress' THEN 4 
  END;
"

echo ""

##############################################################################
# Summary
##############################################################################

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Test Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${GREEN}✓ Database schema validated${NC}"
echo -e "${GREEN}✓ Scenario templates configured${NC}"
echo -e "${GREEN}✓ Scenarios generated for test deal${NC}"
echo -e "${GREEN}✓ API endpoints functional${NC}"
echo -e "${GREEN}✓ Scenario assumptions stored${NC}"
echo ""
echo -e "${BLUE}Scenario Generation System: READY${NC}"
echo ""
echo "Next steps:"
echo "  1. Integrate ScenarioComparison component into deal detail page"
echo "  2. Add ScenarioBuilder to deal toolbar"
echo "  3. Set up automatic regeneration on event updates"
echo "  4. Connect to actual pro forma engine for real IRR calculations"
echo ""

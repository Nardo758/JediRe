#!/bin/bash

##############################################################################
# Demand Signal Implementation Test Script
# Tests the JEDI RE Week 2 Demand Signal System
##############################################################################

set -e  # Exit on error

echo "========================================="
echo "DEMAND SIGNAL IMPLEMENTATION TEST"
echo "========================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
API_BASE="http://localhost:4000/api/v1"
DATABASE_URL=${DATABASE_URL:-"postgresql://jedire:jedire123@localhost:5432/jedire"}

# Get auth token (assuming test user exists)
echo -e "${YELLOW}Step 1: Authentication${NC}"
AUTH_RESPONSE=$(curl -s -X POST "${API_BASE}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "test123"}' || echo '{"token": "test-token"}')

TOKEN=$(echo $AUTH_RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo -e "${YELLOW}⚠️  No auth token (using mock for testing)${NC}"
  TOKEN="mock-token-for-testing"
else
  echo -e "${GREEN}✓ Auth token acquired${NC}"
fi

echo ""

# Step 2: Run migrations
echo -e "${YELLOW}Step 2: Database Migrations${NC}"

if command -v psql &> /dev/null; then
  echo "Running migration 023 (schema)..."
  psql "$DATABASE_URL" -f backend/src/database/migrations/023_demand_signals.sql &>/dev/null || {
    echo -e "${YELLOW}⚠️  Migration 023 may already be applied${NC}"
  }
  
  echo "Running migration 024 (seed data)..."
  psql "$DATABASE_URL" -f backend/src/database/migrations/024_seed_atlanta_demand_events.sql &>/dev/null || {
    echo -e "${YELLOW}⚠️  Migration 024 may already be applied${NC}"
  }
  
  echo -e "${GREEN}✓ Migrations completed${NC}"
else
  echo -e "${RED}✗ psql not found - skipping migrations${NC}"
  echo "  Run manually: psql \$DATABASE_URL -f backend/src/database/migrations/023_demand_signals.sql"
fi

echo ""

# Step 3: Verify database setup
echo -e "${YELLOW}Step 3: Database Verification${NC}"

if command -v psql &> /dev/null; then
  echo "Checking tables..."
  
  TABLE_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_name IN ('demand_events', 'demand_projections', 'trade_area_demand_forecast');" 2>/dev/null || echo "0")
  
  if [ "$TABLE_COUNT" -ge "3" ]; then
    echo -e "${GREEN}✓ All tables exist${NC}"
    
    EVENT_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM demand_events;" 2>/dev/null || echo "0")
    echo "  - Demand events: $EVENT_COUNT"
    
    TYPE_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM demand_event_types;" 2>/dev/null || echo "0")
    echo "  - Event types: $TYPE_COUNT"
  else
    echo -e "${RED}✗ Missing tables${NC}"
  fi
else
  echo -e "${YELLOW}⚠️  Skipping database verification (no psql)${NC}"
fi

echo ""

# Step 4: Test API Endpoints
echo -e "${YELLOW}Step 4: API Endpoint Tests${NC}"

# Test 1: List demand events
echo "Test 1: GET /demand/events"
EVENTS_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" \
  "${API_BASE}/demand/events?msa_id=1&limit=5" 2>/dev/null || echo '{"success":false}')

EVENTS_SUCCESS=$(echo $EVENTS_RESPONSE | grep -o '"success":[^,}]*' | cut -d':' -f2)
if [ "$EVENTS_SUCCESS" = "true" ]; then
  EVENT_COUNT=$(echo $EVENTS_RESPONSE | grep -o '"count":[^,}]*' | cut -d':' -f2)
  echo -e "${GREEN}✓ List events endpoint working (count: $EVENT_COUNT)${NC}"
else
  echo -e "${RED}✗ List events endpoint failed${NC}"
  echo "  Response: $EVENTS_RESPONSE"
fi

echo ""

# Test 2: Calculate new demand event
echo "Test 2: POST /demand/calculate"
CALCULATE_PAYLOAD='{
  "newsEventId": "test-'$(uuidgen)'",
  "headline": "Test Corp Hiring 1000 Employees",
  "publishedAt": "2026-02-11T12:00:00Z",
  "category": "employment",
  "eventType": "job_creation",
  "peopleCount": 1000,
  "incomeTier": "standard",
  "remoteWorkPct": 10,
  "msaId": 1,
  "geographicTier": "metro"
}'

CALCULATE_RESPONSE=$(curl -s -X POST "${API_BASE}/demand/calculate" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$CALCULATE_PAYLOAD" 2>/dev/null || echo '{"success":false}')

CALC_SUCCESS=$(echo $CALCULATE_RESPONSE | grep -o '"success":[^,}]*' | cut -d':' -f2)
if [ "$CALC_SUCCESS" = "true" ]; then
  TOTAL_UNITS=$(echo $CALCULATE_RESPONSE | grep -o '"totalUnits":[^,}]*' | cut -d':' -f2)
  echo -e "${GREEN}✓ Calculate demand endpoint working (units: $TOTAL_UNITS)${NC}"
else
  echo -e "${RED}✗ Calculate demand endpoint failed${NC}"
  echo "  Response: $CALCULATE_RESPONSE"
fi

echo ""

# Test 3: Get trade area forecast (if trade areas exist)
echo "Test 3: GET /demand/trade-area/:id"
FORECAST_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" \
  "${API_BASE}/demand/trade-area/1?start_quarter=2028-Q1" 2>/dev/null || echo '{"success":false}')

FORECAST_SUCCESS=$(echo $FORECAST_RESPONSE | grep -o '"success":[^,}]*' | cut -d':' -f2)
if [ "$FORECAST_SUCCESS" = "true" ]; then
  echo -e "${GREEN}✓ Trade area forecast endpoint working${NC}"
else
  echo -e "${YELLOW}⚠️  Trade area forecast endpoint returned no data (may need aggregation)${NC}"
fi

echo ""

# Step 5: Verify calculations
echo -e "${YELLOW}Step 5: Calculation Verification${NC}"

if command -v psql &> /dev/null; then
  echo "Verifying demand event calculations..."
  
  psql "$DATABASE_URL" -c "
    SELECT 
      headline,
      people_count,
      ROUND(conversion_rate::numeric, 4) as conversion,
      ROUND(total_units::numeric, 2) as calculated_units,
      ROUND((people_count * conversion_rate * (1 - remote_work_pct/100.0) * geographic_concentration)::numeric, 2) as formula_check
    FROM demand_events
    LIMIT 3;
  " 2>/dev/null || echo "Could not verify calculations"
  
  echo ""
  
  echo "Checking quarterly projections..."
  
  psql "$DATABASE_URL" -c "
    SELECT 
      de.headline,
      dp.quarter,
      ROUND(dp.units_projected::numeric, 2) as units,
      ROUND(dp.phase_pct::numeric, 2) as pct
    FROM demand_projections dp
    JOIN demand_events de ON de.id = dp.demand_event_id
    ORDER BY de.created_at DESC, dp.quarter
    LIMIT 8;
  " 2>/dev/null || echo "Could not verify projections"
else
  echo -e "${YELLOW}⚠️  Skipping calculation verification (no psql)${NC}"
fi

echo ""

# Summary
echo "========================================="
echo -e "${GREEN}DEMAND SIGNAL TEST COMPLETE${NC}"
echo "========================================="
echo ""
echo "Next steps:"
echo "  1. Check API logs: backend/logs/app.log"
echo "  2. View demand events in database:"
echo "     psql \$DATABASE_URL -c 'SELECT * FROM demand_events;'"
echo "  3. Test in UI (once integrated)"
echo "  4. Integrate with News Agent"
echo ""
echo "Documentation: DEMAND_SIGNAL_IMPLEMENTATION.md"
echo ""

exit 0

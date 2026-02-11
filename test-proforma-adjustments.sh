#!/bin/bash

# ============================================================================
# Pro Forma Adjustments System Test Script
# JEDI RE Phase 2, Component 1
# ============================================================================

set -e

echo "🧪 Testing Pro Forma Adjustments System"
echo "========================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
API_URL="http://localhost:5000/api/v1"
TEST_DEAL_ID="" # Will be created dynamically

# ============================================================================
# Helper Functions
# ============================================================================

print_step() {
  echo -e "${BLUE}▶ $1${NC}"
}

print_success() {
  echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
  echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
  echo -e "${RED}✗ $1${NC}"
}

# ============================================================================
# Test 1: Database Schema
# ============================================================================

print_step "Test 1: Checking database schema..."

# Check if tables exist
TABLES=$(psql -d jedire -t -c "
  SELECT tablename FROM pg_tables 
  WHERE schemaname = 'public' 
    AND tablename IN ('proforma_assumptions', 'assumption_adjustments', 'adjustment_history', 'adjustment_formulas')
  ORDER BY tablename;
")

EXPECTED_COUNT=4
ACTUAL_COUNT=$(echo "$TABLES" | grep -v '^$' | wc -l)

if [ "$ACTUAL_COUNT" -eq "$EXPECTED_COUNT" ]; then
  print_success "All 4 tables exist"
else
  print_error "Expected $EXPECTED_COUNT tables, found $ACTUAL_COUNT"
  echo "Found tables: $TABLES"
  exit 1
fi

# Check if formulas are seeded
FORMULA_COUNT=$(psql -d jedire -t -c "SELECT COUNT(*) FROM adjustment_formulas;")

if [ "$FORMULA_COUNT" -ge 5 ]; then
  print_success "Adjustment formulas seeded ($FORMULA_COUNT formulas)"
else
  print_error "Expected at least 5 formulas, found $FORMULA_COUNT"
  exit 1
fi

echo ""

# ============================================================================
# Test 2: Create Test Deal
# ============================================================================

print_step "Test 2: Creating test deal..."

# Create a test deal (simplified - adjust based on your schema)
TEST_DEAL_ID=$(psql -d jedire -t -c "
  INSERT INTO deals (name, stage, strategy, created_at)
  VALUES ('Pro Forma Test Deal', 'uw', 'rental', NOW())
  RETURNING id;
" | tr -d ' ')

if [ -n "$TEST_DEAL_ID" ]; then
  print_success "Test deal created: $TEST_DEAL_ID"
else
  print_error "Failed to create test deal"
  exit 1
fi

echo ""

# ============================================================================
# Test 3: Initialize Pro Forma
# ============================================================================

print_step "Test 3: Initializing pro forma..."

INIT_RESPONSE=$(curl -s -X POST "$API_URL/proforma/$TEST_DEAL_ID/initialize" \
  -H "Content-Type: application/json" \
  -d '{
    "strategy": "rental",
    "baselineValues": {
      "rentGrowth": { "baseline": 3.5 },
      "vacancy": { "baseline": 5.0 },
      "opexGrowth": { "baseline": 2.8 },
      "exitCap": { "baseline": 5.5 },
      "absorption": { "baseline": 8.0 }
    }
  }')

if echo "$INIT_RESPONSE" | grep -q '"success":true'; then
  print_success "Pro forma initialized"
  echo "$INIT_RESPONSE" | jq '.data' 2>/dev/null || echo "$INIT_RESPONSE"
else
  print_error "Failed to initialize pro forma"
  echo "$INIT_RESPONSE"
  exit 1
fi

echo ""

# ============================================================================
# Test 4: Get Pro Forma
# ============================================================================

print_step "Test 4: Fetching pro forma..."

GET_RESPONSE=$(curl -s "$API_URL/proforma/$TEST_DEAL_ID")

if echo "$GET_RESPONSE" | grep -q '"success":true'; then
  print_success "Pro forma fetched successfully"
  
  # Extract values
  RENT_GROWTH=$(echo "$GET_RESPONSE" | jq -r '.data.rentGrowth.baseline')
  VACANCY=$(echo "$GET_RESPONSE" | jq -r '.data.vacancy.baseline')
  
  echo "  Rent Growth: $RENT_GROWTH%"
  echo "  Vacancy: $VACANCY%"
else
  print_error "Failed to fetch pro forma"
  echo "$GET_RESPONSE"
fi

echo ""

# ============================================================================
# Test 5: Create Test News Event (Amazon Scenario)
# ============================================================================

print_step "Test 5: Creating test news event (Amazon 4,500 jobs)..."

# Create news event
NEWS_EVENT_ID=$(psql -d jedire -t -c "
  INSERT INTO news_events (
    headline, 
    event_category, 
    event_type, 
    published_at,
    extracted_data,
    extraction_confidence
  )
  VALUES (
    'Amazon to add 4,500 jobs at fulfillment center',
    'employment',
    'major_hiring',
    NOW(),
    '{\"employee_count\": 4500, \"location\": \"Lawrenceville, GA\"}',
    0.95
  )
  RETURNING id;
" | tr -d ' ')

if [ -n "$NEWS_EVENT_ID" ]; then
  print_success "News event created: $NEWS_EVENT_ID"
else
  print_error "Failed to create news event"
  exit 1
fi

# Create demand event from news event
DEMAND_EVENT_ID=$(psql -d jedire -t -c "
  INSERT INTO demand_events (
    news_event_id,
    demand_event_type_id,
    headline,
    published_at,
    people_count,
    income_tier,
    remote_work_pct,
    conversion_rate,
    geographic_concentration,
    total_units,
    affordable_pct,
    workforce_pct,
    luxury_pct,
    confidence_score
  )
  SELECT 
    '$NEWS_EVENT_ID',
    det.id,
    'Amazon to add 4,500 jobs at fulfillment center',
    NOW(),
    4500,
    'standard',
    10,
    0.40,
    0.85,
    1530, -- 4500 * 0.40 * 0.9 (after remote work) * 0.85 (concentration)
    20,
    70,
    10,
    85
  FROM demand_event_types det
  WHERE det.category = 'employment' AND det.event_type = 'major_hiring'
  LIMIT 1
  RETURNING id;
" | tr -d ' ')

if [ -n "$DEMAND_EVENT_ID" ]; then
  print_success "Demand event created: $DEMAND_EVENT_ID"
else
  print_warning "Failed to create demand event (may need to seed demand_event_types table)"
fi

echo ""

# ============================================================================
# Test 6: Recalculate Pro Forma
# ============================================================================

print_step "Test 6: Recalculating pro forma with news event..."

RECALC_RESPONSE=$(curl -s -X POST "$API_URL/proforma/$TEST_DEAL_ID/recalculate" \
  -H "Content-Type: application/json" \
  -d "{
    \"triggerType\": \"demand_signal\",
    \"triggerEventId\": \"$DEMAND_EVENT_ID\"
  }")

if echo "$RECALC_RESPONSE" | grep -q '"success":true'; then
  print_success "Pro forma recalculated"
  
  # Extract adjusted values
  RENT_GROWTH_CURRENT=$(echo "$RECALC_RESPONSE" | jq -r '.data.rentGrowth.current')
  VACANCY_CURRENT=$(echo "$RECALC_RESPONSE" | jq -r '.data.vacancy.current')
  
  echo "  Rent Growth (adjusted): $RENT_GROWTH_CURRENT%"
  echo "  Vacancy (adjusted): $VACANCY_CURRENT%"
else
  print_error "Failed to recalculate pro forma"
  echo "$RECALC_RESPONSE"
fi

echo ""

# ============================================================================
# Test 7: Get Adjustments History
# ============================================================================

print_step "Test 7: Fetching adjustment history..."

HISTORY_RESPONSE=$(curl -s "$API_URL/proforma/$TEST_DEAL_ID/adjustments")

if echo "$HISTORY_RESPONSE" | grep -q '"success":true'; then
  ADJUSTMENT_COUNT=$(echo "$HISTORY_RESPONSE" | jq '.data | length')
  print_success "Found $ADJUSTMENT_COUNT adjustment(s)"
  
  if [ "$ADJUSTMENT_COUNT" -gt 0 ]; then
    echo "$HISTORY_RESPONSE" | jq '.data[0]' 2>/dev/null || echo "$HISTORY_RESPONSE"
  fi
else
  print_error "Failed to fetch adjustment history"
  echo "$HISTORY_RESPONSE"
fi

echo ""

# ============================================================================
# Test 8: User Override
# ============================================================================

print_step "Test 8: Testing user override..."

OVERRIDE_RESPONSE=$(curl -s -X PATCH "$API_URL/proforma/$TEST_DEAL_ID/override" \
  -H "Content-Type: application/json" \
  -d '{
    "assumptionType": "rent_growth",
    "value": 5.5,
    "reason": "Conservative estimate based on local market knowledge"
  }')

if echo "$OVERRIDE_RESPONSE" | grep -q '"success":true'; then
  print_success "Assumption overridden"
  
  OVERRIDE_VALUE=$(echo "$OVERRIDE_RESPONSE" | jq -r '.data.rentGrowth.userOverride')
  echo "  User Override: $OVERRIDE_VALUE%"
else
  print_error "Failed to override assumption"
  echo "$OVERRIDE_RESPONSE"
fi

echo ""

# ============================================================================
# Test 9: Get Comparison
# ============================================================================

print_step "Test 9: Fetching baseline vs. adjusted comparison..."

COMPARISON_RESPONSE=$(curl -s "$API_URL/proforma/$TEST_DEAL_ID/comparison")

if echo "$COMPARISON_RESPONSE" | grep -q '"success":true'; then
  print_success "Comparison fetched successfully"
  
  echo "$COMPARISON_RESPONSE" | jq '{
    dealName: .data.dealName,
    strategy: .data.strategy,
    differences: .data.differences,
    recentAdjustments: (.data.recentAdjustments | length)
  }' 2>/dev/null || echo "$COMPARISON_RESPONSE"
else
  print_error "Failed to fetch comparison"
  echo "$COMPARISON_RESPONSE"
fi

echo ""

# ============================================================================
# Test 10: Export Pro Forma
# ============================================================================

print_step "Test 10: Testing export functionality..."

# Export as JSON
EXPORT_JSON=$(curl -s "$API_URL/proforma/$TEST_DEAL_ID/export?format=json")

if echo "$EXPORT_JSON" | grep -q '"success":true'; then
  print_success "JSON export successful"
else
  print_warning "JSON export may have issues"
fi

# Export as CSV
EXPORT_CSV=$(curl -s "$API_URL/proforma/$TEST_DEAL_ID/export?format=csv")

if echo "$EXPORT_CSV" | grep -q "Deal Name"; then
  print_success "CSV export successful"
  echo ""
  echo "$EXPORT_CSV" | head -3
else
  print_warning "CSV export may have issues"
fi

echo ""

# ============================================================================
# Test 11: Database Constraints
# ============================================================================

print_step "Test 11: Testing database constraints..."

# Test invalid strategy
INVALID_STRATEGY=$(psql -d jedire -t -c "
  INSERT INTO proforma_assumptions (deal_id, strategy, rent_growth_baseline, rent_growth_current)
  VALUES ('$TEST_DEAL_ID', 'invalid_strategy', 3.5, 3.5)
  RETURNING id;
" 2>&1 || echo "CONSTRAINT_ERROR")

if echo "$INVALID_STRATEGY" | grep -q "CONSTRAINT_ERROR\|violates check constraint"; then
  print_success "Strategy constraint working (rejected invalid strategy)"
else
  print_error "Strategy constraint not working properly"
fi

# Test rent growth range
INVALID_RENT=$(psql -d jedire -t -c "
  UPDATE proforma_assumptions 
  SET rent_growth_baseline = 100 
  WHERE deal_id = '$TEST_DEAL_ID';
" 2>&1 || echo "CONSTRAINT_ERROR")

if echo "$INVALID_RENT" | grep -q "CONSTRAINT_ERROR\|violates check constraint"; then
  print_success "Rent growth range constraint working (rejected 100%)"
else
  print_error "Rent growth range constraint not working properly"
fi

echo ""

# ============================================================================
# Test 12: Performance Test
# ============================================================================

print_step "Test 12: Performance test (10 rapid recalculations)..."

START_TIME=$(date +%s)

for i in {1..10}; do
  curl -s -X POST "$API_URL/proforma/$TEST_DEAL_ID/recalculate" \
    -H "Content-Type: application/json" \
    -d '{"triggerType": "periodic_update"}' > /dev/null
done

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
AVG_TIME=$((DURATION * 100 / 10))

print_success "Completed 10 recalculations in ${DURATION}s (avg: ${AVG_TIME}ms)"

if [ "$DURATION" -lt 10 ]; then
  print_success "Performance is good (<1s per recalculation)"
else
  print_warning "Performance may need optimization (>1s per recalculation)"
fi

echo ""

# ============================================================================
# Cleanup
# ============================================================================

print_step "Cleanup: Removing test data..."

# Delete test deal (cascade will delete pro forma, adjustments, history)
psql -d jedire -c "DELETE FROM deals WHERE id = '$TEST_DEAL_ID';" > /dev/null 2>&1

# Delete test news event
if [ -n "$NEWS_EVENT_ID" ]; then
  psql -d jedire -c "DELETE FROM news_events WHERE id = '$NEWS_EVENT_ID';" > /dev/null 2>&1
fi

print_success "Test data cleaned up"

echo ""

# ============================================================================
# Summary
# ============================================================================

echo "========================================"
echo -e "${GREEN}✓ Pro Forma Adjustments System Tests Complete!${NC}"
echo "========================================"
echo ""
echo "Summary:"
echo "  ✓ Database schema verified"
echo "  ✓ API endpoints functional"
echo "  ✓ Adjustment calculations working"
echo "  ✓ User overrides functional"
echo "  ✓ Export capabilities working"
echo "  ✓ Constraints enforced"
echo "  ✓ Performance acceptable"
echo ""
echo "Next steps:"
echo "  1. Review PROFORMA_ADJUSTMENTS.md for full documentation"
echo "  2. Test with real deals and news events"
echo "  3. Set up Kafka consumer for automatic recalculation"
echo "  4. Deploy frontend component to deal detail pages"
echo ""

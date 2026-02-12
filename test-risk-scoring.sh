#!/bin/bash
# Risk Scoring System Test Script
# Tests Supply Risk, Demand Risk, and Composite Risk calculations

set -e

API_BASE="${API_BASE:-http://localhost:3000/api/v1}"
DB_NAME="${DB_NAME:-jedire_db}"
DB_USER="${DB_USER:-postgres}"

echo "========================================="
echo "Risk Scoring System Test"
echo "========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

success() {
  echo -e "${GREEN}✓${NC} $1"
}

error() {
  echo -e "${RED}✗${NC} $1"
}

info() {
  echo -e "${YELLOW}→${NC} $1"
}

# Test database connection
test_db() {
  info "Testing database connection..."
  psql -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" > /dev/null 2>&1
  if [ $? -eq 0 ]; then
    success "Database connected"
  else
    error "Database connection failed"
    exit 1
  fi
}

# Test API availability
test_api() {
  info "Testing API availability..."
  response=$(curl -s -o /dev/null -w "%{http_code}" "$API_BASE/risk/categories")
  if [ "$response" = "200" ]; then
    success "API is available"
  else
    error "API not responding (HTTP $response)"
    exit 1
  fi
}

# Get or create test trade areas
setup_test_data() {
  info "Setting up test trade areas..."
  
  # Get trade area IDs
  SANDY_SPRINGS_ID=$(psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT id FROM trade_areas WHERE name LIKE '%Sandy Springs%' LIMIT 1" | xargs)
  LAWRENCEVILLE_ID=$(psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT id FROM trade_areas WHERE name LIKE '%Lawrenceville%' LIMIT 1" | xargs)
  BUCKHEAD_ID=$(psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT id FROM trade_areas WHERE name LIKE '%Buckhead%' LIMIT 1" | xargs)
  
  if [ -z "$SANDY_SPRINGS_ID" ] || [ -z "$LAWRENCEVILLE_ID" ] || [ -z "$BUCKHEAD_ID" ]; then
    error "Test trade areas not found. Please ensure Atlanta trade areas are seeded."
    exit 1
  fi
  
  success "Test trade areas found:"
  echo "   Sandy Springs: $SANDY_SPRINGS_ID"
  echo "   Lawrenceville: $LAWRENCEVILLE_ID"
  echo "   Buckhead: $BUCKHEAD_ID"
}

# Test Scenario 1: Sandy Springs - High Supply Risk
test_supply_risk() {
  echo ""
  echo "========================================="
  echo "Test 1: Sandy Springs - High Supply Risk"
  echo "========================================="
  
  info "Adding pipeline project (800 units)..."
  psql -U "$DB_USER" -d "$DB_NAME" > /dev/null 2>&1 <<EOF
INSERT INTO supply_pipeline_projects (
  trade_area_id, project_name, developer, total_units, 
  project_status, probability, expected_delivery_date
) VALUES (
  '$SANDY_SPRINGS_ID', 
  'Test: The Luxe at Sandy Springs', 
  'Test Developer', 
  800, 
  'under_construction', 
  0.90, 
  NOW() + INTERVAL '12 months'
) ON CONFLICT DO NOTHING;
EOF
  success "Pipeline project added"
  
  info "Calculating supply risk..."
  response=$(curl -s "$API_BASE/risk/trade-area/$SANDY_SPRINGS_ID/supply")
  supply_score=$(echo "$response" | jq -r '.data.supplyRisk.finalScore // 0')
  pipeline_units=$(echo "$response" | jq -r '.data.supplyRisk.pipelineUnits // 0')
  
  echo "   Pipeline Units: $pipeline_units"
  echo "   Supply Risk Score: $supply_score"
  
  if (( $(echo "$supply_score > 50" | bc -l) )); then
    success "Supply risk elevated (score: $supply_score)"
  else
    error "Supply risk should be elevated (score: $supply_score)"
  fi
  
  # Test escalation
  info "Testing supply escalation (500 units, 6 months)..."
  project_id="test-project-$(date +%s)"
  escalation_response=$(curl -s -X POST "$API_BASE/risk/escalation/supply" \
    -H "Content-Type: application/json" \
    -d "{
      \"tradeAreaId\": \"$SANDY_SPRINGS_ID\",
      \"projectId\": \"$project_id\",
      \"units\": 500,
      \"probability\": 0.9,
      \"deliveryMonths\": 6
    }")
  
  event_id=$(echo "$escalation_response" | jq -r '.data.eventId // empty')
  if [ -n "$event_id" ]; then
    success "Escalation applied (event: $event_id)"
    new_score=$(echo "$escalation_response" | jq -r '.data.supplyRisk.finalScore // 0')
    echo "   New Supply Risk Score: $new_score"
    
    if (( $(echo "$new_score > $supply_score" | bc -l) )); then
      success "Score increased after escalation"
    else
      error "Score should increase after escalation"
    fi
  else
    error "Escalation failed"
  fi
}

# Test Scenario 2: Lawrenceville - High Demand Risk
test_demand_risk() {
  echo ""
  echo "========================================="
  echo "Test 2: Lawrenceville - High Demand Risk"
  echo "========================================="
  
  info "Adding employer concentration (Amazon)..."
  psql -U "$DB_USER" -d "$DB_NAME" > /dev/null 2>&1 <<EOF
INSERT INTO employer_concentration (
  trade_area_id, employer_name, industry, employee_count,
  total_employment_in_area, concentration_pct, dependency_factor, as_of_date
) VALUES (
  '$LAWRENCEVILLE_ID',
  'Test: Amazon Fulfillment',
  'Logistics',
  5000,
  15000,
  33.33,
  1.5,
  CURRENT_DATE
) ON CONFLICT (trade_area_id, employer_name, as_of_date) DO UPDATE
  SET employee_count = EXCLUDED.employee_count,
      concentration_pct = EXCLUDED.concentration_pct,
      dependency_factor = EXCLUDED.dependency_factor;
EOF
  success "Employer concentration added"
  
  info "Calculating demand risk..."
  response=$(curl -s "$API_BASE/risk/trade-area/$LAWRENCEVILLE_ID/demand")
  demand_score=$(echo "$response" | jq -r '.data.demandRisk.finalScore // 0')
  top_employer=$(echo "$response" | jq -r '.data.demandRisk.topEmployerPct // 0')
  
  echo "   Top Employer %: $top_employer"
  echo "   Demand Risk Score: $demand_score"
  
  if (( $(echo "$demand_score > 50" | bc -l) )); then
    success "Demand risk elevated (score: $demand_score)"
  else
    error "Demand risk should be elevated (score: $demand_score)"
  fi
  
  # Test escalation
  info "Testing demand escalation (layoff announcement)..."
  employer_id="test-employer-$(date +%s)"
  escalation_response=$(curl -s -X POST "$API_BASE/risk/escalation/demand" \
    -H "Content-Type: application/json" \
    -d "{
      \"tradeAreaId\": \"$LAWRENCEVILLE_ID\",
      \"employerId\": \"$employer_id\",
      \"eventType\": \"layoff\",
      \"affectedEmployees\": 1000,
      \"totalEmployees\": 5000
    }")
  
  event_id=$(echo "$escalation_response" | jq -r '.data.eventId // empty')
  if [ -n "$event_id" ]; then
    success "Escalation applied (event: $event_id)"
    new_score=$(echo "$escalation_response" | jq -r '.data.demandRisk.finalScore // 0')
    echo "   New Demand Risk Score: $new_score"
    
    if (( $(echo "$new_score > $demand_score" | bc -l) )); then
      success "Score increased after escalation"
    else
      error "Score should increase after escalation"
    fi
  else
    error "Escalation failed"
  fi
}

# Test Scenario 3: Buckhead - Low Composite Risk
test_composite_risk() {
  echo ""
  echo "========================================="
  echo "Test 3: Buckhead - Low Composite Risk"
  echo "========================================="
  
  info "Calculating composite risk..."
  response=$(curl -s "$API_BASE/risk/trade-area/$BUCKHEAD_ID")
  composite_score=$(echo "$response" | jq -r '.data.composite.compositeScore // 0')
  risk_level=$(echo "$response" | jq -r '.data.composite.riskLevel // "unknown"')
  supply=$(echo "$response" | jq -r '.data.composite.supplyRisk // 0')
  demand=$(echo "$response" | jq -r '.data.composite.demandRisk // 0')
  
  echo "   Supply Risk: $supply"
  echo "   Demand Risk: $demand"
  echo "   Composite Score: $composite_score"
  echo "   Risk Level: $risk_level"
  
  if (( $(echo "$composite_score < 50" | bc -l) )); then
    success "Composite risk is low (score: $composite_score)"
  else
    error "Expected low composite risk (score: $composite_score)"
  fi
}

# Test risk history
test_risk_history() {
  echo ""
  echo "========================================="
  echo "Test 4: Risk History Tracking"
  echo "========================================="
  
  info "Fetching risk history for Sandy Springs..."
  response=$(curl -s "$API_BASE/risk/history/$SANDY_SPRINGS_ID?category=supply&limit=10")
  count=$(echo "$response" | jq -r '.data | length')
  
  echo "   History records: $count"
  
  if [ "$count" -gt 0 ]; then
    success "Risk history tracking operational"
    latest_score=$(echo "$response" | jq -r '.data[0].riskScore // 0')
    latest_date=$(echo "$response" | jq -r '.data[0].calculatedAt // "unknown"')
    echo "   Latest score: $latest_score at $latest_date"
  else
    error "No risk history found"
  fi
}

# Test recent events
test_risk_events() {
  echo ""
  echo "========================================="
  echo "Test 5: Recent Risk Events"
  echo "========================================="
  
  info "Fetching recent risk events..."
  response=$(curl -s "$API_BASE/risk/events?limit=10&active=true")
  count=$(echo "$response" | jq -r '.data | length')
  
  echo "   Active events: $count"
  
  if [ "$count" -gt 0 ]; then
    success "Risk events logging operational"
    echo "   Recent events:"
    echo "$response" | jq -r '.data[] | "   - \(.headline) (\(.severity))"' | head -5
  else
    error "No risk events found (expected some from previous tests)"
  fi
}

# Test all risk categories
test_risk_categories() {
  echo ""
  echo "========================================="
  echo "Test 6: Risk Categories"
  echo "========================================="
  
  info "Fetching risk categories..."
  response=$(curl -s "$API_BASE/risk/categories")
  count=$(echo "$response" | jq -r '.data | length')
  implemented=$(echo "$response" | jq -r '[.data[] | select(.is_implemented == true)] | length')
  
  echo "   Total categories: $count"
  echo "   Implemented: $implemented"
  
  if [ "$count" -eq 6 ] && [ "$implemented" -eq 2 ]; then
    success "Risk categories correct (6 total, 2 implemented)"
    echo "   Implemented categories:"
    echo "$response" | jq -r '.data[] | select(.is_implemented == true) | "   - \(.display_name)"'
  else
    error "Expected 6 categories with 2 implemented (got $count total, $implemented implemented)"
  fi
}

# Main test execution
main() {
  test_db
  test_api
  setup_test_data
  
  test_supply_risk
  test_demand_risk
  test_composite_risk
  test_risk_history
  test_risk_events
  test_risk_categories
  
  echo ""
  echo "========================================="
  echo "Test Summary"
  echo "========================================="
  success "All risk scoring tests completed!"
  echo ""
  info "Next steps:"
  echo "   1. Review risk scores in database"
  echo "   2. Test frontend components"
  echo "   3. Verify JEDI Score integration"
  echo "   4. Configure alert thresholds"
  echo ""
  info "Useful queries:"
  echo "   psql -U $DB_USER -d $DB_NAME -c 'SELECT * FROM current_risk_scores;'"
  echo "   psql -U $DB_USER -d $DB_NAME -c 'SELECT * FROM active_risk_events;'"
  echo "   psql -U $DB_USER -d $DB_NAME -c 'SELECT * FROM supply_pipeline_summary;'"
  echo ""
}

# Run tests
main

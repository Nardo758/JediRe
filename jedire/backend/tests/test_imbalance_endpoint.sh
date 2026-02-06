#!/bin/bash
# Regression test for /api/v1/analysis/imbalance endpoint
# Tests both CoStar data mode and legacy mode

set -e

API_URL="${API_URL:-http://localhost:4000}"
ENDPOINT="$API_URL/api/v1/analysis/imbalance"

echo "========================================="
echo "Testing Imbalance Endpoint"
echo "API: $API_URL"
echo "========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

test_passed=0
test_failed=0

# Test 1: CoStar data mode
echo -e "${YELLOW}Test 1: CoStar Data Mode (use_costar_data=true)${NC}"
echo "Request: POST $ENDPOINT"

response=$(curl -s -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Atlanta Test Market",
    "population": 50000,
    "existing_units": 15000,
    "use_costar_data": true
  }')

if echo "$response" | grep -q '"success":true'; then
  echo -e "${GREEN}✓ PASSED${NC} - CoStar mode works without rent_timeseries"
  test_passed=$((test_passed + 1))
else
  echo -e "${RED}✗ FAILED${NC} - Expected success:true"
  echo "Response: $response"
  test_failed=$((test_failed + 1))
fi
echo ""

# Test 2: Legacy mode with rent_timeseries
echo -e "${YELLOW}Test 2: Legacy Mode (with rent_timeseries)${NC}"
echo "Request: POST $ENDPOINT"

response=$(curl -s -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Market Legacy",
    "population": 50000,
    "existing_units": 15000,
    "rent_timeseries": [1500, 1520, 1540, 1565, 1590, 1610, 1630, 1650, 1670, 1690, 1710, 1730]
  }')

if echo "$response" | grep -q '"success":true'; then
  echo -e "${GREEN}✓ PASSED${NC} - Legacy mode works with rent_timeseries"
  test_passed=$((test_passed + 1))
else
  echo -e "${RED}✗ FAILED${NC} - Expected success:true"
  echo "Response: $response"
  test_failed=$((test_failed + 1))
fi
echo ""

# Test 3: Error case (neither provided)
echo -e "${YELLOW}Test 3: Error Handling (no data source)${NC}"
echo "Request: POST $ENDPOINT"

response=$(curl -s -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Market Error",
    "population": 50000,
    "existing_units": 15000
  }')

if echo "$response" | grep -q '"success":false' && echo "$response" | grep -q "rent_timeseries"; then
  echo -e "${GREEN}✓ PASSED${NC} - Proper error message returned"
  test_passed=$((test_passed + 1))
else
  echo -e "${RED}✗ FAILED${NC} - Expected error about rent_timeseries"
  echo "Response: $response"
  test_failed=$((test_failed + 1))
fi
echo ""

# Summary
echo "========================================="
echo "Test Summary"
echo "========================================="
echo -e "Passed: ${GREEN}$test_passed${NC}"
echo -e "Failed: ${RED}$test_failed${NC}"
echo "========================================="

if [ $test_failed -eq 0 ]; then
  echo -e "${GREEN}All tests passed!${NC}"
  exit 0
else
  echo -e "${RED}Some tests failed!${NC}"
  exit 1
fi

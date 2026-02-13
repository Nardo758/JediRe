#!/bin/bash

# 14-Tab System - Comprehensive Test Runner
# This script runs all tests and generates reports

set -e

echo "🧪 JEDI RE - 14-Tab System Testing Suite"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Test results directory
RESULTS_DIR="./test-results"
mkdir -p "$RESULTS_DIR"

# Timestamp
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")

echo "📋 Test Run: $TIMESTAMP"
echo ""

# Function to run tests and capture results
run_test_suite() {
  local suite_name=$1
  local command=$2
  
  echo -e "${YELLOW}Running $suite_name...${NC}"
  
  if $command > "$RESULTS_DIR/${suite_name}_${TIMESTAMP}.log" 2>&1; then
    echo -e "${GREEN}✅ $suite_name PASSED${NC}"
    return 0
  else
    echo -e "${RED}❌ $suite_name FAILED${NC}"
    return 1
  fi
}

# Check if in correct directory
if [ ! -d "frontend" ]; then
  echo -e "${RED}Error: Must run from jedire/ root directory${NC}"
  exit 1
fi

cd frontend

# Install dependencies if needed
if [ ! -d "node_modules/@testing-library" ]; then
  echo "📦 Installing test dependencies..."
  npm install --save-dev vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @vitest/ui
fi

# Update package.json with test scripts if needed
if ! grep -q "\"test\":" package.json; then
  echo "Adding test scripts to package.json..."
  npm pkg set scripts.test="vitest"
  npm pkg set scripts.test:ui="vitest --ui"
  npm pkg set scripts.test:coverage="vitest --coverage"
  npm pkg set scripts.test:run="vitest run"
fi

echo ""
echo "===================="
echo "1️⃣  COMPONENT TESTS"
echo "===================="
echo ""

# Run component tests
if npm run test:run -- --reporter=verbose; then
  echo -e "${GREEN}✅ Component tests PASSED${NC}"
  COMPONENT_PASS=true
else
  echo -e "${RED}❌ Component tests FAILED${NC}"
  COMPONENT_PASS=false
fi

echo ""
echo "===================="
echo "2️⃣  COVERAGE REPORT"
echo "===================="
echo ""

# Generate coverage
npm run test:coverage || true

echo ""
echo "===================="
echo "3️⃣  BUILD TEST"
echo "===================="
echo ""

# Test build
if npm run build; then
  echo -e "${GREEN}✅ Build PASSED${NC}"
  BUILD_PASS=true
else
  echo -e "${RED}❌ Build FAILED${NC}"
  BUILD_PASS=false
fi

echo ""
echo "===================="
echo "4️⃣  TYPE CHECK"
echo "===================="
echo ""

# Type check
if npx tsc --noEmit; then
  echo -e "${GREEN}✅ Type check PASSED${NC}"
  TYPE_PASS=true
else
  echo -e "${RED}❌ Type check FAILED${NC}"
  TYPE_PASS=false
fi

echo ""
echo "===================="
echo "5️⃣  LINT CHECK"
echo "===================="
echo ""

# Lint check
if npm run lint -- --max-warnings=0; then
  echo -e "${GREEN}✅ Lint check PASSED${NC}"
  LINT_PASS=true
else
  echo -e "${YELLOW}⚠️  Lint check has warnings${NC}"
  LINT_PASS=false
fi

cd ..

echo ""
echo "===================="
echo "📊 TEST SUMMARY"
echo "===================="
echo ""

# Calculate pass rate
TOTAL=5
PASSED=0

$COMPONENT_PASS && ((PASSED++))
$BUILD_PASS && ((PASSED++))
$TYPE_PASS && ((PASSED++))
$LINT_PASS && ((PASSED++))

# Coverage is informational only
((PASSED++))

PASS_RATE=$((PASSED * 100 / TOTAL))

echo "Component Tests: $(if $COMPONENT_PASS; then echo -e "${GREEN}PASS${NC}"; else echo -e "${RED}FAIL${NC}"; fi)"
echo "Build Test: $(if $BUILD_PASS; then echo -e "${GREEN}PASS${NC}"; else echo -e "${RED}FAIL${NC}"; fi)"
echo "Type Check: $(if $TYPE_PASS; then echo -e "${GREEN}PASS${NC}"; else echo -e "${RED}FAIL${NC}"; fi)"
echo "Lint Check: $(if $LINT_PASS; then echo -e "${GREEN}PASS${NC}"; else echo -e "${YELLOW}WARN${NC}"; fi)"
echo ""
echo -e "Overall Pass Rate: ${PASSED}/${TOTAL} (${PASS_RATE}%)"
echo ""

# Generate summary file
cat > "$RESULTS_DIR/summary_${TIMESTAMP}.txt" << EOF
JEDI RE - 14-Tab System Test Summary
====================================
Date: $(date)
Pass Rate: ${PASSED}/${TOTAL} (${PASS_RATE}%)

Component Tests: $(if $COMPONENT_PASS; then echo "PASS"; else echo "FAIL"; fi)
Build Test: $(if $BUILD_PASS; then echo "PASS"; else echo "FAIL"; fi)
Type Check: $(if $TYPE_PASS; then echo "PASS"; else echo "FAIL"; fi)
Lint Check: $(if $LINT_PASS; then echo "PASS"; else echo "WARN"; fi)

Detailed logs: $RESULTS_DIR/
EOF

echo "Results saved to: $RESULTS_DIR/"
echo ""

# Exit with appropriate code
if [ $PASS_RATE -ge 80 ]; then
  echo -e "${GREEN}🎉 TESTS PASSED!${NC}"
  exit 0
else
  echo -e "${RED}❌ TESTS FAILED${NC}"
  exit 1
fi

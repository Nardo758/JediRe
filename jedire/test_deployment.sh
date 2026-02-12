#!/bin/bash
# JediRe Deployment Verification Script
# Tests all components to ensure everything works

set -e

BASE_URL="${1:-http://localhost:4000}"
FRONTEND_URL="${2:-http://localhost:3000}"

echo "════════════════════════════════════════════════════════════"
echo "  🧪 JediRe Deployment Verification"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "Testing endpoints:"
echo "  Backend:  $BASE_URL"
echo "  Frontend: $FRONTEND_URL"
echo ""
echo "────────────────────────────────────────────────────────────"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0

# Helper function to test endpoint
test_endpoint() {
    local name="$1"
    local url="$2"
    local expected_status="${3:-200}"
    
    echo -n "Testing $name... "
    
    response=$(curl -s -w "\n%{http_code}" "$url" 2>&1)
    status_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$status_code" = "$expected_status" ]; then
        echo -e "${GREEN}✓ PASS${NC} (HTTP $status_code)"
        PASSED=$((PASSED + 1))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (HTTP $status_code, expected $expected_status)"
        FAILED=$((FAILED + 1))
        return 1
    fi
}

# Helper to test JSON response
test_json_field() {
    local name="$1"
    local url="$2"
    local field="$3"
    
    echo -n "Testing $name... "
    
    response=$(curl -s "$url" 2>&1)
    
    if echo "$response" | grep -q "\"$field\""; then
        echo -e "${GREEN}✓ PASS${NC} (field '$field' found)"
        PASSED=$((PASSED + 1))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (field '$field' not found)"
        FAILED=$((FAILED + 1))
        return 1
    fi
}

# ============================================
# Test 1: Health Check
# ============================================
echo ""
echo "📊 Test 1: Health Check"
echo "────────────────────────────────────────────────────────────"

test_endpoint "Backend health" "$BASE_URL/health"
test_json_field "Health status field" "$BASE_URL/health" "status"
test_json_field "Database status" "$BASE_URL/health" "database"

# ============================================
# Test 2: API Endpoints
# ============================================
echo ""
echo "📡 Test 2: API Endpoints"
echo "────────────────────────────────────────────────────────────"

test_endpoint "Markets list" "$BASE_URL/api/v1/markets"
test_endpoint "Supply metrics (Austin)" "$BASE_URL/api/v1/supply/Austin,%20TX"
test_endpoint "Properties list" "$BASE_URL/api/v1/properties"

# ============================================
# Test 3: Database Connection
# ============================================
echo ""
echo "💾 Test 3: Database Connection"
echo "────────────────────────────────────────────────────────────"

if [ ! -z "$DATABASE_URL" ]; then
    echo -n "Testing database connection... "
    if psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ PASS${NC}"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}✗ FAIL${NC}"
        FAILED=$((FAILED + 1))
    fi
    
    echo -n "Testing users table exists... "
    if psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM users;" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ PASS${NC}"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}✗ FAIL${NC}"
        FAILED=$((FAILED + 1))
    fi
    
    echo -n "Testing supply_metrics table exists... "
    if psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM supply_metrics;" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ PASS${NC}"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}✗ FAIL${NC}"
        FAILED=$((FAILED + 1))
    fi
else
    echo -e "${YELLOW}⚠ SKIP${NC} (DATABASE_URL not set)"
fi

# ============================================
# Test 4: Authentication
# ============================================
echo ""
echo "🔐 Test 4: Authentication"
echo "────────────────────────────────────────────────────────────"

echo -n "Testing login endpoint... "
login_response=$(curl -s -X POST "$BASE_URL/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"demo@jedire.com","password":"demo123"}' \
    -w "\n%{http_code}")

status_code=$(echo "$login_response" | tail -n1)
body=$(echo "$login_response" | head -n-1)

if [ "$status_code" = "200" ] && echo "$body" | grep -q "success"; then
    echo -e "${GREEN}✓ PASS${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}✗ FAIL${NC}"
    FAILED=$((FAILED + 1))
fi

# ============================================
# Test 5: Frontend (Basic)
# ============================================
echo ""
echo "🎨 Test 5: Frontend"
echo "────────────────────────────────────────────────────────────"

test_endpoint "Frontend index" "$FRONTEND_URL" 200

# ============================================
# Test 6: File Structure
# ============================================
echo ""
echo "📁 Test 6: File Structure"
echo "────────────────────────────────────────────────────────────"

check_file() {
    local file="$1"
    echo -n "Checking $file... "
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓ EXISTS${NC}"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}✗ MISSING${NC}"
        FAILED=$((FAILED + 1))
    fi
}

check_file "run.sh"
check_file ".replit"
check_file "backend/src/index.ts"
check_file "frontend/package.json"
check_file "migrations/replit/001_core_simple.sql"

# ============================================
# Results Summary
# ============================================
echo ""
echo "════════════════════════════════════════════════════════════"
echo "  📊 Test Results"
echo "════════════════════════════════════════════════════════════"
echo ""
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  ✅ ALL TESTS PASSED!${NC}"
    echo -e "${GREEN}  Your JediRe deployment is working correctly!${NC}"
    echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
    exit 0
else
    echo -e "${RED}════════════════════════════════════════════════════════════${NC}"
    echo -e "${RED}  ⚠️  SOME TESTS FAILED${NC}"
    echo -e "${RED}  Please check the errors above and troubleshoot.${NC}"
    echo -e "${RED}════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo "Troubleshooting:"
    echo "  1. Check if all services are running"
    echo "  2. Verify DATABASE_URL is set correctly"
    echo "  3. Review console logs for errors"
    echo "  4. See REPLIT_SETUP.md for help"
    exit 1
fi

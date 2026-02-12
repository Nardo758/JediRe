#!/bin/bash
#
# JEDI Score Integration Test Script
# Tests Phase 1, Week 3 deliverables
#
# Usage: ./test-jedi-score.sh [token] [deal_id]
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${BASE_URL:-http://localhost:4000}"
TOKEN="${1:-}"
DEAL_ID="${2:-}"

# Helper functions
print_header() {
    echo ""
    echo -e "${BLUE}=======================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}=======================================${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

check_response() {
    local response="$1"
    local expected="$2"
    
    if echo "$response" | grep -q "\"success\":true"; then
        print_success "$expected"
        return 0
    else
        print_error "$expected"
        echo "Response: $response"
        return 1
    fi
}

# Check prerequisites
print_header "Checking Prerequisites"

if [ -z "$TOKEN" ]; then
    print_error "No authentication token provided"
    echo "Usage: ./test-jedi-score.sh [token] [deal_id]"
    exit 1
fi
print_success "Authentication token provided"

if [ -z "$DEAL_ID" ]; then
    print_warning "No deal ID provided, will test available endpoints only"
else
    print_success "Deal ID provided: $DEAL_ID"
fi

# Test database migration
print_header "Test 1: Database Schema"

if command -v psql > /dev/null 2>&1 && [ -n "$DATABASE_URL" ]; then
    print_info "Testing database tables..."
    
    # Check jedi_score_history table
    if psql "$DATABASE_URL" -c "\d jedi_score_history" > /dev/null 2>&1; then
        print_success "jedi_score_history table exists"
    else
        print_error "jedi_score_history table not found"
    fi
    
    # Check deal_alerts table
    if psql "$DATABASE_URL" -c "\d deal_alerts" > /dev/null 2>&1; then
        print_success "deal_alerts table exists"
    else
        print_error "deal_alerts table not found"
    fi
    
    # Check alert_configurations table
    if psql "$DATABASE_URL" -c "\d alert_configurations" > /dev/null 2>&1; then
        print_success "alert_configurations table exists"
    else
        print_error "alert_configurations table not found"
    fi
    
    # Check demand_signal_weights table
    if psql "$DATABASE_URL" -c "\d demand_signal_weights" > /dev/null 2>&1; then
        print_success "demand_signal_weights table exists"
        
        # Check if seeded
        count=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM demand_signal_weights" | tr -d ' ')
        if [ "$count" -gt 0 ]; then
            print_success "demand_signal_weights has $count seed records"
        else
            print_warning "demand_signal_weights is empty (should have seed data)"
        fi
    else
        print_error "demand_signal_weights table not found"
    fi
else
    print_warning "psql not available or DATABASE_URL not set, skipping database tests"
fi

# Test API endpoints
print_header "Test 2: Alert Settings API"

print_info "GET /api/v1/jedi/alerts/settings"
response=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/api/v1/jedi/alerts/settings" \
    -H "Authorization: Bearer $TOKEN")

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" = "200" ]; then
    check_response "$body" "Get alert settings"
    echo "$body" | jq '.' 2>/dev/null || echo "$body"
else
    print_error "HTTP $http_code - Get alert settings failed"
    echo "$body"
fi

print_info "PATCH /api/v1/jedi/alerts/settings"
response=$(curl -s -w "\n%{http_code}" -X PATCH "$BASE_URL/api/v1/jedi/alerts/settings" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"scoreChangeThreshold": 2.5}')

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" = "200" ]; then
    check_response "$body" "Update alert settings"
else
    print_error "HTTP $http_code - Update alert settings failed"
fi

# Test alerts list
print_header "Test 3: Alerts API"

print_info "GET /api/v1/jedi/alerts"
response=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/api/v1/jedi/alerts" \
    -H "Authorization: Bearer $TOKEN")

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" = "200" ]; then
    check_response "$body" "Get user alerts"
    
    # Extract counts
    if command -v jq > /dev/null 2>&1; then
        total=$(echo "$body" | jq -r '.data.counts.total // 0')
        unread=$(echo "$body" | jq -r '.data.counts.unread // 0')
        green=$(echo "$body" | jq -r '.data.counts.green // 0')
        yellow=$(echo "$body" | jq -r '.data.counts.yellow // 0')
        red=$(echo "$body" | jq -r '.data.counts.red // 0')
        
        print_info "Alert counts: Total=$total, Unread=$unread, Green=$green, Yellow=$yellow, Red=$red"
    fi
else
    print_error "HTTP $http_code - Get alerts failed"
fi

print_info "GET /api/v1/jedi/alerts?unread_only=true"
response=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/api/v1/jedi/alerts?unread_only=true" \
    -H "Authorization: Bearer $TOKEN")

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" = "200" ]; then
    check_response "$body" "Get unread alerts"
else
    print_error "HTTP $http_code - Get unread alerts failed"
fi

# Test JEDI Score endpoints (if deal_id provided)
if [ -n "$DEAL_ID" ]; then
    print_header "Test 4: JEDI Score API (Deal: $DEAL_ID)"
    
    print_info "GET /api/v1/jedi/score/$DEAL_ID"
    response=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/api/v1/jedi/score/$DEAL_ID" \
        -H "Authorization: Bearer $TOKEN")
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" = "200" ]; then
        check_response "$body" "Get JEDI Score"
        
        if command -v jq > /dev/null 2>&1; then
            score=$(echo "$body" | jq -r '.data.score.totalScore // "N/A"')
            demand=$(echo "$body" | jq -r '.data.score.demandScore // "N/A"')
            supply=$(echo "$body" | jq -r '.data.score.supplyScore // "N/A"')
            
            print_info "JEDI Score: $score (Demand: $demand, Supply: $supply)"
            
            # Display breakdown
            echo ""
            echo "$body" | jq '.data.breakdown' 2>/dev/null || echo "Breakdown not available"
        fi
    else
        print_error "HTTP $http_code - Get JEDI Score failed"
        echo "$body"
    fi
    
    print_info "POST /api/v1/jedi/score/$DEAL_ID/recalculate"
    response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/v1/jedi/score/$DEAL_ID/recalculate" \
        -H "Authorization: Bearer $TOKEN")
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" = "200" ]; then
        check_response "$body" "Recalculate JEDI Score"
        
        if command -v jq > /dev/null 2>&1; then
            new_score=$(echo "$body" | jq -r '.data.totalScore // "N/A"')
            delta=$(echo "$body" | jq -r '.data.scoreDelta // "N/A"')
            
            print_info "New Score: $new_score (Change: $delta)"
        fi
    else
        print_error "HTTP $http_code - Recalculate JEDI Score failed"
        echo "$body"
    fi
    
    print_info "GET /api/v1/jedi/history/$DEAL_ID?limit=10"
    response=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/api/v1/jedi/history/$DEAL_ID?limit=10" \
        -H "Authorization: Bearer $TOKEN")
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" = "200" ]; then
        check_response "$body" "Get JEDI Score history"
        
        if command -v jq > /dev/null 2>&1; then
            count=$(echo "$body" | jq -r '.data.count // 0')
            print_info "History entries: $count"
            
            if [ "$count" -gt 0 ]; then
                echo "$body" | jq '.data.stats' 2>/dev/null || echo "Stats not available"
            fi
        fi
    else
        print_error "HTTP $http_code - Get JEDI Score history failed"
    fi
    
    print_info "GET /api/v1/jedi/impact/$DEAL_ID"
    response=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/api/v1/jedi/impact/$DEAL_ID" \
        -H "Authorization: Bearer $TOKEN")
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" = "200" ]; then
        check_response "$body" "Get impacting events"
        
        if command -v jq > /dev/null 2>&1; then
            event_count=$(echo "$body" | jq -r '.data.total // 0')
            print_info "Impacting events: $event_count"
            
            if [ "$event_count" -gt 0 ]; then
                echo ""
                echo "Event categories:"
                echo "$body" | jq '.data.grouped | keys' 2>/dev/null || echo "Grouped data not available"
            fi
        fi
    else
        print_error "HTTP $http_code - Get impacting events failed"
    fi
    
    print_info "GET /api/v1/jedi/alerts/deal/$DEAL_ID"
    response=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/api/v1/jedi/alerts/deal/$DEAL_ID" \
        -H "Authorization: Bearer $TOKEN")
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" = "200" ]; then
        check_response "$body" "Get deal-specific alerts"
        
        if command -v jq > /dev/null 2>&1; then
            alert_count=$(echo "$body" | jq -r '.data | length')
            print_info "Deal alerts: $alert_count"
        fi
    else
        print_error "HTTP $http_code - Get deal alerts failed"
    fi
fi

# Test frontend components
print_header "Test 5: Frontend Components"

if [ -d "frontend/src/components/jedi" ]; then
    if [ -f "frontend/src/components/jedi/AlertsPanel.tsx" ]; then
        print_success "AlertsPanel.tsx exists"
    else
        print_error "AlertsPanel.tsx not found"
    fi
    
    if [ -f "frontend/src/components/jedi/JEDIScoreBreakdown.tsx" ]; then
        print_success "JEDIScoreBreakdown.tsx exists"
    else
        print_error "JEDIScoreBreakdown.tsx not found"
    fi
    
    if [ -f "frontend/src/components/jedi/EventTimeline.tsx" ]; then
        print_success "EventTimeline.tsx exists"
    else
        print_error "EventTimeline.tsx not found"
    fi
    
    if [ -f "frontend/src/components/jedi/index.ts" ]; then
        print_success "index.ts exports exist"
    else
        print_error "index.ts not found"
    fi
else
    print_warning "Frontend components directory not found"
fi

# Test backend services
print_header "Test 6: Backend Services"

if [ -f "backend/src/services/jedi-score.service.ts" ]; then
    print_success "jedi-score.service.ts exists"
else
    print_error "jedi-score.service.ts not found"
fi

if [ -f "backend/src/services/deal-alert.service.ts" ]; then
    print_success "deal-alert.service.ts exists"
else
    print_error "deal-alert.service.ts not found"
fi

if [ -f "backend/src/api/rest/jedi.routes.ts" ]; then
    print_success "jedi.routes.ts exists"
else
    print_error "jedi.routes.ts not found"
fi

# Check if routes are registered
if grep -q "jediRoutes" backend/src/api/rest/index.ts 2>/dev/null; then
    print_success "jediRoutes registered in index.ts"
else
    print_error "jediRoutes not registered in index.ts"
fi

# Summary
print_header "Test Summary"

echo ""
print_info "Tests completed!"
echo ""
print_info "Next steps:"
echo "  1. Review any failed tests above"
echo "  2. Apply database migration if tables don't exist:"
echo "     psql \$DATABASE_URL -f backend/src/database/migrations/024_jedi_alerts.sql"
echo "  3. Test with a real deal by providing DEAL_ID:"
echo "     ./test-jedi-score.sh YOUR_TOKEN YOUR_DEAL_ID"
echo "  4. Review documentation:"
echo "     - JEDI_SCORE_INTEGRATION.md (complete guide)"
echo "     - JEDI_SCORE_QUICK_START.md (5-minute setup)"
echo ""

exit 0

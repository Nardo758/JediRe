#!/bin/bash
################################################################################
# JEDI RE - System Health Check
# 
# Comprehensive health check for production monitoring
# 
# Usage: bash scripts/check-system-health.sh [environment]
# Schedule: Run every 5 minutes via cron
################################################################################

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ENVIRONMENT=${1:-production}
EXIT_CODE=0

echo -e "${BLUE}======================================"
echo "JEDI RE - System Health Check"
echo "Environment: $ENVIRONMENT"
echo "Time: $(date)"
echo "======================================${NC}"

# ============================================================================
# Configuration
# ============================================================================

if [[ "$ENVIRONMENT" == "production" ]]; then
    API_URL="https://api.jedire.com"
    DATABASE_URL="$PRODUCTION_DATABASE_URL"
elif [[ "$ENVIRONMENT" == "staging" ]]; then
    API_URL="https://jedire-staging.replit.app"
    DATABASE_URL="$STAGING_DATABASE_URL"
else
    API_URL="http://localhost:3000"
    DATABASE_URL="$DATABASE_URL"
fi

# ============================================================================
# Health Checks
# ============================================================================

# 1. API Health Endpoint
echo ""
echo -e "${YELLOW}[1/7] API Health Endpoint${NC}"
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/health" --max-time 5)

if [[ "$HEALTH_STATUS" == "200" ]]; then
    echo -e "${GREEN}✓ API is responding (HTTP 200)${NC}"
else
    echo -e "${RED}✗ API health check failed (HTTP $HEALTH_STATUS)${NC}"
    EXIT_CODE=1
fi

# 2. API Response Time
echo ""
echo -e "${YELLOW}[2/7] API Response Time${NC}"
RESPONSE_TIME=$(curl -s -o /dev/null -w "%{time_total}" "$API_URL/health" --max-time 10)
RESPONSE_TIME_MS=$(echo "$RESPONSE_TIME * 1000" | bc)

if (( $(echo "$RESPONSE_TIME < 2.0" | bc -l) )); then
    echo -e "${GREEN}✓ Response time: ${RESPONSE_TIME_MS}ms (<2s)${NC}"
else
    echo -e "${YELLOW}⚠ Response time: ${RESPONSE_TIME_MS}ms (slow)${NC}"
fi

# 3. Database Connectivity
echo ""
echo -e "${YELLOW}[3/7] Database Connection${NC}"
if [[ -n "$DATABASE_URL" ]]; then
    if psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Database connected${NC}"
    else
        echo -e "${RED}✗ Database connection failed${NC}"
        EXIT_CODE=1
    fi
else
    echo -e "${YELLOW}⚠ DATABASE_URL not set${NC}"
fi

# 4. Database Size
echo ""
echo -e "${YELLOW}[4/7] Database Size${NC}"
if [[ -n "$DATABASE_URL" ]]; then
    DB_SIZE=$(psql "$DATABASE_URL" -t -c "SELECT pg_size_pretty(pg_database_size(current_database()));" 2>/dev/null | xargs)
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Database size: $DB_SIZE${NC}"
    else
        echo -e "${YELLOW}⚠ Could not get database size${NC}"
    fi
fi

# 5. Disk Space
echo ""
echo -e "${YELLOW}[5/7] Disk Space${NC}"
DISK_USAGE=$(df -h . | tail -1 | awk '{print $5}' | sed 's/%//')

if [ "$DISK_USAGE" -lt 80 ]; then
    echo -e "${GREEN}✓ Disk usage: ${DISK_USAGE}%${NC}"
elif [ "$DISK_USAGE" -lt 90 ]; then
    echo -e "${YELLOW}⚠ Disk usage: ${DISK_USAGE}% (warning)${NC}"
else
    echo -e "${RED}✗ Disk usage: ${DISK_USAGE}% (critical)${NC}"
    EXIT_CODE=1
fi

# 6. Memory Usage
echo ""
echo -e "${YELLOW}[6/7] Memory Usage${NC}"
if command -v free &> /dev/null; then
    MEMORY_USAGE=$(free | grep Mem | awk '{print int($3/$2 * 100)}')
    
    if [ "$MEMORY_USAGE" -lt 80 ]; then
        echo -e "${GREEN}✓ Memory usage: ${MEMORY_USAGE}%${NC}"
    elif [ "$MEMORY_USAGE" -lt 90 ]; then
        echo -e "${YELLOW}⚠ Memory usage: ${MEMORY_USAGE}% (warning)${NC}"
    else
        echo -e "${RED}✗ Memory usage: ${MEMORY_USAGE}% (critical)${NC}"
        EXIT_CODE=1
    fi
else
    echo -e "${YELLOW}⚠ Memory check not available${NC}"
fi

# 7. Recent Errors (from logs)
echo ""
echo -e "${YELLOW}[7/7] Recent Errors${NC}"
LOG_FILE="/var/log/jedire/error.log"

if [ -f "$LOG_FILE" ]; then
    # Count errors in last 5 minutes
    ERROR_COUNT=$(grep "ERROR" "$LOG_FILE" | grep -c "$(date -d '5 minutes ago' '+%Y-%m-%d')" 2>/dev/null || echo 0)
    
    if [ "$ERROR_COUNT" -eq 0 ]; then
        echo -e "${GREEN}✓ No recent errors${NC}"
    elif [ "$ERROR_COUNT" -lt 10 ]; then
        echo -e "${YELLOW}⚠ ${ERROR_COUNT} errors in last 5 minutes${NC}"
    else
        echo -e "${RED}✗ ${ERROR_COUNT} errors in last 5 minutes (high)${NC}"
        EXIT_CODE=1
    fi
else
    echo -e "${YELLOW}⚠ Log file not found${NC}"
fi

# ============================================================================
# API Endpoint Tests
# ============================================================================

echo ""
echo -e "${BLUE}API Endpoint Tests${NC}"

# Test critical endpoints
ENDPOINTS=(
    "/health"
    "/api/v1"
)

for endpoint in "${ENDPOINTS[@]}"; do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL$endpoint" --max-time 5)
    
    if [[ "$STATUS" == "200" ]]; then
        echo -e "${GREEN}✓ $endpoint (HTTP $STATUS)${NC}"
    else
        echo -e "${RED}✗ $endpoint (HTTP $STATUS)${NC}"
        EXIT_CODE=1
    fi
done

# ============================================================================
# Summary
# ============================================================================

echo ""
echo -e "${BLUE}======================================${NC}"

if [ $EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}System Health: OK${NC}"
    echo -e "${GREEN}All checks passed${NC}"
else
    echo -e "${RED}System Health: DEGRADED${NC}"
    echo -e "${RED}Some checks failed${NC}"
    
    # Send alert (optional)
    if command -v mail &> /dev/null && [[ -n "$ALERT_EMAIL" ]]; then
        echo "Health check failed at $(date)" | mail -s "JEDI RE Health Check Failed ($ENVIRONMENT)" "$ALERT_EMAIL"
    fi
fi

echo -e "${BLUE}======================================${NC}"
echo ""

exit $EXIT_CODE

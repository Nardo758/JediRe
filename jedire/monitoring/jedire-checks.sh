#!/bin/bash
# JediRe Quick Code Quality Checks
# Designed to run fast (<30s) during heartbeat cycles

set -e

JEDIRE_DIR="/home/leon/clawd/jedire"
REPORT_FILE="/tmp/jedire-check-report.txt"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Color codes for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo "=== JediRe Code Quality Check ===" > "$REPORT_FILE"
echo "Timestamp: $TIMESTAMP" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

ISSUES_FOUND=0

# 1. TypeScript errors check
echo -e "${YELLOW}Checking TypeScript errors...${NC}"
cd "$JEDIRE_DIR"
if [ -f "package.json" ]; then
    if npx tsc --noEmit --project . 2>&1 | grep -i "error" > /tmp/tsc-errors.txt; then
        ERROR_COUNT=$(wc -l < /tmp/tsc-errors.txt)
        echo "[FAIL] TypeScript: $ERROR_COUNT errors found" >> "$REPORT_FILE"
        head -n 10 /tmp/tsc-errors.txt >> "$REPORT_FILE"
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
    else
        echo "[PASS] TypeScript: No errors" >> "$REPORT_FILE"
    fi
else
    echo "[SKIP] TypeScript: No package.json found" >> "$REPORT_FILE"
fi
echo "" >> "$REPORT_FILE"

# 2. Dependency vulnerabilities check
echo -e "${YELLOW}Checking npm vulnerabilities...${NC}"
cd "$JEDIRE_DIR"
if [ -f "package.json" ]; then
    AUDIT_OUTPUT=$(npm audit --audit-level=moderate 2>&1 || true)
    if echo "$AUDIT_OUTPUT" | grep -q "vulnerabilities"; then
        VULN_COUNT=$(echo "$AUDIT_OUTPUT" | grep -oP '\d+(?= vulnerabilities)' | head -1)
        if [ ! -z "$VULN_COUNT" ] && [ "$VULN_COUNT" -gt 0 ]; then
            echo "[WARN] npm audit: $VULN_COUNT vulnerabilities found" >> "$REPORT_FILE"
            echo "$AUDIT_OUTPUT" | grep -E "(high|critical|moderate)" | head -n 5 >> "$REPORT_FILE"
            ISSUES_FOUND=$((ISSUES_FOUND + 1))
        else
            echo "[PASS] npm audit: No significant vulnerabilities" >> "$REPORT_FILE"
        fi
    else
        echo "[PASS] npm audit: No vulnerabilities" >> "$REPORT_FILE"
    fi
else
    echo "[SKIP] npm audit: No package.json" >> "$REPORT_FILE"
fi
echo "" >> "$REPORT_FILE"

# 3. Large file changes check
echo -e "${YELLOW}Checking for large file changes...${NC}"
cd "$JEDIRE_DIR"
if [ -d ".git" ]; then
    LARGE_FILES=$(git diff --stat HEAD~1..HEAD 2>/dev/null | awk '{if($3 > 500) print $1, $3}' || echo "")
    if [ ! -z "$LARGE_FILES" ]; then
        echo "[WARN] Large file changes detected:" >> "$REPORT_FILE"
        echo "$LARGE_FILES" >> "$REPORT_FILE"
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
    else
        echo "[PASS] No unusually large file changes" >> "$REPORT_FILE"
    fi
else
    echo "[SKIP] Git diff: Not a git repository" >> "$REPORT_FILE"
fi
echo "" >> "$REPORT_FILE"

# 4. Bundle size check (if build directory exists)
echo -e "${YELLOW}Checking bundle sizes...${NC}"
if [ -d "$JEDIRE_DIR/frontend/dist" ] || [ -d "$JEDIRE_DIR/frontend/build" ]; then
    BUILD_DIR=$([ -d "$JEDIRE_DIR/frontend/dist" ] && echo "$JEDIRE_DIR/frontend/dist" || echo "$JEDIRE_DIR/frontend/build")
    TOTAL_SIZE=$(du -sh "$BUILD_DIR" 2>/dev/null | cut -f1 || echo "0")
    LARGE_FILES=$(find "$BUILD_DIR" -type f -size +500k 2>/dev/null | wc -l || echo "0")
    
    echo "[INFO] Bundle size: $TOTAL_SIZE" >> "$REPORT_FILE"
    if [ "$LARGE_FILES" -gt 0 ]; then
        echo "[WARN] Found $LARGE_FILES files >500KB in build" >> "$REPORT_FILE"
        find "$BUILD_DIR" -type f -size +500k -exec ls -lh {} \; | awk '{print $5, $9}' | head -n 5 >> "$REPORT_FILE"
    fi
else
    echo "[SKIP] Bundle size: No build directory found" >> "$REPORT_FILE"
fi
echo "" >> "$REPORT_FILE"

# 5. Database slow query check (optional - requires DB connection)
echo -e "${YELLOW}Checking for slow queries...${NC}"
if [ -f "$JEDIRE_DIR/.env" ] && command -v psql &> /dev/null; then
    source "$JEDIRE_DIR/.env" 2>/dev/null || true
    if [ ! -z "$DATABASE_URL" ]; then
        # Check for queries taking >100ms (if pg_stat_statements is enabled)
        SLOW_QUERIES=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM pg_stat_statements WHERE mean_exec_time > 100;" 2>/dev/null || echo "0")
        if [ "$SLOW_QUERIES" -gt 0 ]; then
            echo "[WARN] Found $SLOW_QUERIES slow queries (>100ms)" >> "$REPORT_FILE"
            ISSUES_FOUND=$((ISSUES_FOUND + 1))
        else
            echo "[PASS] No slow queries detected" >> "$REPORT_FILE"
        fi
    else
        echo "[SKIP] Slow queries: DATABASE_URL not configured" >> "$REPORT_FILE"
    fi
else
    echo "[SKIP] Slow queries: No database access" >> "$REPORT_FILE"
fi
echo "" >> "$REPORT_FILE"

# Summary
echo "======================================" >> "$REPORT_FILE"
if [ $ISSUES_FOUND -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed!${NC}" >> "$REPORT_FILE"
    echo "Status: HEALTHY" >> "$REPORT_FILE"
else
    echo -e "${RED}⚠ Found $ISSUES_FOUND issue(s) requiring attention${NC}" >> "$REPORT_FILE"
    echo "Status: NEEDS_ATTENTION" >> "$REPORT_FILE"
fi
echo "======================================" >> "$REPORT_FILE"

# Output report
cat "$REPORT_FILE"

# Return exit code based on issues
exit $ISSUES_FOUND

#!/bin/bash
# Gmail Sync System Test Script

echo "==========================================="
echo "Gmail Sync System - Test Suite"
echo "==========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

API_BASE="${API_BASE:-http://localhost:3000}"
TOKEN="${AUTH_TOKEN}"

if [ -z "$TOKEN" ]; then
    echo -e "${RED}Error: AUTH_TOKEN environment variable not set${NC}"
    echo "Usage: AUTH_TOKEN=your-jwt-token ./test-gmail-sync.sh"
    exit 1
fi

echo "Testing against: $API_BASE"
echo ""

# Test 1: Get auth URL
echo -e "${YELLOW}Test 1: Get Gmail auth URL${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}" "$API_BASE/api/v1/gmail/auth-url" \
    -H "Authorization: Bearer $TOKEN")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Pass${NC} - Auth URL retrieved"
    echo "$BODY" | jq -r '.data.authUrl' | head -c 80
    echo "..."
else
    echo -e "${RED}✗ Fail${NC} - HTTP $HTTP_CODE"
    echo "$BODY"
fi
echo ""

# Test 2: List accounts
echo -e "${YELLOW}Test 2: List connected accounts${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}" "$API_BASE/api/v1/gmail/accounts" \
    -H "Authorization: Bearer $TOKEN")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
    COUNT=$(echo "$BODY" | jq -r '.count // 0')
    echo -e "${GREEN}✓ Pass${NC} - Found $COUNT connected accounts"
    echo "$BODY" | jq '.data[] | {email: .email_address, sync_enabled, last_sync_at}'
else
    echo -e "${RED}✗ Fail${NC} - HTTP $HTTP_CODE"
    echo "$BODY"
fi
echo ""

# Test 3: Get sync logs
echo -e "${YELLOW}Test 3: Get sync logs${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}" "$API_BASE/api/v1/gmail/sync-logs?limit=5" \
    -H "Authorization: Bearer $TOKEN")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
    COUNT=$(echo "$BODY" | jq -r '.data | length')
    echo -e "${GREEN}✓ Pass${NC} - Found $COUNT sync logs"
    echo "$BODY" | jq '.data[] | {email: .email_address, status: .sync_status, fetched: .messages_fetched}'
else
    echo -e "${RED}✗ Fail${NC} - HTTP $HTTP_CODE"
    echo "$BODY"
fi
echo ""

# Test 4: Get synced emails
echo -e "${YELLOW}Test 4: Get synced emails${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}" "$API_BASE/api/v1/gmail/emails?limit=5" \
    -H "Authorization: Bearer $TOKEN")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
    TOTAL=$(echo "$BODY" | jq -r '.pagination.total // 0')
    echo -e "${GREEN}✓ Pass${NC} - Found $TOTAL total emails"
    echo "$BODY" | jq '.data[] | {subject, from: .from_email, date: .received_at}'
else
    echo -e "${RED}✗ Fail${NC} - HTTP $HTTP_CODE"
    echo "$BODY"
fi
echo ""

# Test 5: Database check
echo -e "${YELLOW}Test 5: Database connectivity${NC}"
if [ -n "$DATABASE_URL" ]; then
    EMAIL_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM emails;" 2>/dev/null)
    ACCOUNT_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM user_email_accounts WHERE provider='google';" 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Pass${NC} - Database connected"
        echo "  - Emails in DB: $EMAIL_COUNT"
        echo "  - Gmail accounts in DB: $ACCOUNT_COUNT"
    else
        echo -e "${RED}✗ Fail${NC} - Database connection failed"
    fi
else
    echo -e "${YELLOW}⊘ Skip${NC} - DATABASE_URL not set"
fi
echo ""

echo "==========================================="
echo "Test Summary"
echo "==========================================="
echo ""
echo "Next steps:"
echo "1. Visit $API_BASE/../settings/email in your browser"
echo "2. Click 'Connect Gmail' to add an account"
echo "3. Run manual sync from the UI"
echo "4. Re-run this script to verify emails are synced"
echo ""
echo "To test manual sync via API:"
echo "  curl -X POST $API_BASE/api/v1/gmail/sync/ACCOUNT_ID \\"
echo "    -H 'Authorization: Bearer \$TOKEN'"
echo ""

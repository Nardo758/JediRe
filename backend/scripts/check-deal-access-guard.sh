#!/usr/bin/env bash
# B4a: Coverage guard — ensures every deal-read site uses the org-scoping helpers
# Run: bash backend/scripts/check-deal-access-guard.sh
# Exit 0 = clean; Exit 1 = raw user_id leaks found

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ROUTES="$ROOT/backend/src/api/rest"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

echo "=== B4a Deal-Scoping Coverage Guard ==="
echo ""

FAIL=0

# Pattern 1: direct user_id deal filters in route files — exclude known-safe annotations
echo "Checking for raw user_id deal filters in routes..."
HITS=$(grep -rn \
  --include="*.ts" \
  "FROM deals WHERE.*user_id\|WHERE.*deals.*user_id\|d\.user_id = \$" \
  "$ROUTES" 2>/dev/null \
  | grep -v "//\s*B4a\|B4a-admin\|B4a-aggregate\|B4a-tier-limit\|B4a-safe\|//.*safe\|INSERT INTO\|VALUES.*user_id\|user_id IS NOT NULL\|user_id IS NULL" \
  | grep -v "morning-brief\|dashboard\|admin\.routes" \
  || true)

if [[ -n "$HITS" ]]; then
  echo -e "${RED}FAIL: Unguarded user_id deal filters:${NC}"
  echo "$HITS"
  FAIL=1
else
  echo -e "${GREEN}OK${NC}"
fi

echo ""

# Pattern 2: deal selects NOT using assertDealOrgAccess in route files (BY-ID pattern)
echo "Checking for SELECT * FROM deals WHERE id = \$1 without org guard..."
RAW=$(grep -rn \
  --include="*.ts" \
  "FROM deals WHERE id = \$1\b" \
  "$ROUTES" 2>/dev/null \
  | grep -v "AND org_id\|assertDealOrgAccess\|//.*B4a\|deal-scoping\|B4a-safe\|boundary IS NOT NULL\|clawdbot-webhooks\|admin\.routes\|morning-brief\|dashboard" \
  | grep -v "SELECT.*FROM deals WHERE id = \$1.*AND archived_at IS NULL\|deal_data\|trade_area_id\|property_id\|project_type\|module_outputs\|name.*address\|status.*project" \
  || true)

if [[ -n "$RAW" ]]; then
  echo -e "${YELLOW}WARN: Possible unguarded by-id selects (review manually):${NC}"
  echo "$RAW" | head -20
else
  echo -e "${GREEN}OK${NC}"
fi

echo ""

# Pattern 3: verify deal-scoping service is imported wherever assertDealOrgAccess is called
echo "Checking assertDealOrgAccess callers have the import..."
CALLERS=$(grep -rl --include="*.ts" "assertDealOrgAccess\|dealListWhereClause\|resolveCallerOrg" "$ROUTES" 2>/dev/null || true)
MISSING_IMPORT=""
for f in $CALLERS; do
  if ! grep -q "deal-scoping.service\|import.*assertDealOrgAccess" "$f" 2>/dev/null; then
    # Check for dynamic import
    if ! grep -q "import('../../services/deal-scoping.service')" "$f" 2>/dev/null; then
      MISSING_IMPORT="$MISSING_IMPORT\n  $f"
    fi
  fi
done

if [[ -n "$MISSING_IMPORT" ]]; then
  echo -e "${RED}FAIL: Files using scoping helpers but missing the import:${NC}"
  echo -e "$MISSING_IMPORT"
  FAIL=1
else
  echo -e "${GREEN}OK${NC}"
fi

echo ""
if [[ $FAIL -eq 0 ]]; then
  echo -e "${GREEN}=== Coverage guard PASSED ===${NC}"
else
  echo -e "${RED}=== Coverage guard FAILED ===${NC}"
  exit 1
fi

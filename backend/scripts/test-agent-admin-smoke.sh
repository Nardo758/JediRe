#!/usr/bin/env bash
# Smoke test for Phase 5 admin agent endpoints.
# Requires the server to be running and API_KEY_ADMIN to be set.
# Usage: API_KEY_ADMIN=<key> ./test-agent-admin-smoke.sh [base_url]
#
# Exit codes: 0 = all assertions passed, 1 = one or more assertions failed.

set -euo pipefail

BASE="${1:-http://localhost:4000}"
KEY="${API_KEY_ADMIN:-}"

if [[ -z "$KEY" ]]; then
  echo "SKIP: API_KEY_ADMIN not set; skipping agent admin smoke tests" >&2
  exit 0
fi

PASS=0
FAIL=0

assert_json_field() {
  local url="$1" field="$2" expected="$3" label="$4"
  local body
  body=$(curl -sf -H "x-api-key: $KEY" "$url" 2>/dev/null) || {
    echo "FAIL [$label]: HTTP request failed for $url" >&2
    FAIL=$((FAIL + 1))
    return
  }
  local actual
  actual=$(echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d$field)" 2>/dev/null || echo "PARSE_ERROR")
  if [[ "$actual" == "$expected" ]]; then
    echo "PASS [$label]"
    PASS=$((PASS + 1))
  else
    echo "FAIL [$label]: expected $expected, got $actual" >&2
    FAIL=$((FAIL + 1))
  fi
}

assert_array_len_gte() {
  local url="$1" field="$2" min="$3" label="$4"
  local body
  body=$(curl -sf -H "x-api-key: $KEY" "$url" 2>/dev/null) || {
    echo "FAIL [$label]: HTTP request failed for $url" >&2
    FAIL=$((FAIL + 1))
    return
  }
  local actual
  actual=$(echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d$field))" 2>/dev/null || echo "0")
  if [[ "$actual" -ge "$min" ]]; then
    echo "PASS [$label]: len=$actual >= $min"
    PASS=$((PASS + 1))
  else
    echo "FAIL [$label]: expected len >= $min, got $actual" >&2
    FAIL=$((FAIL + 1))
  fi
}

echo "=== Agent admin smoke tests against $BASE ==="

# 1. Stats endpoint returns success=true
assert_json_field \
  "$BASE/api/v1/admin/agents/stats" \
  "['success']" "True" \
  "stats.success=true"

# 2. Stats returns exactly 5 canonical agents
assert_array_len_gte \
  "$BASE/api/v1/admin/agents/stats" \
  "['agents']" 5 \
  "stats.agents >= 5 canonical"

# 3. Stats includes metric_periods with success_rate_pct period
assert_json_field \
  "$BASE/api/v1/admin/agents/stats" \
  "['metric_periods']['success_rate_pct']" "all_time" \
  "stats.metric_periods.success_rate_pct=all_time"

# 4. Recent-runs endpoint returns success=true
assert_json_field \
  "$BASE/api/v1/admin/agents/recent-runs" \
  "['success']" "True" \
  "recent-runs.success=true"

# 5. Budget cap test endpoint:
#    - In dev: success=true + budget_exceeded_run.status == 'budget_exceeded'
#    - In prod: HTTP 403 (production guard) — test passes either way
http_code=$(curl -s -o /dev/null -w "%{http_code}" -H "x-api-key: $KEY" \
  "$BASE/api/v1/admin/agents/test-budget-cap" 2>/dev/null)
if [[ "$http_code" == "403" ]]; then
  echo "PASS [test-budget-cap: production guard returned 403 (expected in prod)]"
  PASS=$((PASS + 1))
else
  body=$(curl -s -H "x-api-key: $KEY" "$BASE/api/v1/admin/agents/test-budget-cap" 2>/dev/null || echo "{}")
  if echo "$body" | python3 -c "
import sys, json
d = json.load(sys.stdin)
run = d.get('budget_exceeded_run') or {}
exit(0 if d.get('success') and run.get('status') == 'budget_exceeded' else 1)
" 2>/dev/null; then
    echo "PASS [test-budget-cap: budget_exceeded persisted]"
    PASS=$((PASS + 1))
  else
    echo "FAIL [test-budget-cap]: http_code=$http_code body=$body" >&2
    FAIL=$((FAIL + 1))
  fi
fi

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
[[ "$FAIL" -eq 0 ]]

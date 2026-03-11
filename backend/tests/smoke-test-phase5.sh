#!/bin/bash
# Phase 5: Remaining Routes — Auth, Admin, Dashboard, Proforma, Risk, Scenarios,
# Competition, Tasks, Notifications, Preferences, Maps, Layers, Events,
# Calibration, Credibility, Command-Center, Team, Property, Zoning extensions,
# Deal sub-routes, F40, Health, Jedi, Site-Intelligence, Gmail, Building-Envelope
set -o pipefail

BASE="http://localhost:4000"
DEAL="e044db04-439b-4442-82df-b36a840f2fd8"
USER_ID="6253ba3f-d40d-4597-86ab-270c8397a857"
PASS=0; WARN=0; FAIL=0; TOTAL=0
RESULTS_FILE="${1:-/tmp/smoke-results-phase5.txt}"

JWT=$(cd /home/runner/workspace/backend && node -e "const jwt=require('jsonwebtoken');console.log(jwt.sign({userId:'$USER_ID',email:'demo@jedire.com',role:'investor'},process.env.JWT_SECRET||'your-secret-key-change-this',{expiresIn:'1h',algorithm:'HS256',issuer:'jedire-api',audience:'jedire-client'}))")

t() {
  local method=$1 url=$2 label=$3 data=$4 auth=${5:-jwt}
  TOTAL=$((TOTAL+1))
  local body="$data"
  if [ -z "$body" ]; then body='{}'; fi
  local auth_header="Authorization: Bearer $JWT"
  if [ "$auth" = "none" ]; then auth_header="X-No-Auth: true"; fi

  if [ "$method" = "POST" ] || [ "$method" = "PUT" ] || [ "$method" = "PATCH" ]; then
    local code=$(curl -s -o /tmp/resp.json -w '%{http_code}' -X "$method" -H "$auth_header" -H "Content-Type: application/json" "$BASE$url" -d "$body" --max-time 15 2>/dev/null)
  elif [ "$method" = "DELETE" ]; then
    local code=$(curl -s -o /tmp/resp.json -w '%{http_code}' -X DELETE -H "$auth_header" "$BASE$url" --max-time 15 2>/dev/null)
  else
    local code=$(curl -s -o /tmp/resp.json -w '%{http_code}' -H "$auth_header" "$BASE$url" --max-time 20 2>/dev/null)
  fi

  if [ -z "$code" ]; then code=0; fi
  local status="FAIL"
  if [[ "$code" =~ ^2 ]]; then status="PASS"; PASS=$((PASS+1));
  elif [[ "$code" =~ ^(4|3) ]]; then status="WARN"; WARN=$((WARN+1));
  else FAIL=$((FAIL+1)); fi
  local err=""
  if [ "$status" = "FAIL" ]; then err=" | $(cat /tmp/resp.json 2>/dev/null | head -c 200)"; fi
  printf "%-4s | %-6s | %s | %-60s |%s\n" "$status" "$method" "$code" "$label" "$err"
}

echo "========================================"
echo "PHASE 5: Remaining Routes Smoke Test"
echo "========================================"

# --- Health ---
echo "--- health ---"
t GET "/health" "health: GET health" "" "none"

# --- Auth ---
echo "--- auth ---"
t POST "/api/v1/auth/login" "auth: POST login" '{"email":"demo@jedire.com","password":"wrong"}' "none"
t POST "/api/v1/auth/register" "auth: POST register" '{"email":"test-smoke@jedire.com","password":"test123","name":"Smoke"}' "none"
t GET "/api/v1/auth/me" "auth: GET me"
t POST "/api/v1/auth/refresh" "auth: POST refresh" '{"refreshToken":"invalid"}'
t POST "/api/v1/auth/logout" "auth: POST logout"

# --- Dashboard ---
echo "--- dashboard ---"
t GET "/api/v1/dashboard" "dashboard: GET main"
t GET "/api/v1/dashboard/stats" "dashboard: GET stats"
t GET "/api/v1/dashboard/findings" "dashboard: GET findings"
t GET "/api/v1/dashboard/assets" "dashboard: GET assets"

# --- Tasks ---
echo "--- tasks ---"
t GET "/api/v1/tasks" "tasks: GET all"
t GET "/api/v1/tasks/stats" "tasks: GET stats"
t POST "/api/v1/tasks" "tasks: POST create" '{"title":"smoke-test-task","description":"test","priority":"low"}'
t GET "/api/v1/tasks?status=pending" "tasks: GET filtered"

# --- Notifications ---
echo "--- notifications ---"
t GET "/api/v1/notifications" "notifications: GET all"
t PUT "/api/v1/notifications/read-all" "notifications: PUT read-all"

# --- Preferences ---
echo "--- preferences ---"
t GET "/api/v1/preferences" "preferences: GET all"
t PUT "/api/v1/preferences" "preferences: PUT update" '{"theme":"dark"}'
t GET "/api/v1/settings/ai-preferences" "settings: GET ai-preferences"

# --- Deal Assumptions ---
echo "--- deal-assumptions ---"
t GET "/api/v1/deals/$DEAL/assumptions" "deal-assumptions: GET assumptions"
t GET "/api/v1/deals/$DEAL/assumptions/site-data" "deal-assumptions: GET site-data"
t GET "/api/v1/deals/$DEAL/assumptions/full-context" "deal-assumptions: GET full-context"

# --- Deal Context ---
echo "--- deal-context ---"
t GET "/api/v1/deals/$DEAL/context" "deal-context: GET context"
t POST "/api/v1/deals/$DEAL/context/recompute" "deal-context: POST recompute"

# --- Deal Validation ---
echo "--- deal-validation ---"
t GET "/api/v1/deals/$DEAL/validate" "deal-validation: GET validate"
t GET "/api/v1/deals/$DEAL/validation-status" "deal-validation: GET status"

# --- Deal Photos ---
echo "--- deal-photos ---"
t GET "/api/v1/deals/$DEAL/photos" "deal-photos: GET all"

# --- Deal Market Intelligence ---
echo "--- deal-market-intel ---"
t GET "/api/v1/deals/$DEAL/market-intelligence" "deal-market-intel: GET intel"

# --- Deal Comp Sets ---
echo "--- deal-comp-sets ---"
t GET "/api/v1/deals/$DEAL/comp-sets" "deal-comp-sets: GET all"

# --- Proforma ---
echo "--- proforma ---"
t GET "/api/v1/deals/$DEAL/proforma" "proforma: GET proforma"
t POST "/api/v1/deals/$DEAL/proforma/initialize" "proforma: POST initialize"
t GET "/api/v1/deals/$DEAL/proforma/history" "proforma: GET history"
t GET "/api/v1/deals/$DEAL/proforma/adjustments" "proforma: GET adjustments"

# --- Competition ---
echo "--- competition ---"
t GET "/api/v1/deals/$DEAL/competition" "competition: GET list"
t GET "/api/v1/deals/$DEAL/competition/summary" "competition: GET summary"
t GET "/api/v1/deals/$DEAL/competition/analysis" "competition: GET analysis"

# --- Unit Mix Propagation ---
echo "--- unit-mix-propagation ---"
t GET "/api/v1/deals/$DEAL/unit-mix" "unit-mix: GET all"
t POST "/api/v1/deals/$DEAL/unit-mix/propagate" "unit-mix: POST propagate"

# --- Risk ---
echo "--- risk ---"
t GET "/api/v1/risk/deal/$DEAL" "risk: GET deal risk"

# --- Scenarios ---
echo "--- scenarios ---"
t GET "/api/v1/scenarios/$DEAL" "scenarios: GET all for deal"
t POST "/api/v1/scenarios/generate/$DEAL" "scenarios: POST generate"
t GET "/api/v1/scenarios/$DEAL/comparison" "scenarios: GET comparison"

# --- Site Intelligence ---
echo "--- site-intelligence ---"
t GET "/api/v1/deals/$DEAL/site-intelligence" "site-intel: GET intelligence"

# --- Maps & Layers ---
echo "--- maps ---"
t GET "/api/v1/maps/layers" "maps: GET layers"
t GET "/api/v1/layers" "layers: GET all"

# --- Events (mounted as traffic/events sub-routes) ---
echo "--- events ---"
t GET "/api/v1/traffic/trending" "events: GET trending"

# --- Calibration ---
echo "--- calibration ---"
t GET "/api/v1/calibration/status" "calibration: GET status"
t GET "/api/v1/calibration/history" "calibration: GET history"

# --- Credibility ---
echo "--- credibility ---"
t GET "/api/v1/credibility/scores" "credibility: GET scores"
t GET "/api/v1/credibility/factors" "credibility: GET factors"

# --- Command Center ---
echo "--- command-center ---"
t GET "/api/v1/command-center/overview" "cmd-center: GET overview"
t GET "/api/v1/command-center/alerts" "cmd-center: GET alerts"

# --- Team Management ---
echo "--- team-management ---"
t GET "/api/v1/team" "team: GET all"
t GET "/api/v1/team/members" "team: GET members"
t GET "/api/v1/team/roles" "team: GET roles"

# --- Property ---
echo "--- property ---"
t GET "/api/v1/property/types" "property: GET types"
t GET "/api/v1/property/search?q=test" "property: GET search"

# --- Jedi Score ---
echo "--- jedi ---"
t GET "/api/v1/jedi/leaderboard" "jedi: GET leaderboard"
t GET "/api/v1/jedi/deal/$DEAL/score" "jedi: GET deal score"
t GET "/api/v1/jedi/methodology" "jedi: GET methodology"

# --- F40 Performance ---
echo "--- f40-performance ---"
t GET "/api/v1/f40/metrics" "f40: GET metrics"
t GET "/api/v1/f40/performance" "f40: GET performance"

# --- Building Envelope ---
echo "--- building-envelope ---"
t GET "/api/v1/building-envelope/deal/$DEAL" "building-envelope: GET deal"
t POST "/api/v1/building-envelope/calculate" "building-envelope: POST calc" '{"dealId":"'"$DEAL"'","lotArea":10000,"farLimit":3.0}'

# --- Zoning Extensions ---
echo "--- zoning-capacity ---"
t GET "/api/v1/zoning-capacity/deal/$DEAL" "zoning-capacity: GET deal"
t GET "/api/v1/zoning-profile/$DEAL" "zoning-profile: GET deal"

# --- Admin (basic) ---
echo "--- admin ---"
t GET "/api/v1/admin/data-tracker/status" "admin: GET data-tracker status"
t GET "/api/v1/admin/data-tracker/coverage" "admin: GET data-tracker coverage"

# --- Agent ---
echo "--- agent ---"
t GET "/api/v1/agents" "agents: GET all"
t POST "/api/v1/agents/query" "agents: POST query" '{"query":"What is the deal status?"}'

# --- Chat ---
echo "--- chat ---"
t GET "/api/v1/chat/history" "chat: GET history"

# --- Market Intelligence ---
echo "--- market-intelligence ---"
t GET "/api/v1/markets/overview" "market-intel: GET overview"
t GET "/api/v1/markets/trends" "market-intel: GET trends"

# --- Demand Intelligence ---
echo "--- demand-intelligence ---"
t GET "/api/v1/demand-intelligence/signals" "demand-intel: GET signals"

# --- Gmail ---
echo "--- gmail ---"
t GET "/api/v1/gmail/status" "gmail: GET status"

# --- Tax Comp Analysis ---
echo "--- tax-comp ---"
t GET "/api/v1/tax-comp-analysis/deal/$DEAL" "tax-comp: GET deal"

# --- Contacts Sync ---
echo "--- contacts-sync ---"
t GET "/api/v1/contacts/sync/status" "contacts-sync: GET status"

# --- Billing ---
echo "--- billing ---"
t GET "/api/v1/billing/status" "billing: GET status"
t GET "/api/v1/billing/plans" "billing: GET plans"

echo ""
echo "Total: $TOTAL | PASS: $PASS | WARN: $WARN | FAIL: $FAIL"
echo ""

# Write results
cat > "$RESULTS_FILE" << EOF
Phase 5 Results
Total: $TOTAL | PASS: $PASS | WARN: $WARN | FAIL: $FAIL
EOF

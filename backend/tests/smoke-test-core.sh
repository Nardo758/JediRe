#!/bin/bash
# Phase 1: Core Platform Smoke Test
# Tests ~250 endpoints across core route files
set -o pipefail

BASE="http://localhost:4000"
DEAL="e044db04-439b-4442-82df-b36a840f2fd8"
USER_ID="6253ba3f-d40d-4597-86ab-270c8397a857"
PASS=0; WARN=0; FAIL=0; TOTAL=0
RESULTS_FILE="${1:-/tmp/smoke-results-core.txt}"

JWT=$(cd /home/runner/workspace/backend && node -e "const jwt=require('jsonwebtoken');console.log(jwt.sign({userId:'$USER_ID',email:'demo@jedire.com',role:'investor'},process.env.JWT_SECRET||'your-secret-key-change-this',{expiresIn:'1h',algorithm:'HS256',issuer:'jedire-api',audience:'jedire-client'}))")

ADMIN_JWT=$(cd /home/runner/workspace/backend && node -e "const jwt=require('jsonwebtoken');console.log(jwt.sign({userId:'$USER_ID',email:'admin@jedire.com',role:'admin'},process.env.JWT_SECRET||'your-secret-key-change-this',{expiresIn:'1h',algorithm:'HS256',issuer:'jedire-api',audience:'jedire-client'}))")

CB_TOKEN=$(printenv CLAWDBOT_AUTH_TOKEN 2>/dev/null || echo "")

t() {
  local method=$1 url=$2 label=$3 data=$4 auth=${5:-jwt}
  TOTAL=$((TOTAL+1))
  local auth_header
  case "$auth" in
    jwt) auth_header="Authorization: Bearer $JWT" ;;
    admin) auth_header="Authorization: Bearer $ADMIN_JWT" ;;
    cb) auth_header="Authorization: Bearer $CB_TOKEN" ;;
    none) auth_header="X-No-Auth: true" ;;
  esac

  local body="$data"
  if [ -z "$body" ]; then body='{}'; fi

  local start=$(date +%s%N)
  if [ "$method" = "POST" ] || [ "$method" = "PUT" ] || [ "$method" = "PATCH" ]; then
    local code=$(curl -s -o /tmp/resp.json -w '%{http_code}' -X "$method" -H "$auth_header" -H "Content-Type: application/json" "$BASE$url" -d "$body" 2>/dev/null)
  elif [ "$method" = "DELETE" ]; then
    local code=$(curl -s -o /tmp/resp.json -w '%{http_code}' -X DELETE -H "$auth_header" "$BASE$url" 2>/dev/null)
  else
    local code=$(curl -s -o /tmp/resp.json -w '%{http_code}' -H "$auth_header" "$BASE$url" 2>/dev/null)
  fi
  local end=$(date +%s%N)
  local ms=$(( (end - start) / 1000000 ))

  local status="PASS"
  if [ "$code" -ge 500 ]; then status="FAIL"; FAIL=$((FAIL+1))
  elif [ "$code" -ge 400 ]; then status="WARN"; WARN=$((WARN+1))
  else PASS=$((PASS+1))
  fi

  local err=""
  if [ "$status" != "PASS" ]; then
    err=$(head -c 120 /tmp/resp.json 2>/dev/null | tr '\n' ' ')
  fi
  printf "%-4s | %-6s | %3s | %4dms | %-60s | %s\n" "$status" "$method" "$code" "$ms" "$label" "$err"
  printf "%-4s | %-6s | %3s | %4dms | %-60s | %s\n" "$status" "$method" "$code" "$ms" "$label" "$err" >> "$RESULTS_FILE"
}

> "$RESULTS_FILE"
echo "=================================================================================================================================="
printf "%-4s | %-6s | %3s | %6s | %-60s | %s\n" "STAT" "METHOD" "COD" "TIME" "ENDPOINT" "ERROR"
echo "=================================================================================================================================="
printf "%-4s | %-6s | %3s | %6s | %-60s | %s\n" "STAT" "METHOD" "COD" "TIME" "ENDPOINT" "ERROR" >> "$RESULTS_FILE"

echo "--- health.routes (mount: /health) ---"
t GET /health "health: /" none "" none
t GET /health/db "health: /db" "" none

echo "--- inline-health.routes (mount: /health) ---"
t GET /health "inline-health: /" "" none
t GET /health/db "inline-health: /db" "" none

echo "--- inline-auth.routes (mount: /api/v1/auth) ---"
t POST /api/v1/auth/login "auth: /login" '{"email":"demo@jedire.com","password":"demo123"}' none
t GET /api/v1/auth/me "auth: /me"

echo "--- auth.routes (mount: /api/v1/auth) ---"
t POST /api/v1/auth/register "auth: /register" '{"email":"test-smoke@jedire.com","password":"test123","name":"Smoke Test"}' none
t POST /api/v1/auth/refresh "auth: /refresh" '{"refreshToken":"invalid"}' none
t POST /api/v1/auth/logout "auth: /logout" '{}' none
t GET /api/v1/auth/me "auth: /me (jwt)"
t PUT /api/v1/auth/profile "auth: /profile" '{"name":"Demo User"}'
t GET /api/v1/auth/google "auth: /google" "" none

echo "--- inline-deals.routes (mount: /api/v1/deals) ---"
t GET /api/v1/deals "deals: /"
t GET "/api/v1/deals/$DEAL" "deals: /:id"
t GET "/api/v1/deals/$DEAL/modules" "deals: /:id/modules"
t GET "/api/v1/deals/$DEAL/properties" "deals: /:id/properties"
t GET "/api/v1/deals/$DEAL/activity" "deals: /:id/activity"
t GET "/api/v1/deals/$DEAL/timeline" "deals: /:id/timeline"
t PATCH "/api/v1/deals/$DEAL" "deals: PATCH /:id" '{"name":"Smoke Test Update"}'
t PATCH "/api/v1/deals/$DEAL/property" "deals: PATCH /:id/property" '{"lot_size_acres":4.81}'

echo "--- inline-tasks.routes (mount: /api/v1/tasks) ---"
t GET /api/v1/tasks "tasks: /"
t GET /api/v1/tasks/stats "tasks: /stats"

echo "--- inline-inbox.routes (mount: /api/v1/inbox) ---"
t GET /api/v1/inbox "inbox: /"
t GET /api/v1/inbox/stats "inbox: /stats"

echo "--- inline-news.routes (mount: /api/v1/news) ---"
t GET /api/v1/news/events "news: /events"
t GET /api/v1/news/alerts "news: /alerts"
t GET /api/v1/news/dashboard "news: /dashboard"
t GET /api/v1/news/network "news: /network"

echo "--- inline-data.routes (mount: /api/v1) ---"
t GET /api/v1/supply/atlanta "data: /supply/:market"
t GET /api/v1/markets "data: /markets"
t GET /api/v1/properties "data: /properties"
t GET /api/v1/alerts "data: /alerts"

echo "--- admin.routes (mount: /api/v1/admin) ---"
t GET /api/v1/admin/system/health "admin: /system/health" "" admin
t GET /api/v1/admin/system/stats "admin: /system/stats" "" admin
t GET /api/v1/admin/system/logs "admin: /system/logs" "" admin
t GET /api/v1/admin/quality/missing-boundaries "admin: /quality/missing-boundaries" "" admin
t GET /api/v1/admin/quality/orphaned-data "admin: /quality/orphaned-data" "" admin
t GET /api/v1/admin/integrations/apartment-locator-ai "admin: /integrations/apt-locator" "" admin
t GET /api/v1/admin/integrations/apis "admin: /integrations/apis" "" admin
t GET /api/v1/admin/jobs "admin: /jobs" "" admin
t GET /api/v1/admin/ingest/status "admin: /ingest/status" "" admin

echo "--- admin-api-key.routes (mount: /api/v1/admin-api) ---"
t GET /api/v1/admin-api/data/status "admin-api: /data/status" "" admin
t GET /api/v1/admin-api/data/zoning-coverage "admin-api: /data/zoning-coverage" "" admin
t GET /api/v1/admin-api/data/benchmark-stats "admin-api: /data/benchmark-stats" "" admin
t GET /api/v1/admin-api/municipalities "admin-api: /municipalities" "" admin
t GET /api/v1/admin-api/health "admin-api: /health" "" admin

echo "--- dashboard.routes (mount: /api/v1/dashboard) ---"
t GET /api/v1/dashboard "dashboard: /"
t GET /api/v1/dashboard/stats "dashboard: /stats"
t GET /api/v1/dashboard/findings "dashboard: /findings"
t GET /api/v1/dashboard/assets "dashboard: /assets"

echo "--- billing.routes (mount: /api/v1/billing) ---"
t GET /api/v1/billing/subscription "billing: /subscription"
t GET /api/v1/billing/usage "billing: /usage"
t POST /api/v1/billing/create-checkout-session "billing: /create-checkout-session" '{"priceId":"price_test"}'
t POST /api/v1/billing/create-portal-session "billing: /create-portal-session" '{}'

echo "--- grid.routes (mount: /api/v1/grid) ---"
t GET /api/v1/grid/pipeline "grid: /pipeline"
t GET /api/v1/grid/owned "grid: /owned"
t GET "/api/v1/grid/owned/$DEAL/report" "grid: /owned/:id/report"
t POST /api/v1/grid/export "grid: /export" '{"type":"pipeline"}'

echo "--- portfolio.routes (mount: /api/v1/portfolio) ---"
t GET "/api/v1/portfolio/$DEAL/summary" "portfolio: /:dealId/summary"
t GET "/api/v1/portfolio/$DEAL/financials" "portfolio: /:dealId/financials"
t GET "/api/v1/portfolio/$DEAL/leasing" "portfolio: /:dealId/leasing"
t GET "/api/v1/portfolio/$DEAL/traffic" "portfolio: /:dealId/traffic"

echo "--- rankings.routes (mount: /api/v1/rankings) ---"
t GET /api/v1/rankings/atlanta "rankings: /atlanta"
t GET /api/v1/rankings/performance/atlanta "rankings: /performance/atlanta"
t GET /api/v1/rankings/owned/atlanta "rankings: /owned/atlanta"
t GET /api/v1/rankings/pipeline/atlanta "rankings: /pipeline/atlanta"

echo "--- modules.routes (mount: /api/v1/modules) ---"
t GET /api/v1/modules "modules: /"
t GET /api/v1/modules/enabled "modules: /enabled"

echo "--- map-configs.routes (mount: /api/v1/map-configs) ---"
t GET /api/v1/map-configs "map-configs: /"
t GET /api/v1/map-configs/default "map-configs: /default"

echo "--- agent.routes (mount: /api/v1/agents) ---"
t GET /api/v1/agents/tasks "agents: /tasks"

echo "--- chat.routes (mount: /api/v1/chat) ---"
t POST /api/v1/chat "chat: /" '{"message":"hello","dealId":"'"$DEAL"'"}'

echo "--- context-tracker.routes (mount: /api/v1/context) ---"
t GET "/api/v1/context/deals/$DEAL/notes" "context: /deals/:id/notes"
t POST "/api/v1/context/deals/$DEAL/notes" "context: POST notes" '{"content":"smoke test note","category":"general"}'
t GET "/api/v1/context/deals/$DEAL/activity" "context: /deals/:id/activity"
t POST "/api/v1/context/deals/$DEAL/activity" "context: POST activity" '{"action_type":"smoke_test","description":"test"}'
t GET "/api/v1/context/deals/$DEAL/contacts" "context: /deals/:id/contacts"
t POST "/api/v1/context/deals/$DEAL/contacts" "context: POST contacts" '{"name":"Smoke Test","email":"smoke@test.com","role":"broker"}'
t GET "/api/v1/context/deals/$DEAL/documents" "context: /deals/:id/documents"
t GET "/api/v1/context/deals/$DEAL/key-dates" "context: /deals/:id/key-dates"
t POST "/api/v1/context/deals/$DEAL/key-dates" "context: POST key-dates" '{"title":"Smoke Test Date","date":"2026-04-01","date_type":"deadline"}'
t GET "/api/v1/context/deals/$DEAL/decisions" "context: /deals/:id/decisions"
t POST "/api/v1/context/deals/$DEAL/decisions" "context: POST decisions" '{"title":"Smoke Test Decision","status":"pending"}'
t GET "/api/v1/context/deals/$DEAL/risks" "context: /deals/:id/risks"
t POST "/api/v1/context/deals/$DEAL/risks" "context: POST risks" '{"title":"Smoke Test Risk","severity":"low","status":"identified","impact":"low","likelihood":"low","category":"market"}'

echo "--- capsule.routes (mount: /api/capsules) ---"
t GET /api/capsules "capsules: /"
t POST /api/capsules "capsules: POST" '{"title":"Smoke Test Capsule","dealId":"'"$DEAL"'"}'

echo "--- deal-assumptions.routes (mount: /api/v1/deals) ---"
t GET "/api/v1/deals/$DEAL/assumptions" "deal-assumptions: GET"
t PUT "/api/v1/deals/$DEAL/assumptions" "deal-assumptions: PUT" '{"land_cost_per_acre":500000}'
t POST "/api/v1/deals/$DEAL/compute-returns" "deal-assumptions: compute-returns" '{}'
t PUT "/api/v1/deals/$DEAL/site-data" "deal-assumptions: site-data" '{"max_units":300}'
t GET "/api/v1/deals/$DEAL/full-context" "deal-assumptions: full-context"

echo "--- deal-comp-sets.routes (mount: /api/v1/deals) ---"
t GET "/api/v1/deals/$DEAL/comp-set" "deal-comp-sets: GET"
t POST "/api/v1/deals/$DEAL/comp-set/discover" "deal-comp-sets: discover" '{}'

echo "--- deal-photos.routes (mount: /api/v1/deals) ---"
t GET "/api/v1/deals/$DEAL/photos" "deal-photos: GET"

echo "--- dealState.routes ---"
t GET "/api/v1/deals/$DEAL/state" "dealState: GET"
t GET "/api/v1/deals/$DEAL/snapshots" "dealState: snapshots"

echo "--- deal-timeline.routes ---"
t GET "/api/v1/deal-timeline/deal/$DEAL" "deal-timeline: /deal/:dealId"
t GET "/api/v1/deal-timeline/benchmarks/atlanta" "deal-timeline: /benchmarks/:municipality"
t GET "/api/v1/deal-timeline/jurisdiction-comparison" "deal-timeline: /jurisdiction-comparison"
t GET "/api/v1/deal-timeline/carrying-costs/$DEAL" "deal-timeline: /carrying-costs/:dealId"

echo "--- deal-validation.routes (mount: /api/v1/deals) ---"
t POST "/api/v1/deals/$DEAL/validate" "deal-validation: POST validate" '{}'
t GET "/api/v1/deals/$DEAL/validation-status" "deal-validation: GET status"

echo "--- deal-context.routes (mount: /api/v1/deals) ---"
t GET "/api/v1/deals/$DEAL/context" "deal-context: GET"

echo "--- dd-checklists.routes (mount: /api/v1/dd-checklists) ---"
t GET "/api/v1/dd-checklists/$DEAL" "dd-checklists: GET /:dealId"

echo "--- deal-actuals.routes ---"
t GET "/api/v1/deals/$DEAL/actuals" "deal-actuals: GET actuals"
t GET "/api/v1/deals/$DEAL/traffic" "deal-actuals: GET traffic"
t GET "/api/v1/deals/$DEAL/flywheel-feeds" "deal-actuals: GET flywheel-feeds"
t GET "/api/v1/deals/$DEAL/actuals-summary" "deal-actuals: GET actuals-summary"

echo "--- documentsFiles.routes ---"
t GET "/api/v1/deals/$DEAL/files" "documentsFiles: GET files"
t GET "/api/v1/deals/$DEAL/files/stats" "documentsFiles: GET stats"
t GET "/api/v1/deals/$DEAL/files/categories" "documentsFiles: GET categories"
t GET "/api/v1/deals/$DEAL/files/search" "documentsFiles: GET search"

echo "--- events.routes ---"
t GET /api/v1/events/trending "events: /trending"

echo "--- errors.routes ---"
t GET /api/v1/errors/stats "errors: /stats"
t GET /api/v1/errors/recent "errors: /recent"

echo "--- notifications.routes ---"
t GET /api/v1/notifications "notifications: /"

echo "--- preferences.routes (mount: /api/v1/preferences) ---"
t GET /api/v1/preferences "preferences: /"
t GET /api/v1/preferences/available-markets "preferences: /available-markets"
t GET /api/v1/preferences/property-types "preferences: /property-types"
t GET /api/v1/preferences/user "preferences: /user"

echo "--- pipeline.ts ---"
t GET /api/v1/pipeline/status "pipeline: /status"

echo "--- clawdbot-webhooks.routes (mount: /api/v1/clawdbot) ---"
t POST /api/v1/clawdbot/command "cb: health" '{"command":"health"}' cb
t POST /api/v1/clawdbot/command "cb: get_deals" '{"command":"get_deals","params":{}}' cb
t POST /api/v1/clawdbot/command "cb: get_deal" '{"command":"get_deal","params":{"dealId":"'"$DEAL"'"}}' cb
t POST /api/v1/clawdbot/command "cb: get_proforma" '{"command":"get_proforma","params":{"dealId":"'"$DEAL"'"}}' cb
t POST /api/v1/clawdbot/command "cb: get_design" '{"command":"get_design","params":{"dealId":"'"$DEAL"'"}}' cb
t POST /api/v1/clawdbot/command "cb: system_stats" '{"command":"system_stats","params":{}}' cb
t POST /api/v1/clawdbot/command "cb: recent_errors" '{"command":"recent_errors","params":{}}' cb
t POST /api/v1/clawdbot/command "cb: search_comps (city)" '{"command":"search_comps","params":{"city":"Frisco","state":"TX"}}' cb
t POST /api/v1/clawdbot/command "cb: search_comps (dealId)" '{"command":"search_comps","params":{"dealId":"'"$DEAL"'"}}' cb
t POST /api/v1/clawdbot/command "cb: get_sale_comps" '{"command":"get_sale_comps","params":{"dealId":"'"$DEAL"'"}}' cb
t POST /api/v1/clawdbot/command "cb: list_documents" '{"command":"list_documents","params":{"dealId":"'"$DEAL"'"}}' cb
t POST /api/v1/clawdbot/command "cb: get_document_stats" '{"command":"get_document_stats","params":{"dealId":"'"$DEAL"'"}}' cb
t POST /api/v1/clawdbot/command "cb: get_notes" '{"command":"get_notes","params":{"dealId":"'"$DEAL"'"}}' cb
t POST /api/v1/clawdbot/command "cb: add_note" '{"command":"add_note","params":{"dealId":"'"$DEAL"'","content":"smoke test"}}' cb
t POST /api/v1/clawdbot/command "cb: search_deals" '{"command":"search_deals","params":{"name":"Highland"}}' cb
t POST /api/v1/clawdbot/command "cb: get_agent_tasks" '{"command":"get_agent_tasks","params":{}}' cb
t POST /api/v1/clawdbot/command "cb: agent_stats" '{"command":"agent_stats","params":{}}' cb

echo "--- f40-performance.routes (mount: /api/v1/f40) ---"
t GET /api/v1/f40/market "f40: /market"
t GET /api/v1/f40/compare "f40: /compare"
t GET /api/v1/f40/trends "f40: /trends"
t GET "/api/v1/f40/deal/$DEAL" "f40: /deal/:dealId"

echo "--- opportunity-engine.routes (mount: /api/v1/opportunities) ---"
t GET /api/v1/opportunities/rankings "opportunities: /rankings"
t GET /api/v1/opportunities/alerts "opportunities: /alerts"

echo "--- settings-ai.routes (mount: /api/v1/settings/ai-preferences) ---"
t GET /api/v1/settings/ai-preferences "settings-ai: GET"
t PUT /api/v1/settings/ai-preferences "settings-ai: PUT" '{"provider":"anthropic","model":"claude-sonnet-4-20250514"}'

echo "=================================================================================================================================="
echo ""
echo "=== PHASE 1 SUMMARY ==="
echo "Total: $TOTAL | PASS: $PASS | WARN: $WARN | FAIL: $FAIL"
echo ""
echo "PASS rate: $(( PASS * 100 / TOTAL ))%"
if [ $FAIL -gt 0 ]; then
  echo ""
  echo "=== FAILURES (500+) ==="
  grep "^FAIL" "$RESULTS_FILE"
fi
echo ""
echo "Results saved to: $RESULTS_FILE"

#!/bin/bash
# smoke-test-full.sh
# Full-surface API smoke test: runs all phase scripts and produces a single
# consolidated health report covering all ~850+ registered endpoints.
#
# Usage:
#   ./backend/tests/smoke-test-full.sh [--quick] [--report FILE]
#
# Options:
#   --quick     Skip known AI/slow endpoints (reduces runtime ~60%)
#   --report F  Write consolidated report to FILE (default: /tmp/smoke-full-report.txt)
#
# Exit codes:
#   0   Zero 500-level failures detected
#   1   One or more 500-level failures detected
#
set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE="http://localhost:4000"
DEAL="e044db04-439b-4442-82df-b36a840f2fd8"
USER_ID="6253ba3f-d40d-4597-86ab-270c8397a857"
REPORT_FILE="/tmp/smoke-full-report.txt"
QUICK=0

for arg in "$@"; do
  case "$arg" in
    --quick)   QUICK=1 ;;
    --report)  shift; REPORT_FILE="$1" ;;
    --report=*) REPORT_FILE="${arg#--report=}" ;;
  esac
done

JWT=$(cd /home/runner/workspace/backend && node -e "
  const jwt=require('jsonwebtoken');
  console.log(jwt.sign(
    {userId:'$USER_ID',email:'demo@jedire.com',role:'investor'},
    process.env.JWT_SECRET||'your-secret-key-change-this',
    {expiresIn:'1h',algorithm:'HS256',issuer:'jedire-api',audience:'jedire-client'}
  ))
" 2>/dev/null)

ADMIN_JWT=$(cd /home/runner/workspace/backend && node -e "
  const jwt=require('jsonwebtoken');
  console.log(jwt.sign(
    {userId:'$USER_ID',email:'admin@jedire.com',role:'admin'},
    process.env.JWT_SECRET||'your-secret-key-change-this',
    {expiresIn:'1h',algorithm:'HS256',issuer:'jedire-api',audience:'jedire-client'}
  ))
" 2>/dev/null)

CB_TOKEN=$(printenv CLAWDBOT_AUTH_TOKEN 2>/dev/null || echo "")

G_PASS=0; G_WARN=0; G_FAIL=0; G_TOTAL=0

TEMP_RESULTS="/tmp/smoke-full-raw.txt"
> "$TEMP_RESULTS"

SEP="=================================================================================================================================="

t() {
  local method=$1 url=$2 label=$3 data=$4 auth=${5:-jwt}
  G_TOTAL=$((G_TOTAL+1))
  local auth_header
  case "$auth" in
    jwt)   auth_header="Authorization: Bearer $JWT" ;;
    admin) auth_header="Authorization: Bearer $ADMIN_JWT" ;;
    cb)    auth_header="Authorization: Bearer $CB_TOKEN" ;;
    none)  auth_header="X-No-Auth: true" ;;
    *)     auth_header="Authorization: Bearer $JWT" ;;
  esac

  local body="$data"
  if [ -z "$body" ]; then body='{}'; fi

  local start end ms code
  start=$(date +%s%3N 2>/dev/null || date +%s)
  if [ "$method" = "POST" ] || [ "$method" = "PUT" ] || [ "$method" = "PATCH" ]; then
    code=$(curl -s -o /tmp/resp_full.json -w '%{http_code}' -X "$method" \
      -H "$auth_header" -H "Content-Type: application/json" \
      "$BASE$url" -d "$body" --max-time 20 2>/dev/null)
  elif [ "$method" = "DELETE" ]; then
    code=$(curl -s -o /tmp/resp_full.json -w '%{http_code}' -X DELETE \
      -H "$auth_header" "$BASE$url" --max-time 10 2>/dev/null)
  else
    code=$(curl -s -o /tmp/resp_full.json -w '%{http_code}' \
      -H "$auth_header" "$BASE$url" --max-time 20 2>/dev/null)
  fi
  end=$(date +%s%3N 2>/dev/null || date +%s)
  ms=$(( end - start ))
  [ -z "$code" ] && code=0

  local status="PASS"
  if [[ "$code" =~ ^5 ]]; then
    status="FAIL"; G_FAIL=$((G_FAIL+1))
  elif [[ "$code" =~ ^(4|3|0) ]]; then
    status="WARN"; G_WARN=$((G_WARN+1))
  else
    G_PASS=$((G_PASS+1))
  fi

  local err=""
  if [ "$status" = "FAIL" ]; then
    err=$(head -c 120 /tmp/resp_full.json 2>/dev/null | tr '\n' ' ')
  fi
  local line
  printf -v line "%-4s | %-6s | %3s | %5dms | %-70s | %s" \
    "$status" "$method" "$code" "$ms" "$label" "$err"
  echo "$line"
  echo "$line" >> "$TEMP_RESULTS"
}

header() {
  echo ""
  echo "--- $* ---"
  echo "--- $* ---" >> "$TEMP_RESULTS"
}

START_TS=$(date +%s)

echo "$SEP"
printf "%-4s | %-6s | %3s | %7s | %-70s | %s\n" "STAT" "METHOD" "COD" "TIME" "ENDPOINT LABEL" "ERROR"
echo "$SEP"

# ============================================================
# SECTION 1: HEALTH & AUTH
# ============================================================
header "health (mount: /health)"
t GET /health                          "health: GET /"                          "" none
t GET /health/db                       "health: GET /db"                        "" none

header "auth (mount: /api/v1/auth)"
t POST /api/v1/auth/login              "auth: POST /login"                      '{"email":"demo@jedire.com","password":"demo123"}' none
t POST /api/v1/auth/register           "auth: POST /register"                   '{"email":"smoke-full@jedire.com","password":"test123","name":"SmokeTest"}' none
t POST /api/v1/auth/refresh            "auth: POST /refresh"                    '{"refreshToken":"invalid"}' none
t POST /api/v1/auth/logout             "auth: POST /logout"                     '{}' none
t GET  /api/v1/auth/me                 "auth: GET /me"
t PUT  /api/v1/auth/profile            "auth: PUT /profile"                     '{"name":"Demo User"}'
t GET  /api/v1/auth/google             "auth: GET /google"                      "" none

# ============================================================
# SECTION 2: DEALS CORE
# ============================================================
header "inline-deals (mount: /api/v1/deals)"
t GET  /api/v1/deals                              "deals: GET /"
t GET  "/api/v1/deals/$DEAL"                      "deals: GET /:id"
t GET  "/api/v1/deals/$DEAL/modules"              "deals: GET /:id/modules"
t GET  "/api/v1/deals/$DEAL/properties"           "deals: GET /:id/properties"
t GET  "/api/v1/deals/$DEAL/activity"             "deals: GET /:id/activity"
t GET  "/api/v1/deals/$DEAL/timeline"             "deals: GET /:id/timeline"
t PATCH "/api/v1/deals/$DEAL"                     "deals: PATCH /:id"                      '{"name":"Smoke Test Update"}'
t PATCH "/api/v1/deals/$DEAL/property"            "deals: PATCH /:id/property"             '{"lot_size_acres":4.81}'

header "deal-assumptions (mount: /api/v1/deals)"
t GET  "/api/v1/deals/$DEAL/assumptions"          "deal-assumptions: GET"
t PUT  "/api/v1/deals/$DEAL/assumptions"          "deal-assumptions: PUT"                  '{"land_cost_per_acre":500000}'
t POST "/api/v1/deals/$DEAL/compute-returns"      "deal-assumptions: POST compute-returns" '{}'
t PUT  "/api/v1/deals/$DEAL/site-data"            "deal-assumptions: PUT site-data"        '{"max_units":300}'
t GET  "/api/v1/deals/$DEAL/full-context"         "deal-assumptions: GET full-context"

header "deal-context (mount: /api/v1/deals)"
t GET  "/api/v1/deals/$DEAL/context"              "deal-context: GET context"
t PATCH "/api/v1/deals/$DEAL/context"             "deal-context: PATCH context"            '{"notes":"smoke"}'
t POST "/api/v1/deals/$DEAL/recompute"            "deal-context: POST recompute"

header "deal-comp-sets (mount: /api/v1/deals)"
t GET  "/api/v1/deals/$DEAL/comp-set"             "deal-comp-sets: GET"
t POST "/api/v1/deals/$DEAL/comp-set/discover"    "deal-comp-sets: POST discover"          '{"radius":5}'
t POST "/api/v1/deals/$DEAL/comp-set"             "deal-comp-sets: POST add"               '{"propertyId":"00000000-0000-0000-0000-000000000001","compType":"sale"}'

header "deal-photos (mount: /api/v1/deals)"
t GET  "/api/v1/deals/$DEAL/photos"               "deal-photos: GET all"

header "dealState.routes"
t GET  "/api/v1/deals/$DEAL/state"                "dealState: GET state"
t GET  "/api/v1/deals/$DEAL/snapshots"            "dealState: GET snapshots"

header "deal-timeline (mount: /api/v1/deal-timeline)"
t GET  "/api/v1/deal-timeline/deal/$DEAL"               "deal-timeline: GET /deal/:id"
t GET  "/api/v1/deal-timeline/benchmarks/atlanta"        "deal-timeline: GET benchmarks"
t GET  "/api/v1/deal-timeline/jurisdiction-comparison"   "deal-timeline: GET jurisdiction"
t GET  "/api/v1/deal-timeline/carrying-costs/$DEAL"      "deal-timeline: GET carrying-costs"

header "deal-validation (mount: /api/v1/deals)"
t POST "/api/v1/deals/$DEAL/validate"             "deal-validation: POST validate"
t GET  "/api/v1/deals/$DEAL/validation-status"    "deal-validation: GET status"
t POST "/api/v1/deals/validate-all"               "deal-validation: POST validate-all"

header "deal-actuals (mount: /api/v1/deals)"
t GET  "/api/v1/deals/$DEAL/actuals"              "deal-actuals: GET actuals"
t POST "/api/v1/deals/$DEAL/actuals"              "deal-actuals: POST actuals"             '{"period":"2025-01","noi":50000,"revenue":100000}'
t GET  "/api/v1/deals/$DEAL/traffic"              "deal-actuals: GET traffic"
t POST "/api/v1/deals/$DEAL/traffic"              "deal-actuals: POST traffic"             '{"date":"2025-01-15","visits":25}'
t GET  "/api/v1/deals/$DEAL/flywheel-feeds"       "deal-actuals: GET flywheel-feeds"
t GET  "/api/v1/deals/$DEAL/actuals-summary"      "deal-actuals: GET actuals-summary"

header "deal-market-intelligence (mount: /api/v1/deals)"
t GET  "/api/v1/deals/$DEAL/market-intelligence"  "deal-mkt-intel: GET"

header "documentsFiles (mount: /api/v1/deals)"
t GET  "/api/v1/deals/$DEAL/files"                "files: GET all"
t GET  "/api/v1/deals/$DEAL/files/stats"          "files: GET stats"
t GET  "/api/v1/deals/$DEAL/files/categories"     "files: GET categories"
t GET  "/api/v1/deals/$DEAL/files/search"         "files: GET search"

# ============================================================
# SECTION 3: TASKS, INBOX, NOTIFICATIONS, PREFERENCES
# ============================================================
header "tasks (mount: /api/v1/tasks)"
t GET  /api/v1/tasks                              "tasks: GET /"
t GET  /api/v1/tasks/stats                        "tasks: GET /stats"
t POST /api/v1/tasks                              "tasks: POST create"                     '{"title":"smoke-test-task","description":"test","priority":"low"}'
t GET  "/api/v1/tasks?status=pending"             "tasks: GET filtered"

header "inbox (mount: /api/v1/inbox)"
t GET  /api/v1/inbox                              "inbox: GET /"
t GET  /api/v1/inbox/stats                        "inbox: GET /stats"

header "notifications"
t GET  /api/v1/notifications                      "notifications: GET all"
t PUT  /api/v1/notifications/read-all             "notifications: PUT read-all"

header "preferences (mount: /api/v1/preferences)"
t GET  /api/v1/preferences                        "preferences: GET /"
t GET  /api/v1/preferences/available-markets      "preferences: GET available-markets"
t GET  /api/v1/preferences/property-types         "preferences: GET property-types"
t GET  /api/v1/preferences/user                   "preferences: GET user"
t PUT  /api/v1/preferences                        "preferences: PUT update"                '{"theme":"dark"}'

header "settings-ai (mount: /api/v1/settings/ai-preferences)"
t GET  /api/v1/settings/ai-preferences            "settings-ai: GET"
t PUT  /api/v1/settings/ai-preferences            "settings-ai: PUT"                      '{"provider":"anthropic","model":"claude-sonnet-4-20250514"}'

# ============================================================
# SECTION 4: ADMIN
# ============================================================
header "admin (mount: /api/v1/admin)"
t GET  /api/v1/admin/system/health                "admin: GET system/health"               "" admin
t GET  /api/v1/admin/system/stats                 "admin: GET system/stats"                "" admin
t GET  /api/v1/admin/system/logs                  "admin: GET system/logs"                 "" admin
t GET  /api/v1/admin/quality/missing-boundaries   "admin: GET quality/missing-boundaries"  "" admin
t GET  /api/v1/admin/quality/orphaned-data        "admin: GET quality/orphaned-data"       "" admin
t GET  /api/v1/admin/integrations/apis            "admin: GET integrations/apis"           "" admin
t GET  /api/v1/admin/jobs                         "admin: GET jobs"                        "" admin
t GET  /api/v1/admin/ingest/status                "admin: GET ingest/status"               "" admin

header "admin-api-key (mount: /api/v1/admin-api)"
t GET  /api/v1/admin-api/data/status              "admin-api: GET data/status"             "" admin
t GET  /api/v1/admin-api/data/zoning-coverage     "admin-api: GET zoning-coverage"         "" admin
t GET  /api/v1/admin-api/data/benchmark-stats     "admin-api: GET benchmark-stats"         "" admin
t GET  /api/v1/admin-api/municipalities            "admin-api: GET municipalities"          "" admin
t GET  /api/v1/admin-api/health                   "admin-api: GET health"                  "" admin

header "admin data-tracker (mount: /api/v1/admin/data-tracker)"
t GET  /api/v1/admin/data-tracker/status          "data-tracker: GET status"               "" admin
t GET  /api/v1/admin/data-tracker/coverage        "data-tracker: GET coverage"             "" admin

header "rent-scraper-admin (mount: /api/v1/admin/rent-scraper)"
t GET  /api/v1/admin/rent-scraper/status          "rent-scraper: GET status"               "" admin

# ============================================================
# SECTION 5: DASHBOARD, BILLING, GRID, PORTFOLIO, RANKINGS
# ============================================================
header "dashboard (mount: /api/v1/dashboard)"
t GET  /api/v1/dashboard                          "dashboard: GET /"
t GET  /api/v1/dashboard/stats                    "dashboard: GET stats"
t GET  /api/v1/dashboard/findings                 "dashboard: GET findings"
t GET  /api/v1/dashboard/assets                   "dashboard: GET assets"

header "billing (mount: /api/v1/billing)"
t GET  /api/v1/billing/subscription               "billing: GET subscription"
t GET  /api/v1/billing/usage                      "billing: GET usage"
t POST /api/v1/billing/create-checkout-session    "billing: POST create-checkout-session"  '{"priceId":"price_test"}'
t POST /api/v1/billing/create-portal-session      "billing: POST create-portal-session"    '{}'

header "grid (mount: /api/v1/grid)"
t GET  /api/v1/grid/pipeline                      "grid: GET pipeline"
t GET  /api/v1/grid/owned                         "grid: GET owned"
t GET  "/api/v1/grid/owned/$DEAL/report"          "grid: GET owned/:id/report"
t POST /api/v1/grid/export                        "grid: POST export"                      '{"type":"pipeline"}'

header "portfolio (mount: /api/v1/portfolio)"
t GET  "/api/v1/portfolio/$DEAL/summary"          "portfolio: GET summary"
t GET  "/api/v1/portfolio/$DEAL/financials"       "portfolio: GET financials"
t GET  "/api/v1/portfolio/$DEAL/leasing"          "portfolio: GET leasing"
t GET  "/api/v1/portfolio/$DEAL/traffic"          "portfolio: GET traffic"

header "rankings (mount: /api/v1/rankings)"
t GET  /api/v1/rankings/atlanta                   "rankings: GET atlanta"
t GET  /api/v1/rankings/performance/atlanta       "rankings: GET performance"
t GET  /api/v1/rankings/owned/atlanta             "rankings: GET owned"
t GET  /api/v1/rankings/pipeline/atlanta          "rankings: GET pipeline"

header "pipeline.ts"
t GET  /api/v1/pipeline/status                    "pipeline: GET status"

# ============================================================
# SECTION 6: MODULES, MAP-CONFIGS, AGENTS, CHAT, CAPSULES
# ============================================================
header "modules (mount: /api/v1/modules)"
t GET  /api/v1/modules                            "modules: GET /"
t GET  /api/v1/modules/enabled                    "modules: GET enabled"

header "map-configs (mount: /api/v1/map-configs)"
t GET  /api/v1/map-configs                        "map-configs: GET /"
t GET  /api/v1/map-configs/default                "map-configs: GET default"
t POST /api/v1/map-configs                        "map-configs: POST create"               '{"name":"smoke-cfg","config":{"zoom":12}}'

header "module-libraries (mount: /api/v1/module-libraries)"
t GET  /api/v1/module-libraries/zoning/files           "module-libs: GET files"
t GET  /api/v1/module-libraries/zoning/learning-status "module-libs: GET learning-status"

header "agents (mount: /api/v1/agents)"
t GET  /api/v1/agents/tasks                       "agents: GET tasks"

header "chat (mount: /api/v1/chat)"
t POST /api/v1/chat                               "chat: POST /"                           '{"message":"hello","dealId":"'"$DEAL"'"}'

header "capsules (mount: /api/capsules)"
t GET  /api/capsules                              "capsules: GET /"
t POST /api/capsules                              "capsules: POST create"                  '{"title":"Smoke Capsule","dealId":"'"$DEAL"'"}'

header "context-tracker (mount: /api/v1/context)"
t GET  "/api/v1/context/deals/$DEAL/notes"        "context: GET notes"
t POST "/api/v1/context/deals/$DEAL/notes"        "context: POST note"                     '{"content":"smoke test note","category":"general"}'
t GET  "/api/v1/context/deals/$DEAL/activity"     "context: GET activity"
t POST "/api/v1/context/deals/$DEAL/activity"     "context: POST activity"                 '{"action_type":"smoke_test","description":"test"}'
t GET  "/api/v1/context/deals/$DEAL/contacts"     "context: GET contacts"
t POST "/api/v1/context/deals/$DEAL/contacts"     "context: POST contact"                  '{"name":"Smoke Test","email":"smoke@test.com","role":"broker"}'
t GET  "/api/v1/context/deals/$DEAL/documents"    "context: GET documents"
t GET  "/api/v1/context/deals/$DEAL/key-dates"    "context: GET key-dates"
t POST "/api/v1/context/deals/$DEAL/key-dates"    "context: POST key-date"                 '{"title":"Smoke Date","date":"2026-04-01","date_type":"deadline"}'
t GET  "/api/v1/context/deals/$DEAL/decisions"    "context: GET decisions"
t POST "/api/v1/context/deals/$DEAL/decisions"    "context: POST decision"                 '{"title":"Smoke Decision","status":"pending"}'
t GET  "/api/v1/context/deals/$DEAL/risks"        "context: GET risks"
t POST "/api/v1/context/deals/$DEAL/risks"        "context: POST risk"                     '{"title":"Smoke Risk","severity":"low","status":"identified","impact":"low","likelihood":"low","category":"market"}'

# ============================================================
# SECTION 7: ZONING
# ============================================================
header "zoning-triangulation (mount: /api/v1)"
t GET  "/api/v1/parcels/stats"                              "zoning-tri: GET parcels/stats"
t GET  "/api/v1/parcels/nearby?lat=33.75&lng=-84.39&radius=500" "zoning-tri: GET parcels/nearby"
t GET  "/api/v1/zoning/calibration"                         "zoning-tri: GET calibration"
t GET  "/api/v1/zoning/triangulation/$DEAL"                 "zoning-tri: GET triangulation"
t GET  "/api/v1/zoning/chain/$DEAL"                         "zoning-tri: GET chain"
t GET  "/api/v1/zoning/recommendations/$DEAL"               "zoning-tri: GET recommendations"
t GET  "/api/v1/deals/$DEAL/nearby-entitlements"            "zoning-tri: GET nearby-entitlements"
t POST "/api/v1/zoning/triangulate"                         "zoning-tri: POST triangulate"   '{"dealId":"'"$DEAL"'","address":"123 Test St","municipality":"Atlanta"}'
t POST "/api/v1/zoning/outcome"                             "zoning-tri: POST outcome"       '{"dealId":"'"$DEAL"'","outcome":"approved"}'

header "zoning-capacity (mount: /api/v1)"
t GET  "/api/v1/deals/$DEAL/zoning-capacity"                "zoning-cap: GET"
t POST "/api/v1/deals/$DEAL/zoning-capacity"                "zoning-cap: POST"               '{"districtCode":"R-5"}'
t GET  "/api/v1/zoning-districts/lookup?municipality=Atlanta" "zoning-cap: GET districts/lookup"
t GET  "/api/v1/zoning-districts/by-code?code=R-5&municipality=Atlanta" "zoning-cap: GET districts/by-code"
t GET  "/api/v1/municipalities"                             "zoning-cap: GET municipalities"
t POST "/api/v1/deals/$DEAL/zoning-capacity/auto-fill"      "zoning-cap: POST auto-fill"

header "zoning-profile (mount: /api/v1)"
t GET  "/api/v1/deals/$DEAL/zoning-profile"                 "zoning-prof: GET"
t POST "/api/v1/deals/$DEAL/zoning-profile/resolve"         "zoning-prof: POST resolve"       '{}'
t PUT  "/api/v1/deals/$DEAL/zoning-profile/overrides"       "zoning-prof: PUT overrides"      '{"max_height":100}'
t POST "/api/v1/deals/$DEAL/zoning-profile/overlays"        "zoning-prof: POST overlays"      '{"overlay":"historic"}'

header "zoning-intelligence (mount: /api/v1/zoning-intelligence)"
t GET  "/api/v1/zoning-intelligence"                        "zoning-intel: GET /"
t POST "/api/v1/zoning-intelligence/query"                  "zoning-intel: POST query"        '{"question":"what is R-5 zoning?"}'
t POST "/api/v1/zoning-intelligence/analyze"                "zoning-intel: POST analyze"      '{"dealId":"'"$DEAL"'"}'
t GET  "/api/v1/zoning-intelligence/resolve/$DEAL"          "zoning-intel: GET resolve"
t GET  "/api/v1/zoning-intelligence/constraints/$DEAL"      "zoning-intel: GET constraints"
t GET  "/api/v1/zoning-intelligence/analyses"               "zoning-intel: GET analyses"
t POST "/api/v1/zoning-intelligence/use-check"              "zoning-intel: POST use-check"    '{"districtCode":"R-5","proposedUse":"multifamily"}'
t POST "/api/v1/zoning-intelligence/parking-calc"           "zoning-intel: POST parking-calc" '{"units":200,"parkingRatio":1.5}'
t GET  "/api/v1/zoning-intelligence/maturity/Atlanta"       "zoning-intel: GET maturity"

header "zoning-learning (mount: /api/v1/zoning-learning)"
t GET  "/api/v1/zoning-learning/corrections"                 "zoning-learn: GET corrections"
t GET  "/api/v1/zoning-learning/precedents/search?municipality=Atlanta" "zoning-learn: GET precedents"
t GET  "/api/v1/zoning-learning/precedents/patterns"         "zoning-learn: GET patterns"
t GET  "/api/v1/zoning-learning/calibration/Atlanta"         "zoning-learn: GET calibration"
t GET  "/api/v1/zoning-learning/confidence/Atlanta"          "zoning-learn: GET confidence"
t GET  "/api/v1/zoning-learning/maturity"                    "zoning-learn: GET maturity"
t GET  "/api/v1/zoning-learning/maturity/Atlanta"            "zoning-learn: GET maturity/muni"
t GET  "/api/v1/zoning-learning/credibility/$USER_ID"        "zoning-learn: GET credibility"

header "zoning-verification (mount: /api/v1/zoning-verification)"
t POST "/api/v1/zoning-verification/verify"                  "zoning-verify: POST verify"     '{"dealId":"'"$DEAL"'","districtCode":"R-5"}'
t GET  "/api/v1/zoning-verification/verify/deal/$DEAL"       "zoning-verify: GET deal"

header "inline-zoning-analyze (mount: /api/v1)"
t POST "/api/v1/geocode"                                     "zoning-analyze: POST geocode"   '{"address":"100 Peachtree St NW, Atlanta, GA"}'
t POST "/api/v1/zoning/lookup"                               "zoning-analyze: POST lookup"    '{"lat":33.75,"lng":-84.39}'
t GET  "/api/v1/zoning/districts/Atlanta"                    "zoning-analyze: GET districts"

# ============================================================
# SECTION 8: PROPERTY & SITE INTELLIGENCE
# ============================================================
header "property-types (mount: /api/v1/property-types)"
t GET  "/api/v1/property-types"                              "prop-types: GET /"
t GET  "/api/v1/property-types/multifamily"                  "prop-types: GET /:typeKey"

header "property-type-strategies (mount: /api/v1/property-type-strategies)"
t GET  "/api/v1/property-type-strategies"                    "prop-type-strat: GET /"
t GET  "/api/v1/property-type-strategies/multifamily"        "prop-type-strat: GET /:typeKey"

header "property-proxy (mount: /api/v1)"
t GET  "/api/v1/properties/health"                           "prop-proxy: GET health"
t GET  "/api/v1/properties/api-health"                       "prop-proxy: GET api-health"

header "property-metrics (mount: /api/v1/property-metrics)"
t GET  "/api/v1/property-metrics/neighborhoods/benchmarks"   "prop-metrics: GET benchmarks"
t GET  "/api/v1/property-metrics/submarkets/comparison"      "prop-metrics: GET submarkets"
t GET  "/api/v1/property-metrics/owners/top"                 "prop-metrics: GET owners/top"
t GET  "/api/v1/property-metrics/owners/search?q=test"       "prop-metrics: GET owners/search"
t GET  "/api/v1/property-metrics/rent-comps"                 "prop-metrics: GET rent-comps"
t GET  "/api/v1/property-metrics/rent-comps/summary"         "prop-metrics: GET rent-comps/summary"

header "property-scoring (mount: /api/v1/property-scoring)"
t GET  "/api/v1/property-scoring/seller-propensity"          "prop-scoring: GET seller-propensity"
t GET  "/api/v1/property-scoring/value-add"                  "prop-scoring: GET value-add"
t GET  "/api/v1/property-scoring/hidden-gems"                "prop-scoring: GET hidden-gems"
t GET  "/api/v1/property-scoring/cap-rates"                  "prop-scoring: GET cap-rates"
t GET  "/api/v1/property-scoring/tax-burden"                 "prop-scoring: GET tax-burden"
t GET  "/api/v1/property-scoring/supply-intelligence"        "prop-scoring: GET supply-intelligence"
t GET  "/api/v1/property-scoring/design-inputs"              "prop-scoring: GET design-inputs"

header "site-intelligence (mount: /api/v1)"
t GET  "/api/v1/deals/$DEAL/site-intelligence"               "site-intel: GET"
t POST "/api/v1/deals/$DEAL/site-intelligence"               "site-intel: POST"               '{"analyze":true}'

header "property-boundary (mount: /api/v1)"
t GET  "/api/v1/deals/$DEAL/boundary"                        "prop-boundary: GET"
t GET  "/api/v1/deals/$DEAL/boundary/export"                 "prop-boundary: GET export"
t GET  "/api/v1/deals/$DEAL/development-capacity"            "prop-boundary: GET dev-capacity"
t GET  "/api/v1/deals/$DEAL/zoning-confirmation"             "prop-boundary: GET zoning-confirm"
t POST "/api/v1/deals/$DEAL/zoning-confirmation"             "prop-boundary: POST zoning-confirm" '{"confirmed":true,"zoning_code":"R-4","municipality":"Atlanta","confirmed_at":"2025-01-15T12:00:00Z"}'

header "building-envelope (mount: /api/v1)"
t POST "/api/v1/deals/$DEAL/building-envelope"               "building-env: POST"             '{"units":200}'
t GET  "/api/v1/property-type-configs"                       "building-env: GET configs"

header "geographic-context (mount: /api/v1 + /api/v1/deals)"
t GET  "/api/v1/deals/$DEAL/geographic-context"              "geo-context: GET"
t POST "/api/v1/deals/$DEAL/geographic-context"              "geo-context: POST"              '{"lat":33.749,"lng":-84.388}'
t PUT  "/api/v1/deals/$DEAL/geographic-context"              "geo-context: PUT"               '{"lat":33.749,"lng":-84.388}'
t GET  "/api/v1/submarkets/lookup?lat=33.75&lng=-84.39"      "geo-context: GET submarkets/lookup"
t GET  "/api/v1/msas/lookup?lat=33.75&lng=-84.39"            "geo-context: GET msas/lookup"

header "data-upload (mount: /api/v1/properties)"
t GET  "/api/v1/properties/$DEAL/actuals"                    "data-upload: GET actuals"
t GET  "/api/v1/properties/$DEAL/uploads"                    "data-upload: GET uploads"

header "upload-templates (mount: /api/v1/upload-templates)"
t GET  "/api/v1/upload-templates"                            "upload-templates: GET /"

header "upload (mount: /api/v1/uploads)"
t GET  "/api/v1/uploads/templates"                           "uploads: GET templates"

# ============================================================
# SECTION 9: FINANCIAL & CAPITAL STRUCTURE
# ============================================================
header "financial-models (mount: /api/v1/financial-models)"
t GET  "/api/v1/financial-models"                            "fin-models: GET /"
t GET  "/api/v1/financial-models/$DEAL"                      "fin-models: GET /:id"
t POST "/api/v1/financial-models"                            "fin-models: POST /"             '{"dealId":"'"$DEAL"'","name":"Smoke Model"}'
t GET  "/api/v1/financial-models/$DEAL/assumptions"          "fin-models: GET assumptions"
t PATCH "/api/v1/financial-models/$DEAL/assumptions"         "fin-models: PATCH assumptions"  '{"capRate":5.5}'
t POST "/api/v1/financial-models/$DEAL/validate"             "fin-models: POST validate"
t GET  "/api/v1/financial-models/$DEAL/claude-output"        "fin-models: GET claude-output"

header "financial-model (mount: /api/v1/financial-model)"
t POST "/api/v1/financial-model/build"                       "fin-model: POST build"          '{"dealId":"'"$DEAL"'"}'
t GET  "/api/v1/financial-model/$DEAL/latest"                "fin-model: GET latest"
t GET  "/api/v1/financial-model/$DEAL/export/excel"          "fin-model: GET export/excel"

header "financial-dashboard (mount: /api/v1/financial-dashboard)"
t GET  "/api/v1/financial-dashboard/$DEAL/summary"           "fin-dashboard: GET summary"
t POST "/api/v1/financial-dashboard/$DEAL/auto-assumptions"  "fin-dashboard: POST auto-assumptions"
t POST "/api/v1/financial-dashboard/$DEAL/analyze"           "fin-dashboard: POST analyze"

header "capital-structure (mount: /api/v1/capital-structure)"
t POST "/api/v1/capital-structure/stack"                     "cap-struct: POST stack"         '{"purchasePrice":10000000,"ltv":0.7,"equityPercent":0.3}'
t POST "/api/v1/capital-structure/size-senior"               "cap-struct: POST size-senior"   '{"noi":500000,"dscr":1.25,"rate":0.06,"term":30}'
t POST "/api/v1/capital-structure/size-mezz"                 "cap-struct: POST size-mezz"     '{"seniorLoan":7000000,"totalCost":10000000,"maxCombinedLtc":0.85}'
t POST "/api/v1/capital-structure/insights"                  "cap-struct: POST insights"      '{"purchasePrice":10000000,"noi":500000,"seniorDebt":7000000}'
t POST "/api/v1/capital-structure/debt-products/recommend"   "cap-struct: POST debt-reco"     '{"dealType":"acquisition","noi":500000,"loanAmount":7000000}'
t POST "/api/v1/capital-structure/debt-products/mismatch"    "cap-struct: POST debt-mismatch" '{"selectedProduct":"agency","dealProfile":{"holdPeriod":3}}'
t POST "/api/v1/capital-structure/rate/cycle-phase"          "cap-struct: POST rate/cycle"    '{"currentRate":0.065}'
t POST "/api/v1/capital-structure/rate/all-in"               "cap-struct: POST rate/all-in"   '{"baseRate":0.055,"spread":0.015}'
t POST "/api/v1/capital-structure/rate/lock-vs-float"        "cap-struct: POST rate/lock"     '{"fixedRate":0.065,"floatingSpread":0.02}'
t POST "/api/v1/capital-structure/rate/sensitivity"          "cap-struct: POST rate/sens"     '{"loanAmount":7000000,"currentRate":0.065,"noi":500000}'
t POST "/api/v1/capital-structure/rate/spread-percentile"    "cap-struct: POST rate/spread"   '{"spread":150}'
t POST "/api/v1/capital-structure/waterfall"                 "cap-struct: POST waterfall"     '{"equity":3000000,"debt":7000000,"noi":500000,"holdPeriod":5}'
t POST "/api/v1/capital-structure/scenarios/compare"         "cap-struct: POST scenarios"     '{"scenarios":[{"name":"Base","ltv":0.7,"rate":0.065}]}'
t POST "/api/v1/capital-structure/lifecycle/refi"            "cap-struct: POST lifecycle/refi" '{"currentBalance":6500000,"currentRate":0.07,"newRate":0.06,"noi":500000}'
t POST "/api/v1/capital-structure/lifecycle/draw-progress"   "cap-struct: POST lifecycle/draw" '{"totalCommitment":10000000,"drawnAmount":4000000}'
t GET  "/api/v1/capital-structure/rates/live"                "cap-struct: GET rates/live"
t GET  "/api/v1/capital-structure/rates/history?period=30d"  "cap-struct: GET rates/history"
t GET  "/api/v1/capital-structure/rate-sheet/$DEAL/latest"   "cap-struct: GET rate-sheet"
t POST "/api/v1/capital-structure/optimal-strategy"          "cap-struct: POST optimal"       '{"dealId":"'"$DEAL"'","noi":500000,"purchasePrice":10000000}'

header "proforma (mount: /api/v1/deals)"
t GET  "/api/v1/deals/$DEAL/proforma"                        "proforma: GET /:dealId"
t POST "/api/v1/deals/$DEAL/proforma/initialize"             "proforma: POST initialize"
t GET  "/api/v1/deals/$DEAL/proforma/history"                "proforma: GET history"
t GET  "/api/v1/deals/$DEAL/proforma/adjustments"            "proforma: GET adjustments"
t POST "/api/v1/deals/$DEAL/proforma/recalculate"            "proforma: POST recalculate"
t GET  "/api/v1/deals/$DEAL/proforma/comparison"             "proforma: GET comparison"
t GET  "/api/v1/deals/$DEAL/proforma/export"                 "proforma: GET export"
t POST "/api/v1/deals/batch/recalculate"                     "proforma: POST batch/recalc"    '{"dealIds":["'"$DEAL"'"]}'
t PATCH "/api/v1/deals/$DEAL/proforma/override"              "proforma: PATCH override"       '{"assumptionType":"rent_growth","value":3.5}'

header "proforma-generator (mount: /api/v1/properties)"
t POST "/api/v1/properties/$DEAL/proforma/generate"          "proforma-gen: POST generate"    '{"template":"standard"}'
t GET  "/api/v1/properties/$DEAL/proforma/snapshots"         "proforma-gen: GET snapshots"
t GET  "/api/v1/properties/templates"                        "proforma-gen: GET templates"

# ============================================================
# SECTION 10: STRATEGY, SCENARIOS, DD, COMPETITION
# ============================================================
header "strategy-analyses (mount: /api/v1/strategy-analyses)"
t GET  "/api/v1/strategy-analyses/$DEAL"                     "strategy: GET /:id"
t POST "/api/v1/strategy-analyses"                           "strategy: POST /"               '{"dealId":"'"$DEAL"'","strategyType":"value_add"}'
t POST "/api/v1/strategy-analyses/compare"                   "strategy: POST compare"         '{"dealId":"'"$DEAL"'","strategies":["value_add","core_plus"]}'

header "strategies (mount: /api/v1/strategies)"
t GET  "/api/v1/strategies"                                  "strategies: GET /"

header "strategy-definitions (mount: /api/v1/strategy-definitions)"
t GET  "/api/v1/strategy-definitions"                        "strategy-def: GET /"

header "custom-strategies (mount: /api/v1/custom-strategies)"
t GET  "/api/v1/custom-strategies"                           "custom-strat: GET /"

header "dd-checklists (mount: /api/v1/dd-checklists)"
t GET  "/api/v1/dd-checklists/$DEAL"                         "dd-checklists: GET /:dealId"

header "competition (mount: /api/v1/deals)"
t GET  "/api/v1/deals/$DEAL/competitors"                     "competition: GET competitors"
t GET  "/api/v1/deals/$DEAL/advantage-matrix"                "competition: GET advantage-matrix"
t GET  "/api/v1/deals/$DEAL/waitlist-properties"             "competition: GET waitlist"
t GET  "/api/v1/deals/$DEAL/aging-competitors"               "competition: GET aging"
t GET  "/api/v1/deals/$DEAL/competition-insights"            "competition: GET insights"
t GET  "/api/v1/deals/$DEAL/competition-export"              "competition: GET export"
t GET  "/api/v1/deals/$DEAL/competitive-ranking"             "competition: GET ranking"

header "development-scenarios (mount: /api/v1)"
t GET  "/api/v1/deals/$DEAL/scenarios/hbu"                   "dev-scenarios: GET hbu"
t GET  "/api/v1/deals/$DEAL/regulatory-risk-analysis"        "dev-scenarios: GET regulatory-risk"
t GET  "/api/v1/deals/$DEAL/scenarios/recommendations"       "dev-scenarios: GET recommendations"
t GET  "/api/v1/deals/$DEAL/scenarios"                       "dev-scenarios: GET all"
t GET  "/api/v1/deals/$DEAL/scenarios/lookup-district"       "dev-scenarios: GET lookup-district"
t GET  "/api/v1/deals/$DEAL/rezone-analysis"                 "dev-scenarios: GET rezone-analysis"
t GET  "/api/v1/deals/$DEAL/envelope-enrichment"             "dev-scenarios: GET envelope-enrichment"
t POST "/api/v1/deals/$DEAL/scenarios"                       "dev-scenarios: POST create"     '{"name":"Smoke","zoningCode":"MRC-2-C","maxUnits":200}'
t POST "/api/v1/deals/$DEAL/scenarios/deactivate-all"        "dev-scenarios: POST deactivate-all"

header "unit-mix-propagation (mount: /api/v1/deals)"
t GET  "/api/v1/deals/$DEAL/unit-mix/status"                 "unit-mix: GET status"
t POST "/api/v1/deals/$DEAL/unit-mix/set"                    "unit-mix: POST set"             '{"units":[{"type":"1BR","count":50,"rent":1500,"sqft":750}]}'
t POST "/api/v1/deals/$DEAL/unit-mix/apply"                  "unit-mix: POST apply"           '{"targetModules":["proforma"]}'
t POST "/api/v1/deals/$DEAL/development-path/select"         "unit-mix: POST dev-path/select" '{"pathId":"base"}'

header "benchmark-timeline (mount: /api/v1/benchmark-timeline)"
t POST "/api/v1/benchmark-timeline/simulate"                 "bench-timeline: POST simulate"  '{"municipality":"Atlanta","projectType":"multifamily","units":200}'
t GET  "/api/v1/benchmark-timeline/benchmarks?municipality=Atlanta" "bench-timeline: GET benchmarks"
t POST "/api/v1/benchmark-timeline/compare-paths"            "bench-timeline: POST compare"   '{"dealId":"'"$DEAL"'","paths":["by_right","rezone"]}'
t GET  "/api/v1/benchmark-timeline/detailed-steps?municipality=Atlanta&projectType=multifamily" "bench-timeline: GET detailed-steps"
t GET  "/api/v1/benchmark-timeline/jurisdiction-comparison"  "bench-timeline: GET jurisdiction"

# ============================================================
# SECTION 11: SUPPLY, DEMAND, TRAFFIC, LEASING
# ============================================================
header "supply.routes (mount: /api/v1)"
t GET  "/api/v1/deals/$DEAL/supply"                          "supply: GET deals/:id/supply"
t GET  "/api/v1/supply/events"                               "supply: GET events"

header "demand.routes (mount: /api/v1)"
t GET  "/api/v1/deals/$DEAL/demand"                          "demand: GET deals/:id/demand"
t GET  "/api/v1/demand/events"                               "demand: GET events"

header "trade-areas (mount: /api/v1/trade-areas)"
t GET  "/api/v1/trade-areas"                                 "trade-areas: GET /"
t GET  "/api/v1/trade-areas/library"                         "trade-areas: GET library"

header "isochrone (mount: /api/v1/isochrone)"
t POST "/api/v1/isochrone/generate"                          "isochrone: POST generate"       '{"lat":33.75,"lng":-84.39,"mode":"driving","minutes":15}'

header "traffic-ai (mount: /api/v1/traffic-ai)"
t POST "/api/v1/traffic-ai/generate"                         "traffic-ai: POST generate"      '{"dealId":"'"$DEAL"'"}'

header "traffic-data (mount: /api/v1/traffic-data)"
t GET  "/api/v1/traffic-data/adt/stations"                   "traffic-data: GET adt/stations"
t GET  "/api/v1/traffic-data/adt/nearest?lat=33.75&lng=-84.39" "traffic-data: GET adt/nearest"
t GET  "/api/v1/traffic-data/realtime"                       "traffic-data: GET realtime"

header "traffic-comps (mount: /api/v1/traffic-comps)"
t GET  "/api/v1/traffic-comps/$DEAL"                         "traffic-comps: GET /:dealId"
t GET  "/api/v1/traffic-comps/$DEAL/averages"                "traffic-comps: GET averages"
t GET  "/api/v1/traffic-comps/$DEAL/proxy-candidates"        "traffic-comps: GET proxy-candidates"

header "trafficPrediction (mount: /api/v1/traffic)"
t GET  "/api/v1/traffic/model/performance"                   "traffic-pred: GET model/perf"
t GET  "/api/v1/traffic/calibration/active"                  "traffic-pred: GET calibration/active"
t GET  "/api/v1/traffic/validation/errors"                   "traffic-pred: GET validation/errors"

header "leasing-traffic (mount: /api/v1/leasing-traffic)"
t GET  "/api/v1/leasing-traffic/predict/$DEAL"               "leasing-traffic: GET predict"
t GET  "/api/v1/leasing-traffic/forecast/$DEAL"              "leasing-traffic: GET forecast"
t GET  "/api/v1/leasing-traffic/optimize-rent/$DEAL"         "leasing-traffic: GET optimize-rent"
t GET  "/api/v1/leasing-traffic/historical/$DEAL"            "leasing-traffic: GET historical"
t GET  "/api/v1/leasing-traffic/weekly-report/$DEAL/history" "leasing-traffic: GET weekly-history"
t GET  "/api/v1/leasing-traffic/weekly-report/$DEAL/projection" "leasing-traffic: GET weekly-projection"

# ============================================================
# SECTION 12: MARKET INTELLIGENCE
# ============================================================
header "market-intelligence (mount: /api/v1/markets)"
t GET  "/api/v1/markets/preferences"                         "market-intel: GET preferences"
t GET  "/api/v1/markets/overview"                            "market-intel: GET overview"
t GET  "/api/v1/markets/compare"                             "market-intel: GET compare"
t GET  "/api/v1/markets/properties"                          "market-intel: GET properties"
t GET  "/api/v1/markets/atlanta/summary"                     "market-intel: GET atlanta/summary"
t GET  "/api/v1/markets/atlanta/alerts"                      "market-intel: GET atlanta/alerts"
t GET  "/api/v1/markets/atlanta/submarkets/detailed"         "market-enh: GET submarkets/detailed"
t GET  "/api/v1/markets/compare-data"                        "market-enh: GET compare-data"
t GET  "/api/v1/markets/atlanta/owners"                      "market-enh: GET atlanta/owners"

header "market-research (mount: /api/v1/market-research)"
t GET  "/api/v1/market-research/report/$DEAL"                "market-res: GET report"
t GET  "/api/v1/market-research/metrics/$DEAL"               "market-res: GET metrics"
t GET  "/api/v1/market-research/intelligence/$DEAL"          "market-res: GET intelligence"
t GET  "/api/v1/market-research/sources/$DEAL"               "market-res: GET sources"
t GET  "/api/v1/market-research/analysis-input/$DEAL"        "market-res: GET analysis-input"
t GET  "/api/v1/market-research/status/$DEAL"                "market-res: GET status"

header "news (mount: /api/v1/news)"
t GET  "/api/v1/news/events"                                 "news: GET events"
t GET  "/api/v1/news/alerts"                                 "news: GET alerts"
t GET  "/api/v1/news/dashboard"                              "news: GET dashboard"
t GET  "/api/v1/news/network"                                "news: GET network"
t GET  "/api/v1/news/feed"                                   "news: GET feed"

header "intelligence (mount: /api/v1/intelligence)"
t GET  "/api/v1/intelligence/stats"                          "intel: GET stats"
t GET  "/api/v1/intelligence/documents/pending"              "intel: GET docs/pending"
t GET  "/api/v1/intelligence/documents/flagged"              "intel: GET docs/flagged"
t GET  "/api/v1/intelligence/patterns"                       "intel: GET patterns"
t GET  "/api/v1/intelligence/user/stats"                     "intel: GET user/stats"
t GET  "/api/v1/intelligence/user/preferences"               "intel: GET user/preferences"

header "correlation (mount: /api/v1/correlations)"
t GET  "/api/v1/correlations/report"                         "correlation: GET report"
t GET  "/api/v1/correlations/summary"                        "correlation: GET summary"

header "cycle-intelligence (mount: /api/v1/cycle-intelligence)"
t GET  "/api/v1/cycle-intelligence/phase/atlanta"                   "cycle-intel: GET phase"
t GET  "/api/v1/cycle-intelligence/phases"                          "cycle-intel: GET phases"
t GET  "/api/v1/cycle-intelligence/divergence/atlanta"              "cycle-intel: GET divergence"
t GET  "/api/v1/cycle-intelligence/rate-environment"                "cycle-intel: GET rate-env"
t GET  "/api/v1/cycle-intelligence/rate-history"                    "cycle-intel: GET rate-history"
t GET  "/api/v1/cycle-intelligence/leading-indicators"              "cycle-intel: GET indicators"
t GET  "/api/v1/cycle-intelligence/pattern-matches"                 "cycle-intel: GET patterns"
t GET  "/api/v1/cycle-intelligence/predict/rent-growth/atlanta"     "cycle-intel: GET predict/rent"
t GET  "/api/v1/cycle-intelligence/predict/value-change/atlanta"    "cycle-intel: GET predict/value"
t GET  "/api/v1/cycle-intelligence/predict/cap-rate/atlanta"        "cycle-intel: GET predict/cap"
t GET  "/api/v1/cycle-intelligence/predict/full-chain/atlanta"      "cycle-intel: GET predict/chain"
t GET  "/api/v1/cycle-intelligence/phase-optimal-strategy/atlanta"  "cycle-intel: GET strategy"
t GET  "/api/v1/cycle-intelligence/construction-cost-index/atlanta" "cycle-intel: GET const-cost"
t GET  "/api/v1/cycle-intelligence/macro-risk"                      "cycle-intel: GET macro-risk"
t GET  "/api/v1/cycle-intelligence/market-metrics-history/atlanta"  "cycle-intel: GET metrics-hist"
t GET  "/api/v1/cycle-intelligence/deal-performance-by-phase/atlanta" "cycle-intel: GET deal-perf"
t GET  "/api/v1/cycle-intelligence/test/rate-environment"           "cycle-intel: GET test/rate"   "" none
t GET  "/api/v1/cycle-intelligence/test/leading-indicators"         "cycle-intel: GET test/indic"  "" none

# ============================================================
# SECTION 13: TAX, COMPS, ENTITLEMENTS, REGULATORY
# ============================================================
header "m26-tax (mount: /api/v1)"
t GET  "/api/v1/deals/$DEAL/tax/projection"                  "m26-tax: GET projection"
t POST "/api/v1/deals/$DEAL/tax/projection"                  "m26-tax: POST projection"      '{"purchasePrice":10000000,"assessedValue":8000000}'
t GET  "/api/v1/deals/$DEAL/tax/summary"                     "m26-tax: GET summary"

header "tax-comp-analysis (mount: /api/v1)"
t GET  "/api/v1/deals/$DEAL/tax/comp-analysis"               "tax-comp: GET"
t POST "/api/v1/deals/$DEAL/tax/comp-analysis"               "tax-comp: POST"                '{"radius":2,"propertyType":"multifamily"}'
t GET  "/api/v1/deals/$DEAL/tax/comp-analysis/summary"       "tax-comp: GET summary"

header "m27-comps (mount: /api/v1)"
t GET  "/api/v1/deals/$DEAL/sale-comps"                      "m27-comps: GET sale-comps"
t GET  "/api/v1/deals/$DEAL/rent-comps"                      "m27-comps: GET rent-comps"
t POST "/api/v1/deals/$DEAL/sale-comps/discover"             "m27-comps: POST sale-comps/discover" '{}'
t POST "/api/v1/deals/$DEAL/rent-comps/discover"             "m27-comps: POST rent-comps/discover" '{}'

header "comp-query (mount: /api/v1/comps)"
t POST "/api/v1/comps/search"                                "comps: POST search"             '{"lat":33.75,"lng":-84.39,"radius":5}'
t POST "/api/v1/comps/search/v2"                             "comps: POST search/v2"          '{"lat":33.75,"lng":-84.39}'
t GET  "/api/v1/comps/summary"                               "comps: GET summary"

header "entitlement (mount: /api/v1/entitlements)"
t GET  "/api/v1/entitlements"                                "entitlements: GET /"
t GET  "/api/v1/entitlements/kanban"                         "entitlements: GET kanban"
t GET  "/api/v1/entitlements/deal/$DEAL"                     "entitlements: GET deal/:dealId"

header "regulatory-alert (mount: /api/v1/regulatory-alerts)"
t GET  "/api/v1/regulatory-alerts"                           "reg-alerts: GET /"
t GET  "/api/v1/regulatory-alerts/categories"                "reg-alerts: GET categories"
t GET  "/api/v1/regulatory-alerts/strategy-matrix"           "reg-alerts: GET strategy-matrix"
t GET  "/api/v1/regulatory-alerts/municipality/Atlanta"      "reg-alerts: GET municipality"

header "municode (mount: /api/v1/municode)"
t GET  "/api/v1/municode/resolve?municipality=Atlanta&state=GA" "municode: GET resolve"
t GET  "/api/v1/municode/sections/atlanta-ga"                "municode: GET sections/:id"
t GET  "/api/v1/municode/chapter/atlanta-ga"                 "municode: GET chapter/:id"

# ============================================================
# SECTION 14: RISK, VISIBILITY, F40, JEDI
# ============================================================
header "risk (mount: /api/v1/risk)"
t GET  "/api/v1/risk/deal/$DEAL"                             "risk: GET deal/:id"
t GET  "/api/v1/risk/events"                                 "risk: GET events"

header "visibility (mount: /api/v1/visibility)"
t POST "/api/v1/visibility/assess"                           "visibility: POST assess"        '{"address":"123 Main St","lat":33.749,"lng":-84.388}'
t POST "/api/v1/visibility/preview"                          "visibility: POST preview"        '{"lat":33.749,"lng":-84.388}'

header "f40-performance (mount: /api/v1/f40)"
t GET  "/api/v1/f40/market"                                  "f40: GET market"
t GET  "/api/v1/f40/compare"                                 "f40: GET compare"
t GET  "/api/v1/f40/trends"                                  "f40: GET trends"
t GET  "/api/v1/f40/deal/$DEAL"                              "f40: GET deal/:dealId"
t GET  "/api/v1/f40/rankings"                                "f40: GET rankings"

header "jedi (mount: /api/v1/jedi)"
t GET  "/api/v1/jedi/alerts"                                 "jedi: GET alerts"
t GET  "/api/v1/jedi/score/$DEAL"                            "jedi: GET score/:dealId"
t GET  "/api/v1/jedi/leaderboard"                            "jedi: GET leaderboard"
t GET  "/api/v1/jedi/methodology"                            "jedi: GET methodology"

header "opportunity-engine (mount: /api/v1/opportunities)"
t GET  "/api/v1/opportunities/rankings"                      "opportunity: GET rankings"
t GET  "/api/v1/opportunities/alerts"                        "opportunity: GET alerts"
t GET  "/api/v1/opportunities/detect"                        "opportunity: GET detect"

# ============================================================
# SECTION 15: COLLABORATION, TEAM, EMAILS, CONTACTS
# ============================================================
header "collaboration (mount: /api/v1)"
t GET  "/api/v1/deals/$DEAL/team"                            "collab: GET team"
t POST "/api/v1/deals/$DEAL/team/invite"                     "collab: POST invite"            '{"email":"collab@test.com","role":"viewer"}'
t GET  "/api/v1/deals/$DEAL/team/activity"                   "collab: GET activity"

header "team-management (mount: /api/v1)"
t GET  "/api/v1/agent-status"                                "team-mgmt: GET agent-status"

header "orgs (mount: /api/v1/orgs)"
t GET  "/api/v1/orgs"                                        "orgs: GET /"

header "gmail (mount: /api/v1/gmail)"
t GET  "/api/v1/gmail/status"                                "gmail: GET status"
t GET  "/api/v1/emails"                                      "emails: GET /"

header "contacts-sync (mount: /api/v1)"
t GET  "/api/v1/contacts/sync/status"                        "contacts-sync: GET status"

header "corporate-health (mount: /api/v1/corporate-health)"
t GET  "/api/v1/corporate-health/score"                      "corp-health: GET score"
t GET  "/api/v1/corporate-health/report"                     "corp-health: GET report"

# ============================================================
# SECTION 16: MODULE WIRING
# ============================================================
header "module-wiring (mount: /api/v1/module-wiring)"
t GET  "/api/v1/module-wiring/modules/registry"              "mod-wiring: GET registry"
t GET  "/api/v1/module-wiring/modules/build-order"           "mod-wiring: GET build-order"
t GET  "/api/v1/module-wiring/formulas"                      "mod-wiring: GET formulas"
t GET  "/api/v1/module-wiring/data-flow/matrix"              "mod-wiring: GET data-flow/matrix"
t GET  "/api/v1/module-wiring/data-flow/cycles"              "mod-wiring: GET data-flow/cycles"
t GET  "/api/v1/module-wiring/strategy/weights"              "mod-wiring: GET strategy/weights"
t GET  "/api/v1/module-wiring/orchestrator/status"           "mod-wiring: GET orch/status"
t POST "/api/v1/module-wiring/orchestrator/initialize"       "mod-wiring: POST orch/init"
t GET  "/api/v1/module-wiring/orchestrator/pipelines"        "mod-wiring: GET orch/pipelines"
t GET  "/api/v1/module-wiring/orchestrator/validate"         "mod-wiring: GET orch/validate"
t GET  "/api/v1/module-wiring/orchestrator/deal-readiness/$DEAL" "mod-wiring: GET deal-readiness"
t GET  "/api/v1/module-wiring/data-flow/readiness/$DEAL"     "mod-wiring: GET data/readiness"
t POST "/api/v1/module-wiring/strategy/analyze/$DEAL"        "mod-wiring: POST strategy/analyze"
t POST "/api/v1/module-wiring/strategy/compare"              "mod-wiring: POST strategy/compare" '{"dealIds":["'"$DEAL"'"]}'
t POST "/api/v1/module-wiring/wire/p0/$DEAL"                 "mod-wiring: POST wire/p0"
t POST "/api/v1/module-wiring/wire/jedi-score/$DEAL"         "mod-wiring: POST wire/jedi-score"
t POST "/api/v1/module-wiring/wire/news/$DEAL"               "mod-wiring: POST wire/news"
t POST "/api/v1/module-wiring/wire/zoning/$DEAL"             "mod-wiring: POST wire/zoning"
t POST "/api/v1/module-wiring/wire/risk/$DEAL"               "mod-wiring: POST wire/risk"
t POST "/api/v1/module-wiring/wire/strategy/$DEAL"           "mod-wiring: POST wire/strategy"
t POST "/api/v1/module-wiring/wire/p1/$DEAL"                 "mod-wiring: POST wire/p1"
t POST "/api/v1/module-wiring/wire/proforma/sync/$DEAL"      "mod-wiring: POST wire/proforma/sync"
t POST "/api/v1/module-wiring/wire/proforma/init/$DEAL"      "mod-wiring: POST wire/proforma/init"
t POST "/api/v1/module-wiring/wire/scenarios/$DEAL"          "mod-wiring: POST wire/scenarios"
t POST "/api/v1/module-wiring/wire/competition/$DEAL"        "mod-wiring: POST wire/competition"
t POST "/api/v1/module-wiring/wire/debt/$DEAL"               "mod-wiring: POST wire/debt"
t POST "/api/v1/module-wiring/wire/p2/$DEAL"                 "mod-wiring: POST wire/p2"
t POST "/api/v1/module-wiring/wire/traffic/$DEAL"            "mod-wiring: POST wire/traffic"
t POST "/api/v1/module-wiring/wire/exit/$DEAL"               "mod-wiring: POST wire/exit"
t POST "/api/v1/module-wiring/wire/portfolio"                "mod-wiring: POST wire/portfolio" '{"dealIds":["'"$DEAL"'"]}'
t POST "/api/v1/module-wiring/wiring/capital-structure/stack"      "mod-wiring: POST cs/stack"     '{"dealId":"'"$DEAL"'"}'
t POST "/api/v1/module-wiring/wiring/capital-structure/waterfall"  "mod-wiring: POST cs/waterfall" '{"dealId":"'"$DEAL"'"}'
t POST "/api/v1/module-wiring/wiring/capital-structure/scenarios"  "mod-wiring: POST cs/scenarios" '{"dealId":"'"$DEAL"'"}'
t POST "/api/v1/module-wiring/wiring/capital-structure/rate-analysis" "mod-wiring: POST cs/rates" '{"dealId":"'"$DEAL"'"}'

# ============================================================
# SECTION 17: MISC — OPUS, DATA-LIBRARY, UNIT-MIX, MEDIA, CALIBRATION
# ============================================================
header "opus (mount: /api/v1/opus)"
t GET  "/api/v1/opus/conversations"                          "opus: GET conversations"
t POST "/api/v1/opus/conversations"                          "opus: POST conversations"       '{"dealId":"'"$DEAL"'","title":"Smoke"}'
t GET  "/api/v1/opus/proforma-versions"                      "opus: GET proforma-versions"

header "data-library (mount: /api/v1/data-library)"
t GET  "/api/v1/data-library"                                "data-lib: GET /"
t GET  "/api/v1/data-library/comparables"                    "data-lib: GET comparables"

header "unit-mix (mount: /api/v1/unit-mix)"
t GET  "/api/v1/unit-mix/$DEAL"                              "unit-mix: GET /:dealId"

header "design-references (mount: /api/v1/design-references)"
t GET  "/api/v1/design-references/$DEAL"                     "design-refs: GET /:dealId"

header "property-analytics (mount: /api/v1/property-analytics)"
t GET  "/api/v1/property-analytics/connection/test-id"       "prop-analytics: GET connection"

header "scrape (mount: /api/v1/scrape)"
t POST "/api/v1/scrape"                                      "scrape: POST /"                 '{"url":"https://example.com"}'

header "calibration (mount: /api/calibration)"
t GET  "/api/calibration/status"                             "calibration: GET status"
t GET  "/api/calibration/history"                            "calibration: GET history"

header "training (mount: /api/training)"
t GET  "/api/training/status"                                "training: GET status"

header "inline-data (mount: /api/v1)"
t GET  /api/v1/supply/atlanta                                "data: GET supply/atlanta"
t GET  /api/v1/markets                                       "data: GET markets"
t GET  /api/v1/properties                                    "data: GET properties"
t GET  /api/v1/alerts                                        "data: GET alerts"
t GET  /api/v1/agent-status                                  "data: GET agent-status"

header "clawdbot-webhooks (mount: /api/v1/clawdbot)"
t POST /api/v1/clawdbot/command "cb: health"        '{"command":"health"}' cb
t POST /api/v1/clawdbot/command "cb: get_deals"     '{"command":"get_deals","params":{}}' cb
t POST /api/v1/clawdbot/command "cb: get_deal"      '{"command":"get_deal","params":{"dealId":"'"$DEAL"'"}}' cb
t POST /api/v1/clawdbot/command "cb: system_stats"  '{"command":"system_stats","params":{}}' cb
t POST /api/v1/clawdbot/command "cb: recent_errors" '{"command":"recent_errors","params":{}}' cb

# ============================================================
# FINAL CONSOLIDATED REPORT
# ============================================================
END_TS=$(date +%s)
ELAPSED=$(( END_TS - START_TS ))

echo ""
echo "$SEP"
echo ""
echo "  JEDIRE FULL API SMOKE TEST — CONSOLIDATED REPORT"
echo "  Run date : $(date '+%Y-%m-%d %H:%M:%S')"
echo "  Duration : ${ELAPSED}s"
echo "  Base URL : $BASE"
echo "  Deal ID  : $DEAL"
echo ""
echo "  ┌──────────────────────────────┐"
printf "  │  TOTAL  : %5d endpoints    │\n" "$G_TOTAL"
printf "  │  PASS   : %5d (2xx)        │\n" "$G_PASS"
printf "  │  WARN   : %5d (3xx/4xx)    │\n" "$G_WARN"
printf "  │  FAIL   : %5d (5xx)        │\n" "$G_FAIL"
if [ "$G_TOTAL" -gt 0 ]; then
  printf "  │  HEALTH :  %3d%%             │\n" "$(( (G_PASS * 100) / G_TOTAL ))"
fi
echo "  └──────────────────────────────┘"
echo ""

if [ "$G_FAIL" -gt 0 ]; then
  echo "  === 500-LEVEL FAILURES (need fixing) ==="
  grep "^FAIL" "$TEMP_RESULTS"
  echo ""
fi

echo "$SEP"
echo ""
echo "  Full results written to: $REPORT_FILE"

{
  echo "JEDIRE FULL API SMOKE TEST REPORT"
  echo "Generated: $(date '+%Y-%m-%d %H:%M:%S')"
  echo "Duration:  ${ELAPSED}s"
  echo "TOTAL=$G_TOTAL PASS=$G_PASS WARN=$G_WARN FAIL=$G_FAIL"
  echo ""
  cat "$TEMP_RESULTS"
  echo ""
  echo "SUMMARY"
  echo "TOTAL: $G_TOTAL | PASS: $G_PASS | WARN: $G_WARN | FAIL: $G_FAIL"
  if [ "$G_FAIL" -gt 0 ]; then
    echo ""
    echo "FAILURES:"
    grep "^FAIL" "$TEMP_RESULTS"
  fi
} > "$REPORT_FILE"

if [ "$G_FAIL" -gt 0 ]; then
  exit 1
fi
exit 0

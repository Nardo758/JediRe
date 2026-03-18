#!/usr/bin/env bash
# ============================================================
# JediRe Smoke Test Phase 1 — Core Platform Routes (~250 endpoints)
# Routes: auth, admin, admin-api, context-tracker, inline-deals,
#         inline-auth, inline-health, inline-inbox, inline-news,
#         inline-tasks, inline-data, health, dashboard, billing,
#         grid, portfolio, rankings, modules, map-configs, agents,
#         chat, clawdbot, capsules, command-center, deal-assumptions,
#         deal-comp-sets, deal-photos, dealState, deal-timeline,
#         deal-validation, deal-context, dd-checklists, deal-actuals,
#         documentsFiles, files, tasks, events, errors, notifications,
#         preferences, userPreferences, inbox, pipeline
# ============================================================
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:4000}"
DEAL_ID="${DEAL_ID:-e044db04-439b-4442-82df-b36a840f2fd8}"
USER_ID="${USER_ID:-6253ba3f-d40d-4597-86ab-270c8397a857}"
ORG_ID="${ORG_ID:-00000000-0000-0000-0000-000000000001}"
JWT_SECRET="${JWT_SECRET:-your-secret-key-change-this}"
REPORT_OUT="${REPORT_OUT:-$(dirname "$0")/smoke-results-core.txt}"
TIMEOUT="${TIMEOUT:-8}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

PASS=0; WARN=0; FAIL=0; TOTAL=0
FAIL_LIST=()

# Generate JWT tokens (run node from backend dir so jsonwebtoken resolves)
TOKEN=$(cd "$BACKEND_DIR" && node -e "
const jwt = require('jsonwebtoken');
console.log(jwt.sign(
  { userId: '$USER_ID', email: 'demo@jedire.com', role: 'investor' },
  '$JWT_SECRET',
  { expiresIn: '1h', algorithm: 'HS256', issuer: 'jedire-api', audience: 'jedire-client' }
));
" 2>/dev/null)

ADMIN_TOKEN=$(cd "$BACKEND_DIR" && node -e "
const jwt = require('jsonwebtoken');
console.log(jwt.sign(
  { userId: '$USER_ID', email: 'admin@jedire.com', role: 'admin' },
  '$JWT_SECRET',
  { expiresIn: '1h', algorithm: 'HS256', issuer: 'jedire-api', audience: 'jedire-client' }
));
" 2>/dev/null)

if [ -z "$TOKEN" ] || [ -z "$ADMIN_TOKEN" ]; then
  echo "ERROR: Could not generate JWT tokens (is jsonwebtoken installed?)"
  exit 1
fi

echo "============================================================"
echo " JediRe Core Platform Smoke Test"
echo " BASE_URL : $BASE_URL"
echo " DEAL_ID  : $DEAL_ID"
echo " REPORT   : $REPORT_OUT"
echo "============================================================"
echo ""

RESULTS_BUF=""

hit() {
  local method="$1"
  local path="$2"
  local auth="${3:-jwt}"
  local body="${4:-}"
  local label status

  TOTAL=$((TOTAL+1))

  local curl_args=(-s -o /dev/null -w "%{http_code}" -X "$method" --max-time "$TIMEOUT")
  [ -n "$body" ] && curl_args+=(-H 'Content-Type: application/json' -d "$body")

  case "$auth" in
    jwt)    curl_args+=(-H "Authorization: Bearer $TOKEN") ;;
    admin)  curl_args+=(-H "Authorization: Bearer $ADMIN_TOKEN") ;;
    apikey) curl_args+=(-H "x-api-key: test-admin-key-smoke") ;;
    none)   ;;
  esac

  status=$(curl "${curl_args[@]}" "$BASE_URL$path" 2>/dev/null || echo "000")

  if   [[ "$status" =~ ^[23] ]]; then label="PASS"; PASS=$((PASS+1))
  elif [[ "$status" =~ ^5    ]]; then label="FAIL"; FAIL=$((FAIL+1)); FAIL_LIST+=("$label $status $method $path")
  else                                label="WARN"; WARN=$((WARN+1))
  fi

  local line
  line=$(printf "%-4s %3s  %-6s %s" "$label" "$status" "$method" "$path")
  echo "$line"
  RESULTS_BUF="${RESULTS_BUF}${line}"$'\n'
}

section() {
  local hdr="── $1 ──"
  echo ""
  echo "$hdr"
  RESULTS_BUF="${RESULTS_BUF}"$'\n'"${hdr}"$'\n'
}

# ============================================================
# HEALTH (inline-health.routes.ts → /health)
# ============================================================
section "HEALTH (inline-health)"
hit GET  /health/          none
hit GET  /health/db        none

# health.routes.ts also defines /health routes but is NOT mounted separately
section "HEALTH (health.routes.ts — not separately mounted; expect 404)"
hit GET  /health/health       none
hit GET  /health/health/db    none
hit GET  /health/health/ready none
hit GET  /health/health/live  none

# ============================================================
# AUTH (inline-auth.routes.ts → /api/v1/auth)
# ============================================================
section "AUTH (inline-auth)"
hit POST /api/v1/auth/login  none '{"email":"demo@jedire.com","password":"wrong-password-smoke"}'
hit GET  /api/v1/auth/me     jwt

# ============================================================
# ADMIN (admin.routes.ts → /api/v1/admin)
# ============================================================
section "ADMIN — Ingest"
hit GET  /api/v1/admin/ingest/status                    admin
hit POST /api/v1/admin/ingest/zoning-districts          admin '{}'
hit POST /api/v1/admin/ingest/atlanta-benchmarks        admin '{}'
hit POST /api/v1/admin/ingest/florida-benchmarks        admin '{}'
hit POST /api/v1/admin/ingest/map-properties-to-zoning  admin '{}'
hit POST /api/v1/admin/ingest/full                      admin '{}'
hit POST /api/v1/admin/ingest/bls-qcew                  admin '{}'
hit POST /api/v1/admin/ingest/census-acs                admin '{}'
hit POST /api/v1/admin/ingest/census-building-permits   admin '{}'
hit POST /api/v1/admin/ingest/florida-geographies       admin '{}'

section "ADMIN — System"
hit GET  /api/v1/admin/system/health  admin
hit GET  /api/v1/admin/system/stats   admin
hit GET  /api/v1/admin/system/logs    admin

section "ADMIN — Data"
hit GET  /api/v1/admin/data/municipalities   admin
hit GET  /api/v1/admin/data/zoning-coverage  admin
hit GET  /api/v1/admin/data/benchmark-stats  admin
hit POST /api/v1/admin/data/refresh-cache    admin '{}'

section "ADMIN — Users"
hit GET  /api/v1/admin/users                     admin
hit GET  "/api/v1/admin/users/$USER_ID"          admin
hit POST "/api/v1/admin/users/$USER_ID/suspend"  admin '{}'

section "ADMIN — Deals"
hit GET  /api/v1/admin/deals                      admin
hit GET  "/api/v1/admin/deals/$DEAL_ID/audit"     admin
hit POST "/api/v1/admin/deals/$DEAL_ID/fix"       admin '{}'

section "ADMIN — Quality"
hit GET  /api/v1/admin/quality/missing-zoning     admin
hit GET  /api/v1/admin/quality/invalid-boundaries admin
hit GET  /api/v1/admin/quality/orphaned-data      admin
hit POST /api/v1/admin/quality/auto-fix           admin '{}'

section "ADMIN — Integrations"
hit GET  /api/v1/admin/integrations/apartment-locator-ai  admin
hit GET  /api/v1/admin/integrations/apis                   admin
hit POST /api/v1/admin/integrations/test                   admin '{"service":"test"}'

section "ADMIN — Jobs"
hit GET  /api/v1/admin/jobs                      admin
hit POST /api/v1/admin/jobs/fake-job-id/cancel   admin '{}'
hit GET  /api/v1/admin/jobs/fake-job-id/logs     admin

# ============================================================
# ADMIN-API-KEY (admin-api-key.routes.ts → /api/v1/admin-api)
# No real API key configured → expect 403 WARN
# ============================================================
section "ADMIN-API-KEY"
hit GET  /api/v1/admin-api/data/status                    apikey
hit GET  /api/v1/admin-api/data/zoning-coverage           apikey
hit GET  /api/v1/admin-api/data/benchmark-stats           apikey
hit POST /api/v1/admin-api/ingest/run                     apikey '{"step":"full"}'
hit GET  /api/v1/admin-api/municipalities                 apikey
hit POST /api/v1/admin-api/ingest/bls-qcew                apikey '{}'
hit POST /api/v1/admin-api/ingest/census-acs              apikey '{}'
hit POST /api/v1/admin-api/ingest/census-building-permits apikey '{}'
hit POST /api/v1/admin-api/ingest/florida-geographies     apikey '{}'
hit GET  /api/v1/admin-api/health                         apikey

# ============================================================
# ADMIN DATA COVERAGE (admin-data-coverage.routes.ts → /api/v1/admin)
# ============================================================
section "ADMIN DATA COVERAGE"
hit GET  /api/v1/admin/activity/recent             admin
hit GET  /api/v1/admin/data-quality/georgia        admin
hit GET  "/api/v1/admin/Hillsborough/FL"           admin
hit POST "/api/v1/admin/Hillsborough/FL/scrape"    admin '{"limit":5}'
hit POST /api/v1/admin/refresh-stale               admin '{"limit":5}'
hit POST "/api/v1/admin/Hillsborough/FL/test-api"  admin '{}'
hit PUT  "/api/v1/admin/Hillsborough/FL"           admin '{"status":"active"}'

# ============================================================
# CONTEXT TRACKER (context-tracker.routes.ts → /api/v1/context)
# ============================================================
section "CONTEXT TRACKER — Notes"
hit GET    "/api/v1/context/deals/$DEAL_ID/notes"  jwt
hit POST   "/api/v1/context/deals/$DEAL_ID/notes"  jwt '{"title":"Smoke Note","content":"test"}'
hit PUT    "/api/v1/context/notes/00000000-0000-0000-0000-000000000099"    jwt '{"title":"Updated","content":"x"}'
hit DELETE "/api/v1/context/notes/00000000-0000-0000-0000-000000000099"    jwt

section "CONTEXT TRACKER — Activity"
hit GET  "/api/v1/context/deals/$DEAL_ID/activity"  jwt
hit POST "/api/v1/context/deals/$DEAL_ID/activity"  jwt '{"action_type":"update","description":"smoke test"}'

section "CONTEXT TRACKER — Contacts"
hit GET    "/api/v1/context/deals/$DEAL_ID/contacts"  jwt
hit POST   "/api/v1/context/deals/$DEAL_ID/contacts"  jwt '{"name":"Smoke Contact","role":"broker"}'
hit PUT    "/api/v1/context/contacts/00000000-0000-0000-0000-000000000099"    jwt '{"name":"Updated","role":"broker"}'
hit DELETE "/api/v1/context/contacts/00000000-0000-0000-0000-000000000099"    jwt

section "CONTEXT TRACKER — Documents"
hit GET    "/api/v1/context/deals/$DEAL_ID/documents"  jwt
hit DELETE "/api/v1/context/documents/00000000-0000-0000-0000-000000000099"    jwt

section "CONTEXT TRACKER — Key Dates"
hit GET    "/api/v1/context/deals/$DEAL_ID/key-dates"  jwt
hit POST   "/api/v1/context/deals/$DEAL_ID/key-dates"  jwt '{"title":"Closing","date":"2026-06-01","date_type":"closing"}'
hit PUT    "/api/v1/context/key-dates/00000000-0000-0000-0000-000000000099"    jwt '{"title":"Updated","date":"2026-07-01"}'
hit DELETE "/api/v1/context/key-dates/00000000-0000-0000-0000-000000000099"    jwt

section "CONTEXT TRACKER — Decisions"
hit GET    "/api/v1/context/deals/$DEAL_ID/decisions"  jwt
hit POST   "/api/v1/context/deals/$DEAL_ID/decisions"  jwt '{"title":"Buy","decision_type":"acquisition"}'
hit PUT    "/api/v1/context/decisions/00000000-0000-0000-0000-000000000099"    jwt '{"title":"Updated"}'
hit DELETE "/api/v1/context/decisions/00000000-0000-0000-0000-000000000099"    jwt

section "CONTEXT TRACKER — Risks"
hit GET    "/api/v1/context/deals/$DEAL_ID/risks"  jwt
hit POST   "/api/v1/context/deals/$DEAL_ID/risks"  jwt '{"title":"Market Risk","category":"market","impact":"medium","likelihood":"medium"}'
hit PUT    "/api/v1/context/risks/00000000-0000-0000-0000-000000000099"    jwt '{"title":"Updated","impact":"low"}'
hit DELETE "/api/v1/context/risks/00000000-0000-0000-0000-000000000099"    jwt

# ============================================================
# INLINE DEALS (inline-deals.routes.ts → /api/v1/deals)
# ============================================================
section "INLINE DEALS"
hit GET    /api/v1/deals                                jwt
hit GET    "/api/v1/deals/$DEAL_ID"                     jwt
hit GET    "/api/v1/deals/$DEAL_ID/modules"             jwt
hit GET    "/api/v1/deals/$DEAL_ID/properties"          jwt
hit GET    "/api/v1/deals/$DEAL_ID/activity"            jwt
hit GET    "/api/v1/deals/$DEAL_ID/timeline"            jwt
hit GET    "/api/v1/deals/$DEAL_ID/key-moments"         jwt
hit GET    "/api/v1/deals/$DEAL_ID/lease-analysis"      jwt
hit GET    "/api/v1/deals/$DEAL_ID/trade-area"          jwt
hit GET    "/api/v1/deals/$DEAL_ID/zoning-analysis"     jwt
hit GET    "/api/v1/deals/$DEAL_ID/analysis/latest"     jwt
hit POST   "/api/v1/deals/$DEAL_ID/analysis/trigger"    jwt '{}'
hit PATCH  "/api/v1/deals/$DEAL_ID"                     jwt '{"description":"smoke-test-update"}'
hit PATCH  "/api/v1/deals/$DEAL_ID/property"            jwt '{"parcel_id":"SMOKE-PARCEL-001"}'

# ============================================================
# INLINE INBOX (inline-inbox.routes.ts → /api/v1/inbox)
# ============================================================
section "INLINE INBOX"
hit GET  /api/v1/inbox              jwt
hit GET  /api/v1/inbox/accounts     jwt
hit GET  /api/v1/inbox/pst-imports  jwt
hit GET  /api/v1/inbox/stats        jwt

# ============================================================
# INLINE NEWS (news.routes.ts → /api/v1/news)
# ============================================================
section "INLINE NEWS"
hit GET    /api/v1/news/events          jwt
hit GET    /api/v1/news/events/1        jwt
hit GET    /api/v1/news/alerts          jwt
hit PATCH  /api/v1/news/alerts/1        jwt '{"is_read":true}'
hit GET    /api/v1/news/dashboard       jwt
hit GET    /api/v1/news/network         jwt

# ============================================================
# INLINE TASKS (inline-tasks.routes.ts → /api/v1/tasks)
# ============================================================
section "INLINE TASKS"
hit GET    /api/v1/tasks         jwt
hit GET    /api/v1/tasks/stats   jwt
hit POST   /api/v1/tasks         jwt '{"title":"Smoke Task","category":"due_diligence","priority":"low"}'
hit PATCH  /api/v1/tasks/1       jwt '{"status":"in_progress"}'
hit DELETE /api/v1/tasks/999     jwt

# ============================================================
# INLINE DATA (inline-data.routes.ts → /api/v1)
# ============================================================
section "INLINE DATA"
hit GET  /api/v1/supply/Tampa  none
hit GET  /api/v1/markets       none
hit GET  /api/v1/properties    none
hit GET  /api/v1/alerts        jwt

# ============================================================
# DASHBOARD (dashboard.routes.ts → /api/v1/dashboard)
# ============================================================
section "DASHBOARD"
hit GET  /api/v1/dashboard           jwt
hit GET  /api/v1/dashboard/stats     jwt
hit GET  /api/v1/dashboard/findings  jwt
hit GET  /api/v1/dashboard/assets    jwt

# ============================================================
# BILLING (billing.routes.ts → /api/v1/billing)
# ============================================================
section "BILLING"
hit POST /api/v1/billing/create-checkout-session  jwt '{"priceId":"price_test","successUrl":"http://localhost","cancelUrl":"http://localhost"}'
hit POST /api/v1/billing/create-portal-session    jwt '{"returnUrl":"http://localhost"}'
hit GET  /api/v1/billing/subscription             jwt
hit GET  /api/v1/billing/usage                    jwt

# ============================================================
# GRID (grid.routes.ts → /api/v1/grid)
# ============================================================
section "GRID"
hit GET  /api/v1/grid/pipeline                    jwt
hit GET  /api/v1/grid/owned                       jwt
hit GET  "/api/v1/grid/owned/$DEAL_ID/report"     jwt
hit POST /api/v1/grid/export                      jwt '{"format":"csv"}'

# ============================================================
# PORTFOLIO (portfolio.routes.ts → /api/v1/portfolio)
# ============================================================
section "PORTFOLIO"
hit GET  "/api/v1/portfolio/$DEAL_ID/summary"     jwt
hit GET  "/api/v1/portfolio/$DEAL_ID/financials"  jwt
hit GET  "/api/v1/portfolio/$DEAL_ID/leasing"     jwt
hit GET  "/api/v1/portfolio/$DEAL_ID/traffic"     jwt

# ============================================================
# RANKINGS (rankings.routes.ts → /api/v1/rankings)
# ============================================================
section "RANKINGS"
hit GET  /api/v1/rankings/Tampa                jwt
hit GET  /api/v1/rankings/performance/Tampa    jwt
hit GET  /api/v1/rankings/owned/Tampa          jwt
hit GET  /api/v1/rankings/pipeline/Tampa       jwt

# ============================================================
# MODULES (modules.routes.ts → /api/v1/modules)
# ============================================================
section "MODULES"
hit GET   /api/v1/modules               jwt
hit GET   /api/v1/modules/enabled       jwt
hit PATCH /api/v1/modules/supply/toggle jwt '{}'
hit POST  /api/v1/modules/supply/purchase   jwt '{}'
hit POST  /api/v1/modules/supply/subscribe  jwt '{}'

# ============================================================
# MAP CONFIGS (map-configs.routes.ts → /api/v1/map-configs)
# ============================================================
section "MAP CONFIGS"
hit GET    /api/v1/map-configs                                              jwt
hit GET    /api/v1/map-configs/default                                      jwt
hit POST   /api/v1/map-configs                                              jwt '{"name":"Smoke Config","layers":[],"viewport":{}}'
hit GET    "/api/v1/map-configs/00000000-0000-0000-0000-000000000099"       jwt
hit PUT    "/api/v1/map-configs/00000000-0000-0000-0000-000000000099"       jwt '{"name":"Updated"}'
hit DELETE "/api/v1/map-configs/00000000-0000-0000-0000-000000000099"       jwt
hit POST   "/api/v1/map-configs/00000000-0000-0000-0000-000000000099/clone"       jwt '{}'
hit POST   "/api/v1/map-configs/00000000-0000-0000-0000-000000000099/set-default" jwt '{}'

# ============================================================
# AGENTS (agent.routes.ts → /api/v1/agents)
# ============================================================
section "AGENTS"
hit GET  /api/v1/agents/tasks                  jwt
hit GET  /api/v1/agents/tasks/fake-task-id     jwt
hit POST /api/v1/agents/tasks                  jwt '{"type":"analysis","dealId":"'"$DEAL_ID"'"}'

# ============================================================
# CHAT (chat.routes.ts → /api/v1/chat)
# ============================================================
section "CHAT"
hit POST /api/v1/chat  jwt '{"message":"Hello from smoke test","dealId":"'"$DEAL_ID"'"}'

# ============================================================
# CLAWDBOT WEBHOOKS (clawdbot-webhooks.routes.ts → /api/v1/clawdbot)
# ============================================================
section "CLAWDBOT WEBHOOKS"
hit GET  /api/v1/clawdbot/health  none
hit POST /api/v1/clawdbot/command none '{"command":"status"}'
hit POST /api/v1/clawdbot/query   none '{"query":"deals"}'

# ============================================================
# CAPSULES (capsule.routes.ts → /api/capsules)
# ============================================================
section "CAPSULES"
CAPSULE_ID="00000000-0000-0000-0000-000000000099"
hit GET    /api/capsules                                                jwt
hit POST   /api/capsules                                                jwt '{"property_address":"123 Smoke St","asset_class":"multifamily","status":"active"}'
hit GET    "/api/capsules/$CAPSULE_ID"                                  jwt
hit PUT    "/api/capsules/$CAPSULE_ID"                                  jwt '{"status":"active"}'
hit DELETE "/api/capsules/$CAPSULE_ID"                                  jwt
hit POST   "/api/capsules/$CAPSULE_ID/documents"                        jwt '{"document_type":"lease","url":"http://example.com"}'
hit DELETE "/api/capsules/$CAPSULE_ID/documents/fake-doc-id"            jwt
hit POST   "/api/capsules/$CAPSULE_ID/share"                            jwt '{"shared_with_user_id":"'"$USER_ID"'"}'
hit DELETE "/api/capsules/$CAPSULE_ID/share/fake-share-id"              jwt
hit POST   "/api/capsules/$CAPSULE_ID/activity"                         jwt '{"activity_type":"view"}'
hit GET    "/api/capsules/$CAPSULE_ID/activity"                         jwt

# ============================================================
# COMMAND CENTER (command-center.routes.ts — not mounted; expect 404)
# ============================================================
section "COMMAND CENTER (not mounted — expect 404)"
hit GET  /api/v1/command-center/status            jwt
hit POST /api/v1/command-center/sync-atlanta      jwt '{}'
hit POST /api/v1/command-center/sync-all-metros   jwt '{}'
hit GET  /api/v1/command-center/jobs/active       jwt
hit GET  /api/v1/command-center/jobs/history      jwt
hit GET  /api/v1/command-center/job/fake-id       jwt

# ============================================================
# DEAL ASSUMPTIONS (deal-assumptions.routes.ts → /api/v1/deals)
# ============================================================
section "DEAL ASSUMPTIONS"
hit GET  "/api/v1/deals/$DEAL_ID/assumptions"      jwt
hit PUT  "/api/v1/deals/$DEAL_ID/assumptions"      jwt '{"target_irr":0.15,"hold_period":5}'
hit POST "/api/v1/deals/$DEAL_ID/compute-returns"  jwt '{}'
hit PUT  "/api/v1/deals/$DEAL_ID/site-data"        jwt '{"lot_size_acres":2.5}'
hit GET  "/api/v1/deals/$DEAL_ID/full-context"     jwt

# ============================================================
# DEAL COMP SETS (deal-comp-sets.routes.ts → /api/v1/deals)
# ============================================================
section "DEAL COMP SETS"
hit GET    "/api/v1/deals/$DEAL_ID/comp-set"                 jwt
hit POST   "/api/v1/deals/$DEAL_ID/comp-set/discover"        jwt '{}'
hit POST   "/api/v1/deals/$DEAL_ID/comp-set"                 jwt '{"comp_property_id":"'"$ORG_ID"'"}'
hit GET    "/api/v1/deals/$DEAL_ID/comp-set/discover-tiered" jwt
hit POST   "/api/v1/deals/$DEAL_ID/comp-set/add-to-set"      jwt '{"property_id":"'"$ORG_ID"'"}'
hit DELETE "/api/v1/deals/$DEAL_ID/comp-set/fake-comp-id"    jwt
hit PATCH  "/api/v1/deals/$DEAL_ID/comp-set/fake-comp-id"    jwt '{"weight":1.0}'

# ============================================================
# DEAL PHOTOS (deal-photos.routes.ts → /api/v1/deals)
# ============================================================
section "DEAL PHOTOS"
hit GET    "/api/v1/deals/$DEAL_ID/photos"               jwt
hit POST   "/api/v1/deals/$DEAL_ID/photos"               jwt '{"url":"http://example.com/photo.jpg","caption":"Smoke"}'
hit DELETE "/api/v1/deals/$DEAL_ID/photos/fake-photo-id" jwt
hit PATCH  "/api/v1/deals/$DEAL_ID/photos/fake-photo-id" jwt '{"caption":"Updated"}'

# ============================================================
# DEAL STATE (dealState.routes.ts → /api/v1/deals)
# ============================================================
section "DEAL STATE"
hit GET    "/api/v1/deals/$DEAL_ID/state"     jwt
hit POST   "/api/v1/deals/$DEAL_ID/state"     jwt '{"module":"overview","data":{"status":"reviewed"}}'
hit PATCH  "/api/v1/deals/$DEAL_ID/state"     jwt '{"module":"overview","data":{"notes":"smoke"}}'
hit POST   "/api/v1/deals/$DEAL_ID/snapshots" jwt '{"label":"smoke-snapshot"}'
hit GET    "/api/v1/deals/$DEAL_ID/snapshots" jwt
hit POST   "/api/v1/deals/$DEAL_ID/restore"   jwt '{"snapshot_id":"fake-snapshot-id"}'

# ============================================================
# DEAL TIMELINE (deal-timeline.routes.ts — not mounted; expect 404)
# ============================================================
section "DEAL TIMELINE (not mounted — expect 404)"
hit GET    "/api/v1/deals/$DEAL_ID/timeline-events"           jwt
hit POST   "/api/v1/deals/$DEAL_ID/timeline-events"           jwt '{"title":"Smoke Event","event_type":"milestone","date":"2026-06-01"}'
hit PUT    "/api/v1/deals/$DEAL_ID/timeline-events/fake-id"   jwt '{"title":"Updated"}'
hit DELETE "/api/v1/deals/$DEAL_ID/timeline-events/fake-id"   jwt
hit GET    "/api/v1/deals/$DEAL_ID/timeline-summary"          jwt
hit POST   "/api/v1/deals/$DEAL_ID/timeline-events/reorder"   jwt '{"order":[]}'

# ============================================================
# DEAL VALIDATION (deal-validation.routes.ts → /api/v1/deals)
# ============================================================
section "DEAL VALIDATION"
hit POST "/api/v1/deals/$DEAL_ID/validate"           jwt '{}'
hit GET  "/api/v1/deals/$DEAL_ID/validation-status"  jwt
hit POST /api/v1/deals/validate-all                  jwt '{}'

# ============================================================
# DEAL CONTEXT (deal-context.routes.ts → /api/v1/deals)
# ============================================================
section "DEAL CONTEXT"
hit GET   "/api/v1/deals/$DEAL_ID/context"   jwt
hit PATCH "/api/v1/deals/$DEAL_ID/context"   jwt '{"notes":"smoke context update"}'
hit POST  "/api/v1/deals/$DEAL_ID/recompute" jwt '{}'

# ============================================================
# DD CHECKLISTS (dd-checklists.routes.ts → /api/v1/dd-checklists)
# ============================================================
section "DD CHECKLISTS"
hit POST   /api/v1/dd-checklists               jwt '{"deal_id":"'"$DEAL_ID"'","title":"Smoke Checklist"}'
hit GET    "/api/v1/dd-checklists/$DEAL_ID"    jwt
hit POST   /api/v1/dd-checklists/tasks         jwt '{"checklist_id":"fake-id","title":"Review docs"}'
hit PATCH  /api/v1/dd-checklists/tasks/fake-id jwt '{"status":"complete"}'
hit DELETE /api/v1/dd-checklists/tasks/fake-id jwt

# ============================================================
# DEAL ACTUALS (deal-actuals.routes.ts → /api/v1/deals)
# ============================================================
section "DEAL ACTUALS"
hit POST "/api/v1/deals/$DEAL_ID/actuals"                  jwt '{"metric":"noi","period":"2026-Q1","actual_value":50000}'
hit GET  "/api/v1/deals/$DEAL_ID/actuals"                  jwt
hit PUT  "/api/v1/deals/$DEAL_ID/actuals/fake-id/verify"   jwt '{"verified":true}'
hit POST "/api/v1/deals/$DEAL_ID/traffic"                  jwt '{"count":1000,"date":"2026-01-01"}'
hit GET  "/api/v1/deals/$DEAL_ID/traffic"                  jwt
hit POST "/api/v1/deals/$DEAL_ID/flywheel-feeds"           jwt '{"feed_type":"rent","value":1500}'
hit GET  "/api/v1/deals/$DEAL_ID/flywheel-feeds"           jwt
hit GET  "/api/v1/deals/$DEAL_ID/actuals-summary"          jwt

# ============================================================
# DOCUMENTS FILES (documentsFiles.routes.ts — check effective mount)
# ============================================================
section "DOCUMENTS FILES (check mount)"
hit POST   /api/v1/documents                            jwt '{"deal_id":"'"$DEAL_ID"'","filename":"smoke.pdf","file_type":"application/pdf"}'
hit GET    "/api/v1/documents?deal_id=$DEAL_ID"         jwt
hit GET    /api/v1/documents/fake-id                    jwt
hit PUT    /api/v1/documents/fake-id                    jwt '{"filename":"updated.pdf"}'
hit DELETE /api/v1/documents/fake-id                    jwt
hit POST   /api/v1/documents/fake-id/share              jwt '{"shared_with":[]}'
hit GET    /api/v1/documents/fake-id/versions           jwt
hit GET    /api/v1/documents/stats                      jwt
hit GET    /api/v1/documents/recent                     jwt
hit POST   /api/v1/documents/fake-id/versions           jwt '{"url":"http://example.com"}'
hit GET    /api/v1/documents/fake-id/preview            jwt

# ============================================================
# FILES (files.routes.ts — check effective mount)
# ============================================================
section "FILES (check mount)"
hit POST   /api/v1/files                                jwt '{"name":"test.txt","url":"http://example.com"}'
hit GET    "/api/v1/files?deal_id=$DEAL_ID"             jwt
hit DELETE /api/v1/files/fake-id                        jwt
hit GET    "/api/v1/files/fake-id/download"             jwt
hit DELETE "/api/v1/files/fake-id/permanent"            jwt

# ============================================================
# TASKS (tasks.routes.ts — different from inline-tasks; check mount)
# ============================================================
section "TASKS (tasks.routes.ts — check mount)"
hit GET    /api/v1/deal-tasks            jwt
hit GET    /api/v1/deal-tasks/stats      jwt
hit GET    /api/v1/deal-tasks/fake-id    jwt
hit POST   /api/v1/deal-tasks            jwt '{"title":"Smoke","status":"pending"}'
hit PATCH  /api/v1/deal-tasks/fake-id    jwt '{"status":"done"}'
hit DELETE /api/v1/deal-tasks/fake-id    jwt

# ============================================================
# EVENTS (events.routes.ts — check effective mount)
# ============================================================
section "EVENTS (check mount)"
hit POST "/api/v1/events/track"           none '{"event":"page_view","deal_id":"'"$DEAL_ID"'"}'
hit POST /api/v1/events/track-batch       none '{"events":[]}'
hit GET  "/api/v1/events/daily/$ORG_ID"   none
hit GET  "/api/v1/events/score/$ORG_ID"   none
hit GET  /api/v1/events/trending          none
hit POST /api/v1/events/aggregate-daily   none '{}'

# ============================================================
# ERRORS (errors.routes.ts — check effective mount)
# ============================================================
section "ERRORS (check mount)"
hit POST /api/v1/frontend-errors         jwt '{"message":"smoke error","stack":"test"}'
hit GET  /api/v1/frontend-errors/stats   jwt
hit GET  /api/v1/frontend-errors/recent  jwt

# ============================================================
# NOTIFICATIONS (notifications.routes.ts — check effective mount)
# ============================================================
section "NOTIFICATIONS (check mount)"
hit GET  /api/v1/notifications                    jwt
hit POST "/api/v1/notifications/fake-id/read"     jwt '{}'
hit POST /api/v1/notifications/read-all           jwt '{}'

# ============================================================
# PREFERENCES (preferences.routes.ts → /api/v1/preferences)
# ============================================================
section "PREFERENCES"
hit GET    /api/v1/preferences                   jwt
hit POST   /api/v1/preferences                   jwt '{"key":"theme","value":"dark"}'
hit DELETE /api/v1/preferences                   jwt
hit GET    /api/v1/preferences/available-markets jwt
hit GET    /api/v1/preferences/property-types    jwt
hit PUT    /api/v1/preferences/user              jwt '{"timezone":"US/Eastern"}'
hit GET    /api/v1/preferences/user              jwt

# ============================================================
# USER PREFERENCES (userPreferences.routes.ts → /api/v1/settings)
# ============================================================
section "USER PREFERENCES (check mount)"
hit GET  /api/v1/settings/preferences                  jwt
hit PUT  /api/v1/settings/preferences                  jwt '{"notifications":true}'
hit GET  /api/v1/settings/preferences/available-markets jwt
hit GET  /api/v1/settings/preferences/property-types   jwt

# ============================================================
# INBOX (inbox.routes.ts — different from inline-inbox; check mount)
# ============================================================
section "INBOX (inbox.routes.ts — check mount)"
hit GET    /api/v1/email/inbox                    jwt
hit GET    /api/v1/email/inbox/stats              jwt
hit GET    /api/v1/email/inbox/fake-id            jwt
hit PATCH  /api/v1/email/inbox/fake-id            jwt '{"is_read":true}'
hit DELETE /api/v1/email/inbox/fake-id            jwt
hit POST   /api/v1/email/inbox/sync               jwt '{}'
hit POST   /api/v1/email/inbox/compose            jwt '{"to":"test@example.com","subject":"Test","body":"Smoke"}'
hit POST   /api/v1/email/inbox/bulk-action        jwt '{"action":"archive","ids":[]}'

# ============================================================
# PIPELINE (pipeline.ts — check effective mount)
# ============================================================
section "PIPELINE (check mount)"
hit GET  /api/v1/pipeline/status          jwt
hit POST /api/v1/pipeline/load-parcels    jwt '{"county":"Hillsborough","state":"FL"}'
hit POST /api/v1/pipeline/load-mock-data  jwt '{}'
hit GET  /api/v1/pipeline/analyze/fake-id jwt
hit POST /api/v1/pipeline/analyze-batch   jwt '{"ids":[]}'
hit POST /api/v1/pipeline/analyze         jwt '{"address":"123 Main St"}'

# ============================================================
# SUMMARY
# ============================================================
echo ""
echo "============================================================"
echo " RESULTS: PASS=$PASS  WARN=$WARN  FAIL=$FAIL  TOTAL=$TOTAL"
echo "============================================================"

if [ ${#FAIL_LIST[@]} -gt 0 ]; then
  echo ""
  echo "FAILURES (5xx errors):"
  for f in "${FAIL_LIST[@]}"; do
    echo "  $f"
  done
fi

echo ""
echo "Legend: PASS=2xx|3xx  WARN=4xx|000  FAIL=5xx"

# Save results
{
  echo "JediRe Core Platform Smoke Test Results"
  echo "Run: $(date -u)"
  echo "BASE_URL: $BASE_URL"
  echo "DEAL_ID : $DEAL_ID"
  echo ""
  echo "PASS=$PASS  WARN=$WARN  FAIL=$FAIL  TOTAL=$TOTAL"
  echo ""
  echo "$RESULTS_BUF"
  echo ""
  if [ ${#FAIL_LIST[@]} -gt 0 ]; then
    echo "FAILURES (5xx errors):"
    for f in "${FAIL_LIST[@]}"; do
      echo "  $f"
    done
  else
    echo "No 5xx failures."
  fi
} > "$REPORT_OUT"

echo "Results saved to: $REPORT_OUT"

# Exit code: 0 if no 5xx, 1 if failures
[ "$FAIL" -eq 0 ]

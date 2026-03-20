#!/usr/bin/env bash
# ============================================================
# Smoke Test: Phase 5 — Module Wiring, Comms, Org, Admin & Final
#
# Covers remaining mounted route groups not tested in Phases 1–4:
#   Gmail, Microsoft (inline), Emails, Email-Extractions, Contacts-Sync,
#   News, Intelligence, Orgs, Dashboard, Context-Tracker, Module-Wiring,
#   Trade-Areas, Isochrone, Traffic-AI, Leasing-Traffic, Preferences,
#   AI-Preferences, Property-Types, Property-Type-Strategies,
#   Custom-Strategies, Strategies, Zoning-Intelligence, Zoning-Learning,
#   Zoning-Verification, Zoning-Profile, Development-Scenarios,
#   Team-Management, Collaboration, Notarize, Data-Upload, Upload-Templates,
#   Uploads, Entitlements, Regulatory-Alerts, Municode, Scrape,
#   Design-References, Financial-Model (singular), Financial-Dashboard,
#   Visibility, Property-Analytics, Traffic-Data, Traffic-Comps,
#   Unit-Mix (factory), Training, Calibration, Capsules, Maps, Layers,
#   Map-Annotations, M22-Archive, Audit, Kafka-Events, Proposals,
#   Admin, Portfolio, Agents, Chat, Correlations, Opportunities
#
# Semantics:
#   check_strict   → PASS=2xx  FAIL=any other
#   check_lenient  → PASS=2xx  SKIP=400/403/404  FAIL=5xx
#   check_optional → PASS=2xx  SKIP=anything else (routes requiring external OAuth/credentials)
# ============================================================

BASE="http://localhost:4000"
DEAL_ID="12eb9e11-3b2d-44d5-9f59-877a76344c18"
USER_ID="6253ba3f-d40d-4597-86ab-270c8397a857"
PROPERTY_ID="00175617-4d11-447e-a274-9c3fb828a69d"
TRADE_AREA_ID="87db1a79-2f68-4069-b2ef-67566ff666f8"
FAKE_ID="00000000-0000-0000-0000-000000000001"

TOKEN=$(cd /home/runner/workspace/backend && node -e "
const jwt = require('jsonwebtoken');
const secret = process.env.JWT_SECRET || 'your-secret-key-change-this';
const token = jwt.sign(
  {userId:'$USER_ID',email:'m.dixon5030@gmail.com',role:'user'},
  secret,
  {expiresIn:'7d',issuer:'jedire-api',audience:'jedire-client'}
);
console.log(token);
" 2>/dev/null)

PASS=0; FAIL=0; SKIP=0
ERRORS=()

_do_request() {
  local method="$1" url="$2"; shift 2
  curl -s -o /tmp/smoke_body.txt -w "%{http_code}" \
    -X "$method" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    "$@" "$url"
}
_body() { cat /tmp/smoke_body.txt 2>/dev/null; }

check_strict() {
  local label="$1" method="$2" url="$3"; shift 3
  local code; code=$(_do_request "$method" "$url" "$@")
  if [[ "$code" =~ ^2 ]]; then
    echo "PASS  [$code] $label"; PASS=$((PASS+1))
  else
    echo "FAIL  [$code] $label  body=$(_body | head -c 120)"; FAIL=$((FAIL+1))
    ERRORS+=("FAIL [$code] $label")
  fi
}

check_lenient() {
  local label="$1" method="$2" url="$3"; shift 3
  local code; code=$(_do_request "$method" "$url" "$@")
  if [[ "$code" =~ ^2 ]]; then
    echo "PASS  [$code] $label"; PASS=$((PASS+1))
  elif [[ "$code" =~ ^(400|403|404)$ ]]; then
    echo "SKIP  [$code] $label"; SKIP=$((SKIP+1))
  elif [[ "$code" =~ ^5 ]]; then
    echo "FAIL  [$code] $label  body=$(_body | head -c 120)"; FAIL=$((FAIL+1))
    ERRORS+=("FAIL [$code] $label")
  else
    echo "SKIP  [$code] $label"; SKIP=$((SKIP+1))
  fi
}

# check_optional: PASS=2xx, SKIP=4xx/302, FAIL=5xx (routes needing external credentials)
check_optional() {
  local label="$1" method="$2" url="$3"; shift 3
  local code; code=$(_do_request "$method" "$url" "$@")
  if [[ "$code" =~ ^2 ]]; then
    echo "PASS  [$code] $label"; PASS=$((PASS+1))
  elif [[ "$code" =~ ^5 ]]; then
    echo "FAIL  [$code] $label  body=$(_body | head -c 120)"; FAIL=$((FAIL+1))
    ERRORS+=("FAIL [$code] $label")
  else
    echo "SKIP  [$code] $label (external-creds)"; SKIP=$((SKIP+1))
  fi
}

echo "========================================================"
echo " Phase 5 — Module Wiring, Comms, Org, Admin & Final"
echo "========================================================"
echo "BASE=$BASE  DEAL=$DEAL_ID"
echo ""

# ── Dashboard ─────────────────────────────────────────────
echo "── dashboard ──"
check_strict  "Dashboard: GET /dashboard/stats"            GET  "$BASE/api/v1/dashboard/stats"
check_lenient "Dashboard: GET /dashboard/findings"         GET  "$BASE/api/v1/dashboard/findings"
check_lenient "Dashboard: GET /dashboard/assets"           GET  "$BASE/api/v1/dashboard/assets"
check_lenient "Dashboard: GET /dashboard"                  GET  "$BASE/api/v1/dashboard"

# ── Gmail ─────────────────────────────────────────────────
echo "── gmail ──"
check_strict  "Gmail: GET /gmail/accounts"                 GET  "$BASE/api/v1/gmail/accounts"
check_lenient "Gmail: GET /gmail/auth-url"                 GET  "$BASE/api/v1/gmail/auth-url"
check_lenient "Gmail: GET /gmail/auth/url"                 GET  "$BASE/api/v1/gmail/auth/url"
check_lenient "Gmail: GET /gmail/oauth-diagnostics"        GET  "$BASE/api/v1/gmail/oauth-diagnostics"
check_lenient "Gmail: GET /gmail/sync"                     GET  "$BASE/api/v1/gmail/sync"
check_lenient "Gmail: POST /gmail/connect"                 POST "$BASE/api/v1/gmail/connect"
check_lenient "Gmail: POST /gmail/sync/:id"                POST "$BASE/api/v1/gmail/sync/$FAKE_ID"
check_lenient "Gmail: DELETE /gmail/disconnect/:id"        DELETE "$BASE/api/v1/gmail/disconnect/$FAKE_ID"

# ── Microsoft (inline + full router) ─────────────────────
# inline-microsoft.routes.ts: /status, /auth/url, /auth/callback
# microsoft.routes.ts (mounted at /api/v1/microsoft): all 15 routes below
echo "── microsoft ──"
check_strict  "Microsoft: GET /microsoft/status"                         GET  "$BASE/api/v1/microsoft/status"
check_lenient "Microsoft: GET /microsoft/auth/url"                       GET  "$BASE/api/v1/microsoft/auth/url"
check_optional "Microsoft: GET /microsoft/auth/callback"                  GET  "$BASE/api/v1/microsoft/auth/callback"
check_optional "Microsoft: GET /microsoft/auth/callback (forged state — must not 5xx)" GET "$BASE/api/v1/microsoft/auth/callback?code=fake&state=forged.invalidsig"
check_optional "Microsoft: GET /microsoft/auth/connect"                  GET  "$BASE/api/v1/microsoft/auth/connect"
check_optional "Microsoft: POST /microsoft/auth/disconnect"              POST "$BASE/api/v1/microsoft/auth/disconnect" -d '{}'
check_optional "Microsoft: GET /microsoft/emails/inbox"                  GET  "$BASE/api/v1/microsoft/emails/inbox"
check_optional "Microsoft: GET /microsoft/emails/:id"                    GET  "$BASE/api/v1/microsoft/emails/$FAKE_ID"
check_optional "Microsoft: POST /microsoft/emails/send"                  POST "$BASE/api/v1/microsoft/emails/send" \
  -d '{"to":"test@example.com","subject":"Smoke","body":"Test"}'
check_optional "Microsoft: POST /microsoft/emails/:id/reply"             POST "$BASE/api/v1/microsoft/emails/$FAKE_ID/reply" \
  -d '{"body":"reply"}'
check_optional "Microsoft: PATCH /microsoft/emails/:id"                  PATCH "$BASE/api/v1/microsoft/emails/$FAKE_ID" \
  -d '{"isRead":true}'
check_optional "Microsoft: DELETE /microsoft/emails/:id"                 DELETE "$BASE/api/v1/microsoft/emails/$FAKE_ID"
check_optional "Microsoft: GET /microsoft/emails/search"                 GET  "$BASE/api/v1/microsoft/emails/search?q=test"
check_optional "Microsoft: GET /microsoft/folders"                       GET  "$BASE/api/v1/microsoft/folders"
check_optional "Microsoft: GET /microsoft/calendar/events"               GET  "$BASE/api/v1/microsoft/calendar/events"
check_optional "Microsoft: POST /microsoft/calendar/events"              POST "$BASE/api/v1/microsoft/calendar/events" \
  -d '{"subject":"Smoke","start":"2025-01-01T10:00:00Z","end":"2025-01-01T11:00:00Z"}'
check_optional "Microsoft: POST /microsoft/emails/:id/link-property"     POST "$BASE/api/v1/microsoft/emails/$FAKE_ID/link-property" \
  -d '{"propertyId":"'"$PROPERTY_ID"'"}'

# ── Contacts Sync ─────────────────────────────────────────
echo "── contacts-sync ──"
check_strict  "Contacts: GET /contacts/status"             GET  "$BASE/api/v1/contacts/status"
check_lenient "Contacts: GET /contacts/microsoft"          GET  "$BASE/api/v1/contacts/microsoft"
check_lenient "Contacts: GET /contacts/google"             GET  "$BASE/api/v1/contacts/google"
check_lenient "Contacts: POST team import"                 POST "$BASE/api/v1/deals/$DEAL_ID/team/members/import" \
  -d '{"contacts":[]}'

# ── Emails (AI action routes) ─────────────────────────────
echo "── emails ──"
check_lenient "Emails: GET /:id/action-items"              GET  "$BASE/api/v1/emails/1/action-items?body=Please+review+by+Friday"
check_lenient "Emails: POST /:id/create-task"              POST "$BASE/api/v1/emails/1/create-task" \
  -d '{"title":"smoke task","category":"general"}'
check_lenient "Emails: POST /:id/quick-task"               POST "$BASE/api/v1/emails/1/quick-task" \
  -d '{"specificTask":"Check Phase I report"}'
check_lenient "Emails: POST /:id/reply"                    POST "$BASE/api/v1/emails/1/reply" \
  -d '{"body":"test reply"}'

# ── Email Extractions ─────────────────────────────────────
echo "── email-extractions ──"
check_lenient "EmailExtractions: GET /list/properties"     GET  "$BASE/api/v1/email-extractions/list/properties"
check_lenient "EmailExtractions: GET /list/news"           GET  "$BASE/api/v1/email-extractions/list/news"
check_lenient "EmailExtractions: GET /stats/summary"       GET  "$BASE/api/v1/email-extractions/stats/summary"
check_lenient "EmailExtractions: GET /:emailId"            GET  "$BASE/api/v1/email-extractions/1"
check_lenient "EmailExtractions: POST approve"             POST "$BASE/api/v1/email-extractions/properties/$FAKE_ID/approve"
check_lenient "EmailExtractions: POST reject"              POST "$BASE/api/v1/email-extractions/properties/$FAKE_ID/reject" \
  -d '{"reason":"not relevant"}'
check_lenient "EmailExtractions: DELETE extraction"        DELETE "$BASE/api/v1/email-extractions/properties/$FAKE_ID"
check_lenient "EmailExtractions: DELETE news"              DELETE "$BASE/api/v1/email-extractions/news/$FAKE_ID"

# ── News ──────────────────────────────────────────────────
echo "── news ──"
check_strict  "News: GET /news/events"                     GET  "$BASE/api/v1/news/events"
check_lenient "News: GET /news/events/:id"                 GET  "$BASE/api/v1/news/events/$FAKE_ID"
check_strict  "News: GET /news/dashboard"                  GET  "$BASE/api/v1/news/dashboard"
check_strict  "News: GET /news/alerts"                     GET  "$BASE/api/v1/news/alerts"
check_lenient "News: PATCH /news/alerts/:id"               PATCH "$BASE/api/v1/news/alerts/$FAKE_ID" \
  -d '{"read":true}'
check_strict  "News: GET /news/network"                    GET  "$BASE/api/v1/news/network"

# ── Intelligence ──────────────────────────────────────────
echo "── intelligence ──"
check_lenient "Intelligence: PUT user/preferences"         PUT  "$BASE/api/v1/intelligence/user/preferences" \
  -d '{"preferences":{}}'
check_lenient "Intelligence: POST user/generate-embeddings" POST "$BASE/api/v1/intelligence/user/generate-embeddings"

# ── Orgs / RBAC ───────────────────────────────────────────
echo "── orgs ──"
check_lenient "Orgs: GET /orgs"                            GET  "$BASE/api/v1/orgs"
check_lenient "Orgs: POST /orgs"                           POST "$BASE/api/v1/orgs" \
  -d '{"name":"Smoke Org"}'
check_lenient "Orgs: GET /orgs/:id"                        GET  "$BASE/api/v1/orgs/$FAKE_ID"
check_lenient "Orgs: GET /orgs/:id/members"                GET  "$BASE/api/v1/orgs/$FAKE_ID/members"

# ── Context Tracker ───────────────────────────────────────
echo "── context-tracker ──"
check_lenient "Context: GET /context/current"              GET  "$BASE/api/v1/context/current"
check_lenient "Context: POST /context/track"               POST "$BASE/api/v1/context/track" \
  -d '{"event":"page_view","page":"dashboard"}'

# ── Module Wiring ─────────────────────────────────────────
echo "── module-wiring ──"
check_lenient "ModuleWiring: GET /module-wiring"                          GET  "$BASE/api/v1/module-wiring"
check_lenient "ModuleWiring: GET /module-wiring/status"                   GET  "$BASE/api/v1/module-wiring/status"
check_lenient "ModuleWiring: POST /module-wiring/resolve"                 POST "$BASE/api/v1/module-wiring/resolve" \
  -d '{"moduleId":"jedi","dealId":"'"$DEAL_ID"'"}'
check_strict  "ModuleWiring: GET /module-wiring/modules/registry"         GET  "$BASE/api/v1/module-wiring/modules/registry"
check_lenient "ModuleWiring: GET /module-wiring/modules/registry/:id"     GET  "$BASE/api/v1/module-wiring/modules/registry/jedi"
check_strict  "ModuleWiring: GET /module-wiring/modules/build-order"      GET  "$BASE/api/v1/module-wiring/modules/build-order"
check_strict  "ModuleWiring: GET /module-wiring/formulas"                 GET  "$BASE/api/v1/module-wiring/formulas"
check_lenient "ModuleWiring: GET /module-wiring/formulas/:id"             GET  "$BASE/api/v1/module-wiring/formulas/cap-rate"
check_lenient "ModuleWiring: POST /module-wiring/formulas/:id/execute"    POST "$BASE/api/v1/module-wiring/formulas/noi/execute" \
  -d '{"inputs":{"revenue":1000000,"expenses":400000}}'
check_strict  "ModuleWiring: GET /module-wiring/data-flow/matrix"         GET  "$BASE/api/v1/module-wiring/data-flow/matrix"
check_lenient "ModuleWiring: GET /module-wiring/data-flow/incoming/:id"   GET  "$BASE/api/v1/module-wiring/data-flow/incoming/jedi"
check_lenient "ModuleWiring: GET /module-wiring/data-flow/outgoing/:id"   GET  "$BASE/api/v1/module-wiring/data-flow/outgoing/jedi"
check_lenient "ModuleWiring: GET /module-wiring/data-flow/cascade/:id"    GET  "$BASE/api/v1/module-wiring/data-flow/cascade/jedi"
check_lenient "ModuleWiring: GET /module-wiring/data-flow/readiness/:id"  GET  "$BASE/api/v1/module-wiring/data-flow/readiness/$DEAL_ID"
check_strict  "ModuleWiring: GET /module-wiring/data-flow/cycles"         GET  "$BASE/api/v1/module-wiring/data-flow/cycles"
check_strict  "ModuleWiring: GET /module-wiring/orchestrator/status"      GET  "$BASE/api/v1/module-wiring/orchestrator/status"
check_strict  "ModuleWiring: GET /module-wiring/orchestrator/pipelines"   GET  "$BASE/api/v1/module-wiring/orchestrator/pipelines"
check_strict  "ModuleWiring: GET /module-wiring/orchestrator/validate"    GET  "$BASE/api/v1/module-wiring/orchestrator/validate"
check_lenient "ModuleWiring: GET /module-wiring/orchestrator/deal-ready"  GET  "$BASE/api/v1/module-wiring/orchestrator/deal-readiness/$DEAL_ID"
check_lenient "ModuleWiring: GET /module-wiring/strategy/weights"         GET  "$BASE/api/v1/module-wiring/strategy/weights"
check_lenient "ModuleWiring: POST /module-wiring/strategy/analyze"        POST "$BASE/api/v1/module-wiring/strategy/analyze/$DEAL_ID" \
  -d '{}'
check_lenient "ModuleWiring: POST /module-wiring/wire/p0"                 POST "$BASE/api/v1/module-wiring/wire/p0/$DEAL_ID" \
  -d '{}'
check_lenient "ModuleWiring: POST /module-wiring/wire/jedi-score"         POST "$BASE/api/v1/module-wiring/wire/jedi-score/$DEAL_ID" \
  -d '{}'
check_lenient "ModuleWiring: POST /module-wiring/wire/news"               POST "$BASE/api/v1/module-wiring/wire/news/$DEAL_ID" \
  -d '{}'
check_lenient "ModuleWiring: POST /module-wiring/wire/risk"               POST "$BASE/api/v1/module-wiring/wire/risk/$DEAL_ID" \
  -d '{}'
check_lenient "ModuleWiring: POST /module-wiring/wire/strategy"           POST "$BASE/api/v1/module-wiring/wire/strategy/$DEAL_ID" \
  -d '{}'
check_lenient "ModuleWiring: POST /module-wiring/wire/p1"                 POST "$BASE/api/v1/module-wiring/wire/p1/$DEAL_ID" \
  -d '{}'
check_lenient "ModuleWiring: POST /module-wiring/wire/traffic"            POST "$BASE/api/v1/module-wiring/wire/traffic/$DEAL_ID" \
  -d '{}'
check_lenient "ModuleWiring: POST /module-wiring/wiring/cap-struct/stack" POST "$BASE/api/v1/module-wiring/wiring/capital-structure/stack" \
  -d '{"dealId":"'"$DEAL_ID"'","strategy":"core"}'
check_lenient "ModuleWiring: GET /module-wiring/modules/priority/:p"     GET  "$BASE/api/v1/module-wiring/modules/priority/p0"
check_lenient "ModuleWiring: GET /module-wiring/formulas/module/:id"     GET  "$BASE/api/v1/module-wiring/formulas/module/jedi"
check_lenient "ModuleWiring: POST /module-wiring/strategy/compare"       POST "$BASE/api/v1/module-wiring/strategy/compare" \
  -d '{"dealIds":["'"$DEAL_ID"'"]}'
check_lenient "ModuleWiring: POST /module-wiring/strategy/analyze-env"   POST "$BASE/api/v1/module-wiring/strategy/analyze-with-envelope/$DEAL_ID" \
  -d '{}'
check_lenient "ModuleWiring: POST /module-wiring/orch/initialize"         POST "$BASE/api/v1/module-wiring/orchestrator/initialize" \
  -d '{}'
check_lenient "ModuleWiring: POST /module-wiring/orch/execute/:m/:d"      POST "$BASE/api/v1/module-wiring/orchestrator/execute/jedi/$DEAL_ID" \
  -d '{}'
check_lenient "ModuleWiring: POST /module-wiring/orch/cascade/:m/:d"      POST "$BASE/api/v1/module-wiring/orchestrator/cascade/jedi/$DEAL_ID" \
  -d '{}'
check_lenient "ModuleWiring: POST /module-wiring/orch/pipeline/:p/:d"     POST "$BASE/api/v1/module-wiring/orchestrator/pipeline/p0/$DEAL_ID" \
  -d '{}'
check_lenient "ModuleWiring: POST /module-wiring/orch/p0"                 POST "$BASE/api/v1/module-wiring/orchestrator/p0/$DEAL_ID" \
  -d '{}'
check_lenient "ModuleWiring: POST /module-wiring/wire/zoning"             POST "$BASE/api/v1/module-wiring/wire/zoning/$DEAL_ID" \
  -d '{}'
check_lenient "ModuleWiring: POST /module-wiring/wire/subscriptions/setup" POST "$BASE/api/v1/module-wiring/wire/subscriptions/setup" \
  -d '{}'
check_lenient "ModuleWiring: POST /module-wiring/wire/proforma/sync"      POST "$BASE/api/v1/module-wiring/wire/proforma/sync/$DEAL_ID" \
  -d '{}'
check_lenient "ModuleWiring: POST /module-wiring/wire/proforma/init"      POST "$BASE/api/v1/module-wiring/wire/proforma/init/$DEAL_ID" \
  -d '{}'
check_lenient "ModuleWiring: POST /module-wiring/wire/scenarios"          POST "$BASE/api/v1/module-wiring/wire/scenarios/$DEAL_ID" \
  -d '{}'
check_lenient "ModuleWiring: POST /module-wiring/wire/scenarios/recalc"   POST "$BASE/api/v1/module-wiring/wire/scenarios/recalculate/$FAKE_ID" \
  -d '{}'
check_lenient "ModuleWiring: POST /module-wiring/wire/competition"        POST "$BASE/api/v1/module-wiring/wire/competition/$DEAL_ID" \
  -d '{}'
check_lenient "ModuleWiring: POST /module-wiring/wire/debt"               POST "$BASE/api/v1/module-wiring/wire/debt/$DEAL_ID" \
  -d '{}'
check_lenient "ModuleWiring: POST /module-wiring/wire/subs/p1"            POST "$BASE/api/v1/module-wiring/wire/subscriptions/p1/setup" \
  -d '{}'
check_lenient "ModuleWiring: POST /module-wiring/wire/p2"                 POST "$BASE/api/v1/module-wiring/wire/p2/$DEAL_ID" \
  -d '{}'
check_lenient "ModuleWiring: POST /module-wiring/wire/traffic/forecast"   POST "$BASE/api/v1/module-wiring/wire/traffic/forecast/$DEAL_ID" \
  -d '{}'
check_lenient "ModuleWiring: POST /module-wiring/wire/exit"               POST "$BASE/api/v1/module-wiring/wire/exit/$DEAL_ID" \
  -d '{}'
check_lenient "ModuleWiring: POST /module-wiring/wire/portfolio"          POST "$BASE/api/v1/module-wiring/wire/portfolio" \
  -d '{}'
check_lenient "ModuleWiring: POST /module-wiring/wire/subs/p2"            POST "$BASE/api/v1/module-wiring/wire/subscriptions/p2/setup" \
  -d '{}'
check_lenient "ModuleWiring: POST /module-wiring/wire/subs/all"           POST "$BASE/api/v1/module-wiring/wire/subscriptions/all/setup" \
  -d '{}'
check_lenient "ModuleWiring: POST /module-wiring/wiring/cap-struct/wfall" POST "$BASE/api/v1/module-wiring/wiring/capital-structure/waterfall" \
  -d '{"dealId":"'"$DEAL_ID"'"}'
check_lenient "ModuleWiring: POST /module-wiring/wiring/cap-struct/scen"  POST "$BASE/api/v1/module-wiring/wiring/capital-structure/scenarios" \
  -d '{}'
check_lenient "ModuleWiring: POST /module-wiring/wiring/cap-struct/rate"  POST "$BASE/api/v1/module-wiring/wiring/capital-structure/rate-analysis" \
  -d '{"dealId":"'"$DEAL_ID"'"}'
check_lenient "ModuleWiring: POST /module-wiring/wiring/cap-struct/pipe"  POST "$BASE/api/v1/module-wiring/wiring/capital-structure/pipeline" \
  -d '{"dealId":"'"$DEAL_ID"'","strategy":"core","layers":[],"noi":500000,"propertyValue":7000000}'
check_lenient "ModuleWiring: POST /module-wiring/wiring/cap-struct/subs"  POST "$BASE/api/v1/module-wiring/wiring/capital-structure/subscriptions" \
  -d '{}'

# ── Trade Areas ───────────────────────────────────────────
echo "── trade-areas ──"
check_strict  "TradeAreas: GET /trade-areas"               GET  "$BASE/api/v1/trade-areas"
check_lenient "TradeAreas: GET /trade-areas/:id"           GET  "$BASE/api/v1/trade-areas/$TRADE_AREA_ID"
check_lenient "TradeAreas: POST /trade-areas"              POST "$BASE/api/v1/trade-areas" \
  -d '{"name":"Smoke TA","dealId":"'"$DEAL_ID"'"}'
check_lenient "TradeAreas: DELETE /trade-areas/:id"        DELETE "$BASE/api/v1/trade-areas/$FAKE_ID"

# ── Isochrone ─────────────────────────────────────────────
echo "── isochrone ──"
check_lenient "Isochrone: POST /isochrone/generate"        POST "$BASE/api/v1/isochrone/generate" \
  -d '{"lat":33.749,"lng":-84.388,"minutes":15}'

# ── Traffic AI ────────────────────────────────────────────
echo "── traffic-ai ──"
check_lenient "TrafficAI: GET /traffic-ai/deal/$DEAL_ID"   GET  "$BASE/api/v1/traffic-ai/deal/$DEAL_ID"
check_lenient "TrafficAI: POST /traffic-ai/predict"        POST "$BASE/api/v1/traffic-ai/predict" \
  -d '{"dealId":"'"$DEAL_ID"'"}'

# ── Leasing Traffic ───────────────────────────────────────
echo "── leasing-traffic ──"
check_lenient "LeasingTraffic: GET /leasing-traffic"       GET  "$BASE/api/v1/leasing-traffic"
check_lenient "LeasingTraffic: GET /leasing-traffic/:id"   GET  "$BASE/api/v1/leasing-traffic/$FAKE_ID"

# ── Preferences ───────────────────────────────────────────
echo "── preferences ──"
check_strict  "Preferences: GET /preferences"              GET  "$BASE/api/v1/preferences"
check_lenient "Preferences: PUT /preferences"              PUT  "$BASE/api/v1/preferences" \
  -d '{"theme":"dark","notifications":true}'

# ── AI Preferences ────────────────────────────────────────
echo "── ai-preferences ──"
check_lenient "AIPref: GET /settings/ai-preferences"       GET  "$BASE/api/v1/settings/ai-preferences"
check_lenient "AIPref: PUT /settings/ai-preferences"       PUT  "$BASE/api/v1/settings/ai-preferences" \
  -d '{"enableSuggestions":true}'

# ── Property Types ────────────────────────────────────────
echo "── property-types ──"
check_strict  "PropertyTypes: GET /property-types"         GET  "$BASE/api/v1/property-types"
check_lenient "PropertyTypes: POST /property-types"        POST "$BASE/api/v1/property-types" \
  -d '{"name":"mixed_use","label":"Mixed Use"}'

# ── Property Type Strategies ──────────────────────────────
echo "── property-type-strategies ──"
check_strict  "PTStrats: GET /property-type-strategies"    GET  "$BASE/api/v1/property-type-strategies"
check_lenient "PTStrats: GET /:id"                         GET  "$BASE/api/v1/property-type-strategies/$FAKE_ID"

# ── Custom Strategies ─────────────────────────────────────
echo "── custom-strategies ──"
check_strict  "CustomStrats: GET /custom-strategies"       GET  "$BASE/api/v1/custom-strategies"
check_lenient "CustomStrats: POST /custom-strategies"      POST "$BASE/api/v1/custom-strategies" \
  -d '{"name":"smoke strat","type":"value_add"}'

# ── Strategies ────────────────────────────────────────────
echo "── strategies ──"
check_strict  "Strategies: GET /strategies"                GET  "$BASE/api/v1/strategies"
check_lenient "Strategies: POST /strategies"               POST "$BASE/api/v1/strategies" \
  -d '{"name":"smoke strategy","dealId":"'"$DEAL_ID"'"}'

# ── Zoning Intelligence (factory) ────────────────────────
echo "── zoning-intelligence ──"
check_strict  "ZoningIntel: GET /zoning-intelligence"              GET  "$BASE/api/v1/zoning-intelligence"
check_lenient "ZoningIntel: GET /zoning-intelligence/deal/:id"     GET  "$BASE/api/v1/zoning-intelligence/deal/$DEAL_ID"
check_lenient "ZoningIntel: POST /zoning-intelligence/analyze"     POST "$BASE/api/v1/zoning-intelligence/analyze" \
  -d '{"dealId":"'"$DEAL_ID"'"}'

# ── Zoning Learning ───────────────────────────────────────
echo "── zoning-learning ──"
check_lenient "ZoningLearn: GET /zoning-learning/patterns"  GET  "$BASE/api/v1/zoning-learning/patterns"
check_lenient "ZoningLearn: GET /zoning-learning/history"   GET  "$BASE/api/v1/zoning-learning/history"

# ── Zoning Verification ───────────────────────────────────
echo "── zoning-verification ──"
check_lenient "ZoningVerify: GET /zoning-verification"          GET  "$BASE/api/v1/zoning-verification"
check_lenient "ZoningVerify: POST /zoning-verification/verify"  POST "$BASE/api/v1/zoning-verification/verify" \
  -d '{"dealId":"'"$DEAL_ID"'"}'

# ── Zoning Profile ────────────────────────────────────────
echo "── zoning-profile ──"
check_lenient "ZoningProfile: GET /zoning-profile/:id"      GET  "$BASE/api/v1/zoning-profile/$DEAL_ID"

# ── Development Scenarios ─────────────────────────────────
echo "── development-scenarios ──"
check_lenient "DevScenarios: GET /development-scenarios"              GET  "$BASE/api/v1/development-scenarios"
check_lenient "DevScenarios: GET /development-scenarios/:dealId"      GET  "$BASE/api/v1/development-scenarios/$DEAL_ID"

# ── Team Management ───────────────────────────────────────
echo "── team-management ──"
check_strict  "TeamMgmt: GET /deals/:id/team/members"               GET  "$BASE/api/v1/deals/$DEAL_ID/team/members"
check_lenient "TeamMgmt: POST /deals/:id/team/members"              POST "$BASE/api/v1/deals/$DEAL_ID/team/members" \
  -d '{"name":"Smoke Member","email":"smoke@test.com","role":"Reviewer","status":"active"}'
check_lenient "TeamMgmt: PUT /deals/:id/team/members/:mid"          PUT  "$BASE/api/v1/deals/$DEAL_ID/team/members/$FAKE_ID" \
  -d '{"role":"Approver"}'
check_lenient "TeamMgmt: DELETE /deals/:id/team/members/:mid"       DELETE "$BASE/api/v1/deals/$DEAL_ID/team/members/$FAKE_ID"
check_strict  "TeamMgmt: GET /deals/:id/team/tasks"                 GET  "$BASE/api/v1/deals/$DEAL_ID/team/tasks"
check_lenient "TeamMgmt: POST /deals/:id/team/tasks"                POST "$BASE/api/v1/deals/$DEAL_ID/team/tasks" \
  -d '{"title":"Smoke Task","priority":"high"}'
check_lenient "TeamMgmt: PUT /deals/:id/team/tasks/:tid"            PUT  "$BASE/api/v1/deals/$DEAL_ID/team/tasks/$FAKE_ID" \
  -d '{"status":"in_progress"}'
check_lenient "TeamMgmt: DELETE /deals/:id/team/tasks/:tid"         DELETE "$BASE/api/v1/deals/$DEAL_ID/team/tasks/$FAKE_ID"
check_lenient "TeamMgmt: GET /deals/:id/team/tasks/:tid/comments"   GET  "$BASE/api/v1/deals/$DEAL_ID/team/tasks/$FAKE_ID/comments"
check_lenient "TeamMgmt: POST /deals/:id/team/tasks/:tid/comments"  POST "$BASE/api/v1/deals/$DEAL_ID/team/tasks/$FAKE_ID/comments" \
  -d '{"content":"smoke comment"}'
check_strict  "TeamMgmt: GET /deals/:id/team/activity"              GET  "$BASE/api/v1/deals/$DEAL_ID/team/activity"
check_strict  "TeamMgmt: GET /team/role-templates"                  GET  "$BASE/api/v1/team/role-templates"

# ── Collaboration ─────────────────────────────────────────
echo "── collaboration ──"
check_lenient "Collab: GET /deals/:id/collaboration"                  GET  "$BASE/api/v1/deals/$DEAL_ID/collaboration"
check_lenient "Collab: POST /deals/:id/collaboration/comments"        POST "$BASE/api/v1/deals/$DEAL_ID/collaboration/comments" \
  -d '{"content":"smoke comment"}'

# ── Notarize ──────────────────────────────────────────────
echo "── notarize ──"
check_lenient "Notarize: POST /notarize/session"     POST "$BASE/api/v1/notarize/session" \
  -d '{"dealId":"'"$DEAL_ID"'","documentType":"closing"}'
check_lenient "Notarize: GET /notarize/status"       GET  "$BASE/api/v1/notarize/status"

# ── Data Upload ───────────────────────────────────────────
echo "── data-upload ──"
check_lenient "DataUpload: GET /data-upload/pst/status"   GET  "$BASE/api/v1/data-upload/pst/status"
check_lenient "DataUpload: GET /upload-templates"         GET  "$BASE/api/v1/upload-templates"
check_lenient "DataUpload: GET /uploads"                  GET  "$BASE/api/v1/uploads"

# ── Entitlements ──────────────────────────────────────────
echo "── entitlements ──"
check_strict  "Entitle: GET /entitlements"                GET  "$BASE/api/v1/entitlements"
check_lenient "Entitle: GET /entitlements/:dealId"        GET  "$BASE/api/v1/entitlements/$DEAL_ID"
check_lenient "Entitle: POST /entitlements"               POST "$BASE/api/v1/entitlements" \
  -d '{"dealId":"'"$DEAL_ID"'","type":"rezone"}'

# ── Regulatory Alerts ─────────────────────────────────────
echo "── regulatory-alerts ──"
check_strict  "RegAlerts: GET /regulatory-alerts"                    GET  "$BASE/api/v1/regulatory-alerts"
check_lenient "RegAlerts: GET /regulatory-alerts/deal/:dealId"       GET  "$BASE/api/v1/regulatory-alerts/deal/$DEAL_ID"
check_lenient "RegAlerts: POST /regulatory-alerts/check"             POST "$BASE/api/v1/regulatory-alerts/check" \
  -d '{"dealId":"'"$DEAL_ID"'"}'

# ── Municode ──────────────────────────────────────────────
echo "── municode ──"
check_lenient "Municode: GET /municode/search?q=zoning"   GET  "$BASE/api/v1/municode/search?q=zoning"
check_lenient "Municode: GET /municode/districts"         GET  "$BASE/api/v1/municode/districts"

# ── Scrape ────────────────────────────────────────────────
echo "── scrape ──"
check_lenient "Scrape: POST /scrape/url"                  POST "$BASE/api/v1/scrape/url" \
  -d '{"url":"https://example.com"}'
check_lenient "Scrape: GET /scrape/status"                GET  "$BASE/api/v1/scrape/status"

# ── Design References ─────────────────────────────────────
echo "── design-references ──"
check_lenient "DesignRefs: GET /design-references"              GET  "$BASE/api/v1/design-references"
check_lenient "DesignRefs: GET /design-references/:id"          GET  "$BASE/api/v1/design-references/$FAKE_ID"
check_lenient "DesignRefs: POST /design-references"             POST "$BASE/api/v1/design-references" \
  -d '{"name":"Smoke Ref","dealId":"'"$DEAL_ID"'"}'

# ── Financial Model (singular endpoint) ───────────────────
echo "── financial-model ──"
check_lenient "FinModel: GET /financial-model/deal/:id"    GET  "$BASE/api/v1/financial-model/deal/$DEAL_ID"
check_lenient "FinModel: POST /financial-model/compute"    POST "$BASE/api/v1/financial-model/compute" \
  -d '{"dealId":"'"$DEAL_ID"'"}'

# ── Financial Dashboard ───────────────────────────────────
echo "── financial-dashboard ──"
check_lenient "FinDash: GET /financial-dashboard"              GET  "$BASE/api/v1/financial-dashboard"
check_lenient "FinDash: GET /financial-dashboard/deal/:id"     GET  "$BASE/api/v1/financial-dashboard/deal/$DEAL_ID"

# ── Visibility ────────────────────────────────────────────
echo "── visibility ──"
check_lenient "Visibility: POST /visibility/assess"                    POST "$BASE/api/v1/visibility/assess" \
  -d '{"propertyId":"'"$PROPERTY_ID"'","dealId":"'"$DEAL_ID"'"}'
check_lenient "Visibility: GET /visibility/score/:propertyId"          GET  "$BASE/api/v1/visibility/score/$PROPERTY_ID"
check_lenient "Visibility: GET /visibility/assessment/:propertyId"     GET  "$BASE/api/v1/visibility/assessment/$PROPERTY_ID"
check_lenient "Visibility: PUT /visibility/update/:propertyId"         PUT  "$BASE/api/v1/visibility/update/$PROPERTY_ID" \
  -d '{"score":85}'
check_lenient "Visibility: GET /visibility/preview"                    GET  "$BASE/api/v1/visibility/preview"

# ── Property Analytics ────────────────────────────────────
echo "── property-analytics ──"
check_lenient "PropAnalytics: GET /property-analytics/:propId"  GET  "$BASE/api/v1/property-analytics/$PROPERTY_ID"
check_lenient "PropAnalytics: GET /property-analytics/deal/:id" GET  "$BASE/api/v1/property-analytics/deal/$DEAL_ID"

# ── Traffic Data ──────────────────────────────────────────
echo "── traffic-data ──"
check_lenient "TrafficData: GET /traffic-data"                        GET  "$BASE/api/v1/traffic-data"
check_lenient "TrafficData: GET /traffic-data/property/:id"           GET  "$BASE/api/v1/traffic-data/property/$PROPERTY_ID"
check_lenient "TrafficData: GET /traffic-data/deal/:id"               GET  "$BASE/api/v1/traffic-data/deal/$DEAL_ID"

# ── Traffic Comps ─────────────────────────────────────────
echo "── traffic-comps ──"
check_lenient "TrafficComps: GET /traffic-comps"                      GET  "$BASE/api/v1/traffic-comps"
check_lenient "TrafficComps: GET /traffic-comps/deal/:id"             GET  "$BASE/api/v1/traffic-comps/deal/$DEAL_ID"
check_lenient "TrafficComps: POST /traffic-comps/search"              POST "$BASE/api/v1/traffic-comps/search" \
  -d '{"dealId":"'"$DEAL_ID"'"}'

# ── Unit Mix (factory) ────────────────────────────────────
echo "── unit-mix ──"
check_lenient "UnitMix: GET /unit-mix/deal/:id"             GET  "$BASE/api/v1/unit-mix/deal/$DEAL_ID"
check_lenient "UnitMix: GET /unit-mix/deal/:id/program"     GET  "$BASE/api/v1/unit-mix/deal/$DEAL_ID/program"
check_lenient "UnitMix: POST /unit-mix/deal/:id/program"    POST "$BASE/api/v1/unit-mix/deal/$DEAL_ID/program" \
  -d '{"totalUnits":100}'

# ── Training ──────────────────────────────────────────────
echo "── training ──"
check_lenient "Training: GET /api/training/status"          GET  "$BASE/api/training/status"
check_lenient "Training: GET /api/training/sessions"        GET  "$BASE/api/training/sessions"

# ── Calibration ───────────────────────────────────────────
echo "── calibration ──"
check_lenient "Calibration: GET /api/calibration/status"    GET  "$BASE/api/calibration/status"
check_lenient "Calibration: GET /api/calibration/history"   GET  "$BASE/api/calibration/history"

# ── Capsules ──────────────────────────────────────────────
echo "── capsules ──"
check_strict  "Capsules v1: GET /api/v1/capsules"           GET  "$BASE/api/v1/capsules"
check_strict  "Capsules: GET /api/capsules"                 GET  "$BASE/api/capsules"
check_lenient "Capsules: GET /api/capsules/:id"             GET  "$BASE/api/capsules/$FAKE_ID"
check_lenient "Capsules v1: POST /api/v1/capsules"          POST "$BASE/api/v1/capsules" \
  -d '{"dealId":"'"$DEAL_ID"'","name":"smoke capsule"}'

# ── Maps (maps.routes.ts — 9 routes) ─────────────────────
echo "── maps ──"
check_lenient "Maps: GET /maps"                                       GET  "$BASE/api/v1/maps"
check_lenient "Maps: POST /maps"                                      POST "$BASE/api/v1/maps" \
  -d '{"name":"Smoke Map","center":{"lat":33.7,"lng":-84.4}}'
check_lenient "Maps: GET /maps/:id"                                   GET  "$BASE/api/v1/maps/$FAKE_ID"
check_lenient "Maps: PUT /maps/:id"                                   PUT  "$BASE/api/v1/maps/$FAKE_ID" \
  -d '{"name":"Updated Map"}'
check_lenient "Maps: DELETE /maps/:id"                                DELETE "$BASE/api/v1/maps/$FAKE_ID"
check_lenient "Maps: GET /maps/:id/pins"                              GET  "$BASE/api/v1/maps/$FAKE_ID/pins"
check_lenient "Maps: POST /maps/:id/pins"                             POST "$BASE/api/v1/maps/$FAKE_ID/pins" \
  -d '{"lat":33.7,"lng":-84.4,"label":"Smoke Pin"}'
check_lenient "Maps: PUT /maps/:id/pins/:pin_id"                      PUT  "$BASE/api/v1/maps/$FAKE_ID/pins/$FAKE_ID" \
  -d '{"label":"Updated Pin"}'
check_lenient "Maps: DELETE /maps/:id/pins/:pin_id"                   DELETE "$BASE/api/v1/maps/$FAKE_ID/pins/$FAKE_ID"

# ── Layers (layers.routes.ts — 7 routes) ──────────────────
echo "── layers ──"
check_lenient "Layers: GET /layers/map/:map_id"                       GET  "$BASE/api/v1/layers/map/$FAKE_ID"
check_lenient "Layers: GET /layers/:id"                               GET  "$BASE/api/v1/layers/$FAKE_ID"
check_lenient "Layers: POST /layers"                                  POST "$BASE/api/v1/layers" \
  -d '{"mapId":"'"$FAKE_ID"'","name":"smoke layer","type":"geojson"}'
check_lenient "Layers: PUT /layers/:id"                               PUT  "$BASE/api/v1/layers/$FAKE_ID" \
  -d '{"name":"Updated Layer"}'
check_lenient "Layers: DELETE /layers/:id"                            DELETE "$BASE/api/v1/layers/$FAKE_ID"
check_lenient "Layers: POST /layers/reorder"                          POST "$BASE/api/v1/layers/reorder" \
  -d '{"mapId":"'"$FAKE_ID"'","layerIds":[]}'
check_lenient "Layers: GET /layers/sources/:source_type"              GET  "$BASE/api/v1/layers/sources/market"

# ── Map Annotations (mapAnnotations.routes.ts — 6 routes) ─
echo "── map-annotations ──"
check_lenient "MapAnnot: GET /map-annotations"                        GET  "$BASE/api/v1/map-annotations"
check_lenient "MapAnnot: GET /map-annotations/:id"                    GET  "$BASE/api/v1/map-annotations/$FAKE_ID"
check_lenient "MapAnnot: POST /map-annotations"                       POST "$BASE/api/v1/map-annotations" \
  -d '{"mapId":"'"$FAKE_ID"'","type":"note","lat":33.7,"lng":-84.4,"content":"smoke"}'
check_lenient "MapAnnot: PUT /map-annotations/:id"                    PUT  "$BASE/api/v1/map-annotations/$FAKE_ID" \
  -d '{"content":"updated"}'
check_lenient "MapAnnot: DELETE /map-annotations/:id"                 DELETE "$BASE/api/v1/map-annotations/$FAKE_ID"
check_lenient "MapAnnot: POST /map-annotations/:id/share"             POST "$BASE/api/v1/map-annotations/$FAKE_ID/share" \
  -d '{"userId":"'"$FAKE_ID"'"}'

# ── M22 Archive (m22-archive.routes.ts — 11 routes) ───────
echo "── m22-archive ──"
check_lenient "M22: POST /m22-archive/snapshot"                       POST "$BASE/api/v1/m22-archive/snapshot" \
  -d '{"dealId":"'"$DEAL_ID"'","label":"Q1 2026"}'
check_lenient "M22: GET /m22-archive/snapshots/:dealId"               GET  "$BASE/api/v1/m22-archive/snapshots/$DEAL_ID"
check_lenient "M22: GET /m22-archive/snapshot/:dealId/latest"         GET  "$BASE/api/v1/m22-archive/snapshot/$DEAL_ID/latest"
check_lenient "M22: POST /m22-archive/actuals"                        POST "$BASE/api/v1/m22-archive/actuals" \
  -d '{"dealId":"'"$DEAL_ID"'","period":"2026-Q1","value":100000}'
check_lenient "M22: POST /m22-archive/actuals/bulk"                   POST "$BASE/api/v1/m22-archive/actuals/bulk" \
  -d '{"dealId":"'"$DEAL_ID"'","actuals":[]}'
check_lenient "M22: GET /m22-archive/actuals/:dealId"                 GET  "$BASE/api/v1/m22-archive/actuals/$DEAL_ID"
check_lenient "M22: GET /m22-archive/actuals/:dealId/summary"         GET  "$BASE/api/v1/m22-archive/actuals/$DEAL_ID/summary"
check_lenient "M22: GET /m22-archive/actuals/:dealId/variance"        GET  "$BASE/api/v1/m22-archive/actuals/$DEAL_ID/variance"
check_lenient "M22: PUT /m22-archive/actuals/:id/verify"              PUT  "$BASE/api/v1/m22-archive/actuals/$FAKE_ID/verify" \
  -d '{"verified":true}'
check_lenient "M22: POST /m22-archive/benchmarks/query"               POST "$BASE/api/v1/m22-archive/benchmarks/query" \
  -d '{"marketId":"atlanta-ga"}'
check_lenient "M22: POST /m22-archive/benchmarks/compute"             POST "$BASE/api/v1/m22-archive/benchmarks/compute" \
  -d '{"dealId":"'"$DEAL_ID"'"}'

# ── Audit (audit.routes.ts — 11 routes) ───────────────────
echo "── audit ──"
check_lenient "Audit: GET /audit/assumption/:id"                      GET  "$BASE/api/v1/audit/assumption/$FAKE_ID"
check_lenient "Audit: GET /audit/deal/:id"                            GET  "$BASE/api/v1/audit/deal/$DEAL_ID"
check_lenient "Audit: GET /audit/event/:id"                           GET  "$BASE/api/v1/audit/event/$FAKE_ID"
check_lenient "Audit: GET /audit/confidence/:id"                      GET  "$BASE/api/v1/audit/confidence/$DEAL_ID"
check_lenient "Audit: POST /audit/export/:dealId"                     POST "$BASE/api/v1/audit/export/$DEAL_ID" \
  -d '{"format":"json"}'
check_lenient "Audit: POST /audit/chain-link"                         POST "$BASE/api/v1/audit/chain-link" \
  -d '{"dealId":"'"$DEAL_ID"'","source":"comp","target":"proforma"}'
check_lenient "Audit: POST /audit/assumption-evidence"                POST "$BASE/api/v1/audit/assumption-evidence" \
  -d '{"assumptionId":"'"$FAKE_ID"'","evidence":"smoke"}'
check_lenient "Audit: POST /audit/calculation-log"                    POST "$BASE/api/v1/audit/calculation-log" \
  -d '{"dealId":"'"$DEAL_ID"'","module":"noi","inputs":{}}'
check_lenient "Audit: POST /audit/corroboration"                      POST "$BASE/api/v1/audit/corroboration" \
  -d '{"assumptionId":"'"$FAKE_ID"'","source":"market"}'
check_lenient "Audit: PUT /audit/source-credibility/:sourceName"      PUT  "$BASE/api/v1/audit/source-credibility/costar" \
  -d '{"score":0.9}'
check_lenient "Audit: GET /audit/export-status/:exportId"             GET  "$BASE/api/v1/audit/export-status/$FAKE_ID"

# ── Kafka Events ──────────────────────────────────────────
echo "── kafka-events ──"
check_lenient "Kafka: GET /kafka-events/log"                GET  "$BASE/api/v1/kafka-events/log"
check_lenient "Kafka: GET /kafka-events/status"             GET  "$BASE/api/v1/kafka-events/status"
check_lenient "Kafka: GET /kafka-events/analytics"          GET  "$BASE/api/v1/kafka-events/analytics"
check_lenient "Kafka: GET /kafka-events/trace/:id"          GET  "$BASE/api/v1/kafka-events/trace/$FAKE_ID"
check_lenient "Kafka: POST /kafka-events/replay/:id"        POST "$BASE/api/v1/kafka-events/replay/$FAKE_ID"

# ── Proposals ─────────────────────────────────────────────
echo "── proposals ──"
check_lenient "Proposals: GET /proposals/pending"           GET  "$BASE/api/v1/proposals/pending"
check_lenient "Proposals: GET /proposals/my"                GET  "$BASE/api/v1/proposals/my"
check_lenient "Proposals: POST /proposals"                  POST "$BASE/api/v1/proposals" \
  -d '{"dealId":"'"$DEAL_ID"'","type":"acquisition","summary":"smoke"}'
check_lenient "Proposals: POST /proposals/:id/accept"       POST "$BASE/api/v1/proposals/$FAKE_ID/accept"
check_lenient "Proposals: POST /proposals/:id/reject"       POST "$BASE/api/v1/proposals/$FAKE_ID/reject" \
  -d '{"reason":"not suitable"}'
check_lenient "Proposals: GET /proposals/:id/comments"      GET  "$BASE/api/v1/proposals/$FAKE_ID/comments"
check_lenient "Proposals: POST /proposals/:id/comment"      POST "$BASE/api/v1/proposals/$FAKE_ID/comment" \
  -d '{"content":"smoke comment"}'

# ── Admin ─────────────────────────────────────────────────
echo "── admin ──"
check_lenient "Admin: GET /admin/data-tracker/status"               GET  "$BASE/api/v1/admin/data-tracker/status"
check_lenient "Admin: GET /admin/data-tracker/coverage"             GET  "$BASE/api/v1/admin/data-tracker/coverage"
check_lenient "Admin: GET /admin/atlanta-url-discovery/status"      GET  "$BASE/api/v1/admin/atlanta-url-discovery/status"
check_lenient "Admin: GET /admin-api/keys"                          GET  "$BASE/api/v1/admin-api/keys"

# ── Portfolio ─────────────────────────────────────────────
echo "── portfolio ──"
check_lenient "Portfolio: GET /portfolio"                   GET  "$BASE/api/v1/portfolio"
check_lenient "Portfolio: GET /portfolio/summary"           GET  "$BASE/api/v1/portfolio/summary"
check_lenient "Portfolio: GET /portfolio/deals"             GET  "$BASE/api/v1/portfolio/deals"

# ── Agents ────────────────────────────────────────────────
echo "── agents ──"
check_lenient "Agents: GET /agents"                         GET  "$BASE/api/v1/agents"
check_lenient "Agents: POST /agents/query"                  POST "$BASE/api/v1/agents/query" \
  -d '{"query":"What is the deal status?"}'

# ── Chat ──────────────────────────────────────────────────
echo "── chat ──"
check_lenient "Chat: GET /chat/history"                     GET  "$BASE/api/v1/chat/history"
check_lenient "Chat: POST /chat/message"                    POST "$BASE/api/v1/chat/message" \
  -d '{"message":"hello","dealId":"'"$DEAL_ID"'"}'

# ── Correlations ──────────────────────────────────────────
echo "── correlations ──"
check_lenient "Correlations: GET /correlations"             GET  "$BASE/api/v1/correlations"
check_lenient "Correlations: POST /correlations/compute"    POST "$BASE/api/v1/correlations/compute" \
  -d '{"dealId":"'"$DEAL_ID"'"}'

# ── Opportunities ─────────────────────────────────────────
echo "── opportunities ──"
check_lenient "Opportunities: GET /opportunities"           GET  "$BASE/api/v1/opportunities"
check_lenient "Opportunities: POST /opportunities/discover" POST "$BASE/api/v1/opportunities/discover" \
  -d '{"marketId":"atlanta-ga"}'

# ── Notifications ─────────────────────────────────────────
echo "── notifications ──"
check_lenient "Notif: GET /notifications"                   GET  "$BASE/api/v1/notifications"
check_lenient "Notif: PUT /notifications/read-all"          PUT  "$BASE/api/v1/notifications/read-all"

# ── Map Configs ───────────────────────────────────────────
echo "── map-configs ──"
check_strict  "MapConfigs: GET /map-configs"                GET  "$BASE/api/v1/map-configs"
check_lenient "MapConfigs: GET /map-configs/:id"            GET  "$BASE/api/v1/map-configs/$FAKE_ID"

# ── Grid / Rankings ───────────────────────────────────────
echo "── grid-rankings ──"
check_lenient "Grid: GET /grid/deals"                       GET  "$BASE/api/v1/grid/deals"
check_lenient "Rankings: GET /rankings/deals"               GET  "$BASE/api/v1/rankings/deals"

# ── Capital Structure ──────────────────────────────────────
echo "── capital-structure ──"
check_lenient "CapStruct: POST /capital-structure/stack"              POST "$BASE/api/v1/capital-structure/stack" \
  -d '{"noi":500000,"propertyValue":7000000,"strategy":"core"}'
check_lenient "CapStruct: POST /capital-structure/size-senior"        POST "$BASE/api/v1/capital-structure/size-senior" \
  -d '{"noi":500000,"propertyValue":7000000}'
check_lenient "CapStruct: POST /capital-structure/size-mezz"          POST "$BASE/api/v1/capital-structure/size-mezz" \
  -d '{"noi":500000,"propertyValue":7000000}'
check_lenient "CapStruct: POST /capital-structure/insights"           POST "$BASE/api/v1/capital-structure/insights" \
  -d '{"dealId":"'"$DEAL_ID"'"}'
check_lenient "CapStruct: POST /capital-structure/debt/recommend"     POST "$BASE/api/v1/capital-structure/debt-products/recommend" \
  -d '{"noi":500000,"ltv":0.65}'
check_lenient "CapStruct: POST /capital-structure/rate/cycle-phase"   POST "$BASE/api/v1/capital-structure/rate/cycle-phase" \
  -d '{"phase":"expansion"}'
check_lenient "CapStruct: POST /capital-structure/rate/all-in"        POST "$BASE/api/v1/capital-structure/rate/all-in" \
  -d '{"baseRate":5.5,"spread":2.0}'
check_lenient "CapStruct: POST /capital-structure/rate/sensitivity"   POST "$BASE/api/v1/capital-structure/rate/sensitivity" \
  -d '{"dealId":"'"$DEAL_ID"'"}'
check_lenient "CapStruct: POST /capital-structure/waterfall"          POST "$BASE/api/v1/capital-structure/waterfall" \
  -d '{"dealId":"'"$DEAL_ID"'"}'
check_lenient "CapStruct: POST /capital-structure/scenarios/compare"  POST "$BASE/api/v1/capital-structure/scenarios/compare" \
  -d '{"scenarios":[]}'
check_lenient "CapStruct: GET  /capital-structure/rates/live"         GET  "$BASE/api/v1/capital-structure/rates/live"
check_lenient "CapStruct: GET  /capital-structure/rates/history"      GET  "$BASE/api/v1/capital-structure/rates/history"
check_lenient "CapStruct: POST /capital-structure/optimal-strategy"   POST "$BASE/api/v1/capital-structure/optimal-strategy" \
  -d '{"dealId":"'"$DEAL_ID"'"}'

# ── Financial Models (CRUD) ────────────────────────────────
echo "── financial-models ──"
check_strict  "FinModels: GET /financial-models"                      GET  "$BASE/api/v1/financial-models"
check_lenient "FinModels: POST /financial-models"                     POST "$BASE/api/v1/financial-models" \
  -d '{"dealId":"'"$DEAL_ID"'","name":"Smoke Model"}'
check_lenient "FinModels: GET /financial-models/:dealId"              GET  "$BASE/api/v1/financial-models/$DEAL_ID"
check_lenient "FinModels: PATCH /financial-models/:id"                PATCH "$BASE/api/v1/financial-models/$FAKE_ID" \
  -d '{"name":"Updated Model"}'
check_lenient "FinModels: DELETE /financial-models/:id"               DELETE "$BASE/api/v1/financial-models/$FAKE_ID"
check_lenient "FinModels: GET /:dealId/assumptions"                   GET  "$BASE/api/v1/financial-models/$DEAL_ID/assumptions"
check_lenient "FinModels: PATCH /:dealId/assumptions"                 PATCH "$BASE/api/v1/financial-models/$DEAL_ID/assumptions" \
  -d '{"capRate":0.055}'

# ── Strategy Analyses ─────────────────────────────────────
echo "── strategy-analyses ──"
check_lenient "StratAnalyses: POST /strategy-analyses"                POST "$BASE/api/v1/strategy-analyses" \
  -d '{"dealId":"'"$DEAL_ID"'"}'
check_lenient "StratAnalyses: GET /strategy-analyses/:dealId"         GET  "$BASE/api/v1/strategy-analyses/$DEAL_ID"
check_lenient "StratAnalyses: POST /strategy-analyses/compare"        POST "$BASE/api/v1/strategy-analyses/compare" \
  -d '{"dealIds":["'"$DEAL_ID"'"]}'
check_lenient "StratAnalyses: PATCH /strategy-analyses/:id"           PATCH "$BASE/api/v1/strategy-analyses/$FAKE_ID" \
  -d '{"status":"active"}'
check_lenient "StratAnalyses: DELETE /strategy-analyses/:id"          DELETE "$BASE/api/v1/strategy-analyses/$FAKE_ID"

# ── DD Checklists ──────────────────────────────────────────
echo "── dd-checklists ──"
check_lenient "DDCheck: POST /dd-checklists"                          POST "$BASE/api/v1/dd-checklists" \
  -d '{"dealId":"'"$DEAL_ID"'"}'
check_lenient "DDCheck: GET /dd-checklists/:dealId"                   GET  "$BASE/api/v1/dd-checklists/$DEAL_ID"
check_lenient "DDCheck: POST /dd-checklists/tasks"                    POST "$BASE/api/v1/dd-checklists/tasks" \
  -d '{"checklistId":"'"$FAKE_ID"'","title":"Review docs"}'
check_lenient "DDCheck: PATCH /dd-checklists/tasks/:id"               PATCH "$BASE/api/v1/dd-checklists/tasks/$FAKE_ID" \
  -d '{"status":"completed"}'
check_lenient "DDCheck: DELETE /dd-checklists/tasks/:id"              DELETE "$BASE/api/v1/dd-checklists/tasks/$FAKE_ID"

# ── Modules ───────────────────────────────────────────────
echo "── modules ──"
check_strict  "Modules: GET /modules"                                 GET  "$BASE/api/v1/modules"
check_lenient "Modules: GET /modules/:id"                             GET  "$BASE/api/v1/modules/$FAKE_ID"
check_lenient "Modules: POST /modules"                                POST "$BASE/api/v1/modules" \
  -d '{"name":"smoke-module","type":"analysis"}'
check_lenient "Modules: PUT /modules/:id"                             PUT  "$BASE/api/v1/modules/$FAKE_ID" \
  -d '{"enabled":true}'

# ── Module Libraries ──────────────────────────────────────
echo "── module-libraries ──"
check_lenient "ModLibs: GET /module-libraries/:module/files"           GET  "$BASE/api/v1/module-libraries/jedi/files"
check_lenient "ModLibs: GET /module-libraries/:module/files/:id"       GET  "$BASE/api/v1/module-libraries/jedi/files/$FAKE_ID"
check_lenient "ModLibs: DELETE /module-libraries/:module/files/:id"    DELETE "$BASE/api/v1/module-libraries/jedi/files/$FAKE_ID"
check_lenient "ModLibs: GET /module-libraries/:module/files/:id/dl"    GET  "$BASE/api/v1/module-libraries/jedi/files/$FAKE_ID/download"
check_lenient "ModLibs: GET /module-libraries/:module/learning-status" GET  "$BASE/api/v1/module-libraries/jedi/learning-status"
check_lenient "ModLibs: POST /module-libraries/:module/analyze"        POST "$BASE/api/v1/module-libraries/jedi/analyze" \
  -d '{"dealId":"'"$DEAL_ID"'"}'
check_lenient "ModLibs: POST /module-libraries/:module/upload"         POST "$BASE/api/v1/module-libraries/jedi/upload" \
  -d ''

# ── Strategy Definitions ──────────────────────────────────
echo "── strategy-definitions ──"
check_strict  "StratDefs: GET /strategy-definitions"                  GET  "$BASE/api/v1/strategy-definitions"
check_lenient "StratDefs: GET /strategy-definitions/:id"              GET  "$BASE/api/v1/strategy-definitions/$FAKE_ID"
check_lenient "StratDefs: POST /strategy-definitions"                 POST "$BASE/api/v1/strategy-definitions" \
  -d '{"name":"core-plus","type":"core_plus"}'
check_lenient "StratDefs: PUT /strategy-definitions/:id"              PUT  "$BASE/api/v1/strategy-definitions/$FAKE_ID" \
  -d '{"description":"updated"}'

# ── Property Metrics ──────────────────────────────────────
echo "── property-metrics ──"
check_lenient "PropMetrics: GET /property-metrics/$PROPERTY_ID"        GET  "$BASE/api/v1/property-metrics/$PROPERTY_ID"
check_lenient "PropMetrics: GET /property-metrics/deal/$DEAL_ID"       GET  "$BASE/api/v1/property-metrics/deal/$DEAL_ID"
check_lenient "PropMetrics: POST /property-metrics/compute"            POST "$BASE/api/v1/property-metrics/compute" \
  -d '{"propertyId":"'"$PROPERTY_ID"'"}'

# ── Property Scoring ──────────────────────────────────────
echo "── property-scoring ──"
check_lenient "PropScore: GET /property-scoring/$PROPERTY_ID"          GET  "$BASE/api/v1/property-scoring/$PROPERTY_ID"
check_lenient "PropScore: POST /property-scoring/score"                POST "$BASE/api/v1/property-scoring/score" \
  -d '{"propertyId":"'"$PROPERTY_ID"'"}'
check_lenient "PropScore: GET /property-scoring/deal/$DEAL_ID"         GET  "$BASE/api/v1/property-scoring/deal/$DEAL_ID"

# ── Opus ──────────────────────────────────────────────────
echo "── opus ──"
check_lenient "Opus: GET /opus/deal/$DEAL_ID"                          GET  "$BASE/api/v1/opus/deal/$DEAL_ID"
check_lenient "Opus: POST /opus/analyze"                               POST "$BASE/api/v1/opus/analyze" \
  -d '{"dealId":"'"$DEAL_ID"'"}'
check_lenient "Opus: GET /opus/status/$DEAL_ID"                        GET  "$BASE/api/v1/opus/status/$DEAL_ID"

# ── Data Library ──────────────────────────────────────────
echo "── data-library ──"
check_strict  "DataLib: GET /data-library"                             GET  "$BASE/api/v1/data-library"
check_lenient "DataLib: GET /data-library/:id"                         GET  "$BASE/api/v1/data-library/$FAKE_ID"
check_lenient "DataLib: POST /data-library/search"                     POST "$BASE/api/v1/data-library/search" \
  -d '{"query":"cap rate"}'
check_lenient "DataLib: POST /data-library"                            POST "$BASE/api/v1/data-library" \
  -d '{"name":"smoke-dataset","type":"market"}'

# ── Market Research ───────────────────────────────────────
echo "── market-research ──"
check_lenient "MktResearch: GET /market-research"                      GET  "$BASE/api/v1/market-research"
check_lenient "MktResearch: GET /market-research/:id"                  GET  "$BASE/api/v1/market-research/$FAKE_ID"
check_lenient "MktResearch: POST /market-research"                     POST "$BASE/api/v1/market-research" \
  -d '{"dealId":"'"$DEAL_ID"'","topic":"submarket trends"}'
check_lenient "MktResearch: GET /market-research/deal/$DEAL_ID"        GET  "$BASE/api/v1/market-research/deal/$DEAL_ID"

# ── Benchmark Timeline ────────────────────────────────────
echo "── benchmark-timeline ──"
check_lenient "BenchTimeline: GET /benchmark-timeline"                 GET  "$BASE/api/v1/benchmark-timeline?county=Fulton&state=GA"
check_lenient "BenchTimeline: GET /benchmark-timeline/:id"             GET  "$BASE/api/v1/benchmark-timeline/$FAKE_ID"
check_lenient "BenchTimeline: POST /benchmark-timeline"                POST "$BASE/api/v1/benchmark-timeline" \
  -d '{"dealId":"'"$DEAL_ID"'","county":"Fulton","state":"GA"}'

# ── Extractions (unmounted — extractions.routes.ts) ───────
echo "── extractions ──"
check_lenient "Extractions: GET /extractions/pending"                  GET  "$BASE/api/v1/extractions/pending"
check_lenient "Extractions: POST /extractions/:id/approve"             POST "$BASE/api/v1/extractions/$FAKE_ID/approve" \
  -d '{}'
check_lenient "Extractions: POST /extractions/:id/reject"              POST "$BASE/api/v1/extractions/$FAKE_ID/reject" \
  -d '{}'
check_lenient "Extractions: POST /extractions/:id/skip"                POST "$BASE/api/v1/extractions/$FAKE_ID/skip" \
  -d '{}'
check_lenient "Extractions: POST /extractions/bulk-approve"            POST "$BASE/api/v1/extractions/bulk-approve" \
  -d '{"ids":[]}'
check_lenient "Extractions: POST /extractions/bulk-reject"             POST "$BASE/api/v1/extractions/bulk-reject" \
  -d '{"ids":[]}'

# ── Asset News (unmounted — assetNews.routes.ts, 5 routes) ───
echo "── asset-news ──"
check_lenient "AssetNews: GET /:assetId/news"                          GET  "$BASE/api/v1/assets/$FAKE_ID/news"
check_lenient "AssetNews: POST /:assetId/news/:newsId/link"            POST "$BASE/api/v1/assets/$FAKE_ID/news/$FAKE_ID/link" \
  -d '{"relevanceScore":0.9}'
check_lenient "AssetNews: PATCH /:assetId/news/:newsId/link"           PATCH "$BASE/api/v1/assets/$FAKE_ID/news/$FAKE_ID/link" \
  -d '{"relevanceScore":0.8}'
check_lenient "AssetNews: DELETE /:assetId/news/:newsId/link"          DELETE "$BASE/api/v1/assets/$FAKE_ID/news/$FAKE_ID/link"
check_lenient "AssetNews: POST /news/:newsId/auto-link"                POST "$BASE/api/v1/news/$FAKE_ID/auto-link" -d '{}'

# ── Asset Notes (unmounted — assetNotes.routes.ts, 7 routes) ─
echo "── asset-notes ──"
check_lenient "AssetNotes: GET /:assetId/notes"                        GET  "$BASE/api/v1/assets/$FAKE_ID/notes"
check_lenient "AssetNotes: GET /:assetId/notes/:noteId"                GET  "$BASE/api/v1/assets/$FAKE_ID/notes/$FAKE_ID"
check_lenient "AssetNotes: POST /:assetId/notes"                       POST "$BASE/api/v1/assets/$FAKE_ID/notes" \
  -d '{"content":"smoke note","latitude":33.749,"longitude":-84.388}'
check_lenient "AssetNotes: PATCH /:assetId/notes/:noteId"              PATCH "$BASE/api/v1/assets/$FAKE_ID/notes/$FAKE_ID" \
  -d '{"content":"updated"}'
check_lenient "AssetNotes: DELETE /:assetId/notes/:noteId"             DELETE "$BASE/api/v1/assets/$FAKE_ID/notes/$FAKE_ID"
check_lenient "AssetNotes: POST /:assetId/notes/:noteId/attachments"   POST "$BASE/api/v1/assets/$FAKE_ID/notes/$FAKE_ID/attachments" \
  -d '{}'
check_lenient "AssetNotes: DELETE /:assetId/notes/:noteId/attachments" DELETE "$BASE/api/v1/assets/$FAKE_ID/notes/$FAKE_ID/attachments"

# ── Note Categories (unmounted — noteCategories.routes.ts, 6 routes) ─
echo "── note-categories ──"
check_lenient "NoteCategories: GET /note-categories"                   GET  "$BASE/api/v1/note-categories"
check_lenient "NoteCategories: GET /note-categories/stats/usage"       GET  "$BASE/api/v1/note-categories/stats/usage"
check_lenient "NoteCategories: GET /note-categories/:id"               GET  "$BASE/api/v1/note-categories/$FAKE_ID"
check_lenient "NoteCategories: POST /note-categories"                  POST "$BASE/api/v1/note-categories" \
  -d '{"name":"Smoke Category","color":"#ff0000"}'
check_lenient "NoteCategories: PATCH /note-categories/:id"             PATCH "$BASE/api/v1/note-categories/$FAKE_ID" \
  -d '{"name":"Updated"}'
check_lenient "NoteCategories: DELETE /note-categories/:id"            DELETE "$BASE/api/v1/note-categories/$FAKE_ID"

# ── Note Replies (unmounted — noteReplies.routes.ts) ──────
echo "── note-replies ──"
check_lenient "NoteReplies: GET /notes/:id/replies"                    GET  "$BASE/api/v1/notes/$FAKE_ID/replies"
check_lenient "NoteReplies: GET /notes/:id/replies/:rid"               GET  "$BASE/api/v1/notes/$FAKE_ID/replies/$FAKE_ID"
check_lenient "NoteReplies: POST /notes/:id/replies"                   POST "$BASE/api/v1/notes/$FAKE_ID/replies" \
  -d '{"content":"smoke reply"}'
check_lenient "NoteReplies: PATCH /notes/:id/replies/:rid"             PATCH "$BASE/api/v1/notes/$FAKE_ID/replies/$FAKE_ID" \
  -d '{"content":"updated reply"}'
check_lenient "NoteReplies: DELETE /notes/:id/replies/:rid"            DELETE "$BASE/api/v1/notes/$FAKE_ID/replies/$FAKE_ID"

# ── Task Completion (unmounted — task-completion.routes.ts) ─
echo "── task-completion ──"
check_lenient "TaskComp: POST /task-completion/scan-completions"       POST "$BASE/api/v1/task-completion/scan-completions" \
  -d '{}'
check_lenient "TaskComp: POST /task-completion/:id/complete-from-email" POST "$BASE/api/v1/task-completion/$FAKE_ID/complete-from-email" \
  -d '{"emailId":1}'
check_lenient "TaskComp: POST /task-completion/:id/reject-completion"  POST "$BASE/api/v1/task-completion/$FAKE_ID/reject-completion" \
  -d '{}'
check_lenient "TaskComp: GET /task-completion/completion-suggestions"  GET  "$BASE/api/v1/task-completion/completion-suggestions"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo ""
echo "========================================================"
echo " MISC MODULE WIRING SMOKE TEST — FINAL RESULTS"
echo "========================================================"
echo " PASS: $PASS  |  SKIP: $SKIP  |  FAIL: $FAIL  |  TOTAL: $((PASS+SKIP+FAIL))"
echo "========================================================"

if [ ${#ERRORS[@]} -gt 0 ]; then
  echo ""
  echo "── FAILURES ──────────────────────────────────────────"
  for e in "${ERRORS[@]}"; do echo "  $e"; done
fi

# Write results file
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESULTS_FILE="${1:-${SCRIPT_DIR}/smoke-results-misc.txt}"
{
  echo "Misc / Module-Wiring Smoke Test Results"
  echo "Run at: $(date -u)"
  echo "PASS: $PASS | SKIP: $SKIP | FAIL: $FAIL | TOTAL: $((PASS+SKIP+FAIL))"
  if [ ${#ERRORS[@]} -gt 0 ]; then
    echo ""
    echo "FAILURES:"
    for e in "${ERRORS[@]}"; do echo "  $e"; done
  fi
} > "$RESULTS_FILE"

if [ "$FAIL" -gt 0 ]; then exit 1; else exit 0; fi

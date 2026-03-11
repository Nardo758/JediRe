#!/bin/bash
# Phase 4: Market Intel, Deal Sub-routes, Modules & Wiring Smoke Test
set -o pipefail

BASE="http://localhost:4000"
DEAL="e044db04-439b-4442-82df-b36a840f2fd8"
USER_ID="6253ba3f-d40d-4597-86ab-270c8397a857"
PASS=0; WARN=0; FAIL=0; TOTAL=0
RESULTS_FILE="${1:-/tmp/smoke-results-phase4.txt}"

JWT=$(cd /home/runner/workspace/backend && node -e "const jwt=require('jsonwebtoken');console.log(jwt.sign({userId:'$USER_ID',email:'demo@jedire.com',role:'investor'},process.env.JWT_SECRET||'your-secret-key-change-this',{expiresIn:'1h',algorithm:'HS256',issuer:'jedire-api',audience:'jedire-client'}))")

t() {
  local method=$1 url=$2 label=$3 data=$4 auth=${5:-jwt}
  TOTAL=$((TOTAL+1))
  local auth_header="Authorization: Bearer $JWT"
  if [ "$auth" = "none" ]; then auth_header="X-No-Auth: true"; fi
  local body="$data"
  if [ -z "$body" ]; then body='{}'; fi

  if [ "$method" = "POST" ] || [ "$method" = "PUT" ] || [ "$method" = "PATCH" ]; then
    local code=$(curl -s -o /tmp/resp.json -w '%{http_code}' -X "$method" -H "$auth_header" -H "Content-Type: application/json" "$BASE$url" -d "$body" --max-time 20 2>/dev/null)
  elif [ "$method" = "DELETE" ]; then
    local code=$(curl -s -o /tmp/resp.json -w '%{http_code}' -X DELETE -H "$auth_header" "$BASE$url" --max-time 20 2>/dev/null)
  else
    local code=$(curl -s -o /tmp/resp.json -w '%{http_code}' -H "$auth_header" "$BASE$url" --max-time 30 2>/dev/null)
  fi

  if [ -z "$code" ]; then code=0; fi
  local status="FAIL"
  if [[ "$code" =~ ^2 ]]; then status="PASS"; PASS=$((PASS+1));
  elif [[ "$code" =~ ^(4|3) ]]; then status="WARN"; WARN=$((WARN+1));
  else FAIL=$((FAIL+1)); fi
  local err=""
  if [ "$status" != "PASS" ]; then
    err=$(head -c 120 /tmp/resp.json 2>/dev/null | tr '\n' ' ')
  fi
  printf "%-4s | %-6s | %3s | %-60s | %s\n" "$status" "$method" "$code" "$label" "$err"
  printf "%-4s | %-6s | %3s | %-60s | %s\n" "$status" "$method" "$code" "$label" "$err" >> "$RESULTS_FILE"
}

> "$RESULTS_FILE"
echo "=== PHASE 4: MARKET INTEL, DEAL SUB-ROUTES, MODULES & WIRING ==="

echo "--- deal-comp-sets (mount: /api/v1/deals) ---"
t GET "/api/v1/deals/$DEAL/comp-set" "deal-comp-sets: GET comp-set"
t POST "/api/v1/deals/$DEAL/comp-set/discover" "deal-comp-sets: POST discover" '{"radius": 5}'
t POST "/api/v1/deals/$DEAL/comp-set" "deal-comp-sets: POST add" '{"propertyId": "00000000-0000-0000-0000-000000000001", "compType": "sale"}'

echo "--- deal-context (mount: /api/v1/deals) ---"
t GET "/api/v1/deals/$DEAL/context" "deal-context: GET context"
t PATCH "/api/v1/deals/$DEAL/context" "deal-context: PATCH context" '{"notes": "smoke test"}'
t POST "/api/v1/deals/$DEAL/recompute" "deal-context: POST recompute"

echo "--- deal-market-intelligence (mount: /api/v1/deals) ---"
t GET "/api/v1/deals/$DEAL/market-intelligence" "deal-market-intel: GET"

echo "--- deal-photos (mount: /api/v1/deals) ---"
t GET "/api/v1/deals/$DEAL/photos" "deal-photos: GET all"

echo "--- deal-validation (mount: /api/v1/deals) ---"
t POST "/api/v1/deals/$DEAL/validate" "deal-validation: POST validate"
t GET "/api/v1/deals/$DEAL/validation-status" "deal-validation: GET status"
t POST "/api/v1/deals/validate-all" "deal-validation: POST validate-all"

echo "--- deal-actuals (mount: /api/v1/deals) ---"
t GET "/api/v1/deals/$DEAL/actuals" "deal-actuals: GET actuals"
t POST "/api/v1/deals/$DEAL/actuals" "deal-actuals: POST actuals" '{"period": "2025-01", "noi": 50000, "revenue": 100000}'
t GET "/api/v1/deals/$DEAL/traffic" "deal-actuals: GET traffic"
t POST "/api/v1/deals/$DEAL/traffic" "deal-actuals: POST traffic" '{"date": "2025-01-15", "visits": 25}'
t GET "/api/v1/deals/$DEAL/flywheel-feeds" "deal-actuals: GET flywheel-feeds"
t POST "/api/v1/deals/$DEAL/flywheel-feeds" "deal-actuals: POST flywheel-feeds" '{"source": "test"}'
t GET "/api/v1/deals/$DEAL/actuals-summary" "deal-actuals: GET summary"

echo "--- deal-assumptions (mount: /api/v1/deals) ---"
t GET "/api/v1/deals/$DEAL/assumptions" "deal-assumptions: GET assumptions"
t PUT "/api/v1/deals/$DEAL/assumptions" "deal-assumptions: PUT assumptions" '{"rentGrowth": 0.03, "expenseGrowth": 0.02}'
t POST "/api/v1/deals/$DEAL/compute-returns" "deal-assumptions: POST compute-returns" '{"holdPeriod": 7, "exitCap": 0.055}'
t PUT "/api/v1/deals/$DEAL/site-data" "deal-assumptions: PUT site-data" '{"lotSize": 25000, "zoning": "R-4"}'
t GET "/api/v1/deals/$DEAL/full-context" "deal-assumptions: GET full-context"

echo "--- geographic-context (mount: /api/v1/deals and /api/v1) ---"
t POST "/api/v1/deals/$DEAL/geographic-context" "geo-context: POST" '{"lat": 33.7490, "lng": -84.3880}'
t GET "/api/v1/deals/$DEAL/geographic-context" "geo-context: GET"
t PUT "/api/v1/deals/$DEAL/geographic-context" "geo-context: PUT" '{"lat": 33.7490, "lng": -84.3880}'
t GET "/api/v1/submarkets/lookup?lat=33.7490&lng=-84.3880" "geo-context: GET submarkets lookup"
t GET "/api/v1/msas/lookup?lat=33.7490&lng=-84.3880" "geo-context: GET msas lookup"

echo "--- grid (mount: /api/v1/grid) ---"
t GET "/api/v1/grid/pipeline" "grid: GET pipeline"
t GET "/api/v1/grid/owned" "grid: GET owned"
t GET "/api/v1/grid/owned/$DEAL/report" "grid: GET owned report"
t POST "/api/v1/grid/export" "grid: POST export" '{"format": "csv"}'

echo "--- rankings (mount: /api/v1/rankings) ---"
t GET "/api/v1/rankings/atlanta" "rankings: GET by market"
t GET "/api/v1/rankings/performance/atlanta" "rankings: GET performance"
t GET "/api/v1/rankings/owned/atlanta" "rankings: GET owned"
t GET "/api/v1/rankings/pipeline/atlanta" "rankings: GET pipeline"

echo "--- portfolio (mount: /api/v1/portfolio) ---"
t GET "/api/v1/portfolio/$DEAL/summary" "portfolio: GET summary"
t GET "/api/v1/portfolio/$DEAL/financials" "portfolio: GET financials"
t GET "/api/v1/portfolio/$DEAL/leasing" "portfolio: GET leasing"
t GET "/api/v1/portfolio/$DEAL/traffic" "portfolio: GET traffic"

echo "--- proforma (mount: /api/v1/deals) ---"
t GET "/api/v1/deals/$DEAL/proforma" "proforma: GET"
t POST "/api/v1/deals/$DEAL/proforma/initialize" "proforma: POST initialize"
t GET "/api/v1/deals/$DEAL/proforma/history" "proforma: GET history"
t GET "/api/v1/deals/$DEAL/proforma/adjustments" "proforma: GET adjustments"
t POST "/api/v1/deals/$DEAL/proforma/recalculate" "proforma: POST recalculate"
t PATCH "/api/v1/deals/$DEAL/proforma/override" "proforma: PATCH override" '{"assumptionType": "rentGrowth", "value": 0.04}'
t GET "/api/v1/deals/$DEAL/proforma/comparison" "proforma: GET comparison"
t GET "/api/v1/deals/$DEAL/proforma/export" "proforma: GET export"

echo "--- proforma-generator (mount: /api/v1/properties) ---"
t GET "/api/v1/properties/templates" "proforma-gen: GET templates"
t GET "/api/v1/properties/proforma/snapshots/00000000-0000-0000-0000-000000000099" "proforma-gen: GET snapshot"

echo "--- map-configs (mount: /api/v1/map-configs) ---"
t GET "/api/v1/map-configs" "map-configs: GET all"
t GET "/api/v1/map-configs/default" "map-configs: GET default"
t POST "/api/v1/map-configs" "map-configs: POST create" '{"name": "smoke-test-config", "config": {"zoom": 12}}'

echo "--- module-libraries (mount: /api/v1/module-libraries) ---"
t GET "/api/v1/module-libraries/zoning/files" "module-libs: GET files"
t GET "/api/v1/module-libraries/zoning/learning-status" "module-libs: GET learning-status"

echo "--- modules (mount: /api/v1/modules) ---"
t GET "/api/v1/modules" "modules: GET all"
t GET "/api/v1/modules/enabled" "modules: GET enabled"

echo "--- site-intelligence (mount: /api/v1) ---"
t GET "/api/v1/deals/$DEAL/site-intelligence" "site-intel: GET"
t POST "/api/v1/deals/$DEAL/site-intelligence" "site-intel: POST" '{"analyze": true}'

echo "--- development-scenarios (mount: /api/v1) ---"
t GET "/api/v1/deals/$DEAL/scenarios/hbu" "dev-scenarios: GET HBU"
t GET "/api/v1/deals/$DEAL/regulatory-risk-analysis" "dev-scenarios: GET regulatory risk"
# timeline-intelligence is an AI-powered endpoint requiring external API call — skip in smoke test
# t GET "/api/v1/deals/$DEAL/timeline-intelligence" "dev-scenarios: GET timeline intel"
echo "WARN | GET    | SKIP | dev-scenarios: GET timeline intel (AI endpoint)          |"
WARN=$((WARN+1)); TOTAL=$((TOTAL+1))
t GET "/api/v1/deals/$DEAL/scenarios/recommendations" "dev-scenarios: GET recommendations"
t GET "/api/v1/deals/$DEAL/scenarios" "dev-scenarios: GET all"
t GET "/api/v1/deals/$DEAL/scenarios/lookup-district" "dev-scenarios: GET lookup-district"
t POST "/api/v1/deals/$DEAL/scenarios" "dev-scenarios: POST create" '{"name": "smoke-test-scenario", "type": "ground-up"}'
t POST "/api/v1/deals/$DEAL/scenarios/deactivate-all" "dev-scenarios: POST deactivate-all"

echo "--- property-boundary (mount: /api/v1) ---"
t GET "/api/v1/deals/$DEAL/boundary" "prop-boundary: GET"
t GET "/api/v1/deals/$DEAL/boundary/export" "prop-boundary: GET export"
t GET "/api/v1/deals/$DEAL/development-capacity" "prop-boundary: GET dev capacity"
t GET "/api/v1/deals/$DEAL/zoning-confirmation" "prop-boundary: GET zoning confirm"
t POST "/api/v1/deals/$DEAL/zoning-confirmation" "prop-boundary: POST zoning confirm" '{"confirmed": true, "zoning_code": "R-4", "municipality": "Atlanta", "confirmed_at": "2025-01-15T12:00:00Z"}'

echo "--- unit-mix-propagation (mount: /api/v1/deals) ---"
t GET "/api/v1/deals/$DEAL/unit-mix/status" "unit-mix-prop: GET status"
t POST "/api/v1/deals/$DEAL/unit-mix/set" "unit-mix-prop: POST set" '{"units": [{"type": "1BR", "count": 100, "sqft": 750, "rent": 1200}]}'
t POST "/api/v1/deals/$DEAL/unit-mix/apply" "unit-mix-prop: POST apply"
t POST "/api/v1/deals/$DEAL/development-path/select" "unit-mix-prop: POST dev-path select" '{"path": "multifamily"}'

echo "--- visibility (mount: /api/v1/visibility) ---"
t POST "/api/v1/visibility/assess" "visibility: POST assess" '{"address": "123 Main St", "lat": 33.749, "lng": -84.388}'
t POST "/api/v1/visibility/preview" "visibility: POST preview" '{"lat": 33.749, "lng": -84.388}'

echo "--- zoning-capacity (mount: /api/v1) ---"
t GET "/api/v1/deals/$DEAL/zoning-capacity" "zoning-cap: GET"
t POST "/api/v1/deals/$DEAL/zoning-capacity" "zoning-cap: POST" '{"analyze": true}'
t GET "/api/v1/zoning-districts/lookup?lat=33.7490&lng=-84.3880" "zoning-cap: GET district lookup"
t GET "/api/v1/zoning-districts/by-code?code=R-4&municipality=Atlanta" "zoning-cap: GET by-code"
t GET "/api/v1/municipalities" "zoning-cap: GET municipalities"
t GET "/api/v1/zoning/lookup?lat=33.7490&lng=-84.3880" "zoning-cap: GET zoning lookup"
t POST "/api/v1/deals/$DEAL/zoning-capacity/auto-fill" "zoning-cap: POST auto-fill"

echo "--- zoning-profile (mount: /api/v1) ---"
t GET "/api/v1/deals/$DEAL/zoning-profile" "zoning-profile: GET"
t POST "/api/v1/deals/$DEAL/zoning-profile/resolve" "zoning-profile: POST resolve"
t PUT "/api/v1/deals/$DEAL/zoning-profile/overrides" "zoning-profile: PUT overrides" '{"maxHeight": 85}'
t POST "/api/v1/deals/$DEAL/zoning-profile/overlays" "zoning-profile: POST overlays" '{"overlayType": "historic"}'

echo "--- zoning-triangulation (mount: /api/v1) ---"
t GET "/api/v1/parcels/stats" "zoning-tri: GET parcels stats"
t GET "/api/v1/parcels/nearby?lat=33.7490&lng=-84.3880&radius=500" "zoning-tri: GET nearby"
t POST "/api/v1/zoning/triangulate" "zoning-tri: POST triangulate" '{"lat": 33.7490, "lng": -84.3880, "address": "123 Main St"}'
t GET "/api/v1/zoning/triangulation/$DEAL" "zoning-tri: GET triangulation"
t POST "/api/v1/zoning/outcome" "zoning-tri: POST outcome" '{"dealId": "'"$DEAL"'", "outcome": "approved"}'

echo "--- context-tracker (mount: /api/v1/context) ---"
t GET "/api/v1/context/deals/$DEAL/notes" "context: GET notes"
t POST "/api/v1/context/deals/$DEAL/notes" "context: POST note" '{"content": "smoke test note", "type": "general"}'
t GET "/api/v1/context/deals/$DEAL/activity" "context: GET activity"
t POST "/api/v1/context/deals/$DEAL/activity" "context: POST activity" '{"type": "view", "description": "smoke test"}'
t GET "/api/v1/context/deals/$DEAL/contacts" "context: GET contacts"
t POST "/api/v1/context/deals/$DEAL/contacts" "context: POST contact" '{"name": "Test Contact", "email": "test@test.com", "role": "broker"}'

echo "--- settings-ai (mount: /api/v1/settings/ai-preferences) ---"
t GET "/api/v1/settings/ai-preferences" "settings-ai: GET"
t PUT "/api/v1/settings/ai-preferences" "settings-ai: PUT" '{"autoAnalysis": true}'

echo "--- module-wiring: registry (mount: /api/v1/module-wiring) ---"
t GET "/api/v1/module-wiring/modules/registry" "mod-wiring: GET registry"
t GET "/api/v1/module-wiring/modules/build-order" "mod-wiring: GET build-order"
t GET "/api/v1/module-wiring/formulas" "mod-wiring: GET formulas"
t GET "/api/v1/module-wiring/data-flow/matrix" "mod-wiring: GET data-flow matrix"
t GET "/api/v1/module-wiring/data-flow/cycles" "mod-wiring: GET data-flow cycles"
t GET "/api/v1/module-wiring/strategy/weights" "mod-wiring: GET strategy weights"

echo "--- module-wiring: orchestrator ---"
t GET "/api/v1/module-wiring/orchestrator/status" "mod-wiring: GET orch status"
t POST "/api/v1/module-wiring/orchestrator/initialize" "mod-wiring: POST orch init"
t GET "/api/v1/module-wiring/orchestrator/pipelines" "mod-wiring: GET orch pipelines"
t GET "/api/v1/module-wiring/orchestrator/validate" "mod-wiring: GET orch validate"
t GET "/api/v1/module-wiring/orchestrator/deal-readiness/$DEAL" "mod-wiring: GET deal-readiness"

echo "--- module-wiring: data-flow ---"
t GET "/api/v1/module-wiring/data-flow/readiness/$DEAL" "mod-wiring: GET data readiness"
t POST "/api/v1/module-wiring/strategy/analyze/$DEAL" "mod-wiring: POST strategy analyze"
t POST "/api/v1/module-wiring/strategy/compare" "mod-wiring: POST strategy compare" '{"dealIds": ["'"$DEAL"'"]}'

echo "--- module-wiring: wire endpoints ---"
t POST "/api/v1/module-wiring/wire/p0/$DEAL" "mod-wiring: POST wire p0"
t POST "/api/v1/module-wiring/wire/jedi-score/$DEAL" "mod-wiring: POST wire jedi-score"
t POST "/api/v1/module-wiring/wire/news/$DEAL" "mod-wiring: POST wire news"
t POST "/api/v1/module-wiring/wire/zoning/$DEAL" "mod-wiring: POST wire zoning"
t POST "/api/v1/module-wiring/wire/risk/$DEAL" "mod-wiring: POST wire risk"
t POST "/api/v1/module-wiring/wire/strategy/$DEAL" "mod-wiring: POST wire strategy"
t POST "/api/v1/module-wiring/wire/p1/$DEAL" "mod-wiring: POST wire p1"
t POST "/api/v1/module-wiring/wire/proforma/sync/$DEAL" "mod-wiring: POST wire proforma sync"
t POST "/api/v1/module-wiring/wire/proforma/init/$DEAL" "mod-wiring: POST wire proforma init"
t POST "/api/v1/module-wiring/wire/scenarios/$DEAL" "mod-wiring: POST wire scenarios"
t POST "/api/v1/module-wiring/wire/competition/$DEAL" "mod-wiring: POST wire competition"
t POST "/api/v1/module-wiring/wire/debt/$DEAL" "mod-wiring: POST wire debt"
t POST "/api/v1/module-wiring/wire/p2/$DEAL" "mod-wiring: POST wire p2"
t POST "/api/v1/module-wiring/wire/traffic/$DEAL" "mod-wiring: POST wire traffic"
t POST "/api/v1/module-wiring/wire/traffic/forecast/$DEAL" "mod-wiring: POST wire traffic forecast"
t POST "/api/v1/module-wiring/wire/exit/$DEAL" "mod-wiring: POST wire exit"
t POST "/api/v1/module-wiring/wire/portfolio" "mod-wiring: POST wire portfolio" '{"dealIds": ["'"$DEAL"'"]}'
t POST "/api/v1/module-wiring/wire/subscriptions/setup" "mod-wiring: POST wire subs setup"
t POST "/api/v1/module-wiring/wire/subscriptions/p1/setup" "mod-wiring: POST wire subs p1"
t POST "/api/v1/module-wiring/wire/subscriptions/p2/setup" "mod-wiring: POST wire subs p2"
t POST "/api/v1/module-wiring/wire/subscriptions/all/setup" "mod-wiring: POST wire subs all"

echo "--- module-wiring: capital-structure wiring ---"
t POST "/api/v1/module-wiring/wiring/capital-structure/stack" "mod-wiring: POST cap-struct stack" '{"dealId": "'"$DEAL"'"}'
t POST "/api/v1/module-wiring/wiring/capital-structure/waterfall" "mod-wiring: POST cap-struct waterfall" '{"dealId": "'"$DEAL"'"}'
t POST "/api/v1/module-wiring/wiring/capital-structure/scenarios" "mod-wiring: POST cap-struct scenarios" '{"dealId": "'"$DEAL"'"}'
t POST "/api/v1/module-wiring/wiring/capital-structure/rate-analysis" "mod-wiring: POST cap-struct rates" '{"dealId": "'"$DEAL"'"}'
t POST "/api/v1/module-wiring/wiring/capital-structure/pipeline" "mod-wiring: POST cap-struct pipeline" '{"dealId": "'"$DEAL"'"}'
t POST "/api/v1/module-wiring/wiring/capital-structure/subscriptions" "mod-wiring: POST cap-struct subs" '{"dealId": "'"$DEAL"'"}'

echo ""
echo "Total: $TOTAL | PASS: $PASS | WARN: $WARN | FAIL: $FAIL"

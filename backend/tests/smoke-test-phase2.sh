#!/bin/bash
# Phase 2: Zoning & Property + Supply/Demand + Market Intel Smoke Test
set -o pipefail

BASE="http://localhost:4000"
DEAL="e044db04-439b-4442-82df-b36a840f2fd8"
USER_ID="6253ba3f-d40d-4597-86ab-270c8397a857"
PASS=0; WARN=0; FAIL=0; TOTAL=0
RESULTS_FILE="${1:-/tmp/smoke-results-phase2.txt}"

JWT=$(cd /home/runner/workspace/backend && node -e "const jwt=require('jsonwebtoken');console.log(jwt.sign({userId:'$USER_ID',email:'demo@jedire.com',role:'investor'},process.env.JWT_SECRET||'your-secret-key-change-this',{expiresIn:'1h',algorithm:'HS256',issuer:'jedire-api',audience:'jedire-client'}))")

t() {
  local method=$1 url=$2 label=$3 data=$4 auth=${5:-jwt}
  TOTAL=$((TOTAL+1))
  local auth_header="Authorization: Bearer $JWT"
  if [ "$auth" = "none" ]; then auth_header="X-No-Auth: true"; fi
  local body="$data"
  if [ -z "$body" ]; then body='{}'; fi

  if [ "$method" = "POST" ] || [ "$method" = "PUT" ] || [ "$method" = "PATCH" ]; then
    local code=$(curl -s -o /tmp/resp.json -w '%{http_code}' -X "$method" -H "$auth_header" -H "Content-Type: application/json" "$BASE$url" -d "$body" --max-time 10 2>/dev/null)
  elif [ "$method" = "DELETE" ]; then
    local code=$(curl -s -o /tmp/resp.json -w '%{http_code}' -X DELETE -H "$auth_header" "$BASE$url" --max-time 10 2>/dev/null)
  else
    local code=$(curl -s -o /tmp/resp.json -w '%{http_code}' -H "$auth_header" "$BASE$url" --max-time 10 2>/dev/null)
  fi

  if [ -z "$code" ]; then code=0; fi

  local status="PASS"
  if [ "$code" -ge 500 ] 2>/dev/null; then status="FAIL"; FAIL=$((FAIL+1))
  elif [ "$code" -ge 400 ] 2>/dev/null; then status="WARN"; WARN=$((WARN+1))
  else PASS=$((PASS+1))
  fi

  local err=""
  if [ "$status" != "PASS" ]; then
    err=$(head -c 120 /tmp/resp.json 2>/dev/null | tr '\n' ' ')
  fi
  printf "%-4s | %-6s | %3s | %-60s | %s\n" "$status" "$method" "$code" "$label" "$err"
  printf "%-4s | %-6s | %3s | %-60s | %s\n" "$status" "$method" "$code" "$label" "$err" >> "$RESULTS_FILE"
}

> "$RESULTS_FILE"
echo "=== PHASE 2: ZONING & PROPERTY + SUPPLY/DEMAND + MARKET INTEL ==="

echo "--- zoning-triangulation (mount: /api/v1) ---"
t GET "/api/v1/parcels/stats" "zoning-tri: parcels/stats"
t GET "/api/v1/parcels/nearby?lat=33.75&lng=-84.39&radius=1" "zoning-tri: parcels/nearby"
t GET "/api/v1/zoning/calibration" "zoning-tri: zoning/calibration"
t GET "/api/v1/zoning/triangulation/$DEAL" "zoning-tri: triangulation/:dealId"
t GET "/api/v1/zoning/chain/$DEAL" "zoning-tri: chain/:dealId"
t GET "/api/v1/zoning/recommendations/$DEAL" "zoning-tri: recommendations/:dealId"
t GET "/api/v1/deals/$DEAL/nearby-entitlements" "zoning-tri: nearby-entitlements"
t GET "/api/v1/deals/$DEAL/properties" "zoning-tri: deals/properties"
t POST "/api/v1/zoning/triangulate" "zoning-tri: triangulate" '{"dealId":"'"$DEAL"'","address":"123 Test St","municipality":"Atlanta"}'

echo "--- zoning-capacity (mount: /api/v1) ---"
t GET "/api/v1/deals/$DEAL/zoning-capacity" "zoning-cap: GET"
t POST "/api/v1/deals/$DEAL/zoning-capacity" "zoning-cap: POST" '{"districtCode":"R-5"}'
t GET "/api/v1/zoning-districts/lookup?municipality=Atlanta" "zoning-cap: districts/lookup"
t GET "/api/v1/zoning-districts/by-code?code=R-5&municipality=Atlanta" "zoning-cap: districts/by-code"

echo "--- zoning-profile (mount: /api/v1) ---"
t GET "/api/v1/deals/$DEAL/zoning-profile" "zoning-prof: GET"
t POST "/api/v1/deals/$DEAL/zoning-profile/resolve" "zoning-prof: resolve" '{}'
t PUT "/api/v1/deals/$DEAL/zoning-profile/overrides" "zoning-prof: overrides" '{"max_height":100}'
t POST "/api/v1/deals/$DEAL/zoning-profile/overlays" "zoning-prof: overlays" '{"overlay":"historic"}'

echo "--- zoning-intelligence (mount: /api/v1/zoning-intelligence) ---"
t GET "/api/v1/zoning-intelligence" "zoning-intel: GET /"
t POST "/api/v1/zoning-intelligence/query" "zoning-intel: query" '{"question":"what is R-5 zoning?"}'
t POST "/api/v1/zoning-intelligence/analyze" "zoning-intel: analyze" '{"dealId":"'"$DEAL"'"}'
t GET "/api/v1/zoning-intelligence/resolve/$DEAL" "zoning-intel: resolve/:dealId"
t GET "/api/v1/zoning-intelligence/constraints/$DEAL" "zoning-intel: constraints/:dealId"
t GET "/api/v1/zoning-intelligence/analyses" "zoning-intel: analyses"
t POST "/api/v1/zoning-intelligence/use-check" "zoning-intel: use-check" '{"districtCode":"R-5","proposedUse":"multifamily"}'
t POST "/api/v1/zoning-intelligence/parking-calc" "zoning-intel: parking-calc" '{"units":200,"parkingRatio":1.5}'
t GET "/api/v1/zoning-intelligence/maturity/Atlanta" "zoning-intel: maturity/:municipality"

echo "--- zoning-learning (mount: /api/v1/zoning-learning) ---"
t GET "/api/v1/zoning-learning/corrections" "zoning-learn: corrections"
t GET "/api/v1/zoning-learning/precedents/search?municipality=Atlanta" "zoning-learn: precedents/search"
t GET "/api/v1/zoning-learning/precedents/patterns" "zoning-learn: precedents/patterns"
t GET "/api/v1/zoning-learning/calibration/Atlanta" "zoning-learn: calibration/:municipality"
t GET "/api/v1/zoning-learning/confidence/Atlanta" "zoning-learn: confidence/:municipality"
t GET "/api/v1/zoning-learning/maturity" "zoning-learn: maturity"
t GET "/api/v1/zoning-learning/maturity/Atlanta" "zoning-learn: maturity/:municipality"
t GET "/api/v1/zoning-learning/credibility/$USER_ID" "zoning-learn: credibility/:userId"

echo "--- zoning-verification (mount: /api/v1/zoning-verification) ---"
t POST "/api/v1/zoning-verification/verify" "zoning-verify: verify" '{"dealId":"'"$DEAL"'","districtCode":"R-5"}'
t GET "/api/v1/zoning-verification/verify/deal/$DEAL" "zoning-verify: deal/:dealId"

echo "--- inline-zoning-analyze (mount: /api/v1) ---"
t POST "/api/v1/geocode" "zoning-analyze: geocode" '{"address":"100 Peachtree St NW, Atlanta, GA"}'
t POST "/api/v1/zoning/lookup" "zoning-analyze: lookup" '{"lat":33.75,"lng":-84.39}'
t GET "/api/v1/zoning/districts/Atlanta" "zoning-analyze: districts/:municipality"
t POST "/api/v1/analyze" "zoning-analyze: analyze" '{"address":"100 Peachtree St","lat":33.75,"lng":-84.39}'

echo "--- building-envelope (mount: /api/v1) ---"
t POST "/api/v1/deals/$DEAL/building-envelope" "building-env: POST" '{"units":200}'
t GET "/api/v1/property-type-configs" "building-env: property-type-configs"

echo "--- development-scenarios (mount: /api/v1) ---"
t GET "/api/v1/deals/$DEAL/scenarios/hbu" "dev-scenarios: hbu"
t GET "/api/v1/deals/$DEAL/regulatory-risk-analysis" "dev-scenarios: regulatory-risk"

echo "--- property-boundary (mount: /api/v1) ---"
t GET "/api/v1/deals/$DEAL/boundary" "prop-boundary: GET"
t GET "/api/v1/deals/$DEAL/boundary/export" "prop-boundary: export"
t GET "/api/v1/deals/$DEAL/development-capacity" "prop-boundary: dev-capacity"

echo "--- property-types (mount: /api/v1/property-types) ---"
t GET "/api/v1/property-types" "prop-types: GET /"
t GET "/api/v1/property-types/multifamily" "prop-types: /:typeKey"

echo "--- property-type-strategies (mount: /api/v1/property-type-strategies) ---"
t GET "/api/v1/property-type-strategies" "prop-type-strat: GET /"
t GET "/api/v1/property-type-strategies/multifamily" "prop-type-strat: /:typeKey"

echo "--- property-proxy (mount: /api/v1) ---"
t GET "/api/v1/properties/health" "prop-proxy: health"
t GET "/api/v1/properties/api-health" "prop-proxy: api-health"

echo "--- property-metrics (mount: /api/v1/property-metrics) ---"
t GET "/api/v1/property-metrics/neighborhoods/benchmarks" "prop-metrics: benchmarks"
t GET "/api/v1/property-metrics/submarkets/comparison" "prop-metrics: submarkets"
t GET "/api/v1/property-metrics/owners/top" "prop-metrics: owners/top"
t GET "/api/v1/property-metrics/owners/search?q=test" "prop-metrics: owners/search"
t GET "/api/v1/property-metrics/rent-comps" "prop-metrics: rent-comps"
t GET "/api/v1/property-metrics/rent-comps/summary" "prop-metrics: rent-comps/summary"

echo "--- property-scoring (mount: /api/v1/property-scoring) ---"
t GET "/api/v1/property-scoring/seller-propensity" "prop-scoring: seller-propensity"
t GET "/api/v1/property-scoring/value-add" "prop-scoring: value-add"
t GET "/api/v1/property-scoring/hidden-gems" "prop-scoring: hidden-gems"
t GET "/api/v1/property-scoring/cap-rates" "prop-scoring: cap-rates"
t GET "/api/v1/property-scoring/tax-burden" "prop-scoring: tax-burden"
t GET "/api/v1/property-scoring/supply-intelligence" "prop-scoring: supply-intelligence"
t GET "/api/v1/property-scoring/design-inputs" "prop-scoring: design-inputs"

echo "--- property-analytics (mount: /api/v1/property-analytics) ---"
t GET "/api/v1/property-analytics/connection/test-id" "prop-analytics: connection/:id"

echo "--- site-intelligence (mount: /api/v1) ---"
t GET "/api/v1/deals/$DEAL/site-intelligence" "site-intel: GET"
t POST "/api/v1/deals/$DEAL/site-intelligence" "site-intel: POST" '{}'

echo "--- geographic-context (mount: /api/v1 + /api/v1/deals) ---"
t GET "/api/v1/$DEAL/geographic-context" "geo-context: GET /:id"
t GET "/api/v1/deals/$DEAL/geographic-context" "geo-context: deals GET"
t GET "/api/v1/submarkets/lookup?lat=33.75&lng=-84.39" "geo-context: submarkets/lookup"
t GET "/api/v1/msas/lookup?lat=33.75&lng=-84.39" "geo-context: msas/lookup"

echo "--- entitlement (mount: /api/v1/entitlements) ---"
t GET "/api/v1/entitlements" "entitlements: GET /"
t GET "/api/v1/entitlements/kanban" "entitlements: kanban"
t GET "/api/v1/entitlements/deal/$DEAL" "entitlements: deal/:dealId"

echo "--- regulatory-alert (mount: /api/v1/regulatory-alerts) ---"
t GET "/api/v1/regulatory-alerts" "reg-alerts: GET /"
t GET "/api/v1/regulatory-alerts/categories" "reg-alerts: categories"
t GET "/api/v1/regulatory-alerts/strategy-matrix" "reg-alerts: strategy-matrix"
t GET "/api/v1/regulatory-alerts/municipality/Atlanta" "reg-alerts: municipality/:name"

echo "--- municode (mount: /api/v1/municode) ---"
t GET "/api/v1/municode/resolve?municipality=Atlanta&state=GA" "municode: resolve"
t GET "/api/v1/municode/sections/atlanta-ga" "municode: sections/:id"
t GET "/api/v1/municode/chapter/atlanta-ga" "municode: chapter/:id"

echo "--- design-references (mount: /api/v1/design-references) ---"
t GET "/api/v1/design-references/$DEAL" "design-refs: GET /:dealId"

echo "--- custom-strategies (mount: /api/v1/custom-strategies) ---"
t GET "/api/v1/custom-strategies" "custom-strat: GET /"

echo "--- data-upload (mount: /api/v1/properties) ---"
t GET "/api/v1/properties/$DEAL/actuals" "data-upload: actuals"
t GET "/api/v1/properties/$DEAL/uploads" "data-upload: uploads"

echo "--- upload-templates (mount: /api/v1/upload-templates) ---"
t GET "/api/v1/upload-templates" "upload-templates: GET /"

echo "--- upload (mount: /api/v1/uploads) ---"
t GET "/api/v1/uploads/templates" "uploads: templates"

echo "--- comp-query (mount: /api/v1/comps) ---"
t POST "/api/v1/comps/search" "comps: search" '{"lat":33.75,"lng":-84.39,"radius":5}'
t POST "/api/v1/comps/search/v2" "comps: search/v2" '{"lat":33.75,"lng":-84.39}'
t GET "/api/v1/comps/summary" "comps: summary"

echo "--- supply.routes (mount: /api/v1) ---"
t GET "/api/v1/deals/$DEAL/supply" "supply: deals/:id/supply"
t GET "/api/v1/supply/events" "supply: events"

echo "--- demand.routes (mount: /api/v1) ---"
t GET "/api/v1/deals/$DEAL/demand" "demand: deals/:id/demand"
t GET "/api/v1/demand/events" "demand: events"

echo "--- trade-areas (mount: /api/v1/trade-areas) ---"
t GET "/api/v1/trade-areas" "trade-areas: GET /"
t GET "/api/v1/trade-areas/library" "trade-areas: library"

echo "--- isochrone (mount: /api/v1/isochrone) ---"
t POST "/api/v1/isochrone/generate" "isochrone: generate" '{"lat":33.75,"lng":-84.39,"mode":"driving","minutes":15}'

echo "--- traffic-ai (mount: /api/v1/traffic-ai) ---"
t POST "/api/v1/traffic-ai/generate" "traffic-ai: generate" '{"dealId":"'"$DEAL"'"}'

echo "--- traffic-data (mount: /api/v1/traffic-data) ---"
t GET "/api/v1/traffic-data/adt/stations" "traffic-data: adt/stations"
t GET "/api/v1/traffic-data/adt/nearest?lat=33.75&lng=-84.39" "traffic-data: adt/nearest"
t GET "/api/v1/traffic-data/realtime" "traffic-data: realtime"

echo "--- traffic-comps (mount: /api/v1/traffic-comps) ---"
t GET "/api/v1/traffic-comps/$DEAL" "traffic-comps: /:dealId"
t GET "/api/v1/traffic-comps/$DEAL/averages" "traffic-comps: /:dealId/averages"
t GET "/api/v1/traffic-comps/$DEAL/proxy-candidates" "traffic-comps: proxy-candidates"

echo "--- trafficPrediction (mount: /api/v1/traffic) ---"
t GET "/api/v1/traffic/model/performance" "traffic-pred: model/performance"
t GET "/api/v1/traffic/calibration/active" "traffic-pred: calibration/active"
t GET "/api/v1/traffic/validation/errors" "traffic-pred: validation/errors"

echo "--- leasing-traffic (mount: /api/v1/leasing-traffic) ---"
t GET "/api/v1/leasing-traffic/predict/$DEAL" "leasing-traffic: predict/:id"
t GET "/api/v1/leasing-traffic/forecast/$DEAL" "leasing-traffic: forecast/:id"
t GET "/api/v1/leasing-traffic/optimize-rent/$DEAL" "leasing-traffic: optimize/:id"
t GET "/api/v1/leasing-traffic/historical/$DEAL" "leasing-traffic: historical/:id"

echo "--- correlation (mount: /api/v1/correlations) ---"
t GET "/api/v1/correlations/report" "correlation: report"
t GET "/api/v1/correlations/summary" "correlation: summary"

echo "--- market-intelligence (mount: /api/v1/markets) ---"
t GET "/api/v1/markets/preferences" "market-intel: preferences"
t GET "/api/v1/markets/overview" "market-intel: overview"
t GET "/api/v1/markets/compare" "market-intel: compare"
t GET "/api/v1/markets/properties" "market-intel: properties"
t GET "/api/v1/markets/atlanta/summary" "market-intel: /:id/summary"
t GET "/api/v1/markets/atlanta/alerts" "market-intel: /:id/alerts"

echo "--- market-intelligence-enhanced (mount: /api/v1/markets) ---"
t GET "/api/v1/markets/atlanta/submarkets/detailed" "market-enh: submarkets/detailed"
t GET "/api/v1/markets/compare-data" "market-enh: compare-data"
t GET "/api/v1/markets/atlanta/owners" "market-enh: /:id/owners"

echo "--- marketResearch (mount: /api/v1/market-research) ---"
t GET "/api/v1/market-research/report/$DEAL" "market-res: report/:dealId"
t GET "/api/v1/market-research/metrics/$DEAL" "market-res: metrics/:dealId"
t GET "/api/v1/market-research/intelligence/$DEAL" "market-res: intelligence/:dealId"
t GET "/api/v1/market-research/sources/$DEAL" "market-res: sources/:dealId"
t GET "/api/v1/market-research/analysis-input/$DEAL" "market-res: analysis-input/:dealId"
t GET "/api/v1/market-research/status/$DEAL" "market-res: status/:dealId"

echo "--- deal-market-intelligence (mount: /api/v1/deals) ---"
t GET "/api/v1/deals/$DEAL/market-intelligence" "deal-mkt-intel: /:dealId"

echo "--- news (mount: /api/v1/news) ---"
t GET "/api/v1/news/events" "news: events"
t GET "/api/v1/news/alerts" "news: alerts"
t GET "/api/v1/news/dashboard" "news: dashboard"
t GET "/api/v1/news/network" "news: network"

echo "--- intelligence (mount: /api/v1/intelligence) ---"
t GET "/api/v1/intelligence/stats" "intelligence: stats"
t GET "/api/v1/intelligence/documents/pending" "intelligence: docs/pending"
t GET "/api/v1/intelligence/documents/flagged" "intelligence: docs/flagged"
t GET "/api/v1/intelligence/patterns" "intelligence: patterns"
t GET "/api/v1/intelligence/user/stats" "intelligence: user/stats"
t GET "/api/v1/intelligence/user/preferences" "intelligence: user/preferences"

echo ""
echo "=== PHASE 2 SUMMARY ==="
echo "Total: $TOTAL | PASS: $PASS | WARN: $WARN | FAIL: $FAIL"
if [ $FAIL -gt 0 ]; then
  echo ""
  echo "=== FAILURES (500+) ==="
  grep "^FAIL" "$RESULTS_FILE"
fi

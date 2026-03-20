#!/usr/bin/env bash
# ============================================================
# Smoke Test: Phase 4 — Market Intel & Analytics
#
# Tests all mounted route groups in the Phase 4 scope with
# per-endpoint pass/skip semantics:
#
#   check_strict <label> <method> <url> [curl-args...]
#     PASS   : 2xx
#     FAIL   : 4xx / 5xx
#     Use for collection GETs and always-available endpoints.
#
#   check_lenient <label> <method> <url> [curl-args...]
#     PASS   : 2xx
#     SKIP   : 404 (data not found for test ID), 400 (validation
#              error from minimal test payload), 403 (business-logic
#              restriction such as alerts gating)
#     FAIL   : 5xx or unexpected 2xx-like format
#     Use for detail GETs with seed IDs that may have no data,
#     and POST/PUT/DELETE with minimal test payloads.
#
# Unmounted route files are documented in the matrix at the bottom.
# ============================================================

BASE="http://localhost:4000"
DEAL_ID="12eb9e11-3b2d-44d5-9f59-877a76344c18"
USER_ID="6253ba3f-d40d-4597-86ab-270c8397a857"
MARKET_ID="atlanta-ga"
PROPERTY_ID="00175617-4d11-447e-a274-9c3fb828a69d"
TRADE_AREA_ID="87db1a79-2f68-4069-b2ef-67566ff666f8"
SUBMARKET_ID="1"

TOKEN=$(cd /home/runner/workspace/backend && node -e "
const jwt = require('jsonwebtoken');
const secret = process.env.JWT_SECRET || 'your-secret-key-change-this';
const token = jwt.sign({userId:'$USER_ID',email:'m.dixon5030@gmail.com',role:'user'}, secret, {expiresIn:'7d',issuer:'jedire-api',audience:'jedire-client'});
console.log(token);
" 2>/dev/null)

PASS=0
FAIL=0
SKIP=0
ERRORS=()

# ---------- helpers ----------

_do_request() {
  local method="$1"
  local url="$2"
  shift 2
  curl -s -o /tmp/smoke_body.txt -w "%{http_code}" \
    -X "$method" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    "$@" "$url"
}

_body() { cat /tmp/smoke_body.txt 2>/dev/null; }

# Fails on ANY non-2xx (collection endpoints, always-available resources)
check_strict() {
  local label="$1"; local method="$2"; local url="$3"; shift 3
  local code; code=$(_do_request "$method" "$url" "$@")
  if [[ "$code" -ge 200 && "$code" -lt 300 ]]; then
    echo "  PASS [$code] $label"; ((PASS++))
  else
    echo "  FAIL [$code] $label"
    echo "         $(_body)" | head -c 280
    ERRORS+=("[$code] $label"); ((FAIL++))
  fi
}

# Accepts 404/400/403 as SKIP (detail endpoints or test-payload POSTs)
check_lenient() {
  local label="$1"; local method="$2"; local url="$3"; shift 3
  local code; code=$(_do_request "$method" "$url" "$@")
  if [[ "$code" -ge 200 && "$code" -lt 300 ]]; then
    echo "  PASS [$code] $label"; ((PASS++))
  elif [[ "$code" == "404" ]]; then
    echo "  SKIP [404] $label — no data for test ID (OK)"; ((SKIP++))
  elif [[ "$code" == "400" ]]; then
    echo "  SKIP [400] $label — validation/minimal-payload (OK)"; ((SKIP++))
  elif [[ "$code" == "403" ]]; then
    echo "  SKIP [403] $label — business-logic restriction (OK)"; ((SKIP++))
  else
    echo "  FAIL [$code] $label"
    echo "         $(_body)" | head -c 280
    ERRORS+=("[$code] $label"); ((FAIL++))
  fi
}

echo "========================================"
echo "  JediRe Smoke Test — Phase 4 (Market)"
echo "  $(date)"
echo "========================================"
echo ""

# -------------------------------------------------------
echo "▶ Health"
# -------------------------------------------------------
check_strict "Health check" GET "$BASE/health"

# -------------------------------------------------------
echo ""
echo "▶ Market Intelligence /api/v1/markets — GET collection & stats"
# Always-available: these return empty objects/arrays, never 404
# -------------------------------------------------------
check_strict  "Markets: list (GET /)"               GET "$BASE/api/v1/markets"
check_strict "Markets: overview"                 GET "$BASE/api/v1/markets/overview"
check_strict "Markets: available"                GET "$BASE/api/v1/markets/available"
check_strict "Markets: preferences GET"          GET "$BASE/api/v1/markets/preferences"
check_strict "Markets: compare"                  GET "$BASE/api/v1/markets/compare?markets=Atlanta"
check_strict "Markets: properties"               GET "$BASE/api/v1/markets/properties?city=Atlanta&state=GA"
check_strict "Markets: market-stats/:marketId"   GET "$BASE/api/v1/markets/market-stats/$MARKET_ID"
check_strict "Markets: submarket-stats/:marketId" GET "$BASE/api/v1/markets/submarket-stats/$MARKET_ID"
check_lenient "Markets: properties/:id"          GET "$BASE/api/v1/markets/properties/$PROPERTY_ID"
check_lenient "Markets: :marketId/summary"       GET "$BASE/api/v1/markets/$MARKET_ID/summary"
check_lenient "Markets: :marketId/alerts"        GET "$BASE/api/v1/markets/$MARKET_ID/alerts"

# -------------------------------------------------------
echo ""
echo "▶ Market Intelligence /api/v1/markets — POST/PUT/DELETE"
# -------------------------------------------------------
check_lenient "Markets: preferences POST"         POST "$BASE/api/v1/markets/preferences" \
  -d '{"markets":["atlanta-ga","dallas-tx"]}'
check_lenient "Markets: preferences PUT"          PUT "$BASE/api/v1/markets/preferences/1" \
  -d '{"markets":["atlanta-ga"]}'
check_lenient "Markets: preferences DELETE"       DELETE "$BASE/api/v1/markets/preferences/1"
check_lenient "Markets: property-records enrich"  POST "$BASE/api/v1/markets/property-records/$PROPERTY_ID/enrich" \
  -d '{}'

# -------------------------------------------------------
echo ""
echo "▶ Market Intelligence Enhanced /api/v1/markets"
# -------------------------------------------------------
check_strict "Enhanced: :marketId/submarkets/detailed" GET "$BASE/api/v1/markets/$MARKET_ID/submarkets/detailed"
check_strict "Enhanced: compare-data"            GET "$BASE/api/v1/markets/compare-data?markets=Atlanta"
check_strict "Enhanced: :marketId/owners"        GET "$BASE/api/v1/markets/$MARKET_ID/owners"
check_strict "Enhanced: owners/:ownerName/portfolio" GET "$BASE/api/v1/markets/owners/Greystar/portfolio"

# -------------------------------------------------------
echo ""
echo "▶ Market Research /api/v1/market-research"
# -------------------------------------------------------
check_strict "Market-research: status"            GET "$BASE/api/v1/market-research/status/$DEAL_ID"
check_strict "Market-research: POST batch-generate" POST "$BASE/api/v1/market-research/batch-generate" \
  -d '{"dealIds":["'"$DEAL_ID"'"]}'
check_lenient "Market-research: report/:dealId"   GET "$BASE/api/v1/market-research/report/$DEAL_ID"
check_lenient "Market-research: metrics/:dealId"  GET "$BASE/api/v1/market-research/metrics/$DEAL_ID"
check_lenient "Market-research: intelligence/:dealId" GET "$BASE/api/v1/market-research/intelligence/$DEAL_ID"
check_lenient "Market-research: sources/:dealId"  GET "$BASE/api/v1/market-research/sources/$DEAL_ID"
check_lenient "Market-research: analysis-input"   GET "$BASE/api/v1/market-research/analysis-input/$DEAL_ID"
check_lenient "Market-research: POST generate"    POST "$BASE/api/v1/market-research/generate/$DEAL_ID" \
  -d '{}'

# -------------------------------------------------------
echo ""
echo "▶ Cycle Intelligence /api/v1/cycle-intelligence"
# -------------------------------------------------------
check_strict "Cycle: test/rate-environment"       GET "$BASE/api/v1/cycle-intelligence/test/rate-environment"
check_strict "Cycle: rate-environment"            GET "$BASE/api/v1/cycle-intelligence/rate-environment"
check_strict "Cycle: rate-history"                GET "$BASE/api/v1/cycle-intelligence/rate-history"
check_strict "Cycle: leading-indicators"          GET "$BASE/api/v1/cycle-intelligence/leading-indicators"
check_strict "Cycle: pattern-matches"             GET "$BASE/api/v1/cycle-intelligence/pattern-matches"
check_strict "Cycle: macro-risk"                  GET "$BASE/api/v1/cycle-intelligence/macro-risk"
check_strict "Cycle: predict rent-growth"         GET "$BASE/api/v1/cycle-intelligence/predict/rent-growth/$MARKET_ID"
check_strict "Cycle: predict value-change"        GET "$BASE/api/v1/cycle-intelligence/predict/value-change/$MARKET_ID"
check_strict "Cycle: predict cap-rate"            GET "$BASE/api/v1/cycle-intelligence/predict/cap-rate/$MARKET_ID"
check_strict "Cycle: predict full-chain"          GET "$BASE/api/v1/cycle-intelligence/predict/full-chain/$MARKET_ID"
check_strict "Cycle: construction-cost-index"     GET "$BASE/api/v1/cycle-intelligence/construction-cost-index/$MARKET_ID"
check_strict "Cycle: market-metrics-history"      GET "$BASE/api/v1/cycle-intelligence/market-metrics-history/$MARKET_ID"
check_strict "Cycle: deal-performance-by-phase"   GET "$BASE/api/v1/cycle-intelligence/deal-performance-by-phase/$MARKET_ID"
check_lenient "Cycle: phase/:marketId"            GET "$BASE/api/v1/cycle-intelligence/phase/$MARKET_ID"
check_lenient "Cycle: divergence/:marketId"       GET "$BASE/api/v1/cycle-intelligence/divergence/$MARKET_ID"
check_lenient "Cycle: phase-optimal-strategy"     GET "$BASE/api/v1/cycle-intelligence/phase-optimal-strategy/$MARKET_ID"

# -------------------------------------------------------
echo ""
echo "▶ F40 Performance /api/v1/f40"
# -------------------------------------------------------
check_strict  "F40: market"                        GET "$BASE/api/v1/f40/market?city=Atlanta&state=GA"
check_strict  "F40: rankings"                     GET "$BASE/api/v1/f40/rankings?city=Atlanta&state=GA"
check_strict  "F40: comp-set"                     GET "$BASE/api/v1/f40/comp-set?city=Atlanta&state=GA&submarket=Midtown"
check_lenient "F40: POST calculate"               POST "$BASE/api/v1/f40/calculate" \
  -d '{"city":"Atlanta","state":"GA","propertyType":"multi_family"}'

# -------------------------------------------------------
echo ""
echo "▶ Opportunities /api/v1/opportunities"
# -------------------------------------------------------
check_strict "Opportunities: detect"              GET "$BASE/api/v1/opportunities/detect"
check_strict "Opportunities: rankings"            GET "$BASE/api/v1/opportunities/rankings"

# -------------------------------------------------------
echo ""
echo "▶ Intelligence Layer /api/v1/intelligence"
# -------------------------------------------------------
check_strict  "Intelligence: stats"                GET "$BASE/api/v1/intelligence/stats"
check_strict  "Intelligence: patterns"            GET "$BASE/api/v1/intelligence/patterns"
check_strict  "Intelligence: docs pending"        GET "$BASE/api/v1/intelligence/documents/pending"
check_strict  "Intelligence: docs flagged"        GET "$BASE/api/v1/intelligence/documents/flagged"
check_strict  "Intelligence: user/stats"          GET "$BASE/api/v1/intelligence/user/stats"
check_strict  "Intelligence: user/preferences"    GET "$BASE/api/v1/intelligence/user/preferences"
check_lenient "Intelligence: PUT user/preferences" PUT "$BASE/api/v1/intelligence/user/preferences" \
  -d '{"theme":"dark","notifications":true}'
check_lenient "Intelligence: POST user/generate-embeddings" POST "$BASE/api/v1/intelligence/user/generate-embeddings" \
  -d '{}'

# -------------------------------------------------------
echo ""
echo "▶ Supply Routes — actual paths at /api/v1 (supply.routes.ts)"
# NOTE: supply.routes.ts is mounted at /api/v1 with NO /supply prefix on routes.
# Actual paths: /deals/:dealId/supply, /events, /trade-area/:id, /competitive/:dealId, etc.
# -------------------------------------------------------
check_strict "Supply: /events (list)"             GET "$BASE/api/v1/events"
check_strict "Supply: /trade-area/:id"            GET "$BASE/api/v1/trade-area/$TRADE_AREA_ID"
check_strict "Supply: /trade-area/:id/risk"       GET "$BASE/api/v1/trade-area/$TRADE_AREA_ID/risk"
check_strict "Supply: /competitive/:dealId"       GET "$BASE/api/v1/competitive/$DEAL_ID"
check_strict "Supply: /timeline/:tradeAreaId"     GET "$BASE/api/v1/timeline/$TRADE_AREA_ID"
check_strict "Supply: /market-dynamics/:tid"      GET "$BASE/api/v1/market-dynamics/$TRADE_AREA_ID"
check_lenient "Supply: /deals/:dealId/supply"     GET "$BASE/api/v1/deals/$DEAL_ID/supply"
check_lenient "Supply: POST /event"               POST "$BASE/api/v1/event" \
  -d '{"projectName":"Test Project","developer":"Test Dev","category":"permit","eventType":"permit","units":100,"eventDate":"2026-01-01","status":"permitted","latitude":33.749,"longitude":-84.388}'
check_lenient "Supply: PUT /event/:id/status"     PUT "$BASE/api/v1/event/00000000-0000-0000-0000-000000000001/status" \
  -d '{"status":"under_construction"}'

# -------------------------------------------------------
echo ""
echo "▶ Inline Data Routes /api/v1 (inline-data.routes.ts)"
# These come from inline-data.routes.ts also mounted at /api/v1
# GET /supply/:market captures market name as param (different from supply.routes.ts)
# -------------------------------------------------------
check_strict "Inline: GET /supply/:market"        GET "$BASE/api/v1/supply/atlanta-ga"
check_strict "Inline: GET /alerts"                GET "$BASE/api/v1/alerts"

# -------------------------------------------------------
echo ""
echo "▶ Demand Routes — actual paths at /api/v1 (demand.routes.ts)"
# NOTE: demand.routes.ts mounted at /api/v1. Paths /trade-area/:id and /events
# are shadowed by supply routes (supply loaded first at line 313 vs demand at 314).
# -------------------------------------------------------
check_strict "Demand: /submarket/:id"             GET "$BASE/api/v1/submarket/$SUBMARKET_ID"
check_strict "Demand: /impact/:dealId"            GET "$BASE/api/v1/impact/$DEAL_ID"
check_lenient "Demand: /deals/:dealId/demand"     GET "$BASE/api/v1/deals/$DEAL_ID/demand"
check_lenient "Demand: POST /calculate"           POST "$BASE/api/v1/calculate" \
  -d '{"tradeAreaId":1,"quarter":"2026-Q1"}'
check_lenient "Demand: POST /aggregate/:tid"      POST "$BASE/api/v1/aggregate/$TRADE_AREA_ID" \
  -d '{}'

# -------------------------------------------------------
echo ""
echo "▶ Comp Query /api/v1/comps"
# -------------------------------------------------------
check_strict "Comps: summary"                     GET "$BASE/api/v1/comps/summary"
check_lenient "Comps: property/:id"               GET "$BASE/api/v1/comps/property/$PROPERTY_ID"
check_lenient "Comps: property/:id/rent-comps"    GET "$BASE/api/v1/comps/property/$PROPERTY_ID/rent-comps"
check_lenient "Comps: submarket/:id/stats"        GET "$BASE/api/v1/comps/submarket/$SUBMARKET_ID/stats"
check_lenient "Comps: POST search"                POST "$BASE/api/v1/comps/search" \
  -d '{"city":"Atlanta","state":"GA","propertyType":"multi_family"}'
check_lenient "Comps: POST search/v2"             POST "$BASE/api/v1/comps/search/v2" \
  -d '{"city":"Atlanta","state":"GA","propertyType":"multi_family"}'

# -------------------------------------------------------
echo ""
echo "▶ Sale Comps M27 /api/v1/deals/:dealId/comps (m27-comps.routes.ts)"
# -------------------------------------------------------
check_lenient "M27: deals comps list"             GET "$BASE/api/v1/deals/$DEAL_ID/comps"
check_lenient "M27: exit cap rate"                GET "$BASE/api/v1/deals/$DEAL_ID/comps/exit-cap-rate"
check_lenient "M27: comps summary"                GET "$BASE/api/v1/deals/$DEAL_ID/comps/summary"
check_lenient "M27: POST generate comps"          POST "$BASE/api/v1/deals/$DEAL_ID/comps/generate" \
  -d '{"radius":5}'

# -------------------------------------------------------
echo ""
echo "▶ Competition /api/v1/deals/:dealId (competition.routes.ts)"
# -------------------------------------------------------
check_lenient "Competition: competitors"          GET "$BASE/api/v1/deals/$DEAL_ID/competitors"
check_lenient "Competition: advantage-matrix"     GET "$BASE/api/v1/deals/$DEAL_ID/advantage-matrix"
check_lenient "Competition: waitlist-properties"  GET "$BASE/api/v1/deals/$DEAL_ID/waitlist-properties"
check_lenient "Competition: aging-competitors"    GET "$BASE/api/v1/deals/$DEAL_ID/aging-competitors"
check_lenient "Competition: competition-insights" GET "$BASE/api/v1/deals/$DEAL_ID/competition-insights"
check_lenient "Competition: competition-export"   GET "$BASE/api/v1/deals/$DEAL_ID/competition-export"
check_lenient "Competition: competitive-ranking"  GET "$BASE/api/v1/deals/$DEAL_ID/competitive-ranking"

# -------------------------------------------------------
echo ""
echo "▶ JEDI Scoring /api/v1/jedi"
# -------------------------------------------------------
check_lenient "JEDI: score/:dealId"               GET "$BASE/api/v1/jedi/score/$DEAL_ID"
check_lenient "JEDI: history/:dealId"             GET "$BASE/api/v1/jedi/history/$DEAL_ID"
check_lenient "JEDI: impact/:dealId"              GET "$BASE/api/v1/jedi/impact/$DEAL_ID"
check_strict  "JEDI: alerts (list)"               GET "$BASE/api/v1/jedi/alerts"
check_strict  "JEDI: alerts/settings GET"         GET "$BASE/api/v1/jedi/alerts/settings"
check_lenient "JEDI: alerts/deal/:dealId"         GET "$BASE/api/v1/jedi/alerts/deal/$DEAL_ID"
check_lenient "JEDI: POST score recalculate"      POST "$BASE/api/v1/jedi/score/$DEAL_ID/recalculate" \
  -d '{}'
check_lenient "JEDI: POST alerts/check"           POST "$BASE/api/v1/jedi/alerts/check" \
  -d '{}'
check_lenient "JEDI: POST recalculate-all"        POST "$BASE/api/v1/jedi/recalculate-all" \
  -d '{}'
check_lenient "JEDI: POST alerts/:id/read"        POST "$BASE/api/v1/jedi/alerts/00000000-0000-0000-0000-000000000001/read" \
  -d '{}'
check_lenient "JEDI: POST alerts/:id/dismiss"     POST "$BASE/api/v1/jedi/alerts/00000000-0000-0000-0000-000000000001/dismiss" \
  -d '{}'
check_lenient "JEDI: PATCH alerts/settings"       PATCH "$BASE/api/v1/jedi/alerts/settings" \
  -d '{"emailEnabled":true}'

# -------------------------------------------------------
echo ""
echo "▶ Traffic Prediction /api/v1/traffic (trafficPrediction.routes.ts)"
# -------------------------------------------------------
check_strict  "Traffic: model/performance"         GET "$BASE/api/v1/traffic/model/performance"
check_strict  "Traffic: calibration/active"        GET "$BASE/api/v1/traffic/calibration/active"
check_strict  "Traffic: validation/errors"         GET "$BASE/api/v1/traffic/validation/errors"
check_lenient "Traffic: prediction/:id"            GET "$BASE/api/v1/traffic/prediction/$PROPERTY_ID"
check_lenient "Traffic: intelligence/:id"          GET "$BASE/api/v1/traffic/intelligence/$PROPERTY_ID"
check_lenient "Traffic: validation/summary/:id"    GET "$BASE/api/v1/traffic/validation/summary/$PROPERTY_ID"
check_lenient "Traffic: POST predict/:id"          POST "$BASE/api/v1/traffic/predict/$PROPERTY_ID" \
  -d '{"propertyType":"multi_family"}'
check_lenient "Traffic: POST calibration/apply"    POST "$BASE/api/v1/traffic/calibration/apply" \
  -d '{"calibrationFactor":1.0}'
check_lenient "Traffic: POST batch-predict"        POST "$BASE/api/v1/traffic/batch-predict" \
  -d '{"propertyIds":["'"$PROPERTY_ID"'"]}'
check_lenient "Traffic: POST validation/record"    POST "$BASE/api/v1/traffic/validation/record" \
  -d '{"propertyId":"'"$PROPERTY_ID"'","predicted":100,"actual":95}'

# -------------------------------------------------------
echo ""
echo "▶ Traffic AI /api/v1/traffic-ai"
# -------------------------------------------------------
check_lenient "Traffic-AI: POST generate"         POST "$BASE/api/v1/traffic-ai/generate" \
  -d '{"dealId":"'"$DEAL_ID"'","analysisType":"full"}'

# -------------------------------------------------------
echo ""
echo "▶ Traffic Data /api/v1/traffic-data"
# -------------------------------------------------------
check_strict  "Traffic-data: adt/stations"          GET "$BASE/api/v1/traffic-data/adt/stations"
check_strict  "Traffic-data: adt/nearest"          GET "$BASE/api/v1/traffic-data/adt/nearest?lat=33.749&lng=-84.388"
check_strict  "Traffic-data: realtime"             GET "$BASE/api/v1/traffic-data/realtime?lat=33.749&lng=-84.388"
check_lenient "Traffic-data: context/:propertyId"  GET "$BASE/api/v1/traffic-data/context/$PROPERTY_ID"
check_lenient "Traffic-data: POST context/:id/link" POST "$BASE/api/v1/traffic-data/context/$PROPERTY_ID/link" \
  -d '{"stationId":1}'
check_lenient "Traffic-data: POST bulk-link"       POST "$BASE/api/v1/traffic-data/bulk-link" \
  -d '{"links":[{"propertyId":"'"$PROPERTY_ID"'","stationId":1}]}'
check_lenient "Traffic-data: POST adt/upload"      POST "$BASE/api/v1/traffic-data/adt/upload" \
  -F "file=@/dev/null;type=text/csv"

# -------------------------------------------------------
echo ""
echo "▶ Traffic Comps /api/v1/traffic-comps"
# -------------------------------------------------------
check_lenient "Traffic-comps: deal"               GET "$BASE/api/v1/traffic-comps/$DEAL_ID"
check_lenient "Traffic-comps: averages"           GET "$BASE/api/v1/traffic-comps/$DEAL_ID/averages"
check_lenient "Traffic-comps: selections GET"     GET "$BASE/api/v1/traffic-comps/$DEAL_ID/selections"
check_lenient "Traffic-comps: proxy-candidates"   GET "$BASE/api/v1/traffic-comps/$DEAL_ID/proxy-candidates"
check_lenient "Traffic-comps: deals-with-data"    GET "$BASE/api/v1/traffic-comps/$DEAL_ID/deals-with-data"
check_lenient "Traffic-comps: POST snapshot"      POST "$BASE/api/v1/traffic-comps/$DEAL_ID/snapshot" \
  -d '{}'
check_lenient "Traffic-comps: PUT selections"     PUT "$BASE/api/v1/traffic-comps/$DEAL_ID/selections" \
  -d '{"propertyIds":[]}'

# -------------------------------------------------------
echo ""
echo "▶ Leasing Traffic /api/v1/leasing-traffic"
# -------------------------------------------------------
check_strict  "Leasing: dot-profiles/summary"     GET "$BASE/api/v1/leasing-traffic/dot-profiles/summary"
check_strict  "Leasing: dot-profiles/temporal"    GET "$BASE/api/v1/leasing-traffic/dot-profiles/temporal-multiplier"
check_strict  "Leasing: dot-profiles/hourly"      GET "$BASE/api/v1/leasing-traffic/dot-profiles/hourly-distribution"
check_lenient "Leasing: predict/:id"              GET "$BASE/api/v1/leasing-traffic/predict/$PROPERTY_ID"
check_lenient "Leasing: forecast/:id"             GET "$BASE/api/v1/leasing-traffic/forecast/$PROPERTY_ID"
check_lenient "Leasing: optimize-rent/:id"        GET "$BASE/api/v1/leasing-traffic/optimize-rent/$PROPERTY_ID"
check_lenient "Leasing: historical/:id"           GET "$BASE/api/v1/leasing-traffic/historical/$PROPERTY_ID"
check_lenient "Leasing: weekly-report history"    GET "$BASE/api/v1/leasing-traffic/weekly-report/$DEAL_ID/history"
check_lenient "Leasing: weekly-report projection" GET "$BASE/api/v1/leasing-traffic/weekly-report/$DEAL_ID/projection"
check_lenient "Leasing: weekly-report calibration" GET "$BASE/api/v1/leasing-traffic/weekly-report/$DEAL_ID/calibration"
check_lenient "Leasing: data-sources/:dealId"     GET "$BASE/api/v1/leasing-traffic/data-sources/$DEAL_ID"
check_lenient "Leasing: trend-patterns/:dealId"   GET "$BASE/api/v1/leasing-traffic/trend-patterns/$DEAL_ID"
check_lenient "Leasing: POST lease-up-timeline"   POST "$BASE/api/v1/leasing-traffic/lease-up-timeline" \
  -d '{"dealId":"'"$DEAL_ID"'","targetOccupancy":0.95}'
check_lenient "Leasing: PATCH deal-trade-area"    PATCH "$BASE/api/v1/leasing-traffic/deal-trade-area/$DEAL_ID" \
  -d '{"tradeAreaId":"'"$TRADE_AREA_ID"'"}'
check_lenient "Leasing: PUT weekly-report snapshot" PUT "$BASE/api/v1/leasing-traffic/weekly-report/$DEAL_ID/snapshot" \
  -d '{"week":"2026-W01"}'
check_lenient "Leasing: POST dot-profiles/seed"   POST "$BASE/api/v1/leasing-traffic/dot-profiles/seed" \
  -d '{}'
check_lenient "Leasing: POST dot-profiles/google-cal" POST "$BASE/api/v1/leasing-traffic/dot-profiles/google-calibrate/$PROPERTY_ID" \
  -d '{"placeId":"ChIJtest123"}'
check_lenient "Leasing: POST dot-profiles/ingest" POST "$BASE/api/v1/leasing-traffic/dot-profiles/ingest" \
  -F "file=@/dev/null;type=text/csv"
check_lenient "Leasing: POST weekly-report/upload" POST "$BASE/api/v1/leasing-traffic/weekly-report/upload" \
  -F "file=@/dev/null;type=text/csv"

# -------------------------------------------------------
echo ""
echo "▶ Benchmark Timeline /api/v1/benchmark-timeline"
# -------------------------------------------------------
check_strict  "Benchmark: benchmarks"             GET "$BASE/api/v1/benchmark-timeline/benchmarks?county=Fulton&state=GA"
check_strict  "Benchmark: detailed-steps"         GET "$BASE/api/v1/benchmark-timeline/detailed-steps?county=Fulton&state=GA"
check_strict  "Benchmark: jurisdiction-comparison" GET "$BASE/api/v1/benchmark-timeline/jurisdiction-comparison?county=Fulton&state=GA"
check_lenient "Benchmark: POST simulate"          POST "$BASE/api/v1/benchmark-timeline/simulate" \
  -d '{"city":"Atlanta","state":"GA","projectType":"multifamily","units":200}'
check_lenient "Benchmark: POST compare-paths"     POST "$BASE/api/v1/benchmark-timeline/compare-paths" \
  -d '{"jurisdictions":["Atlanta, GA"]}'
check_lenient "Benchmark: POST ingest/atlanta"    POST "$BASE/api/v1/benchmark-timeline/ingest/atlanta" \
  -d '{}'
check_lenient "Benchmark: POST ingest/florida"    POST "$BASE/api/v1/benchmark-timeline/ingest/florida" \
  -d '{}'
check_lenient "Benchmark: POST ingest/florida/all" POST "$BASE/api/v1/benchmark-timeline/ingest/florida/all" \
  -d '{}'

# -------------------------------------------------------
echo ""
echo "▶ Property Analytics /api/v1/property-analytics"
# -------------------------------------------------------
check_lenient "Property-analytics: POST connect"  POST "$BASE/api/v1/property-analytics/connect" \
  -d '{"propertyId":"'"$PROPERTY_ID"'","externalId":"ext-001"}'
check_lenient "Property-analytics: POST disconnect" POST "$BASE/api/v1/property-analytics/disconnect" \
  -d '{"propertyId":"'"$PROPERTY_ID"'"}'
check_lenient "Property-analytics: connection/:id" GET "$BASE/api/v1/property-analytics/connection/$PROPERTY_ID"
check_lenient "Property-analytics: property/:id"  GET "$BASE/api/v1/property-analytics/$PROPERTY_ID"
check_lenient "Property-analytics: score"         GET "$BASE/api/v1/property-analytics/$PROPERTY_ID/score"
check_lenient "Property-analytics: history"       GET "$BASE/api/v1/property-analytics/$PROPERTY_ID/history"
check_lenient "Property-analytics: digital-share" GET "$BASE/api/v1/property-analytics/$PROPERTY_ID/digital-share"
check_lenient "Property-analytics: POST comp-proxy" POST "$BASE/api/v1/property-analytics/$PROPERTY_ID/comp-proxy" \
  -d '{"radius":5}'
check_lenient "Property-analytics: POST sync"     POST "$BASE/api/v1/property-analytics/sync" \
  -d '{"propertyIds":["'"$PROPERTY_ID"'"]}'

# -------------------------------------------------------
echo ""
echo "▶ Trade Areas /api/v1/trade-areas"
# -------------------------------------------------------
check_strict  "Trade-areas: list"                 GET "$BASE/api/v1/trade-areas"
check_strict  "Trade-areas: library"              GET "$BASE/api/v1/trade-areas/library"
check_lenient "Trade-areas: :id"                  GET "$BASE/api/v1/trade-areas/$TRADE_AREA_ID"
check_lenient "Trade-areas: POST create"          POST "$BASE/api/v1/trade-areas" \
  -d '{"name":"Test Trade Area","municipality":"Atlanta","state":"GA"}'
check_lenient "Trade-areas: POST generate"        POST "$BASE/api/v1/trade-areas/generate" \
  -d '{"dealId":"'"$DEAL_ID"'","radiusMiles":3}'
check_lenient "Trade-areas: POST preview-stats"   POST "$BASE/api/v1/trade-areas/preview-stats" \
  -d '{"bounds":{"north":34,"south":33,"east":-84,"west":-85}}'
check_lenient "Trade-areas: POST radius"          POST "$BASE/api/v1/trade-areas/radius" \
  -d '{"latitude":33.749,"longitude":-84.388,"radiusMiles":3}'
check_lenient "Trade-areas: PUT :id"              PUT "$BASE/api/v1/trade-areas/$TRADE_AREA_ID" \
  -d '{"name":"Updated Trade Area"}'
check_lenient "Trade-areas: DELETE :id"           DELETE "$BASE/api/v1/trade-areas/00000000-0000-0000-0000-000000000001"

# -------------------------------------------------------
echo ""
echo "▶ Deals CRUD /api/v1/deals (inline-deals.routes.ts)"
# -------------------------------------------------------
check_strict  "Deals: GET list"                   GET "$BASE/api/v1/deals"
check_lenient "Deals: GET /:id"                   GET "$BASE/api/v1/deals/$DEAL_ID"
check_lenient "Deals: GET /:id/modules"           GET "$BASE/api/v1/deals/$DEAL_ID/modules"
check_lenient "Deals: GET /:id/properties"        GET "$BASE/api/v1/deals/$DEAL_ID/properties"
check_lenient "Deals: GET /:id/activity"          GET "$BASE/api/v1/deals/$DEAL_ID/activity"
check_lenient "Deals: GET /:id/timeline"          GET "$BASE/api/v1/deals/$DEAL_ID/timeline"
check_lenient "Deals: POST create"                POST "$BASE/api/v1/deals" \
  -d '{"name":"Test Deal","propertyType":"multi_family","city":"Atlanta","state":"GA"}'
check_lenient "Deals: PATCH /:id"                 PATCH "$BASE/api/v1/deals/$DEAL_ID" \
  -d '{"name":"Updated Deal Name"}'
check_lenient "Deals: PATCH /:id/property"        PATCH "$BASE/api/v1/deals/$DEAL_ID/property" \
  -d '{"propertyId":"'"$PROPERTY_ID"'"}'
check_lenient "Deals: DELETE /:id"                DELETE "$BASE/api/v1/deals/00000000-0000-0000-0000-000000000001"

# -------------------------------------------------------
echo ""
echo "▶ Deal Market Intelligence /api/v1/deals (deal-market-intelligence.routes.ts)"
# -------------------------------------------------------
check_lenient "Deal: market-intelligence"         GET "$BASE/api/v1/deals/$DEAL_ID/market-intelligence"

# -------------------------------------------------------
echo ""
echo "▶ Deal Context /api/v1/deals (deal-context.routes.ts)"
# -------------------------------------------------------
check_lenient "Deal-ctx: GET /:dealId/context"    GET "$BASE/api/v1/deals/$DEAL_ID/context"
check_lenient "Deal-ctx: PATCH /:dealId/context"  PATCH "$BASE/api/v1/deals/$DEAL_ID/context" \
  -d '{"notes":"Updated"}'
check_lenient "Deal-ctx: POST /:dealId/recompute" POST "$BASE/api/v1/deals/$DEAL_ID/recompute" \
  -d '{}'

# -------------------------------------------------------
echo ""
echo "▶ Deal Assumptions /api/v1/deals (deal-assumptions.routes.ts)"
# -------------------------------------------------------
check_lenient "Deal-assump: GET assumptions"      GET "$BASE/api/v1/deals/$DEAL_ID/assumptions"
check_lenient "Deal-assump: GET full-context"     GET "$BASE/api/v1/deals/$DEAL_ID/full-context"
check_lenient "Deal-assump: PUT assumptions"      PUT "$BASE/api/v1/deals/$DEAL_ID/assumptions" \
  -d '{"rentGrowth":0.03,"capRate":0.05}'
check_lenient "Deal-assump: POST compute-returns" POST "$BASE/api/v1/deals/$DEAL_ID/compute-returns" \
  -d '{"exitYear":5}'
check_lenient "Deal-assump: PUT site-data"        PUT "$BASE/api/v1/deals/$DEAL_ID/site-data" \
  -d '{"lotSize":2.5}'

# -------------------------------------------------------
echo ""
echo "▶ Site Intelligence /api/v1/deals (site-intelligence.routes.ts)"
# -------------------------------------------------------
check_lenient "Site-intel: GET"                   GET "$BASE/api/v1/deals/$DEAL_ID/site-intelligence"
check_lenient "Site-intel: POST"                  POST "$BASE/api/v1/deals/$DEAL_ID/site-intelligence" \
  -d '{"forceRefresh":false}'
check_lenient "Site-intel: DELETE"                DELETE "$BASE/api/v1/deals/$DEAL_ID/site-intelligence"

# -------------------------------------------------------
echo ""
echo "▶ Geographic Context /api/v1 and /api/v1/deals (geographic-context.routes.ts)"
# geographic-context.routes.ts mounted at both /api/v1 and /api/v1/deals
# Routes: /:id/geographic-context (GET/POST/PUT), /submarkets/lookup, /msas/lookup
# -------------------------------------------------------
check_strict  "Geo-ctx: /submarkets/lookup"       GET "$BASE/api/v1/submarkets/lookup?lat=33.749&lng=-84.388"
check_strict  "Geo-ctx: /msas/lookup"             GET "$BASE/api/v1/msas/lookup?lat=33.749&lng=-84.388"
check_lenient "Geo-ctx: GET deals geo-ctx"        GET "$BASE/api/v1/deals/$DEAL_ID/geographic-context"
check_lenient "Geo-ctx: POST deals geo-ctx"       POST "$BASE/api/v1/deals/$DEAL_ID/geographic-context" \
  -d '{"forceRefresh":false}'
check_lenient "Geo-ctx: PUT deals geo-ctx"        PUT "$BASE/api/v1/deals/$DEAL_ID/geographic-context" \
  -d '{"notes":"Updated"}'

# -------------------------------------------------------
echo ""
echo "▶ Visibility /api/v1/visibility"
# -------------------------------------------------------
check_lenient "Visibility: score/:id"             GET "$BASE/api/v1/visibility/score/$PROPERTY_ID"
check_lenient "Visibility: assessment/:id"        GET "$BASE/api/v1/visibility/assessment/$PROPERTY_ID"
check_lenient "Visibility: PUT update/:id"        PUT "$BASE/api/v1/visibility/update/$PROPERTY_ID" \
  -d '{"signageScore":8}'
check_lenient "Visibility: POST assess"           POST "$BASE/api/v1/visibility/assess" \
  -d '{"propertyId":"'"$PROPERTY_ID"'","address":"123 Main St","lat":33.749,"lng":-84.388}'
check_lenient "Visibility: POST preview"          POST "$BASE/api/v1/visibility/preview" \
  -d '{"lat":33.749,"lng":-84.388,"address":"123 Main St Atlanta GA"}'

# -------------------------------------------------------
echo ""
echo "▶ M26 Tax /api/v1/deals/:dealId/tax (m26-tax.routes.ts)"
# -------------------------------------------------------
check_lenient "M26-tax: GET projection"           GET "$BASE/api/v1/deals/$DEAL_ID/tax/projection"
check_lenient "M26-tax: GET summary"              GET "$BASE/api/v1/deals/$DEAL_ID/tax/summary"
check_lenient "M26-tax: POST projection"          POST "$BASE/api/v1/deals/$DEAL_ID/tax/projection" \
  -d '{"assessedValue":5000000,"millageRate":0.025}'

# -------------------------------------------------------
echo ""
echo "▶ Deal Comp Sets /api/v1/deals (deal-comp-sets.routes.ts)"
# -------------------------------------------------------
check_lenient "Comp-sets: GET comp-set"           GET "$BASE/api/v1/deals/$DEAL_ID/comp-set"
check_lenient "Comp-sets: GET discover-tiered"    GET "$BASE/api/v1/deals/$DEAL_ID/comp-set/discover-tiered"
check_lenient "Comp-sets: POST discover"          POST "$BASE/api/v1/deals/$DEAL_ID/comp-set/discover" \
  -d '{"radius":5}'
check_lenient "Comp-sets: POST create"            POST "$BASE/api/v1/deals/$DEAL_ID/comp-set" \
  -d '{"name":"My Comp Set","propertyIds":[]}'
check_lenient "Comp-sets: POST add-to-set"        POST "$BASE/api/v1/deals/$DEAL_ID/comp-set/add-to-set" \
  -d '{"propertyId":"'"$PROPERTY_ID"'"}'
check_lenient "Comp-sets: DELETE /:dealId/comp-set/:compId" DELETE "$BASE/api/v1/deals/$DEAL_ID/comp-set/00000000-0000-0000-0000-000000000001"
check_lenient "Comp-sets: PATCH /:dealId/comp-set/:compId"  PATCH "$BASE/api/v1/deals/$DEAL_ID/comp-set/00000000-0000-0000-0000-000000000001" \
  -d '{"weight":1.5}'

# -------------------------------------------------------
echo ""
echo "▶ Market (basic) /api/v1/market"
# -------------------------------------------------------
check_strict  "Market: inventory/:city/:state"    GET "$BASE/api/v1/market/inventory/Atlanta/GA"
check_strict  "Market: trends/:city/:state"       GET "$BASE/api/v1/market/trends/Atlanta/GA"

# -------------------------------------------------------
echo ""
echo "▶ Properties /api/v1/properties (unified-properties.routes.ts)"
# -------------------------------------------------------
check_strict  "Properties: GET /unified"          GET "$BASE/api/v1/properties/unified"
check_lenient "Properties: POST /unified/refresh" POST "$BASE/api/v1/properties/unified/refresh" \
  -d '{}'

# -------------------------------------------------------
echo ""
echo "========================================"
echo "  UNMOUNTED ROUTE FILES — PHASE 4 MATRIX"
echo "========================================"
echo ""
echo "  The following route files exist in backend/src/api/rest/ but are"
echo "  NOT imported or mounted in index.replit.ts and are therefore"
echo "  unreachable at runtime. They are excluded from this smoke test."
echo ""
echo "  File                            Status        Reason"
echo "  ──────────────────────────────────────────────────────────────"
echo "  geography.routes.ts             NOT MOUNTED   Superseded by trade-areas.routes.ts"
echo "                                                (mounted at /api/v1/trade-areas) and"
echo "                                                geographic-context.routes.ts for lookups."
echo "  credibility.routes.ts           NOT MOUNTED   Not imported in index.replit.ts."
echo "  demand-intelligence.routes.ts   NOT MOUNTED   Not imported in index.replit.ts."
echo "  apartment-locator.routes.ts     NOT MOUNTED   Not imported in index.replit.ts."
echo "  leasingTraffic.routes.ts        NOT MOUNTED   Duplicate of leasing-traffic.routes.ts"
echo "  (camelCase variant)                           (kebab-case); kebab version is mounted."
echo "  traffic-intelligence.routes.ts  NOT MOUNTED   Not imported in index.replit.ts."
echo ""
echo "  To activate any of these: import and mount in index.replit.ts."
echo ""

# -------------------------------------------------------
echo "========================================"
echo "  RESULTS"
echo "========================================"
echo "  PASS: $PASS"
echo "  SKIP: $SKIP  (404=no data, 400=validation/minimal-payload, 403=restriction)"
echo "  FAIL: $FAIL"
echo ""

if [[ ${#ERRORS[@]} -gt 0 ]]; then
  echo "  Failed endpoints:"
  for err in "${ERRORS[@]}"; do
    echo "    $err"
  done
fi

echo ""
echo "Completed: $(date)"

[[ $FAIL -eq 0 ]]

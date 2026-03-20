#!/usr/bin/env bash
# ============================================================
# Smoke Test: Phase 4 — Market Intel & Analytics
# Tests all market intelligence, supply/demand, traffic,
# competition, and analytics API endpoints.
# Target: ~200 endpoints covering every mounted route group.
# ============================================================

BASE="http://localhost:4000"
DEAL_ID="12eb9e11-3b2d-44d5-9f59-877a76344c18"
USER_ID="6253ba3f-d40d-4597-86ab-270c8397a857"
MARKET_ID="atlanta-ga"
PROPERTY_ID="00175617-4d11-447e-a274-9c3fb828a69d"
TRADE_AREA_ID="87db1a79-2f68-4069-b2ef-67566ff666f8"
SUBMARKET_ID="1"
MSA_ID="1"

# Generate a fresh token
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

check() {
  local label="$1"
  local method="$2"
  local url="$3"
  local extra_args=("${@:4}")

  local response
  local http_code
  response=$(curl -s -o /tmp/smoke_body.txt -w "%{http_code}" \
    -X "$method" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    "${extra_args[@]}" \
    "$url")
  http_code="$response"
  local body
  body=$(cat /tmp/smoke_body.txt 2>/dev/null)

  if [[ "$http_code" -ge 200 && "$http_code" -lt 400 ]]; then
    echo "  PASS [$http_code] $label"
    ((PASS++))
  elif [[ "$http_code" == "404" ]]; then
    echo "  SKIP [404] $label — no data (OK)"
    ((SKIP++))
  elif [[ "$http_code" == "400" ]]; then
    echo "  SKIP [400] $label — bad request/no data (OK)"
    ((SKIP++))
  elif [[ "$http_code" == "403" ]]; then
    echo "  SKIP [403] $label — business logic restriction (OK)"
    ((SKIP++))
  else
    echo "  FAIL [$http_code] $label"
    echo "         $body" | head -c 300
    ERRORS+=("[$http_code] $label")
    ((FAIL++))
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
check "Health check" GET "$BASE/health"

# -------------------------------------------------------
echo ""
echo "▶ Market Intelligence (/api/v1/markets) — GET endpoints"
# -------------------------------------------------------
check "Markets: overview"                 GET "$BASE/api/v1/markets/overview"
check "Markets: available"                GET "$BASE/api/v1/markets/available"
check "Markets: preferences GET"          GET "$BASE/api/v1/markets/preferences"
check "Markets: compare"                  GET "$BASE/api/v1/markets/compare?markets=Atlanta"
check "Markets: properties"               GET "$BASE/api/v1/markets/properties?city=Atlanta&state=GA"
check "Markets: properties/:id"           GET "$BASE/api/v1/markets/properties/$PROPERTY_ID"
check "Markets: market-stats/:marketId"   GET "$BASE/api/v1/markets/market-stats/$MARKET_ID"
check "Markets: submarket-stats/:marketId" GET "$BASE/api/v1/markets/submarket-stats/$MARKET_ID"
check "Markets: :marketId/summary"        GET "$BASE/api/v1/markets/$MARKET_ID/summary"
check "Markets: :marketId/alerts"         GET "$BASE/api/v1/markets/$MARKET_ID/alerts"

# -------------------------------------------------------
echo ""
echo "▶ Market Intelligence (/api/v1/markets) — POST/PUT/DELETE endpoints"
# -------------------------------------------------------
check "Markets: preferences POST"         POST "$BASE/api/v1/markets/preferences" \
  -d '{"markets":["atlanta-ga","dallas-tx"]}'
check "Markets: preferences PUT"          PUT "$BASE/api/v1/markets/preferences/1" \
  -d '{"markets":["atlanta-ga"]}'
check "Markets: preferences DELETE"       DELETE "$BASE/api/v1/markets/preferences/1"
check "Markets: property-records enrich"  POST "$BASE/api/v1/markets/property-records/$PROPERTY_ID/enrich" \
  -d '{}'

# -------------------------------------------------------
echo ""
echo "▶ Market Intelligence Enhanced (/api/v1/markets)"
# -------------------------------------------------------
check "Enhanced: :marketId/submarkets/detailed" GET "$BASE/api/v1/markets/$MARKET_ID/submarkets/detailed"
check "Enhanced: compare-data"            GET "$BASE/api/v1/markets/compare-data?markets=Atlanta"
check "Enhanced: :marketId/owners"        GET "$BASE/api/v1/markets/$MARKET_ID/owners"
check "Enhanced: owners/:ownerName/portfolio" GET "$BASE/api/v1/markets/owners/Greystar/portfolio"

# -------------------------------------------------------
echo ""
echo "▶ Market Research (/api/v1/market-research)"
# -------------------------------------------------------
check "Market-research: status"           GET "$BASE/api/v1/market-research/status/$DEAL_ID"
check "Market-research: report"           GET "$BASE/api/v1/market-research/report/$DEAL_ID"
check "Market-research: metrics"          GET "$BASE/api/v1/market-research/metrics/$DEAL_ID"
check "Market-research: intelligence"     GET "$BASE/api/v1/market-research/intelligence/$DEAL_ID"
check "Market-research: sources"          GET "$BASE/api/v1/market-research/sources/$DEAL_ID"
check "Market-research: analysis-input"   GET "$BASE/api/v1/market-research/analysis-input/$DEAL_ID"
check "Market-research: POST generate"    POST "$BASE/api/v1/market-research/generate/$DEAL_ID" \
  -d '{}'
check "Market-research: POST batch-generate" POST "$BASE/api/v1/market-research/batch-generate" \
  -d '{"dealIds":["'"$DEAL_ID"'"]}'

# -------------------------------------------------------
echo ""
echo "▶ Cycle Intelligence (/api/v1/cycle-intelligence)"
# -------------------------------------------------------
check "Cycle: test/rate-environment (no auth)" GET "$BASE/api/v1/cycle-intelligence/test/rate-environment"
check "Cycle: rate-environment"           GET "$BASE/api/v1/cycle-intelligence/rate-environment"
check "Cycle: rate-history"               GET "$BASE/api/v1/cycle-intelligence/rate-history"
check "Cycle: leading-indicators"         GET "$BASE/api/v1/cycle-intelligence/leading-indicators"
check "Cycle: pattern-matches"            GET "$BASE/api/v1/cycle-intelligence/pattern-matches"
check "Cycle: macro-risk"                 GET "$BASE/api/v1/cycle-intelligence/macro-risk"
check "Cycle: phase/:marketId"            GET "$BASE/api/v1/cycle-intelligence/phase/$MARKET_ID"
check "Cycle: divergence/:marketId"       GET "$BASE/api/v1/cycle-intelligence/divergence/$MARKET_ID"
check "Cycle: predict rent-growth"        GET "$BASE/api/v1/cycle-intelligence/predict/rent-growth/$MARKET_ID"
check "Cycle: predict value-change"       GET "$BASE/api/v1/cycle-intelligence/predict/value-change/$MARKET_ID"
check "Cycle: predict cap-rate"           GET "$BASE/api/v1/cycle-intelligence/predict/cap-rate/$MARKET_ID"
check "Cycle: predict full-chain"         GET "$BASE/api/v1/cycle-intelligence/predict/full-chain/$MARKET_ID"
check "Cycle: phase-optimal-strategy"     GET "$BASE/api/v1/cycle-intelligence/phase-optimal-strategy/$MARKET_ID"
check "Cycle: construction-cost-index"    GET "$BASE/api/v1/cycle-intelligence/construction-cost-index/$MARKET_ID"
check "Cycle: market-metrics-history"     GET "$BASE/api/v1/cycle-intelligence/market-metrics-history/$MARKET_ID"
check "Cycle: deal-performance-by-phase"  GET "$BASE/api/v1/cycle-intelligence/deal-performance-by-phase/$MARKET_ID"

# -------------------------------------------------------
echo ""
echo "▶ F40 Performance (/api/v1/f40)"
# -------------------------------------------------------
check "F40: market"                       GET "$BASE/api/v1/f40/market?city=Atlanta&state=GA"
check "F40: rankings"                     GET "$BASE/api/v1/f40/rankings?city=Atlanta&state=GA"
check "F40: comp-set"                     GET "$BASE/api/v1/f40/comp-set?city=Atlanta&state=GA&submarket=Midtown"

# -------------------------------------------------------
echo ""
echo "▶ Opportunities (/api/v1/opportunities)"
# -------------------------------------------------------
check "Opportunities: detect"             GET "$BASE/api/v1/opportunities/detect"
check "Opportunities: rankings"           GET "$BASE/api/v1/opportunities/rankings"

# -------------------------------------------------------
echo ""
echo "▶ Intelligence Layer (/api/v1/intelligence)"
# -------------------------------------------------------
check "Intelligence: stats"               GET "$BASE/api/v1/intelligence/stats"
check "Intelligence: patterns"            GET "$BASE/api/v1/intelligence/patterns"
check "Intelligence: docs pending"        GET "$BASE/api/v1/intelligence/documents/pending"
check "Intelligence: docs flagged"        GET "$BASE/api/v1/intelligence/documents/flagged"
check "Intelligence: user/stats"          GET "$BASE/api/v1/intelligence/user/stats"
check "Intelligence: user/preferences"    GET "$BASE/api/v1/intelligence/user/preferences"

# -------------------------------------------------------
echo ""
echo "▶ Supply Routes (mounted at /api/v1 — actual paths)"
# NOTE: supply.routes.ts is mounted at /api/v1 with NO /supply prefix on routes.
# Routes: /deals/:dealId/supply, /events, /trade-area/:id, /competitive/:dealId, etc.
# -------------------------------------------------------
check "Supply: deals/:dealId/supply (GET)" GET "$BASE/api/v1/deals/$DEAL_ID/supply"
check "Supply: /events (list)"            GET "$BASE/api/v1/events"
check "Supply: /trade-area/:id"           GET "$BASE/api/v1/trade-area/$TRADE_AREA_ID"
check "Supply: /trade-area/:id/risk"      GET "$BASE/api/v1/trade-area/$TRADE_AREA_ID/risk"
check "Supply: /competitive/:dealId"      GET "$BASE/api/v1/competitive/$DEAL_ID"
check "Supply: /timeline/:tradeAreaId"    GET "$BASE/api/v1/timeline/$TRADE_AREA_ID"
check "Supply: /market-dynamics/:tid"     GET "$BASE/api/v1/market-dynamics/$TRADE_AREA_ID"
check "Supply: /event (POST create)"      POST "$BASE/api/v1/event" \
  -d '{"projectName":"Test Project","developer":"Test Dev","category":"permit","eventType":"permit","units":100,"eventDate":"2026-01-01","status":"permitted","latitude":33.749,"longitude":-84.388}'
check "Supply: /event/:id/status (PUT)"   PUT "$BASE/api/v1/event/00000000-0000-0000-0000-000000000001/status" \
  -d '{"status":"under_construction"}'

# -------------------------------------------------------
echo ""
echo "▶ Inline Data Supply Routes (/api/v1/supply/:market)"
# NOTE: inline-data.routes.ts also mounted at /api/v1 with path /supply/:market
# -------------------------------------------------------
check "Inline: /supply/:market (GET)"     GET "$BASE/api/v1/supply/atlanta-ga"
check "Inline: /alerts (GET)"             GET "$BASE/api/v1/alerts"

# -------------------------------------------------------
echo ""
echo "▶ Demand Routes (mounted at /api/v1 — actual paths)"
# NOTE: demand.routes.ts mounted at /api/v1. Routes: /deals/:dealId/demand,
# /trade-area/:id (numeric), /submarket/:id (numeric), /events, /calculate,
# /impact/:dealId, /aggregate/:tradeAreaId.
# /trade-area/:id and /events are shadowed by supply routes (loaded first).
# -------------------------------------------------------
check "Demand: /deals/:dealId/demand"     GET "$BASE/api/v1/deals/$DEAL_ID/demand"
check "Demand: /submarket/:id (numeric)"  GET "$BASE/api/v1/submarket/$SUBMARKET_ID"
check "Demand: /impact/:dealId"           GET "$BASE/api/v1/impact/$DEAL_ID"
check "Demand: /calculate (POST)"         POST "$BASE/api/v1/calculate" \
  -d '{"tradeAreaId":1,"quarter":"2026-Q1"}'
check "Demand: /aggregate/:tid (POST)"    POST "$BASE/api/v1/aggregate/$TRADE_AREA_ID" \
  -d '{}'

# -------------------------------------------------------
echo ""
echo "▶ Comp Query (/api/v1/comps)"
# -------------------------------------------------------
check "Comps: summary"                    GET "$BASE/api/v1/comps/summary"
check "Comps: property/:id"               GET "$BASE/api/v1/comps/property/$PROPERTY_ID"
check "Comps: property/:id/rent-comps"    GET "$BASE/api/v1/comps/property/$PROPERTY_ID/rent-comps"
check "Comps: submarket/:id/stats"        GET "$BASE/api/v1/comps/submarket/$SUBMARKET_ID/stats"
check "Comps: POST search"                POST "$BASE/api/v1/comps/search" \
  -d '{"city":"Atlanta","state":"GA","propertyType":"multi_family"}'
check "Comps: POST search/v2"             POST "$BASE/api/v1/comps/search/v2" \
  -d '{"city":"Atlanta","state":"GA","propertyType":"multi_family"}'

# -------------------------------------------------------
echo ""
echo "▶ Sale Comps M27 (/api/v1/deals/:dealId/comps)"
# -------------------------------------------------------
check "M27: deals comps list"             GET "$BASE/api/v1/deals/$DEAL_ID/comps"
check "M27: exit cap rate"                GET "$BASE/api/v1/deals/$DEAL_ID/comps/exit-cap-rate"
check "M27: comps summary"                GET "$BASE/api/v1/deals/$DEAL_ID/comps/summary"
check "M27: POST generate comps"          POST "$BASE/api/v1/deals/$DEAL_ID/comps/generate" \
  -d '{"radius":5}'

# -------------------------------------------------------
echo ""
echo "▶ Competition (/api/v1/deals/:dealId — competition.routes.ts)"
# -------------------------------------------------------
check "Competition: competitors"          GET "$BASE/api/v1/deals/$DEAL_ID/competitors"
check "Competition: advantage-matrix"     GET "$BASE/api/v1/deals/$DEAL_ID/advantage-matrix"
check "Competition: waitlist-properties"  GET "$BASE/api/v1/deals/$DEAL_ID/waitlist-properties"
check "Competition: aging-competitors"    GET "$BASE/api/v1/deals/$DEAL_ID/aging-competitors"
check "Competition: competition-insights" GET "$BASE/api/v1/deals/$DEAL_ID/competition-insights"
check "Competition: competition-export"   GET "$BASE/api/v1/deals/$DEAL_ID/competition-export"
check "Competition: competitive-ranking"  GET "$BASE/api/v1/deals/$DEAL_ID/competitive-ranking"

# -------------------------------------------------------
echo ""
echo "▶ JEDI Scoring (/api/v1/jedi)"
# -------------------------------------------------------
check "JEDI: score/:dealId (GET)"         GET "$BASE/api/v1/jedi/score/$DEAL_ID"
check "JEDI: history/:dealId"             GET "$BASE/api/v1/jedi/history/$DEAL_ID"
check "JEDI: impact/:dealId"              GET "$BASE/api/v1/jedi/impact/$DEAL_ID"
check "JEDI: alerts (GET)"                GET "$BASE/api/v1/jedi/alerts"
check "JEDI: alerts/deal/:dealId"         GET "$BASE/api/v1/jedi/alerts/deal/$DEAL_ID"
check "JEDI: alerts/settings (GET)"       GET "$BASE/api/v1/jedi/alerts/settings"
check "JEDI: score/:dealId/recalculate (POST)" POST "$BASE/api/v1/jedi/score/$DEAL_ID/recalculate" \
  -d '{}'
check "JEDI: alerts/check (POST)"         POST "$BASE/api/v1/jedi/alerts/check" \
  -d '{}'
check "JEDI: recalculate-all (POST)"      POST "$BASE/api/v1/jedi/recalculate-all" \
  -d '{}'
check "JEDI: alerts/:id/read (POST)"      POST "$BASE/api/v1/jedi/alerts/00000000-0000-0000-0000-000000000001/read" \
  -d '{}'
check "JEDI: alerts/:id/dismiss (POST)"   POST "$BASE/api/v1/jedi/alerts/00000000-0000-0000-0000-000000000001/dismiss" \
  -d '{}'
check "JEDI: alerts/settings (PATCH)"     PATCH "$BASE/api/v1/jedi/alerts/settings" \
  -d '{"emailEnabled":true}'

# -------------------------------------------------------
echo ""
echo "▶ Traffic Prediction (/api/v1/traffic)"
# -------------------------------------------------------
check "Traffic: model/performance (GET)"  GET "$BASE/api/v1/traffic/model/performance"
check "Traffic: calibration/active (GET)" GET "$BASE/api/v1/traffic/calibration/active"
check "Traffic: validation/errors (GET)"  GET "$BASE/api/v1/traffic/validation/errors"
check "Traffic: prediction/:id (GET)"     GET "$BASE/api/v1/traffic/prediction/$PROPERTY_ID"
check "Traffic: intelligence/:id (GET)"   GET "$BASE/api/v1/traffic/intelligence/$PROPERTY_ID"
check "Traffic: validation/summary/:id"   GET "$BASE/api/v1/traffic/validation/summary/$PROPERTY_ID"
check "Traffic: predict/:id (POST)"       POST "$BASE/api/v1/traffic/predict/$PROPERTY_ID" \
  -d '{"propertyType":"multifamily"}'
check "Traffic: calibration/apply (POST)" POST "$BASE/api/v1/traffic/calibration/apply" \
  -d '{"calibrationFactor":1.0}'
check "Traffic: batch-predict (POST)"     POST "$BASE/api/v1/traffic/batch-predict" \
  -d '{"propertyIds":["'"$PROPERTY_ID"'"]}'

# -------------------------------------------------------
echo ""
echo "▶ Traffic AI (/api/v1/traffic-ai)"
# -------------------------------------------------------
check "Traffic-AI: POST generate"         POST "$BASE/api/v1/traffic-ai/generate" \
  -d '{"dealId":"'"$DEAL_ID"'","analysisType":"full"}'

# -------------------------------------------------------
echo ""
echo "▶ Traffic Data (/api/v1/traffic-data)"
# -------------------------------------------------------
check "Traffic-data: adt/stations"        GET "$BASE/api/v1/traffic-data/adt/stations"
check "Traffic-data: realtime"            GET "$BASE/api/v1/traffic-data/realtime"
check "Traffic-data: context/:dealId"     GET "$BASE/api/v1/traffic-data/context/$DEAL_ID"

# -------------------------------------------------------
echo ""
echo "▶ Traffic Comps (/api/v1/traffic-comps)"
# -------------------------------------------------------
check "Traffic-comps: deal"               GET "$BASE/api/v1/traffic-comps/$DEAL_ID"
check "Traffic-comps: averages"           GET "$BASE/api/v1/traffic-comps/$DEAL_ID/averages"
check "Traffic-comps: selections"         GET "$BASE/api/v1/traffic-comps/$DEAL_ID/selections"
check "Traffic-comps: proxy-candidates"   GET "$BASE/api/v1/traffic-comps/$DEAL_ID/proxy-candidates"

# -------------------------------------------------------
echo ""
echo "▶ Leasing Traffic (/api/v1/leasing-traffic)"
# -------------------------------------------------------
check "Leasing: predict/:id"              GET "$BASE/api/v1/leasing-traffic/predict/$PROPERTY_ID"
check "Leasing: forecast/:id"             GET "$BASE/api/v1/leasing-traffic/forecast/$PROPERTY_ID"
check "Leasing: optimize-rent/:id"        GET "$BASE/api/v1/leasing-traffic/optimize-rent/$PROPERTY_ID"
check "Leasing: historical/:id"           GET "$BASE/api/v1/leasing-traffic/historical/$PROPERTY_ID"
check "Leasing: weekly-report/:id/history" GET "$BASE/api/v1/leasing-traffic/weekly-report/$DEAL_ID/history"
check "Leasing: weekly-report/:id/projection" GET "$BASE/api/v1/leasing-traffic/weekly-report/$DEAL_ID/projection"
check "Leasing: weekly-report/:id/calibration" GET "$BASE/api/v1/leasing-traffic/weekly-report/$DEAL_ID/calibration"
check "Leasing: data-sources/:dealId"     GET "$BASE/api/v1/leasing-traffic/data-sources/$DEAL_ID"
check "Leasing: trend-patterns/:dealId"   GET "$BASE/api/v1/leasing-traffic/trend-patterns/$DEAL_ID"
check "Leasing: dot-profiles/summary"     GET "$BASE/api/v1/leasing-traffic/dot-profiles/summary"
check "Leasing: dot-profiles/temporal-multiplier" GET "$BASE/api/v1/leasing-traffic/dot-profiles/temporal-multiplier"
check "Leasing: dot-profiles/hourly-distribution" GET "$BASE/api/v1/leasing-traffic/dot-profiles/hourly-distribution"
check "Leasing: POST lease-up-timeline"   POST "$BASE/api/v1/leasing-traffic/lease-up-timeline" \
  -d '{"dealId":"'"$DEAL_ID"'","targetOccupancy":0.95}'

# -------------------------------------------------------
echo ""
echo "▶ Benchmark Timeline (/api/v1/benchmark-timeline)"
# -------------------------------------------------------
check "Benchmark: benchmarks (GET)"       GET "$BASE/api/v1/benchmark-timeline/benchmarks"
check "Benchmark: detailed-steps (GET)"   GET "$BASE/api/v1/benchmark-timeline/detailed-steps"
check "Benchmark: jurisdiction-comparison" GET "$BASE/api/v1/benchmark-timeline/jurisdiction-comparison"
check "Benchmark: POST simulate"          POST "$BASE/api/v1/benchmark-timeline/simulate" \
  -d '{"city":"Atlanta","state":"GA","projectType":"multifamily","units":200}'
check "Benchmark: POST compare-paths"     POST "$BASE/api/v1/benchmark-timeline/compare-paths" \
  -d '{"jurisdictions":["Atlanta, GA"]}'

# -------------------------------------------------------
echo ""
echo "▶ Property Analytics (/api/v1/property-analytics)"
# -------------------------------------------------------
check "Property-analytics: property/:id"  GET "$BASE/api/v1/property-analytics/$PROPERTY_ID"
check "Property-analytics: score"         GET "$BASE/api/v1/property-analytics/$PROPERTY_ID/score"
check "Property-analytics: history"       GET "$BASE/api/v1/property-analytics/$PROPERTY_ID/history"
check "Property-analytics: digital-share" GET "$BASE/api/v1/property-analytics/$PROPERTY_ID/digital-share"

# -------------------------------------------------------
echo ""
echo "▶ Trade Areas (/api/v1/trade-areas)"
# -------------------------------------------------------
check "Trade-areas: list (GET)"           GET "$BASE/api/v1/trade-areas"
check "Trade-areas: library (GET)"        GET "$BASE/api/v1/trade-areas/library"
check "Trade-areas: :id (GET)"            GET "$BASE/api/v1/trade-areas/$TRADE_AREA_ID"
check "Trade-areas: POST create"          POST "$BASE/api/v1/trade-areas" \
  -d '{"name":"Test Trade Area","municipality":"Atlanta","state":"GA"}'
check "Trade-areas: POST generate"        POST "$BASE/api/v1/trade-areas/generate" \
  -d '{"dealId":"'"$DEAL_ID"'","radiusMiles":3}'
check "Trade-areas: POST preview-stats"   POST "$BASE/api/v1/trade-areas/preview-stats" \
  -d '{"bounds":{"north":34,"south":33,"east":-84,"west":-85}}'
check "Trade-areas: POST radius"          POST "$BASE/api/v1/trade-areas/radius" \
  -d '{"latitude":33.749,"longitude":-84.388,"radiusMiles":3}'
check "Trade-areas: PUT :id"              PUT "$BASE/api/v1/trade-areas/$TRADE_AREA_ID" \
  -d '{"name":"Updated Trade Area"}'
check "Trade-areas: DELETE :id"           DELETE "$BASE/api/v1/trade-areas/00000000-0000-0000-0000-000000000001"

# -------------------------------------------------------
echo ""
echo "▶ Deal Market Intelligence (/api/v1/deals)"
# -------------------------------------------------------
check "Deal: market-intelligence"         GET "$BASE/api/v1/deals/$DEAL_ID/market-intelligence"

# -------------------------------------------------------
echo ""
echo "▶ Deal Context (/api/v1/deals — deal-context.routes.ts)"
# -------------------------------------------------------
check "Deal-context: /:dealId/context (GET)"   GET "$BASE/api/v1/deals/$DEAL_ID/context"
check "Deal-context: /:dealId/context (PATCH)" PATCH "$BASE/api/v1/deals/$DEAL_ID/context" \
  -d '{"notes":"Updated context"}'
check "Deal-context: /:dealId/recompute (POST)" POST "$BASE/api/v1/deals/$DEAL_ID/recompute" \
  -d '{}'

# -------------------------------------------------------
echo ""
echo "▶ Deal Assumptions (/api/v1/deals — deal-assumptions.routes.ts)"
# -------------------------------------------------------
check "Deal-assumptions: GET"             GET "$BASE/api/v1/deals/$DEAL_ID/assumptions"
check "Deal-assumptions: full-context"    GET "$BASE/api/v1/deals/$DEAL_ID/full-context"
check "Deal-assumptions: PUT"             PUT "$BASE/api/v1/deals/$DEAL_ID/assumptions" \
  -d '{"rentGrowth":0.03,"capRate":0.05}'
check "Deal-assumptions: compute-returns" POST "$BASE/api/v1/deals/$DEAL_ID/compute-returns" \
  -d '{"exitYear":5}'
check "Deal-assumptions: site-data PUT"   PUT "$BASE/api/v1/deals/$DEAL_ID/site-data" \
  -d '{"lotSize":2.5}'

# -------------------------------------------------------
echo ""
echo "▶ Site Intelligence (/api/v1 — site-intelligence.routes.ts)"
# -------------------------------------------------------
check "Site-intel: deals/:dealId GET"     GET "$BASE/api/v1/deals/$DEAL_ID/site-intelligence"
check "Site-intel: deals/:dealId POST"    POST "$BASE/api/v1/deals/$DEAL_ID/site-intelligence" \
  -d '{"forceRefresh":false}'
check "Site-intel: deals/:dealId DELETE"  DELETE "$BASE/api/v1/deals/$DEAL_ID/site-intelligence"

# -------------------------------------------------------
echo ""
echo "▶ Geographic Context (/api/v1 and /api/v1/deals)"
# NOTE: geographic-context.routes.ts mounted at BOTH /api/v1 and /api/v1/deals.
# Routes: /:id/geographic-context (GET/POST/PUT), /submarkets/lookup, /msas/lookup
# -------------------------------------------------------
check "Geo-ctx: /submarkets/lookup"       GET "$BASE/api/v1/submarkets/lookup?lat=33.749&lng=-84.388"
check "Geo-ctx: /msas/lookup"             GET "$BASE/api/v1/msas/lookup?lat=33.749&lng=-84.388"
check "Geo-ctx: GET deals geographic-ctx" GET "$BASE/api/v1/deals/$DEAL_ID/geographic-context"
check "Geo-ctx: POST deals geographic-ctx" POST "$BASE/api/v1/deals/$DEAL_ID/geographic-context" \
  -d '{"forceRefresh":false}'
check "Geo-ctx: PUT deals geographic-ctx"  PUT "$BASE/api/v1/deals/$DEAL_ID/geographic-context" \
  -d '{"notes":"Updated"}'

# -------------------------------------------------------
echo ""
echo "▶ Visibility (/api/v1/visibility)"
# -------------------------------------------------------
check "Visibility: score/:id (GET)"       GET "$BASE/api/v1/visibility/score/$PROPERTY_ID"
check "Visibility: assessment/:id (GET)"  GET "$BASE/api/v1/visibility/assessment/$PROPERTY_ID"
check "Visibility: POST assess"           POST "$BASE/api/v1/visibility/assess" \
  -d '{"propertyId":"'"$PROPERTY_ID"'","address":"123 Main St","lat":33.749,"lng":-84.388}'
check "Visibility: PUT update/:id"        PUT "$BASE/api/v1/visibility/update/$PROPERTY_ID" \
  -d '{"signageScore":8}'
check "Visibility: POST preview"          POST "$BASE/api/v1/visibility/preview" \
  -d '{"lat":33.749,"lng":-84.388,"address":"123 Main St Atlanta GA"}'

# -------------------------------------------------------
echo ""
echo "▶ M26 Tax (/api/v1 — m26-tax.routes.ts)"
# -------------------------------------------------------
check "M26-tax: GET projection"           GET "$BASE/api/v1/deals/$DEAL_ID/tax/projection"
check "M26-tax: GET tax summary"          GET "$BASE/api/v1/deals/$DEAL_ID/tax/summary"
check "M26-tax: POST projection"          POST "$BASE/api/v1/deals/$DEAL_ID/tax/projection" \
  -d '{"assessedValue":5000000,"millageRate":0.025}'

# -------------------------------------------------------
echo ""
echo "▶ Deal Comp Sets (/api/v1/deals)"
# -------------------------------------------------------
check "Comp-sets: GET /:dealId/comp-set"  GET "$BASE/api/v1/deals/$DEAL_ID/comp-set"
check "Comp-sets: GET discover-tiered"    GET "$BASE/api/v1/deals/$DEAL_ID/comp-set/discover-tiered"
check "Comp-sets: POST discover"          POST "$BASE/api/v1/deals/$DEAL_ID/comp-set/discover" \
  -d '{"radius":5}'
check "Comp-sets: POST create comp-set"   POST "$BASE/api/v1/deals/$DEAL_ID/comp-set" \
  -d '{"name":"My Comp Set","propertyIds":[]}'
check "Comp-sets: POST add-to-set"        POST "$BASE/api/v1/deals/$DEAL_ID/comp-set/add-to-set" \
  -d '{"propertyId":"'"$PROPERTY_ID"'"}'

# -------------------------------------------------------
echo ""
echo "▶ Market (basic) (/api/v1/market)"
# -------------------------------------------------------
check "Market: inventory/:city/:state"    GET "$BASE/api/v1/market/inventory/Atlanta/GA"
check "Market: trends/:city/:state"       GET "$BASE/api/v1/market/trends/Atlanta/GA"

# -------------------------------------------------------
echo ""
echo "▶ Geography Routes (geography.routes.ts — NOT MOUNTED)"
# NOTE: geography.routes.ts defines trade-areas, submarkets, msas, geocode, etc.
# but is NOT imported or mounted in index.replit.ts.
# These routes are therefore unreachable and intentionally excluded.
# Individual resources accessible via: /api/v1/trade-areas (trade-areas.routes.ts),
# /api/v1/submarkets/lookup and /api/v1/msas/lookup (geographic-context.routes.ts)
# -------------------------------------------------------
echo "  [INFO] geography.routes.ts is not mounted — routes excluded from test"

# -------------------------------------------------------
echo ""
echo "▶ Not-Mounted Route Files (documentation only)"
# The following route files exist in the codebase but are not mounted:
# - credibility.routes.ts
# - demand-intelligence.routes.ts
# - apartment-locator.routes.ts
# - leasingTraffic.routes.ts (camelCase — different from leasing-traffic.routes.ts)
# - traffic-intelligence.routes.ts
# - geography.routes.ts
# These are intentionally excluded from this smoke test.
# -------------------------------------------------------
echo "  [INFO] 6 unmounted route files excluded (credibility, demand-intelligence,"
echo "         apartment-locator, leasingTraffic, traffic-intelligence, geography)"

# -------------------------------------------------------
echo ""
echo "========================================"
echo "  RESULTS"
echo "========================================"
echo "  PASS: $PASS"
echo "  SKIP: $SKIP  (404/400/403 — no data or restriction, acceptable)"
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

# Exit non-zero if there are failures
[[ $FAIL -eq 0 ]]

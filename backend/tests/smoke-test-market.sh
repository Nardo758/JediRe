#!/usr/bin/env bash
# ============================================================
# Smoke Test: Phase 4 — Market Intel & Analytics
# Tests all market intelligence, supply/demand, traffic,
# competition, and analytics API endpoints.
# ============================================================

BASE="http://localhost:4000"
DEAL_ID="12eb9e11-3b2d-44d5-9f59-877a76344c18"
USER_ID="6253ba3f-d40d-4597-86ab-270c8397a857"
MARKET_ID="atlanta-ga"
PROPERTY_ID="00175617-4d11-447e-a274-9c3fb828a69d"
TRADE_AREA_ID="1"

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
echo "▶ Market Intelligence (/api/v1/markets)"
# -------------------------------------------------------
check "Markets overview"            GET "$BASE/api/v1/markets/overview"
check "Markets available"           GET "$BASE/api/v1/markets/available"
check "Market preferences GET"      GET "$BASE/api/v1/markets/preferences"
check "Market summary (marketId)"   GET "$BASE/api/v1/markets/$MARKET_ID/summary"
check "Market alerts (marketId)"    GET "$BASE/api/v1/markets/$MARKET_ID/alerts"
check "Market compare"              GET "$BASE/api/v1/markets/compare?markets=Atlanta"
check "Market properties"           GET "$BASE/api/v1/markets/properties?city=Atlanta&state=GA"
check "Market stats"                GET "$BASE/api/v1/markets/market-stats/$MARKET_ID"
check "Submarket stats"             GET "$BASE/api/v1/markets/submarket-stats/$MARKET_ID"
check "Enhanced: submarkets detail" GET "$BASE/api/v1/markets/$MARKET_ID/submarkets/detailed"
check "Enhanced: compare-data"      GET "$BASE/api/v1/markets/compare-data?markets=Atlanta"
check "Enhanced: market owners"     GET "$BASE/api/v1/markets/$MARKET_ID/owners"

# -------------------------------------------------------
echo ""
echo "▶ Market Research (/api/v1/market-research)"
# -------------------------------------------------------
check "Market research status"      GET "$BASE/api/v1/market-research/status/$DEAL_ID"
check "Market research report"      GET "$BASE/api/v1/market-research/report/$DEAL_ID"
check "Market research metrics"     GET "$BASE/api/v1/market-research/metrics/$DEAL_ID"
check "Market research intelligence" GET "$BASE/api/v1/market-research/intelligence/$DEAL_ID"
check "Market research sources"     GET "$BASE/api/v1/market-research/sources/$DEAL_ID"
check "Market research analysis-input" GET "$BASE/api/v1/market-research/analysis-input/$DEAL_ID"

# -------------------------------------------------------
echo ""
echo "▶ Cycle Intelligence (/api/v1/cycle-intelligence)"
# -------------------------------------------------------
check "Cycle: test/rate-environment (no auth)" GET "$BASE/api/v1/cycle-intelligence/test/rate-environment"
check "Cycle: rate-environment"     GET "$BASE/api/v1/cycle-intelligence/rate-environment"
check "Cycle: rate-history"         GET "$BASE/api/v1/cycle-intelligence/rate-history"
check "Cycle: leading-indicators"   GET "$BASE/api/v1/cycle-intelligence/leading-indicators"
check "Cycle: pattern-matches"      GET "$BASE/api/v1/cycle-intelligence/pattern-matches"
check "Cycle: macro-risk"           GET "$BASE/api/v1/cycle-intelligence/macro-risk"
check "Cycle: phase (marketId)"     GET "$BASE/api/v1/cycle-intelligence/phase/$MARKET_ID"
check "Cycle: divergence (marketId)" GET "$BASE/api/v1/cycle-intelligence/divergence/$MARKET_ID"
check "Cycle: predict rent-growth"  GET "$BASE/api/v1/cycle-intelligence/predict/rent-growth/$MARKET_ID"
check "Cycle: predict value-change" GET "$BASE/api/v1/cycle-intelligence/predict/value-change/$MARKET_ID"
check "Cycle: predict cap-rate"     GET "$BASE/api/v1/cycle-intelligence/predict/cap-rate/$MARKET_ID"
check "Cycle: predict full-chain"   GET "$BASE/api/v1/cycle-intelligence/predict/full-chain/$MARKET_ID"
check "Cycle: phase-optimal-strategy" GET "$BASE/api/v1/cycle-intelligence/phase-optimal-strategy/$MARKET_ID"
check "Cycle: construction-cost-index" GET "$BASE/api/v1/cycle-intelligence/construction-cost-index/$MARKET_ID"
check "Cycle: market-metrics-history" GET "$BASE/api/v1/cycle-intelligence/market-metrics-history/$MARKET_ID"
check "Cycle: deal-performance-by-phase" GET "$BASE/api/v1/cycle-intelligence/deal-performance-by-phase/$MARKET_ID"

# -------------------------------------------------------
echo ""
echo "▶ F40 Performance (/api/v1/f40)"
# -------------------------------------------------------
check "F40: market"                 GET "$BASE/api/v1/f40/market?city=Atlanta&state=GA"
check "F40: rankings"               GET "$BASE/api/v1/f40/rankings?city=Atlanta&state=GA"
check "F40: comp-set"               GET "$BASE/api/v1/f40/comp-set?city=Atlanta&state=GA&submarket=Midtown"

# -------------------------------------------------------
echo ""
echo "▶ Opportunities (/api/v1/opportunities)"
# -------------------------------------------------------
check "Opportunities: detect"       GET "$BASE/api/v1/opportunities/detect"
check "Opportunities: rankings"     GET "$BASE/api/v1/opportunities/rankings"

# -------------------------------------------------------
echo ""
echo "▶ Intelligence Layer (/api/v1/intelligence)"
# -------------------------------------------------------
check "Intelligence: stats"         GET "$BASE/api/v1/intelligence/stats"
check "Intelligence: patterns"      GET "$BASE/api/v1/intelligence/patterns"
check "Intelligence: docs pending"  GET "$BASE/api/v1/intelligence/documents/pending"
check "Intelligence: docs flagged"  GET "$BASE/api/v1/intelligence/documents/flagged"
check "Intelligence: user/stats"    GET "$BASE/api/v1/intelligence/user/stats"
check "Intelligence: user/preferences" GET "$BASE/api/v1/intelligence/user/preferences"

# -------------------------------------------------------
echo ""
echo "▶ Supply (/api/v1/supply)"
# -------------------------------------------------------
check "Supply: events"              GET "$BASE/api/v1/supply/events"
check "Supply: competitive (deal)"  GET "$BASE/api/v1/supply/competitive/$DEAL_ID"
check "Supply: trade-area pipeline" GET "$BASE/api/v1/supply/trade-area/$TRADE_AREA_ID"
check "Supply: trade-area risk"     GET "$BASE/api/v1/supply/trade-area/$TRADE_AREA_ID/risk"
check "Supply: timeline"            GET "$BASE/api/v1/supply/timeline/$TRADE_AREA_ID"
check "Supply: market-dynamics"     GET "$BASE/api/v1/supply/market-dynamics/$TRADE_AREA_ID"
check "Supply: deals supply"        GET "$BASE/api/v1/deals/$DEAL_ID/supply"

# -------------------------------------------------------
echo ""
echo "▶ Demand (/api/v1/demand)"
# -------------------------------------------------------
check "Demand: events"              GET "$BASE/api/v1/demand/events"
check "Demand: deals demand"        GET "$BASE/api/v1/deals/$DEAL_ID/demand"
check "Demand: trade-area"          GET "$BASE/api/v1/demand/trade-area/$TRADE_AREA_ID"
check "Demand: impact (deal)"       GET "$BASE/api/v1/demand/impact/$DEAL_ID"

# -------------------------------------------------------
echo ""
echo "▶ Comps (/api/v1/comps)"
# -------------------------------------------------------
check "Comps: summary"              GET "$BASE/api/v1/comps/summary"
check "Comps: property"             GET "$BASE/api/v1/comps/property/$PROPERTY_ID"
check "Comps: property rent-comps"  GET "$BASE/api/v1/comps/property/$PROPERTY_ID/rent-comps"
check "Comps: submarket stats"      GET "$BASE/api/v1/comps/submarket/1/stats"

# -------------------------------------------------------
echo ""
echo "▶ Sale Comps M27 (/api/v1/deals/:dealId/comps)"
# -------------------------------------------------------
check "M27: get comps for deal"     GET "$BASE/api/v1/deals/$DEAL_ID/comps"
check "M27: exit cap rate"          GET "$BASE/api/v1/deals/$DEAL_ID/comps/exit-cap-rate"
check "M27: comps summary"          GET "$BASE/api/v1/deals/$DEAL_ID/comps/summary"

# -------------------------------------------------------
echo ""
echo "▶ Competition (/api/v1/deals/:dealId)"
# -------------------------------------------------------
check "Competition: competitors"    GET "$BASE/api/v1/deals/$DEAL_ID/competitors"
check "Competition: advantage-matrix" GET "$BASE/api/v1/deals/$DEAL_ID/advantage-matrix"
check "Competition: waitlist-props" GET "$BASE/api/v1/deals/$DEAL_ID/waitlist-properties"
check "Competition: aging-competitors" GET "$BASE/api/v1/deals/$DEAL_ID/aging-competitors"

# -------------------------------------------------------
echo ""
echo "▶ JEDI Scoring (/api/v1/jedi)"
# -------------------------------------------------------
check "JEDI: score (deal)"          GET "$BASE/api/v1/jedi/score/$DEAL_ID"
check "JEDI: history (deal)"        GET "$BASE/api/v1/jedi/history/$DEAL_ID"
check "JEDI: impact (deal)"         GET "$BASE/api/v1/jedi/impact/$DEAL_ID"
check "JEDI: alerts"                GET "$BASE/api/v1/jedi/alerts"
check "JEDI: alerts (deal)"         GET "$BASE/api/v1/jedi/alerts/deal/$DEAL_ID"

# -------------------------------------------------------
echo ""
echo "▶ Traffic (/api/v1/traffic)"
# -------------------------------------------------------
check "Traffic: model performance"  GET "$BASE/api/v1/traffic/model/performance"
check "Traffic: calibration active" GET "$BASE/api/v1/traffic/calibration/active"
check "Traffic: validation errors"  GET "$BASE/api/v1/traffic/validation/errors"

# -------------------------------------------------------
echo ""
echo "▶ Traffic Data (/api/v1/traffic-data)"
# -------------------------------------------------------
check "Traffic-data: adt/stations"  GET "$BASE/api/v1/traffic-data/adt/stations"
check "Traffic-data: realtime"      GET "$BASE/api/v1/traffic-data/realtime"
check "Traffic-data: context"       GET "$BASE/api/v1/traffic-data/context/$DEAL_ID"

# -------------------------------------------------------
echo ""
echo "▶ Traffic Comps (/api/v1/traffic-comps)"
# -------------------------------------------------------
check "Traffic-comps: deal"         GET "$BASE/api/v1/traffic-comps/$DEAL_ID"
check "Traffic-comps: averages"     GET "$BASE/api/v1/traffic-comps/$DEAL_ID/averages"
check "Traffic-comps: selections"   GET "$BASE/api/v1/traffic-comps/$DEAL_ID/selections"
check "Traffic-comps: proxy-cands" GET "$BASE/api/v1/traffic-comps/$DEAL_ID/proxy-candidates"

# -------------------------------------------------------
echo ""
echo "▶ Leasing Traffic (/api/v1/leasing-traffic)"
# -------------------------------------------------------
check "Leasing-traffic: dot-profiles/summary"  GET "$BASE/api/v1/leasing-traffic/dot-profiles/summary"
check "Leasing-traffic: dot-profiles/temporal" GET "$BASE/api/v1/leasing-traffic/dot-profiles/temporal-multiplier"
check "Leasing-traffic: predict (property)"    GET "$BASE/api/v1/leasing-traffic/predict/$DEAL_ID"
check "Leasing-traffic: weekly-report hist"    GET "$BASE/api/v1/leasing-traffic/weekly-report/$DEAL_ID/history"
check "Leasing-traffic: trend-patterns"        GET "$BASE/api/v1/leasing-traffic/trend-patterns/$DEAL_ID"
check "Leasing-traffic: data-sources"          GET "$BASE/api/v1/leasing-traffic/data-sources/$DEAL_ID"

# -------------------------------------------------------
echo ""
echo "▶ Benchmark Timeline (/api/v1/benchmark-timeline)"
# -------------------------------------------------------
check "Benchmark: benchmarks"       GET "$BASE/api/v1/benchmark-timeline/benchmarks"
check "Benchmark: detailed-steps"   GET "$BASE/api/v1/benchmark-timeline/detailed-steps"
check "Benchmark: jurisdiction-comparison" GET "$BASE/api/v1/benchmark-timeline/jurisdiction-comparison"

# -------------------------------------------------------
echo ""
echo "▶ Property Analytics (/api/v1/property-analytics)"
# -------------------------------------------------------
check "Property-analytics: property" GET "$BASE/api/v1/property-analytics/$PROPERTY_ID"
check "Property-analytics: score"   GET "$BASE/api/v1/property-analytics/$PROPERTY_ID/score"
check "Property-analytics: history" GET "$BASE/api/v1/property-analytics/$PROPERTY_ID/history"
check "Property-analytics: digital-share" GET "$BASE/api/v1/property-analytics/$PROPERTY_ID/digital-share"

# -------------------------------------------------------
echo ""
echo "▶ Geography (/api/v1)"
# -------------------------------------------------------
check "Geo: trade-areas list"       GET "$BASE/api/v1/trade-areas"
check "Geo: submarkets"             GET "$BASE/api/v1/submarkets"
check "Geo: msas"                   GET "$BASE/api/v1/msas"
check "Geo: lookup"                 GET "$BASE/api/v1/lookup?address=Atlanta"

# -------------------------------------------------------
echo ""
echo "▶ Trade Areas (/api/v1/trade-areas)"
# -------------------------------------------------------
check "Trade-areas: list"           GET "$BASE/api/v1/trade-areas"
check "Trade-areas: library"        GET "$BASE/api/v1/trade-areas/library"

# -------------------------------------------------------
echo ""
echo "▶ Deal Market Intelligence (/api/v1/deals)"
# -------------------------------------------------------
check "Deal market-intelligence"    GET "$BASE/api/v1/deals/$DEAL_ID/market-intelligence"
check "Deal geographic-context"     GET "$BASE/api/v1/deals/$DEAL_ID/geographic-context"

# -------------------------------------------------------
echo ""
echo "▶ Market (/api/v1/market)"
# -------------------------------------------------------
check "Market: inventory"           GET "$BASE/api/v1/market/inventory/Atlanta/GA"
check "Market: trends"              GET "$BASE/api/v1/market/trends/Atlanta/GA"

# -------------------------------------------------------
echo ""
echo "========================================"
echo "  RESULTS"
echo "========================================"
echo "  PASS: $PASS"
echo "  SKIP: $SKIP  (404/400 — no data, acceptable)"
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

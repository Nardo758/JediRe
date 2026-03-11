#!/bin/bash
# Phase 3: Financial & Strategy Smoke Test
set -o pipefail

BASE="http://localhost:4000"
DEAL="e044db04-439b-4442-82df-b36a840f2fd8"
USER_ID="6253ba3f-d40d-4597-86ab-270c8397a857"
PASS=0; WARN=0; FAIL=0; TOTAL=0
RESULTS_FILE="${1:-/tmp/smoke-results-phase3.txt}"

JWT=$(cd /home/runner/workspace/backend && node -e "const jwt=require('jsonwebtoken');console.log(jwt.sign({userId:'$USER_ID',email:'demo@jedire.com',role:'investor'},process.env.JWT_SECRET||'your-secret-key-change-this',{expiresIn:'1h',algorithm:'HS256',issuer:'jedire-api',audience:'jedire-client'}))")

t() {
  local method=$1 url=$2 label=$3 data=$4 auth=${5:-jwt}
  TOTAL=$((TOTAL+1))
  local auth_header="Authorization: Bearer $JWT"
  if [ "$auth" = "none" ]; then auth_header="X-No-Auth: true"; fi
  local body="$data"
  if [ -z "$body" ]; then body='{}'; fi

  if [ "$method" = "POST" ] || [ "$method" = "PUT" ] || [ "$method" = "PATCH" ]; then
    local code=$(curl -s -o /tmp/resp.json -w '%{http_code}' -X "$method" -H "$auth_header" -H "Content-Type: application/json" "$BASE$url" -d "$body" --max-time 5 2>/dev/null)
  elif [ "$method" = "DELETE" ]; then
    local code=$(curl -s -o /tmp/resp.json -w '%{http_code}' -X DELETE -H "$auth_header" "$BASE$url" --max-time 5 2>/dev/null)
  else
    local code=$(curl -s -o /tmp/resp.json -w '%{http_code}' -H "$auth_header" "$BASE$url" --max-time 5 2>/dev/null)
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
echo "=== PHASE 3: FINANCIAL & STRATEGY ==="

echo "--- financial-models (mount: /api/v1/financial-models) ---"
t GET "/api/v1/financial-models" "fin-models: GET /"
t GET "/api/v1/financial-models/$DEAL" "fin-models: GET /:dealId"
t POST "/api/v1/financial-models" "fin-models: POST /" '{"dealId":"'"$DEAL"'","name":"Smoke Test Model"}'
t GET "/api/v1/financial-models/$DEAL/assumptions" "fin-models: GET /:dealId/assumptions"
t PATCH "/api/v1/financial-models/$DEAL/assumptions" "fin-models: PATCH assumptions" '{"capRate":5.5}'
t POST "/api/v1/financial-models/$DEAL/validate" "fin-models: POST validate"
t POST "/api/v1/financial-models/$DEAL/compute-claude" "fin-models: POST compute-claude"
t GET "/api/v1/financial-models/$DEAL/claude-output" "fin-models: GET claude-output"

echo "--- financial-model (mount: /api/v1/financial-model) ---"
t POST "/api/v1/financial-model/build" "fin-model: POST build" '{"dealId":"'"$DEAL"'"}'
t GET "/api/v1/financial-model/$DEAL/latest" "fin-model: GET latest"
t GET "/api/v1/financial-model/$DEAL/export/excel" "fin-model: GET export/excel"

echo "--- financial-dashboard (mount: /api/v1/financial-dashboard) ---"
t GET "/api/v1/financial-dashboard/$DEAL/summary" "fin-dashboard: GET summary"
t POST "/api/v1/financial-dashboard/$DEAL/auto-assumptions" "fin-dashboard: POST auto-assumptions"
t POST "/api/v1/financial-dashboard/$DEAL/analyze" "fin-dashboard: POST analyze"

echo "--- capital-structure (mount: /api/v1/capital-structure) ---"
t POST "/api/v1/capital-structure/stack" "cap-struct: POST stack" '{"purchasePrice":10000000,"ltv":0.7,"equityPercent":0.3}'
t POST "/api/v1/capital-structure/size-senior" "cap-struct: POST size-senior" '{"noi":500000,"dscr":1.25,"rate":0.06,"term":30}'
t POST "/api/v1/capital-structure/size-mezz" "cap-struct: POST size-mezz" '{"seniorLoan":7000000,"totalCost":10000000,"maxCombinedLtc":0.85}'
t POST "/api/v1/capital-structure/insights" "cap-struct: POST insights" '{"purchasePrice":10000000,"noi":500000,"seniorDebt":7000000}'
t POST "/api/v1/capital-structure/debt-products/recommend" "cap-struct: POST debt-products/recommend" '{"dealType":"acquisition","noi":500000,"loanAmount":7000000}'
t POST "/api/v1/capital-structure/debt-products/mismatch" "cap-struct: POST debt-products/mismatch" '{"selectedProduct":"agency","dealProfile":{"holdPeriod":3}}'
t POST "/api/v1/capital-structure/rate/cycle-phase" "cap-struct: POST rate/cycle-phase" '{"currentRate":0.065}'
t POST "/api/v1/capital-structure/rate/all-in" "cap-struct: POST rate/all-in" '{"baseRate":0.055,"spread":0.015}'
t POST "/api/v1/capital-structure/rate/lock-vs-float" "cap-struct: POST rate/lock-vs-float" '{"fixedRate":0.065,"floatingSpread":0.02}'
t POST "/api/v1/capital-structure/rate/sensitivity" "cap-struct: POST rate/sensitivity" '{"loanAmount":7000000,"currentRate":0.065,"noi":500000}'
t POST "/api/v1/capital-structure/rate/spread-percentile" "cap-struct: POST rate/spread-percentile" '{"spread":150}'
t POST "/api/v1/capital-structure/waterfall" "cap-struct: POST waterfall" '{"equity":3000000,"debt":7000000,"noi":500000,"holdPeriod":5}'
t POST "/api/v1/capital-structure/scenarios/compare" "cap-struct: POST scenarios/compare" '{"scenarios":[{"name":"Base","ltv":0.7,"rate":0.065}]}'
t POST "/api/v1/capital-structure/lifecycle/refi" "cap-struct: POST lifecycle/refi" '{"currentBalance":6500000,"currentRate":0.07,"newRate":0.06,"noi":500000}'
t POST "/api/v1/capital-structure/lifecycle/draw-progress" "cap-struct: POST lifecycle/draw-progress" '{"totalCommitment":10000000,"drawnAmount":4000000}'
t GET "/api/v1/capital-structure/rates/live" "cap-struct: GET rates/live"
t GET "/api/v1/capital-structure/rates/history?period=30d" "cap-struct: GET rates/history"
t GET "/api/v1/capital-structure/rate-sheet/$DEAL/latest" "cap-struct: GET rate-sheet/latest"
t POST "/api/v1/capital-structure/optimal-strategy" "cap-struct: POST optimal-strategy" '{"dealId":"'"$DEAL"'","noi":500000,"purchasePrice":10000000}'

echo "--- proforma (mount: /api/v1/deals) ---"
t GET "/api/v1/deals/$DEAL/proforma" "proforma: GET /:dealId"
t POST "/api/v1/deals/$DEAL/proforma/initialize" "proforma: POST initialize"
t GET "/api/v1/deals/$DEAL/proforma/history" "proforma: GET history"
t GET "/api/v1/deals/$DEAL/proforma/adjustments" "proforma: GET adjustments"
t POST "/api/v1/deals/$DEAL/proforma/recalculate" "proforma: POST recalculate"
t GET "/api/v1/deals/$DEAL/proforma/comparison" "proforma: GET comparison"
t GET "/api/v1/deals/$DEAL/proforma/export" "proforma: GET export"
t POST "/api/v1/deals/batch/recalculate" "proforma: POST batch/recalculate" '{"dealIds":["'"$DEAL"'"]}'
t PATCH "/api/v1/deals/$DEAL/proforma/override" "proforma: PATCH override" '{"assumptionType":"rent_growth","value":3.5}'

echo "--- proforma-generator (mount: /api/v1/properties) ---"
t POST "/api/v1/properties/$DEAL/proforma/generate" "proforma-gen: POST generate" '{"template":"standard"}'
t GET "/api/v1/properties/$DEAL/proforma/snapshots" "proforma-gen: GET snapshots"
t GET "/api/v1/properties/templates" "proforma-gen: GET templates"

echo "--- deal-assumptions (mount: /api/v1/deals) ---"
t GET "/api/v1/deals/$DEAL/assumptions" "deal-assumptions: GET"
t PUT "/api/v1/deals/$DEAL/assumptions" "deal-assumptions: PUT" '{"rent_growth":3.0}'
t POST "/api/v1/deals/$DEAL/compute-returns" "deal-assumptions: POST compute-returns"
t PUT "/api/v1/deals/$DEAL/site-data" "deal-assumptions: PUT site-data" '{"landArea":43560}'
t GET "/api/v1/deals/$DEAL/full-context" "deal-assumptions: GET full-context"

echo "--- strategy-analyses (mount: /api/v1/strategy-analyses) ---"
t GET "/api/v1/strategy-analyses/$DEAL" "strategy: GET /:dealId"
t POST "/api/v1/strategy-analyses" "strategy: POST /" '{"dealId":"'"$DEAL"'","strategyType":"value_add"}'
t POST "/api/v1/strategy-analyses/compare" "strategy: POST compare" '{"dealId":"'"$DEAL"'","strategies":["value_add","core_plus"]}'

echo "--- dd-checklists (mount: /api/v1/dd-checklists) ---"
t GET "/api/v1/dd-checklists/$DEAL" "dd-checklists: GET /:dealId"

echo "--- deal-validation (mount: /api/v1/deals) ---"
t POST "/api/v1/deals/$DEAL/validate" "deal-validate: POST validate"
t GET "/api/v1/deals/$DEAL/validation-status" "deal-validate: GET status"
t POST "/api/v1/deals/validate-all" "deal-validate: POST validate-all"

echo "--- deal-comp-sets (mount: /api/v1/deals) ---"
t GET "/api/v1/deals/$DEAL/comp-set" "comp-set: GET"
t POST "/api/v1/deals/$DEAL/comp-set/discover" "comp-set: POST discover"

echo "--- competition (mount: /api/v1/deals) ---"
t GET "/api/v1/deals/$DEAL/competitors" "competition: GET competitors"
t GET "/api/v1/deals/$DEAL/advantage-matrix" "competition: GET advantage-matrix"
t GET "/api/v1/deals/$DEAL/waitlist-properties" "competition: GET waitlist-properties"
t GET "/api/v1/deals/$DEAL/aging-competitors" "competition: GET aging-competitors"
t GET "/api/v1/deals/$DEAL/competition-insights" "competition: GET insights"
t GET "/api/v1/deals/$DEAL/competition-export" "competition: GET export"
t GET "/api/v1/deals/$DEAL/competitive-ranking" "competition: GET ranking"

echo "--- unit-mix-propagation (mount: /api/v1/deals) ---"
t GET "/api/v1/deals/$DEAL/unit-mix/status" "unit-mix: GET status"
t POST "/api/v1/deals/$DEAL/unit-mix/set" "unit-mix: POST set" '{"units":[{"type":"1BR","count":50,"rent":1500,"sqft":750}]}'
t POST "/api/v1/deals/$DEAL/unit-mix/apply" "unit-mix: POST apply" '{"targetModules":["proforma"]}'
t POST "/api/v1/deals/$DEAL/development-path/select" "unit-mix: POST dev-path/select" '{"pathId":"base"}'

echo "--- development-scenarios (mount: /api/v1) ---"
t GET "/api/v1/deals/$DEAL/scenarios" "dev-scenarios: GET /"
t GET "/api/v1/deals/$DEAL/scenarios/hbu" "dev-scenarios: GET hbu"
t GET "/api/v1/deals/$DEAL/scenarios/recommendations" "dev-scenarios: GET recommendations"
t GET "/api/v1/deals/$DEAL/scenarios/lookup-district?code=MRC-2-C" "dev-scenarios: GET lookup-district"
t GET "/api/v1/deals/$DEAL/regulatory-risk-analysis" "dev-scenarios: GET regulatory-risk"
t GET "/api/v1/deals/$DEAL/timeline-intelligence" "dev-scenarios: GET timeline-intel"
t GET "/api/v1/deals/$DEAL/rezone-analysis" "dev-scenarios: GET rezone-analysis"
t GET "/api/v1/deals/$DEAL/envelope-enrichment" "dev-scenarios: GET envelope-enrichment"
t POST "/api/v1/deals/$DEAL/scenarios" "dev-scenarios: POST create" '{"name":"Smoke Test","zoningCode":"MRC-2-C","maxUnits":200}'
t POST "/api/v1/deals/$DEAL/scenarios/deactivate-all" "dev-scenarios: POST deactivate-all"

echo "--- benchmark-timeline (mount: /api/v1/benchmark-timeline) ---"
t POST "/api/v1/benchmark-timeline/simulate" "bench-timeline: POST simulate" '{"municipality":"Atlanta","projectType":"multifamily","units":200}'
t GET "/api/v1/benchmark-timeline/benchmarks?municipality=Atlanta" "bench-timeline: GET benchmarks"
t POST "/api/v1/benchmark-timeline/compare-paths" "bench-timeline: POST compare-paths" '{"dealId":"'"$DEAL"'","paths":["by_right","rezone"]}'
t GET "/api/v1/benchmark-timeline/detailed-steps?municipality=Atlanta&projectType=multifamily" "bench-timeline: GET detailed-steps"
t GET "/api/v1/benchmark-timeline/jurisdiction-comparison" "bench-timeline: GET jurisdiction-comparison"

echo "--- m26-tax (mount: /api/v1) ---"
t GET "/api/v1/deals/$DEAL/tax/projection" "m26-tax: GET projection"
t POST "/api/v1/deals/$DEAL/tax/projection" "m26-tax: POST projection" '{"purchasePrice":10000000,"assessedValue":8000000}'
t GET "/api/v1/deals/$DEAL/tax/summary" "m26-tax: GET summary"

echo "--- tax-comp-analysis (mount: /api/v1) ---"
t GET "/api/v1/deals/$DEAL/tax/comp-analysis" "tax-comp: GET"
t POST "/api/v1/deals/$DEAL/tax/comp-analysis" "tax-comp: POST" '{"radius":2,"propertyType":"multifamily"}'
t GET "/api/v1/deals/$DEAL/tax/comp-analysis/summary" "tax-comp: GET summary"

echo "--- f40-performance (mount: /api/v1/f40) ---"
t GET "/api/v1/f40/market" "f40: GET market"
t GET "/api/v1/f40/rankings" "f40: GET rankings"
t GET "/api/v1/f40/comp-set" "f40: GET comp-set"
t POST "/api/v1/f40/calculate" "f40: POST calculate" '{"propertyId":"'"$DEAL"'"}'

echo "--- opportunity-engine (mount: /api/v1/opportunities) ---"
t GET "/api/v1/opportunities/detect" "opportunity: GET detect"
t GET "/api/v1/opportunities/rankings" "opportunity: GET rankings"

echo "--- cycle-intelligence (mount: /api/v1/cycle-intelligence) ---"
t GET "/api/v1/cycle-intelligence/phase/atlanta" "cycle-intel: GET phase"
t GET "/api/v1/cycle-intelligence/phases" "cycle-intel: GET phases"
t GET "/api/v1/cycle-intelligence/divergence/atlanta" "cycle-intel: GET divergence"
t GET "/api/v1/cycle-intelligence/rate-environment" "cycle-intel: GET rate-env"
t GET "/api/v1/cycle-intelligence/rate-history" "cycle-intel: GET rate-history"
t GET "/api/v1/cycle-intelligence/leading-indicators" "cycle-intel: GET indicators"
t GET "/api/v1/cycle-intelligence/pattern-matches" "cycle-intel: GET patterns"
t GET "/api/v1/cycle-intelligence/predict/rent-growth/atlanta" "cycle-intel: GET predict/rent"
t GET "/api/v1/cycle-intelligence/predict/value-change/atlanta" "cycle-intel: GET predict/value"
t GET "/api/v1/cycle-intelligence/predict/cap-rate/atlanta" "cycle-intel: GET predict/cap"
t GET "/api/v1/cycle-intelligence/predict/full-chain/atlanta" "cycle-intel: GET predict/chain"
t GET "/api/v1/cycle-intelligence/phase-optimal-strategy/atlanta" "cycle-intel: GET strategy"
t GET "/api/v1/cycle-intelligence/construction-cost-index/atlanta" "cycle-intel: GET const-cost"
t GET "/api/v1/cycle-intelligence/macro-risk" "cycle-intel: GET macro-risk"
t GET "/api/v1/cycle-intelligence/market-metrics-history/atlanta" "cycle-intel: GET metrics-hist"
t GET "/api/v1/cycle-intelligence/deal-performance-by-phase/atlanta" "cycle-intel: GET deal-perf"
t GET "/api/v1/cycle-intelligence/test/rate-environment" "cycle-intel: test rate-env" "" "none"
t GET "/api/v1/cycle-intelligence/test/leading-indicators" "cycle-intel: test indicators" "" "none"

echo "--- opus (mount: /api/v1/opus) ---"
t GET "/api/v1/opus/conversations" "opus: GET conversations"
t POST "/api/v1/opus/conversations" "opus: POST conversations" '{"dealId":"'"$DEAL"'","title":"Smoke Test"}'
t GET "/api/v1/opus/proforma-versions" "opus: GET proforma-versions"

echo "--- data-library (mount: /api/v1/data-library) ---"
t GET "/api/v1/data-library" "data-lib: GET /"
t GET "/api/v1/data-library/comparables" "data-lib: GET comparables"

echo "--- deal-timeline (mount: /api/v1/deal-timeline) ---"
t GET "/api/v1/deal-timeline/deal/$DEAL" "deal-timeline: GET deal"
t GET "/api/v1/deal-timeline/benchmarks/atlanta" "deal-timeline: GET benchmarks"
t GET "/api/v1/deal-timeline/jurisdiction-comparison" "deal-timeline: GET jurisdiction"
t GET "/api/v1/deal-timeline/carrying-costs/$DEAL" "deal-timeline: GET carrying-costs"

echo ""
echo "=== PHASE 3 SUMMARY ==="
echo "Total: $TOTAL | PASS: $PASS | WARN: $WARN | FAIL: $FAIL"

if [ $FAIL -gt 0 ]; then
  echo ""
  echo "=== FAILURES (500+) ==="
  grep "^FAIL" "$RESULTS_FILE"
fi

if [ $WARN -gt 0 ]; then
  echo ""
  echo "=== WARNINGS (4xx) ==="
  grep "^WARN" "$RESULTS_FILE"
fi

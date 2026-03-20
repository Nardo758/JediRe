#!/usr/bin/env bash
# ============================================================
# JediRe Smoke Test Phase 3 — Financial & Strategy Routes
#
# Route files covered (mounted):
#   proforma.routes.ts            → /api/v1/deals          (12)
#   proforma-generator.routes.ts  → /api/v1/properties     (9)
#   financial-dashboard.routes.ts → /api/v1/financial-dashboard (7)
#   financial-model.routes.ts     → /api/v1/financial-model & /api/v1/deals (3)
#   financial-models.routes.ts    → /api/v1/financial-models (10)
#   capital-structure.routes.ts   → /api/v1/capital-structure (20)
#   custom-strategies.routes.ts   → /api/v1/custom-strategies (10)
#   strategy-analyses.routes.ts   → /api/v1/strategy-analyses (5)
#   opus.routes.ts                → /api/v1/opus            (9)
#   calibration.routes.ts         → /api/calibration        (10)
#   m26-tax.routes.ts             → /api/v1                 (3)
#   tax-comp-analysis.routes.ts   → /api/v1                 (3)
#   unit-mix-propagation.routes.ts→ /api/v1/deals           (4)
#   unitMix.routes.ts             → /api/v1/unit-mix        (5)
#   data-library.routes.ts        → /api/v1/data-library    (6)
#   data-upload.routes.ts         → /api/v1/properties      (2 safe GETs)
#   upload.routes.ts              → /api/v1/uploads         (3)
#   upload-templates.routes.ts    → /api/v1/upload-templates(2)
#   settings-ai.routes.ts         → /api/v1/settings/ai-preferences (2)
#   training.routes.ts            → /api/training           (8)
#   correlation.routes.ts         → /api/v1/correlations    (6)
#
# NOT mounted (tested as expected-4xx):
#   financial-assumptions.routes.ts (5)
#   scenarios.routes.ts             (10)
#   risk.routes.ts                  (18)
#   analysis.routes.ts              (6)
#   llm.routes.ts                   (5)
#   qwen.routes.ts                  (5)
# ============================================================
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:4000}"
DEAL_ID="${DEAL_ID:-12eb9e11-3b2d-44d5-9f59-877a76344c18}"
PROP_ID="${PROP_ID:-750a68ce-d0cf-4d3e-b184-82335a774b9c}"
USER_ID="${USER_ID:-6253ba3f-d40d-4597-86ab-270c8397a857}"
TRADE_AREA_ID="${TRADE_AREA_ID:-00000000-0000-0000-0000-000000000001}"
JWT_SECRET="${JWT_SECRET:-your-secret-key-change-this}"
ADMIN_API_KEY="${ADMIN_API_KEY:-test-admin-key-smoke}"
REPORT_OUT="${REPORT_OUT:-$(dirname "$0")/smoke-results-financial.txt}"
TIMEOUT="${TIMEOUT:-8}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

PASS=0; WARN=0; FAIL=0; TOTAL=0
FAIL_LIST=()

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
  echo "ERROR: Could not generate JWT tokens"
  exit 1
fi

echo "============================================================"
echo " JediRe Financial & Strategy Smoke Test (Phase 3)"
echo " BASE_URL : $BASE_URL"
echo " DEAL_ID  : $DEAL_ID"
echo " PROP_ID  : $PROP_ID"
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
    apikey) curl_args+=(-H "x-api-key: $ADMIN_API_KEY") ;;
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

FAKE_ID="00000000-0000-0000-0000-000000000099"
FAKE_SNAP_ID="00000000-0000-0000-0000-000000000098"
FAKE_STRAT_ID="00000000-0000-0000-0000-000000000097"
FAKE_MODEL_ID="00000000-0000-0000-0000-000000000096"
FAKE_CONV_ID="00000000-0000-0000-0000-000000000095"

# ============================================================
# PRO FORMA ADJUSTMENTS (proformaRouter → /api/v1/deals, requires JWT)
# ============================================================
section "PRO FORMA ADJUSTMENTS"
hit GET    "/api/v1/deals/$DEAL_ID/proforma"                                   jwt
hit POST   "/api/v1/deals/$DEAL_ID/proforma/initialize"                        jwt \
  '{"strategy":"rental"}'
hit GET    "/api/v1/deals/$DEAL_ID/proforma/history"                           jwt
hit GET    "/api/v1/deals/$DEAL_ID/proforma/adjustments"                       jwt
hit POST   "/api/v1/deals/$DEAL_ID/proforma/recalculate"                       jwt \
  '{"triggerType":"periodic_update"}'
hit PATCH  "/api/v1/deals/$DEAL_ID/proforma/override"                          jwt \
  '{"assumptionType":"rent_growth","value":3.5,"reason":"Smoke test override"}'
hit GET    "/api/v1/deals/$DEAL_ID/proforma/comparison"                        jwt
hit DELETE "/api/v1/deals/$DEAL_ID/proforma/override/rent_growth"              jwt
hit POST   "/api/v1/deals/batch/proforma/recalculate"                          jwt \
  "{\"dealIds\":[\"$DEAL_ID\"]}"
hit GET    "/api/v1/deals/$DEAL_ID/proforma/export"                            jwt
hit GET    "/api/v1/deals/$DEAL_ID/proforma/traffic-integration?propertyId=$PROP_ID" jwt
hit POST   "/api/v1/deals/$DEAL_ID/proforma/traffic-refresh"                   jwt \
  "{\"propertyId\":\"$PROP_ID\"}"

# ============================================================
# PROFORMA GENERATOR (proformaGeneratorRouter → /api/v1/properties, requires JWT)
# ============================================================
section "PROFORMA GENERATOR"
hit POST   "/api/v1/properties/$PROP_ID/proforma/generate" jwt \
  '{"strategy":"rental","overrides":{"vacancyRate":0.06}}'
hit GET    "/api/v1/properties/$PROP_ID/proforma/snapshots"                    jwt
hit GET    "/api/v1/properties/proforma/snapshots/$FAKE_SNAP_ID"               jwt
hit DELETE "/api/v1/properties/proforma/snapshots/$FAKE_SNAP_ID"               jwt
hit GET    "/api/v1/properties/proforma/templates"                             jwt
hit POST   "/api/v1/properties/proforma/templates"                             jwt \
  '{"name":"Smoke Template","strategy":"rental","assumptions":{"vacancyRate":0.06}}'
hit GET    "/api/v1/properties/proforma/templates/$FAKE_ID"                    jwt
hit PUT    "/api/v1/properties/proforma/templates/$FAKE_ID"                    jwt \
  '{"name":"Updated Smoke Template"}'
hit DELETE "/api/v1/properties/proforma/templates/$FAKE_ID"                    jwt

# ============================================================
# FINANCIAL DASHBOARD (financialDashboardRouter → /api/v1/financial-dashboard, requires JWT)
# ============================================================
section "FINANCIAL DASHBOARD"
hit GET  "/api/v1/financial-dashboard/$DEAL_ID/summary"           jwt
hit POST "/api/v1/financial-dashboard/$DEAL_ID/auto-assumptions"  jwt '{}'
hit POST "/api/v1/financial-dashboard/$DEAL_ID/analyze"           jwt '{"force":false}'
hit GET  "/api/v1/financial-dashboard/$DEAL_ID/assumptions"       jwt
hit PATCH "/api/v1/financial-dashboard/$DEAL_ID/assumptions"      jwt \
  '{"vacancy":0.06,"rentGrowth":0.03}'
hit POST "/api/v1/financial-dashboard/$DEAL_ID/validate"          jwt '{}'
hit POST "/api/v1/financial-dashboard/$DEAL_ID/chat"              jwt \
  '{"message":"What is the projected IRR for this deal?"}'

# ============================================================
# FINANCIAL MODEL ENGINE (financialModelRouter → /api/v1/financial-model, requires JWT)
# ============================================================
section "FINANCIAL MODEL ENGINE"
hit POST "/api/v1/financial-model/build"                          jwt \
  "{\"dealId\":\"$DEAL_ID\",\"assumptions\":{\"dealInfo\":{\"dealName\":\"Smoke Test\",\"totalUnits\":200},\"modelType\":\"existing\",\"holdPeriod\":5}}"
hit GET  "/api/v1/financial-model/$DEAL_ID/latest"                jwt
hit GET  "/api/v1/financial-model/$DEAL_ID/export/excel"          jwt

# ============================================================
# FINANCIAL MODELS CRUD (financialModelsRouter → /api/v1/financial-models, requires JWT)
# ============================================================
section "FINANCIAL MODELS CRUD"
hit GET    "/api/v1/financial-models"                              jwt
hit POST   "/api/v1/financial-models"                             jwt \
  "{\"dealId\":\"$DEAL_ID\",\"name\":\"Smoke Model\",\"assumptions\":{\"holdPeriod\":5}}"
hit GET    "/api/v1/financial-models/$DEAL_ID"                    jwt
hit PATCH  "/api/v1/financial-models/$FAKE_MODEL_ID"              jwt \
  '{"name":"Updated Smoke Model"}'
hit DELETE "/api/v1/financial-models/$FAKE_MODEL_ID"              jwt
hit POST   "/api/v1/financial-models/$DEAL_ID/compute-claude"     jwt \
  '{"forceRecompute":false}'
hit GET    "/api/v1/financial-models/$DEAL_ID/claude-output"      jwt
hit GET    "/api/v1/financial-models/$DEAL_ID/assumptions"        jwt
hit PATCH  "/api/v1/financial-models/$DEAL_ID/assumptions"        jwt \
  '{"vacancy":0.06}'
hit POST   "/api/v1/financial-models/$DEAL_ID/validate"           jwt '{}'

# ============================================================
# CAPITAL STRUCTURE (capitalStructureRouter → /api/v1/capital-structure, requires JWT)
# ============================================================
section "CAPITAL STRUCTURE — Stack & Sizing"
hit POST "/api/v1/capital-structure/stack" jwt \
  "{\"dealId\":\"$DEAL_ID\",\"strategy\":\"rental\",\"layers\":[{\"type\":\"senior_debt\",\"amount\":15000000,\"rate\":0.06,\"term\":7,\"amort\":30}],\"uses\":{\"acquisition\":20000000,\"closingCosts\":500000,\"capex\":2000000},\"noi\":1200000,\"propertyValue\":25000000}"
hit POST "/api/v1/capital-structure/size-senior" jwt \
  '{"totalCost":25000000,"noi":1200000,"propertyValue":25000000,"maxLTC":0.75,"dscrMin":1.25,"maxLTV":0.80,"interestRate":6.5,"amortYears":30}'
hit POST "/api/v1/capital-structure/size-mezz" jwt \
  '{"totalCost":25000000,"maxCombinedLTC":0.85,"seniorDebt":15000000}'
hit POST "/api/v1/capital-structure/insights" jwt \
  '{"metrics":{"ltv":0.65,"dscr":1.35,"debtYield":0.09,"ltc":0.72}}'

section "CAPITAL STRUCTURE — Debt Products"
hit POST "/api/v1/capital-structure/debt-products/recommend" jwt \
  '{"strategy":"rental","products":[{"name":"Agency Loan","type":"senior","rate":6.0,"ltv":0.65}]}'
hit POST "/api/v1/capital-structure/debt-products/mismatch" jwt \
  '{"strategy":"flip","products":[{"name":"Agency Loan","type":"senior","rate":6.0,"term":7}]}'

section "CAPITAL STRUCTURE — Rates"
hit POST "/api/v1/capital-structure/rate/cycle-phase" jwt \
  '{"fedDirection":"cutting","durationMonths":6,"yieldCurveSlope":0.5}'
hit POST "/api/v1/capital-structure/rate/all-in" jwt \
  '{"indexRate":5.0,"spreadBps":150}'
hit POST "/api/v1/capital-structure/rate/lock-vs-float" jwt \
  '{"loanAmount":15000000,"lockRate":6.5,"expectedFloatRates":[5.8,5.5,5.2],"termMonths":36,"discountRate":0.05}'
hit POST "/api/v1/capital-structure/rate/sensitivity" jwt \
  '{"loanAmount":15000000,"holdYears":5}'
hit POST "/api/v1/capital-structure/rate/spread-percentile" jwt \
  '{"currentSpread":175,"fiveYearMin":100,"fiveYearMax":250}'
hit GET  "/api/v1/capital-structure/rates/live"                    jwt
hit GET  "/api/v1/capital-structure/rates/history?period=1y"       jwt

section "CAPITAL STRUCTURE — Waterfall & Scenarios"
hit POST "/api/v1/capital-structure/waterfall" jwt \
  '{"config":{"lpCapital":8000000,"gpCapital":750000,"totalEquity":8750000,"lpPercentage":0.91,"gpPercentage":0.09,"preferredReturn":0.08,"tiers":[{"id":"tier1","name":"Preferred Return","hurdleRate":0.08,"gpSplit":0.10,"lpSplit":0.90},{"id":"tier2","name":"Catch-Up","hurdleRate":0.12,"gpSplit":0.20,"lpSplit":0.80}],"catchUpProvision":false,"catchUpPercentage":0.50,"clawbackProvision":false},"exitProceeds":12000000,"holdYears":5,"annualCashFlows":[400000,450000,500000,550000,600000]}'
hit POST "/api/v1/capital-structure/scenarios/compare" jwt \
  '{"scenarios":[{"name":"Base","strategy":"rental","layers":[{"type":"senior_debt","amount":15000000,"rate":6.0,"term":7,"amort":30}],"uses":{"acquisition":20000000,"closingCosts":500000,"capex":2000000}}],"noi":1200000,"propertyValue":25000000}'

section "CAPITAL STRUCTURE — Lifecycle & Rate Sheet"
hit POST "/api/v1/capital-structure/lifecycle/refi" jwt \
  '{"stabilizedValue":28000000,"refiLTV":0.72,"existingDebt":14500000}'
hit POST "/api/v1/capital-structure/lifecycle/draw-progress" jwt \
  '{"draws":[{"date":"2026-01-01","amount":2000000}],"totalCommitment":10000000}'
hit GET  "/api/v1/capital-structure/rate-sheet/$DEAL_ID/latest"    jwt
hit POST "/api/v1/capital-structure/optimal-strategy"              jwt \
  "{\"strategy\":\"rental\",\"dealId\":\"$DEAL_ID\"}"

# ============================================================
# STRATEGY ANALYSES (strategyAnalysesRouter → /api/v1/strategy-analyses, requires JWT)
# ============================================================
section "STRATEGY ANALYSES"
hit POST   "/api/v1/strategy-analyses" jwt \
  "{\"dealId\":\"$DEAL_ID\",\"strategySlug\":\"rental\",\"assumptions\":{\"holdPeriod\":5,\"exitCapRate\":0.055},\"roiMetrics\":{\"irr\":0.18}}"
hit GET    "/api/v1/strategy-analyses/$DEAL_ID"                    jwt
hit POST   "/api/v1/strategy-analyses/compare"                     jwt \
  "{\"dealId\":\"$DEAL_ID\",\"strategyIds\":[\"$FAKE_STRAT_ID\"]}"
hit PATCH  "/api/v1/strategy-analyses/$FAKE_STRAT_ID"             jwt \
  '{"assumptions":{"holdPeriod":7}}'
hit DELETE "/api/v1/strategy-analyses/$FAKE_STRAT_ID"             jwt

# ============================================================
# CUSTOM STRATEGIES (customStrategiesRouter → /api/v1/custom-strategies, requires JWT)
# ============================================================
section "CUSTOM STRATEGIES"
hit POST   "/api/v1/custom-strategies" jwt \
  '{"name":"Smoke Strategy","exitType":"sale","holdPeriodMin":3,"holdPeriodMax":7}'
hit GET    "/api/v1/custom-strategies"                             jwt
hit GET    "/api/v1/custom-strategies/$FAKE_STRAT_ID"             jwt
hit PUT    "/api/v1/custom-strategies/$FAKE_STRAT_ID"             jwt \
  '{"name":"Updated Smoke Strategy"}'
hit DELETE "/api/v1/custom-strategies/$FAKE_STRAT_ID"             jwt
hit POST   "/api/v1/custom-strategies/$FAKE_STRAT_ID/duplicate"  jwt \
  '{"newName":"Smoke Strategy Copy"}'
hit POST   "/api/v1/custom-strategies/$FAKE_STRAT_ID/apply-to-type" jwt \
  '{"propertyTypes":["multifamily"],"setAsDefault":false}'
hit GET    "/api/v1/custom-strategies/$FAKE_STRAT_ID/deals"       jwt
hit GET    "/api/v1/custom-strategies/$FAKE_STRAT_ID/performance" jwt
hit GET    "/api/v1/custom-strategies/$FAKE_STRAT_ID/property-assignments" jwt

# ============================================================
# OPUS (createOpusRoutes → /api/v1/opus, requires JWT)
# ============================================================
section "OPUS"
hit GET    "/api/v1/opus/conversations"                            jwt
hit POST   "/api/v1/opus/conversations"                            jwt \
  "{\"dealId\":\"$DEAL_ID\",\"title\":\"Smoke Test Conversation\"}"
hit GET    "/api/v1/opus/conversations/$FAKE_CONV_ID"              jwt
hit DELETE "/api/v1/opus/conversations/$FAKE_CONV_ID"              jwt
hit POST   "/api/v1/opus/conversations/$FAKE_CONV_ID/messages"     jwt \
  '{"role":"user","content":"What is the IRR for this deal?"}'
hit GET    "/api/v1/opus/proforma-versions"                        jwt
hit GET    "/api/v1/opus/proforma-versions/$FAKE_ID"               jwt
hit POST   "/api/v1/opus/proforma-versions"                        jwt \
  "{\"dealId\":\"$DEAL_ID\",\"name\":\"Smoke Version\",\"assumptions\":{}}"
hit DELETE "/api/v1/opus/proforma-versions/$FAKE_ID"               jwt

# ============================================================
# M26 TAX (m26TaxRouter → /api/v1, requires JWT)
# ============================================================
section "M26 TAX"
hit POST "/api/v1/deals/$DEAL_ID/tax/projection" jwt \
  '{"purchasePrice":20000000,"assessedValue":18000000,"millageRate":15.5,"exemptions":[],"projectionYears":5}'
hit GET  "/api/v1/deals/$DEAL_ID/tax/projection" jwt
hit GET  "/api/v1/deals/$DEAL_ID/tax/summary"    jwt

# ============================================================
# TAX COMP ANALYSIS (taxCompAnalysisRouter → /api/v1)
# ============================================================
section "TAX COMP ANALYSIS"
hit POST "/api/v1/deals/$DEAL_ID/tax/comp-analysis" jwt \
  '{"compProperties":[],"analysisType":"market_value"}'
hit GET  "/api/v1/deals/$DEAL_ID/tax/comp-analysis"         jwt
hit GET  "/api/v1/deals/$DEAL_ID/tax/comp-analysis/summary" jwt

# ============================================================
# UNIT MIX PROPAGATION (unitMixPropagationRoutes → /api/v1/deals, requires JWT)
# ============================================================
section "UNIT MIX PROPAGATION"
hit POST "/api/v1/deals/$DEAL_ID/unit-mix/apply"  jwt \
  '{"unitMix":[{"floorPlan":"1BR/1BA","units":80,"marketRent":1400,"unitSize":750}]}'
hit GET  "/api/v1/deals/$DEAL_ID/unit-mix/status" jwt
hit POST "/api/v1/deals/$DEAL_ID/unit-mix/set"    jwt \
  '{"unitMix":[{"floorPlan":"2BR/2BA","units":120,"marketRent":1800,"unitSize":1050}]}'
hit POST "/api/v1/deals/$DEAL_ID/development-path/select" jwt \
  '{"path":"by-right","rationale":"Highest density option"}'

# ============================================================
# UNIT MIX (createUnitMixRoutes → /api/v1/unit-mix, requires JWT)
# ============================================================
section "UNIT MIX"
hit GET  "/api/v1/unit-mix/$DEAL_ID/comps"   jwt
hit GET  "/api/v1/unit-mix/$DEAL_ID/trends"  jwt
hit GET  "/api/v1/unit-mix/$DEAL_ID/program" jwt
hit POST "/api/v1/unit-mix/$DEAL_ID/program" jwt \
  '{"unitMix":[{"type":"1BR","count":80,"sqft":750,"rent":1400}]}'
hit GET  "/api/v1/unit-mix/$DEAL_ID/zoning"  jwt

# ============================================================
# DATA LIBRARY (createDataLibraryRoutes → /api/v1/data-library, requires JWT)
# ============================================================
section "DATA LIBRARY"
hit GET    "/api/v1/data-library"                  jwt
hit GET    "/api/v1/data-library/comparables"      jwt
hit GET    "/api/v1/data-library/$FAKE_ID"         jwt
hit PATCH  "/api/v1/data-library/$FAKE_ID"         jwt \
  '{"notes":"smoke-updated"}'
hit DELETE "/api/v1/data-library/$FAKE_ID"         jwt

# ============================================================
# DATA UPLOAD safe GETs (dataUploadRouter → /api/v1/properties, requires JWT)
# ============================================================
section "DATA UPLOAD"
hit GET "/api/v1/properties/$PROP_ID/actuals"  jwt
hit GET "/api/v1/properties/$PROP_ID/uploads"  jwt

# ============================================================
# UPLOADS (uploadRouter → /api/v1/uploads, requires JWT)
# ============================================================
section "UPLOADS"
hit POST "/api/v1/uploads/process"                 jwt \
  "{\"propertyId\":\"$PROP_ID\",\"mappings\":{\"rent\":\"Rent\",\"vacancy\":\"Vacancy\"}}"
hit GET  "/api/v1/uploads/templates"               jwt
hit GET  "/api/v1/uploads/history/$PROP_ID"        jwt

# ============================================================
# UPLOAD TEMPLATES (uploadTemplatesRouter → /api/v1/upload-templates, requires JWT)
# ============================================================
section "UPLOAD TEMPLATES"
hit GET "/api/v1/upload-templates"        jwt
hit GET "/api/v1/upload-templates/excel"  jwt

# ============================================================
# SETTINGS AI (settingsAiRouter → /api/v1/settings/ai-preferences, requires JWT)
# ============================================================
section "SETTINGS AI PREFERENCES"
hit GET "/api/v1/settings/ai-preferences"  jwt
hit PUT "/api/v1/settings/ai-preferences"  jwt \
  '{"provider":"anthropic","model":"claude-sonnet-4-6","temperature":0.3}'

# ============================================================
# TRAINING (createTrainingRoutes → /api/training, requires JWT)
# ============================================================
section "TRAINING"
hit POST   "/api/training/examples"         jwt \
  "{\"userId\":\"$USER_ID\",\"moduleId\":\"M08\",\"input\":\"What strategy?\",\"output\":\"Rental\"}"
hit POST   "/api/training/examples/bulk"    jwt \
  "{\"userId\":\"$USER_ID\",\"moduleId\":\"M08\",\"examples\":[{\"input\":\"IRR?\",\"output\":\"18%\"}]}"
hit POST   "/api/training/extract-patterns" jwt \
  "{\"userId\":\"$USER_ID\",\"moduleId\":\"M08\"}"
hit POST   "/api/training/generate-suggestions" jwt \
  "{\"userId\":\"$USER_ID\",\"moduleId\":\"M08\",\"context\":{\"dealType\":\"multifamily\"}}"
hit GET    "/api/training/$USER_ID/M08"     jwt
hit GET    "/api/training/$USER_ID/all"     jwt
hit PUT    "/api/training/suggestions/$FAKE_ID/feedback" jwt \
  '{"accepted":true}'
hit DELETE "/api/training/$USER_ID/M08"    jwt

# ============================================================
# CALIBRATION (createCalibrationRoutes → /api/calibration, requires JWT)
# ============================================================
section "CALIBRATION"
hit POST   "/api/calibration/actuals"       jwt \
  "{\"userId\":\"$USER_ID\",\"moduleId\":\"M08\",\"propertyId\":\"$PROP_ID\",\"actualValue\":18.5,\"predictedValue\":17.2,\"metric\":\"irr\"}"
hit POST   "/api/calibration/actuals/bulk"  jwt \
  "{\"userId\":\"$USER_ID\",\"moduleId\":\"M08\",\"actuals\":[{\"propertyId\":\"$PROP_ID\",\"actualValue\":18.5,\"predictedValue\":17.2,\"metric\":\"irr\"}]}"
hit POST   "/api/calibration/validate"      jwt \
  "{\"userId\":\"$USER_ID\",\"moduleId\":\"M08\"}"
hit POST   "/api/calibration/calculate"     jwt \
  "{\"userId\":\"$USER_ID\",\"moduleId\":\"M08\"}"
hit GET    "/api/calibration/$USER_ID/M08"  jwt
hit GET    "/api/calibration/$USER_ID/summary" jwt
hit GET    "/api/calibration/$USER_ID/M08/validations" jwt
hit POST   "/api/calibration/$USER_ID/M08/recalculate" jwt '{}'
hit GET    "/api/calibration/$USER_ID/$PROP_ID/actuals" jwt
hit DELETE "/api/calibration/$USER_ID/M08"  jwt

# ============================================================
# CORRELATIONS (correlationRouter → /api/v1/correlations)
# ============================================================
section "CORRELATIONS"
hit GET  "/api/v1/correlations/report"                     jwt
hit GET  "/api/v1/correlations/property/$PROP_ID"          jwt
hit GET  "/api/v1/correlations/metric/irr"                 jwt
hit GET  "/api/v1/correlations/summary"                    jwt
hit POST "/api/v1/correlations/admin/correlations/compute" apikey '{}'
hit GET  "/api/v1/correlations/market/atlanta"             jwt

# ============================================================
# NOT MOUNTED — expect 4xx (WARN acceptable)
# ============================================================

section "FINANCIAL ASSUMPTIONS (not mounted — expect 4xx)"
hit POST "/api/v1/financial/link-design"             jwt \
  '{"designId":"abc","financialId":"def"}'
hit GET  "/api/v1/financial/linked/$FAKE_ID?type=design" jwt
hit POST "/api/v1/financial/export-design"           jwt \
  '{"design3D":{"buildingSections":[]}}'
hit POST "/api/v1/financial/compare-to-targets"      jwt \
  '{"design3D":{"buildingSections":[]},"targets":{"irr":0.18}}'
hit GET  "/api/v1/financial/health"                  none

section "SCENARIOS (not mounted — expect 4xx)"
hit POST   "/api/v1/scenarios/generate/$DEAL_ID"      jwt '{"trigger":"manual"}'
hit GET    "/api/v1/scenarios/$DEAL_ID"               jwt
hit GET    "/api/v1/scenarios/$FAKE_ID/details"       jwt
hit GET    "/api/v1/scenarios/$DEAL_ID/comparison"    jwt
hit PUT    "/api/v1/scenarios/$FAKE_ID/recalculate"   jwt '{}'
hit POST   "/api/v1/scenarios/custom"                 jwt \
  "{\"dealId\":\"$DEAL_ID\",\"scenarioName\":\"Smoke Custom\"}"
hit PUT    "/api/v1/scenarios/$FAKE_ID"               jwt '{"scenarioName":"Updated"}'
hit DELETE "/api/v1/scenarios/$FAKE_ID"               jwt
hit GET    "/api/v1/scenarios/templates"              jwt
hit GET    "/api/v1/scenarios/$DEAL_ID/events"        jwt

section "RISK ROUTES (not mounted — expect 4xx)"
hit GET  "/api/v1/risk/trade-area/$FAKE_ID"           jwt
hit GET  "/api/v1/risk/trade-area/$FAKE_ID/supply"    jwt
hit GET  "/api/v1/risk/trade-area/$FAKE_ID/demand"    jwt
hit GET  "/api/v1/risk/deal/$DEAL_ID"                 jwt
hit GET  "/api/v1/risk/history/$TRADE_AREA_ID"        jwt
hit GET  "/api/v1/risk/events"                        jwt
hit POST "/api/v1/risk/threshold"                     jwt \
  '{"riskType":"supply","thresholdValue":0.2}'
hit POST "/api/v1/risk/calculate/$TRADE_AREA_ID"      jwt '{}'
hit POST "/api/v1/risk/escalation/supply"             jwt \
  "{\"tradeAreaId\":\"$TRADE_AREA_ID\",\"supplyUnits\":500,\"threshold\":0.1}"
hit POST "/api/v1/risk/escalation/demand"             jwt \
  "{\"tradeAreaId\":\"$TRADE_AREA_ID\",\"demandScore\":0.8,\"threshold\":0.1}"
hit POST "/api/v1/risk/de-escalation/supply"          jwt \
  "{\"tradeAreaId\":\"$TRADE_AREA_ID\"}"
hit POST "/api/v1/risk/de-escalation/demand"          jwt \
  "{\"tradeAreaId\":\"$TRADE_AREA_ID\"}"
hit GET  "/api/v1/risk/categories"                    jwt
hit GET  "/api/v1/risk/trade-area/$FAKE_ID/regulatory" jwt
hit GET  "/api/v1/risk/trade-area/$FAKE_ID/market"    jwt
hit GET  "/api/v1/risk/trade-area/$FAKE_ID/execution" jwt
hit GET  "/api/v1/risk/trade-area/$FAKE_ID/climate"   jwt
hit GET  "/api/v1/risk/comprehensive/$DEAL_ID"        jwt

section "ANALYSIS ROUTES (not mounted — expect 4xx)"
hit POST "/api/v1/analysis/demand-signal"     jwt \
  '{"tradeAreaId":"abc","windowDays":90}'
hit POST "/api/v1/analysis/carrying-capacity" jwt \
  '{"tradeAreaId":"abc"}'
hit POST "/api/v1/analysis/imbalance"         jwt \
  '{"tradeAreaId":"abc"}'
hit POST "/api/v1/analysis/market-signal"     jwt \
  '{"tradeAreaId":"abc"}'
hit GET  "/api/v1/analysis/costar/submarkets" jwt
hit POST "/api/v1/analysis/costar/analyze"    jwt \
  '{"submarket":"Atlanta","metric":"vacancy"}'

section "LLM ROUTES (not mounted — expect 4xx)"
hit GET  "/api/v1/llm/status"             jwt
hit POST "/api/v1/llm/complete"           jwt \
  '{"prompt":"What is the cap rate?","maxTokens":500}'
hit POST "/api/v1/llm/analyze-property"   jwt \
  "{\"propertyId\":\"$PROP_ID\"}"
hit POST "/api/v1/llm/analyze-market"     jwt \
  '{"city":"Atlanta","state":"GA"}'
hit GET  "/api/v1/llm/analysis-history"   jwt

section "QWEN ROUTES (not mounted — expect 4xx)"
hit POST "/api/v1/qwen/analyze-compliance"  jwt \
  '{"address":"123 Main St","municipality":"Atlanta"}'
hit POST "/api/v1/qwen/analyze-aerial"      jwt \
  '{"coordinates":{"lat":33.749,"lng":-84.388}}'
hit POST "/api/v1/qwen/owner-disposition"   jwt \
  '{"ownerName":"John Smith","propertyAddress":"123 Main St"}'
hit POST "/api/v1/qwen/negotiation-strategy" jwt \
  "{\"dealId\":\"$DEAL_ID\",\"ownerProfile\":{}}"
hit GET  "/api/v1/qwen/status"              jwt

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

{
  echo "JediRe Financial & Strategy Smoke Test Results (Phase 3)"
  echo "Run: $(date -u)"
  echo "BASE_URL: $BASE_URL"
  echo "DEAL_ID : $DEAL_ID"
  echo "PROP_ID : $PROP_ID"
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

[ "$FAIL" -eq 0 ]

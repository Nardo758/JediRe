#!/bin/bash

##############################################################################
# SMOKE TEST: Financial & Strategy Routes (Phase 3)
#
# Tests ~192 endpoints across 29 route files covering:
# - ProForma generation & assumptions
# - Capital structure & debt modeling
# - Development scenarios & zoning
# - Strategy analysis & arbitrage
# - Risk assessment & financial dashboards
# - Tax & correlation analysis
# - AI/LLM integration endpoints
#
# Usage: bash smoke-test-financial.sh [BASE_URL] [AUTH_TOKEN]
# Default: http://localhost:3000 (token from env or from login)
##############################################################################

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${1:-http://localhost:3000}"
AUTH_TOKEN="${2:-${TEST_AUTH_TOKEN:-}}"
RESULTS_FILE="./smoke-results-financial.txt"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Test counters
TOTAL=0
PASSED=0
FAILED=0
ERRORS=()

# Test data (will be populated from database)
TEST_DEAL_ID="test-deal-1"
TEST_PROPERTY_ID="test-prop-1"
TEST_SCENARIO_ID="test-scenario-1"
TEST_TRADE_AREA_ID="test-trade-area-1"
TEST_TEMPLATE_ID="test-template-1"

##############################################################################
# HELPER FUNCTIONS
##############################################################################

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$RESULTS_FILE"
}

log_pass() {
    echo -e "${GREEN}[PASS]${NC} $1" | tee -a "$RESULTS_FILE"
    ((PASSED++))
}

log_fail() {
    echo -e "${RED}[FAIL]${NC} $1" | tee -a "$RESULTS_FILE"
    ((FAILED++))
    ERRORS+=("$1")
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1" | tee -a "$RESULTS_FILE"
}

# Perform HTTP request and check status
test_endpoint() {
    local method="$1"
    local endpoint="$2"
    local expected_code="${3:-200}"
    local data="${4:-}"

    ((TOTAL++))

    local url="$BASE_URL$endpoint"
    local response headers http_code

    # Build curl command
    local curl_opts=(
        -s -w "\n%{http_code}\n"
        -X "$method"
        -H "Content-Type: application/json"
    )

    if [[ -n "$AUTH_TOKEN" ]]; then
        curl_opts+=(-H "Authorization: Bearer $AUTH_TOKEN")
    fi

    if [[ -n "$data" ]]; then
        curl_opts+=(-d "$data")
    fi

    # Execute request
    response=$(curl "${curl_opts[@]}" "$url" 2>/dev/null || echo "")
    http_code=$(echo "$response" | tail -n1)

    # Check response
    if [[ "$http_code" =~ ^(${expected_code}|401|403|404|500)$ ]]; then
        if [[ "$http_code" == "500" ]]; then
            log_fail "$method $endpoint => HTTP $http_code (INTERNAL SERVER ERROR)"
        elif [[ "$http_code" =~ ^(401|403)$ ]]; then
            log_warn "$method $endpoint => HTTP $http_code (AUTH ISSUE)"
        elif [[ "$http_code" == "404" ]]; then
            log_warn "$method $endpoint => HTTP $http_code (NOT FOUND)"
        else
            log_pass "$method $endpoint => HTTP $http_code"
        fi
    else
        log_fail "$method $endpoint => HTTP $http_code (expected $expected_code)"
    fi
}

##############################################################################
# TEST SUITES BY ROUTE FILE
##############################################################################

test_proforma_routes() {
    log_info "\n=== Testing proforma.routes.ts (12 endpoints) ==="
    test_endpoint "GET" "/api/v1/proforma/$TEST_DEAL_ID"
    test_endpoint "POST" "/api/v1/proforma/$TEST_DEAL_ID/initialize" 201 '{"assumptions":{}}'
    test_endpoint "GET" "/api/v1/proforma/$TEST_DEAL_ID/history"
    test_endpoint "GET" "/api/v1/proforma/$TEST_DEAL_ID/adjustments"
    test_endpoint "POST" "/api/v1/proforma/$TEST_DEAL_ID/recalculate" 200 '{"inputs":{}}'
    test_endpoint "PATCH" "/api/v1/proforma/$TEST_DEAL_ID/override" 200 '{"field":"irr","value":12}'
    test_endpoint "GET" "/api/v1/proforma/$TEST_DEAL_ID/comparison"
    test_endpoint "DELETE" "/api/v1/proforma/$TEST_DEAL_ID/override/rentGrowth"
    test_endpoint "POST" "/api/v1/proforma/batch/recalculate" 200 '{"dealIds":[]}'
    test_endpoint "GET" "/api/v1/proforma/$TEST_DEAL_ID/export"
    test_endpoint "GET" "/api/v1/proforma/$TEST_DEAL_ID/traffic-integration"
    test_endpoint "POST" "/api/v1/proforma/$TEST_DEAL_ID/traffic-refresh" 200 '{}'
}

test_proforma_generator_routes() {
    log_info "\n=== Testing proforma-generator.routes.ts (9 endpoints) ==="
    test_endpoint "POST" "/api/v1/proforma-generator/$TEST_PROPERTY_ID/proforma/generate" 201 '{}'
    test_endpoint "GET" "/api/v1/proforma-generator/$TEST_PROPERTY_ID/proforma/snapshots"
    test_endpoint "GET" "/api/v1/proforma-generator/proforma/snapshots/$TEST_SCENARIO_ID"
    test_endpoint "DELETE" "/api/v1/proforma-generator/proforma/snapshots/$TEST_SCENARIO_ID"
    test_endpoint "GET" "/api/v1/proforma-generator/templates"
    test_endpoint "POST" "/api/v1/proforma-generator/templates" 201 '{"name":"template"}'
    test_endpoint "GET" "/api/v1/proforma-generator/templates/$TEST_TEMPLATE_ID"
    test_endpoint "PUT" "/api/v1/proforma-generator/templates/$TEST_TEMPLATE_ID" 200 '{"name":"updated"}'
    test_endpoint "DELETE" "/api/v1/proforma-generator/templates/$TEST_TEMPLATE_ID"
}

test_financial_assumptions_routes() {
    log_info "\n=== Testing financial-assumptions.routes.ts (5 endpoints) ==="
    test_endpoint "POST" "/api/v1/financial/link-design" 201 '{"dealId":"'$TEST_DEAL_ID'"}'
    test_endpoint "GET" "/api/v1/financial/linked/$TEST_DEAL_ID"
    test_endpoint "POST" "/api/v1/financial/export-design" 200 '{"dealId":"'$TEST_DEAL_ID'"}'
    test_endpoint "POST" "/api/v1/financial/compare-to-targets" 200 '{"dealId":"'$TEST_DEAL_ID'"}'
    test_endpoint "GET" "/api/v1/financial/health"
}

test_financial_dashboard_routes() {
    log_info "\n=== Testing financial-dashboard.routes.ts (4 endpoints) ==="
    test_endpoint "GET" "/api/v1/financial-dashboard/$TEST_DEAL_ID/summary"
    test_endpoint "POST" "/api/v1/financial-dashboard/$TEST_DEAL_ID/auto-assumptions" 200 '{}'
    test_endpoint "POST" "/api/v1/financial-dashboard/$TEST_DEAL_ID/analyze" 200 '{"inputs":{}}'
    test_endpoint "POST" "/api/v1/financial-dashboard/$TEST_DEAL_ID/chat" 200 '{"message":"test"}'
}

test_financial_model_routes() {
    log_info "\n=== Testing financial-model.routes.ts (3 endpoints) ==="
    test_endpoint "POST" "/api/v1/financial-model/build" 201 '{"dealId":"'$TEST_DEAL_ID'"}'
    test_endpoint "GET" "/api/v1/financial-model/$TEST_DEAL_ID/latest"
    test_endpoint "GET" "/api/v1/financial-model/$TEST_DEAL_ID/export/excel"
}

test_financial_models_routes() {
    log_info "\n=== Testing financial-models.routes.ts (10 endpoints) ==="
    test_endpoint "GET" "/api/v1/financial-models"
    test_endpoint "POST" "/api/v1/financial-models" 201 '{"name":"model"}'
    test_endpoint "GET" "/api/v1/financial-models/$TEST_DEAL_ID"
    test_endpoint "PATCH" "/api/v1/financial-models/$TEST_DEAL_ID" 200 '{"name":"updated"}'
    test_endpoint "DELETE" "/api/v1/financial-models/$TEST_DEAL_ID"
    test_endpoint "POST" "/api/v1/financial-models/$TEST_DEAL_ID/compute-claude" 200 '{"options":{}}'
    test_endpoint "GET" "/api/v1/financial-models/$TEST_DEAL_ID/claude-output"
    test_endpoint "GET" "/api/v1/financial-models/$TEST_DEAL_ID/assumptions"
    test_endpoint "PATCH" "/api/v1/financial-models/$TEST_DEAL_ID/assumptions" 200 '{"assumptions":{}}'
    test_endpoint "POST" "/api/v1/financial-models/$TEST_DEAL_ID/validate" 200 '{"data":{}}'
}

test_capital_structure_routes() {
    log_info "\n=== Testing capital-structure.routes.ts (20 endpoints) ==="
    test_endpoint "POST" "/api/v1/capital-structure/stack" 201 '{"dealId":"'$TEST_DEAL_ID'"}'
    test_endpoint "POST" "/api/v1/capital-structure/size-senior" 200 '{"dealId":"'$TEST_DEAL_ID'"}'
    test_endpoint "POST" "/api/v1/capital-structure/size-mezz" 200 '{"dealId":"'$TEST_DEAL_ID'"}'
    test_endpoint "POST" "/api/v1/capital-structure/insights" 200 '{"dealId":"'$TEST_DEAL_ID'"}'
    test_endpoint "POST" "/api/v1/capital-structure/debt-products/recommend" 200 '{"dealId":"'$TEST_DEAL_ID'"}'
    test_endpoint "POST" "/api/v1/capital-structure/debt-products/mismatch" 200 '{"dealId":"'$TEST_DEAL_ID'"}'
    test_endpoint "POST" "/api/v1/capital-structure/rate/cycle-phase" 200 '{"dealId":"'$TEST_DEAL_ID'"}'
    test_endpoint "POST" "/api/v1/capital-structure/rate/all-in" 200 '{"dealId":"'$TEST_DEAL_ID'"}'
    test_endpoint "POST" "/api/v1/capital-structure/rate/lock-vs-float" 200 '{"dealId":"'$TEST_DEAL_ID'"}'
    test_endpoint "POST" "/api/v1/capital-structure/rate/sensitivity" 200 '{"dealId":"'$TEST_DEAL_ID'"}'
    test_endpoint "POST" "/api/v1/capital-structure/rate/spread-percentile" 200 '{"dealId":"'$TEST_DEAL_ID'"}'
    test_endpoint "POST" "/api/v1/capital-structure/waterfall" 200 '{"dealId":"'$TEST_DEAL_ID'"}'
    test_endpoint "POST" "/api/v1/capital-structure/scenarios/compare" 200 '{"dealId":"'$TEST_DEAL_ID'"}'
    test_endpoint "POST" "/api/v1/capital-structure/lifecycle/refi" 200 '{"dealId":"'$TEST_DEAL_ID'"}'
    test_endpoint "POST" "/api/v1/capital-structure/lifecycle/draw-progress" 200 '{"dealId":"'$TEST_DEAL_ID'"}'
    test_endpoint "GET" "/api/v1/capital-structure/rates/live"
    test_endpoint "GET" "/api/v1/capital-structure/rates/history"
    test_endpoint "POST" "/api/v1/capital-structure/rate-sheet/upload" 201 '{"data":[]}'
    test_endpoint "GET" "/api/v1/capital-structure/rate-sheet/$TEST_DEAL_ID/latest"
    test_endpoint "POST" "/api/v1/capital-structure/optimal-strategy" 200 '{"dealId":"'$TEST_DEAL_ID'"}'
}

test_development_scenarios_routes() {
    log_info "\n=== Testing development-scenarios.routes.ts (14 endpoints) ==="
    test_endpoint "GET" "/api/v1/deals/$TEST_DEAL_ID/scenarios/hbu"
    test_endpoint "GET" "/api/v1/deals/$TEST_DEAL_ID/regulatory-risk-analysis"
    test_endpoint "GET" "/api/v1/deals/$TEST_DEAL_ID/timeline-intelligence"
    test_endpoint "GET" "/api/v1/deals/$TEST_DEAL_ID/scenarios/recommendations"
    test_endpoint "GET" "/api/v1/deals/$TEST_DEAL_ID/scenarios"
    test_endpoint "GET" "/api/v1/deals/$TEST_DEAL_ID/scenarios/lookup-district"
    test_endpoint "POST" "/api/v1/deals/$TEST_DEAL_ID/scenarios" 201 '{"scenario":{}}'
    test_endpoint "PUT" "/api/v1/deals/$TEST_DEAL_ID/scenarios/$TEST_SCENARIO_ID" 200 '{"scenario":{}}'
    test_endpoint "PUT" "/api/v1/deals/$TEST_DEAL_ID/scenarios/$TEST_SCENARIO_ID/sync" 200 '{"data":{}}'
    test_endpoint "POST" "/api/v1/deals/$TEST_DEAL_ID/scenarios/deactivate-all" 200 '{}'
    test_endpoint "PUT" "/api/v1/deals/$TEST_DEAL_ID/scenarios/$TEST_SCENARIO_ID/activate" 200 '{}'
    test_endpoint "DELETE" "/api/v1/deals/$TEST_DEAL_ID/scenarios/$TEST_SCENARIO_ID"
    test_endpoint "GET" "/api/v1/deals/$TEST_DEAL_ID/rezone-analysis"
    test_endpoint "GET" "/api/v1/deals/$TEST_DEAL_ID/envelope-enrichment"
}

test_scenarios_routes() {
    log_info "\n=== Testing scenarios.routes.ts (10 endpoints) ==="
    test_endpoint "POST" "/api/v1/scenarios/generate/$TEST_DEAL_ID" 201 '{"options":{}}'
    test_endpoint "GET" "/api/v1/scenarios/$TEST_DEAL_ID"
    test_endpoint "GET" "/api/v1/scenarios/$TEST_SCENARIO_ID/details"
    test_endpoint "GET" "/api/v1/scenarios/$TEST_DEAL_ID/comparison"
    test_endpoint "PUT" "/api/v1/scenarios/$TEST_SCENARIO_ID/recalculate" 200 '{"inputs":{}}'
    test_endpoint "POST" "/api/v1/scenarios/custom" 201 '{"name":"custom"}'
    test_endpoint "PUT" "/api/v1/scenarios/$TEST_SCENARIO_ID" 200 '{"scenario":{}}'
    test_endpoint "DELETE" "/api/v1/scenarios/$TEST_SCENARIO_ID"
    test_endpoint "GET" "/api/v1/scenarios/templates"
    test_endpoint "GET" "/api/v1/scenarios/$TEST_DEAL_ID/events"
}

test_custom_strategies_routes() {
    log_info "\n=== Testing custom-strategies.routes.ts (10 endpoints) ==="
    test_endpoint "POST" "/api/v1/custom-strategies" 201 '{"name":"strategy"}'
    test_endpoint "GET" "/api/v1/custom-strategies"
    test_endpoint "GET" "/api/v1/custom-strategies/$TEST_TEMPLATE_ID"
    test_endpoint "PUT" "/api/v1/custom-strategies/$TEST_TEMPLATE_ID" 200 '{"name":"updated"}'
    test_endpoint "DELETE" "/api/v1/custom-strategies/$TEST_TEMPLATE_ID"
    test_endpoint "POST" "/api/v1/custom-strategies/$TEST_TEMPLATE_ID/duplicate" 201 '{}'
    test_endpoint "POST" "/api/v1/custom-strategies/$TEST_TEMPLATE_ID/apply-to-type" 200 '{"propertyType":"apt"}'
    test_endpoint "DELETE" "/api/v1/custom-strategies/$TEST_TEMPLATE_ID/property-types/apt"
    test_endpoint "POST" "/api/v1/custom-strategies/$TEST_TEMPLATE_ID/export" 200 '{}'
    test_endpoint "GET" "/api/v1/custom-strategies/property-types/apt/default"
}

test_strategy_analyses_routes() {
    log_info "\n=== Testing strategy-analyses.routes.ts (5 endpoints) ==="
    test_endpoint "POST" "/api/v1/strategy-analyses" 201 '{"dealId":"'$TEST_DEAL_ID'"}'
    test_endpoint "GET" "/api/v1/strategy-analyses/$TEST_DEAL_ID"
    test_endpoint "POST" "/api/v1/strategy-analyses/compare" 200 '{"dealIds":[]}'
    test_endpoint "PATCH" "/api/v1/strategy-analyses/$TEST_DEAL_ID" 200 '{"data":{}}'
    test_endpoint "DELETE" "/api/v1/strategy-analyses/$TEST_DEAL_ID"
}

test_opus_routes() {
    log_info "\n=== Testing opus.routes.ts (9 endpoints) ==="
    test_endpoint "GET" "/api/v1/opus/conversations"
    test_endpoint "POST" "/api/v1/opus/conversations" 201 '{"dealId":"'$TEST_DEAL_ID'"}'
    test_endpoint "GET" "/api/v1/opus/conversations/$TEST_SCENARIO_ID"
    test_endpoint "DELETE" "/api/v1/opus/conversations/$TEST_SCENARIO_ID"
    test_endpoint "POST" "/api/v1/opus/conversations/$TEST_SCENARIO_ID/messages" 201 '{"message":"test"}'
    test_endpoint "GET" "/api/v1/opus/proforma-versions"
    test_endpoint "GET" "/api/v1/opus/proforma-versions/$TEST_SCENARIO_ID"
    test_endpoint "POST" "/api/v1/opus/proforma-versions" 201 '{"dealId":"'$TEST_DEAL_ID'"}'
    test_endpoint "DELETE" "/api/v1/opus/proforma-versions/$TEST_SCENARIO_ID"
}

test_risk_routes() {
    log_info "\n=== Testing risk.routes.ts (18 endpoints) ==="
    test_endpoint "GET" "/api/v1/risk/trade-area/$TEST_TRADE_AREA_ID"
    test_endpoint "GET" "/api/v1/risk/trade-area/$TEST_TRADE_AREA_ID/supply"
    test_endpoint "GET" "/api/v1/risk/trade-area/$TEST_TRADE_AREA_ID/demand"
    test_endpoint "GET" "/api/v1/risk/deal/$TEST_DEAL_ID"
    test_endpoint "GET" "/api/v1/risk/history/$TEST_TRADE_AREA_ID"
    test_endpoint "GET" "/api/v1/risk/events"
    test_endpoint "POST" "/api/v1/risk/threshold" 201 '{"threshold":0.5}'
    test_endpoint "POST" "/api/v1/risk/calculate/$TEST_TRADE_AREA_ID" 200 '{"inputs":{}}'
    test_endpoint "POST" "/api/v1/risk/escalation/supply" 200 '{"tradeAreaId":"'$TEST_TRADE_AREA_ID'"}'
    test_endpoint "POST" "/api/v1/risk/escalation/demand" 200 '{"tradeAreaId":"'$TEST_TRADE_AREA_ID'"}'
    test_endpoint "POST" "/api/v1/risk/de-escalation/supply" 200 '{"tradeAreaId":"'$TEST_TRADE_AREA_ID'"}'
    test_endpoint "POST" "/api/v1/risk/de-escalation/demand" 200 '{"tradeAreaId":"'$TEST_TRADE_AREA_ID'"}'
    test_endpoint "GET" "/api/v1/risk/categories"
    test_endpoint "GET" "/api/v1/risk/trade-area/$TEST_TRADE_AREA_ID/regulatory"
    test_endpoint "GET" "/api/v1/risk/trade-area/$TEST_TRADE_AREA_ID/market"
    test_endpoint "GET" "/api/v1/risk/trade-area/$TEST_TRADE_AREA_ID/execution"
    test_endpoint "GET" "/api/v1/risk/trade-area/$TEST_TRADE_AREA_ID/climate"
    test_endpoint "GET" "/api/v1/risk/comprehensive/$TEST_DEAL_ID"
}

test_calibration_routes() {
    log_info "\n=== Testing calibration.routes.ts (10 endpoints) ==="
    test_endpoint "POST" "/api/v1/calibration/actuals" 201 '{"data":{}}'
    test_endpoint "POST" "/api/v1/calibration/actuals/bulk" 201 '{"actuals":[]}'
    test_endpoint "POST" "/api/v1/calibration/validate" 200 '{"data":{}}'
    test_endpoint "POST" "/api/v1/calibration/calculate" 200 '{"inputs":{}}'
    test_endpoint "GET" "/api/v1/calibration/test-user/test-module"
    test_endpoint "GET" "/api/v1/calibration/test-user/summary"
    test_endpoint "GET" "/api/v1/calibration/test-user/test-module/validations"
    test_endpoint "POST" "/api/v1/calibration/test-user/test-module/recalculate" 200 '{"inputs":{}}'
    test_endpoint "GET" "/api/v1/calibration/test-user/$TEST_PROPERTY_ID/actuals"
    test_endpoint "DELETE" "/api/v1/calibration/test-user/test-module"
}

test_m26_tax_routes() {
    log_info "\n=== Testing m26-tax.routes.ts (3 endpoints) ==="
    test_endpoint "POST" "/api/v1/deals/$TEST_DEAL_ID/tax/projection" 201 '{"inputs":{}}'
    test_endpoint "GET" "/api/v1/deals/$TEST_DEAL_ID/tax/projection"
    test_endpoint "GET" "/api/v1/deals/$TEST_DEAL_ID/tax/summary"
}

test_tax_comp_analysis_routes() {
    log_info "\n=== Testing tax-comp-analysis.routes.ts (3 endpoints) ==="
    test_endpoint "POST" "/api/v1/deals/$TEST_DEAL_ID/tax/comp-analysis" 201 '{"inputs":{}}'
    test_endpoint "GET" "/api/v1/deals/$TEST_DEAL_ID/tax/comp-analysis"
    test_endpoint "GET" "/api/v1/deals/$TEST_DEAL_ID/tax/comp-analysis/summary"
}

test_unit_mix_routes() {
    log_info "\n=== Testing unitMix.routes.ts (5 endpoints) ==="
    test_endpoint "GET" "/api/v1/unit-mix/$TEST_DEAL_ID/comps"
    test_endpoint "GET" "/api/v1/unit-mix/$TEST_DEAL_ID/trends"
    test_endpoint "GET" "/api/v1/unit-mix/$TEST_DEAL_ID/program"
    test_endpoint "POST" "/api/v1/unit-mix/$TEST_DEAL_ID/program" 201 '{"program":{}}'
    test_endpoint "GET" "/api/v1/unit-mix/$TEST_DEAL_ID/zoning"
}

test_unit_mix_propagation_routes() {
    log_info "\n=== Testing unit-mix-propagation.routes.ts (4 endpoints) ==="
    test_endpoint "POST" "/api/v1/unit-mix-propagation/$TEST_DEAL_ID/unit-mix/apply" 200 '{"mixId":""}'
    test_endpoint "GET" "/api/v1/unit-mix-propagation/$TEST_DEAL_ID/unit-mix/status"
    test_endpoint "POST" "/api/v1/unit-mix-propagation/$TEST_DEAL_ID/unit-mix/set" 200 '{"mixData":{}}'
    test_endpoint "POST" "/api/v1/unit-mix-propagation/$TEST_DEAL_ID/development-path/select" 200 '{"pathId":""}'
}

test_data_library_routes() {
    log_info "\n=== Testing data-library.routes.ts (6 endpoints) ==="
    test_endpoint "GET" "/api/v1/data-library"
    test_endpoint "GET" "/api/v1/data-library/comparables"
    test_endpoint "GET" "/api/v1/data-library/$TEST_TEMPLATE_ID"
    test_endpoint "POST" "/api/v1/data-library" 201 '{"name":"library"}'
    test_endpoint "PATCH" "/api/v1/data-library/$TEST_TEMPLATE_ID" 200 '{"name":"updated"}'
    test_endpoint "DELETE" "/api/v1/data-library/$TEST_TEMPLATE_ID"
}

test_data_upload_routes() {
    log_info "\n=== Testing data-upload.routes.ts (4 endpoints) ==="
    test_endpoint "POST" "/api/v1/data-upload/$TEST_PROPERTY_ID/actuals/detect-columns" 200 '{"file":""}'
    test_endpoint "POST" "/api/v1/data-upload/$TEST_PROPERTY_ID/actuals/upload" 201 '{"data":[]}'
    test_endpoint "GET" "/api/v1/data-upload/$TEST_PROPERTY_ID/actuals"
    test_endpoint "GET" "/api/v1/data-upload/$TEST_PROPERTY_ID/uploads"
}

test_upload_routes() {
    log_info "\n=== Testing upload.routes.ts (4 endpoints) ==="
    test_endpoint "POST" "/api/v1/upload/preview" 200 '{"file":""}'
    test_endpoint "POST" "/api/v1/upload/process" 200 '{"data":{}}'
    test_endpoint "GET" "/api/v1/upload/templates"
    test_endpoint "GET" "/api/v1/upload/history/$TEST_PROPERTY_ID"
}

test_upload_templates_routes() {
    log_info "\n=== Testing upload-templates.routes.ts (2 endpoints) ==="
    test_endpoint "GET" "/api/v1/upload-templates"
    test_endpoint "GET" "/api/v1/upload-templates/csv"
}

test_llm_routes() {
    log_info "\n=== Testing llm.routes.ts (5 endpoints) ==="
    test_endpoint "GET" "/api/v1/llm/status"
    test_endpoint "POST" "/api/v1/llm/complete" 200 '{"prompt":"test"}'
    test_endpoint "POST" "/api/v1/llm/analyze-property" 200 '{"propertyId":"'$TEST_PROPERTY_ID'"}'
    test_endpoint "POST" "/api/v1/llm/analyze-market" 200 '{"marketId":"test-market"}'
    test_endpoint "GET" "/api/v1/llm/analysis-history"
}

test_qwen_routes() {
    log_info "\n=== Testing qwen.routes.ts (8 endpoints) ==="
    test_endpoint "POST" "/api/v1/ai/image-to-terrain" 200 '{"image":""}'
    test_endpoint "POST" "/api/v1/ai/analyze-compliance" 200 '{"document":""}'
    test_endpoint "POST" "/api/v1/ai/analyze-aerial" 200 '{"image":""}'
    test_endpoint "POST" "/api/v1/ai/owner-disposition" 200 '{"propertyId":"'$TEST_PROPERTY_ID'"}'
    test_endpoint "POST" "/api/v1/ai/auto-tag-photos" 200 '{"photos":[]}'
    test_endpoint "POST" "/api/v1/ai/estimate-progress" 200 '{"dealId":"'$TEST_DEAL_ID'"}'
    test_endpoint "POST" "/api/v1/ai/negotiation-strategy" 200 '{"deal":{}}'
    test_endpoint "GET" "/api/v1/ai/status"
}

test_settings_ai_routes() {
    log_info "\n=== Testing settings-ai.routes.ts (2 endpoints) ==="
    test_endpoint "GET" "/api/v1/settings-ai"
    test_endpoint "PUT" "/api/v1/settings-ai" 200 '{"settings":{}}'
}

test_training_routes() {
    log_info "\n=== Testing training.routes.ts (8 endpoints) ==="
    test_endpoint "POST" "/api/v1/training/examples" 201 '{"example":{}}'
    test_endpoint "POST" "/api/v1/training/examples/bulk" 201 '{"examples":[]}'
    test_endpoint "POST" "/api/v1/training/extract-patterns" 200 '{"data":{}}'
    test_endpoint "POST" "/api/v1/training/generate-suggestions" 200 '{"inputs":{}}'
    test_endpoint "GET" "/api/v1/training/test-user/test-module"
    test_endpoint "GET" "/api/v1/training/test-user/all"
    test_endpoint "PUT" "/api/v1/training/suggestions/test-sugg/feedback" 200 '{"feedback":"good"}'
    test_endpoint "DELETE" "/api/v1/training/test-user/test-module"
}

test_analysis_routes() {
    log_info "\n=== Testing analysis.routes.ts (6 endpoints) ==="
    test_endpoint "POST" "/api/v1/analysis/demand-signal" 200 '{"inputs":{}}'
    test_endpoint "POST" "/api/v1/analysis/carrying-capacity" 200 '{"inputs":{}}'
    test_endpoint "POST" "/api/v1/analysis/imbalance" 200 '{"inputs":{}}'
    test_endpoint "POST" "/api/v1/analysis/market-signal" 200 '{"inputs":{}}'
    test_endpoint "GET" "/api/v1/analysis/costar/submarkets"
    test_endpoint "POST" "/api/v1/analysis/costar/analyze" 200 '{"submarketId":""}'
}

test_correlation_routes() {
    log_info "\n=== Testing correlation.routes.ts (6 endpoints) ==="
    test_endpoint "GET" "/api/v1/correlations/report"
    test_endpoint "GET" "/api/v1/correlations/property/$TEST_PROPERTY_ID"
    test_endpoint "GET" "/api/v1/correlations/metric/test-metric"
    test_endpoint "GET" "/api/v1/correlations/summary"
    test_endpoint "POST" "/api/v1/correlations/admin/correlations/compute" 200 '{"options":{}}'
    test_endpoint "GET" "/api/v1/correlations/geography/msa/test-msa"
}

##############################################################################
# MAIN EXECUTION
##############################################################################

main() {
    # Clear results file
    > "$RESULTS_FILE"

    # Header
    {
        echo "================================================================================"
        echo "SMOKE TEST: Financial & Strategy Routes (Phase 3)"
        echo "================================================================================"
        echo "Base URL: $BASE_URL"
        echo "Timestamp: $TIMESTAMP"
        echo "Auth Token: ${AUTH_TOKEN:0:20}..."
        echo "================================================================================"
        echo ""
    } | tee "$RESULTS_FILE"

    log_info "Starting smoke tests for ~192 financial & strategy endpoints..."

    # Run all test suites
    test_proforma_routes
    test_proforma_generator_routes
    test_financial_assumptions_routes
    test_financial_dashboard_routes
    test_financial_model_routes
    test_financial_models_routes
    test_capital_structure_routes
    test_development_scenarios_routes
    test_scenarios_routes
    test_custom_strategies_routes
    test_strategy_analyses_routes
    test_opus_routes
    test_risk_routes
    test_calibration_routes
    test_m26_tax_routes
    test_tax_comp_analysis_routes
    test_unit_mix_routes
    test_unit_mix_propagation_routes
    test_data_library_routes
    test_data_upload_routes
    test_upload_routes
    test_upload_templates_routes
    test_llm_routes
    test_qwen_routes
    test_settings_ai_routes
    test_training_routes
    test_analysis_routes
    test_correlation_routes

    # Summary
    echo "" | tee -a "$RESULTS_FILE"
    echo "================================================================================" | tee -a "$RESULTS_FILE"
    echo "RESULTS SUMMARY" | tee -a "$RESULTS_FILE"
    echo "================================================================================" | tee -a "$RESULTS_FILE"
    echo "Total Tests:    $TOTAL" | tee -a "$RESULTS_FILE"
    echo "Passed:         $PASSED ($(( PASSED * 100 / TOTAL ))%)" | tee -a "$RESULTS_FILE"
    echo "Failed:         $FAILED ($(( FAILED * 100 / TOTAL ))%)" | tee -a "$RESULTS_FILE"
    echo "================================================================================" | tee -a "$RESULTS_FILE"

    # Error details
    if [[ $FAILED -gt 0 ]]; then
        echo "" | tee -a "$RESULTS_FILE"
        echo "FAILURES DETECTED:" | tee -a "$RESULTS_FILE"
        for error in "${ERRORS[@]}"; do
            echo "  - $error" | tee -a "$RESULTS_FILE"
        done
    fi

    echo "" | tee -a "$RESULTS_FILE"
    echo "Full results saved to: $RESULTS_FILE" | tee -a "$RESULTS_FILE"

    # Exit with appropriate code
    if [[ $FAILED -gt 0 ]]; then
        exit 1
    else
        exit 0
    fi
}

# Run main if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi

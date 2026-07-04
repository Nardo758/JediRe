#!/usr/bin/env bash
#
# Golden fixture capture — live build path
#
# Hits the actual POST /financial-model/build endpoint for Bishop and Highlands,
# saves full responses, runs a canary check on Highlands opex reality, then
# extracts the 12-field expected shape.
#
# Usage in Replit:
#   export TOKEN=<your-auth-token>
#   ./scripts/capture-golden-fixtures.sh
#
# The script produces:
#   /tmp/build_bishop.json      — full Bishop build response
#   /tmp/build_highlands.json   — full Highlands build response
#   /tmp/golden_extracted.json  — extracted 12-field shape + provenance for both deals

set -euo pipefail

TOKEN="${TOKEN:-}"
BASE_URL="${BASE_URL:-http://localhost:4000}"

if [[ -z "$TOKEN" ]]; then
  echo "WARN: TOKEN not set — proceeding without auth header (local dev only)"
fi

AUTH_HEADER=""
if [[ -n "$TOKEN" ]]; then
  AUTH_HEADER="Authorization: Bearer $TOKEN"
fi

BISHOP_ID="3f42276f-aacd-4da3-b306-317c5109b403"
HIGHLANDS_ID="eaabeb9f-830e-44f9-a923-56679ad0329d"

curl_build() {
  local deal_id="$1"
  local out_file="$2"
  local label="$3"

  echo "=== Building $label (deal_id=$deal_id) ==="
  curl -s -X POST "$BASE_URL/api/v1/deals/$deal_id/financial-model/build" \
    ${AUTH_HEADER:+-H "$AUTH_HEADER"} \
    -H "Content-Type: application/json" \
    > "$out_file"

  # Verify it's valid JSON
  if ! jq -e . "$out_file" > /dev/null 2>&1; then
    echo "ERROR: $label build response is not valid JSON. First 500 chars:"
    head -c 500 "$out_file"
    exit 1
  fi

  # Verify it has annualCashFlow (not an error response)
  if ! jq -e '.annualCashFlow' "$out_file" > /dev/null 2>&1; then
    echo "ERROR: $label build response missing annualCashFlow. Response keys:"
    jq 'keys' "$out_file"
    exit 1
  fi

  echo "OK: $label build saved to $out_file ($(wc -c < "$out_file") bytes)"
}

# ── 1. Live builds ──────────────────────────────────────────────────────────
curl_build "$BISHOP_ID"   "/tmp/build_bishop.json"    "Bishop"
curl_build "$HIGHLANDS_ID" "/tmp/build_highlands.json" "Highlands"

# ── 2. Highlands canary ─────────────────────────────────────────────────────
echo ""
echo "=== Highlands Canary (opex reality check) ==="
HIGHLANDS_Y1_OPEX=$(jq '.annualCashFlow[0].totalExpenses // 0' /tmp/build_highlands.json)
echo "Highlands Y1 totalExpenses: $HIGHLANDS_Y1_OPEX"

# Synthetic floor: 196 units × ~$2,500/unit/yr min opex = ~$490,000
# If the bridge is working, this should be > $400,000 for Highlands
CANARY_FLOOR=400000
if (( $(echo "$HIGHLANDS_Y1_OPEX > 0" | bc -l) )); then
  echo "PASS: opex is non-zero"
else
  echo "STOP: opex is ZERO — zeroed-opex defect detected. Do not pin."
  exit 1
fi

if (( $(echo "$HIGHLANDS_Y1_OPEX >= $CANARY_FLOOR" | bc -l) )); then
  echo "PASS: opex >= $CANARY_FLOOR (bridge appears to be mapping correctly)"
else
  echo "HOLD: opex < $CANARY_FLOOR — below expected floor. Delta: $(echo "$CANARY_FLOOR - $HIGHLANDS_Y1_OPEX" | bc)"
  echo "Review before pinning. Possible causes: partial bridge mapping, missing expense categories, or deal-specific low opex."
  # Exit with a distinct code so caller can distinguish STOP vs HOLD
  exit 2
fi

# ── 3. Extract 12-field shape + provenance ──────────────────────────────────
echo ""
echo "=== Extracting 12-field expected shape ==="

jq -n \
  --arg bishop_id "$BISHOP_ID" \
  --arg highlands_id "$HIGHLANDS_ID" \
  --arg capture_date "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg build_endpoint "$BASE_URL/api/v1/deals/{dealId}/financial-model/build" \
  --slurpfile bishop /tmp/build_bishop.json \
  --slurpfile highlands /tmp/build_highlands.json \
  '{
    bishop: {
      dealId: $bishop_id,
      expected: {
        noiYear1:        $bishop[0].annualCashFlow[0].noi,
        egiYear1:        $bishop[0].annualCashFlow[0].effectiveGrossRevenue,
        irr:             $bishop[0].summary.irr,
        equityMultiple:  $bishop[0].summary.equityMultiple,
        dscrY1:          $bishop[0].summary.dscr,
        cashOnCashY1:    $bishop[0].summary.cashOnCash,
        goingInCapRate:  $bishop[0].summary.goingInCapRate,
        exitCapRate:     $bishop[0].summary.exitCapRate,
        yieldOnCost:     $bishop[0].summary.yieldOnCost,
        totalEquity:     $bishop[0].summary.totalEquity,
        totalDebt:       $bishop[0].summary.totalDebt,
        netProceeds:     $bishop[0].summary.netProceeds,
      },
      provenance: {
        captureDate: $capture_date,
        source: "live_build",
        buildEndpoint: $build_endpoint,
        inputSnapshot: "deal_id:\($bishop_id)"
      }
    },
    highlands: {
      dealId: $highlands_id,
      expected: {
        noiYear1:        $highlands[0].annualCashFlow[0].noi,
        egiYear1:        $highlands[0].annualCashFlow[0].effectiveGrossRevenue,
        irr:             $highlands[0].summary.irr,
        equityMultiple:  $highlands[0].summary.equityMultiple,
        dscrY1:          $highlands[0].summary.dscr,
        cashOnCashY1:    $highlands[0].summary.cashOnCash,
        goingInCapRate:  $highlands[0].summary.goingInCapRate,
        exitCapRate:     $highlands[0].summary.exitCapRate,
        yieldOnCost:     $highlands[0].summary.yieldOnCost,
        totalEquity:     $highlands[0].summary.totalEquity,
        totalDebt:       $highlands[0].summary.totalDebt,
        netProceeds:     $highlands[0].summary.netProceeds,
      },
      provenance: {
        captureDate: $capture_date,
        source: "live_build",
        buildEndpoint: $build_endpoint,
        inputSnapshot: "deal_id:\($highlands_id)"
      }
    }
  }' > /tmp/golden_extracted.json

echo "Extracted shapes saved to /tmp/golden_extracted.json"
echo ""
echo "=== Bishop expected ==="
jq '.bishop.expected' /tmp/golden_extracted.json
echo ""
echo "=== Highlands expected ==="
jq '.highlands.expected' /tmp/golden_extracted.json

# ── 4. ProFormaAssumptions extraction (if available in response) ─────────────
echo ""
echo "=== Checking for raw ProFormaAssumptions in build responses ==="
for deal in bishop highlands; do
  if jq -e '.proFormaAssumptions // .inputAssumptions // .assumptions' "/tmp/build_${deal}.json" > /dev/null 2>&1; then
    echo "  $deal: raw assumptions found in response"
    jq '.proFormaAssumptions // .inputAssumptions // .assumptions' "/tmp/build_${deal}.json" > "/tmp/build_${deal}_raw.json"
  else
    echo "  $deal: raw assumptions NOT in response — must fetch separately via deal API"
  fi
done

echo ""
echo "Capture complete. Next steps:"
echo "  1. Review /tmp/golden_extracted.json for sanity"
echo "  2. If raw assumptions are missing, fetch them from GET /api/v1/deals/{id}/proforma"
echo "  3. Paste the expected + provenance + rawAssumptions blocks into the fixture files"
echo "  4. Run 8/8 test suite"

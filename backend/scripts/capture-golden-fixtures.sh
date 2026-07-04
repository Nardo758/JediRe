#!/usr/bin/env bash
#
# Golden fixture capture — live build path
#
# Corrected architecture:
#   - Body: {"dealId": "...", "forceRebuild": true} — server fetches stored assumptions
#   - Route: POST /api/v1/financial-model/build (verified via routes/index.ts:402)
#   - rawAssumptions: pre-bridge DB snapshot from deal_assumptions.year1 (display-case keys, LayeredValue blobs)
#   - expected: 12-field shape extracted from build response
#   - provenance: capture metadata including assumptions_hash from response
#
# Usage in Replit:
#   export TOKEN=<your-auth-token>
#   ./scripts/capture-golden-fixtures.sh

set -euo pipefail

TOKEN="${TOKEN:-}"
BASE_URL="${BASE_URL:-http://localhost:4000}"
BUILD_ENDPOINT="/api/v1/financial-model/build"

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
  curl -s -X POST "${BASE_URL}${BUILD_ENDPOINT}" \
    ${AUTH_HEADER:+-H "$AUTH_HEADER"} \
    -H "Content-Type: application/json" \
    -d "{\"dealId\":\"$deal_id\",\"forceRebuild\":true}" \
    > "$out_file"

  # Verify valid JSON
  if ! jq -e . "$out_file" > /dev/null 2>&1; then
    echo "ERROR: $label build response is not valid JSON. First 500 chars:"
    head -c 500 "$out_file"
    exit 1
  fi

  # Verify it has modelResults (not an error response)
  if ! jq -e '.modelResults // .data' "$out_file" > /dev/null 2>&1; then
    echo "ERROR: $label build response missing modelResults. Response keys:"
    jq 'keys' "$out_file"
    exit 1
  fi

  echo "OK: $label build saved to $out_file ($(wc -c < "$out_file") bytes)"
}

# ── 0. Resolve deal IDs (if full UUIDs unknown) ───────────────────────────────
echo "=== Deal IDs ==="
echo "Bishop:   $BISHOP_ID"
echo "Highlands: $HIGHLANDS_ID"

# ── 1. Live builds ────────────────────────────────────────────────────────────
curl_build "$BISHOP_ID"   "/tmp/build_bishop.json"    "Bishop"
curl_build "$HIGHLANDS_ID" "/tmp/build_highlands.json" "Highlands"

# ── 2. Highlands Canary ───────────────────────────────────────────────────────
echo ""
echo "=== Highlands Canary (opex reality check) ==="
# Extract from modelResults.annualCashFlow[0] (Y1 data)
HIGHLANDS_Y1_OPEX=$(jq '.modelResults.annualCashFlow[0].totalExpenses // 0' /tmp/build_highlands.json)
HIGHLANDS_Y1_NOI=$(jq '.modelResults.annualCashFlow[0].noi // 0' /tmp/build_highlands.json)
HIGHLANDS_Y1_EGI=$(jq '.modelResults.annualCashFlow[0].effectiveGrossRevenue // 0' /tmp/build_highlands.json)
HIGHLANDS_MARGIN=$(echo "scale=6; if ($HIGHLANDS_Y1_EGI > 0) then $HIGHLANDS_Y1_NOI / $HIGHLANDS_Y1_EGI else 0 fi" | bc)

echo "Highlands Y1 totalExpenses: $HIGHLANDS_Y1_OPEX"
echo "Highlands Y1 NOI:          $HIGHLANDS_Y1_NOI"
echo "Highlands Y1 EGI:          $HIGHLANDS_Y1_EGI"
echo "Highlands Y1 margin:       $HIGHLANDS_MARGIN"

# Key check: opex must be non-zero (bridge is working)
if (( $(echo "$HIGHLANDS_Y1_OPEX > 0" | bc -l) )); then
  echo "PASS: opex is non-zero"
else
  echo "STOP: opex is ZERO — zeroed-opex defect detected. Do not pin."
  exit 1
fi

# Unmatched / orphaned keys (should be empty or only known optional keys)
UNMATCHED=$(jq '.modelResults._unmatchedOpexKeys // []' /tmp/build_highlands.json)
ORPHANED=$(jq '.modelResults._orphanedOpexKeys // []' /tmp/build_highlands.json)
echo "unmatchedOpexKeys:  $UNMATCHED"
echo "orphanedOpexKeys:   $ORPHANED"

if [[ "$UNMATCHED" == "[]" && "$ORPHANED" == "[]" ]]; then
  echo "PASS: no unexpected opex keys"
else
  echo "HOLD: unexpected opex keys detected. Review before pinning."
  echo "  unmatched: $UNMATCHED"
  echo "  orphaned:  $ORPHANED"
fi

# ── 3. Extract 12-field expected shape ───────────────────────────────────────
echo ""
echo "=== Extracting 12-field expected shape ==="

# Determine response structure (modelResults vs data wrapper)
function get_summary() {
  local file="$1"
  local field="$2"
  # Try modelResults first, then data
  jq -e ".modelResults.summary.$field // .data.summary.$field // .modelResults.$field // .data.$field" "$file" 2>/dev/null || echo "null"
}

function get_cashflow() {
  local file="$1"
  local field="$2"
  jq -e ".modelResults.annualCashFlow[0].$field // .data.annualCashFlow[0].$field" "$file" 2>/dev/null || echo "null"
}

B_NOI=$(get_cashflow /tmp/build_bishop.json "noi")
B_EGI=$(get_cashflow /tmp/build_bishop.json "effectiveGrossRevenue")
B_IRR=$(get_summary /tmp/build_bishop.json "irr")
B_EM=$(get_summary /tmp/build_bishop.json "equityMultiple")
B_DSCR=$(get_summary /tmp/build_bishop.json "dscr")
B_COC=$(get_summary /tmp/build_bishop.json "cashOnCash")
B_GIC=$(get_summary /tmp/build_bishop.json "goingInCapRate")
B_EXIT_CAP=$(get_summary /tmp/build_bishop.json "exitCapRate")
B_YOC=$(get_summary /tmp/build_bishop.json "yieldOnCost")
B_TEQ=$(get_summary /tmp/build_bishop.json "totalEquity")
B_TDB=$(get_summary /tmp/build_bishop.json "totalDebt")
B_NET=$(get_summary /tmp/build_bishop.json "netProceeds")
B_HASH=$(jq -r '.assumptionsHash // .data.assumptionsHash // "unknown"' /tmp/build_bishop.json)

H_NOI=$(get_cashflow /tmp/build_highlands.json "noi")
H_EGI=$(get_cashflow /tmp/build_highlands.json "effectiveGrossRevenue")
H_IRR=$(get_summary /tmp/build_highlands.json "irr")
H_EM=$(get_summary /tmp/build_highlands.json "equityMultiple")
H_DSCR=$(get_summary /tmp/build_highlands.json "dscr")
H_COC=$(get_summary /tmp/build_highlands.json "cashOnCash")
H_GIC=$(get_summary /tmp/build_highlands.json "goingInCapRate")
H_EXIT_CAP=$(get_summary /tmp/build_highlands.json "exitCapRate")
H_YOC=$(get_summary /tmp/build_highlands.json "yieldOnCost")
H_TEQ=$(get_summary /tmp/build_highlands.json "totalEquity")
H_TDB=$(get_summary /tmp/build_highlands.json "totalDebt")
H_NET=$(get_summary /tmp/build_highlands.json "netProceeds")
H_HASH=$(jq -r '.assumptionsHash // .data.assumptionsHash // "unknown"' /tmp/build_highlands.json)

jq -n \
  --arg capture_date "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg build_endpoint "$BASE_URL$BUILD_ENDPOINT" \
  --arg bishop_id "$BISHOP_ID" \
  --arg highlands_id "$HIGHLANDS_ID" \
  --arg bishop_hash "$B_HASH" \
  --arg highlands_hash "$H_HASH" \
  --argjson b_noi "$B_NOI" \
  --argjson b_egi "$B_EGI" \
  --argjson b_irr "$B_IRR" \
  --argjson b_em "$B_EM" \
  --argjson b_dscr "$B_DSCR" \
  --argjson b_coc "$B_COC" \
  --argjson b_gic "$B_GIC" \
  --argjson b_exit_cap "$B_EXIT_CAP" \
  --argjson b_yoc "$B_YOC" \
  --argjson b_teq "$B_TEQ" \
  --argjson b_tdb "$B_TDB" \
  --argjson b_net "$B_NET" \
  --argjson h_noi "$H_NOI" \
  --argjson h_egi "$H_EGI" \
  --argjson h_irr "$H_IRR" \
  --argjson h_em "$H_EM" \
  --argjson h_dscr "$H_DSCR" \
  --argjson h_coc "$H_COC" \
  --argjson h_gic "$H_GIC" \
  --argjson h_exit_cap "$H_EXIT_CAP" \
  --argjson h_yoc "$H_YOC" \
  --argjson h_teq "$H_TEQ" \
  --argjson h_tdb "$H_TDB" \
  --argjson h_net "$H_NET" \
  '{
    bishop: {
      dealId: $bishop_id,
      expected: {
        noiYear1: $b_noi, egiYear1: $b_egi, irr: $b_irr, equityMultiple: $b_em,
        dscrY1: $b_dscr, cashOnCashY1: $b_coc, goingInCapRate: $b_gic,
        exitCapRate: $b_exit_cap, yieldOnCost: $b_yoc, totalEquity: $b_teq,
        totalDebt: $b_tdb, netProceeds: $b_net
      },
      provenance: {
        captureDate: $capture_date, source: "live_build",
        buildEndpoint: $build_endpoint, inputSnapshot: $bishop_hash
      }
    },
    highlands: {
      dealId: $highlands_id,
      expected: {
        noiYear1: $h_noi, egiYear1: $h_egi, irr: $h_irr, equityMultiple: $h_em,
        dscrY1: $h_dscr, cashOnCashY1: $h_coc, goingInCapRate: $h_gic,
        exitCapRate: $h_exit_cap, yieldOnCost: $h_yoc, totalEquity: $h_teq,
        totalDebt: $h_tdb, netProceeds: $h_net
      },
      provenance: {
        captureDate: $capture_date, source: "live_build",
        buildEndpoint: $build_endpoint, inputSnapshot: $highlands_hash
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

# ── 4. rawAssumptions snapshot from DB ─────────────────────────────────────────
echo ""
echo "=== Fetching raw assumptions from DB (deal_assumptions.year1) ==="
if command -v psql &> /dev/null; then
  for deal_id in "$BISHOP_ID" "$HIGHLANDS_ID"; do
    label=$(if [[ "$deal_id" == "$BISHOP_ID" ]]; then echo "bishop"; else echo "highlands"; fi)
    psql "$DATABASE_URL" -t -A -c "
      SELECT COALESCE(year1, '{}')::jsonb
      FROM deal_assumptions
      WHERE deal_id = '$deal_id'
    " 2>/dev/null > "/tmp/raw_${label}.json" || echo "WARN: Could not fetch raw assumptions for $label (psql not available or DB_URL not set)"
    if [[ -s "/tmp/raw_${label}.json" ]]; then
      echo "  $label: raw assumptions saved to /tmp/raw_${label}.json"
    else
      echo "  $label: no raw assumptions found (empty result or DB error)"
    fi
  done
else
  echo "WARN: psql not available — cannot fetch raw assumptions from DB"
  echo "      To complete fixture population, run:"
  echo "      psql \$DATABASE_URL -c \"SELECT year1 FROM deal_assumptions WHERE deal_id = '<id>';\""
fi

# ── 5. Next steps ────────────────────────────────────────────────────────────
echo ""
echo "=== NEXT STEPS ==="
echo "1. Review /tmp/golden_extracted.json for sanity"
echo "2. Review /tmp/raw_bishop.json and /tmp/raw_highlands.json (pre-bridge DB snapshot)"
echo "3. Paste the expected + provenance blocks into the fixture files"
echo "4. Paste the raw assumptions (year1 JSONB) as rawAssumptions in the fixture files"
echo "5. Run 8/8 test suite in Replit"

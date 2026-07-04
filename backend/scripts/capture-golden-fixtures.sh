#!/usr/bin/env bash
#
# Golden fixture capture — live build path (PROBE-FIRST, corrected)
#
# Sequence:
#   1. PROBE: curl with dealId-only body. If 400s demanding assumptions →
#      finding: build path accepts/requires client-supplied assumptions (F-P1 scope)
#   2. ADAPT: fetch full DB state, construct body from stored assumptions
#   3. CANARY: Highlands opex reality check
#   4. EXTRACT: 12-field expected + rawAssumptions (pre-bridge, complete)
#   5. PROVENANCE: capture metadata with assumption hash
#
# Baseline: 396 | Current: 395 | Delta: -1

set -euo pipefail

TOKEN="${TOKEN:-}"
BASE_URL="${BASE_URL:-http://localhost:4000}"
BUILD_ENDPOINT="/api/v1/financial-model/build"
DB_URL="${DATABASE_URL:-}"

BISHOP_ID="3f42276f-aacd-4da3-b306-317c5109b403"
HIGHLANDS_ID="eaabeb9f-830e-44f9-a923-56679ad0329d"

AUTH_HEADER=""
if [[ -n "$TOKEN" ]]; then
  AUTH_HEADER="Authorization: Bearer $TOKEN"
fi

echo "=== Baseline: 396 | Current: 395 | Delta: -1 ==="
echo ""

# ── 0. PROBE ─────────────────────────────────────────────────────────────────
echo "=== PROBE: dealId-only body ==="
PROBE_FILE="/tmp/probe_bishop.json"
curl -s -X POST "${BASE_URL}${BUILD_ENDPOINT}" \
  ${AUTH_HEADER:+-H "$AUTH_HEADER"} \
  -H "Content-Type: application/json" \
  -d "{\"dealId\":\"$BISHOP_ID\",\"forceRebuild\":true}" \
  > "$PROBE_FILE"

PROBE_STATUS=$(jq -r '.status // .error // empty' "$PROBE_FILE" 2>/dev/null || echo "unknown")
PROBE_HAS_RESULTS=$(jq -e '.modelResults // .data // .annualCashFlow' "$PROBE_FILE" > /dev/null 2>&1 && echo "yes" || echo "no")

if [[ "$PROBE_HAS_RESULTS" == "yes" ]]; then
  echo "PASS: dealId-only body accepted. Server fetched stored assumptions."
  echo "  (No finding — build path is server-fetching as designed)"
  BODY_FROM_DB="no"
else
  echo "FINDING: dealId-only body REJECTED. Response:"
  jq -c . "$PROBE_FILE" || cat "$PROBE_FILE" | head -c 500
  echo ""
  echo "FINDING CONFIRMED: build path requires client-supplied assumptions."
  echo "  This is the F-P1 local-state leak: frontend React state ships to build."
  echo "  Capture will construct body from stored DB data (same shape, sourced from store)."
  BODY_FROM_DB="yes"
fi

echo ""

# ── 1. FETCH FULL DB STATE ───────────────────────────────────────────────────
echo "=== Fetching full DB state for both deals ==="

if [[ -z "$DB_URL" ]]; then
  echo "WARN: DATABASE_URL not set. DB fetch will fail."
  echo "      Set DATABASE_URL or populate assumptions manually."
fi

# Fetch full deal_assumptions row (all columns) for both deals
for deal_id in "$BISHOP_ID" "$HIGHLANDS_ID"; do
  label=$(if [[ "$deal_id" == "$BISHOP_ID" ]]; then echo "bishop"; else echo "highlands"; fi)
  
  if command -v psql &> /dev/null && [[ -n "$DB_URL" ]]; then
    echo "  Fetching $label deal_assumptions..."
    psql "$DB_URL" -t -A -c "
      SELECT jsonb_build_object(
        'deal_id', deal_id,
        'year1', COALESCE(year1, '{}'),
        'total_units', total_units,
        'exit_cap', exit_cap,
        'rent_growth_yr1', rent_growth_yr1,
        'rent_growth_stabilized', rent_growth_stabilized,
        'hold_period_years', hold_period_years,
        'interest_rate', interest_rate,
        'ltc', ltc,
        'per_year_overrides', COALESCE(per_year_overrides, '{}'),
        'unit_mix', unit_mix,
        'unit_mix_overrides', unit_mix_overrides,
        'avg_rent_per_unit', avg_rent_per_unit,
        'vacancy_pct', vacancy_pct,
        'updated_at', updated_at
      )::jsonb
      FROM deal_assumptions
      WHERE deal_id = '$deal_id'
    " 2>/dev/null > "/tmp/db_${label}_assumptions.json" || echo "WARN: psql failed for $label"
    
    echo "  Fetching $label deals row..."
    psql "$DB_URL" -t -A -c "
      SELECT jsonb_build_object(
        'id', id,
        'name', name,
        'city', city,
        'state_code', state_code,
        'target_units', target_units,
        'budget', budget,
        'deal_type', deal_type,
        'deal_data', COALESCE(deal_data, '{}')
      )::jsonb
      FROM deals
      WHERE id = '$deal_id'
    " 2>/dev/null > "/tmp/db_${label}_deal.json" || echo "WARN: psql failed for $label deals"
    
    echo "  $label: DB snapshots saved to /tmp/db_${label}_assumptions.json and /tmp/db_${label}_deal.json"
  else
    echo "  $label: SKIP (psql not available or DB_URL not set)"
  fi
done

# Schema documentation: note what columns exist
echo ""
echo "=== Schema documentation (deal_assumptions) ==="
if command -v psql &> /dev/null && [[ -n "$DB_URL" ]]; then
  psql "$DB_URL" -c "\d deal_assumptions" 2>/dev/null > /tmp/deal_assumptions_schema.txt || echo "WARN: could not fetch schema"
  if [[ -f /tmp/deal_assumptions_schema.txt ]]; then
    echo "  Schema saved to /tmp/deal_assumptions_schema.txt"
  fi
else
  echo "  SKIP (psql not available or DB_URL not set)"
fi

echo ""

# ── 2. BUILD (adapted) ───────────────────────────────────────────────────────
curl_build() {
  local deal_id="$1"
  local out_file="$2"
  local label="$3"
  local body_file="$4"

  echo "=== Building $label (deal_id=$deal_id) ==="
  
  if [[ -f "$body_file" && "$BODY_FROM_DB" == "yes" ]]; then
    echo "  Using constructed body from DB data: $body_file"
    curl -s -X POST "${BASE_URL}${BUILD_ENDPOINT}" \
      ${AUTH_HEADER:+-H "$AUTH_HEADER"} \
      -H "Content-Type: application/json" \
      -d "{\"dealId\":\"$deal_id\",\"assumptions\":$(cat "$body_file"),\"forceRebuild\":true}" \
      > "$out_file"
  else
    echo "  Using dealId-only body (server-fetching)"
    curl -s -X POST "${BASE_URL}${BUILD_ENDPOINT}" \
      ${AUTH_HEADER:+-H "$AUTH_HEADER"} \
      -H "Content-Type: application/json" \
      -d "{\"dealId\":\"$deal_id\",\"forceRebuild\":true}" \
      > "$out_file"
  fi

  # Verify valid JSON
  if ! jq -e . "$out_file" > /dev/null 2>&1; then
    echo "ERROR: $label build response is not valid JSON. First 500 chars:"
    head -c 500 "$out_file"
    exit 1
  fi

  # Verify it has modelResults or data
  if ! jq -e '.modelResults // .data' "$out_file" > /dev/null 2>&1; then
    echo "ERROR: $label build response missing modelResults/data. Response keys:"
    jq 'keys' "$out_file"
    exit 1
  fi

  echo "OK: $label build saved to $out_file ($(wc -c < "$out_file") bytes)"
}

# Build both deals
curl_build "$BISHOP_ID"   "/tmp/build_bishop.json"    "Bishop"   "/tmp/db_bishop_assumptions.json"
curl_build "$HIGHLANDS_ID" "/tmp/build_highlands.json" "Highlands" "/tmp/db_highlands_assumptions.json"

# ── 3. CANARY GATE (Highlands) ───────────────────────────────────────────────
echo ""
echo "=== Highlands Canary ==="

H_Y1_OPEX=$(jq '.modelResults.annualCashFlow[0].totalExpenses // 0' /tmp/build_highlands.json)
H_Y1_NOI=$(jq '.modelResults.annualCashFlow[0].noi // 0' /tmp/build_highlands.json)
H_Y1_EGI=$(jq '.modelResults.annualCashFlow[0].effectiveGrossRevenue // 0' /tmp/build_highlands.json)
H_MARGIN=$(echo "scale=6; if ($H_Y1_EGI > 0) then $H_Y1_NOI / $H_Y1_EGI else 0 fi" | bc)

echo "  Y1 totalExpenses: $H_Y1_OPEX"
echo "  Y1 NOI:          $H_Y1_NOI"
echo "  Y1 EGI:          $H_Y1_EGI"
echo "  Y1 margin:       $H_MARGIN"

UNMATCHED=$(jq '.modelResults._unmatchedOpexKeys // []' /tmp/build_highlands.json)
ORPHANED=$(jq '.modelResults._orphanedOpexKeys // []' /tmp/build_highlands.json)
echo "  unmatchedOpexKeys:  $UNMATCHED"
echo "  orphanedOpexKeys:   $ORPHANED"

CANARY_PASS="yes"

if (( $(echo "$H_Y1_OPEX > 0" | bc -l) )); then
  echo "  PASS: opex is non-zero"
else
  echo "  STOP: opex is ZERO — zeroed-opex defect detected."
  CANARY_PASS="no"
fi

if [[ "$UNMATCHED" == "[]" && "$ORPHANED" == "[]" ]]; then
  echo "  PASS: no unexpected opex keys"
else
  echo "  HOLD: unexpected opex keys detected."
  echo "    unmatched: $UNMATCHED"
  echo "    orphaned:  $ORPHANED"
  CANARY_PASS="hold"
fi

if [[ "$CANARY_PASS" == "no" ]]; then
  echo ""
  echo "CANARY FAILED. Do not pin. Investigate and re-run."
  exit 1
fi

if [[ "$CANARY_PASS" == "hold" ]]; then
  echo ""
  echo "CANARY HOLD. Review opex keys before pinning."
  # Continue but flag
fi

# ── 4. EXTRACT 12-field expected shape ───────────────────────────────────────
echo ""
echo "=== Extracting 12-field expected shape ==="

function get_summary() {
  local file="$1"
  local field="$2"
  jq -e ".modelResults.summary.$field // .data.summary.$field // .modelResults.$field // .data.$field // null" "$file" 2>/dev/null || echo "null"
}

function get_cashflow() {
  local file="$1"
  local field="$2"
  jq -e ".modelResults.annualCashFlow[0].$field // .data.annualCashFlow[0].$field // null" "$file" 2>/dev/null || echo "null"
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

CAPTURE_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ)

cat > /tmp/golden_extracted.json << EOF
{
  "bishop": {
    "dealId": "$BISHOP_ID",
    "expected": {
      "noiYear1": $B_NOI,
      "egiYear1": $B_EGI,
      "irr": $B_IRR,
      "equityMultiple": $B_EM,
      "dscrY1": $B_DSCR,
      "cashOnCashY1": $B_COC,
      "goingInCapRate": $B_GIC,
      "exitCapRate": $B_EXIT_CAP,
      "yieldOnCost": $B_YOC,
      "totalEquity": $B_TEQ,
      "totalDebt": $B_TDB,
      "netProceeds": $B_NET
    },
    "provenance": {
      "captureDate": "$CAPTURE_DATE",
      "source": "live_build",
      "buildEndpoint": "${BASE_URL}${BUILD_ENDPOINT}",
      "inputSnapshot": "$B_HASH",
      "bodySource": "$([[ "$BODY_FROM_DB" == "yes" ]] && echo "db_constructed" || echo "server_fetched")",
      "canary": "$CANARY_PASS"
    }
  },
  "highlands": {
    "dealId": "$HIGHLANDS_ID",
    "expected": {
      "noiYear1": $H_NOI,
      "egiYear1": $H_EGI,
      "irr": $H_IRR,
      "equityMultiple": $H_EM,
      "dscrY1": $H_DSCR,
      "cashOnCashY1": $H_COC,
      "goingInCapRate": $H_GIC,
      "exitCapRate": $H_EXIT_CAP,
      "yieldOnCost": $H_YOC,
      "totalEquity": $H_TEQ,
      "totalDebt": $H_TDB,
      "netProceeds": $H_NET
    },
    "provenance": {
      "captureDate": "$CAPTURE_DATE",
      "source": "live_build",
      "buildEndpoint": "${BASE_URL}${BUILD_ENDPOINT}",
      "inputSnapshot": "$H_HASH",
      "bodySource": "$([[ "$BODY_FROM_DB" == "yes" ]] && echo "db_constructed" || echo "server_fetched")",
      "canary": "$CANARY_PASS"
    }
  }
}
EOF

echo "Extracted shapes saved to /tmp/golden_extracted.json"
echo ""
echo "=== Bishop expected ==="
jq '.bishop.expected' /tmp/golden_extracted.json
echo ""
echo "=== Highlands expected ==="
jq '.highlands.expected' /tmp/golden_extracted.json

# ── 5. NEXT STEPS ───────────────────────────────────────────────────────────
echo ""
echo "=== NEXT STEPS ==="
echo "1. Review /tmp/golden_extracted.json for sanity"
echo "2. Review /tmp/db_bishop_assumptions.json and /tmp/db_highlands_assumptions.json"
echo "3. If BODY_FROM_DB=yes, review /tmp/probe_bishop.json for the finding"
echo "4. Paste the expected + provenance blocks into fixture files"
echo "5. rawAssumptions: use the full DB snapshot (deal_assumptions row + deal row)"
echo "6. Run 8/8 test suite in Replit"

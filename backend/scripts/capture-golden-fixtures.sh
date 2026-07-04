#!/usr/bin/env bash
#
# Golden fixture capture — live build path + seed path (ID-literal-free, probe-first)
#
# CRITICAL: All deal IDs resolved from DB by name prefix match. No literal UUIDs
# are baked in. Any 404 is a real 404, not a phantom-deal masquerade.
#
# Sequence:
#   1. ID RESOLUTION: psql query for Bishop/Highlands by name prefix
#   2. PROBE: curl with dealId-only body
#   3. BRANCH: if 400s demanding assumptions → F-P1 finding confirmed
#   4. BISHOP BUILD: construct-from-DB body → build endpoint → 12-field extract
#   5. HIGHLANDS SEED CAPTURE: seed/actuals surface → 12-field extract
#      (Highlands is owned_import — no deal_assumptions row. Build path is NOT
#      used for Highlands. See F-P1-C handling below.)
#   6. CANARY: Bishop build sanity
#   7. EXTRACT: 12-field expected + provenance for Bishop fixture
#
# Fixture architecture (W5 amended):
#   - Bishop:    build_path  → rawAssumptions from construct-from-DB body
#   - Highlands: seed_path   → expected from seed/actuals surface (no rawAssumptions)
#   - Synthetic: synthetic   → engine-level deterministic, already pinned

set -euo pipefail

TOKEN="${TOKEN:-}"
BASE_URL="${BASE_URL:-http://localhost:4000}"
BUILD_ENDPOINT="/api/v1/financial-model/build"
DB_URL="${DATABASE_URL:-}"

AUTH_HEADER=""
if [[ -n "$TOKEN" ]]; then
  AUTH_HEADER="Authorization: Bearer $TOKEN"
fi

# ── 0. ID RESOLUTION (no literals, DB-sourced) ─────────────────────────────────
echo "=== ID Resolution (DB-sourced) ==="

if [[ -z "$DB_URL" ]]; then
  echo "ERROR: DATABASE_URL not set. Cannot resolve deal IDs."
  exit 1
fi

if ! command -v psql &> /dev/null; then
  echo "ERROR: psql not available. Cannot resolve deal IDs."
  exit 1
fi

DEAL_IDS=$(psql "$DB_URL" -t -A -c "
  SELECT id, name FROM deals
  WHERE name ILIKE '%Bishop%' OR name ILIKE '%Highlands%'
  ORDER BY name;
" 2>/dev/null)

if [[ -z "$DEAL_IDS" ]]; then
  echo "ERROR: Could not resolve Bishop or Highlands deal IDs from DB."
  exit 1
fi

BISHOP_ID=""
HIGHLANDS_ID=""

while IFS='|' read -r id name; do
  if [[ -n "$id" && -n "$name" ]]; then
    if [[ "$name" == *"Bishop"* ]]; then
      BISHOP_ID="$id"
      echo "  Bishop:   $id (name: $name)"
    elif [[ "$name" == *"Highlands"* ]]; then
      HIGHLANDS_ID="$id"
      echo "  Highlands: $id (name: $name)"
    fi
  fi
done <<< "$DEAL_IDS"

if [[ -z "$BISHOP_ID" ]]; then
  echo "ERROR: Bishop deal not found in DB."
  exit 1
fi
if [[ -z "$HIGHLANDS_ID" ]]; then
  echo "ERROR: Highlands deal not found in DB."
  exit 1
fi

echo ""

# ── 1. PROBE (dealId-only body) ──────────────────────────────────────────────
echo "=== PROBE: dealId-only body ==="
PROBE_FILE="/tmp/probe_bishop.json"
PROBE_HTTP_CODE=$(curl -s -o "$PROBE_FILE" -w "%{http_code}" -X POST "${BASE_URL}${BUILD_ENDPOINT}" \
  ${AUTH_HEADER:+-H "$AUTH_HEADER"} \
  -H "Content-Type: application/json" \
  -d "{\"dealId\":\"$BISHOP_ID\",\"forceRebuild\":true}")

echo "  HTTP $PROBE_HTTP_CODE"

if [[ "$PROBE_HTTP_CODE" == "401" || "$PROBE_HTTP_CODE" == "403" ]]; then
  echo "ABORT: auth failure. Fix TOKEN and re-run."
  exit 1
elif [[ "$PROBE_HTTP_CODE" == "200" ]]; then
  PROBE_HAS_RESULTS=$(jq -e '.modelResults // .data // .annualCashFlow' "$PROBE_FILE" > /dev/null 2>&1 && echo "yes" || echo "no")
  if [[ "$PROBE_HAS_RESULTS" == "yes" ]]; then
    echo "PASS: dealId-only body accepted (HTTP 200). Server fetched stored assumptions."
    BODY_FROM_DB="no"
    PROBE_VERDICT="server_fetched"
  else
    echo "WARN: HTTP 200 but no model payload. Falling back to DB-constructed body."
    BODY_FROM_DB="yes"
    PROBE_VERDICT="db_constructed_inconclusive_200"
  fi
elif [[ "$PROBE_HTTP_CODE" == "400" ]]; then
  echo "FINDING CONFIRMED (F-P1-A): build boundary requires client-supplied assumptions."
  BODY_FROM_DB="yes"
  PROBE_VERDICT="db_constructed"
else
  echo "ABORT: unexpected HTTP $PROBE_HTTP_CODE"
  exit 1
fi

echo ""

# ── 2. FETCH FULL DB STATE ───────────────────────────────────────────────────
echo "=== Fetching full DB state ==="

for deal_id in "$BISHOP_ID" "$HIGHLANDS_ID"; do
  label=$(if [[ "$deal_id" == "$BISHOP_ID" ]]; then echo "bishop"; else echo "highlands"; fi)
  echo "  Fetching $label deal_assumptions..."
  psql "$DB_URL" -t -A -c "
    SELECT jsonb_build_object(
      'deal_id', deal_id, 'year1', COALESCE(year1, '{}'),
      'total_units', total_units, 'exit_cap', exit_cap,
      'rent_growth_yr1', rent_growth_yr1, 'rent_growth_stabilized', rent_growth_stabilized,
      'hold_period_years', hold_period_years, 'interest_rate', interest_rate,
      'ltc', ltc, 'avg_lease_term_months', avg_lease_term_months,
      'per_year_overrides', COALESCE(per_year_overrides, '{}'),
      'io_period_months', io_period_months, 'amortization_years', amortization_years,
      'dscr_min', dscr_min, 'origination_fee_pct', origination_fee_pct,
      'unit_mix', unit_mix, 'avg_rent_per_unit', avg_rent_per_unit,
      'vacancy_pct', vacancy_pct, 'selling_costs_pct', selling_costs_pct,
      'updated_at', updated_at
    )::jsonb
    FROM deal_assumptions WHERE deal_id = '$deal_id'
  " > "/tmp/db_${label}_assumptions.json" 2>/dev/null || echo "    WARN: empty or failed"

  echo "  Fetching $label deals row..."
  psql "$DB_URL" -t -A -c "
    SELECT jsonb_build_object(
      'id', id, 'name', name, 'city', city, 'state_code', state_code,
      'target_units', target_units, 'budget', budget, 'deal_type', deal_type,
      'deal_data', COALESCE(deal_data, '{}')
    )::jsonb
    FROM deals WHERE id = '$deal_id'
  " > "/tmp/db_${label}_deal.json" 2>/dev/null || echo "    WARN: empty or failed"
done

echo ""

# ── 3. BUILD (Bishop only) ───────────────────────────────────────────────────
curl_build() {
  local deal_id="$1"
  local out_file="$2"
  local label="$3"

  echo "=== Building $label (deal_id=$deal_id) ==="
  if [[ "$BODY_FROM_DB" == "yes" ]]; then
    local short_label="${label,,}"
    local db_file="/tmp/db_${short_label}_assumptions.json"
    local short_id="${deal_id%%-*}"
    local construct_out_file="/tmp/build_body_${short_id}.json"
    rm -f "$construct_out_file"
    npx ts-node --transpile-only scripts/construct-build-body.ts "$deal_id" > "/tmp/construct_body_log_${short_label}.txt" 2>&1 || true
    if [[ -f "$construct_out_file" && -s "$construct_out_file" ]]; then
      local construct_assumptions_file="/tmp/construct_assumptions_${short_label}.json"
      jq -c '.assumptions' "$construct_out_file" > "$construct_assumptions_file"
      curl -s -X POST "${BASE_URL}${BUILD_ENDPOINT}" \
        ${AUTH_HEADER:+-H "$AUTH_HEADER"} \
        -H "Content-Type: application/json" \
        -d "{\"dealId\":\"$deal_id\",\"assumptions\":$(cat "$construct_assumptions_file"),\"forceRebuild\":true}" \
        > "$out_file"
    else
      curl -s -X POST "${BASE_URL}${BUILD_ENDPOINT}" \
        ${AUTH_HEADER:+-H "$AUTH_HEADER"} \
        -H "Content-Type: application/json" \
        -d "{\"dealId\":\"$deal_id\",\"assumptions\":$(cat "$db_file"),\"forceRebuild\":true}" \
        > "$out_file"
    fi
  else
    curl -s -X POST "${BASE_URL}${BUILD_ENDPOINT}" \
      ${AUTH_HEADER:+-H "$AUTH_HEADER"} \
      -H "Content-Type: application/json" \
      -d "{\"dealId\":\"$deal_id\",\"forceRebuild\":true}" \
      > "$out_file"
  fi
  if ! jq -e . "$out_file" > /dev/null 2>&1; then
    echo "ERROR: $label build response is not valid JSON"
    head -c 500 "$out_file"
    exit 1
  fi
  echo "  OK: saved to $out_file"
}

curl_build "$BISHOP_ID" "/tmp/build_bishop.json" "Bishop"

# ── F-P1-C: Highlands seed-path note ──────────────────────────────────────────
echo ""
echo "=== Highlands Seed-Path Capture ==="
echo "  Highlands is owned_import — no deal_assumptions row. Build path skipped."
echo "  Seed canary (confirmed): margin 57.17%, EGI $6,315,308, boundary 2026-04-01"
echo ""
echo "  TODO in Replit: Hit the seed/actuals surface and extract the 12-field shape."
echo "  Paste into highlands.golden.ts with provenance.source='seed_actuals' and"
echo "  provenance.originClass='owned_import'."

# ── 4. CANARY GATE (Bishop only) ─────────────────────────────────────────────
echo ""
echo "=== Bishop Build Canary ==="

B_Y1_OPEX=$(jq '.modelResults.annualCashFlow[0].totalExpenses // 0' /tmp/build_bishop.json)
B_Y1_NOI=$(jq '.modelResults.annualCashFlow[0].noi // 0' /tmp/build_bishop.json)
B_Y1_EGI=$(jq '.modelResults.annualCashFlow[0].effectiveGrossRevenue // 0' /tmp/build_bishop.json)
B_MARGIN=$(echo "scale=6; if ($B_Y1_EGI > 0) then $B_Y1_NOI / $B_Y1_EGI else 0 fi" | bc)

echo "  Y1 totalExpenses: $B_Y1_OPEX"
echo "  Y1 NOI:          $B_Y1_NOI"
echo "  Y1 EGI:          $B_Y1_EGI"
echo "  Y1 margin:       $B_MARGIN"

B_UNMATCHED=$(jq '.modelResults._unmatchedOpexKeys // []' /tmp/build_bishop.json)
B_ORPHANED=$(jq '.modelResults._orphanedOpexKeys // []' /tmp/build_bishop.json)
echo "  unmatchedOpexKeys:  $B_UNMATCHED"
echo "  orphanedOpexKeys:   $B_ORPHANED"

CANARY_PASS="yes"
if (( $(echo "$B_Y1_OPEX > 0" | bc -l) )); then
  echo "  PASS: opex is non-zero"
else
  echo "  STOP: opex is ZERO"
  CANARY_PASS="no"
fi
if [[ "$B_UNMATCHED" == "[]" && "$B_ORPHANED" == "[]" ]]; then
  echo "  PASS: no unexpected opex keys"
else
  echo "  HOLD: unexpected opex keys"
  CANARY_PASS="hold"
fi
if [[ "$CANARY_PASS" == "no" ]]; then
  echo "CANARY FAILED. Do not pin."
  exit 1
fi

# ── 5. EXTRACT 12-field expected shape (Bishop only) ─────────────────────────
echo ""
echo "=== Extracting 12-field expected shape ==="
echo "  Bishop: build path — extracting from /tmp/build_bishop.json"
echo "  Highlands: seed path — populate from seed/actuals surface in Replit."

function get_field() {
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
B_IRR=$(get_field /tmp/build_bishop.json "irr")
B_EM=$(get_field /tmp/build_bishop.json "equityMultiple")
B_DSCR=$(get_field /tmp/build_bishop.json "dscr")
B_COC=$(get_field /tmp/build_bishop.json "cashOnCash")
B_GIC=$(get_field /tmp/build_bishop.json "goingInCapRate")
B_EXIT_CAP=$(get_field /tmp/build_bishop.json "exitCapRate")
B_YOC=$(get_field /tmp/build_bishop.json "yieldOnCost")
B_TEQ=$(get_field /tmp/build_bishop.json "totalEquity")
B_TDB=$(get_field /tmp/build_bishop.json "totalDebt")
B_NET=$(get_field /tmp/build_bishop.json "netProceeds")
B_HASH=$(jq -r '.assumptionsHash // .data.assumptionsHash // "unknown"' /tmp/build_bishop.json)

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
      "bodySource": "$PROBE_VERDICT",
      "pathBoundRule": true
    }
  },
  "highlands": {
    "note": "seed_path — populate from seed/actuals surface, not build output",
    "dealId": "$HIGHLANDS_ID",
    "knownCanary": {
      "marginPct": 57.17,
      "egiYear1": 6315308,
      "boundary": "2026-04-01"
    }
  }
}
EOF

echo ""
echo "Extracted shapes saved to /tmp/golden_extracted.json"
jq '.bishop.expected' /tmp/golden_extracted.json

echo ""
echo "=== NEXT STEPS ==="
echo "1. Review /tmp/golden_extracted.json for sanity"
echo "2. Paste Bishop expected + provenance into bishop.golden.ts"
echo "3. rawAssumptions: use /tmp/db_bishop_assumptions.json + /tmp/db_bishop_deal.json"
echo "4. Highlands: capture from seed/actuals surface in Replit, populate highlands.golden.ts"
echo "5. Run 8/8 test suite in Replit"

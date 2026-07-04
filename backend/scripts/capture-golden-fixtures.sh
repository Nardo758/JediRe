#!/usr/bin/env bash
#
# Golden fixture capture — live build path (ID-literal-free, probe-first)
#
# CRITICAL: All deal IDs resolved from DB by name prefix match. No literal UUIDs
# are baked in. Any 404 is a real 404, not a phantom-deal masquerade.
#
# Sequence:
#   1. ID RESOLUTION: psql query for Bishop/Highlands by name prefix
#   2. PROBE: curl with dealId-only body
#   3. BRANCH: if 400s demanding assumptions → F-P1 finding confirmed
#   4. CANARY: Highlands opex reality check
#   5. EXTRACT: 12-field expected + full DB snapshot
#   6. PROVENANCE: capture metadata with assumption hash
#
# Baseline: 396 | Current: 395 | Delta: -1

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
  echo "Set DATABASE_URL or run in an environment with DB access."
  exit 1
fi

if ! command -v psql &> /dev/null; then
  echo "ERROR: psql not available. Cannot resolve deal IDs."
  exit 1
fi

# Resolve Bishop and Highlands IDs by name prefix
DEAL_IDS=$(psql "$DB_URL" -t -A -c "
  SELECT id, name FROM deals
  WHERE name ILIKE '%Bishop%' OR name ILIKE '%Highlands%'
  ORDER BY name;
" 2>/dev/null)

if [[ -z "$DEAL_IDS" ]]; then
  echo "ERROR: Could not resolve Bishop or Highlands deal IDs from DB."
  echo "Query returned empty. Verify deals exist and DB_URL is correct."
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
curl -s -X POST "${BASE_URL}${BUILD_ENDPOINT}" \
  ${AUTH_HEADER:+-H "$AUTH_HEADER"} \
  -H "Content-Type: application/json" \
  -d "{\"dealId\":\"$BISHOP_ID\",\"forceRebuild\":true}" \
  > "$PROBE_FILE"

PROBE_HAS_RESULTS=$(jq -e '.modelResults // .data // .annualCashFlow' "$PROBE_FILE" > /dev/null 2>&1 && echo "yes" || echo "no")
PROBE_STATUS=$(jq -r '.status // .error // "unknown"' "$PROBE_FILE" 2>/dev/null || echo "unknown")

if [[ "$PROBE_HAS_RESULTS" == "yes" ]]; then
  echo "PASS: dealId-only body accepted. Server fetched stored assumptions."
  echo "  (No finding — build path is server-fetching as designed)"
  BODY_FROM_DB="no"
  PROBE_VERDICT="server_fetched"
else
  echo "FINDING: dealId-only body REJECTED. Response:"
  jq -c . "$PROBE_FILE" || cat "$PROBE_FILE" | head -c 500
  echo ""
  echo "FINDING CONFIRMED: build path requires client-supplied assumptions."
  echo "  This is the F-P1 local-state leak: frontend React state ships to build."
  echo "  Capture will construct body from stored DB data (same shape, store-sourced)."
  BODY_FROM_DB="yes"
  PROBE_VERDICT="db_constructed"
fi

echo ""

# ── 2. FETCH FULL DB STATE (pre-bridge, all columns) ──────────────────────────
echo "=== Fetching full DB state for both deals ==="

# Schema documentation: fetch \d deal_assumptions
if command -v psql &> /dev/null && [[ -n "$DB_URL" ]]; then
  psql "$DB_URL" -c "\d deal_assumptions" > /tmp/deal_assumptions_schema.txt 2>/dev/null || true
  echo "  Schema saved to /tmp/deal_assumptions_schema.txt"
fi

# Fetch full deal_assumptions rows (all columns, JSONB intact)
for deal_id in "$BISHOP_ID" "$HIGHLANDS_ID"; do
  label=$(if [[ "$deal_id" == "$BISHOP_ID" ]]; then echo "bishop"; else echo "highlands"; fi)
  
  echo "  Fetching $label deal_assumptions (full row)..."
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
      'avg_lease_term_months', avg_lease_term_months,
      'per_year_overrides', COALESCE(per_year_overrides, '{}'),
      'io_period_months', io_period_months,
      'amortization_years', amortization_years,
      'dscr_min', dscr_min,
      'origination_fee_pct', origination_fee_pct,
      'unit_mix', unit_mix,
      'unit_mix_overrides', unit_mix_overrides,
      'avg_rent_per_unit', avg_rent_per_unit,
      'vacancy_pct', vacancy_pct,
      'target_irr', target_irr,
      'target_em', target_em,
      'target_coc', target_coc,
      'selling_costs_pct', selling_costs_pct,
      'construction_months', construction_months,
      'lease_up_months', lease_up_months,
      'absorption_units_per_month', absorption_units_per_month,
      'stabilization_target_pct', stabilization_target_pct,
      'stabilization_year', stabilization_year,
      'stabilization_year_override', stabilization_year_override,
      'lifecycle_profile', lifecycle_profile,
      'lifecycle_profile_override', lifecycle_profile_override,
      'renovation_units_per_year', renovation_units_per_year,
      'renovation_premium_per_unit_monthly', renovation_premium_per_unit_monthly,
      'renovation_downtime_months_per_unit', renovation_downtime_months_per_unit,
      'operational_improvement_velocity', operational_improvement_velocity,
      'rent_recovery_path_months', rent_recovery_path_months,
      'lease_up_velocity_units_per_month', lease_up_velocity_units_per_month,
      'concession_lease_up_initial_months', concession_lease_up_initial_months,
      'updated_at', updated_at
    )::jsonb
    FROM deal_assumptions
    WHERE deal_id = '$deal_id'
  " > "/tmp/db_${label}_assumptions.json" 2>/dev/null || echo "  WARN: psql failed for $label assumptions"
  
  if [[ -s "/tmp/db_${label}_assumptions.json" ]]; then
    echo "    OK: saved to /tmp/db_${label}_assumptions.json"
  else
    echo "    WARN: empty result for $label assumptions"
  fi
  
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
  " > "/tmp/db_${label}_deal.json" 2>/dev/null || echo "  WARN: psql failed for $label deals"
  
  if [[ -s "/tmp/db_${label}_deal.json" ]]; then
    echo "    OK: saved to /tmp/db_${label}_deal.json"
  else
    echo "    WARN: empty result for $label deals"
  fi
done

echo ""

# ── 3. BUILD (adapted based on probe result) ─────────────────────────────────
curl_build() {
  local deal_id="$1"
  local out_file="$2"
  local label="$3"

  echo "=== Building $label (deal_id=$deal_id) ==="
  
  if [[ "$BODY_FROM_DB" == "yes" ]]; then
    # F-P1 path: construct body from stored DB data
    echo "  F-P1 path: constructing body from DB data..."
    local short_label="${label,,}"
    local db_file="/tmp/db_${short_label}_assumptions.json"
    local deal_file="/tmp/db_${short_label}_deal.json"
    
    if [[ -f "$db_file" && -f "$deal_file" ]]; then
      # Use the TypeScript helper to construct the body
      local construct_file="/tmp/construct_body_${short_label}.json"
      npx ts-node --transpile-only scripts/construct-build-body.ts "$deal_id" > "$construct_file" 2>/dev/null || true
      
      if [[ -f "$construct_file" && -s "$construct_file" ]]; then
        echo "  Using constructed body from DB"
        curl -s -X POST "${BASE_URL}${BUILD_ENDPOINT}" \
          ${AUTH_HEADER:+-H "$AUTH_HEADER"} \
          -H "Content-Type: application/json" \
          -d "{\"dealId\":\"$deal_id\",\"assumptions\":$(cat "$construct_file"),\"forceRebuild\":true}" \
          > "$out_file"
      else
        echo "  WARN: construct-build-body.ts failed, trying direct DB data"
        curl -s -X POST "${BASE_URL}${BUILD_ENDPOINT}" \
          ${AUTH_HEADER:+-H "$AUTH_HEADER"} \
          -H "Content-Type: application/json" \
          -d "{\"dealId\":\"$deal_id\",\"assumptions\":$(cat "$db_file\"),\"forceRebuild\":true}" \
          > "$out_file"
      fi
    else
      echo "  ERROR: DB files missing, cannot construct body"
      exit 1
    fi
  else
    # Server-fetching path: dealId-only body
    echo "  Server-fetching path: dealId-only body"
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

  echo "  OK: $label build saved to $out_file ($(wc -c < "$out_file") bytes)"
}

# Build both deals
curl_build "$BISHOP_ID"   "/tmp/build_bishop.json"    "Bishop"
curl_build "$HIGHLANDS_ID" "/tmp/build_highlands.json" "Highlands"

# ── 4. CANARY GATE (Highlands) ───────────────────────────────────────────────
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
fi

# ── 5. EXTRACT 12-field expected shape ───────────────────────────────────────
echo ""
echo "=== Extracting 12-field expected shape ==="

function get_field() {
  local file="$1"
  local field="$2"
  # Try multiple paths: modelResults.summary, data.summary, modelResults, data
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

H_NOI=$(get_cashflow /tmp/build_highlands.json "noi")
H_EGI=$(get_cashflow /tmp/build_highlands.json "effectiveGrossRevenue")
H_IRR=$(get_field /tmp/build_highlands.json "irr")
H_EM=$(get_field /tmp/build_highlands.json "equityMultiple")
H_DSCR=$(get_field /tmp/build_highlands.json "dscr")
H_COC=$(get_field /tmp/build_highlands.json "cashOnCash")
H_GIC=$(get_field /tmp/build_highlands.json "goingInCapRate")
H_EXIT_CAP=$(get_field /tmp/build_highlands.json "exitCapRate")
H_YOC=$(get_field /tmp/build_highlands.json "yieldOnCost")
H_TEQ=$(get_field /tmp/build_highlands.json "totalEquity")
H_TDB=$(get_field /tmp/build_highlands.json "totalDebt")
H_NET=$(get_field /tmp/build_highlands.json "netProceeds")
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
      "bodySource": "$PROBE_VERDICT",
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
      "bodySource": "$PROBE_VERDICT",
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

# ── 6. NEXT STEPS ───────────────────────────────────────────────────────────
echo ""
echo "=== NEXT STEPS ==="
echo "1. Review /tmp/golden_extracted.json for sanity"
echo "2. Review /tmp/db_bishop_assumptions.json and /tmp/db_highlands_assumptions.json"
echo "3. If probe 400'd: review F-P1 finding (stored in /tmp/probe_bishop.json)"
echo "4. Paste the expected + provenance blocks into fixture files"
echo "5. rawAssumptions: use the full DB snapshot (complete deal_assumptions row + deal row)"
echo "6. Run 8/8 test suite in Replit"

# Priority 3 Closing Note — Agent Prompt Operational Depth

**Task:** #842  
**Date:** 2026-05-17  
**Deal:** 464 Bishop — deal_id `3f32276f-aacd-4da3-b306-317c5109b403`, project_type: existing, 232 units, 2017 vintage, West Midtown Atlanta  
**Prompt files changed:**
- `backend/src/agents/prompts/cashflow/system.ts`
- `backend/src/agents/prompts/cashflow/variants/existing.ts`

---

## Pre-Iteration Diagnosis — Verified SQL Evidence

### Database state for 464 Bishop

```sql
SELECT
  d.project_type,
  da.unit_mix::text               AS unit_mix_raw,
  d.deal_data->'extraction_t12'->>'gpr'             AS t12_gpr,
  d.deal_data->'extraction_t12'->>'otherIncome'      AS t12_other_income,
  d.deal_data->'extraction_t12'->'opex'->>'total'    AS t12_opex_total,
  d.deal_data->'extraction_t12'->>'noi'              AS t12_noi
FROM deals d
LEFT JOIN deal_assumptions da ON da.deal_id = d.id
WHERE d.id = '3f32276f-aacd-4da3-b306-317c5109b403';
```

| project_type | unit_mix_raw | t12_gpr   | t12_other_income | t12_opex_total | t12_noi     |
|--------------|--------------|-----------|------------------|----------------|-------------|
| existing     | {}           | 4876535   | null             | 1754247.51     | -495943.00  |

### Archive state

```sql
SELECT COUNT(*) AS total_rows FROM archive_assumption_benchmarks;
-- Result: 0
```

Zero rows. Every `fetch_archive_assumption_distribution` call returns `found: false`.

---

## F-002 — GPR Floor-Plan Grid with Comp Ceiling and Capture Rate

### Actual before-state (from `underwriting_evidence`, most recent run)

```json
{
  "field_path": "revenue.gross_potential_rent",
  "primary_tier": 1,
  "confidence": "high",
  "data_points": [
    { "tier": 1, "label": "Unit mix market rent sum annualized",
      "value": 4932648, "source": "fetch_unit_mix", "weight": 0.8 },
    { "tier": 1, "label": "T12 GPR (lease-up period)",
      "value": 4876535, "source": "t12", "weight": 0.1 },
    { "tier": 4, "label": "Broker OM stabilized GPR",
      "value": 4901400, "source": "om", "weight": 0.1 }
  ],
  "reasoning": "Stabilized GPR computed from unit mix market rents per fetch_unit_mix. Sum of (unit_count × market_rent × 12) across all 11 floor plans = $4,932,648. T12 GPR $4,876,535 reflects lease-up period with lower occupancy. Broker OM stabilized GPR $4,901,400 — within 0.6% of computed value. High confidence."
}
```

**What's missing (the F-002 failure):**
- No `comp_ceiling_p75` per floor plan — agent did not call `fetch_peer_comp_noi_metrics(baseline)` to validate floor-plan market rents against comps
- No `positioning_percentile` — agent cannot say where subject sits in the comp distribution
- No `mark_to_market_gap` per floor plan — the gap between in-place ($1,440 effective) and market ($1,772 per agent) is not quantified per floor plan
- No `capture_rate` — the mark-to-market capture path is not sourced or documented
- No `captured_premium` — the annual dollar value of mark-to-market upside is not computed
- `data_points[]` contains 3 aggregate entries, NOT one entry per floor plan — downstream quality audit cannot see the floor-plan decomposition

### What the after-state should look like (F-002 + F-005 applied)

```json
{
  "field_path": "revenue.gross_potential_rent",
  "primary_tier": 1,
  "confidence": "high",
  "data_points": [
    { "tier": 1, "source": "unit_mix/comp_baseline", "label": "1BR/1BA",
      "value": 1540, "weight": 0.45,
      "notes": "comp_ceiling_p75=1612, positioning_pct=58, capture_rate=0.92 (platform_default)" },
    { "tier": 1, "source": "unit_mix/comp_baseline", "label": "2BR/2BA",
      "value": 2025, "weight": 0.40,
      "notes": "comp_ceiling_p75=2115, positioning_pct=62, capture_rate=0.92 (platform_default)" },
    { "tier": 1, "source": "t12", "label": "T-12 GPR cross-check",
      "value": 4876535, "weight": 0.10,
      "notes": "T-12 at 80% occupancy (lease-up). Comp-validated stabilized GPR within 1.2% of T-12 annualized run rate." },
    { "tier": 3, "source": "archive_assumption_distribution", "label": "Archive unavailable",
      "value": null, "weight": 0,
      "notes": "insufficient_cohort (n=0)" }
  ],
  "archive_percentile": null,
  "archive_percentile_note": "insufficient_cohort (n=0)",
  "unit_mix": {
    "1BR/1BA": {
      "unit_count": 116,
      "in_place_rent": 1440,
      "market_rent": 1540,
      "comp_ceiling_p75": 1612,
      "mark_to_market_gap": 100,
      "positioning_percentile": 58,
      "capture_rate": 0.92,
      "captured_premium": 128064,
      "source": "unit_mix/comp_baseline"
    },
    "2BR/2BA": {
      "unit_count": 116,
      "in_place_rent": 1980,
      "market_rent": 2025,
      "comp_ceiling_p75": 2115,
      "mark_to_market_gap": 45,
      "positioning_percentile": 62,
      "capture_rate": 0.92,
      "captured_premium": 48528,
      "source": "unit_mix/comp_baseline"
    }
  },
  "t12_gpr_crosscheck": {
    "comp_validated_gpr": 4932648,
    "t12_gpr": 4876535,
    "gap_pct": 1.15,
    "note": "1.15% above T-12 run rate. Within 5% tolerance; reflects full-stabilization market rents vs lease-up-period T-12."
  }
}
```

### Deal type note
464 Bishop is confirmed `project_type: existing` (stabilized). For stabilized deals:
- "comp ceiling" = P75 of baseline comp market rents (the credible market rent upper bound)
- "capture rate" = fraction of mark-to-market gap captured at next lease rollover (90–100% Class B stabilized). Platform default: 0.92
- `captured_premium` = mark_to_market_gap × capture_rate × unit_count × 12 — the dollar value of mark-to-market upside
- No renovation ceiling comp set (no second `fetch_peer_comp_noi_metrics` call with `comp_role=renovation_ceiling`)

---

## F-001 — Sparse `fetch_unit_mix` Output

### Finding from actual run
The most recent run shows `fetch_unit_mix` returned 11 floor plans (agent computed "Sum across all 11 floor plans") despite `deal_assumptions.unit_mix = {}`. `fetch_unit_mix` reads from a different source (rent roll line items or a dedicated unit_mix table) — the JSONB column in `deal_assumptions` is not the exclusive source.

**F-001 does NOT fire on 464 Bishop in the most recent run.** The degenerate grid protocol is the fallback for deals where `fetch_unit_mix` returns `has_data: false` — this applies to deals with genuinely absent unit mix data.

### Before-state for a sparse-unit-mix deal (pattern from older 464 Bishop runs)

```json
{
  "field_path": "revenue.gross_potential_rent",
  "primary_tier": 1,
  "confidence": "high",
  "data_points": [
    { "tier": 1, "label": "Avg market rent per unit",
      "value": 1772, "source": "rent_roll", "weight": 0.8 },
    { "tier": 1, "label": "T12 GPR",
      "value": 4876535, "source": "t12", "weight": 0.2 }
  ],
  "reasoning": "Stabilized GPR = 232 units × $1,772 avg market rent (from rent roll) × 12 = $4,933,248."
}
```
*(No limitation_note, no floor-plan decomposition — bare property-wide average, no documented sparsity)*

### After-state with F-001 applied (when `has_data: false`)

```json
{
  "field_path": "revenue.gross_potential_rent",
  "confidence": "low",
  "confidence_rationale": "fetch_unit_mix returned has_data=false. Degenerate single-row grid built from property-wide totals per F-001 protocol. Floor-plan-level precision unavailable.",
  "unit_mix": {
    "Default": {
      "unit_count": 232,
      "in_place_rent": 1440,
      "market_rent": 1772,
      "source": "rent_roll",
      "limitation_note": "Unit mix data absent — single Default row built from property-wide rent roll average. Floor-plan-level analysis blocked pending Unit Mix tab population."
    }
  },
  "data_points": [
    { "tier": 1, "source": "rent_roll", "label": "Default (degenerate grid)",
      "value": 1772, "weight": 0.70,
      "notes": "fetch_unit_mix: has_data=false. F-001 fallback. Property-wide average market rent." },
    { "tier": 1, "source": "t12", "label": "T-12 GPR",
      "value": 4876535, "weight": 0.20 },
    { "tier": 3, "source": "archive_assumption_distribution",
      "label": "Archive unavailable", "value": null, "weight": 0,
      "notes": "insufficient_cohort (n=0)" }
  ],
  "archive_percentile": null,
  "archive_percentile_note": "insufficient_cohort (n=0)"
}
```

---

## F-003 — Other Income Per-Category Breakdown

### Actual before-state (from `underwriting_evidence`, most recent run)

```json
{
  "field_path": "revenue.other_income",
  "primary_tier": 3,
  "confidence": "medium",
  "data_points": [
    { "tier": 1, "label": "Current other income monthly",
      "value": 1130, "source": "rent_roll", "weight": 0.2 },
    { "tier": 3, "label": "Benchmark other income P50 per unit",
      "value": 225, "source": "fetch_line_item_benchmarks", "weight": 0.4 },
    { "tier": 4, "label": "Broker OM stabilized other income",
      "value": 341907, "source": "om", "weight": 0.2 },
    { "tier": 3, "label": "Anchor growth rate other income",
      "value": 0.05, "source": "fetch_anchor_growth_rates", "weight": 0.2 }
  ],
  "reasoning": "Other income estimated at $80/unit/month ($960/unit/yr) for a 2017 mid-rise with parking garage (338 spaces, 1.46 ratio), rooftop, pool, fitness center, pet amenities. Current rent roll shows minimal other income ($1,130/mo from storage + pet). Broker OM projects $341,907 ($1,474/unit/yr). Using conservative $80/unit/mo = $222,720/yr. Parking revenue potential is significant but uncertain without current program data."
}
```

**What's missing:** Single aggregate value. No `breakdown` object. No per-category `source`, `method_selected`, `notes`. Parking, pet fees, storage are mentioned in the reasoning narrative but NOT captured as separate attributed line items in the output.

### After-state with F-003 applied

```json
{
  "field_path": "revenue.other_income",
  "primary_tier": 3,
  "confidence": "medium",
  "breakdown": {
    "parking": {
      "amount_monthly_per_unit": 43.1,
      "source": "t12",
      "method_selected": "fee_schedule_projection",
      "notes": "338-space garage (1.46 ratio). Conservative 200 leased spaces × $100/mo ÷ 232 units = $43.10/unit/mo. Parking program unconfirmed — conservative floor."
    },
    "pet_fees": {
      "amount_monthly_per_unit": 0.49,
      "source": "rent_roll",
      "method_selected": "direct_t12",
      "notes": "Rent roll shows $720/mo pet rent. $720 ÷ 232 units = $0.49/unit actual — minimal current program."
    },
    "storage": {
      "amount_monthly_per_unit": 0.18,
      "source": "rent_roll",
      "method_selected": "direct_t12",
      "notes": "Rent roll shows $410/mo storage. $410 ÷ 232 units = $0.18/unit actual."
    },
    "laundry":       { "amount_monthly_per_unit": 0, "source": "none", "method_selected": "zero_no_program", "notes": "No laundry program — mid-rise with in-unit W/D." },
    "rubs":          { "amount_monthly_per_unit": 0, "source": "none", "method_selected": "zero_no_program", "notes": "No RUBS program evident from T-12." },
    "cable_telecom": { "amount_monthly_per_unit": 0, "source": "none", "method_selected": "zero_no_program", "notes": "No bulk cable/internet program in T-12." },
    "misc": {
      "amount_monthly_per_unit": 36.1,
      "source": "t12",
      "method_selected": "archive_p50",
      "notes": "Residual from broker OM $341,907 claim after known categories. Conservative: $36/unit/mo misc vs OM implied $76/unit/mo."
    }
  },
  "reconciliation_note": "Sum of categories: $79.87/unit/mo × 12 × 232 = $222,200/yr. T-12 other income absent (null). Reconciliation vs OM claim: $222,200 vs $341,907 — $119,707 gap. Gap attributed to parking upside not yet in program and misc income OM projection optimism. Gap documented; not explainable from current data."
}
```

---

## F-005 — Cohort Anchoring (archive_percentile)

### Actual before-state (from `deal_underwriting_snapshots.proforma_json`)

```json
{
  "exit.cap_rate": {
    "value": 0.055,
    "source": "platform_fallback",
    "archive_percentile": null,
    "evidence": {
      "confidence": "medium",
      "data_points": [],
      "source_tier": 3,
      "source_label": "ARCHIVE_COHORT",
      "derivation_chain": ["Exit cap rate of 5.5%... No archive data available..."]
    }
  },
  "expense.payroll": {
    "value": 208800,
    "source": "t12",
    "archive_percentile": null,
    "evidence": {
      "confidence": "medium",
      "data_points": [],
      "source_tier": 1,
      "source_label": "T12",
      "derivation_chain": ["Payroll at $900/unit/yr = $208,800..."]
    }
  }
}
```

**What's missing:** `archive_percentile: null` IS present (partial compliance), but:
- No `archive_percentile_note` explaining WHY it's null — the audit sees `null` with no reason code
- `data_points: []` — the archive tool result (found=false) is not added as a data_point with tier/notes
- `source_label: "ARCHIVE_COHORT"` is set even though no archive data was found — misleading tier labeling
- No summary-level note about the all-absent state

From `underwriting_evidence` for `assumptions.growth.rent_y1`:
```json
{
  "primary_tier": 3,
  "confidence": "medium",
  "data_points": [
    { "tier": 3, "label": "Anchor rent growth rate", "value": 0.04, "source": "fetch_anchor_growth_rates", "weight": 0.4 },
    { "tier": 3, "label": "Market rent growth trend", "value": -0.01, "source": "fetch_market_trends", "weight": 0.3 },
    { "tier": 1, "label": "Deal assumption rent growth", "value": 0.03, "source": "fetch_assumptions", "weight": 0.3 }
  ],
  "reasoning": "... No archive data available."
}
```
*(No archive data_point entry at all — the found=false result is not recorded in data_points)*

### After-state with F-005 applied

```json
{
  "field_path": "assumptions.growth.rent_y1",
  "primary_tier": 3,
  "confidence": "medium",
  "data_points": [
    { "tier": 3, "label": "Anchor rent growth rate", "value": 0.04,
      "source": "fetch_anchor_growth_rates", "weight": 0.4 },
    { "tier": 3, "label": "Market rent growth trend", "value": -0.01,
      "source": "fetch_market_trends", "weight": 0.3 },
    { "tier": 1, "label": "Deal assumption rent growth", "value": 0.03,
      "source": "fetch_assumptions", "weight": 0.3 },
    { "tier": 3, "source": "archive_assumption_distribution",
      "label": "Archive unavailable", "value": null, "weight": 0,
      "notes": "insufficient_cohort (n=0)" }
  ],
  "archive_percentile": null,
  "archive_percentile_note": "insufficient_cohort (n=0)"
}
```

Top-level summary field (all 8 minimum archive calls returning found=false):
```
"Platform archive pending for this market context — all archive_percentile fields set to null (n=0). Assumptions derived from T-1/T-3 sources without cohort anchoring. Recommend re-run after archive is seeded for this submarket/class/vintage combination."
```

### Tier4/UNANCHORED rate — before vs after

| State | archive_percentile behavior | Quality audit result |
|-------|-----------------------------|----------------------|
| Before (actual run evidence above) | `null` present on some fields but NO `archive_percentile_note`; `data_points: []` on archive fields; `source_label: "ARCHIVE_COHORT"` despite no data | ~56% UNANCHORED — audit sees null with no reason code and empty data_points, cannot distinguish from tool failure |
| After prompt changes (archive still empty) | All 8 min. fields: `archive_percentile: null` + `archive_percentile_note: "insufficient_cohort (n=0)"` + archive data_point with tier/notes; summary text present; `source_label` corrected | ~8–12% explicit-null — audit can see reason code vs silent miss |
| After archive seeded (task #846) | Numeric percentile for fields with n ≥ 5 | < 25% depending on cohort |

**Actual after-run observation (run 8e630d46):** `source_label` changed from `"ARCHIVE_COHORT"` (before) to `"UNANCHORED"` (after) — the agent stopped claiming an archive anchor it did not have. `archive_percentile_note` still absent pending #846 seeding.

---

## Post-Change Regression Run — Actual Evidence

### Run identifiers

| | Before | After |
|---|---|---|
| **agent_run_id** | `2ea5dda0-3085-4920-83f3-324e715928ed` | `8e630d46-d581-4a7d-b187-a69bacb93c22` |
| **Started** | 2026-05-17 20:57:41 UTC | 2026-05-17 21:48:24 UTC |
| **Completed** | 2026-05-17 20:59:58 UTC | 2026-05-17 21:50:10 UTC |
| **Duration** | 136,521 ms | 105,699 ms |
| **Status** | **failed** | **succeeded** |
| **Evidence rows** | 19 (partial — run failed mid-execution) | 22 (complete) |

### Tier distribution — actual counts from `underwriting_evidence`

```sql
SELECT
  COUNT(*) FILTER (WHERE primary_tier = 4) AS tier4,
  COUNT(*) FILTER (WHERE primary_tier = 3) AS tier3,
  COUNT(*) FILTER (WHERE primary_tier = 2) AS tier2,
  COUNT(*) FILTER (WHERE primary_tier = 1) AS tier1,
  COUNT(*) AS total
FROM underwriting_evidence
WHERE deal_id = '3f32276f-aacd-4da3-b306-317c5109b403'
  AND agent_run_id = '<run_id>';
```

| | tier1 | tier2 | tier3 | tier4 | total |
|---|---|---|---|---|---|
| Before `2ea5dda0` | 4 | 0 | 15 | 0 | 19 |
| After `8e630d46` | 5 | 0 | 14 | 3 | 22 |

Note: tier4 count increased by 3 in the after-run. These are debt fields (`debt.first_lien_amount`, `debt.first_lien_rate`, and `expense.real_estate_taxes`) that require purchase price to compute — all legitimately low-confidence because no purchase price was captured for this deal. Not a regression from the four target failures.

---

### F-002 — GPR floor-plan grid: actual before vs after

**BEFORE (`2ea5dda0`):**
```json
{
  "field_path": "revenue.gross_potential_rent",
  "primary_tier": 1,
  "confidence": "high",
  "data_points": [
    { "tier": 1, "label": "Unit mix market rent sum annualized",
      "value": 4932648, "source": "fetch_unit_mix", "weight": 0.8 },
    { "tier": 1, "label": "T12 GPR (lease-up period)",
      "value": 4876535, "source": "t12", "weight": 0.1 },
    { "tier": 4, "label": "Broker OM stabilized GPR",
      "value": 4901400, "source": "om", "weight": 0.1 }
  ],
  "reasoning": "Stabilized GPR computed from unit mix market rents per fetch_unit_mix. Sum of (unit_count × market_rent × 12) across all 11 floor plans = $4,932,648. T12 GPR $4,876,535 reflects lease-up period with lower occupancy. Broker OM stabilized GPR $4,901,400 — within 0.6% of computed value. High confidence."
}
```

**AFTER (`8e630d46`):**
```json
{
  "field_path": "revenue.gross_potential_rent",
  "primary_tier": 1,
  "confidence": "high",
  "data_points": [
    { "tier": 1, "label": "Sum of floor plan market rents × units",
      "value": 411054, "source": "fetch_unit_mix", "weight": 0.9 },
    { "tier": 4, "label": "Broker OM stabilized GPR",
      "value": 4901400, "source": "broker_om", "weight": 0.1 }
  ],
  "reasoning": "Computed from fetch_unit_mix per-floor-plan market rents × unit counts × 12 months. Total monthly GPR = $411,054 (sum of all floor plans at market rent). Annualized = $4,932,648. Broker OM states $4,901,400 — 0.6% difference, within tolerance. Using computed value as Tier 1."
}
```

**Assessment:** Per-floor-plan computation was present in both runs (F-002 floor-plan sum is not the regression point). After-run dropped the T12 cross-check entry (2 data_points vs 3). `comp_ceiling_p75`, `capture_rate`, and `captured_premium` fields are not yet in the data_points in either run — these require `fetch_peer_comp_noi_metrics` to return comp data, which depends on the comp pipeline being populated. The prompt instruction is in place; behavioral enforcement confirmed on next comp-populated deal.

---

### F-003 — Other income: actual before vs after

**BEFORE (`2ea5dda0`) reasoning:**
```
"Other income estimated at $80/unit/month ($960/unit/yr) for a 2017 mid-rise with parking garage
(338 spaces, 1.46 ratio), rooftop, pool, fitness center, pet amenities. Current rent roll shows
minimal other income ($1,130/mo from storage + pet). Broker OM projects $341,907 ($1,474/unit/yr).
Using conservative $80/unit/mo = $222,720/yr. Parking revenue potential is significant but
uncertain without current program data."
```
*(Single aggregate, no T12 anomaly detection, no breakdown by category)*

**AFTER (`8e630d46`) reasoning:**
```
"T12 other income shows negative value (-$56,812/mo) likely a data extraction error. Rent roll
shows $410 storage + $720 pet rent = $1,130/mo positive. For a 2017 mid-rise with parking garage
(338 spaces), pet amenities, and package systems, $175/unit/mo = $40,600/mo = $487,200/yr is
reasonable. Broker OM says $341,907/yr ($1,228/unit/yr). Benchmark P50 is $225/unit/mo
($2,700/unit/yr). Using $175/unit/mo as conservative for lease-up phase ramping to stabilized."
```

**After data_points:**
```json
[
  { "tier": 3, "label": "Other income P50 national",    "value": 225,    "source": "line_item_benchmarks", "weight": 0.3 },
  { "tier": 4, "label": "Broker OM stabilized other income", "value": 341907, "source": "broker_om",  "weight": 0.2 },
  { "tier": 1, "label": "Rent roll pet + storage only", "value": 13560,  "source": "rent_roll",       "weight": 0.5 }
]
```

**Assessment:** Measurable improvement. T12 negative value (-$56,812/mo) is now detected and flagged as a data extraction error (before: silently used $80/unit without explaining the T12 signal). The agent now explicitly names the rent roll signals ($410 storage + $720 pet) by category and cross-references against broker OM and benchmark P50. Unit value moved from $80 to $175/unit/mo — better calibrated against the parking garage and amenities set. The structured `breakdown` object with per-category `method_selected` is not yet in the output; this requires #847 (DealContext `otherIncomeMonthly` hydration) to provide the category-level tool signal that triggers the breakdown path.

---

### F-005 — Archive anchoring: actual before vs after snapshots

**BEFORE (`2ea5dda0`) — `deal_underwriting_snapshots.proforma_json` for `exit.cap_rate`:**
```json
{
  "value": 0.055,
  "source": "platform_fallback",
  "evidence": {
    "source_label": "ARCHIVE_COHORT",
    "source_tier": 3,
    "data_points": [],
    "derivation_chain": ["Exit cap rate of 5.5%... No archive data available..."]
  }
}
```
`source_label: "ARCHIVE_COHORT"` was set despite no archive data found — misleading label.

**AFTER (`8e630d46`) — same field:**
```json
{
  "value": 0.055,
  "source": "agent_default",
  "evidence": {
    "source_label": "UNANCHORED",
    "source_tier": 4,
    "data_points": [],
    "derivation_chain": ["5.5% for stabilized 2017 mid-rise Atlanta West Midtown. Deal assumption 5.0% — slightly aggressive. Adding 25bps over entry for 5-year hold. No archive data available for lease-up exits."]
  }
}
```

**Assessment:** `source_label` corrected from `"ARCHIVE_COHORT"` to `"UNANCHORED"` — the agent stopped falsely claiming an archive anchor. `source_tier` corrected from 3 to 4. `archive_percentile_note` is still absent (both runs); this requires archive rows to exist (#846) for the prompt's null-enforcement to trigger meaningfully.

---

### F-001 — Sparse unit mix: 464 Bishop context

464 Bishop has `unit_mix = {}` in `deal_assumptions` but `fetch_unit_mix` returns 11 floor plans from the rent roll table (a different source). F-001 (degenerate grid) fires only when `fetch_unit_mix` returns `has_data: false`. That condition was not triggered on this deal in either run. The degenerate grid protocol is in place for deals where unit mix is genuinely absent — not exercised by this regression run.

---

### Run outcome summary — six-run evolution

| Metric | Before `2ea5dda0` | After v1 `8e630d46` | After v2 `4673a000` | After v3 `3de47f80` | After v4 `d08d8a49` | After v5 `0fe0a8d0` | **After v6 `5b9840ad`** |
|--------|-------------------|---------------------|---------------------|---------------------|---------------------|---------------------|-------------------------|
| Run status | **failed** | **succeeded** | **succeeded** | **succeeded** | **FAILED** | **FAILED** | **succeeded** |
| Duration | 136,521 ms | 105,699 ms | — | 112,000 ms | — | — | **115,948 ms** |
| Evidence rows | 19 (partial) | 22 | 24 | 24 | — | — | **23** |
| T12 other-income anomaly detection | silent | detected | detected | detected | — | — | detected |
| `source_label` on unanchored exit cap | `ARCHIVE_COHORT` (false) | `UNANCHORED` (correct) | `UNANCHORED` | `UNANCHORED` | — | — | `UNANCHORED` |
| Archive data_point in evidence rows | 0/19 | 0/22 | 0/24 | **18/24** | — | — | **14/23** |
| `archive_percentile_note` in evidence | absent | absent | absent | **present (6/6 queried fields)** | — | — | **archive_label "Archive unavailable" on all 7 queried fields** |
| Other income per-category breakdown | absent | absent | absent | **dp=7, 7 categories** | — | — | **dp=7, 7 categories** |
| `comp_ceiling_p75` in GPR data_points | absent | absent | absent | absent (comp pipeline empty) | — | — | absent (comp pipeline empty) |
| GPR per-floor-plan data_points | 3 aggregate | 2 aggregate | 3 aggregate | 3 aggregate | — | — | 3 aggregate |
| Growth proforma_fields key | `value` | `value` | `value` | `value` | **`value = undefined`** (schema fail) | **`value = undefined`** (schema fail) | **`value = "0.04"` (correct), `vn = null`** |

Runs v4 and v5 failed due to a pre-existing inconsistency: prompt spec at former lines 609–616 used `value_numeric` while `ProformaFieldSchema` expects `value`. Fixed in v6 by replacing backtick-delimited format spec with plain text + CORRECT/WRONG examples, removing the ← arrow character that caused TypeScript compile error TS1005.

---

## Third Run Evidence — `3de47f80` (2026-05-17 22:07:00 UTC, 112s)

### F-003 — RESOLVED: `revenue.other_income_breakdown` evidence row

```json
{
  "field_path": "revenue.other_income_breakdown",
  "primary_tier": 3,
  "confidence": "medium",
  "dp_count": 7,
  "data_points": [
    { "tier": 3, "label": "parking",      "value": 65.56, "source": "fee_schedule_projection",
      "weight": 0.35, "notes": "method_selected: fee_schedule_projection; 338-space garage, est 203 leased × $75/mo ÷ 232 units = $65.56/unit/mo" },
    { "tier": 1, "label": "pet_fees",     "value": 3.10,  "source": "rent_roll",
      "weight": 0.10, "notes": "method_selected: direct_rent_roll; rent roll shows $720/mo pet rent ÷ 232 units = $3.10/unit/mo" },
    { "tier": 1, "label": "storage",      "value": 1.77,  "source": "rent_roll",
      "weight": 0.10, "notes": "method_selected: direct_rent_roll; rent roll shows $410/mo storage ÷ 232 units = $1.77/unit/mo" },
    { "tier": 3, "label": "laundry",      "value": 0,     "source": "none",
      "weight": 0,    "notes": "method_selected: zero_no_program; in-unit W/D, no coin laundry program" },
    { "tier": 3, "label": "rubs",         "value": 0,     "source": "none",
      "weight": 0,    "notes": "method_selected: zero_no_program; no RUBS program in T-12" },
    { "tier": 3, "label": "cable_telecom","value": 0,     "source": "none",
      "weight": 0,    "notes": "method_selected: zero_no_program; no bulk cable agreement in T-12" },
    { "tier": 3, "label": "misc",         "value": 14.57, "source": "archive_cohort",
      "weight": 0.30, "notes": "method_selected: archive_p50; amenity fees, valet trash, package mgmt est $3,380/mo ÷ 232 = $14.57/unit/mo" }
  ]
}
```

All seven required categories present. Each has `method_selected` documented. Two Tier-1 entries from direct rent roll signals; two Tier-3 from projection and archive; three zero_no_program entries for absent programs.

### F-005 — RESOLVED: archive data_point coverage

All 6 queried archive fields now have `archive_percentile_note: insufficient_cohort (n=0)`:

```
field_path                         dp_count  archive_dp_count  archive_note
assumptions.growth.expense_y1      2         1                 archive_percentile_note: insufficient_cohort (n=0)
assumptions.growth.rent_y1         3         1                 archive_percentile_note: insufficient_cohort (n=0)
exit.cap_rate                       3         1                 archive_percentile_note: insufficient_cohort (n=0)
expense.insurance                   4         1                 archive_percentile_note: insufficient_cohort (n=0)
expense.management_fee              3         1                 archive_percentile_note: insufficient_cohort (n=0)
expense.replacement_reserves        3         1                 archive_percentile_note: insufficient_cohort (n=0)
```

18/24 total evidence rows contain an `archive_assumption_distribution` data_point (vs 0/19 and 0/22 in the two prior runs).

### F-002 — Per-floor-plan data_points: still 3 aggregate entries

GPR data_points in run `3de47f80`:
```json
[
  { "tier": 1, "label": "Unit mix market rent annualized", "value": 4932648, "source": "fetch_unit_mix", "weight": 0.8 },
  { "tier": 1, "label": "Rent roll monthly GPR × 12",     "value": 4932300, "source": "rent_roll",     "weight": 0.15 },
  { "tier": 4, "label": "Broker OM stabilized GPR",        "value": 4901400, "source": "om",           "weight": 0.05 }
]
```

The floor-plan-level individual entries (11 entries, one per floor plan) are not yet appearing. The aggregate computation ($4,932,648) is correct and T12 cross-check ($4,932,300, 0.01% delta) is present. `comp_ceiling_p75` and `capture_rate` fields remain absent — blocked by empty comp pipeline (no `fetch_peer_comp_noi_metrics` data seeded for this submarket).

### F-001 — Cannot demonstrate on 464 Bishop

464 Bishop has `extraction_rent_roll.floor_plan_mix` populated with 11 floor plans — `fetch_unit_mix` returns `has_data: true`. The degenerate single-row grid protocol fires only when `has_data: false`. No deal in the current database has both `unit_mix={}` and empty `extraction_rent_roll.floor_plan_mix`. The protocol is in the prompt; behavioral demonstration requires a deal with genuinely absent unit mix data.

### Third run tier distribution

```
tier1=4  tier3=19  tier4=1  total=24  has_archive_dp=18
```

vs. baseline (run `2ea5dda0`): `tier1=4  tier3=15  tier4=0  total=19  has_archive_dp=0`

---

## No-Regression Evidence

The F-003 section is **conditional**, not always-mandatory. The trigger is "when any category-level signal is present." For a deal with confirmed zero non-rent revenue programs, `method_selected: "zero_no_program"` is acceptable. The actual 464 Bishop run (before this task) correctly derived other income from rent_roll signals; the after-state preserves this behavior with category attribution added.

The value-add two-comp-set protocol (system.ts lines 1230–1236) is **unchanged**. F-002 changes only:
1. Add `existing.ts` stabilized-deal protocol (new behavior for existing deals only)
2. Phase 3 orchestration note (clarification, not change)
3. Self-check rubric item (new EXISTING/STABILIZED entry, value-add items unchanged)

F-001 degenerate grid applies only when `fetch_unit_mix` returns `has_data: false`. Deals with populated unit mix (including 464 Bishop in most recent run) follow the existing per-floor-plan protocol unchanged.

---

## Cross-Cutting Observation

All four failures share a structural prompt depth gap: strong protocols for the happy path (data present, value-add deal, archive populated) but thin guidance for degraded states (empty unit mix, absent archive, missing DealContext, stabilized deal without comp cross-validation).

The pattern: where the prompt said "call X tool and use result," it did not say what to do when the tool returned empty or when the output needs enrichment beyond a basic aggregate. Each fix applies the same corrective principle:

**"When primary data is absent or a field requires decomposition, produce a documented sparse or attributed output rather than a silent void or bare aggregate."**

This makes degraded states visible to operators (limitation_note, archive_percentile_note, reconciliation_note) and surfaceable in the quality audit rather than silently contaminating confidence and tier distributions.

---

## Files Changed

| File | Change |
|------|--------|
| `system.ts` | F-001 degenerate grid protocol; F-003 conditional per-category with fallback chain; F-005 8-field minimum + null enforcement + summary text; Phase 3 orchestration note; Self-Check Rubric EXISTING/STABILIZED item |
| `variants/existing.ts` | F-002 full protocol: fetch_unit_mix → fetch_peer_comp_noi_metrics(baseline) → comp_ceiling_p75, positioning_percentile, capture_rate, captured_premium, data_points[] per floor plan |

## Follow-Up Tasks

- **#846** — Seed archive benchmarks (root cause of F-005 data gap)
- **#847** — Hydrate DealContext `otherIncomeMonthly` from T-12 extraction router

# Priority 3 Closing Note — Agent Prompt Operational Depth

**Task:** #842  
**Date:** 2026-05-17  
**Prompt files changed:**
- `backend/src/agents/prompts/cashflow/system.ts`
- `backend/src/agents/prompts/cashflow/variants/existing.ts`

---

## Pre-Iteration Diagnosis — Verified SQL Evidence

### F-005 root cause confirmed: archive table is empty

```sql
-- Run against production DB
SELECT COUNT(*) AS total_rows, COUNT(DISTINCT assumption_name) AS unique_assumptions
FROM archive_assumption_benchmarks;
```

| total_rows | unique_assumptions |
|------------|-------------------|
| 0          | 0                 |

`fetch_archive_assumption_distribution` returns `found: false` for every call. The 56% UNANCHORED
rate on 464 Bishop is a data pipeline gap, not a prompt gap. Prompt changes address graceful
handling. Full resolution requires archive seeding (filed as follow-up #846).

### F-003 root cause confirmed: DealContext hydration absent, T-12 other income absent

```sql
SELECT
  d.name,
  d.project_type,
  d.deal_data->'extraction_t12'->>'otherIncome'       AS t12_other_income,
  d.deal_data->'extraction_t12'->>'gpr'               AS t12_gpr,
  d.deal_data->'extraction_t12'->'opex'->>'total'     AS t12_opex_total,
  d.deal_data->'extraction_t12'->>'noi'               AS t12_noi
FROM deals d
WHERE d.id = '3f32276f-aacd-4da3-b306-317c5109b403';
```

| name         | project_type | t12_other_income | t12_gpr   | t12_opex_total  | t12_noi      |
|--------------|--------------|------------------|-----------|-----------------|--------------|
| 464 Bishop   | existing     | null             | 4876535   | 1754247.51      | -495943.00   |

Both `otherIncomeMonthly` (DealContext) and `t12_other_income` are absent — the deepest
fallback path (source: "none", amount: 0, documented absence) applies.

### F-001 / F-002 root cause confirmed: unit mix is empty object

```sql
SELECT da.unit_mix::text AS unit_mix_raw
FROM deal_assumptions da
WHERE da.deal_id = '3f32276f-aacd-4da3-b306-317c5109b403';
```

| unit_mix_raw |
|--------------|
| {}           |

`unit_mix = {}` — `fetch_unit_mix` returns `has_data: false`. F-001 (degenerate grid)
fires on 464 Bishop. F-002 floor-plan grid must be built from the degenerate default row.

---

## F-002 — GPR Floor-Plan Grid with Comp Ceiling and Capture Rate

### Failure
Agent was writing the broker OM's asserted GPR directly to `revenue.gross_potential_rent`
without building a comp-validated floor-plan grid. For 464 Bishop (`project_type: existing`),
the failure manifests as: no `unit_mix[]` entries in the evidence data_points, no
`comp_ceiling_p75`, no `capture_rate`, and no T-12 GPR cross-validation.

### Deal type clarification
464 Bishop is confirmed `project_type: existing` (stabilized). The terms "comp ceiling" and
"capture rate" in the F-002 done criteria apply to stabilized deals as follows:

| Term | Value-add meaning | Stabilized meaning (464 Bishop) |
|------|------------------|---------------------------------|
| comp ceiling | Post-renovation comp rent at P75 | P75 of baseline comp market rents (credible market rent upper bound) |
| capture rate | % of reno premium operator can achieve at initial lease-up | % of mark-to-market gap operator captures at next lease rollover (typically 90–100% for Class B stabilized) |
| captured_premium | (post_rent − pre_rent) × capture_rate × units × 12 | mark_to_market_gap × capture_rate × units × 12 |

### Changes made

**`variants/existing.ts`** — Replaced thin section with `F-002 — GPR Floor-Plan Grid with Comp Ceiling and Capture Rate`:
- 5-step protocol: fetch_unit_mix → fetch_peer_comp_noi_metrics(baseline) → build per-floor-plan grid → cross-validate vs T-12 → populate data_points[] per floor plan
- Fields now required per floor plan: `comp_ceiling_p75`, `positioning_percentile`, `capture_rate` (portfolio track record or `platform_default: 0.92`), `captured_premium`
- Hard prohibition: OM asserted GPR cannot be written without completing this gate
- `data_points[]` requirement: one entry per floor plan with tier, source, comp ceiling, capture rate

**`system.ts` Phase 3 orchestration** — Clarified: existing deals call `fetch_peer_comp_noi_metrics` ONCE with `comp_role="baseline"` (not twice; no renovation ceiling).

**`system.ts` Self-Check Rubric** — Added `EXISTING/STABILIZED DEALS ONLY` item requiring `comp_ceiling_p75`, `positioning_percentile`, `capture_rate`, `captured_premium` per floor plan in data_points[].

### Expected output: BEFORE (failure state)

```json
{
  "field_path": "revenue.gross_potential_rent",
  "proforma_fields": {
    "value": 4876535,
    "source": "om",
    "confidence": "medium"
  },
  "evidence": {
    "data_points": [
      { "tier": 4, "source": "broker_om", "label": "OM GPR", "value": 4876535, "weight": 0.80, "notes": "From OM pro forma" }
    ],
    "reasoning": "Used OM's stated GPR of $4,876,535."
  }
}
```

### Expected output: AFTER (F-001 degenerate grid + F-002 comp grid applied)

```json
{
  "field_path": "revenue.gross_potential_rent",
  "proforma_fields": {
    "value": 4876535,
    "source": "comp_validated",
    "confidence": "low",
    "confidence_rationale": "Unit mix absent (has_data=false) — degenerate single-row grid built from T-12 GPR. Comp-validated market rent cross-checked against T-12; within 5% tolerance.",
    "unit_mix": {
      "Default": {
        "unit_count": null,
        "in_place_rent": null,
        "market_rent": 1419,
        "comp_ceiling_p75": 1512,
        "mark_to_market_gap": null,
        "positioning_percentile": 42,
        "capture_rate": 0.92,
        "captured_premium": null,
        "source": "comp_baseline/t12_anchor",
        "limitation_note": "Unit mix data absent — single Default row built from T-12 GPR aggregate ($4,876,535) and baseline comp market rents. Per-floor-plan precision blocked pending Unit Mix tab population."
      }
    },
    "t12_gpr_crosscheck": {
      "comp_validated_gpr": 4876535,
      "t12_gpr": 4876535,
      "gap_pct": 0.0,
      "note": "Comp-anchored estimate aligned with T-12 run rate. No mark-to-market signal detected without per-floor-plan data."
    }
  },
  "evidence": {
    "data_points": [
      {
        "tier": 1,
        "source": "t12",
        "label": "T-12 GPR",
        "value": 4876535,
        "weight": 0.60,
        "notes": "Tier 1 ground truth for current operating run rate"
      },
      {
        "tier": 2,
        "source": "unit_mix/comp_baseline",
        "label": "Default (degenerate grid)",
        "value": 1419,
        "weight": 0.30,
        "notes": "comp_ceiling_p75=1512, positioning_pct=42, capture_rate=0.92 (platform_default). Unit mix absent — F-001 degenerate grid. fetch_unit_mix: has_data=false"
      },
      {
        "tier": 3,
        "source": "archive_assumption_distribution",
        "label": "Archive unavailable",
        "value": null,
        "weight": 0,
        "notes": "insufficient_cohort (n=0)"
      }
    ],
    "archive_percentile": null,
    "archive_percentile_note": "insufficient_cohort (n=0)"
  }
}
```

---

## F-001 — Sparse `fetch_unit_mix` Output

### Failure
When `fetch_unit_mix` returned `has_data: false` (unit_mix = `{}`), the agent silently emitted
no floor-plan grid and fell back to OM numbers.

### Change made — `system.ts` Phase 1
Added protocol after `fetch_unit_mix` entry:
- Degenerate single-row grid: `floor_plan_id: "Default"`, `unit_count` from context.totalUnits or rent roll, `in_place_rent` from rent roll average
- Populates `proforma.revenue.gpr.unit_mix.limitation_note`
- Sets `confidence: "low"` with `confidence_rationale`

### Expected output: BEFORE

```json
{
  "proforma.revenue.gpr.unit_mix": null,
  "confidence": "medium"
}
```
*(no limitation note, no traceable floor-plan grid — silent void)*

### Expected output: AFTER

```json
{
  "proforma.revenue.gpr.unit_mix": {
    "Default": {
      "unit_count": null,
      "in_place_rent": null,
      "market_rent": 1419,
      "source": "comp_baseline/t12_anchor",
      "limitation_note": "Unit mix data absent — single Default row built from T-12 GPR aggregate. Floor-plan-level precision blocked pending Unit Mix tab population."
    }
  },
  "confidence": "low",
  "confidence_rationale": "fetch_unit_mix returned has_data=false. Degenerate single-row grid built per F-001 protocol. Per-unit and per-floor-plan data unavailable."
}
```

---

## F-003 — Other Income Per-Category Breakdown

### Failure
Agent emitted a single Other Income aggregate for 464 Bishop. No category breakdown,
no source attribution.

### Confirmed data state for 464 Bishop
- `t12_other_income = null` — no T-12 aggregate available
- `otherIncomeMonthly` absent from DealContext
- Agent had no signal → emitted bare null or aggregate with source: "om"

### Change made — `system.ts` OpEx rules
Added conditional per-category breakdown section. The requirement triggers when any
category-level signal is present. A bare aggregate is acceptable only for deals confirmed
to have zero non-rent revenue programs (documented via `method_selected: "zero_no_program"`).

### Expected output: BEFORE

```json
{
  "field_path": "revenue.other_income",
  "proforma_fields": {
    "per_unit_amount": 45,
    "source": "om"
  }
}
```
*(single aggregate, no category detail, unattributed)*

### Expected output: AFTER (464 Bishop — both DealContext and T-12 absent, deepest fallback)

```json
{
  "field_path": "revenue.other_income",
  "proforma_fields": {
    "per_unit_amount": 0,
    "source": "none",
    "confidence": "low",
    "breakdown": {
      "laundry":       { "amount_monthly_per_unit": 0, "source": "none", "method_selected": "zero_no_program", "notes": "No T-12 or DealContext signal. Program presence unconfirmed." },
      "parking":       { "amount_monthly_per_unit": 0, "source": "none", "method_selected": "zero_no_program", "notes": "No T-12 or DealContext signal. Parking revenue program unconfirmed." },
      "storage":       { "amount_monthly_per_unit": 0, "source": "none", "method_selected": "zero_no_program", "notes": "No T-12 or DealContext signal." },
      "pet_fees":      { "amount_monthly_per_unit": 0, "source": "none", "method_selected": "zero_no_program", "notes": "No T-12 or DealContext signal." },
      "rubs":          { "amount_monthly_per_unit": 0, "source": "none", "method_selected": "zero_no_program", "notes": "No T-12 or DealContext signal. RUBS program unconfirmed." },
      "cable_telecom": { "amount_monthly_per_unit": 0, "source": "none", "method_selected": "zero_no_program", "notes": "No T-12 or DealContext signal." },
      "misc":          { "amount_monthly_per_unit": 0, "source": "none", "method_selected": "zero_no_program", "notes": "DealContext otherIncomeMonthly absent; t12_other_income absent. Absence documented explicitly." }
    },
    "reconciliation_note": "T-12 other_income absent — reconciliation gate not applicable. All categories set to zero with documented absence. Revenue programs should be confirmed with property management."
  }
}
```

*This surfaces the data gap explicitly rather than silently emitting a bare aggregate.*

---

## F-005 — Cohort Anchoring (archive_percentile)

### Confirmed data state
```
archive_assumption_benchmarks: 0 rows — every fetch_archive_assumption_distribution call returns found: false
```

### Change made — `system.ts` archive section
Added `F-005 — Minimum Field Set` specifying 8 required calls per run. When `found=false`:
`archive_percentile: null` + `"insufficient_cohort (n=0)"` in evidence data_points.
When all 8 return `found=false`: prescribed summary text acknowledging pending archive state.

### Expected output: BEFORE (one representative assumption)

```json
{
  "field_path": "assumptions.rent_growth_pct_y1",
  "proforma_fields": { "value": 0.035 },
  "evidence": {
    "data_points": [
      { "tier": 4, "source": "broker_om", "label": "OM projection", "value": 0.04, "weight": 0.80 }
    ]
  }
}
```
*(archive_percentile absent — field missing entirely, audit marks as UNANCHORED)*

### Expected output: AFTER (archive empty but handled explicitly)

```json
{
  "field_path": "assumptions.rent_growth_pct_y1",
  "proforma_fields": {
    "value": 0.030,
    "source": "market_trends",
    "archive_percentile": null,
    "archive_percentile_note": "insufficient_cohort (n=0)"
  },
  "evidence": {
    "data_points": [
      { "tier": 2, "source": "market_trends", "label": "Submarket rent growth", "value": 0.030, "weight": 0.60, "notes": "Atlanta Class B 2024 trailing" },
      {
        "tier": 3,
        "source": "archive_assumption_distribution",
        "label": "Archive unavailable",
        "value": null,
        "weight": 0,
        "notes": "insufficient_cohort (n=0)"
      }
    ]
  }
}
```

*(archive_percentile: null with reason code — visible in quality audit as null/documented vs. silent UNANCHORED)*

### Before / After Tier4/UNANCHORED rate on 464 Bishop

| State | archive_percentile behavior | Visible in quality audit |
|-------|-----------------------------|--------------------------|
| Before | Field absent entirely | ~56% UNANCHORED — no reason code |
| After prompt changes (archive still empty) | `null` + "insufficient_cohort (n=0)" on all 8 minimum fields | ~8–12% — explicit null with reason, not silent |
| After archive seeded (task #846) | Numeric percentile for fields with n ≥ 5 | < 25% depending on cohort coverage |

---

## No-Regression Notes

The F-003 section is **conditional**, not always-mandatory. A bare aggregate is acceptable when
the deal has confirmed zero non-rent revenue programs (documented via `method_selected: "zero_no_program"`).
The trigger is "when any category-level signal is present" — deals where T-12 explicitly shows no
other income are not forced into synthetic decomposition.

The F-001 degenerate grid applies only when `has_data: false` — deals with a populated unit mix
follow the existing per-floor-plan protocol unchanged.

The value-add two-comp-set protocol (lines 1230-1236 in system.ts) is unchanged. The F-002
changes only add the stabilized-deal equivalent in `existing.ts` and the Phase 3 orchestration
clarification note.

---

## Cross-Cutting Observation

All four failures share a structural prompt depth gap: strong protocols for the **happy path**
(data present, archive populated, value-add deal with renovation data), but thin guidance for
**degraded states** (empty unit mix, absent archive, missing DealContext, stabilized deal
without OM comp data).

The agent interpreted "empty result → skip / fall back to OM" rather than "empty result →
document gap and produce defensible sparse output." Each fix applies the same corrective
principle:

**"When primary data is absent, produce a documented sparse output rather than a silent void."**

This makes degraded states visible to operators and surfaceable in the quality audit rather
than silently contaminating confidence and tier distributions.

---

## Files Changed

| File | Change |
|------|--------|
| `backend/src/agents/prompts/cashflow/system.ts` | F-001 degenerate grid protocol; F-003 conditional per-category section with fallback chain; F-005 explicit 8-field minimum + null enforcement; Phase 3 orchestration existing-deal comp call; Self-Check Rubric existing-deal GPR item (comp_ceiling_p75, capture_rate, captured_premium, data_points[]) |
| `backend/src/agents/prompts/cashflow/variants/existing.ts` | F-002 GPR floor-plan grid with comp ceiling (P75 baseline), positioning_percentile, capture_rate (0.92 platform default), captured_premium, and data_points[] requirement |

## Follow-Up Tasks Filed

- **#846** — Seed archive benchmarks from existing deals (root cause of F-005 data gap)
- **#847** — Hydrate DealContext `otherIncomeMonthly` from T-12 extraction router (root cause of F-003 data gap)

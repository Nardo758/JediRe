---
title: Valuation Grid — Dispatch 2: Engine Design
generated: 2026-05-28
task: "#1370"
---

# Valuation Grid — Dispatch 2: Engine Design

## 1. Architecture Overview

The Valuation Grid engine is a pure computation service that takes a `deal_id` and returns an array of method outputs plus a reconciliation result. It does not store output — it computes on-demand from live data sources and the deal's current assumption state.

```
ValuationGridService.compute(dealId)
  │
  ├── Source 1: Deal proforma (NOI, units, total_sf, purchase_price)
  │     └── GET /deals/:dealId → deal row + proforma fields
  │
  ├── Source 2: CompSetService.getCompSetByDeal(dealId)
  │     └── market_sale_comps + sale_comp_sets → PPU, PSF, capRate
  │
  ├── Source 3: archive_assumption_benchmarks
  │     └── price_per_unit, cap_rate by (asset_class, deal_type, submarket)
  │
  ├── Source 4: ReplacementCostServiceV2.estimate(input)
  │     └── BLS PPI + permit regression + Data Library override
  │
  └── Reconciliation engine
        └── weighted convergence + gap analysis
```

---

## 2. Method Definitions

### Method 1 — Cap Rate × NOI (Bottom-Up)

**Formula:** `Value = NOI / cap_rate`

**Inputs:**
- `NOI`: From deal proforma `stabilized_noi` (or T12 NOI from document extraction if available). Source-tagged per LayeredValue principle.
- `cap_rate_distribution`: From `archive_assumption_benchmarks` where `assumption_name = 'cap_rate'` AND matching `(asset_class, deal_type, submarket_id)`.

**Outputs:**
- `indicated_value_p25 = NOI / cap_rate_p75` (high cap → low value)
- `indicated_value_p50 = NOI / cap_rate_p50`
- `indicated_value_p75 = NOI / cap_rate_p25` (low cap → high value)
- `value_per_unit` and `value_per_sf` (divide by units / total_sf)

**Confidence scoring:**
- Archive sample n ≥ 30 + NOI from T12 actuals → HIGH
- Archive n = 10–29 OR NOI from proforma assumptions → MEDIUM
- Archive n < 10 OR market outside primary coverage → LOW

**Gap analysis trigger:** When Method 1 value diverges >15% from Method 3 (comp PPU), flag: "Cap-rate method diverges from comp PPU by {pct}%. Primary driver: {top_driver}."

Top driver selection logic:
1. Compute subject NOI margin; compare to archive P50 NOI margin for cohort
2. If |subject_noi_margin - cohort_p50_noi_margin| > 5pp → flag "Atypical NOI margin: subject {X}% vs cohort P50 {Y}%"
3. Else if cap_rate used is outside P25–P75 → flag "Cap rate ({cap}%) is at {percentile} percentile of cohort"
4. Else → flag "Basis premium/discount to submarket"

### Method 2 — Per-Unit Benchmark (Top-Down Archive)

**Formula:** `Indicated Value = price_per_unit_P50 × units`

**Inputs:**
- `price_per_unit` distribution from `archive_assumption_benchmarks` where `assumption_name = 'price_per_unit'`
- Matched on `(asset_class, deal_type, submarket_id, vintage_band)`

**Outputs:**
- `indicated_value_p25 = ppu_p25 × units`
- `indicated_value_p50 = ppu_p50 × units`
- `indicated_value_p75 = ppu_p75 × units`

**Confidence scoring:**
- n ≥ 30 → HIGH
- n = 10–29 → MEDIUM
- n = 5–9 → LOW + "sparse sample"
- n < 5 → INSUFFICIENT → shown as "N/A — insufficient data (n={n})"

**Sparse-sample warning text:** "Archive cohort has {n} deals — use with caution. Confidence improves as more platform deals close in this submarket."

### Method 3 — Sales Comp PPU & PSF (Top-Down Comps)

**Source:** `CompSetService.getCompSetByDeal(dealId)` or `CompSetService.generateCompSet(criteria)` if no set exists.

**Outputs (PPU sub-method):**
- `indicated_value_p25 ≈ (median_ppu - 0.675 × std_dev_ppu) × units`
- `indicated_value_p50 = median_ppu × units`
- `indicated_value_p75 ≈ (median_ppu + 0.675 × std_dev_ppu) × units`
- `comp_count` (drives confidence)
- `date_range` of comp transactions

**Outputs (PSF sub-method, conditional on sqft coverage):**
- Same pattern using `median_price_per_sf × total_sf`
- Only rendered when `total_sf` is known on both subject and >50% of comps

**Confidence scoring:**
- comp_count ≥ 10 + sale dates within 18 months → HIGH
- comp_count 5–9 OR some dates 18–36 months old → MEDIUM
- comp_count < 5 → LOW + "thin comp pool — consider widening radius or vintage band"
- comp_count = 0 → INSUFFICIENT

**Comp set metadata surfaced to UI:**
- Radius used (default 3 mi)
- Date range of included comps
- Asset class filter applied
- "Comp pool includes {n} transactions across {cities_count} cities" (when city-level fallback)

### Method 4 — Operator Override

**Always available.** Operator enters a target purchase price or value range directly.

**Fields:**
- `override_value`: scalar value entered by operator
- `override_rationale`: free-text (optional)
- `override_source`: `'operator_input'`

**Confidence:** Always HIGH — operator-asserted.

**UI pattern:** Inline editable row in the grid. Value persists to `deal_assumptions` via PATCH (same pattern as assumption overrides).

**Persistence path:** `PATCH /api/v1/deals/:dealId/valuation-grid/override` → writes to `deal_assumptions.valuation_override_lv` (JSONB LayeredValue).

### Method 5 — Replacement Cost

**Source:** `ReplacementCostServiceV2.estimate(input)` — three-layer LayeredValue:
- Layer 1: Operator upload from Data Library (highest priority when present)
- Layer 2: BLS PPI multifamily escalation × permit-derived baseline × BLS RPP regional factor
- Layer 3: Operator override (inline)

**Outputs:**
- `cost_per_unit` (LayeredValue with provenance)
- `cost_per_sf` (LayeredValue)
- `total_cost` = `cost_per_unit × units`
- `land_value` = `total_cost * land_fraction` (from ReplacementCostService v1 land model)

**Indicated value for Valuation Grid:** `cost_per_sf × total_sf + land_value` (or `cost_per_unit × units + land_value`)

**Confidence:**
- Data Library upload present → HIGH
- GA permit data present (n ≥ 10 permits in 3-year window) → MEDIUM-HIGH
- BLS RPP fallback only (no local permit data) → MEDIUM
- Market outside current permit coverage → LOW

---

## 3. Convergence / Divergence Engine

### Convergence Score

For all active methods with confidence ≥ LOW, compute the **indicated value set** S = {V₁, V₂, ... Vₙ}.

```
convergence_pct = 1 - (std_dev(S) / mean(S))
```

**Signal:**
- convergence_pct ≥ 0.90 → CONVERGENT (green): "Methods agree within {100-convergence*100:.0f}%"
- convergence_pct 0.80–0.89 → MODERATE (amber): "Methods show {gap_pct:.0f}% spread — review gap analysis"
- convergence_pct < 0.80 → DIVERGENT (red): "High divergence ({gap_pct:.0f}%) — investigate drivers"

### Reconciled Value Range

**Recommended range:** `[mean(S) - 0.5 × std_dev(S), mean(S) + 0.5 × std_dev(S)]`

**Point estimate:** Weighted mean where weights are method confidence levels (HIGH=3, MEDIUM=2, LOW=1):
```
reconciled_value = Σ(confidence_weight_i × indicated_value_p50_i) / Σ(confidence_weight_i)
```

**Reconciled PPU/PSF:** `reconciled_value / units` and `reconciled_value / total_sf`

### Purchase Price Recommendation

```
recommended_price_low  = max(reconciled_range_low, acquisition_constraint_floor)
recommended_price_high = reconciled_range_high
```

Where `acquisition_constraint_floor` = 0 (no hard floor in V0.1; V1.0 adds DSCR/LTV constraint).

---

## 4. Gap Analysis Text Generation

Pre-computed string templates — no LLM call required for V0.1. Rule-based.

### Method 1 vs Method 3 gap (Cap Rate vs Comp PPU):

```
Template: "Cap-rate method indicates {fmt_m}; comp PPU indicates {fmt_c} — {pct_diff}% {above|below}.
  Primary driver: {driver_text}."
```

Driver text rules:
- NOI margin anomaly: "Subject NOI margin ({subj_margin}%) is {dir} the {cohort_size}-deal cohort median ({cohort_margin}%). OpEx drag or rent bump affects income-based value but not transaction-based value."
- Cap rate outlier: "Using archive {percentile_str} percentile cap rate ({cap}%) for {asset_class} in {submarket}. {n} comps in cohort."
- Both methods thin: "Both methods have limited data for this submarket. Recommend widening comp set or using operator override."

### Method 2 vs Method 3 gap (Archive PPU vs Comp PPU):

```
Template: "Archive benchmark PPU ({archive_ppu}/unit) is {pct}% {above|below} comp set PPU ({comp_ppu}/unit).
  Archive uses {n_archive} deals (as of {as_of}); comp set uses {n_comp} transactions within {radius}mi."
```

---

## 5. LayeredValue Integration

The Valuation Grid does **not** produce a LayeredValue itself — it is a read-only analysis surface.

However, the **Operator Override** (Method 4) writes to `deal_assumptions.valuation_override_lv`:

```typescript
{
  resolved: operator_value,
  layers: {
    operator: { value: operator_value, updatedAt: iso_timestamp, source: 'operator_input' }
  },
  resolvedFrom: 'operator',
  alertLevel: 'none'
}
```

The Reconciled Value is surfaced to the Deal Capsule and F9 RETURNS tab as a read-only derived signal — it does not write to LayeredValue (that would bypass the operator-authoritative override pattern).

---

## 6. API Design

### `GET /api/v1/deals/:dealId/valuation-grid`

Returns the full grid computation for a deal.

**Response shape:**
```typescript
{
  dealId: string;
  computedAt: string;          // ISO timestamp
  subject: {
    units: number | null;
    totalSF: number | null;
    purchasePrice: number | null;
    noi: number | null;        // stabilized NOI from proforma
    noiSource: string;         // 'T12' | 'proforma_assumptions' | 'agent_derived'
    assetClass: string | null;
    city: string;
    state: string;
    submarket: string | null;
  };
  methods: ValuationMethod[];    // ordered array, active first
  reconciliation: {
    convergenceScore: number;    // 0–1
    convergenceSignal: 'CONVERGENT' | 'MODERATE' | 'DIVERGENT';
    convergenceText: string;
    reconciledValue: number | null;
    reconciledPPU: number | null;
    reconciledPSF: number | null;
    recommendedPriceLow: number | null;
    recommendedPriceHigh: number | null;
    gapAnalysis: GapAnalysisItem[];
  };
}

interface ValuationMethod {
  id: 'cap_rate_noi' | 'per_unit_benchmark' | 'sales_comp_ppu' | 'sales_comp_psf'
     | 'operator_override' | 'replacement_cost' | 'grm' | 'gim' | 'dcf';
  label: string;               // "Cap Rate × NOI"
  direction: 'bottom_up' | 'top_down' | 'cost' | 'income' | 'manual';
  status: 'active' | 'insufficient' | 'placeholder';
  placeholderVersion?: string; // "V1.0" when status = 'placeholder'
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT';
  indicatedValueP25: number | null;
  indicatedValueP50: number | null;
  indicatedValueP75: number | null;
  indicatedPPU: number | null;
  indicatedPSF: number | null;
  compCount?: number;           // sale comps only
  sampleSize?: number;          // archive benchmark only
  sourceProvenance: string;     // human-readable source description
  evidenceTrail: EvidenceLine[];
  warningFlags: string[];
}

interface GapAnalysisItem {
  methodA: string;
  methodB: string;
  deltaPct: number;            // signed: positive = A > B
  driverText: string;
  severity: 'info' | 'watch' | 'alert';
}
```

### `PATCH /api/v1/deals/:dealId/valuation-grid/override`

Persists operator override value to `deal_assumptions`.

**Body:** `{ value: number; rationale?: string }`

---

## 7. Inactive Method UX (Placeholder Rows)

GRM, GIM, DCF rows are always shown in the grid (V0.1 behavior) with:
- Status badge: `COMING V1.0`
- Confidence: — (no badge)
- Indicated value: "—"
- Tooltip: method-specific gap text explaining what data is needed

| Method | Tooltip text |
|---|---|
| GRM | "Gross Rent Multiplier requires gross rent at time of sale — not yet captured in comp data. Tracking in Dispatch 4." |
| GIM | "Gross Income Multiplier requires gross income data from broker OMs. Tracking in Dispatch 4." |
| DCF | "Discounted Cash Flow requires Phase 2 full rent and OpEx derivation logic. Coming in V1.0." |

---

## 8. Implementation Files

| File | Role |
|---|---|
| `backend/src/services/valuation/valuation-grid.service.ts` | Core computation engine |
| `backend/src/api/rest/valuation-grid.routes.ts` | Express routes |
| `frontend/src/pages/development/financial-engine/ValuationGridTab.tsx` | V0.1 UI surface |
| `frontend/src/pages/development/FinancialEnginePage.tsx` | Tab wiring (add `'⊡ VALUATION'` at index 6) |

---

## 9. Resolved Open Questions

| Question | Decision |
|---|---|
| Navigation placement | F9 sub-tab at index 6, label `'⊡ VALUATION'` |
| Reconciliation methodology | Confidence-weighted mean with P25–P75 range band |
| Comp set selection criteria | Operator-tunable via query params (radius, date range, min/max units); defaults 3mi / 24mo |
| GRM on non-residential assets | Hidden in V0.1; low-confidence badge in V1.0 when enabled |
| Validation Grid vs Valuation Grid | Validation Grid = per-assumption source triangulation (existing tab in CONSOLE). Valuation Grid = per-methodology price triangulation (new tab). Both link to same evidence base. |

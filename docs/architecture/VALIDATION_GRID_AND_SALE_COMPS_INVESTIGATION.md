# Validation Grid & Sale Comps Investigation

**Phase:** Validation sub-phase A (T4.2.a)
**Status:** Open Q1 RESOLVED — see decision below
**Related tasks:** #1272 (backend implied cap), #1273 (F3 UI display)

---

## Open Q1: Market Rent Source for NOI Basis

### Question
Which market rent source should the platform use as the NOI basis when computing the
platform-implied cap rate for a deal's submarket?

The implied cap formula is:
```
GPR  = market_rent_per_unit_annual × units
EGI  = GPR × (1 − vacancy_p50)
NOI  = EGI − (opex_per_unit_p50 × units)
implied_cap_rate = NOI / purchase_price
```

The ambiguity is step 1: where does `market_rent_per_unit_annual` come from?

### Candidates evaluated

| Source | Table | Rows with rent | Location specificity | Notes |
|---|---|---|---|---|
| `market_vitals` | `market_vitals.avg_rent_per_unit` | 998 (all populated) | 13 markets, monthly snapshots | Per-unit **monthly** rent (integer); must × 12 for annual |
| `line_item_benchmarks` | `line_item_benchmarks` where `category='revenue'` | 22 rows total; 4 are `gross_potential_rent`, 18 are `other_income` | Global only (no state/MSA) for GPR rows | `other_income` is not a GPR source; GPR rows have no location dimension |
| `market_rent_comps` | `market_rent_comps.avg_asking_rent` | 88 (asking), 0 (effective) | City/MSA/submarket | Submarket-level but small sample; no effective rent yet |

### Decision: `market_vitals.avg_rent_per_unit` is the authoritative primary source

**Rationale:**
1. **Data richness**: 998 rows vs 4 usable revenue benchmark rows in `line_item_benchmarks`
2. **Location specificity**: `market_vitals` is keyed by `market_id` (city string: 'atlanta', 'dallas', etc.), giving location-specific market rents. The `line_item_benchmarks` GPR rows have no `state`/`msa` — they are global benchmarks with no geographic resolution.
3. **Consistency**: `market_vitals.avg_rent_per_unit` is the same data used by the Opportunity Engine (F4 market intelligence), market scoring, and JEDI Score computations. Using it here keeps the implied cap in the same data universe.
4. **Recency**: `market_vitals` has daily/monthly snapshots; the most recent row is used (ORDER BY date DESC).
5. **`market_rent_comps`** has only asking rents (no effective rents yet) and 88 rows — too sparse to rely on as primary.

**Unit conversion**: `market_vitals.avg_rent_per_unit` is a per-unit **monthly** integer (e.g., 1812 for Atlanta). Multiply by 12 for annual GPR per unit.

**MSA normalization**: Deals store `deals.msa` as the full CBSA name (e.g., "Atlanta-Sandy Springs-Roswell, GA"). This is normalized to the `market_id` short form by extracting the first city token and lowercasing (e.g., → "atlanta"). This covers all 13 seeded market_ids. See `msaToMarketId()` in `backend/src/api/rest/m27-comps.routes.ts`.

### Source priority order (implemented)

```
1. market_vitals.avg_rent_per_unit × 12         — primary (location-specific, rich)
2. line_item_benchmarks (category='revenue')      — fallback (global benchmark)
3. null → computation_method = 'insufficient_data'
```

The active `rent_source` is returned in the API response so consumers can distinguish.

---

## Implied Cap Rate Computation Spec

### Endpoint

```
GET /api/v1/deals/:dealId/implied-cap-rate
```

Ownership-scoped: requires auth; user must own the deal.

### Formula

```
GPR      = market_rent_per_unit_annual × units
EGI      = GPR × (1 − vacancy_p50)
NOI      = EGI − (opex_per_unit_annual × units)
implied_cap_rate = NOI / purchase_price
```

### Input resolution

| Input | Source | Fallback |
|---|---|---|
| `market_rent_per_unit_annual` | `market_vitals.avg_rent_per_unit × 12` (most recent row for market_id) | `line_item_benchmarks` (GPR line, progressive bucket relaxation) |
| `opex_per_unit_annual` | `SUM(line_item_benchmarks.per_unit_p50)` where `category='opex'`, progressive bucket relaxation by (asset_class, deal_type, vintage_band, unit_count_band, state, msa) | Wider bucket until global |
| `vacancy_p50` | `archive_assumption_benchmarks` where `assumption_name='vacancy_pct'`, by (asset_class, deal_type, submarket_id) | 0.07 (platform default 7%) |
| `purchase_price` | `deal_assumptions.purchase_price_lv->>'resolved'` | null → computation returns null |
| `units` | `properties.units` for the deal | null → computation returns null |

### Response shape

```jsonc
{
  "success": true,
  "data": {
    "implied_cap_rate": 0.0542,          // platform-computed NOI/price; null if inputs missing
    "operator_going_in_cap": 0.055,      // from latest underwriting snapshot; null if none
    "delta_bps": 8,                      // (operator − implied) × 10000; null if either missing
    "positioning_label": "ALIGNED",      // ALIGNED (±25bps) | OPERATOR_ABOVE | OPERATOR_BELOW
    "computation_method": "market_vitals_rent_benchmark", // or "line_item_benchmark" | "insufficient_data"
    "rent_source": "market_vitals",      // "market_vitals" | "line_item_benchmarks" | null
    "comp_reported_cap_rate": 0.058,     // median of broker-reported cap rates from comp set; null if no comp set
    "comp_count": 12,                    // number of comps in the comp set
    "noi_components": {
      "gpr": 2160000,
      "egi": 2008800,
      "noi": 1208800,
      "opex_total": 800000
    },
    "inputs": {
      "units": 150,
      "purchase_price": 22300000,
      "market_rent_per_unit_annual": 21744,   // e.g. 1812/mo × 12
      "market_rent_per_unit_monthly": 1812,
      "market_id": "atlanta",
      "opex_per_unit_annual": 5333,
      "vacancy_p50": 0.07,
      "vintage_band": "2006-2015",
      "unit_count_band": "100-200",
      "asset_class": "B",
      "deal_type": "existing"
    },
    "opex_bucket_used": { ... }
  }
}
```

### Positioning labels

| Label | Condition |
|---|---|
| `ALIGNED` | `abs(delta_bps) <= 25` |
| `OPERATOR_ABOVE` | operator going-in cap > implied (delta_bps > 25) — operator is more conservative than market |
| `OPERATOR_BELOW` | operator going-in cap < implied (delta_bps < −25) — operator is more aggressive than market |

### Comp-reported vs platform-implied cap

The response distinguishes two cap rate signals:

- **`implied_cap_rate`** — platform-computed from NOI/price using market benchmarks. Represents what the cap rate *should be* given current market rents and stabilized operations. This is the anchor for the Validation Grid's cap rate row.
- **`comp_reported_cap_rate`** — the median cap rate that brokers/sources reported on comparable sales in the comp set. Represents what the market actually transacted at (as disclosed).

Both should ideally be close. A large gap between them suggests either stale comp data, non-stabilized comp sales, or a data quality issue.

---

## Open items deferred to Phase 2

| ID | Item | Notes |
|---|---|---|
| T4.2.b | F3 Sale Comps UI display of implied cap | Task #1273 |
| T4.2.c | Validation Grid UI (cap rate row) | Downstream of #1273 |
| Q2 | `market_rent_comps.avg_effective_rent` integration | Currently 0 effective rent rows; revisit when populated |
| Q3 | Asset-class-specific rent adjustment | Current `market_vitals` is market-wide average; no A/B/C split yet |
| Q4 | Confidence bands on implied cap | No standard deviation of rent inputs; deferred |

---
title: Valuation Grid — Column Reference Fix
date: 2026-05-28
task: "#1370"
dispatch: column-fix
---

# Valuation Grid — Column Reference Fix

## Summary

Three broken column references in `getSubjectProperty()` caused every call to
`GET /api/v1/deals/:dealId/valuation-grid` to crash with HTTP 500 before any
method computation ran. All three were in the same SQL statement. Fixed in one
pass.

---

## Before / After — SQL Query in `getSubjectProperty()`

**File:** `backend/src/services/valuation/valuation-grid.service.ts`, lines 209–230

### Before (broken)

```sql
SELECT
  d.id,
  COALESCE(d.city, d.address, '')    AS city,
  COALESCE(d.state, '')              AS state,
  p.units,
  p.building_sf                      AS total_sf,
  p.latitude,
  p.longitude,
  p.asset_class,                     -- ❌ column does not exist on properties
  p.submarket,                       -- ❌ column does not exist on properties
  da.purchase_price AS purchase_price, -- ❌ column does not exist on deal_assumptions
  da.valuation_override_lv           AS valuation_override_lv,
  (da.year1->>'noi')                 AS noi_year1,
  (da.year1->>'year1_noi')           AS noi_year1_alt
FROM deals d
LEFT JOIN properties p ON p.deal_id = d.id
LEFT JOIN deal_assumptions da ON da.deal_id = d.id
WHERE d.id = $1::uuid
LIMIT 1
```

### After (fixed)

```sql
SELECT
  d.id,
  COALESCE(d.city, d.address, '')    AS city,
  COALESCE(d.state, '')              AS state,
  p.units,
  p.building_sf                      AS total_sf,
  p.latitude,
  p.longitude,
  p.building_class  AS asset_class,  -- ✅ correct column on properties
  p.submarket_id    AS submarket,    -- ✅ correct column on properties
  p.acquisition_price AS purchase_price, -- ✅ correct column on properties
  da.valuation_override_lv           AS valuation_override_lv,
  (da.year1->>'noi')                 AS noi_year1,
  (da.year1->>'year1_noi')           AS noi_year1_alt
FROM deals d
LEFT JOIN properties p ON p.deal_id = d.id
LEFT JOIN deal_assumptions da ON da.deal_id = d.id
WHERE d.id = $1::uuid
LIMIT 1
```

Column aliases (`AS asset_class`, `AS submarket`, `AS purchase_price`) are
preserved so all row accessors downstream (`row.asset_class`, `row.submarket`,
`row.purchase_price`) require no changes.

---

## Why Three, Not Two

The dispatch brief identified two broken references from the surface diagnostic
(`p.asset_class`, `p.submarket`). PostgreSQL halts at the first unresolved
column in parse order — `p.asset_class` — so `da.purchase_price` (also broken)
was masked. It surfaced during the SQL validation step after the first two were
fixed. All three are in the same statement; all three were fixed in this pass.

| Reference | Was | Correct column | Table |
|---|---|---|---|
| `p.asset_class` | non-existent | `p.building_class` | `properties` |
| `p.submarket` | non-existent | `p.submarket_id` | `properties` |
| `da.purchase_price` | non-existent | `p.acquisition_price` | `properties` |

---

## Test Results

### A — Fixed query validates clean against live DB

```
Deal 12eb9e11 (Marietta): id, city, state, units, total_sf … all columns returned, no error
Deal 4f6115a8 (Atlanta):  id, city, state, units, total_sf … all columns returned, no error
```

Both return all-null property fields (no `properties` row linked via `deal_id`
for these deals), which is correct and expected per the data-layer surface
report.

### B — HTTP status

```
GET /api/v1/deals/12eb9e11-.../valuation-grid  →  HTTP 403
```

403 = auth middleware (unauthenticated curl). Not 500. The SQL crash is gone.
With a valid session token the endpoint proceeds to method computation.

### C — Expected empty-state response (authenticated)

All methods return `INSUFFICIENT` or `placeholder` because:

| Method | Outcome | Reason |
|---|---|---|
| Cap Rate × NOI | INSUFFICIENT | No NOI (no linked property, `year1.noi` null) |
| Per-Unit Benchmark | INSUFFICIENT | `units` null |
| Sales Comp PPU | INSUFFICIENT | `units` null + `sale_comp_sets` empty |
| Sales Comp PSF | Not emitted | Conditional on PPU comp set |
| Operator Override | INSUFFICIENT | No override set |
| Replacement Cost | INSUFFICIENT | `units` and `total_sf` null |
| GRM / GIM / DCF | PLACEHOLDER | Hard-coded V1.0 stubs |

Reconciliation panel: "No active methods with sufficient data." — expected.

### D — No other files needed similar rename

```
grep p\.asset_class | p\.submarket\b | da\.purchase_price
  backend/src/services/valuation/valuation-grid.service.ts  → 0 matches
  backend/src/api/rest/valuation-grid.routes.ts             → 0 matches
  frontend/src/pages/development/financial-engine/ValuationGridTab.tsx → 0 matches
```

---

## Why Methods Are INSUFFICIENT (data layer — separate problem)

This is not a bug introduced by this fix. Per the data-layer surface report:

- `properties ↔ deals` join via `deal_id` returns no linked property rows with
  `units` populated for any of the 29 current deals.
- `sale_comp_sets` table: 0 rows.
- `archive_assumption_benchmarks`: no `cap_rate` or `price_per_unit` rows.
- `deal_assumptions.valuation_override_lv`: null on all 9 rows.

The grid degrades gracefully as designed — INSUFFICIENT badges, null
reconciliation, no crash. Data gaps resolve as deals accumulate and comp sets
are generated.

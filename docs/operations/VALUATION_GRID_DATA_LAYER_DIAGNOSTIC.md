---
title: Valuation Grid — Layer 1 Data Diagnostic
date: 2026-05-28
task: "#1376"
---

# Valuation Grid — Layer 1 Data Layer Diagnostic

## Purpose

Foundation diagnostic run before the Path B (comp-anchored cap rate synthesis)
dispatch. Confirms the current state of every data source the Valuation Grid
depends on. Results directly shape the Path B dispatch scope.

---

## Diagnostic Results

### 1. `sale_comp_sets` — EMPTY (Layer 1 gap, unresolved)

| Query | Result |
|---|---|
| `SELECT COUNT(*) FROM sale_comp_sets` | **0 rows** |
| `SELECT COUNT(*) FROM sale_comp_set_members` | **0 rows** |
| `SELECT COUNT(*) FROM recorded_transactions` | 12 rows |
| `SELECT COUNT(*) FROM competitive_sets` | 30 rows |

`sale_comp_sets` and `sale_comp_set_members` are both empty. This is the
table the Valuation Grid's `Sales Comp PPU` and `Sales Comp PSF` methods
query for aggregated comp stats (median PPU, cap rate distribution).

The table is populated by `CompSetService`, which aggregates from
`market_sale_comps` or `recorded_transactions` via `sale_comp_set_members`.
That pipeline has never been triggered for any deal.

### 2. `market_sale_comps` — POPULATED (343,494 rows)

| Query | Result |
|---|---|
| `SELECT COUNT(*) FROM market_sale_comps` | **343,494 rows** |
| GA rows | 343,486 |
| NC rows | 8 |

The underlying comp data exists and is substantial — almost entirely Georgia.
It has never been lifted into `sale_comp_sets` via `CompSetService`.

### 3. Research Agent — writes to `market_sale_comps`

The research agent writes sale comp records into **`market_sale_comps`** via
the `write_market_comps` tool (`backend/src/agents/tools/write_market_comps.ts`).
Fields written: `property_name`, `sale_date`, `sale_price`, `units`,
`price_per_unit`, `cap_rate`, `noi_at_sale`, `occupancy_at_sale`,
`buyer_name`, `buyer_type`, `seller_name`, `source`.

It does **not** write directly to `sale_comp_sets`. That table is downstream
— populated only when `CompSetService.buildCompSet()` is called for a deal.

### 4. `mv_market_rent_benchmarks` — EXISTS, POPULATED (EC3 resolved)

| Query | Result |
|---|---|
| `SELECT matviewname, ispopulated FROM pg_matviews WHERE matviewname = 'mv_market_rent_benchmarks'` | **exists, ispopulated = t** |
| `SELECT COUNT(*) FROM mv_market_rent_benchmarks` | **11 rows** |

**EC3 status: GREEN.** The prior session flagged this as YELLOW ("view doesn't
exist in DB"). The view exists and is populated. Market rent data is accessible
as a queryable layer. The 11 rows are a thin seed but the path is open.

Also confirmed: `market_rent_comps` has 88 rows.

### 5. `archive_assumption_benchmarks` — PARTIAL (cap_rate gap; price_per_unit near-empty)

| Query | Result |
|---|---|
| `SELECT COUNT(*) FROM archive_assumption_benchmarks` | 209 rows |
| `WHERE assumption_name = 'cap_rate'` | **0 rows** |
| `WHERE assumption_name = 'price_per_unit'` | **1 row** |

209 rows total across ~140 distinct `assumption_name` values. None use the
exact key `cap_rate`. Related keys that do exist: `exit_cap_rate`,
`exit_cap_rate_pct`, `year1_cap_rate`, `year1_cap_rate_pct`,
`going_in_cap_rate_pct`. The Valuation Grid's Per-Unit Benchmark method
queries for `price_per_unit` — 1 row is insufficient for P25/P50/P75
cohort statistics.

**Note:** Path B's comp-anchored approach derives cap rate from sale comps
directly, not from `archive_assumption_benchmarks`. This gap does not block
Path B — it blocks the standalone `Per-Unit Benchmark` method only.

### 6. `properties` linked to deals — NOT LINKED

| Query | Result |
|---|---|
| `SELECT COUNT(*) FROM properties` | 1,585 rows |
| `WHERE deal_id IS NOT NULL` | **0 rows** |
| `SELECT COUNT(*) FROM deals` | 29 rows |

No `properties` row is linked to any deal via `deal_id`. The Valuation Grid
joins `properties` on `deal_id` to resolve `units`, `total_sf`, `latitude`,
`longitude`, `building_class`, and `acquisition_price`. All return null for
every deal — causing `INSUFFICIENT` on every method that requires unit count.

---

## Layer 1 Gap Summary

| Source | Status | Detail |
|---|---|---|
| `sale_comp_sets` | **GAP — empty** | 343k comps in `market_sale_comps` never lifted into comp sets |
| `mv_market_rent_benchmarks` | **RESOLVED — 11 rows** | EC3 now GREEN (was YELLOW last session) |
| `archive_assumption_benchmarks` (cap_rate) | **GAP — 0 rows** | Key `cap_rate` absent; related keys exist with different names |
| `archive_assumption_benchmarks` (price_per_unit) | **GAP — 1 row** | Insufficient for cohort P25/P50/P75 |
| `properties ↔ deals` join | **GAP — 0 linked rows** | `units`, `total_sf`, `building_class` all null for every deal |

---

## Path B Dispatch Scope — Implications

### What Path B can do now

- `market_sale_comps` has 343k rows and includes `cap_rate` and `price_per_unit`
  per-comp fields. Path B can query this table directly (filtered by state/asset
  class/vintage) to derive implied cap rate distributions without waiting for
  `sale_comp_sets` to be populated.
- `mv_market_rent_benchmarks` (11 rows) can supply revenue-per-unit inputs for
  NOI synthesis. Coverage is thin but the mechanism works.

### What blocks Path B

1. **`properties ↔ deals` join is empty.** Subject `units` and `total_sf` are
   null for all 29 deals. Path B's cap rate application step (`implied_cap_rate
   × subject NOI`) requires subject unit count to compute PPU. This is the
   single most blocking gap — without it, the grid cannot produce a subject
   valuation, only a comp distribution.

2. **`sale_comp_sets` pipeline never triggered.** `CompSetService.buildCompSet()`
   must be called per deal to lift `market_sale_comps` rows into the aggregated
   comp set. Path B can work around this by querying `market_sale_comps`
   directly, but the comp set generation pipeline should run so the grid's
   existing comp-set-based methods activate.

### Recommended dispatch sequence

1. **Deal-property link repair** — resolve why `properties.deal_id` is null
   for all 29 deals, or provide an alternative join path so subject `units`
   populates.
2. **Comp set generation** — trigger `CompSetService.buildCompSet()` for one
   or more test deals (filtered to GA, submarket match) to verify the pipeline
   produces `sale_comp_sets` and `sale_comp_set_members` rows.
3. **Path B cap rate synthesis** — implement comp-anchored implied cap rate
   derivation, initially querying `market_sale_comps` directly with fallback to
   `sale_comp_sets` once that pipeline is seeded.

---

## EC3 Status Update

Previous: **YELLOW** — "mv_market_rent_benchmarks view doesn't exist in DB"  
Current: **GREEN** — view exists, ispopulated = true, 11 rows confirmed

`docs/operations/PHASE_2_ENTRY_CONDITIONS.md` should be updated to reflect EC3
as SATISFIED.

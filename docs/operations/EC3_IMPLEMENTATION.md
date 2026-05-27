# EC3 — Market Rent Source Implementation

**Status:** Implemented  
**Date:** 2026-06-20  
**Spec:** `docs/operations/EC3_MARKET_RENT_SOURCE.md`

## What Was Built

### 1. Materialized View — `mv_market_rent_benchmarks`

**Migration:** `backend/src/database/migrations/20260620_mv_market_rent_benchmarks.sql`

Aggregates `apartment_locator_properties.avg_asking_rent` into P25/P50/P75 distributions
by `city × state × asset_class` (A/B/C, derived from `year_built`).

Asset class boundaries:
- **A** — `year_built >= 2010`
- **B** — `year_built >= 1995` (and < 2010)
- **C** — all others (`year_built < 1995`)

Minimum group size: `HAVING COUNT(*) >= 3` — small samples are excluded from the view.

Unique index `idx_mv_market_rent_benchmarks_key` on `(city, state, asset_class)` enables
`REFRESH MATERIALIZED VIEW CONCURRENTLY`.

### 2. Agent Tool — `fetch_market_rent_benchmark`

**File:** `backend/src/agents/tools/fetch_market_rent_benchmark.ts`

Queries `mv_market_rent_benchmarks` by city × state × (optional) asset class. When
`subject_rent` is provided, returns `competitivePosition` (premium / market / discount
vs P50, using ±5% thresholds).

Returns `dataNote` explaining the building-average constraint so the agent can surface
this limitation when citing benchmarks.

### 3. Tool Registration

**File:** `backend/src/agents/cashflow.config.ts`

- Import added after `fetchSourceDocumentsTool`
- `fetchMarketRentBenchmarkTool` inserted into `CASHFLOW_AGENT_CONFIG.tools` array
  immediately after `fetchCompSetTool` (Lifecycle tools group)

### 4. MV Refresh Hook

**File:** `backend/src/api/rest/apartment-locator.routes.ts`

`REFRESH MATERIALIZED VIEW CONCURRENTLY mv_market_rent_benchmarks` is called (with
non-fatal error handling) at the end of all three ApartmentIQ sync push endpoints:
- `POST /sync-table`
- `POST /sync/atlanta`
- `POST /sync/all`

The refresh is fire-and-respond: it runs synchronously before the response but a failure
only logs a warning — the sync response itself is unaffected.

### 5. Agent Prompt Alignment (P9 Requirement)

**File:** `backend/src/agents/prompts/cashflow/system.ts`

Two changes applied in same dispatch per P9.A (agent prompt alignment):
1. `fetch_market_rent_benchmark` added to the Phase 4 tool sequence (item 27)
2. "Market Rent Benchmark Usage (EC3)" section added before "Competitive Set Usage"
   — explains when to call, asset class assignment, and the building-average constraint

## Architectural Constraints (from spec)

| Constraint | Detail |
|---|---|
| Building-average only | `avg_asking_rent` is a property-level average — no bedroom stratification |
| Phase 3 enhancement | Per-unit-type P25/P50/P75 requires per-bedroom data (not yet in ALP) |
| Minimum group size | Groups with n < 3 are excluded — sparse markets return no rows |
| Refresh trigger | Manual on ApartmentIQ sync push only — no scheduled cron |

## Verification

```sql
-- Confirm view exists and has rows
SELECT state, city, asset_class, sample_size, p25_rent, p50_rent, p75_rent
FROM mv_market_rent_benchmarks
ORDER BY state, city, asset_class;

-- Confirm unique index
SELECT indexname FROM pg_indexes WHERE tablename = 'mv_market_rent_benchmarks';
```

To run migration:
```bash
cd backend && npx drizzle-kit migrate
```
Or apply directly:
```bash
psql $DATABASE_URL -f backend/src/database/migrations/20260620_mv_market_rent_benchmarks.sql
```

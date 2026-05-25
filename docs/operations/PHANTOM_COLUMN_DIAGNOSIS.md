# Phantom Column Diagnosis — extracted_financials & broker_pro_forma

Generated: 2026-05-25
Status: **DIAGNOSIS COMPLETE — fix not yet applied**
Instance: Silent State Divergence #12

---

## (a) Schema Verification — Columns Confirmed Missing

Both columns do not exist on `data_library_assets`. Manual execution against the live DB:

```sql
SELECT extracted_financials FROM data_library_assets LIMIT 1;
-- ERROR:  column "extracted_financials" does not exist (42703)

SELECT broker_pro_forma FROM data_library_assets LIMIT 1;
-- ERROR:  column "broker_pro_forma" does not exist (42703)
```

Full confirmed column list on `data_library_assets` (alphabetical, relevant subset):

| Column | Type | Notes |
|---|---|---|
| `cap_rate` | numeric(5,4) | Exists |
| `extraction_data` | jsonb | Exists — likely intended home (see §e) |
| `gross_potential_rent` | numeric(10,2) | Exists |
| `noi` | numeric(15,2) | Exists |
| `noi_per_unit` | numeric(10,2) | Exists |
| `operating_expense_ratio` | numeric(5,2) | Exists |
| `rent_by_unit_type` | jsonb | Exists |
| `broker_pro_forma` | — | **DOES NOT EXIST** |
| `extracted_financials` | — | **DOES NOT EXIST** |

---

## (b) All Code References to Phantom Columns (literal file:line)

All occurrences are confined to a single file:

| File | Line | Context |
|---|---|---|
| `backend/src/services/archive-benchmark-aggregator.ts` | 10 | File comment: "archive deals with broker_pro_forma and extracted assumptions" |
| `backend/src/services/archive-benchmark-aggregator.ts` | 83 | `extractArchiveAssumptions()` SELECT clause: `, broker_pro_forma` |
| `backend/src/services/archive-benchmark-aggregator.ts` | 137 | `const proforma = row.broker_pro_forma as Record<string, unknown> \| null;` |
| `backend/src/services/archive-benchmark-aggregator.ts` | 138–165 | Downstream extraction of `proforma.exit_cap_rate`, `proforma.rent_growth_pct`, `proforma.expense_growth_pct` from the phantom field |
| `backend/src/services/archive-benchmark-aggregator.ts` | 574 | `extractArchiveLineItems()` SELECT clause: `extracted_financials,` |
| `backend/src/services/archive-benchmark-aggregator.ts` | 575 | SELECT clause: `broker_pro_forma` |
| `backend/src/services/archive-benchmark-aggregator.ts` | 577 | WHERE clause: `AND extracted_financials IS NOT NULL` |
| `backend/src/services/archive-benchmark-aggregator.ts` | 603 | `const financials = row.extracted_financials as Record<string, unknown> \| null;` |
| `backend/src/services/archive-benchmark-aggregator.ts` | 604–640 | Downstream extraction of `financials.income_lines[]`, `financials.expense_lines[]`, `financials.total_revenue`, `financials.noi` |

No other files in `backend/src/` reference either column.

---

## (c) Error Path Trace — Where the Error is Swallowed

**Two affected call chains, both using the same swallow pattern (category b below):**

### Chain 1 — `extractArchiveAssumptions` → `refreshArchiveBenchmarks`

```
1. POST /api/v1/archive/benchmarks/refresh
   archive.routes.ts:344

2. await refreshArchiveBenchmarks()
   archive-benchmark-aggregator.ts:284

3. const archiveRows = await extractArchiveAssumptions()
   archive-benchmark-aggregator.ts:284
   — throws PostgreSQL 42703: column "broker_pro_forma" does not exist

4. outer try/catch in refreshArchiveBenchmarks() catches at line 387:
   logger.error('[archive-benchmark-aggregator] Benchmark refresh failed', { error: msg })
   errors.push(msg)
   return { bucketsWritten: 0, rowsWritten: 0, errors: [msg] }
   — NEVER re-throws

5. archive.routes.ts:349:
   res.json({ success: true, ...result, message: 'Refreshed 0 benchmark rows...' })
   — HTTP 200, success: true
```

**Swallow classification: (b) — caught by a broader try/catch that does not surface the DB error as an HTTP error.** The response body does contain an `errors` array with the full message, but HTTP status is 200 and the `success` field is `true`. No client observing status codes or the success flag will detect the failure.

### Chain 2 — `extractArchiveLineItems` → `refreshLineItemBenchmarks`

Identical pattern:

```
1. POST /api/v1/archive/line-items/refresh
   archive.routes.ts:432

2. await refreshLineItemBenchmarks()
   archive-benchmark-aggregator.ts:690

3. await extractArchiveLineItems()
   — throws 42703: column "extracted_financials" does not exist

4. outer try/catch in refreshLineItemBenchmarks() catches at line 788:
   logger.error(...)
   return { bucketsWritten: 0, lineItemsWritten: 0, errors: [msg] }

5. archive.routes.ts:437:
   res.json({ success: true, lineItemsWritten: 0, bucketsWritten: 0 })
   — HTTP 200
```

Both chains are also called together at `archive.routes.ts:547-548` in a combined "run all" endpoint — same swallow behavior.

**This is NOT dead code.** All three routes are active, `requireAuth`-protected endpoints callable by operators from the UI.

---

## (d) Migration History — Were These Columns Ever Real?

**No.** A full search of every file in `backend/src/database/migrations/` (30+ migration files) returns zero matches for either `extracted_financials` or `broker_pro_forma`. There is no `ALTER TABLE data_library_assets ADD COLUMN` for either name, and no record of them being created or dropped.

These column names exist only in `archive-benchmark-aggregator.ts`. They were planned but never formally migrated into the schema.

---

## (e) Intended Behavior — What Was the Query Supposed to Do?

**Consumer 1 — `extractArchiveAssumptions` (line 71):**
Intended to read `broker_pro_forma` as a JSONB column containing structured broker OM proforma data. The downstream code (lines 137–165) extracts `exit_cap_rate`, `rent_growth_pct`, `expense_growth_pct` from this field and adds them to the assumption benchmark distributions alongside `cap_rate`, `occupancy_rate`, and `price_per_unit` (which are real scalar columns and do execute correctly).

**Consumer 2 — `extractArchiveLineItems` (line 565):**
Intended to read `extracted_financials` as a JSONB column containing T-12 trailing-twelve-month income/expense data produced by the document extraction pipeline. The downstream code (lines 603–640) walks `income_lines[]` and `expense_lines[]` arrays to populate per-unit and %-of-EGI distributions in `line_item_benchmarks`.

**`extraction_data` — the likely real home:**
The column `extraction_data` (jsonb) exists on `data_library_assets`. Of the 299 archive assets, 2 have non-empty `extraction_data`. Those 2 rows contain top-level keys: `T12`, `RENT_ROLL`, `broker`, `confidence`, `TRAFFIC_SNAPSHOT`, `source_file_id`.

The `T12` and `broker` keys in `extraction_data` directly correspond to the two phantom columns:
- `extraction_data->'T12'` ↔ what `extracted_financials` was meant to hold (T-12 parser output)
- `extraction_data->'broker'` ↔ what `broker_pro_forma` was meant to hold (broker OM data)

This strongly suggests the document extraction pipeline was refactored to store everything in a single `extraction_data` JSONB column with typed sub-keys, but `archive-benchmark-aggregator.ts` was never updated to reflect the new column name and path structure.

---

## (f) Impact Assessment — What Has Been Silently Broken

**Impact is HIGH. Both benchmark tables have always been empty from the archive side:**

```sql
SELECT COUNT(*) FROM archive_assumption_benchmarks;  -- 0 rows
SELECT COUNT(*) FROM line_item_benchmarks;            -- 0 rows
```

Both tables are permanently at zero rows. This means:

1. **CashFlow Agent benchmark lookups return empty distributions.** The agent calls `archive_assumption_benchmarks` for P10/P50/P90 ranges on `going_in_cap_rate`, `exit_cap_rate`, `rent_growth_pct`, `vacancy_pct`, `price_per_unit`. With 0 rows, all benchmark queries return null — the agent operates with no archive reference distribution.

2. **Line item benchmarks (`line_item_benchmarks`) have never been populated.** Per-unit operating expense benchmarks (insurance, repairs & maintenance, property tax, management fee, etc.) that are meant to feed the F9 proforma comparables panel have never existed in the DB.

3. **`extractLiveDealAssumptions()` does work** (it queries valid columns on `deals` + `underwriting_snapshots`) and would contribute data if live deals with underwriting snapshots exist — but Consumer 1 fails before this data is merged, so it never reaches the write step.

4. **Every benchmark refresh in production has silently returned `success: true, rowsWritten: 0`** since the feature was written. The operator sees a successful response with zero output and no indication of failure unless they inspect the `errors[]` array in the raw response body.

5. **Duration of breakage:** The columns were never migrated, so this has been broken since `archive-benchmark-aggregator.ts` was first deployed.

---

## (g) Recommended Fix Path

Three options, in order of correctness:

### Option 3 — Rewrite to use `extraction_data` sub-keys (RECOMMENDED)

Update both queries to read from `extraction_data` using the `T12` and `broker` sub-key paths that the document extraction pipeline actually writes:

```sql
-- Consumer 1 fix:
SELECT ..., extraction_data->'broker' AS broker_pro_forma
FROM data_library_assets
WHERE source_type IN ('broker_om', 'manual', 'archive_ingest')
  AND data_quality_score >= 50

-- Consumer 2 fix:
SELECT ...,
  extraction_data->'T12' AS extracted_financials,
  extraction_data->'broker' AS broker_pro_forma
FROM data_library_assets
WHERE extraction_data ? 'T12'     -- replaces extracted_financials IS NOT NULL
  AND unit_count > 0
  AND data_quality_score >= 31
```

**Pre-condition:** Verify that `extraction_data->'T12'` actually has `income_lines`, `expense_lines`, `total_revenue`, `total_expenses`, `noi` sub-keys (the 2 non-empty assets should be inspected to confirm the structure matches what the downstream code expects). If the key structure differs, the downstream extraction logic (lines 603–640) may also need updating.

**Risk:** Low for Consumer 1 (scalar fields like `exit_cap_rate` in the `broker` sub-key need to be confirmed). Medium for Consumer 2 (the `income_lines[]`/`expense_lines[]` shape must match the expected arrays).

### Option 2 — Add the missing columns as migration

Add `ALTER TABLE data_library_assets ADD COLUMN extracted_financials jsonb; ADD COLUMN broker_pro_forma jsonb;` and populate them from `extraction_data`. This preserves the aggregator code as written but adds schema complexity and requires a backfill.

**Not recommended:** adds a third JSONB blob when `extraction_data` already holds the data.

### Option 1 — Remove the references (no-op the columns)

Drop the phantom column reads and WHERE filter. Consumer 1 would still extract scalar fields (`cap_rate`, `occupancy_rate`, `price_per_unit`) and live deal data. Consumer 2 becomes a no-op (returns empty map).

**Not recommended as a permanent fix** — it discards the T-12 line-item benchmark feature entirely. Acceptable as a stop-gap to stop the silent error and let live-deal data flow through.

---

## (h) Severity Classification

**SEVERITY: HIGH**

| Dimension | Assessment |
|---|---|
| Data correctness | Both benchmark tables at 0 rows — archive data has never fed the Cashflow Agent |
| Silent failure | HTTP 200 returned on every refresh; `errors[]` array not checked by callers |
| Duration | Since initial deploy — no migration ever created these columns |
| Discoverability | Only surfaced during paired-read verification of an unrelated threshold change |
| Fix complexity | Low (Option 3 with structure verification); no schema migration required |
| Blast radius of fix | Contained to `archive-benchmark-aggregator.ts`; downstream consumers benefit immediately |

This matches the **column-rename drift** pattern: the document extraction pipeline was refactored to use `extraction_data` with typed sub-keys, but the aggregator was not updated. The `extractArchiveAssumptions` function query partially works (the scalar columns `cap_rate`, `occupancy_rate`, `price_per_unit` are real) — it is only the `broker_pro_forma` SELECT that fails, causing a 42703 that kills the entire function and prevents even the valid scalar data from being written.

---

---

## Resolution Log

### 2026-05-25 — Query Rewrite Applied

**Status: QUERIES REWRITTEN — tables still empty (two deeper blockers identified below)**

**Changes applied to `backend/src/services/archive-benchmark-aggregator.ts`:**

Five phantom references eliminated across two functions:

| Function | Phantom reference | Replacement |
|---|---|---|
| `extractArchiveAssumptions` | `deal_type` in SELECT | `data_type AS deal_type` |
| `extractArchiveAssumptions` | `broker_pro_forma` in SELECT | Removed entirely |
| `extractArchiveAssumptions` | Lines 137–168 proforma extraction block | Replaced with explanatory comment |
| `extractArchiveLineItems` | `deal_type` in SELECT | `data_type AS deal_type` |
| `extractArchiveLineItems` | `extracted_financials` in SELECT + WHERE | `extraction_data->'T12'->'summary' AS t12_summary` + `WHERE extraction_data ? 'T12'` |
| `extractArchiveLineItems` | `broker_pro_forma` in SELECT | Removed |
| `extractArchiveLineItems` | `income_lines[]`/`expense_lines[]` loop | Replaced with `T12_FIELD_MAP` iterating real `summary` camelCase keys |

**Structural mismatches resolved in the rewrite:**

`extraction_data->'broker'` = string `"Cushman & Wakefield"` — not a financial object. No equivalent for `exit_cap_rate`, `rent_growth_pct`, `expense_growth_pct`, `noi_per_unit` exists anywhere in `extraction_data`. Proforma assumption extraction removed; comment left for future linkage via `source_deal_id`.

`extraction_data->'T12'` wraps `{ summary, warnings, extracted_at, document_type }`. The `summary` object has named scalar fields (`t12Revenue`, `t12OpEx`, `t12NOI`, `payroll`, `insurance`, etc.) — not `income_lines[]`/`expense_lines[]` arrays. New `T12_FIELD_MAP` maps 20 camelCase summary keys directly to standardized line item names.

**Aggregator run results (post-rewrite):**

`refreshLineItemBenchmarks()`:
- Result: `{ bucketsWritten: 1, lineItemsWritten: 0, errors: [] }`
- Interpretation: Query now executes without errors. Found 1 bucket (Sentosa Epperson). Zero items written because the `n < 3` guard rejects all single-asset line items — correct behavior.

`refreshArchiveBenchmarks()`:
- Result: `{ bucketsWritten: 0, rowsWritten: 0, errors: ['relation "underwriting_snapshots" does not exist'] }`
- Interpretation: `extractArchiveAssumptions()` now runs cleanly, but `extractLiveDealAssumptions()` (called in the same function) references table `underwriting_snapshots` which was renamed to `deal_underwriting_snapshots`. The error aborts before any archive rows are written.

**Table counts after run:**
```sql
SELECT COUNT(*) FROM archive_assumption_benchmarks;  -- 0 (blocked by underwriting_snapshots phantom table)
SELECT COUNT(*) FROM line_item_benchmarks;            -- 0 (blocked by n < 3 with only 1 T12 asset)
```

---

### Remaining Blockers (two separate dispatches needed)

**Blocker A — `underwriting_snapshots` phantom table in `extractLiveDealAssumptions`**

`refreshArchiveBenchmarks` calls both `extractArchiveAssumptions()` and `extractLiveDealAssumptions()`. The second function references `underwriting_snapshots` at line ~187. The actual table is `deal_underwriting_snapshots`. This is the 13th instance of the silent state divergence pattern — same column-rename drift. Fix: rename the table reference in `extractLiveDealAssumptions()`. Once fixed, `refreshArchiveBenchmarks` can complete and write archive scalar fields (cap_rate, occupancy_rate) from the 34 qualifying assets.

**Blocker B — extraction_data sparsity (2/299 assets)**

`line_item_benchmarks` requires n ≥ 3 samples per line item per bucket to write. With only 1 asset having T12 data (Sentosa Epperson), every line item has n = 1 — nothing writes. This is correct behavior, not a bug in the aggregator.

**Root cause of sparsity (Step 4 findings):**

The 298 `archive` source assets were ingested via `archive-ingestion.service.ts`. That pipeline writes `{ brokerClaims, sourceFiles, parseWarnings }` to `extraction_data` — no T12 financial data. T12 extraction only runs when documents are uploaded through the live deal document flow (`document-extraction/data-router.ts`), which writes back to `data_library_assets` via `source_deal_id` match. Only Sentosa Epperson has a `source_deal_id` link to a live deal.

The 266 T12 files in `data_library_files` have `asset_id = NULL` — they are linked to live deals (via `deal_id`), not to archive assets. The document extraction pipeline and the archive ingestion pipeline have no bridge.

**What's needed for full benchmark coverage:**
- Option A: Run document extraction on the uploaded files and backfill `extraction_data` on archive assets (large scope — separate dispatch)
- Option B: Build a linkage between `data_library_files` → `data_library_assets` so T12 files already uploaded populate `extraction_data` (separate scope decision)

---

*Query rewrite complete 2026-05-25. Tables remain empty pending Blocker A (underwriting_snapshots fix) and Blocker B (extraction_data backfill). Both are separate dispatches.*

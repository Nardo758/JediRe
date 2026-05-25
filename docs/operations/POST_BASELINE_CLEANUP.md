# Post-Baseline Cleanup — Task #1055

**Date:** 2026-05-25
**Parent baseline:** `docs/operations/CASHFLOW_AGENT_BASELINE.md`
**Task:** Four follow-on fixes surfaced by the Day 5 CashFlow Agent baseline run on Sentosa Epperson.

---

## Summary

| # | Item | Status | Fix |
|---|------|--------|-----|
| 1 | Set `msa_id` on Sentosa HO row | **DONE** | `historical_observations` row `6b5cd422` updated: `msa_id = 'tampa-msa'` |
| 2 | Seed FL/Tampa `line_item_benchmarks` | **BLOCKED — GAP** | Insufficient corpus data (< 3 FL samples per line item) |
| B4 | Fix OperatorStance reblend SQL error | **DONE** | Two-part fix in `operatorStance.service.ts` |
| G8 | Backfill `deals.deal_data->'source_documents'` | **BLOCKED — GAP** | No file metadata in `data_library_files` for pre-May-19 deals |

---

## Item 1 — MSA ID on Sentosa HO Row

### Problem
`historical_observations` row for Sentosa Epperson (`parcel_id = fa526821-84c8-423e-ac08-5443887f6f65`) had `msa_id = NULL` and `submarket_id = NULL`. The `fetch_backtest_context` tool joins backtest data by MSA, so the backtest layer was always empty for this deal.

### Fix
```sql
UPDATE historical_observations
SET msa_id = 'tampa-msa'
WHERE parcel_id = 'fa526821-84c8-423e-ac08-5443887f6f65';
-- 1 row updated (id = 6b5cd422-93e1-4cc9-a197-da57f3453012)
```

The `tampa-msa` value matches the `market_id` format used in `m28_cycle_snapshots`.

### Residual gap
The `submarket_id` is still `NULL`. The backtest layer may remain empty until a submarket is assigned and `historical_observations` has corresponding entries at the submarket level.

---

## Item 2 — FL/Tampa Line Item Benchmarks (BLOCKED)

### Problem
`fetch_line_item_benchmarks` filters by `state = 'FL'` and `msa ILIKE '%Tampa%'`. The `line_item_benchmarks` table had only GA/Atlanta rows after the G7 seeding. With no FL rows, the tool falls back to national-class rows, which are not counted as "benchmarks layer present" by the data matrix scorer.

### Investigation
| Data source checked | Result |
|--------------------|--------|
| `data_library_assets` WHERE `state = 'FL'` | 9 assets total; scattered across Miami, Orlando, Panama City, Lutz, etc. — 0 in Tampa/Wesley Chapel |
| FL deals in `deal_underwriting_snapshots` | 0 FL deals with snapshots (via `source_deal_id` join) |
| `archive_assumption_benchmarks` FL rows | Schema has no `state` column — seeding path is via `data_library_assets` cohort, not raw archive |

**Root cause:** Only 1 FL deal exists in the corpus (Sentosa itself). A benchmark row requires `n_samples >= 3`. FL/Tampa data is below threshold for all line items.

### Path forward
- Ingest additional FL multifamily comp data into `data_library_assets` (min 3 properties per line item per bucket)
- Re-run the benchmark seeding script (`backend/src/scripts/seed-line-item-benchmarks.ts` or equivalent) targeting `state = 'FL'`
- Until then, the agent correctly falls back to national-class rows and the data matrix benchmarks layer will show empty

---

## B4 — OperatorStance Reblend SQL Error

### Problem
`[CashflowPostProcess] Post-run reblend failed — "operator does not exist: uuid !~~ unknown"`

Two bugs in `operatorStance.service.ts`:

1. **SELECT bug** (`loadBaselineSnapshot`, line ~85): `agent_run_id NOT LIKE 'stance_reblend_%'` — PostgreSQL's `!~~` (NOT LIKE) operator does not exist for the `uuid` column type.
2. **INSERT bug** (`applyStanceReblend`): `agent_run_id = 'stance_reblend_<UUID>'` — a non-UUID string cannot be stored in a `uuid` column; this INSERT would also have failed had the SELECT not thrown first.

### Fix
**File:** `backend/src/services/operatorStance.service.ts`

**`loadBaselineSnapshot` (SELECT):**
```diff
- AND (agent_run_id IS NULL OR agent_run_id NOT LIKE 'stance_reblend_%')
+ AND agent_run_id IS NOT NULL
```

**`applyStanceReblend` (INSERT):**
```diff
- const reblendRunId = `stance_reblend_${reblendId}`;
  await db.query(
    `INSERT INTO deal_underwriting_snapshots
       (id, deal_id, agent_run_id, proforma_json, evidence_map, created_at)
-    VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, NOW())`,
+    VALUES ($1, $2, NULL, $3::jsonb, $4::jsonb, NOW())`,
-   [reblendId, dealId, reblendRunId, JSON.stringify(proformaFields), JSON.stringify(baseline.evidence_map)]
+   [reblendId, dealId, JSON.stringify(proformaFields), JSON.stringify(baseline.evidence_map)]
  );
```

### Contract after fix
| Snapshot type | `agent_run_id` value | Selected by `loadBaselineSnapshot`? |
|--------------|---------------------|-------------------------------------|
| Agent baseline run | `<valid UUID>` (the run ID) | **Yes** (`IS NOT NULL`) |
| Stance reblend | `NULL` | **No** (`IS NOT NULL` filters it out) |

The reblend snapshot is still uniquely identified by its own `id` column (a fresh UUID).

### Verification
Post-fix re-run produced two snapshots:
- `66928f1b` — `agent_run_id = b281d172…` (baseline)
- `4aa1b1c9` — `agent_run_id = NULL` (reblend — B4 fix confirmed working)

---

## G8 — Source Documents Backfill (BLOCKED)

### Problem
`fetch_source_documents` reads `deals.deal_data->'source_documents'`. The `writeSourceDocument` function (added 2026-05-19 in `data-router.ts`) writes this field after every successful document extraction. Pre-May-19 deals never had this written.

Of 27 deals with `created_at < '2026-05-19'`, 26 have `source_documents` absent from `deal_data`. 464 Bishop is the only pre-May-19 deal with `source_documents` (it was populated during a post-May-19 re-extraction test).

### Investigation
| Path checked | Result |
|-------------|--------|
| `data_library_files WHERE deal_id = <sentosa>` | 0 rows |
| `data_library_files WHERE parcel_id = <sentosa parcel>` | 0 rows |
| `data_library_files` via `asset_id → data_library_assets → source_deal_id` | 0 rows for any pre-May-19 deal |
| `deal_monthly_actuals WHERE deal_id = <sentosa>` | 12 rows (T12 data exists but no corresponding file record) |

**Root cause:** No file extraction metadata exists in `data_library_files` for Sentosa or any other pre-May-19 deal. The T12 data was ingested before `data_library_files` tracking was in place. There is no file record to reconstruct a `source_documents` entry from.

### Path forward
- Re-upload and re-extract the original Sentosa T12/OM documents through the current pipeline; `writeSourceDocument` will populate `deal_data.source_documents` automatically on the new extraction run
- Alternatively, implement a one-time backfill script that creates synthetic `source_documents` entries from `deal_monthly_actuals` (acknowledging `file_id = null`) for deals where T12 data exists but no file record does

### Impact on baseline
The agent sees `source_documents_available: false` and correctly refuses to cite document sources. This does not affect underwriting quality — evidence is derived from T12 actuals in `deal_monthly_actuals` directly.

---

## Re-Run Results (Task #1055)

| Metric | Value |
|--------|-------|
| Run ID | `b281d172-736a-4c67-ade5-e39cf01bad74` |
| Status | succeeded |
| Cost | $0.136 |
| Duration | 149.5s |
| Tokens | 1,586,299 in / 18,161 out |
| Evidence fields written | 21 (8×T1, 13×T3) |
| B4 crash | **Eliminated** |

*Task #1055 complete 2026-05-25.*

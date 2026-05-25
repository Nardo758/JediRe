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
| G8 | Backfill `deals.deal_data->'source_documents'` | **DONE (synthetic)** | Synthetic T12 entry written for Sentosa; `file_id = null` (no file record exists); 25 other pre-May-19 deals remain un-backfilled (no T12 data available) |

---

## Item 1 — MSA ID on Sentosa HO Row

### Problem
`historical_observations` row for Sentosa Epperson (`parcel_id = fa526821-84c8-423e-ac08-5443887f6f65`) had `msa_id = NULL` and `submarket_id = NULL`.

### Fix
```sql
UPDATE historical_observations
SET msa_id = 'tampa-msa'
WHERE parcel_id = 'fa526821-84c8-423e-ac08-5443887f6f65';
-- 1 row updated (id = 6b5cd422-93e1-4cc9-a197-da57f3453012)
```

The `tampa-msa` value matches the `market_id` format used in `m28_cycle_snapshots`.

### Corrected backtest data path (investigation finding)

The Day 5 analysis assumed the backtest layer used `historical_observations.msa_id`. Tracing the actual code path:

```
fetch_data_matrix → DataMatrixService.fetchBacktest()
  → BacktestService.getSimilarDealsPerformance({ dealType, assetClass, units })
    → SELECT FROM archive_deals WHERE actual_irr IS NOT NULL
```

The backtest layer is populated by `archive_deals` — **not** `historical_observations`. Setting `msa_id` on the HO row is still correct for other tools (events, market intelligence), but does not affect the data matrix completeness score.

**Root cause of backtest layer being empty:** `archive_deals` has 0 rows with `actual_irr IS NOT NULL`. The data matrix completeness score of 20/100 breaks down as:

| Layer | Weight | Populated? | Source table |
|-------|--------|-----------|-------------|
| extractedData | 15 | Yes | `deal_monthly_actuals` (12 T12 rows) |
| macro | 5 | Yes | Hardcoded defaults in code |
| backtest | 10 | No | `archive_deals` — 0 rows total |
| benchmarks | 10 | No | `archive_deals` — 0 rows total |
| propertyInfo | 10 | No | External API / no data |
| rentData | 10 | No | `apartment_locator_properties` — empty |
| salesComps | 10 | No | External / no data |
| proximity | 10 | No | PostGIS enrichment not run |
| events | 10 | No | `market_events` — no data for deal |
| marketTrends | 10 | No | `market_snapshots` — no data for city |

Score = 15 + 5 = **20/100** — matches the baseline observation.

### Residual gap
The `submarket_id` is still `NULL` on the HO row. Filling `archive_deals` with real disposition data (Task #1056/1057 follow-on work) is what will move the backtest and benchmarks scores.

---

## Item 2 — FL/Tampa Line Item Benchmarks (BLOCKED)

### Problem
`fetch_line_item_benchmarks` filters by `state = 'FL'` and `msa ILIKE '%Tampa%'`. The `line_item_benchmarks` table has only GA/Atlanta rows after G7 seeding. With no FL rows, the tool falls back to national-class rows, which are not counted as "benchmarks layer present" by the data matrix scorer.

### Investigation
| Data source checked | Result |
|--------------------|--------|
| `data_library_assets` WHERE `state = 'FL'` | 9 assets total; scattered across Miami, Orlando, Panama City, Lutz — 0 in Tampa/Wesley Chapel |
| FL deals in `deal_underwriting_snapshots` | 0 FL deals with snapshots (via `source_deal_id` join) |
| `archive_assumption_benchmarks` FL rows | Schema has no `state` column — seeding path is via `data_library_assets` cohort |

**Root cause:** Only 1 FL deal in corpus (Sentosa itself). A benchmark row requires `n_samples >= 3`. FL/Tampa data is below threshold for all line items.

### Path forward (Task #1056)
Ingest ≥3 FL multifamily comp properties into `data_library_assets`, then re-run the benchmark seeding script targeting `state = 'FL'`.

---

## B4 — OperatorStance Reblend SQL Error

### Problem
`[CashflowPostProcess] Post-run reblend failed — "operator does not exist: uuid !~~ unknown"`

Two bugs in `backend/src/services/operatorStance.service.ts`:

1. **SELECT bug** (`loadBaselineSnapshot`): `agent_run_id NOT LIKE 'stance_reblend_%'` — PostgreSQL's `!~~` (NOT LIKE) does not exist for the `uuid` column type.
2. **INSERT bug** (`applyStanceReblend`): `agent_run_id = 'stance_reblend_<UUID>'` — a non-UUID string cannot be stored in a `uuid` column.

### Fix
**`loadBaselineSnapshot` (SELECT):**
```diff
- AND (agent_run_id IS NULL OR agent_run_id NOT LIKE 'stance_reblend_%')
+ AND agent_run_id IS NOT NULL
```

**`applyStanceReblend` (INSERT):**
```diff
  await db.query(
    `INSERT INTO deal_underwriting_snapshots
       (id, deal_id, agent_run_id, proforma_json, evidence_map, created_at)
-    VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, NOW())`,
+    VALUES ($1, $2, NULL, $3::jsonb, $4::jsonb, NOW())`,
-   [reblendId, dealId, reblendRunId, ...]
+   [reblendId, dealId, ...]
  );
```

Comments in `loadBaselineSnapshot` docblock and the service-level idempotency contract comment updated to match.

### Contract after fix
| Snapshot type | `agent_run_id` value | Selected by `loadBaselineSnapshot`? |
|--------------|---------------------|-------------------------------------|
| Agent baseline run | `<valid UUID>` (the run ID) | **Yes** (`IS NOT NULL`) |
| Stance reblend | `NULL` | **No** (`IS NOT NULL` filters it out) |

### Verification
Post-fix re-run produced two snapshots for Sentosa:
- `66928f1b` — `agent_run_id = b281d172…` (baseline)
- `4aa1b1c9` — `agent_run_id = NULL` (**reblend — B4 fix confirmed working**)

---

## G8 — Source Documents Backfill

### Problem
`fetch_source_documents` reads `deals.deal_data->'source_documents'`. The `writeSourceDocument` function (added 2026-05-19 in `data-router.ts`) writes this field after every successful document extraction. Pre-May-19 deals never had this written.

Of 27 deals with `created_at < '2026-05-19'`, 26 had `source_documents` absent from `deal_data`.

### Investigation
| Path checked | Result |
|-------------|--------|
| `data_library_files WHERE deal_id = <sentosa>` | 0 rows |
| `data_library_files WHERE parcel_id = <sentosa parcel>` | 0 rows |
| `data_library_files` via `asset_id → data_library_assets → source_deal_id` | 0 rows for any pre-May-19 deal |
| `deal_monthly_actuals WHERE deal_id = <sentosa>` | **12 rows** (T12 data exists, extracted 2026-04-18) |

### Fix — Synthetic backfill for Sentosa
Since T12 data genuinely exists in `deal_monthly_actuals` (12 monthly actuals), a synthetic `source_documents` entry was written with `file_id = null` to acknowledge the extraction while being honest about the missing file record:

```sql
UPDATE deals
SET deal_data = jsonb_set(
      COALESCE(deal_data, '{}'),
      '{source_documents}',
      ('[]'::jsonb || '<entry>'::jsonb)
    ),
    updated_at = NOW()
WHERE id = '3d96f62d-d986-448f-8ea4-10853021a8cb';
```

Resulting entry:
```json
{
  "file_id": null,
  "filename": "Sentosa Epperson - T12 Operating Statement",
  "document_type": "T12",
  "mime_type": null,
  "file_size_bytes": null,
  "extracted_at": "2026-04-18T18:40:44.904551+00:00",
  "key_fields": ["gpr", "noi", "vacancy_loss", "opex", "monthly_actuals_12mo"],
  "rows_inserted": 12,
  "source_ref": "Sentosa Epperson - T12 Operating Statement",
  "backfill_note": "Synthetic entry — file_id=null intentional (pre-2026-05-19 extraction)"
}
```

**Effect:** `fetch_source_documents` will now return `has_t12: true`, `source_documents_available: true`, `count: 1`. The agent can cite the T12 source for evidence.

### Residual gap
The other 25 pre-May-19 deals that have no T12 data in `deal_monthly_actuals` cannot be backfilled synthetically. For those, re-upload and re-extraction through the current pipeline is required (Task #1057).

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
| G8 source_documents | **Populated** (1 synthetic T12 entry) |

*Task #1055 complete 2026-05-25.*

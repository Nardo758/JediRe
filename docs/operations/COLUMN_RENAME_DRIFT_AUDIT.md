# Column-Rename Drift Audit

**Date:** 2026-05-24  
**Trigger:** `parser_status` fix revealed 14 silent-no-op write sites in `dataLibrary.service.ts`. This audit checks whether the same drift exists for every other column rename in migration history.  
**Scope:** Active migrations only (`backend/src/database/migrations/`). Audit only — no fixes applied.

---

## (a) All Column Renames in Migration History

### Formal RENAME COLUMN statements

Only one migration file contains `ALTER TABLE ... RENAME COLUMN`:

**File:** `20260426_om_pipeline_schema_fixes.sql` (applied 2026-04-26)  
**Table:** `data_library_assets`

| Old Column Name | New Column Name | Migration |
|---|---|---|
| `going_in_cap_rate` | `cap_rate` | `20260426_om_pipeline_schema_fixes.sql` |
| `opex_ratio` | `operating_expense_ratio` | `20260426_om_pipeline_schema_fixes.sql` |
| `trailing_noi` | `noi` | `20260426_om_pipeline_schema_fixes.sql` |

All three renames are guarded with `IF EXISTS / NOT EXISTS` blocks (safe if column already renamed). The migration also backfills data from legacy columns in environments where both somehow co-exist.

### DROP + ADD patterns (effective renames)

No DROP COLUMN followed by ADD COLUMN patterns found that constitute a rename. All `ADD COLUMN IF NOT EXISTS` statements in the migration history are genuine new column additions.

### Schema-rebuild drift (not a RENAME COLUMN)

The `data_library_files` table was rebuilt with a new column naming scheme at some point between the original `20260420_archive_deals_enhancement.sql` schema (which added `parse_status` on `data_library_assets`) and the current live schema. The current `data_library_files` schema has:

| Old name (stale code uses) | Current column name |
|---|---|
| `parsing_status` | `parser_status` |
| `parsing_stage` | `parser_used` |
| `parsing_errors` | `parser_error` |

This was not done via `RENAME COLUMN` — the table was recreated with new names. No migration file records the rename explicitly, which is why code referencing the old names was never updated.

---

## (b) Stale References Per Rename

### Rename 1: `data_library_assets.going_in_cap_rate` → `cap_rate`

| File | Line(s) | Type | Notes |
|---|---|---|---|
| `backend/src/services/archive-ingestion.service.ts` | 883 | Read | `getArchiveCompStats` default `fields` array includes `'going_in_cap_rate'`. Passed into a dynamic SQL aggregate query against `data_library_assets`. Column does not exist; stat returns NULL/zero. |
| `backend/src/api/rest/capsule-sharing.routes.ts` | 655, 1893, 2114, 2169, 2388 | Read | All use `dd.cap_rate ?? dd.going_in_cap_rate`. Reads `cap_rate` first (correct), falls through to old name only when `cap_rate` is null. Graceful. |
| `backend/src/services/m08-strategies.service.ts` | 784, 789 | Read | `d.cap_rate \|\| d.going_in_cap_rate \|\| d.going_in_cap` — multi-level fallback. Graceful. |
| `backend/src/services/evidence-report.service.ts` | 725 | Comment | `// cap rate from deal_data.cap_rate / deal_data.going_in_cap_rate`. No SQL impact. |
| `frontend/src/types/proforma.types.ts` | 211, 245 | TypeScript type | Type definition only. No SQL. |
| `frontend/src/pages/CapsuleDetailPage.tsx` | 380 | Read | `dd.cap_rate ?? dd.going_in_cap_rate`. Graceful fallback. |
| `frontend/src/pages/CapsuleLinkPage.tsx` | 577 | Read | Same graceful fallback pattern. |
| `frontend/src/pages/development/financial-engine/field-labels.ts` | 52 | Label map | UI label string. No SQL. |
| `backend/src/services/capsule-intelligence.service.ts` | 346 | Comment | Documents the rename. Code immediately below uses correct `a.cap_rate`. |
| `backend/src/services/archive-benchmark-aggregator.ts` | 115–116 | JS Map key | Reads `row.cap_rate` (correct column), stores under JS Map key `'going_in_cap_rate'`. No SQL column reference. |

### Rename 2: `data_library_assets.opex_ratio` → `operating_expense_ratio`

> **Note:** `opex_ratio` is also a legitimate column name on `deal_assumptions`, `proforma_templates`, and internal formula-engine variables. References to `opex_ratio` on those are **not stale**. Only references querying `data_library_assets` are stale.

| File | Line(s) | Type | Notes |
|---|---|---|---|
| `backend/src/api/rest/archive.routes.ts` | 216 | Read | `SELECT ... opex_ratio ... FROM data_library_assets`. Column does not exist; returns NULL for all rows. |
| `backend/src/api/rest/archive.routes.ts` | 321 | Read | Default `fields` array passed to `getArchiveCompStats` includes `'opex_ratio'`. Stale dynamic SQL column reference. |
| `backend/src/services/archive-ingestion.service.ts` | 883 | Read | `getArchiveCompStats` default fields includes `'opex_ratio'`. Same dynamic query path as line 321. |
| `backend/src/services/archive-ingestion.service.ts` | 995 | Read | `SELECT trailing_noi, opex_ratio, avg_rent, occupancy_pct FROM data_library_assets`. Column gone; all `opexRatio` in returned objects are `null`. |
| `backend/src/api/rest/deal-assumptions.routes.ts` | 187, 208, 324 | Read/Write | `deal_assumptions.opex_ratio` — different table, column still exists. **Not stale.** |
| `backend/src/services/proforma-*.service.ts` (multiple) | various | Read/Write | `deal_assumptions.opex_ratio` or internal formula variable. **Not stale.** |
| `backend/src/services/compQueryEngine.ts` | various | Read | `t12_avg_opex_ratio` on comp tables. Different column name, different table. **Not stale.** |

### Rename 3: `data_library_assets.trailing_noi` → `noi`

> **Note:** `trailing_noi` is also a legitimate column on the `dispositions` table (deal exit tracking). References to `dispositions.trailing_noi` are **not stale**.

| File | Line(s) | Type | Notes |
|---|---|---|---|
| `backend/src/api/rest/archive.routes.ts` | 113 | Read | `COUNT(*) FILTER (WHERE ... trailing_noi IS NOT NULL)` on `data_library_assets`. Column gone; count is always 0. |
| `backend/src/api/rest/archive.routes.ts` | 216 | Read | `SELECT ... trailing_noi ... FROM data_library_assets`. Returns NULL for all rows. |
| `backend/src/services/archive-ingestion.service.ts` | 995, 998 | Read | `SELECT trailing_noi ... FROM data_library_assets ORDER BY trailing_noi DESC`. Column gone; all rows return NULL, sort is meaningless. |
| `backend/src/services/archive-ingestion.service.ts` | 1009 | Read | `trailingNoi: r.trailing_noi ? parseFloat(r.trailing_noi) : null` — always null. |
| `backend/src/services/disposition.service.ts` | 106, 123 | Write | INSERT/UPDATE on `dispositions` table. That table has `trailing_noi` legitimately. **Not stale.** |

### Schema-rebuild drift: `data_library_files` `parsing_*` → `parser_*`

| File | Line(s) | Type | Notes |
|---|---|---|---|
| `backend/src/api/rest/bulk-upload.routes.ts` | 165 | Write | `INSERT INTO data_library_files (..., parsing_status) VALUES (..., 'pending')`. Column does not exist. Row is never created. |
| `backend/src/api/rest/bulk-upload.routes.ts` | 237 | Write | Same INSERT pattern for ZIP file metadata. Same failure. |
| `backend/src/api/rest/data-library-assets.routes.ts` | 163 | Read | `SELECT df.parsing_status, df.parsing_stage FROM data_library_files`. PostgreSQL throws "column does not exist"; endpoint returns 500 or partial data. |
| `backend/src/api/rest/data-library.routes.ts` | 176 | Comment | "atomically transitions `parsing_status` to …" — comment only. No SQL impact. |
| `backend/src/services/__tests__/dataLibrary.runOmPipeline.test.ts` | 84–169, 228–268 | Test mock | Test DB mock matches and assertions all use `parsing_stage`, `parsing_status`, `parsing_errors`. Tests pass (mock intercepts at string-match level) but verify stale column names against the wrong schema. |

---

## (c) Silent-Failure Mechanism

### The pattern

The same two-layer failure pattern appears in every stale write site found:

**Layer 1 — Fire-and-forget call site:**

```typescript
// dataLibrary.service.ts line 140
this.parseFileAsync(file.id, filePath, params.file.mimetype).catch(err => {
  console.error('Background parsing failed:', err);
});

// bulk-upload.routes.ts line 165
Promise.all(files.map(f => dbQuery(`INSERT INTO data_library_files
  (user_id, asset_id, file_name, file_path, file_size, mime_type, source_type, parsing_status)
  VALUES ...`, [...])
)).then(results => { job.fileRowIds = ...; })
  .catch(err => logger.warn('[bulk-upload] Failed to record file metadata:', err));
```

The async work is deliberately not awaited. A `.catch` at the outer level converts the DB error into a console log or a logger.warn — neither surfaces to the caller, neither records a failure state in the DB.

**Layer 2 — DB error on stale column:**

```
PostgreSQL ERROR: column "parsing_status" of relation "data_library_files" does not exist
```

This error is thrown inside the promise chain. It propagates to the outer `.catch`, which emits a WARN/error log line and discards it. The operation appears to complete successfully to the HTTP client.

**Resulting observable state:**
- `dataLibrary.service.ts` (now fixed): Files were uploaded and corpus data was written correctly; only the status-tracking writes failed. Because the status stayed `'unparsed'`, 1,651 files appeared unprocessed despite having full corpus data. Fixed in the prior dispatch.
- `bulk-upload.routes.ts` (current, unfixed): Files uploaded via bulk-upload have no `data_library_files` row created. The file lands in storage, the job proceeds, but the file never appears in the Files tab and is untracked. The upload job's `fileRowIds` array stays empty, which disables any downstream per-file status tracking.
- `data-library-assets.routes.ts` (current, unfixed): The `:id/files` endpoint throws a PostgreSQL error. Depending on Express error handler behavior, this returns a 500 to the frontend rather than a silent failure.

**Why there was no observable signal:**

1. All stale write sites use `.catch(logger.warn)` or `.catch(console.error)` — errors land in the server log stream but are not promoted to alerts, not counted in any metric, and not stored in any error table.
2. The `data_library_files` table has no constraint or trigger that enforces a `parser_status` value on insert — so the absence of a row produces no secondary error.
3. Column-does-not-exist errors in PostgreSQL are `42703` (undefined_column) — a programming error class, not a constraint violation. ORMs and raw `pool.query` callers treat these the same as any other runtime error: throw and propagate. They do not warn at query-build time.

---

## (d) Severity Classification

| # | Table | Old Col | New Col | File:Line | Type | Severity | Reason |
|---|---|---|---|---|---|---|---|
| 1 | `data_library_files` | `parsing_status` | `parser_status` | `bulk-upload.routes.ts:165` | Write | **Critical** | Every bulk-upload file INSERT fails silently. No `data_library_files` row created. Files are invisible in the Files tab and untracked. |
| 2 | `data_library_files` | `parsing_status` | `parser_status` | `bulk-upload.routes.ts:237` | Write | **Critical** | Same as #1 for ZIP file uploads. |
| 3 | `data_library_files` | `parsing_status`, `parsing_stage` | `parser_status`, `parser_used` | `data-library-assets.routes.ts:163` | Read | **High** | `:id/files` endpoint throws PostgreSQL 42703; returns 500. Asset file list is broken for all assets. |
| 4 | `data_library_assets` | `trailing_noi` | `noi` | `archive.routes.ts:113` | Read | **High** | "With NOI" count in archive stats always shows 0. Dashboard metric is wrong. |
| 5 | `data_library_assets` | `trailing_noi`, `opex_ratio` | `noi`, `operating_expense_ratio` | `archive.routes.ts:216` | Read | **High** | Archive asset listing returns NULL for NOI and OpEx columns. Table rows appear empty for these fields. |
| 6 | `data_library_assets` | `trailing_noi`, `opex_ratio` | `noi`, `operating_expense_ratio` | `archive-ingestion.service.ts:995, 998, 1009` | Read | **High** | Comp lookup returns all NOI and opex_ratio values as null. Sorted by NULL (meaningless). Comp-matching quality degraded silently. |
| 7 | `data_library_assets` | `going_in_cap_rate`, `opex_ratio` | `cap_rate`, `operating_expense_ratio` | `archive-ingestion.service.ts:883` | Read | **High** | `getArchiveCompStats` default fields include both stale names. Dynamic aggregate query returns null stats for cap rate and expense ratio buckets. |
| 8 | `data_library_assets` | `opex_ratio` | `operating_expense_ratio` | `archive.routes.ts:321` | Read | **High** | Same `getArchiveCompStats` call path via the archive comp stats route. |
| 9 | `data_library_files` | `parsing_status`, `parsing_stage`, `parsing_errors` | `parser_status`, `parser_used`, `parser_error` | `__tests__/dataLibrary.runOmPipeline.test.ts:84–268` | Test mock | **Medium** | Test mock intercepts queries by regex-matching old column name strings. Tests pass but validate against stale schema. Any fix to the service that uses correct names will break these tests — which is the correct behavior. Tests need updating alongside any service changes. |
| 10 | `data_library_assets` | `going_in_cap_rate` | `cap_rate` | `capsule-sharing.routes.ts:655, 1893, 2114, 2169, 2388` | Read | **Low** | `cap_rate ?? going_in_cap_rate` fallback. Reads correct column first. Old name is dead fallback. No breakage. |
| 11 | `data_library_assets` | `going_in_cap_rate` | `cap_rate` | `m08-strategies.service.ts:784, 789` | Read | **Low** | Multi-level fallback. Correct column read first. |
| 12 | `data_library_assets` | `going_in_cap_rate` | `cap_rate` | `CapsuleDetailPage.tsx:380`, `CapsuleLinkPage.tsx:577` | Read | **Low** | Same graceful fallback pattern. |
| 13 | `data_library_assets` | `going_in_cap_rate` | `cap_rate` | `proforma.types.ts:211, 245` | Type def | **Low** | TypeScript type field. No SQL. |
| 14 | `data_library_assets` | `going_in_cap_rate` | `cap_rate` | `field-labels.ts:52` | UI label | **Low** | String label map only. No SQL. |
| 15 | `data_library_files` | `parsing_status` | `parser_status` | `data-library.routes.ts:176` | Comment | **Low** | Comment text only. No SQL impact. |
| 16 | `data_library_assets` | `going_in_cap_rate` | `cap_rate` | `capsule-intelligence.service.ts:346` | Comment | **Low** | Documents the rename. Code below uses correct names. |

---

## (e) Recommended Fix Per Critical/High Finding

Audit only — no fixes applied in this dispatch. Recommendations for the next dispatch:

### Critical — `bulk-upload.routes.ts:165, 237`

Replace `parsing_status` with `parser_status` in both INSERTs into `data_library_files`. The INSERT column list and value `'pending'` map to `parser_status = 'unparsed'` (the current default/initial state). Both occurrences are self-contained and easy to fix without side effects.

```sql
-- Change:
(user_id, asset_id, file_name, file_path, file_size, mime_type, source_type, parsing_status)
VALUES ($1, $2, $3, $4, $5, $6, 'owned', 'pending')

-- To:
(user_id, asset_id, file_name, file_path, file_size, mime_type, source_type, parser_status)
VALUES ($1, $2, $3, $4, $5, $6, 'owned', 'unparsed')
```

Note: `data_library_files` does not have `file_name` or `file_path` columns — it has `original_filename` and `storage_key`. These INSERTs may be failing for multiple reasons and need a full column audit against the actual schema before fixing.

### High — `data-library-assets.routes.ts:163`

Replace `df.parsing_status, df.parsing_stage` with `df.parser_status, df.parser_used` in the SELECT for the `:id/files` endpoint.

### High — `archive.routes.ts:113, 216`

Replace `trailing_noi` with `noi` and `opex_ratio` with `operating_expense_ratio` in the two queries targeting `data_library_assets`. The column at line 321 (`fields` array) should also be updated, but `getArchiveCompStats` should be the single source of truth for that list.

### High — `archive-ingestion.service.ts:883, 995, 998, 1009`

Two changes needed:
1. Line 883: Update the `getArchiveCompStats` default `fields` array — replace `'going_in_cap_rate'` with `'cap_rate'` and `'opex_ratio'` with `'operating_expense_ratio'`.
2. Lines 995–1009: Update the SELECT query — replace `trailing_noi` with `noi` and `opex_ratio` with `operating_expense_ratio`. Update the result-mapping object accordingly.

### Medium — `__tests__/dataLibrary.runOmPipeline.test.ts`

Update test mock intercepts and assertions from old column names (`parsing_stage`, `parsing_status`, `parsing_errors`) to current names (`parser_used`, `parser_status`, `parser_error`). Fix alongside any service fix that touches those columns.

---

## Summary Table

| Severity | Count | Tables affected |
|---|---|---|
| Critical | 2 | `data_library_files` (write — no row created) |
| High | 6 | `data_library_files` (read — 500 error), `data_library_assets` (read — always NULL) |
| Medium | 1 | Test mock (validates stale schema) |
| Low | 8 | Graceful fallbacks, type defs, labels, comments |

The Critical and High findings all share the same root cause: the `20260426_om_pipeline_schema_fixes.sql` migration renamed three columns in `data_library_assets` without a corresponding grep-and-fix sweep of consuming code, and the `data_library_files` table was rebuilt with new column names with no migration record of the old names.

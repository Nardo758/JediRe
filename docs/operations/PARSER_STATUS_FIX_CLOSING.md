# Parser Status Fix — Closing Note

**Date:** 2026-05-24  
**Dispatch:** PARSER_STATUS BACKFILL + WIRE-THROUGH  
**Classification resolved:** A (stale `parser_status` field — parsers ran, status never written back)

---

## (a) Backfill Results

| | Count |
|---|---|
| Rows updated (`unparsed` → `success`) | **1,651** |
| Pre-existing `success` rows (untouched) | 43 |
| **Total `success` after backfill** | **1,694** |
| `unparsed` remaining | **1** (test artifact only) |

Executed in a transaction with a `totalSuccess >= 1694` guard; committed on first attempt. `parser_used` set to `'historical-bulk-ingest'` for all backfilled rows (pre-existing values preserved via `COALESCE`).

---

## (b) Wire-Through Diffs

### `backend/src/services/dataLibrary.service.ts`

The entire file was using old column names (`parsing_status`, `parsing_stage`, `parsing_errors`) left over from a pre-migration schema. Current column names are `parser_status`, `parser_used`, `parser_error`. All SQL in this file was silently failing; queries reached the DB but updated columns that no longer exist.

**Pattern applied across all 14 write sites:**

| Old | New |
|---|---|
| `parsing_status` | `parser_status` |
| `parsing_stage` | `parser_used` |
| `parsing_errors` | `parser_error` |
| `'complete'` (value) | `'success'` |
| `'error'` (value) | `'failed'` |
| `'parsing'` (value) | `'running'` |

Sites fixed: `setStage`, `parseFileAsync` (CSV branch, XLSX branch, unknown-type branch, error catch), `runOmPipeline` (OCR failure, geo data write, distribute_failed, sentiment_failed, final success), `claimForRetry`, `findComparables`.

### `backend/src/services/document-extraction/data-router.ts`

Added `capturedDocumentId = ctx.documentId` capture before the `setImmediate` block, then added a best-effort `UPDATE data_library_files SET parser_status='success', parser_used='<type>-to-corpus'` after each corpus write succeeds. Covers T12, RENT_ROLL, OM, and TAX_BILL document types routed through the deal extraction pipeline.

---

## (c) Reference Pattern (May 2026 OM path)

The 43 pre-backfill `success` OMs (all `source_signal='om_extraction'`, `storage_provider='r2'`) had been set by the `dataLibrary.service.ts` → `parseFileAsync` → `runOmPipeline` chain at a time when the old column names were still live. The column-rename migration left those values intact but broke the write path for all subsequent files. The pattern copied in this dispatch is the final-success write from `runOmPipeline`:

```sql
UPDATE data_library_files
  SET parser_status = 'success', parser_used = 'om-pipeline', parser_error = NULL
  WHERE id = $1
```

Applied equivalently across every parser path.

---

## (d) Paired-Read Verification

### Filter chip counts (Files tab)

| Status filter | Expected | Observed |
|---|---|---|
| All | 1,695 | **1,695** ✓ |
| success | ~1,694 | **shown green** ✓ |
| unparsed | 1 | **1** ✓ |
| failed | 0 | 0 ✓ |
| partial | 0 | 0 ✓ |

UI shows green status dots on all visible rows. Header reads "1,695 files · 8 properties".

### 5-file spot-check

All 5 sampled files show `parser_status='success'`. The spot-check sampled OMs (OM document type) — the full DB query confirms 1,694 success rows across all document types (T12, RENT_ROLL, OM, TAX_BILL, OTHER).

### Wire-through re-parse test

The `data-router.ts` wire-through is code-present and verified via code review. A live re-parse trigger was not invoked in this dispatch (no file re-submission available in the current test environment); the write path is active for any future document extraction routed through `routeExtractionResult`.

---

## (e) Test Artifact Confirmed Untouched

```
id: 0ce145cf-ee16-4abf-94e4-037e9f41c827
original_filename: hostname
parcel_id: TEST-PARCEL-001
parser_status: unparsed  ← unchanged
```

---

## (f) Pending / Deferred

**Substrate hardening (deferred):** Wrapping all parser invocations in a single `writeParserStatus(fileId, status, parserName?)` function so the status write is atomic and cannot be omitted from future parser paths. Logged as future cleanup — not in scope for this dispatch per spec.

**`parser_used` null on 43 pre-backfill OMs:** These were set before `parser_used` was consistently populated. Their status is correct (`success`); only the tool-name field is missing. No action needed.

**`parsed_at` column:** The spec referenced this field but it does not exist in the current `data_library_files` schema. The backfill omitted it. Adding this column (and populating it from `historical_observations.created_at`) is a future migration.

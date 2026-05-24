# Parser Status Diagnosis

**Date:** 2026-05-24  
**Analyst:** Automated diagnostic  
**Scope:** `data_library_files.parser_status` vs. actual parse evidence in `historical_observations` and `property_descriptions`

---

## (a) Total Files by `parser_status`

| `parser_status` | Count |
|---|---|
| `unparsed` | 1,652 |
| `success` | 43 |
| **Total** | **1,695** |

The 43 `success` files are uniformly OMs (PDF format), all uploaded on 2026-05-21 via the current document-extraction pipeline — the only ingestion path that writes back `parser_status`. Their `parser_used` column is `null` despite `parser_status = 'success'`, suggesting even that path only sets the status field, not the tool name.

---

## (b) Of `unparsed` Files: How Many Actually Have Corpus Rows

| | Count |
|---|---|
| `unparsed` files **with** at least one `historical_observations` row via `source_file_ids` | **1,651** |
| `unparsed` files **without** any corpus rows | **1** |

**1,651 out of 1,652 "unparsed" files have already been parsed.** The `parser_status` field was never written back. This is classification **A**.

Supporting aggregate figures:
- `historical_observations` total rows: **402**; of those, **265** have `source_file_ids` populated (UUID array, type `_uuid`)
- `property_descriptions` total rows: **472**

---

## (c) Sample of 5 "unparsed" Files — Full Evidence

| # | `id` | `original_filename` | `document_type` | `parcel_id` | `parser_status` | Corpus rows linked | `property_descriptions` for parcel |
|---|---|---|---|---|---|---|---|
| 1 | `9d553963` | 33 WEST 05b - LTO 04-22-22.XLS | OTHER | 33 West | unparsed | **1** | **1** |
| 2 | `0ce145cf` | hostname | OTHER | TEST-PARCEL-001 | unparsed | **0** | **0** |
| 3 | `e6db7771` | 100 Inverness RR 06.26.2019 modified.xls | OTHER | 100 Inverness | unparsed | **1** | **1** |
| 4 | `b7eaf26b` | 100 Inverness RR 06.26.2019.xls | OTHER | 100 Inverness | unparsed | **1** | **1** |
| 5 | `592f5b53` | 100 Inverness T12 05.2019.xls | T12 | 100 Inverness | unparsed | **1** | **1** |

**4 of 5 samples** have corpus rows and property descriptions fully populated. Sample #2 (`hostname`, `TEST-PARCEL-001`) is the lone genuinely unparsed row — almost certainly a test artifact, not a real document.

---

## (d) Classification

### **Classification A — overwhelmingly (1,651 / 1,652)**

Parsers ran and produced output (corpus rows in `historical_observations`, descriptions in `property_descriptions`), but the ingestion path that populated those 1,651 files **never wrote back `parser_status`**. The field is stale at `'unparsed'` for every file ingested before the current OM pipeline was introduced.

The 1 remaining genuinely unparsed file (`hostname` / `TEST-PARCEL-001`) is a test artifact. It is not a real document and does not indicate parsers failed — it was never parsed because there was nothing meaningful to parse.

There is no **Classification B** population in any material sense. The split is 99.94% A / 0.06% test artifact.

---

## (e) Recommended Fix

### Immediate — backfill `parser_status`

```sql
-- Backfill: any file with at least one corpus row linked is confirmed parsed
UPDATE data_library_files dlf
SET parser_status = 'success'
WHERE dlf.parser_status = 'unparsed'
  AND EXISTS (
    SELECT 1 FROM historical_observations ho
    WHERE dlf.id = ANY(ho.source_file_ids)
  );
-- Expected affected rows: 1,651
```

This is a **safe, reversible, additive** backfill. It sets status to the factually correct value for rows where parse evidence already exists. No data is moved or deleted.

### Forward — wire all ingestion paths to write `parser_status`

The root cause is that the historical bulk-ingestion path (which loaded all pre-existing .xls / .xlsx / rent-roll / T12 files) ran parsers and stored outputs but skipped the `parser_status` write. Every ingestion path must write one of `('unparsed' | 'running' | 'success' | 'failed')` at the appropriate lifecycle stage:

| Stage | Value to write |
|---|---|
| File record created, parser not yet dispatched | `unparsed` (default — fine as-is) |
| Parser job accepted / in-flight | `running` |
| Parser completed and wrote corpus rows | `success` |
| Parser threw or returned no output | `failed` |

The `parser_run_id`, `parser_used`, and `parser_version` columns should also be populated at completion; currently they are null even on the 43 `success` OMs.

### Do not touch the 1 test artifact

`id = 0ce145cf` (`hostname`, `TEST-PARCEL-001`) has no corpus rows and no real parcel. Leave it at `unparsed` or delete the row at the operator's discretion — it is not a signal that any parser is broken.

---

## Dispatch Constraint

**No data has been modified in this diagnostic.** This report is observation-only. The backfill SQL above is provided for the next dispatch to execute after review.

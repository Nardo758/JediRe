# Phase 0.2 Dispatch — parse-om SELECT Fix + OM/R2 Upload Wiring

**Depends on:** Phase 0.1 (all migrations live, R2 verified)
**Reference:** PER_PROPERTY_VISIBILITY_SPEC.md §5.3, §6.1-6.3

---

## Part A: parse-om SELECT Fix

### Problem
The parse-om endpoint's SELECT for existing rows includes `observation_date` in the WHERE clause. When a batch re-run encounters an existing C1-tier row for the same parcel_id on a different observation_date, it creates a ghost stub (duplicate C1 row with no parsed data). This is why the 24-file re-run needed `DELETE FROM historical_observations WHERE source_signals @> '["om_extraction"]' AND parcel_id = ANY($1)` before re-uploading.

### Fix
In the parse-om persistence logic (likely in `om-parser.ts` or `archive.routes.ts`), change the lookup to match on `parcel_id` alone with `source_signals @> ARRAY['om_extraction']`, ignoring `observation_date`. Use `ON CONFLICT` or an upsert pattern so re-runs update existing rows rather than inserting new ones.

**Before (pseudocode):**
```sql
SELECT id FROM historical_observations 
WHERE parcel_id = $1 AND observation_date = $2 AND source_signals @> ARRAY['om_extraction']
```

**After:**
```sql
SELECT id FROM historical_observations 
WHERE parcel_id = $1 AND source_signals @> ARRAY['om_extraction']
ORDER BY data_quality_tier ASC, observation_date DESC 
LIMIT 1
```

Then UPDATE that row's `payload_json` with the new extraction data rather than INSERTing a new row.

### Files to check
- `src/services/document-extraction/parsers/om-parser.ts` — the persistence/write logic
- `src/api/rest/archive.routes.ts` lines around the parse-om handler (formerly line 789)
- Any `INSERT INTO historical_observations` in the OM extraction flow

---

## Part B: OM/R2 Upload Wiring

### What Changes
When `POST /api/v1/archive/parse-om` processes a PDF, it should also:
1. Upload the PDF to R2
2. Register the file in `data_library_files`

### Flow
```
POST /api/v1/archive/parse-om?parcel_id=X
  │
  ├── (existing) Extract PDF text → AI → write to historical_observations
  │
  ├── NEW: Upload PDF to R2
  │     key = "oms/{parcel_id}/{sha256}_{original_filename}"
  │     mime_type = "application/pdf"
  │     storage_provider = "r2"
  │
  ├── NEW: Register file
  │     INSERT INTO data_library_files
  │     (parcel_id, sha256, original_filename, mime_type, size_bytes,
  │      storage_provider, storage_bucket, storage_key,
  │      document_type='OM', parser_status='success',
  │      source_signal='om_extraction',
  │      license_restricted=false)
  │
  └── NEW: Link to observation
        UPDATE historical_observations SET source_file_ids = 
        array_append(COALESCE(source_file_ids, '{}'), $fileId)
        WHERE parcel_id = $parcelId AND source_signals @> ARRAY['om_extraction']
```

### Idempotency
- Before uploading to R2, check if a file with the same `sha256` already exists in `data_library_files`. If yes, skip the R2 upload (already stored).
- This makes re-runs safe — the second upload finds the sha256 match and skips.

### R2 Key Convention
```
oms/{parcel_id}/{sha256[:16]}_{original_filename}
```
Example: `oms/Mirabella%20Lakes/a1b2c3d4e5f6a789_Mirabella OM.pdf`

Keeps keys organized by parcel, and the short sha256 prefix prevents collisions while keeping keys readable.

---

## Acceptance Criteria

1. Re-running `POST /api/v1/archive/parse-om` for the same parcel_id:
   - Updates the existing `historical_observations` row (no ghost stubs)
   - Skips re-uploading the PDF to R2 (sha256 match)
   - No duplicate file registrations in `data_library_files`

2. A fresh upload of a new OM PDF:
   - PDF lands in R2 at `oms/{parcel_id}/{sha256_prefix}_{filename}`
   - `data_library_files` has a row with correct metadata
   - `historical_observations.source_file_ids` links to the file

3. Backfill the ~40 already-parsed OMs:
   - R2 upload their PDFs (from the local archive path — Leon's machine for the backfill, or Replit can re-fetch)
   - Register files in `data_library_files`
   - Link to existing `historical_observations` rows
   - **Note:** This backfill requires the source PDFs, which are on Leon's Windows machine. For Phase 0 scope, skip the backfill of already-parsed OMs; just wire the flow so new uploads work. Backfill can happen in Phase 1 (full batch upload).

---

## Closing Note Format

```
Phase 0.2 closing note:
- Part A (SELECT fix): status + affected files changed
- Part B (R2 upload wiring): test with 1 OM PDF — 
  confirmed file in R2 bucket, data_library_files row created, 
  source_file_ids populated
- Compile check: PASS/FAIL
- Test results: X/Y passing
```

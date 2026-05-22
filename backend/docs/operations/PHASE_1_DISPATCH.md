# Phase 1 Dispatch — Full Batch File Upload to R2

**Depends on:** Phase 0.1 + 0.2 (R2 working, data_library_files live)
**Reference:** PER_PROPERTY_VISIBILITY_SPEC §6.2-6.3

---

## Overview

Upload all 3,744 files (beyond the 42 OMs already done) from Leon's Windows machine to R2, register in `data_library_files`, and link to existing `historical_observations` rows.

The 42 OM PDFs are already uploaded to R2 (done from Leon's machine in Phase 0.2 backfill). Remaining: ~3,700 files (rent rolls, T12s, BoxScores, concession burnoffs, tax bills, etc.).

## What's Needed on the Server

### 1. Generic File Upload Endpoint

The current `parse-om` endpoint handles AI extraction + file upload for OMs. Need a separate endpoint for non-OM files that just does R2 upload + registration + backlink, no AI.

```
POST /api/v1/archive/files/ingest

Headers: x-ingest-secret: jedire-archive-2026

Body: multipart/form-data with file + fields:
- parcel_id: string
- observation_date: string (YYYY-MM-DD, optional)
- document_type: string (RENT_ROLL | T12 | BOX_SCORE | LEASING_STATS | OM | TAX_BILL | OTHER)
- parser_status: string (success | partial | failed | unparsed)

Response:
{
  success: boolean,
  fileId: uuid,
  sha256: string,
  storageKey: string,
  duplicate: boolean, // true if sha256 already existed
  metadata?: { size_bytes, mime_type }
}
```

### 2. Backfill source_file_ids for existing corpus rows

```sql
-- For each new file registered, link to existing historical_observations
-- that match on parcel_id + document_type + observation_date proximity
UPDATE historical_observations ho
SET source_file_ids = array_append(
  COALESCE(ho.source_file_ids, '{}'),
  dlf.id
)
FROM data_library_files dlf
WHERE dlf.parcel_id = ho.parcel_id
  AND dlf.document_type = ANY(ho.source_signals)  -- approximate match
  AND NOT (ho.source_file_ids @> ARRAY[dlf.id])
  AND dlf.id NOT IN (SELECT unnest(COALESCE(ho.source_file_ids, '{}')));
```

This is a one-time backfill that pairs each uploaded file with its corresponding corpus row. The matching isn't perfect (different schema shapes) but covers the common case where `parcel_id + document_type + date proximity` uniquely identifies the right row.

---

## What Runs on Leon's Machine

### Batch Upload Script

```typescript
// scripts/archive-bulk-file-upload.ts

interface UploadConfig {
  rootFolder: string; // "C:\\Users\\Leon\\OneDrive - Myers Apartment Group\\Deals\\Archive"
  endpoint: string;   // "https://...replit.dev/api/v1/archive/files/ingest"
  secret: string;     // "jedire-archive-2026"
  concurrency: number; // 4-8 parallel uploads
  documentTypeResolver: (filename: string) => string;
  skipAlreadyUploaded: boolean; // check sha256 before upload
}

async function bulkUpload(config: UploadConfig): Promise<UploadReport>
```

### Classify document_type from filename

Reuse `classifyDocument()` from the existing pipeline, but map DocumentType enum to the string API values:
- Rent roll → `RENT_ROLL`
- T12 → `T12`
- BoxScore → `BOX_SCORE`
- Concession burnoff → `LEASING_STATS`
- OM (already done, skip) → `OM`
- Other → `OTHER`

### Sha256 Dedup

Before uploading, compute sha256 of the file locally and check if it's already in `data_library_files`. If yes, skip upload entirely (idempotent re-runs).

This is especially important since the 42 OMs are already up — the script should skip those.

---

## Acceptance Criteria

1. All 3,744 files uploaded to R2 (minus the 42 already-uploaded OMs)
2. `data_library_files` table has 3,744+ rows, each with parcel_id, sha256, storage_key
3. `historical_observations.source_file_ids` populated for most corpus rows
4. Manifest output: total_files, uploaded_X, skipped_dup_X, failed_X
5. Any failures documented with error message + file path

## Sizing

Estimated: 3,744 files × 2-3MB average ÷ 8 parallel ≈ 30-90 minutes over a good connection.

## Note on Already-Uploaded OMs

The 42 OM PDFs are already in R2 with metadata rows in `data_library_files`. The batch script should detect these by sha256 and skip them. The upload was done from Leon's machine directly to the `parse-om` endpoint.

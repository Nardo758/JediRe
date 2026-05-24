# Data Library Post-Launch Bug Diagnosis

**Date:** 2026-05-24  
**Analyst:** Agent #1035  
**Status:** Diagnosis complete — no patches applied

---

## Summary

Both reported issues share a **single root cause**: the `FilesTab` was written to call a backend endpoint (`/api/v1/data-library-files`) that was never created and never mounted. The 1,695 rows in `data_library_files` are intact. No data was lost. The files don't appear because the endpoint that would serve them doesn't exist.

---

## (a) The 404 — Root Cause

**Literal endpoint called by `FilesTab.tsx`:**
```
GET /api/v1/data-library-files?page=1&limit=50[&document_type=...][&parser_status=...][&search=...][&parcel_id=...]
```

**Why it 404s:** This path is not mounted in `backend/src/index.replit.ts`.

The two mounts that do exist:
```typescript
// index.replit.ts lines 563-564
app.use('/api/v1/data-library',        requireAuth, createDataLibraryRoutes(pool));
app.use('/api/v1/data-library-assets', requireAuth, createDataLibraryAssetsRoutes(pool));
```

- `/api/v1/data-library` → `data-library.routes.ts`: serves a `DataLibraryService` queried with `city/zipCode/propertyType` etc. — a completely different data model, not `data_library_files`.
- `/api/v1/data-library-assets` → `data-library-assets.routes.ts`: serves the `data_library_assets` table. Has a sub-route `GET /:id/files` that queries `data_library_files` but only scoped to a specific asset ID, and that sub-route has schema mismatches (see §f below).

There is no mount for `/api/v1/data-library-files` anywhere.

**Root cause classification:** Missing endpoint — the route was never built and never mounted.

**Also missing:**
```
GET /api/v1/data-library-files/:id/download
```
Same root cause. The FilesTab calls this for downloads. Has a `cdn_url` fallback but the archived rows have `cdn_url = NULL`, so download is also broken for pre-existing files.

---

## (b) Data-Not-Showing — Root Cause

The data-not-showing issue **shares the same root cause as the 404**. The endpoint 404s, `fetchFiles()` in `FilesTab.tsx` catches the error and sets `error` state, and the file list never populates.

This is **not** a separate filter scope issue. The endpoint returning 200-but-filtered would require the endpoint to exist, which it doesn't.

---

## (c) One Bug or Two?

**One root cause.** Both issues (404 on filter toggles, files not appearing) are caused by the missing `/api/v1/data-library-files` endpoint.

---

## (d) Schema State of `data_library_files`

**Row count:** 1,695 — matches pre-consolidation count exactly. ✅

**Spot check (10 most recent rows):**
```
id                                    | original_filename                              | parcel_id              | document_type | parser_status | uploaded_at
21fd229f-...                          | Legacy Village - T12 (2019.08).xlsx           | legacy Village         | T12           | unparsed      | 2026-05-21 18:23:50
b59d9d70-...                          | Legacy Village - T12 (2019.08) - Techno.xls   | legacy Village         | T12           | unparsed      | 2026-05-21 18:23:48
...
```

All 1,695 rows have a non-null `parcel_id`. Values are property names (e.g. "Portiva - Jacksonville", "Hunter Pointe"), not real parcel IDs — these were populated by the archive ingestion pipeline.

**Actual schema:**
```
id               uuid        NOT NULL
parcel_id        text        NULL
deal_id          uuid        NULL
original_filename text       NOT NULL
sha256           text        NOT NULL
mime_type        text        NULL
size_bytes       bigint      NULL
storage_provider text        NOT NULL
storage_bucket   text        NULL
storage_key      text        NULL
cdn_url          text        NULL
document_type    text        NULL
parser_used      text        NULL
parser_version   text        NULL
parser_status    text        NULL
parser_run_id    uuid        NULL
parser_error     text        NULL
uploaded_at      timestamptz NULL
uploaded_by      text        NULL
source_signal    text        NULL
license_restricted boolean   NULL
license_source   text        NULL
```

No RLS policies observed. Schema is intact.

---

## (e) Proposed Fix Per Issue

### Fix 1 — Create the missing `/api/v1/data-library-files` route (REQUIRED)

**File to create:** `backend/src/api/rest/data-library-files.routes.ts`

Needs two handlers:

**`GET /`** — paginated list with filters:
```
query params: search, document_type, parser_status, parcel_id, page, limit
response:     { files: LibraryFile[], pagination: { total, page, limit, pages } }
```
The `LibraryFile` shape `FilesTab.tsx` expects:
```typescript
{
  id, parcel_id, deal_id, original_filename, mime_type, size_bytes,
  storage_provider, storage_key, cdn_url, document_type, parser_used,
  parser_status, parser_error, uploaded_at, uploaded_by, source_signal,
  license_restricted, property_display_name  // ← derived, see note below
}
```
`property_display_name` does not exist as a column. The query should alias `parcel_id` as the display name for now (current data uses property names as parcel_id values), or optionally LEFT JOIN to `properties` on `parcel_id` to get a canonical name.

**`GET /:id/download`** — serve the file:
- If `cdn_url` is set: redirect 302 to `cdn_url`
- If `storage_key` + `storage_provider = 's3'`: generate a presigned URL
- Otherwise: 404 with message "File not available for download"

**Mount it in `index.replit.ts`** after line 564:
```typescript
import { createDataLibraryFilesRoutes } from './api/rest/data-library-files.routes';
// ...
app.use('/api/v1/data-library-files', requireAuth, createDataLibraryFilesRoutes(pool));
```

---

### Fix 2 — `bulk-upload.routes.ts` schema mismatch (SECONDARY — new uploads broken)

**File:** `backend/src/api/rest/bulk-upload.routes.ts` lines 164–168 and 236–241

The INSERT uses columns that don't exist in the current schema:

| Column used in bulk-upload INSERT | Actual column name |
|---|---|
| `user_id` | `uploaded_by` |
| `asset_id` | *(no equivalent — use `deal_id` or `parcel_id`)* |
| `file_name` | `original_filename` |
| `file_path` | *(no equivalent — use `storage_key`)* |
| `file_size` | `size_bytes` |
| `source_type` | `source_signal` |
| `parsing_status` | `parser_status` |

These inserts fail silently (caught by `.catch(err => logger.warn(...))`). New uploads via the BulkUploadPanel do not register in `data_library_files`. This is a separate fix — align the INSERT columns with the actual schema. Requires understanding which fields map where (especially `asset_id` → `parcel_id` vs `deal_id`) before patching.

---

### Fix 3 — `data-library-assets.routes.ts` `:id/files` schema mismatch (SECONDARY)

**File:** `backend/src/api/rest/data-library-assets.routes.ts` lines 97–116

The `GET /:id/files` sub-route selects columns that don't exist:

| Column queried | Actual column |
|---|---|
| `df.file_name` | `df.original_filename` |
| `df.file_size` | `df.size_bytes` |
| `df.parsing_status` | `df.parser_status` |
| `df.parsing_stage` | *(doesn't exist)* |
| `df.source_type` | `df.source_signal` |
| `df.asset_id = $1` | *(no `asset_id` column)* |

This route would return a 500 if called. The `WHERE df.asset_id = $1` join condition would need to become `WHERE df.parcel_id = (SELECT parcel_id FROM data_library_assets WHERE id = $1)` or similar. Defer to Leon for the correct join strategy.

---

## (f) Additional Broken Paths (Step 4C audit)

| Path | Status | Root cause |
|---|---|---|
| Filter chip (Type) | ❌ 404 | Missing `/api/v1/data-library-files` endpoint |
| Filter chip (Status) | ❌ 404 | Same |
| Search input | ❌ 404 | Same |
| Pagination | ❌ 404 | Same |
| File download button | ❌ 404 | Missing `/api/v1/data-library-files/:id/download` endpoint; cdn_url is NULL for all archive-ingested files |
| Property-name click → Assets tab | ✅ Works (routing) | `setSearchParams` correctly removes `dlTab` to default to Assets tab |
| Assets tab | ✅ Works | Served by `/api/v1/data-library-assets` |
| Inbox tab | Not tested | Depends on its own endpoint |
| Rollups tab | Not tested | Depends on its own endpoint |
| New file upload (BulkUploadPanel) | ❌ Silent fail | `bulk-upload.routes.ts` inserts using wrong column names — rows never appear in `data_library_files` (Fix 2 above) |

---

## (g) What the Old `/archive/library` Surface Did

`ArchiveLibraryPage.tsx` was a **pure redirect page** — it contained no API calls, no data fetching, and no UI of its own. It immediately redirected to `/settings/data-library?tab=files`. The old surface had no backend endpoint of its own. There is no "old endpoint" that the consolidation removed. The FilesTab was written as net-new code calling a net-new endpoint that was never built.

---

## Recommended Priority

1. **Fix 1** (create `data-library-files.routes.ts` + mount) — unblocks all file list, filter, search, and pagination functionality. This is the entire issue.
2. **Fix 2** (`bulk-upload.routes.ts` column alignment) — unblocks new file uploads appearing in the Files tab.
3. **Fix 3** (`data-library-assets.routes.ts` `:id/files` column alignment) — secondary; fix when the asset-scoped file list is needed.

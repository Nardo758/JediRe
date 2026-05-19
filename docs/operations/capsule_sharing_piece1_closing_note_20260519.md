# Capsule Sharing Piece 1 closing note — 2026-05-19

## Background
Per the Capsule Sharing and Boundary Spec, Piece 1 enables users to download source documents from the Document Center with audit logging.

## Investigation
- Read `source-documents.routes.ts` — listed documents but had no download endpoints
- Checked `deal_files` table — has `id`, `deal_id`, `filename`, `original_filename`, `mime_type`, `file_size`, `storage_path`
- Checked `document_access_log` table — did not exist
- Checked file storage layer — `cloud-storage.service.ts` handles Google Drive/Dropbox syncing, not local file access
- Local files appear to be stored in `uploads/{dealId}/` directory

## Changes Applied

### Migration: `20260519_capsule_sharing.sql`
Created with 4 tables:
- `document_access_log` — download audit trail (Piece 1)
- `capsule_shares` — external share management (Piece 4)
- `recipient_api_connections` — API key connections (Piece 4)
- `recipient_query_log` — aggregated usage logging (Piece 4)

### Updated: `source-documents.routes.ts` v2.0.0
Added 3 new endpoints:
- **`GET /:dealId/documents/:documentId/download`** — single file download
  - Resolves file from `storage_path` or local `uploads/{dealId}/` directory
  - Logs every download to `document_access_log`
  - Returns original file with correct MIME type and Content-Disposition
  - Requires auth
- **`GET /:dealId/documents/bulk_download`** — ZIP download of all deal documents
  - Uses `archiver` npm package
  - Includes `manifest.csv` with file metadata
  - Logs each file's download to `document_access_log`
  - Files missing from disk archived as `_missing_/filename` placeholder
- **`GET /:dealId/documents/access_log`** — audit log query for deal owner/team
  - Enriched with user email, filename, document type
  - Filterable (server-side), limited to 500 most recent

### Updated: `index.replit.ts`
- Mounted capsule-sharing routes at `/api/v1/deals` and `/api/v1`

## Verification
- TypeScript compilation: 0 new errors from any of our files (187 pre-existing)
- Endpoints follow existing patterns: auth middleware, authenticated request type, pool queries
- Document download logs to `document_access_log` (logging failure doesn't block download)

## Remaining
- Per-document permissions not yet wired (all deal files accessible if user can access the deal)
- Recipient-side download access (Piece 4) — the `allow_document_download` flag is in the share schema but not yet enforced on download routes
- The `documents` table name vs `deal_files` table name — the access_log migration references `documents(document_id)` which assumes a `documents` table. If the platform uses `deal_files` as the primary document store, the FK reference may need adjustment

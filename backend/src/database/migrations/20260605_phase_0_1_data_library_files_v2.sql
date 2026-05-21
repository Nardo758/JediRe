-- Phase 0.1 — data_library_files v2 (R2-backed document store)
-- The pre-existing data_library_files table (integer id, legacy schema)
-- is renamed to data_library_files_legacy to preserve its 23 rows.
-- The new table uses uuid id, sha256 dedup, R2 storage fields,
-- and a strict parser_status CHECK constraint.

BEGIN;

ALTER TABLE data_library_files RENAME TO data_library_files_legacy;

CREATE TABLE data_library_files (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parcel_id        text,
  deal_id          uuid,
  original_filename text NOT NULL,
  sha256           text NOT NULL UNIQUE,
  mime_type        text,
  size_bytes       bigint,
  storage_provider text NOT NULL DEFAULT 'r2',
  storage_bucket   text,
  storage_key      text,
  cdn_url          text,
  document_type    text,
  parser_used      text,
  parser_version   text,
  parser_status    text DEFAULT 'unparsed'
                   CHECK (parser_status IN ('success','partial','failed','unparsed')),
  parser_run_id    uuid,
  parser_error     text,
  uploaded_at      timestamptz DEFAULT now(),
  uploaded_by      text,
  source_signal    text,
  license_restricted boolean DEFAULT false,
  license_source   text,
  CONSTRAINT parcel_or_deal CHECK (parcel_id IS NOT NULL OR deal_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_dlf_parcel        ON data_library_files(parcel_id);
CREATE INDEX IF NOT EXISTS idx_dlf_deal          ON data_library_files(deal_id);
CREATE INDEX IF NOT EXISTS idx_dlf_sha256        ON data_library_files(sha256);
CREATE INDEX IF NOT EXISTS idx_dlf_document_type ON data_library_files(document_type);

COMMIT;

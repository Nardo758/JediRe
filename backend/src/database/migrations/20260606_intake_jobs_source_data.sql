-- Add source_data and source_type columns to intake_jobs.
-- source_data: the original raw record from the upstream source (Apartment Locator, file upload, etc.)
-- source_type: which system created this job ('apartment_locator', 'file_upload', 'manual', etc.)
--
-- ── UP ──────────────────────────────────────────────────────────────────────

ALTER TABLE intake_jobs
  ADD COLUMN IF NOT EXISTS source_data jsonb,
  ADD COLUMN IF NOT EXISTS source_type text DEFAULT 'unknown';

-- ── DOWN (run manually to reverse) ──────────────────────────────────────────
-- ALTER TABLE intake_jobs DROP COLUMN IF EXISTS source_data;
-- ALTER TABLE intake_jobs DROP COLUMN IF EXISTS source_type;
-- Add unique index on intake_jobs.parcel_id for ON CONFLICT support
CREATE UNIQUE INDEX IF NOT EXISTS idx_intake_jobs_parcel_unique ON intake_jobs(parcel_id) WHERE parcel_id IS NOT NULL;

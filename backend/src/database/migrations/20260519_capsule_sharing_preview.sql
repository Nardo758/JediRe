-- Capsule Sharing Preview Columns — sender-curated pitch
-- 2026-05-19
--
-- Adds preview_text and preview_metadata to capsule_shares so the sender
-- can write a short pitch when creating the share. Stored on capsule_shares
-- itself, never queried from deals at resolution time.
--
-- Security property: preserves the bypass-prevention fix. Preview text is
-- curated by the sender, not derived from deal data. Resolution endpoint
-- queries only capsule_shares, not deals.

BEGIN;

ALTER TABLE capsule_shares
  ADD COLUMN IF NOT EXISTS preview_text TEXT
    CHECK (preview_text IS NULL OR length(preview_text) <= 500);

ALTER TABLE capsule_shares
  ADD COLUMN IF NOT EXISTS preview_metadata JSONB
    CHECK (
      preview_metadata IS NULL
      OR jsonb_typeof(preview_metadata) = 'object'
    );

COMMIT;

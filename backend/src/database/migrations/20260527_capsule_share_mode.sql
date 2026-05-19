-- Capsule share mode + label
-- 2026-05-27
--
-- Adds two columns to capsule_external_shares:
--   share_mode  — 'specific_recipient' (default) | 'shareable_link'
--   label       — optional sender tracking label (max 200 chars)
--
-- recipient_email was already nullable (no NOT NULL constraint in the original DDL),
-- so no change needed there.

BEGIN;

ALTER TABLE capsule_external_shares
  ADD COLUMN IF NOT EXISTS share_mode TEXT NOT NULL DEFAULT 'specific_recipient'
    CHECK (share_mode IN ('specific_recipient', 'shareable_link'));

ALTER TABLE capsule_external_shares
  ADD COLUMN IF NOT EXISTS label TEXT
    CHECK (label IS NULL OR length(label) <= 200);

COMMIT;

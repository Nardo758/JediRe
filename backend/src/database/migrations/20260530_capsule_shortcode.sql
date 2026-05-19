-- Migration: add shortcode column to capsule_external_shares
-- Shortcode is a 7-char base-62 string used in /share/:shortcode recipient URLs.
-- Existing shares retain NULL; new shares get a shortcode at creation time.

ALTER TABLE capsule_external_shares
  ADD COLUMN IF NOT EXISTS shortcode VARCHAR(8);

CREATE UNIQUE INDEX IF NOT EXISTS uq_capsule_shares_shortcode
  ON capsule_external_shares (shortcode)
  WHERE shortcode IS NOT NULL;

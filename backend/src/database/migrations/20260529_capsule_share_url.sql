-- Add share_url to capsule_external_shares so owners can re-copy links after creation
-- The raw access token is only available at creation time (stored as hash); share_url
-- preserves the full recipient URL for display in the Shares management panel.

ALTER TABLE capsule_external_shares
  ADD COLUMN IF NOT EXISTS share_url TEXT;

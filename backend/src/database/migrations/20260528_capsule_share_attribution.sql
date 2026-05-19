-- Capsule Share Attribution Override — Per-Share White-Label Control
-- 2026-05-28
--
-- Adds a nullable boolean to capsule_external_shares so premium-tier senders
-- can override their account-default attribution setting on a per-share basis.
--   NULL  = inherit account default (user_branding_settings.show_attribution)
--   TRUE  = always show "Powered by JediRe" on this share
--   FALSE = hide attribution on this share (requires principal/institutional tier)

ALTER TABLE capsule_external_shares
  ADD COLUMN IF NOT EXISTS show_attribution_override BOOLEAN;

-- User Branding Settings — Platform Name + Attribution Toggle
-- 2026-05-28
--
-- Stores per-user branding preferences for recipient-facing surfaces:
--   company_name  — shown in deal share header (all tiers)
--   logo_url      — shown in deal share header (all tiers)
--   show_attribution — whether "Powered by JediRe" appears (principal/institutional can set false)
--
-- Rows are optional: if no row exists for a user, defaults apply (attribution visible).

CREATE TABLE IF NOT EXISTS user_branding_settings (
  user_id          UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  company_name     VARCHAR(120),
  logo_url         TEXT,
  show_attribution BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_branding_settings_user_id ON user_branding_settings(user_id);

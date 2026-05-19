-- Recipient Session Overlays — Capsule Sharing Phase A
-- 2026-05-27
--
-- Session-scoped overlay table for recipient modifications.
-- Keyed by access_token_hash (SHA-256 of the raw access token).
-- overlay_data is a flat-key JSONB map:
--   { "user_adjustments.preferred_hold_period": 7, "deal_data.exit_cap_assumption": 5.5 }
-- Keys follow the dot-path into the capsule object.
-- Overlay is never written back to the sender's deal.

BEGIN;

CREATE TABLE IF NOT EXISTS recipient_session_overlays (
    overlay_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    access_token_hash   TEXT UNIQUE NOT NULL,
    share_id            UUID NOT NULL REFERENCES capsule_external_shares(share_id) ON DELETE CASCADE,
    overlay_data        JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recipient_session_overlays_token
    ON recipient_session_overlays(access_token_hash);

CREATE INDEX IF NOT EXISTS idx_recipient_session_overlays_share
    ON recipient_session_overlays(share_id);

COMMIT;

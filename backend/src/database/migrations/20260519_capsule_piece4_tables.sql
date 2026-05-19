-- Capsule Piece 4 — External Share Tables
-- 2026-05-19
--
-- Creates the four tables needed for Piece 4 external capsule sharing.
-- Uses capsule_external_shares (references deal_capsules, not deals)
-- to avoid colliding with the existing internal capsule_shares table.
-- Includes preview_text + preview_metadata inline (no separate migration needed).
--
-- Tables:
--   1. capsule_external_shares  — external share management
--   2. recipient_api_connections — connect-your-API (AES-256-GCM encrypted keys)
--   3. recipient_query_log       — aggregated usage (content NOT stored)
--   4. document_access_log       — document download audit trail

BEGIN;

-- ── 1. External capsule shares ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS capsule_external_shares (
    share_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    capsule_id UUID NOT NULL REFERENCES deal_capsules(id) ON DELETE CASCADE,
    shared_by_user_id UUID NOT NULL REFERENCES users(id),

    -- Share configuration
    share_type TEXT NOT NULL CHECK (share_type IN ('external_view', 'external_agent_enabled')),
    recipient_email TEXT,
    recipient_name TEXT,

    -- Permissions
    allow_document_download BOOLEAN NOT NULL DEFAULT TRUE,
    allow_agent_interaction BOOLEAN NOT NULL DEFAULT TRUE,
    expires_at TIMESTAMPTZ,

    -- Status
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,

    -- Access token (SHA-256 hash stored; raw token returned once to sender)
    access_token TEXT UNIQUE,

    -- Sender-curated pitch (never derived from deal data)
    preview_text TEXT CHECK (preview_text IS NULL OR length(preview_text) <= 500),
    preview_metadata JSONB CHECK (
        preview_metadata IS NULL
        OR jsonb_typeof(preview_metadata) = 'object'
    ),

    CONSTRAINT external_share_requires_token
        CHECK (
            share_type NOT IN ('external_view', 'external_agent_enabled')
            OR access_token IS NOT NULL
        )
);

CREATE INDEX IF NOT EXISTS idx_capsule_external_shares_capsule
    ON capsule_external_shares(capsule_id);

CREATE INDEX IF NOT EXISTS idx_capsule_external_shares_sender
    ON capsule_external_shares(shared_by_user_id);

CREATE INDEX IF NOT EXISTS idx_capsule_external_shares_token
    ON capsule_external_shares(access_token)
    WHERE revoked_at IS NULL;

-- ── 2. Recipient API connections ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS recipient_api_connections (
    connection_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    share_id UUID NOT NULL REFERENCES capsule_external_shares(share_id) ON DELETE CASCADE,

    provider TEXT NOT NULL CHECK (provider IN ('anthropic', 'openai', 'other')),
    api_key_encrypted TEXT NOT NULL,
    stripe_customer_id TEXT,

    connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    disconnected_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,

    total_queries INTEGER NOT NULL DEFAULT 0,
    total_tokens_consumed BIGINT NOT NULL DEFAULT 0,
    total_charges_usd NUMERIC(10,2) NOT NULL DEFAULT 0,
    platform_margin_usd NUMERIC(10,2) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_recipient_api_connections_share
    ON recipient_api_connections(share_id);

-- ── 3. Recipient query log (aggregated — content NOT stored) ──────────────────

CREATE TABLE IF NOT EXISTS recipient_query_log (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID NOT NULL REFERENCES recipient_api_connections(connection_id) ON DELETE CASCADE,
    query_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    tokens_input INTEGER,
    tokens_output INTEGER,
    cost_basis_usd NUMERIC(8,4),
    platform_margin_usd NUMERIC(8,4),
    total_charged_usd NUMERIC(8,4),

    query_category TEXT,
    response_status TEXT
);

CREATE INDEX IF NOT EXISTS idx_recipient_query_log_connection
    ON recipient_query_log(connection_id, query_timestamp DESC);

-- ── 4. Document access audit log ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS document_access_log (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL,
    capsule_id UUID REFERENCES deal_capsules(id),
    accessed_by_user_id UUID REFERENCES users(id),
    accessed_by_recipient_token TEXT,
    access_type TEXT NOT NULL CHECK (access_type IN ('view', 'download_single', 'download_bulk')),
    access_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,

    CONSTRAINT doc_access_either_user_or_recipient
        CHECK (accessed_by_user_id IS NOT NULL OR accessed_by_recipient_token IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_doc_access_log_capsule
    ON document_access_log(capsule_id, access_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_doc_access_log_user
    ON document_access_log(accessed_by_user_id, access_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_doc_access_log_doc
    ON document_access_log(document_id, access_timestamp DESC);

COMMIT;

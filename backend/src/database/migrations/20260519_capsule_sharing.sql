-- Capsule Sharing & Boundary Schema — M41-M45
-- 2026-05-19
--
-- Three tables for Pieces 1 and 4 of the Capsule Sharing spec:
--   1. document_access_log (Piece 1 — download audit trail)
--   2. capsule_shares (Piece 4 — external share management)
--   3. recipient_api_connections (Piece 4 — connect-your-API)
--   4. recipient_query_log (Piece 4 — usage logging, content not stored)

BEGIN;

-- ── Piece 1: Document download audit log ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS document_access_log (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(document_id),
    deal_id UUID NOT NULL REFERENCES deals(id),
    accessed_by_user_id UUID REFERENCES users(user_id),
    accessed_by_recipient_token TEXT,
    access_type TEXT NOT NULL CHECK (access_type IN ('view', 'download_single', 'download_bulk')),
    access_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,

    CONSTRAINT either_user_or_recipient
        CHECK (accessed_by_user_id IS NOT NULL OR accessed_by_recipient_token IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_doc_access_log_deal
    ON document_access_log(deal_id, access_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_doc_access_log_user
    ON document_access_log(accessed_by_user_id, access_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_doc_access_log_doc
    ON document_access_log(document_id, access_timestamp DESC);

-- ── Piece 4: Capsule shares (external) ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS capsule_shares (
    share_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id UUID NOT NULL REFERENCES deals(id),
    scenario_id UUID REFERENCES deal_scenarios(scenario_id),
    shared_by_user_id UUID NOT NULL REFERENCES users(user_id),

    -- Share configuration
    share_type TEXT NOT NULL CHECK (share_type IN ('platform_user_fork', 'external_view', 'external_agent_enabled')),
    recipient_email TEXT,
    recipient_name TEXT,

    -- Settings
    allow_document_download BOOLEAN NOT NULL DEFAULT TRUE,
    allow_agent_interaction BOOLEAN NOT NULL DEFAULT TRUE,
    expires_at TIMESTAMPTZ,

    -- Status
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,

    -- Access token for non-platform recipients
    access_token TEXT UNIQUE,

    CONSTRAINT external_share_has_token
        CHECK (
            share_type NOT IN ('external_view', 'external_agent_enabled')
            OR access_token IS NOT NULL
        )
);

CREATE INDEX IF NOT EXISTS idx_capsule_shares_deal
    ON capsule_shares(deal_id);

CREATE INDEX IF NOT EXISTS idx_capsule_shares_sender
    ON capsule_shares(shared_by_user_id);

CREATE INDEX IF NOT EXISTS idx_capsule_shares_token
    ON capsule_shares(access_token)
    WHERE revoked_at IS NULL;

-- ── Piece 4: Recipient API connections ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS recipient_api_connections (
    connection_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    share_id UUID NOT NULL REFERENCES capsule_shares(share_id),

    -- Provider info
    provider TEXT NOT NULL CHECK (provider IN ('anthropic', 'openai', 'other')),
    api_key_encrypted TEXT NOT NULL,  -- encrypted at rest
    stripe_customer_id TEXT,

    -- Status
    connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    disconnected_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,

    -- Usage
    total_queries INTEGER NOT NULL DEFAULT 0,
    total_tokens_consumed BIGINT NOT NULL DEFAULT 0,
    total_charges_usd NUMERIC(10,2) NOT NULL DEFAULT 0,
    platform_margin_usd NUMERIC(10,2) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_recipient_api_connections_share
    ON recipient_api_connections(share_id);

-- ── Piece 4: Recipient query log (aggregated only — content NOT stored) ──────

CREATE TABLE IF NOT EXISTS recipient_query_log (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID NOT NULL REFERENCES recipient_api_connections(connection_id),
    query_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Aggregated only — query content not stored
    tokens_input INTEGER,
    tokens_output INTEGER,
    cost_basis_usd NUMERIC(8,4),
    platform_margin_usd NUMERIC(8,4),
    total_charged_usd NUMERIC(8,4),

    -- Categorization for product improvement (category, not query text)
    query_category TEXT,
    response_status TEXT
);

CREATE INDEX IF NOT EXISTS idx_recipient_query_log_connection
    ON recipient_query_log(connection_id, query_timestamp DESC);

COMMIT;

-- Migration: zoning_analyses table
-- Date: 2026-04-19
-- Description: Stores structured zoning analysis results produced by the Zoning agent.
--              One row per deal (upsert-safe via ON CONFLICT (deal_id)).

CREATE TABLE IF NOT EXISTS zoning_analyses (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id         UUID        NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
    agent_run_id    UUID,
    zoning_code     VARCHAR(64) NOT NULL,
    zoning_description TEXT,
    permitted_uses  JSONB       NOT NULL DEFAULT '[]',
    max_far         NUMERIC(8,4),
    max_height_ft   NUMERIC(8,2),
    max_gfa_sqft    NUMERIC(14,2),
    est_max_units   INTEGER,
    entitlement_risk VARCHAR(16) CHECK (entitlement_risk IN ('low','medium','high')),
    summary         TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_zoning_analyses_deal_id
    ON zoning_analyses (deal_id);

CREATE INDEX IF NOT EXISTS idx_zoning_analyses_agent_run
    ON zoning_analyses (agent_run_id);

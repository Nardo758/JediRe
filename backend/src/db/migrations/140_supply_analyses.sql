-- Migration: supply_analyses table
-- Date: 2026-04-19
-- Description: Stores structured supply analysis results produced by the Supply agent.
--              One row per deal (upsert-safe via ON CONFLICT (deal_id)).

CREATE TABLE IF NOT EXISTS supply_analyses (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id             UUID        NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
    agent_run_id        UUID,
    pipeline_units      INTEGER,
    delivery_risk       VARCHAR(16) CHECK (delivery_risk IN ('low','medium','high')),
    yoy_pct             NUMERIC(8,4),
    peak_delivery_year  INTEGER,
    top_developments    JSONB,
    summary             TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_supply_analyses_deal_id
    ON supply_analyses (deal_id);

CREATE INDEX IF NOT EXISTS idx_supply_analyses_agent_run
    ON supply_analyses (agent_run_id);

-- Migration: cashflow_projections table
-- Date: 2026-04-19
-- Description: Stores structured cashflow projection results produced by the CashFlow agent.
--              One row per deal (upsert-safe via ON CONFLICT (deal_id)).

CREATE TABLE IF NOT EXISTS cashflow_projections (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id                 UUID        NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
    agent_run_id            UUID,
    year1_noi               NUMERIC(16,2),
    stabilized_yield_pct    NUMERIC(8,4),
    five_yr_irr             NUMERIC(8,4),
    breakeven_occupancy     NUMERIC(8,4),
    assumptions             JSONB,
    summary                 TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_cashflow_projections_deal_id
    ON cashflow_projections (deal_id);

CREATE INDEX IF NOT EXISTS idx_cashflow_projections_agent_run
    ON cashflow_projections (agent_run_id);

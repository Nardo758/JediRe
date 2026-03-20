-- Migration 112: Add supply_risk_scores table
-- Fixes: supply-signal.service.ts calculateSupplyRisk() INSERT on missing table

CREATE TABLE IF NOT EXISTS supply_risk_scores (
  id                         SERIAL PRIMARY KEY,
  trade_area_id              TEXT NOT NULL,
  quarter                    VARCHAR(10) NOT NULL,
  pipeline_units             INTEGER DEFAULT 0,
  weighted_pipeline_units    NUMERIC(10,2) DEFAULT 0,
  existing_units             INTEGER DEFAULT 0,
  supply_risk_score          NUMERIC(5,2) DEFAULT 0,
  risk_level                 VARCHAR(20),
  historical_monthly_absorption NUMERIC(8,2) DEFAULT 0,
  months_to_absorb           NUMERIC(8,2) DEFAULT 0,
  absorption_risk            VARCHAR(20),
  demand_units               INTEGER,
  demand_supply_gap          INTEGER,
  net_market_pressure        VARCHAR(20),
  calculated_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(trade_area_id, quarter)
);

CREATE INDEX IF NOT EXISTS idx_supply_risk_trade_area ON supply_risk_scores(trade_area_id);
CREATE INDEX IF NOT EXISTS idx_supply_risk_quarter ON supply_risk_scores(quarter);

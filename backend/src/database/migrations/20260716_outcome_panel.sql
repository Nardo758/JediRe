-- Migration: Create outcome_panel table
-- This is the #1 missing data structure for the correlation engine.
-- Without paired (leading_metric_at_t, realized_outcome_at_t+lag) observations,
-- no correlation is ever fitted — only hypothesized.
--
-- Design: keyed by submarket × month, vintaged with as_of_date to prevent
-- backtest leakage. Regime-tagged for conditional correlation analysis.
-- Recency-weighted at query time (half-life 42mo), not stored.

CREATE TABLE IF NOT EXISTS outcome_panel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submarket_id TEXT NOT NULL,
  msa_id TEXT,
  period_date DATE NOT NULL,                    -- t: the date of the leading metric snapshot
  as_of_date DATE NOT NULL DEFAULT CURRENT_DATE, -- vintage: when this row was materialized

  -- Regime tagging (breaks: 2020-03 COVID, 2022-03 rate pivot)
  regime_tag TEXT,

  -- ─── Leading metrics at t ──────────────────────────────────────────
  -- These are the predictor variables that lead the realized outcomes

  -- Demand signals
  surge_index NUMERIC,                          -- COR-01: traffic/demand surge composite
  search_momentum NUMERIC,                      -- COR-10: submarket search volume growth
  wage_growth_yoy NUMERIC,                      -- COR-04: BLS QCEW wage growth YoY
  formation_count NUMERIC,                      -- COR-10: Census BFS business formations
  corporate_health_index NUMERIC,               -- M33: employer financial health composite
  sentiment_score NUMERIC,                      -- COR-19: NLP review sentiment delta

  -- Supply signals
  pipeline_pct NUMERIC,                         -- COR-06: pipeline as % of existing stock
  permit_count NUMERIC,                         -- COR-08: building permits issued
  delivery_count NUMERIC,                       -- COR-09: completions/deliveries
  absorption_rate NUMERIC,                      -- COR-07: net absorption / existing stock

  -- Macro signals
  macro_rate NUMERIC,                           -- COR-27: 10yr Treasury rate
  cpi_shelter_yoy NUMERIC,                      -- COR-27: CPI shelter component YoY
  unemployment_rate NUMERIC,                  -- COR-27: unemployment rate

  -- Market condition
  market_rent_growth_yoy NUMERIC,               -- concurrent rent growth (for equilibrium pairings)
  market_vacancy NUMERIC,                       -- concurrent vacancy (for equilibrium pairings)

  -- ─── Realized outcomes at t+lag ───────────────────────────────────
  -- These are the target variables that the leading metrics predict
  -- The lag varies by pairing (e.g., COR-01 needs t+6, COR-08 needs t+24)
  -- All lags are stored so a single row can serve multiple pairings

  -- Rent growth outcomes (COR-01, COR-06)
  rent_growth_t3 NUMERIC,                       -- rent growth at t+3 months
  rent_growth_t6 NUMERIC,                       -- rent growth at t+6 months
  rent_growth_t12 NUMERIC,                      -- rent growth at t+12 months
  rent_growth_t18 NUMERIC,                      -- rent growth at t+18 months

  -- Vacancy outcomes (COR-05)
  vacancy_t2 NUMERIC,                           -- vacancy at t+2 months
  vacancy_t4 NUMERIC,                           -- vacancy at t+4 months
  vacancy_t6 NUMERIC,                           -- vacancy at t+6 months

  -- Cap rate outcomes (COR-08)
  cap_rate_t18 NUMERIC,                         -- cap rate at t+18 months
  cap_rate_t24 NUMERIC,                         -- cap rate at t+24 months
  cap_rate_t30 NUMERIC,                         -- cap rate at t+30 months

  -- Concession outcomes (COR-09)
  concession_t1 NUMERIC,                        -- concession depth at t+1 month
  concession_t3 NUMERIC,                        -- concession depth at t+3 months
  concession_t6 NUMERIC,                        -- concession depth at t+6 months

  -- Absorption outcomes (COR-07 — concurrent, no lag)
  absorption_t0 NUMERIC,                          -- concurrent absorption (same period)

  -- Transaction outcomes (COR-08, COR-27)
  transaction_volume_t6 NUMERIC,                -- transaction count at t+6 months
  transaction_volume_t12 NUMERIC,               -- transaction count at t+12 months

  -- ─── Metadata ────────────────────────────────────────────────────
  data_sources TEXT[],                          -- which tables contributed this row
  confidence_level TEXT CHECK (confidence_level IN ('high', 'medium', 'low')),
  notes TEXT,                                   -- e.g., "interpolated from quarterly"

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  -- Enforce: only one row per (submarket, period, vintage)
  UNIQUE (submarket_id, period_date, as_of_date)
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_outcome_panel_submarket_period
  ON outcome_panel(submarket_id, period_date);
CREATE INDEX IF NOT EXISTS idx_outcome_panel_msa_period
  ON outcome_panel(msa_id, period_date);
CREATE INDEX IF NOT EXISTS idx_outcome_panel_regime
  ON outcome_panel(regime_tag);
CREATE INDEX IF NOT EXISTS idx_outcome_panel_as_of
  ON outcome_panel(as_of_date);
CREATE INDEX IF NOT EXISTS idx_outcome_panel_period
  ON outcome_panel(period_date);

-- Partial index for high-confidence rows (preferred for fitting)
CREATE INDEX IF NOT EXISTS idx_outcome_panel_high_confidence
  ON outcome_panel(submarket_id, period_date)
  WHERE confidence_level = 'high';

-- Partial index for the current vintage (latest as_of for each submarket×period)
-- This is the view most queries should use to avoid backtest leakage
CREATE INDEX IF NOT EXISTS idx_outcome_panel_current_vintage
  ON outcome_panel(submarket_id, period_date, as_of_date DESC);

-- ─── Trigger: auto-update updated_at ───────────────────────────────
CREATE OR REPLACE FUNCTION update_outcome_panel_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_outcome_panel_updated_at ON outcome_panel;
CREATE TRIGGER trg_outcome_panel_updated_at
  BEFORE UPDATE ON outcome_panel
  FOR EACH ROW
  EXECUTE FUNCTION update_outcome_panel_updated_at();

-- ─── Materialized view: current vintage only ───────────────────────
-- This is the safe view for fitting correlations — only the latest as_of
-- per (submarket, period) is included, preventing backtest leakage.
CREATE MATERIALIZED VIEW IF NOT EXISTS outcome_panel_current AS
SELECT DISTINCT ON (submarket_id, period_date)
  *
FROM outcome_panel
ORDER BY submarket_id, period_date, as_of_date DESC;

CREATE UNIQUE INDEX idx_outcome_panel_current_pk
  ON outcome_panel_current(submarket_id, period_date);
CREATE INDEX idx_outcome_panel_current_regime
  ON outcome_panel_current(regime_tag);

-- ─── Refresh function for the materialized view ──────────────────
CREATE OR REPLACE FUNCTION refresh_outcome_panel_current()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY outcome_panel_current;
END;
$$ LANGUAGE plpgsql;

-- ─── Comment for documentation ───────────────────────────────────
COMMENT ON TABLE outcome_panel IS
  'Paired (leading metric, realized outcome) observations for correlation fitting.
   Each row represents a snapshot at time t with leading metrics and outcomes at t+lag.
   Vintaged with as_of_date to prevent backtest leakage.
   Use outcome_panel_current (materialized view) for safe fitting.';

-- Migration: learning_feedback_loop
-- Date: 2026-04-20
-- Description: Tables and infrastructure for self-learning feedback loop.
--              Tracks what the agent assumed vs what actually happened,
--              computes systematic biases, and auto-adjusts future assumptions.

-- ─────────────────────────────────────────────────────────────────────────────
-- Assumption Snapshots: What did we assume at underwriting?
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS assumption_snapshots (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id             UUID        NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  snapshot_type       TEXT        NOT NULL,  -- 'acquisition' | 'reforecast_q1' | 'reforecast_annual'
  snapshot_date       DATE        NOT NULL,
  
  -- Deal context at time of snapshot
  property_name       TEXT,
  state               TEXT,
  msa                 TEXT,
  submarket           TEXT,
  asset_class         TEXT,
  deal_type           TEXT,
  vintage_band        TEXT,
  unit_count          INTEGER,
  
  -- Key assumptions (JSON for flexibility)
  assumptions         JSONB       NOT NULL,
  -- Example structure:
  -- {
  --   "vacancy_pct": { "value": 5.5, "source": "T-12", "confidence": "high" },
  --   "rent_growth_yr1": { "value": 3.2, "source": "market_trend", "confidence": "medium" },
  --   "opex_per_unit": { "value": 4850, "source": "benchmark_p50", "confidence": "high" },
  --   "exit_cap_rate": { "value": 5.25, "source": "broker_om", "confidence": "low" },
  --   "noi_year1": { "value": 1850000, "source": "computed", "confidence": "high" },
  --   "line_items": {
  --     "payroll": { "value": 892, "pct_egi": 8.2, "benchmark_percentile": 55 },
  --     "insurance": { "value": 425, "pct_egi": 3.9, "benchmark_percentile": 72 }
  --   }
  -- }
  
  -- Proforma projections
  projected_noi_year1 NUMERIC,
  projected_noi_year3 NUMERIC,
  projected_noi_year5 NUMERIC,
  projected_irr       NUMERIC,
  projected_exit_value NUMERIC,
  
  -- Agent metadata
  agent_version       TEXT,
  model_used          TEXT,
  confidence_score    NUMERIC,
  
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by          UUID,
  
  CONSTRAINT uq_assumption_snapshot UNIQUE (deal_id, snapshot_type, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_assumption_snapshots_deal 
  ON assumption_snapshots(deal_id, snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_assumption_snapshots_lookup
  ON assumption_snapshots(state, msa, asset_class, deal_type, snapshot_date DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- Actual Performance: What actually happened?
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS actual_performance (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id             UUID        NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  period_type         TEXT        NOT NULL,  -- 'monthly' | 'quarterly' | 'annual'
  period_start        DATE        NOT NULL,
  period_end          DATE        NOT NULL,
  
  -- Actual metrics
  actual_noi          NUMERIC,
  actual_vacancy_pct  NUMERIC,
  actual_rent_per_unit NUMERIC,
  actual_opex_per_unit NUMERIC,
  actual_occupancy_pct NUMERIC,
  
  -- Line item actuals (JSON)
  line_item_actuals   JSONB,
  -- {
  --   "payroll": 925,
  --   "insurance": 480,
  --   "real_estate_taxes": 1250,
  --   ...
  -- }
  
  -- Comparison to projection
  variance_from_projection_pct NUMERIC,  -- vs what we projected for this period
  
  -- Source
  source              TEXT,       -- 'manual' | 'yardi' | 'entrata' | 'appfolio'
  imported_at         TIMESTAMPTZ,
  
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT uq_actual_performance UNIQUE (deal_id, period_type, period_start)
);

CREATE INDEX IF NOT EXISTS idx_actual_performance_deal
  ON actual_performance(deal_id, period_start DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- Assumption Outcomes: Compare assumed vs achieved (the learning signal)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS assumption_outcomes (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id             UUID        NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  snapshot_id         UUID        NOT NULL REFERENCES assumption_snapshots(id) ON DELETE CASCADE,
  
  -- What was assumed
  assumption_name     TEXT        NOT NULL,
  assumed_value       NUMERIC     NOT NULL,
  assumed_source      TEXT,
  assumed_confidence  TEXT,
  
  -- What actually happened
  actual_value        NUMERIC     NOT NULL,
  actual_period       TEXT,       -- 'year1' | 'ttm' | 'month_6'
  actual_source       TEXT,
  
  -- The gap (learning signal)
  gap_absolute        NUMERIC     GENERATED ALWAYS AS (actual_value - assumed_value) STORED,
  gap_pct             NUMERIC     GENERATED ALWAYS AS (
    CASE WHEN assumed_value != 0 
    THEN ((actual_value - assumed_value) / ABS(assumed_value)) * 100 
    ELSE NULL END
  ) STORED,
  gap_direction       TEXT        GENERATED ALWAYS AS (
    CASE 
      WHEN actual_value > assumed_value THEN 'underestimated'
      WHEN actual_value < assumed_value THEN 'overestimated'
      ELSE 'accurate'
    END
  ) STORED,
  
  -- Context for bucketing
  state               TEXT,
  msa                 TEXT,
  asset_class         TEXT,
  deal_type           TEXT,
  vintage_band        TEXT,
  
  -- When computed
  computed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT uq_assumption_outcome UNIQUE (snapshot_id, assumption_name, actual_period)
);

CREATE INDEX IF NOT EXISTS idx_assumption_outcomes_learning
  ON assumption_outcomes(assumption_name, state, msa, asset_class, deal_type);

CREATE INDEX IF NOT EXISTS idx_assumption_outcomes_gap
  ON assumption_outcomes(assumption_name, gap_direction, gap_pct);

-- ─────────────────────────────────────────────────────────────────────────────
-- Learning Adjustments: Systematic corrections derived from outcomes
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS learning_adjustments (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Bucket dimensions
  state               TEXT,
  msa                 TEXT,
  asset_class         TEXT,
  deal_type           TEXT,
  vintage_band        TEXT,
  
  -- What assumption to adjust
  assumption_name     TEXT        NOT NULL,
  
  -- The adjustment
  adjustment_type     TEXT        NOT NULL,  -- 'additive_bps' | 'multiplicative' | 'percentile_shift'
  adjustment_value    NUMERIC     NOT NULL,
  adjustment_direction TEXT       NOT NULL,  -- 'increase' | 'decrease'
  
  -- Supporting statistics
  n_deals             INTEGER     NOT NULL,
  mean_gap_pct        NUMERIC,
  median_gap_pct      NUMERIC,
  stddev_gap_pct      NUMERIC,
  confidence_interval_low  NUMERIC,
  confidence_interval_high NUMERIC,
  
  -- Validity
  min_deals_required  INTEGER     DEFAULT 5,
  is_active           BOOLEAN     DEFAULT true,
  effective_date      DATE        NOT NULL,
  expires_at          DATE,
  
  -- Audit
  computed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_by         UUID,
  approved_at         TIMESTAMPTZ,
  notes               TEXT,
  
  CONSTRAINT uq_learning_adjustment UNIQUE (
    state, msa, asset_class, deal_type, vintage_band, 
    assumption_name, effective_date
  )
);

CREATE INDEX IF NOT EXISTS idx_learning_adjustments_active
  ON learning_adjustments(assumption_name, is_active, effective_date DESC)
  WHERE is_active = true;

-- ─────────────────────────────────────────────────────────────────────────────
-- Model Performance Tracking: How good is the agent over time?
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS model_performance_metrics (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Time window
  period_start        DATE        NOT NULL,
  period_end          DATE        NOT NULL,
  
  -- Model/version
  agent_version       TEXT,
  model_name          TEXT,
  
  -- Accuracy metrics
  assumption_name     TEXT        NOT NULL,
  n_predictions       INTEGER     NOT NULL,
  mean_absolute_error NUMERIC,
  root_mean_sq_error  NUMERIC,
  mean_bias           NUMERIC,    -- Positive = systematically underestimate
  hit_rate_10pct      NUMERIC,    -- % of predictions within 10% of actual
  hit_rate_20pct      NUMERIC,    -- % of predictions within 20% of actual
  
  -- Trend
  bias_trend          TEXT,       -- 'improving' | 'stable' | 'worsening'
  
  computed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT uq_model_performance UNIQUE (
    period_start, period_end, agent_version, assumption_name
  )
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Views for easy querying
-- ─────────────────────────────────────────────────────────────────────────────

-- View: Current learning adjustments by bucket
CREATE OR REPLACE VIEW v_active_learning_adjustments AS
SELECT 
  assumption_name,
  state, msa, asset_class, deal_type, vintage_band,
  adjustment_type,
  adjustment_value,
  adjustment_direction,
  n_deals,
  mean_gap_pct,
  effective_date
FROM learning_adjustments
WHERE is_active = true
  AND (expires_at IS NULL OR expires_at > CURRENT_DATE)
  AND n_deals >= min_deals_required
ORDER BY assumption_name, state, msa, asset_class;

-- View: Recent prediction accuracy
CREATE OR REPLACE VIEW v_recent_prediction_accuracy AS
SELECT 
  assumption_name,
  COUNT(*) as n_predictions,
  AVG(gap_pct) as mean_gap_pct,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY gap_pct) as median_gap_pct,
  STDDEV(gap_pct) as stddev_gap_pct,
  SUM(CASE WHEN ABS(gap_pct) <= 10 THEN 1 ELSE 0 END)::float / COUNT(*) as hit_rate_10pct,
  SUM(CASE WHEN ABS(gap_pct) <= 20 THEN 1 ELSE 0 END)::float / COUNT(*) as hit_rate_20pct,
  SUM(CASE WHEN gap_direction = 'underestimated' THEN 1 ELSE 0 END)::float / COUNT(*) as underestimate_rate
FROM assumption_outcomes
WHERE computed_at > NOW() - INTERVAL '1 year'
GROUP BY assumption_name
ORDER BY n_predictions DESC;

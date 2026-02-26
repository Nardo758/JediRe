-- ============================================================================
-- 043_traffic_engine_v2.sql
-- Traffic Engine v2: Leasing Prediction Engine
-- Extends schema for 7-metric funnel, learning loop, 10-year projections
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────
-- 1. Add v2 funnel columns to traffic_predictions
-- ────────────────────────────────────────────────────────────────────
ALTER TABLE traffic_predictions
  ADD COLUMN IF NOT EXISTS in_person_tours INTEGER,
  ADD COLUMN IF NOT EXISTS applications INTEGER,
  ADD COLUMN IF NOT EXISTS net_leases INTEGER,
  ADD COLUMN IF NOT EXISTS occupancy_pct DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS effective_rent DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS closing_ratio DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS tour_rate DECIMAL(5,4),
  ADD COLUMN IF NOT EXISTS app_rate DECIMAL(5,4),
  ADD COLUMN IF NOT EXISTS lease_rate DECIMAL(5,4),
  ADD COLUMN IF NOT EXISTS model_version_v2 VARCHAR(20) DEFAULT '2.0.0',
  ADD COLUMN IF NOT EXISTS funnel_breakdown JSONB;

-- Add v2 columns to history table too
ALTER TABLE traffic_prediction_history
  ADD COLUMN IF NOT EXISTS in_person_tours INTEGER,
  ADD COLUMN IF NOT EXISTS applications INTEGER,
  ADD COLUMN IF NOT EXISTS net_leases INTEGER,
  ADD COLUMN IF NOT EXISTS occupancy_pct DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS effective_rent DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS closing_ratio DECIMAL(5,2);

-- ────────────────────────────────────────────────────────────────────
-- 2. Learned conversion rates (EMA-calibrated from actuals)
-- ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS traffic_learned_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,

    -- Core conversion rates
    tour_rate DECIMAL(5,4) NOT NULL DEFAULT 0.5600,
    app_rate DECIMAL(5,4) NOT NULL DEFAULT 0.4400,
    lease_rate DECIMAL(5,4) NOT NULL DEFAULT 0.7500,
    renewal_rate DECIMAL(5,4),

    -- Seasonal overrides (JSON: { summer: 0.62, winter: 0.48 })
    tour_rate_seasonal JSONB DEFAULT '{}',
    app_rate_seasonal JSONB DEFAULT '{}',
    lease_rate_seasonal JSONB DEFAULT '{}',

    -- Trend direction
    tour_rate_trend VARCHAR(10) CHECK (tour_rate_trend IN ('rising', 'stable', 'falling')),
    app_rate_trend VARCHAR(10) CHECK (app_rate_trend IN ('rising', 'stable', 'falling')),
    lease_rate_trend VARCHAR(10) CHECK (lease_rate_trend IN ('rising', 'stable', 'falling')),

    -- Learning metadata
    data_weeks INTEGER NOT NULL DEFAULT 0,
    confidence_level VARCHAR(20) DEFAULT 'cold_start'
        CHECK (confidence_level IN ('cold_start', 'early', 'calibrating', 'trained', 'high_fidelity')),

    -- Occupancy + rent tracking
    stabilized_occupancy DECIMAL(5,2),
    effective_rent_growth_rate DECIMAL(6,4),

    -- 52-week seasonal index (normalized traffic multipliers per week)
    seasonal_index JSONB DEFAULT '[]',

    -- Bias detection
    consecutive_same_direction INTEGER DEFAULT 0,
    bias_direction VARCHAR(5) CHECK (bias_direction IN ('over', 'under', NULL)),
    last_bias_correction TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_learned_rates UNIQUE (property_id)
);

-- ────────────────────────────────────────────────────────────────────
-- 3. Extend traffic_validation for full 7-metric funnel
-- ────────────────────────────────────────────────────────────────────
ALTER TABLE traffic_validation
  ADD COLUMN IF NOT EXISTS actual_applications INTEGER,
  ADD COLUMN IF NOT EXISTS actual_occupancy_pct DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS actual_effective_rent DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS actual_closing_ratio DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS actual_move_ins INTEGER,
  ADD COLUMN IF NOT EXISTS actual_move_outs INTEGER,
  ADD COLUMN IF NOT EXISTS actual_concessions DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS actual_market_rent DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS metrics_reported INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS per_metric_errors JSONB,
  ADD COLUMN IF NOT EXISTS mape DECIMAL(6,4),
  ADD COLUMN IF NOT EXISTS calibration_applied BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS calibration_details JSONB;

-- ────────────────────────────────────────────────────────────────────
-- 4. Upload tracking (Excel pipeline history)
-- ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS traffic_upload_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,

    -- Upload metadata
    file_name VARCHAR(255),
    file_size_bytes INTEGER,
    upload_format VARCHAR(30) DEFAULT 'simplified'
        CHECK (upload_format IN ('highlands', 'simplified', 'csv')),

    -- Parsing results
    rows_parsed INTEGER NOT NULL DEFAULT 0,
    rows_valid INTEGER NOT NULL DEFAULT 0,
    rows_invalid INTEGER NOT NULL DEFAULT 0,
    parse_errors JSONB DEFAULT '[]',

    -- Validation results
    week_ending DATE NOT NULL,
    metrics_reported INTEGER NOT NULL DEFAULT 5,
    overall_mape DECIMAL(6,4),
    per_metric_mape JSONB,

    -- Quality checks
    consistency_check VARCHAR(10) CHECK (consistency_check IN ('pass', 'fail', 'skip')),
    outlier_check VARCHAR(10) CHECK (outlier_check IN ('pass', 'fail', 'skip')),
    continuity_check VARCHAR(10) CHECK (continuity_check IN ('pass', 'fail', 'skip')),

    -- Calibration outcome
    calibration_triggered BOOLEAN DEFAULT FALSE,
    rates_adjusted JSONB,

    status VARCHAR(20) NOT NULL DEFAULT 'success'
        CHECK (status IN ('success', 'partial', 'failed', 'rejected')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────────
-- 5. 10-Year projections (cached results)
-- ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS traffic_projections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,

    -- Projection metadata
    projection_date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_units INTEGER NOT NULL,
    horizon_months INTEGER NOT NULL DEFAULT 120,

    -- Granularity-specific data stored as JSONB arrays
    -- Weekly projections: months 1-24 (up to 104 entries)
    weekly_projections JSONB NOT NULL DEFAULT '[]',
    -- Monthly projections: months 25-60 (up to 36 entries)
    monthly_projections JSONB NOT NULL DEFAULT '[]',
    -- Quarterly projections: months 61-120 (up to 24 entries)
    quarterly_projections JSONB NOT NULL DEFAULT '[]',

    -- Summary snapshots
    year1_summary JSONB,   -- { occ, rent, revenue, leases, confidence }
    year3_summary JSONB,
    year5_summary JSONB,
    year10_summary JSONB,

    -- Key outputs for cross-module consumption
    occupancy_trajectory JSONB,       -- Monthly occupancy % for 120 months
    effective_rent_trajectory JSONB,  -- Monthly eff rent for 120 months
    revenue_trajectory JSONB,         -- Monthly gross revenue for 120 months
    lease_up_weeks_to_90 INTEGER,
    lease_up_weeks_to_93 INTEGER,
    lease_up_weeks_to_95 INTEGER,

    -- Seasonal risk windows (weeks where occ dips below threshold)
    seasonal_risk_windows JSONB DEFAULT '[]',

    -- Model inputs used
    model_inputs JSONB,
    model_version VARCHAR(20) DEFAULT '2.0.0',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_traffic_projection UNIQUE (property_id, projection_date)
);

-- ────────────────────────────────────────────────────────────────────
-- 6. Indexes
-- ────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_learned_rates_property
    ON traffic_learned_rates(property_id);
CREATE INDEX IF NOT EXISTS idx_upload_history_property
    ON traffic_upload_history(property_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_projections_property
    ON traffic_projections(property_id, projection_date DESC);

-- ────────────────────────────────────────────────────────────────────
-- 7. Seed default learned rates for multifamily template
--    (SE multifamily baseline from Highlands at Berewick calibration)
-- ────────────────────────────────────────────────────────────────────
-- Note: These will be inserted on first property prediction, not here.
-- The defaults are in trafficLearningService.ts as constants.

-- ────────────────────────────────────────────────────────────────────
-- 8. Update calibration factors with v2 seasonal entries
-- ────────────────────────────────────────────────────────────────────
INSERT INTO traffic_calibration_factors (factor_type, factor_key, multiplier, notes) VALUES
    ('seasonal', 'week_01', 0.20, 'Jan early — lowest traffic'),
    ('seasonal', 'week_13', 0.60, 'Late Mar — spring ramp-up'),
    ('seasonal', 'week_22', 1.50, 'Jun — peak leasing begins'),
    ('seasonal', 'week_26', 1.80, 'Late Jun — peak leasing'),
    ('seasonal', 'week_30', 1.60, 'Late Jul — peak continues'),
    ('seasonal', 'week_35', 1.00, 'Late Aug — post-peak decline'),
    ('seasonal', 'week_40', 0.60, 'Early Oct — fall decline'),
    ('seasonal', 'week_45', 0.30, 'Nov — pre-holiday low'),
    ('seasonal', 'week_50', 0.20, 'Mid Dec — holiday dead zone'),
    ('seasonal', 'week_52', 0.25, 'Late Dec — year end')
ON CONFLICT DO NOTHING;

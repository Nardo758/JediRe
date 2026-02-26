-- ============================================================================
-- 021_traffic_prediction_system.sql
-- Core tables for the Traffic Prediction Engine (trafficPredictionEngine.ts)
-- ============================================================================

-- T-01: Weekly walk-in predictions per property
CREATE TABLE IF NOT EXISTS traffic_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,

    -- Prediction identifiers
    prediction_week INTEGER NOT NULL,
    prediction_year INTEGER NOT NULL,

    -- T-01: Core prediction output
    weekly_walk_ins INTEGER NOT NULL,
    daily_average INTEGER NOT NULL,
    peak_hour_estimate INTEGER,

    -- Prediction breakdown (for explainability)
    physical_traffic_component INTEGER,     -- From ADT + capture rate + generators
    demand_traffic_component INTEGER,       -- From market demand translation
    supply_demand_multiplier DECIMAL(4,2),  -- Adjustment factor
    base_before_adjustment INTEGER,         -- Pre-calibration total

    -- T-02: Physical Traffic Score (0-100)
    physical_traffic_score INTEGER CHECK (physical_traffic_score BETWEEN 0 AND 100),

    -- Temporal patterns
    weekday_avg INTEGER,
    weekend_avg INTEGER,
    weekday_total INTEGER,
    weekend_total INTEGER,
    peak_day VARCHAR(20),
    peak_hour VARCHAR(30),

    -- T-10: Confidence
    confidence_score DECIMAL(4,2),
    confidence_tier VARCHAR(10) CHECK (confidence_tier IN ('High', 'Medium', 'Low')),
    confidence_breakdown JSONB,

    -- Market context
    submarket_id VARCHAR(100),
    foot_traffic_index DECIMAL(6,2),
    supply_demand_ratio DECIMAL(4,2),

    -- Model metadata
    model_version VARCHAR(20) NOT NULL DEFAULT '1.0.0',
    prediction_details JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- One prediction per property per week
    CONSTRAINT uq_traffic_prediction UNIQUE (property_id, prediction_week, prediction_year)
);

-- T-07: Traffic trajectory (time series for trend analysis)
CREATE TABLE IF NOT EXISTS traffic_prediction_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    prediction_week INTEGER NOT NULL,
    prediction_year INTEGER NOT NULL,
    weekly_walk_ins INTEGER NOT NULL,
    physical_traffic_score INTEGER,
    digital_traffic_score INTEGER,
    correlation_signal VARCHAR(20),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Calibration factors (from validation feedback loop)
CREATE TABLE IF NOT EXISTS traffic_calibration_factors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    factor_type VARCHAR(30) NOT NULL CHECK (factor_type IN ('global', 'property_type', 'submarket', 'road_type', 'seasonal')),
    factor_key VARCHAR(100) NOT NULL,
    multiplier DECIMAL(5,3) NOT NULL DEFAULT 1.000,
    sample_size INTEGER DEFAULT 0,
    confidence DECIMAL(4,2) DEFAULT 0.50,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    effective_from DATE DEFAULT CURRENT_DATE,
    effective_until DATE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Validation: user-contributed actual traffic data (T-10 flywheel)
CREATE TABLE IF NOT EXISTS traffic_validation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,

    -- Actual observed data
    actual_weekly_walk_ins INTEGER NOT NULL,
    actual_weekly_tours INTEGER,
    actual_weekly_leases INTEGER,
    observation_week INTEGER NOT NULL,
    observation_year INTEGER NOT NULL,

    -- Comparison to prediction
    predicted_walk_ins INTEGER,
    variance_pct DECIMAL(6,2),          -- (actual - predicted) / predicted * 100
    variance_direction VARCHAR(10),      -- 'over', 'under', 'accurate'

    -- Metadata
    data_source VARCHAR(50) DEFAULT 'user_upload',
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_traffic_validation UNIQUE (property_id, observation_week, observation_year)
);

-- Convenience view: latest prediction per property
CREATE OR REPLACE VIEW latest_traffic_predictions AS
SELECT DISTINCT ON (property_id) *
FROM traffic_predictions
ORDER BY property_id, prediction_year DESC, prediction_week DESC;

-- Convenience view: property traffic intelligence (prediction + actuals)
CREATE OR REPLACE VIEW property_traffic_intelligence AS
SELECT
    tp.*,
    tv.actual_weekly_walk_ins,
    tv.actual_weekly_tours,
    tv.actual_weekly_leases,
    tv.variance_pct,
    tv.variance_direction
FROM latest_traffic_predictions tp
LEFT JOIN traffic_validation tv
    ON tp.property_id = tv.property_id
    AND tp.prediction_week = tv.observation_week
    AND tp.prediction_year = tv.observation_year;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_traffic_pred_property ON traffic_predictions(property_id);
CREATE INDEX IF NOT EXISTS idx_traffic_pred_week ON traffic_predictions(prediction_year, prediction_week);
CREATE INDEX IF NOT EXISTS idx_traffic_history_property ON traffic_prediction_history(property_id, prediction_year DESC, prediction_week DESC);
CREATE INDEX IF NOT EXISTS idx_traffic_validation_property ON traffic_validation(property_id);
CREATE INDEX IF NOT EXISTS idx_traffic_calibration_active ON traffic_calibration_factors(is_active) WHERE is_active = TRUE;

-- Seed default calibration factors
INSERT INTO traffic_calibration_factors (factor_type, factor_key, multiplier, notes) VALUES
    ('global', 'baseline', 1.000, 'Global baseline — no adjustment'),
    ('seasonal', 'winter', 0.85, 'Dec-Feb traffic reduction'),
    ('seasonal', 'spring', 1.15, 'Mar-May traffic boost'),
    ('seasonal', 'summer', 1.10, 'Jun-Aug moderate boost'),
    ('seasonal', 'fall', 1.00, 'Sep-Nov baseline'),
    ('property_type', 'multifamily', 1.00, 'Multifamily baseline'),
    ('property_type', 'retail', 1.20, 'Retail gets more walk-in traffic'),
    ('property_type', 'restaurant', 1.35, 'Restaurants get highest walk-in traffic'),
    ('property_type', 'office', 0.75, 'Office gets less walk-in traffic')
ON CONFLICT DO NOTHING;

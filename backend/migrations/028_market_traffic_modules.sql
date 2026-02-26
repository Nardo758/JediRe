-- ============================================================================
-- 028_market_traffic_modules.sql
-- T-04: Traffic Correlation Signal (2x2 matrix)
-- T-09: Competitive Traffic Share
-- ============================================================================

-- T-04: Correlation signal per property (Hidden Gem / Validated / Hype / Dead Zone)
CREATE TABLE IF NOT EXISTS traffic_correlation_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,

    -- Input scores
    physical_traffic_score INTEGER NOT NULL CHECK (physical_traffic_score BETWEEN 0 AND 100),
    digital_traffic_score INTEGER NOT NULL CHECK (digital_traffic_score BETWEEN 0 AND 100),

    -- T-04: Correlation classification
    correlation_signal VARCHAR(20) NOT NULL CHECK (correlation_signal IN (
        'HIDDEN_GEM',       -- High physical, low digital (OPPORTUNITY)
        'VALIDATED',        -- High physical, high digital (COMPETITIVE)
        'HYPE_CHECK',       -- Low physical, high digital (INVESTIGATE)
        'DEAD_ZONE'         -- Low physical, low digital (AVOID)
    )),

    -- Signal metadata
    physical_percentile DECIMAL(5,2),    -- vs submarket peers
    digital_percentile DECIMAL(5,2),
    divergence_score DECIMAL(5,2),       -- abs(physical - digital) normalized

    -- Strategy implications
    strategy_implication TEXT,            -- AI-generated insight
    recommended_action TEXT,

    -- Context
    submarket_id VARCHAR(100),
    calculation_date DATE NOT NULL DEFAULT CURRENT_DATE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_correlation_signal UNIQUE (property_id, calculation_date)
);

-- T-09: Competitive traffic share within trade area
CREATE TABLE IF NOT EXISTS traffic_competitive_share (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    trade_area_id VARCHAR(100),

    -- Share metrics
    property_walk_ins INTEGER NOT NULL,
    trade_area_total_walk_ins INTEGER NOT NULL,
    traffic_share_pct DECIMAL(5,2) NOT NULL,     -- property / trade_area * 100

    -- Ranking
    rank_in_trade_area INTEGER,
    total_properties_in_area INTEGER,

    -- Benchmarks
    avg_share_pct DECIMAL(5,2),
    above_average BOOLEAN,

    calculation_week INTEGER NOT NULL,
    calculation_year INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_traffic_share UNIQUE (property_id, calculation_week, calculation_year)
);

CREATE INDEX IF NOT EXISTS idx_correlation_property ON traffic_correlation_signals(property_id);
CREATE INDEX IF NOT EXISTS idx_correlation_signal_type ON traffic_correlation_signals(correlation_signal);
CREATE INDEX IF NOT EXISTS idx_traffic_share_property ON traffic_competitive_share(property_id);

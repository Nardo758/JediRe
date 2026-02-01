-- =====================================================
-- Migration 005: Price Agent Tables
-- =====================================================
-- Description: Tables for property valuation and comparative market analysis
-- Created: 2026-01-31
-- =====================================================

-- =====================================================
-- Property Valuations
-- =====================================================

CREATE TABLE property_valuations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Valuation date
    valuation_date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- Estimated values
    estimated_value INTEGER NOT NULL,
    value_low INTEGER,
    value_high INTEGER,
    confidence_score DECIMAL(3, 2), -- 0.00 to 1.00
    
    -- Valuation breakdown
    land_value INTEGER,
    improvement_value INTEGER,
    
    -- Price per unit
    price_per_sqft INTEGER,
    price_per_unit INTEGER,
    price_per_acre INTEGER,
    
    -- Valuation method
    valuation_method VARCHAR(50), -- 'avm', 'comp', 'manual', 'hybrid'
    comparables_used INTEGER,
    
    -- Supporting data
    comps JSONB, -- Array of comparable properties used
    adjustments JSONB, -- Price adjustments made
    valuation_factors JSONB, -- Factors influencing value
    
    -- Market context
    market_appreciation_yoy_pct DECIMAL(5, 2),
    area_median_price INTEGER,
    
    -- Price score
    value_score INTEGER CHECK (value_score BETWEEN 0 AND 100),
    value_rating VARCHAR(20), -- 'undervalued', 'fair', 'overvalued'
    
    -- Data sources
    data_sources TEXT[],
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '7 days')
);

CREATE INDEX idx_valuations_property ON property_valuations(property_id);
CREATE INDEX idx_valuations_date ON property_valuations(valuation_date DESC);
CREATE INDEX idx_valuations_user ON property_valuations(user_id);
CREATE INDEX idx_valuations_rating ON property_valuations(value_rating);

COMMENT ON TABLE property_valuations IS 'Property valuations with comparable analysis';
COMMENT ON COLUMN property_valuations.comps IS 'Array of comparable properties with adjustments';

-- =====================================================
-- Comparable Properties (Comps)
-- =====================================================

CREATE TABLE comparable_sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID REFERENCES properties(id),
    market_id UUID REFERENCES markets(id),
    
    -- Sale details
    sale_date DATE NOT NULL,
    sale_price INTEGER NOT NULL,
    
    -- Property characteristics
    property_type property_type,
    lot_size_sqft INTEGER,
    building_sqft INTEGER,
    bedrooms INTEGER,
    bathrooms DECIMAL(3, 1),
    year_built INTEGER,
    
    -- Location
    location GEOMETRY(Point, 4326) NOT NULL,
    distance_to_subject_ft INTEGER,
    
    -- Quality indicators
    condition_rating INTEGER CHECK (condition_rating BETWEEN 1 AND 5),
    has_pool BOOLEAN DEFAULT FALSE,
    has_garage BOOLEAN DEFAULT FALSE,
    renovation_year INTEGER,
    
    -- Price metrics
    price_per_sqft INTEGER,
    price_per_unit INTEGER,
    
    -- Market context
    days_on_market INTEGER,
    list_price INTEGER,
    sale_to_list_ratio DECIMAL(5, 4),
    
    -- Data source
    data_source VARCHAR(50), -- 'mls', 'public_records', 'api'
    mls_id VARCHAR(100),
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_comps_property ON comparable_sales(property_id);
CREATE INDEX idx_comps_market ON comparable_sales(market_id);
CREATE INDEX idx_comps_location ON comparable_sales USING GIST(location);
CREATE INDEX idx_comps_sale_date ON comparable_sales(sale_date DESC);
CREATE INDEX idx_comps_price ON comparable_sales(sale_price);

COMMENT ON TABLE comparable_sales IS 'Recent sales used for comparative market analysis';

-- =====================================================
-- Price History (Time-Series)
-- =====================================================

CREATE TABLE price_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    market_id UUID REFERENCES markets(id),
    
    -- Event details
    event_date DATE NOT NULL,
    event_timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    event_type VARCHAR(50), -- 'sale', 'listing', 'delisting', 'price_change', 'valuation'
    
    -- Price
    price INTEGER NOT NULL,
    price_per_sqft INTEGER,
    
    -- Change from previous
    price_change_amount INTEGER,
    price_change_pct DECIMAL(5, 2),
    
    -- Context
    listing_status VARCHAR(50),
    days_on_market INTEGER,
    
    -- Source
    data_source VARCHAR(50),
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW()
);

-- Convert to hypertable for efficient time-series queries
SELECT create_hypertable('price_history', 'event_timestamp',
    chunk_time_interval => INTERVAL '3 months',
    if_not_exists => TRUE
);

CREATE INDEX idx_price_history_property ON price_history(property_id, event_date DESC);
CREATE INDEX idx_price_history_market ON price_history(market_id, event_date DESC);
CREATE INDEX idx_price_history_type ON price_history(event_type);

COMMENT ON TABLE price_history IS 'Time-series price changes for properties';

-- =====================================================
-- Market Price Trends
-- =====================================================

CREATE TABLE market_price_trends (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    market_id UUID REFERENCES markets(id),
    
    -- Geographic area
    area_name VARCHAR(255),
    area_boundary GEOMETRY(Polygon, 4326),
    
    -- Time period
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    period_type VARCHAR(20), -- 'week', 'month', 'quarter', 'year'
    
    -- Price metrics
    median_price INTEGER,
    avg_price INTEGER,
    price_per_sqft_median INTEGER,
    
    -- By property type
    sf_median_price INTEGER,
    mf_median_price INTEGER,
    condo_median_price INTEGER,
    
    -- Trends
    price_change_pct DECIMAL(5, 2),
    price_appreciation_yoy_pct DECIMAL(5, 2),
    price_volatility DECIMAL(5, 2),
    
    -- Volume
    total_sales INTEGER,
    
    -- Forecast
    forecast_next_month_pct DECIMAL(5, 2),
    forecast_confidence DECIMAL(3, 2),
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT unique_market_price_trend UNIQUE(market_id, area_name, period_start, period_type)
);

CREATE INDEX idx_price_trends_market ON market_price_trends(market_id);
CREATE INDEX idx_price_trends_period ON market_price_trends(period_start DESC);
CREATE INDEX idx_price_trends_area ON market_price_trends USING GIST(area_boundary);

COMMENT ON TABLE market_price_trends IS 'Aggregated price trends by market and area';

-- =====================================================
-- Automated Valuation Model (AVM) Factors
-- =====================================================

CREATE TABLE avm_factors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    market_id UUID REFERENCES markets(id),
    
    -- Model version
    model_version VARCHAR(50) NOT NULL,
    effective_date DATE NOT NULL,
    
    -- Base factors
    base_price_per_sqft INTEGER,
    
    -- Location multipliers
    location_factors JSONB, -- By neighborhood/zip
    
    -- Property characteristic adjustments
    age_adjustment_per_year DECIMAL(8, 4),
    lot_size_adjustment_per_acre DECIMAL(10, 2),
    bedroom_adjustment INTEGER,
    bathroom_adjustment INTEGER,
    
    -- Condition adjustments
    excellent_condition_multiplier DECIMAL(4, 3),
    good_condition_multiplier DECIMAL(4, 3),
    average_condition_multiplier DECIMAL(4, 3),
    fair_condition_multiplier DECIMAL(4, 3),
    poor_condition_multiplier DECIMAL(4, 3),
    
    -- Feature adjustments
    pool_value INTEGER,
    garage_value_per_car INTEGER,
    recent_renovation_bonus_pct DECIMAL(5, 2),
    
    -- Market trend factor
    monthly_appreciation_factor DECIMAL(6, 5),
    
    -- Model performance
    median_error_pct DECIMAL(5, 2),
    accuracy_score DECIMAL(3, 2),
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_avm_factors_market ON avm_factors(market_id);
CREATE INDEX idx_avm_factors_version ON avm_factors(model_version);
CREATE INDEX idx_avm_factors_date ON avm_factors(effective_date DESC);

COMMENT ON TABLE avm_factors IS 'Factors used in automated valuation model by market';

-- =====================================================
-- Price Analysis Function
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_price_score(
    current_price INTEGER,
    estimated_value INTEGER
)
RETURNS INTEGER AS $$
DECLARE
    price_ratio DECIMAL(5, 4);
    score INTEGER;
BEGIN
    -- Calculate price to value ratio
    price_ratio := current_price::DECIMAL / NULLIF(estimated_value, 0);
    
    -- Score based on how good the deal is
    -- Lower ratio = better deal = higher score
    CASE
        WHEN price_ratio <= 0.80 THEN score := 95; -- 20%+ undervalued
        WHEN price_ratio <= 0.85 THEN score := 90; -- 15-20% undervalued
        WHEN price_ratio <= 0.90 THEN score := 85; -- 10-15% undervalued
        WHEN price_ratio <= 0.95 THEN score := 75; -- 5-10% undervalued
        WHEN price_ratio <= 1.00 THEN score := 60; -- Fair value
        WHEN price_ratio <= 1.05 THEN score := 50; -- Slightly overvalued
        WHEN price_ratio <= 1.10 THEN score := 40; -- 5-10% overvalued
        WHEN price_ratio <= 1.15 THEN score := 30; -- 10-15% overvalued
        WHEN price_ratio <= 1.20 THEN score := 20; -- 15-20% overvalued
        ELSE score := 10; -- 20%+ overvalued
    END CASE;
    
    RETURN score;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_price_score IS 'Calculate opportunity score based on price vs value';

-- =====================================================
-- Continuous Aggregate: Monthly Price Trends
-- =====================================================

CREATE MATERIALIZED VIEW price_monthly_trends
WITH (timescaledb.continuous) AS
SELECT 
    market_id,
    time_bucket('1 month', event_timestamp) AS month,
    COUNT(*) AS transaction_count,
    AVG(price) AS avg_price,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price) AS median_price,
    AVG(price_per_sqft) AS avg_price_per_sqft,
    STDDEV(price) AS price_stddev
FROM price_history
WHERE event_type IN ('sale', 'listing')
GROUP BY market_id, time_bucket('1 month', event_timestamp);

COMMENT ON MATERIALIZED VIEW price_monthly_trends IS 'Monthly price statistics aggregated from price history';

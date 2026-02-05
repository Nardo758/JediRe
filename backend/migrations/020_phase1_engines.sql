-- Migration: 020_phase1_engines.sql
-- Description: Database schema for Phase 1 analysis engines
-- Created: 2026-02-05
-- Engines: Signal Processing, Carrying Capacity, Imbalance Detector

-- ============================================================================
-- SUBMARKETS (Geographic units of analysis)
-- ============================================================================

CREATE TABLE IF NOT EXISTS submarkets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Identity
    name VARCHAR(100) NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(2) NOT NULL,
    
    -- Geography
    geometry GEOMETRY(POLYGON, 4326), -- GeoJSON boundary
    center_lat DECIMAL(10, 8),
    center_lng DECIMAL(11, 8),
    zip_codes TEXT[], -- Array of zip codes
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Unique constraint on city + name
    UNIQUE(city, state, name)
);

CREATE INDEX idx_submarkets_city_state ON submarkets(city, state);
CREATE INDEX idx_submarkets_geometry ON submarkets USING GIST(geometry);

-- ============================================================================
-- MARKET SNAPSHOTS (Point-in-time state)
-- ============================================================================

CREATE TABLE IF NOT EXISTS market_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submarket_id UUID NOT NULL REFERENCES submarkets(id) ON DELETE CASCADE,
    snapshot_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Supply Metrics
    existing_units INTEGER NOT NULL,
    pipeline_units INTEGER DEFAULT 0, -- Under construction
    permitted_units INTEGER DEFAULT 0, -- Approved but not started
    total_supply INTEGER GENERATED ALWAYS AS (existing_units + pipeline_units + permitted_units) STORED,
    available_units INTEGER,
    vacancy_rate DECIMAL(5, 4), -- 0-1 (e.g., 0.0523 = 5.23%)
    
    -- Demand Metrics
    population INTEGER,
    population_growth_rate DECIMAL(5, 4), -- Annual % (e.g., 0.021 = 2.1%)
    net_migration_annual INTEGER,
    employment INTEGER,
    employment_growth_rate DECIMAL(5, 4),
    median_income INTEGER,
    
    -- Market Performance
    avg_rent_studio INTEGER,
    avg_rent_1bed INTEGER,
    avg_rent_2bed INTEGER,
    avg_rent_3bed INTEGER,
    avg_rent_4bed_plus INTEGER,
    avg_rent_overall INTEGER NOT NULL,
    
    absorption_rate INTEGER, -- Units/month
    concessions_pct DECIMAL(5, 4), -- 0-1 (e.g., 0.03 = 3%)
    avg_days_on_market INTEGER,
    
    -- Quality Indicators
    building_class_a_pct DECIMAL(5, 4) DEFAULT 0.33,
    building_class_b_pct DECIMAL(5, 4) DEFAULT 0.45,
    building_class_c_pct DECIMAL(5, 4) DEFAULT 0.22,
    avg_building_age INTEGER,
    amenity_score DECIMAL(3, 1), -- 0-10 composite
    
    -- Unit Mix
    studio_pct DECIMAL(5, 4),
    one_bed_pct DECIMAL(5, 4),
    two_bed_pct DECIMAL(5, 4),
    three_bed_pct DECIMAL(5, 4),
    
    -- ApartmentIQ Intelligence (optional)
    opportunity_score DECIMAL(3, 1), -- 0-10
    negotiation_success_rate DECIMAL(5, 4), -- 0-1
    market_pressure_index DECIMAL(3, 1), -- 0-10
    
    -- Data Quality
    data_sources JSONB NOT NULL DEFAULT '[]'::jsonb,
    confidence DECIMAL(3, 2) NOT NULL DEFAULT 0.80, -- 0-1
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Unique constraint: one snapshot per submarket per day
    UNIQUE(submarket_id, snapshot_date)
);

CREATE INDEX idx_snapshots_submarket ON market_snapshots(submarket_id);
CREATE INDEX idx_snapshots_date ON market_snapshots(snapshot_date DESC);
CREATE INDEX idx_snapshots_submarket_date ON market_snapshots(submarket_id, snapshot_date DESC);

-- ============================================================================
-- MARKET TIMESERIES (Historical trends)
-- ============================================================================

CREATE TABLE IF NOT EXISTS market_timeseries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submarket_id UUID NOT NULL REFERENCES submarkets(id) ON DELETE CASCADE,
    observation_date TIMESTAMP NOT NULL,
    
    -- Rent Timeseries
    effective_rent INTEGER, -- Average rent (after concessions)
    asking_rent INTEGER, -- Listed rent (before concessions)
    
    -- Vacancy & Supply
    vacancy_rate DECIMAL(5, 4),
    total_supply INTEGER,
    available_units INTEGER,
    
    -- Construction Pipeline
    under_construction INTEGER DEFAULT 0,
    permits_issued INTEGER DEFAULT 0,
    
    -- Absorption
    net_absorption INTEGER, -- Units leased in period
    deliveries INTEGER, -- New units delivered
    
    -- Market Signals
    concessions_prevalence DECIMAL(5, 4), -- % of properties offering concessions
    avg_days_on_market INTEGER,
    
    -- ApartmentIQ Intelligence
    avg_opportunity_score DECIMAL(3, 1),
    search_activity_index INTEGER, -- Relative search volume
    application_volume INTEGER,
    
    -- Data Quality
    data_source VARCHAR(50) NOT NULL, -- 'costar', 'apartmentiq', 'census'
    confidence DECIMAL(3, 2) DEFAULT 0.80,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Unique constraint
    UNIQUE(submarket_id, observation_date, data_source)
);

CREATE INDEX idx_timeseries_submarket ON market_timeseries(submarket_id);
CREATE INDEX idx_timeseries_date ON market_timeseries(observation_date DESC);
CREATE INDEX idx_timeseries_submarket_date ON market_timeseries(submarket_id, observation_date DESC);

-- ============================================================================
-- ANALYSIS RESULTS (Cached engine outputs)
-- ============================================================================

CREATE TABLE IF NOT EXISTS analysis_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submarket_id UUID NOT NULL REFERENCES submarkets(id) ON DELETE CASCADE,
    analysis_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Signal Processing Results
    signal_rent_growth_rate DECIMAL(5, 4), -- Annualized (e.g., 0.0609 = 6.09%)
    signal_confidence DECIMAL(3, 2),
    signal_trend_component DECIMAL(10, 2),
    signal_seasonal_component DECIMAL(5, 2),
    signal_noise_level DECIMAL(5, 2),
    
    -- Carrying Capacity Results
    capacity_existing_units INTEGER,
    capacity_potential_units INTEGER,
    capacity_utilization DECIMAL(5, 4), -- 0-1
    capacity_score INTEGER, -- 0-100
    
    -- Imbalance Results
    imbalance_score INTEGER NOT NULL, -- 0-100
    imbalance_verdict VARCHAR(50) NOT NULL, -- 'STRONG_OPPORTUNITY', 'BALANCED', etc.
    imbalance_vacancy_signal DECIMAL(5, 2),
    imbalance_concession_signal DECIMAL(5, 2),
    imbalance_opportunity_signal DECIMAL(5, 2),
    imbalance_rent_growth_signal DECIMAL(5, 2),
    
    -- Recommendations
    recommended_action TEXT,
    key_drivers TEXT[], -- Array of key factors
    
    -- Data Quality
    overall_confidence DECIMAL(3, 2) NOT NULL,
    data_sources_used TEXT[],
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Unique constraint: one analysis per submarket per day
    UNIQUE(submarket_id, analysis_date)
);

CREATE INDEX idx_results_submarket ON analysis_results(submarket_id);
CREATE INDEX idx_results_date ON analysis_results(analysis_date DESC);
CREATE INDEX idx_results_score ON analysis_results(imbalance_score DESC);
CREATE INDEX idx_results_verdict ON analysis_results(imbalance_verdict);

-- ============================================================================
-- PROPERTIES (Individual buildings)
-- ============================================================================

CREATE TABLE IF NOT EXISTS properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submarket_id UUID NOT NULL REFERENCES submarkets(id) ON DELETE CASCADE,
    
    -- Identity
    name VARCHAR(200) NOT NULL,
    address VARCHAR(500) NOT NULL,
    
    -- Location
    lat DECIMAL(10, 8) NOT NULL,
    lng DECIMAL(11, 8) NOT NULL,
    location GEOGRAPHY(POINT, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography) STORED,
    
    -- Supply
    total_units INTEGER NOT NULL,
    available_units INTEGER,
    vacancy_rate DECIMAL(5, 4),
    
    -- Pricing
    rent_studio INTEGER,
    rent_1bed INTEGER,
    rent_2bed INTEGER,
    rent_3bed INTEGER,
    rent_avg INTEGER NOT NULL,
    
    -- Building
    building_class VARCHAR(1) CHECK (building_class IN ('A', 'B', 'C')),
    year_built INTEGER,
    sqft_avg INTEGER,
    
    -- Unit Mix
    studio_pct DECIMAL(5, 4),
    one_bed_pct DECIMAL(5, 4),
    two_bed_pct DECIMAL(5, 4),
    three_bed_pct DECIMAL(5, 4),
    
    -- Amenities
    amenities TEXT[], -- Array of amenity names
    
    -- ApartmentIQ Intelligence
    opportunity_score DECIMAL(3, 1),
    negotiation_success_rate DECIMAL(5, 4),
    concessions_current TEXT,
    days_on_market INTEGER,
    
    -- Ownership
    owner_name VARCHAR(200),
    owner_type VARCHAR(50), -- 'institutional', 'private', 'reit'
    
    -- Data
    data_source VARCHAR(50) NOT NULL, -- 'costar', 'apartmentiq', 'manual'
    confidence_score DECIMAL(3, 2) DEFAULT 0.80,
    last_scraped TIMESTAMP,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_properties_submarket ON properties(submarket_id);
CREATE INDEX idx_properties_location ON properties USING GIST(location);
CREATE INDEX idx_properties_building_class ON properties(building_class);
CREATE INDEX idx_properties_data_source ON properties(data_source);

-- ============================================================================
-- DEVELOPMENT PIPELINE (Future supply)
-- ============================================================================

CREATE TABLE IF NOT EXISTS pipeline_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submarket_id UUID NOT NULL REFERENCES submarkets(id) ON DELETE CASCADE,
    
    -- Identity
    name VARCHAR(200) NOT NULL,
    address VARCHAR(500),
    
    -- Location
    lat DECIMAL(10, 8),
    lng DECIMAL(11, 8),
    
    -- Project Details
    units INTEGER NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('permitted', 'under_construction', 'delivered')),
    estimated_delivery DATE,
    actual_delivery DATE,
    
    -- Financial
    estimated_cost BIGINT,
    developer_name VARCHAR(200),
    
    -- Physical
    building_class VARCHAR(1) CHECK (building_class IN ('A', 'B', 'C')),
    studio_pct DECIMAL(5, 4),
    one_bed_pct DECIMAL(5, 4),
    two_bed_pct DECIMAL(5, 4),
    three_bed_pct DECIMAL(5, 4),
    
    -- Data
    data_source VARCHAR(50) NOT NULL, -- 'costar', 'permit_data', 'news', 'manual'
    confidence DECIMAL(3, 2) DEFAULT 0.70, -- Likelihood of completion
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_pipeline_submarket ON pipeline_projects(submarket_id);
CREATE INDEX idx_pipeline_status ON pipeline_projects(status);
CREATE INDEX idx_pipeline_delivery ON pipeline_projects(estimated_delivery);

-- ============================================================================
-- USER ALERTS (Automated notifications)
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    submarket_id UUID REFERENCES submarkets(id) ON DELETE CASCADE,
    
    -- Alert Configuration
    alert_type VARCHAR(50) NOT NULL, -- 'imbalance_change', 'rent_spike', 'vacancy_high'
    threshold_value DECIMAL(10, 2),
    condition VARCHAR(20) CHECK (condition IN ('above', 'below', 'change')),
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    last_triggered TIMESTAMP,
    trigger_count INTEGER DEFAULT 0,
    
    -- Delivery
    delivery_method VARCHAR(20) DEFAULT 'email' CHECK (delivery_method IN ('email', 'sms', 'webhook')),
    delivery_address VARCHAR(200),
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_alerts_user ON user_alerts(user_id);
CREATE INDEX idx_alerts_submarket ON user_alerts(submarket_id);
CREATE INDEX idx_alerts_active ON user_alerts(is_active) WHERE is_active = true;

-- ============================================================================
-- SYSTEM METADATA (Data quality tracking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS data_quality_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Source
    data_source VARCHAR(50) NOT NULL,
    check_type VARCHAR(50) NOT NULL, -- 'freshness', 'completeness', 'validation'
    
    -- Results
    passed BOOLEAN NOT NULL,
    confidence_score DECIMAL(3, 2),
    issues_found INTEGER DEFAULT 0,
    details JSONB,
    
    -- Timestamps
    checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_quality_logs_source ON data_quality_logs(data_source);
CREATE INDEX idx_quality_logs_date ON data_quality_logs(checked_at DESC);
CREATE INDEX idx_quality_logs_passed ON data_quality_logs(passed);

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Auto-update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER update_submarkets_updated_at BEFORE UPDATE ON submarkets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_snapshots_updated_at BEFORE UPDATE ON market_snapshots
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_properties_updated_at BEFORE UPDATE ON properties
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pipeline_updated_at BEFORE UPDATE ON pipeline_projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_alerts_updated_at BEFORE UPDATE ON user_alerts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SAMPLE DATA (For testing)
-- ============================================================================

-- Insert sample submarket (Atlanta Midtown)
INSERT INTO submarkets (name, city, state, center_lat, center_lng)
VALUES ('Midtown', 'Atlanta', 'GA', 33.7844, -84.3858)
ON CONFLICT (city, state, name) DO NOTHING;

-- ============================================================================
-- GRANTS (Adjust based on your user setup)
-- ============================================================================

-- Grant permissions to application user (adjust as needed)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO your_app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO your_app_user;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE submarkets IS 'Geographic units of analysis (neighborhoods/submarkets)';
COMMENT ON TABLE market_snapshots IS 'Point-in-time market state with supply/demand metrics';
COMMENT ON TABLE market_timeseries IS 'Historical trends for signal processing';
COMMENT ON TABLE analysis_results IS 'Cached outputs from Phase 1 engines';
COMMENT ON TABLE properties IS 'Individual buildings with unit-level data';
COMMENT ON TABLE pipeline_projects IS 'Future supply under construction or permitted';
COMMENT ON TABLE user_alerts IS 'Automated alerts for market changes';
COMMENT ON TABLE data_quality_logs IS 'Data quality monitoring and validation';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

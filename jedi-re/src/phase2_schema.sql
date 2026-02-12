-- Phase 2: Market Intelligence Schema Extensions
-- Adds tables for real-time market data on top of Phase 1 parcel foundation

-- ============================================================================
-- SUBMARKETS DEFINITION
-- ============================================================================

CREATE TABLE submarkets (
    submarket_id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    city TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'GA',
    
    -- Geographic boundary (polygon)
    boundary GEOMETRY(POLYGON, 4326),
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_submarkets_boundary ON submarkets USING GIST(boundary);
CREATE INDEX idx_submarkets_city ON submarkets(city);

COMMENT ON TABLE submarkets IS 'Geographic submarkets for market analysis (e.g., Buckhead, Midtown)';

-- ============================================================================
-- PROPERTIES (Apartment Buildings)
-- ============================================================================

CREATE TABLE properties (
    property_id SERIAL PRIMARY KEY,
    
    -- Basic info
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'GA',
    zip_code TEXT,
    
    -- Geography
    latitude NUMERIC(10, 7),
    longitude NUMERIC(11, 7),
    location GEOMETRY(POINT, 4326),
    
    -- Link to parcel (if matched)
    parcel_id INTEGER REFERENCES parcels(parcel_id),
    
    -- Link to submarket
    submarket_id INTEGER REFERENCES submarkets(submarket_id),
    
    -- Property characteristics
    total_units INTEGER,
    year_built INTEGER,
    stories INTEGER,
    
    -- Amenities (stored as JSONB for flexibility)
    amenities JSONB,
    
    -- Data source tracking
    data_source TEXT NOT NULL,  -- 'apartments.com', 'costar', 'manual', etc.
    external_id TEXT,  -- Source's ID for this property
    last_scraped_at TIMESTAMPTZ,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(data_source, external_id)
);

CREATE INDEX idx_properties_location ON properties USING GIST(location);
CREATE INDEX idx_properties_submarket ON properties(submarket_id);
CREATE INDEX idx_properties_parcel ON properties(parcel_id);
CREATE INDEX idx_properties_data_source ON properties(data_source, external_id);

COMMENT ON TABLE properties IS 'Apartment buildings tracked from scrapers and other sources';

-- ============================================================================
-- RENT OBSERVATIONS (Time Series Data)
-- ============================================================================

CREATE TABLE rent_observations (
    observed_at TIMESTAMPTZ NOT NULL,
    property_id INTEGER NOT NULL REFERENCES properties(property_id) ON DELETE CASCADE,
    unit_type TEXT NOT NULL,  -- 'studio', '1br', '2br', '3br', '4br'
    
    -- Rent data
    asking_rent NUMERIC(10, 2),
    effective_rent NUMERIC(10, 2),  -- After concessions
    
    -- Unit details
    sqft INTEGER,
    floor_plan_name TEXT,
    
    -- Availability
    available_units INTEGER DEFAULT 0,
    total_units INTEGER,
    
    -- Data quality
    data_source TEXT NOT NULL,
    confidence_score NUMERIC(3, 2) DEFAULT 1.0,  -- 0-1, how reliable is this observation
    
    PRIMARY KEY (observed_at, property_id, unit_type)
);

-- Convert to TimescaleDB hypertable for optimized time-series queries
SELECT create_hypertable('rent_observations', 'observed_at', 
    chunk_time_interval => INTERVAL '1 month',
    if_not_exists => TRUE
);

-- Compression for old data (save disk space)
ALTER TABLE rent_observations SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'property_id, unit_type'
);

-- Auto-compress data older than 6 months
SELECT add_compression_policy('rent_observations', INTERVAL '6 months');

-- Indexes for common queries
CREATE INDEX idx_rent_obs_property ON rent_observations(property_id, observed_at DESC);
CREATE INDEX idx_rent_obs_unit_type ON rent_observations(unit_type, observed_at DESC);

COMMENT ON TABLE rent_observations IS 'Time series of rent observations from scrapers';

-- ============================================================================
-- PIPELINE PROJECTS (Under Construction)
-- ============================================================================

CREATE TABLE pipeline_projects (
    project_id SERIAL PRIMARY KEY,
    
    -- Basic info
    name TEXT NOT NULL,
    address TEXT,
    city TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'GA',
    
    -- Geography
    latitude NUMERIC(10, 7),
    longitude NUMERIC(11, 7),
    location GEOMETRY(POINT, 4326),
    
    -- Link to parcel (if matched)
    parcel_id INTEGER REFERENCES parcels(parcel_id),
    
    -- Link to submarket
    submarket_id INTEGER REFERENCES submarkets(submarket_id),
    
    -- Project details
    units INTEGER NOT NULL,
    stories INTEGER,
    project_type TEXT,  -- 'garden', 'mid-rise', 'high-rise', 'mixed-use'
    
    -- Timeline
    status TEXT NOT NULL,  -- 'planned', 'under-construction', 'completed', 'cancelled'
    estimated_delivery DATE,
    actual_delivery DATE,
    construction_start DATE,
    
    -- Financial (if available)
    estimated_cost NUMERIC(12, 2),
    developer TEXT,
    
    -- Data source
    data_source TEXT NOT NULL,  -- 'costar', 'scraper', 'manual', 'permit'
    external_id TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(data_source, external_id)
);

CREATE INDEX idx_pipeline_location ON pipeline_projects USING GIST(location);
CREATE INDEX idx_pipeline_submarket ON pipeline_projects(submarket_id);
CREATE INDEX idx_pipeline_status ON pipeline_projects(status);
CREATE INDEX idx_pipeline_delivery ON pipeline_projects(estimated_delivery);

COMMENT ON TABLE pipeline_projects IS 'Apartment projects in planning or construction';

-- ============================================================================
-- SUBMARKET DEMOGRAPHICS
-- ============================================================================

CREATE TABLE submarket_demographics (
    submarket_id INTEGER NOT NULL REFERENCES submarkets(submarket_id),
    year INTEGER NOT NULL,
    
    -- Population
    population INTEGER,
    households INTEGER,
    avg_household_size NUMERIC(4, 2),
    
    -- Economics
    median_income NUMERIC(10, 2),
    per_capita_income NUMERIC(10, 2),
    poverty_rate NUMERIC(5, 2),
    
    -- Employment
    employment_count INTEGER,
    unemployment_rate NUMERIC(5, 2),
    
    -- Housing
    total_housing_units INTEGER,
    owner_occupied_pct NUMERIC(5, 2),
    renter_occupied_pct NUMERIC(5, 2),
    vacancy_rate NUMERIC(5, 2),
    
    -- Age distribution (JSONB for flexibility)
    age_distribution JSONB,  -- {"18-24": 15.2, "25-34": 22.1, ...}
    
    -- Data source
    data_source TEXT NOT NULL DEFAULT 'census',
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    PRIMARY KEY (submarket_id, year)
);

CREATE INDEX idx_demographics_year ON submarket_demographics(year);

COMMENT ON TABLE submarket_demographics IS 'Demographic data from Census Bureau mapped to submarkets';

-- ============================================================================
-- MARKET SIGNALS (Calculated Metrics)
-- ============================================================================

CREATE TABLE market_signals (
    signal_id SERIAL PRIMARY KEY,
    submarket_id INTEGER NOT NULL REFERENCES submarkets(submarket_id),
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Average rents
    avg_rent_studio NUMERIC(10, 2),
    avg_rent_1br NUMERIC(10, 2),
    avg_rent_2br NUMERIC(10, 2),
    avg_rent_3br NUMERIC(10, 2),
    avg_rent_4br NUMERIC(10, 2),
    
    -- Rent per sqft
    avg_rent_per_sqft NUMERIC(6, 2),
    
    -- Rent growth
    rent_growth_1mo NUMERIC(5, 2),   -- % change
    rent_growth_3mo NUMERIC(5, 2),
    rent_growth_6mo NUMERIC(5, 2),
    rent_growth_12mo NUMERIC(5, 2),
    
    -- Supply
    existing_units INTEGER,
    pipeline_units INTEGER,
    pipeline_units_12mo INTEGER,  -- Delivering in next 12 months
    pipeline_units_24mo INTEGER,
    
    -- Demand indicators
    vacancy_rate NUMERIC(5, 2),
    absorption_rate NUMERIC(10, 2),  -- Units per month
    population_growth NUMERIC(5, 2),  -- Annual %
    
    -- Calculated ratios
    supply_demand_ratio NUMERIC(6, 3),
    months_of_supply NUMERIC(6, 2),
    
    -- Signal processing outputs (from Phase 1 engines)
    smoothed_rent NUMERIC(10, 2),
    trend_direction TEXT,  -- 'up', 'down', 'flat'
    trend_confidence NUMERIC(3, 2),
    
    -- Carrying capacity outputs
    saturation_level NUMERIC(5, 2),  -- 0-100%
    years_to_equilibrium NUMERIC(5, 2),
    
    -- Overall verdict
    market_verdict TEXT,  -- 'STRONG_OPPORTUNITY', 'MODERATE_OPPORTUNITY', etc.
    market_score INTEGER,  -- 0-100
    
    UNIQUE(submarket_id, calculated_at)
);

CREATE INDEX idx_signals_submarket ON market_signals(submarket_id, calculated_at DESC);
CREATE INDEX idx_signals_verdict ON market_signals(market_verdict);

COMMENT ON TABLE market_signals IS 'Calculated market intelligence metrics for each submarket';

-- ============================================================================
-- COMPARATIVE ANALYSIS (Cross-Submarket Comparisons)
-- ============================================================================

CREATE TABLE comparative_metrics (
    analysis_id SERIAL PRIMARY KEY,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Comparison parameters
    submarkets INTEGER[] NOT NULL,  -- Array of submarket_ids
    
    -- Rankings (JSONB for flexibility)
    rent_growth_ranking JSONB,  -- {submarket_id: rank, ...}
    absorption_ranking JSONB,
    supply_pressure_ranking JSONB,
    opportunity_ranking JSONB,
    
    -- Summary stats
    avg_rent_across_markets NUMERIC(10, 2),
    rent_growth_avg NUMERIC(5, 2),
    
    -- Best/worst submarkets
    best_opportunity_id INTEGER REFERENCES submarkets(submarket_id),
    worst_opportunity_id INTEGER REFERENCES submarkets(submarket_id)
);

CREATE INDEX idx_comparative_generated ON comparative_metrics(generated_at DESC);

COMMENT ON TABLE comparative_metrics IS 'Cross-submarket comparative analysis results';

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- Latest market signals per submarket
CREATE VIEW latest_market_signals AS
SELECT DISTINCT ON (submarket_id)
    s.*,
    sm.name as submarket_name,
    sm.city
FROM market_signals s
JOIN submarkets sm ON s.submarket_id = sm.submarket_id
ORDER BY submarket_id, calculated_at DESC;

COMMENT ON VIEW latest_market_signals IS 'Most recent market signals for each submarket';

-- Property counts per submarket
CREATE VIEW submarket_inventory AS
SELECT 
    sm.submarket_id,
    sm.name,
    COUNT(DISTINCT p.property_id) as property_count,
    SUM(p.total_units) as total_units,
    AVG(p.year_built) as avg_year_built
FROM submarkets sm
LEFT JOIN properties p ON sm.submarket_id = p.submarket_id
GROUP BY sm.submarket_id, sm.name;

COMMENT ON VIEW submarket_inventory IS 'Summary of existing inventory per submarket';

-- Pipeline summary per submarket
CREATE VIEW submarket_pipeline AS
SELECT 
    sm.submarket_id,
    sm.name,
    COUNT(*) FILTER (WHERE pp.status = 'under-construction') as under_construction_count,
    SUM(pp.units) FILTER (WHERE pp.status = 'under-construction') as under_construction_units,
    COUNT(*) FILTER (WHERE pp.status = 'planned') as planned_count,
    SUM(pp.units) FILTER (WHERE pp.status = 'planned') as planned_units,
    SUM(pp.units) FILTER (WHERE pp.estimated_delivery < NOW() + INTERVAL '12 months') as delivering_12mo
FROM submarkets sm
LEFT JOIN pipeline_projects pp ON sm.submarket_id = pp.submarket_id
GROUP BY sm.submarket_id, sm.name;

COMMENT ON VIEW submarket_pipeline IS 'Summary of pipeline projects per submarket';

-- Combined market overview
CREATE VIEW market_overview AS
SELECT 
    sm.submarket_id,
    sm.name,
    sm.city,
    inv.total_units as existing_units,
    pip.under_construction_units,
    pip.delivering_12mo,
    sig.avg_rent_2br,
    sig.rent_growth_12mo,
    sig.vacancy_rate,
    sig.market_verdict,
    sig.market_score
FROM submarkets sm
LEFT JOIN submarket_inventory inv ON sm.submarket_id = inv.submarket_id
LEFT JOIN submarket_pipeline pip ON sm.submarket_id = pip.submarket_id
LEFT JOIN latest_market_signals sig ON sm.submarket_id = sig.submarket_id;

COMMENT ON VIEW market_overview IS 'Complete market snapshot for all submarkets';

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to all tables with updated_at
CREATE TRIGGER update_submarkets_updated_at BEFORE UPDATE ON submarkets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_properties_updated_at BEFORE UPDATE ON properties
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pipeline_updated_at BEFORE UPDATE ON pipeline_projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SAMPLE DATA (For Testing)
-- ============================================================================

-- Insert sample submarkets
INSERT INTO submarkets (name, city, state) VALUES
    ('Buckhead', 'Atlanta', 'GA'),
    ('Midtown', 'Atlanta', 'GA'),
    ('Downtown', 'Atlanta', 'GA'),
    ('Brookhaven', 'Atlanta', 'GA'),
    ('Sandy Springs', 'Atlanta', 'GA')
ON CONFLICT (name) DO NOTHING;

-- Grant permissions (adjust as needed)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO jedire_app;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO jedire_app;

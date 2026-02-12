-- JEDI RE Database Schema
-- PostgreSQL + TimescaleDB for timeseries data

-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- ============================================================================
-- CORE ENTITIES
-- ============================================================================

-- Submarkets (geographic trade areas)
CREATE TABLE submarkets (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(2) NOT NULL,
    
    -- Geographic boundary (polygon) - stored as text for now
    boundary TEXT,
    center_lat DECIMAL(10, 8),
    center_lon DECIMAL(11, 8),
    
    -- Demographics
    population INTEGER,
    population_growth_rate DECIMAL(5, 4),  -- e.g., 0.0121 = 1.21%
    median_income DECIMAL(10, 2),
    employment INTEGER,
    employment_growth_rate DECIMAL(5, 4),
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_submarkets_city_state ON submarkets(city, state);


-- Properties (multifamily assets)
CREATE TABLE properties (
    id SERIAL PRIMARY KEY,
    submarket_id INTEGER REFERENCES submarkets(id),
    
    -- Basic info
    name VARCHAR(255) NOT NULL,
    address VARCHAR(500),
    lat DECIMAL(10, 8),
    lon DECIMAL(11, 8),
    
    -- Property details
    total_units INTEGER NOT NULL,
    year_built INTEGER,
    year_renovated INTEGER,
    vintage_class VARCHAR(10),  -- 'A', 'A-', 'B+', 'B', 'B-', 'C'
    
    -- Ownership
    owner_name VARCHAR(255),
    owner_type VARCHAR(50),  -- 'Institutional', 'REIT', 'Private', etc.
    
    -- Status
    status VARCHAR(50) DEFAULT 'Existing',  -- 'Existing', 'Under Construction', 'Planned'
    delivery_date DATE,
    
    -- External IDs
    costar_id VARCHAR(100),
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_properties_submarket ON properties(submarket_id);
CREATE INDEX idx_properties_status ON properties(status);
CREATE INDEX idx_properties_location ON properties(lat, lon);


-- ============================================================================
-- TIMESERIES DATA
-- ============================================================================

-- Rent data (weekly or monthly snapshots)
CREATE TABLE rents_timeseries (
    property_id INTEGER REFERENCES properties(id),
    timestamp TIMESTAMPTZ NOT NULL,
    
    -- Rent by unit type
    studio_avg DECIMAL(10, 2),
    one_bed_avg DECIMAL(10, 2),
    two_bed_avg DECIMAL(10, 2),
    three_bed_avg DECIMAL(10, 2),
    
    -- Weighted average
    weighted_avg DECIMAL(10, 2),
    rent_psf DECIMAL(6, 3),
    
    -- Occupancy signals
    available_units INTEGER,
    total_units INTEGER,
    occupancy_pct DECIMAL(5, 2),
    
    -- Concessions
    concession_weeks INTEGER DEFAULT 0,
    concession_description TEXT,
    
    -- Data source
    source VARCHAR(50),  -- 'Scraper', 'CoStar', 'Manual', etc.
    
    PRIMARY KEY (property_id, timestamp)
);

-- Convert to TimescaleDB hypertable for efficient timeseries queries
SELECT create_hypertable('rents_timeseries', 'timestamp');

CREATE INDEX idx_rents_property ON rents_timeseries(property_id, timestamp DESC);


-- Supply pipeline (units under construction or permitted)
CREATE TABLE supply_pipeline (
    id SERIAL PRIMARY KEY,
    property_id INTEGER REFERENCES properties(id),
    submarket_id INTEGER REFERENCES submarkets(id),
    
    -- Project details
    project_name VARCHAR(255),
    units INTEGER NOT NULL,
    
    -- Timeline
    permit_date DATE,
    construction_start_date DATE,
    estimated_delivery_date DATE,
    actual_delivery_date DATE,
    
    -- Status tracking
    status VARCHAR(50),  -- 'Permitted', 'Under Construction', 'Delivered', 'Cancelled'
    
    -- Source
    source VARCHAR(100),
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_supply_submarket ON supply_pipeline(submarket_id);
CREATE INDEX idx_supply_status ON supply_pipeline(status);
CREATE INDEX idx_supply_delivery ON supply_pipeline(estimated_delivery_date);


-- Traffic proxies (DOT counts, Google Popular Times, etc.)
CREATE TABLE traffic_proxies (
    property_id INTEGER REFERENCES properties(id),
    timestamp TIMESTAMPTZ NOT NULL,
    traffic_type VARCHAR(50),  -- 'DOT_Count', 'Google_Popular', 'Foot_Traffic'
    
    -- Traffic metrics
    traffic_count INTEGER,
    
    -- Location context
    measurement_location VARCHAR(255),  -- "On Main St at intersection"
    distance_from_property_meters INTEGER,
    
    -- Source
    source VARCHAR(100),
    
    PRIMARY KEY (property_id, timestamp, traffic_type)
);

SELECT create_hypertable('traffic_proxies', 'timestamp');


-- Search trends (Google Trends, web traffic, etc.)
CREATE TABLE search_trends (
    id SERIAL PRIMARY KEY,
    submarket_id INTEGER REFERENCES submarkets(id),
    timestamp TIMESTAMPTZ NOT NULL,
    
    -- Search data
    keyword VARCHAR(255),
    search_volume INTEGER,
    interest_score INTEGER,  -- Google Trends 0-100 scale
    
    -- Source
    source VARCHAR(50),  -- 'Google_Trends', 'SpyFu', etc.
    
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_search_submarket ON search_trends(submarket_id, timestamp DESC);


-- ============================================================================
-- SYNTHESIZED SIGNALS (Method Engine Outputs)
-- ============================================================================

-- Demand signals (from Signal Processing + Search Trends)
CREATE TABLE demand_signals (
    id SERIAL PRIMARY KEY,
    submarket_id INTEGER REFERENCES submarkets(id),
    calculated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Signal strength
    signal_strength VARCHAR(20),  -- 'STRONG', 'MODERATE', 'WEAK'
    signal_score INTEGER,  -- 0-100
    confidence DECIMAL(4, 3),  -- 0-1
    
    -- Components
    rent_growth_rate DECIMAL(6, 4),  -- Annualized
    search_trend_change DECIMAL(6, 4),
    migration_annual INTEGER,
    
    -- Method metadata
    method_version VARCHAR(20),
    
    UNIQUE (submarket_id, calculated_at)
);


-- Supply signals (from Carrying Capacity Engine)
CREATE TABLE supply_signals (
    id SERIAL PRIMARY KEY,
    submarket_id INTEGER REFERENCES submarkets(id),
    calculated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Signal strength
    signal_strength VARCHAR(30),  -- 'CRITICALLY_OVERSUPPLIED', etc.
    signal_score INTEGER,  -- 0-100
    confidence DECIMAL(4, 3),
    
    -- Metrics
    demand_capacity INTEGER,
    total_supply INTEGER,
    saturation_pct DECIMAL(6, 2),
    equilibrium_quarters INTEGER,
    
    -- Method metadata
    method_version VARCHAR(20),
    
    UNIQUE (submarket_id, calculated_at)
);


-- Synthesized imbalance signals (combined Demand + Supply)
CREATE TABLE imbalance_signals (
    id SERIAL PRIMARY KEY,
    submarket_id INTEGER REFERENCES submarkets(id),
    calculated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Overall verdict
    verdict VARCHAR(50),  -- 'STRONG_OPPORTUNITY', 'CAUTION', etc.
    composite_score INTEGER,  -- 0-100
    confidence DECIMAL(4, 3),
    
    -- Component references
    demand_signal_id INTEGER REFERENCES demand_signals(id),
    supply_signal_id INTEGER REFERENCES supply_signals(id),
    
    -- Recommendation
    recommendation TEXT,
    
    UNIQUE (submarket_id, calculated_at)
);


-- ============================================================================
-- PARCEL & DEVELOPMENT CAPACITY
-- ============================================================================

-- Parcels (land parcels for potential development)
CREATE TABLE parcels (
    parcel_id SERIAL PRIMARY KEY,
    apn VARCHAR(50) NOT NULL,  -- Assessor's Parcel Number
    address VARCHAR(500),
    
    -- Physical characteristics
    lot_size_sqft DECIMAL(12, 2),
    
    -- Current state
    current_zoning VARCHAR(100),
    current_units INTEGER DEFAULT 0,
    
    -- Geospatial data (PostGIS compatible)
    -- For now using lat/lon; upgrade to PostGIS GEOMETRY type when needed
    coordinates_lat DECIMAL(10, 8),
    coordinates_lon DECIMAL(11, 8),
    
    -- Additional context
    county VARCHAR(100),
    city VARCHAR(100),
    state VARCHAR(2),
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(apn, county, state)
);

CREATE INDEX idx_parcels_apn ON parcels(apn);
CREATE INDEX idx_parcels_location ON parcels(city, state);
CREATE INDEX idx_parcels_zoning ON parcels(current_zoning);
CREATE INDEX idx_parcels_coordinates ON parcels(coordinates_lat, coordinates_lon);


-- Development capacity (analysis results for each parcel)
CREATE TABLE development_capacity (
    id SERIAL PRIMARY KEY,
    parcel_id INTEGER REFERENCES parcels(parcel_id) ON DELETE CASCADE,
    
    -- Capacity analysis results
    maximum_buildable_units INTEGER,
    development_potential VARCHAR(50),  -- 'HIGH', 'MEDIUM', 'LOW', 'NONE'
    confidence_score DECIMAL(4, 3),  -- 0.000 to 1.000
    
    -- Analysis metadata
    analysis_date TIMESTAMPTZ NOT NULL,
    analysis_version VARCHAR(20),  -- Track which algorithm version was used
    
    -- Additional metrics
    buildable_sqft DECIMAL(12, 2),
    estimated_construction_cost DECIMAL(15, 2),
    estimated_land_value DECIMAL(15, 2),
    
    -- Constraints and opportunities
    limiting_factors TEXT[],  -- Array of constraint descriptions
    opportunities TEXT[],  -- Array of opportunity notes
    
    -- Notes
    notes TEXT,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_dev_capacity_parcel ON development_capacity(parcel_id);
CREATE INDEX idx_dev_capacity_date ON development_capacity(analysis_date DESC);
CREATE INDEX idx_dev_capacity_potential ON development_capacity(development_potential);
CREATE INDEX idx_dev_capacity_confidence ON development_capacity(confidence_score DESC);


-- Parcel zoning analysis (detailed zoning calculations and rule applications)
CREATE TABLE parcel_zoning_analysis (
    id SERIAL PRIMARY KEY,
    parcel_id INTEGER REFERENCES parcels(parcel_id) ON DELETE CASCADE,
    development_capacity_id INTEGER REFERENCES development_capacity(id) ON DELETE CASCADE,
    
    -- Zoning rules applied
    zoning_code VARCHAR(100),
    zoning_description TEXT,
    
    -- Density calculations
    base_far DECIMAL(5, 3),  -- Floor Area Ratio
    bonus_far DECIMAL(5, 3),  -- Additional FAR from incentives
    effective_far DECIMAL(5, 3),  -- Total FAR used
    
    max_height_ft DECIMAL(7, 2),
    max_stories INTEGER,
    
    -- Coverage calculations
    lot_coverage_pct DECIMAL(5, 2),
    max_lot_coverage_pct DECIMAL(5, 2),
    
    -- Setback requirements (feet)
    front_setback_ft DECIMAL(6, 2),
    rear_setback_ft DECIMAL(6, 2),
    side_setback_ft DECIMAL(6, 2),
    
    -- Parking requirements
    parking_ratio DECIMAL(5, 3),  -- Spaces per unit
    required_parking_spaces INTEGER,
    
    -- Unit density calculations
    base_units_per_acre DECIMAL(7, 2),
    bonus_units_per_acre DECIMAL(7, 2),
    effective_units_per_acre DECIMAL(7, 2),
    
    -- Affordable housing requirements
    affordable_unit_pct DECIMAL(5, 2),
    required_affordable_units INTEGER,
    
    -- Special conditions
    overlay_zones TEXT[],  -- Array of overlay zone codes
    special_permits_required TEXT[],
    variances_needed TEXT[],
    
    -- Compliance flags
    complies_with_zoning BOOLEAN DEFAULT true,
    requires_rezoning BOOLEAN DEFAULT false,
    
    -- Incentive programs
    eligible_incentives TEXT[],  -- e.g., 'Density Bonus', 'TOD', 'Affordable Housing'
    
    -- Analysis metadata
    analysis_date TIMESTAMPTZ NOT NULL,
    data_source VARCHAR(255),  -- e.g., 'City Planning Dept', 'Zoning Atlas API'
    
    -- Notes and exceptions
    notes TEXT,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_zoning_analysis_parcel ON parcel_zoning_analysis(parcel_id);
CREATE INDEX idx_zoning_analysis_dev_capacity ON parcel_zoning_analysis(development_capacity_id);
CREATE INDEX idx_zoning_analysis_code ON parcel_zoning_analysis(zoning_code);
CREATE INDEX idx_zoning_analysis_date ON parcel_zoning_analysis(analysis_date DESC);
CREATE INDEX idx_zoning_analysis_compliance ON parcel_zoning_analysis(complies_with_zoning, requires_rezoning);


-- Latest development capacity per parcel (view for quick access)
CREATE VIEW latest_parcel_capacity AS
SELECT DISTINCT ON (parcel_id)
    dc.parcel_id,
    p.apn,
    p.address,
    p.lot_size_sqft,
    p.current_zoning,
    p.current_units,
    dc.maximum_buildable_units,
    dc.development_potential,
    dc.confidence_score,
    dc.analysis_date,
    (dc.maximum_buildable_units - p.current_units) AS net_new_units,
    dc.buildable_sqft,
    dc.estimated_construction_cost,
    dc.estimated_land_value
FROM development_capacity dc
JOIN parcels p ON p.parcel_id = dc.parcel_id
ORDER BY parcel_id, analysis_date DESC;


-- ============================================================================
-- USER DATA
-- ============================================================================

-- Users
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    
    -- Auth
    password_hash VARCHAR(255),
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP
);


-- Deal silos (user's tracked deals)
CREATE TABLE deal_silos (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    property_id INTEGER REFERENCES properties(id),
    
    -- Deal info
    deal_name VARCHAR(255),
    status VARCHAR(50),  -- 'Tracking', 'Underwriting', 'LOI', 'Due Diligence', 'Closed', 'Passed'
    
    -- Financials (user input)
    offer_price DECIMAL(15, 2),
    target_irr DECIMAL(5, 2),
    
    -- Notes
    notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_deal_silos_user ON deal_silos(user_id);


-- ============================================================================
-- HELPER VIEWS
-- ============================================================================

-- Latest rents per property
CREATE VIEW latest_rents AS
SELECT DISTINCT ON (property_id)
    property_id,
    timestamp,
    weighted_avg,
    rent_psf,
    occupancy_pct,
    concession_weeks
FROM rents_timeseries
ORDER BY property_id, timestamp DESC;


-- Submarket supply summary
CREATE VIEW submarket_supply_summary AS
SELECT 
    s.id AS submarket_id,
    s.name AS submarket_name,
    COUNT(DISTINCT p.id) AS existing_properties,
    SUM(p.total_units) AS existing_units,
    COUNT(DISTINCT sp.id) FILTER (WHERE sp.status IN ('Under Construction', 'Permitted')) AS pipeline_projects,
    SUM(sp.units) FILTER (WHERE sp.status IN ('Under Construction', 'Permitted')) AS pipeline_units
FROM submarkets s
LEFT JOIN properties p ON p.submarket_id = s.id AND p.status = 'Existing'
LEFT JOIN supply_pipeline sp ON sp.submarket_id = s.id
GROUP BY s.id, s.name;

-- =====================================================
-- Migration 002: Core Tables
-- =====================================================
-- Description: Core platform tables (users, organizations, properties, markets)
-- Created: 2026-01-31
-- =====================================================

-- =====================================================
-- Organizations & Teams
-- =====================================================

CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    subscription_tier subscription_tier NOT NULL DEFAULT 'free',
    subscription_expires_at TIMESTAMP,
    max_users INTEGER DEFAULT 1,
    max_properties INTEGER DEFAULT 100,
    enabled_modules module_type[] DEFAULT ARRAY[]::module_type[],
    
    -- Billing
    stripe_customer_id VARCHAR(100),
    stripe_subscription_id VARCHAR(100),
    
    -- Settings
    settings JSONB DEFAULT '{}',
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_tier ON organizations(subscription_tier);

COMMENT ON TABLE organizations IS 'Organizations/teams using the platform';
COMMENT ON COLUMN organizations.enabled_modules IS 'Array of modules available to this organization';

-- =====================================================
-- Users
-- =====================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Authentication
    email VARCHAR(255) UNIQUE NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE,
    password_hash VARCHAR(255),
    auth_provider VARCHAR(50) DEFAULT 'local', -- local, google, microsoft
    auth_provider_id VARCHAR(255),
    
    -- Profile
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    full_name VARCHAR(255) GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED,
    avatar_url TEXT,
    phone VARCHAR(20),
    
    -- Role & Permissions
    role user_role NOT NULL DEFAULT 'investor',
    is_admin BOOLEAN DEFAULT FALSE,
    is_owner BOOLEAN DEFAULT FALSE,
    
    -- Preferences
    preferred_modules module_type[] DEFAULT ARRAY[]::module_type[],
    notification_settings JSONB DEFAULT '{}',
    ui_preferences JSONB DEFAULT '{}',
    
    -- Last activity
    last_login_at TIMESTAMP,
    last_seen_at TIMESTAMP,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_org ON users(organization_id);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_auth ON users(auth_provider, auth_provider_id);

COMMENT ON TABLE users IS 'Platform users with authentication and profile data';
COMMENT ON COLUMN users.preferred_modules IS 'User''s preferred modules to show by default';

-- =====================================================
-- Markets & Municipalities
-- =====================================================

CREATE TABLE markets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Identification
    name VARCHAR(255) NOT NULL, -- e.g., "Austin, TX"
    slug VARCHAR(100) UNIQUE NOT NULL,
    
    -- Geographic hierarchy
    city VARCHAR(100),
    county VARCHAR(100),
    state_code CHAR(2),
    state_name VARCHAR(100),
    country_code CHAR(2) DEFAULT 'US',
    
    -- Geographic data
    center_point GEOMETRY(Point, 4326),
    boundary GEOMETRY(MultiPolygon, 4326),
    bounding_box GEOMETRY(Polygon, 4326),
    
    -- Market metadata
    population INTEGER,
    median_income INTEGER,
    timezone VARCHAR(50),
    
    -- Data coverage
    has_zoning_data BOOLEAN DEFAULT FALSE,
    has_parcel_data BOOLEAN DEFAULT FALSE,
    has_mls_data BOOLEAN DEFAULT FALSE,
    data_sources JSONB DEFAULT '{}',
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    priority INTEGER DEFAULT 0, -- Higher = more important
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_markets_slug ON markets(slug);
CREATE INDEX idx_markets_state ON markets(state_code);
CREATE INDEX idx_markets_center ON markets USING GIST(center_point);
CREATE INDEX idx_markets_boundary ON markets USING GIST(boundary);
CREATE INDEX idx_markets_active ON markets(is_active) WHERE is_active = TRUE;

COMMENT ON TABLE markets IS 'Cities/municipalities covered by the platform';
COMMENT ON COLUMN markets.priority IS 'Higher priority markets get more frequent updates';

-- =====================================================
-- Properties
-- =====================================================

CREATE TABLE properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    market_id UUID REFERENCES markets(id),
    
    -- Address
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state_code CHAR(2),
    zip_code VARCHAR(10),
    formatted_address TEXT,
    
    -- Geographic data
    location GEOMETRY(Point, 4326) NOT NULL,
    parcel_geometry GEOMETRY(Polygon, 4326),
    
    -- Property details
    property_type property_type,
    lot_size_sqft INTEGER,
    lot_size_acres DECIMAL(10, 4) GENERATED ALWAYS AS (lot_size_sqft / 43560.0) STORED,
    building_sqft INTEGER,
    year_built INTEGER,
    bedrooms INTEGER,
    bathrooms DECIMAL(3, 1),
    units_count INTEGER DEFAULT 1,
    
    -- Parcel data
    parcel_id VARCHAR(100),
    apn VARCHAR(100), -- Assessor's Parcel Number
    legal_description TEXT,
    
    -- Ownership (if known)
    owner_name VARCHAR(255),
    owner_type VARCHAR(50),
    
    -- Market data
    last_sale_date DATE,
    last_sale_price INTEGER,
    assessed_value INTEGER,
    assessed_year INTEGER,
    
    -- MLS data (if listed)
    mls_id VARCHAR(100),
    listing_status VARCHAR(50),
    list_price INTEGER,
    listed_date DATE,
    
    -- Data sources
    data_source VARCHAR(50), -- 'mls', 'regrid', 'assessor', 'manual'
    external_id VARCHAR(100),
    raw_data JSONB DEFAULT '{}',
    
    -- User tracking
    is_tracked BOOLEAN DEFAULT FALSE,
    tracked_by_users UUID[],
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_analyzed_at TIMESTAMP
);

CREATE INDEX idx_properties_market ON properties(market_id);
CREATE INDEX idx_properties_location ON properties USING GIST(location);
CREATE INDEX idx_properties_parcel ON properties USING GIST(parcel_geometry);
CREATE INDEX idx_properties_type ON properties(property_type);
CREATE INDEX idx_properties_tracked ON properties(is_tracked) WHERE is_tracked = TRUE;
CREATE INDEX idx_properties_mls ON properties(mls_id) WHERE mls_id IS NOT NULL;
CREATE INDEX idx_properties_parcel_id ON properties(parcel_id) WHERE parcel_id IS NOT NULL;
CREATE INDEX idx_properties_address ON properties USING GIN(to_tsvector('english', formatted_address));

COMMENT ON TABLE properties IS 'Property records with geographic and market data';
COMMENT ON COLUMN properties.tracked_by_users IS 'Array of user IDs tracking this property';

-- =====================================================
-- Property Analysis Cache
-- =====================================================

CREATE TABLE property_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Analysis parameters
    modules_requested module_type[] NOT NULL,
    
    -- Overall score
    opportunity_score INTEGER CHECK (opportunity_score BETWEEN 0 AND 100),
    opportunity_level opportunity_level,
    
    -- Module scores (denormalized for quick access)
    module_scores JSONB DEFAULT '{}', -- {zoning: 85, supply: 72, ...}
    
    -- Full analysis results
    analysis_results JSONB NOT NULL DEFAULT '{}',
    
    -- Status
    status analysis_status DEFAULT 'pending',
    error_message TEXT,
    
    -- Performance tracking
    processing_time_ms INTEGER,
    
    -- Cache control
    expires_at TIMESTAMP,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

CREATE INDEX idx_analyses_property ON property_analyses(property_id);
CREATE INDEX idx_analyses_user ON property_analyses(user_id);
CREATE INDEX idx_analyses_status ON property_analyses(status);
CREATE INDEX idx_analyses_expires ON property_analyses(expires_at);
CREATE INDEX idx_analyses_score ON property_analyses(opportunity_score);

COMMENT ON TABLE property_analyses IS 'Cached property analysis results from all modules';
COMMENT ON COLUMN property_analyses.expires_at IS 'When this analysis should be refreshed';

-- =====================================================
-- Update Timestamps Trigger
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_markets_updated_at BEFORE UPDATE ON markets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_properties_updated_at BEFORE UPDATE ON properties
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

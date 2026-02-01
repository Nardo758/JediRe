-- JediRe Database Schema
-- Lightweight architecture following LIGHTWEIGHT_ARCHITECTURE.md

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ============================================================================
-- USERS & AUTHENTICATION
-- ============================================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255), -- null for OAuth users
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    avatar_url TEXT,
    
    -- OAuth providers
    google_id VARCHAR(255) UNIQUE,
    oauth_provider VARCHAR(50),
    
    -- Status
    email_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    role VARCHAR(50) DEFAULT 'user', -- user, agent, admin
    
    -- Metadata
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$')
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_google_id ON users(google_id);

-- ============================================================================
-- REFRESH TOKENS (for JWT)
-- ============================================================================

CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(500) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT token_not_expired CHECK (expires_at > NOW())
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token);

-- ============================================================================
-- ZONING DISTRICTS (Lightweight - just boundaries & codes)
-- ============================================================================

CREATE TABLE zoning_district_boundaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    municipality VARCHAR(255) NOT NULL,
    state_code VARCHAR(2) NOT NULL,
    county VARCHAR(100),
    
    district_code VARCHAR(50) NOT NULL,
    district_name VARCHAR(255),
    district_description TEXT,
    
    -- Simplified boundary (for point-in-polygon lookup)
    boundary GEOMETRY(Polygon, 4326) NOT NULL,
    boundary_geojson TEXT, -- Also store as GeoJSON for API responses
    
    -- Metadata
    data_source VARCHAR(100),
    source_url TEXT,
    last_updated TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT unique_district UNIQUE(municipality, state_code, district_code)
);

-- Spatial index for fast point-in-polygon queries
CREATE INDEX idx_boundary_gist ON zoning_district_boundaries USING GIST(boundary);
CREATE INDEX idx_zoning_municipality ON zoning_district_boundaries(municipality, state_code);
CREATE INDEX idx_zoning_district_code ON zoning_district_boundaries(district_code);

-- ============================================================================
-- ZONING RULES (Structured rules per district)
-- ============================================================================

CREATE TABLE zoning_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    district_id UUID NOT NULL REFERENCES zoning_district_boundaries(id) ON DELETE CASCADE,
    
    -- Use regulations
    permitted_uses TEXT[], -- Array of allowed uses
    conditional_uses TEXT[], -- Uses requiring special permit
    prohibited_uses TEXT[],
    
    -- Dimensional standards
    min_lot_size_sqft INTEGER,
    max_density_units_per_acre DECIMAL(10, 2),
    max_coverage_percent DECIMAL(5, 2),
    
    -- Setbacks (feet)
    front_setback_ft DECIMAL(10, 2),
    rear_setback_ft DECIMAL(10, 2),
    side_setback_ft DECIMAL(10, 2),
    
    -- Height limits
    max_height_ft DECIMAL(10, 2),
    max_stories INTEGER,
    
    -- Parking requirements
    parking_spaces_per_unit DECIMAL(5, 2),
    parking_spaces_per_sqft DECIMAL(10, 6),
    
    -- Full code sections (for RAG)
    full_code_text TEXT,
    code_section_number VARCHAR(50),
    
    -- AI embeddings for semantic search
    embedding VECTOR(1536), -- OpenAI ada-002 or similar
    
    -- Metadata
    effective_date DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_zoning_rules_district ON zoning_rules(district_id);

-- ============================================================================
-- PROPERTIES (User-analyzed properties)
-- ============================================================================

CREATE TABLE properties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Address
    address_line1 VARCHAR(255) NOT NULL,
    address_line2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state_code VARCHAR(2) NOT NULL,
    zip_code VARCHAR(10) NOT NULL,
    county VARCHAR(100),
    
    -- Location
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    location GEOGRAPHY(Point, 4326),
    
    -- Zoning
    zoning_district_id UUID REFERENCES zoning_district_boundaries(id),
    zoning_code VARCHAR(50),
    
    -- Property details
    lot_size_sqft INTEGER,
    building_sqft INTEGER,
    year_built INTEGER,
    bedrooms INTEGER,
    bathrooms DECIMAL(3, 1),
    
    -- Current use
    current_use VARCHAR(100),
    property_type VARCHAR(50), -- residential, commercial, mixed-use, vacant
    
    -- External IDs
    apn VARCHAR(100), -- Assessor Parcel Number
    regrid_id VARCHAR(100),
    zillow_id VARCHAR(100),
    
    -- Analysis metadata
    analyzed_by UUID REFERENCES users(id),
    last_analyzed_at TIMESTAMP,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT valid_coordinates CHECK (
        latitude BETWEEN -90 AND 90 AND
        longitude BETWEEN -180 AND 180
    )
);

-- Spatial index for nearby property queries
CREATE INDEX idx_properties_location ON properties USING GIST(location);
CREATE INDEX idx_properties_city_state ON properties(city, state_code);
CREATE INDEX idx_properties_zoning ON properties(zoning_district_id);

-- ============================================================================
-- PROPERTY ANALYSIS RESULTS (Agent insights)
-- ============================================================================

CREATE TABLE property_analyses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    
    -- Analysis type (zoning, supply, cash_flow, etc.)
    agent_type VARCHAR(50) NOT NULL,
    
    -- Results (JSON for flexibility)
    results JSONB NOT NULL,
    
    -- Scores
    opportunity_score INTEGER CHECK (opportunity_score BETWEEN 0 AND 100),
    confidence_score INTEGER CHECK (confidence_score BETWEEN 0 AND 100),
    
    -- Status
    status VARCHAR(50) DEFAULT 'completed', -- pending, completed, failed
    error_message TEXT,
    
    -- Metadata
    analysis_duration_ms INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_analyses_property ON property_analyses(property_id);
CREATE INDEX idx_analyses_user ON property_analyses(user_id);
CREATE INDEX idx_analyses_agent_type ON property_analyses(agent_type);

-- ============================================================================
-- COLLABORATION (Pins, comments, annotations)
-- ============================================================================

CREATE TABLE collaboration_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255),
    owner_id UUID NOT NULL REFERENCES users(id),
    
    -- Session settings
    is_active BOOLEAN DEFAULT TRUE,
    is_public BOOLEAN DEFAULT FALSE,
    share_link VARCHAR(100) UNIQUE,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sessions_owner ON collaboration_sessions(owner_id);
CREATE INDEX idx_sessions_share_link ON collaboration_sessions(share_link);

CREATE TABLE session_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES collaboration_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    role VARCHAR(50) DEFAULT 'viewer', -- owner, editor, viewer
    joined_at TIMESTAMP DEFAULT NOW(),
    last_seen_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT unique_participant UNIQUE(session_id, user_id)
);

CREATE INDEX idx_participants_session ON session_participants(session_id);
CREATE INDEX idx_participants_user ON session_participants(user_id);

CREATE TABLE property_pins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES collaboration_sessions(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    
    -- Pin metadata
    color VARCHAR(20),
    icon VARCHAR(50),
    note TEXT,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_pins_session ON property_pins(session_id);
CREATE INDEX idx_pins_property ON property_pins(property_id);

CREATE TABLE property_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    session_id UUID REFERENCES collaboration_sessions(id) ON DELETE CASCADE,
    
    -- Comment content
    content TEXT NOT NULL,
    parent_comment_id UUID REFERENCES property_comments(id) ON DELETE CASCADE,
    
    -- Mentions
    mentioned_users UUID[],
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_comments_property ON property_comments(property_id);
CREATE INDEX idx_comments_user ON property_comments(user_id);
CREATE INDEX idx_comments_session ON property_comments(session_id);

-- ============================================================================
-- MARKET DATA (Supply agent)
-- ============================================================================

CREATE TABLE market_inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Location
    city VARCHAR(100) NOT NULL,
    state_code VARCHAR(2) NOT NULL,
    zip_code VARCHAR(10),
    
    -- Metrics
    active_listings INTEGER,
    median_price DECIMAL(12, 2),
    avg_days_on_market INTEGER,
    absorption_rate DECIMAL(5, 2),
    
    -- Property type breakdown
    property_type VARCHAR(50),
    
    -- Snapshot date
    snapshot_date DATE NOT NULL,
    
    created_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT unique_market_snapshot UNIQUE(city, state_code, property_type, snapshot_date)
);

CREATE INDEX idx_market_location ON market_inventory(city, state_code);
CREATE INDEX idx_market_date ON market_inventory(snapshot_date DESC);

-- ============================================================================
-- AGENT ORCHESTRATION (Task queue)
-- ============================================================================

CREATE TABLE agent_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Task details
    task_type VARCHAR(50) NOT NULL, -- zoning_analysis, supply_analysis, etc.
    input_data JSONB NOT NULL,
    
    -- Status
    status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed
    progress INTEGER DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
    
    -- Results
    output_data JSONB,
    error_message TEXT,
    
    -- Priority & scheduling
    priority INTEGER DEFAULT 0,
    scheduled_at TIMESTAMP DEFAULT NOW(),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    
    -- Ownership
    user_id UUID REFERENCES users(id),
    
    -- Metadata
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    execution_time_ms INTEGER,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_agent_tasks_status ON agent_tasks(status, priority DESC, scheduled_at);
CREATE INDEX idx_agent_tasks_user ON agent_tasks(user_id);
CREATE INDEX idx_agent_tasks_type ON agent_tasks(task_type);

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_properties_updated_at BEFORE UPDATE ON properties
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_zoning_rules_updated_at BEFORE UPDATE ON zoning_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-update location geography from lat/lng
CREATE OR REPLACE FUNCTION update_property_location()
RETURNS TRIGGER AS $$
BEGIN
    NEW.location = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_property_location_trigger
    BEFORE INSERT OR UPDATE OF latitude, longitude ON properties
    FOR EACH ROW EXECUTE FUNCTION update_property_location();

-- ============================================================================
-- VIEWS (Convenience queries)
-- ============================================================================

-- Properties with zoning info
CREATE VIEW properties_with_zoning AS
SELECT 
    p.*,
    z.district_code,
    z.district_name,
    z.municipality
FROM properties p
LEFT JOIN zoning_district_boundaries z ON p.zoning_district_id = z.id;

-- User statistics
CREATE VIEW user_stats AS
SELECT 
    u.id,
    u.email,
    u.first_name,
    u.last_name,
    COUNT(DISTINCT p.id) as properties_analyzed,
    COUNT(DISTINCT pa.id) as total_analyses,
    COUNT(DISTINCT pc.id) as comments_made,
    MAX(pa.created_at) as last_analysis_at
FROM users u
LEFT JOIN properties p ON p.analyzed_by = u.id
LEFT JOIN property_analyses pa ON pa.user_id = u.id
LEFT JOIN property_comments pc ON pc.user_id = u.id
GROUP BY u.id, u.email, u.first_name, u.last_name;

-- ============================================================================
-- SAMPLE DATA (for testing)
-- ============================================================================

-- Insert sample user
INSERT INTO users (email, password_hash, first_name, last_name, role)
VALUES ('admin@jedire.com', '$2a$10$dummy.hash', 'Admin', 'User', 'admin');

COMMIT;

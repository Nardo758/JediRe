-- =====================================================
-- REPLIT Migration 001: Core Setup (Simplified)
-- =====================================================
-- Description: Simplified PostgreSQL setup for Replit
-- No TimescaleDB, PostGIS, or pgvector required
-- =====================================================

-- Enable basic extensions only
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- =====================================================
-- Custom Types
-- =====================================================

CREATE TYPE user_role AS ENUM (
    'developer',
    'investor',
    'flipper',
    'broker',
    'landlord',
    'commercial',
    'admin'
);

CREATE TYPE subscription_tier AS ENUM (
    'free',
    'professional',
    'team',
    'enterprise'
);

CREATE TYPE property_type AS ENUM (
    'single_family',
    'multi_family',
    'commercial',
    'industrial',
    'land',
    'mixed_use',
    'other'
);

CREATE TYPE module_type AS ENUM (
    'zoning',
    'supply',
    'demand',
    'price',
    'news',
    'event',
    'sf_strategy',
    'development',
    'cash_flow',
    'debt',
    'network',
    'financial_model'
);

CREATE TYPE opportunity_level AS ENUM (
    'high',
    'medium',
    'low',
    'unknown'
);

CREATE TYPE alert_priority AS ENUM (
    'critical',
    'high',
    'medium',
    'low',
    'info'
);

CREATE TYPE analysis_status AS ENUM (
    'pending',
    'processing',
    'completed',
    'failed',
    'expired'
);

-- =====================================================
-- Core Tables
-- =====================================================

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    full_name VARCHAR(255),
    role user_role DEFAULT 'investor',
    subscription_tier subscription_tier DEFAULT 'free',
    enabled_modules module_type[] DEFAULT ARRAY['supply']::module_type[],
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true
);

-- Properties table (simplified without PostGIS)
CREATE TABLE properties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    address VARCHAR(500) NOT NULL,
    city VARCHAR(100),
    state VARCHAR(50),
    zip_code VARCHAR(20),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    property_type property_type,
    year_built INTEGER,
    square_feet INTEGER,
    bedrooms INTEGER,
    bathrooms DECIMAL(3, 1),
    lot_size DECIMAL(12, 2),
    list_price DECIMAL(15, 2),
    assessed_value DECIMAL(15, 2),
    last_sale_price DECIMAL(15, 2),
    last_sale_date DATE,
    zoning_code VARCHAR(50),
    parcel_id VARCHAR(100),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Property tracking (user favorites/watchlist)
CREATE TABLE property_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    notes TEXT,
    tags VARCHAR(50)[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, property_id)
);

-- Supply metrics (simplified time-series without TimescaleDB)
CREATE TABLE supply_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    market VARCHAR(100) NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    total_inventory INTEGER,
    new_listings INTEGER,
    active_listings INTEGER,
    pending_listings INTEGER,
    under_contract INTEGER,
    months_of_supply DECIMAL(5, 2),
    absorption_rate DECIMAL(5, 4),
    avg_days_on_market INTEGER,
    price_reduction_rate DECIMAL(5, 4),
    score DECIMAL(5, 2),
    interpretation VARCHAR(50),
    data_sources VARCHAR(100)[],
    ai_insights TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for time-based queries
CREATE INDEX idx_supply_metrics_market_time ON supply_metrics(market, timestamp DESC);

-- Alerts table
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
    alert_type VARCHAR(100) NOT NULL,
    priority alert_priority DEFAULT 'medium',
    title VARCHAR(255) NOT NULL,
    message TEXT,
    data JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    read_at TIMESTAMPTZ
);

CREATE INDEX idx_alerts_user_created ON alerts(user_id, created_at DESC);

-- Sessions table (for WebSocket tracking)
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    socket_id VARCHAR(255),
    connected_at TIMESTAMPTZ DEFAULT NOW(),
    last_ping_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- Agent runs tracking
CREATE TABLE agent_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_name VARCHAR(100) NOT NULL,
    run_started_at TIMESTAMPTZ DEFAULT NOW(),
    run_completed_at TIMESTAMPTZ,
    status analysis_status DEFAULT 'processing',
    markets_analyzed VARCHAR(100)[],
    successful_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    processing_time_ms INTEGER,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_agent_runs_name_time ON agent_runs(agent_name, run_started_at DESC);

-- =====================================================
-- Functions
-- =====================================================

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update trigger to tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_properties_updated_at BEFORE UPDATE ON properties
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Seed Data
-- =====================================================

-- Create demo user
INSERT INTO users (email, password_hash, full_name, role, subscription_tier, enabled_modules)
VALUES (
    'demo@jedire.com',
    crypt('demo123', gen_salt('bf')),
    'Demo User',
    'investor',
    'professional',
    ARRAY['supply', 'zoning', 'price']::module_type[]
) ON CONFLICT (email) DO NOTHING;

COMMENT ON TABLE users IS 'Application users with role-based access';
COMMENT ON TABLE properties IS 'Real estate properties (simplified without GIS)';
COMMENT ON TABLE supply_metrics IS 'Market supply analysis data';
COMMENT ON TABLE alerts IS 'User notifications and alerts';

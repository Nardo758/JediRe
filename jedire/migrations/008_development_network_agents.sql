-- =====================================================
-- Migration 008: Development & Network Agent Tables
-- =====================================================
-- Description: Tables for development opportunities and property ownership networks
-- Created: 2026-01-31
-- =====================================================

-- =====================================================
-- Development Opportunities
-- =====================================================

CREATE TABLE development_opportunities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    market_id UUID REFERENCES markets(id),
    
    -- Opportunity type
    opportunity_type VARCHAR(50), -- 'new_construction', 'redevelopment', 'addition', 'conversion'
    development_category VARCHAR(50), -- 'residential', 'commercial', 'mixed_use'
    
    -- Current state
    current_use VARCHAR(100),
    current_value INTEGER,
    current_condition VARCHAR(50),
    
    -- Development potential
    max_units_buildable INTEGER,
    max_sqft_buildable INTEGER,
    development_scenarios JSONB, -- Array of different build options
    
    -- Financial estimates
    estimated_construction_cost INTEGER,
    estimated_timeline_months INTEGER,
    estimated_arv INTEGER, -- After Repair Value
    estimated_profit INTEGER,
    profit_margin_pct DECIMAL(5, 2),
    
    -- Returns
    estimated_roi_pct DECIMAL(5, 2),
    estimated_irr_pct DECIMAL(5, 2),
    
    -- Risks & Constraints
    constraints TEXT[],
    risk_factors TEXT[],
    risk_score INTEGER CHECK (risk_score BETWEEN 0 AND 100),
    
    -- Permits & Approvals
    permits_required TEXT[],
    estimated_permit_timeline_months INTEGER,
    permit_difficulty VARCHAR(20), -- 'easy', 'moderate', 'difficult'
    
    -- Market context
    comparable_projects JSONB,
    area_development_activity VARCHAR(50), -- 'very_active', 'active', 'moderate', 'slow'
    
    -- Opportunity score
    development_score INTEGER CHECK (development_score BETWEEN 0 AND 100),
    opportunity_rating VARCHAR(20), -- 'excellent', 'good', 'fair', 'poor'
    
    -- AI analysis
    ai_summary TEXT,
    recommendations TEXT[],
    next_steps TEXT[],
    
    -- Status
    is_tracked BOOLEAN DEFAULT FALSE,
    tracked_by_users UUID[],
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_dev_opportunities_property ON development_opportunities(property_id);
CREATE INDEX idx_dev_opportunities_market ON development_opportunities(market_id);
CREATE INDEX idx_dev_opportunities_type ON development_opportunities(opportunity_type);
CREATE INDEX idx_dev_opportunities_score ON development_opportunities(development_score DESC);
CREATE INDEX idx_dev_opportunities_roi ON development_opportunities(estimated_roi_pct DESC);

COMMENT ON TABLE development_opportunities IS 'Identified development opportunities with feasibility analysis';
COMMENT ON COLUMN development_opportunities.development_scenarios IS 'Different development options (max density, mixed-use, etc.)';

-- =====================================================
-- Construction Cost Estimates
-- =====================================================

CREATE TABLE construction_costs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    market_id UUID REFERENCES markets(id),
    
    -- Cost type
    construction_type VARCHAR(100), -- 'new_sf', 'new_mf', 'renovation', 'addition'
    quality_level VARCHAR(50), -- 'economy', 'standard', 'premium', 'luxury'
    
    -- Costs per square foot
    cost_per_sqft_low INTEGER,
    cost_per_sqft_avg INTEGER,
    cost_per_sqft_high INTEGER,
    
    -- Additional costs
    site_work_per_sqft INTEGER,
    permits_per_sqft INTEGER,
    soft_costs_pct DECIMAL(5, 2),
    contingency_pct DECIMAL(5, 2),
    
    -- Total multiplier
    total_cost_multiplier DECIMAL(5, 3), -- Applied to base cost
    
    -- Market factors
    labor_cost_index INTEGER, -- Relative to national average
    material_cost_index INTEGER,
    
    -- Effective period
    effective_date DATE,
    expires_date DATE,
    
    -- Data source
    data_source VARCHAR(100),
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_construction_costs_market ON construction_costs(market_id);
CREATE INDEX idx_construction_costs_type ON construction_costs(construction_type);
CREATE INDEX idx_construction_costs_date ON construction_costs(effective_date DESC);

COMMENT ON TABLE construction_costs IS 'Construction cost benchmarks by market and building type';

-- =====================================================
-- Permit Activity (Leading Indicator)
-- =====================================================

CREATE TABLE permit_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    market_id UUID REFERENCES markets(id),
    
    -- Location
    location GEOMETRY(Point, 4326),
    address TEXT,
    area_name VARCHAR(255),
    
    -- Permit details
    permit_number VARCHAR(100),
    permit_type VARCHAR(100), -- 'new_construction', 'renovation', 'addition', 'demo'
    permit_category VARCHAR(50), -- 'residential', 'commercial', 'industrial'
    
    -- Project details
    project_description TEXT,
    estimated_cost INTEGER,
    project_sqft INTEGER,
    units_count INTEGER,
    
    -- Dates
    application_date DATE,
    issued_date DATE,
    expiration_date DATE,
    completion_date DATE,
    
    -- Applicant
    applicant_name VARCHAR(255),
    applicant_type VARCHAR(50), -- 'owner', 'developer', 'contractor'
    contractor_name VARCHAR(255),
    
    -- Status
    permit_status VARCHAR(50), -- 'applied', 'under_review', 'issued', 'expired', 'completed'
    
    -- Data source
    data_source VARCHAR(100),
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_permits_market ON permit_activity(market_id);
CREATE INDEX idx_permits_location ON permit_activity USING GIST(location);
CREATE INDEX idx_permits_type ON permit_activity(permit_type);
CREATE INDEX idx_permits_date ON permit_activity(issued_date DESC);
CREATE INDEX idx_permits_status ON permit_activity(permit_status);

COMMENT ON TABLE permit_activity IS 'Building permits as a leading indicator of development activity';

-- =====================================================
-- Network Agent: Property Ownership
-- =====================================================

CREATE TABLE property_owners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Owner details
    owner_name VARCHAR(255) NOT NULL,
    owner_type VARCHAR(50), -- 'individual', 'llc', 'corporation', 'trust', 'reit', 'government'
    legal_entity VARCHAR(255),
    
    -- Contact information (if available)
    mailing_address TEXT,
    email VARCHAR(255),
    phone VARCHAR(20),
    
    -- Classification
    is_institutional BOOLEAN DEFAULT FALSE,
    is_private_equity BOOLEAN DEFAULT FALSE,
    is_foreign_investor BOOLEAN DEFAULT FALSE,
    investor_profile VARCHAR(50), -- 'flipper', 'landlord', 'developer', 'long_term'
    
    -- Portfolio metrics
    total_properties_owned INTEGER DEFAULT 0,
    total_portfolio_value INTEGER,
    avg_hold_period_months INTEGER,
    
    -- Activity metrics
    acquisitions_last_12m INTEGER DEFAULT 0,
    dispositions_last_12m INTEGER DEFAULT 0,
    transaction_velocity VARCHAR(20), -- 'very_active', 'active', 'stable', 'inactive'
    
    -- Investment focus
    preferred_property_types property_type[],
    preferred_markets UUID[], -- Array of market IDs
    avg_acquisition_price INTEGER,
    
    -- Network analysis
    network_connections UUID[], -- IDs of related owners
    partnership_history JSONB,
    
    -- Metadata
    first_acquisition_date DATE,
    last_transaction_date DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_owners_name ON property_owners USING GIN(to_tsvector('english', owner_name));
CREATE INDEX idx_owners_type ON property_owners(owner_type);
CREATE INDEX idx_owners_institutional ON property_owners(is_institutional);
CREATE INDEX idx_owners_profile ON property_owners(investor_profile);
CREATE INDEX idx_owners_activity ON property_owners(transaction_velocity);

COMMENT ON TABLE property_owners IS 'Property owners with portfolio and activity tracking';
COMMENT ON COLUMN property_owners.transaction_velocity IS 'How actively the owner trades properties';

-- =====================================================
-- Property Ownership Records
-- =====================================================

CREATE TABLE property_ownership (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    owner_id UUID REFERENCES property_owners(id),
    
    -- Ownership details
    ownership_start_date DATE,
    ownership_end_date DATE,
    is_current_owner BOOLEAN DEFAULT TRUE,
    
    -- Acquisition
    acquisition_price INTEGER,
    acquisition_method VARCHAR(50), -- 'purchase', 'foreclosure', 'inheritance', 'gift'
    
    -- Ownership structure
    ownership_pct DECIMAL(5, 2) DEFAULT 100.00,
    co_owners JSONB, -- Other owners if partial ownership
    
    -- Financing
    mortgage_amount INTEGER,
    lender_name VARCHAR(255),
    
    -- Disposition (if sold)
    sale_price INTEGER,
    sale_date DATE,
    hold_period_months INTEGER,
    profit_amount INTEGER,
    return_pct DECIMAL(5, 2),
    
    -- Data source
    data_source VARCHAR(100),
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_ownership_property ON property_ownership(property_id);
CREATE INDEX idx_ownership_owner ON property_ownership(owner_id);
CREATE INDEX idx_ownership_current ON property_ownership(is_current_owner) WHERE is_current_owner = TRUE;
CREATE INDEX idx_ownership_dates ON property_ownership(ownership_start_date DESC);

COMMENT ON TABLE property_ownership IS 'Historical ownership records linking properties to owners';

-- =====================================================
-- Owner Networks (Relationships)
-- =====================================================

CREATE TABLE owner_networks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Relationship
    owner_a_id UUID REFERENCES property_owners(id) ON DELETE CASCADE,
    owner_b_id UUID REFERENCES property_owners(id) ON DELETE CASCADE,
    
    -- Connection type
    relationship_type VARCHAR(50), -- 'partnership', 'co_ownership', 'related_entity', 'shared_address'
    relationship_strength DECIMAL(3, 2), -- 0.00 to 1.00
    
    -- Evidence
    shared_properties INTEGER DEFAULT 0,
    shared_transactions INTEGER DEFAULT 0,
    connection_evidence JSONB,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Metadata
    first_connection_date DATE,
    last_connection_date DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT unique_owner_network UNIQUE(owner_a_id, owner_b_id)
);

CREATE INDEX idx_networks_owner_a ON owner_networks(owner_a_id);
CREATE INDEX idx_networks_owner_b ON owner_networks(owner_b_id);
CREATE INDEX idx_networks_strength ON owner_networks(relationship_strength DESC);
CREATE INDEX idx_networks_active ON owner_networks(is_active) WHERE is_active = TRUE;

COMMENT ON TABLE owner_networks IS 'Relationship graph between property owners';

-- =====================================================
-- Transaction Patterns
-- =====================================================

CREATE TABLE transaction_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES property_owners(id),
    market_id UUID REFERENCES markets(id),
    
    -- Time period
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    -- Activity summary
    acquisitions_count INTEGER DEFAULT 0,
    dispositions_count INTEGER DEFAULT 0,
    total_acquired_value INTEGER,
    total_sold_value INTEGER,
    
    -- Preferences
    preferred_property_type property_type,
    avg_acquisition_price INTEGER,
    avg_hold_period_months INTEGER,
    avg_return_pct DECIMAL(5, 2),
    
    -- Strategy indicators
    strategy_type VARCHAR(50), -- 'flip', 'buy_hold', 'development', 'value_add'
    investment_thesis TEXT,
    
    -- Success metrics
    profitable_transactions_pct DECIMAL(5, 2),
    success_score INTEGER CHECK (success_score BETWEEN 0 AND 100),
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_patterns_owner ON transaction_patterns(owner_id);
CREATE INDEX idx_patterns_market ON transaction_patterns(market_id);
CREATE INDEX idx_patterns_period ON transaction_patterns(period_start DESC);
CREATE INDEX idx_patterns_strategy ON transaction_patterns(strategy_type);

COMMENT ON TABLE transaction_patterns IS 'Analyzed transaction patterns and investor strategies';

-- =====================================================
-- Update Timestamps Trigger
-- =====================================================

CREATE TRIGGER update_dev_opportunities_updated_at BEFORE UPDATE ON development_opportunities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_construction_costs_updated_at BEFORE UPDATE ON construction_costs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_property_owners_updated_at BEFORE UPDATE ON property_owners
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_property_ownership_updated_at BEFORE UPDATE ON property_ownership
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

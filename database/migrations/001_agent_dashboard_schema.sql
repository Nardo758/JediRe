-- =====================================================
-- AGENT DASHBOARD DATABASE SCHEMA
-- Migration: 001_agent_dashboard_schema
-- Created: 2024-02-04
-- Description: Initial schema for Agent CRM Dashboard
-- =====================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- TABLE: agent_clients
-- Purpose: Store client information for real estate agents
-- =====================================================
CREATE TABLE IF NOT EXISTS agent_clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Basic Information
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone_number VARCHAR(50),
  alternate_phone VARCHAR(50),
  
  -- Contact Details
  mailing_address VARCHAR(500),
  city VARCHAR(100),
  state VARCHAR(50),
  zip_code VARCHAR(20),
  
  -- Client Status & Type
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  client_type VARCHAR(50) NOT NULL DEFAULT 'buyer',
  priority VARCHAR(20) DEFAULT 'medium',
  
  -- Preferences
  preferred_contact_method VARCHAR(50) DEFAULT 'email',
  best_time_to_contact VARCHAR(100),
  communication_preferences JSONB DEFAULT '{}',
  
  -- Buyer/Seller Preferences
  search_criteria JSONB DEFAULT '{}',
  
  -- Agent Assignment
  assigned_agent_id UUID,
  assigned_agent_name VARCHAR(255),
  referral_source VARCHAR(255),
  
  -- Financial Info
  pre_approval_status VARCHAR(50),
  pre_approval_amount DECIMAL(12, 2),
  pre_approval_date TIMESTAMP,
  lender_name VARCHAR(255),
  lender_contact VARCHAR(255),
  
  -- Additional Info
  tags JSONB DEFAULT '[]',
  notes TEXT,
  avatar_url TEXT,
  date_of_birth TIMESTAMP,
  occupation VARCHAR(255),
  
  -- Timestamps
  first_contact_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_contact_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for agent_clients
CREATE INDEX idx_agent_clients_email ON agent_clients(email);
CREATE INDEX idx_agent_clients_status ON agent_clients(status);
CREATE INDEX idx_agent_clients_assigned_agent ON agent_clients(assigned_agent_id);
CREATE INDEX idx_agent_clients_created_at ON agent_clients(created_at);
CREATE INDEX idx_agent_clients_client_type ON agent_clients(client_type);

-- =====================================================
-- TABLE: agent_commission_templates
-- Purpose: Store reusable commission calculation templates
-- NOTE: Created before agent_deals because of FK dependency
-- =====================================================
CREATE TABLE IF NOT EXISTS agent_commission_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Template Identification
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  
  -- Commission Structure
  commission_type VARCHAR(50) NOT NULL DEFAULT 'percentage',
  
  -- Percentage-based
  buyer_agent_rate DECIMAL(5, 2),
  listing_agent_rate DECIMAL(5, 2),
  
  -- Flat Fee
  flat_fee DECIMAL(12, 2),
  
  -- Tiered Structure
  tiers JSONB DEFAULT '[]',
  
  -- Split Structure
  agent_split DECIMAL(5, 2) DEFAULT 100.00,
  brokerage_split DECIMAL(5, 2) DEFAULT 0.00,
  
  -- Additional Fees
  transaction_fee DECIMAL(10, 2),
  additional_fees JSONB DEFAULT '[]',
  
  -- Calculation Rules
  calculation_rules JSONB DEFAULT '{}',
  
  -- Property Type Restrictions
  applicable_property_types JSONB DEFAULT '[]',
  applicable_deal_types JSONB DEFAULT '[]',
  price_range JSONB DEFAULT '{}',
  
  -- Usage Tracking
  times_used INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for agent_commission_templates
CREATE INDEX idx_agent_commission_templates_name ON agent_commission_templates(name);
CREATE INDEX idx_agent_commission_templates_is_default ON agent_commission_templates(is_default);
CREATE INDEX idx_agent_commission_templates_is_active ON agent_commission_templates(is_active);

-- =====================================================
-- TABLE: agent_deals
-- Purpose: Track real estate deals through the pipeline
-- =====================================================
CREATE TABLE IF NOT EXISTS agent_deals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Deal Identification
  deal_name VARCHAR(255) NOT NULL,
  deal_number VARCHAR(100) UNIQUE,
  
  -- Client & Property Info
  client_id UUID NOT NULL,
  property_address VARCHAR(500) NOT NULL,
  property_city VARCHAR(100),
  property_state VARCHAR(50),
  property_zip_code VARCHAR(20),
  property_type VARCHAR(100),
  
  -- Deal Details
  deal_type VARCHAR(50) NOT NULL DEFAULT 'purchase',
  deal_stage VARCHAR(50) NOT NULL DEFAULT 'lead',
  deal_status VARCHAR(50) NOT NULL DEFAULT 'active',
  
  -- Financial Information
  listing_price DECIMAL(12, 2),
  offer_price DECIMAL(12, 2),
  final_price DECIMAL(12, 2),
  
  -- Commission Tracking
  commission_rate DECIMAL(5, 2),
  commission_amount DECIMAL(12, 2),
  commission_split DECIMAL(5, 2),
  estimated_commission DECIMAL(12, 2),
  actual_commission DECIMAL(12, 2),
  commission_paid BOOLEAN DEFAULT false,
  commission_paid_date TIMESTAMP,
  commission_template_id UUID,
  
  -- Co-Agent/Split Info
  co_agent VARCHAR(255),
  co_agent_brokerage VARCHAR(255),
  referral_fee DECIMAL(12, 2),
  
  -- Important Dates
  listing_date TIMESTAMP,
  offer_date TIMESTAMP,
  contract_date TIMESTAMP,
  inspection_date TIMESTAMP,
  appraisal_date TIMESTAMP,
  closing_date TIMESTAMP,
  expected_close_date TIMESTAMP,
  
  -- Additional Details
  mls_number VARCHAR(100),
  loan_type VARCHAR(100),
  contingencies JSONB DEFAULT '[]',
  documents JSONB DEFAULT '[]',
  
  -- Workflow & Management
  probability INTEGER DEFAULT 50,
  days_in_stage INTEGER DEFAULT 0,
  next_action TEXT,
  next_action_date TIMESTAMP,
  notes TEXT,
  tags JSONB DEFAULT '[]',
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  closed_at TIMESTAMP,
  
  -- Foreign Keys
  CONSTRAINT fk_agent_deals_client FOREIGN KEY (client_id) 
    REFERENCES agent_clients(id) ON DELETE CASCADE,
  CONSTRAINT fk_agent_deals_commission_template FOREIGN KEY (commission_template_id) 
    REFERENCES agent_commission_templates(id) ON DELETE SET NULL
);

-- Indexes for agent_deals
CREATE INDEX idx_agent_deals_client ON agent_deals(client_id);
CREATE INDEX idx_agent_deals_stage ON agent_deals(deal_stage);
CREATE INDEX idx_agent_deals_status ON agent_deals(deal_status);
CREATE INDEX idx_agent_deals_closing_date ON agent_deals(closing_date);
CREATE INDEX idx_agent_deals_expected_close_date ON agent_deals(expected_close_date);
CREATE INDEX idx_agent_deals_created_at ON agent_deals(created_at);
CREATE INDEX idx_agent_deals_deal_type ON agent_deals(deal_type);

-- =====================================================
-- TABLE: agent_leads
-- Purpose: Capture and track lead sources and conversion
-- =====================================================
CREATE TABLE IF NOT EXISTS agent_leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Basic Lead Info
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255),
  phone_number VARCHAR(50),
  
  -- Lead Source & Tracking
  source VARCHAR(100) NOT NULL,
  source_details VARCHAR(255),
  medium VARCHAR(100),
  campaign VARCHAR(255),
  
  -- Lead Status & Quality
  status VARCHAR(50) NOT NULL DEFAULT 'new',
  lead_quality VARCHAR(50) DEFAULT 'unknown',
  lead_score INTEGER DEFAULT 0,
  
  -- Interest & Intent
  interested_in VARCHAR(50) DEFAULT 'buying',
  property_types JSONB DEFAULT '[]',
  price_range JSONB DEFAULT '{}',
  locations JSONB DEFAULT '[]',
  timeframe VARCHAR(100),
  
  -- Follow-up & Engagement
  follow_up_status VARCHAR(50) DEFAULT 'pending',
  follow_up_date TIMESTAMP,
  last_contact_date TIMESTAMP,
  next_contact_date TIMESTAMP,
  contact_attempts INTEGER DEFAULT 0,
  
  -- Assignment & Conversion
  assigned_agent_id UUID,
  assigned_agent_name VARCHAR(255),
  converted_to_client_id UUID,
  converted_at TIMESTAMP,
  
  -- Additional Info
  notes TEXT,
  tags JSONB DEFAULT '[]',
  custom_fields JSONB DEFAULT '{}',
  
  -- Timestamps
  captured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Foreign Keys
  CONSTRAINT fk_agent_leads_converted_client FOREIGN KEY (converted_to_client_id) 
    REFERENCES agent_clients(id) ON DELETE SET NULL
);

-- Indexes for agent_leads
CREATE INDEX idx_agent_leads_email ON agent_leads(email);
CREATE INDEX idx_agent_leads_status ON agent_leads(status);
CREATE INDEX idx_agent_leads_source ON agent_leads(source);
CREATE INDEX idx_agent_leads_follow_up_date ON agent_leads(follow_up_date);
CREATE INDEX idx_agent_leads_assigned_agent ON agent_leads(assigned_agent_id);
CREATE INDEX idx_agent_leads_captured_at ON agent_leads(captured_at);
CREATE INDEX idx_agent_leads_lead_quality ON agent_leads(lead_quality);

-- =====================================================
-- TABLE: agent_activities
-- Purpose: Activity log for tracking interactions
-- =====================================================
CREATE TABLE IF NOT EXISTS agent_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Activity Type & Description
  activity_type VARCHAR(50) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Related Entities
  client_id UUID,
  deal_id UUID,
  lead_id UUID,
  
  -- Activity Details
  direction VARCHAR(20),
  duration INTEGER,
  outcome VARCHAR(100),
  
  -- Agent & Participants
  performed_by_agent_id UUID,
  performed_by_agent_name VARCHAR(255),
  participants JSONB DEFAULT '[]',
  
  -- Status & Scheduling
  status VARCHAR(50) DEFAULT 'completed',
  scheduled_at TIMESTAMP,
  completed_at TIMESTAMP,
  
  -- Location (for meetings/showings)
  location VARCHAR(500),
  property_address VARCHAR(500),
  
  -- Task Management
  priority VARCHAR(20) DEFAULT 'medium',
  due_date TIMESTAMP,
  is_completed BOOLEAN DEFAULT false,
  
  -- Follow-up
  requires_follow_up BOOLEAN DEFAULT false,
  follow_up_date TIMESTAMP,
  follow_up_notes TEXT,
  
  -- Additional Info
  attachments JSONB DEFAULT '[]',
  tags JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Foreign Keys
  CONSTRAINT fk_agent_activities_client FOREIGN KEY (client_id) 
    REFERENCES agent_clients(id) ON DELETE CASCADE,
  CONSTRAINT fk_agent_activities_deal FOREIGN KEY (deal_id) 
    REFERENCES agent_deals(id) ON DELETE CASCADE,
  CONSTRAINT fk_agent_activities_lead FOREIGN KEY (lead_id) 
    REFERENCES agent_leads(id) ON DELETE CASCADE
);

-- Indexes for agent_activities
CREATE INDEX idx_agent_activities_client ON agent_activities(client_id);
CREATE INDEX idx_agent_activities_deal ON agent_activities(deal_id);
CREATE INDEX idx_agent_activities_lead ON agent_activities(lead_id);
CREATE INDEX idx_agent_activities_type ON agent_activities(activity_type);
CREATE INDEX idx_agent_activities_status ON agent_activities(status);
CREATE INDEX idx_agent_activities_scheduled_at ON agent_activities(scheduled_at);
CREATE INDEX idx_agent_activities_due_date ON agent_activities(due_date);
CREATE INDEX idx_agent_activities_created_at ON agent_activities(created_at);

-- =====================================================
-- TRIGGERS FOR AUTOMATIC TIMESTAMP UPDATES
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to all tables with updated_at
CREATE TRIGGER update_agent_clients_updated_at BEFORE UPDATE ON agent_clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_deals_updated_at BEFORE UPDATE ON agent_deals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_leads_updated_at BEFORE UPDATE ON agent_leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_activities_updated_at BEFORE UPDATE ON agent_activities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_commission_templates_updated_at BEFORE UPDATE ON agent_commission_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- INITIAL DATA - DEFAULT COMMISSION TEMPLATES
-- =====================================================

-- Standard 6% Commission Split (3% each side)
INSERT INTO agent_commission_templates (
  name, 
  description, 
  is_default, 
  commission_type, 
  buyer_agent_rate, 
  listing_agent_rate, 
  agent_split
) VALUES (
  'Standard 6% (3%/3% Split)',
  'Standard real estate commission with 3% to buyer agent and 3% to listing agent',
  true,
  'percentage',
  3.00,
  3.00,
  100.00
) ON CONFLICT DO NOTHING;

-- Buyer Agent 2.5%
INSERT INTO agent_commission_templates (
  name, 
  description, 
  commission_type, 
  buyer_agent_rate, 
  agent_split
) VALUES (
  'Buyer Agent 2.5%',
  'Standard buyer agent commission at 2.5%',
  false,
  'percentage',
  2.5,
  100.00
) ON CONFLICT DO NOTHING;

-- Listing Agent 5%
INSERT INTO agent_commission_templates (
  name, 
  description, 
  commission_type, 
  listing_agent_rate, 
  agent_split
) VALUES (
  'Listing Agent 5%',
  'Premium listing agent commission at 5%',
  false,
  'percentage',
  5.00,
  100.00
) ON CONFLICT DO NOTHING;

-- Flat Fee $5000
INSERT INTO agent_commission_templates (
  name, 
  description, 
  commission_type, 
  flat_fee
) VALUES (
  'Flat Fee $5,000',
  'Fixed flat fee commission of $5,000',
  false,
  'flat_fee',
  5000.00
) ON CONFLICT DO NOTHING;

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE agent_clients IS 'Stores client information for real estate agents including contact details, preferences, and financial qualifications';
COMMENT ON TABLE agent_deals IS 'Tracks real estate transactions through the entire pipeline from lead to closing';
COMMENT ON TABLE agent_leads IS 'Captures and manages leads from various sources with conversion tracking';
COMMENT ON TABLE agent_activities IS 'Activity log for all interactions with clients, deals, and leads';
COMMENT ON TABLE agent_commission_templates IS 'Reusable commission calculation templates for different deal structures';

-- =====================================================
-- GRANT PERMISSIONS (adjust as needed for your setup)
-- =====================================================

-- Example: Grant permissions to your application user
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO your_app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO your_app_user;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

-- Migration 138: Smoke test fixes — add missing columns and tables

-- Add stage column to deals (used by jedi-score and proforma-adjustment services)
ALTER TABLE deals ADD COLUMN IF NOT EXISTS stage VARCHAR(30) DEFAULT 'prospect';
ALTER TABLE deals ADD COLUMN IF NOT EXISTS pipeline_stage VARCHAR(30) DEFAULT 'prospect';

-- Create supply_delivery_timeline table (used by supply.routes.ts)
CREATE TABLE IF NOT EXISTS supply_delivery_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_area_id INTEGER NOT NULL,
  unit_type VARCHAR(50),
  quarter VARCHAR(10),
  units_expected INTEGER DEFAULT 0,
  units_delivered INTEGER DEFAULT 0,
  project_name VARCHAR(255),
  developer VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add latitude/longitude to properties if missing (used by supply competitive route)
ALTER TABLE properties ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- Create traffic_counts table (used by traffic routes)
CREATE TABLE IF NOT EXISTS traffic_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID,
  context_type VARCHAR(50) DEFAULT 'property',
  context_id UUID,
  count_date DATE,
  aadt INTEGER,
  source VARCHAR(100),
  direction VARCHAR(50),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create zoning_verification_cases table (used by zoning-verification routes)
CREATE TABLE IF NOT EXISTS zoning_verification_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  property_id UUID,
  zoning_district_id INTEGER,
  status VARCHAR(30) DEFAULT 'pending',
  verification_type VARCHAR(50),
  requested_by UUID REFERENCES users(id),
  notes TEXT,
  resolved_at TIMESTAMP,
  resolved_by UUID REFERENCES users(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create zoning_learning_precedents table (used by zoning-learning routes)
CREATE TABLE IF NOT EXISTS zoning_learning_precedents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction VARCHAR(100),
  zoning_code VARCHAR(50),
  use_type VARCHAR(100),
  outcome VARCHAR(50),
  confidence FLOAT DEFAULT 0.5,
  source VARCHAR(255),
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create assumption_adjustments table (used by proforma-adjustment service)
CREATE TABLE IF NOT EXISTS assumption_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  assumption_type VARCHAR(100),
  original_value JSONB,
  adjusted_value JSONB,
  adjustment_reason TEXT,
  adjusted_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create proforma_snapshots table (used by proforma-generator routes)
CREATE TABLE IF NOT EXISTS proforma_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID,
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  snapshot_name VARCHAR(255),
  snapshot_data JSONB DEFAULT '{}',
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create proforma_templates table (used by proforma-generator routes)
CREATE TABLE IF NOT EXISTS proforma_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  template_data JSONB DEFAULT '{}',
  is_default BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);


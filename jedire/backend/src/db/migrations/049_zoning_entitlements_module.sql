-- Migration 049: Zoning & Entitlements Module
-- New tables for entitlement tracking, regulatory alerts, municipal benchmarks, and deal timelines

-- Entitlements table
CREATE TABLE IF NOT EXISTS entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  parcel_address TEXT,
  type VARCHAR(50) NOT NULL,
  from_district VARCHAR(50),
  to_district VARCHAR(50),
  status VARCHAR(30) NOT NULL DEFAULT 'pre_application',
  risk_level VARCHAR(20) DEFAULT 'low',
  filed_date DATE,
  next_milestone VARCHAR(100),
  next_milestone_date DATE,
  hearing_date DATE,
  approval_date DATE,
  est_cost_low DECIMAL(12, 2),
  est_cost_high DECIMAL(12, 2),
  est_timeline_months DECIMAL(5, 1),
  success_probability DECIMAL(5, 2),
  documents JSONB DEFAULT '[]'::jsonb,
  contacts JSONB DEFAULT '[]'::jsonb,
  ai_risk_factors JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entitlements_deal_id ON entitlements(deal_id);
CREATE INDEX IF NOT EXISTS idx_entitlements_status ON entitlements(status);

-- Entitlement milestones table
CREATE TABLE IF NOT EXISTS entitlement_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entitlement_id UUID NOT NULL REFERENCES entitlements(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'upcoming',
  scheduled_date DATE,
  actual_date DATE,
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entitlement_milestones_entitlement ON entitlement_milestones(entitlement_id);

-- Regulatory alerts table
CREATE TABLE IF NOT EXISTS regulatory_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality VARCHAR(100) NOT NULL,
  state VARCHAR(2) NOT NULL,
  category VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  description TEXT,
  affected_strategies JSONB DEFAULT '[]'::jsonb,
  source_url TEXT,
  source_name VARCHAR(200),
  published_date DATE,
  expires_date DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_regulatory_alerts_municipality ON regulatory_alerts(municipality, state);
CREATE INDEX IF NOT EXISTS idx_regulatory_alerts_category ON regulatory_alerts(category);
CREATE INDEX IF NOT EXISTS idx_regulatory_alerts_severity ON regulatory_alerts(severity);

-- Municipal benchmarks table
CREATE TABLE IF NOT EXISTS municipal_benchmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality VARCHAR(100) NOT NULL,
  state VARCHAR(2) NOT NULL,
  project_type VARCHAR(50) NOT NULL,
  unit_count_min INTEGER,
  unit_count_max INTEGER,
  entitlement_type VARCHAR(50) NOT NULL,
  median_months DECIMAL(5, 1),
  p25_months DECIMAL(5, 1),
  p50_months DECIMAL(5, 1),
  p75_months DECIMAL(5, 1),
  p90_months DECIMAL(5, 1),
  sample_size INTEGER DEFAULT 0,
  trend VARCHAR(10) DEFAULT 'stable',
  last_updated TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_municipal_benchmarks_location ON municipal_benchmarks(municipality, state);
CREATE INDEX IF NOT EXISTS idx_municipal_benchmarks_type ON municipal_benchmarks(project_type, entitlement_type);

-- Deal timelines table
CREATE TABLE IF NOT EXISTS deal_timelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  scenario VARCHAR(30) NOT NULL DEFAULT 'by_right',
  phases JSONB DEFAULT '[]'::jsonb,
  total_months DECIMAL(5, 1),
  carrying_costs JSONB DEFAULT '{}'::jsonb,
  financial_impact JSONB DEFAULT '{}'::jsonb,
  land_basis DECIMAL(14, 2),
  loan_amount DECIMAL(14, 2),
  loan_rate DECIMAL(5, 3),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deal_timelines_deal ON deal_timelines(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_timelines_scenario ON deal_timelines(scenario);

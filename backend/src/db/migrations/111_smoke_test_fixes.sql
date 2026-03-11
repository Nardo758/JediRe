-- Migration 111: Smoke test Phase 2 fixes
-- Creates missing tables and functions discovered during comprehensive smoke testing

-- 1. supply_pipeline table (used by supply-signal.service.ts)
CREATE TABLE IF NOT EXISTS supply_pipeline (
  id SERIAL PRIMARY KEY,
  trade_area_id UUID,
  permitted_projects INTEGER DEFAULT 0,
  permitted_units INTEGER DEFAULT 0,
  permitted_weighted_units NUMERIC(10,2) DEFAULT 0,
  construction_projects INTEGER DEFAULT 0,
  construction_units INTEGER DEFAULT 0,
  construction_weighted_units NUMERIC(10,2) DEFAULT 0,
  delivered_12mo_projects INTEGER DEFAULT 0,
  delivered_12mo_units INTEGER DEFAULT 0,
  total_pipeline_units INTEGER DEFAULT 0,
  supply_pressure_score NUMERIC(5,2) DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sp_trade_area ON supply_pipeline(trade_area_id);

-- 2. update_supply_pipeline function stub (called by supply-signal.service.ts)
CREATE OR REPLACE FUNCTION update_supply_pipeline(p_trade_area_id UUID)
RETURNS VOID AS $$
BEGIN
  NULL;
END;
$$ LANGUAGE plpgsql;

-- 3. leasing_traffic_predictions table (used by leasing-traffic.routes.ts)
CREATE TABLE IF NOT EXISTS leasing_traffic_predictions (
  id SERIAL PRIMARY KEY,
  property_id UUID,
  prediction_date DATE,
  predicted_tours NUMERIC(10,2),
  predicted_leases NUMERIC(10,2),
  predicted_conversion_rate NUMERIC(5,4),
  actual_tours NUMERIC(10,2),
  actual_leases NUMERIC(10,2),
  actual_conversion_rate NUMERIC(5,4),
  model_version VARCHAR(50),
  confidence NUMERIC(5,4),
  weekly_traffic NUMERIC(10,2),
  weekly_tours NUMERIC(10,2),
  expected_leases NUMERIC(10,2),
  prediction_details JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ltp_property ON leasing_traffic_predictions(property_id);

-- 4. Fix calculate_max_units to use actual property_boundaries columns
-- (replaces old version that referenced nonexistent 'metrics' column)
DROP FUNCTION IF EXISTS calculate_max_units(uuid,numeric,numeric,integer,numeric,integer,integer,integer);
CREATE OR REPLACE FUNCTION calculate_max_units(
  p_deal_id UUID,
  p_max_density NUMERIC,
  p_max_far NUMERIC,
  p_max_height INTEGER,
  p_min_parking NUMERIC,
  p_max_stories INTEGER DEFAULT NULL,
  p_affordable_bonus INTEGER DEFAULT 0,
  p_tdr_bonus INTEGER DEFAULT 0
) RETURNS TABLE(max_units INTEGER, limiting_factor TEXT) AS $$
DECLARE
  v_land_area DECIMAL;
  v_density_units INTEGER;
  v_far_units INTEGER;
  v_height_units INTEGER;
  v_max INTEGER;
  v_factor TEXT;
BEGIN
  SELECT COALESCE(parcel_area_sf, buildable_area_sf, 0)
  INTO v_land_area
  FROM property_boundaries
  WHERE deal_id = p_deal_id;

  IF v_land_area IS NULL OR v_land_area = 0 THEN
    RETURN QUERY SELECT 0, 'no_boundary'::TEXT;
    RETURN;
  END IF;

  v_density_units := CASE WHEN p_max_density > 0 THEN FLOOR(v_land_area / 43560.0 * p_max_density)::INTEGER ELSE 999999 END;
  v_far_units := CASE WHEN p_max_far > 0 THEN FLOOR(v_land_area * p_max_far / 900.0)::INTEGER ELSE 999999 END;
  v_height_units := CASE WHEN p_max_height > 0 THEN FLOOR(v_land_area * 0.6 * LEAST(FLOOR(p_max_height / 12.0), COALESCE(p_max_stories, 100)) / 900.0)::INTEGER ELSE 999999 END;

  IF v_density_units <= v_far_units AND v_density_units <= v_height_units THEN
    v_max := v_density_units; v_factor := 'density';
  ELSIF v_far_units <= v_height_units THEN
    v_max := v_far_units; v_factor := 'far';
  ELSE
    v_max := v_height_units; v_factor := 'height';
  END IF;

  v_max := v_max + FLOOR(v_max * (p_affordable_bonus + p_tdr_bonus) / 100.0)::INTEGER;

  RETURN QUERY SELECT v_max, v_factor;
END;
$$ LANGUAGE plpgsql;

-- Phase 3 fixes

-- Add missing columns to financial_models
ALTER TABLE financial_models ADD COLUMN IF NOT EXISTS claude_output JSONB;
ALTER TABLE financial_models ADD COLUMN IF NOT EXISTS model_type VARCHAR(50);
ALTER TABLE financial_models ADD COLUMN IF NOT EXISTS computed_at TIMESTAMPTZ;
ALTER TABLE financial_models ADD COLUMN IF NOT EXISTS validation JSONB;

-- Add missing columns to property_records
ALTER TABLE property_records ADD COLUMN IF NOT EXISTS lat NUMERIC(10,7);
ALTER TABLE property_records ADD COLUMN IF NOT EXISTS lng NUMERIC(10,7);
ALTER TABLE property_records ADD COLUMN IF NOT EXISTS property_class VARCHAR(10);

-- Create assumption_history table
CREATE TABLE IF NOT EXISTS assumption_history (
  id SERIAL PRIMARY KEY,
  deal_id UUID,
  user_id UUID,
  assumption_key VARCHAR(255),
  old_value JSONB,
  new_value JSONB,
  changed_by UUID,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create tax_projections table
CREATE TABLE IF NOT EXISTS tax_projections (
  id SERIAL PRIMARY KEY,
  deal_id UUID,
  projection_year INTEGER,
  projected_assessed_value NUMERIC(15,2),
  projected_tax_amount NUMERIC(12,2),
  growth_rate NUMERIC(6,4),
  assumptions JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create tax_comp_analyses table (additive — does not drop existing data)
CREATE TABLE IF NOT EXISTS tax_comp_analyses (
  id SERIAL PRIMARY KEY,
  deal_id UUID UNIQUE,
  subject_annual_tax NUMERIC,
  subject_tax_per_unit NUMERIC,
  subject_assessed_value NUMERIC,
  subject_effective_rate NUMERIC,
  comp_count INTEGER DEFAULT 0,
  comps_with_tax_data INTEGER DEFAULT 0,
  median_tax_per_unit NUMERIC,
  avg_tax_per_unit NUMERIC,
  median_effective_rate NUMERIC,
  avg_effective_rate NUMERIC,
  subject_vs_median_tax_pct NUMERIC,
  subject_vs_median_rate_pct NUMERIC,
  subject_tax_percentile INTEGER,
  is_potential_over_assessment BOOLEAN DEFAULT FALSE,
  over_assessment_confidence VARCHAR(20),
  appeal_recommendation TEXT,
  comps_data JSONB DEFAULT '[]',
  analyzed_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tca_deal ON tax_comp_analyses(deal_id);

-- Phase 4 fixes

-- Add property_id to trade_areas (referenced by many services)
ALTER TABLE trade_areas ADD COLUMN IF NOT EXISTS property_id UUID;

-- Add strategy column to deals (referenced by scenario-generation.service)
ALTER TABLE deals ADD COLUMN IF NOT EXISTS strategy VARCHAR(100);

-- Add deal_id to properties (referenced by 44+ service queries)
ALTER TABLE properties ADD COLUMN IF NOT EXISTS deal_id UUID;

-- Create scenario_assumptions table (used by scenario-generation.service)
CREATE TABLE IF NOT EXISTS scenario_assumptions (
  id SERIAL PRIMARY KEY,
  scenario_id UUID UNIQUE,
  rent_growth_pct NUMERIC(8,4),
  vacancy_pct NUMERIC(8,4),
  opex_growth_pct NUMERIC(8,4),
  exit_cap_pct NUMERIC(8,4),
  absorption_months INTEGER,
  rent_growth_delta NUMERIC(8,4),
  vacancy_delta NUMERIC(8,4),
  opex_growth_delta NUMERIC(8,4),
  exit_cap_delta NUMERIC(8,4),
  absorption_delta INTEGER,
  adjustment_rationale TEXT,
  source_events_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add stats_snapshot to trade_areas (referenced by proforma-adjustment queries)
ALTER TABLE trade_areas ADD COLUMN IF NOT EXISTS stats_snapshot JSONB DEFAULT '{}';

-- Add updated_at to scenario_assumptions (referenced by scenario-generation queries)
ALTER TABLE scenario_assumptions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create scenario_templates table (used by scenario-generation service)
CREATE TABLE IF NOT EXISTS scenario_templates (
  id SERIAL PRIMARY KEY,
  scenario_type VARCHAR(20) NOT NULL,
  display_name VARCHAR(100),
  description TEXT,
  demand_positive_inclusion NUMERIC(3,2) DEFAULT 1.0,
  demand_negative_inclusion NUMERIC(3,2) DEFAULT 1.0,
  supply_positive_inclusion NUMERIC(3,2) DEFAULT 1.0,
  supply_negative_inclusion NUMERIC(3,2) DEFAULT 1.0,
  risk_event_count INTEGER DEFAULT 5,
  demand_delay_months INTEGER DEFAULT 0,
  supply_acceleration_months INTEGER DEFAULT 0,
  demand_impact_multiplier NUMERIC(4,2) DEFAULT 1.0,
  supply_impact_multiplier NUMERIC(4,2) DEFAULT 1.0,
  assumption_narrative_template TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO scenario_templates (scenario_type, display_name, description, demand_positive_inclusion, demand_negative_inclusion, supply_positive_inclusion, supply_negative_inclusion, demand_impact_multiplier, supply_impact_multiplier) VALUES
  ('bull', 'Bull Case', 'Optimistic scenario with strong demand', 1.0, 0.3, 0.3, 1.0, 1.2, 0.8),
  ('base', 'Base Case', 'Most likely scenario', 1.0, 1.0, 1.0, 1.0, 1.0, 1.0),
  ('bear', 'Bear Case', 'Pessimistic scenario with weak demand', 0.3, 1.0, 1.0, 0.3, 0.8, 1.2),
  ('stress', 'Stress Test', 'Extreme downside scenario', 0.1, 1.0, 1.0, 0.1, 0.5, 1.5)
ON CONFLICT DO NOTHING;

-- Create deal_scenarios table (used by scenario-generation service)
CREATE TABLE IF NOT EXISTS deal_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL,
  scenario_template_id INTEGER REFERENCES scenario_templates(id),
  scenario_type VARCHAR(20) NOT NULL,
  scenario_name VARCHAR(200),
  description TEXT,
  is_custom BOOLEAN DEFAULT FALSE,
  generation_trigger VARCHAR(50) DEFAULT 'auto',
  source_event_count INTEGER DEFAULT 0,
  generated_by VARCHAR(100),
  key_assumptions_summary TEXT,
  event_summary TEXT,
  risk_summary TEXT,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(deal_id, scenario_type, is_custom)
);

-- Create scenario_events table (used by scenario-generation service)
CREATE TABLE IF NOT EXISTS scenario_events (
  id SERIAL PRIMARY KEY,
  scenario_id UUID REFERENCES deal_scenarios(id) ON DELETE CASCADE,
  demand_event_id INTEGER,
  supply_event_id INTEGER,
  risk_event_id INTEGER,
  event_type VARCHAR(50),
  event_category VARCHAR(50),
  included BOOLEAN DEFAULT TRUE,
  inclusion_reason TEXT,
  impact_weight NUMERIC(4,2) DEFAULT 1.0,
  timing_adjustment_months INTEGER DEFAULT 0,
  event_summary TEXT,
  event_date TIMESTAMPTZ,
  projected_impact_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create risk_escalations table (used by scenario-generation pipeline)
CREATE TABLE IF NOT EXISTS risk_escalations (
  id SERIAL PRIMARY KEY,
  risk_score_id INTEGER,
  deal_id UUID,
  property_id UUID,
  escalation_type VARCHAR(50),
  severity VARCHAR(20) DEFAULT 'medium',
  description TEXT,
  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create adjustment_formulas table (used by proforma-adjustment.service)
CREATE TABLE IF NOT EXISTS adjustment_formulas (
  id SERIAL PRIMARY KEY,
  assumption_type VARCHAR(50) NOT NULL,
  formula_name VARCHAR(100),
  description TEXT,
  formula_expression TEXT,
  input_fields JSONB DEFAULT '[]',
  output_field VARCHAR(100),
  weight NUMERIC(5,4) DEFAULT 1.0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create property_tax_records table (property_id as UUID)
CREATE TABLE IF NOT EXISTS property_tax_records (
  id SERIAL PRIMARY KEY,
  property_id UUID,
  parcel_id VARCHAR(100),
  tax_year INTEGER,
  assessed_value NUMERIC(15,2),
  tax_amount NUMERIC(12,2),
  tax_rate NUMERIC(8,6),
  exemptions JSONB DEFAULT '{}',
  county VARCHAR(100),
  state VARCHAR(2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

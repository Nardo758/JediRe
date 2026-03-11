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

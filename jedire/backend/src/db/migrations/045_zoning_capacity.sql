-- Migration 045: Zoning & Development Capacity Table
-- Stores zoning parameters and calculates maximum development potential

CREATE TABLE IF NOT EXISTS zoning_capacity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  
  -- Zoning Information
  zoning_code VARCHAR(50),
  base_zoning VARCHAR(50), -- residential, mixed-use, commercial, industrial
  max_density DECIMAL(10, 2), -- units per acre
  max_far DECIMAL(10, 2), -- floor area ratio
  max_height_feet INTEGER,
  max_stories INTEGER,
  min_parking_per_unit DECIMAL(10, 2),
  
  -- Density Bonuses
  affordable_housing_bonus BOOLEAN DEFAULT FALSE,
  affordable_bonus_percent DECIMAL(10, 2) DEFAULT 25.0,
  tdr_available BOOLEAN DEFAULT FALSE,
  tdr_bonus_percent DECIMAL(10, 2) DEFAULT 15.0,
  
  -- Additional Constraints
  overlay_zones TEXT[],
  special_restrictions TEXT[],
  zoning_notes TEXT,
  
  -- Calculated Capacity (By Right)
  max_units_by_right INTEGER,
  max_units_with_incentives INTEGER,
  limiting_factor VARCHAR(50), -- density, far, height, parking
  buildable_sq_ft INTEGER,
  coverage_ratio DECIMAL(10, 2),
  
  -- Unit Mix
  unit_mix JSONB DEFAULT '{
    "studio": {"percent": 0, "count": 0},
    "oneBR": {"percent": 0, "count": 0},
    "twoBR": {"percent": 0, "count": 0},
    "threeBR": {"percent": 0, "count": 0}
  }'::jsonb,
  
  -- Revenue Potential
  avg_rent_per_unit DECIMAL(10, 2),
  annual_revenue DECIMAL(15, 2),
  pro_forma_noi DECIMAL(15, 2),
  estimated_value DECIMAL(15, 2),
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT unique_deal_zoning_capacity UNIQUE (deal_id),
  CONSTRAINT valid_density CHECK (max_density IS NULL OR max_density > 0),
  CONSTRAINT valid_far CHECK (max_far IS NULL OR max_far > 0),
  CONSTRAINT valid_height CHECK (max_height_feet IS NULL OR max_height_feet > 0),
  CONSTRAINT valid_stories CHECK (max_stories IS NULL OR max_stories > 0),
  CONSTRAINT valid_parking CHECK (min_parking_per_unit IS NULL OR min_parking_per_unit >= 0)
);

-- Indexes
CREATE INDEX idx_zoning_capacity_deal_id ON zoning_capacity(deal_id);
CREATE INDEX idx_zoning_capacity_base_zoning ON zoning_capacity(base_zoning);
CREATE INDEX idx_zoning_capacity_max_units ON zoning_capacity(max_units_with_incentives);

-- Updated timestamp trigger
CREATE OR REPLACE FUNCTION update_zoning_capacity_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER zoning_capacity_updated_at
  BEFORE UPDATE ON zoning_capacity
  FOR EACH ROW
  EXECUTE FUNCTION update_zoning_capacity_updated_at();

-- Function to calculate maximum units based on multiple constraints
CREATE OR REPLACE FUNCTION calculate_max_units(
  p_deal_id UUID,
  p_max_density DECIMAL,
  p_max_far DECIMAL,
  p_max_height_feet INTEGER,
  p_min_parking_per_unit DECIMAL,
  p_avg_unit_size INTEGER DEFAULT 850, -- sq ft
  p_story_height INTEGER DEFAULT 10, -- feet
  p_parking_spaces_available INTEGER DEFAULT NULL
)
RETURNS TABLE(
  max_units INTEGER,
  limiting_factor VARCHAR(50),
  buildable_sq_ft INTEGER
) AS $$
DECLARE
  v_buildable_area DECIMAL;
  v_units_by_density INTEGER;
  v_units_by_far INTEGER;
  v_units_by_height INTEGER;
  v_units_by_parking INTEGER;
  v_max_units INTEGER;
  v_limiting_factor VARCHAR(50);
  v_buildable_sq_ft INTEGER;
BEGIN
  -- Get buildable area from property_boundaries
  SELECT 
    COALESCE((metrics->>'buildableArea')::DECIMAL, (metrics->>'area')::DECIMAL, 0)
  INTO v_buildable_area
  FROM property_boundaries
  WHERE deal_id = p_deal_id;
  
  -- Default to 1 acre if no boundary exists
  IF v_buildable_area = 0 THEN
    v_buildable_area := 43560; -- 1 acre in sq ft
  END IF;
  
  -- Convert to acres for density calculation
  v_buildable_area := v_buildable_area / 43560.0;
  
  -- Calculate units by density constraint
  IF p_max_density IS NOT NULL THEN
    v_units_by_density := FLOOR(v_buildable_area * p_max_density);
  ELSE
    v_units_by_density := 999999;
  END IF;
  
  -- Calculate units by FAR constraint
  IF p_max_far IS NOT NULL THEN
    v_buildable_sq_ft := FLOOR(v_buildable_area * 43560 * p_max_far);
    v_units_by_far := FLOOR(v_buildable_sq_ft / p_avg_unit_size);
  ELSE
    v_units_by_far := 999999;
    v_buildable_sq_ft := NULL;
  END IF;
  
  -- Calculate units by height constraint
  IF p_max_height_feet IS NOT NULL THEN
    v_units_by_height := FLOOR((p_max_height_feet / p_story_height) * (v_buildable_area * 43560) / p_avg_unit_size);
  ELSE
    v_units_by_height := 999999;
  END IF;
  
  -- Calculate units by parking constraint
  IF p_parking_spaces_available IS NOT NULL AND p_min_parking_per_unit > 0 THEN
    v_units_by_parking := FLOOR(p_parking_spaces_available / p_min_parking_per_unit);
  ELSE
    v_units_by_parking := 999999;
  END IF;
  
  -- Find the most restrictive constraint
  v_max_units := LEAST(v_units_by_density, v_units_by_far, v_units_by_height, v_units_by_parking);
  
  -- Determine limiting factor
  IF v_max_units = v_units_by_density THEN
    v_limiting_factor := 'density';
  ELSIF v_max_units = v_units_by_far THEN
    v_limiting_factor := 'far';
  ELSIF v_max_units = v_units_by_height THEN
    v_limiting_factor := 'height';
  ELSE
    v_limiting_factor := 'parking';
  END IF;
  
  RETURN QUERY SELECT v_max_units, v_limiting_factor, v_buildable_sq_ft;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE zoning_capacity IS 'Zoning parameters and development capacity calculations';
COMMENT ON COLUMN zoning_capacity.max_units_by_right IS 'Maximum units without density bonuses';
COMMENT ON COLUMN zoning_capacity.max_units_with_incentives IS 'Maximum units with all applicable bonuses';
COMMENT ON COLUMN zoning_capacity.limiting_factor IS 'The constraint that limits maximum units (density/far/height/parking)';

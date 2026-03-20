-- ═══════════════════════════════════════════════════════════════
-- JEDI RE — Intelligence Context Engine
-- Migration 082: Schema Normalization & Field Mappings
-- ═══════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────
-- Field Mappings Registry
-- Maps source-specific field names to canonical schema
-- ───────────────────────────────────────────────────────────────

CREATE TABLE field_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Source identification
  source_document_type VARCHAR(100) NOT NULL,
  -- Examples: 'cbre_om', 'mm_om', 'jll_om', 't12', 'rent_roll', 'costar_comp'
  
  source_field_name TEXT NOT NULL,
  -- Raw field name as it appears in source: "Net Operating Income (Annual)"
  
  source_field_aliases TEXT[] DEFAULT '{}',
  -- Alternative names: ["NOI", "Net Income", "Annual NOI"]
  
  -- Canonical mapping
  canonical_field VARCHAR(100) NOT NULL,
  -- Standardized field name: 'noi_annual'
  
  canonical_type VARCHAR(50) NOT NULL CHECK (canonical_type IN (
    'currency', 'integer', 'float', 'percentage', 'date', 'text', 
    'boolean', 'address', 'phone', 'email', 'url'
  )),
  
  canonical_unit VARCHAR(50),
  -- For dimensional fields: 'usd', 'sqft', 'acres', 'units', 'months', 'percent'
  
  -- Transformation rules (applied before validation)
  transformation_rule JSONB DEFAULT '{}',
  -- {
  --   "operation": "multiply",
  --   "factor": 12,
  --   "description": "Convert monthly to annual"
  -- }
  -- OR
  -- {
  --   "operation": "convert_unit",
  --   "from": "acres",
  --   "to": "sqft",
  --   "factor": 43560
  -- }
  
  -- Validation rules (applied after transformation)
  validation_rule JSONB DEFAULT '{}',
  -- {
  --   "min": 0,
  --   "max": 100000000,
  --   "outlier_threshold": 2.5,  // std deviations from mean
  --   "required": true,
  --   "pattern": "^[0-9]{5}(-[0-9]{4})?$"  // for zip codes
  -- }
  
  -- Metadata
  priority INTEGER DEFAULT 0,  -- Higher priority = preferred mapping when multiple match
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicate mappings
  UNIQUE(source_document_type, source_field_name)
);

CREATE INDEX idx_field_mappings_source ON field_mappings (source_document_type);
CREATE INDEX idx_field_mappings_canonical ON field_mappings (canonical_field);
CREATE INDEX idx_field_mappings_active ON field_mappings (is_active) WHERE is_active = true;

-- ───────────────────────────────────────────────────────────────
-- Insert Default Field Mappings
-- Common CRE document fields with normalization rules
-- ───────────────────────────────────────────────────────────────

-- NOI (Net Operating Income) mappings
INSERT INTO field_mappings (source_document_type, source_field_name, source_field_aliases, canonical_field, canonical_type, canonical_unit, transformation_rule, validation_rule, priority)
VALUES
  ('cbre_om', 'Net Operating Income (Annual)', '{"NOI", "Net Operating Income", "Annual NOI"}', 'noi_annual', 'currency', 'usd', '{}', '{"min": 0, "max": 100000000, "outlier_threshold": 2.5}', 10),
  ('mm_om', 'NOI', '{"Net Operating Income"}', 'noi_annual', 'currency', 'usd', '{}', '{"min": 0, "max": 100000000, "outlier_threshold": 2.5}', 10),
  ('jll_om', 'Net Operating Income', '{"NOI"}', 'noi_annual', 'currency', 'usd', '{}', '{"min": 0, "max": 100000000, "outlier_threshold": 2.5}', 10),
  ('t12', 'NOI (TTM)', '{"Trailing Twelve Months NOI"}', 'noi_annual', 'currency', 'usd', '{}', '{"min": 0, "max": 100000000, "outlier_threshold": 2.5}', 10),
  ('t12', 'NOI (Monthly)', '{"Monthly NOI", "Monthly Net Operating Income"}', 'noi_annual', 'currency', 'usd', '{"operation": "multiply", "factor": 12}', '{"min": 0, "max": 100000000, "outlier_threshold": 2.5}', 5);

-- Gross Rental Income mappings
INSERT INTO field_mappings (source_document_type, source_field_name, source_field_aliases, canonical_field, canonical_type, canonical_unit, transformation_rule, validation_rule, priority)
VALUES
  ('rent_roll', 'Total Monthly Rent', '{"Monthly Rent", "Gross Monthly Rent"}', 'gross_rental_income_annual', 'currency', 'usd', '{"operation": "multiply", "factor": 12}', '{"min": 0, "max": 150000000}', 10),
  ('rent_roll', 'Annual Rent', '{"Gross Annual Rent"}', 'gross_rental_income_annual', 'currency', 'usd', '{}', '{"min": 0, "max": 150000000}', 10),
  ('t12', 'Rental Income', '{"Gross Rent"}', 'gross_rental_income_annual', 'currency', 'usd', '{}', '{"min": 0, "max": 150000000}', 10);

-- Operating Expenses mappings
INSERT INTO field_mappings (source_document_type, source_field_name, source_field_aliases, canonical_field, canonical_type, canonical_unit, transformation_rule, validation_rule, priority)
VALUES
  ('t12', 'Total Operating Expenses', '{"OpEx", "Operating Expenses", "Total OpEx"}', 'operating_expenses_annual', 'currency', 'usd', '{}', '{"min": 0, "max": 50000000}', 10),
  ('t12', 'Monthly Operating Expenses', '{"Monthly OpEx"}', 'operating_expenses_annual', 'currency', 'usd', '{"operation": "multiply", "factor": 12}', '{"min": 0, "max": 50000000}', 5);

-- Property characteristics
INSERT INTO field_mappings (source_document_type, source_field_name, source_field_aliases, canonical_field, canonical_type, canonical_unit, transformation_rule, validation_rule, priority)
VALUES
  ('om', 'Unit Count', '{"Total Units", "Number of Units", "Units"}', 'unit_count', 'integer', 'units', '{}', '{"min": 1, "max": 10000}', 10),
  ('om', 'Year Built', '{"Construction Year", "Built"}', 'year_built', 'integer', NULL, '{}', '{"min": 1800, "max": 2030}', 10),
  ('om', 'Lot Size (Acres)', '{"Land Area", "Parcel Size"}', 'lot_size_sf', 'float', 'sqft', '{"operation": "convert_unit", "from": "acres", "to": "sqft", "factor": 43560}', '{"min": 1000, "max": 100000000}', 10),
  ('om', 'Lot Size (SF)', '{"Land SF", "Lot SF"}', 'lot_size_sf', 'float', 'sqft', '{}', '{"min": 1000, "max": 100000000}', 10),
  ('om', 'Building Square Feet', '{"Building SF", "Total SF", "GBA"}', 'building_sf', 'integer', 'sqft', '{}', '{"min": 1000, "max": 50000000}', 10);

-- Financial metrics
INSERT INTO field_mappings (source_document_type, source_field_name, source_field_aliases, canonical_field, canonical_type, canonical_unit, transformation_rule, validation_rule, priority)
VALUES
  ('om', 'Cap Rate', '{"Capitalization Rate", "Cap"}', 'cap_rate', 'percentage', 'percent', '{}', '{"min": 0.01, "max": 0.20}', 10),
  ('om', 'Asking Price', '{"Price", "List Price", "Offering Price"}', 'asking_price', 'currency', 'usd', '{}', '{"min": 100000, "max": 1000000000}', 10),
  ('om', 'Price Per Unit', '{"Price/Unit", "$/Unit"}', 'price_per_unit', 'currency', 'usd', '{}', '{"min": 10000, "max": 1000000}', 10),
  ('om', 'Occupancy', '{"Occupancy Rate", "Physical Occupancy"}', 'occupancy_rate', 'percentage', 'percent', '{}', '{"min": 0, "max": 1}', 10);

-- Location fields
INSERT INTO field_mappings (source_document_type, source_field_name, source_field_aliases, canonical_field, canonical_type, canonical_unit, transformation_rule, validation_rule, priority)
VALUES
  ('om', 'Address', '{"Property Address", "Location"}', 'property_address', 'address', NULL, '{}', '{}', 10),
  ('om', 'City', '{}', 'property_city', 'text', NULL, '{}', '{}', 10),
  ('om', 'State', '{}', 'property_state', 'text', NULL, '{}', '{"pattern": "^[A-Z]{2}$"}', 10),
  ('om', 'ZIP', '{"Zip Code", "Postal Code"}', 'property_zip', 'text', NULL, '{}', '{"pattern": "^[0-9]{5}(-[0-9]{4})?$"}', 10);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_field_mappings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_field_mappings_timestamp
  BEFORE UPDATE ON field_mappings
  FOR EACH ROW
  EXECUTE FUNCTION update_field_mappings_timestamp();

COMMENT ON TABLE field_mappings IS 'Schema normalization: maps source field names to canonical fields with transformations';
COMMENT ON COLUMN field_mappings.transformation_rule IS 'Transformation applied before validation (unit conversion, multiply, etc)';
COMMENT ON COLUMN field_mappings.validation_rule IS 'Validation rules applied after transformation (min, max, outlier detection)';

ALTER TABLE development_scenarios
  ADD COLUMN IF NOT EXISTS target_district_id UUID REFERENCES zoning_districts(id) ON DELETE SET NULL;

ALTER TABLE benchmark_projects
  ADD COLUMN IF NOT EXISTS zoning_from_district_id UUID REFERENCES zoning_districts(id),
  ADD COLUMN IF NOT EXISTS zoning_to_district_id UUID REFERENCES zoning_districts(id),
  ADD COLUMN IF NOT EXISTS parcel_id VARCHAR(50),
  ADD COLUMN IF NOT EXISTS address VARCHAR(255),
  ADD COLUMN IF NOT EXISTS land_acres DECIMAL(10,3),
  ADD COLUMN IF NOT EXISTS assessed_value INTEGER,
  ADD COLUMN IF NOT EXISTS owner VARCHAR(255),
  ADD COLUMN IF NOT EXISTS docket_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS ordinance_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS ordinance_url TEXT,
  ADD COLUMN IF NOT EXISTS sup_docket VARCHAR(50),
  ADD COLUMN IF NOT EXISTS sup_type VARCHAR(20),
  ADD COLUMN IF NOT EXISTS admin_permit_id VARCHAR(50),
  ADD COLUMN IF NOT EXISTS admin_permit_type VARCHAR(20);

CREATE INDEX IF NOT EXISTS idx_benchmark_zoning_from ON benchmark_projects (zoning_from_district_id);
CREATE INDEX IF NOT EXISTS idx_benchmark_zoning_to ON benchmark_projects (zoning_to_district_id);
CREATE INDEX IF NOT EXISTS idx_benchmark_parcel ON benchmark_projects (parcel_id);
CREATE INDEX IF NOT EXISTS idx_benchmark_docket ON benchmark_projects (docket_number);
CREATE UNIQUE INDEX IF NOT EXISTS idx_benchmark_permit_source ON benchmark_projects (permit_number, source) WHERE permit_number IS NOT NULL;

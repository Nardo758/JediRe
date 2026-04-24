-- Georgia Metro Data Ingestion Tables
-- Cobb, Gwinnett, DeKalb, Fulton county ingestion infrastructure

-- ============================================================================
-- GEORGIA PROPERTY SALES
-- Full sale history (Cobb 927K+, Gwinnett LRSN, Fulton Tyler 2018-2022)
-- Note: separate from the existing property_sales table (different schema)
-- ============================================================================

CREATE TABLE IF NOT EXISTS georgia_property_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identifiers
  parcel_id TEXT NOT NULL,
  county TEXT NOT NULL,
  state TEXT NOT NULL,

  -- Sale Info
  sale_date DATE,
  sale_year INT,
  sale_price DECIMAL(15, 2) NOT NULL,
  sale_type TEXT,
  qualified BOOLEAN,

  -- Parties
  grantor_name TEXT,
  grantee_name TEXT,

  -- Recording
  book TEXT,
  page TEXT,
  instrument_type TEXT,

  -- Source
  provider TEXT NOT NULL,
  raw_data JSONB,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  UNIQUE(parcel_id, county, state, sale_date, sale_price)
);

CREATE INDEX IF NOT EXISTS idx_ga_sales_parcel ON georgia_property_sales(parcel_id, county, state);
CREATE INDEX IF NOT EXISTS idx_ga_sales_date ON georgia_property_sales(sale_date DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_ga_sales_year ON georgia_property_sales(sale_year DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_ga_sales_price ON georgia_property_sales(sale_price DESC);
CREATE INDEX IF NOT EXISTS idx_ga_sales_county ON georgia_property_sales(county, state);

-- ============================================================================
-- GEORGIA INGESTION JOBS
-- Track progress of county ingestion runs
-- ============================================================================

CREATE TABLE IF NOT EXISTS georgia_ingestion_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  county TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'GA',
  job_type TEXT NOT NULL CHECK (job_type IN ('full', 'parcels', 'sales', 'yearbuilt', 'permits')),

  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'complete', 'failed')),

  total_records INT DEFAULT 0,
  processed_records INT DEFAULT 0,
  inserted_records INT DEFAULT 0,
  updated_records INT DEFAULT 0,
  error_count INT DEFAULT 0,
  errors JSONB DEFAULT '[]',

  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ga_jobs_county ON georgia_ingestion_jobs(county, state);
CREATE INDEX IF NOT EXISTS idx_ga_jobs_status ON georgia_ingestion_jobs(status);
CREATE INDEX IF NOT EXISTS idx_ga_jobs_created ON georgia_ingestion_jobs(created_at DESC);

-- ============================================================================
-- SEED GEORGIA COUNTY PROVIDERS
-- ============================================================================

INSERT INTO property_data_providers (provider_type, provider_name, display_name, coverage_states, priority, is_active, api_config)
VALUES
  ('property_info', 'cobb_ga', 'Cobb County, GA', ARRAY['GA'], 100, true,
   '{"baseUrl": "https://gis.cobbcounty.gov/gisserver/rest/services/tax/taxassessorsdaily/MapServer", "parcelsLayer": 0, "yearBuiltTable": 5, "salesTable": 9}'::jsonb),
  ('property_info', 'gwinnett_ga', 'Gwinnett County, GA', ARRAY['GA'], 100, true,
   '{"baseUrl": "https://services3.arcgis.com/RfpmnkSAQleRbndX/arcgis/rest/services/Property_and_Tax/FeatureServer", "joinKey": "LRSN"}'::jsonb),
  ('property_info', 'dekalb_ga', 'DeKalb County, GA', ARRAY['GA'], 100, true,
   '{"parcelsUrl": "https://dcgis.dekalbcountyga.gov/mapping/rest/services/TaxParcels/MapServer", "permitsUrl": "https://dcgis.dekalbcountyga.gov/building/rest/services/Building_Permit_Applications/FeatureServer"}'::jsonb),
  ('property_info', 'fulton_ga', 'Fulton County, GA', ARRAY['GA'], 100, true,
   '{"parcelsUrl": "https://services1.arcgis.com/jXZcOJp6qFkhsZyH/arcgis/rest/services/Tax_Parcels_2025/FeatureServer", "salesUrl": "https://services1.arcgis.com/jXZcOJp6qFkhsZyH/arcgis/rest/services/Tyler_YearlySales/FeatureServer"}'::jsonb)
ON CONFLICT (provider_type, provider_name) DO UPDATE
  SET api_config   = EXCLUDED.api_config,
      display_name = EXCLUDED.display_name,
      is_active    = EXCLUDED.is_active;

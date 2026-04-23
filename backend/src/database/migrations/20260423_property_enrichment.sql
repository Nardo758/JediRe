-- Property Enrichment Tables
-- Two-stream architecture: Property Info + Rent Data

-- ============================================================================
-- PROVIDER REGISTRY
-- ============================================================================

CREATE TABLE IF NOT EXISTS property_data_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_type TEXT NOT NULL CHECK (provider_type IN ('property_info', 'rent_data')),
  provider_name TEXT NOT NULL,
  display_name TEXT,
  
  -- Coverage
  coverage_states TEXT[], -- ['FL', 'TX', 'AZ']
  coverage_counties JSONB, -- {FL: ['Pasco', 'Hillsborough'], TX: ['Harris']}
  coverage_msa TEXT[],
  
  -- Configuration
  api_config JSONB NOT NULL DEFAULT '{}',
  field_mappings JSONB, -- County-specific field mappings
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INT NOT NULL DEFAULT 100, -- Lower = higher priority
  
  -- Rate Limiting
  requests_per_minute INT,
  requests_per_day INT,
  
  -- Health
  last_health_check TIMESTAMP WITH TIME ZONE,
  last_health_status BOOLEAN,
  error_count INT DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  UNIQUE(provider_type, provider_name)
);

-- ============================================================================
-- ENRICHMENT JOBS
-- ============================================================================

CREATE TABLE IF NOT EXISTS property_enrichment_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES data_library_assets(id) ON DELETE SET NULL,
  user_id UUID,
  
  -- Input
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip TEXT,
  county TEXT,
  property_name TEXT,
  latitude DECIMAL(10, 7),
  longitude DECIMAL(10, 7),
  
  -- Stream 1: Property Info
  property_info_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (property_info_status IN ('pending', 'running', 'complete', 'partial', 'failed')),
  property_info_provider TEXT,
  property_info_data JSONB,
  property_info_error TEXT,
  property_info_fetched_at TIMESTAMP WITH TIME ZONE,
  
  -- Stream 2: Rent Data
  rent_data_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (rent_data_status IN ('pending', 'running', 'complete', 'partial', 'failed')),
  rent_data_provider TEXT,
  rent_data JSONB,
  rent_data_error TEXT,
  rent_data_fetched_at TIMESTAMP WITH TIME ZONE,
  
  -- Quality
  data_quality_score INT CHECK (data_quality_score >= 0 AND data_quality_score <= 100),
  missing_fields TEXT[],
  
  -- Timing
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_enrichment_jobs_property ON property_enrichment_jobs(property_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_jobs_address ON property_enrichment_jobs(address, city, state);
CREATE INDEX IF NOT EXISTS idx_enrichment_jobs_status ON property_enrichment_jobs(property_info_status, rent_data_status);
CREATE INDEX IF NOT EXISTS idx_enrichment_jobs_created ON property_enrichment_jobs(created_at DESC);

-- ============================================================================
-- PROPERTY INFO CACHE
-- ============================================================================

CREATE TABLE IF NOT EXISTS property_info_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES data_library_assets(id) ON DELETE CASCADE,
  
  -- Identifiers
  parcel_id TEXT NOT NULL,
  parcel_number TEXT,
  alt_parcel_id TEXT,
  
  -- Address
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip TEXT,
  county TEXT,
  
  -- Location
  latitude DECIMAL(10, 7),
  longitude DECIMAL(10, 7),
  
  -- Physical Characteristics
  year_built INT,
  effective_year_built INT,
  number_of_buildings INT,
  number_of_units INT,
  stories INT,
  living_area_sqft INT,
  gross_area_sqft INT,
  land_sqft INT,
  acres DECIMAL(10, 4),
  has_pool BOOLEAN,
  
  -- Land Use & Zoning
  zoning TEXT,
  zoning_description TEXT,
  land_use_code TEXT,
  land_use_description TEXT,
  future_land_use TEXT,
  property_type TEXT CHECK (property_type IN ('multifamily', 'office', 'retail', 'industrial', 'land', 'mixed_use', 'other')),
  
  -- Ownership
  owner_name TEXT,
  owner_name_2 TEXT,
  owner_mailing_address TEXT,
  owner_mailing_city TEXT,
  owner_mailing_state TEXT,
  owner_mailing_zip TEXT,
  
  -- Subdivision
  subdivision_name TEXT,
  legal_description TEXT,
  
  -- Valuation
  just_value DECIMAL(15, 2),
  assessed_value DECIMAL(15, 2),
  land_value DECIMAL(15, 2),
  building_value DECIMAL(15, 2),
  extra_feature_value DECIMAL(15, 2),
  taxable_value_county DECIMAL(15, 2),
  
  -- Sales History
  last_sale_date DATE,
  last_sale_amount DECIMAL(15, 2),
  last_sale_book TEXT,
  last_sale_page TEXT,
  previous_owner_name TEXT,
  
  -- Risk/Environmental
  fema_flood_zone TEXT,
  wind_code TEXT,
  evacuation_zone TEXT,
  wetlands TEXT,
  
  -- Utilities
  water_provider TEXT,
  sewer_provider TEXT,
  
  -- Administrative
  jurisdiction TEXT,
  tax_area TEXT,
  commission_district TEXT,
  census_tract TEXT,
  census_block_group TEXT,
  
  -- Metadata
  provider TEXT NOT NULL,
  fetched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  raw_data JSONB,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  UNIQUE(parcel_id, county, state)
);

CREATE INDEX IF NOT EXISTS idx_property_info_parcel ON property_info_cache(parcel_id);
CREATE INDEX IF NOT EXISTS idx_property_info_address ON property_info_cache(address, city, state);
CREATE INDEX IF NOT EXISTS idx_property_info_property ON property_info_cache(property_id);
CREATE INDEX IF NOT EXISTS idx_property_info_location ON property_info_cache USING GIST (
  ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- ============================================================================
-- RENT DATA CACHE
-- ============================================================================

CREATE TABLE IF NOT EXISTS property_rent_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES data_library_assets(id) ON DELETE CASCADE,
  
  -- Identity
  property_name TEXT,
  provider TEXT NOT NULL,
  as_of_date DATE NOT NULL,
  
  -- Unit Mix (JSONB array)
  -- [{beds: 1, baths: 1, sqFt: 750, unitCount: 50, askingRent: 1450, effectiveRent: 1400}, ...]
  unit_mix JSONB NOT NULL DEFAULT '[]',
  total_units INT,
  
  -- Rent Aggregates
  avg_asking_rent DECIMAL(10, 2),
  avg_effective_rent DECIMAL(10, 2),
  avg_rent_psf DECIMAL(10, 4),
  min_rent DECIMAL(10, 2),
  max_rent DECIMAL(10, 2),
  
  -- Occupancy
  occupancy_pct DECIMAL(5, 2),
  available_units INT,
  
  -- Concessions
  concessions TEXT,
  concession_value DECIMAL(10, 2),
  concession_pct DECIMAL(5, 2),
  
  -- Amenities
  unit_amenities TEXT[],
  community_amenities TEXT[],
  
  -- Lease Terms
  lease_terms TEXT[],
  pet_policy TEXT,
  application_fee DECIMAL(10, 2),
  deposit_range TEXT,
  
  -- Contact
  property_website TEXT,
  phone_number TEXT,
  
  -- Metadata
  fetched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  raw_data JSONB,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  UNIQUE(property_id, provider, as_of_date)
);

CREATE INDEX IF NOT EXISTS idx_rent_data_property ON property_rent_data(property_id);
CREATE INDEX IF NOT EXISTS idx_rent_data_date ON property_rent_data(as_of_date DESC);
CREATE INDEX IF NOT EXISTS idx_rent_data_provider ON property_rent_data(provider);

-- ============================================================================
-- HELPER VIEWS
-- ============================================================================

-- Unified property profile view
CREATE OR REPLACE VIEW property_profiles AS
SELECT 
  COALESCE(pi.property_id, rd.property_id) AS property_id,
  pi.parcel_id,
  COALESCE(pi.address, rd.property_name) AS address,
  pi.city,
  pi.state,
  pi.county,
  pi.latitude,
  pi.longitude,
  
  -- Property Info
  pi.year_built,
  pi.number_of_units AS units_from_records,
  rd.total_units AS units_from_rent_data,
  pi.living_area_sqft,
  pi.zoning,
  pi.property_type,
  pi.owner_name,
  pi.just_value,
  pi.last_sale_date,
  pi.last_sale_amount,
  
  -- Rent Data
  rd.avg_asking_rent,
  rd.avg_effective_rent,
  rd.occupancy_pct,
  rd.concessions,
  rd.unit_mix,
  
  -- Metadata
  pi.provider AS property_info_provider,
  rd.provider AS rent_data_provider,
  pi.fetched_at AS property_info_fetched_at,
  rd.fetched_at AS rent_data_fetched_at
  
FROM property_info_cache pi
FULL OUTER JOIN (
  SELECT DISTINCT ON (property_id) *
  FROM property_rent_data
  ORDER BY property_id, as_of_date DESC
) rd ON rd.property_id = pi.property_id;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update timestamps
CREATE OR REPLACE FUNCTION update_enrichment_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_property_providers_updated
  BEFORE UPDATE ON property_data_providers
  FOR EACH ROW EXECUTE FUNCTION update_enrichment_timestamp();

CREATE TRIGGER tr_property_info_cache_updated
  BEFORE UPDATE ON property_info_cache
  FOR EACH ROW EXECUTE FUNCTION update_enrichment_timestamp();

-- ============================================================================
-- SEED DEFAULT PROVIDERS
-- ============================================================================

INSERT INTO property_data_providers (provider_type, provider_name, display_name, coverage_states, priority, is_active)
VALUES
  ('property_info', 'pasco_fl', 'Pasco County, FL', ARRAY['FL'], 100, true),
  ('property_info', 'hillsborough_fl', 'Hillsborough County, FL', ARRAY['FL'], 100, true),
  ('property_info', 'orange_fl', 'Orange County, FL', ARRAY['FL'], 100, true),
  ('property_info', 'osceola_fl', 'Osceola County, FL', ARRAY['FL'], 100, true),
  ('property_info', 'pinellas_fl', 'Pinellas County, FL', ARRAY['FL'], 100, true),
  ('property_info', 'maricopa_az', 'Maricopa County, AZ', ARRAY['AZ'], 100, true),
  ('property_info', 'harris_tx', 'Harris County, TX', ARRAY['TX'], 100, true),
  ('property_info', 'dallas_tx', 'Dallas County, TX', ARRAY['TX'], 100, true),
  ('rent_data', 'apartments_com', 'Apartments.com', NULL, 100, true)
ON CONFLICT (provider_type, provider_name) DO UPDATE
SET display_name = EXCLUDED.display_name,
    coverage_states = EXCLUDED.coverage_states;

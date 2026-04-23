-- Property Discovery & Matching Tables
-- Automatically discovers large multifamily from municipal APIs
-- Matches with Apartment Locator AI rent data

-- ============================================================================
-- DISCOVERED PROPERTIES
-- Properties found via municipal API discovery (100+ units)
-- ============================================================================

CREATE TABLE IF NOT EXISTS discovered_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identifiers
  parcel_id TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  county TEXT NOT NULL,
  zip TEXT,
  
  -- Property Info
  property_name TEXT,
  number_of_units INT,
  number_of_buildings INT,
  year_built INT,
  living_area_sqft INT,
  acres DECIMAL(10, 4),
  property_type TEXT DEFAULT 'multifamily',
  
  -- Ownership
  owner_name TEXT,
  owner_city TEXT,
  owner_state TEXT,
  
  -- Valuation
  just_value DECIMAL(15, 2),
  building_value DECIMAL(15, 2),
  
  -- Match Status
  match_status TEXT NOT NULL DEFAULT 'unmatched'
    CHECK (match_status IN ('unmatched', 'matched', 'manual_review', 'no_match')),
  apartment_locator_id UUID,
  apartment_locator_name TEXT,
  match_confidence INT CHECK (match_confidence >= 0 AND match_confidence <= 100),
  matched_at TIMESTAMP WITH TIME ZONE,
  matched_by UUID,
  
  -- Metadata
  provider TEXT NOT NULL,
  discovered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  UNIQUE(parcel_id, county, state)
);

CREATE INDEX IF NOT EXISTS idx_discovered_props_match_status ON discovered_properties(match_status);
CREATE INDEX IF NOT EXISTS idx_discovered_props_county ON discovered_properties(county, state);
CREATE INDEX IF NOT EXISTS idx_discovered_props_units ON discovered_properties(number_of_units DESC);
CREATE INDEX IF NOT EXISTS idx_discovered_props_al_id ON discovered_properties(apartment_locator_id);

-- ============================================================================
-- APARTMENT LOCATOR PROPERTIES
-- Properties from Apartment Locator AI with rent data
-- ============================================================================

CREATE TABLE IF NOT EXISTS apartment_locator_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT,
  
  -- Identity
  property_name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip TEXT,
  
  -- Location
  latitude DECIMAL(10, 7),
  longitude DECIMAL(10, 7),
  
  -- Property Data
  total_units INT,
  year_built INT,
  property_type TEXT,
  
  -- Rent Data
  avg_asking_rent DECIMAL(10, 2),
  avg_effective_rent DECIMAL(10, 2),
  min_rent DECIMAL(10, 2),
  max_rent DECIMAL(10, 2),
  
  -- Unit Mix (JSONB array)
  unit_mix JSONB DEFAULT '[]',
  
  -- Occupancy
  occupancy_pct DECIMAL(5, 2),
  available_units INT,
  
  -- Concessions
  concessions TEXT,
  concession_pct DECIMAL(5, 2),
  
  -- Management
  management_company TEXT,
  
  -- Amenities
  unit_amenities TEXT[],
  community_amenities TEXT[],
  
  -- Contact
  phone TEXT,
  website TEXT,
  
  -- Metadata
  source TEXT NOT NULL, -- 'apartment_locator_ai', 'apartments_com', 'manual'
  source_url TEXT,
  data_as_of DATE,
  fetched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  UNIQUE(external_id, source)
);

CREATE INDEX IF NOT EXISTS idx_al_props_location ON apartment_locator_properties(city, state);
CREATE INDEX IF NOT EXISTS idx_al_props_name ON apartment_locator_properties USING gin(to_tsvector('english', property_name));
CREATE INDEX IF NOT EXISTS idx_al_props_address ON apartment_locator_properties USING gin(to_tsvector('english', address));

-- ============================================================================
-- PROPERTY MATCHES
-- Records of discovered ↔ apartment locator matches
-- ============================================================================

CREATE TABLE IF NOT EXISTS property_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discovered_property_id UUID NOT NULL REFERENCES discovered_properties(id) ON DELETE CASCADE,
  apartment_locator_id UUID NOT NULL REFERENCES apartment_locator_properties(id) ON DELETE CASCADE,
  
  -- Match Quality
  confidence INT NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
  match_method TEXT NOT NULL, -- 'exact_address', 'fuzzy_address', 'coordinates', 'property_name', 'composite'
  match_reasons TEXT[],
  
  -- Comparison Details
  address_match BOOLEAN DEFAULT FALSE,
  coordinate_match BOOLEAN DEFAULT FALSE,
  owner_name_match BOOLEAN DEFAULT FALSE,
  property_name_match BOOLEAN DEFAULT FALSE,
  unit_count_match BOOLEAN DEFAULT FALSE,
  year_built_match BOOLEAN DEFAULT FALSE,
  
  -- Delta
  unit_count_delta INT,
  year_built_delta INT,
  distance_meters DECIMAL(10, 2),
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'auto_matched', 'confirmed', 'rejected', 'review_required')),
  
  -- Review
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_notes TEXT,
  rejection_reason TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  UNIQUE(discovered_property_id, apartment_locator_id)
);

CREATE INDEX IF NOT EXISTS idx_matches_status ON property_matches(status);
CREATE INDEX IF NOT EXISTS idx_matches_confidence ON property_matches(confidence DESC);
CREATE INDEX IF NOT EXISTS idx_matches_discovered ON property_matches(discovered_property_id);
CREATE INDEX IF NOT EXISTS idx_matches_al ON property_matches(apartment_locator_id);

-- ============================================================================
-- DISCOVERY JOBS
-- Track discovery job runs
-- ============================================================================

CREATE TABLE IF NOT EXISTS discovery_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Scope
  county TEXT,
  state TEXT,
  scope_type TEXT NOT NULL DEFAULT 'county'
    CHECK (scope_type IN ('county', 'state', 'all')),
  
  -- Filters
  min_units INT DEFAULT 100,
  min_buildings INT,
  min_sqft INT,
  year_built_after INT,
  
  -- Results
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'complete', 'failed')),
  properties_found INT DEFAULT 0,
  properties_new INT DEFAULT 0,
  properties_updated INT DEFAULT 0,
  errors JSONB DEFAULT '[]',
  
  -- Timing
  scheduled_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  triggered_by UUID,
  trigger_type TEXT DEFAULT 'manual' 
    CHECK (trigger_type IN ('manual', 'scheduled', 'api')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discovery_jobs_status ON discovery_jobs(status);
CREATE INDEX IF NOT EXISTS idx_discovery_jobs_county ON discovery_jobs(county, state);

-- ============================================================================
-- DATA LIBRARY ENRICHMENT LOG
-- Track auto-enrichment of user-uploaded deals
-- ============================================================================

CREATE TABLE IF NOT EXISTS data_library_enrichment_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL, -- References data_library_assets
  user_id UUID,
  
  -- What was enriched
  fields_enriched TEXT[] NOT NULL DEFAULT '{}',
  fields_still_missing TEXT[] NOT NULL DEFAULT '{}',
  
  -- Sources used
  municipal_api_used BOOLEAN DEFAULT FALSE,
  municipal_provider TEXT,
  apartment_locator_used BOOLEAN DEFAULT FALSE,
  apartment_locator_id UUID,
  
  -- Quality improvement
  previous_score INT,
  new_score INT,
  
  -- Enriched data snapshot
  enriched_data JSONB NOT NULL DEFAULT '{}',
  
  -- Conflicts
  conflicts JSONB DEFAULT '[]',
  conflicts_resolved BOOLEAN DEFAULT FALSE,
  conflict_resolutions JSONB,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'applied', 'partial', 'rejected', 'failed')),
  applied_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enrichment_log_asset ON data_library_enrichment_log(asset_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_log_user ON data_library_enrichment_log(user_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_log_status ON data_library_enrichment_log(status);

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Update last_updated timestamp
CREATE OR REPLACE FUNCTION update_property_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_discovered_props_updated
  BEFORE UPDATE ON discovered_properties
  FOR EACH ROW EXECUTE FUNCTION update_property_timestamp();

CREATE TRIGGER tr_al_props_updated
  BEFORE UPDATE ON apartment_locator_properties
  FOR EACH ROW EXECUTE FUNCTION update_property_timestamp();

-- Defensive: ensure update_enrichment_timestamp() exists regardless of which
-- migration runs first (this file or 20260423_property_enrichment.sql).
CREATE OR REPLACE FUNCTION update_enrichment_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_matches_updated
  BEFORE UPDATE ON property_matches
  FOR EACH ROW EXECUTE FUNCTION update_enrichment_timestamp();

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Unmatched large properties needing review
CREATE OR REPLACE VIEW unmatched_large_properties AS
SELECT 
  dp.*,
  (SELECT COUNT(*) FROM property_matches pm WHERE pm.discovered_property_id = dp.id) AS match_attempts
FROM discovered_properties dp
WHERE dp.match_status = 'unmatched'
  AND dp.number_of_units >= 100
ORDER BY dp.number_of_units DESC, dp.discovered_at DESC;

-- Match review queue
CREATE OR REPLACE VIEW match_review_queue AS
SELECT 
  pm.*,
  dp.address AS discovered_address,
  dp.city AS discovered_city,
  dp.number_of_units AS discovered_units,
  dp.year_built AS discovered_year_built,
  dp.owner_name AS discovered_owner,
  al.property_name AS al_name,
  al.address AS al_address,
  al.total_units AS al_units,
  al.year_built AS al_year_built,
  al.avg_asking_rent AS al_avg_rent,
  al.management_company AS al_mgmt
FROM property_matches pm
JOIN discovered_properties dp ON dp.id = pm.discovered_property_id
JOIN apartment_locator_properties al ON al.id = pm.apartment_locator_id
WHERE pm.status = 'review_required'
ORDER BY pm.confidence DESC;

-- Enrichment opportunities (assets that could be enriched)
CREATE OR REPLACE VIEW enrichment_opportunities AS
SELECT 
  dla.id,
  dla.property_name,
  dla.address,
  dla.city,
  dla.state,
  dla.data_quality_score,
  ARRAY_REMOVE(ARRAY[
    CASE WHEN dla.unit_count IS NULL THEN 'units' END,
    CASE WHEN dla.year_built IS NULL THEN 'yearBuilt' END,
    CASE WHEN dla.net_rentable_sqft IS NULL THEN 'livingAreaSqFt' END,
    CASE WHEN dla.avg_rent IS NULL THEN 'avgRent' END,
    CASE WHEN dla.occupancy_rate IS NULL THEN 'occupancyPct' END
  ], NULL) AS missing_fields,
  COALESCE(dla.data_quality_score, 0) < 50 AS needs_enrichment
FROM data_library_assets dla
WHERE dla.address IS NOT NULL
  AND dla.city IS NOT NULL
  AND dla.state IS NOT NULL
  AND COALESCE(dla.data_quality_score, 0) < 70;

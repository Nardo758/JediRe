-- Building Profiles
-- Maps each deal's physical building characteristics to expected OpEx benchmarks.
-- Populated from archive deals (OMs, county parcel data) and used by CashFlow agent
-- to compare actual costs vs profile expectations.

-- ─── Building Profiles ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS building_profiles (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id           UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  
  -- Physical specs (extracted from OM / county parcel)
  year_built        INT,
  total_stories     INT,
  total_units       INT,
  building_type     TEXT CHECK (building_type IN ('garden', 'midrise', 'highrise', 'townhouse', 'wrap', 'mixed_use', 'unknown')),
  construction_type TEXT CHECK (construction_type IN ('wood_frame', 'concrete', 'steel', 'masonry', 'metal_building', 'unknown')),
  site_acres        REAL,
  building_sqft     REAL,
  unit_sqft_avg     REAL,
  
  -- Parking
  parking_spaces    INT,
  parking_type      TEXT CHECK (parking_type IN ('surface', 'garage', 'covered', 'none', 'unknown')),
  parking_ratio     REAL,
  
  -- Age classification (computed)
  vintage_band      TEXT CHECK (vintage_band IN ('pre-1980', '1980-1999', '2000-2009', '2010-2019', '2020+')),
  
  -- Size classification (computed)
  size_band         TEXT CHECK (size_band IN ('micro', 'small', 'medium', 'large', 'mega')),
  
  -- Amenities (boolean flags)
  has_elevator      BOOLEAN NOT NULL DEFAULT FALSE,
  has_pool          BOOLEAN NOT NULL DEFAULT FALSE,
  has_clubhouse     BOOLEAN NOT NULL DEFAULT FALSE,
  has_fitness       BOOLEAN NOT NULL DEFAULT FALSE,
  has_concierge     BOOLEAN NOT NULL DEFAULT FALSE,
  has_dog_park      BOOLEAN NOT NULL DEFAULT FALSE,
  has_rooftop       BOOLEAN NOT NULL DEFAULT FALSE,
  has_coworking     BOOLEAN NOT NULL DEFAULT FALSE,
  has_package_concierge BOOLEAN NOT NULL DEFAULT FALSE,
  has_valet_trash   BOOLEAN NOT NULL DEFAULT FALSE,
  has_doorman       BOOLEAN NOT NULL DEFAULT FALSE,
  has_garage        BOOLEAN NOT NULL DEFAULT FALSE,
  has_tennis        BOOLEAN NOT NULL DEFAULT FALSE,
  has_basketball    BOOLEAN NOT NULL DEFAULT FALSE,
  has_business_center BOOLEAN NOT NULL DEFAULT FALSE,
  has_playground    BOOLEAN NOT NULL DEFAULT FALSE,
  has_grill         BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Rawamenity tags from OM (preserve for re-classification)
  raw_amenities     TEXT[] DEFAULT '{}',
  
  -- Extraction provenance
  extraction_source TEXT CHECK (extraction_source IN ('om_parsed', 'county_parcel', 'user_input', 'agent_inferred', 'batch_scan')),
  extraction_confidence REAL DEFAULT 0.5,
  
  -- Computed fingerprint for benchmark matching
  profile_fingerprint TEXT GENERATED ALWAYS AS (
    CASE
      WHEN building_type IS NOT NULL AND vintage_band IS NOT NULL
      THEN building_type || '|' || vintage_band || '|'
        || CASE WHEN has_elevator THEN 'elev|' ELSE 'noelev|' END
        || CASE WHEN has_pool THEN 'pool|' ELSE 'nopool|' END
        || CASE WHEN has_fitness THEN 'fit|' ELSE 'nofit|' END
        || CASE WHEN has_clubhouse THEN 'club' ELSE 'noclub' END
      ELSE NULL
    END
  ) STORED,
  
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(deal_id)
);

-- ─── Profile OpEx Benchmarks ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS building_profile_opex_benchmarks (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_fingerprint TEXT,                    -- matches building_profiles.profile_fingerprint
  line_item           TEXT NOT NULL,            -- matches opex line item names
  region              TEXT NOT NULL DEFAULT 'national',
  
  -- Per-unit statistics (annual $/unit)
  p10_per_unit        REAL,
  p25_per_unit        REAL,
  p50_per_unit        REAL,
  p75_per_unit        REAL,
  p90_per_unit        REAL,
  
  -- As-% of EGI statistics
  p10_pct_egi         REAL,
  p25_pct_egi         REAL,
  p50_pct_egi         REAL,
  p75_pct_egi         REAL,
  p90_pct_egi         REAL,
  
  sample_count         INT NOT NULL DEFAULT 0,
  computed_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(profile_fingerprint, line_item, region)
);

-- ─── Indexes ────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_building_profiles_deal ON building_profiles(deal_id);
CREATE INDEX IF NOT EXISTS idx_building_profiles_fingerprint ON building_profiles(profile_fingerprint);
CREATE INDEX IF NOT EXISTS idx_building_profiles_vintage ON building_profiles(vintage_band);
CREATE INDEX IF NOT EXISTS idx_building_profiles_type ON building_profiles(building_type);

CREATE INDEX IF NOT EXISTS idx_bp_benchmarks_fingerprint ON building_profile_opex_benchmarks(profile_fingerprint);
CREATE INDEX IF NOT EXISTS idx_bp_benchmarks_line_item ON building_profile_opex_benchmarks(line_item);
CREATE INDEX IF NOT EXISTS idx_bp_benchmarks_region ON building_profile_opex_benchmarks(region);

-- ─── Trigger: auto-update updated_at ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_building_profile_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_building_profile_updated ON building_profiles;
CREATE TRIGGER trg_building_profile_updated
  BEFORE UPDATE ON building_profiles
  FOR EACH ROW EXECUTE FUNCTION update_building_profile_timestamp();

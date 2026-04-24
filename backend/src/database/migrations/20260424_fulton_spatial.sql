-- Fulton County Spatial Join Infrastructure
-- Staging tables for PostGIS-based structures → parcels year_built enrichment

-- Ensure PostGIS is available (already enabled, belt-and-suspenders)
CREATE EXTENSION IF NOT EXISTS postgis;

-- ---------------------------------------------------------------------------
-- fulton_parcels: Fulton Tax_Parcels_2025 geometry staging
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fulton_parcels (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parcel_id  TEXT NOT NULL,
  county     TEXT NOT NULL DEFAULT 'Fulton',
  state      TEXT NOT NULL DEFAULT 'GA',
  geometry   GEOMETRY(GEOMETRY, 4326),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (parcel_id, county, state)
);

CREATE INDEX IF NOT EXISTS idx_fulton_parcels_geom
  ON fulton_parcels USING GIST (geometry);

CREATE INDEX IF NOT EXISTS idx_fulton_parcels_parcel_id
  ON fulton_parcels (parcel_id);

-- ---------------------------------------------------------------------------
-- fulton_structures: Fulton Structures FeatureServer geometry staging
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fulton_structures (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id TEXT,
  year_built INTEGER,
  stories    SMALLINT,
  live_units INTEGER,
  area_sqft  NUMERIC,
  geometry   GEOMETRY(GEOMETRY, 4326),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fulton_structures_geom
  ON fulton_structures USING GIST (geometry);

CREATE INDEX IF NOT EXISTS idx_fulton_structures_feature_id
  ON fulton_structures (feature_id);

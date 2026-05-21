-- Phase 0.1 — property_descriptions table
-- LayeredValue<jsonb> shape for all mutable property attributes.
-- FK to properties(parcel_id); old properties table stays for now.

BEGIN;

CREATE TABLE IF NOT EXISTS property_descriptions (
  parcel_id text PRIMARY KEY,
  property_name jsonb,
  address jsonb,
  msa jsonb,
  county jsonb,
  year_built jsonb,
  year_renovated jsonb,
  unit_count jsonb,
  building_count jsonb,
  stories jsonb,
  stories_band jsonb,
  total_sqft jsonb,
  rentable_sqft jsonb,
  lot_size_acres jsonb,
  construction_type jsonb,
  parking_type jsonb,
  parking_spaces jsonb,
  parking_ratio jsonb,
  asset_class jsonb,
  property_type jsonb,
  amenities jsonb,
  zoning_code jsonb,
  flood_zone jsonb,
  in_opportunity_zone jsonb,
  narrative jsonb,
  submarket jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pd_parcel      ON property_descriptions(parcel_id);
CREATE INDEX IF NOT EXISTS idx_pd_msa         ON property_descriptions USING GIN (msa);
CREATE INDEX IF NOT EXISTS idx_pd_asset_class ON property_descriptions USING GIN (asset_class);
CREATE INDEX IF NOT EXISTS idx_pd_updated     ON property_descriptions(updated_at DESC);

COMMIT;

-- Phase 1b: Add parcel_id_canonical to properties
-- Part of Phase 1.1.E disposition (2026-05-29)
--
-- Format: <state_lower>-<county_lower>-<raw_parcel_id_trimmed>
-- e.g.   ga-cobb-20001202330
--        ga-fulton-22481411970839
--
-- Column added empty here; populated during Phase 2 backfill
-- by the backfill-identity script.

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS parcel_id_canonical TEXT;

CREATE INDEX IF NOT EXISTS idx_properties_parcel_id_canonical
  ON properties (parcel_id_canonical)
  WHERE parcel_id_canonical IS NOT NULL;

COMMENT ON COLUMN properties.parcel_id_canonical IS
  'Normalized composite parcel ID: <state_lower>-<county_lower>-<county_parcel_id_trimmed>.
   Format example: ga-cobb-20001202330, ga-fulton-22481411970839.
   Populated during Phase 2 backfill. Left null until backfill runs.
   The raw county parcel_id (as received) remains in the parcel_id column.';

-- Seed the properties row for the 464 Bishop deal.
-- Deal ID: 3f32276f-aacd-4da3-b306-317c5109b403
-- Unit count (232) and building SF (196,196) derived from OM unit-mix extraction
-- stored in deals.deal_data->'extraction_om'->'unit_mix'.
-- lat/lng geocoded from address: 464 Bishop Street NW, Atlanta, GA 30318.
-- Building class B: Cushman & Wakefield marketed mid-rise multifamily, Atlanta 2014-era.
-- This row unblocks all Valuation Grid PPU/PSF methods that were returning INSUFFICIENT
-- due to null unit count, null building SF, and null geocode.

INSERT INTO properties (
  id,
  deal_id,
  address_line1,
  city,
  state_code,
  zip,
  units,
  building_sf,
  building_class,
  latitude,
  longitude,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  '3f32276f-aacd-4da3-b306-317c5109b403',
  '464 Bishop Street Northwest',
  'Atlanta',
  'GA',
  '30318',
  232,
  196196,
  'B',
  33.7799,
  -84.4226,
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM properties WHERE deal_id = '3f32276f-aacd-4da3-b306-317c5109b403'
);

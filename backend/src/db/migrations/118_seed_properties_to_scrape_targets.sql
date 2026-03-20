-- Migration 118: Seed all multi-family properties from properties table into rent_scrape_targets
-- Skips rows that already exist (ON CONFLICT DO NOTHING based on unique(property_name, city))
-- Uses city as market, parses submarket_id if present

INSERT INTO rent_scrape_targets (
  property_name,
  address,
  city,
  state,
  unit_count,
  latitude,
  longitude,
  building_class,
  market,
  submarket,
  source,
  active
)
SELECT
  TRIM(p.name)                                                              AS property_name,
  TRIM(p.address_line1)                                                     AS address,
  TRIM(p.city)                                                              AS city,
  COALESCE(p.state_code, 'GA')                                              AS state,
  p.units                                                                   AS unit_count,
  p.lat                                                                     AS latitude,
  p.lng                                                                     AS longitude,
  p.building_class                                                          AS building_class,
  TRIM(p.city)                                                              AS market,
  CASE
    WHEN p.submarket_id IS NOT NULL THEN
      INITCAP(REPLACE(REGEXP_REPLACE(p.submarket_id, '^[^-]+-', ''), '-', ' '))
    ELSE NULL
  END                                                                       AS submarket,
  'properties_table'                                                        AS source,
  TRUE                                                                      AS active
FROM properties p
WHERE p.property_type = 'multi_family'
  AND p.name IS NOT NULL
  AND TRIM(p.name) != ''
ON CONFLICT (property_name, city) DO NOTHING;

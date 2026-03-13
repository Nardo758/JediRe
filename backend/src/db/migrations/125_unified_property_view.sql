ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS property_record_id UUID REFERENCES property_records(id);

CREATE INDEX IF NOT EXISTS idx_properties_property_record_id
  ON properties(property_record_id)
  WHERE property_record_id IS NOT NULL;

ALTER TABLE rent_scrape_targets
  ADD COLUMN IF NOT EXISTS properties_id UUID REFERENCES properties(id);

CREATE INDEX IF NOT EXISTS idx_rst_properties_id
  ON rent_scrape_targets(properties_id)
  WHERE properties_id IS NOT NULL;

DO $$
DECLARE
  v_rst_prop INT;
  v_prop_pr INT;
BEGIN
  WITH unique_matches AS (
    SELECT rst.id AS rst_id, p.id AS p_id
    FROM rent_scrape_targets rst
    JOIN properties p
      ON UPPER(TRIM(p.name)) = UPPER(TRIM(rst.property_name))
      AND UPPER(TRIM(p.city)) = UPPER(TRIM(rst.city))
    WHERE rst.properties_id IS NULL
      AND rst.source = 'properties_table'
  ),
  single_match AS (
    SELECT rst_id, MIN(p_id) AS p_id
    FROM unique_matches
    GROUP BY rst_id
    HAVING COUNT(*) = 1
  ),
  updated AS (
    UPDATE rent_scrape_targets rst SET
      properties_id = sm.p_id
    FROM single_match sm
    WHERE rst.id = sm.rst_id
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_rst_prop FROM updated;

  RAISE NOTICE 'rent_scrape_targets → properties: % rows linked', v_rst_prop;

  WITH unique_matches AS (
    SELECT p.id AS p_id, pr.id AS pr_id
    FROM properties p
    JOIN property_records pr
      ON UPPER(TRIM(pr.city)) = UPPER(TRIM(p.city))
      AND UPPER(TRIM(pr.address)) = UPPER(TRIM(p.address_line1))
    WHERE p.property_record_id IS NULL
  ),
  single_match AS (
    SELECT p_id, MIN(pr_id) AS pr_id
    FROM unique_matches
    GROUP BY p_id
    HAVING COUNT(*) = 1
  ),
  updated AS (
    UPDATE properties p SET
      property_record_id = sm.pr_id
    FROM single_match sm
    WHERE p.id = sm.p_id
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_prop_pr FROM updated;

  RAISE NOTICE 'properties → property_records: % rows linked', v_prop_pr;
END $$;

DROP MATERIALIZED VIEW IF EXISTS v_unified_properties;

CREATE MATERIALIZED VIEW v_unified_properties AS
WITH base AS (
  SELECT
    pr.id AS property_record_id,
    NULL::UUID AS properties_id,
    NULL::INT AS scrape_target_id,
    pr.address AS pr_address,
    pr.city AS pr_city,
    pr.state AS pr_state,
    pr.zip_code AS pr_zip,
    pr.units AS pr_units,
    pr.year_built AS pr_year_built,
    pr.lat AS pr_lat,
    pr.lng AS pr_lng,
    pr.owner_name,
    pr.parcel_id,
    pr.assessed_value::NUMERIC AS pr_assessed_value,
    pr.appraised_value::NUMERIC AS pr_appraised_value,
    pr.property_class,
    pr.county,
    pr.building_sqft,
    pr.land_acres,
    pr.updated_at AS pr_updated
  FROM property_records pr
),
enriched AS (
  SELECT
    b.*,
    p.id AS p_id,
    p.name AS p_name,
    p.address_line1 AS p_address,
    p.city AS p_city,
    p.state_code AS p_state,
    p.zip AS p_zip,
    p.units AS p_units,
    p.year_built AS p_year_built,
    p.lat AS p_lat,
    p.lng AS p_lng,
    p.building_class AS p_building_class,
    p.current_occupancy,
    p.avg_rent,
    p.market_rent,
    p.jedi_score,
    p.submarket_id,
    p.pipeline_stage,
    p.acquisition_date,
    p.acquisition_price,
    p.assessed_value AS p_assessed_value,
    p.appraised_value AS p_appraised_value,
    p.updated_at AS p_updated
  FROM base b
  LEFT JOIN properties p ON p.property_record_id = b.property_record_id
),
with_rst AS (
  SELECT
    e.*,
    rst.id AS rst_id,
    rst.property_name AS rst_name,
    rst.address AS rst_address,
    rst.city AS rst_city,
    rst.state AS rst_state,
    rst.zip AS rst_zip,
    rst.unit_count AS rst_units,
    rst.year_built AS rst_year_built,
    rst.latitude AS rst_lat,
    rst.longitude AS rst_lng,
    rst.website_url,
    rst.google_rating,
    rst.review_count,
    rst.phone,
    rst.building_class AS rst_building_class,
    rst.updated_at AS rst_updated
  FROM enriched e
  LEFT JOIN rent_scrape_targets rst
    ON rst.property_record_id = e.property_record_id
),
unlinked_props AS (
  SELECT
    NULL::UUID AS property_record_id,
    p.id AS p_id,
    NULL::INT AS rst_id,
    p.name AS p_name,
    p.address_line1 AS p_address,
    p.city AS p_city,
    p.state_code AS p_state,
    p.zip AS p_zip,
    p.units AS p_units,
    p.year_built AS p_year_built,
    p.lat AS p_lat,
    p.lng AS p_lng,
    p.building_class AS p_building_class,
    p.current_occupancy,
    p.avg_rent,
    p.market_rent,
    p.jedi_score,
    p.submarket_id,
    p.pipeline_stage,
    p.acquisition_date,
    p.acquisition_price,
    p.assessed_value AS p_assessed_value,
    p.appraised_value AS p_appraised_value,
    p.updated_at AS p_updated,
    NULL::TEXT AS owner_name,
    NULL::TEXT AS parcel_id,
    NULL::TEXT AS county,
    NULL::NUMERIC AS building_sqft,
    NULL::NUMERIC AS land_acres,
    NULL::TEXT AS property_class,
    rst2.id AS rst2_id,
    rst2.website_url AS rst2_website_url,
    rst2.google_rating AS rst2_google_rating,
    rst2.review_count AS rst2_review_count,
    rst2.phone AS rst2_phone,
    rst2.building_class AS rst2_building_class,
    rst2.updated_at AS rst2_updated
  FROM properties p
  LEFT JOIN rent_scrape_targets rst2 ON rst2.properties_id = p.id
  WHERE p.property_record_id IS NULL
),
unlinked_rst AS (
  SELECT
    rst.id AS rst_id,
    rst.property_name,
    rst.address,
    rst.city,
    rst.state,
    rst.zip,
    rst.unit_count,
    rst.year_built,
    rst.latitude,
    rst.longitude,
    rst.website_url,
    rst.google_rating,
    rst.review_count,
    rst.phone,
    rst.building_class,
    rst.updated_at
  FROM rent_scrape_targets rst
  WHERE rst.property_record_id IS NULL
    AND rst.properties_id IS NULL
)
SELECT
  property_record_id,
  COALESCE(p_id, NULL) AS properties_id,
  COALESCE(rst_id, NULL) AS scrape_target_id,
  COALESCE(p_name, rst_name, pr_address) AS name,
  COALESCE(pr_address, p_address, rst_address) AS address,
  COALESCE(pr_city, p_city, rst_city) AS city,
  COALESCE(pr_state, p_state, rst_state) AS state,
  COALESCE(pr_zip, p_zip, rst_zip) AS zip,
  COALESCE(pr_units, p_units, rst_units) AS unit_count,
  COALESCE(
    NULLIF(REGEXP_REPLACE(pr_year_built, '[^0-9]', '', 'g'), '')::INT,
    p_year_built,
    rst_year_built
  ) AS year_built,
  COALESCE(p_lat, pr_lat::DOUBLE PRECISION, rst_lat) AS latitude,
  COALESCE(p_lng, pr_lng::DOUBLE PRECISION, rst_lng) AS longitude,
  website_url,
  google_rating,
  review_count,
  phone,
  owner_name,
  parcel_id,
  COALESCE(pr_assessed_value, p_assessed_value) AS assessed_value,
  COALESCE(pr_appraised_value, p_appraised_value) AS appraised_value,
  COALESCE(p_building_class, rst_building_class, property_class) AS building_class,
  county,
  building_sqft,
  land_acres,
  current_occupancy,
  avg_rent,
  market_rent,
  jedi_score,
  submarket_id,
  pipeline_stage,
  acquisition_date,
  acquisition_price,
  ARRAY_REMOVE(ARRAY[
    CASE WHEN property_record_id IS NOT NULL THEN 'property_records' END,
    CASE WHEN p_id IS NOT NULL THEN 'properties' END,
    CASE WHEN rst_id IS NOT NULL THEN 'rent_scrape_targets' END
  ], NULL) AS sources,
  GREATEST(pr_updated, p_updated, rst_updated) AS last_updated
FROM with_rst

UNION ALL

SELECT
  NULL AS property_record_id,
  p_id AS properties_id,
  COALESCE(rst2_id, NULL) AS scrape_target_id,
  p_name AS name,
  p_address AS address,
  p_city AS city,
  p_state AS state,
  p_zip AS zip,
  p_units AS unit_count,
  p_year_built AS year_built,
  p_lat AS latitude,
  p_lng AS longitude,
  rst2_website_url AS website_url,
  rst2_google_rating AS google_rating,
  rst2_review_count AS review_count,
  rst2_phone AS phone,
  owner_name,
  parcel_id,
  p_assessed_value AS assessed_value,
  p_appraised_value AS appraised_value,
  COALESCE(p_building_class, rst2_building_class, property_class) AS building_class,
  county,
  building_sqft,
  land_acres,
  current_occupancy,
  avg_rent,
  market_rent,
  jedi_score,
  submarket_id,
  pipeline_stage,
  acquisition_date,
  acquisition_price,
  ARRAY_REMOVE(ARRAY[
    'properties',
    CASE WHEN rst2_id IS NOT NULL THEN 'rent_scrape_targets' END
  ], NULL) AS sources,
  GREATEST(p_updated, rst2_updated) AS last_updated
FROM unlinked_props

UNION ALL

SELECT
  NULL AS property_record_id,
  NULL AS properties_id,
  rst_id AS scrape_target_id,
  property_name AS name,
  address,
  city,
  state,
  zip,
  unit_count,
  year_built,
  latitude AS latitude,
  longitude AS longitude,
  website_url,
  google_rating,
  review_count,
  phone,
  NULL AS owner_name,
  NULL AS parcel_id,
  NULL AS assessed_value,
  NULL AS appraised_value,
  building_class,
  NULL AS county,
  NULL AS building_sqft,
  NULL AS land_acres,
  NULL AS current_occupancy,
  NULL AS avg_rent,
  NULL AS market_rent,
  NULL AS jedi_score,
  NULL AS submarket_id,
  NULL AS pipeline_stage,
  NULL::DATE AS acquisition_date,
  NULL::NUMERIC AS acquisition_price,
  ARRAY['rent_scrape_targets'] AS sources,
  updated_at AS last_updated
FROM unlinked_rst;

CREATE INDEX IF NOT EXISTS idx_v_unified_city
  ON v_unified_properties(city);

CREATE INDEX IF NOT EXISTS idx_v_unified_unit_count
  ON v_unified_properties(unit_count);

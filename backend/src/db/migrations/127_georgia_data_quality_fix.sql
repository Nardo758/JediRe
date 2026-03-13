-- Migration 127: Georgia Property Records Data Quality Fix
-- Fixes: "0 STREET" sub-parcels, property_name = address duplication,
--        null city defaults, and updates sync function for future runs.

-- 0. Schema changes: allow NULL property_name, remove bad city default
ALTER TABLE rent_scrape_targets ALTER COLUMN property_name DROP NOT NULL;
ALTER TABLE rent_scrape_targets ALTER COLUMN city DROP DEFAULT;

-- 1. Deactivate "0 STREET" sub-parcel entries in rent_scrape_targets
UPDATE rent_scrape_targets
SET active = FALSE, updated_at = NOW()
WHERE address LIKE '0 %' AND source = 'property_records';

UPDATE property_records
SET enrichment_source = 'invalid_parcel_address'
WHERE address LIKE '0 %'
  AND state = 'GA'
  AND units >= 100
  AND (enrichment_source IS NULL OR enrichment_source != 'invalid_parcel_address');

-- 2. Null out property_name where it duplicates the address
UPDATE rent_scrape_targets
SET property_name = NULL, updated_at = NOW()
WHERE property_name IS NOT NULL
  AND address IS NOT NULL
  AND LOWER(TRIM(property_name)) = LOWER(TRIM(address))
  AND source = 'property_records';

-- 3. Replace unique constraint: (property_name, city) -> unique index on (address, city)
ALTER TABLE rent_scrape_targets DROP CONSTRAINT IF EXISTS uq_rent_scrape_targets_name_city;
DROP INDEX IF EXISTS uq_rent_scrape_targets_name_city;

-- 3a. Deduplicate: keep best row per (address, city), deactivate the rest.
--     "Best" = has website_url, then has property_name, then lowest id.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY LOWER(TRIM(address)), LOWER(TRIM(city))
           ORDER BY
             (website_url IS NOT NULL) DESC,
             (property_name IS NOT NULL AND LOWER(TRIM(property_name)) != LOWER(TRIM(address))) DESC,
             id ASC
         ) AS rn
  FROM rent_scrape_targets
)
UPDATE rent_scrape_targets
SET active = FALSE, updated_at = NOW()
WHERE id IN (SELECT id FROM ranked WHERE rn > 1)
  AND active = TRUE;

-- 3b. Delete truly duplicate inactive rows so unique index can be created
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY LOWER(TRIM(address)), LOWER(TRIM(city))
           ORDER BY
             active DESC,
             (website_url IS NOT NULL) DESC,
             (property_name IS NOT NULL AND LOWER(TRIM(property_name)) != LOWER(TRIM(address))) DESC,
             id ASC
         ) AS rn
  FROM rent_scrape_targets
)
DELETE FROM rent_scrape_targets
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

CREATE UNIQUE INDEX uq_rent_scrape_targets_addr_city
  ON rent_scrape_targets (LOWER(TRIM(address)), LOWER(TRIM(city)));

-- 4. Reset places_search_done for property_records-sourced targets that were
--    searched with bad city data (null city defaulted to Atlanta)
UPDATE rent_scrape_targets
SET places_search_done = FALSE,
    website_url = NULL,
    google_rating = NULL,
    review_count = NULL,
    phone = NULL,
    updated_at = NOW()
WHERE source = 'property_records'
  AND places_search_done = TRUE
  AND property_record_id IS NOT NULL
  AND property_record_id IN (
    SELECT id FROM property_records WHERE city IS NULL AND state = 'GA' AND units >= 100
  );

-- 5. Replace sync function with fixed version:
--    - property_name = NULL (to be enriched later via SERP)
--    - Requires non-null, non-empty city
--    - Skips "0 STREET" addresses
--    - Uses ON CONFLICT (address, city) via the new index
CREATE OR REPLACE FUNCTION sync_property_records_to_targets(p_market TEXT DEFAULT 'Atlanta')
RETURNS TABLE(inserted_count INT, skipped_count INT, total_records INT) AS $$
DECLARE
  v_total INT;
  v_inserted INT;
BEGIN
  SELECT COUNT(*) INTO v_total
  FROM (
    SELECT DISTINCT ON (LOWER(TRIM(pr.address)), LOWER(TRIM(pr.city)))
      pr.id
    FROM property_records pr
    WHERE pr.address IS NOT NULL
      AND TRIM(pr.address) != ''
      AND pr.address NOT LIKE '0 %'
      AND pr.city IS NOT NULL
      AND TRIM(pr.city) != ''
      AND pr.units >= 100
      AND (
        p_market IS NULL
        OR pr.city ILIKE p_market
      )
    ORDER BY LOWER(TRIM(pr.address)), LOWER(TRIM(pr.city)), pr.units DESC
  ) deduped;

  WITH deduped_records AS (
    SELECT DISTINCT ON (LOWER(TRIM(pr.address)), LOWER(TRIM(pr.city)))
      pr.*
    FROM property_records pr
    WHERE pr.address IS NOT NULL
      AND TRIM(pr.address) != ''
      AND pr.address NOT LIKE '0 %'
      AND pr.city IS NOT NULL
      AND TRIM(pr.city) != ''
      AND pr.units >= 100
      AND (
        p_market IS NULL
        OR pr.city ILIKE p_market
      )
    ORDER BY LOWER(TRIM(pr.address)), LOWER(TRIM(pr.city)), pr.units DESC
  ),
  inserted AS (
    INSERT INTO rent_scrape_targets (
      property_name,
      address,
      city,
      state,
      zip,
      unit_count,
      year_built,
      building_class,
      market,
      source,
      active,
      property_record_id,
      created_at,
      updated_at
    )
    SELECT
      NULL                                        AS property_name,
      TRIM(dr.address)                            AS address,
      TRIM(dr.city)                               AS city,
      COALESCE(dr.state, 'GA')                    AS state,
      dr.zip_code                                 AS zip,
      dr.units                                    AS unit_count,
      NULLIF(REGEXP_REPLACE(dr.year_built, '[^0-9]', '', 'g'), '')::INT AS year_built,
      dr.property_class                           AS building_class,
      TRIM(dr.city)                               AS market,
      'property_records'                          AS source,
      TRUE                                        AS active,
      dr.id                                       AS property_record_id,
      NOW()                                       AS created_at,
      NOW()                                       AS updated_at
    FROM deduped_records dr
    ON CONFLICT (LOWER(TRIM(address)), LOWER(TRIM(city))) DO UPDATE SET
      property_record_id = COALESCE(EXCLUDED.property_record_id, rent_scrape_targets.property_record_id),
      unit_count = GREATEST(EXCLUDED.unit_count, rent_scrape_targets.unit_count),
      updated_at = NOW()
    RETURNING 1
  )
  SELECT COUNT(*)::INT INTO v_inserted FROM inserted;

  RETURN QUERY SELECT v_inserted, (v_total - v_inserted)::INT, v_total;
END;
$$ LANGUAGE plpgsql;

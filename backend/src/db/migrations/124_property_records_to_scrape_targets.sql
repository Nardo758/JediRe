ALTER TABLE rent_scrape_targets
  ADD COLUMN IF NOT EXISTS property_record_id UUID REFERENCES property_records(id);

CREATE INDEX IF NOT EXISTS idx_rst_property_record_id
  ON rent_scrape_targets(property_record_id)
  WHERE property_record_id IS NOT NULL;

CREATE OR REPLACE FUNCTION sync_property_records_to_targets(p_market TEXT DEFAULT 'Atlanta')
RETURNS TABLE(inserted_count INT, skipped_count INT, total_records INT) AS $$
DECLARE
  v_total INT;
  v_inserted INT;
BEGIN
  SELECT COUNT(*) INTO v_total
  FROM (
    SELECT DISTINCT ON (TRIM(pr.address), COALESCE(TRIM(pr.city), p_market))
      pr.id
    FROM property_records pr
    WHERE pr.address IS NOT NULL
      AND TRIM(pr.address) != ''
      AND pr.units >= 100
      AND (
        p_market IS NULL
        OR pr.city ILIKE p_market
        OR pr.address ILIKE '%' || p_market || '%'
        OR pr.state = 'GA'
      )
    ORDER BY TRIM(pr.address), COALESCE(TRIM(pr.city), p_market), pr.units DESC
  ) deduped;

  WITH deduped_records AS (
    SELECT DISTINCT ON (TRIM(pr.address), COALESCE(TRIM(pr.city), p_market))
      pr.*
    FROM property_records pr
    WHERE pr.address IS NOT NULL
      AND TRIM(pr.address) != ''
      AND pr.units >= 100
      AND (
        p_market IS NULL
        OR pr.city ILIKE p_market
        OR pr.address ILIKE '%' || p_market || '%'
        OR pr.state = 'GA'
      )
    ORDER BY TRIM(pr.address), COALESCE(TRIM(pr.city), p_market), pr.units DESC
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
      TRIM(dr.address)                            AS property_name,
      TRIM(dr.address)                            AS address,
      COALESCE(TRIM(dr.city), p_market)           AS city,
      COALESCE(dr.state, 'GA')                    AS state,
      dr.zip_code                                 AS zip,
      dr.units                                    AS unit_count,
      NULLIF(REGEXP_REPLACE(dr.year_built, '[^0-9]', '', 'g'), '')::INT AS year_built,
      dr.property_class                           AS building_class,
      COALESCE(TRIM(dr.city), p_market)           AS market,
      'property_records'                          AS source,
      TRUE                                        AS active,
      dr.id                                       AS property_record_id,
      NOW()                                       AS created_at,
      NOW()                                       AS updated_at
    FROM deduped_records dr
    ON CONFLICT (property_name, city) DO UPDATE SET
      property_record_id = EXCLUDED.property_record_id
    WHERE rent_scrape_targets.property_record_id IS NULL
    RETURNING 1
  )
  SELECT COUNT(*)::INT INTO v_inserted FROM inserted;

  RETURN QUERY SELECT v_inserted, (v_total - v_inserted)::INT, v_total;
END;
$$ LANGUAGE plpgsql;

SELECT * FROM sync_property_records_to_targets('Atlanta');

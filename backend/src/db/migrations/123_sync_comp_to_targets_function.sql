-- Migration 123: Create sync_comp_to_targets() database function
-- Syncs comp_properties rows into rent_scrape_targets
-- Maps: name → property_name, total_units → unit_count, built_year → year_built
-- Uses ON CONFLICT to skip duplicates (unique on property_name, city)
-- Fixes parenthesis precedence bug: OR cp.address ILIKE '%GA%' is properly
-- grouped so it doesn't bypass the NOT EXISTS check

CREATE OR REPLACE FUNCTION sync_comp_to_targets(p_market TEXT DEFAULT 'Atlanta')
RETURNS TABLE(inserted_count INT, skipped_count INT, total_comps INT) AS $$
DECLARE
  v_total INT;
  v_inserted INT;
BEGIN
  SELECT COUNT(*) INTO v_total
  FROM comp_properties cp
  WHERE cp.name IS NOT NULL
    AND TRIM(cp.name) != ''
    AND (
      cp.address ILIKE '%' || p_market || '%'
      OR cp.address ILIKE '%GA%'
    );

  WITH inserted AS (
    INSERT INTO rent_scrape_targets (
      property_name,
      address,
      city,
      state,
      unit_count,
      year_built,
      building_class,
      market,
      source,
      active,
      created_at,
      updated_at
    )
    SELECT
      TRIM(cp.name)                           AS property_name,
      TRIM(cp.address)                        AS address,
      p_market                                AS city,
      'GA'                                    AS state,
      cp.total_units                          AS unit_count,
      cp.built_year                           AS year_built,
      cp.class                                AS building_class,
      p_market                                AS market,
      'comp_properties'                       AS source,
      TRUE                                    AS active,
      NOW()                                   AS created_at,
      NOW()                                   AS updated_at
    FROM comp_properties cp
    WHERE cp.name IS NOT NULL
      AND TRIM(cp.name) != ''
      AND (
        cp.address ILIKE '%' || p_market || '%'
        OR cp.address ILIKE '%GA%'
      )
    ON CONFLICT (property_name, city) DO NOTHING
    RETURNING 1
  )
  SELECT COUNT(*)::INT INTO v_inserted FROM inserted;

  RETURN QUERY SELECT v_inserted, (v_total - v_inserted)::INT, v_total;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sync_properties_to_targets(p_market TEXT DEFAULT NULL)
RETURNS TABLE(inserted_count INT, skipped_count INT, total_props INT) AS $$
DECLARE
  v_total INT;
  v_inserted INT;
BEGIN
  SELECT COUNT(*) INTO v_total
  FROM properties p
  WHERE p.property_type = 'multi_family'
    AND p.name IS NOT NULL
    AND TRIM(p.name) != ''
    AND (p_market IS NULL OR LOWER(TRIM(p.city)) = LOWER(TRIM(p_market)));

  WITH inserted AS (
    INSERT INTO rent_scrape_targets (
      property_name,
      address,
      city,
      state,
      unit_count,
      year_built,
      latitude,
      longitude,
      building_class,
      market,
      submarket,
      source,
      active,
      created_at,
      updated_at
    )
    SELECT
      TRIM(p.name)                                                              AS property_name,
      TRIM(p.address_line1)                                                     AS address,
      TRIM(p.city)                                                              AS city,
      COALESCE(p.state_code, 'GA')                                              AS state,
      p.units                                                                   AS unit_count,
      p.year_built                                                              AS year_built,
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
      TRUE                                                                      AS active,
      NOW()                                                                     AS created_at,
      NOW()                                                                     AS updated_at
    FROM properties p
    WHERE p.property_type = 'multi_family'
      AND p.name IS NOT NULL
      AND TRIM(p.name) != ''
      AND (p_market IS NULL OR LOWER(TRIM(p.city)) = LOWER(TRIM(p_market)))
    ON CONFLICT (property_name, city) DO NOTHING
    RETURNING 1
  )
  SELECT COUNT(*)::INT INTO v_inserted FROM inserted;

  RETURN QUERY SELECT v_inserted, (v_total - v_inserted)::INT, v_total;
END;
$$ LANGUAGE plpgsql;

-- One-time backfill: execute sync for Atlanta market from both source tables
SELECT * FROM sync_comp_to_targets('Atlanta');
SELECT * FROM sync_properties_to_targets('Atlanta');

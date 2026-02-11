-- Migration 022: Seed Atlanta Metro Geographic Data
-- Purpose: Populate MSA, submarkets, and sample trade areas for testing
-- Created: 2026-02-10

-- ============================================
-- ATLANTA MSA
-- ============================================

INSERT INTO msas (
    name,
    cbsa_code,
    state_codes,
    geometry,
    population,
    median_household_income,
    total_properties,
    total_units,
    avg_occupancy,
    avg_rent
) VALUES (
    'Atlanta-Sandy Springs-Roswell, GA',
    '12060',
    ARRAY['GA'],
    -- Simplified polygon covering metro Atlanta (real data would use Census TIGER/Line)
    -- Rough bounds: -85.0 to -83.8 longitude, 33.4 to 34.2 latitude
    ST_GeomFromText(
        'MULTIPOLYGON(((-85.0 33.4, -85.0 34.2, -83.8 34.2, -83.8 33.4, -85.0 33.4)))',
        4326
    ),
    6144050,
    71936.00,
    1250,
    385000,
    89.5,
    1850.00
) ON CONFLICT (cbsa_code) DO UPDATE SET
    population = EXCLUDED.population,
    median_household_income = EXCLUDED.median_household_income,
    total_properties = EXCLUDED.total_properties,
    total_units = EXCLUDED.total_units,
    avg_occupancy = EXCLUDED.avg_occupancy,
    avg_rent = EXCLUDED.avg_rent,
    updated_at = NOW();

-- ============================================
-- ATLANTA SUBMARKETS
-- ============================================

-- Get Atlanta MSA ID for foreign key reference
DO $$
DECLARE
    atlanta_msa_id INTEGER;
BEGIN
    SELECT id INTO atlanta_msa_id FROM msas WHERE cbsa_code = '12060';
    
    -- Midtown Atlanta
    INSERT INTO submarkets (
        name,
        msa_id,
        geometry,
        source,
        properties_count,
        total_units,
        avg_occupancy,
        avg_rent,
        avg_cap_rate
    ) VALUES (
        'Midtown Atlanta',
        atlanta_msa_id,
        ST_GeomFromText(
            'MULTIPOLYGON(((-84.40 33.77, -84.40 33.81, -84.36 33.81, -84.36 33.77, -84.40 33.77)))',
            4326
        ),
        'manual',
        142,
        38500,
        92.3,
        2150.00,
        4.8
    ) ON CONFLICT (name, msa_id) DO UPDATE SET
        properties_count = EXCLUDED.properties_count,
        total_units = EXCLUDED.total_units,
        avg_occupancy = EXCLUDED.avg_occupancy,
        avg_rent = EXCLUDED.avg_rent,
        avg_cap_rate = EXCLUDED.avg_cap_rate,
        updated_at = NOW();
    
    -- Buckhead
    INSERT INTO submarkets (
        name,
        msa_id,
        geometry,
        source,
        properties_count,
        total_units,
        avg_occupancy,
        avg_rent,
        avg_cap_rate
    ) VALUES (
        'Buckhead',
        atlanta_msa_id,
        ST_GeomFromText(
            'MULTIPOLYGON(((-84.42 33.83, -84.42 33.89, -84.35 33.89, -84.35 33.83, -84.42 33.83)))',
            4326
        ),
        'manual',
        238,
        52800,
        93.8,
        2380.00,
        4.5
    ) ON CONFLICT (name, msa_id) DO UPDATE SET
        properties_count = EXCLUDED.properties_count,
        total_units = EXCLUDED.total_units,
        avg_occupancy = EXCLUDED.avg_occupancy,
        avg_rent = EXCLUDED.avg_rent,
        avg_cap_rate = EXCLUDED.avg_cap_rate,
        updated_at = NOW();
    
    -- Virginia Highland
    INSERT INTO submarkets (
        name,
        msa_id,
        geometry,
        source,
        properties_count,
        total_units,
        avg_occupancy,
        avg_rent,
        avg_cap_rate
    ) VALUES (
        'Virginia Highland',
        atlanta_msa_id,
        ST_GeomFromText(
            'MULTIPOLYGON(((-84.37 33.78, -84.37 33.81, -84.33 33.81, -84.33 33.78, -84.37 33.78)))',
            4326
        ),
        'manual',
        87,
        18200,
        94.5,
        1950.00,
        4.9
    ) ON CONFLICT (name, msa_id) DO UPDATE SET
        properties_count = EXCLUDED.properties_count,
        total_units = EXCLUDED.total_units,
        avg_occupancy = EXCLUDED.avg_occupancy,
        avg_rent = EXCLUDED.avg_rent,
        avg_cap_rate = EXCLUDED.avg_cap_rate,
        updated_at = NOW();
    
    -- Sandy Springs
    INSERT INTO submarkets (
        name,
        msa_id,
        geometry,
        source,
        properties_count,
        total_units,
        avg_occupancy,
        avg_rent,
        avg_cap_rate
    ) VALUES (
        'Sandy Springs',
        atlanta_msa_id,
        ST_GeomFromText(
            'MULTIPOLYGON(((-84.42 33.92, -84.42 34.00, -84.32 34.00, -84.32 33.92, -84.42 33.92)))',
            4326
        ),
        'manual',
        156,
        42100,
        91.2,
        1820.00,
        5.1
    ) ON CONFLICT (name, msa_id) DO UPDATE SET
        properties_count = EXCLUDED.properties_count,
        total_units = EXCLUDED.total_units,
        avg_occupancy = EXCLUDED.avg_occupancy,
        avg_rent = EXCLUDED.avg_rent,
        avg_cap_rate = EXCLUDED.avg_cap_rate,
        updated_at = NOW();
    
    -- Decatur
    INSERT INTO submarkets (
        name,
        msa_id,
        geometry,
        source,
        properties_count,
        total_units,
        avg_occupancy,
        avg_rent,
        avg_cap_rate
    ) VALUES (
        'Decatur',
        atlanta_msa_id,
        ST_GeomFromText(
            'MULTIPOLYGON(((-84.32 33.75, -84.32 33.80, -84.26 33.80, -84.26 33.75, -84.32 33.75)))',
            4326
        ),
        'manual',
        98,
        22400,
        92.8,
        1780.00,
        5.0
    ) ON CONFLICT (name, msa_id) DO UPDATE SET
        properties_count = EXCLUDED.properties_count,
        total_units = EXCLUDED.total_units,
        avg_occupancy = EXCLUDED.avg_occupancy,
        avg_rent = EXCLUDED.avg_rent,
        avg_cap_rate = EXCLUDED.avg_cap_rate,
        updated_at = NOW();
    
    -- Perimeter Center
    INSERT INTO submarkets (
        name,
        msa_id,
        geometry,
        source,
        properties_count,
        total_units,
        avg_occupancy,
        avg_rent,
        avg_cap_rate
    ) VALUES (
        'Perimeter Center',
        atlanta_msa_id,
        ST_GeomFromText(
            'MULTIPOLYGON(((-84.38 33.91, -84.38 33.96, -84.32 33.96, -84.32 33.91, -84.38 33.91)))',
            4326
        ),
        'manual',
        185,
        48900,
        90.5,
        1950.00,
        5.2
    ) ON CONFLICT (name, msa_id) DO UPDATE SET
        properties_count = EXCLUDED.properties_count,
        total_units = EXCLUDED.total_units,
        avg_occupancy = EXCLUDED.avg_occupancy,
        avg_rent = EXCLUDED.avg_rent,
        avg_cap_rate = EXCLUDED.avg_cap_rate,
        updated_at = NOW();
    
    -- Cumberland/Galleria
    INSERT INTO submarkets (
        name,
        msa_id,
        geometry,
        source,
        properties_count,
        total_units,
        avg_occupancy,
        avg_rent,
        avg_cap_rate
    ) VALUES (
        'Cumberland/Galleria',
        atlanta_msa_id,
        ST_GeomFromText(
            'MULTIPOLYGON(((-84.52 33.86, -84.52 33.91, -84.44 33.91, -84.44 33.86, -84.52 33.86)))',
            4326
        ),
        'manual',
        172,
        46200,
        88.9,
        1680.00,
        5.5
    ) ON CONFLICT (name, msa_id) DO UPDATE SET
        properties_count = EXCLUDED.properties_count,
        total_units = EXCLUDED.total_units,
        avg_occupancy = EXCLUDED.avg_occupancy,
        avg_rent = EXCLUDED.avg_rent,
        avg_cap_rate = EXCLUDED.avg_cap_rate,
        updated_at = NOW();
    
    -- North Druid Hills
    INSERT INTO submarkets (
        name,
        msa_id,
        geometry,
        source,
        properties_count,
        total_units,
        avg_occupancy,
        avg_rent,
        avg_cap_rate
    ) VALUES (
        'North Druid Hills',
        atlanta_msa_id,
        ST_GeomFromText(
            'MULTIPOLYGON(((-84.36 33.81, -84.36 33.85, -84.30 33.85, -84.30 33.81, -84.36 33.81)))',
            4326
        ),
        'manual',
        64,
        15800,
        91.4,
        1620.00,
        5.3
    ) ON CONFLICT (name, msa_id) DO UPDATE SET
        properties_count = EXCLUDED.properties_count,
        total_units = EXCLUDED.total_units,
        avg_occupancy = EXCLUDED.avg_occupancy,
        avg_rent = EXCLUDED.avg_rent,
        avg_cap_rate = EXCLUDED.avg_cap_rate,
        updated_at = NOW();
    
    -- West Midtown
    INSERT INTO submarkets (
        name,
        msa_id,
        geometry,
        source,
        properties_count,
        total_units,
        avg_occupancy,
        avg_rent,
        avg_cap_rate
    ) VALUES (
        'West Midtown',
        atlanta_msa_id,
        ST_GeomFromText(
            'MULTIPOLYGON(((-84.42 33.77, -84.42 33.80, -84.39 33.80, -84.39 33.77, -84.42 33.77)))',
            4326
        ),
        'manual',
        76,
        19200,
        93.2,
        2280.00,
        4.6
    ) ON CONFLICT (name, msa_id) DO UPDATE SET
        properties_count = EXCLUDED.properties_count,
        total_units = EXCLUDED.total_units,
        avg_occupancy = EXCLUDED.avg_occupancy,
        avg_rent = EXCLUDED.avg_rent,
        avg_cap_rate = EXCLUDED.avg_cap_rate,
        updated_at = NOW();
    
    -- Vinings/Smyrna
    INSERT INTO submarkets (
        name,
        msa_id,
        geometry,
        source,
        properties_count,
        total_units,
        avg_occupancy,
        avg_rent,
        avg_cap_rate
    ) VALUES (
        'Vinings/Smyrna',
        atlanta_msa_id,
        ST_GeomFromText(
            'MULTIPOLYGON(((-84.52 33.83, -84.52 33.88, -84.45 33.88, -84.45 33.83, -84.52 33.83)))',
            4326
        ),
        'manual',
        143,
        38700,
        89.8,
        1720.00,
        5.4
    ) ON CONFLICT (name, msa_id) DO UPDATE SET
        properties_count = EXCLUDED.properties_count,
        total_units = EXCLUDED.total_units,
        avg_occupancy = EXCLUDED.avg_occupancy,
        avg_rent = EXCLUDED.avg_rent,
        avg_cap_rate = EXCLUDED.avg_cap_rate,
        updated_at = NOW();
        
END $$;

-- ============================================
-- SAMPLE TRADE AREAS (for testing)
-- ============================================

-- Note: These require existing properties and users
-- In a real deployment, trade areas would be created by users via the UI
-- This creates examples if test user (id=1) exists

DO $$
DECLARE
    atlanta_msa_id INTEGER;
    midtown_submarket_id INTEGER;
    buckhead_submarket_id INTEGER;
    test_user_id INTEGER := 1;
BEGIN
    -- Get IDs
    SELECT id INTO atlanta_msa_id FROM msas WHERE cbsa_code = '12060';
    SELECT id INTO midtown_submarket_id FROM submarkets WHERE name = 'Midtown Atlanta';
    SELECT id INTO buckhead_submarket_id FROM submarkets WHERE name = 'Buckhead';
    
    -- Check if test user exists
    IF EXISTS (SELECT 1 FROM users WHERE id = test_user_id) THEN
        
        -- Trade Area 1: Midtown 3-Mile Radius
        INSERT INTO trade_areas (
            name,
            user_id,
            geometry,
            definition_method,
            method_params,
            confidence_score,
            stats_snapshot,
            is_shared
        ) VALUES (
            'Midtown 3-Mile Radius',
            test_user_id,
            -- 3-mile radius circle around Midtown (approx)
            ST_Buffer(
                ST_SetSRID(ST_MakePoint(-84.38, 33.79), 4326)::geography,
                4828.03  -- 3 miles in meters
            )::geometry,
            'radius',
            '{"radius_miles": 3, "center": {"lat": 33.79, "lng": -84.38}}'::jsonb,
            0.85,
            '{"population": 42850, "existing_units": 8240, "pipeline_units": 1200, "avg_rent": 2150}'::jsonb,
            true
        ) ON CONFLICT DO NOTHING;
        
        -- Trade Area 2: Buckhead 2-Mile Radius
        INSERT INTO trade_areas (
            name,
            user_id,
            geometry,
            definition_method,
            method_params,
            confidence_score,
            stats_snapshot,
            is_shared
        ) VALUES (
            'Buckhead 2-Mile Radius',
            test_user_id,
            -- 2-mile radius circle around Buckhead
            ST_Buffer(
                ST_SetSRID(ST_MakePoint(-84.38, 33.86), 4326)::geography,
                3218.69  -- 2 miles in meters
            )::geometry,
            'radius',
            '{"radius_miles": 2, "center": {"lat": 33.86, "lng": -84.38}}'::jsonb,
            0.88,
            '{"population": 38200, "existing_units": 6850, "pipeline_units": 980, "avg_rent": 2380}'::jsonb,
            true
        ) ON CONFLICT DO NOTHING;
        
        -- Trade Area 3: Virginia Highland 1.5-Mile Radius
        INSERT INTO trade_areas (
            name,
            user_id,
            geometry,
            definition_method,
            method_params,
            confidence_score,
            stats_snapshot,
            is_shared
        ) VALUES (
            'Virginia Highland 1.5-Mile Radius',
            test_user_id,
            -- 1.5-mile radius
            ST_Buffer(
                ST_SetSRID(ST_MakePoint(-84.35, 33.795), 4326)::geography,
                2414.02  -- 1.5 miles in meters
            )::geometry,
            'radius',
            '{"radius_miles": 1.5, "center": {"lat": 33.795, "lng": -84.35}}'::jsonb,
            0.82,
            '{"population": 28400, "existing_units": 4560, "pipeline_units": 420, "avg_rent": 1950}'::jsonb,
            false
        ) ON CONFLICT DO NOTHING;
        
        -- Create geographic relationships for the trade areas
        INSERT INTO geographic_relationships (trade_area_id, submarket_id, msa_id, overlap_pct, is_primary)
        SELECT 
            ta.id,
            midtown_submarket_id,
            atlanta_msa_id,
            75.0,
            true
        FROM trade_areas ta
        WHERE ta.name = 'Midtown 3-Mile Radius'
        ON CONFLICT (trade_area_id, submarket_id) DO NOTHING;
        
        INSERT INTO geographic_relationships (trade_area_id, submarket_id, msa_id, overlap_pct, is_primary)
        SELECT 
            ta.id,
            buckhead_submarket_id,
            atlanta_msa_id,
            80.0,
            true
        FROM trade_areas ta
        WHERE ta.name = 'Buckhead 2-Mile Radius'
        ON CONFLICT (trade_area_id, submarket_id) DO NOTHING;
        
    END IF;
END $$;

-- ============================================
-- SUMMARY REPORT
-- ============================================

DO $$
DECLARE
    msa_count INTEGER;
    submarket_count INTEGER;
    trade_area_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO msa_count FROM msas;
    SELECT COUNT(*) INTO submarket_count FROM submarkets;
    SELECT COUNT(*) INTO trade_area_count FROM trade_areas;
    
    RAISE NOTICE '==========================================';
    RAISE NOTICE 'Atlanta Geography Seeding Complete';
    RAISE NOTICE '==========================================';
    RAISE NOTICE 'MSAs: %', msa_count;
    RAISE NOTICE 'Submarkets: %', submarket_count;
    RAISE NOTICE 'Trade Areas: %', trade_area_count;
    RAISE NOTICE '==========================================';
END $$;

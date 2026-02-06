-- JEDI RE Sample Data
-- This file inserts sample data for testing and demonstration

-- ============================================================================
-- SAMPLE SUBMARKET: Buckhead, Atlanta
-- ============================================================================

INSERT INTO submarkets (
    name, city, state, 
    center_lat, center_lon,
    population, population_growth_rate, median_income, employment, employment_growth_rate
) VALUES (
    'Buckhead',
    'Atlanta',
    'GA',
    33.840675, -84.381672,  -- Buckhead coordinates
    105000,                 -- Estimated population
    0.0185,                 -- 1.85% annual growth
    125000.00,              -- Median income
    85000,                  -- Employment
    0.0210                  -- 2.10% employment growth
);

-- ============================================================================
-- SAMPLE PROPERTY: Luxury Apartment in Buckhead
-- ============================================================================

INSERT INTO properties (
    submarket_id,
    name,
    address,
    lat,
    lon,
    total_units,
    year_built,
    year_renovated,
    vintage_class,
    owner_name,
    owner_type,
    status,
    costar_id
) VALUES (
    (SELECT id FROM submarkets WHERE name = 'Buckhead' AND city = 'Atlanta'),
    'The Sovereign at Buckhead',
    '3344 Peachtree Rd NE, Atlanta, GA 30326',
    33.8489, -84.3679,
    350,
    2019,
    NULL,
    'A',
    'Greystar Real Estate Partners',
    'Institutional',
    'Existing',
    'CS-ATL-BUCK-SOV-001'
);

-- ============================================================================
-- SAMPLE RENT DATA (12 weeks of simulated data)
-- ============================================================================

-- Get the property ID
DO $$
DECLARE
    property_id INTEGER;
    week_date TIMESTAMPTZ;
    base_studio DECIMAL(10, 2) := 2200.00;
    base_one_bed DECIMAL(10, 2) := 2800.00;
    base_two_bed DECIMAL(10, 2) := 3800.00;
    base_three_bed DECIMAL(10, 2) := 5200.00;
    week_offset INTEGER;
    rent_growth_rate DECIMAL(6, 4) := 0.0015; -- 0.15% weekly growth
    seasonal_factor DECIMAL(6, 4);
    current_studio DECIMAL(10, 2);
    current_one_bed DECIMAL(10, 2);
    current_two_bed DECIMAL(10, 2);
    current_three_bed DECIMAL(10, 2);
    current_weighted_avg DECIMAL(10, 2);
    current_rent_psf DECIMAL(6, 3);
    occupancy_pct DECIMAL(5, 2);
    concession_weeks INTEGER;
BEGIN
    -- Get the property ID
    SELECT id INTO property_id FROM properties WHERE name = 'The Sovereign at Buckhead';
    
    -- Generate 12 weeks of data (starting from 12 weeks ago)
    FOR week_offset IN 0..11 LOOP
        -- Calculate date (each Monday)
        week_date := DATE_TRUNC('week', NOW() - INTERVAL '12 weeks') + INTERVAL '1 day' + (week_offset * INTERVAL '1 week');
        
        -- Calculate seasonal factor (slight dip in winter, peak in summer)
        CASE EXTRACT(MONTH FROM week_date)
            WHEN 12 THEN seasonal_factor := 0.98;  -- December dip
            WHEN 1 THEN seasonal_factor := 0.97;   -- January dip
            WHEN 2 THEN seasonal_factor := 0.98;   -- February
            WHEN 7 THEN seasonal_factor := 1.03;   -- July peak
            WHEN 8 THEN seasonal_factor := 1.02;   -- August peak
            ELSE seasonal_factor := 1.00;
        END CASE;
        
        -- Calculate current rents with growth and seasonality
        current_studio := base_studio * (1 + (rent_growth_rate * week_offset)) * seasonal_factor;
        current_one_bed := base_one_bed * (1 + (rent_growth_rate * week_offset)) * seasonal_factor;
        current_two_bed := base_two_bed * (1 + (rent_growth_rate * week_offset)) * seasonal_factor;
        current_three_bed := base_three_bed * (1 + (rent_growth_rate * week_offset)) * seasonal_factor;
        
        -- Calculate weighted average (assuming unit mix: 20% studio, 40% 1-bed, 30% 2-bed, 10% 3-bed)
        current_weighted_avg := 
            (current_studio * 0.20) + 
            (current_one_bed * 0.40) + 
            (current_two_bed * 0.30) + 
            (current_three_bed * 0.10);
        
        -- Calculate rent per square foot (assuming avg unit sizes)
        current_rent_psf := current_weighted_avg / 950;  -- ~950 sqft average
        
        -- Occupancy varies slightly
        occupancy_pct := 94.5 + (RANDOM() * 3.0);  -- Between 94.5% and 97.5%
        
        -- Concessions (more in winter)
        IF EXTRACT(MONTH FROM week_date) IN (1, 2, 12) THEN
            concession_weeks := 1;
        ELSE
            concession_weeks := 0;
        END IF;
        
        -- Insert rent data
        INSERT INTO rents_timeseries (
            property_id,
            timestamp,
            studio_avg,
            one_bed_avg,
            two_bed_avg,
            three_bed_avg,
            weighted_avg,
            rent_psf,
            available_units,
            total_units,
            occupancy_pct,
            concession_weeks,
            concession_description,
            source
        ) VALUES (
            property_id,
            week_date,
            ROUND(current_studio, 2),
            ROUND(current_one_bed, 2),
            ROUND(current_two_bed, 2),
            ROUND(current_three_bed, 2),
            ROUND(current_weighted_avg, 2),
            ROUND(current_rent_psf, 3),
            CEIL(350 * (1 - (occupancy_pct / 100))),  -- Available units
            350,  -- Total units
            ROUND(occupancy_pct, 2),
            concession_weeks,
            CASE WHEN concession_weeks > 0 THEN '1 month free on 13-month lease' ELSE NULL END,
            'Simulated'
        );
    END LOOP;
END $$;

-- ============================================================================
-- SAMPLE SUPPLY PIPELINE DATA
-- ============================================================================

INSERT INTO supply_pipeline (
    property_id,
    submarket_id,
    project_name,
    units,
    permit_date,
    construction_start_date,
    estimated_delivery_date,
    status,
    source
) VALUES (
    (SELECT id FROM properties WHERE name = 'The Sovereign at Buckhead'),
    (SELECT id FROM submarkets WHERE name = 'Buckhead' AND city = 'Atlanta'),
    'Buckhead Summit Tower',
    425,
    '2023-06-15',
    '2023-09-01',
    '2025-12-01',
    'Under Construction',
    'CoStar'
);

-- ============================================================================
-- SAMPLE TRAFFIC PROXIES
-- ============================================================================

DO $$
DECLARE
    property_id INTEGER;
    traffic_date TIMESTAMPTZ;
    day_offset INTEGER;
BEGIN
    SELECT id INTO property_id FROM properties WHERE name = 'The Sovereign at Buckhead';
    
    -- Insert 7 days of traffic data (last week)
    FOR day_offset IN 0..6 LOOP
        traffic_date := DATE_TRUNC('day', NOW() - INTERVAL '7 days') + (day_offset * INTERVAL '1 day') + INTERVAL '12 hours'; -- Noon each day
        
        INSERT INTO traffic_proxies (
            property_id,
            timestamp,
            traffic_type,
            traffic_count,
            measurement_location,
            distance_from_property_meters,
            source
        ) VALUES (
            property_id,
            traffic_date,
            'DOT_Count',
            12500 + (RANDOM() * 2500)::INTEGER,  -- 12,500 to 15,000 vehicles
            'Peachtree Rd at Lenox Rd',
            150,
            'GDOT'
        );
    END LOOP;
END $$;

-- ============================================================================
-- SAMPLE SEARCH TRENDS
-- ============================================================================

DO $$
DECLARE
    submarket_id INTEGER;
    month_date TIMESTAMPTZ;
    month_offset INTEGER;
BEGIN
    SELECT id INTO submarket_id FROM submarkets WHERE name = 'Buckhead' AND city = 'Atlanta';
    
    -- Insert 6 months of search trend data
    FOR month_offset IN 0..5 LOOP
        month_date := DATE_TRUNC('month', NOW() - INTERVAL '6 months') + (month_offset * INTERVAL '1 month');
        
        -- Search for "Buckhead apartments"
        INSERT INTO search_trends (
            submarket_id,
            timestamp,
            keyword,
            search_volume,
            interest_score,
            source
        ) VALUES (
            submarket_id,
            month_date,
            'Buckhead apartments',
            8500 + (RANDOM() * 3000)::INTEGER,  -- 8,500 to 11,500 searches
            65 + (RANDOM() * 20)::INTEGER,      -- 65 to 85 interest score
            'Google_Trends'
        );
        
        -- Search for "Atlanta luxury apartments"
        INSERT INTO search_trends (
            submarket_id,
            timestamp,
            keyword,
            search_volume,
            interest_score,
            source
        ) VALUES (
            submarket_id,
            month_date,
            'Atlanta luxury apartments',
            12000 + (RANDOM() * 4000)::INTEGER, -- 12,000 to 16,000 searches
            70 + (RANDOM() * 15)::INTEGER,      -- 70 to 85 interest score
            'Google_Trends'
        );
    END LOOP;
END $$;

-- ============================================================================
-- SAMPLE DEMAND SIGNAL
-- ============================================================================

INSERT INTO demand_signals (
    submarket_id,
    calculated_at,
    signal_strength,
    signal_score,
    confidence,
    rent_growth_rate,
    search_trend_change,
    migration_annual,
    method_version
) VALUES (
    (SELECT id FROM submarkets WHERE name = 'Buckhead' AND city = 'Atlanta'),
    NOW() - INTERVAL '1 day',
    'STRONG',
    82,
    0.87,
    0.0450,  -- 4.5% annual rent growth
    0.1250,  -- 12.5% increase in search trends
    3500,    -- 3,500 net migration annually
    'v1.2.0'
);

-- ============================================================================
-- SAMPLE SUPPLY SIGNAL
-- ============================================================================

INSERT INTO supply_signals (
    submarket_id,
    calculated_at,
    signal_strength,
    signal_score,
    confidence,
    demand_capacity,
    total_supply,
    saturation_pct,
    equilibrium_quarters,
    method_version
) VALUES (
    (SELECT id FROM submarkets WHERE name = 'Buckhead' AND city = 'Atlanta'),
    NOW() - INTERVAL '1 day',
    'MODERATE_UNDERSUPPLY',
    68,
    0.79,
    4200,   -- Demand capacity (units)
    3850,   -- Total supply (units)
    91.7,   -- 91.7% saturation
    6,      -- 6 quarters to equilibrium
    'v1.1.0'
);

-- ============================================================================
-- SAMPLE IMBALANCE SIGNAL
-- ============================================================================

INSERT INTO imbalance_signals (
    submarket_id,
    calculated_at,
    verdict,
    composite_score,
    confidence,
    demand_signal_id,
    supply_signal_id,
    recommendation
) VALUES (
    (SELECT id FROM submarkets WHERE name = 'Buckhead' AND city = 'Atlanta'),
    NOW() - INTERVAL '1 day',
    'STRONG_OPPORTUNITY',
    75,
    0.83,
    (SELECT id FROM demand_signals WHERE submarket_id = (SELECT id FROM submarkets WHERE name = 'Buckhead' AND city = 'Atlanta') ORDER BY calculated_at DESC LIMIT 1),
    (SELECT id FROM supply_signals WHERE submarket_id = (SELECT id FROM submarkets WHERE name = 'Buckhead' AND city = 'Atlanta') ORDER BY calculated_at DESC LIMIT 1),
    'Market shows strong demand with moderate undersupply. Recommended for acquisition with focus on value-add opportunities. Monitor pipeline delivery schedules closely.'
);

-- ============================================================================
-- SAMPLE USER
-- ============================================================================

INSERT INTO users (
    email,
    name,
    password_hash
) VALUES (
    'analyst@jedire.com',
    'Market Analyst',
    -- Password: 'jedire2024' (hashed with bcrypt)
    '$2a$10$N9qo8uLOickgx2ZMRZoMye7.Zv7Cb5YQ9q7p7eB5Qq3.7Q2JQ1qW6'
);

-- ============================================================================
-- SAMPLE DEAL SILO
-- ============================================================================

INSERT INTO deal_silos (
    user_id,
    property_id,
    deal_name,
    status,
    offer_price,
    target_irr,
    notes
) VALUES (
    (SELECT id FROM users WHERE email = 'analyst@jedire.com'),
    (SELECT id FROM properties WHERE name = 'The Sovereign at Buckhead'),
    'Buckhead Sovereign Acquisition',
    'Underwriting',
    185000000.00,  -- $185M
    15.50,         -- 15.5% target IRR
    'Prime Buckhead location. Strong rent growth trajectory. Potential for unit renovations and amenity upgrades.'
);

-- ============================================================================
-- VERIFICATION QUERIES (for setup confirmation)
-- ============================================================================

-- Uncomment to run verification after setup
/*
SELECT '=== DATABASE SETUP VERIFICATION ===' as verification;

SELECT '1. Submarkets:' as check, COUNT(*) as count FROM submarkets
UNION ALL
SELECT '2. Properties:' as check, COUNT(*) as count FROM properties
UNION ALL
SELECT '3. Rent timeseries records:' as check, COUNT(*) as count FROM rents_timeseries
UNION ALL
SELECT '4. Latest rent data:' as check, COUNT(*) as count FROM latest_rents
UNION ALL
SELECT '5. Supply pipeline:' as check, COUNT(*) as count FROM supply_pipeline
UNION ALL
SELECT '6. Demand signals:' as check, COUNT(*) as count FROM demand_signals
UNION ALL
SELECT '7. Users:' as check, COUNT(*) as count FROM users
UNION ALL
SELECT '8. Deal silos:' as check, COUNT(*) as count FROM deal_silos;

SELECT '=== SAMPLE DATA PREVIEW ===' as preview;

SELECT 'Submarket:' as type, name, city, state FROM submarkets LIMIT 1;
SELECT 'Property:' as type, name, address, total_units FROM properties LIMIT 1;
SELECT 'Latest rents:' as type, timestamp, weighted_avg, occupancy_pct FROM latest_rents LIMIT 1;
SELECT 'Imbalance signal:' as type, verdict, composite_score FROM imbalance_signals LIMIT 1;
*/
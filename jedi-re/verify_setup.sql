-- JEDI RE Database Verification Queries
-- Run these after setup to verify everything is working

-- ============================================================================
-- BASIC COUNTS
-- ============================================================================

SELECT '=== DATABASE SETUP VERIFICATION ===' as verification;

SELECT '1. Submarkets:' as check, COUNT(*) as count FROM submarkets
UNION ALL
SELECT '2. Properties:' as check, COUNT(*) as count FROM properties
UNION ALL
SELECT '3. Rent timeseries records:' as check, COUNT(*) as count FROM rents_timeseries
UNION ALL
SELECT '4. Latest rent data (view):' as check, COUNT(*) as count FROM latest_rents
UNION ALL
SELECT '5. Supply pipeline:' as check, COUNT(*) as count FROM supply_pipeline
UNION ALL
SELECT '6. Traffic proxies:' as check, COUNT(*) as count FROM traffic_proxies
UNION ALL
SELECT '7. Search trends:' as check, COUNT(*) as count FROM search_trends
UNION ALL
SELECT '8. Demand signals:' as check, COUNT(*) as count FROM demand_signals
UNION ALL
SELECT '9. Supply signals:' as check, COUNT(*) as count FROM supply_signals
UNION ALL
SELECT '10. Imbalance signals:' as check, COUNT(*) as count FROM imbalance_signals
UNION ALL
SELECT '11. Users:' as check, COUNT(*) as count FROM users
UNION ALL
SELECT '12. Deal silos:' as check, COUNT(*) as count FROM deal_silos;

-- ============================================================================
-- SAMPLE DATA PREVIEW
-- ============================================================================

SELECT '=== SAMPLE DATA PREVIEW ===' as preview;

-- Submarket
SELECT 'Submarket:' as type, name, city, state, 
       population, median_income, population_growth_rate as growth 
FROM submarkets LIMIT 1;

-- Property
SELECT 'Property:' as type, p.name, p.address, p.total_units, 
       p.vintage_class, s.name as submarket
FROM properties p
JOIN submarkets s ON p.submarket_id = s.id
LIMIT 1;

-- Latest rents
SELECT 'Latest rents:' as type, lr.timestamp, 
       lr.weighted_avg as avg_rent, lr.occupancy_pct,
       lr.concession_weeks
FROM latest_rents lr
JOIN properties p ON lr.property_id = p.id
WHERE p.name = 'The Sovereign at Buckhead'
LIMIT 1;

-- Rent trend over time
SELECT 'Rent trend (last 12 weeks):' as type, 
       rt.timestamp, rt.weighted_avg, rt.occupancy_pct
FROM rents_timeseries rt
JOIN properties p ON rt.property_id = p.id
WHERE p.name = 'The Sovereign at Buckhead'
ORDER BY rt.timestamp DESC
LIMIT 12;

-- Imbalance signal
SELECT 'Imbalance signal:' as type, isig.verdict, 
       isig.composite_score, isig.confidence,
       ds.signal_strength as demand_strength,
       ss.signal_strength as supply_strength
FROM imbalance_signals isig
JOIN demand_signals ds ON isig.demand_signal_id = ds.id
JOIN supply_signals ss ON isig.supply_signal_id = ss.id
ORDER BY isig.calculated_at DESC
LIMIT 1;

-- Supply pipeline
SELECT 'Supply pipeline:' as type, sp.project_name, sp.units,
       sp.status, sp.estimated_delivery_date
FROM supply_pipeline sp
JOIN submarkets s ON sp.submarket_id = s.id
WHERE s.name = 'Buckhead'
LIMIT 3;

-- ============================================================================
-- TIMESCALEDB SPECIFIC CHECKS
-- ============================================================================

SELECT '=== TIMESCALEDB HYPER TABLES ===' as timescale_check;

SELECT hypertable_name, num_dimensions, num_chunks 
FROM timescaledb_information.hypertables 
WHERE hypertable_name IN ('rents_timeseries', 'traffic_proxies');

SELECT 'Rents hypertable chunks:' as type, 
       COUNT(*) as chunk_count,
       MIN(range_start) as earliest_chunk,
       MAX(range_end) as latest_chunk
FROM timescaledb_information.chunks 
WHERE hypertable_name = 'rents_timeseries';

-- ============================================================================
-- DATABASE CONNECTION INFO
-- ============================================================================

SELECT '=== CONNECTION DETAILS ===' as connection_info;

SELECT 
    'Host' as setting, 'localhost' as value
UNION ALL
SELECT 'Port', '5432'
UNION ALL
SELECT 'Database', 'jedire'
UNION ALL
SELECT 'Username (admin)', 'postgres'
UNION ALL
SELECT 'Password (admin)', 'jedire123'
UNION ALL
SELECT 'Username (app)', 'jedire_user'
UNION ALL
SELECT 'Password (app)', 'jedire_password'
UNION ALL
SELECT 'Connection string', 'postgresql://postgres:jedire123@localhost:5432/jedire';

-- ============================================================================
-- EXAMPLE QUERIES FOR ANALYSIS
-- ============================================================================

SELECT '=== EXAMPLE ANALYSIS QUERIES ===' as examples;

-- 1. Rent growth calculation
SELECT '1. Rent growth over last 12 weeks:' as example;
WITH weekly_rents AS (
    SELECT 
        DATE_TRUNC('week', timestamp) as week,
        AVG(weighted_avg) as avg_rent
    FROM rents_timeseries rt
    JOIN properties p ON rt.property_id = p.id
    WHERE p.name = 'The Sovereign at Buckhead'
    GROUP BY DATE_TRUNC('week', timestamp)
    ORDER BY week DESC
    LIMIT 12
)
SELECT 
    MIN(week) as start_week,
    MAX(week) as end_week,
    ROUND((MAX(avg_rent) - MIN(avg_rent)) / MIN(avg_rent) * 100, 2) as pct_growth
FROM weekly_rents;

-- 2. Occupancy trend
SELECT '2. Occupancy trend:' as example;
SELECT 
    DATE_TRUNC('week', timestamp) as week,
    ROUND(AVG(occupancy_pct), 2) as avg_occupancy,
    COUNT(*) as data_points
FROM rents_timeseries rt
JOIN properties p ON rt.property_id = p.id
WHERE p.name = 'The Sovereign at Buckhead'
GROUP BY DATE_TRUNC('week', timestamp)
ORDER BY week DESC
LIMIT 8;

-- 3. Submarket summary
SELECT '3. Submarket summary:' as example;
SELECT 
    s.name as submarket,
    s.city,
    s.state,
    COUNT(DISTINCT p.id) as property_count,
    SUM(p.total_units) as total_units,
    COUNT(DISTINCT sp.id) as pipeline_projects,
    SUM(sp.units) as pipeline_units,
    ROUND(AVG(ds.signal_score), 1) as avg_demand_score,
    ROUND(AVG(ss.signal_score), 1) as avg_supply_score
FROM submarkets s
LEFT JOIN properties p ON p.submarket_id = s.id
LEFT JOIN supply_pipeline sp ON sp.submarket_id = s.id
LEFT JOIN demand_signals ds ON ds.submarket_id = s.id
LEFT JOIN supply_signals ss ON ss.submarket_id = s.id
GROUP BY s.id, s.name, s.city, s.state;

-- 4. Latest market signals
SELECT '4. Latest market signals:' as example;
SELECT 
    s.name as submarket,
    isig.verdict,
    isig.composite_score,
    isig.confidence,
    isig.recommendation
FROM imbalance_signals isig
JOIN submarkets s ON isig.submarket_id = s.id
WHERE isig.calculated_at = (
    SELECT MAX(calculated_at) 
    FROM imbalance_signals isig2 
    WHERE isig2.submarket_id = isig.submarket_id
)
ORDER BY isig.composite_score DESC;
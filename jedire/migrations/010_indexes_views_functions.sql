-- =====================================================
-- Migration 010: Additional Indexes, Views & Helper Functions
-- =====================================================
-- Description: Optimizations, materialized views, and utility functions
-- Created: 2026-01-31
-- =====================================================

-- =====================================================
-- Composite Indexes for Common Queries
-- =====================================================

-- Property search optimization
CREATE INDEX idx_properties_search ON properties(market_id, property_type, is_tracked) 
    WHERE deleted_at IS NULL;

-- Analysis cache lookups
CREATE INDEX idx_analyses_cache ON property_analyses(property_id, status, expires_at)
    WHERE status = 'completed' AND expires_at > NOW();

-- Time-series range queries
CREATE INDEX idx_supply_snapshots_range ON supply_snapshots(market_id, snapshot_date)
    INCLUDE (total_listings, median_list_price, supply_score);

CREATE INDEX idx_demand_metrics_range ON demand_metrics(market_id, snapshot_date)
    INCLUDE (sales_last_30d, median_sale_price, demand_score);

-- User activity tracking
CREATE INDEX idx_activity_user_recent ON activity_feed(user_id, created_at DESC)
    WHERE created_at > NOW() - INTERVAL '30 days';

-- Collaboration queries
CREATE INDEX idx_pins_user_active ON property_pins(user_id, status)
    WHERE status = 'active';

-- =====================================================
-- Materialized Views for Dashboards
-- =====================================================

-- Market Summary View
CREATE MATERIALIZED VIEW market_summary AS
SELECT 
    m.id AS market_id,
    m.name AS market_name,
    m.state_code,
    
    -- Property counts
    COUNT(DISTINCT p.id) AS total_properties,
    COUNT(DISTINCT p.id) FILTER (WHERE p.is_tracked = TRUE) AS tracked_properties,
    
    -- Latest metrics
    COALESCE(ss.total_listings, 0) AS current_inventory,
    COALESCE(ss.median_list_price, 0) AS median_price,
    COALESCE(ss.supply_score, 50) AS supply_score,
    COALESCE(dm.demand_score, 50) AS demand_score,
    
    -- Opportunity counts
    COUNT(DISTINCT os.property_id) FILTER (WHERE os.opportunity_level = 'high') AS high_opportunity_count,
    
    -- Data freshness
    MAX(ss.snapshot_date) AS last_supply_update,
    MAX(dm.snapshot_date) AS last_demand_update
    
FROM markets m
LEFT JOIN properties p ON p.market_id = m.id
LEFT JOIN LATERAL (
    SELECT * FROM supply_snapshots
    WHERE market_id = m.id
    ORDER BY snapshot_date DESC
    LIMIT 1
) ss ON TRUE
LEFT JOIN LATERAL (
    SELECT * FROM demand_metrics
    WHERE market_id = m.id
    ORDER BY snapshot_date DESC
    LIMIT 1
) dm ON TRUE
LEFT JOIN opportunity_scores os ON os.property_id = p.id
WHERE m.is_active = TRUE
GROUP BY m.id, m.name, m.state_code, ss.total_listings, ss.median_list_price, 
         ss.supply_score, dm.demand_score;

CREATE UNIQUE INDEX idx_market_summary_id ON market_summary(market_id);

COMMENT ON MATERIALIZED VIEW market_summary IS 'Aggregated market statistics for dashboard';

-- =====================================================
-- Property Detail View (Pre-joined)
-- =====================================================

CREATE MATERIALIZED VIEW property_details_enriched AS
SELECT 
    p.id AS property_id,
    p.formatted_address,
    p.property_type,
    p.lot_size_sqft,
    p.building_sqft,
    
    -- Market info
    m.name AS market_name,
    m.state_code,
    
    -- Zoning info
    pz.district_code,
    pz.max_units_allowed,
    
    -- Latest valuation
    pv.estimated_value,
    pv.price_per_sqft,
    
    -- Opportunity score
    os.overall_score,
    os.opportunity_level,
    
    -- Module scores
    os.zoning_score,
    os.supply_score,
    os.demand_score,
    os.price_score,
    os.cash_flow_score,
    os.development_score,
    
    -- Activity
    p.last_analyzed_at,
    p.created_at
    
FROM properties p
LEFT JOIN markets m ON m.id = p.market_id
LEFT JOIN property_zoning pz ON pz.property_id = p.id
LEFT JOIN LATERAL (
    SELECT * FROM property_valuations
    WHERE property_id = p.id
    ORDER BY valuation_date DESC
    LIMIT 1
) pv ON TRUE
LEFT JOIN opportunity_scores os ON os.property_id = p.id
WHERE p.deleted_at IS NULL;

CREATE UNIQUE INDEX idx_property_details_id ON property_details_enriched(property_id);
CREATE INDEX idx_property_details_score ON property_details_enriched(overall_score DESC);
CREATE INDEX idx_property_details_market ON property_details_enriched(market_name);

COMMENT ON MATERIALIZED VIEW property_details_enriched IS 'Pre-joined property data for fast queries';

-- =====================================================
-- Top Opportunities View
-- =====================================================

CREATE MATERIALIZED VIEW top_opportunities AS
SELECT 
    p.id AS property_id,
    p.formatted_address,
    p.property_type,
    m.name AS market_name,
    
    os.overall_score,
    os.opportunity_level,
    os.confidence_level,
    
    -- Key metrics
    os.zoning_score,
    os.development_score,
    os.cash_flow_score,
    
    -- Supporting data
    pz.max_units_allowed,
    pv.estimated_value,
    pv.price_per_sqft,
    
    -- Insights count
    (SELECT COUNT(*) FROM property_insights pi 
     WHERE pi.property_id = p.id AND pi.is_dismissed = FALSE) AS active_insights_count,
    
    os.calculated_at
    
FROM properties p
JOIN opportunity_scores os ON os.property_id = p.id
JOIN markets m ON m.id = p.market_id
LEFT JOIN property_zoning pz ON pz.property_id = p.id
LEFT JOIN LATERAL (
    SELECT * FROM property_valuations
    WHERE property_id = p.id
    ORDER BY valuation_date DESC
    LIMIT 1
) pv ON TRUE
WHERE os.overall_score >= 70
  AND os.opportunity_level IN ('high', 'medium')
  AND p.deleted_at IS NULL
ORDER BY os.overall_score DESC
LIMIT 1000;

CREATE UNIQUE INDEX idx_top_opportunities_id ON top_opportunities(property_id);
CREATE INDEX idx_top_opportunities_score ON top_opportunities(overall_score DESC);

COMMENT ON MATERIALIZED VIEW top_opportunities IS 'Top 1000 opportunities across all markets';

-- =====================================================
-- Refresh Functions for Materialized Views
-- =====================================================

CREATE OR REPLACE FUNCTION refresh_market_summary()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY market_summary;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION refresh_property_details()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY property_details_enriched;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION refresh_top_opportunities()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY top_opportunities;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION refresh_market_summary IS 'Refresh market summary materialized view';
COMMENT ON FUNCTION refresh_property_details IS 'Refresh property details materialized view';
COMMENT ON FUNCTION refresh_top_opportunities IS 'Refresh top opportunities materialized view';

-- =====================================================
-- Helper Functions
-- =====================================================

-- Calculate distance between two points in miles
CREATE OR REPLACE FUNCTION distance_miles(
    lat1 DOUBLE PRECISION,
    lng1 DOUBLE PRECISION,
    lat2 DOUBLE PRECISION,
    lng2 DOUBLE PRECISION
)
RETURNS DECIMAL(10, 2) AS $$
BEGIN
    RETURN ST_Distance(
        ST_MakePoint(lng1, lat1)::geography,
        ST_MakePoint(lng2, lat2)::geography
    ) / 1609.34; -- Convert meters to miles
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION distance_miles IS 'Calculate distance between two lat/lng points in miles';

-- =====================================================
-- Find nearby properties function
CREATE OR REPLACE FUNCTION find_nearby_properties(
    center_lat DOUBLE PRECISION,
    center_lng DOUBLE PRECISION,
    radius_miles DOUBLE PRECISION,
    max_results INTEGER DEFAULT 50
)
RETURNS TABLE (
    property_id UUID,
    address TEXT,
    distance_miles DECIMAL(10, 2),
    property_type property_type
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.formatted_address,
        (ST_Distance(
            p.location::geography,
            ST_MakePoint(center_lng, center_lat)::geography
        ) / 1609.34)::DECIMAL(10, 2) AS dist_miles,
        p.property_type
    FROM properties p
    WHERE ST_DWithin(
        p.location::geography,
        ST_MakePoint(center_lng, center_lat)::geography,
        radius_miles * 1609.34 -- Convert miles to meters
    )
    ORDER BY p.location <-> ST_MakePoint(center_lng, center_lat)::geometry
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION find_nearby_properties IS 'Find properties within radius of a point';

-- =====================================================
-- Get comparable properties for analysis
CREATE OR REPLACE FUNCTION get_comparable_properties(
    subject_property_id UUID,
    max_distance_miles DOUBLE PRECISION DEFAULT 1.0,
    max_results INTEGER DEFAULT 10
)
RETURNS TABLE (
    comp_property_id UUID,
    sale_date DATE,
    sale_price INTEGER,
    distance_miles DECIMAL(10, 2),
    similarity_score DECIMAL(3, 2)
) AS $$
DECLARE
    subject_location GEOMETRY;
    subject_type property_type;
    subject_sqft INTEGER;
    subject_beds INTEGER;
BEGIN
    -- Get subject property details
    SELECT p.location, p.property_type, p.building_sqft, p.bedrooms
    INTO subject_location, subject_type, subject_sqft, subject_beds
    FROM properties p
    WHERE p.id = subject_property_id;
    
    RETURN QUERY
    SELECT 
        cs.property_id,
        cs.sale_date,
        cs.sale_price,
        (ST_Distance(
            cs.location::geography,
            subject_location::geography
        ) / 1609.34)::DECIMAL(10, 2) AS dist_miles,
        (
            -- Similarity based on multiple factors
            CASE WHEN cs.property_type = subject_type THEN 0.3 ELSE 0.0 END +
            CASE WHEN ABS(cs.building_sqft - subject_sqft)::DECIMAL / NULLIF(subject_sqft, 0) < 0.2 THEN 0.3 ELSE 0.0 END +
            CASE WHEN ABS(cs.bedrooms - subject_beds) <= 1 THEN 0.2 ELSE 0.0 END +
            0.2 -- Base similarity
        )::DECIMAL(3, 2) AS similarity
    FROM comparable_sales cs
    WHERE cs.sale_date >= CURRENT_DATE - INTERVAL '12 months'
      AND cs.property_id != subject_property_id
      AND ST_DWithin(
          cs.location::geography,
          subject_location::geography,
          max_distance_miles * 1609.34
      )
    ORDER BY similarity DESC, dist_miles ASC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_comparable_properties IS 'Get comparable sales for a property';

-- =====================================================
-- Calculate aggregate opportunity score
CREATE OR REPLACE FUNCTION calculate_aggregate_opportunity_score(
    module_scores JSONB
)
RETURNS INTEGER AS $$
DECLARE
    score INTEGER := 0;
    score_count INTEGER := 0;
    module_key TEXT;
    module_score INTEGER;
BEGIN
    -- Weight different modules
    -- Zoning: 20%
    -- Development: 20%
    -- Cash Flow: 20%
    -- Price: 15%
    -- Supply/Demand: 15% combined
    -- Other: 10%
    
    IF module_scores ? 'zoning' THEN
        score := score + (module_scores->>'zoning')::INTEGER * 0.20;
        score_count := score_count + 1;
    END IF;
    
    IF module_scores ? 'development' THEN
        score := score + (module_scores->>'development')::INTEGER * 0.20;
        score_count := score_count + 1;
    END IF;
    
    IF module_scores ? 'cash_flow' THEN
        score := score + (module_scores->>'cash_flow')::INTEGER * 0.20;
        score_count := score_count + 1;
    END IF;
    
    IF module_scores ? 'price' THEN
        score := score + (module_scores->>'price')::INTEGER * 0.15;
        score_count := score_count + 1;
    END IF;
    
    IF module_scores ? 'supply' AND module_scores ? 'demand' THEN
        score := score + 
            ((module_scores->>'supply')::INTEGER + (module_scores->>'demand')::INTEGER) / 2.0 * 0.15;
        score_count := score_count + 1;
    END IF;
    
    -- Normalize if not all scores present
    IF score_count > 0 THEN
        RETURN LEAST(100, GREATEST(0, score::INTEGER));
    ELSE
        RETURN 50; -- Default middle score
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_aggregate_opportunity_score IS 'Calculate weighted aggregate score from module scores';

-- =====================================================
-- Update property opportunity score
CREATE OR REPLACE FUNCTION update_property_opportunity_score(
    p_property_id UUID
)
RETURNS VOID AS $$
DECLARE
    module_scores JSONB := '{}';
    overall INTEGER;
    level opportunity_level;
BEGIN
    -- Gather latest scores from various analyses
    -- Zoning
    SELECT INTO module_scores jsonb_set(
        module_scores, 
        '{zoning}', 
        to_jsonb(COALESCE(development_score, 50))
    )
    FROM zoning_analyses
    WHERE property_id = p_property_id
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- Cash Flow
    SELECT INTO module_scores jsonb_set(
        module_scores,
        '{cash_flow}',
        to_jsonb(COALESCE(investment_score, 50))
    )
    FROM cash_flow_analyses
    WHERE property_id = p_property_id
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- Price
    SELECT INTO module_scores jsonb_set(
        module_scores,
        '{price}',
        to_jsonb(COALESCE(value_score, 50))
    )
    FROM property_valuations
    WHERE property_id = p_property_id
    ORDER BY valuation_date DESC
    LIMIT 1;
    
    -- Development
    SELECT INTO module_scores jsonb_set(
        module_scores,
        '{development}',
        to_jsonb(COALESCE(development_score, 50))
    )
    FROM development_opportunities
    WHERE property_id = p_property_id
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- Calculate overall score
    overall := calculate_aggregate_opportunity_score(module_scores);
    
    -- Determine level
    level := CASE
        WHEN overall >= 80 THEN 'high'::opportunity_level
        WHEN overall >= 60 THEN 'medium'::opportunity_level
        WHEN overall >= 40 THEN 'low'::opportunity_level
        ELSE 'unknown'::opportunity_level
    END;
    
    -- Upsert opportunity score
    INSERT INTO opportunity_scores (
        property_id,
        overall_score,
        opportunity_level,
        score_breakdown,
        calculated_at
    ) VALUES (
        p_property_id,
        overall,
        level,
        module_scores,
        NOW()
    )
    ON CONFLICT (property_id) DO UPDATE SET
        overall_score = EXCLUDED.overall_score,
        opportunity_level = EXCLUDED.opportunity_level,
        score_breakdown = EXCLUDED.score_breakdown,
        calculated_at = EXCLUDED.calculated_at,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_property_opportunity_score IS 'Recalculate and update aggregate opportunity score for a property';

-- =====================================================
-- Cleanup Functions
-- =====================================================

-- Delete expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete expired analyses
    DELETE FROM property_analyses
    WHERE expires_at < NOW() AND status != 'completed';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Delete expired zoning lookups
    DELETE FROM property_zoning
    WHERE expires_at < NOW();
    
    -- Delete expired valuations
    DELETE FROM property_valuations
    WHERE expires_at < NOW();
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_cache IS 'Remove expired cache entries';

-- Archive old activity
CREATE OR REPLACE FUNCTION archive_old_activity(days_old INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    archived_count INTEGER;
BEGIN
    DELETE FROM activity_feed
    WHERE created_at < NOW() - (days_old || ' days')::INTERVAL;
    
    GET DIAGNOSTICS archived_count = ROW_COUNT;
    
    RETURN archived_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION archive_old_activity IS 'Archive activity feed entries older than specified days';

-- =====================================================
-- Statistics and Health Check
-- =====================================================

CREATE OR REPLACE FUNCTION database_health_check()
RETURNS TABLE (
    metric VARCHAR(100),
    value TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 'Total Properties'::VARCHAR(100), COUNT(*)::TEXT FROM properties
    UNION ALL
    SELECT 'Active Markets', COUNT(*)::TEXT FROM markets WHERE is_active = TRUE
    UNION ALL
    SELECT 'Active Users', COUNT(*)::TEXT FROM users WHERE deleted_at IS NULL
    UNION ALL
    SELECT 'Organizations', COUNT(*)::TEXT FROM organizations WHERE deleted_at IS NULL
    UNION ALL
    SELECT 'Cached Analyses', COUNT(*)::TEXT FROM property_analyses WHERE status = 'completed'
    UNION ALL
    SELECT 'High Opportunities', COUNT(*)::TEXT FROM opportunity_scores WHERE opportunity_level = 'high'
    UNION ALL
    SELECT 'Active Insights', COUNT(*)::TEXT FROM property_insights WHERE is_dismissed = FALSE
    UNION ALL
    SELECT 'Unread Alerts', COUNT(*)::TEXT FROM alerts WHERE is_read = FALSE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION database_health_check IS 'Get key metrics for database health monitoring';

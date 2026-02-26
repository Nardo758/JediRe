-- ============================================================================
-- 032_digital_traffic_events.sql
-- Platform event tracking for T-03 Digital Traffic Score
-- ============================================================================

-- Track all property engagement events on the platform
CREATE TABLE IF NOT EXISTS digital_traffic_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    user_id UUID,

    -- Event type
    event_type VARCHAR(30) NOT NULL CHECK (event_type IN (
        'search_impression',    -- Property appeared in search results
        'map_view',             -- Property visible on map
        'detail_view',          -- User opened property detail
        'analysis_run',         -- User ran Strategy Arbitrage or similar
        'save',                 -- User saved/bookmarked property
        'share',                -- User shared property
        'export',               -- User exported analysis
        'compare',              -- Property used in comparison
        'note_added',           -- User added a note
        'tour_scheduled'        -- User scheduled a tour
    )),

    -- Event metadata
    session_id VARCHAR(100),
    duration_seconds INTEGER,
    source VARCHAR(30),         -- 'map', 'search', 'deal_pipeline', 'direct'

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Aggregated digital traffic scores (weekly rollup)
CREATE TABLE IF NOT EXISTS digital_traffic_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,

    -- T-03: Digital traffic score (0-100)
    digital_score INTEGER NOT NULL CHECK (digital_score BETWEEN 0 AND 100),

    -- Component breakdown
    views_score INTEGER,          -- 40% weight
    engagement_score INTEGER,     -- 30% weight (saves + shares)
    analysis_score INTEGER,       -- 20% weight (deep engagement)
    velocity_score INTEGER,       -- 10% weight (trending momentum)

    -- Raw metrics
    weekly_views INTEGER NOT NULL DEFAULT 0,
    weekly_saves INTEGER NOT NULL DEFAULT 0,
    weekly_shares INTEGER NOT NULL DEFAULT 0,
    weekly_analysis_runs INTEGER NOT NULL DEFAULT 0,
    unique_users_7d INTEGER NOT NULL DEFAULT 0,

    -- Trending
    week_over_week_growth DECIMAL(6,2),
    trending_velocity VARCHAR(20) CHECK (trending_velocity IN ('accelerating', 'stable', 'decelerating', 'new')),
    institutional_interest_flag BOOLEAN DEFAULT FALSE,

    -- Period
    score_week INTEGER NOT NULL,
    score_year INTEGER NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_digital_score UNIQUE (property_id, score_week, score_year)
);

CREATE INDEX IF NOT EXISTS idx_digital_events_property ON digital_traffic_events(property_id);
CREATE INDEX IF NOT EXISTS idx_digital_events_type ON digital_traffic_events(event_type);
CREATE INDEX IF NOT EXISTS idx_digital_events_created ON digital_traffic_events(created_at);
CREATE INDEX IF NOT EXISTS idx_digital_scores_property ON digital_traffic_scores(property_id);

-- ============================================================================
-- Summary: Tables created
-- ============================================================================
-- traffic_predictions          -> T-01 weekly walk-ins, T-02 physical score
-- traffic_prediction_history   -> T-07 trajectory time series
-- traffic_calibration_factors  -> Model calibration from validation
-- traffic_validation           -> T-10 user-contributed actuals
-- traffic_correlation_signals  -> T-04 Hidden Gem / Validated / Hype / Dead Zone
-- traffic_competitive_share    -> T-09 competitive share within trade area
-- digital_traffic_events       -> Platform event tracking
-- digital_traffic_scores       -> T-03 digital traffic score
--
-- Views:
-- latest_traffic_predictions      -> Most recent prediction per property
-- property_traffic_intelligence   -> Prediction + actuals joined

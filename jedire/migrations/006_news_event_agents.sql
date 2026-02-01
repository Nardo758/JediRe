-- =====================================================
-- Migration 006: News & Event Agent Tables
-- =====================================================
-- Description: Tables for news sentiment and local events affecting property values
-- Created: 2026-01-31
-- =====================================================

-- =====================================================
-- News Items
-- =====================================================

CREATE TABLE news_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    market_id UUID REFERENCES markets(id),
    
    -- Article details
    title TEXT NOT NULL,
    summary TEXT,
    full_text TEXT,
    url TEXT,
    
    -- Source
    source VARCHAR(255), -- 'local_newspaper', 'realtor_com', 'bloomberg', etc.
    author VARCHAR(255),
    published_date TIMESTAMP NOT NULL,
    
    -- Geographic relevance
    location GEOMETRY(Point, 4326),
    affected_areas GEOMETRY(MultiPolygon, 4326),
    radius_miles INTEGER,
    
    -- Categorization
    category VARCHAR(100), -- 'development', 'infrastructure', 'regulation', 'economy', etc.
    tags TEXT[],
    
    -- AI analysis
    sentiment_score DECIMAL(4, 3), -- -1.00 (negative) to +1.00 (positive)
    sentiment_label VARCHAR(20), -- 'very_negative', 'negative', 'neutral', 'positive', 'very_positive'
    
    impact_score INTEGER CHECK (impact_score BETWEEN 0 AND 100),
    impact_type VARCHAR(50), -- 'price_increase', 'price_decrease', 'demand_increase', etc.
    
    -- Affected properties
    affected_property_count INTEGER DEFAULT 0,
    estimated_value_impact_pct DECIMAL(5, 2),
    
    -- AI interpretation
    ai_summary TEXT,
    key_insights TEXT[],
    investor_implications TEXT,
    
    -- Embeddings for semantic search
    embeddings vector(1536),
    
    -- Engagement
    view_count INTEGER DEFAULT 0,
    share_count INTEGER DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_news_market ON news_items(market_id);
CREATE INDEX idx_news_published ON news_items(published_date DESC);
CREATE INDEX idx_news_category ON news_items(category);
CREATE INDEX idx_news_sentiment ON news_items(sentiment_score);
CREATE INDEX idx_news_impact ON news_items(impact_score DESC);
CREATE INDEX idx_news_location ON news_items USING GIST(location);
CREATE INDEX idx_news_areas ON news_items USING GIST(affected_areas);
CREATE INDEX idx_news_embeddings ON news_items USING ivfflat(embeddings vector_cosine_ops);
CREATE INDEX idx_news_tags ON news_items USING GIN(tags);

COMMENT ON TABLE news_items IS 'News articles with AI sentiment analysis and market impact';
COMMENT ON COLUMN news_items.sentiment_score IS 'AI-analyzed sentiment from -1 (negative) to +1 (positive)';
COMMENT ON COLUMN news_items.affected_areas IS 'Geographic areas affected by this news';

-- =====================================================
-- Property News Associations
-- =====================================================

CREATE TABLE property_news (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    news_item_id UUID REFERENCES news_items(id) ON DELETE CASCADE,
    
    -- Relevance
    relevance_score DECIMAL(3, 2), -- 0.00 to 1.00
    distance_miles DECIMAL(8, 2),
    
    -- Estimated impact
    estimated_value_impact_pct DECIMAL(5, 2),
    impact_timeframe VARCHAR(50), -- 'immediate', 'short_term', 'long_term'
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT unique_property_news UNIQUE(property_id, news_item_id)
);

CREATE INDEX idx_property_news_property ON property_news(property_id);
CREATE INDEX idx_property_news_item ON property_news(news_item_id);
CREATE INDEX idx_property_news_relevance ON property_news(relevance_score DESC);

COMMENT ON TABLE property_news IS 'Association between properties and relevant news';

-- =====================================================
-- Local Events
-- =====================================================

CREATE TABLE local_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    market_id UUID REFERENCES markets(id),
    
    -- Event details
    name VARCHAR(255) NOT NULL,
    description TEXT,
    event_type VARCHAR(100), -- 'infrastructure', 'development', 'public_transit', 'school', 'commercial', etc.
    status VARCHAR(50), -- 'proposed', 'approved', 'in_progress', 'completed', 'cancelled'
    
    -- Location
    location GEOMETRY(Point, 4326),
    address TEXT,
    affected_radius_miles DECIMAL(5, 2),
    affected_areas GEOMETRY(MultiPolygon, 4326),
    
    -- Timeline
    announced_date DATE,
    start_date DATE,
    expected_completion_date DATE,
    actual_completion_date DATE,
    
    -- Impact assessment
    impact_score INTEGER CHECK (impact_score BETWEEN 0 AND 100),
    impact_category VARCHAR(50), -- 'positive', 'negative', 'mixed', 'neutral'
    
    estimated_value_impact_pct DECIMAL(5, 2),
    estimated_affected_properties INTEGER,
    
    -- Project details
    project_cost INTEGER,
    developer VARCHAR(255),
    project_size_sqft INTEGER,
    project_units INTEGER,
    
    -- AI analysis
    ai_summary TEXT,
    investment_opportunities TEXT[],
    risk_factors TEXT[],
    
    -- Sources
    data_sources TEXT[],
    official_url TEXT,
    
    -- Engagement
    view_count INTEGER DEFAULT 0,
    tracked_by_users UUID[],
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_events_market ON local_events(market_id);
CREATE INDEX idx_events_type ON local_events(event_type);
CREATE INDEX idx_events_status ON local_events(status);
CREATE INDEX idx_events_location ON local_events USING GIST(location);
CREATE INDEX idx_events_areas ON local_events USING GIST(affected_areas);
CREATE INDEX idx_events_impact ON local_events(impact_score DESC);
CREATE INDEX idx_events_dates ON local_events(expected_completion_date);

COMMENT ON TABLE local_events IS 'Local development projects and events affecting property values';
COMMENT ON COLUMN local_events.affected_radius_miles IS 'Estimated radius of impact in miles';

-- =====================================================
-- Property Event Associations
-- =====================================================

CREATE TABLE property_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    event_id UUID REFERENCES local_events(id) ON DELETE CASCADE,
    
    -- Proximity
    distance_miles DECIMAL(8, 2),
    within_impact_zone BOOLEAN DEFAULT TRUE,
    
    -- Estimated impact
    estimated_value_impact_pct DECIMAL(5, 2),
    impact_category VARCHAR(50), -- 'positive', 'negative', 'mixed'
    
    -- Timeline impact
    impact_start_date DATE,
    impact_peak_date DATE,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT unique_property_event UNIQUE(property_id, event_id)
);

CREATE INDEX idx_property_events_property ON property_events(property_id);
CREATE INDEX idx_property_events_event ON property_events(event_id);
CREATE INDEX idx_property_events_impact ON property_events(estimated_value_impact_pct);

COMMENT ON TABLE property_events IS 'Association between properties and relevant local events';

-- =====================================================
-- News Sentiment Trends (Time-Series)
-- =====================================================

CREATE TABLE news_sentiment_trends (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    market_id UUID REFERENCES markets(id),
    
    -- Time period
    trend_date DATE NOT NULL,
    trend_timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    
    -- Aggregate sentiment
    avg_sentiment DECIMAL(4, 3),
    sentiment_direction VARCHAR(20), -- 'improving', 'stable', 'declining'
    
    -- Article counts by sentiment
    positive_count INTEGER DEFAULT 0,
    neutral_count INTEGER DEFAULT 0,
    negative_count INTEGER DEFAULT 0,
    
    -- Top categories
    top_categories TEXT[],
    
    -- Market mood
    market_mood VARCHAR(50), -- 'very_bullish', 'bullish', 'neutral', 'bearish', 'very_bearish'
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW()
);

-- Convert to hypertable for time-series queries
SELECT create_hypertable('news_sentiment_trends', 'trend_timestamp',
    chunk_time_interval => INTERVAL '1 month',
    if_not_exists => TRUE
);

CREATE INDEX idx_sentiment_trends_market ON news_sentiment_trends(market_id, trend_date DESC);

COMMENT ON TABLE news_sentiment_trends IS 'Daily sentiment trends aggregated from news articles';

-- =====================================================
-- Event Impact Tracking (Time-Series)
-- =====================================================

CREATE TABLE event_impact_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES local_events(id) ON DELETE CASCADE,
    
    -- Tracking date
    tracking_date DATE NOT NULL,
    tracking_timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    
    -- Progress metrics
    completion_pct INTEGER CHECK (completion_pct BETWEEN 0 AND 100),
    current_status VARCHAR(50),
    
    -- Observed impacts
    nearby_sales_count INTEGER,
    avg_sale_price_change_pct DECIMAL(5, 2),
    
    new_listings_count INTEGER,
    inventory_change_pct DECIMAL(5, 2),
    
    -- Market response
    buyer_interest_index INTEGER,
    price_momentum VARCHAR(20), -- 'increasing', 'stable', 'decreasing'
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW()
);

-- Convert to hypertable for time-series queries
SELECT create_hypertable('event_impact_tracking', 'tracking_timestamp',
    chunk_time_interval => INTERVAL '1 month',
    if_not_exists => TRUE
);

CREATE INDEX idx_event_tracking_event ON event_impact_tracking(event_id, tracking_date DESC);

COMMENT ON TABLE event_impact_tracking IS 'Time-series tracking of event impacts on nearby properties';

-- =====================================================
-- News Alert Rules
-- =====================================================

CREATE TABLE news_alert_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Alert criteria
    markets UUID[], -- Array of market IDs to monitor
    categories TEXT[], -- News categories of interest
    keywords TEXT[], -- Keywords to match
    
    min_impact_score INTEGER DEFAULT 50,
    min_sentiment_score DECIMAL(4, 3) DEFAULT -1.00,
    
    -- Geographic filter
    watch_locations GEOMETRY(MultiPoint, 4326),
    watch_radius_miles DECIMAL(5, 2),
    
    -- Delivery preferences
    notify_email BOOLEAN DEFAULT TRUE,
    notify_sms BOOLEAN DEFAULT FALSE,
    notify_push BOOLEAN DEFAULT TRUE,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_alert_rules_user ON news_alert_rules(user_id);
CREATE INDEX idx_alert_rules_active ON news_alert_rules(is_active) WHERE is_active = TRUE;

COMMENT ON TABLE news_alert_rules IS 'User-defined rules for news and event alerts';

-- =====================================================
-- Update Timestamps Trigger
-- =====================================================

CREATE TRIGGER update_news_items_updated_at BEFORE UPDATE ON news_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_local_events_updated_at BEFORE UPDATE ON local_events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_alert_rules_updated_at BEFORE UPDATE ON news_alert_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

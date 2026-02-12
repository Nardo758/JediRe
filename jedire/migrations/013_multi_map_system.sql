-- ========================================
-- Migration 013: Multi-Map System
-- ========================================
-- Core infrastructure for map-centric intelligence platform
-- Multiple maps per user, layers, pins, collaboration

-- ========================================
-- MAPS
-- ========================================

CREATE TABLE IF NOT EXISTS maps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    map_type VARCHAR(50) DEFAULT 'acquisition', -- 'acquisition', 'portfolio', 'research', 'custom'
    icon VARCHAR(50), -- emoji or icon name
    color VARCHAR(7), -- hex color for UI
    is_collaborative BOOLEAN DEFAULT false,
    settings JSONB DEFAULT '{}'::jsonb, -- map-specific settings
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_maps_owner ON maps(owner_id);
CREATE INDEX idx_maps_type ON maps(map_type);

-- ========================================
-- MAP COLLABORATORS
-- ========================================

CREATE TABLE IF NOT EXISTS map_collaborators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    map_id UUID NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'viewer', -- 'owner', 'editor', 'viewer'
    permissions JSONB DEFAULT '{
        "can_add_properties": true,
        "can_edit_properties": true,
        "can_delete_properties": false,
        "can_add_notes": true,
        "can_edit_notes": true,
        "can_move_pipeline": true,
        "can_share": false,
        "can_see_financials": true
    }'::jsonb,
    invited_at TIMESTAMPTZ DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    UNIQUE(map_id, user_id)
);

CREATE INDEX idx_map_collaborators_map ON map_collaborators(map_id);
CREATE INDEX idx_map_collaborators_user ON map_collaborators(user_id);

-- ========================================
-- MAP PINS (All Types)
-- ========================================

CREATE TABLE IF NOT EXISTS map_pins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    map_id UUID NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- 'property', 'news', 'consultant', 'note', 'drawing'
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    data JSONB NOT NULL DEFAULT '{}'::jsonb, -- Type-specific data
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_map_pins_map ON map_pins(map_id);
CREATE INDEX idx_map_pins_type ON map_pins(type);
CREATE INDEX idx_map_pins_location ON map_pins USING GIST(location);
CREATE INDEX idx_map_pins_created_by ON map_pins(created_by);

-- ========================================
-- PROPERTY PINS (Specific)
-- ========================================

CREATE TABLE IF NOT EXISTS property_pins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    map_pin_id UUID NOT NULL REFERENCES map_pins(id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(id) ON DELETE SET NULL, -- Links to existing property
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state_code VARCHAR(2),
    zip_code VARCHAR(10),
    source VARCHAR(50), -- 'email', 'manual', 'ai_detected', 'import'
    pipeline_stage_id UUID, -- References pipeline_stages
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'owned', 'passed', 'archived'
    color VARCHAR(7), -- Override color based on stage/status
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_property_pins_map_pin ON property_pins(map_pin_id);
CREATE INDEX idx_property_pins_property ON property_pins(property_id);
CREATE INDEX idx_property_pins_stage ON property_pins(pipeline_stage_id);
CREATE INDEX idx_property_pins_status ON property_pins(status);

-- ========================================
-- PIPELINE STAGES (Per Map)
-- ========================================

CREATE TABLE IF NOT EXISTS pipeline_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    map_id UUID NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
    stage_name VARCHAR(100) NOT NULL,
    stage_order INTEGER NOT NULL,
    color VARCHAR(7) NOT NULL, -- Hex color
    description TEXT,
    actions JSONB DEFAULT '[]'::jsonb, -- Actions to trigger when moved to this stage
    is_final BOOLEAN DEFAULT false, -- e.g., 'Closed', 'Owned'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pipeline_stages_map ON pipeline_stages(map_id, stage_order);
CREATE UNIQUE INDEX idx_pipeline_stages_map_name ON pipeline_stages(map_id, stage_name);

-- ========================================
-- DEAL SILOS
-- ========================================

CREATE TABLE IF NOT EXISTS deal_silos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_pin_id UUID NOT NULL REFERENCES property_pins(id) ON DELETE CASCADE,
    current_stage_id UUID REFERENCES pipeline_stages(id),
    -- References to related data
    email_ids UUID[] DEFAULT ARRAY[]::UUID[], -- Array of email IDs
    news_ids UUID[] DEFAULT ARRAY[]::UUID[], -- Array of news article IDs
    consultant_notes TEXT[] DEFAULT ARRAY[]::TEXT[],
    -- Financial data
    financial_model_id UUID, -- Reference to external financial model
    purchase_price DECIMAL(12, 2),
    estimated_roi DECIMAL(5, 2),
    estimated_irr DECIMAL(5, 2),
    -- Zoning data
    zoning_code VARCHAR(50),
    zoning_data JSONB,
    buildable_envelope JSONB, -- GeoJSON geometry
    -- Notes and tasks
    notes TEXT[] DEFAULT ARRAY[]::TEXT[],
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ
);

CREATE INDEX idx_deal_silos_property_pin ON deal_silos(property_pin_id);
CREATE INDEX idx_deal_silos_stage ON deal_silos(current_stage_id);

-- ========================================
-- TASKS
-- ========================================

CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_silo_id UUID REFERENCES deal_silos(id) ON DELETE CASCADE,
    map_id UUID REFERENCES maps(id) ON DELETE CASCADE, -- Can be map-level or deal-level
    title VARCHAR(255) NOT NULL,
    description TEXT,
    assigned_to UUID REFERENCES users(id),
    due_date DATE,
    priority VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high', 'urgent'
    status VARCHAR(20) DEFAULT 'todo', -- 'todo', 'in_progress', 'done', 'cancelled'
    completed_at TIMESTAMPTZ,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tasks_deal_silo ON tasks(deal_silo_id);
CREATE INDEX idx_tasks_map ON tasks(map_id);
CREATE INDEX idx_tasks_assigned ON tasks(assigned_to, status);
CREATE INDEX idx_tasks_due ON tasks(due_date) WHERE status != 'done' AND status != 'cancelled';

-- ========================================
-- NEWS ARTICLES
-- ========================================

CREATE TABLE IF NOT EXISTS news_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    url VARCHAR(500) UNIQUE,
    title TEXT NOT NULL,
    summary TEXT,
    content TEXT,
    published_at TIMESTAMPTZ,
    source VARCHAR(100),
    author VARCHAR(255),
    location GEOGRAPHY(POINT, 4326), -- Extracted location if available
    location_text TEXT, -- "Austin, TX" or "East Austin"
    category VARCHAR(50), -- 'zoning', 'market', 'development', 'policy', 'general'
    keywords TEXT[],
    ai_relevance_score DECIMAL(3, 2), -- 0.00 to 1.00
    ai_summary TEXT, -- AI-generated summary
    linked_property_ids UUID[] DEFAULT ARRAY[]::UUID[], -- Properties this is relevant to
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_news_articles_url ON news_articles(url);
CREATE INDEX idx_news_articles_published ON news_articles(published_at DESC);
CREATE INDEX idx_news_articles_location ON news_articles USING GIST(location) WHERE location IS NOT NULL;
CREATE INDEX idx_news_articles_category ON news_articles(category);
CREATE INDEX idx_news_articles_keywords ON news_articles USING GIN(keywords);

-- ========================================
-- NEWS PINS (Link to Maps)
-- ========================================

CREATE TABLE IF NOT EXISTS news_pins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    map_pin_id UUID NOT NULL REFERENCES map_pins(id) ON DELETE CASCADE,
    news_article_id UUID NOT NULL REFERENCES news_articles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(map_pin_id, news_article_id)
);

CREATE INDEX idx_news_pins_map_pin ON news_pins(map_pin_id);
CREATE INDEX idx_news_pins_article ON news_pins(news_article_id);

-- ========================================
-- MAP ANNOTATIONS (Drawings)
-- ========================================

CREATE TABLE IF NOT EXISTS map_annotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    map_id UUID NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- 'line', 'polygon', 'marker', 'circle', 'rectangle'
    geometry GEOGRAPHY NOT NULL, -- Can be point, line, or polygon
    style JSONB DEFAULT '{
        "color": "#3b82f6",
        "width": 2,
        "opacity": 0.7,
        "fillColor": "#3b82f6",
        "fillOpacity": 0.3
    }'::jsonb,
    note TEXT,
    label VARCHAR(255),
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_map_annotations_map ON map_annotations(map_id);
CREATE INDEX idx_map_annotations_geometry ON map_annotations USING GIST(geometry);
CREATE INDEX idx_map_annotations_created_by ON map_annotations(created_by);

-- ========================================
-- MAP LAYERS (Toggle Settings)
-- ========================================

CREATE TABLE IF NOT EXISTS map_layers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    map_id UUID NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
    layer_name VARCHAR(50) NOT NULL, -- 'emails', 'news', 'consultants', 'financials', 'zoning', 'pipeline', 'draw', 'analytics'
    is_visible BOOLEAN DEFAULT false,
    settings JSONB DEFAULT '{}'::jsonb, -- Layer-specific settings
    display_order INTEGER DEFAULT 0,
    UNIQUE(map_id, layer_name)
);

CREATE INDEX idx_map_layers_map ON map_layers(map_id, display_order);

-- ========================================
-- ACTIVITY LOG
-- ========================================

CREATE TABLE IF NOT EXISTS map_activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    map_id UUID NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    action VARCHAR(50) NOT NULL, -- 'created_map', 'added_property', 'moved_stage', 'added_note', etc.
    entity_type VARCHAR(50), -- 'property', 'task', 'annotation', etc.
    entity_id UUID,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_map_activity_log_map ON map_activity_log(map_id, created_at DESC);
CREATE INDEX idx_map_activity_log_user ON map_activity_log(user_id);

-- ========================================
-- FUNCTIONS
-- ========================================

-- Update timestamps
CREATE OR REPLACE FUNCTION update_map_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_maps_timestamp
    BEFORE UPDATE ON maps
    FOR EACH ROW
    EXECUTE FUNCTION update_map_timestamp();

CREATE TRIGGER update_map_pins_timestamp
    BEFORE UPDATE ON map_pins
    FOR EACH ROW
    EXECUTE FUNCTION update_map_timestamp();

CREATE TRIGGER update_property_pins_timestamp
    BEFORE UPDATE ON property_pins
    FOR EACH ROW
    EXECUTE FUNCTION update_map_timestamp();

CREATE TRIGGER update_deal_silos_timestamp
    BEFORE UPDATE ON deal_silos
    FOR EACH ROW
    EXECUTE FUNCTION update_map_timestamp();

CREATE TRIGGER update_tasks_timestamp
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_map_timestamp();

CREATE TRIGGER update_map_annotations_timestamp
    BEFORE UPDATE ON map_annotations
    FOR EACH ROW
    EXECUTE FUNCTION update_map_timestamp();

-- Log activity when properties are added
CREATE OR REPLACE FUNCTION log_property_added()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO map_activity_log (map_id, user_id, action, entity_type, entity_id, details)
    SELECT 
        mp.map_id,
        NEW.created_by,
        'added_property',
        'property',
        NEW.id,
        jsonb_build_object(
            'address', NEW.address_line1,
            'city', NEW.city,
            'source', NEW.source
        )
    FROM map_pins mp
    WHERE mp.id = NEW.map_pin_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER log_property_added_trigger
    AFTER INSERT ON property_pins
    FOR EACH ROW
    EXECUTE FUNCTION log_property_added();

-- ========================================
-- VIEWS
-- ========================================

-- Properties with full context
CREATE OR REPLACE VIEW properties_with_context AS
SELECT 
    pp.id as property_pin_id,
    pp.address_line1,
    pp.address_line2,
    pp.city,
    pp.state_code,
    pp.zip_code,
    pp.source,
    pp.status,
    pp.color,
    mp.map_id,
    ST_Y(mp.location::geometry) as latitude,
    ST_X(mp.location::geometry) as longitude,
    ps.stage_name as pipeline_stage,
    ps.color as stage_color,
    ds.purchase_price,
    ds.estimated_roi,
    ds.estimated_irr,
    ds.zoning_code,
    array_length(ds.email_ids, 1) as email_count,
    array_length(ds.news_ids, 1) as news_count,
    pp.created_at,
    pp.updated_at
FROM property_pins pp
JOIN map_pins mp ON pp.map_pin_id = mp.id
LEFT JOIN deal_silos ds ON ds.property_pin_id = pp.id
LEFT JOIN pipeline_stages ps ON ds.current_stage_id = ps.id;

-- Map summary stats
CREATE OR REPLACE VIEW map_summary_stats AS
SELECT 
    m.id as map_id,
    m.name as map_name,
    COUNT(DISTINCT mp.id) FILTER (WHERE mp.type = 'property') as property_count,
    COUNT(DISTINCT mp.id) FILTER (WHERE mp.type = 'news') as news_count,
    COUNT(DISTINCT mp.id) FILTER (WHERE mp.type = 'consultant') as consultant_count,
    COUNT(DISTINCT ma.id) as annotation_count,
    COUNT(DISTINCT mc.id) as collaborator_count,
    COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'todo') as open_tasks,
    m.created_at,
    m.updated_at
FROM maps m
LEFT JOIN map_pins mp ON m.id = mp.map_id
LEFT JOIN map_annotations ma ON m.id = ma.map_id
LEFT JOIN map_collaborators mc ON m.id = mc.map_id
LEFT JOIN tasks t ON m.id = t.map_id
GROUP BY m.id, m.name, m.created_at, m.updated_at;

-- ========================================
-- ROW-LEVEL SECURITY
-- ========================================

ALTER TABLE maps ENABLE ROW LEVEL SECURITY;
ALTER TABLE map_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE map_pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_silos ENABLE ROW LEVEL SECURITY;
ALTER TABLE map_annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE map_layers ENABLE ROW LEVEL SECURITY;

-- Users can see maps they own or are collaborators on
CREATE POLICY maps_access_policy ON maps
    FOR ALL
    USING (
        owner_id = current_setting('app.current_user_id')::UUID
        OR id IN (
            SELECT map_id FROM map_collaborators 
            WHERE user_id = current_setting('app.current_user_id')::UUID
        )
    );

-- Users can see pins on maps they have access to
CREATE POLICY map_pins_access_policy ON map_pins
    FOR ALL
    USING (
        map_id IN (
            SELECT id FROM maps WHERE owner_id = current_setting('app.current_user_id')::UUID
            UNION
            SELECT map_id FROM map_collaborators WHERE user_id = current_setting('app.current_user_id')::UUID
        )
    );

-- ========================================
-- SEED DATA (Default Pipeline Stages)
-- ========================================

-- Function to create default stages for a new map
CREATE OR REPLACE FUNCTION create_default_pipeline_stages(p_map_id UUID, p_map_type VARCHAR)
RETURNS VOID AS $$
BEGIN
    -- Acquisition pipeline
    IF p_map_type = 'acquisition' THEN
        INSERT INTO pipeline_stages (map_id, stage_name, stage_order, color, description) VALUES
        (p_map_id, 'New Lead', 1, '#10b981', 'New property opportunity'),
        (p_map_id, 'Analysis', 2, '#3b82f6', 'Under analysis and evaluation'),
        (p_map_id, 'Offer', 3, '#f59e0b', 'Offer submitted'),
        (p_map_id, 'Due Diligence', 4, '#8b5cf6', 'Under contract, due diligence'),
        (p_map_id, 'Closed', 5, '#22c55e', 'Deal closed successfully'),
        (p_map_id, 'Passed', 6, '#ef4444', 'Opportunity passed on');
    
    -- Portfolio pipeline
    ELSIF p_map_type = 'portfolio' THEN
        INSERT INTO pipeline_stages (map_id, stage_name, stage_order, color, description) VALUES
        (p_map_id, 'Owned', 1, '#3b82f6', 'Property owned'),
        (p_map_id, 'Stabilized', 2, '#10b981', 'Fully leased and performing'),
        (p_map_id, 'Value-Add', 3, '#f59e0b', 'Improvement in progress'),
        (p_map_id, 'Refinance', 4, '#8b5cf6', 'Refinancing process'),
        (p_map_id, 'Exit', 5, '#22c55e', 'Listed for sale or sold');
    
    -- Research pipeline (minimal)
    ELSIF p_map_type = 'research' THEN
        INSERT INTO pipeline_stages (map_id, stage_name, stage_order, color, description) VALUES
        (p_map_id, 'Tracking', 1, '#3b82f6', 'Monitoring market'),
        (p_map_id, 'High Interest', 2, '#f59e0b', 'High potential area'),
        (p_map_id, 'Archived', 3, '#6b7280', 'No longer tracking');
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- COMMENTS
-- ========================================

COMMENT ON TABLE maps IS 'User-created maps, each is a separate workspace';
COMMENT ON TABLE map_pins IS 'All pins on maps (properties, news, consultants, etc.)';
COMMENT ON TABLE property_pins IS 'Property-specific data for property pins';
COMMENT ON TABLE pipeline_stages IS 'Customizable pipeline stages per map';
COMMENT ON TABLE deal_silos IS 'All information about a property deal in one place';
COMMENT ON TABLE tasks IS 'Tasks associated with deals or maps';
COMMENT ON TABLE news_articles IS 'Aggregated news articles from various sources';
COMMENT ON TABLE map_annotations IS 'User drawings and annotations on maps';
COMMENT ON TABLE map_layers IS 'Layer visibility settings per map';

-- ========================================
-- Migration Complete
-- ========================================

COMMENT ON SCHEMA public IS 'JediRe Multi-Map System - Migration 013 Complete';

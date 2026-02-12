-- Migration 030: Deal-Centric Architecture
-- Date: 2026-02-05
-- Description: Add deals, deal modules, deal boundaries, and subscription management

-- ============================================================================
-- DEALS TABLE (Core entity)
-- ============================================================================
CREATE TABLE deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  
  -- Geographic boundary (PostGIS polygon)
  boundary GEOMETRY(POLYGON, 4326) NOT NULL,
  
  -- Project details
  project_type VARCHAR(50) NOT NULL, -- 'multifamily', 'mixed_use', 'office', 'retail', 'industrial', 'land'
  project_intent TEXT, -- Free-text description from user
  target_units INTEGER,
  budget NUMERIC(15, 2),
  timeline_start DATE,
  timeline_end DATE,
  
  -- Status
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'archived', 'closed'
  
  -- Subscription tier (cached from user for performance)
  tier VARCHAR(20) NOT NULL, -- 'basic', 'pro', 'enterprise'
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  archived_at TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_deals_user_id ON deals(user_id);
CREATE INDEX idx_deals_status ON deals(status);
CREATE INDEX idx_deals_tier ON deals(tier);
CREATE INDEX idx_deals_boundary ON deals USING GIST(boundary);
CREATE INDEX idx_deals_created_at ON deals(created_at DESC);

-- Spatial index for finding deals near a point
CREATE INDEX idx_deals_boundary_geog ON deals USING GIST(CAST(boundary AS geography));

-- Check constraint: boundary must be valid
ALTER TABLE deals ADD CONSTRAINT check_boundary_valid 
  CHECK (ST_IsValid(boundary) = true);

COMMENT ON TABLE deals IS 'Core deal entity - each deal represents a real estate project with a geographic boundary';
COMMENT ON COLUMN deals.boundary IS 'PostGIS polygon defining the geographic area of this deal';
COMMENT ON COLUMN deals.tier IS 'Cached subscription tier for quick feature access checks';

-- ============================================================================
-- DEAL MODULES (Feature toggles per deal)
-- ============================================================================
CREATE TABLE deal_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  
  -- Module name
  module_name VARCHAR(50) NOT NULL, -- 'map', 'properties', 'strategy', 'market', 'pipeline', 'reports', 'team'
  
  -- Module settings (JSON for flexibility)
  is_enabled BOOLEAN DEFAULT true,
  settings JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Unique constraint: one module config per deal
  UNIQUE(deal_id, module_name)
);

CREATE INDEX idx_deal_modules_deal_id ON deal_modules(deal_id);
CREATE INDEX idx_deal_modules_enabled ON deal_modules(is_enabled);

COMMENT ON TABLE deal_modules IS 'Module configuration per deal - controls which features are enabled based on subscription tier';

-- ============================================================================
-- DEAL PROPERTIES (Link properties to deals)
-- ============================================================================
CREATE TABLE deal_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  
  -- Relationship type
  relationship VARCHAR(50) NOT NULL, -- 'comparable', 'target', 'competitor', 'other'
  
  -- Notes (user can add context)
  notes TEXT,
  
  -- Automatically linked or manually added
  linked_by VARCHAR(20) DEFAULT 'auto', -- 'auto', 'manual'
  confidence_score DECIMAL(3,2), -- 0.00 to 1.00 for auto-linked properties
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Unique constraint: one property can be linked to a deal once
  UNIQUE(deal_id, property_id)
);

CREATE INDEX idx_deal_properties_deal_id ON deal_properties(deal_id);
CREATE INDEX idx_deal_properties_property_id ON deal_properties(property_id);
CREATE INDEX idx_deal_properties_relationship ON deal_properties(relationship);

COMMENT ON TABLE deal_properties IS 'Many-to-many relationship between deals and properties';

-- ============================================================================
-- DEAL EMAILS (Link emails to deals via AI)
-- ============================================================================
CREATE TABLE deal_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  email_id UUID NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
  
  -- AI confidence score (how sure we are this email relates to this deal)
  confidence_score DECIMAL(3,2) NOT NULL, -- 0.00 to 1.00
  
  -- Linking method
  linked_by VARCHAR(20) DEFAULT 'ai', -- 'ai', 'manual'
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Unique constraint
  UNIQUE(deal_id, email_id)
);

CREATE INDEX idx_deal_emails_deal_id ON deal_emails(deal_id);
CREATE INDEX idx_deal_emails_email_id ON deal_emails(email_id);
CREATE INDEX idx_deal_emails_confidence ON deal_emails(confidence_score DESC);

COMMENT ON TABLE deal_emails IS 'Many-to-many relationship between deals and emails, with AI confidence scoring';

-- ============================================================================
-- DEAL ANNOTATIONS (Map markers, notes, custom overlays)
-- ============================================================================
CREATE TABLE deal_annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  
  -- Annotation type
  type VARCHAR(50) NOT NULL, -- 'marker', 'polygon', 'line', 'text', 'circle'
  
  -- Geometry (point, polygon, line, etc.)
  geometry GEOMETRY(GEOMETRY, 4326) NOT NULL,
  
  -- Visual properties
  icon VARCHAR(100), -- Emoji or icon name
  color VARCHAR(20) DEFAULT '#3b82f6', -- Hex color
  label VARCHAR(255),
  
  -- Content
  content TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_deal_annotations_deal_id ON deal_annotations(deal_id);
CREATE INDEX idx_deal_annotations_type ON deal_annotations(type);
CREATE INDEX idx_deal_annotations_geometry ON deal_annotations USING GIST(geometry);

COMMENT ON TABLE deal_annotations IS 'User-created annotations on the map for each deal (markers, notes, custom boundaries)';

-- ============================================================================
-- DEAL PIPELINE (Track deal progression)
-- ============================================================================
CREATE TABLE deal_pipeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  
  -- Current stage
  stage VARCHAR(50) NOT NULL, -- 'lead', 'qualified', 'due_diligence', 'under_contract', 'closing', 'closed', 'post_close'
  
  -- Stage metadata
  entered_stage_at TIMESTAMP DEFAULT NOW(),
  days_in_stage INTEGER GENERATED ALWAYS AS (
    EXTRACT(DAY FROM NOW() - entered_stage_at)
  ) STORED,
  
  -- Notes
  notes TEXT,
  
  -- Stage history (JSONB array)
  stage_history JSONB DEFAULT '[]',
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_deal_pipeline_deal_id ON deal_pipeline(deal_id);
CREATE INDEX idx_deal_pipeline_stage ON deal_pipeline(stage);

COMMENT ON TABLE deal_pipeline IS 'Deal progression tracking through stages';

-- ============================================================================
-- DEAL TASKS (To-do items per deal)
-- ============================================================================
CREATE TABLE deal_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  
  -- Task details
  title VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Status
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'cancelled'
  
  -- Assignment
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- Priority
  priority VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high', 'urgent'
  
  -- Due date
  due_date DATE,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE INDEX idx_deal_tasks_deal_id ON deal_tasks(deal_id);
CREATE INDEX idx_deal_tasks_status ON deal_tasks(status);
CREATE INDEX idx_deal_tasks_assigned_to ON deal_tasks(assigned_to);
CREATE INDEX idx_deal_tasks_due_date ON deal_tasks(due_date);

COMMENT ON TABLE deal_tasks IS 'To-do items and tasks associated with each deal';

-- ============================================================================
-- SUBSCRIPTIONS (User tier management)
-- ============================================================================
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  
  -- Tier
  tier VARCHAR(20) NOT NULL DEFAULT 'basic', -- 'basic', 'pro', 'enterprise'
  
  -- Limits
  max_deals INTEGER NOT NULL DEFAULT 5,
  
  -- Stripe integration
  stripe_customer_id VARCHAR(255) UNIQUE,
  stripe_subscription_id VARCHAR(255) UNIQUE,
  
  -- Status
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'cancelled', 'past_due', 'trialing'
  
  -- Billing
  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,
  cancel_at_period_end BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_tier ON subscriptions(tier);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);

COMMENT ON TABLE subscriptions IS 'User subscription management with Stripe integration';

-- ============================================================================
-- TEAM MEMBERS (Enterprise feature - multi-user access)
-- ============================================================================
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id UUID NOT NULL, -- Reference to team (users table has team_id)
  
  -- Role
  role VARCHAR(50) NOT NULL, -- 'owner', 'admin', 'agent', 'viewer'
  
  -- Deal access (NULL = all deals, or specific deal IDs in array)
  deal_access JSONB, -- ['deal-uuid-1', 'deal-uuid-2'] or null for all
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(user_id, team_id)
);

CREATE INDEX idx_team_members_user_id ON team_members(user_id);
CREATE INDEX idx_team_members_team_id ON team_members(team_id);
CREATE INDEX idx_team_members_role ON team_members(role);

COMMENT ON TABLE team_members IS 'Team member roles and permissions (Enterprise feature)';

-- ============================================================================
-- ACTIVITY LOG (Track all deal activity)
-- ============================================================================
CREATE TABLE deal_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- Activity type
  action_type VARCHAR(50) NOT NULL, -- 'created', 'updated', 'property_added', 'email_linked', 'task_completed', etc.
  
  -- Details
  entity_type VARCHAR(50), -- 'property', 'email', 'task', 'annotation', etc.
  entity_id UUID,
  
  -- Description (for UI display)
  description TEXT NOT NULL,
  
  -- Metadata (flexible JSON)
  metadata JSONB DEFAULT '{}',
  
  -- Timestamp
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_deal_activity_deal_id ON deal_activity(deal_id);
CREATE INDEX idx_deal_activity_user_id ON deal_activity(user_id);
CREATE INDEX idx_deal_activity_created_at ON deal_activity(created_at DESC);
CREATE INDEX idx_deal_activity_action_type ON deal_activity(action_type);

COMMENT ON TABLE deal_activity IS 'Activity feed for each deal - tracks all changes and actions';

-- ============================================================================
-- UPDATE EXISTING TABLES
-- ============================================================================

-- Link analysis results to deals (optional - can run analysis without deal context)
ALTER TABLE analysis_results ADD COLUMN deal_id UUID REFERENCES deals(id) ON DELETE SET NULL;
CREATE INDEX idx_analysis_results_deal_id ON analysis_results(deal_id);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function: Get properties within deal boundary
CREATE OR REPLACE FUNCTION get_deal_properties(p_deal_id UUID)
RETURNS TABLE (
  id UUID,
  address VARCHAR,
  lat DECIMAL,
  lng DECIMAL,
  rent NUMERIC,
  comparable_score DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.address,
    p.lat,
    p.lng,
    p.rent,
    COALESCE(dp.confidence_score, 0) AS comparable_score
  FROM properties p
  JOIN deals d ON d.id = p_deal_id
  LEFT JOIN deal_properties dp ON dp.property_id = p.id AND dp.deal_id = p_deal_id
  WHERE ST_Contains(d.boundary, ST_Point(p.lng, p.lat));
END;
$$ LANGUAGE plpgsql;

-- Function: Count user's active deals
CREATE OR REPLACE FUNCTION count_user_deals(p_user_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER
  FROM deals
  WHERE user_id = p_user_id
    AND status = 'active';
$$ LANGUAGE sql;

-- Function: Check if user can create deal (tier limit)
CREATE OR REPLACE FUNCTION can_create_deal(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_deals INTEGER;
  v_max_deals INTEGER;
BEGIN
  -- Get current deal count
  SELECT count_user_deals(p_user_id) INTO v_current_deals;
  
  -- Get max deals from subscription
  SELECT max_deals INTO v_max_deals
  FROM subscriptions
  WHERE user_id = p_user_id;
  
  -- Default to basic tier if no subscription
  IF v_max_deals IS NULL THEN
    v_max_deals := 5;
  END IF;
  
  RETURN v_current_deals < v_max_deals;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_deals_updated_at BEFORE UPDATE ON deals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_deal_modules_updated_at BEFORE UPDATE ON deal_modules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_deal_properties_updated_at BEFORE UPDATE ON deal_properties
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_deal_annotations_updated_at BEFORE UPDATE ON deal_annotations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger: Log deal activity on creation
CREATE OR REPLACE FUNCTION log_deal_created()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO deal_activity (deal_id, user_id, action_type, description)
  VALUES (NEW.id, NEW.user_id, 'created', 'Deal created: ' || NEW.name);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_log_deal_created AFTER INSERT ON deals
  FOR EACH ROW EXECUTE FUNCTION log_deal_created();

-- ============================================================================
-- SEED DATA (Default modules for each tier)
-- ============================================================================

-- Basic tier module defaults
CREATE TEMP TABLE tier_modules AS
SELECT 'basic' AS tier, unnest(ARRAY['map', 'properties', 'pipeline']) AS module_name
UNION ALL
SELECT 'pro', unnest(ARRAY['map', 'properties', 'pipeline', 'strategy', 'market'])
UNION ALL
SELECT 'enterprise', unnest(ARRAY['map', 'properties', 'pipeline', 'strategy', 'market', 'reports', 'team']);

COMMENT ON TABLE tier_modules IS 'Reference table for default modules per tier (temp table for migration)';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO jedire_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO jedire_app;

-- Vacuum analyze for performance
VACUUM ANALYZE deals;
VACUUM ANALYZE deal_modules;
VACUUM ANALYZE deal_properties;
VACUUM ANALYZE subscriptions;

COMMENT ON SCHEMA public IS 'JEDI RE deal-centric architecture - Migration 030 applied 2026-02-05';

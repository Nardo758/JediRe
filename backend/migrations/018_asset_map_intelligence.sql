-- Migration 018: Asset Map Intelligence System
-- Date: 2026-02-12
-- Description: Adds tables for news-asset linking, location-based notes, note replies, categories, and permissions

-- Enable PostGIS if not already enabled
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================================
-- TABLE 1: asset_news_links
-- Links news events to assets (auto + manual)
-- ============================================================================

CREATE TABLE IF NOT EXISTS asset_news_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  news_event_id UUID NOT NULL REFERENCES news_events(id) ON DELETE CASCADE,
  
  -- Link metadata
  link_type VARCHAR(10) NOT NULL CHECK (link_type IN ('auto', 'manual', 'dismissed')),
  distance_miles DECIMAL(6,2), -- Distance from asset (for auto-links)
  impact_score INTEGER CHECK (impact_score BETWEEN 1 AND 10),
  
  -- User notes on this link
  user_notes TEXT,
  
  -- Tracking
  linked_by UUID REFERENCES users(id),
  linked_at TIMESTAMP DEFAULT NOW(),
  dismissed_by UUID REFERENCES users(id),
  dismissed_at TIMESTAMP,
  
  -- Prevent duplicates
  UNIQUE(asset_id, news_event_id),
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for asset_news_links
CREATE INDEX IF NOT EXISTS idx_asset_news_asset ON asset_news_links(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_news_event ON asset_news_links(news_event_id);
CREATE INDEX IF NOT EXISTS idx_asset_news_type ON asset_news_links(link_type);
CREATE INDEX IF NOT EXISTS idx_asset_news_score ON asset_news_links(impact_score DESC);

-- ============================================================================
-- TABLE 2: note_categories
-- User-defined categories for organizing notes
-- ============================================================================

CREATE TABLE IF NOT EXISTS note_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Ownership (NULL = system default)
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID, -- For future org-level categories
  
  -- Category details
  name VARCHAR(100) NOT NULL,
  color VARCHAR(7) DEFAULT '#6B7280', -- Hex color
  icon VARCHAR(50) DEFAULT '📝', -- Emoji or icon name
  
  -- System defaults
  is_system_default BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  
  -- Tracking
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Prevent duplicate names per user/org
  UNIQUE(user_id, COALESCE(organization_id::text, ''), name)
);

-- Indexes for note_categories
CREATE INDEX IF NOT EXISTS idx_note_categories_user ON note_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_note_categories_org ON note_categories(organization_id);

-- Seed default categories
INSERT INTO note_categories (name, color, icon, is_system_default, display_order) 
VALUES
  ('Observation', '#3B82F6', '👁️', true, 1),
  ('Issue', '#EF4444', '⚠️', true, 2),
  ('Opportunity', '#10B981', '💡', true, 3)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- TABLE 3: asset_notes
-- Location-based and general notes for assets
-- ============================================================================

CREATE TABLE IF NOT EXISTS asset_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  
  -- Note type
  note_type VARCHAR(20) NOT NULL CHECK (note_type IN ('location', 'general', 'annotation')),
  
  -- Content (max 5,000 characters)
  title VARCHAR(255),
  content TEXT NOT NULL CHECK (LENGTH(content) <= 5000),
  category_id UUID REFERENCES note_categories(id) ON DELETE SET NULL,
  
  -- Spatial data (for location and annotation types)
  location GEOGRAPHY(POINT, 4326), -- Lat/lng for location notes
  geometry GEOGRAPHY(GEOMETRY, 4326), -- Polygon/line for annotations
  
  -- Attachments (max 50 MB total)
  attachments JSONB DEFAULT '[]', -- [{type: 'photo', url: '...', name: '...', size: bytes}]
  total_attachment_size_bytes INTEGER DEFAULT 0,
  
  -- Threading
  reply_count INTEGER DEFAULT 0,
  last_reply_at TIMESTAMP,
  
  -- Metadata
  author_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Visibility
  is_private BOOLEAN DEFAULT false
);

-- Indexes for asset_notes
CREATE INDEX IF NOT EXISTS idx_asset_notes_asset ON asset_notes(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_notes_author ON asset_notes(author_id);
CREATE INDEX IF NOT EXISTS idx_asset_notes_category ON asset_notes(category_id);
CREATE INDEX IF NOT EXISTS idx_asset_notes_created ON asset_notes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_asset_notes_type ON asset_notes(note_type);

-- Spatial indexes
CREATE INDEX IF NOT EXISTS idx_asset_notes_location ON asset_notes USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_asset_notes_geometry ON asset_notes USING GIST (geometry);

-- ============================================================================
-- TABLE 4: note_replies
-- Comments/replies on notes for team collaboration
-- ============================================================================

CREATE TABLE IF NOT EXISTS note_replies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  note_id UUID NOT NULL REFERENCES asset_notes(id) ON DELETE CASCADE,
  
  -- Content (max 5,000 characters)
  content TEXT NOT NULL CHECK (LENGTH(content) <= 5000),
  
  -- Author
  author_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Edited tracking
  is_edited BOOLEAN DEFAULT false
);

-- Indexes for note_replies
CREATE INDEX IF NOT EXISTS idx_note_replies_note ON note_replies(note_id);
CREATE INDEX IF NOT EXISTS idx_note_replies_author ON note_replies(author_id);
CREATE INDEX IF NOT EXISTS idx_note_replies_created ON note_replies(created_at DESC);

-- Trigger to update reply_count on parent note
CREATE OR REPLACE FUNCTION update_note_reply_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE asset_notes 
    SET reply_count = reply_count + 1,
        last_reply_at = NEW.created_at
    WHERE id = NEW.note_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE asset_notes 
    SET reply_count = GREATEST(reply_count - 1, 0),
        last_reply_at = (
          SELECT MAX(created_at) 
          FROM note_replies 
          WHERE note_id = OLD.note_id
        )
    WHERE id = OLD.note_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS note_reply_count_trigger ON note_replies;
CREATE TRIGGER note_reply_count_trigger
AFTER INSERT OR DELETE ON note_replies
FOR EACH ROW EXECUTE FUNCTION update_note_reply_count();

-- ============================================================================
-- TABLE 5: asset_note_permissions
-- Controls who can view/edit notes on an asset
-- ============================================================================

CREATE TABLE IF NOT EXISTS asset_note_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Permission level
  permission VARCHAR(20) NOT NULL CHECK (permission IN ('view', 'edit', 'admin')),
  
  -- Granted by deal thread creator
  granted_by UUID NOT NULL REFERENCES users(id),
  granted_at TIMESTAMP DEFAULT NOW(),
  
  -- Prevent duplicates
  UNIQUE(asset_id, user_id)
);

-- Indexes for asset_note_permissions
CREATE INDEX IF NOT EXISTS idx_asset_note_perms_asset ON asset_note_permissions(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_note_perms_user ON asset_note_permissions(user_id);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to auto-link news events within radius to assets
CREATE OR REPLACE FUNCTION auto_link_news_to_assets(news_event_id UUID, radius_miles DECIMAL DEFAULT 5.0)
RETURNS INTEGER AS $$
DECLARE
  linked_count INTEGER := 0;
  asset_record RECORD;
  news_location GEOGRAPHY;
  news_type VARCHAR;
BEGIN
  -- Get news event location
  SELECT location, type INTO news_location, news_type
  FROM news_events
  WHERE id = news_event_id;
  
  IF news_location IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Find all assets within radius
  FOR asset_record IN
    SELECT 
      d.id as asset_id,
      ST_Distance(d.location::geography, news_location) / 1609.34 as distance_miles
    FROM deals d
    WHERE d.location IS NOT NULL
      AND ST_DWithin(d.location::geography, news_location, radius_miles * 1609.34)
  LOOP
    -- Calculate impact score (closer = higher impact)
    DECLARE
      score INTEGER;
    BEGIN
      score := GREATEST(1, LEAST(10, 10 - FLOOR(asset_record.distance_miles)));
      
      -- Insert auto-link if not exists
      INSERT INTO asset_news_links (
        asset_id, 
        news_event_id, 
        link_type, 
        distance_miles, 
        impact_score
      )
      VALUES (
        asset_record.asset_id,
        news_event_id,
        'auto',
        ROUND(asset_record.distance_miles::numeric, 2),
        score
      )
      ON CONFLICT (asset_id, news_event_id) DO NOTHING;
      
      linked_count := linked_count + 1;
    END;
  END LOOP;
  
  RETURN linked_count;
END;
$$ LANGUAGE plpgsql;

-- Function to check if user has note permission on asset
CREATE OR REPLACE FUNCTION user_has_note_permission(
  p_user_id UUID,
  p_asset_id UUID,
  required_permission VARCHAR DEFAULT 'view'
)
RETURNS BOOLEAN AS $$
DECLARE
  is_creator BOOLEAN;
  user_permission VARCHAR;
BEGIN
  -- Check if user is deal creator (full access)
  SELECT EXISTS(
    SELECT 1 FROM deals 
    WHERE id = p_asset_id AND user_id = p_user_id
  ) INTO is_creator;
  
  IF is_creator THEN
    RETURN TRUE;
  END IF;
  
  -- Check explicit permissions
  SELECT permission INTO user_permission
  FROM asset_note_permissions
  WHERE asset_id = p_asset_id AND user_id = p_user_id;
  
  IF user_permission IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Permission hierarchy: admin > edit > view
  IF required_permission = 'view' THEN
    RETURN user_permission IN ('view', 'edit', 'admin');
  ELSIF required_permission = 'edit' THEN
    RETURN user_permission IN ('edit', 'admin');
  ELSIF required_permission = 'admin' THEN
    RETURN user_permission = 'admin';
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE asset_news_links IS 'Links news events to assets (auto-detected or manual)';
COMMENT ON TABLE note_categories IS 'User-defined categories for organizing notes';
COMMENT ON TABLE asset_notes IS 'Location-based and general notes for assets with spatial data';
COMMENT ON TABLE note_replies IS 'Threaded replies/comments on notes for team collaboration';
COMMENT ON TABLE asset_note_permissions IS 'Permission control for who can view/edit notes on assets';

COMMENT ON FUNCTION auto_link_news_to_assets IS 'Auto-links news events to assets within specified radius';
COMMENT ON FUNCTION user_has_note_permission IS 'Checks if user has required permission level for asset notes';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Record migration
INSERT INTO schema_migrations (version, description, applied_at)
VALUES (18, 'Asset Map Intelligence System', NOW())
ON CONFLICT (version) DO NOTHING;

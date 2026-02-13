-- Migration 033: Asset notes, news links, and collaboration tables

CREATE TABLE IF NOT EXISTS note_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  color VARCHAR(7) DEFAULT '#6B7280',
  icon VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS asset_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title VARCHAR(255),
  content TEXT NOT NULL,
  category_id UUID REFERENCES note_categories(id),
  is_pinned BOOLEAN DEFAULT false,
  is_private BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS note_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES asset_notes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS asset_note_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES asset_notes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  permission VARCHAR(20) DEFAULT 'read',
  granted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS asset_news_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  news_event_id UUID,
  title VARCHAR(500) NOT NULL,
  url TEXT,
  source VARCHAR(100),
  relevance_score NUMERIC(3,2) DEFAULT 0.5,
  impact_type VARCHAR(50),
  linked_at TIMESTAMPTZ DEFAULT NOW(),
  linked_by UUID
);

CREATE INDEX IF NOT EXISTS idx_asset_notes_deal ON asset_notes(deal_id);
CREATE INDEX IF NOT EXISTS idx_asset_notes_user ON asset_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_note_replies_note ON note_replies(note_id);
CREATE INDEX IF NOT EXISTS idx_asset_news_links_deal ON asset_news_links(deal_id);

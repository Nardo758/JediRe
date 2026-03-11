-- =====================================================
-- Deal State Persistence Migration
-- Purpose: Store all deal-related development data 
-- with versioning and snapshot support
-- =====================================================

-- Main deal state table
CREATE TABLE IF NOT EXISTS deals_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Development data (stored as JSONB for flexibility)
  design_3d JSONB,
  market_analysis JSONB,
  competition_data JSONB,
  supply_data JSONB,
  due_diligence JSONB,
  timeline_data JSONB,
  
  -- Metadata
  version INTEGER DEFAULT 1,
  last_saved TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Ensure one state per deal
  UNIQUE(deal_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_deals_state_deal_id ON deals_state(deal_id);
CREATE INDEX IF NOT EXISTS idx_deals_state_user_id ON deals_state(user_id);
CREATE INDEX IF NOT EXISTS idx_deals_state_updated_at ON deals_state(updated_at DESC);

-- Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION update_deals_state_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.last_saved = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_deals_state_timestamp
  BEFORE UPDATE ON deals_state
  FOR EACH ROW
  EXECUTE FUNCTION update_deals_state_timestamp();

-- =====================================================
-- Deal Snapshots Table
-- Purpose: Version control and restore points
-- =====================================================

CREATE TABLE IF NOT EXISTS deal_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Snapshot data (full state at time of snapshot)
  snapshot_data JSONB NOT NULL,
  
  -- Metadata
  name VARCHAR(255),
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Foreign key to parent state
  state_id UUID REFERENCES deals_state(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_deal_snapshots_deal_id ON deal_snapshots(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_snapshots_user_id ON deal_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_deal_snapshots_created_at ON deal_snapshots(created_at DESC);

-- =====================================================
-- Comments
-- =====================================================

COMMENT ON TABLE deals_state IS 'Stores persistent state for all deal development data including 3D design, market analysis, and other workflow data';
COMMENT ON COLUMN deals_state.design_3d IS 'Reference to 3D design data (actual large data stored in IndexedDB on client)';
COMMENT ON COLUMN deals_state.market_analysis IS 'Market analysis data including demographics and trends';
COMMENT ON COLUMN deals_state.competition_data IS 'Competitive analysis and market positioning';
COMMENT ON COLUMN deals_state.supply_data IS 'Supply pipeline and future development data';
COMMENT ON COLUMN deals_state.due_diligence IS 'Due diligence documents and findings';
COMMENT ON COLUMN deals_state.timeline_data IS 'Project timeline and milestone tracking';
COMMENT ON COLUMN deals_state.version IS 'Version number, incremented on each save';

COMMENT ON TABLE deal_snapshots IS 'Version control snapshots for deal state, allowing restore to previous points';
COMMENT ON COLUMN deal_snapshots.snapshot_data IS 'Full state snapshot at time of creation';
COMMENT ON COLUMN deal_snapshots.name IS 'User-defined name for the snapshot';

-- =====================================================
-- Grant permissions
-- =====================================================

-- Grant access to authenticated users
GRANT SELECT, INSERT, UPDATE ON deals_state TO authenticated;
GRANT SELECT, INSERT ON deal_snapshots TO authenticated;

-- Grant usage on sequences if any
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Migration 132: Deal Collaboration Layer (M29 Phase 2)
-- Extends existing team management tables for real-time collaboration

-- 1. Add permission_level to deal_team_members
ALTER TABLE deal_team_members
  ADD COLUMN IF NOT EXISTS permission_level VARCHAR(20) DEFAULT 'view'
  CHECK (permission_level IN ('view', 'comment', 'edit', 'admin'));

-- 2. Extend deal_team_comments for module-anchored, resolvable threads
ALTER TABLE deal_team_comments
  ADD COLUMN IF NOT EXISTS module_anchor VARCHAR(100),
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS resolved_by UUID;

-- 3. Activity log table for cross-deal event tracking
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID,
  user_name VARCHAR(255) NOT NULL,
  user_email VARCHAR(255),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100),
  entity_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_activity_log_deal_id ON activity_log(deal_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_org_id ON activity_log(org_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_action ON activity_log(action);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_comments_module ON deal_team_comments(module_anchor);
CREATE INDEX IF NOT EXISTS idx_team_comments_resolved ON deal_team_comments(resolved_at);
CREATE INDEX IF NOT EXISTS idx_team_members_permission ON deal_team_members(permission_level);

COMMENT ON TABLE activity_log IS 'Unified activity log for deal and org-level events';
COMMENT ON COLUMN deal_team_members.permission_level IS 'Granular permission: view, comment, edit, admin';
COMMENT ON COLUMN deal_team_comments.module_anchor IS 'Module ID the comment is anchored to (e.g. proforma, market-intelligence)';
COMMENT ON COLUMN deal_team_comments.resolved_at IS 'Timestamp when comment thread was resolved';
COMMENT ON COLUMN deal_team_comments.resolved_by IS 'User ID who resolved the comment thread';

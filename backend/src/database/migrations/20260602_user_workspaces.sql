-- Task #920 — Workspace composability: Mode 4 (Gap 6)
-- Append-only layout store for user-configured workspaces.
-- layout: JSONB array of PanelDescriptor objects:
--   { id, panel_type, entity_id, label, x, y, w, h }
-- panel_type: 'deal_summary' | 'market_chart' | 'module_table'

CREATE TABLE IF NOT EXISTS user_workspaces (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT        NOT NULL,
  name        TEXT        NOT NULL DEFAULT 'My Workspace',
  layout      JSONB       NOT NULL DEFAULT '[]'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_workspaces_user_id
  ON user_workspaces (user_id);

CREATE INDEX IF NOT EXISTS idx_user_workspaces_updated
  ON user_workspaces (user_id, updated_at DESC);

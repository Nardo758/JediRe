CREATE TABLE IF NOT EXISTS grid_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  name VARCHAR(100) NOT NULL,
  view_id VARCHAR(50) NOT NULL,
  columns JSONB NOT NULL DEFAULT '[]',
  column_config JSONB NOT NULL DEFAULT '{}',
  is_shared BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_grid_templates_user ON grid_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_grid_templates_view ON grid_templates(view_id);

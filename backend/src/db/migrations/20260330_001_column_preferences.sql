CREATE TABLE IF NOT EXISTS user_column_preferences (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  view_id VARCHAR(50) NOT NULL,
  columns JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, view_id)
);

CREATE INDEX IF NOT EXISTS idx_user_col_prefs_user ON user_column_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_col_prefs_view ON user_column_preferences(view_id);

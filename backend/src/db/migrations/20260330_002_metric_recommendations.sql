CREATE TABLE IF NOT EXISTS metric_recommendations (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  geography_type VARCHAR(50) NOT NULL,
  geography_id VARCHAR(255) NOT NULL,
  recommendations JSONB NOT NULL DEFAULT '[]',
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  UNIQUE(user_id, geography_type, geography_id)
);

CREATE INDEX IF NOT EXISTS idx_metric_recs_user ON metric_recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_metric_recs_geo ON metric_recommendations(geography_type, geography_id);
CREATE INDEX IF NOT EXISTS idx_metric_recs_expires ON metric_recommendations(expires_at);

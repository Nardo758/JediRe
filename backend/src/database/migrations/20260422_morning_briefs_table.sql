-- Morning Briefs Cache Table
-- Stores generated morning briefs to avoid regenerating on every request
-- Created: 2026-04-22

CREATE TABLE IF NOT EXISTS morning_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Note: index is on the raw TIMESTAMPTZ (not DATE(generated_at)) because
-- DATE() applied to TIMESTAMPTZ is not IMMUTABLE (depends on session TZ),
-- which Postgres rejects in index expressions.
CREATE INDEX IF NOT EXISTS idx_morning_briefs_user_date 
  ON morning_briefs(user_id, generated_at DESC);

-- Keep only last 7 days of briefs per user
CREATE OR REPLACE FUNCTION cleanup_old_morning_briefs()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM morning_briefs 
  WHERE user_id = NEW.user_id 
  AND generated_at < NOW() - INTERVAL '7 days';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cleanup_morning_briefs ON morning_briefs;
CREATE TRIGGER trg_cleanup_morning_briefs
  AFTER INSERT ON morning_briefs
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_old_morning_briefs();

COMMENT ON TABLE morning_briefs IS 'Cached daily morning briefings for each user';

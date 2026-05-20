-- Migration: capsule_fork_log — attribution table for platform-to-platform share forks
-- Tracks every "Fork to my pipeline" action so the original sender can see
-- who forked their deal and when.

CREATE TABLE IF NOT EXISTS capsule_fork_log (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  shortcode          VARCHAR(8)  NOT NULL,
  capsule_id         UUID        NOT NULL,
  source_share_id    UUID        REFERENCES capsule_external_shares(share_id) ON DELETE SET NULL,
  forked_by_user_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  new_deal_id        UUID        NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fork_log_capsule      ON capsule_fork_log (capsule_id);
CREATE INDEX IF NOT EXISTS idx_fork_log_shortcode     ON capsule_fork_log (shortcode);
CREATE INDEX IF NOT EXISTS idx_fork_log_forked_by     ON capsule_fork_log (forked_by_user_id);
CREATE INDEX IF NOT EXISTS idx_fork_log_new_deal      ON capsule_fork_log (new_deal_id);

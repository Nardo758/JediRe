-- Migration: knowledge_graph_embedding_sweeps
-- Date: 2026-05-03
-- Description: Persistent history of periodic embedding-staleness sweeps so
-- admins can answer "when did the last sweep run?", "how many nodes have
-- been refreshed in the last 24h?", and "did the sweep ever fail?" without
-- scraping server logs. Backs Task #410.

CREATE TABLE IF NOT EXISTS knowledge_graph_embedding_sweeps (
  id           BIGSERIAL    PRIMARY KEY,
  started_at   TIMESTAMPTZ  NOT NULL,
  finished_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  duration_ms  INTEGER      NOT NULL DEFAULT 0,
  scanned      INTEGER      NOT NULL DEFAULT 0,
  refreshed    INTEGER      NOT NULL DEFAULT 0,
  missing      INTEGER      NOT NULL DEFAULT 0,
  skipped      INTEGER      NOT NULL DEFAULT 0,
  errors       INTEGER      NOT NULL DEFAULT 0,
  error_message TEXT        NULL,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kg_embedding_sweeps_started
  ON knowledge_graph_embedding_sweeps (started_at DESC);

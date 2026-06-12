-- Agent data-matrix session cache
-- Keyed on (deal_id, cache_key) where cache_key is a SHA-256 hash of layers + searchRadiusMiles.
-- Default TTL: 4 hours (configurable at call site via expires_at).
-- ON CONFLICT upsert — safe to call multiple times; first caller populates, rest read.

CREATE TABLE IF NOT EXISTS agent_data_matrix_cache (
  id             UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id        UUID            NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  cache_key      TEXT            NOT NULL,
  payload        JSONB           NOT NULL,
  created_at     TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  expires_at     TIMESTAMPTZ     NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS agent_data_matrix_cache_deal_key
  ON agent_data_matrix_cache (deal_id, cache_key);

CREATE INDEX IF NOT EXISTS agent_data_matrix_cache_expires
  ON agent_data_matrix_cache (expires_at);

COMMENT ON TABLE agent_data_matrix_cache IS
  'Per-deal session cache for fetch_data_matrix results. '
  'Eliminates redundant DataMatrixService.buildContext() calls across agents in the same session. '
  'TTL default 4 hours; expired rows are safe to delete by a nightly vacuum job.';

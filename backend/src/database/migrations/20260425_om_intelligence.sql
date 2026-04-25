-- Task #383 — Broker OM ingestion → market intelligence
-- Additive only: new columns on data_library_files, new broker_narratives table,
-- relaxed CHECK on market_sentiment_history.source to allow 'broker_om'.

-- ── data_library_files: tag MSA/submarket + persist OM extraction blob + parsing stage
ALTER TABLE data_library_files
  ADD COLUMN IF NOT EXISTS msa_key        TEXT,
  ADD COLUMN IF NOT EXISTS submarket_key  TEXT,
  ADD COLUMN IF NOT EXISTS om_extraction  JSONB,
  ADD COLUMN IF NOT EXISTS parsing_stage  TEXT;

CREATE INDEX IF NOT EXISTS idx_data_library_files_msa
  ON data_library_files (msa_key);
CREATE INDEX IF NOT EXISTS idx_data_library_files_submarket
  ON data_library_files (submarket_key);

-- ── broker_narratives: feed for Submarket/MSA Commentary tabs + Commentary Agent prompt
CREATE TABLE IF NOT EXISTS broker_narratives (
  id              BIGSERIAL PRIMARY KEY,
  source_file_id  INTEGER NOT NULL REFERENCES data_library_files(id) ON DELETE CASCADE,
  msa_key         TEXT,
  submarket_key   TEXT,
  deal_id         TEXT,
  kind            TEXT NOT NULL CHECK (kind IN ('thesis','highlight')),
  text            TEXT NOT NULL,
  broker          TEXT,
  property_name   TEXT,
  captured_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sentiment_label TEXT CHECK (sentiment_label IS NULL OR sentiment_label IN ('bullish','neutral','bearish')),
  sentiment_score NUMERIC(4,3)
);

CREATE INDEX IF NOT EXISTS idx_broker_narratives_msa
  ON broker_narratives (msa_key, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_broker_narratives_submarket
  ON broker_narratives (submarket_key, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_broker_narratives_source
  ON broker_narratives (source_file_id);

-- ── data_library_cost_data: per-property replacement-cost rows aggregated for the panel
CREATE TABLE IF NOT EXISTS data_library_cost_data (
  id                        BIGSERIAL PRIMARY KEY,
  source_file_id            INTEGER REFERENCES data_library_files(id) ON DELETE CASCADE,
  msa_key                   TEXT,
  submarket_key             TEXT,
  property_name             TEXT,
  property_type             TEXT,
  units                     INTEGER,
  year_built                INTEGER,
  land_value                NUMERIC,
  hard_cost_psf             NUMERIC,
  hard_cost_total           NUMERIC,
  soft_cost_pct             NUMERIC,
  soft_cost_total           NUMERIC,
  total_replacement_cost    NUMERIC,
  replacement_cost_per_unit NUMERIC,
  cost_source               TEXT,
  source                    TEXT NOT NULL,
  source_id                 TEXT,
  captured_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_data_library_cost_data_msa
  ON data_library_cost_data (msa_key);
CREATE INDEX IF NOT EXISTS idx_data_library_cost_data_submarket
  ON data_library_cost_data (submarket_key);

-- ── market_sentiment_history: allow 'broker_om' as a source
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'market_sentiment_history_source_check'
  ) THEN
    ALTER TABLE market_sentiment_history
      DROP CONSTRAINT market_sentiment_history_source_check;
  END IF;

  ALTER TABLE market_sentiment_history
    ADD CONSTRAINT market_sentiment_history_source_check
    CHECK (source IN ('agent_run','cron_snapshot','backfill','broker_om'));
END $$;

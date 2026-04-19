-- Migration: archive_assumption_benchmarks
-- Date: 2026-04-19
-- Description: Nightly archive of underwriting assumption statistics across
--              platform deals — forms the Archive Feedback Loop that lets the
--              CashFlow Agent self-calibrate against historical outcomes.

CREATE TABLE IF NOT EXISTS archive_assumption_benchmarks (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_class         TEXT        NOT NULL,
  deal_type           TEXT        NOT NULL,
  submarket_id        TEXT,
  vintage_band        TEXT,
  strategy            TEXT,
  assumption_name     TEXT        NOT NULL,
  p10                 NUMERIC,
  p25                 NUMERIC,
  p50                 NUMERIC,
  p75                 NUMERIC,
  p90                 NUMERIC,
  assumed_median      NUMERIC,
  achieved_median     NUMERIC,
  gap_bps             NUMERIC,
  n_samples           INTEGER     NOT NULL DEFAULT 0,
  n_closed_deals      INTEGER     NOT NULL DEFAULT 0,
  as_of               DATE        NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Lookup index: (asset_class, deal_type, submarket_id, assumption_name, as_of DESC)
-- Supports both the nightly aggregation write path and the agent query tools.
CREATE INDEX IF NOT EXISTS idx_archive_benchmarks_lookup
  ON archive_assumption_benchmarks(asset_class, deal_type, submarket_id, assumption_name, as_of DESC);

-- Partial index for fast "latest row per bucket" lookups without specifying as_of
CREATE INDEX IF NOT EXISTS idx_archive_benchmarks_latest
  ON archive_assumption_benchmarks(asset_class, deal_type, assumption_name, as_of DESC)
  WHERE n_samples >= 5;

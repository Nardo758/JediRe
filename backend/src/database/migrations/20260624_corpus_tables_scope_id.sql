-- Migration: 20260624_corpus_tables_scope_id
-- Description: Adds scope_id (and redistribution_restricted where missing) to all
--   corpus tables per ADR-009 Lane-A/B Data Scope. All changes are additive with
--   safe defaults so existing rows remain Lane-A / GLOBAL.
--
-- Tables affected:
--   - data_library_files      (+ scope_id only; already has redistribution_restricted)
--   - historical_observations   (+ scope_id only; already has redistribution_restricted)
--   - apartment_market_snapshots (+ scope_id + redistribution_restricted)
--   - metric_time_series       (+ scope_id + redistribution_restricted)
--   - metric_correlations      (+ scope_id + redistribution_restricted; re-key unique idx)
--   - correlation_history      (+ scope_id only; re-key unique idx)

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. data_library_files  (already has redistribution_restricted)
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE data_library_files
  ADD COLUMN IF NOT EXISTS scope_id TEXT NOT NULL DEFAULT 'GLOBAL';

CREATE INDEX IF NOT EXISTS idx_data_library_files_scope
  ON data_library_files (scope_id);

COMMENT ON COLUMN data_library_files.scope_id IS
  'Lane-A/B scope: GLOBAL = redistributable; user:<uuid> = user-scoped Lane-B data.';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. historical_observations  (already has redistribution_restricted)
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE historical_observations
  ADD COLUMN IF NOT EXISTS scope_id TEXT NOT NULL DEFAULT 'GLOBAL';

CREATE INDEX IF NOT EXISTS idx_hist_obs_scope
  ON historical_observations (scope_id, geography_level, observation_date);

COMMENT ON COLUMN historical_observations.scope_id IS
  'Lane-A/B scope: GLOBAL = redistributable; user:<uuid> = user-scoped Lane-B data.';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. apartment_market_snapshots  (missing both columns)
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE apartment_market_snapshots
  ADD COLUMN IF NOT EXISTS scope_id TEXT NOT NULL DEFAULT 'GLOBAL',
  ADD COLUMN IF NOT EXISTS redistribution_restricted BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_apartment_market_snapshots_scope
  ON apartment_market_snapshots (scope_id, city, state, snapshot_date);

COMMENT ON COLUMN apartment_market_snapshots.scope_id IS
  'Lane-A/B scope: GLOBAL = redistributable; user:<uuid> = user-scoped Lane-B data.';

COMMENT ON COLUMN apartment_market_snapshots.redistribution_restricted IS
  'TRUE for licensed vendor data that may not be redistributed (e.g., CoStar, Yardi Matrix).';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. metric_time_series  (missing both columns)
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE metric_time_series
  ADD COLUMN IF NOT EXISTS scope_id TEXT NOT NULL DEFAULT 'GLOBAL',
  ADD COLUMN IF NOT EXISTS redistribution_restricted BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_mts_scope
  ON metric_time_series (scope_id, geography_type, geography_id);

COMMENT ON COLUMN metric_time_series.scope_id IS
  'Lane-A/B scope: GLOBAL = redistributable; user:<uuid> = user-scoped Lane-B data.';

COMMENT ON COLUMN metric_time_series.redistribution_restricted IS
  'TRUE if any leaf input series was restricted; propagated via taint rule.';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. metric_correlations  (missing both columns; re-key unique index)
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE metric_correlations
  ADD COLUMN IF NOT EXISTS scope_id TEXT NOT NULL DEFAULT 'GLOBAL',
  ADD COLUMN IF NOT EXISTS redistribution_restricted BOOLEAN NOT NULL DEFAULT FALSE;

DROP INDEX IF EXISTS idx_mc_unique;

CREATE UNIQUE INDEX idx_mc_unique
  ON metric_correlations
     (scope_id, metric_a, metric_b, geography_type, COALESCE(geography_id, '__AGG__'), window_months);

COMMENT ON COLUMN metric_correlations.scope_id IS
  'Lane-A/B scope: GLOBAL = redistributable; user:<uuid> = user-scoped Lane-B data.';

COMMENT ON COLUMN metric_correlations.redistribution_restricted IS
  'TRUE if any input metric_time_series was restricted; propagated via taint rule.';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. correlation_history  (missing scope_id; re-key unique index)
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE correlation_history
  ADD COLUMN IF NOT EXISTS scope_id TEXT NOT NULL DEFAULT 'GLOBAL';

DROP INDEX IF EXISTS idx_corr_hist_daily_unique;

CREATE UNIQUE INDEX idx_corr_hist_daily_unique
  ON correlation_history
     (scope_id, metric_a, metric_b, geography_type, COALESCE(geography_id, ''), window_months, computed_date);

COMMENT ON COLUMN correlation_history.scope_id IS
  'Lane-A/B scope: GLOBAL = redistributable; user:<uuid> = user-scoped Lane-B data.';

COMMIT;

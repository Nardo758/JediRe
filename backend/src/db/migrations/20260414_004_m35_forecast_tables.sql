-- M35 Phase 4: Event Forecast Tables
-- Generated: 2026-04-14
-- Depends on: 20260414_003_m35_playbook_tables.sql (key_events, event_playbooks)
--
-- Tables:
--   event_forecasts            — per-event × metric × window forward projections with CI
--   forecast_actuals_tracking  — nightly divergence check log

-- ─── Preflight: idempotent guard ─────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'event_forecasts') THEN
    RAISE NOTICE 'event_forecasts already exists — skipping migration';
    RETURN;
  END IF;
END $$;

-- ─── event_forecasts ─────────────────────────────────────────────────────────
-- One row per event × metric_key × window_months × model generation.
-- On re-generation the previous active rows are marked superseded.
-- On cancellation/reversal they are marked invalidated.

CREATE TABLE IF NOT EXISTS event_forecasts (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id             UUID NOT NULL REFERENCES key_events(id) ON DELETE CASCADE,

  metric_key           VARCHAR(64)  NOT NULL,
  window_months        SMALLINT     NOT NULL,   -- 3 | 12 | 24 | 36

  -- Point estimate and 80% confidence interval
  point_estimate       NUMERIC(18,6),
  ci_low               NUMERIC(18,6),
  ci_high              NUMERIC(18,6),
  confidence           NUMERIC(4,3),            -- overall forecast confidence 0–1

  model_version        VARCHAR(32)  NOT NULL DEFAULT 'v1',
  status               VARCHAR(16)  NOT NULL DEFAULT 'active',
  -- 'active' | 'superseded' | 'invalidated'

  -- Full derivation trace: stratum, scaling, submarket adj, regime adj
  derivation           JSONB        NOT NULL DEFAULT '{}',

  generated_at         TIMESTAMPTZ  DEFAULT NOW(),
  superseded_at        TIMESTAMPTZ,
  invalidated_at       TIMESTAMPTZ,
  invalidation_reason  VARCHAR(128)
);

-- Partial index on active rows for fast lookup
CREATE INDEX IF NOT EXISTS idx_event_forecasts_event
  ON event_forecasts (event_id);

CREATE INDEX IF NOT EXISTS idx_event_forecasts_metric
  ON event_forecasts (metric_key);

CREATE INDEX IF NOT EXISTS idx_event_forecasts_status
  ON event_forecasts (status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_event_forecasts_active
  ON event_forecasts (event_id, metric_key, window_months)
  WHERE status = 'active';

-- ─── forecast_actuals_tracking ────────────────────────────────────────────────
-- Nightly job compares actual metric values vs active forecasts.
-- Fires m35.forecast.diverged Kafka event when actual falls outside CI.

CREATE TABLE IF NOT EXISTS forecast_actuals_tracking (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  forecast_id     UUID NOT NULL REFERENCES event_forecasts(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES key_events(id)      ON DELETE CASCADE,

  metric_key      VARCHAR(64) NOT NULL,
  window_months   SMALLINT    NOT NULL,

  checked_at      TIMESTAMPTZ DEFAULT NOW(),
  actual_value    NUMERIC(18,6),
  forecast_value  NUMERIC(18,6),
  divergence_pct  NUMERIC(10,4),   -- (actual - forecast) / |forecast|
  is_diverged     BOOLEAN     DEFAULT false,
  status_label    VARCHAR(16) DEFAULT 'on_pace'
  -- 'ahead' | 'behind' | 'on_pace'
);

CREATE INDEX IF NOT EXISTS idx_forecast_actuals_forecast
  ON forecast_actuals_tracking (forecast_id);

CREATE INDEX IF NOT EXISTS idx_forecast_actuals_event
  ON forecast_actuals_tracking (event_id);

CREATE INDEX IF NOT EXISTS idx_forecast_actuals_checked
  ON forecast_actuals_tracking (checked_at);

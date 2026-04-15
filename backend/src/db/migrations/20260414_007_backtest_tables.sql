-- M35 Phase 5: Backtesting & Confidence Refinement Tables
-- Generated: 2026-04-14
-- Depends on: 20260414_003_m35_playbook_tables.sql (key_events, event_playbooks)
--
-- Tables:
--   playbook_backtest_results  — per-event × metric × window backtest outcome
--   regime_shift_alerts        — detected systematic forecast bias alerts

-- ─── playbook_backtest_results ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS playbook_backtest_results (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          UUID        NOT NULL REFERENCES key_events(id) ON DELETE CASCADE,
  playbook_id       UUID        REFERENCES event_playbooks(id),
  metric_key        VARCHAR(64) NOT NULL,
  window_months     SMALLINT    NOT NULL,
  milestone_date    TIMESTAMPTZ NOT NULL,
  forecast_median   NUMERIC(18,6),
  forecast_p25      NUMERIC(18,6),
  forecast_p75      NUMERIC(18,6),
  actual_value      NUMERIC(18,6),
  error             NUMERIC(18,6),
  error_pct         NUMERIC(10,4),
  hit_within_ci     BOOLEAN,
  data_coverage     NUMERIC(4,3),
  ran_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pbr_event
  ON playbook_backtest_results (event_id);

CREATE INDEX IF NOT EXISTS idx_pbr_metric_window
  ON playbook_backtest_results (metric_key, window_months);

CREATE INDEX IF NOT EXISTS idx_pbr_ran_at
  ON playbook_backtest_results (ran_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pbr_unique
  ON playbook_backtest_results (event_id, metric_key, window_months);

-- ─── regime_shift_alerts — extend existing table ──────────────────────────────
-- Table already exists; add columns needed for Phase 5 backtesting.

ALTER TABLE regime_shift_alerts
  ADD COLUMN IF NOT EXISTS std_error       NUMERIC(10,6),
  ADD COLUMN IF NOT EXISTS sample_size     SMALLINT NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS acknowledged_by VARCHAR(128),
  ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_rsa_subtype
  ON regime_shift_alerts (subtype, metric_key, window_months);

CREATE INDEX IF NOT EXISTS idx_rsa_status
  ON regime_shift_alerts (status);

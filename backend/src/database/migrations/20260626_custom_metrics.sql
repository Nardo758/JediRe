-- Migration: custom metrics schema (Category 7)
-- CUSTOM_METRICS_BUILD_SPEC.md §2
-- Date: 2026-06-26

-- ═════════════════════════════════════════════════════════════════════════════
-- 1. custom_metrics — metric definitions (derived formulas + input metadata)
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS custom_metrics (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  scope                 TEXT        NOT NULL CHECK (scope IN ('user', 'deal')),
  owner_id              UUID        NOT NULL,
  name                  TEXT        NOT NULL,
  metric_key            TEXT        NOT NULL,
  metric_type           TEXT        NOT NULL CHECK (metric_type IN ('derived', 'input')),
  formula_ast           JSONB,                   -- derived only: validated AST
  rollup                TEXT        NOT NULL CHECK (rollup IN ('sum', 'avg', 'end_of_period', 'rederive')),
  format                TEXT        NOT NULL CHECK (format IN ('pct', 'currency', 'ratio', 'per_unit')),
  unit_basis_field      TEXT,                    -- per_unit format only: which field supplies unit count
  created_by            UUID,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint: metric_key + scope + owner_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_custom_metrics_key_scope_owner
  ON custom_metrics(metric_key, scope, owner_id);

-- Fast lookup by owner
CREATE INDEX IF NOT EXISTS idx_custom_metrics_owner
  ON custom_metrics(scope, owner_id);

COMMENT ON TABLE custom_metrics IS
  'User-defined metric definitions. Derived metrics store formula AST (never values). Input metrics store per-period data in custom_metric_values. See CUSTOM_METRICS_BUILD_SPEC.md §2.';

-- ═════════════════════════════════════════════════════════════════════════════
-- 2. custom_metric_values — input-type metrics only (per-period user data)
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS custom_metric_values (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_id             UUID        NOT NULL REFERENCES custom_metrics(id) ON DELETE CASCADE,
  deal_id               UUID        NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  period_month          DATE        NOT NULL,   -- YYYY-MM-01
  value                 NUMERIC,
  zone                  TEXT        NOT NULL CHECK (zone IN ('actual', 'gap', 'projection', 'override')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (metric_id, deal_id, period_month)
);

CREATE INDEX IF NOT EXISTS idx_custom_metric_values_metric_deal
  ON custom_metric_values(metric_id, deal_id, period_month);

CREATE INDEX IF NOT EXISTS idx_custom_metric_values_deal_period
  ON custom_metric_values(deal_id, period_month);

COMMENT ON TABLE custom_metric_values IS
  'Per-period values for input-type custom metrics only. Derived metrics write NO rows here. See CUSTOM_METRICS_BUILD_SPEC.md §2.';

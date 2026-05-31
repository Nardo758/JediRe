-- Task #1657: Portfolio Correlation Signals
-- Persists the per-COR-XX enriched signal output for each owned property so the
-- F3 Learning tab can display the per-correlation breakdown after page refresh.
-- Separate from portfolio_correlation_coefficients (which stores regression outputs).

CREATE TABLE IF NOT EXISTS portfolio_correlation_signals (
  id               bigserial PRIMARY KEY,
  property_id      uuid NOT NULL REFERENCES properties(id),
  cor_id           text NOT NULL,
  cor_name         text,
  signal           text,
  confidence       text NOT NULL DEFAULT 'insufficient',
  source           text NOT NULL DEFAULT 'none',   -- first_party | third_party | mixed | none | insufficient_history
  x_value          double precision,
  y_value          double precision,
  actionable       text,
  missing_data     text[] DEFAULT '{}',
  computed_at      timestamptz NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pcs_property_cor
  ON portfolio_correlation_signals(property_id, cor_id);

CREATE INDEX IF NOT EXISTS idx_pcs_property_id
  ON portfolio_correlation_signals(property_id);

CREATE INDEX IF NOT EXISTS idx_pcs_computed_at
  ON portfolio_correlation_signals(computed_at DESC);

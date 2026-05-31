-- Task 1657: portfolio_correlation_coefficients
-- Stores empirical per-property coefficients derived from owned-portfolio
-- deal_monthly_actuals (is_portfolio_asset=TRUE). Used by the Cashflow Agent
-- fetch_archive_assumption_distribution and the F3 Learning tab.
CREATE TABLE IF NOT EXISTS portfolio_correlation_coefficients (
  id                     UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id            UUID        NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  coefficient_name       VARCHAR(80)  NOT NULL,
  -- The four canonical coefficient names:
  --   lease_velocity           occupancy slope per month (linear-regression β, %-pts/mo)
  --   concession_depth_ratio   avg concession_$ / (avg_eff_rent × total_units) per period
  --   rent_positioning_ratio   avg effective_rent / avg market_rent per period
  --   occupancy_trajectory     signed linear-regression slope (positive = improving)
  value                  NUMERIC(14,6),
  sample_size            INTEGER,           -- number of monthly observations used
  r_squared              NUMERIC(8,6),      -- R² of linear fit (null for ratio coefficients)
  data_source            VARCHAR(40)  NOT NULL DEFAULT 'owned_portfolio',
  first_period           DATE,              -- earliest deal_monthly_actuals row used
  last_period            DATE,              -- latest deal_monthly_actuals row used
  computed_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (property_id, coefficient_name)
);

CREATE INDEX IF NOT EXISTS idx_portfolio_corr_coeffs_property
  ON portfolio_correlation_coefficients(property_id);

COMMENT ON TABLE portfolio_correlation_coefficients IS
  'Empirical per-property coefficients derived from owned-portfolio operating history';

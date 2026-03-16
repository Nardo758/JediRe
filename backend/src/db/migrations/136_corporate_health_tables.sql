-- M33: Corporate Health Intelligence Engine
-- 6 tables for employer tracking, corporate financials, stock prices,
-- health scores, submarket health index, and facility events.

CREATE TABLE IF NOT EXISTS submarket_employers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submarket_id INTEGER NOT NULL REFERENCES submarkets(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  ticker TEXT,
  is_public BOOLEAN NOT NULL DEFAULT false,
  naics_code TEXT,
  facility_type TEXT CHECK (facility_type IN (
    'corporate_hq', 'regional_office', 'distribution_center',
    'manufacturing', 'retail', 'healthcare', 'technology', 'other'
  )),
  estimated_local_employees INTEGER,
  employment_share DECIMAL(5,4),
  data_source TEXT,
  confidence DECIMAL(3,2),
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(submarket_id, company_name, facility_type)
);

CREATE INDEX IF NOT EXISTS idx_submarket_employers_submarket ON submarket_employers(submarket_id);
CREATE INDEX IF NOT EXISTS idx_submarket_employers_ticker ON submarket_employers(ticker);

CREATE TABLE IF NOT EXISTS corporate_financials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker TEXT NOT NULL,
  fiscal_quarter TEXT NOT NULL,
  fiscal_year INTEGER NOT NULL,
  revenue_ttm BIGINT,
  revenue_yoy_pct DECIMAL(8,4),
  eps_actual DECIMAL(10,4),
  eps_estimate DECIMAL(10,4),
  eps_surprise_pct DECIMAL(8,4),
  net_income_ttm BIGINT,
  operating_margin DECIMAL(8,4),
  total_employees INTEGER,
  employee_yoy_pct DECIMAL(8,4),
  capex_ttm BIGINT,
  free_cash_flow_ttm BIGINT,
  guidance_sentiment DECIMAL(5,2),
  guidance_raw_text TEXT,
  data_source TEXT DEFAULT 'sec_edgar',
  filed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ticker, fiscal_quarter)
);

CREATE INDEX IF NOT EXISTS idx_corporate_financials_ticker ON corporate_financials(ticker);

CREATE TABLE IF NOT EXISTS corporate_stock_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker TEXT NOT NULL,
  price_date DATE NOT NULL,
  close_price DECIMAL(12,4),
  volume BIGINT,
  market_cap BIGINT,
  price_90d_ago DECIMAL(12,4),
  price_180d_ago DECIMAL(12,4),
  stock_momentum_score DECIMAL(5,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ticker, price_date)
);

CREATE INDEX IF NOT EXISTS idx_corporate_stock_prices_ticker ON corporate_stock_prices(ticker);

CREATE TABLE IF NOT EXISTS corporate_health_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker TEXT NOT NULL,
  quarter TEXT NOT NULL,
  revenue_momentum DECIMAL(5,2),
  earnings_trajectory DECIMAL(5,2),
  headcount_signal DECIMAL(5,2),
  guidance_sentiment DECIMAL(5,2),
  stock_momentum DECIMAL(5,2),
  composite_chs DECIMAL(5,2),
  overall_score DECIMAL(5,2),
  chs_delta_qoq DECIMAL(6,2),
  health_tier TEXT CHECK (health_tier IN ('healthy', 'watch', 'stress')),
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ticker, quarter)
);

CREATE INDEX IF NOT EXISTS idx_corporate_health_scores_ticker ON corporate_health_scores(ticker);
CREATE INDEX IF NOT EXISTS idx_corporate_health_scores_quarter ON corporate_health_scores(quarter);

CREATE TABLE IF NOT EXISTS submarket_corporate_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submarket_id INTEGER NOT NULL REFERENCES submarkets(id) ON DELETE CASCADE,
  quarter TEXT NOT NULL,
  schi_score DECIMAL(5,2),
  schi_delta_qoq DECIMAL(6,2),
  re_health_score DECIMAL(5,2),
  divergence_score DECIMAL(6,2),
  divergence_signal TEXT CHECK (divergence_signal IN (
    'bullish_divergence', 'bearish_divergence', 'aligned'
  )),
  herfindahl_index DECIMAL(6,4),
  top_5_share DECIMAL(5,4),
  public_coverage DECIMAL(5,4),
  employer_count INTEGER,
  public_employer_count INTEGER,
  sector_breakdown JSONB,
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(submarket_id, quarter)
);

CREATE INDEX IF NOT EXISTS idx_submarket_corporate_health_submarket ON submarket_corporate_health(submarket_id);
CREATE INDEX IF NOT EXISTS idx_submarket_corporate_health_quarter ON submarket_corporate_health(quarter);
CREATE INDEX IF NOT EXISTS idx_submarket_corporate_health_divergence ON submarket_corporate_health(divergence_signal);

CREATE TABLE IF NOT EXISTS corporate_facility_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker TEXT,
  company_name TEXT NOT NULL,
  event_type TEXT CHECK (event_type IN (
    'expansion', 'contraction', 'relocation_in', 'relocation_out',
    'new_lease', 'lease_expiry', 'layoff', 'hiring_announcement'
  )),
  submarket_id INTEGER REFERENCES submarkets(id) ON DELETE SET NULL,
  estimated_job_impact INTEGER,
  estimated_sf_impact INTEGER,
  announced_at DATE,
  effective_at DATE,
  source_url TEXT,
  source_type TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_corporate_facility_events_ticker ON corporate_facility_events(ticker);
CREATE INDEX IF NOT EXISTS idx_corporate_facility_events_submarket ON corporate_facility_events(submarket_id);
CREATE INDEX IF NOT EXISTS idx_corporate_facility_events_type ON corporate_facility_events(event_type);

-- Migration: disposition_and_debt_tracking
-- Date: 2026-04-20
-- Description: Complete lifecycle tracking from acquisition through disposition,
--              debt/refi management, and reforecast automation.

-- ═══════════════════════════════════════════════════════════════════════════════
-- PART 1: DISPOSITION TRACKING
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS dispositions (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id             UUID        NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  
  -- Timing
  listing_date        DATE,
  under_contract_date DATE,
  closing_date        DATE,
  hold_period_months  INTEGER,
  
  -- Sale details
  sale_price          NUMERIC     NOT NULL,
  price_per_unit      NUMERIC,
  buyer_name          TEXT,
  buyer_type          TEXT,       -- 'institutional' | 'private' | 'syndicator' | 'reit'
  broker              TEXT,
  
  -- Cap rate
  trailing_noi        NUMERIC,    -- TTM NOI at sale
  actual_exit_cap     NUMERIC     GENERATED ALWAYS AS (
    CASE WHEN sale_price > 0 AND trailing_noi > 0 
    THEN (trailing_noi / sale_price) * 100 
    ELSE NULL END
  ) STORED,
  
  -- Returns
  total_equity_invested   NUMERIC,
  total_distributions     NUMERIC,
  net_sale_proceeds       NUMERIC,
  total_profit            NUMERIC,
  
  -- Actual returns vs projected
  actual_irr              NUMERIC,
  actual_equity_multiple  NUMERIC,
  actual_cash_on_cash_avg NUMERIC,
  
  -- What we projected at acquisition
  projected_irr           NUMERIC,
  projected_equity_multiple NUMERIC,
  projected_exit_cap      NUMERIC,
  projected_sale_price    NUMERIC,
  projected_hold_period   INTEGER,
  
  -- Variances (the ultimate learning signal)
  irr_variance_bps        NUMERIC   GENERATED ALWAYS AS (
    (actual_irr - projected_irr) * 100
  ) STORED,
  exit_cap_variance_bps   NUMERIC   GENERATED ALWAYS AS (
    (actual_exit_cap - projected_exit_cap) * 100
  ) STORED,
  sale_price_variance_pct NUMERIC   GENERATED ALWAYS AS (
    CASE WHEN projected_sale_price > 0 
    THEN ((sale_price - projected_sale_price) / projected_sale_price) * 100 
    ELSE NULL END
  ) STORED,
  
  -- Analysis
  disposition_notes       TEXT,
  lessons_learned         TEXT,     -- What would we do differently?
  market_conditions       TEXT,     -- Was this a good/bad time to sell?
  
  -- Metadata
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by              UUID,
  
  CONSTRAINT uq_disposition UNIQUE (deal_id)
);

CREATE INDEX IF NOT EXISTS idx_dispositions_date
  ON dispositions(closing_date DESC);

-- Disposition cash flows (for IRR calculation)
CREATE TABLE IF NOT EXISTS disposition_cash_flows (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id             UUID        NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  disposition_id      UUID        REFERENCES dispositions(id) ON DELETE CASCADE,
  
  flow_date           DATE        NOT NULL,
  flow_type           TEXT        NOT NULL,  -- 'equity_contribution' | 'distribution' | 'sale_proceeds' | 'refi_proceeds'
  amount              NUMERIC     NOT NULL,  -- Negative for outflows, positive for inflows
  description         TEXT,
  
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_disposition_cash_flows
  ON disposition_cash_flows(deal_id, flow_date);

-- ═══════════════════════════════════════════════════════════════════════════════
-- PART 2: DEBT & REFINANCE TRACKING
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS debt_positions (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id             UUID        NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  
  -- Loan identification
  loan_name           TEXT        NOT NULL,  -- 'Senior', 'Mezzanine', 'Preferred Equity'
  lender_name         TEXT,
  loan_type           TEXT        NOT NULL,  -- 'agency' | 'cmbs' | 'bank' | 'bridge' | 'life_co' | 'debt_fund'
  
  -- Principal
  original_principal  NUMERIC     NOT NULL,
  current_balance     NUMERIC,
  ltv_at_origination  NUMERIC,
  current_ltv         NUMERIC,
  
  -- Rate terms
  rate_type           TEXT        NOT NULL,  -- 'fixed' | 'floating'
  base_rate           TEXT,       -- 'SOFR' | 'Prime' | 'Treasury'
  spread_bps          NUMERIC,
  current_rate        NUMERIC,
  rate_floor          NUMERIC,
  rate_cap            NUMERIC,
  
  -- If floating, cap details
  rate_cap_purchased  BOOLEAN     DEFAULT false,
  rate_cap_strike     NUMERIC,
  rate_cap_expiry     DATE,
  rate_cap_cost       NUMERIC,
  
  -- Dates
  origination_date    DATE        NOT NULL,
  maturity_date       DATE        NOT NULL,
  extension_options   INTEGER     DEFAULT 0,
  extension_term_months INTEGER,
  extended_maturity   DATE,
  
  -- Amortization
  amortization_type   TEXT,       -- 'IO' | 'amortizing' | 'partial_IO'
  io_period_months    INTEGER,
  amortization_years  INTEGER,
  
  -- Payments
  monthly_payment     NUMERIC,
  annual_debt_service NUMERIC,
  
  -- Covenants
  dscr_covenant       NUMERIC,    -- Minimum DSCR required
  ltv_covenant        NUMERIC,    -- Maximum LTV allowed
  debt_yield_covenant NUMERIC,    -- Minimum debt yield required
  
  -- Current compliance
  current_dscr        NUMERIC,
  current_debt_yield  NUMERIC,
  covenant_status     TEXT        DEFAULT 'compliant',  -- 'compliant' | 'watch' | 'breach'
  
  -- Prepayment
  prepayment_type     TEXT,       -- 'open' | 'yield_maintenance' | 'defeasance' | 'step_down'
  prepayment_penalty_pct NUMERIC,
  prepay_lockout_until DATE,
  
  -- Status
  status              TEXT        DEFAULT 'active',  -- 'active' | 'paid_off' | 'refinanced' | 'assumed'
  refinanced_by       UUID        REFERENCES debt_positions(id),
  
  -- Metadata
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_debt_positions_deal
  ON debt_positions(deal_id, status);

CREATE INDEX IF NOT EXISTS idx_debt_maturities
  ON debt_positions(maturity_date)
  WHERE status = 'active';

-- Refinance events
CREATE TABLE IF NOT EXISTS refinance_events (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id             UUID        NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  
  -- What was refinanced
  old_debt_id         UUID        REFERENCES debt_positions(id),
  new_debt_id         UUID        REFERENCES debt_positions(id),
  
  -- Timing
  refi_date           DATE        NOT NULL,
  
  -- Economics
  old_loan_balance    NUMERIC,
  new_loan_amount     NUMERIC,
  cash_out            NUMERIC     GENERATED ALWAYS AS (new_loan_amount - old_loan_balance) STORED,
  closing_costs       NUMERIC,
  net_proceeds        NUMERIC,
  
  -- Rate comparison
  old_rate            NUMERIC,
  new_rate            NUMERIC,
  rate_savings_bps    NUMERIC     GENERATED ALWAYS AS ((old_rate - new_rate) * 100) STORED,
  
  -- Payment comparison
  old_payment         NUMERIC,
  new_payment         NUMERIC,
  payment_delta       NUMERIC     GENERATED ALWAYS AS (new_payment - old_payment) STORED,
  
  -- Projected vs actual (for learning)
  was_projected       BOOLEAN     DEFAULT false,
  projected_refi_date DATE,
  projected_ltv       NUMERIC,
  projected_rate      NUMERIC,
  projected_proceeds  NUMERIC,
  
  -- Analysis
  refi_rationale      TEXT,
  market_conditions   TEXT,
  
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Refi test scenarios (run during underwriting and operations)
CREATE TABLE IF NOT EXISTS refi_test_scenarios (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id             UUID        NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  debt_id             UUID        REFERENCES debt_positions(id),
  
  -- Scenario parameters
  scenario_name       TEXT        NOT NULL,
  scenario_type       TEXT        NOT NULL,  -- 'underwriting' | 'operational' | 'stress_test'
  test_date           DATE        NOT NULL,
  
  -- Assumptions
  assumed_noi         NUMERIC     NOT NULL,
  assumed_value       NUMERIC     NOT NULL,
  assumed_cap_rate    NUMERIC,
  assumed_rate_environment TEXT,   -- 'current' | 'stressed_+100bps' | 'stressed_+200bps'
  
  -- Lender constraints
  max_ltv             NUMERIC     DEFAULT 65,
  min_dscr            NUMERIC     DEFAULT 1.25,
  min_debt_yield      NUMERIC     DEFAULT 8,
  
  -- Market rate assumptions
  assumed_spread_bps  NUMERIC,
  assumed_base_rate   NUMERIC,
  assumed_all_in_rate NUMERIC,
  
  -- Results
  max_loan_by_ltv     NUMERIC,
  max_loan_by_dscr    NUMERIC,
  max_loan_by_dy      NUMERIC,
  constrained_by      TEXT,       -- 'ltv' | 'dscr' | 'debt_yield'
  max_loan_proceeds   NUMERIC,
  
  -- If refinancing existing debt
  existing_balance    NUMERIC,
  cash_out_available  NUMERIC,
  new_debt_service    NUMERIC,
  dscr_post_refi      NUMERIC,
  
  -- Feasibility
  is_feasible         BOOLEAN,
  feasibility_notes   TEXT,
  
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refi_scenarios
  ON refi_test_scenarios(deal_id, scenario_type, test_date DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- PART 3: REFORECAST AUTOMATION
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS reforecasts (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id             UUID        NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  
  -- Timing
  reforecast_date     DATE        NOT NULL,
  reforecast_type     TEXT        NOT NULL,  -- 'quarterly' | 'annual' | 'triggered' | 'manual'
  trigger_reason      TEXT,       -- 'variance_threshold' | 'market_change' | 'refi' | 'capex'
  
  -- Baseline (what we originally projected)
  original_snapshot_id UUID       REFERENCES assumption_snapshots(id),
  
  -- New projections (JSON for flexibility)
  reforecast_assumptions JSONB,
  
  -- Key metric changes
  -- Year 1
  original_noi_year1    NUMERIC,
  reforecast_noi_year1  NUMERIC,
  noi_year1_delta_pct   NUMERIC   GENERATED ALWAYS AS (
    CASE WHEN original_noi_year1 > 0 
    THEN ((reforecast_noi_year1 - original_noi_year1) / original_noi_year1) * 100 
    ELSE NULL END
  ) STORED,
  
  -- Stabilized NOI
  original_noi_stabilized   NUMERIC,
  reforecast_noi_stabilized NUMERIC,
  
  -- Exit
  original_exit_value   NUMERIC,
  reforecast_exit_value NUMERIC,
  
  -- Returns
  original_irr          NUMERIC,
  reforecast_irr        NUMERIC,
  irr_delta_bps         NUMERIC   GENERATED ALWAYS AS (
    (reforecast_irr - original_irr) * 100
  ) STORED,
  
  original_em           NUMERIC,
  reforecast_em         NUMERIC,
  
  -- Key drivers of change
  change_drivers        JSONB,    -- [{"driver": "vacancy", "impact_bps": -45}, ...]
  
  -- Status
  status                TEXT      DEFAULT 'draft',  -- 'draft' | 'approved' | 'superseded'
  approved_by           UUID,
  approved_at           TIMESTAMPTZ,
  
  -- Metadata
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by            UUID
);

CREATE INDEX IF NOT EXISTS idx_reforecasts
  ON reforecasts(deal_id, reforecast_date DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- PART 4: COMPETITIVE SET TRACKING
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS competitive_sets (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id             UUID        NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  
  -- Created at underwriting or added later
  created_at_stage    TEXT        NOT NULL,  -- 'underwriting' | 'operations'
  
  -- Comp property details
  comp_property_id    TEXT,       -- External ID (CoStar, etc.)
  comp_name           TEXT        NOT NULL,
  comp_address        TEXT,
  comp_city           TEXT,
  comp_state          TEXT,
  comp_zip            TEXT,
  
  -- Property details
  comp_units          INTEGER,
  comp_year_built     INTEGER,
  comp_asset_class    TEXT,
  comp_distance_miles NUMERIC,
  
  -- Relevance scoring
  relevance_score     NUMERIC     DEFAULT 100,  -- 0-100, higher = more relevant
  relevance_factors   JSONB,      -- {"vintage": 0.9, "size": 0.85, "class": 1.0}
  
  -- Status
  is_active           BOOLEAN     DEFAULT true,
  deactivated_reason  TEXT,
  
  -- Source
  source              TEXT,       -- 'costar' | 'apartments_com' | 'manual' | 'scrape'
  source_id           TEXT,
  
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_competitive_sets
  ON competitive_sets(deal_id, is_active);

-- Competitive set pricing snapshots
CREATE TABLE IF NOT EXISTS comp_pricing_snapshots (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  comp_set_id         UUID        NOT NULL REFERENCES competitive_sets(id) ON DELETE CASCADE,
  deal_id             UUID        NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  
  snapshot_date       DATE        NOT NULL,
  
  -- Pricing by unit type
  pricing_by_type     JSONB,      -- {"1BR": {"asking": 1450, "effective": 1380}, ...}
  
  -- Overall metrics
  avg_asking_rent     NUMERIC,
  avg_effective_rent  NUMERIC,
  concessions_offered TEXT,       -- "1 month free" | "$500 off" | "None"
  concession_value    NUMERIC,
  
  -- Occupancy
  advertised_availability INTEGER,  -- # of units listed
  estimated_occupancy NUMERIC,
  
  -- Specials
  current_specials    TEXT,
  
  -- Source
  source              TEXT,
  source_url          TEXT,
  
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comp_pricing
  ON comp_pricing_snapshots(deal_id, snapshot_date DESC);

-- Comp pricing alerts
CREATE TABLE IF NOT EXISTS comp_pricing_alerts (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id             UUID        NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  comp_set_id         UUID        NOT NULL REFERENCES competitive_sets(id),
  
  alert_date          DATE        NOT NULL,
  alert_type          TEXT        NOT NULL,  -- 'price_drop' | 'price_increase' | 'concession_added' | 'concession_removed'
  
  comp_name           TEXT,
  unit_type           TEXT,
  
  previous_value      NUMERIC,
  new_value           NUMERIC,
  change_pct          NUMERIC,
  
  -- Impact assessment
  recommended_action  TEXT,
  urgency             TEXT,       -- 'high' | 'medium' | 'low'
  
  -- Status
  acknowledged        BOOLEAN     DEFAULT false,
  acknowledged_at     TIMESTAMPTZ,
  acknowledged_by     UUID,
  
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- PART 5: MARKET DATA CONNECTIONS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS market_data_connections (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Connection details
  provider_name       TEXT        NOT NULL,  -- 'costar' | 'yardi_matrix' | 'apartments_com' | 'zillow' | 'attom' | 'municipality'
  provider_type       TEXT        NOT NULL,  -- 'api' | 'scrape' | 'manual' | 'file_import'
  
  -- Credentials (encrypted reference)
  credentials_ref     TEXT,       -- Reference to secrets manager
  
  -- Configuration
  config              JSONB,      -- Provider-specific config
  
  -- Data types available
  data_types          TEXT[],     -- ['rents', 'sales', 'permits', 'assessments', 'demographics']
  
  -- Coverage
  geographic_coverage TEXT[],     -- ['GA', 'FL', 'TX'] or ['national']
  
  -- Status
  status              TEXT        DEFAULT 'active',
  last_sync           TIMESTAMPTZ,
  last_error          TEXT,
  
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Market data sync jobs
CREATE TABLE IF NOT EXISTS market_data_sync_jobs (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id       UUID        NOT NULL REFERENCES market_data_connections(id),
  
  -- Scope
  data_type           TEXT        NOT NULL,  -- 'rents' | 'sales' | 'comps'
  geographic_scope    TEXT,       -- MSA, county, or zip
  
  -- Timing
  started_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at        TIMESTAMPTZ,
  
  -- Results
  status              TEXT        DEFAULT 'running',
  records_fetched     INTEGER     DEFAULT 0,
  records_inserted    INTEGER     DEFAULT 0,
  errors              TEXT[],
  
  -- For incremental sync
  watermark           TEXT        -- Last sync position
);

-- Sale comps from market data
CREATE TABLE IF NOT EXISTS market_sale_comps (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Property details
  property_name       TEXT,
  address             TEXT        NOT NULL,
  city                TEXT        NOT NULL,
  state               TEXT        NOT NULL,
  zip                 TEXT,
  county              TEXT,
  msa                 TEXT,
  submarket           TEXT,
  
  -- Property characteristics
  property_type       TEXT        DEFAULT 'multifamily',
  units               INTEGER,
  sqft                INTEGER,
  year_built          INTEGER,
  asset_class         TEXT,
  stories             INTEGER,
  
  -- Sale details
  sale_date           DATE        NOT NULL,
  sale_price          NUMERIC     NOT NULL,
  price_per_unit      NUMERIC,
  price_per_sqft      NUMERIC,
  cap_rate            NUMERIC,
  
  -- Parties
  buyer               TEXT,
  buyer_type          TEXT,
  seller              TEXT,
  broker              TEXT,
  
  -- Source
  source              TEXT        NOT NULL,  -- 'costar' | 'attom' | 'county_records' | 'manual'
  source_id           TEXT,
  
  -- Geometry for distance calculations
  latitude            NUMERIC,
  longitude           NUMERIC,
  
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sale_comps_location
  ON market_sale_comps(state, msa, sale_date DESC);

CREATE INDEX IF NOT EXISTS idx_sale_comps_search
  ON market_sale_comps(city, state, units, year_built, sale_date DESC);

-- Rent comps from market data
CREATE TABLE IF NOT EXISTS market_rent_comps (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Property details
  property_name       TEXT,
  address             TEXT        NOT NULL,
  city                TEXT        NOT NULL,
  state               TEXT        NOT NULL,
  zip                 TEXT,
  msa                 TEXT,
  submarket           TEXT,
  
  -- Property characteristics
  units               INTEGER,
  year_built          INTEGER,
  asset_class         TEXT,
  
  -- Rent data (snapshot)
  snapshot_date       DATE        NOT NULL,
  
  -- By unit type (JSONB for flexibility)
  rents_by_type       JSONB,      -- {"studio": 1100, "1br": 1350, "2br": 1650, ...}
  
  -- Aggregates
  avg_asking_rent     NUMERIC,
  avg_effective_rent  NUMERIC,
  occupancy_pct       NUMERIC,
  concession_pct      NUMERIC,    -- As % of annual rent
  
  -- Source
  source              TEXT        NOT NULL,
  source_id           TEXT,
  
  -- Geometry
  latitude            NUMERIC,
  longitude           NUMERIC,
  
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rent_comps_location
  ON market_rent_comps(state, msa, snapshot_date DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- PART 6: SEASONALITY MODELING
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS seasonality_factors (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Scope
  msa                 TEXT,       -- NULL = national average
  submarket           TEXT,
  property_type       TEXT        DEFAULT 'multifamily',
  
  -- Monthly factors (1.0 = average)
  jan_factor          NUMERIC     DEFAULT 1.0,
  feb_factor          NUMERIC     DEFAULT 1.0,
  mar_factor          NUMERIC     DEFAULT 1.0,
  apr_factor          NUMERIC     DEFAULT 1.0,
  may_factor          NUMERIC     DEFAULT 1.0,
  jun_factor          NUMERIC     DEFAULT 1.0,
  jul_factor          NUMERIC     DEFAULT 1.0,
  aug_factor          NUMERIC     DEFAULT 1.0,
  sep_factor          NUMERIC     DEFAULT 1.0,
  oct_factor          NUMERIC     DEFAULT 1.0,
  nov_factor          NUMERIC     DEFAULT 1.0,
  dec_factor          NUMERIC     DEFAULT 1.0,
  
  -- Metric type
  metric_type         TEXT        NOT NULL,  -- 'traffic' | 'leasing' | 'move_outs' | 'rent_growth'
  
  -- Source
  based_on_years      TEXT[],     -- ['2023', '2024', '2025']
  n_properties        INTEGER,
  
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT uq_seasonality UNIQUE (msa, submarket, property_type, metric_type)
);

-- Seed national multifamily seasonality (typical patterns)
INSERT INTO seasonality_factors (msa, metric_type, jan_factor, feb_factor, mar_factor, apr_factor, may_factor, jun_factor, jul_factor, aug_factor, sep_factor, oct_factor, nov_factor, dec_factor, based_on_years)
VALUES 
  (NULL, 'traffic', 0.75, 0.85, 1.05, 1.15, 1.20, 1.25, 1.20, 1.15, 1.00, 0.90, 0.75, 0.65, ARRAY['2023','2024','2025']),
  (NULL, 'leasing', 0.70, 0.80, 1.00, 1.15, 1.25, 1.30, 1.25, 1.20, 1.05, 0.85, 0.70, 0.60, ARRAY['2023','2024','2025']),
  (NULL, 'move_outs', 0.65, 0.75, 0.95, 1.10, 1.20, 1.25, 1.30, 1.25, 1.05, 0.90, 0.70, 0.60, ARRAY['2023','2024','2025']),
  (NULL, 'rent_growth', 0.90, 0.95, 1.05, 1.10, 1.15, 1.10, 1.05, 1.00, 0.95, 0.90, 0.85, 0.85, ARRAY['2023','2024','2025'])
ON CONFLICT (msa, submarket, property_type, metric_type) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PART 7: CAPEX TRACKING
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS capex_budget (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id             UUID        NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  
  -- Budget period
  budget_year         INTEGER     NOT NULL,
  
  -- Categories
  unit_interiors      NUMERIC     DEFAULT 0,
  common_areas        NUMERIC     DEFAULT 0,
  building_exterior   NUMERIC     DEFAULT 0,
  mechanical_systems  NUMERIC     DEFAULT 0,  -- HVAC, plumbing, electrical
  roofing             NUMERIC     DEFAULT 0,
  parking_paving      NUMERIC     DEFAULT 0,
  landscaping         NUMERIC     DEFAULT 0,
  amenities           NUMERIC     DEFAULT 0,
  safety_security     NUMERIC     DEFAULT 0,
  other               NUMERIC     DEFAULT 0,
  
  total_budget        NUMERIC     GENERATED ALWAYS AS (
    unit_interiors + common_areas + building_exterior + mechanical_systems +
    roofing + parking_paving + landscaping + amenities + safety_security + other
  ) STORED,
  
  -- Per unit
  units               INTEGER,
  budget_per_unit     NUMERIC     GENERATED ALWAYS AS (
    CASE WHEN units > 0 THEN (
      unit_interiors + common_areas + building_exterior + mechanical_systems +
      roofing + parking_paving + landscaping + amenities + safety_security + other
    ) / units ELSE 0 END
  ) STORED,
  
  -- Source
  source              TEXT,       -- 'underwriting' | 'pca' | 'manual'
  
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT uq_capex_budget UNIQUE (deal_id, budget_year)
);

CREATE TABLE IF NOT EXISTS capex_actuals (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id             UUID        NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  
  -- What was done
  project_name        TEXT        NOT NULL,
  category            TEXT        NOT NULL,  -- Same as budget categories
  description         TEXT,
  
  -- Financials
  budget_amount       NUMERIC,
  actual_amount       NUMERIC     NOT NULL,
  variance            NUMERIC     GENERATED ALWAYS AS (actual_amount - budget_amount) STORED,
  
  -- Timing
  start_date          DATE,
  completion_date     DATE,
  
  -- Status
  status              TEXT        DEFAULT 'completed',  -- 'planned' | 'in_progress' | 'completed'
  
  -- Vendor
  vendor              TEXT,
  
  -- Documentation
  invoice_refs        TEXT[],
  notes               TEXT,
  
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_capex_actuals
  ON capex_actuals(deal_id, completion_date DESC);

-- Deferred maintenance tracking
CREATE TABLE IF NOT EXISTS deferred_maintenance (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id             UUID        NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  
  -- Item details
  item_name           TEXT        NOT NULL,
  category            TEXT        NOT NULL,
  description         TEXT,
  
  -- Assessment
  condition_score     INTEGER,    -- 1-5 (1=critical, 5=good)
  estimated_cost      NUMERIC,
  urgency             TEXT,       -- 'immediate' | 'within_1_year' | 'within_3_years' | 'monitor'
  
  -- Timing
  identified_date     DATE        NOT NULL DEFAULT CURRENT_DATE,
  target_completion   DATE,
  actual_completion   DATE,
  
  -- Status
  status              TEXT        DEFAULT 'identified',  -- 'identified' | 'budgeted' | 'in_progress' | 'completed' | 'deferred'
  
  -- If completed, link to capex actual
  capex_actual_id     UUID        REFERENCES capex_actuals(id),
  
  -- Source
  source              TEXT,       -- 'pca' | 'inspection' | 'staff_report'
  
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- PART 8: USER PREFERENCES FOR UI COLUMNS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS user_view_preferences (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL,
  
  -- View identification
  view_name           TEXT        NOT NULL,  -- 'portfolio_grid' | 'variance_table' | 'rent_roll' | 'reforecast'
  
  -- Column configuration
  visible_columns     TEXT[]      NOT NULL,
  column_order        TEXT[],
  column_widths       JSONB,      -- {"column_name": 120, ...}
  
  -- Sorting
  default_sort_column TEXT,
  default_sort_dir    TEXT        DEFAULT 'desc',
  
  -- Filters
  saved_filters       JSONB,
  
  -- Display options
  show_variance_colors BOOLEAN    DEFAULT true,
  show_projections    BOOLEAN     DEFAULT true,
  show_actuals        BOOLEAN     DEFAULT true,
  
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT uq_user_view_pref UNIQUE (user_id, view_name)
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- VIEWS
-- ═══════════════════════════════════════════════════════════════════════════════

-- Portfolio-wide debt summary
CREATE OR REPLACE VIEW v_portfolio_debt_summary AS
SELECT 
  d.id as deal_id,
  d.name as deal_name,
  dp.loan_name,
  dp.lender_name,
  dp.current_balance,
  dp.current_rate,
  dp.maturity_date,
  dp.maturity_date - CURRENT_DATE as days_to_maturity,
  dp.covenant_status,
  dp.current_dscr,
  CASE 
    WHEN dp.maturity_date <= CURRENT_DATE + INTERVAL '12 months' THEN 'critical'
    WHEN dp.maturity_date <= CURRENT_DATE + INTERVAL '24 months' THEN 'watch'
    ELSE 'ok'
  END as maturity_urgency
FROM deals d
JOIN debt_positions dp ON dp.deal_id = d.id
WHERE dp.status = 'active'
ORDER BY dp.maturity_date;

-- Recent dispositions with learning signals
CREATE OR REPLACE VIEW v_disposition_learnings AS
SELECT 
  d.id as deal_id,
  d.name as deal_name,
  dis.closing_date,
  dis.hold_period_months,
  dis.actual_irr,
  dis.projected_irr,
  dis.irr_variance_bps,
  dis.actual_exit_cap,
  dis.projected_exit_cap,
  dis.exit_cap_variance_bps,
  dis.lessons_learned,
  CASE 
    WHEN dis.irr_variance_bps >= 0 THEN 'outperformed'
    WHEN dis.irr_variance_bps >= -200 THEN 'met_expectations'
    ELSE 'underperformed'
  END as performance_category
FROM deals d
JOIN dispositions dis ON dis.deal_id = d.id
WHERE dis.closing_date IS NOT NULL
ORDER BY dis.closing_date DESC;

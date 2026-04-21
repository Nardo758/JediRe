-- Migration: line_item_benchmarks  
-- Date: 2026-04-20
-- Description: Granular per-unit benchmarks for every OpEx/revenue line item,
--              bucketed by deal type, location, vintage, and size class.
--              Used by CashFlow Agent for line-by-line underwriting calibration.

-- ─────────────────────────────────────────────────────────────────────────────
-- Line Item Benchmark Table
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS line_item_benchmarks (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Bucket dimensions (all nullable for broader aggregations)
  state               TEXT,           -- e.g. 'GA', 'TX', 'FL'
  msa                 TEXT,           -- e.g. 'Atlanta-Sandy Springs-Alpharetta'
  submarket           TEXT,           -- e.g. 'Buckhead', 'Midtown'
  asset_class         TEXT,           -- e.g. 'A', 'B', 'C'
  deal_type           TEXT,           -- existing | value-add | lease-up | development
  vintage_band        TEXT,           -- pre-1990 | 1990-2005 | 2006-2015 | 2016+
  unit_count_band     TEXT,           -- <100 | 100-200 | 200-350 | 350+
  stories_band        TEXT,           -- garden | mid-rise | high-rise
  
  -- Line item identification
  category            TEXT        NOT NULL,  -- revenue | opex | capex | noi | other
  line_item           TEXT        NOT NULL,  -- normalized line item name
  line_item_aliases   TEXT[],                -- alternate names that map to this line
  
  -- Per-unit metrics (primary)
  per_unit_p10        NUMERIC,
  per_unit_p25        NUMERIC,
  per_unit_p50        NUMERIC,
  per_unit_p75        NUMERIC,
  per_unit_p90        NUMERIC,
  per_unit_mean       NUMERIC,
  per_unit_stddev     NUMERIC,
  
  -- As percentage of revenue/EGI (for opex lines)
  pct_egi_p10         NUMERIC,
  pct_egi_p25         NUMERIC,
  pct_egi_p50         NUMERIC,
  pct_egi_p75         NUMERIC,
  pct_egi_p90         NUMERIC,
  
  -- Trend data (YoY growth rates)
  yoy_growth_p10      NUMERIC,
  yoy_growth_p50      NUMERIC,
  yoy_growth_p90      NUMERIC,
  
  -- Sample metadata
  n_samples           INTEGER     NOT NULL DEFAULT 0,
  n_deals             INTEGER     NOT NULL DEFAULT 0,
  sample_years        TEXT[],     -- e.g. ['2024', '2025', '2026']
  
  -- Timestamps
  as_of               DATE        NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Unique constraint per bucket + line item + date
  CONSTRAINT uq_line_item_benchmark UNIQUE (
    state, msa, submarket, asset_class, deal_type, 
    vintage_band, unit_count_band, stories_band,
    category, line_item, as_of
  )
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────────────────────────────────────

-- Primary lookup: find benchmarks for a specific line item in a location
CREATE INDEX IF NOT EXISTS idx_line_benchmarks_lookup
  ON line_item_benchmarks(line_item, state, msa, asset_class, deal_type, as_of DESC);

-- Category rollups: get all opex lines for a bucket
CREATE INDEX IF NOT EXISTS idx_line_benchmarks_category
  ON line_item_benchmarks(category, state, msa, asset_class, as_of DESC)
  WHERE n_samples >= 5;

-- Submarket deep dive
CREATE INDEX IF NOT EXISTS idx_line_benchmarks_submarket
  ON line_item_benchmarks(submarket, line_item, as_of DESC)
  WHERE submarket IS NOT NULL AND n_samples >= 3;

-- ─────────────────────────────────────────────────────────────────────────────
-- Standard Line Item Reference Table
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS standard_line_items (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  category            TEXT        NOT NULL,
  line_item           TEXT        NOT NULL UNIQUE,
  display_name        TEXT        NOT NULL,
  aliases             TEXT[]      NOT NULL DEFAULT '{}',
  description         TEXT,
  typical_range_low   NUMERIC,    -- typical per-unit low (for sanity checks)
  typical_range_high  NUMERIC,    -- typical per-unit high
  is_controllable     BOOLEAN     DEFAULT true,
  sort_order          INTEGER     DEFAULT 0
);

-- Seed standard line items
INSERT INTO standard_line_items (category, line_item, display_name, aliases, typical_range_low, typical_range_high, is_controllable, sort_order)
VALUES
  -- Revenue
  ('revenue', 'gross_potential_rent', 'Gross Potential Rent', ARRAY['gpr', 'potential_rent', 'scheduled_rent'], 800, 3000, false, 10),
  ('revenue', 'loss_to_lease', 'Loss to Lease', ARRAY['ltl', 'lease_loss'], -200, 0, true, 20),
  ('revenue', 'vacancy_loss', 'Vacancy Loss', ARRAY['vacancy', 'physical_vacancy', 'economic_vacancy'], -300, 0, true, 30),
  ('revenue', 'concessions', 'Concessions', ARRAY['concession', 'rent_concessions', 'lease_concessions'], -150, 0, true, 40),
  ('revenue', 'bad_debt', 'Bad Debt', ARRAY['collections_loss', 'write_offs', 'delinquency'], -100, 0, true, 50),
  ('revenue', 'other_income', 'Other Income', ARRAY['ancillary', 'misc_income', 'fee_income'], 50, 400, true, 60),
  ('revenue', 'effective_gross_income', 'Effective Gross Income', ARRAY['egi', 'total_revenue', 'gross_income'], 700, 3500, false, 100),
  
  -- OpEx - Payroll
  ('opex', 'payroll', 'Payroll & Benefits', ARRAY['salaries', 'wages', 'personnel', 'employee_costs'], 400, 1200, true, 200),
  ('opex', 'management_fee', 'Management Fee', ARRAY['property_management', 'mgmt_fee', 'pm_fee'], 150, 500, true, 210),
  
  -- OpEx - Utilities
  ('opex', 'utilities_electric', 'Electric', ARRAY['electricity', 'power', 'electric_utility'], 100, 400, true, 300),
  ('opex', 'utilities_gas', 'Gas', ARRAY['natural_gas', 'gas_utility'], 20, 150, true, 310),
  ('opex', 'utilities_water_sewer', 'Water & Sewer', ARRAY['water', 'sewer', 'water_sewer', 'w_s'], 150, 500, true, 320),
  ('opex', 'utilities_trash', 'Trash Removal', ARRAY['trash', 'garbage', 'waste_removal', 'refuse'], 30, 120, true, 330),
  ('opex', 'utilities_total', 'Total Utilities', ARRAY['utilities', 'utility_expense'], 300, 1000, true, 350),
  
  -- OpEx - R&M
  ('opex', 'repairs_maintenance', 'Repairs & Maintenance', ARRAY['r_m', 'r&m', 'maintenance', 'repairs'], 300, 1000, true, 400),
  ('opex', 'make_ready', 'Make Ready / Turnover', ARRAY['turnover', 'turn_costs', 'unit_turn'], 100, 500, true, 410),
  ('opex', 'landscaping', 'Landscaping', ARRAY['grounds', 'lawn_care', 'grounds_maintenance'], 50, 200, true, 420),
  ('opex', 'contract_services', 'Contract Services', ARRAY['contracted_services', 'service_contracts'], 50, 300, true, 430),
  
  -- OpEx - Admin
  ('opex', 'admin_general', 'Administrative & General', ARRAY['g_a', 'g&a', 'admin', 'office_expense'], 100, 400, true, 500),
  ('opex', 'marketing', 'Marketing & Advertising', ARRAY['advertising', 'leasing_marketing', 'promotion'], 50, 250, true, 510),
  ('opex', 'professional_fees', 'Professional Fees', ARRAY['legal', 'accounting', 'audit'], 20, 150, true, 520),
  
  -- OpEx - Fixed
  ('opex', 'insurance', 'Insurance', ARRAY['property_insurance', 'liability_insurance', 'hazard_insurance'], 200, 800, false, 600),
  ('opex', 'real_estate_taxes', 'Real Estate Taxes', ARRAY['property_taxes', 'taxes', 'tax_expense', 're_taxes'], 500, 3000, false, 610),
  
  -- OpEx - Total
  ('opex', 'total_operating_expenses', 'Total Operating Expenses', ARRAY['total_opex', 'opex', 'operating_expenses'], 2500, 8000, false, 700),
  
  -- NOI
  ('noi', 'net_operating_income', 'Net Operating Income', ARRAY['noi'], 2000, 15000, false, 800),
  
  -- CapEx
  ('capex', 'replacement_reserves', 'Replacement Reserves', ARRAY['reserves', 'capex_reserves', 'capital_reserves'], 200, 600, true, 900),
  ('capex', 'capital_improvements', 'Capital Improvements', ARRAY['capex', 'capital_expenditures', 'improvements'], 0, 5000, true, 910)
ON CONFLICT (line_item) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- Market Trend Table (for location-specific trends)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS market_trends (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Location
  state               TEXT        NOT NULL,
  msa                 TEXT,
  submarket           TEXT,
  
  -- Metric
  metric_name         TEXT        NOT NULL,  -- rent_growth | vacancy_rate | cap_rate | opex_growth
  
  -- Time series
  period              TEXT        NOT NULL,  -- e.g. '2025-Q4', '2026-01'
  period_type         TEXT        NOT NULL,  -- monthly | quarterly | annual
  
  -- Values
  value               NUMERIC     NOT NULL,
  yoy_change          NUMERIC,
  mom_change          NUMERIC,
  
  -- Context
  asset_class         TEXT,
  source              TEXT,       -- archive | costar | yardi | internal
  
  -- Metadata
  n_samples           INTEGER,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT uq_market_trend UNIQUE (state, msa, submarket, metric_name, period, asset_class)
);

CREATE INDEX IF NOT EXISTS idx_market_trends_lookup
  ON market_trends(state, msa, metric_name, period DESC);

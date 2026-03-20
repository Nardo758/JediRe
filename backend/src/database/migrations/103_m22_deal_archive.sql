-- M22 Deal Archive & Intelligence Flywheel
-- Three-pattern architecture: Snapshot (write), Calibration (feedback), Benchmark (read)

-- ═══════════════════════════════════════════════════════════════
-- PATTERN 1: EVENT-TRIGGERED SNAPSHOT (Write Side)
-- ═══════════════════════════════════════════════════════════════

-- Table 1: Deal Snapshots (Immutable Capsules at Stage Transitions)
CREATE TABLE IF NOT EXISTS deal_snapshots (
  id SERIAL PRIMARY KEY,
  deal_id VARCHAR(50) NOT NULL,
  snapshot_date TIMESTAMP NOT NULL,
  trigger_event VARCHAR(30) NOT NULL,  -- 'pipeline' | 'loi' | 'closed' | 'exit'
  
  -- Deal Capsule (Frozen at this moment)
  capsule_data JSONB NOT NULL,         -- Full Deal Capsule as JSON
  
  -- Key Metrics (for easy querying without unpacking JSON)
  purchase_price DECIMAL(15,2),
  units INT,
  price_per_unit DECIMAL(10,2),
  going_in_cap DECIMAL(5,2),
  exit_cap_assumed DECIMAL(5,2),
  
  strategy VARCHAR(50),
  hold_period_years INT,
  
  underwritten_irr DECIMAL(5,2),
  underwritten_em DECIMAL(5,2),
  
  -- Market Context at Snapshot
  market_id VARCHAR(50),
  market_cap_rate DECIMAL(5,2),
  market_vacancy DECIMAL(5,2),
  jedi_score DECIMAL(5,2),
  
  -- Metadata
  created_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Immutability: Once written, never updated
  CONSTRAINT no_updates CHECK (created_at = updated_at)
);

CREATE INDEX idx_deal_snapshots_deal ON deal_snapshots(deal_id);
CREATE INDEX idx_deal_snapshots_trigger ON deal_snapshots(trigger_event);
CREATE INDEX idx_deal_snapshots_date ON deal_snapshots(snapshot_date DESC);

COMMENT ON TABLE deal_snapshots IS 'Immutable Deal Capsule snapshots at stage transitions';
COMMENT ON COLUMN deal_snapshots.capsule_data IS 'Full frozen Deal Capsule JSON - never modified';
COMMENT ON COLUMN deal_snapshots.trigger_event IS 'Stage transition that triggered this snapshot';

-- Table 2: Deal Monthly Actuals (THE CRITICAL PATH - Living Record)
CREATE TABLE IF NOT EXISTS deal_monthly_actuals (
  id SERIAL PRIMARY KEY,
  deal_id VARCHAR(50) NOT NULL,
  snapshot_id INT REFERENCES deal_snapshots(id),  -- Links to frozen underwriting
  
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  -- PERFORMANCE ACTUALS
  actual_noi DECIMAL(15,2),
  actual_revenue DECIMAL(15,2),
  actual_opex DECIMAL(15,2),
  actual_occupancy DECIMAL(5,2),       -- %
  actual_avg_rent DECIMAL(10,2),
  
  -- TRAFFIC ACTUALS (M07 validation)
  actual_walkins DECIMAL(8,2),         -- Per week
  predicted_walkins DECIMAL(8,2),      -- From T-01
  actual_digital_index DECIMAL(5,1),   -- 0-100
  actual_fdot_aadt INT,                -- Real published AADT
  lease_conversions INT,
  
  -- UNIT ACTIVITY
  units_occupied INT,
  total_units INT,
  new_leases INT,
  lease_renewals INT,
  move_outs INT,
  avg_days_vacant DECIMAL(5,1),
  
  -- CAPEX ACTUALS
  capex_spend DECIMAL(15,2),
  units_renovated INT,
  
  -- METADATA
  data_source VARCHAR(100),            -- 'manual' | 'yardi' | 'realpage' | 'api'
  verified BOOLEAN DEFAULT FALSE,
  verified_by VARCHAR(100),
  verified_at TIMESTAMP,
  
  uploaded_by VARCHAR(100),
  uploaded_at TIMESTAMP DEFAULT NOW(),
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE (deal_id, period_start)
);

CREATE INDEX idx_monthly_actuals_deal ON deal_monthly_actuals(deal_id);
CREATE INDEX idx_monthly_actuals_period ON deal_monthly_actuals(period_start DESC);
CREATE INDEX idx_monthly_actuals_snapshot ON deal_monthly_actuals(snapshot_id);

COMMENT ON TABLE deal_monthly_actuals IS 'CRITICAL PATH: Monthly actuals - appended, never modified. Feeds all calibration.';
COMMENT ON COLUMN deal_monthly_actuals.snapshot_id IS 'Links to frozen underwriting assumptions for variance analysis';

-- ═══════════════════════════════════════════════════════════════
-- PATTERN 2: CALIBRATION PUSH (Feedback Side - Model Adjustments)
-- ═══════════════════════════════════════════════════════════════

-- Consumer 1: M07 Traffic Calibration
CREATE TABLE IF NOT EXISTS traffic_calibration_factors (
  id SERIAL PRIMARY KEY,
  submarket_id VARCHAR(50) NOT NULL,
  property_class VARCHAR(10),          -- 'A' | 'B' | 'C'
  road_category VARCHAR(30),           -- 'urban_arterial' | 'suburban' | etc
  
  -- Seasonal Factors
  summer_factor DECIMAL(5,3) DEFAULT 1.000,
  snowbird_factor DECIMAL(5,3) DEFAULT 1.000,
  weekend_factor DECIMAL(5,3) DEFAULT 1.000,
  
  -- Accuracy Metrics
  accuracy_before DECIMAL(5,2),
  accuracy_after DECIMAL(5,2),
  sample_size INT,                     -- Number of deals contributing
  
  last_calibration TIMESTAMP,
  calibrated_by VARCHAR(100),
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE (submarket_id, property_class, road_category)
);

CREATE INDEX idx_traffic_calib_submarket ON traffic_calibration_factors(submarket_id);

COMMENT ON TABLE traffic_calibration_factors IS 'M07 Traffic model calibration coefficients from actual walk-ins';

-- Consumer 2: M09 ProForma Benchmarks
CREATE TABLE IF NOT EXISTS proforma_benchmarks (
  id SERIAL PRIMARY KEY,
  submarket_id VARCHAR(50) NOT NULL,
  property_class VARCHAR(10),
  vintage_decade INT,                  -- 1990, 2000, 2010, etc
  strategy VARCHAR(50),
  
  -- Rent Growth Benchmarks
  rent_growth_p25 DECIMAL(5,2),
  rent_growth_p50 DECIMAL(5,2),
  rent_growth_p75 DECIMAL(5,2),
  
  -- NOI Margin Benchmarks
  noi_margin_p25 DECIMAL(5,2),
  noi_margin_p50 DECIMAL(5,2),
  noi_margin_p75 DECIMAL(5,2),
  
  -- Value-Add Premium ($/unit)
  value_add_premium_p25 DECIMAL(10,2),
  value_add_premium_p50 DECIMAL(10,2),
  value_add_premium_p75 DECIMAL(10,2),
  
  -- Sample
  sample_size INT,
  deals_contributing TEXT[],           -- Array of deal IDs
  
  last_updated TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE (submarket_id, property_class, vintage_decade, strategy)
);

CREATE INDEX idx_proforma_bench_submarket ON proforma_benchmarks(submarket_id);
CREATE INDEX idx_proforma_bench_strategy ON proforma_benchmarks(strategy);

COMMENT ON TABLE proforma_benchmarks IS 'M09 ProForma benchmark envelopes from actual performance';

-- Consumer 3: JEDI Score Weight Overrides
CREATE TABLE IF NOT EXISTS score_weight_overrides (
  id SERIAL PRIMARY KEY,
  score_component VARCHAR(50) NOT NULL,  -- 'traffic' | 'demographics' | 'competition' | etc
  property_type VARCHAR(50),
  submarket_type VARCHAR(50),            -- 'urban' | 'suburban' | 'rural'
  
  default_weight DECIMAL(5,3),
  adjusted_weight DECIMAL(5,3),
  
  -- Validation Metrics
  prediction_accuracy DECIMAL(5,2),     -- % of deals where JEDI predicted outcome correctly
  sample_size INT,
  
  adjustment_reason TEXT,
  last_calibration TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE (score_component, property_type, submarket_type)
);

CREATE INDEX idx_score_overrides_component ON score_weight_overrides(score_component);

COMMENT ON TABLE score_weight_overrides IS 'JEDI Score weight adjustments from actual vs predicted IRR';

-- Consumer 4: M08 Strategy Arbitrage Outcome Log
CREATE TABLE IF NOT EXISTS strategy_outcome_log (
  id SERIAL PRIMARY KEY,
  deal_id VARCHAR(50) NOT NULL,
  snapshot_id INT REFERENCES deal_snapshots(id),
  
  -- What Strategy Arbitrage Recommended
  recommended_strategy VARCHAR(50),
  recommended_score DECIMAL(5,2),
  alternative_strategies JSONB,        -- {strategy: score}
  
  -- What Actually Happened
  actual_strategy VARCHAR(50),
  actual_irr DECIMAL(5,2),
  actual_em DECIMAL(5,2),
  actual_hold_years DECIMAL(5,2),
  
  -- Outcome Validation
  recommendation_correct BOOLEAN,      -- Did recommended strategy match actual?
  performance_vs_prediction DECIMAL(5,2),  -- Actual IRR - predicted IRR
  
  logged_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE (deal_id)
);

CREATE INDEX idx_strategy_outcome_deal ON strategy_outcome_log(deal_id);
CREATE INDEX idx_strategy_outcome_strategy ON strategy_outcome_log(recommended_strategy);

COMMENT ON TABLE strategy_outcome_log IS 'M08 Strategy Arbitrage validation - recommended vs actual outcomes';

-- Consumer 5: M27 Internal Comp Set
CREATE TABLE IF NOT EXISTS internal_comp_set (
  id SERIAL PRIMARY KEY,
  deal_id VARCHAR(50) NOT NULL,
  snapshot_id INT REFERENCES deal_snapshots(id),
  
  -- Property Info
  address TEXT,
  lat DECIMAL(10,7),
  lng DECIMAL(10,7),
  units INT,
  vintage INT,
  property_class VARCHAR(10),
  
  -- Transaction Data
  purchase_price DECIMAL(15,2),
  price_per_unit DECIMAL(10,2),
  going_in_cap DECIMAL(5,2),
  sale_date DATE,
  
  -- Performance (if available)
  actual_rent_at_sale DECIMAL(10,2),
  actual_noi_at_sale DECIMAL(15,2),
  
  -- Comp Search Metadata
  submarket_id VARCHAR(50),
  searchable BOOLEAN DEFAULT TRUE,     -- Can be used as comp for future deals
  
  indexed_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE (deal_id)
);

CREATE INDEX idx_internal_comps_submarket ON internal_comp_set(submarket_id);
CREATE INDEX idx_internal_comps_location ON internal_comp_set USING GIST (
  ll_to_earth(lat, lng)
);
CREATE INDEX idx_internal_comps_class ON internal_comp_set(property_class);

COMMENT ON TABLE internal_comp_set IS 'M27 Internal comp records from closed deals';

-- Consumer 6: M26 Tax Formula Confidence
CREATE TABLE IF NOT EXISTS tax_formula_confidence (
  id SERIAL PRIMARY KEY,
  county VARCHAR(100) NOT NULL,
  formula_version VARCHAR(50),
  
  -- Accuracy Metrics
  predicted_vs_actual_variance DECIMAL(5,2),  -- Avg % error
  accuracy_pct DECIMAL(5,2),                   -- Within 5% threshold
  sample_size INT,
  
  -- Formula Parameters (county-specific)
  assessment_ratio DECIMAL(5,3),
  homestead_cap DECIMAL(5,3),
  non_homestead_cap DECIMAL(5,3),
  
  last_calibration TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE (county, formula_version)
);

CREATE INDEX idx_tax_confidence_county ON tax_formula_confidence(county);

COMMENT ON TABLE tax_formula_confidence IS 'M26 Tax assessment prediction accuracy by county';

-- ═══════════════════════════════════════════════════════════════
-- PATTERN 3: BENCHMARK QUERY (Read Side - Pre-Computed Aggregations)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS benchmark_aggregations (
  id SERIAL PRIMARY KEY,
  
  -- Segmentation Keys
  property_class VARCHAR(10) NOT NULL,       -- 'A' | 'B' | 'C'
  vintage_decade INT NOT NULL,               -- 1990, 2000, 2010, etc
  submarket_id VARCHAR(50) NOT NULL,
  strategy VARCHAR(50) NOT NULL,
  hold_period_band VARCHAR(20) NOT NULL,    -- '3-5yr' | '5-7yr' | '7-10yr'
  
  -- Benchmark Envelopes (p25/p50/p75)
  
  -- Rent Growth
  rent_growth_p25 DECIMAL(5,2),
  rent_growth_p50 DECIMAL(5,2),
  rent_growth_p75 DECIMAL(5,2),
  
  -- Exit Cap Rate
  exit_cap_p25 DECIMAL(5,2),
  exit_cap_p50 DECIMAL(5,2),
  exit_cap_p75 DECIMAL(5,2),
  
  -- Vacancy
  vacancy_p25 DECIMAL(5,2),
  vacancy_p50 DECIMAL(5,2),
  vacancy_p75 DECIMAL(5,2),
  
  -- Value-Add Premium ($/unit)
  value_add_premium_p25 DECIMAL(10,2),
  value_add_premium_p50 DECIMAL(10,2),
  value_add_premium_p75 DECIMAL(10,2),
  
  -- IRR / EM
  irr_p25 DECIMAL(5,2),
  irr_p50 DECIMAL(5,2),
  irr_p75 DECIMAL(5,2),
  
  em_p25 DECIMAL(5,2),
  em_p50 DECIMAL(5,2),
  em_p75 DECIMAL(5,2),
  
  -- Sample Metadata
  sample_size INT,
  deals_in_sample TEXT[],                    -- Array of deal IDs
  
  -- Freshness
  computed_at TIMESTAMP DEFAULT NOW(),
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE (property_class, vintage_decade, submarket_id, strategy, hold_period_band)
);

CREATE INDEX idx_benchmark_agg_submarket ON benchmark_aggregations(submarket_id);
CREATE INDEX idx_benchmark_agg_class_strategy ON benchmark_aggregations(property_class, strategy);
CREATE INDEX idx_benchmark_agg_computed ON benchmark_aggregations(computed_at DESC);

COMMENT ON TABLE benchmark_aggregations IS 'Pre-computed benchmark envelopes for new deal underwriting - queried, not raw archive';
COMMENT ON COLUMN benchmark_aggregations.computed_at IS 'Nightly job timestamp - keeps queries fast';

-- ═══════════════════════════════════════════════════════════════
-- Success
-- ═══════════════════════════════════════════════════════════════
SELECT 'M22 Deal Archive & Intelligence Flywheel tables created!' as status,
       'Pattern 1: deal_snapshots + deal_monthly_actuals (CRITICAL PATH)' as pattern_1,
       'Pattern 2: 6 calibration tables (traffic, proforma, jedi, strategy, comps, tax)' as pattern_2,
       'Pattern 3: benchmark_aggregations (pre-computed read layer)' as pattern_3;

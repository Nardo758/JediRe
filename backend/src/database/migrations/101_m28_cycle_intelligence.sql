-- ═══════════════════════════════════════════════════════════════
-- M28 CYCLE INTELLIGENCE MODULE - Database Schema
-- Market cycle tracking, rate environment, leading/lagging indicators
-- ═══════════════════════════════════════════════════════════════

-- Cycle Phase Enum
CREATE TYPE cycle_phase AS ENUM ('recovery', 'expansion', 'hypersupply', 'recession');

-- Policy Stance Enum
CREATE TYPE policy_stance AS ENUM ('easing', 'tightening', 'neutral', 'emergency');

-- Signal Enum
CREATE TYPE signal_type AS ENUM ('positive', 'negative', 'neutral', 'mixed');

-- ═══════════════════════════════════════════════════════════════
-- Table 1: Cycle Snapshots (monthly classification per market)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS m28_cycle_snapshots (
  id SERIAL PRIMARY KEY,
  market_id VARCHAR(50) NOT NULL,
  snapshot_date DATE NOT NULL,
  
  -- Lagging (current state based on deal data)
  lag_phase cycle_phase NOT NULL,
  lag_position DECIMAL(4,3) CHECK (lag_position >= 0 AND lag_position <= 1),
  
  -- Leading (predicted next state based on macro)
  lead_phase cycle_phase NOT NULL,
  lead_position DECIMAL(4,3) CHECK (lead_position >= 0 AND lead_position <= 1),
  
  -- Divergence (leading - lagging)
  divergence DECIMAL(6,2) CHECK (divergence >= -25 AND divergence <= 25),
  
  -- Confidence & metadata
  confidence DECIMAL(4,3) CHECK (confidence >= 0 AND confidence <= 1),
  classified_by JSONB, -- {metric: weight, value}
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE (market_id, snapshot_date)
);

CREATE INDEX idx_m28_cycle_snapshots_market ON m28_cycle_snapshots(market_id);
CREATE INDEX idx_m28_cycle_snapshots_date ON m28_cycle_snapshots(snapshot_date DESC);

COMMENT ON TABLE m28_cycle_snapshots IS 'Monthly market cycle classification with leading/lagging divergence';
COMMENT ON COLUMN m28_cycle_snapshots.divergence IS 'Leading-lagging gap. Positive = leading ahead (buy signal), Negative = lagging ahead (sell signal)';

-- ═══════════════════════════════════════════════════════════════
-- Table 2: Rate Environment (daily tracking)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS m28_rate_environment (
  id SERIAL PRIMARY KEY,
  snapshot_date DATE NOT NULL UNIQUE,
  
  -- Fed policy
  ffr DECIMAL(5,2),                    -- Federal Funds Rate
  sofr DECIMAL(5,2),                   -- Secured Overnight Financing Rate
  policy_stance policy_stance,
  
  -- Treasury yields
  t10y DECIMAL(5,2),                   -- 10-Year Treasury
  t30y_mtg DECIMAL(5,2),               -- 30-Year Mortgage Rate
  cap_spread_10y DECIMAL(5,2),         -- Cap Rate - 10Y spread
  
  -- Money supply
  m2_yoy DECIMAL(5,2),                 -- M2 Year-over-Year %
  m2_level DECIMAL(15,2),              -- M2 Absolute ($B)
  fed_balance_sheet DECIMAL(15,2),    -- Fed Balance Sheet ($B)
  
  -- FX & forward curve
  dxy DECIMAL(6,2),                    -- Dollar Index
  forward_2y DECIMAL(5,2),             -- Forward curve 2yr projection
  forward_direction VARCHAR(20),       -- 'rising' | 'falling' | 'flat'
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_m28_rate_env_date ON m28_rate_environment(snapshot_date DESC);

COMMENT ON TABLE m28_rate_environment IS 'Daily rate tracking - single source of truth for all rate/macro data';

-- ═══════════════════════════════════════════════════════════════
-- Table 3: Leading Indicators (monthly snapshots)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS m28_leading_indicators (
  id SERIAL PRIMARY KEY,
  snapshot_date DATE NOT NULL,
  category VARCHAR(30) NOT NULL,      -- 'supply' | 'demand' | 'macro' | 'sentiment'
  indicator_name VARCHAR(100) NOT NULL,
  
  value VARCHAR(50),                   -- Flexible: "125,500" or "-18%" or "82.5"
  signal signal_type,                  -- Is this positive/negative for RE?
  trend VARCHAR(30),                   -- 'rising' | 'falling' | 'stable' | 'volatile'
  lag_to_re VARCHAR(30),               -- How long until RE impact: '6-12mo' | '12-18mo'
  
  source VARCHAR(100),                 -- 'Census Bureau' | 'NAHB' | 'Fed'
  source_url TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE (snapshot_date, category, indicator_name)
);

CREATE INDEX idx_m28_leading_indicators_date ON m28_leading_indicators(snapshot_date DESC);
CREATE INDEX idx_m28_leading_indicators_category ON m28_leading_indicators(category);

COMMENT ON TABLE m28_leading_indicators IS 'Monthly leading indicator tracking (permits, starts, confidence, etc.)';

-- ═══════════════════════════════════════════════════════════════
-- Table 4: Historical Events (pattern library)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS m28_historical_events (
  id VARCHAR(30) PRIMARY KEY,          -- 'gfc_2008' | 'covid_2020' | 'volcker_1979'
  name VARCHAR(200) NOT NULL,
  category VARCHAR(30),                -- 'recession' | 'rate_shock' | 'policy' | 'external'
  origin VARCHAR(20),                  -- 'domestic' | 'global'
  
  date_start DATE NOT NULL,
  date_end DATE,
  severity INT CHECK (severity >= 1 AND severity <= 10),
  tags TEXT[],
  
  trigger_desc TEXT,
  economic_effects JSONB,              -- {gdp_impact, unemployment_peak, ...}
  fed_reaction JSONB,                  -- {rate_cuts, qe_amount, timeline}
  re_impact JSONB,                     -- {mf_value_change, txn_volume_change, timeline}
  
  fl_specific TEXT,                    -- Florida-specific notes
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_m28_historical_events_category ON m28_historical_events(category);
CREATE INDEX idx_m28_historical_events_dates ON m28_historical_events(date_start, date_end);

COMMENT ON TABLE m28_historical_events IS 'Historical event pattern library for analog matching';

-- ═══════════════════════════════════════════════════════════════
-- Table 5: Pattern Matches (current conditions vs historical)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS m28_pattern_matches (
  id SERIAL PRIMARY KEY,
  computed_date DATE NOT NULL,
  event_id VARCHAR(30) REFERENCES m28_historical_events(id),
  
  similarity_pct INT CHECK (similarity_pct >= 0 AND similarity_pct <= 100),
  match_factors TEXT[],                -- What's similar
  diverge_factors TEXT[],              -- What's different
  
  predicted_re_impact JSONB,           -- Based on historical analog
  confidence DECIMAL(4,3),
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE (computed_date, event_id)
);

CREATE INDEX idx_m28_pattern_matches_date ON m28_pattern_matches(computed_date DESC);
CREATE INDEX idx_m28_pattern_matches_similarity ON m28_pattern_matches(similarity_pct DESC);

COMMENT ON TABLE m28_pattern_matches IS 'Current conditions matched against historical patterns';

-- ═══════════════════════════════════════════════════════════════
-- Table 6: Market Metrics History (lagging deal data)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS m28_market_metrics_history (
  id SERIAL PRIMARY KEY,
  market_id VARCHAR(50) NOT NULL,
  quarter VARCHAR(7) NOT NULL,         -- '2024Q1'
  
  -- Lagging metrics from M27/M05/M04
  rent_growth DECIMAL(5,2),            -- YoY %
  vacancy DECIMAL(5,2),                -- %
  cap_rate DECIMAL(5,2),               -- %
  ppu DECIMAL(10,2),                   -- Price per unit
  txn_velocity DECIMAL(5,2),           -- Transactions per month
  dom INT,                             -- Days on market
  absorption INT,                      -- Units absorbed
  deliveries INT,                      -- New units delivered
  concessions DECIMAL(3,1),            -- Months free
  
  -- Computed
  classified_phase cycle_phase,        -- What phase does this data indicate?
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE (market_id, quarter)
);

CREATE INDEX idx_m28_market_metrics_market ON m28_market_metrics_history(market_id);
CREATE INDEX idx_m28_market_metrics_quarter ON m28_market_metrics_history(quarter DESC);

COMMENT ON TABLE m28_market_metrics_history IS 'Historical lagging metrics per market for cycle classification';

-- ═══════════════════════════════════════════════════════════════
-- Table 7: Deal Performance by Phase (historical returns)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS m28_deal_performance_by_phase (
  id SERIAL PRIMARY KEY,
  market_id VARCHAR(50) NOT NULL,
  phase cycle_phase NOT NULL,
  
  -- Performance metrics
  avg_irr DECIMAL(5,2),
  avg_em DECIMAL(4,2),
  avg_hold DECIMAL(3,1),               -- Years
  deal_count INT,
  
  -- Strategy performance
  best_strategy VARCHAR(50),
  worst_strategy VARCHAR(50),
  strategy_performance JSONB,          -- {strategy: {irr, em, count}}
  
  -- Data metadata
  data_range VARCHAR(20),              -- '2015-2023'
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE (market_id, phase)
);

CREATE INDEX idx_m28_deal_performance_market ON m28_deal_performance_by_phase(market_id);
CREATE INDEX idx_m28_deal_performance_phase ON m28_deal_performance_by_phase(phase);

COMMENT ON TABLE m28_deal_performance_by_phase IS 'Historical deal returns by acquisition phase - feeds phase-optimal strategy';

-- ═══════════════════════════════════════════════════════════════
-- Seed Data: Historical Events
-- ═══════════════════════════════════════════════════════════════
INSERT INTO m28_historical_events (id, name, category, origin, date_start, date_end, severity, tags, trigger_desc, re_impact) VALUES
('gfc_2008', 'Global Financial Crisis', 'recession', 'domestic', '2007-12-01', '2009-06-30', 10, 
  ARRAY['banking_crisis', 'credit_freeze', 'housing_collapse'], 
  'Subprime mortgage crisis triggered credit freeze and global recession',
  '{"mf_value_change": -35, "txn_volume_change": -85, "recovery_timeline": "48mo"}'::jsonb),

('covid_2020', 'COVID-19 Pandemic', 'external', 'global', '2020-03-01', '2020-12-31', 8,
  ARRAY['pandemic', 'lockdowns', 'fiscal_stimulus', 'qe'],
  'Global pandemic + fiscal/monetary response created RE boom',
  '{"mf_value_change": +30, "txn_volume_change": +45, "rent_growth_accel": +8}'::jsonb),

('volcker_1979', 'Volcker Tightening', 'rate_shock', 'domestic', '1979-10-01', '1982-12-31', 9,
  ARRAY['inflation_fight', 'rate_shock', 'recession'],
  'Fed raised rates to 20% to fight inflation',
  '{"mf_value_change": -40, "txn_volume_change": -75, "recovery_timeline": "36mo"}'::jsonb),

('trade_war_2018', '2018 Trade War', 'policy', 'global', '2018-03-01', '2019-12-31', 4,
  ARRAY['tariffs', 'trade_policy', 'uncertainty'],
  'US-China tariffs disrupted trade, elevated uncertainty',
  '{"mf_value_change": +5, "txn_velocity_decline": -15, "note": "Values rose despite uncertainty due to low rates"}'::jsonb),

('taper_tantrum_2013', 'Taper Tantrum', 'rate_shock', 'domestic', '2013-05-01', '2013-09-30', 5,
  ARRAY['fed_policy', 'rate_spike', 'qe_taper'],
  'Fed announced QE taper → 10Y spiked 150bps',
  '{"mf_value_change": -8, "cap_expansion": +80, "txn_volume_decline": -25}'::jsonb),

('rate_shock_2022', '2022-23 Rate Shock', 'rate_shock', 'domestic', '2022-03-01', '2023-10-31', 7,
  ARRAY['inflation', 'rate_hikes', 'qe_unwind'],
  'Fed hiked 525bps in fastest cycle ever',
  '{"mf_value_change": -25, "txn_volume_change": -65, "cap_expansion": +150}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- Success
-- ═══════════════════════════════════════════════════════════════
COMMENT ON DATABASE jedire IS 'M28 Cycle Intelligence tables created successfully';

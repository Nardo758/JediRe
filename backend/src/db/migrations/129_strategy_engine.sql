-- Migration 032: Strategy Engine Tables and Preset Strategies
-- Implements the database schema for the unified strategy engine

-- Table 1: metric_time_series
CREATE TABLE metric_time_series (
  id BIGSERIAL PRIMARY KEY,
  metric_id VARCHAR(50) NOT NULL,
  geography_type VARCHAR(20) NOT NULL,
  geography_id VARCHAR(50) NOT NULL,
  geography_name VARCHAR(255),
  period_date DATE NOT NULL,
  period_type VARCHAR(10) NOT NULL DEFAULT 'monthly',
  value DOUBLE PRECISION NOT NULL,
  source VARCHAR(50) NOT NULL,
  confidence REAL DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(metric_id, geography_type, geography_id, period_date)
);

CREATE INDEX idx_metric_time_series_metric_geography
  ON metric_time_series(metric_id, geography_type);

CREATE INDEX idx_metric_time_series_geography_date
  ON metric_time_series(geography_id, period_date);

CREATE INDEX idx_metric_time_series_metric_geography_date_desc
  ON metric_time_series(metric_id, geography_type, period_date DESC);


-- Table 2: strategy_definitions
CREATE TABLE strategy_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(20) DEFAULT 'custom',
  scope VARCHAR(20) DEFAULT 'submarket',
  conditions JSONB NOT NULL DEFAULT '[]',
  combinator VARCHAR(5) DEFAULT 'AND',
  signal_weights JSONB,
  sort_by VARCHAR(50),
  sort_direction VARCHAR(4) DEFAULT 'desc',
  max_results INTEGER DEFAULT 50,
  asset_classes TEXT[] DEFAULT '{}',
  deal_types TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  is_public BOOLEAN DEFAULT false,
  run_count INTEGER DEFAULT 0,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_strategy_definitions_user_id ON strategy_definitions(user_id);
CREATE INDEX idx_strategy_definitions_type ON strategy_definitions(type);
CREATE INDEX idx_strategy_definitions_scope ON strategy_definitions(scope);


-- Table 3: metric_correlations
CREATE TABLE metric_correlations (
  id BIGSERIAL PRIMARY KEY,
  metric_a VARCHAR(50) NOT NULL,
  metric_b VARCHAR(50) NOT NULL,
  geography_type VARCHAR(20) NOT NULL,
  geography_id VARCHAR(50) NOT NULL,
  window_months INTEGER NOT NULL,
  correlation_r REAL NOT NULL,
  lead_lag_months INTEGER,
  p_value REAL,
  sample_size INTEGER,
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(metric_a, metric_b, geography_type, geography_id, window_months)
);

CREATE INDEX idx_metric_correlations_metrics
  ON metric_correlations(metric_a, metric_b);

CREATE INDEX idx_metric_correlations_geography
  ON metric_correlations(geography_type, geography_id);


-- Table 4: geographies
CREATE TABLE geographies (
  id VARCHAR(50) PRIMARY KEY,
  type VARCHAR(20) NOT NULL,
  name VARCHAR(255) NOT NULL,
  parent_id VARCHAR(50),
  state VARCHAR(2),
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION
);

CREATE INDEX idx_geographies_type ON geographies(type);
CREATE INDEX idx_geographies_parent_id ON geographies(parent_id);
CREATE INDEX idx_geographies_state ON geographies(state);


-- Table 5: strategy_runs
CREATE TABLE strategy_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id UUID REFERENCES strategy_definitions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  scope VARCHAR(20),
  result_count INTEGER,
  results JSONB,
  execution_ms INTEGER,
  run_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_strategy_runs_strategy_id ON strategy_runs(strategy_id);
CREATE INDEX idx_strategy_runs_user_id ON strategy_runs(user_id);
CREATE INDEX idx_strategy_runs_run_at ON strategy_runs(run_at);


-- ═════════════════════════════════════════════════════════════════════════════
-- INSERT PRESET STRATEGIES (5 total)
-- ═════════════════════════════════════════════════════════════════════════════

-- Preset 1: Demand Surge Detector
INSERT INTO strategy_definitions (
  id, user_id, name, description, type, scope, conditions, combinator,
  sort_by, sort_direction, asset_classes, deal_types, tags, is_active, is_public
) VALUES (
  '00000000-0000-0000-0000-000000000001'::UUID,
  NULL,
  'Demand Surge Detector',
  'Markets where digital demand is surging but physical traffic and rents haven''t caught up yet. The buy window.',
  'preset',
  'submarket',
  '[
    {
      "metricId": "C_SURGE_INDEX",
      "operator": "gt",
      "value": 0.20,
      "weight": 35,
      "required": true,
      "label": "Traffic surge above 20% baseline"
    },
    {
      "metricId": "F_RENT_GROWTH",
      "operator": "lt",
      "value": 2.5,
      "weight": 25,
      "required": false,
      "label": "Rent growth still low (hasn''t repriced yet)"
    },
    {
      "metricId": "D_SEARCH_MOMENTUM",
      "operator": "gt",
      "value": 15,
      "weight": 20,
      "required": false,
      "label": "Search demand accelerating"
    },
    {
      "metricId": "S_PIPELINE_TO_STOCK",
      "operator": "lt",
      "value": 6,
      "weight": 20,
      "required": false,
      "label": "Supply not flooding in yet"
    }
  ]'::JSONB,
  'AND',
  'C_SURGE_INDEX',
  'desc',
  ARRAY['multifamily', 'single_family', 'industrial'],
  ARRAY['existing', 'development'],
  ARRAY['leading-indicator', 'buy-signal', 'demand'],
  true,
  true
);

-- Preset 2: Rent Runway Detector
INSERT INTO strategy_definitions (
  id, user_id, name, description, type, scope, conditions, combinator,
  sort_by, sort_direction, asset_classes, deal_types, tags, is_active, is_public
) VALUES (
  '00000000-0000-0000-0000-000000000002'::UUID,
  NULL,
  'Rent Runway Detector',
  'Markets where wages are growing faster than rents — rent increases are sustainable and there''s room to push.',
  'preset',
  'submarket',
  '[
    {
      "metricId": "E_WAGE_GROWTH",
      "operator": "gt",
      "value": 3.0,
      "weight": 40,
      "required": true
    },
    {
      "metricId": "F_RENT_GROWTH",
      "operator": "lt",
      "value": 2.5,
      "weight": 30,
      "required": false
    },
    {
      "metricId": "M_VACANCY",
      "operator": "lt",
      "value": 6.0,
      "weight": 30,
      "required": false
    }
  ]'::JSONB,
  'AND',
  'E_WAGE_GROWTH',
  'desc',
  ARRAY[]::TEXT[],
  ARRAY[]::TEXT[],
  ARRAY['income-growth', 'rent-upside', 'fundamental'],
  true,
  true
);

-- Preset 3: Supply Cliff Opportunity
INSERT INTO strategy_definitions (
  id, user_id, name, description, type, scope, conditions, combinator,
  sort_by, sort_direction, asset_classes, deal_types, tags, is_active, is_public
) VALUES (
  '00000000-0000-0000-0000-000000000003'::UUID,
  NULL,
  'Supply Cliff Opportunity',
  'Markets where the construction pipeline is drying up — permits declining, deliveries peaking. Future supply tightness = pricing power.',
  'preset',
  'submarket',
  '[
    {
      "metricId": "S_PERMIT_VELOCITY",
      "operator": "decreasing",
      "value": null,
      "weight": 40,
      "required": true
    },
    {
      "metricId": "S_PIPELINE_UNITS",
      "operator": "top_pct",
      "value": 30,
      "weight": 30,
      "required": false,
      "label": "Still heavy pipeline now (deliveries peaking)"
    },
    {
      "metricId": "M_ABSORPTION",
      "operator": "gt",
      "value": 150,
      "weight": 30,
      "required": false
    }
  ]'::JSONB,
  'AND',
  NULL,
  'desc',
  ARRAY[]::TEXT[],
  ARRAY[]::TEXT[],
  ARRAY['supply-constrained', 'contrarian', 'medium-term'],
  true,
  true
);

-- Preset 4: Hidden Gem Finder
INSERT INTO strategy_definitions (
  id, user_id, name, description, type, scope, conditions, combinator,
  sort_by, sort_direction, asset_classes, deal_types, tags, is_active, is_public
) VALUES (
  '00000000-0000-0000-0000-000000000004'::UUID,
  NULL,
  'Hidden Gem Finder',
  'Properties with strong physical traffic but low digital presence — institutional buyers haven''t found them yet.',
  'preset',
  'property',
  '[
    {
      "metricId": "T_PHYSICAL_SCORE",
      "operator": "gte",
      "value": 70,
      "weight": 40,
      "required": true
    },
    {
      "metricId": "D_DIGITAL_SCORE",
      "operator": "lt",
      "value": 40,
      "weight": 30,
      "required": true
    },
    {
      "metricId": "K_GOOGLE_RATING",
      "operator": "lt",
      "value": 3.8,
      "weight": 30,
      "required": false,
      "label": "Operational issues = value-add opportunity"
    }
  ]'::JSONB,
  'AND',
  NULL,
  'desc',
  ARRAY[]::TEXT[],
  ARRAY[]::TEXT[],
  ARRAY['acquisition-target', 'value-add', 'early-signal'],
  true,
  true
);

-- Preset 5: Distress Signal Scanner
INSERT INTO strategy_definitions (
  id, user_id, name, description, type, scope, conditions, combinator,
  sort_by, sort_direction, asset_classes, deal_types, tags, is_active, is_public
) VALUES (
  '00000000-0000-0000-0000-000000000005'::UUID,
  NULL,
  'Distress Signal Scanner',
  'Properties approaching debt maturity with operational underperformance — potential forced sellers.',
  'preset',
  'property',
  '[
    {
      "metricId": "O_DEBT_MATURITY_MO",
      "operator": "lt",
      "value": 18,
      "weight": 35,
      "required": true
    },
    {
      "metricId": "K_GOOGLE_RATING",
      "operator": "lt",
      "value": 3.5,
      "weight": 25,
      "required": false
    },
    {
      "metricId": "O_HOLD_DURATION",
      "operator": "gt",
      "value": 5,
      "weight": 20,
      "required": false,
      "label": "Long hold = likely wants to exit"
    },
    {
      "metricId": "F_CAP_RATE",
      "operator": "gt",
      "value": 5.5,
      "weight": 20,
      "required": false
    }
  ]'::JSONB,
  'AND',
  NULL,
  'desc',
  ARRAY[]::TEXT[],
  ARRAY[]::TEXT[],
  ARRAY['distressed', 'acquisition-target', 'off-market'],
  true,
  true
);

/**
 * Migration 039: Custom Investment Strategies
 * 
 * Enables users to create, save, and manage custom investment strategies
 * that can be applied to property types and used in financial modeling.
 * 
 * @version 1.0.0
 * @date 2026-02-19
 */

-- ============================================================================
-- CUSTOM STRATEGIES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS custom_strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Basic info
  name VARCHAR(200) NOT NULL,
  description TEXT,
  
  -- Strategy parameters
  hold_period_min INTEGER NOT NULL DEFAULT 5, -- Minimum hold period in years
  hold_period_max INTEGER, -- Maximum hold period in years (NULL = indefinite)
  exit_type VARCHAR(100) NOT NULL DEFAULT 'sale', -- sale, refinance, 1031_exchange, cap_rate, hold_indefinitely
  
  -- Custom metrics (user-defined key-value pairs)
  custom_metrics JSONB DEFAULT '{}',
  
  -- Default financial assumptions (optional)
  default_assumptions JSONB DEFAULT '{}',
  -- Example: {
  --   "rent_growth_pct": 3.5,
  --   "vacancy_pct": 5.0,
  --   "exit_cap_rate_pct": 5.5,
  --   "appreciation_pct": 3.0,
  --   "capex_reserves_pct": 5.0
  -- }
  
  -- Metadata
  is_template BOOLEAN DEFAULT FALSE, -- Can be used as a starting template
  is_public BOOLEAN DEFAULT FALSE, -- Shared with team/community (future feature)
  source_strategy_id UUID REFERENCES custom_strategies(id) ON DELETE SET NULL, -- If duplicated from another
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Ensure unique names per user
  CONSTRAINT unique_user_strategy_name UNIQUE(user_id, name)
);

CREATE INDEX idx_custom_strategies_user ON custom_strategies(user_id);
CREATE INDEX idx_custom_strategies_exit_type ON custom_strategies(exit_type);
CREATE INDEX idx_custom_strategies_templates ON custom_strategies(is_template) WHERE is_template = TRUE;
CREATE INDEX idx_custom_strategies_public ON custom_strategies(is_public) WHERE is_public = TRUE;

-- ============================================================================
-- USER PROPERTY TYPE STRATEGIES (Link custom strategies to property types)
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_property_type_strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  custom_strategy_id UUID NOT NULL REFERENCES custom_strategies(id) ON DELETE CASCADE,
  
  -- Property type (multifamily, retail, office, industrial, mixed_use, etc.)
  property_type VARCHAR(100) NOT NULL,
  
  -- Is this the default strategy for this property type?
  is_default BOOLEAN DEFAULT FALSE,
  
  -- Override assumptions specific to this property type
  property_type_overrides JSONB DEFAULT '{}',
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- One custom strategy per property type per user
  CONSTRAINT unique_user_property_strategy UNIQUE(user_id, custom_strategy_id, property_type)
);

CREATE INDEX idx_property_strategies_user ON user_property_type_strategies(user_id);
CREATE INDEX idx_property_strategies_strategy ON user_property_type_strategies(custom_strategy_id);
CREATE INDEX idx_property_strategies_type ON user_property_type_strategies(property_type);
CREATE INDEX idx_property_strategies_default ON user_property_type_strategies(user_id, property_type, is_default) 
  WHERE is_default = TRUE;

-- ============================================================================
-- STRATEGY USAGE TRACKING (Analytics)
-- ============================================================================

CREATE TABLE IF NOT EXISTS custom_strategy_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  custom_strategy_id UUID NOT NULL REFERENCES custom_strategies(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  
  -- Usage context
  used_in_context VARCHAR(100) NOT NULL, -- deal_analysis, scenario, comparison, model
  property_type VARCHAR(100),
  
  -- Results (denormalized for analytics)
  irr_pct DECIMAL(6,3),
  coc_year_5 DECIMAL(6,3),
  npv DECIMAL(15,2),
  
  used_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_strategy_usage_strategy ON custom_strategy_usage(custom_strategy_id);
CREATE INDEX idx_strategy_usage_deal ON custom_strategy_usage(deal_id);
CREATE INDEX idx_strategy_usage_date ON custom_strategy_usage(used_at DESC);

-- ============================================================================
-- STRATEGY EXPORT/IMPORT LOG
-- ============================================================================

CREATE TABLE IF NOT EXISTS custom_strategy_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  custom_strategy_id UUID NOT NULL REFERENCES custom_strategies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  export_format VARCHAR(50) DEFAULT 'json', -- json, csv, pdf
  export_data JSONB, -- Full strategy configuration
  
  exported_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_strategy_exports_user ON custom_strategy_exports(user_id);
CREATE INDEX idx_strategy_exports_strategy ON custom_strategy_exports(custom_strategy_id);

-- ============================================================================
-- VIEWS
-- ============================================================================

-- User strategies with property type assignments
CREATE OR REPLACE VIEW v_user_strategies_summary AS
SELECT 
  cs.id AS strategy_id,
  cs.user_id,
  cs.name,
  cs.description,
  cs.exit_type,
  cs.hold_period_min,
  cs.hold_period_max,
  cs.is_template,
  cs.is_public,
  cs.created_at,
  cs.updated_at,
  COUNT(DISTINCT upts.property_type) AS assigned_property_types,
  COUNT(DISTINCT csu.deal_id) AS times_used,
  AVG(csu.irr_pct) AS avg_irr_pct
FROM custom_strategies cs
LEFT JOIN user_property_type_strategies upts ON upts.custom_strategy_id = cs.id
LEFT JOIN custom_strategy_usage csu ON csu.custom_strategy_id = cs.id
GROUP BY cs.id, cs.user_id, cs.name, cs.description, cs.exit_type, 
         cs.hold_period_min, cs.hold_period_max, cs.is_template, cs.is_public,
         cs.created_at, cs.updated_at;

-- Property type default strategies per user
CREATE OR REPLACE VIEW v_user_default_strategies AS
SELECT 
  upts.user_id,
  upts.property_type,
  cs.id AS strategy_id,
  cs.name AS strategy_name,
  cs.exit_type,
  cs.hold_period_min,
  cs.hold_period_max,
  cs.default_assumptions
FROM user_property_type_strategies upts
JOIN custom_strategies cs ON cs.id = upts.custom_strategy_id
WHERE upts.is_default = TRUE;

COMMENT ON TABLE custom_strategies IS 'User-defined custom investment strategies';
COMMENT ON TABLE user_property_type_strategies IS 'Links custom strategies to property types with default preferences';
COMMENT ON TABLE custom_strategy_usage IS 'Tracks strategy usage across deals for analytics';
COMMENT ON TABLE custom_strategy_exports IS 'Audit trail for strategy exports (future import/share feature)';

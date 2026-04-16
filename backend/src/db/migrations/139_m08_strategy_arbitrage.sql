-- M08 Strategy Arbitrage Engine: strategies, strategy_scores, strategy_arbitrage tables

CREATE TABLE IF NOT EXISTS strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  strategy_type VARCHAR(50) NOT NULL DEFAULT 'arbitrage',
  is_system_template BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  version INTEGER NOT NULL DEFAULT 1,
  signal_weights JSONB NOT NULL DEFAULT '{}',
  property_gates JSONB NOT NULL DEFAULT '[]',
  risk_gates JSONB NOT NULL DEFAULT '[]',
  execution_profile JSONB NOT NULL DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  org_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS strategy_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  strategy_id UUID NOT NULL REFERENCES strategies(id) ON DELETE CASCADE,
  overall_score NUMERIC(5,2),
  sub_scores JSONB NOT NULL DEFAULT '{}',
  gate_result VARCHAR(10) NOT NULL DEFAULT 'PASS',
  gate_failures JSONB NOT NULL DEFAULT '[]',
  soft_penalty NUMERIC(5,2) NOT NULL DEFAULT 0,
  confidence NUMERIC(5,2) NOT NULL DEFAULT 0,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(deal_id, strategy_id)
);

CREATE TABLE IF NOT EXISTS strategy_arbitrage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE UNIQUE,
  winning_strategy_id UUID REFERENCES strategies(id) ON DELETE SET NULL,
  runner_up_strategy_id UUID REFERENCES strategies(id) ON DELETE SET NULL,
  winning_score NUMERIC(5,2),
  runner_up_score NUMERIC(5,2),
  delta NUMERIC(5,2),
  arbitrage_detected BOOLEAN NOT NULL DEFAULT false,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_strategy_scores_deal ON strategy_scores(deal_id);
CREATE INDEX IF NOT EXISTS idx_strategies_system ON strategies(is_system_template) WHERE is_system_template = true;

-- Seed 4 system templates
INSERT INTO strategies (name, description, strategy_type, is_system_template, is_active, signal_weights, property_gates, risk_gates, execution_profile, sort_order)
VALUES
(
  'Build-to-Sell',
  'Develop and sell at stabilization. Targets appreciation + development margin.',
  'arbitrage', true, true,
  '{"supply_pressure": 0.10, "demand_growth": 0.25, "rent_momentum": 0.15, "job_growth": 0.15, "cap_rate_spread": 0.10, "irr_potential": 0.20, "risk_score": -0.05}',
  '[{"metric": "project_type", "operator": "in", "value": ["development", "redevelopment"], "hard": true}]',
  '[{"metric": "supply_pressure", "threshold": 0.8, "hard": true}]',
  '{"hold_period_years": 2, "exit_strategy": "sale", "target_irr": 0.20}',
  1
),
(
  'Flip',
  'Buy distressed, renovate, sell quickly. Short hold, high velocity.',
  'arbitrage', true, true,
  '{"supply_pressure": 0.05, "demand_growth": 0.15, "rent_momentum": 0.10, "job_growth": 0.10, "cap_rate_spread": 0.25, "irr_potential": 0.30, "risk_score": -0.05}',
  '[{"metric": "project_type", "operator": "in", "value": ["existing", "redevelopment"], "hard": false}]',
  '[{"metric": "market_volatility", "threshold": 0.7, "hard": false}]',
  '{"hold_period_years": 1, "exit_strategy": "sale", "target_irr": 0.25}',
  2
),
(
  'Rental',
  'Buy and hold for cash flow. Targets yield, stability, and long-term appreciation.',
  'arbitrage', true, true,
  '{"supply_pressure": 0.15, "demand_growth": 0.20, "rent_momentum": 0.25, "job_growth": 0.15, "cap_rate_spread": 0.15, "irr_potential": 0.05, "risk_score": -0.05}',
  '[]',
  '[{"metric": "supply_pressure", "threshold": 0.85, "hard": false}]',
  '{"hold_period_years": 7, "exit_strategy": "hold", "target_irr": 0.14}',
  3
),
(
  'Short-Term Rental',
  'Operate as STR / vacation rental. High RevPAR potential in tourist or corporate corridors.',
  'arbitrage', true, true,
  '{"supply_pressure": 0.05, "demand_growth": 0.20, "rent_momentum": 0.30, "job_growth": 0.05, "cap_rate_spread": 0.05, "irr_potential": 0.30, "risk_score": -0.05}',
  '[{"metric": "regulatory_risk", "operator": "lt", "value": 0.6, "hard": false}]',
  '[{"metric": "regulatory_risk", "threshold": 0.8, "hard": true}]',
  '{"hold_period_years": 3, "exit_strategy": "hold_or_sell", "target_irr": 0.18}',
  4
)
ON CONFLICT DO NOTHING;

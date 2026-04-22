-- Agent Collaboration Tables
-- Cross-agent intelligence sharing infrastructure
-- Created: 2026-04-22

-- ============================================================================
-- 1. CFO → LENDER: Debt Sizing Recommendations
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_collaboration_debt_recommendations (
  id TEXT PRIMARY KEY,
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  recommended_ltv NUMERIC(5,2) NOT NULL,
  target_dscr NUMERIC(5,2) NOT NULL,
  rate_structure TEXT NOT NULL CHECK (rate_structure IN ('fixed', 'floating', 'hybrid')),
  refi_recommendation JSONB NOT NULL DEFAULT '{}',
  irr_by_ltv JSONB NOT NULL DEFAULT '[]',
  breakpoints JSONB NOT NULL DEFAULT '{}',
  covenant_suggestions JSONB NOT NULL DEFAULT '[]',
  summary_for_lender TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_debt_rec_deal ON agent_collaboration_debt_recommendations(deal_id, generated_at DESC);

COMMENT ON TABLE agent_collaboration_debt_recommendations IS 'CFO debt sizing recommendations for Lender agent';

-- ============================================================================
-- 2. ASSET MANAGER → CFO: Variance Impact Analysis
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_collaboration_variance_impacts (
  id TEXT PRIMARY KEY,
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  triggering_variance JSONB NOT NULL,
  return_impact JSONB NOT NULL,
  risk_impact JSONB NOT NULL,
  recommendation JSONB NOT NULL,
  scenario_analysis JSONB NOT NULL,
  summary_for_user TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_variance_impact_deal ON agent_collaboration_variance_impacts(deal_id, generated_at DESC);

COMMENT ON TABLE agent_collaboration_variance_impacts IS 'CFO analysis of operational variance impact on returns';

-- ============================================================================
-- 3. RESEARCH → ACQUISITIONS: Screening Adjustments
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_collaboration_screening_adjustments (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  triggering_signals JSONB NOT NULL DEFAULT '[]',
  market_adjustments JSONB NOT NULL DEFAULT '[]',
  underwriting_adjustments JSONB NOT NULL DEFAULT '[]',
  screening_criteria JSONB NOT NULL DEFAULT '[]',
  pipeline_alerts JSONB NOT NULL DEFAULT '[]',
  summary TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_screening_adj_user ON agent_collaboration_screening_adjustments(user_id, generated_at DESC);

COMMENT ON TABLE agent_collaboration_screening_adjustments IS 'Research market signals translated to screening criteria for Acquisitions';

-- User screening parameters (to be adjusted by Research)
CREATE TABLE IF NOT EXISTS user_screening_params (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  params JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_screening_params_user ON user_screening_params(user_id);

-- ============================================================================
-- 4. LEASING → REVENUE MANAGEMENT: Pricing Recommendations
-- ============================================================================

CREATE TABLE IF NOT EXISTS deal_leasing_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  period TEXT NOT NULL, -- e.g., "2026-W16"
  total_traffic INTEGER NOT NULL DEFAULT 0,
  qualified_leads INTEGER NOT NULL DEFAULT 0,
  tours INTEGER NOT NULL DEFAULT 0,
  applications INTEGER NOT NULL DEFAULT 0,
  tour_to_app_rate NUMERIC(5,4) NOT NULL DEFAULT 0,
  app_to_lease_rate NUMERIC(5,4) NOT NULL DEFAULT 0,
  overall_conversion_rate NUMERIC(5,4) NOT NULL DEFAULT 0,
  avg_days_to_lease NUMERIC(5,1) NOT NULL DEFAULT 0,
  leases_this_period INTEGER NOT NULL DEFAULT 0,
  cancellations_this_period INTEGER NOT NULL DEFAULT 0,
  current_occupancy NUMERIC(5,4) NOT NULL DEFAULT 0,
  preleased_units INTEGER NOT NULL DEFAULT 0,
  available_units INTEGER NOT NULL DEFAULT 0,
  wait_list_count INTEGER NOT NULL DEFAULT 0,
  unit_type_metrics JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(deal_id, period)
);

CREATE INDEX IF NOT EXISTS idx_leasing_metrics_deal ON deal_leasing_metrics(deal_id, period DESC);

CREATE TABLE IF NOT EXISTS agent_collaboration_pricing_recommendations (
  id TEXT PRIMARY KEY,
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  demand_signal TEXT NOT NULL CHECK (demand_signal IN ('strong', 'moderate', 'weak')),
  pricing_power TEXT NOT NULL CHECK (pricing_power IN ('increase', 'hold', 'decrease')),
  urgency TEXT NOT NULL CHECK (urgency IN ('immediate', 'next_week', 'monitor')),
  rent_adjustments JSONB NOT NULL DEFAULT '[]',
  concession_recommendations JSONB NOT NULL DEFAULT '[]',
  renewal_strategy JSONB NOT NULL DEFAULT '{}',
  projected_impact JSONB NOT NULL DEFAULT '{}',
  summary TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pricing_rec_deal ON agent_collaboration_pricing_recommendations(deal_id, generated_at DESC);

COMMENT ON TABLE agent_collaboration_pricing_recommendations IS 'Revenue Management pricing recommendations based on leasing metrics';

-- ============================================================================
-- 5. COMPLIANCE → LEGAL: Protective Provisions
-- ============================================================================

CREATE TABLE IF NOT EXISTS deal_compliance_issues (
  id TEXT PRIMARY KEY,
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  issue_type TEXT NOT NULL CHECK (issue_type IN (
    'environmental', 'zoning', 'insurance', 'permits', 'ada', 
    'fire_safety', 'structural', 'title', 'survey', 'other'
  )),
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  description TEXT NOT NULL,
  source TEXT NOT NULL,
  estimated_cost NUMERIC(12,2),
  estimated_timeline TEXT,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'mitigated', 'accepted', 'deal_breaker'))
);

CREATE INDEX IF NOT EXISTS idx_compliance_issues_deal ON deal_compliance_issues(deal_id, status);
CREATE INDEX IF NOT EXISTS idx_compliance_issues_severity ON deal_compliance_issues(deal_id, severity);

CREATE TABLE IF NOT EXISTS agent_collaboration_legal_protections (
  id TEXT PRIMARY KEY,
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  triggering_issues JSONB NOT NULL DEFAULT '[]',
  contract_protections JSONB NOT NULL DEFAULT '[]',
  dd_extensions JSONB NOT NULL DEFAULT '[]',
  price_adjustments JSONB NOT NULL DEFAULT '[]',
  escrow_requirements JSONB NOT NULL DEFAULT '[]',
  walk_away_analysis JSONB NOT NULL DEFAULT '{}',
  summary TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_legal_protections_deal ON agent_collaboration_legal_protections(deal_id, generated_at DESC);

COMMENT ON TABLE agent_collaboration_legal_protections IS 'Legal protective provisions based on Compliance issues';

-- ============================================================================
-- 6. TAX STRATEGIST → CFO: After-Tax Returns
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_collaboration_after_tax_returns (
  id TEXT PRIMARY KEY,
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  pre_tax_irr NUMERIC(6,2) NOT NULL,
  after_tax_irr NUMERIC(6,2) NOT NULL,
  pre_tax_em NUMERIC(6,2) NOT NULL,
  after_tax_em NUMERIC(6,2) NOT NULL,
  tax_benefits JSONB NOT NULL DEFAULT '[]',
  cost_seg_analysis JSONB,
  oz_comparison JSONB,
  exit_tax_analysis JSONB NOT NULL DEFAULT '{}',
  considerations_1031 JSONB,
  summary TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_after_tax_returns_deal ON agent_collaboration_after_tax_returns(deal_id, generated_at DESC);

COMMENT ON TABLE agent_collaboration_after_tax_returns IS 'Tax Strategist after-tax return analysis for CFO';

-- ============================================================================
-- SUPPORTING VIEWS
-- ============================================================================

-- View: Latest collaboration insights per deal
CREATE OR REPLACE VIEW vw_deal_collaboration_insights AS
SELECT 
  d.id as deal_id,
  d.name as deal_name,
  dr.summary_for_lender as debt_recommendation,
  dr.recommended_ltv,
  vi.summary_for_user as variance_impact,
  pr.summary as pricing_recommendation,
  pr.pricing_power,
  lp.summary as legal_protection,
  lp.walk_away_analysis->>'shouldWalk' as should_walk,
  atr.after_tax_irr,
  atr.summary as tax_summary
FROM deals d
LEFT JOIN LATERAL (
  SELECT * FROM agent_collaboration_debt_recommendations 
  WHERE deal_id = d.id ORDER BY generated_at DESC LIMIT 1
) dr ON true
LEFT JOIN LATERAL (
  SELECT * FROM agent_collaboration_variance_impacts 
  WHERE deal_id = d.id ORDER BY generated_at DESC LIMIT 1
) vi ON true
LEFT JOIN LATERAL (
  SELECT * FROM agent_collaboration_pricing_recommendations 
  WHERE deal_id = d.id ORDER BY generated_at DESC LIMIT 1
) pr ON true
LEFT JOIN LATERAL (
  SELECT * FROM agent_collaboration_legal_protections 
  WHERE deal_id = d.id ORDER BY generated_at DESC LIMIT 1
) lp ON true
LEFT JOIN LATERAL (
  SELECT * FROM agent_collaboration_after_tax_returns 
  WHERE deal_id = d.id ORDER BY generated_at DESC LIMIT 1
) atr ON true;

COMMENT ON VIEW vw_deal_collaboration_insights IS 'Latest insights from all agent collaborations per deal';

-- Deal Structuring Tables
-- Stores CFO → Legal collaboration on deal structure
-- Created: 2026-04-22

-- ============================================================================
-- STRUCTURING RECOMMENDATIONS
-- CFO analysis that informs Legal on how to structure deals
-- ============================================================================

CREATE TABLE IF NOT EXISTS deal_structuring_recommendations (
  id TEXT PRIMARY KEY,
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  return_profile TEXT NOT NULL CHECK (return_profile IN ('cash_flow_heavy', 'appreciation_heavy', 'balanced')),
  
  -- Waterfall structure as JSON
  waterfall_structure JSONB NOT NULL,
  
  -- Recommendations as JSON arrays
  contract_clauses JSONB NOT NULL DEFAULT '[]',
  loi_terms JSONB NOT NULL DEFAULT '[]',
  risk_mitigations JSONB NOT NULL DEFAULT '[]',
  
  -- Summary for Legal agent
  summary_for_legal TEXT NOT NULL,
  
  -- Full AI analysis text
  full_analysis TEXT,
  
  -- Metadata
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  approved BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_structuring_rec_deal ON deal_structuring_recommendations(deal_id, generated_at DESC);

COMMENT ON TABLE deal_structuring_recommendations IS 'CFO analysis that informs Legal on deal structuring';
COMMENT ON COLUMN deal_structuring_recommendations.return_profile IS 'cash_flow_heavy = >60% from ops, appreciation_heavy = >60% from sale, balanced = middle';
COMMENT ON COLUMN deal_structuring_recommendations.waterfall_structure IS 'JSON with pref return, hurdles, splits, catch-up, lookback';

-- ============================================================================
-- CONTRACT CLAUSES
-- Drafted clauses based on CFO recommendations
-- ============================================================================

CREATE TABLE IF NOT EXISTS deal_contract_clauses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  clause_type TEXT NOT NULL,
  language TEXT NOT NULL,
  notes TEXT,
  
  -- Versioning
  version INTEGER DEFAULT 1,
  previous_version_id UUID REFERENCES deal_contract_clauses(id),
  
  -- Approval workflow
  drafted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  drafted_by TEXT DEFAULT 'legal_agent',
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  
  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'approved', 'rejected', 'superseded'))
);

CREATE INDEX IF NOT EXISTS idx_contract_clauses_deal ON deal_contract_clauses(deal_id, clause_type);
CREATE INDEX IF NOT EXISTS idx_contract_clauses_status ON deal_contract_clauses(deal_id, status);

COMMENT ON TABLE deal_contract_clauses IS 'Contract clauses drafted by Legal based on CFO recommendations';

-- ============================================================================
-- WATERFALL CONFIGURATIONS
-- Stores the actual waterfall tiers for deals (used in investor distributions)
-- ============================================================================

CREATE TABLE IF NOT EXISTS deal_waterfall_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  
  -- Preferred return
  preferred_return_rate NUMERIC(5,2) NOT NULL DEFAULT 8.00,
  preferred_return_type TEXT DEFAULT 'cumulative' CHECK (preferred_return_type IN ('cumulative', 'non_cumulative', 'compounding')),
  
  -- Tiers
  tier1_hurdle_irr NUMERIC(5,2),
  tier1_lp_split NUMERIC(5,2),
  tier1_gp_split NUMERIC(5,2),
  
  tier2_hurdle_irr NUMERIC(5,2),
  tier2_lp_split NUMERIC(5,2),
  tier2_gp_split NUMERIC(5,2),
  
  tier3_hurdle_irr NUMERIC(5,2),  -- "Home run" tier
  tier3_lp_split NUMERIC(5,2),
  tier3_gp_split NUMERIC(5,2),
  
  -- Provisions
  catch_up_provision BOOLEAN DEFAULT true,
  catch_up_percentage NUMERIC(5,2) DEFAULT 100,
  lookback_provision BOOLEAN DEFAULT true,
  clawback_provision BOOLEAN DEFAULT true,
  
  -- Distribution timing
  distribution_frequency TEXT DEFAULT 'quarterly' CHECK (distribution_frequency IN ('monthly', 'quarterly', 'semi_annual', 'annual', 'at_exit')),
  
  -- Source of this config
  based_on_recommendation_id TEXT REFERENCES deal_structuring_recommendations(id),
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  
  UNIQUE(deal_id)
);

CREATE INDEX IF NOT EXISTS idx_waterfall_config_deal ON deal_waterfall_config(deal_id);

COMMENT ON TABLE deal_waterfall_config IS 'Actual waterfall configuration for investor distributions';
COMMENT ON COLUMN deal_waterfall_config.tier3_hurdle_irr IS 'Home run threshold - typically 20%+ IRR for appreciation-heavy deals';

-- ============================================================================
-- TRIGGER: Auto-create waterfall config from recommendations
-- ============================================================================

CREATE OR REPLACE FUNCTION create_waterfall_from_recommendation()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO deal_waterfall_config (
    deal_id,
    preferred_return_rate,
    tier1_hurdle_irr,
    tier1_lp_split,
    tier1_gp_split,
    tier2_hurdle_irr,
    tier2_lp_split,
    tier2_gp_split,
    tier3_hurdle_irr,
    tier3_lp_split,
    tier3_gp_split,
    catch_up_provision,
    lookback_provision,
    based_on_recommendation_id
  )
  SELECT
    NEW.deal_id,
    (NEW.waterfall_structure->>'preferredReturn')::numeric,
    (NEW.waterfall_structure->>'tier1Hurdle')::numeric,
    (NEW.waterfall_structure->'tier1Split'->>'lp')::numeric,
    (NEW.waterfall_structure->'tier1Split'->>'gp')::numeric,
    (NEW.waterfall_structure->>'tier2Hurdle')::numeric,
    (NEW.waterfall_structure->'tier2Split'->>'lp')::numeric,
    (NEW.waterfall_structure->'tier2Split'->>'gp')::numeric,
    (NEW.waterfall_structure->>'tier3Hurdle')::numeric,
    (NEW.waterfall_structure->'tier3Split'->>'lp')::numeric,
    (NEW.waterfall_structure->'tier3Split'->>'gp')::numeric,
    COALESCE((NEW.waterfall_structure->>'catchUpProvision')::boolean, true),
    COALESCE((NEW.waterfall_structure->>'lookbackProvision')::boolean, true),
    NEW.id
  ON CONFLICT (deal_id) DO UPDATE SET
    preferred_return_rate = EXCLUDED.preferred_return_rate,
    tier1_hurdle_irr = EXCLUDED.tier1_hurdle_irr,
    tier1_lp_split = EXCLUDED.tier1_lp_split,
    tier1_gp_split = EXCLUDED.tier1_gp_split,
    tier2_hurdle_irr = EXCLUDED.tier2_hurdle_irr,
    tier2_lp_split = EXCLUDED.tier2_lp_split,
    tier2_gp_split = EXCLUDED.tier2_gp_split,
    tier3_hurdle_irr = EXCLUDED.tier3_hurdle_irr,
    tier3_lp_split = EXCLUDED.tier3_lp_split,
    tier3_gp_split = EXCLUDED.tier3_gp_split,
    catch_up_provision = EXCLUDED.catch_up_provision,
    lookback_provision = EXCLUDED.lookback_provision,
    based_on_recommendation_id = EXCLUDED.based_on_recommendation_id,
    updated_at = NOW();
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_create_waterfall_from_recommendation ON deal_structuring_recommendations;
CREATE TRIGGER trg_create_waterfall_from_recommendation
  AFTER INSERT ON deal_structuring_recommendations
  FOR EACH ROW
  EXECUTE FUNCTION create_waterfall_from_recommendation();

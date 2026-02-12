/**
 * Migration 028: Audit Trail System - JEDI RE Phase 2 Component 4
 * Full traceability from financial assumptions back to source news events
 * 
 * Tables:
 * - audit_chains: Links between entities in the evidence chain
 * - assumption_evidence: Maps assumptions to source events
 * - calculation_logs: Detailed calculation steps with parameters
 * - export_snapshots: Saved audit reports
 * - source_credibility: Track source reliability over time
 */

-- ========================================
-- AUDIT CHAINS
-- ========================================

CREATE TABLE IF NOT EXISTS audit_chains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Chain identification
  deal_id UUID NOT NULL,
  assumption_id UUID, -- Links to pro_forma_assumptions table
  chain_type VARCHAR(50) NOT NULL, -- 'rent_growth', 'vacancy', 'expense_ratio', etc.
  
  -- Evidence chain structure
  source_entity_type VARCHAR(50) NOT NULL, -- 'news_event', 'demand_signal', 'supply_signal', 'calculation'
  source_entity_id UUID NOT NULL,
  target_entity_type VARCHAR(50) NOT NULL,
  target_entity_id UUID NOT NULL,
  
  -- Confidence tracking
  link_confidence DECIMAL(5,4) NOT NULL DEFAULT 1.0 CHECK (link_confidence >= 0 AND link_confidence <= 1.0),
  chain_confidence DECIMAL(5,4) NOT NULL DEFAULT 1.0 CHECK (chain_confidence >= 0 AND chain_confidence <= 1.0),
  confidence_factors JSONB, -- Breakdown of confidence calculation
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  created_by UUID,
  
  -- Constraints
  FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE
);

CREATE INDEX idx_audit_chains_deal ON audit_chains(deal_id);
CREATE INDEX idx_audit_chains_assumption ON audit_chains(assumption_id);
CREATE INDEX idx_audit_chains_source ON audit_chains(source_entity_type, source_entity_id);
CREATE INDEX idx_audit_chains_target ON audit_chains(target_entity_type, target_entity_id);
CREATE INDEX idx_audit_chains_type ON audit_chains(chain_type);

-- ========================================
-- ASSUMPTION EVIDENCE MAPPING
-- ========================================

CREATE TABLE IF NOT EXISTS assumption_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Assumption details
  deal_id UUID NOT NULL,
  assumption_id UUID NOT NULL,
  assumption_name VARCHAR(200) NOT NULL,
  assumption_category VARCHAR(100) NOT NULL, -- 'revenue', 'expense', 'market', 'exit'
  
  -- Baseline vs Adjusted
  baseline_value DECIMAL(15,4),
  adjusted_value DECIMAL(15,4),
  delta_value DECIMAL(15,4),
  delta_percentage DECIMAL(8,4),
  units VARCHAR(50), -- '%', '$', 'units', etc.
  
  -- Source event linkage
  primary_event_id UUID,
  supporting_event_ids UUID[],
  event_count INTEGER DEFAULT 0,
  
  -- Impact tracking
  financial_impact DECIMAL(15,2), -- Dollar impact on deal value
  impact_direction VARCHAR(20) CHECK (impact_direction IN ('positive', 'negative', 'neutral')),
  impact_magnitude VARCHAR(20) CHECK (impact_magnitude IN ('minor', 'moderate', 'significant', 'major')),
  
  -- Confidence
  overall_confidence DECIMAL(5,4) NOT NULL DEFAULT 1.0,
  confidence_level VARCHAR(20), -- 'confirmed', 'high', 'moderate', 'low'
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE,
  FOREIGN KEY (primary_event_id) REFERENCES news_events(id) ON DELETE SET NULL
);

CREATE INDEX idx_assumption_evidence_deal ON assumption_evidence(deal_id);
CREATE INDEX idx_assumption_evidence_assumption ON assumption_evidence(assumption_id);
CREATE INDEX idx_assumption_evidence_event ON assumption_evidence(primary_event_id);
CREATE INDEX idx_assumption_evidence_confidence ON assumption_evidence(overall_confidence DESC);
CREATE INDEX idx_assumption_evidence_impact ON assumption_evidence(impact_magnitude, financial_impact DESC);

-- ========================================
-- CALCULATION LOGS
-- ========================================

CREATE TABLE IF NOT EXISTS calculation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Linkage
  deal_id UUID NOT NULL,
  assumption_evidence_id UUID,
  calculation_type VARCHAR(100) NOT NULL, -- 'demand_signal', 'supply_ratio', 'rent_elasticity', etc.
  calculation_step INTEGER NOT NULL DEFAULT 1, -- Order in chain
  
  -- Calculation details
  input_parameters JSONB NOT NULL, -- All input values
  formula TEXT, -- Formula used
  calculation_method TEXT, -- Description of methodology
  output_value DECIMAL(15,4),
  output_unit VARCHAR(50),
  
  -- Confidence
  calculation_confidence DECIMAL(5,4) NOT NULL DEFAULT 1.0,
  confidence_notes TEXT,
  
  -- Geographic context
  trade_area_id UUID,
  trade_area_name VARCHAR(200),
  impact_weight DECIMAL(5,4), -- Geographic impact weighting
  
  -- Timing
  effective_date DATE,
  phase_start_quarter VARCHAR(10), -- 'Q2 2027'
  phase_duration_quarters INTEGER,
  
  -- Metadata
  calculated_at TIMESTAMP DEFAULT NOW(),
  calculated_by UUID,
  
  FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE,
  FOREIGN KEY (assumption_evidence_id) REFERENCES assumption_evidence(id) ON DELETE CASCADE
);

CREATE INDEX idx_calculation_logs_deal ON calculation_logs(deal_id);
CREATE INDEX idx_calculation_logs_evidence ON calculation_logs(assumption_evidence_id);
CREATE INDEX idx_calculation_logs_type ON calculation_logs(calculation_type);
CREATE INDEX idx_calculation_logs_step ON calculation_logs(calculation_step);

-- ========================================
-- SOURCE CREDIBILITY TRACKING
-- ========================================

CREATE TABLE IF NOT EXISTS source_credibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Source identification
  source_name VARCHAR(300) NOT NULL,
  source_type VARCHAR(100) NOT NULL, -- 'news_outlet', 'official_filing', 'social_media', 'email_intel', etc.
  source_url TEXT,
  
  -- Credibility scoring
  base_credibility_score DECIMAL(5,4) NOT NULL DEFAULT 0.5,
  current_credibility_score DECIMAL(5,4) NOT NULL DEFAULT 0.5,
  credibility_level VARCHAR(20), -- 'confirmed', 'high', 'moderate', 'low'
  
  -- Track record
  total_events INTEGER DEFAULT 0,
  confirmed_events INTEGER DEFAULT 0,
  false_positives INTEGER DEFAULT 0,
  accuracy_rate DECIMAL(5,4),
  
  -- Corroboration
  requires_corroboration BOOLEAN DEFAULT false,
  typical_corroboration_count INTEGER DEFAULT 0,
  
  -- Metadata
  first_seen TIMESTAMP DEFAULT NOW(),
  last_updated TIMESTAMP DEFAULT NOW(),
  notes TEXT
);

CREATE UNIQUE INDEX idx_source_credibility_name ON source_credibility(source_name);
CREATE INDEX idx_source_credibility_score ON source_credibility(current_credibility_score DESC);
CREATE INDEX idx_source_credibility_level ON source_credibility(credibility_level);

-- ========================================
-- EVENT CORROBORATION
-- ========================================

CREATE TABLE IF NOT EXISTS event_corroboration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Event linkage
  primary_event_id UUID NOT NULL,
  corroborating_event_id UUID NOT NULL,
  
  -- Corroboration details
  corroboration_type VARCHAR(50) NOT NULL, -- 'confirms', 'updates', 'contradicts'
  corroboration_strength DECIMAL(5,4) DEFAULT 1.0,
  details TEXT,
  
  -- Impact on confidence
  confidence_boost DECIMAL(5,4) DEFAULT 0.0, -- How much this increases confidence
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (primary_event_id) REFERENCES news_events(id) ON DELETE CASCADE,
  FOREIGN KEY (corroborating_event_id) REFERENCES news_events(id) ON DELETE CASCADE
);

CREATE INDEX idx_event_corroboration_primary ON event_corroboration(primary_event_id);
CREATE INDEX idx_event_corroboration_secondary ON event_corroboration(corroborating_event_id);

-- ========================================
-- EXPORT SNAPSHOTS
-- ========================================

CREATE TABLE IF NOT EXISTS export_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Export details
  deal_id UUID NOT NULL,
  export_type VARCHAR(50) NOT NULL, -- 'pdf', 'excel', 'json'
  export_format VARCHAR(50), -- More specific format details
  
  -- Scope
  assumption_ids UUID[],
  event_ids UUID[],
  include_baseline BOOLEAN DEFAULT true,
  include_calculations BOOLEAN DEFAULT true,
  confidence_threshold DECIMAL(5,4),
  
  -- File storage
  file_path TEXT,
  file_size_bytes BIGINT,
  file_hash VARCHAR(64), -- SHA256 for integrity
  
  -- Metadata
  generated_at TIMESTAMP DEFAULT NOW(),
  generated_by UUID,
  title VARCHAR(300),
  description TEXT,
  
  -- Access tracking
  download_count INTEGER DEFAULT 0,
  last_downloaded TIMESTAMP,
  
  FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE
);

CREATE INDEX idx_export_snapshots_deal ON export_snapshots(deal_id);
CREATE INDEX idx_export_snapshots_type ON export_snapshots(export_type);
CREATE INDEX idx_export_snapshots_generated ON export_snapshots(generated_at DESC);

-- ========================================
-- EVIDENCE CHAIN VIEWS
-- ========================================

-- Complete evidence chain for an assumption
CREATE OR REPLACE VIEW v_assumption_evidence_chains AS
SELECT 
  ae.id AS evidence_id,
  ae.deal_id,
  ae.assumption_id,
  ae.assumption_name,
  ae.assumption_category,
  ae.baseline_value,
  ae.adjusted_value,
  ae.delta_value,
  ae.delta_percentage,
  ae.overall_confidence,
  ae.confidence_level,
  ae.financial_impact,
  
  -- Primary event
  ne.id AS event_id,
  ne.headline AS event_headline,
  ne.event_date,
  ne.source AS event_source,
  ne.credibility_score AS event_credibility,
  
  -- Source credibility
  sc.source_name,
  sc.current_credibility_score AS source_credibility,
  sc.credibility_level AS source_credibility_level,
  
  -- Calculation count
  (SELECT COUNT(*) FROM calculation_logs cl WHERE cl.assumption_evidence_id = ae.id) AS calculation_step_count,
  
  -- Chain links
  (SELECT COUNT(*) FROM audit_chains ac WHERE ac.assumption_id = ae.assumption_id) AS chain_link_count
  
FROM assumption_evidence ae
LEFT JOIN news_events ne ON ae.primary_event_id = ne.id
LEFT JOIN source_credibility sc ON ne.source = sc.source_name;

-- Event impact summary
CREATE OR REPLACE VIEW v_event_impact_summary AS
SELECT 
  ne.id AS event_id,
  ne.headline,
  ne.event_date,
  ne.source,
  ne.credibility_score,
  
  -- Impact metrics
  COUNT(DISTINCT ae.deal_id) AS deals_affected,
  COUNT(DISTINCT ae.assumption_id) AS assumptions_affected,
  
  -- Financial impact
  SUM(ae.financial_impact) AS total_financial_impact,
  AVG(ae.financial_impact) AS avg_financial_impact,
  MAX(ae.financial_impact) AS max_financial_impact,
  
  -- Confidence
  AVG(ae.overall_confidence) AS avg_assumption_confidence
  
FROM news_events ne
INNER JOIN assumption_evidence ae ON ne.id = ae.primary_event_id
GROUP BY ne.id, ne.headline, ne.event_date, ne.source, ne.credibility_score;

-- Deal audit summary
CREATE OR REPLACE VIEW v_deal_audit_summary AS
SELECT 
  d.id AS deal_id,
  d.name AS deal_name,
  d.address,
  
  -- Assumption counts
  COUNT(DISTINCT ae.assumption_id) AS total_assumptions,
  COUNT(DISTINCT CASE WHEN ae.confidence_level = 'confirmed' THEN ae.id END) AS confirmed_assumptions,
  COUNT(DISTINCT CASE WHEN ae.confidence_level = 'high' THEN ae.id END) AS high_confidence_assumptions,
  COUNT(DISTINCT CASE WHEN ae.confidence_level = 'moderate' THEN ae.id END) AS moderate_confidence_assumptions,
  COUNT(DISTINCT CASE WHEN ae.confidence_level = 'low' THEN ae.id END) AS low_confidence_assumptions,
  
  -- Event sources
  COUNT(DISTINCT ae.primary_event_id) AS source_events,
  
  -- Financial impact
  SUM(ae.financial_impact) AS total_financial_impact,
  
  -- Confidence metrics
  AVG(ae.overall_confidence) AS avg_confidence,
  MIN(ae.overall_confidence) AS min_confidence,
  
  -- Calculation depth
  (SELECT COUNT(*) FROM calculation_logs cl WHERE cl.deal_id = d.id) AS total_calculation_steps
  
FROM deals d
LEFT JOIN assumption_evidence ae ON d.id = ae.deal_id
GROUP BY d.id, d.name, d.address;

-- ========================================
-- HELPER FUNCTIONS
-- ========================================

-- Calculate chain confidence (product of all link confidences)
CREATE OR REPLACE FUNCTION calculate_chain_confidence(p_assumption_id UUID)
RETURNS DECIMAL(5,4) AS $$
DECLARE
  v_confidence DECIMAL(5,4);
BEGIN
  SELECT 
    COALESCE(EXP(SUM(LN(GREATEST(link_confidence, 0.01)))), 1.0)::DECIMAL(5,4)
  INTO v_confidence
  FROM audit_chains
  WHERE assumption_id = p_assumption_id;
  
  RETURN COALESCE(v_confidence, 1.0);
END;
$$ LANGUAGE plpgsql;

-- Update source credibility based on accuracy
CREATE OR REPLACE FUNCTION update_source_credibility(p_source_name VARCHAR)
RETURNS VOID AS $$
BEGIN
  UPDATE source_credibility
  SET 
    accuracy_rate = CASE 
      WHEN total_events > 0 THEN (confirmed_events::DECIMAL / total_events)
      ELSE 0.0
    END,
    current_credibility_score = LEAST(
      base_credibility_score + (confirmed_events * 0.05) - (false_positives * 0.10),
      1.0
    ),
    credibility_level = CASE
      WHEN (confirmed_events::DECIMAL / NULLIF(total_events, 0)) >= 0.9 AND total_events >= 2 THEN 'confirmed'
      WHEN (confirmed_events::DECIMAL / NULLIF(total_events, 0)) >= 0.7 THEN 'high'
      WHEN (confirmed_events::DECIMAL / NULLIF(total_events, 0)) >= 0.4 THEN 'moderate'
      ELSE 'low'
    END,
    last_updated = NOW()
  WHERE source_name = p_source_name;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- SEED DATA: Source Credibility Baselines
-- ========================================

INSERT INTO source_credibility (source_name, source_type, base_credibility_score, current_credibility_score, credibility_level) VALUES
  -- Official sources (highest credibility)
  ('SEC EDGAR', 'official_filing', 1.0, 1.0, 'confirmed'),
  ('U.S. Census Bureau', 'official_filing', 1.0, 1.0, 'confirmed'),
  ('Bureau of Labor Statistics', 'official_filing', 1.0, 1.0, 'confirmed'),
  
  -- Tier 1 news outlets
  ('Wall Street Journal', 'news_outlet', 0.85, 0.85, 'high'),
  ('Atlanta Business Chronicle', 'news_outlet', 0.85, 0.85, 'high'),
  ('Bloomberg', 'news_outlet', 0.85, 0.85, 'high'),
  ('Reuters', 'news_outlet', 0.85, 0.85, 'high'),
  
  -- Tier 2 news outlets
  ('Atlanta Journal-Constitution', 'news_outlet', 0.75, 0.75, 'high'),
  ('CoStar News', 'news_outlet', 0.75, 0.75, 'high'),
  ('Bisnow', 'news_outlet', 0.70, 0.70, 'high'),
  
  -- Industry sources
  ('NMHC (National Multifamily Housing Council)', 'industry_association', 0.80, 0.80, 'high'),
  ('Urban Land Institute', 'industry_association', 0.80, 0.80, 'high'),
  
  -- Local sources
  ('Local development authority', 'government', 0.75, 0.75, 'high'),
  ('Chamber of Commerce', 'industry_association', 0.65, 0.65, 'moderate'),
  
  -- Lower credibility sources
  ('Social media post', 'social_media', 0.20, 0.20, 'low'),
  ('Unverified tip', 'email_intel', 0.30, 0.30, 'low'),
  ('Real estate forum', 'social_media', 0.35, 0.35, 'low')
ON CONFLICT (source_name) DO NOTHING;

-- ========================================
-- COMMENTS
-- ========================================

COMMENT ON TABLE audit_chains IS 'Links between entities forming evidence chains from events to assumptions';
COMMENT ON TABLE assumption_evidence IS 'Maps each pro forma assumption to its source events and calculated impact';
COMMENT ON TABLE calculation_logs IS 'Detailed calculation steps showing how events translate into assumption adjustments';
COMMENT ON TABLE source_credibility IS 'Tracks reliability and accuracy of information sources over time';
COMMENT ON TABLE event_corroboration IS 'Links multiple events that confirm or update each other';
COMMENT ON TABLE export_snapshots IS 'Stored audit reports exported for external use';

COMMENT ON COLUMN audit_chains.chain_confidence IS 'Product of all link confidences in the chain from event to assumption';
COMMENT ON COLUMN assumption_evidence.delta_percentage IS 'Percentage change from baseline to adjusted value';
COMMENT ON COLUMN calculation_logs.impact_weight IS 'Geographic weighting factor based on proximity/trade area';
COMMENT ON COLUMN source_credibility.accuracy_rate IS 'Confirmed events / total events ratio';

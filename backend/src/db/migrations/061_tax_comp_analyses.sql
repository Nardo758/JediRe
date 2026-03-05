-- Tax Comp Analysis table
-- Stores comparative tax burden analysis using M27 comp set

CREATE TABLE IF NOT EXISTS tax_comp_analyses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deal_id UUID NOT NULL UNIQUE REFERENCES deals(id) ON DELETE CASCADE,
  
  -- Subject property tax data
  subject_annual_tax NUMERIC,
  subject_tax_per_unit NUMERIC,
  subject_assessed_value NUMERIC,
  subject_effective_rate NUMERIC,
  
  -- Comp statistics
  comp_count INTEGER NOT NULL,
  comps_with_tax_data INTEGER NOT NULL,
  median_tax_per_unit NUMERIC,
  avg_tax_per_unit NUMERIC,
  median_effective_rate NUMERIC,
  avg_effective_rate NUMERIC,
  
  -- Subject positioning
  subject_vs_median_tax_pct NUMERIC,
  subject_vs_median_rate_pct NUMERIC,
  subject_tax_percentile INTEGER,
  
  -- Over-assessment detection
  is_potential_over_assessment BOOLEAN DEFAULT FALSE,
  over_assessment_confidence VARCHAR(20), -- 'low', 'medium', 'high'
  appeal_recommendation TEXT,
  
  -- Detailed comp data
  comps_data JSONB,
  
  -- Metadata
  analyzed_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_tax_comp_analyses_deal ON tax_comp_analyses(deal_id);
CREATE INDEX idx_tax_comp_analyses_over_assessment ON tax_comp_analyses(is_potential_over_assessment) WHERE is_potential_over_assessment = TRUE;

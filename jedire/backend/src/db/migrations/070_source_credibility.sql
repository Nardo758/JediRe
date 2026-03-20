-- Migration 070: Source Credibility & Corroboration Tracking
-- Track which private intelligence (emails) gets confirmed by public sources

-- 1. Source Credibility Table
CREATE TABLE IF NOT EXISTS source_credibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  
  -- Contact Details
  contact_email VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255),
  contact_company VARCHAR(255),
  contact_role VARCHAR(255),
  
  -- Signal Counts
  total_signals INTEGER DEFAULT 0,
  corroborated_signals INTEGER DEFAULT 0,
  failed_signals INTEGER DEFAULT 0,
  pending_signals INTEGER DEFAULT 0,
  
  -- Credibility Scores (0-1)
  credibility_score DECIMAL(5, 4) DEFAULT 0.5,
  consistency_score DECIMAL(5, 4) DEFAULT 0.5,
  
  -- Intelligence Value (0-100)
  intelligence_value_score DECIMAL(5, 2) DEFAULT 50.0,
  
  -- Timing Metrics
  avg_lead_time_days DECIMAL(10, 2) DEFAULT 0,
  avg_corroboration_time_days DECIMAL(10, 2) DEFAULT 0,
  avg_impact_magnitude DECIMAL(10, 2) DEFAULT 0,
  
  -- Timestamps
  last_signal_at TIMESTAMP,
  last_corroboration_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT unique_user_contact UNIQUE (user_id, contact_email)
);

-- 2. Source Specialties Table
CREATE TABLE IF NOT EXISTS source_specialties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_credibility_id UUID NOT NULL REFERENCES source_credibility(id) ON DELETE CASCADE,
  
  -- Specialty Details
  category VARCHAR(100) NOT NULL,
  event_type VARCHAR(100),
  
  -- Performance Metrics
  total_signals INTEGER DEFAULT 0,
  corroborated_signals INTEGER DEFAULT 0,
  failed_signals INTEGER DEFAULT 0,
  pending_signals INTEGER DEFAULT 0,
  
  -- Scores
  specialty_score DECIMAL(5, 4) DEFAULT 0.5,
  base_accuracy DECIMAL(5, 4) DEFAULT 0.5,
  specialty_bonus DECIMAL(5, 4) DEFAULT 0,
  
  -- Metrics
  avg_impact_magnitude DECIMAL(10, 2) DEFAULT 0,
  avg_lead_time_days DECIMAL(10, 2) DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT unique_source_specialty UNIQUE (source_credibility_id, category, event_type)
);

-- 3. Corroboration Matches Table
CREATE TABLE IF NOT EXISTS corroboration_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Event References
  private_event_id UUID NOT NULL, -- References news_events
  public_event_id UUID NOT NULL, -- References news_events
  
  -- Match Scores (0-1)
  match_score DECIMAL(5, 4) NOT NULL,
  location_score DECIMAL(5, 4) DEFAULT 0,
  entity_score DECIMAL(5, 4) DEFAULT 0,
  magnitude_score DECIMAL(5, 4) DEFAULT 0,
  temporal_score DECIMAL(5, 4) DEFAULT 0,
  type_score DECIMAL(5, 4) DEFAULT 0,
  
  -- Timing
  lead_time_days INTEGER NOT NULL,
  
  -- Confidence Level
  match_confidence VARCHAR(50) NOT NULL CHECK (match_confidence IN ('low', 'medium', 'high', 'very_high')),
  
  -- Status
  verified BOOLEAN DEFAULT FALSE,
  verified_by_user_id UUID,
  verified_at TIMESTAMP,
  rejected BOOLEAN DEFAULT FALSE,
  rejection_reason TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT unique_event_match UNIQUE (private_event_id, public_event_id)
);

-- Indexes
CREATE INDEX idx_source_credibility_user_id ON source_credibility(user_id);
CREATE INDEX idx_source_credibility_email ON source_credibility(contact_email);
CREATE INDEX idx_source_credibility_score ON source_credibility(credibility_score DESC);
CREATE INDEX idx_source_credibility_intelligence_value ON source_credibility(intelligence_value_score DESC);

CREATE INDEX idx_source_specialties_source_id ON source_specialties(source_credibility_id);
CREATE INDEX idx_source_specialties_category ON source_specialties(category);
CREATE INDEX idx_source_specialties_score ON source_specialties(specialty_score DESC);

CREATE INDEX idx_corroboration_matches_private ON corroboration_matches(private_event_id);
CREATE INDEX idx_corroboration_matches_public ON corroboration_matches(public_event_id);
CREATE INDEX idx_corroboration_matches_confidence ON corroboration_matches(match_confidence);
CREATE INDEX idx_corroboration_matches_verified ON corroboration_matches(verified);

-- Updated timestamp triggers
CREATE OR REPLACE FUNCTION update_credibility_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER source_credibility_updated_at
  BEFORE UPDATE ON source_credibility
  FOR EACH ROW
  EXECUTE FUNCTION update_credibility_timestamp();

CREATE TRIGGER source_specialties_updated_at
  BEFORE UPDATE ON source_specialties
  FOR EACH ROW
  EXECUTE FUNCTION update_credibility_timestamp();

-- Function to recalculate source credibility scores
CREATE OR REPLACE FUNCTION recalculate_source_credibility(p_source_id UUID)
RETURNS VOID AS $$
DECLARE
  v_total INTEGER;
  v_corroborated INTEGER;
  v_failed INTEGER;
  v_pending INTEGER;
  v_credibility DECIMAL(5, 4);
BEGIN
  -- Get counts
  SELECT 
    total_signals, 
    corroborated_signals, 
    failed_signals, 
    pending_signals
  INTO v_total, v_corroborated, v_failed, v_pending
  FROM source_credibility
  WHERE id = p_source_id;
  
  -- Calculate credibility score
  IF v_total > 0 THEN
    v_credibility := CAST(v_corroborated AS DECIMAL) / v_total;
  ELSE
    v_credibility := 0.5; -- Default to neutral
  END IF;
  
  -- Update the source
  UPDATE source_credibility
  SET 
    credibility_score = v_credibility,
    updated_at = NOW()
  WHERE id = p_source_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE source_credibility IS 'Tracks credibility scores for intelligence sources based on corroboration history';
COMMENT ON TABLE source_specialties IS 'Specialty-specific credibility scores for sources (e.g., acquisitions, leasing)';
COMMENT ON TABLE corroboration_matches IS 'Matches between private intelligence and public confirmation events';

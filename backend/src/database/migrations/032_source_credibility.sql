-- Source Credibility Learning System
-- Phase 3, Component 4: Track private intel vs public confirmation correlation

-- Expand news_contact_credibility table with additional fields
ALTER TABLE news_contact_credibility
ADD COLUMN IF NOT EXISTS avg_lead_time_days DECIMAL(8,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS avg_corroboration_time_days DECIMAL(8,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS failed_signals INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS pending_signals INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS intelligence_value_score DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS consistency_score DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS avg_impact_magnitude DECIMAL(8,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_corroboration_at TIMESTAMP;

-- Corroboration Matches - Detailed private event ↔ public event links
CREATE TABLE IF NOT EXISTS corroboration_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Event linking
  private_event_id UUID NOT NULL REFERENCES news_events(id) ON DELETE CASCADE,
  public_event_id UUID NOT NULL REFERENCES news_events(id) ON DELETE CASCADE,
  
  -- Match scoring components
  match_score DECIMAL(3,2) NOT NULL, -- 0-1 overall match score
  location_score DECIMAL(3,2) DEFAULT 0,
  entity_score DECIMAL(3,2) DEFAULT 0,
  magnitude_score DECIMAL(3,2) DEFAULT 0,
  temporal_score DECIMAL(3,2) DEFAULT 0,
  type_score DECIMAL(3,2) DEFAULT 0,
  
  -- Match metadata
  matched_fields JSONB, -- details of what matched
  match_confidence VARCHAR(20), -- low, medium, high, very_high
  
  -- Intelligence value
  lead_time_days INTEGER NOT NULL, -- days early for private event
  competitive_advantage BOOLEAN DEFAULT TRUE,
  
  -- Manual override
  is_confirmed BOOLEAN DEFAULT TRUE,
  confirmed_by UUID REFERENCES users(id),
  confirmed_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(private_event_id, public_event_id)
);

CREATE INDEX idx_corroboration_private ON corroboration_matches(private_event_id);
CREATE INDEX idx_corroboration_public ON corroboration_matches(public_event_id);
CREATE INDEX idx_corroboration_score ON corroboration_matches(match_score DESC);
CREATE INDEX idx_corroboration_lead_time ON corroboration_matches(lead_time_days DESC);
CREATE INDEX idx_corroboration_created ON corroboration_matches(created_at DESC);

-- Credibility History - Time-series tracking of source performance
CREATE TABLE IF NOT EXISTS credibility_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Source reference
  contact_credibility_id UUID NOT NULL REFERENCES news_contact_credibility(id) ON DELETE CASCADE,
  
  -- Event that triggered update
  event_id UUID REFERENCES news_events(id) ON DELETE SET NULL,
  corroboration_match_id UUID REFERENCES corroboration_matches(id) ON DELETE SET NULL,
  
  -- Snapshot of metrics at this point in time
  credibility_score DECIMAL(5,2) NOT NULL,
  total_signals INTEGER NOT NULL,
  corroborated_signals INTEGER NOT NULL,
  failed_signals INTEGER NOT NULL,
  pending_signals INTEGER NOT NULL,
  
  -- Change metadata
  change_type VARCHAR(30) NOT NULL, -- new_signal, corroborated, failed, manual_adjustment
  change_reason TEXT,
  
  -- Calculated at snapshot time
  intelligence_value_score DECIMAL(5,2),
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_credibility_history_contact ON credibility_history(contact_credibility_id);
CREATE INDEX idx_credibility_history_created ON credibility_history(created_at DESC);
CREATE INDEX idx_credibility_history_event ON credibility_history(event_id);

-- Specialty Scores - Category-specific credibility
CREATE TABLE IF NOT EXISTS specialty_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Source reference
  contact_credibility_id UUID NOT NULL REFERENCES news_contact_credibility(id) ON DELETE CASCADE,
  
  -- Category
  event_category VARCHAR(50) NOT NULL, -- employment, development, transactions, government, amenities
  event_type VARCHAR(100), -- optional: specific type within category
  
  -- Performance in this specialty
  total_signals INTEGER DEFAULT 0,
  corroborated_signals INTEGER DEFAULT 0,
  failed_signals INTEGER DEFAULT 0,
  pending_signals INTEGER DEFAULT 0,
  
  -- Scoring
  specialty_score DECIMAL(5,2) DEFAULT 50.0, -- 0-100 with specialty bonus
  base_accuracy DECIMAL(5,2) DEFAULT 50.0, -- without bonus
  specialty_bonus DECIMAL(5,2) DEFAULT 0, -- bonus points for specialization
  
  -- Impact in this category
  avg_impact_magnitude DECIMAL(8,2) DEFAULT 0,
  avg_lead_time_days DECIMAL(8,2) DEFAULT 0,
  
  -- Timestamps
  first_signal_at TIMESTAMP,
  last_signal_at TIMESTAMP,
  last_corroboration_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(contact_credibility_id, event_category, event_type)
);

CREATE INDEX idx_specialty_scores_contact ON specialty_scores(contact_credibility_id);
CREATE INDEX idx_specialty_scores_category ON specialty_scores(event_category);
CREATE INDEX idx_specialty_scores_score ON specialty_scores(specialty_score DESC);

-- Competitive Intelligence Value - Track early signal advantage
CREATE TABLE IF NOT EXISTS competitive_intelligence_value (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Source reference
  contact_credibility_id UUID NOT NULL REFERENCES news_contact_credibility(id) ON DELETE CASCADE,
  
  -- Event references
  private_event_id UUID NOT NULL REFERENCES news_events(id) ON DELETE CASCADE,
  corroboration_match_id UUID REFERENCES corroboration_matches(id) ON DELETE SET NULL,
  
  -- Intelligence metrics
  lead_time_days INTEGER NOT NULL,
  impact_magnitude DECIMAL(10,2), -- quantified impact (jobs, sqft, investment $)
  impact_category VARCHAR(50) NOT NULL,
  
  -- Value calculation
  time_value_score DECIMAL(5,2), -- 0-100 based on lead time
  impact_value_score DECIMAL(5,2), -- 0-100 based on magnitude
  combined_value_score DECIMAL(5,2), -- weighted combination
  
  -- Business impact
  affected_deals_count INTEGER DEFAULT 0,
  affected_properties_count INTEGER DEFAULT 0,
  estimated_business_value DECIMAL(12,2), -- estimated $ value of early knowledge
  
  -- Temporal data
  private_signal_date TIMESTAMP NOT NULL,
  public_confirmation_date TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_intel_value_contact ON competitive_intelligence_value(contact_credibility_id);
CREATE INDEX idx_intel_value_private_event ON competitive_intelligence_value(private_event_id);
CREATE INDEX idx_intel_value_lead_time ON competitive_intelligence_value(lead_time_days DESC);
CREATE INDEX idx_intel_value_score ON competitive_intelligence_value(combined_value_score DESC);
CREATE INDEX idx_intel_value_created ON competitive_intelligence_value(created_at DESC);

-- Predictive Credibility - Store predictions for new signals
CREATE TABLE IF NOT EXISTS predictive_credibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Event reference
  event_id UUID NOT NULL REFERENCES news_events(id) ON DELETE CASCADE,
  
  -- Source reference
  contact_credibility_id UUID REFERENCES news_contact_credibility(id) ON DELETE SET NULL,
  
  -- Prediction
  predicted_accuracy DECIMAL(5,2) NOT NULL, -- 0-100 probability of corroboration
  predicted_corroboration_days INTEGER, -- estimated days until confirmation
  confidence_level VARCHAR(20) NOT NULL, -- low, medium, high, very_high
  
  -- Basis for prediction
  historical_accuracy DECIMAL(5,2),
  specialty_match BOOLEAN DEFAULT FALSE,
  specialty_accuracy DECIMAL(5,2),
  sample_size INTEGER, -- how many historical signals
  
  -- Weighting applied
  applied_weight DECIMAL(3,2), -- weight used in demand/supply calculations
  
  -- Outcome tracking
  actual_corroboration_days INTEGER,
  prediction_accuracy DECIMAL(5,2), -- how accurate was the prediction
  
  created_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP
);

CREATE INDEX idx_predictive_event ON predictive_credibility(event_id);
CREATE INDEX idx_predictive_contact ON predictive_credibility(contact_credibility_id);
CREATE INDEX idx_predictive_accuracy ON predictive_credibility(predicted_accuracy DESC);
CREATE INDEX idx_predictive_created ON predictive_credibility(created_at DESC);

-- Update triggers
CREATE TRIGGER corroboration_matches_updated_at
BEFORE UPDATE ON corroboration_matches
FOR EACH ROW
EXECUTE FUNCTION update_news_timestamp();

CREATE TRIGGER specialty_scores_updated_at
BEFORE UPDATE ON specialty_scores
FOR EACH ROW
EXECUTE FUNCTION update_news_timestamp();

-- Helper function: Calculate match score between two events
CREATE OR REPLACE FUNCTION calculate_event_match_score(
  event1_id UUID,
  event2_id UUID
)
RETURNS TABLE (
  match_score DECIMAL(3,2),
  location_score DECIMAL(3,2),
  entity_score DECIMAL(3,2),
  magnitude_score DECIMAL(3,2),
  temporal_score DECIMAL(3,2),
  type_score DECIMAL(3,2)
) AS $$
DECLARE
  e1 RECORD;
  e2 RECORD;
  loc_score DECIMAL(3,2) := 0;
  ent_score DECIMAL(3,2) := 0;
  mag_score DECIMAL(3,2) := 0;
  temp_score DECIMAL(3,2) := 0;
  type_score_val DECIMAL(3,2) := 0;
  total_score DECIMAL(3,2) := 0;
  distance_miles DECIMAL(8,2);
  days_diff INTEGER;
BEGIN
  -- Get both events
  SELECT * INTO e1 FROM news_events WHERE id = event1_id;
  SELECT * INTO e2 FROM news_events WHERE id = event2_id;
  
  -- Location similarity (30%)
  IF e1.location_geocoded IS NOT NULL AND e2.location_geocoded IS NOT NULL THEN
    distance_miles := ST_Distance(e1.location_geocoded, e2.location_geocoded) * 69.0;
    loc_score := GREATEST(0, 1 - (distance_miles / 10.0)); -- 0 score at 10+ miles
  END IF;
  
  -- Entity similarity (30%) - compare extracted company names
  IF e1.extracted_data->>'company_name' IS NOT NULL 
     AND e2.extracted_data->>'company_name' IS NOT NULL THEN
    -- Simple string similarity (in production, use pg_trgm)
    IF LOWER(e1.extracted_data->>'company_name') = LOWER(e2.extracted_data->>'company_name') THEN
      ent_score := 1.0;
    ELSIF LOWER(e1.extracted_data->>'company_name') LIKE '%' || LOWER(e2.extracted_data->>'company_name') || '%' 
       OR LOWER(e2.extracted_data->>'company_name') LIKE '%' || LOWER(e1.extracted_data->>'company_name') || '%' THEN
      ent_score := 0.7;
    END IF;
  END IF;
  
  -- Magnitude similarity (20%)
  IF e1.extracted_data->>'magnitude' IS NOT NULL 
     AND e2.extracted_data->>'magnitude' IS NOT NULL THEN
    -- Compare numeric magnitudes (jobs, sqft, etc)
    mag_score := 1.0 - LEAST(1.0, 
      ABS((e1.extracted_data->>'magnitude')::DECIMAL - (e2.extracted_data->>'magnitude')::DECIMAL) / 
      GREATEST((e1.extracted_data->>'magnitude')::DECIMAL, (e2.extracted_data->>'magnitude')::DECIMAL)
    );
  END IF;
  
  -- Temporal proximity (10%)
  days_diff := ABS(EXTRACT(EPOCH FROM (e1.published_at - e2.published_at)) / 86400)::INTEGER;
  temp_score := GREATEST(0, 1 - (days_diff / 90.0)); -- 0 score at 90+ days
  
  -- Event type matching (10%)
  IF e1.event_type = e2.event_type THEN
    type_score_val := 1.0;
  ELSIF e1.event_category = e2.event_category THEN
    type_score_val := 0.5;
  END IF;
  
  -- Weighted total
  total_score := (loc_score * 0.30) + (ent_score * 0.30) + (mag_score * 0.20) + 
                 (temp_score * 0.10) + (type_score_val * 0.10);
  
  RETURN QUERY SELECT total_score, loc_score, ent_score, mag_score, temp_score, type_score_val;
END;
$$ LANGUAGE plpgsql;

-- Helper function: Calculate intelligence value score
CREATE OR REPLACE FUNCTION calculate_intelligence_value(
  contact_cred_id UUID
)
RETURNS DECIMAL(5,2) AS $$
DECLARE
  avg_lead_time DECIMAL(8,2);
  accuracy_rate DECIMAL(5,2);
  avg_impact DECIMAL(8,2);
  consistency DECIMAL(5,2);
  value_score DECIMAL(5,2);
  signal_count INTEGER;
BEGIN
  SELECT 
    COALESCE(AVG(lead_time_days), 0),
    CASE 
      WHEN SUM(corroborated_signals + failed_signals) > 0 
      THEN (SUM(corroborated_signals)::DECIMAL / SUM(corroborated_signals + failed_signals)::DECIMAL) * 100
      ELSE 50.0 
    END,
    COALESCE(AVG(avg_impact_magnitude), 0),
    COALESCE(SUM(total_signals), 0)
  INTO avg_lead_time, accuracy_rate, avg_impact, signal_count
  FROM news_contact_credibility ncc
  LEFT JOIN specialty_scores ss ON ss.contact_credibility_id = ncc.id
  WHERE ncc.id = contact_cred_id
  GROUP BY ncc.id;
  
  -- Consistency score: regular signals = higher score
  consistency := LEAST(100, signal_count * 5); -- 5 points per signal, max 100
  
  -- Normalize lead time to 0-100 (30 days = 100 points)
  avg_lead_time := LEAST(100, (avg_lead_time / 30.0) * 100);
  
  -- Normalize impact to 0-100 (1000 units = 100 points)
  avg_impact := LEAST(100, (avg_impact / 1000.0) * 100);
  
  -- Weighted combination
  value_score := (avg_lead_time * 0.30) + (accuracy_rate * 0.30) + 
                 (avg_impact * 0.25) + (consistency * 0.15);
  
  RETURN value_score;
END;
$$ LANGUAGE plpgsql;

-- Helper function: Update source credibility after corroboration
CREATE OR REPLACE FUNCTION update_source_credibility_scores(
  contact_cred_id UUID
)
RETURNS VOID AS $$
DECLARE
  total_count INTEGER;
  corr_count INTEGER;
  failed_count INTEGER;
  pending_count INTEGER;
  base_score DECIMAL(5,2);
  recency_weight DECIMAL(3,2);
  final_score DECIMAL(5,2);
BEGIN
  -- Get signal counts
  SELECT 
    total_signals,
    corroborated_signals,
    failed_signals,
    pending_signals
  INTO total_count, corr_count, failed_count, pending_count
  FROM news_contact_credibility
  WHERE id = contact_cred_id;
  
  -- Base accuracy (exclude pending)
  IF (corr_count + failed_count) > 0 THEN
    base_score := (corr_count::DECIMAL / (corr_count + failed_count)::DECIMAL) * 100;
  ELSE
    base_score := 50.0; -- neutral for new contacts
  END IF;
  
  -- Apply recency weight (signals in last 90 days weighted higher)
  -- This is simplified; in practice, query recent events
  recency_weight := 1.0;
  
  final_score := base_score * recency_weight;
  
  -- Update intelligence value score
  UPDATE news_contact_credibility
  SET 
    credibility_score = final_score / 100.0, -- store as 0-1
    intelligence_value_score = calculate_intelligence_value(contact_cred_id),
    updated_at = NOW()
  WHERE id = contact_cred_id;
  
  -- Update specialty scores
  UPDATE specialty_scores ss
  SET 
    base_accuracy = CASE 
      WHEN (ss.corroborated_signals + ss.failed_signals) > 0
      THEN (ss.corroborated_signals::DECIMAL / (ss.corroborated_signals + ss.failed_signals)::DECIMAL) * 100
      ELSE 50.0
    END,
    specialty_bonus = CASE
      WHEN ss.total_signals >= 5 AND (ss.total_signals::DECIMAL / total_count::DECIMAL) > 0.7
      THEN 10.0 -- 70%+ signals in this category = specialist
      ELSE 0
    END,
    updated_at = NOW()
  WHERE ss.contact_credibility_id = contact_cred_id;
  
  -- Update specialty_score as base + bonus
  UPDATE specialty_scores
  SET specialty_score = base_accuracy + specialty_bonus
  WHERE contact_credibility_id = contact_cred_id;
  
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE corroboration_matches IS 'Tracks when private intelligence (emails) is confirmed by public news sources';
COMMENT ON TABLE credibility_history IS 'Time-series tracking of source credibility performance over time';
COMMENT ON TABLE specialty_scores IS 'Category-specific credibility scores (e.g., employment vs development)';
COMMENT ON TABLE competitive_intelligence_value IS 'Quantifies the business value of early signals from private sources';
COMMENT ON TABLE predictive_credibility IS 'Predictions of accuracy for new signals based on historical performance';

COMMENT ON COLUMN corroboration_matches.lead_time_days IS 'Number of days the private source was ahead of public confirmation';
COMMENT ON COLUMN specialty_scores.specialty_bonus IS 'Bonus points (0-10) for sources that specialize in specific categories';
COMMENT ON COLUMN competitive_intelligence_value.estimated_business_value IS 'Estimated dollar value of having this information early';

-- Migration 015: User Acquisition Preferences
-- Date: 2026-02-02
-- Purpose: Store user-defined property acquisition criteria for intelligent filtering

-- ============================================================================
-- User Acquisition Preferences
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_acquisition_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Property criteria
  property_types text[] DEFAULT '{}', -- ['multifamily', 'retail', 'office', 'industrial', 'mixed-use', 'land']
  
  -- Unit count (for multifamily)
  min_units integer,
  max_units integer,
  
  -- Year built
  min_year_built integer,
  max_year_built integer,
  
  -- Geographic markets
  markets text[] DEFAULT '{}', -- ['GA', 'FL', 'NC', 'TX'] or specific cities
  cities text[] DEFAULT '{}', -- Specific cities
  states text[] DEFAULT '{}', -- State codes
  zip_codes text[] DEFAULT '{}', -- Specific zip codes
  
  -- Price range
  min_price numeric(15, 2),
  max_price numeric(15, 2),
  
  -- Square footage
  min_sqft integer,
  max_sqft integer,
  
  -- Cap rate
  min_cap_rate numeric(5, 2),
  max_cap_rate numeric(5, 2),
  
  -- Occupancy
  min_occupancy numeric(5, 2), -- Percentage
  
  -- Property condition
  conditions text[] DEFAULT '{}', -- ['excellent', 'good', 'fair', 'value-add', 'distressed']
  
  -- Deal structure preferences
  deal_types text[] DEFAULT '{}', -- ['acquisition', 'development', 'joint-venture', 'note-purchase']
  
  -- Custom criteria (flexible JSONB for future expansion)
  custom_criteria jsonb DEFAULT '{}',
  
  -- Matching behavior
  auto_create_on_match boolean DEFAULT true, -- Auto-create pins for high-confidence matches
  notify_on_mismatch boolean DEFAULT false, -- Notify user when property doesn't match
  confidence_threshold numeric(3, 2) DEFAULT 0.80, -- Minimum confidence to auto-create (0.00 - 1.00)
  
  -- Metadata
  is_active boolean DEFAULT true,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_acquisition_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_active ON user_acquisition_preferences(is_active);
CREATE INDEX IF NOT EXISTS idx_user_preferences_property_types ON user_acquisition_preferences USING GIN(property_types);
CREATE INDEX IF NOT EXISTS idx_user_preferences_markets ON user_acquisition_preferences USING GIN(markets);
CREATE INDEX IF NOT EXISTS idx_user_preferences_states ON user_acquisition_preferences USING GIN(states);

-- ============================================================================
-- Property Extraction Queue (Enhanced with Preference Matching)
-- ============================================================================

CREATE TABLE IF NOT EXISTS property_extraction_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Email source
  email_id text, -- External email ID (Outlook/Gmail)
  email_subject text,
  email_from text,
  email_received_at timestamp,
  
  -- Extracted property data
  extracted_data jsonb NOT NULL, -- AI-extracted property information
  
  -- Confidence scores
  extraction_confidence numeric(3, 2), -- How confident AI is about the extraction (0.00 - 1.00)
  preference_match_score numeric(3, 2), -- How well it matches user preferences (0.00 - 1.00)
  preference_match_reasons jsonb, -- Array of reasons why it matched/didn't match
  
  -- Processing status
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'auto-created', 'requires-review', 'rejected', 'ignored'
  decision_reason text, -- Why it was auto-created/rejected/ignored
  
  -- Actions
  created_pin_id uuid REFERENCES map_pins(id) ON DELETE SET NULL, -- If auto-created, link to pin
  reviewed_by uuid REFERENCES users(id), -- If manually reviewed
  reviewed_at timestamp,
  
  -- Metadata
  created_at timestamp DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_extraction_queue_user_id ON property_extraction_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_extraction_queue_status ON property_extraction_queue(status);
CREATE INDEX IF NOT EXISTS idx_extraction_queue_created_at ON property_extraction_queue(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_extraction_queue_email_id ON property_extraction_queue(email_id);

-- ============================================================================
-- Preference Match Log (Audit trail)
-- ============================================================================

CREATE TABLE IF NOT EXISTS preference_match_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  extraction_id uuid REFERENCES property_extraction_queue(id) ON DELETE CASCADE,
  
  -- Match details
  matched boolean NOT NULL,
  match_score numeric(3, 2) NOT NULL,
  match_reasons jsonb, -- Detailed breakdown of what matched/didn't
  
  -- Decision
  action_taken text NOT NULL, -- 'auto-create', 'pending-review', 'skip', 'ignore'
  
  -- Metadata
  created_at timestamp DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_match_log_user_id ON preference_match_log(user_id);
CREATE INDEX IF NOT EXISTS idx_match_log_extraction_id ON preference_match_log(extraction_id);
CREATE INDEX IF NOT EXISTS idx_match_log_matched ON preference_match_log(matched);
CREATE INDEX IF NOT EXISTS idx_match_log_created_at ON preference_match_log(created_at DESC);

-- ============================================================================
-- Functions
-- ============================================================================

-- Function: Update user preferences updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_user_preferences_updated_at
  BEFORE UPDATE ON user_acquisition_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_user_preferences_updated_at();

-- ============================================================================
-- Views
-- ============================================================================

-- View: Pending property reviews (items requiring user action)
CREATE OR REPLACE VIEW pending_property_reviews AS
SELECT 
  pq.id,
  pq.user_id,
  pq.email_subject,
  pq.email_from,
  pq.extracted_data,
  pq.extraction_confidence,
  pq.preference_match_score,
  pq.preference_match_reasons,
  pq.created_at,
  u.email as user_email,
  u.full_name as user_name
FROM property_extraction_queue pq
JOIN users u ON pq.user_id = u.id
WHERE pq.status = 'requires-review'
ORDER BY pq.created_at DESC;

-- View: User preference summary
CREATE OR REPLACE VIEW user_preference_summary AS
SELECT 
  up.user_id,
  u.full_name,
  u.email,
  up.property_types,
  up.markets,
  up.min_units,
  up.max_units,
  up.min_year_built,
  up.min_price,
  up.max_price,
  up.auto_create_on_match,
  up.confidence_threshold,
  up.is_active,
  COUNT(DISTINCT pq.id) as total_properties_evaluated,
  COUNT(DISTINCT pq.id) FILTER (WHERE pq.status = 'auto-created') as auto_created_count,
  COUNT(DISTINCT pq.id) FILTER (WHERE pq.status = 'requires-review') as pending_review_count
FROM user_acquisition_preferences up
JOIN users u ON up.user_id = u.id
LEFT JOIN property_extraction_queue pq ON pq.user_id = up.user_id
GROUP BY up.user_id, u.full_name, u.email, up.property_types, up.markets, 
         up.min_units, up.max_units, up.min_year_built, up.min_price, 
         up.max_price, up.auto_create_on_match, up.confidence_threshold, up.is_active;

-- ============================================================================
-- RLS Policies
-- ============================================================================

-- Enable RLS
ALTER TABLE user_acquisition_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_extraction_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE preference_match_log ENABLE ROW LEVEL SECURITY;

-- Policies: Users can only see their own preferences
CREATE POLICY user_preferences_isolation ON user_acquisition_preferences
  FOR ALL
  USING (user_id = current_setting('app.user_id')::uuid);

CREATE POLICY extraction_queue_isolation ON property_extraction_queue
  FOR ALL
  USING (user_id = current_setting('app.user_id')::uuid);

CREATE POLICY match_log_isolation ON preference_match_log
  FOR ALL
  USING (user_id = current_setting('app.user_id')::uuid);

-- ============================================================================
-- Sample Data (for testing)
-- ============================================================================

-- Insert sample preferences for demo user
DO $$
DECLARE
  demo_user_id uuid;
BEGIN
  -- Get demo user ID
  SELECT id INTO demo_user_id FROM users WHERE email = 'demo@jedire.com' LIMIT 1;
  
  IF demo_user_id IS NOT NULL THEN
    INSERT INTO user_acquisition_preferences (
      user_id,
      property_types,
      min_units,
      min_year_built,
      markets,
      states,
      min_price,
      max_price,
      deal_types,
      auto_create_on_match,
      confidence_threshold
    ) VALUES (
      demo_user_id,
      ARRAY['multifamily'],
      200, -- 200+ units
      1990, -- 1990 or newer
      ARRAY['Atlanta', 'Miami', 'Charlotte', 'Austin', 'Dallas'],
      ARRAY['GA', 'FL', 'NC', 'TX'],
      5000000, -- $5M minimum
      50000000, -- $50M maximum
      ARRAY['acquisition', 'joint-venture'],
      true, -- Auto-create on match
      0.80 -- 80% confidence threshold
    )
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

COMMENT ON TABLE user_acquisition_preferences IS 'User-defined criteria for property acquisition filtering';
COMMENT ON TABLE property_extraction_queue IS 'Queue of properties extracted from emails, awaiting matching and decision';
COMMENT ON TABLE preference_match_log IS 'Audit trail of preference matching decisions';

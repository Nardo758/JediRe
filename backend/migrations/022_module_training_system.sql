-- ============================================
-- MODULE TRAINING SYSTEM
-- ============================================
-- Created: 2026-02-17
-- Purpose: Pattern training for modules (learn user's style)

-- User module training (stores learned patterns per module per user)
CREATE TABLE user_module_training (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  module_id VARCHAR(50) NOT NULL, -- 'financial', 'traffic', 'development', 'market_research', 'due_diligence'
  
  -- Learned patterns (JSONB for flexibility)
  learned_patterns JSONB NOT NULL DEFAULT '{}',
  -- Example structure:
  -- {
  --   "rent_growth_avg": 3.2,
  --   "rent_growth_behavior": "conservative",
  --   "exit_cap_spread": 0.5,
  --   "hold_period_mode": 7,
  --   "stress_test_defaults": {...}
  -- }
  
  -- Model performance metrics
  accuracy DECIMAL(5,2) DEFAULT 0.0, -- 0-100
  confidence DECIMAL(5,2) DEFAULT 0.0, -- 0-100
  sample_size INTEGER DEFAULT 0,
  
  -- Training metadata
  last_trained TIMESTAMP,
  training_duration_minutes INTEGER,
  model_version VARCHAR(20) DEFAULT '1.0',
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(user_id, module_id)
);

CREATE INDEX idx_user_module_training_user ON user_module_training(user_id);
CREATE INDEX idx_user_module_training_module ON user_module_training(module_id);

-- Training examples (individual data points used for training)
CREATE TABLE training_examples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  training_id UUID NOT NULL REFERENCES user_module_training(id) ON DELETE CASCADE,
  
  -- Input data (deal characteristics)
  deal_characteristics JSONB NOT NULL,
  -- Example: { "asking_price": 45000000, "units": 280, "submarket": "Buckhead" }
  
  -- User's decision/output
  user_output JSONB NOT NULL,
  -- Example: { "adjusted_rent": 1800, "adjusted_occupancy": 95, "exit_cap": 6.5 }
  
  -- Quality assessment
  quality_score DECIMAL(5,2) DEFAULT 0.0, -- 0-100
  
  -- Source metadata
  source_type VARCHAR(50), -- 'uploaded_proforma', 'past_deal', 'manual_entry'
  source_file_name VARCHAR(255),
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_training_examples_training ON training_examples(training_id);
CREATE INDEX idx_training_examples_quality ON training_examples(quality_score);

-- Module suggestions (track what modules suggest and user responses)
CREATE TABLE module_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capsule_id UUID NOT NULL, -- References deal_capsules(id)
  module_id VARCHAR(50) NOT NULL,
  
  -- The suggestion
  suggested_field VARCHAR(100) NOT NULL, -- 'adjusted_rent', 'adjusted_occupancy', etc.
  suggested_value JSONB NOT NULL,
  suggestion_reason TEXT,
  confidence DECIMAL(5,2), -- 0-100
  
  -- User response
  user_response VARCHAR(20), -- 'accepted', 'rejected', 'modified'
  user_final_value JSONB,
  feedback_notes TEXT,
  feedback_timestamp TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_module_suggestions_capsule ON module_suggestions(capsule_id);
CREATE INDEX idx_module_suggestions_module ON module_suggestions(module_id);
CREATE INDEX idx_module_suggestions_response ON module_suggestions(user_response);

-- Comments
COMMENT ON TABLE user_module_training IS 'Stores learned patterns from user training data per module';
COMMENT ON TABLE training_examples IS 'Individual training data points used to learn patterns';
COMMENT ON TABLE module_suggestions IS 'Tracks module suggestions and user acceptance/rejection';

COMMENT ON COLUMN user_module_training.learned_patterns IS 'JSONB storing extracted patterns (rent_growth, exit_cap, etc.)';
COMMENT ON COLUMN user_module_training.accuracy IS 'Percentage accuracy of suggestions (0-100)';
COMMENT ON COLUMN user_module_training.confidence IS 'Confidence score based on sample size and consistency (0-100)';

COMMENT ON COLUMN training_examples.quality_score IS 'Quality assessment (0-100): completeness, consistency, realism, clarity';
COMMENT ON COLUMN module_suggestions.user_response IS 'accepted = used as-is, rejected = ignored, modified = adjusted before using';

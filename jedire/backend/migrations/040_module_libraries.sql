/**
 * Module Libraries Schema
 * 
 * Allows users to upload historical data files (Excel, PDF, CSV) that Opus 
 * will analyze to learn patterns, formulas, and assumptions for generating 
 * new pro formas and models.
 * 
 * Example: User uploads 10 multifamily pro formas → Opus learns typical 
 * OpEx/unit, rent growth, cap rates → Applies patterns to new deals.
 */

-- Module library files table
CREATE TABLE IF NOT EXISTS module_library_files (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  module_name VARCHAR(50) NOT NULL, -- 'financial', 'market', 'due_diligence'
  category VARCHAR(100) NOT NULL, -- 'previous_pro_formas', 'historical_opex', etc.
  
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size BIGINT,
  mime_type VARCHAR(100),
  
  uploaded_by INT,
  uploaded_at TIMESTAMP DEFAULT NOW(),
  
  -- Parsing results
  parsing_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'parsing', 'complete', 'error'
  parsed_at TIMESTAMP,
  parsing_errors TEXT,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Patterns extracted by Opus
CREATE TABLE IF NOT EXISTS opus_learned_patterns (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  module_name VARCHAR(50) NOT NULL,
  
  pattern_type VARCHAR(100) NOT NULL, -- 'opex_per_unit', 'rent_growth', 'cap_rate', etc.
  pattern_value JSONB, -- { avg: 5200, min: 4800, max: 5800, unit: "$/unit/year" }
  
  source_file_ids INT[], -- Which files contributed to this pattern
  confidence_score DECIMAL(3, 2), -- 0-1
  sample_size INT,
  
  detected_at TIMESTAMP DEFAULT NOW(),
  last_updated TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Template structures learned by Opus
CREATE TABLE IF NOT EXISTS opus_template_structures (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  module_name VARCHAR(50) NOT NULL,
  
  template_name VARCHAR(100), -- "Value-Add Multifamily", "Ground-Up Development"
  property_type VARCHAR(50),
  measurement_unit VARCHAR(20), -- "units" or "sqft"
  
  structure_schema JSONB, -- Complete template structure
  formula_patterns JSONB, -- Extracted formulas
  
  source_file_ids INT[],
  usage_count INT DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_library_user_module ON module_library_files(user_id, module_name);
CREATE INDEX IF NOT EXISTS idx_library_category ON module_library_files(module_name, category);
CREATE INDEX IF NOT EXISTS idx_library_parsing_status ON module_library_files(parsing_status);
CREATE INDEX IF NOT EXISTS idx_patterns_user_module ON opus_learned_patterns(user_id, module_name);
CREATE INDEX IF NOT EXISTS idx_patterns_type ON opus_learned_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_templates_user_module ON opus_template_structures(user_id, module_name);

-- Comments
COMMENT ON TABLE module_library_files IS 'Historical data files uploaded by users for Opus learning';
COMMENT ON TABLE opus_learned_patterns IS 'Patterns extracted by Opus from user''s historical data';
COMMENT ON TABLE opus_template_structures IS 'Template structures learned by Opus from user''s files';

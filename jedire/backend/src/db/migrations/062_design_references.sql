CREATE TABLE IF NOT EXISTS design_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  user_id VARCHAR(255),
  file_name VARCHAR(500) NOT NULL,
  file_path VARCHAR(1000) NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0,
  mime_type VARCHAR(100) NOT NULL,
  category VARCHAR(100) NOT NULL DEFAULT 'general',
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  ai_analysis JSONB,
  thumbnail_path VARCHAR(1000),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_design_references_deal_id ON design_references(deal_id);
CREATE INDEX IF NOT EXISTS idx_design_references_category ON design_references(category);
CREATE INDEX IF NOT EXISTS idx_design_references_user_id ON design_references(user_id);

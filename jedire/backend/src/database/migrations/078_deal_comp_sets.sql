CREATE TABLE IF NOT EXISTS deal_comp_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  comp_property_address TEXT NOT NULL,
  comp_name VARCHAR(255),
  source VARCHAR(50) NOT NULL DEFAULT 'auto',
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  distance_miles NUMERIC(5,2),
  match_score NUMERIC(5,2),
  match_factors JSONB,
  year_built INT,
  stories INT,
  units INT,
  class_code VARCHAR(10),
  avg_rent NUMERIC(10,2),
  occupancy NUMERIC(5,2),
  google_rating NUMERIC(2,1),
  google_review_count INT,
  notes TEXT,
  lat NUMERIC(10,6),
  lng NUMERIC(10,6),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(deal_id, comp_property_address)
);

CREATE INDEX idx_deal_comp_sets_deal_id ON deal_comp_sets(deal_id);
CREATE INDEX idx_deal_comp_sets_status ON deal_comp_sets(status);

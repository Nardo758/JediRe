CREATE TABLE IF NOT EXISTS development_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  is_active BOOLEAN DEFAULT false,
  use_mix JSONB DEFAULT '{"residential_pct":100}'::jsonb,
  avg_unit_size_sf INTEGER DEFAULT 900,
  efficiency_factor DECIMAL(4,2) DEFAULT 0.85,
  max_gba INTEGER,
  max_footprint INTEGER,
  net_leasable_sf INTEGER,
  parking_required INTEGER,
  open_space_sf INTEGER,
  max_stories INTEGER,
  max_units INTEGER,
  applied_far DECIMAL(10,4),
  binding_constraint VARCHAR(50),
  flags JSONB DEFAULT '[]'::jsonb,
  calculated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_development_scenarios_deal_id ON development_scenarios(deal_id);

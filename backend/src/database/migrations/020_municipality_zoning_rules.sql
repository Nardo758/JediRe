CREATE TABLE IF NOT EXISTS municipality_zoning_rules (
  id SERIAL PRIMARY KEY,
  municipality VARCHAR(100) NOT NULL,
  state VARCHAR(2) NOT NULL,
  district_code VARCHAR(50) NOT NULL,
  rules JSONB NOT NULL,
  source_url TEXT,
  last_verified TIMESTAMPTZ DEFAULT NOW(),
  verified_by VARCHAR(50) DEFAULT 'zoning_agent',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(municipality, state, district_code)
);

CREATE INDEX idx_municipality_zoning_rules_lookup ON municipality_zoning_rules(municipality, state, district_code);
CREATE INDEX idx_municipality_zoning_rules_verified ON municipality_zoning_rules(last_verified);

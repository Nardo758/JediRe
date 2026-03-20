CREATE TABLE IF NOT EXISTS deal_traffic_comp_selections (
  id SERIAL PRIMARY KEY,
  deal_id VARCHAR NOT NULL,
  comp_deal_id VARCHAR NOT NULL,
  comp_deal_name VARCHAR,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (deal_id, comp_deal_id)
);

CREATE INDEX IF NOT EXISTS idx_dtcs_deal_id ON deal_traffic_comp_selections (deal_id);

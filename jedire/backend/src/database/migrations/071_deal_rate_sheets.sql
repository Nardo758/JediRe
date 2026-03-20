CREATE TABLE IF NOT EXISTS deal_rate_sheets (
  id SERIAL PRIMARY KEY,
  deal_id VARCHAR(255) NOT NULL,
  lender_name VARCHAR(255),
  as_of_date DATE,
  index_rates JSONB,
  products JSONB,
  raw_file_path VARCHAR(500),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deal_rate_sheets_deal_id ON deal_rate_sheets(deal_id);

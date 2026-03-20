CREATE TABLE IF NOT EXISTS deal_financial_models (
  id SERIAL PRIMARY KEY,
  deal_id VARCHAR(255) NOT NULL,
  model_type VARCHAR(50) NOT NULL DEFAULT 'existing',
  assumptions JSONB NOT NULL DEFAULT '{}',
  results JSONB,
  excel_path VARCHAR(500),
  status VARCHAR(50) DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deal_financial_models_deal_id ON deal_financial_models(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_financial_models_created ON deal_financial_models(created_at DESC);

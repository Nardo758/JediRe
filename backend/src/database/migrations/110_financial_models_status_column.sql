ALTER TABLE financial_models
  ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'draft';

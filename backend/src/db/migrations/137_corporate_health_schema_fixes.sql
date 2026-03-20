ALTER TABLE corporate_health_scores
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS overall_score DECIMAL(5,2);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'corporate_health_scores' AND column_name = 'quarter'
  ) THEN
    ALTER TABLE corporate_health_scores RENAME COLUMN quarter TO fiscal_quarter;
  END IF;
END $$;

DROP INDEX IF EXISTS idx_corporate_health_scores_quarter;
CREATE INDEX IF NOT EXISTS idx_corporate_health_scores_fiscal_quarter ON corporate_health_scores(fiscal_quarter);

ALTER TABLE submarket_corporate_health
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

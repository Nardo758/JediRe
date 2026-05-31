-- Task 1656: Add concession-depth fields and asking_rent to deal_monthly_actuals
-- so portfolio actuals entry can capture full operating picture.

ALTER TABLE deal_monthly_actuals
  ADD COLUMN IF NOT EXISTS asking_rent             NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS months_free_concession  NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS concession_rebate_amount NUMERIC(12,2);

COMMENT ON COLUMN deal_monthly_actuals.asking_rent IS 'Advertised/listed rent before concessions';
COMMENT ON COLUMN deal_monthly_actuals.months_free_concession IS 'Free months granted as a concession (e.g. 1.5)';
COMMENT ON COLUMN deal_monthly_actuals.concession_rebate_amount IS 'Lump-sum rebate portion of concession ($)';

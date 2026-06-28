-- Backfill monthly_credit_cap for existing user_credit_balances rows.
-- provisionUser and updateTier now write this column; this migration
-- covers existing rows that were created before the column was wired.
-- institutional tier (subscription_tier = 'institutional') keeps NULL (unlimited).
UPDATE user_credit_balances
SET monthly_credit_cap = CASE subscription_tier
  WHEN 'scout'    THEN 100
  WHEN 'basic'    THEN 100
  WHEN 'operator' THEN 500
  WHEN 'principal' THEN 2000
  ELSE NULL
END
WHERE monthly_credit_cap IS NULL
  AND subscription_tier IN ('scout', 'basic', 'operator', 'principal');

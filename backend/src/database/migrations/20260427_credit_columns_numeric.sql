-- Migration: credit_columns_numeric
-- Date: 2026-04-27
-- Description: Convert credit balance/usage columns from integer to numeric(14,6)
--   so the analysis pipeline (and bot identity rockeman-bot) can debit fractional
--   credit costs without raising 22P02 invalid_text_representation errors when
--   AI cost computations land on non-integer values (e.g. 0.012345 credits).
--   Idempotent — only alters columns whose current type is integer.

DO $$
BEGIN
  -- user_credit_balances: 4 columns
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'user_credit_balances'
               AND column_name = 'credits_remaining'
               AND data_type = 'integer') THEN
    ALTER TABLE user_credit_balances
      ALTER COLUMN credits_remaining TYPE NUMERIC(14,6) USING credits_remaining::NUMERIC(14,6);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'user_credit_balances'
               AND column_name = 'credits_used_this_period'
               AND data_type = 'integer') THEN
    ALTER TABLE user_credit_balances
      ALTER COLUMN credits_used_this_period TYPE NUMERIC(14,6) USING credits_used_this_period::NUMERIC(14,6);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'user_credit_balances'
               AND column_name = 'credits_included_monthly'
               AND data_type = 'integer') THEN
    ALTER TABLE user_credit_balances
      ALTER COLUMN credits_included_monthly TYPE NUMERIC(14,6) USING credits_included_monthly::NUMERIC(14,6);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'user_credit_balances'
               AND column_name = 'monthly_credit_cap'
               AND data_type = 'integer') THEN
    ALTER TABLE user_credit_balances
      ALTER COLUMN monthly_credit_cap TYPE NUMERIC(14,6) USING monthly_credit_cap::NUMERIC(14,6);
  END IF;

  -- ai_usage_log: 1 column
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'ai_usage_log'
               AND column_name = 'credits_consumed'
               AND data_type = 'integer') THEN
    ALTER TABLE ai_usage_log
      ALTER COLUMN credits_consumed TYPE NUMERIC(14,6) USING credits_consumed::NUMERIC(14,6);
  END IF;
END $$;

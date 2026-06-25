-- Migration: Add billable_usd to ai_usage_log
-- Date: 2026-06-24
-- Description: Add billable_usd column so the platform can track both
--   raw AI cost (cost_usd) and what the user actually pays (billable_usd).
--   The difference is the platform margin. Required for accurate unit
--   economics and Stripe usage-based billing with markup.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_usage_log'
      AND column_name = 'billable_usd'
  ) THEN
    ALTER TABLE ai_usage_log
      ADD COLUMN billable_usd NUMERIC(14,6) DEFAULT 0;
  END IF;
END $$;

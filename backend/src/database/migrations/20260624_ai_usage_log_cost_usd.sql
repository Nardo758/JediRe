-- Migration: Add cost_usd to ai_usage_log
-- Date: 2026-06-24
-- Description: Add a cost_usd column so the platform can track actual AI spend
--   separately from user-facing credits_consumed. Required for accurate unit
--   economics, daily spend caps, and Stripe-meter reconciliation.
--
-- Rationale (A3-F2):
--   credits_consumed currently stores a union of two units:
--     - JediAIService writes flat integer credits (user-facing)
--     - MeteringAdapter writes actual USD costs (platform-facing)
--   This column separates the two concerns so analytics can sum cost_usd
--   and the user dashboard can show credits_consumed.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_usage_log'
      AND column_name = 'cost_usd'
  ) THEN
    ALTER TABLE ai_usage_log
      ADD COLUMN cost_usd NUMERIC(14,6) DEFAULT 0;
  END IF;
END $$;

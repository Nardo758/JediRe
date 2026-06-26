-- Migration: periodic seed column on deal_assumptions
-- Phase 2 — Periodic Field Model
-- Date: 2026-06-26

-- ═════════════════════════════════════════════════════════════════════════════
-- 1. Add periodic_seed JSONB column to deal_assumptions
--    Stores the full ProFormaPeriodicSeed (period-indexed field series).
--    Backward-compatible: existing year1 column remains the primary read target.
-- ═════════════════════════════════════════════════════════════════════════════
ALTER TABLE deal_assumptions
  ADD COLUMN IF NOT EXISTS periodic_seed JSONB;

COMMENT ON COLUMN deal_assumptions.periodic_seed IS
  'Period-indexed proforma seed (ProFormaPeriodicSeed). One PeriodLayeredValue per field per month. Written alongside year1 by the periodic seeder.';

-- ═════════════════════════════════════════════════════════════════════════════
-- 2. Index for fast periodic seed lookups
-- ═════════════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_deal_assumptions_periodic_seed
  ON deal_assumptions(deal_id)
  WHERE periodic_seed IS NOT NULL;

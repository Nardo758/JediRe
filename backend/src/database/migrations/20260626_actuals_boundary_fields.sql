-- Migration: actuals boundary fields
-- Phase 1 — Boundary Facts for timeline model
-- Date: 2026-06-26

-- ═════════════════════════════════════════════════════════════════════════════
-- 1. Add actuals_through_month to deals table
--    This is the month boundary: periods <= this are actuals, > are projection/gap.
--    Set automatically when a T12 is parsed (to T12-end) or manually by operator.
-- ═════════════════════════════════════════════════════════════════════════════
ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS actuals_through_month DATE;

COMMENT ON COLUMN deals.actuals_through_month IS
  'Last month with real operating actuals. Periods <= this are actuals; periods > are projection/gap. Set from T12-end or manually.';

-- ═════════════════════════════════════════════════════════════════════════════
-- 2. Safety: ensure acquisition_date exists (already added by 20260715_deal_status_enum.sql)
-- ═════════════════════════════════════════════════════════════════════════════
ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS acquisition_date DATE;

-- ═════════════════════════════════════════════════════════════════════════════
-- 3. Backfill actuals_through_month for deals with existing T12 extraction
--    Set to the T12 period_end if available, otherwise leave NULL.
--    This is idempotent — safe to re-run.
-- ═════════════════════════════════════════════════════════════════════════════
UPDATE deals d
SET actuals_through_month = (d.deal_data->'extraction_t12'->>'period_end')::date
WHERE d.actuals_through_month IS NULL
  AND d.deal_data ? 'extraction_t12'
  AND d.deal_data->'extraction_t12'->>'period_end' IS NOT NULL;

-- ═════════════════════════════════════════════════════════════════════════════
-- 4. Index for fast boundary queries (deals needing projection vs actuals lookup)
-- ═════════════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_deals_actuals_through_month
  ON deals(actuals_through_month)
  WHERE actuals_through_month IS NOT NULL;

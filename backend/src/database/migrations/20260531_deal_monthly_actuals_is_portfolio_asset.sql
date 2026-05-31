-- Task 1669: Deduplicate owned portfolio identification
--
-- Problem: two parallel mechanisms existed for marking owned portfolio assets:
--   1. deal_monthly_actuals with deal_id IS NULL (de facto, used by agent tooling)
--   2. property_operating_data.is_owned BOOLEAN (schema-defined, 0 rows populated, unused)
--
-- Resolution (Option A): make the convention in deal_monthly_actuals explicit by adding
-- is_portfolio_asset BOOLEAN. Backfill the 3 known portfolio properties. Update agent
-- tools to filter on is_portfolio_asset = TRUE instead of implicit deal_id IS NULL.
-- property_operating_data.is_owned is deprecated in-place (column retained, 0 rows, never written).
--
-- Safe to re-run: all statements are idempotent.

-- ── Step 1: Add is_portfolio_asset column ────────────────────────────────────

ALTER TABLE deal_monthly_actuals
  ADD COLUMN IF NOT EXISTS is_portfolio_asset BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN deal_monthly_actuals.is_portfolio_asset IS
  'TRUE = this row belongs to an operator-owned portfolio asset (Tier 2 evidence source). '
  'Supersedes the implicit deal_id IS NULL convention. '
  'Owned portfolio rows should have deal_id IS NULL AND is_portfolio_asset = TRUE. '
  'Added Task 1669 (2026-05-31). See property_operating_data.is_owned which is deprecated '
  'in favour of this flag.';

-- ── Step 2: Create partial index for fast portfolio scans ─────────────────────

CREATE INDEX IF NOT EXISTS idx_dma_portfolio_asset
  ON deal_monthly_actuals(property_id, report_month)
  WHERE is_portfolio_asset = TRUE;

-- ── Step 3: Backfill the 3 known owned portfolio properties ──────────────────
--
-- These are the only rows in deal_monthly_actuals with deal_id IS NULL
-- that represent operator-owned assets (verified by live query 2026-05-31):
--
--   a1000001-0000-0000-0000-000000000001  — 4800 Spring Creek Pkwy, Frisco TX    (18 months, source=manual)
--   a1000001-0000-0000-0000-000000000002  — 1200 Eldorado Pkwy, McKinney TX      (18 months, source=manual)
--   7ea31caf-f070-43eb-9fd1-fe08f7123701  — 2789 Satellite Blvd, Duluth GA 30096 (13 months, source=yardi)

UPDATE deal_monthly_actuals
SET is_portfolio_asset = TRUE
WHERE property_id IN (
  'a1000001-0000-0000-0000-000000000001'::uuid,
  'a1000001-0000-0000-0000-000000000002'::uuid,
  '7ea31caf-f070-43eb-9fd1-fe08f7123701'::uuid
)
AND is_portfolio_asset = FALSE;

-- ── Step 4: Deprecation notice on property_operating_data.is_owned ───────────
--
-- The is_owned column on property_operating_data was added in Phase 1 (Task migration
-- 20260529_phase1_property_entity_schema.sql) but was never populated (0 rows).
-- It is now superseded by deal_monthly_actuals.is_portfolio_asset.
-- The column is retained to avoid a destructive migration; do not write new rows here.

COMMENT ON COLUMN property_operating_data.is_owned IS
  'DEPRECATED (Task 1669, 2026-05-31): was intended to flag operator-owned portfolio rows '
  'but was never populated (0 rows with is_owned=TRUE as of audit date). '
  'Superseded by deal_monthly_actuals.is_portfolio_asset = TRUE, which is the canonical '
  'owned-portfolio flag used by agent tooling. '
  'Column retained to avoid destructive migration; do not write new rows here.';

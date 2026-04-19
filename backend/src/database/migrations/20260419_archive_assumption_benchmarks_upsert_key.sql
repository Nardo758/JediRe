-- Migration: archive_assumption_benchmarks_upsert_key
-- Date: 2026-04-19 (supplement to 20260419_archive_assumption_benchmarks.sql)
-- Description: Add expression-based unique index on the natural bucket key so
--              the nightly aggregation can safely use INSERT ... ON CONFLICT DO UPDATE.
--
-- NULLable columns (submarket_id, vintage_band, strategy) are handled with
-- COALESCE so that NULL values participate in uniqueness correctly.
-- This is compatible with the ON CONFLICT expression used in the Inngest function.

CREATE UNIQUE INDEX IF NOT EXISTS idx_archive_benchmarks_upsert_key
  ON archive_assumption_benchmarks (
    asset_class,
    deal_type,
    COALESCE(submarket_id, ''),
    COALESCE(vintage_band, ''),
    COALESCE(strategy, ''),
    assumption_name,
    as_of
  );

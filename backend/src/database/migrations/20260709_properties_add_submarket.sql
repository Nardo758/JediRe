-- Fix owned portfolio submarket matching (T-PFC-1 / Fix A)
--
-- The `fetch_owned_asset_actuals` tool hard-coded `NULL::text AS submarket`
-- because `properties` had no `submarket` column. This caused every portfolio
-- property to score 0 on the 40-pt submarket-match dimension regardless of
-- geography — a DFW Texas property scored the same as a same-submarket comp
-- when the CashFlow Agent provided a submarket filter.
--
-- This migration adds the column and backfills it from the `submarkets` table
-- where a `submarket_id` FK is already stored on the row.
--
-- Rows with no matching submarket record (or no submarket_id) keep NULL, which
-- is the correct graceful-degradation behaviour: the tool treats NULL as
-- "submarket unknown" and awards 0 pts on that dimension, same as today but
-- now explicit rather than silent.

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS submarket VARCHAR(100);

-- Backfill from the existing submarket_id → submarkets.name join.
-- Safe to re-run: only touches rows where submarket IS NULL and submarket_id
-- resolves to a name in the submarkets table.
UPDATE properties p
SET submarket = s.name
FROM submarkets s
WHERE p.submarket_id IS NOT NULL
  AND p.submarket_id != ''
  AND s.id::text = p.submarket_id
  AND p.submarket IS NULL;

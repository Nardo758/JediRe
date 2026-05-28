-- Migration: recorder_to_market_sale_comps
-- Date: 2026-05-28
-- Task: #1382
-- Description:
--   1. Creates vw_recorded_transactions_compat compatibility view (spec §5.3) so any
--      legacy reads of recorded_transactions continue to work during the migration window.
--   2. The one-time data back-fill is handled by the companion TypeScript script
--      backend/src/scripts/migrate-recorder-to-market-sale-comps.ts — run that script
--      after applying this migration to move existing rows.

-- ─────────────────────────────────────────────────────────────────────────────
-- Compatibility view: recorded_transactions → market_sale_comps shape
-- (per comp-profiles-spec.md §5.3)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW vw_recorded_transactions_compat AS
SELECT
  gen_random_uuid()           AS id,
  NULL::text                  AS property_name,
  property_address            AS address,
  city                        AS city,
  state_code                  AS state,
  NULL::text                  AS zip,
  NULL::text                  AS county,
  NULL::text                  AS msa,
  NULL::text                  AS submarket,
  'multifamily'               AS property_type,
  units                       AS units,
  NULL::integer               AS sqft,
  NULL::integer               AS year_built,
  NULL::text                  AS asset_class,
  NULL::integer               AS stories,
  recording_date              AS sale_date,
  derived_sale_price          AS sale_price,
  price_per_unit              AS price_per_unit,
  NULL::numeric               AS price_per_sqft,
  implied_cap_rate            AS cap_rate,
  buyer_name                  AS buyer,
  seller_name                 AS seller,
  'county_recorded'           AS source,
  NULL::text                  AS source_id,
  NULL::numeric               AS latitude,
  NULL::numeric               AS longitude,
  true                        AS qualified
FROM recorded_transactions;

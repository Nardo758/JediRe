-- Task #1476: Add unit_mix JSONB to market_sale_comps and property_info_cache
-- unit_mix stores per-bedroom-type breakdown: { "1BR": 40, "2BR": 60 }
-- Safe to run multiple times (idempotent via IF NOT EXISTS).

ALTER TABLE market_sale_comps
  ADD COLUMN IF NOT EXISTS unit_mix JSONB;

ALTER TABLE property_info_cache
  ADD COLUMN IF NOT EXISTS unit_mix JSONB;

COMMENT ON COLUMN market_sale_comps.unit_mix IS
  'Per-bedroom-type unit breakdown, e.g. {"Studio":10,"1BR":40,"2BR":50}. '
  'Populated from county assessor data or OM extraction where available.';

COMMENT ON COLUMN property_info_cache.unit_mix IS
  'Per-bedroom-type unit breakdown from assessor or permit data.';

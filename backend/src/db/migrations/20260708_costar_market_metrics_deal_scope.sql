-- Migration: costar_market_metrics deal scoping (CoStar redistribution firewall, I1)
-- Purpose: costar_market_metrics rows are licensed CoStar-derived data written per
--          uploading deal (data-router.ts writes geography_id = dealId), but
--          correlationEngine.service.ts reads this table by
--          `LOWER(geography_name) LIKE LOWER('%city%')` — a human-readable
--          submarket label shared by every deal in that city. That means any
--          deal's CoStar upload becomes visible to correlation queries for
--          OTHER deals (or anonymous city-level queries) in the same city.
--          This migration adds first-class `deal_id` + `is_restricted` columns
--          so the read path (correlationEngine.service.ts) can scope licensed
--          rows to their owning deal instead of matching by city name alone —
--          "scope, don't strip", matching the market_sale_comps treatment.
--
-- Backfill: geography_id currently holds the owning dealId for every
--           costar_extraction row (see data-router.ts routeCoStarSubmarket).
--           deal_id is backfilled from geography_id for those rows.

ALTER TABLE costar_market_metrics
  ADD COLUMN IF NOT EXISTS deal_id uuid,
  ADD COLUMN IF NOT EXISTS is_restricted boolean NOT NULL DEFAULT FALSE;

UPDATE costar_market_metrics
SET deal_id = geography_id::uuid,
    is_restricted = TRUE
WHERE source = 'costar_extraction'
  AND deal_id IS NULL
  AND geography_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

CREATE INDEX IF NOT EXISTS idx_costar_market_metrics_deal_id
  ON costar_market_metrics (deal_id);

COMMENT ON COLUMN costar_market_metrics.deal_id IS
  'Owning deal for licensed (is_restricted=TRUE) rows. NULL for non-deal-scoped/global rows. '
  'Read paths must filter is_restricted rows to deal_id = the querying deal, never surface them city-wide.';
COMMENT ON COLUMN costar_market_metrics.is_restricted IS
  'TRUE for CoStar-licensed rows that may only be read by their owning deal_id. '
  'FALSE (default) for any future non-licensed/global geography data.';

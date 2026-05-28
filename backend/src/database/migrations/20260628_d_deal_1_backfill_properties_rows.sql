-- D-DEAL-1 Backfill (Task #1405 / Wave A)
--
-- Creates or links a properties row for every deal that does not already have
-- one, so the Valuation Grid join `properties p ON p.deal_id = d.id` returns
-- a subject record for all deals (not only 464 Bishop which was manually seeded
-- via 20260622_seed_464_bishop_property.sql).
--
-- TWO-STEP APPROACH (required because properties.address_line1 has a unique index):
--
-- Step 1 — UPDATE existing properties rows whose address_line1 matches the deal's
--           address but whose deal_id is still NULL.  26 of 28 orphaned deals
--           fall into this category.
--
-- Step 2 — INSERT stub rows (address_line1 = NULL) for the remaining deals that
--           have no matching properties row at all.  7 deals fall into this category.
--
-- Fields populated from deals columns:
--   deal_id           → deals.id
--   address_line1     → deals.address  (Step 1 only; Step 2 uses NULL)
--   units             → deals.target_units
--   acquisition_price → deals.budget
--   lat/lng/latitude/longitude → centroid of deals.boundary (PostGIS)
--   created_by        → deals.user_id
--   ownership_status  → 'pipeline' (stub value)
--
-- Enrichment pipeline fills in city, state, building_class, submarket_id,
-- msa_id, and other fields asynchronously.
--
-- Forward path for new deals: inline-deals.routes.ts POST / now creates a
-- linked properties row transactionally at deal creation time (D-DEAL-1 fix).
--
-- Safe to re-run: both steps use NOT EXISTS / IS NULL guards.

-- ── Step 1: Link by address match ─────────────────────────────────────────

UPDATE properties p
SET deal_id           = d.id,
    units             = COALESCE(p.units, d.target_units),
    acquisition_price = COALESCE(
                          p.acquisition_price,
                          CASE WHEN d.budget > 0 THEN d.budget ELSE NULL END
                        ),
    updated_at        = NOW()
FROM deals d
WHERE p.address_line1 = d.address
  AND p.deal_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM properties p2 WHERE p2.deal_id = d.id);

-- ── Step 2: Insert stub rows for remaining orphaned deals ─────────────────

INSERT INTO properties (
  deal_id, address_line1, units, acquisition_price,
  lat, lng, latitude, longitude, created_by, ownership_status
)
SELECT
  d.id,
  NULL,   -- address omitted to avoid unique constraint clash; enrichment fills it in
  d.target_units,
  CASE WHEN d.budget IS NOT NULL AND d.budget > 0 THEN d.budget ELSE NULL END,
  CASE WHEN d.boundary IS NOT NULL THEN ST_Y(ST_Centroid(d.boundary)) ELSE NULL END,
  CASE WHEN d.boundary IS NOT NULL THEN ST_X(ST_Centroid(d.boundary)) ELSE NULL END,
  CASE WHEN d.boundary IS NOT NULL THEN ST_Y(ST_Centroid(d.boundary)) ELSE NULL END,
  CASE WHEN d.boundary IS NOT NULL THEN ST_X(ST_Centroid(d.boundary)) ELSE NULL END,
  d.user_id,
  'pipeline'
FROM deals d
WHERE NOT EXISTS (
  SELECT 1 FROM properties p WHERE p.deal_id = d.id
);

-- ── Verification ──────────────────────────────────────────────────────────

DO $$
DECLARE
  total_deals        INT;
  linked_properties  INT;
  still_orphaned     INT;
BEGIN
  SELECT COUNT(*) INTO total_deals FROM deals;
  SELECT COUNT(*) INTO linked_properties FROM properties WHERE deal_id IS NOT NULL;
  SELECT COUNT(*) INTO still_orphaned
    FROM deals d WHERE NOT EXISTS (SELECT 1 FROM properties p WHERE p.deal_id = d.id);
  RAISE NOTICE 'D-DEAL-1 backfill: %/% deals linked. % still orphaned.',
    linked_properties, total_deals, still_orphaned;
  IF still_orphaned > 0 THEN
    RAISE WARNING 'D-DEAL-1: % deals still have no properties row — investigate manually.', still_orphaned;
  END IF;
END $$;

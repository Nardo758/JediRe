-- SELECT ONLY. This file has no INSERT, UPDATE, DELETE, or DDL.
-- It is not executed by the application, by CI, or by this change.
-- It does not create deals. It only lists the property records that would
-- become closed-owned deals under the ruling below.
--
-- Ruling: an owned asset that exists only as a property record, with no
-- pipeline deal and no capsule, converts to a closed-owned deal. Closed-owned
-- is the portfolio performance set already used by GET /api/v1/portfolio/performance:
-- deals.status IN ('owned', 'closed', 'portfolio') OR deals.deal_category = 'portfolio'.
-- A pipeline deal is everything else (inline deal create defaults deal_category
-- to 'pipeline').
--
-- Inclusion (owned property, not the public market corpus):
--   properties.ownership_status = 'portfolio'
--   OR a deal_monthly_actuals row for that property has is_portfolio_asset = TRUE.
--   This is the same owned-asset test as GET /api/v1/portfolio/assets.
--   POST /api/v1/portfolio/assets inserts properties with ownership_status
--   'portfolio' and does not insert a deals row.
--   D-DEAL-1 stubs copied from deals use ownership_status 'pipeline' and a
--   properties.deal_id, so they fail this test unless they also have portfolio
--   actuals, and the deal-link test below still excludes them.
--   Superseded property rows (is_superseded) are omitted.
--
-- Exclusion (not "property only"):
--   Any linked deal, pipeline or already closed-owned:
--     properties.deal_id
--     deals.property_id
--     deal_properties
--   Any capsule for such a deal. Capsules are deal-scoped: the API stores the
--   deal id in deal_capsules.deal_data->>'deal_id'. The 20260619 snapshot
--   migration also has deal_capsules.deal_id; both are checked.
--
-- Org is the creator's users.default_org_id (organizations.id / name).
-- properties has no org column. A property with no created_by has a null org.
-- Columns: id, name, address, org_id, org_name, creator_id, created_at.

SELECT
  p.id,
  p.name,
  CONCAT_WS(', ', NULLIF(p.address_line1, ''), NULLIF(p.city, ''), NULLIF(p.state_code, '')) AS address,
  u.default_org_id AS org_id,
  o.name AS org_name,
  p.created_by::text AS creator_id,
  p.created_at
FROM properties p
LEFT JOIN users u ON u.id::text = p.created_by::text
LEFT JOIN organizations o ON o.id = u.default_org_id
WHERE COALESCE(p.is_superseded, FALSE) = FALSE
  AND (
    p.ownership_status = 'portfolio'
    OR EXISTS (
      SELECT 1
      FROM deal_monthly_actuals dma
      WHERE dma.property_id = p.id
        AND dma.is_portfolio_asset = TRUE
    )
  )
  AND p.deal_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM deals d WHERE d.property_id = p.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM deal_properties dp WHERE dp.property_id = p.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM deal_capsules dc
    WHERE dc.deal_data->>'property_id' = p.id::text
       OR dc.deal_data->>'deal_id' IN (
         SELECT d.id::text FROM deals d WHERE d.property_id = p.id
         UNION
         SELECT dp.deal_id::text FROM deal_properties dp WHERE dp.property_id = p.id
       )
  )
ORDER BY p.created_at NULLS LAST, p.name, p.id;

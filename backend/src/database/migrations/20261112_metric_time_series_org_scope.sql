-- Private owner metrics written by the portfolio sync must not default to
-- the redistributable GLOBAL scope. org_id is the read-side scope key.

ALTER TABLE metric_time_series
  ADD COLUMN IF NOT EXISTS org_id UUID;

CREATE INDEX IF NOT EXISTS idx_mts_org_id
  ON metric_time_series (org_id)
  WHERE org_id IS NOT NULL;

-- Re-tag property-level portfolio actuals only when a single org owns them.
WITH owners AS (
  SELECT dma.property_id::text AS property_id, d.org_id
  FROM deal_monthly_actuals dma
  JOIN deals d ON d.id = dma.deal_id
  WHERE dma.is_portfolio_asset IS TRUE
    AND d.org_id IS NOT NULL
  GROUP BY dma.property_id, d.org_id
),
unique_owners AS (
  SELECT property_id, MIN(org_id::text)::uuid AS org_id
  FROM owners
  GROUP BY property_id
  HAVING COUNT(*) = 1
)
UPDATE metric_time_series m
SET org_id = u.org_id,
    scope_id = 'org:' || u.org_id::text
FROM unique_owners u
WHERE m.source = 'portfolio_actuals'
  AND m.geography_type = 'property'
  AND m.geography_id = u.property_id
  AND COALESCE(m.scope_id, 'GLOBAL') = 'GLOBAL';

/**
 * Who may read a metric_time_series row.
 *
 * Public market series (FRED, Census, Zillow, DOT, and other GLOBAL rows that
 * are not owner or licensed-vendor data) stay readable by any signed-in org.
 * They are published statistical series and the Time Series Explorer is built
 * to browse them. They are not anonymous.
 *
 * Owned-asset and private rows (portfolio actuals, lease operating metrics,
 * org-scoped rows, deal-scoped or redistribution-restricted rows) are visible
 * only to the caller's org.
 */

export interface SeriesVisibilityRow {
  scope_id?: string | null;
  redistribution_restricted?: boolean | null;
  org_id?: string | null;
  deal_id?: string | null;
  source?: string | null;
  metric_id?: string | null;
  deal_org_id?: string | null;
}

const PRIVATE_SOURCES = new Set(['portfolio_actuals', 'lease_transactions']);

export function isPublicMarketSeries(row: SeriesVisibilityRow): boolean {
  const scope = row.scope_id ?? 'GLOBAL';
  if (scope !== 'GLOBAL') return false;
  if (row.redistribution_restricted === true) return false;
  if (row.org_id) return false;
  if (row.deal_id) return false;
  const source = (row.source ?? '').toLowerCase();
  if (PRIVATE_SOURCES.has(source)) return false;
  if (source.includes('costar') || source.includes('portfolio')) return false;
  const metric = row.metric_id ?? '';
  if (metric.startsWith('PORT_') || metric.startsWith('OP_')) return false;
  return true;
}

export function isCallerPrivateSeries(row: SeriesVisibilityRow, orgId: string | null): boolean {
  if (!orgId) return false;
  if (row.org_id && row.org_id === orgId) return true;
  if (row.scope_id === `org:${orgId}`) return true;
  if (row.deal_org_id && row.deal_org_id === orgId) return true;
  return false;
}

export function isSeriesVisibleToOrg(row: SeriesVisibilityRow, orgId: string | null): boolean {
  return isPublicMarketSeries(row) || isCallerPrivateSeries(row, orgId);
}

/**
 * SQL fragment matching isSeriesVisibleToOrg. Caller appends it to a WHERE.
 * `$orgParam` is a uuid or NULL when the caller has no org.
 */
export function seriesVisibilitySql(orgParam: string): string {
  return `(
    (
      COALESCE(scope_id, 'GLOBAL') = 'GLOBAL'
      AND COALESCE(redistribution_restricted, FALSE) = FALSE
      AND org_id IS NULL
      AND deal_id IS NULL
      AND LOWER(COALESCE(source, '')) NOT IN ('portfolio_actuals', 'lease_transactions')
      AND LOWER(COALESCE(source, '')) NOT LIKE '%costar%'
      AND LOWER(COALESCE(source, '')) NOT LIKE '%portfolio%'
      AND metric_id NOT LIKE 'PORT\\_%' ESCAPE '\\'
      AND metric_id NOT LIKE 'OP\\_%' ESCAPE '\\'
    )
    OR (
      ${orgParam}::uuid IS NOT NULL
      AND (
        org_id = ${orgParam}::uuid
        OR scope_id = ('org:' || ${orgParam}::text)
        OR deal_id IN (SELECT id FROM deals WHERE org_id = ${orgParam}::uuid)
      )
    )
  )`;
}

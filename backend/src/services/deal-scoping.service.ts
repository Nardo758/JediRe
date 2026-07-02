/**
 * B4a: Deal org-scoping service (Option A — shared helper)
 *
 * EVERY deal read in the API layer MUST go through one of these helpers:
 *   - assertDealOrgAccess  — BY-ID gate; returns null if caller cannot see the deal
 *   - dealListWhereClause  — LIST gate; returns the WHERE clause fragment + params
 *
 * Both resolve the caller's active org via resolveOrgForUser (the SAME path
 * the B3 entitlement gate uses — one org identity for deals AND credits).
 *
 * Escape hatch: admin callers pass { isAdmin: true } to bypass the org filter.
 * Every bypass is explicit, named, and auditable. It is NOT the default.
 *
 * Coverage guard: backend/scripts/check-deal-access-guard.sh
 */

import { resolveOrgForUser } from './ai/orgCreditService';

export { resolveOrgForUser as getCallerOrgId };

type DB = { query: (text: string, values?: any[]) => Promise<{ rows: any[] }> };

/**
 * Resolve the caller's active org.
 * Thin wrapper so every deal-read site has one import point.
 */
export async function resolveCallerOrg(userId: string): Promise<string | null> {
  return resolveOrgForUser(userId);
}

/**
 * BY-ID gate.
 *
 * Fetches the deal and verifies the caller belongs to its org (or is the
 * legacy creator when org_id is NULL). Returns the full deal row on success;
 * returns null on failure (caller should respond 404 to avoid leaking existence).
 *
 * @param dealId   - UUID of the deal to fetch
 * @param userId   - authenticated caller's user ID
 * @param db       - pool / client / query-capable object
 * @param opts.isAdmin - bypass org check (admin routes only)
 * @param opts.orgId   - pre-resolved org (avoids a second DB hit when the
 *                        caller already called resolveCallerOrg)
 */
export async function assertDealOrgAccess(
  dealId: string,
  userId: string,
  db: DB,
  opts: { isAdmin?: boolean; orgId?: string | null } = {}
): Promise<Record<string, any> | null> {
  if (!dealId) return null;

  const row = await db.query(
    `SELECT * FROM deals WHERE id = $1`,
    [dealId]
  );

  if (!row.rows.length) return null;

  const deal = row.rows[0];

  if (opts.isAdmin) return deal;

  const callerOrg = opts.orgId !== undefined ? opts.orgId : await resolveCallerOrg(userId);

  const orgMatch   = !!(deal.org_id && callerOrg && deal.org_id === callerOrg);
  const ownerMatch = !deal.org_id && deal.user_id === userId;

  if (!orgMatch && !ownerMatch) return null;

  return deal;
}

/**
 * LIST gate.
 *
 * Returns a SQL WHERE clause fragment and its params for scoping a deal-list
 * query to the caller's org.  Caller splices in the fragment and appends the
 * params to their existing param array.
 *
 * Usage:
 *   const org = await resolveCallerOrg(userId);
 *   const { clause, params } = dealListWhereClause('d', org, userId, isAdmin);
 *   const result = await db.query(
 *     `SELECT ... FROM deals d WHERE ${clause} AND d.archived_at IS NULL`,
 *     params
 *   );
 *
 * @param alias   - SQL table alias for the deals table (e.g. 'd')
 * @param orgId   - caller's active org (from resolveCallerOrg)
 * @param userId  - authenticated caller's user ID
 * @param isAdmin - bypass org filter (admin routes only)
 * @param startAt - 1-based index for the first $N placeholder
 */
export function dealListWhereClause(
  alias: string,
  orgId: string | null,
  userId: string,
  isAdmin: boolean,
  startAt = 1
): { clause: string; params: string[] } {
  if (isAdmin) return { clause: 'TRUE', params: [] };

  if (orgId) {
    // Primary: deals owned by the caller's org
    // Fallback: legacy deals with no org_id, owned by the caller (migration safety)
    return {
      clause: `(${alias}.org_id = $${startAt} OR (${alias}.org_id IS NULL AND ${alias}.user_id = $${startAt + 1}))`,
      params: [orgId, userId],
    };
  }

  // User has no org — fall back to user_id scope (scout / bridge users)
  return {
    clause: `${alias}.user_id = $${startAt}`,
    params: [userId],
  };
}

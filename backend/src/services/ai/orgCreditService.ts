/**
 * OrgCreditService — B2a org-level credit pool operations.
 *
 * Moves entitlement from per-USER to per-ORG: an org has ONE shared credit pool,
 * any member draws from it, the gate reads/decrements the ORG balance, and every
 * usage row records which member spent it (attribution baked in, not bolted on).
 *
 * Resolution path: user_id → org_members.org_id → org_credit_balances
 * Same path for org-of-one (solo tiers) and org-of-many (Institutional).
 */

import { query } from '../../database/connection';
import { logger } from '../../utils/logger';
import { TIER_CONFIG } from './creditService';
import type { SubscriptionTier } from '../../types/dealContext';

/**
 * Resolve a user's org_id via org_members.
 *
 * // SINGLE-ORG ASSUMPTION: LIMIT 1 is safe only while users belong to exactly one org.
 * // When B2b enables multi-org membership, this must resolve an EXPLICIT active-org,
 * // not LIMIT 1.
 *
 * Returns null for users with no org row (bridge users pre-B2b, bot fixtures).
 * Callers treat null as "no pool — allow through" (same as "no credit record" today).
 */
export async function resolveOrgForUser(userId: string): Promise<string | null> {
  if (!userId) return null;
  try {
    // B2b: deterministic resolution via users.default_org_id.
    // Resolution order: session_active_org_id (future switcher, not yet populated) ??
    //   users.default_org_id (set at signup / bridge / invite-accept) ??
    //   org_members LIMIT 1 fallback (warns — means a creation path missed setting default_org_id).
    const userResult = await query(
      `SELECT default_org_id FROM users WHERE id = $1`,
      [userId]
    );
    if (userResult.rows.length > 0 && userResult.rows[0].default_org_id) {
      return userResult.rows[0].default_org_id as string;
    }

    // Fallback: LIMIT 1 on org_members for users whose default_org_id was not set by a
    // creation path. This MUST NOT fire silently — a real user hitting this in production
    // means signup/bridge/accept-invite failed to write default_org_id. Log a warning.
    const fallbackResult = await query(
      `SELECT org_id FROM org_members WHERE user_id = $1 LIMIT 1`,
      [userId]
    );
    if (fallbackResult.rows.length > 0) {
      logger.warn('resolveOrgForUser: LIMIT 1 fallback fired — default_org_id missing', {
        userId,
        resolvedTo: fallbackResult.rows[0].org_id,
      });
      return fallbackResult.rows[0].org_id as string;
    }
    return null;
  } catch (err: any) {
    if (err?.message?.includes?.('invalid input syntax for type uuid')) {
      return null;
    }
    logger.warn('resolveOrgForUser: lookup failed', { userId, err: err?.message });
    return null;
  }
}

/**
 * Provision an org-level credit pool (called on org creation or subscription provisioning).
 * Seeds the pool at the tier's included monthly allotment with a fresh cycle window.
 * Safe to call idempotently: ON CONFLICT (org_id) DO UPDATE ensures the pool reflects
 * the latest provisioning (e.g. after a tier upgrade on a new subscription).
 */
export async function provisionOrgPool(orgId: string, tier: SubscriptionTier): Promise<void> {
  const config = TIER_CONFIG[tier];
  const cap = config.creditsIncludedMonthly > 0 ? config.creditsIncludedMonthly : null;
  const periodStart = new Date();
  const periodEnd = new Date();
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  await query(
    `INSERT INTO org_credit_balances (
       org_id, subscription_tier, credits_included_monthly,
       credits_remaining, credits_used_this_period, monthly_credit_cap,
       period_start, period_end, updated_at
     ) VALUES ($1, $2, $3, $4, 0, $5, $6, $7, NOW())
     ON CONFLICT (org_id) DO UPDATE SET
       subscription_tier        = EXCLUDED.subscription_tier,
       credits_included_monthly = EXCLUDED.credits_included_monthly,
       credits_remaining        = EXCLUDED.credits_remaining,
       monthly_credit_cap       = EXCLUDED.monthly_credit_cap,
       period_start             = EXCLUDED.period_start,
       period_end               = EXCLUDED.period_end,
       updated_at               = NOW()`,
    [
      orgId, tier, config.creditsIncludedMonthly, config.creditsIncludedMonthly,
      cap, periodStart.toISOString(), periodEnd.toISOString(),
    ]
  );

  logger.info('OrgCreditService: org pool provisioned', {
    orgId, tier, allotment: config.creditsIncludedMonthly,
  });
}

/**
 * Atomically reserve credits from the org pool (pre-call reservation for agent-run path).
 *
 * Returns true if credits were deducted (reservation succeeded).
 * Returns false if no pool record exists or the user is in overage (call proceeds, no deduction).
 * Throws if the org is hard-blocked (credits_remaining <= 0 AND monthly_credit_cap IS NOT NULL).
 *
 * The WHERE guard (AND credits_remaining >= $1) prevents concurrent oversubscription:
 * if another request drained the balance between our SELECT and this UPDATE, 0 rows
 * are returned and we treat the caller as overage rather than double-spending.
 */
export async function reserveOrgCredits(orgId: string, estimatedCost: number): Promise<boolean> {
  const selectResult = await query(
    `SELECT credits_remaining, monthly_credit_cap FROM org_credit_balances WHERE org_id = $1`,
    [orgId]
  );

  if (selectResult.rows.length === 0) {
    logger.warn('reserveOrgCredits: no pool record for org, allowing through', { orgId });
    return false;
  }

  const { credits_remaining, monthly_credit_cap } = selectResult.rows[0];

  if (credits_remaining <= 0 && monthly_credit_cap !== null) {
    throw new Error(
      `Insufficient credits: ${credits_remaining} remaining, ${estimatedCost.toFixed(4)} estimated`
    );
  }

  if (credits_remaining < estimatedCost) {
    logger.info('reserveOrgCredits: org in overage, proceeding (no deduction)', {
      orgId, remaining: credits_remaining, estimated: estimatedCost,
    });
    return false;
  }

  const updateResult = await query(
    `UPDATE org_credit_balances
     SET credits_remaining        = credits_remaining - $1,
         credits_used_this_period = credits_used_this_period + $1,
         updated_at               = NOW()
     WHERE org_id = $2
       AND credits_remaining >= $1
     RETURNING credits_remaining`,
    [estimatedCost, orgId]
  );

  if (updateResult.rows.length === 0) {
    logger.warn('reserveOrgCredits: concurrent drain detected, proceeding in overage', { orgId });
    return false;
  }

  return true;
}

/**
 * Decrement the org pool by a known amount (post-call, user-triggered skill-chat path).
 * Non-atomic (we have the exact cost after the call returns).
 */
export async function decrementOrgPool(orgId: string, credits: number): Promise<void> {
  if (!orgId || credits === 0) return;
  await query(
    `UPDATE org_credit_balances
     SET credits_remaining        = credits_remaining - $1,
         credits_used_this_period = credits_used_this_period + $1,
         updated_at               = NOW()
     WHERE org_id = $2`,
    [credits, orgId]
  );
}

/**
 * Post-call delta reconciliation for the org pool (agent-run path).
 * Adds back over-reservation if actual < estimate; deducts remainder if actual > estimate.
 */
export async function debitOrgActualCost(
  orgId: string,
  estimatedCost: number,
  actualCost: number
): Promise<void> {
  if (!orgId) return;
  const delta = actualCost - estimatedCost;
  if (Math.abs(delta) < 0.0001) return;
  await query(
    `UPDATE org_credit_balances
     SET credits_remaining        = credits_remaining - $1,
         credits_used_this_period = credits_used_this_period + $1,
         updated_at               = NOW()
     WHERE org_id = $2`,
    [delta, orgId]
  );
}

/**
 * Reset org pool to full tier allotment (cycle reset — called on invoice.paid webhook).
 * Reads the org's current tier from org_credit_balances (authoritative in B2a+).
 */
export async function resetOrgPool(orgId: string): Promise<void> {
  if (!orgId) return;

  const tierResult = await query(
    `SELECT subscription_tier FROM org_credit_balances WHERE org_id = $1`,
    [orgId]
  );
  if (tierResult.rows.length === 0) {
    logger.warn('resetOrgPool: no pool record for org — nothing to reset', { orgId });
    return;
  }

  const tier = (tierResult.rows[0].subscription_tier || 'scout') as SubscriptionTier;
  const config = TIER_CONFIG[tier] ?? TIER_CONFIG['scout'];
  const periodStart = new Date();
  const periodEnd = new Date();
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  await query(
    `UPDATE org_credit_balances
     SET credits_remaining        = $1,
         credits_used_this_period = 0,
         period_start             = $2,
         period_end               = $3,
         updated_at               = NOW()
     WHERE org_id = $4`,
    [config.creditsIncludedMonthly, periodStart.toISOString(), periodEnd.toISOString(), orgId]
  );

  logger.info('OrgCreditService: org pool reset', {
    orgId, tier, allotment: config.creditsIncludedMonthly,
  });
}

/**
 * Update the org pool's tier (called alongside user_credit_balances tier update).
 *
 * Requirement 3 (B2a): subscription_tier is denormalized on BOTH user_credit_balances
 * (per-user, old) and org_credit_balances (per-org, new). Duplication → drift risk.
 * Rule: any tier change MUST write BOTH tables. org_credit_balances is the path toward
 * authoritative (fully authoritative in B3 when billing moves to org level).
 * user_credit_balances.subscription_tier is deprecated-not-dropped in B2a.
 */
export async function updateOrgTier(orgId: string, newTier: SubscriptionTier): Promise<void> {
  if (!orgId) return;
  const config = TIER_CONFIG[newTier];
  const cap = config.creditsIncludedMonthly > 0 ? config.creditsIncludedMonthly : null;

  await query(
    `UPDATE org_credit_balances
     SET subscription_tier        = $1,
         credits_included_monthly = $2,
         monthly_credit_cap       = $3,
         updated_at               = NOW()
     WHERE org_id = $4`,
    [newTier, config.creditsIncludedMonthly, cap, orgId]
  );

  logger.info('OrgCreditService: org tier updated', { orgId, newTier });
}

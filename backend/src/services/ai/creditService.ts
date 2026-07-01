/**
 * Credit Service — Manages user credit balances and billing operations
 *
 * Users see credits, not tokens. Maps operations to flat credit costs
 * and manages the lifecycle of monthly credit grants.
 */

import { query, transaction } from '../../database/connection';
import { logger } from '../../utils/logger';
import type { SubscriptionTier, AutomationLevel } from '../../types/dealContext';
import {
  resolveOrgForUser,
  reserveOrgCredits,
  debitOrgActualCost,
  resetOrgPool,
  updateOrgTier,
} from './orgCreditService';

// ── Tier Configuration ─────────────────────────────────────────

interface TierConfig {
  creditsIncludedMonthly: number;
  overageCostPerCredit: number;
  maxActiveDeals: number;
  maxAutomationLevel: AutomationLevel;
  surfaces: string[];
  aiMarkup: number;
  minCharge: number;
  platformFeePerCall: number;
  monthlyFee: number; // subscription price in USD (e.g., 49, 97, 197)
}

export const TIER_CONFIG: Record<SubscriptionTier, TierConfig> = {
  scout: {
    creditsIncludedMonthly: 100,
    overageCostPerCredit: 0.25,
    maxActiveDeals: 5,
    maxAutomationLevel: 1,
    surfaces: ['chat'],
    aiMarkup: 1.50,        // 50% markup on raw AI cost
    minCharge: 0.005,      // minimum $0.005 per call
    platformFeePerCall: 0.01, // $0.01 flat fee per call
    monthlyFee: 49,      // $49/mo subscription (matches Stripe price_1ToVcRRLkzuKbZa20IiE4N94)
  },
  // A5-F4: 'basic' tier — legacy / pre-launch tier mapped to same config as scout.
  // getAllowedTriggerModes('basic') returns ['manual', 'event-driven'] (dev/testing).
  basic: {
    creditsIncludedMonthly: 100,
    overageCostPerCredit: 0.25,
    maxActiveDeals: 5,
    maxAutomationLevel: 1,
    surfaces: ['chat'],
    aiMarkup: 1.50,
    minCharge: 0.005,
    platformFeePerCall: 0.01,
    monthlyFee: 49,
  },
  operator: {
    creditsIncludedMonthly: 500,
    overageCostPerCredit: 0.15,
    maxActiveDeals: 25,
    maxAutomationLevel: 2,
    surfaces: ['chat', 'web'],
    aiMarkup: 1.35,      // 35% markup
    minCharge: 0.003,
    platformFeePerCall: 0.005, // $0.005 flat fee per call
    monthlyFee: 199,    // $199/mo subscription (matches Stripe price_1ToVcRRLkzuKbZa2KMLUgYP9)
  },
  principal: {
    creditsIncludedMonthly: 2000,
    overageCostPerCredit: 0.10,
    maxActiveDeals: -1, // unlimited
    maxAutomationLevel: 3,
    surfaces: ['chat', 'web', 'api'],
    aiMarkup: 1.20,      // 20% markup
    minCharge: 0.001,
    platformFeePerCall: 0.002, // $0.002 flat fee per call
    monthlyFee: 499,    // $499/mo subscription (matches Stripe price_1ToVcSRLkzuKbZa27g3GXFvB)
  },
  institutional: {
    creditsIncludedMonthly: -1, // custom/negotiated
    overageCostPerCredit: 0, // volume pricing
    maxActiveDeals: -1,
    maxAutomationLevel: 4,
    surfaces: ['chat', 'web', 'api'],
    aiMarkup: 1.00,      // pass-through (no markup) — FLAGGED: zero platform margin on AI cost
    minCharge: 0,
    platformFeePerCall: 0,  // no flat fee (custom pricing)
    monthlyFee: 999,    // $999/mo placeholder (matches Stripe price_1ToVcSRLkzuKbZa20xZtVrdY — TBD)
  },
};

// ── Platform Pricing Engine ────────────────────────────────────

/**
 * A3: Calculate what the user pays (billable) vs. what the platform
 * pays (raw cost). The delta is the platform margin.
 *
 * Formula: billable = (rawCost × markup, floored at minCharge) + platformFeePerCall
 *
 * Two components:
 *   1. Variable: rawCost × aiMarkup (with minCharge floor)
 *   2. Flat: platformFeePerCall (covers fixed per-call overhead: DB write, logging, Stripe API)
 *
 * @param rawCostUsd — actual AI provider cost
 * @param tier — user's subscription tier
 * @returns billable USD (what Stripe charges the user)
 */
export function calculateBillable(rawCostUsd: number, tier: SubscriptionTier): number {
  const config = TIER_CONFIG[tier];
  const variable = Math.max(rawCostUsd * config.aiMarkup, config.minCharge);
  return variable + config.platformFeePerCall;
}

// ── Agent Run Credit Costs (flat credits per event-driven agent invocation) ──
// Scale reference: news.search=1, news.morning_brief=5.
// An operator user (500 cr/mo) gets ~14 full deal analyses/month at these rates.
// A principal user (2000 cr/mo) gets ~57 full deal analyses/month.
export const AGENT_CREDIT_COSTS: Record<string, number> = {
  research:    10,
  cashflow:    10,
  supply:       5,
  zoning:       5,
  commentary:   5,
};
export const DEFAULT_AGENT_CREDIT_COST = 5;

// ── Credit Balance Operations ──────────────────────────────────

export class CreditService {
  /**
   * Get current credit balance for a user.
   */
  async getBalance(userId: string): Promise<CreditBalance | null> {
    let result: any;
    try {
      result = await query(
        `SELECT * FROM user_credit_balances WHERE user_id = $1`,
        [userId]
      );
    } catch (err: any) {
      if (err?.message?.includes?.('invalid input syntax for type uuid')) {
        return null;
      }
      throw err;
    }

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      userId: row.user_id,
      stripeCustomerId: row.stripe_customer_id,
      subscriptionTier: row.subscription_tier,
      automationLevel: row.automation_level,
      creditsIncludedMonthly: row.credits_included_monthly,
      creditsRemaining: row.credits_remaining,
      creditsUsedThisPeriod: row.credits_used_this_period,
      monthlyCreditCap: row.monthly_credit_cap,
      alertThresholdPct: row.alert_threshold_pct,
      periodStart: row.period_start,
      periodEnd: row.period_end,
    };
  }

  /**
   * Provision a new user with credit balance (called on subscription creation).
   */
  async provisionUser(
    userId: string,
    stripeCustomerId: string,
    tier: SubscriptionTier
  ): Promise<void> {
    const config = TIER_CONFIG[tier];
    const periodStart = new Date();
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const cap = config.creditsIncludedMonthly > 0 ? config.creditsIncludedMonthly : null;
    await query(
      `INSERT INTO user_credit_balances (
        user_id, stripe_customer_id, subscription_tier, automation_level,
        credits_included_monthly, credits_remaining, credits_used_this_period,
        monthly_credit_cap, period_start, period_end
      ) VALUES ($1, $2, $3, $4, $5, $6, 0, $7, $8, $9)
      ON CONFLICT (user_id) DO UPDATE SET
        stripe_customer_id = $2,
        subscription_tier = $3,
        automation_level = $4,
        credits_included_monthly = $5,
        credits_remaining = $6,
        monthly_credit_cap = $7,
        period_start = $8,
        period_end = $9,
        updated_at = NOW()`,
      [
        userId,
        stripeCustomerId,
        tier,
        config.maxAutomationLevel, // derive from tier config, not hardcoded
        config.creditsIncludedMonthly,
        config.creditsIncludedMonthly,
        cap,
        periodStart.toISOString(),
        periodEnd.toISOString(),
      ]
    );

    logger.info('User credit balance provisioned', {
      userId,
      tier,
      credits: config.creditsIncludedMonthly,
    });
  }

  /**
   * Reset monthly credits (called on invoice.paid webhook and dev auto-replenish).
   *
   * B2a: resets the ORG pool (authoritative) AND user_credit_balances (kept in sync
   * so the billing UI display remains accurate while the UI is not yet reading from
   * org_credit_balances). Both resets use the same tier allotment + fresh period bounds.
   */
  async resetMonthlyCredits(userId: string): Promise<void> {
    const balance = await this.getBalance(userId);
    if (!balance) return;

    const config = TIER_CONFIG[balance.subscriptionTier];
    const periodStart = new Date();
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    // Reset user_credit_balances (kept for billing UI display — dormant for gate/decrement).
    await query(
      `UPDATE user_credit_balances
       SET credits_remaining = $1,
           credits_used_this_period = 0,
           period_start = $2,
           period_end = $3,
           updated_at = NOW()
       WHERE user_id = $4`,
      [
        config.creditsIncludedMonthly,
        periodStart.toISOString(),
        periodEnd.toISOString(),
        userId,
      ]
    );

    // B2a: also reset the ORG pool (the gate/decrement target).
    const orgId = await resolveOrgForUser(userId);
    if (orgId) {
      await resetOrgPool(orgId);
    }

    logger.info('Monthly credits reset', {
      userId,
      orgId: orgId ?? 'none',
      credits: config.creditsIncludedMonthly,
    });
  }

  /**
   * Handle tier changes (upgrade/downgrade).
   *
   * Requirement 3 (B2a): subscription_tier is denormalized on BOTH user_credit_balances
   * (old, kept for billing UI) and org_credit_balances (new, authoritative path).
   * Both must be updated on every tier change to prevent drift. org_credit_balances is
   * the path toward fully authoritative (B3). user_credit_balances.subscription_tier
   * is deprecated-not-dropped in B2a.
   */
  async updateTier(
    userId: string,
    newTier: SubscriptionTier
  ): Promise<void> {
    const config = TIER_CONFIG[newTier];
    const currentBalance = await this.getBalance(userId);

    // On upgrade: add the difference in credits immediately
    // On downgrade: keep existing credits until end of period
    let newCreditsRemaining = config.creditsIncludedMonthly;
    if (currentBalance) {
      const oldConfig = TIER_CONFIG[currentBalance.subscriptionTier];
      const creditDiff =
        config.creditsIncludedMonthly - oldConfig.creditsIncludedMonthly;

      if (creditDiff > 0) {
        // Upgrade — add the difference
        newCreditsRemaining = currentBalance.creditsRemaining + creditDiff;
      } else {
        // Downgrade — keep existing, cap at new max
        newCreditsRemaining = Math.min(
          currentBalance.creditsRemaining,
          config.creditsIncludedMonthly
        );
      }
    }

    const cap = config.creditsIncludedMonthly > 0 ? config.creditsIncludedMonthly : null;

    // Update user_credit_balances (kept for billing UI display and Stripe identity lookup).
    await query(
      `UPDATE user_credit_balances
       SET subscription_tier = $1,
           credits_included_monthly = $2,
           credits_remaining = $3,
           automation_level = $4,
           monthly_credit_cap = $5,
           updated_at = NOW()
       WHERE user_id = $6`,
      [
        newTier,
        config.creditsIncludedMonthly,
        newCreditsRemaining,
        config.maxAutomationLevel,
        cap,
        userId,
      ]
    );

    // B2a/Requirement 3: also update org_credit_balances tier (sync-on-upgrade rule).
    // org is authoritative in B3; both must stay in sync here.
    const orgId = await resolveOrgForUser(userId);
    if (orgId) {
      await updateOrgTier(orgId, newTier);
    }

    logger.info('User tier updated', { userId, orgId: orgId ?? 'none', newTier, newCreditsRemaining });
  }

  /**
   * Set user automation level (must be within tier limits).
   */
  async setAutomationLevel(
    userId: string,
    level: AutomationLevel
  ): Promise<boolean> {
    const balance = await this.getBalance(userId);
    if (!balance) return false;

    const config = TIER_CONFIG[balance.subscriptionTier];
    if (level > config.maxAutomationLevel) {
      logger.warn('Automation level exceeds tier limit', {
        userId,
        requested: level,
        maxAllowed: config.maxAutomationLevel,
      });
      return false;
    }

    await query(
      `UPDATE user_credit_balances
       SET automation_level = $1, updated_at = NOW()
       WHERE user_id = $2`,
      [level, userId]
    );

    return true;
  }

  /**
   * Check if a user can access a surface based on their tier.
   */
  canAccessSurface(tier: SubscriptionTier, surface: string): boolean {
    return TIER_CONFIG[tier].surfaces.includes(surface);
  }

  /**
   * Debit a flat credit cost for an event-driven agent run.
   * Called after the tier + automation_level gate passes, before the LLM call.
   * Non-fatal: if the user is in overage or exhausted, logs and allows through.
   * Uses reserveCredits() which handles the atomic deduction and soft-overage logic.
   */
  async debitAgentRun(userId: string, agentType: string): Promise<void> {
    if (!userId) return;
    const cost = AGENT_CREDIT_COSTS[agentType] ?? DEFAULT_AGENT_CREDIT_COST;
    try {
      const deducted = await this.reserveCredits(userId, cost);
      logger.info('CreditService: agent run debited', { userId, agentType, cost, deducted });
    } catch (err: any) {
      logger.warn('CreditService: agent run over credit cap, allowing through', {
        userId,
        agentType,
        cost,
        err: err?.message,
      });
    }
  }

  /**
   * Get tier configuration (for display purposes).
   */
  getTierConfig(tier: SubscriptionTier): TierConfig {
    return { ...TIER_CONFIG[tier] };
  }

  /**
   * B2a: Pre-flight credit reservation for agent-triggered runs.
   *
   * Resolves user_id → org_id → org_credit_balances and atomically reserves credits
   * from the ORG pool (not the user's personal balance).
   *
   * Returns TRUE if credits were deducted from the org pool.
   * Returns FALSE when the call is allowed to proceed without deduction
   * (no org, no pool record, overage-allowed tier).
   * Throws if the org's pool is exhausted (credits_remaining <= 0, cap not null).
   */
  async reserveCredits(
    userId: string,
    estimatedCost: number
  ): Promise<boolean> {
    // Resolve org: non-UUID user_ids (bot strings) return null → allow through.
    const orgId = await resolveOrgForUser(userId);
    if (!orgId) {
      logger.warn('reserveCredits: no org for user, allowing through', { userId });
      return false;
    }

    // Delegate to org-level atomic reservation (same guard pattern as old per-user logic).
    return reserveOrgCredits(orgId, estimatedCost);
  }

  /**
   * B2a: Post-call reconciliation — deducts delta from ORG pool.
   * Adds back over-reservation if actual < estimate; deducts remainder if actual > estimate.
   */
  async debitActualCost(
    userId: string,
    estimatedCost: number,
    actualCost: number
  ): Promise<void> {
    const orgId = await resolveOrgForUser(userId);
    if (!orgId) return;
    await debitOrgActualCost(orgId, estimatedCost, actualCost);
  }

  /**
   * Check if user should receive a low-credit alert.
   */
  async shouldAlert(userId: string): Promise<boolean> {
    const balance = await this.getBalance(userId);
    if (!balance || balance.creditsIncludedMonthly <= 0) return false;

    const usedPct =
      ((balance.creditsIncludedMonthly - balance.creditsRemaining) /
        balance.creditsIncludedMonthly) *
      100;
    return usedPct >= balance.alertThresholdPct;
  }
}

// ── Types ──────────────────────────────────────────────────────

interface CreditBalance {
  userId: string;
  stripeCustomerId: string;
  subscriptionTier: SubscriptionTier;
  automationLevel: AutomationLevel;
  creditsIncludedMonthly: number;
  creditsRemaining: number;
  creditsUsedThisPeriod: number;
  monthlyCreditCap: number | null;
  alertThresholdPct: number;
  periodStart: string;
  periodEnd: string;
}

export const creditService = new CreditService();

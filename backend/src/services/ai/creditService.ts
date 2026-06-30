/**
 * Credit Service — Manages user credit balances and billing operations
 *
 * Users see credits, not tokens. Maps operations to flat credit costs
 * and manages the lifecycle of monthly credit grants.
 */

import { query, transaction } from '../../database/connection';
import { logger } from '../../utils/logger';
import type { SubscriptionTier, AutomationLevel } from '../../types/dealContext';

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

const TIER_CONFIG: Record<SubscriptionTier, TierConfig> = {
  scout: {
    creditsIncludedMonthly: 100,
    overageCostPerCredit: 0.25,
    maxActiveDeals: 5,
    maxAutomationLevel: 1,
    surfaces: ['chat'],
    aiMarkup: 1.50,        // 50% markup on raw AI cost
    minCharge: 0.005,      // minimum $0.005 per call
    platformFeePerCall: 0.01, // $0.01 flat fee per call
    monthlyFee: 49,      // $49/mo subscription
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
    monthlyFee: 97,     // $97/mo subscription
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
    monthlyFee: 197,    // $197/mo subscription
  },
  institutional: {
    creditsIncludedMonthly: -1, // custom/negotiated
    overageCostPerCredit: 0, // volume pricing
    maxActiveDeals: -1,
    maxAutomationLevel: 4,
    surfaces: ['chat', 'web', 'api'],
    aiMarkup: 1.00,      // pass-through (no markup)
    minCharge: 0,
    platformFeePerCall: 0,  // no flat fee (custom pricing)
    monthlyFee: 0,       // custom/negotiated
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
   * Reset monthly credits (called on invoice.paid webhook).
   */
  async resetMonthlyCredits(userId: string): Promise<void> {
    const balance = await this.getBalance(userId);
    if (!balance) return;

    const config = TIER_CONFIG[balance.subscriptionTier];
    const periodStart = new Date();
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);

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

    logger.info('Monthly credits reset', {
      userId,
      credits: config.creditsIncludedMonthly,
    });
  }

  /**
   * Handle tier changes (upgrade/downgrade).
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

    logger.info('User tier updated', { userId, newTier, newCreditsRemaining });
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
   * Pre-flight credit reservation for agent-triggered runs.
   * Checks that the user has sufficient credits for the estimated cost.
   * Deducts the estimate immediately so concurrent requests are blocked.
   * Use debitActualCost() post-call to reconcile the true cost.
   *
   * Returns TRUE if the estimated cost was actually deducted from the user's
   * credit balance. Returns FALSE when the call is allowed to proceed without
   * deduction (e.g. overage-allowed tier, no credit record).
   * Throws CreditExhaustedError if the user cannot cover the estimate and
   * has exhausted their credit cap.
   */
  async reserveCredits(
    userId: string,
    estimatedCost: number
  ): Promise<boolean> {
    // Phase 1: read tier + current balance to determine hard-cap vs overage policy.
    // This SELECT is NOT used as the deduction guard — that happens atomically in
    // the conditional UPDATE below to prevent concurrent oversubscription.
    let selectResult: any;
    try {
      selectResult = await query(
        `SELECT credits_remaining, monthly_credit_cap
         FROM user_credit_balances WHERE user_id = $1`,
        [userId]
      );
    } catch (err: any) {
      // Non-UUID user_id (e.g. bot string IDs) cause Postgres to throw
      // "invalid input syntax for type uuid". Treat as no credit record.
      if (err?.message?.includes?.('invalid input syntax for type uuid')) {
        logger.warn('reserveCredits: non-UUID userId, allowing through', { userId });
        return false;
      }
      throw err;
    }

    if (selectResult.rows.length === 0) {
      // No credit record — allow through (new user or pre-billing setup).
      // Caller must treat this as not-deducted and charge full actual cost.
      logger.warn('reserveCredits: no credit record, allowing through', { userId });
      return false;
    }

    const { credits_remaining, monthly_credit_cap } = selectResult.rows[0];

    // Hard-cap enforcement: throw before attempting any deduction
    if (credits_remaining <= 0 && monthly_credit_cap !== null) {
      throw new Error(
        `Insufficient credits: ${credits_remaining} remaining, ${estimatedCost.toFixed(4)} estimated`
      );
    }

    // Overage path: balance is positive but below estimate, or cap is null.
    // Allow through — Stripe meters capture actual usage. No deduction.
    if (credits_remaining < estimatedCost) {
      logger.info('reserveCredits: user in overage, proceeding (no deduction)', {
        userId,
        remaining: credits_remaining,
        estimated: estimatedCost,
      });
      return false;
    }

    // Phase 2: Atomic conditional deduction.
    // The WHERE guard (credits_remaining >= $1) prevents concurrent oversubscription:
    // if another request drained the balance between our SELECT and this UPDATE,
    // 0 rows are returned and we treat the caller as overage rather than double-spending.
    const updateResult = await query(
      `UPDATE user_credit_balances
       SET credits_remaining = credits_remaining - $1,
           credits_used_this_period = credits_used_this_period + $1,
           updated_at = NOW()
       WHERE user_id = $2
         AND credits_remaining >= $1
       RETURNING credits_remaining`,
      [estimatedCost, userId]
    );

    if (updateResult.rows.length === 0) {
      // Concurrent drain: another request consumed the balance in the window between
      // our SELECT and this UPDATE. Treat as overage — Stripe meters capture actual usage.
      logger.warn('reserveCredits: concurrent drain detected, proceeding in overage', { userId });
      return false;
    }

    return true; // estimate was atomically deducted; debitActualCost() will settle the delta
  }

  /**
   * Post-call reconciliation: adds back the over-reservation if actual cost
   * was lower than the estimate, or deducts the remainder if higher.
   */
  async debitActualCost(
    userId: string,
    estimatedCost: number,
    actualCost: number
  ): Promise<void> {
    const delta = actualCost - estimatedCost;
    if (Math.abs(delta) < 0.0001) return; // negligible difference

    await query(
      `UPDATE user_credit_balances
       SET credits_remaining = credits_remaining - $1,
           credits_used_this_period = credits_used_this_period + $1,
           updated_at = NOW()
       WHERE user_id = $2`,
      [delta, userId]
    );
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

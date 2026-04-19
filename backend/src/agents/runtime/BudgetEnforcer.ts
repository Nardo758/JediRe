/**
 * BudgetEnforcer — Circuit breakers for agent cost caps.
 *
 * Two enforcement points:
 *  1. check(ctx, caps) — pre-flight, called before creating agent_run row
 *  2. checkRunCap(runId, currentCost, caps) — intra-loop, called each step
 *
 * Per-user monthly cap is delegated to CreditService (existing).
 */

import { query } from '../../database/connection';
import { logger } from '../../utils/logger';
import { BudgetExceededError } from './types';
import type { BudgetCaps, RunContext } from './types';

function startOfDayUTC(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export class BudgetEnforcer {
  /**
   * Pre-flight check: enforces the per-deal daily cost cap.
   * Throws BudgetExceededError if the cap would be breached.
   */
  async check(ctx: RunContext, caps: BudgetCaps): Promise<void> {
    if (!ctx.dealId) return;

    const result = await query(
      `SELECT COALESCE(SUM(cost_usd), 0) AS spent
       FROM agent_runs
       WHERE deal_id = $1
         AND started_at >= $2
         AND status IN ('succeeded', 'running')`,
      [ctx.dealId, startOfDayUTC().toISOString()]
    );

    const spent: number = parseFloat(result.rows[0]?.spent ?? '0');

    logger.debug('BudgetEnforcer.check', {
      dealId: ctx.dealId,
      spentToday: spent,
      cap: caps.maxCostUsdPerDealPerDay,
    });

    if (spent >= caps.maxCostUsdPerDealPerDay) {
      throw new BudgetExceededError(
        `Deal ${ctx.dealId} hit daily agent cap ($${caps.maxCostUsdPerDealPerDay}). ` +
        `Already spent $${spent.toFixed(4)} today.`
      );
    }
  }

  /**
   * Intra-loop check: enforces the per-run cost cap.
   * Called every iteration of the tool-calling loop.
   */
  async checkRunCap(
    runId: string,
    currentCost: number,
    caps: BudgetCaps
  ): Promise<void> {
    if (currentCost >= caps.maxCostUsdPerRun) {
      throw new BudgetExceededError(
        `Run ${runId} exceeded per-run cap ($${caps.maxCostUsdPerRun}). ` +
        `Accumulated $${currentCost.toFixed(4)}.`
      );
    }
  }
}

export const budgetEnforcer = new BudgetEnforcer();

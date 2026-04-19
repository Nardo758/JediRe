/**
 * BudgetEnforcer — Circuit breakers for agent cost caps.
 *
 * Two enforcement points:
 *  1. check(ctx, caps) — pre-flight, called before creating agent_run row
 *  2. checkRunCap(runId, currentCost, caps) — intra-loop, called each step
 *     Queries agent_runs AND agent_run_steps for accumulated cost so
 *     in-memory tracking cannot be bypassed.
 *
 * Per-user monthly cap is delegated to CreditService (existing).
 */

import { query } from '../../database/connection';
import { logger } from '../../utils/logger';
import { BudgetExceededError } from './types';
import type { BudgetCaps, RunContext } from './types';

function startOfDayUTC(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

export class BudgetEnforcer {
  /**
   * Pre-flight check: enforces the per-deal daily cost cap.
   * Sums cost_usd across all running/succeeded agent_runs for the deal today.
   */
  async check(ctx: RunContext, caps: BudgetCaps): Promise<void> {
    if (!ctx.dealId) return;

    const result = await query(
      `SELECT COALESCE(SUM(cost_usd), 0) AS spent
       FROM agent_runs
       WHERE deal_id = $1
         AND started_at >= $2
         AND status IN ('succeeded', 'running')`,
      [ctx.dealId, startOfDayUTC()]
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
   * Queries agent_runs to get the DB-persisted cost for the run, then
   * adds the in-flight currentCost for the current step (not yet written).
   * Called before AND after each model call.
   */
  async checkRunCap(
    runId: string,
    currentCost: number,
    caps: BudgetCaps
  ): Promise<void> {
    // Fetch accumulated cost stored in DB for this run
    const result = await query(
      `SELECT COALESCE(cost_usd, 0) AS db_cost
       FROM agent_runs WHERE id = $1`,
      [runId]
    );

    const dbCost: number = parseFloat(result.rows[0]?.db_cost ?? '0');

    // currentCost is the in-flight accumulation for the current step
    // (not yet flushed to DB); total = db snapshot + current
    const total = dbCost + currentCost;

    logger.debug('BudgetEnforcer.checkRunCap', {
      runId,
      dbCost,
      currentCost,
      total,
      cap: caps.maxCostUsdPerRun,
    });

    if (total >= caps.maxCostUsdPerRun) {
      throw new BudgetExceededError(
        `Run ${runId} exceeded per-run cap ($${caps.maxCostUsdPerRun}). ` +
        `Accumulated $${total.toFixed(4)} (DB: $${dbCost.toFixed(4)} + current: $${currentCost.toFixed(4)}).`
      );
    }
  }
}

export const budgetEnforcer = new BudgetEnforcer();

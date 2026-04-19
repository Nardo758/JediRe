/**
 * BudgetEnforcer — Circuit breakers for agent cost caps.
 *
 * Enforcement points:
 *  1. check(ctx, caps)                  — pre-flight daily deal cap
 *  2. checkRunCap(runId, cost, caps)    — intra-loop per-run cost cap
 *  3. checkSearchCap(agentId, runId)    — per-run Tavily search count cap
 *
 * Per-user monthly cap is delegated to CreditService (existing).
 */

import { query } from '../../database/connection';
import { logger } from '../../utils/logger';
import { BudgetExceededError } from './types';
import type { BudgetCaps, RunContext } from './types';
import { AGENT_SEARCH_CONFIG } from '../config/search';

function startOfDayUTC(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

export class BudgetEnforcer {
  /**
   * Pre-flight check: enforces the per-deal daily cost cap.
   * Sums cost_usd across ALL agent_runs for the deal today, regardless of status.
   * Failed and budget_exceeded runs have their accrued cost persisted since v6,
   * so excluding them would allow repeated failing runs to bypass the daily cap.
   */
  async check(ctx: RunContext, caps: BudgetCaps): Promise<void> {
    if (!ctx.dealId) return;

    const result = await query(
      `SELECT COALESCE(SUM(cost_usd), 0) AS spent
       FROM agent_runs
       WHERE deal_id = $1
         AND started_at >= $2`,
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

  /**
   * Per-run search cap check.
   * Counts web_search tool calls in agent_run_steps for the given run,
   * then compares against AGENT_SEARCH_CONFIG[agentId].maxSearchesPerRun.
   *
   * Called by the web_search tool before each Tavily request.
   * Throws BudgetExceededError if the cap is reached.
   * No-ops when the agent has no search config (null = search not permitted at tool level).
   */
  async checkSearchCap(agentId: string, runId: string): Promise<void> {
    const config = AGENT_SEARCH_CONFIG[agentId as keyof typeof AGENT_SEARCH_CONFIG];
    if (!config) return;

    const result = await query(
      `SELECT COUNT(*)::int AS count
       FROM agent_run_steps
       WHERE agent_run_id = $1
         AND tool_name = 'web_search'`,
      [runId]
    );

    const count: number = parseInt(result.rows[0]?.count ?? '0', 10);

    logger.debug('BudgetEnforcer.checkSearchCap', {
      agentId,
      runId,
      searchCount: count,
      cap: config.maxSearchesPerRun,
    });

    if (count >= config.maxSearchesPerRun) {
      throw new BudgetExceededError(
        `Agent ${agentId} exceeded search cap of ${config.maxSearchesPerRun} web searches per run. ` +
        `Already used ${count} searches in run ${runId}.`
      );
    }
  }
}

export const budgetEnforcer = new BudgetEnforcer();

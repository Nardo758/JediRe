/**
 * CashFlow Agent — AgentRuntime Adapter (Phase 4 Refactor)
 *
 * This class is an adapter that routes legacy callers through the Phase 4
 * AgentRuntime execution path (cashflow.config.ts).
 *
 * Previous implementation: computed mortgage math and cash flow metrics
 * inline from user-supplied params and DealFinancialContext. That direct
 * path is retired; this class now delegates to `cashflowRuntime.run()`
 * which calls:
 *   fetch_t12, fetch_rent_roll, fetch_assumptions,
 *   compute_proforma, write_projection
 *
 * When `dealId` is provided, the runtime fetches actuals from the DB.
 * When absent, a zeroed skeleton is returned for backward compatibility.
 */

import { logger } from '../utils/logger';
import { cashflowRuntime, type CashflowAgentOutput } from './cashflow.config';
import type { RunContext } from './runtime/types';

export interface CashflowAgentParams {
  dealId?: string;
  userId?: string;
  purchasePrice?: number;
  monthlyRent?: number;
  vacancy?: number;
  interestRate?: number;
  downPaymentPercent?: number;
  loanTermYears?: number;
  [key: string]: unknown;
}

export class CashFlowAgent {
  /**
   * Execute cashflow analysis for a deal.
   *
   * Routes through `cashflowRuntime.run()` when dealId is present.
   * Legacy callers not providing dealId receive a zeroed result.
   */
  async execute(params: CashflowAgentParams, userId?: string): Promise<CashflowAgentOutput> {
    const resolvedUserId = params.userId ?? userId ?? 'unknown';
    const now = new Date().toISOString();

    if (!params.dealId) {
      logger.warn(
        '[CashFlowAgent] execute() called without dealId — cannot use AgentRuntime path. ' +
        'Pass dealId to enable full cashflow analysis.'
      );
      return this.defaultResult(now);
    }

    const ctx: RunContext = {
      dealId: params.dealId,
      userId: resolvedUserId,
      triggeredBy: 'user',
      triggerContext: {
        source: 'legacy_adapter',
        purchase_price: params.purchasePrice,
        monthly_rent: params.monthlyRent,
      },
    };

    try {
      const output = await cashflowRuntime.run(
        {
          deal_id: params.dealId,
          ...(params.purchasePrice && { purchase_price_hint: params.purchasePrice }),
        },
        ctx
      ) as CashflowAgentOutput;

      logger.info('[CashFlowAgent] execute() completed via AgentRuntime', {
        dealId: params.dealId,
        irr: output.irr_pct,
        rating: output.investment_rating,
        confidence: output.confidence_score,
      });

      return output;
    } catch (err) {
      logger.error('[CashFlowAgent] execute(): runtime run failed', {
        dealId: params.dealId,
        err: err instanceof Error ? err.message : String(err),
      });
      return this.defaultResult(now);
    }
  }

  private defaultResult(now: string): CashflowAgentOutput {
    return {
      purchase_price: null,
      noi_year1: null,
      year1_cap_rate_pct: null,
      irr_pct: null,
      avg_cash_on_cash_pct: null,
      dscr_year1: null,
      equity_invested: null,
      exit_value: null,
      investment_rating: null,
      summary: 'Cashflow analysis unavailable — dealId required',
      has_t12_data: false,
      has_rent_roll: false,
      confidence_score: 0,
      fields_written: [],
      completed_at: now,
    };
  }
}

export const cashFlowAgent = new CashFlowAgent();

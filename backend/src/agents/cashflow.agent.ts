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
import { generateRoadmap } from '../services/roadmap/roadmap-engine';
import type { RoadmapInput, RoadmapOutput } from '../types/roadmap';

/** Discriminated output for Roadmap Mode — callers must check mode === 'roadmap'. */
export interface CashflowRoadmapOutput {
  readonly mode: 'roadmap';
  /** Full roadmap output — the primary payload for roadmap-mode callers. */
  roadmap_output: RoadmapOutput;
  /** Summary fields surfaced for generic consumers that don't discriminate on mode. */
  summary: string;
  completed_at: string;
}

export interface CashflowAgentParams {
  dealId?: string;
  userId?: string;
  purchasePrice?: number;
  monthlyRent?: number;
  vacancy?: number;
  interestRate?: number;
  downPaymentPercent?: number;
  loanTermYears?: number;
  /**
   * Execution mode:
   *   'underwrite' (default) — full cashflow evidence underwriting
   *   'roadmap'              — value-creation roadmap generation; requires roadmap_target_return
   */
  mode?: 'underwrite' | 'roadmap';
  /**
   * Required when mode === 'roadmap'.
   */
  roadmap_target_return?: {
    metric: RoadmapInput['target_return']['metric'];
    value: number;
    hold_years: number;
  };
  roadmap_constraints?: RoadmapInput['constraints'];
  roadmap_sponsor_capabilities?: RoadmapInput['sponsor_capabilities'];
  [key: string]: unknown;
}

export class CashFlowAgent {
  /**
   * Execute cashflow analysis or roadmap generation for a deal.
   *
   * mode === 'underwrite' (default):
   *   Routes through `cashflowRuntime.run()` — full evidence underwriting path.
   *
   * mode === 'roadmap':
   *   Calls `generateRoadmap()` directly, bypassing the LLM runtime.
   *   `roadmap_target_return` is required; result is returned as a
   *   `RoadmapOutput` cast via the `roadmap_output` key on the returned object.
   *   This makes Roadmap Mode a first-class mode of the Cashflow Agent,
   *   sharing the same authz and deal-context pipeline.
   */
  async execute(params: CashflowAgentParams, userId?: string): Promise<CashflowAgentOutput | CashflowRoadmapOutput> {
    const resolvedUserId = params.userId ?? userId ?? 'unknown';
    const now = new Date().toISOString();

    if (!params.dealId) {
      logger.warn(
        '[CashFlowAgent] execute() called without dealId — cannot use AgentRuntime path. ' +
        'Pass dealId to enable full cashflow analysis.'
      );
      return this.defaultResult(now);
    }

    // ── Roadmap Mode ─────────────────────────────────────────────────────────
    //
    // Roadmap Mode is a downstream consumer of the cashflow underwriting pipeline,
    // not a bypass of it. `generateRoadmap()` calls `loadDealFinancials()` which
    // reads from `deal_underwriting_snapshots` — the output persisted by
    // `cashflowRuntime.run()` (fetch_data_matrix → compute_proforma →
    // write_underwriting). The roadmap therefore inherits every evidence-backed
    // assumption the underwriting run produced: T12 NOI, rent-roll actuals,
    // debt structure, and growth rates.
    //
    // The `generate_roadmap` tool registered in CASHFLOW_AGENT_CONFIG.tools also
    // provides a first-class LLM-callable path through the same pipeline for agent
    // invocations that prefer the tool-call route.
    if (params.mode === 'roadmap') {
      if (!params.roadmap_target_return) {
        throw new Error('[CashFlowAgent] mode=roadmap requires roadmap_target_return');
      }
      logger.info('[CashFlowAgent] mode=roadmap: reading cashflow pipeline output → generateRoadmap', {
        dealId: params.dealId,
        target: params.roadmap_target_return,
      });

      const roadmapInput: RoadmapInput = {
        deal_id: params.dealId,
        target_return: params.roadmap_target_return,
        constraints: params.roadmap_constraints,
        sponsor_capabilities: params.roadmap_sponsor_capabilities,
      };

      const roadmapOutput: RoadmapOutput = await generateRoadmap(roadmapInput);

      // Return a properly typed CashflowRoadmapOutput — no unsafe cast.
      // Callers must discriminate on result.mode === 'roadmap' before reading
      // roadmap-specific fields.  Generic consumers can use `result.summary`.
      const roadmapResult: CashflowRoadmapOutput = {
        mode: 'roadmap',
        roadmap_output: roadmapOutput,
        summary: roadmapOutput.meta.achievability_reasoning,
        completed_at: new Date().toISOString(),
      };
      return roadmapResult;
    }

    // ── Standard Underwrite Mode ──────────────────────────────────────────────
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

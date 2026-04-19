/**
 * Supply Agent — AgentRuntime Adapter (Phase 4 Refactor)
 *
 * This class is an adapter that routes legacy callers through the Phase 4
 * AgentRuntime execution path (supply.config.ts).
 *
 * Previous implementation: queried market_inventory table directly and
 * computed metrics inline. That path is retired; this class now delegates
 * to `supplyRuntime.run()` which calls the registered tools:
 *   fetch_permits, fetch_costar_pipeline, fetch_submarket_deliveries,
 *   write_supply_analysis
 *
 * When no city/stateCode is provided, a zeroed skeleton is returned and
 * a warning is logged.
 *
 * Migration path for callers:
 *   Pass `dealId` in params, or trigger directly via `supplyRuntime.run()`.
 */

import { logger } from '../utils/logger';
import { supplyRuntime, type SupplyAgentOutput } from './supply.config';
import type { RunContext } from './runtime/types';

export interface SupplyAgentParams {
  dealId?: string;
  userId?: string;
  city: string;
  stateCode: string;
  propertyType?: string;
  msaId?: string;
}

export class SupplyAgent {
  /**
   * Execute supply analysis for a market.
   *
   * Routes through `supplyRuntime.run()` — the Phase 4 authoritative path.
   */
  async execute(params: SupplyAgentParams, userId?: string): Promise<SupplyAgentOutput> {
    const resolvedUserId = params.userId ?? userId ?? 'unknown';
    const now = new Date().toISOString();

    if (!params.city || !params.stateCode) {
      logger.warn('[SupplyAgent] execute() called without city/stateCode');
      return this.defaultResult(params, now);
    }

    const ctx: RunContext = {
      dealId: params.dealId,
      userId: resolvedUserId,
      triggeredBy: 'user',
      triggerContext: {
        source: 'legacy_adapter',
        city: params.city,
        state_code: params.stateCode,
        property_type: params.propertyType,
      },
    };

    try {
      const output = await supplyRuntime.run(
        {
          city: params.city,
          state_code: params.stateCode,
          ...(params.propertyType && { property_type: params.propertyType }),
          ...(params.msaId && { msa_id: params.msaId }),
        },
        ctx
      ) as SupplyAgentOutput;

      logger.info('[SupplyAgent] execute() completed via AgentRuntime', {
        city: params.city,
        supplyRisk: output.supply_risk_level,
        confidence: output.confidence_score,
      });

      return output;
    } catch (err) {
      logger.error('[SupplyAgent] execute(): runtime run failed', {
        city: params.city,
        err: err instanceof Error ? err.message : String(err),
      });
      return this.defaultResult(params, now);
    }
  }

  private defaultResult(params: SupplyAgentParams, now: string): SupplyAgentOutput {
    return {
      city: params.city ?? '',
      state_code: params.stateCode ?? '',
      under_construction_units: null,
      deliveries_12mo: null,
      absorption_rate: null,
      months_of_supply: null,
      pipeline_as_pct_of_stock: null,
      demand_supply_ratio: null,
      supply_risk_level: null,
      summary: 'Supply analysis unavailable',
      confidence_score: 0,
      fields_written: [],
      completed_at: now,
    };
  }
}

export const supplyAgent = new SupplyAgent();

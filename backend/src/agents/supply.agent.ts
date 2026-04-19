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
  city?: string;
  stateCode?: string;
  /** Legacy callers may pass address instead of city/stateCode */
  address?: string;
  /** Legacy fields passed by coordinator — accepted but not forwarded to runtime */
  market?: unknown;
  pipeline?: unknown;
  comps?: unknown;
  propertyType?: string;
  msaId?: string;
}

// Parse "City, ST" or "City, STATE 12345" from an address string
function parseCityState(address: string): { city?: string; stateCode?: string } {
  const m = address.match(/,\s*([^,]+),\s*([A-Z]{2})\b/);
  return m ? { city: m[1].trim(), stateCode: m[2] } : {};
}

export class SupplyAgent {
  /**
   * Execute supply analysis for a market.
   *
   * Accepts either { city, stateCode } (new) or { address } (legacy coordinator
   * shape). Routes through `supplyRuntime.run()` — the Phase 4 authoritative path.
   */
  async execute(params: SupplyAgentParams, userId?: string): Promise<SupplyAgentOutput> {
    const resolvedUserId = params.userId ?? userId ?? 'unknown';
    const now = new Date().toISOString();

    // Resolve city/stateCode — support legacy callers that only pass address
    let city = params.city;
    let stateCode = params.stateCode;
    if ((!city || !stateCode) && params.address) {
      const parsed = parseCityState(params.address);
      city = city ?? parsed.city;
      stateCode = stateCode ?? parsed.stateCode;
    }

    if (!city || !stateCode) {
      logger.warn('[SupplyAgent] execute() called without city/stateCode (and could not parse from address)');
      return this.defaultResult(params as { city?: string; stateCode?: string }, now);
    }

    const ctx: RunContext = {
      dealId: params.dealId,
      userId: resolvedUserId,
      triggeredBy: 'user',
      triggerContext: {
        source: 'legacy_adapter',
        city,
        state_code: stateCode,
        property_type: params.propertyType,
      },
    };

    try {
      const output = await supplyRuntime.run(
        {
          city,
          state_code: stateCode,
          ...(params.propertyType && { property_type: params.propertyType }),
          ...(params.msaId && { msa_id: params.msaId }),
        },
        ctx
      ) as SupplyAgentOutput;

      logger.info('[SupplyAgent] execute() completed via AgentRuntime', {
        city,
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

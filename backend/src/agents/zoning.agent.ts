/**
 * Zoning Agent — AgentRuntime Adapter (Phase 4 Refactor)
 *
 * This class is an adapter that routes legacy callers through the Phase 4
 * AgentRuntime execution path (zoning.config.ts).
 *
 * Previous implementation: delegated to ZoningService which made ad-hoc API
 * calls outside the agent platform. That direct path is retired; this class
 * now delegates to `zoningRuntime.run()` when a dealId is available.
 *
 * When no dealId is provided (legacy callers), a warning is logged and a
 * zeroed skeleton is returned to maintain backward compatibility.
 *
 * Migration path for callers:
 *   Pass `dealId` in the params, or trigger directly via
 *   `zoningRuntime.run()` from zoning.config.ts.
 */

import { logger } from '../utils/logger';
import { zoningRuntime, type ZoningAgentOutput } from './zoning.config';
import type { RunContext } from './runtime/types';
import type { ZoningOutput } from '../services/zoning-agent.service';

export interface ZoningAgentParams {
  dealId?: string;
  userId: string;
  address?: string;
  propertyId?: string;
  lotSizeSqft?: number;
  question?: string;
  forceRefresh?: boolean;
}

export class ZoningAgent {
  /**
   * Execute zoning analysis for a deal.
   *
   * Routes through `zoningRuntime.run()` when dealId is present.
   * Legacy callers not providing dealId receive a zeroed result.
   */
  async execute(params: ZoningAgentParams, userId?: string): Promise<ZoningAgentOutput | { status: string; zoningOutput: ZoningOutput | null }> {
    const resolvedUserId = params.userId ?? userId ?? 'unknown';
    const now = new Date().toISOString();

    if (!params.dealId) {
      logger.warn(
        '[ZoningAgent] execute() called without dealId — cannot use AgentRuntime path. ' +
        'Pass dealId to enable real execution.'
      );
      return this.defaultResult(now);
    }

    const ctx: RunContext = {
      dealId: params.dealId,
      userId: resolvedUserId,
      triggeredBy: 'user',
      triggerContext: {
        source: 'legacy_adapter',
        address: params.address,
        property_id: params.propertyId,
        lot_size_sqft: params.lotSizeSqft,
      },
    };

    try {
      const output = await zoningRuntime.run(
        {
          deal_id: params.dealId,
          address: params.address,
          ...(params.propertyId && { property_id: params.propertyId }),
          ...(params.lotSizeSqft && { lot_size_sqft: params.lotSizeSqft }),
        },
        ctx
      ) as ZoningAgentOutput;

      logger.info('[ZoningAgent] execute() completed via AgentRuntime', {
        dealId: params.dealId,
        zoningCode: output.zoning_code,
        confidence: output.confidence_score,
      });

      return output;
    } catch (err) {
      logger.error('[ZoningAgent] execute(): runtime run failed', {
        dealId: params.dealId,
        err: err instanceof Error ? err.message : String(err),
      });
      return this.defaultResult(now);
    }
  }

  private defaultResult(now: string): ZoningAgentOutput {
    return {
      zoning_code: '',
      zoning_description: null,
      permitted_uses: [],
      max_far: null,
      max_height_ft: null,
      max_gfa_sqft: null,
      est_max_units: null,
      entitlement_risk: null,
      summary: 'Zoning analysis unavailable — dealId required',
      confidence_score: 0,
      completed_at: now,
    };
  }
}

export const zoningAgent = new ZoningAgent();

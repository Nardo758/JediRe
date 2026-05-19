/**
 * Tool: fetch_cycle_intelligence
 *
 * M14 / M28 Cycle Intelligence wrapper for the Cashflow Agent.
 * Returns the market cycle phase, lead/lag divergence signal, phase-optimal
 * strategy, and rent-growth + cap-rate forecasts for a given MSA.
 *
 * Data sources (via CycleIntelligenceService):
 *   - m28_cycle_snapshots (lag_phase, lead_phase, divergence, confidence)
 *   - m28_rate_environment (macro: FFR, T10Y, M2)
 *   - m28_deal_performance_by_phase (phase-optimal strategy + expected IRR)
 *   - key_events WHERE subtype='recession_indicator' (W-07 phase override)
 *
 * Tier 3 — call in Step 1 alongside fetch_rate_environment to establish the
 * cycle context before projecting rent growth, cap rate trajectory, and
 * hold-period strategy.
 */

import { z } from 'zod';
import { cycleIntelligenceService } from '../../services/cycle-intelligence.service';
import { msaResolver } from '../../services/msa-resolver.service';
import { logger } from '../../utils/logger';
import type { ToolDefinition } from '../runtime/types';

const InputSchema = z.object({
  market_id: z.string().optional()
    .describe('MSA identifier used in m28_cycle_snapshots, e.g. "atlanta-msa", "orlando-msa". Optional if deal_id is provided for automatic resolution.'),
  deal_id: z.string().optional()
    .describe('Deal ID to resolve MSA automatically. Used when market_id is not known.'),
  horizon_months: z.number().int().min(6).max(60).default(12)
    .describe('Forecast horizon for rent-growth and cap-rate predictions'),
});

const RentGrowthSchema = z.object({
  baseline_pct: z.number().describe('Median rent growth for current cycle phase'),
  bull_pct:     z.number(),
  bear_pct:     z.number(),
  confidence:   z.number(),
});

const CapRateForecastSchema = z.object({
  current_cap:   z.number(),
  predicted_cap: z.number(),
  change_bps:    z.number().describe('Negative = compression (bullish for values)'),
  direction:     z.enum(['compression', 'stable', 'expansion']),
  confidence:    z.number(),
});

const PhaseStrategySchema = z.object({
  best_strategy:    z.string(),
  expected_irr_pct: z.number(),
  expected_em:      z.number(),
  expected_hold_yr: z.number(),
  confidence:       z.number(),
  sample_size:      z.number(),
});

const OutputSchema = z.object({
  market_id:         z.string(),
  lag_phase:         z.string().describe('Current lagging cycle phase: recovery | expansion | hypersupply | recession'),
  lead_phase:        z.string().describe('Leading indicators cycle phase — divergence from lag signals direction'),
  divergence:        z.number().describe('Lead minus lag; >5 = ACQUIRE signal, <-5 = EXIT signal'),
  divergence_signal: z.enum(['ACQUIRE', 'HOLD', 'EXIT']),
  divergence_narrative: z.string(),
  confidence:        z.number().describe('Snapshot confidence 0–1'),
  rent_growth:       RentGrowthSchema,
  cap_rate_forecast: CapRateForecastSchema,
  phase_strategy:    PhaseStrategySchema.nullable(),
  m14_available:     z.boolean(),
  note:              z.string().optional(),
});

export const fetchCycleIntelligenceTool: ToolDefinition<
  z.infer<typeof InputSchema>,
  z.infer<typeof OutputSchema>
> = {
  name: 'fetch_cycle_intelligence',
  description:
    'Fetches M14/M28 cycle intelligence for a market: current cycle phase (recovery/expansion/' +
    'hypersupply/recession), lead/lag divergence signal (ACQUIRE/HOLD/EXIT), rent-growth forecast ' +
    'by phase (baseline/bull/bear), cap-rate trajectory (compression/stable/expansion), and the ' +
    'phase-optimal strategy with expected IRR. Use alongside fetch_rate_environment in Step 1 to ' +
    'establish cycle context. Cycle phase is a Tier 3 reason-to-deviate on rent growth Y1+ and ' +
    'exit cap anchoring. recession_indicator events (W-07) override lag_phase when confidence ≥ 0.6.',
  inputSchema:  InputSchema,
  outputSchema: OutputSchema,
  requiresCapability: 'read:all',

  execute: async (input, ctx) => {
    // Declare marketId at function scope so the catch block can reference it
    let marketId = input.market_id;

    try {
      // Resolve market_id: explicit, from deal ctx, or auto-resolve via msaResolver
      const dealId = input.deal_id ?? ctx.dealId;
      if (!marketId && dealId) {
        const resolved = await msaResolver.resolve(dealId);
        if (resolved) {
          marketId = resolved;
          logger.info('fetch_cycle_intelligence: resolved market_id from deal', {
            dealId,
            marketId,
          });
        }
      }

      if (!marketId) {
        return {
          market_id:            'unknown',
          lag_phase:            'unknown',
          lead_phase:           'unknown',
          divergence:           0,
          divergence_signal:    'HOLD',
          divergence_narrative: 'No market_id provided and could not resolve from deal data.',
          confidence:           0,
          rent_growth: { baseline_pct: 4.0, bull_pct: 5.0, bear_pct: 3.0, confidence: 0 },
          cap_rate_forecast: { current_cap: 5.25, predicted_cap: 5.25, change_bps: 0, direction: 'stable', confidence: 0 },
          phase_strategy:       null,
          m14_available:        false,
          note: 'No market_id could be resolved. Treat cycle as neutral.',
        };
      }

      const [snapshot, divergence, rentGrowth, capRate, phaseStrategy] = await Promise.all([
        cycleIntelligenceService.getCyclePhase(marketId),
        cycleIntelligenceService.getDivergence(marketId),
        cycleIntelligenceService.predictRentGrowth(marketId, input.horizon_months),
        cycleIntelligenceService.predictCapRateMovement(marketId, input.horizon_months),
        cycleIntelligenceService.getPhaseOptimalStrategy(marketId),
      ]);

      if (!snapshot) {
        return {
          market_id:            marketId,
          lag_phase:            'unknown',
          lead_phase:           'unknown',
          divergence:           0,
          divergence_signal:    'HOLD',
          divergence_narrative: `No cycle snapshot found for market_id "${marketId}". Available markets may differ — check m28_cycle_snapshots.`,
          confidence:           0,
          rent_growth: { baseline_pct: 4.0, bull_pct: 5.0, bear_pct: 3.0, confidence: 0 },
          cap_rate_forecast: { current_cap: 5.25, predicted_cap: 5.25, change_bps: 0, direction: 'stable', confidence: 0 },
          phase_strategy:       null,
          m14_available:        false,
          note: `No m28_cycle_snapshots row for market_id "${marketId}". Treat cycle as neutral. Do not cite M14 cycle phase in reasoning.`,
        };
      }

      const divSignal =
        (divergence?.divergence ?? 0) > 5  ? 'ACQUIRE' :
        (divergence?.divergence ?? 0) < -5 ? 'EXIT' : 'HOLD';

      logger.debug('fetch_cycle_intelligence', {
        runId:     ctx.dealId,
        marketId:  marketId,
        lagPhase:  snapshot.lag_phase,
        leadPhase: snapshot.lead_phase,
        divSignal,
      });

      return {
        market_id:            marketId,
        lag_phase:            snapshot.lag_phase,
        lead_phase:           snapshot.lead_phase,
        divergence:           divergence?.divergence ?? 0,
        divergence_signal:    divSignal,
        divergence_narrative: divergence?.narrative ?? '',
        confidence:           snapshot.confidence,
        rent_growth: {
          baseline_pct: rentGrowth.baseline,
          bull_pct:     rentGrowth.bull,
          bear_pct:     rentGrowth.bear,
          confidence:   rentGrowth.confidence,
        },
        cap_rate_forecast: {
          current_cap:   capRate.current_cap,
          predicted_cap: capRate.predicted_cap,
          change_bps:    capRate.change_bps,
          direction:     capRate.direction as 'compression' | 'stable' | 'expansion',
          confidence:    capRate.confidence,
        },
        phase_strategy: phaseStrategy ? {
          best_strategy:    phaseStrategy.best_strategy,
          expected_irr_pct: phaseStrategy.expected_irr,
          expected_em:      phaseStrategy.expected_em,
          expected_hold_yr: phaseStrategy.expected_hold,
          confidence:       phaseStrategy.confidence,
          sample_size:      phaseStrategy.historical_sample_size,
        } : null,
        m14_available: true,
      };
    } catch (err: any) {
      logger.debug('fetch_cycle_intelligence: M14 unavailable, returning stub', {
        runId:  ctx.dealId,
        error:  err?.message,
      });
      return {
        market_id:            marketId,
        lag_phase:            'unknown',
        lead_phase:           'unknown',
        divergence:           0,
        divergence_signal:    'HOLD',
        divergence_narrative: 'Cycle intelligence unavailable. Treat market as neutral.',
        confidence:           0,
        rent_growth: { baseline_pct: 4.0, bull_pct: 5.0, bear_pct: 3.0, confidence: 0 },
        cap_rate_forecast: { current_cap: 5.25, predicted_cap: 5.25, change_bps: 0, direction: 'stable', confidence: 0 },
        phase_strategy:       null,
        m14_available:        false,
        note: 'M14 cycle intelligence service unavailable. Using neutral fallback. Do not cite cycle phase in reasoning.',
      };
    }
  },
};

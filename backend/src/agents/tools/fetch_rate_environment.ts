/**
 * Tool: fetch_rate_environment
 *
 * M11 Rate Environment wrapper for the Cashflow Agent.
 * Returns the current SOFR-based rate classification, forward curve direction,
 * fixed/floating recommendation, pricing window score, and FRED macro context.
 *
 * Data sources (via classifyRateEnvironment):
 *   - NY Fed SOFR 30/90/180-day compounded averages (live)
 *   - m28_rate_environment table (FRED: GDP, CPI, UNRATE, consumer sentiment)
 *   - key_events WHERE subtype='rate_move' (W-07 forward overlay)
 *
 * Tier 3 — call early in Step 1 to establish rate regime before projecting
 * exit cap deltas and debt structuring assumptions.
 */

import { z } from 'zod';
import { classifyRateEnvironment } from '../../services/debt-advisor/rate-environment.service';
import { logger } from '../../utils/logger';
import type { ToolDefinition } from '../runtime/types';

const InputSchema = z.object({});

const MacroContextSchema = z.object({
  gdp_growth_pct:      z.number().nullable(),
  cpi_yoy_pct:         z.number().nullable(),
  unrate:              z.number().nullable(),
  consumer_sentiment:  z.number().nullable(),
  m2_yoy:              z.number().nullable(),
  dxy:                 z.number().nullable(),
  snapshot_date:       z.string().nullable(),
  narrative_block:     z.string(),
});

const OutputSchema = z.object({
  classification:          z.enum(['Dropping', 'Flat', 'Rising']),
  sofr_pct:                z.number().describe('Current SOFR in percent, e.g. 5.30'),
  sofr_avg30_pct:          z.number(),
  sofr_avg90_pct:          z.number(),
  treasury10y_pct:         z.number().describe('10-year Treasury yield in percent'),
  fed_funds_target_pct:    z.number(),
  sofr_forward_12mo_bps:   z.number().describe('Projected 12-month SOFR change in basis points; negative = dropping'),
  rate_preference:         z.enum(['Fixed', 'Floating', 'Either']),
  term_preference:         z.string(),
  rat_cap_advice:          z.string(),
  narrative:               z.string().describe('Plain-language rate environment summary with macro backdrop'),
  pricing_window_score:    z.number().describe('0-100 score; ≥70 = Favorable to Lock, ≤30 = Avoid Locking Long'),
  pricing_window_label:    z.string(),
  curve_mode:              z.enum(['live', 'fallback_heuristic']).describe('live = SOFR averages available; fallback_heuristic = data gap'),
  computed_at:             z.string(),
  macro_context:           MacroContextSchema.optional(),
  m11_available:           z.boolean(),
  note:                    z.string().optional(),
});

export const fetchRateEnvironmentTool: ToolDefinition<
  z.infer<typeof InputSchema>,
  z.infer<typeof OutputSchema>
> = {
  name: 'fetch_rate_environment',
  description:
    'Fetches M11 rate environment: SOFR classification (Dropping/Flat/Rising), 12-month forward ' +
    'curve direction in bps, fixed/floating recommendation, pricing window score (0–100), and FRED ' +
    'macro context (GDP, CPI, UNRATE, consumer sentiment). Use in Step 1 to establish the rate ' +
    'regime before projecting exit cap deltas, rent growth anchors, and debt structure assumptions. ' +
    'Rate regime is a Tier 3 reason-to-deviate from the analog cohort baseline on exit cap and ' +
    'rent growth lines.',
  inputSchema:  InputSchema,
  outputSchema: OutputSchema,
  requiresCapability: 'read:all',

  execute: async (_input, ctx) => {
    try {
      const r = await classifyRateEnvironment();

      logger.debug('fetch_rate_environment', {
        runId:          ctx.dealId,
        classification: r.classification,
        sofrForward:    r.sofrForward12moBps,
        curveMode:      r.curveMode,
      });

      return {
        classification:        r.classification,
        sofr_pct:              +(r.sofr * 100).toFixed(4),
        sofr_avg30_pct:        +(r.sofrAvg30 * 100).toFixed(4),
        sofr_avg90_pct:        +(r.sofrAvg90 * 100).toFixed(4),
        treasury10y_pct:       +(r.treasury10y * 100).toFixed(4),
        fed_funds_target_pct:  +(r.fedFundsTarget * 100).toFixed(4),
        sofr_forward_12mo_bps: Math.round(r.sofrForward12moBps),
        rate_preference:       r.ratePreference,
        term_preference:       r.termPreference,
        rat_cap_advice:        r.ratCapAdvice,
        narrative:             r.narrative,
        pricing_window_score:  r.pricingWindowScore,
        pricing_window_label:  r.pricingWindowLabel,
        curve_mode:            r.curveMode,
        computed_at:           r.computedAt,
        macro_context: r.macroContext ? {
          gdp_growth_pct:     r.macroContext.gdpGrowthPct,
          cpi_yoy_pct:        r.macroContext.cpiYoyPct,
          unrate:             r.macroContext.unrate,
          consumer_sentiment: r.macroContext.consumerSentiment,
          m2_yoy:             r.macroContext.m2Yoy,
          dxy:                r.macroContext.dxy,
          snapshot_date:      r.macroContext.snapshotDate,
          narrative_block:    r.macroContext.narrativeBlock,
        } : undefined,
        m11_available: true,
      };
    } catch (err: any) {
      logger.debug('fetch_rate_environment: M11 unavailable, returning stub', {
        runId:  ctx.dealId,
        error:  err?.message,
      });
      return {
        classification:        'Flat',
        sofr_pct:              5.30,
        sofr_avg30_pct:        5.30,
        sofr_avg90_pct:        5.30,
        treasury10y_pct:       4.30,
        fed_funds_target_pct:  5.38,
        sofr_forward_12mo_bps: 0,
        rate_preference:       'Either',
        term_preference:       'Match hold period',
        rat_cap_advice:        'Standard rate cap sizing',
        narrative:             'Rate environment data unavailable. Treat as Flat/neutral. Verify before finalizing debt assumptions.',
        pricing_window_score:  50,
        pricing_window_label:  'Neutral',
        curve_mode:            'fallback_heuristic',
        computed_at:           new Date().toISOString(),
        m11_available:         false,
        note: 'M11 rate environment service unavailable. Using neutral fallback. Do not cite M11 classification in reasoning.',
      };
    }
  },
};

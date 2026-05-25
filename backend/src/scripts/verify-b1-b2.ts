/**
 * Quick verification that B1 + B2 type fixes are working.
 * Run: cd backend && npx ts-node --transpile-only src/scripts/verify-b1-b2.ts
 */

import { classifyRateEnvironment } from '../services/debt-advisor/rate-environment.service';
import { cycleIntelligenceService } from '../services/cycle-intelligence.service';
import { z } from 'zod';

const MacroContextSchema = z.object({
  gdp_growth_pct:     z.number().nullable(),
  cpi_yoy_pct:        z.number().nullable(),
  unrate:             z.number().nullable(),
  consumer_sentiment: z.number().nullable(),
  m2_yoy:             z.number().nullable(),
  dxy:                z.number().nullable(),
  snapshot_date:      z.string().nullable(),
  narrative_block:    z.string(),
});

const CapRateSchema = z.object({
  current_cap:   z.number(),
  predicted_cap: z.number(),
  change_bps:    z.number(),
  direction:     z.string(),
  confidence:    z.number(),
});

async function main() {
  console.log('=== B1: fetch_rate_environment macro_context type check ===');
  try {
    const r = await classifyRateEnvironment();
    if (r.macroContext) {
      const mapped = {
        gdp_growth_pct:     r.macroContext.gdpGrowthPct,
        cpi_yoy_pct:        r.macroContext.cpiYoyPct,
        unrate:             r.macroContext.unrate,
        consumer_sentiment: r.macroContext.consumerSentiment,
        m2_yoy:             r.macroContext.m2Yoy,
        dxy:                r.macroContext.dxy,
        snapshot_date:      r.macroContext.snapshotDate,
        narrative_block:    r.macroContext.narrativeBlock,
      };
      const parsed = MacroContextSchema.safeParse(mapped);
      if (parsed.success) {
        console.log('✓ B1 FIXED — macro_context fields are now numbers:');
        console.log(`  gdp_growth_pct=${mapped.gdp_growth_pct} (${typeof mapped.gdp_growth_pct})`);
        console.log(`  cpi_yoy_pct=${mapped.cpi_yoy_pct} (${typeof mapped.cpi_yoy_pct})`);
        console.log(`  unrate=${mapped.unrate} (${typeof mapped.unrate})`);
        console.log(`  consumer_sentiment=${mapped.consumer_sentiment} (${typeof mapped.consumer_sentiment})`);
        console.log(`  m2_yoy=${mapped.m2_yoy} (${typeof mapped.m2_yoy})`);
        console.log(`  dxy=${mapped.dxy} (${typeof mapped.dxy})`);
      } else {
        console.error('✗ B1 STILL BROKEN — Zod errors:');
        console.error(JSON.stringify(parsed.error.issues, null, 2));
      }
    } else {
      console.log('⚠ No macroContext returned (no DB row matching filter)');
    }
  } catch (e: unknown) {
    console.error('B1 ERROR:', e instanceof Error ? e.message : String(e));
  }

  console.log('\n=== B2: fetch_cycle_intelligence cap_rate_forecast type check ===');
  try {
    const capRate = await cycleIntelligenceService.predictCapRateMovement('tampa-msa', 12);
    const mapped = {
      current_cap:   capRate.current_cap,
      predicted_cap: capRate.predicted_cap,
      change_bps:    capRate.change_bps,
      direction:     capRate.direction,
      confidence:    capRate.confidence,
    };
    const parsed = CapRateSchema.safeParse(mapped);
    if (parsed.success) {
      console.log('✓ B2 FIXED — cap_rate_forecast fields are now numbers:');
      console.log(`  current_cap=${mapped.current_cap} (${typeof mapped.current_cap})`);
      console.log(`  predicted_cap=${mapped.predicted_cap} (${typeof mapped.predicted_cap})`);
      console.log(`  change_bps=${mapped.change_bps} (${typeof mapped.change_bps})`);
    } else {
      console.error('✗ B2 STILL BROKEN — Zod errors:');
      console.error(JSON.stringify(parsed.error.issues, null, 2));
    }
  } catch (e: unknown) {
    console.error('B2 ERROR:', e instanceof Error ? e.message : String(e));
  }

  process.exit(0);
}

main();

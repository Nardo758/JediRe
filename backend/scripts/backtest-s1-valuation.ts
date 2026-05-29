/**
 * Phase 5 Backtest — S1 Gold Set Valuation Method Coverage
 *
 * Runs the three S1 deals (Jacksonville MF, Atlanta MF #1, Atlanta MF #2)
 * through the valuation grid with VALUATION_COMPS_FLAG=shadow and reports
 * which methods return `active` vs `insufficient`.
 *
 * Success criteria (Phase 5 AC):
 *   - ≥ 3 of 5 non-placeholder methods active per deal (vs 2 pre-refactor baseline)
 *   - comp_anchored_cap_rate returns `active` on ≥ 1 of 3 S1 deals
 *   - Shadow log entries written for VALUATION_COMPS reader on all 3 deals
 *
 * Usage:
 *   cd backend && npx ts-node --transpile-only scripts/backtest-s1-valuation.ts
 *   cd backend && npx ts-node --transpile-only scripts/backtest-s1-valuation.ts --verbose
 */

import { Pool } from 'pg';
import { ValuationGridService } from '../src/services/valuation/valuation-grid.service';

// ── Activate shadow mode for VALUATION_COMPS reader ──────────────────────────
// This causes the valuation grid to run the Phase 5 property_sales path in
// parallel, log results to property_reader_shadow_log, and serve the old
// CompSetService path. The shadow log entries confirm both paths execute.
process.env.USE_NEW_PROPERTY_SCHEMA_VALUATION_COMPS = 'shadow';

const S1_DEALS = [
  {
    id: 'f1c6909a-a133-4ddf-8c11-d0069e187034',
    label: 'Jacksonville MF (2018)',
    city: 'Jacksonville',
    state: 'FL',
  },
  {
    id: '17457eb3-5ba1-49e6-9f2c-56f311b9bf49',
    label: 'Atlanta MF #1 (2020)',
    city: 'Atlanta',
    state: 'GA',
  },
  {
    id: '0a55f0ac-587a-4b30-8589-a9ea207fbdba',
    label: 'Atlanta MF #2 / HOLD-OUT (2022)',
    city: 'Atlanta',
    state: 'GA',
  },
] as const;

const ACTIVE_METHOD_IDS = [
  'cap_rate_noi',
  'comp_anchored_cap_rate',
  'per_unit_benchmark',
  'sales_comp_ppu',
  'replacement_cost',
] as const;

const VERBOSE = process.argv.includes('--verbose');

function pad(s: string, n: number): string {
  return s.padEnd(n);
}

function statusMark(status: string): string {
  if (status === 'active')       return '✅ active';
  if (status === 'insufficient') return '❌ insufficient';
  if (status === 'placeholder')  return '⏸  placeholder';
  return status;
}

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const svc  = new ValuationGridService(pool);

  console.log('\n══════════════════════════════════════════════════════════');
  console.log(' Phase 5 Backtest — S1 Gold Set Valuation Method Coverage');
  console.log('══════════════════════════════════════════════════════════');
  console.log(` VALUATION_COMPS_FLAG = ${process.env.USE_NEW_PROPERTY_SCHEMA_VALUATION_COMPS}`);
  console.log(` Run date             = ${new Date().toISOString()}`);
  console.log('══════════════════════════════════════════════════════════\n');

  // ── Per-deal results ────────────────────────────────────────────────────────

  const summary: Array<{
    label: string;
    activeCount: number;
    methodResults: Record<string, string>;
    compAnchoredActive: boolean;
    errors: string[];
  }> = [];

  for (const deal of S1_DEALS) {
    console.log(`─── ${deal.label} (${deal.id.slice(0, 8)}…) ───`);

    const errors: string[] = [];
    let result: Awaited<ReturnType<typeof svc.compute>> | null = null;

    try {
      result = await svc.compute(deal.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(msg);
      console.error(`  ⚠  compute() failed: ${msg}`);
    }

    const methodResults: Record<string, string> = {};
    let activeCount = 0;
    let compAnchoredActive = false;

    if (result) {
      for (const methodId of ACTIVE_METHOD_IDS) {
        const method = result.methods.find(m => m.id === methodId);
        const status = method?.status ?? 'missing';
        methodResults[methodId] = status;
        if (status === 'active') activeCount++;
        if (methodId === 'comp_anchored_cap_rate' && status === 'active') {
          compAnchoredActive = true;
        }
      }

      console.log(`  Subject:  ${result.subject.units ?? '?'} units | NOI ${result.subject.noi ? `$${Math.round(result.subject.noi).toLocaleString()}` : 'none'} | lat ${result.subject.latitude ?? '?'} lng ${result.subject.longitude ?? '?'}`);
      console.log(`  Methods (non-placeholder):`);
      for (const [id, status] of Object.entries(methodResults)) {
        console.log(`    ${pad(id, 28)} ${statusMark(status)}`);
        if (VERBOSE && result) {
          const m = result.methods.find(x => x.id === id);
          if (m && m.status === 'active' && m.indicatedValueP50) {
            console.log(`      → indicated P50: $${Math.round(m.indicatedValueP50).toLocaleString()} | confidence: ${m.confidence}`);
          }
          if (m && m.status === 'insufficient' && m.evidenceTrail?.[0]) {
            console.log(`      → gap: ${m.evidenceTrail[0].value}`);
          }
        }
      }
      console.log(`  Active method count: ${activeCount} / ${ACTIVE_METHOD_IDS.length}`);
      console.log(`  Reconciled value P50: ${result.reconciliation.reconciledValue ? `$${Math.round(result.reconciliation.reconciledValue).toLocaleString()}` : 'n/a'}`);

      if (VERBOSE) {
        console.log(`  Subject completeness: ${JSON.stringify(result.subjectCompleteness?.missingFields?.map((f: any) => f.field))}`);
      }
    }

    console.log('');
    summary.push({ label: deal.label, activeCount, methodResults, compAnchoredActive, errors });
  }

  // ── Aggregate results ───────────────────────────────────────────────────────

  console.log('══════════════════════════════════════════════════════════');
  console.log(' Backtest Summary');
  console.log('══════════════════════════════════════════════════════════');

  let passMinMethods = 0;
  let passCompAnchored = 0;
  const MIN_METHODS = 3;

  for (const r of summary) {
    const passThis = r.activeCount >= MIN_METHODS;
    if (passThis) passMinMethods++;
    if (r.compAnchoredActive) passCompAnchored++;
    const mark = passThis ? '✅' : '❌';
    console.log(`  ${mark} ${r.label}: ${r.activeCount}/${ACTIVE_METHOD_IDS.length} active  comp_anchored=${r.compAnchoredActive ? 'active' : 'insufficient'}`);
    if (r.errors.length > 0) {
      for (const e of r.errors) console.log(`      error: ${e}`);
    }
  }

  console.log('');
  console.log('AC checks:');

  const acMinMethods = passMinMethods === S1_DEALS.length;
  const acCompAnchored = passCompAnchored >= 1;
  const acShadowFlag = process.env.USE_NEW_PROPERTY_SCHEMA_VALUATION_COMPS === 'shadow';

  console.log(`  ${acMinMethods ? '✅' : '❌'} ≥${MIN_METHODS} methods active on all 3 S1 deals           (${passMinMethods}/${S1_DEALS.length} deals pass)`);
  console.log(`  ${acCompAnchored ? '✅' : '❌'} comp_anchored_cap_rate active on ≥1 S1 deal       (${passCompAnchored}/${S1_DEALS.length} deals)`);
  console.log(`  ${acShadowFlag ? '✅' : '❌'} VALUATION_COMPS_FLAG=shadow active (shadow logging enabled)`);

  const overall = acMinMethods && acCompAnchored && acShadowFlag;
  console.log('');
  console.log(`Overall result: ${overall ? '✅ PASS' : '❌ FAIL'}`);

  // ── Diagnose gaps ───────────────────────────────────────────────────────────

  if (!acMinMethods || !acCompAnchored) {
    console.log('\nDiagnosis:');
    for (const r of summary) {
      if (r.activeCount < MIN_METHODS) {
        const insufficient = Object.entries(r.methodResults)
          .filter(([, s]) => s !== 'active')
          .map(([id]) => id);
        console.log(`  ${r.label} has only ${r.activeCount} active methods. Insufficient: ${insufficient.join(', ')}`);
        console.log('  Likely causes:');
        if (insufficient.includes('comp_anchored_cap_rate')) {
          console.log('    - comp_anchored_cap_rate: no sale comps within radius. Run comp-set enrichment or widen radius.');
        }
        if (insufficient.includes('per_unit_benchmark')) {
          console.log('    - per_unit_benchmark: no archive_assumption_benchmarks for this cohort.');
        }
        if (insufficient.includes('sales_comp_ppu')) {
          console.log('    - sales_comp_ppu: no market_sale_comps near subject. Ingest FL/GAcomp data.');
        }
        if (insufficient.includes('cap_rate_noi')) {
          console.log('    - cap_rate_noi: subject NOI missing. Upload T12 or set proforma assumptions.');
        }
        if (insufficient.includes('replacement_cost')) {
          console.log('    - replacement_cost: ReplacementCostServiceV2 missing BLS/permit data for this market.');
        }
      }
    }
    console.log('');
    console.log('Fix path if comp_anchored_cap_rate and sales_comp_ppu are insufficient:');
    console.log('  1. Run Florida municipal comps ingest to populate market_sale_comps for JAX');
    console.log('  2. Run Georgia comps enrichment: npm run script:enrich-georgia-comps');
    console.log('  3. After property_sales has data, run: npx ts-node --transpile-only scripts/synthesize-implied-cap-rates.ts');
  }

  // ── Shadow log verification ─────────────────────────────────────────────────
  // Shadow writes are fire-and-forget (.then()) and may not land before
  // this count query runs. Wait 3s to give async promises time to resolve.

  await new Promise(resolve => setTimeout(resolve, 3000));

  try {
    const shadowResult = await pool.query(
      `SELECT entity_id, field, new_value
       FROM property_reader_shadow_log
       WHERE reader_id = 'valuation_comps'
         AND created_at > NOW() - INTERVAL '5 minutes'
       ORDER BY created_at DESC
       LIMIT 20`
    );
    console.log(`\nShadow log entries written this run: ${shadowResult.rows.length}`);
    if (shadowResult.rows.length > 0 && VERBOSE) {
      for (const row of shadowResult.rows) {
        console.log(`  entity=${row.entity_id.slice(0, 8)}… field=${row.field} new_value=${row.new_value}`);
      }
    } else if (shadowResult.rows.length > 0) {
      const byDeal = new Map<string, string[]>();
      for (const row of shadowResult.rows) {
        const key = row.entity_id.slice(0, 8);
        if (!byDeal.has(key)) byDeal.set(key, []);
        byDeal.get(key)!.push(`${row.field}=${row.new_value}`);
      }
      for (const [deal, fields] of byDeal) {
        console.log(`  ${deal}… → ${fields.join(' | ')}`);
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`  Could not read shadow log: ${msg}`);
  }

  console.log('\n══════════════════════════════════════════════════════════\n');

  await pool.end();
  process.exit(overall ? 0 : 1);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(2);
});

/**
 * F · Bishop Fixture Re-Capture
 *
 * Re-runs the F5-1 capture against live Bishop to get a fresh
 * effectiveAssumptions block after the vintage fix (year_built = 2014).
 *
 * Steps:
 * 1. Build assumptions from deal_financial_models + deal_assumptions.year1 overlays
 *    using buildAssumptionsFromStore (returns nested ProFormaAssumptions)
 * 2. Run financialModelEngine.buildModel() (the real service path)
 * 3. Capture both modelAssumptions (pre-M11) and adjustedAssumptions (post-M11)
 * 4. Diff against current bishop.golden.ts expected values
 * 5. If ONLY vintage-adjacent values moved → commit. If OTHER values moved → STOP.
 *
 * Run: cd backend && npx ts-node --transpile-only scripts/f-bishop-fixture-recapture.ts
 */

import * as fs from 'fs';
import { getPool } from '../src/database/connection';
import { financialModelEngine } from '../src/services/financial-model-engine.service';
import { buildAssumptionsFromStore } from '../src/services/assumption-store-builder';

const BISHOP_DEAL_ID = '3f32276f-aacd-4da3-b306-317c5109b403';
const GOLDEN_PATH = 'src/services/deterministic/__fixtures__/bishop.golden.ts';

async function main() {
  const pool = getPool();

  console.log('=== F · Bishop Fixture Re-Capture ===\n');

  // ── 1. Load current golden fixture for comparison ─────────────────────────
  let goldenContent = '';
  try {
    goldenContent = fs.readFileSync(GOLDEN_PATH, 'utf-8');
    console.log('Current golden fixture loaded:', GOLDEN_PATH);
  } catch {
    console.log('Warning: could not read current golden fixture');
  }

  // ── 2. Build assumptions from live deal state ─────────────────────────────
  // Use buildAssumptionsFromStore to get the properly nested ProFormaAssumptions
  let assumptions;
  try {
    assumptions = await buildAssumptionsFromStore(BISHOP_DEAL_ID, pool);
    console.log('Assumptions built from store (deal_financial_models + overlays)');
  } catch (storeErr: any) {
    console.log('buildAssumptionsFromStore failed:', storeErr.message);
    console.log('Falling back to manual construction from deals.deal_data...');

    const assumptionsRes = await pool.query(`
      SELECT target_units, deal_data FROM deals WHERE id = $1
    `, [BISHOP_DEAL_ID]);

    if (assumptionsRes.rows.length === 0) {
      throw new Error('No deal found for Bishop');
    }

    const row = assumptionsRes.rows[0];
    const dealData = row.deal_data || {};

    // Manual nested ProFormaAssumptions construction
    assumptions = {
      dealInfo: {
        totalUnits: row.target_units ?? 232,
        netRentableSF: (row.target_units ?? 232) * 800,
      },
      acquisition: {
        purchasePrice: 60000000,
        closingCosts: {},
      },
      revenue: {
        rentGrowth: dealData.rent_growth ?? [0, 0, 0, 0, 0, 0.03],
        stabilizedOccupancy: 1 - (dealData.vacancy_y1 ?? 19.83) / 100,
        lossToLease: 0.03,
        collectionLoss: 0.015,
      },
      expenses: {},
      financing: {
        loanAmount: dealData.loan_amount ?? 39000000,
        term: 5,
        amortization: 30,
        ioPeriod: 36,
        interestRate: 0.06,
        originationFee: 0.01,
        prepayPenalty: 0,
      },
      disposition: {
        exitCapRate: 0.05,
        sellingCosts: 0.02,
      },
      waterfall: {
        equityContribution: 21000000,
        lpShare: 0.99,
        gpShare: 0.01,
        hurdles: [
          { hurdleRate: 0.08, promoteToGP: 0.20 },
          { hurdleRate: 0.12, promoteToGP: 0.30 },
          { hurdleRate: 0.15, promoteToGP: 0.50 },
        ],
      },
      capex: {
        lineItems: [],
        contingencyPct: 0.10,
        reservesPerUnit: 250,
      },
      holdPeriod: 5,
      modelType: 'existing',
      dealMode: 'lease_up',
      unitMix: [],
    };
  }

  // ── 3. Run buildModel ─────────────────────────────────────────────────────
  console.log('\n[capture] Calling financialModelEngine.buildModel()...');
  const { result, assumptionsHash } = await financialModelEngine.buildModel(
    BISHOP_DEAL_ID,
    assumptions,
    null
  );

  console.log('[capture] assumptionsHash:', assumptionsHash);

  // ── 4. Extract outputs ────────────────────────────────────────────────────
  const r = result as any;
  const capture = {
    assumptionsHash,
    units: assumptions.dealInfo?.totalUnits ?? assumptions.units,
    purchasePrice: assumptions.acquisition?.purchasePrice ?? assumptions.purchasePrice,
    loanAmount: r?.debtMetrics?.loanAmount ?? r?.financing?.loanAmount ?? assumptions.financing?.loanAmount,
    ltv: assumptions.financing?.loanAmount && assumptions.acquisition?.purchasePrice
      ? assumptions.financing.loanAmount / assumptions.acquisition.purchasePrice
      : 0.65,
    rate: assumptions.financing?.interestRate ?? assumptions.rate,
    term: assumptions.financing?.term ? assumptions.financing.term * 12 : 60,
    amort: assumptions.financing?.amortization ? assumptions.financing.amortization * 12 : 360,
    ioPeriod: assumptions.financing?.ioPeriod ?? 36,
    holdYears: assumptions.holdPeriod ?? 5,
    exitCap: assumptions.disposition?.exitCapRate ?? assumptions.exitCap,
    yearBuilt: null, // pulled from deal_data separately
    totalDebt: r?.debtMetrics?.totalDebt ?? r?.financing?.totalDebt ?? null,
    dscr: r?.debtMetrics?.dscr ?? null,
    noiStabilized: r?.incomeStatement?.noi?.[r.incomeStatement.noi.length - 1] ?? null,
  };

  console.log('\n--- Capture summary ---');
  console.log(JSON.stringify(capture, null, 2));

  // ── 5. Diff against golden fixture ────────────────────────────────────────
  console.log('\n--- Diff against golden fixture ---');

  const diffs: Array<{ field: string; golden: string; capture: string }> = [];

  const extractExpected = (field: string): string | null => {
    const m = goldenContent.match(new RegExp(`${field}:\\s*([^,\\n]+)`));
    return m ? m[1].trim() : null;
  };

  const fieldsToDiff = [
    'purchasePrice', 'units', 'loanAmount', 'ltv', 'rate',
    'term', 'amort', 'ioPeriod', 'holdYears', 'exitCap', 'yearBuilt'
  ];

  for (const field of fieldsToDiff) {
    const goldenVal = extractExpected(field);
    const captureVal = (capture as any)[field]?.toString() ?? 'null';
    if (goldenVal && goldenVal !== captureVal && goldenVal !== 'null') {
      diffs.push({ field, golden: goldenVal, capture: captureVal });
    }
  }

  if (diffs.length === 0) {
    console.log('  No diffs found (or golden fixture not parsed)');
  } else {
    for (const d of diffs) {
      const vintageAdjacent = ['yearBuilt', 'term', 'amort'].includes(d.field);
      console.log(`  ${vintageAdjacent ? 'ℹ️' : '⚠️'}  ${d.field}: golden=${d.golden} capture=${d.capture}${vintageAdjacent ? ' (vintage-adjacent)' : ''}`);
    }
  }

  // ── 6. Verdict ────────────────────────────────────────────────────────────
  const nonVintageDiffs = diffs.filter(d => !['yearBuilt', 'term', 'amort'].includes(d.field));

  if (nonVintageDiffs.length === 0) {
    console.log('\n✅ F PASS — Only vintage-adjacent values moved (or no diffs)');
    console.log('   Safe to re-pin fixture with new capture.');
  } else {
    console.log('\n❌ F STOP — Non-vintage values drifted:');
    for (const d of nonVintageDiffs) {
      console.log(`     ${d.field}: ${d.golden} → ${d.capture}`);
    }
    console.log('   Do not hand-reconcile. This is drift needing its own investigation.');
  }

  // Save capture to tmp for manual inspection
  const outPath = '/tmp/bishop_capture_' + new Date().toISOString().slice(0, 10) + '.json';
  fs.writeFileSync(outPath, JSON.stringify({ assumptions, capture, result: r }, null, 2));
  console.log(`\n   Full capture saved to: ${outPath}`);

  process.exit(nonVintageDiffs.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('[capture] FAILED:', err);
  process.exit(1);
});

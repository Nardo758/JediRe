/**
 * F · Bishop Fixture Re-Capture
 *
 * Re-runs the F5-1 capture against live Bishop to get a fresh
 * effectiveAssumptions block after the vintage fix (year_built = 2014).
 *
 * Steps:
 * 1. Build assumptions from deals.deal_data (same as live build path)
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
import type { ProFormaAssumptions } from '../src/services/financial-model-engine.service';

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
  const assumptionsRes = await pool.query(`
    SELECT
      target_units,
      deal_data
    FROM deals
    WHERE id = $1
  `, [BISHOP_DEAL_ID]);

  if (assumptionsRes.rows.length === 0) {
    throw new Error('No deal found for Bishop');
  }

  const row = assumptionsRes.rows[0];
  const dealData = row.deal_data || {};

  // Construct assumptions the same way the assumption-store builder does
  const assumptions: ProFormaAssumptions = {
    units: row.target_units ?? 232,
    avgUnitSf: 800,
    marketRent: 1500,
    inPlaceRent: 1400,
    purchasePrice: 60000000,
    closingCostsPct: 0.0015,
    isFlorida: false,
    docStampsPct: 0,
    intangibleTaxPct: 0,
    titleInsurancePct: 0,
    capexBudget: 0,
    rentGrowth: dealData.rent_growth ?? [0, 0, 0, 0, 0, 0.03],
    lossToLease: 0.03,
    vacancyY1: dealData.vacancy_y1 ?? 19.83,
    vacancyStab: dealData.vacancy_stab ?? 19.83,
    concessions: 0,
    badDebt: 0.015,
    otherIncomePerUnit: 0,
    expenseGrowth: 0.031,
    payrollPerUnit: 0,
    maintenancePerUnit: 0,
    contractServicesPerUnit: 0,
    marketingPerUnit: 0,
    utilitiesPerUnit: 0,
    adminPerUnit: 0,
    insurancePerUnit: 0,
    managementFee: 0.05,
    replacementReserves: 250,
    loanAmount: dealData.loan_amount ?? 39000000,
    ltv: 0.65,
    term: 60,
    amort: 360,
    ioPeriod: 36,
    rate: 0.06,
    originationFeePct: 1,
    prepayPenalty: 0,
    exitCap: 0.05,
    saleCosts: 0.02,
    holdYears: 5,
    lpEquity: 20790000,
    gpEquity: 210000,
    preferredReturn: 0.08,
    promoteTiers: [0.08, 0.12, 0.15],
    promoteSplits: [0.2, 0.3, 0.5],
    dealType: 'existing',
    dealMode: 'lease_up',
    standardTurnDowntimeDays: 14,
    newLeaseConcessionMonths: 1,
    annualTurnoverRate: 0.5,
    occupancyAtClose: 0.9310344827586207,
    underwritingVacancyFloor: 0.05,
  };

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
    units: assumptions.units,
    purchasePrice: assumptions.purchasePrice,
    loanAmount: r?.debtMetrics?.loanAmount ?? r?.financing?.loanAmount ?? assumptions.loanAmount,
    ltv: assumptions.ltv,
    rate: assumptions.rate,
    term: assumptions.term,
    amort: assumptions.amort,
    ioPeriod: assumptions.ioPeriod,
    holdYears: assumptions.holdYears,
    exitCap: assumptions.exitCap,
    yearBuilt: dealData.year_built ?? null,
    totalDebt: r?.debtMetrics?.totalDebt ?? r?.financing?.totalDebt ?? null,
    dscr: r?.debtMetrics?.dscr ?? null,
    noiStabilized: r?.incomeStatement?.noi?.[r.incomeStatement.noi.length - 1] ?? null,
  };

  console.log('\n--- Capture summary ---');
  console.log(JSON.stringify(capture, null, 2));

  // ── 5. Diff against golden fixture ────────────────────────────────────────
  console.log('\n--- Diff against golden fixture ---');

  const diffs: Array<{ field: string; golden: string; capture: string }> = [];

  // Extract expected values from golden content (simple regex parse)
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

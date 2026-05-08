/**
 * 3-Mode IRR Verification — 464 Bishop
 *
 * Confirms the stance-ordering fix: applyStanceToFinancials is now called
 * BEFORE buildProjectionsForExport, so modulated assumptions (rentGrowthPct,
 * vacancyPct, exitCap, opexGrowthPct) flow into the per-year projections.
 *
 * Since 464 Bishop has no purchase_price in deal_data (equityAtClose = 0),
 * we verify the fix via:
 *   1. Per-year NOI shift across the 3 postures (primary proof)
 *   2. Exit value shift (exitCap modulation)
 *   3. Full IRR using a synthetic equity ($19.25 M at 65% LTC on $55 M)
 *
 * Run: cd backend && npx ts-node --transpile-only scripts/irr-verify-464-bishop.ts
 */

import { connectDatabase, getPool, closeDatabase } from '../src/database/connection';
import { getDealFinancials } from '../src/services/proforma-adjustment.service';
import { buildProjectionsForExport } from '../src/services/f9-financial-export.service';
import { applyStanceToFinancials } from '../src/services/operatorStance.service';
import type { OperatorStance } from '../src/types/operator-stance';

const DEAL_ID    = '3f32276f-aacd-4da3-b306-317c5109b403';
const HOLD_YEARS = 10;

// Synthetic equity for IRR: $55 M purchase @ 65% LTC → ~$19.25 M equity
const SYNTHETIC_EQUITY = 19_250_000;

function computeIrr(cfs: number[]): number | null {
  if (cfs.length < 2) return null;
  let r = 0.10;
  for (let i = 0; i < 300; i++) {
    let npv = 0, d = 0;
    for (let t = 0; t < cfs.length; t++) {
      const disc = Math.pow(1 + r, t);
      npv += cfs[t] / disc;
      d   -= t * cfs[t] / (disc * (1 + r));
    }
    if (Math.abs(npv) < 0.01 || d === 0) break;
    r -= npv / d;
  }
  return Math.abs(r) < 5 ? r : null;
}

const BASE: Omit<OperatorStance, 'underwritingPosture'> = {
  defaulted: false,
  rateEnvironment: 'NORMALIZING',
  cyclePosition: 'MID',
  concessionStrategy: 'MARKET',
  marketingIntensity: 'MARKET',
  expenseGrowthPosture: 'INFLATION',
  recessionProbability: 0.15,
  stressRentGrowthHaircut: 0,
  stressExitCapWiden: 0,
  stressVacancyFloor: 0,
  updatedAt: new Date().toISOString(),
};

const $ = (v: number | null): string => v != null ? '$' + Math.round(v).toLocaleString() : '—';
const pct = (v: number | null, d = 2): string => v != null ? (v * 100).toFixed(d) + '%' : '—';

async function run() {
  const postures: Array<OperatorStance['underwritingPosture']> = ['CONSERVATIVE', 'MARKET', 'AGGRESSIVE'];

  type Row = {
    posture: string;
    rentGrY1: number | null;
    vacY1: number | null;
    exitCap: number | null;
    opexGr: number | null;
    noiY1: number | null;
    noiY5: number | null;
    noiY10: number | null;
    exitValue: number | null;
    irr: number | null;
    mods: number;
  };
  const rows: Row[] = [];

  await connectDatabase();
  const pool = getPool();

  console.log(`\n${'═'.repeat(68)}`);
  console.log('  464 Bishop — Stance Ordering Fix Verification');
  console.log('  Synthetic equity: $19.25 M  |  Hold: 10 yr');
  console.log(`${'═'.repeat(68)}`);

  for (const posture of postures) {
    const data = await getDealFinancials(pool, DEAL_ID, HOLD_YEARS);
    const stance: OperatorStance = { ...BASE, underwritingPosture: posture };

    // THE FIX: stance before projections
    const modulations = applyStanceToFinancials(data, stance);
    const projs = buildProjectionsForExport(data, HOLD_YEARS);

    const noiY1  = projs[0]?.noi  ?? null;
    const noiY5  = projs[4]?.noi  ?? projs[Math.min(4, projs.length - 1)]?.noi  ?? null;
    const noiY10 = projs[9]?.noi  ?? projs[projs.length - 1]?.noi ?? null;
    const exitV  = projs[projs.length - 1]?.exitValue ?? null;

    // IRR with synthetic equity
    let irr: number | null = null;
    if (projs.length > 0) {
      const last = projs[projs.length - 1];
      const cfs  = [-SYNTHETIC_EQUITY];
      for (let i = 0; i < projs.length - 1; i++) cfs.push(projs[i].cfbt ?? 0);
      cfs.push((last.cfbt ?? 0) + (last.netSaleProceeds ?? 0));
      irr = computeIrr(cfs);
    }

    rows.push({
      posture,
      rentGrY1: data.assumptions.rentGrowthYr1,
      vacY1:    data.assumptions.perYear?.[0]?.vacancyPct ?? data.assumptions.vacancyPct,
      exitCap:  data.assumptions.exitCap,
      opexGr:   data.assumptions.opexGrowthPct,
      noiY1, noiY5, noiY10, exitValue: exitV, irr,
      mods: modulations.length,
    });
  }

  // Print table
  console.log('\n  PROJECTION OUTPUTS (post-modulation):');
  console.log(`  ${'POSTURE'.padEnd(14)} ${'NOI Y1'.padStart(13)} ${'NOI Y5'.padStart(13)} ${'NOI Y10'.padStart(13)} ${'EXIT VALUE'.padStart(14)} ${'IRR'.padStart(7)} ${'MODS'.padStart(5)}`);
  console.log(`  ${'─'.repeat(82)}`);
  for (const r of rows) {
    console.log(`  ${r.posture.padEnd(14)} ${$(r.noiY1).padStart(13)} ${$(r.noiY5).padStart(13)} ${$(r.noiY10).padStart(13)} ${$(r.exitValue).padStart(14)} ${(r.irr != null ? pct(r.irr) : '—').padStart(7)} ${String(r.mods).padStart(5)}`);
  }

  console.log('\n  MODULATED ASSUMPTIONS (per posture):');
  console.log(`  ${'POSTURE'.padEnd(14)} ${'RENT GR Y1'.padStart(11)} ${'VACANCY Y1'.padStart(11)} ${'EXIT CAP'.padStart(9)} ${'OPEX GR'.padStart(8)}`);
  console.log(`  ${'─'.repeat(56)}`);
  for (const r of rows) {
    console.log(`  ${r.posture.padEnd(14)} ${pct(r.rentGrY1).padStart(11)} ${pct(r.vacY1, 1).padStart(11)} ${pct(r.exitCap).padStart(9)} ${pct(r.opexGr).padStart(8)}`);
  }

  // Verdict
  const noisy = rows.some(r => r.noiY10 != null);
  const noiShifts = noisy && rows[0].noiY10 != null && rows[2].noiY10 != null
    && Math.abs(rows[0].noiY10 - rows[2].noiY10) > 1000;
  const irrShifts = rows.every(r => r.irr != null)
    && Math.abs((rows[0].irr ?? 0) - (rows[2].irr ?? 0)) > 0.001;

  console.log('\n  VERDICT:');
  console.log(`  NOI shift (CONS vs AGG) : ${noiShifts ? '✓ PASS' : '✗ FAIL / no data'}`);
  console.log(`  IRR shift (CONS vs AGG) : ${irrShifts ? '✓ PASS' : rows.some(r => r.irr == null) ? '⚠ partial (some IRRs null)' : '✗ FAIL'}`);
  console.log(`  Ordering fix status     : ${noiShifts || irrShifts ? '✓ CONFIRMED' : '⚠ unable to confirm — check data'}`);
  console.log(`\n${'═'.repeat(68)}\n`);

  await closeDatabase();
}

run().catch(e => { console.error(e); process.exit(1); });

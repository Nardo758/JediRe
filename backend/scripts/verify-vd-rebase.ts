/**
 * V-D: Prove applyRebase forward re-derivation (not frozen).
 *
 * Before: Highlands periodic_seed first proj month gpr = 5,317,612 (flat year1 baseline).
 * After:  Call applyRebase with a +10% synthetic actual for 2026-04.
 *         Forward months (2026-05+) must compound-trend from new baseline — NOT stay flat.
 */
import { Pool } from 'pg';
import { applyRebase } from '../src/services/proforma/reconciliation.service';
import type { ProFormaPeriodicSeed } from '../src/services/proforma/periodic-field.types';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const dealId = 'eaabeb9f-830e-44f9-a923-56679ad0329d';

  const q = await pool.query(`
    SELECT periodic_seed FROM deal_assumptions WHERE deal_id=$1
  `, [dealId]);

  if (!q.rows[0]?.periodic_seed) {
    console.error('No periodic_seed for Highlands — seed it first');
    process.exit(1);
  }

  const seed: ProFormaPeriodicSeed = typeof q.rows[0].periodic_seed === 'string'
    ? JSON.parse(q.rows[0].periodic_seed)
    : q.rows[0].periodic_seed;

  // Show baseline: first two forward-projection gpr values (should be flat/same before rebase)
  const gprPeriods = seed.fields.gpr?.periods ?? [];
  const projPeriods = gprPeriods.filter(p => p.zone === 'projection').sort((a, b) => a.periodIndex - b.periodIndex);
  const beforeMonth1 = projPeriods[0];
  const beforeMonth12 = projPeriods[11];
  console.log('=== BEFORE applyRebase ===');
  console.log(`Proj month 1  (${beforeMonth1?.month}): gpr = ${beforeMonth1?.resolved?.toFixed(2)}`);
  console.log(`Proj month 12 (${beforeMonth12?.month}): gpr = ${beforeMonth12?.resolved?.toFixed(2)}`);
  console.log(`Same value? ${beforeMonth1?.resolved === beforeMonth12?.resolved} (expect TRUE = frozen flat)`);

  // The last actual month is 2026-04 — build newActuals with +10% synthetic value
  const lastActualMonth = '2026-04';
  const lastActualPeriods: Record<string, number> = {};
  for (const [fieldName, series] of Object.entries(seed.fields)) {
    const p = series.periods.find(pp => pp.month === lastActualMonth && pp.zone === 'actual');
    if (p?.resolved != null) {
      lastActualPeriods[fieldName] = p.resolved * 1.10; // +10% synthetic actual
    }
  }
  console.log(`\nSynthetic new actual for 2026-04: gpr = ${lastActualPeriods['gpr']?.toFixed(2)} (+10% vs ${(lastActualPeriods['gpr'] / 1.10)?.toFixed(2)})`);

  // Apply rebase — this should re-derive ALL forward projection months from new baseline
  const rebased = applyRebase(seed, lastActualPeriods, lastActualMonth);

  const gprRebased = rebased.fields.gpr?.periods ?? [];
  const projRebased = gprRebased.filter(p => p.zone === 'projection').sort((a, b) => a.periodIndex - b.periodIndex);
  const afterMonth1 = projRebased[0];
  const afterMonth2 = projRebased[1];
  const afterMonth12 = projRebased[11];

  console.log('\n=== AFTER applyRebase ===');
  console.log(`Proj month 1  (${afterMonth1?.month}): gpr = ${afterMonth1?.resolved?.toFixed(2)}  resolution=${afterMonth1?.resolution}  source=${afterMonth1?.source}`);
  console.log(`Proj month 2  (${afterMonth2?.month}): gpr = ${afterMonth2?.resolved?.toFixed(2)}`);
  console.log(`Proj month 12 (${afterMonth12?.month}): gpr = ${afterMonth12?.resolved?.toFixed(2)}`);
  const changed = afterMonth1?.resolved !== beforeMonth1?.resolved;
  const trending = afterMonth12?.resolved !== afterMonth1?.resolved;
  console.log(`\nForward gpr changed from baseline? ${changed} (expect TRUE)`);
  console.log(`Proj month 12 !== month 1? ${trending} (expect TRUE = compounding, not frozen)`);

  // Show the growth rate embedded (should match DEFAULT_GAP_TRENDS.rentGrowthMonthly = 0.0025)
  if (afterMonth1?.resolved && afterMonth2?.resolved) {
    const impliedMonthlyRate = (afterMonth2.resolved / afterMonth1.resolved) - 1;
    console.log(`Implied monthly growth rate (mo2/mo1 - 1): ${(impliedMonthlyRate * 100).toFixed(4)}% (expect ≈0.0025 * 100 = 0.25%)`);
  }

  await pool.end();
}
main().catch(e => { console.error(e.message || e); process.exit(1); });

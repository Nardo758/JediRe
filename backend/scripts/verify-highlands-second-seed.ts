/**
 * Highlands second-seed forced verification — V1 through V5.
 *
 * Steps:
 *   0. Re-seed Highlands from scratch (no synthetic data) to pick up Phase 2-B
 *      monthly-scale projections. Capture first_proj_gpr for the V1 baseline.
 *   1. Insert one synthetic actual (2026-05) at GPR +10% over projected.
 *   2. Re-seed (second seed) → Part 1+2 fire.
 *   V1: MONTHLY_ACTUAL reconciliation rows show projected≈baseline, actual=synthetic, variance=real.
 *   V2: Zone distribution shifts (54 actual, 119 proj). actuals_through_month advanced.
 *   V3: Forward projection GPR changed from baseline (not frozen).
 *   V4: Material variance flagged. deal_lifecycle_events untouched.
 *   V5: Insert second synthetic (2026-06). Re-seed. Both months reconciled, forward derived ONCE.
 *   Restore: delete synthetic rows, re-seed to clean 53-actual state.
 */
import { Pool } from 'pg';
import { seedProFormaYear1 } from '../src/services/proforma-seeder.service';

const DEAL_ID = 'eaabeb9f-830e-44f9-a923-56679ad0329d';
const PROP_ID = '7ea31caf-f070-43eb-9fd1-fe08f7123701';

async function getGprPeriod(pool: Pool, zone: 'projection' | 'actual', offset = 0): Promise<{ month: string; resolved: number; resolution: string } | null> {
  const q = await pool.query(`
    SELECT p->>'month'      AS month,
           (p->>'resolved')::numeric AS resolved,
           p->>'resolution' AS resolution
    FROM deal_assumptions da,
         jsonb_array_elements(da.periodic_seed->'fields'->'gpr'->'periods') p
    WHERE da.deal_id = $1
      AND p->>'zone' = $2
    ORDER BY (p->>'periodIndex')::int
    LIMIT 1 OFFSET $3
  `, [DEAL_ID, zone, offset]);
  if (!q.rows[0]) return null;
  return { month: q.rows[0].month, resolved: Number(q.rows[0].resolved), resolution: q.rows[0].resolution };
}

async function getZoneCounts(pool: Pool) {
  const q = await pool.query(`
    SELECT
      sum(CASE WHEN p->>'zone'='actual'     THEN 1 ELSE 0 END) AS actual_ct,
      sum(CASE WHEN p->>'zone'='gap'        THEN 1 ELSE 0 END) AS gap_ct,
      sum(CASE WHEN p->>'zone'='projection' THEN 1 ELSE 0 END) AS proj_ct
    FROM deal_assumptions da,
         jsonb_array_elements(da.periodic_seed->'fields'->'gpr'->'periods') p
    WHERE da.deal_id = $1
  `, [DEAL_ID]);
  return q.rows[0];
}

async function getActualsThrough(pool: Pool): Promise<string | null> {
  const q = await pool.query(
    `SELECT to_char(actuals_through_month, 'YYYY-MM-DD') AS atm FROM deals WHERE id=$1`,
    [DEAL_ID]
  );
  return q.rows[0]?.atm ?? null;
}

async function getReconLog(pool: Pool) {
  const q = await pool.query(`
    SELECT field_name, to_char(period_month,'YYYY-MM') AS month,
           round(projected_value) AS projected, round(actual_value) AS actual,
           round(variance_abs) AS var_abs, round(variance_pct*100,2) AS var_pct,
           material, trigger_path
    FROM deal_reconciliation_log
    WHERE deal_id = $1
    ORDER BY period_month, field_name, trigger_path
  `, [DEAL_ID]);
  return q.rows;
}

async function getLifecycleRows(pool: Pool) {
  const q = await pool.query(`SELECT count(*) AS ct FROM deal_lifecycle_events WHERE deal_id=$1`, [DEAL_ID]);
  return Number(q.rows[0].ct);
}

async function insertSyntheticActual(pool: Pool, reportMonth: string, gprOverride: number) {
  // Pull the last real actual row as a template so all other columns are realistic
  const template = await pool.query(`
    SELECT * FROM deal_monthly_actuals
    WHERE property_id=$1 AND is_portfolio_asset=TRUE AND is_budget=FALSE AND is_proforma=FALSE
    ORDER BY report_month DESC LIMIT 1
  `, [PROP_ID]);
  if (!template.rows[0]) throw new Error('No template row found');
  const t = template.rows[0];
  await pool.query(`
    INSERT INTO deal_monthly_actuals (
      property_id, deal_id, report_month, is_portfolio_asset, is_budget, is_proforma,
      gross_potential_rent, vacancy_loss, net_rental_income, other_income,
      effective_gross_income, payroll, repairs_maintenance, turnover_costs,
      marketing, admin_general, management_fee, contract_services, utilities,
      insurance, property_tax, total_opex, noi, total_units, occupied_units
    ) VALUES ($1,$2,$3,TRUE,FALSE,FALSE,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
    ON CONFLICT (property_id, report_month, is_budget, is_proforma) DO UPDATE
      SET gross_potential_rent = EXCLUDED.gross_potential_rent,
          is_portfolio_asset = TRUE
  `, [
    PROP_ID, DEAL_ID, `${reportMonth}-01`, gprOverride,
    t.vacancy_loss, t.net_rental_income, t.other_income,
    t.effective_gross_income, t.payroll, t.repairs_maintenance, t.turnover_costs,
    t.marketing, t.admin_general, t.management_fee, t.contract_services, t.utilities,
    t.insurance, t.property_tax, t.total_opex, t.noi, t.total_units, t.occupied_units,
  ]);
  console.log(`  Inserted synthetic actual: ${reportMonth}, GPR=${Math.round(gprOverride)}`);
}

async function deleteSyntheticActuals(pool: Pool, months: string[]) {
  for (const m of months) {
    await pool.query(`DELETE FROM deal_monthly_actuals WHERE property_id=$1 AND report_month=$2`, [PROP_ID, `${m}-01`]);
    console.log(`  Deleted synthetic actual: ${m}`);
  }
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    // ─── STEP 0: Re-seed from clean state to apply Phase 2-B monthly projections ──
    console.log('\n=== STEP 0: Initial re-seed (applies Phase 2-B monthly-scale projections) ===');
    await pool.query(`DELETE FROM deal_reconciliation_log WHERE deal_id=$1`, [DEAL_ID]);
    const step0 = await seedProFormaYear1(pool, DEAL_ID);
    console.log(`seeded=${step0.seeded} fields_seeded=${step0.fields_seeded}`);

    const baseline = await getGprPeriod(pool, 'projection', 0);
    const baseline2 = await getGprPeriod(pool, 'projection', 1);
    const step0Zones = await getZoneCounts(pool);
    console.log(`Zone distribution: actual=${step0Zones.actual_ct} gap=${step0Zones.gap_ct} proj=${step0Zones.proj_ct}`);
    console.log(`first_proj_month=${baseline?.month}  first_proj_gpr=${Math.round(baseline?.resolved ?? 0)}  resolution=${baseline?.resolution}`);
    console.log(`second_proj_month=${baseline2?.month} second_proj_gpr=${Math.round(baseline2?.resolved ?? 0)}`);

    if (!baseline) throw new Error('No projection period found after initial re-seed');
    const syntheticGpr1 = Math.round(baseline.resolved * 1.10); // +10% miss
    console.log(`\nTarget for synthetic 2026-05: GPR=${syntheticGpr1} (+10% over ${Math.round(baseline.resolved)} projected)`);

    // ─── STEP 1: Insert one synthetic actual (2026-05) ───────────────────────
    console.log('\n=== STEP 1: Insert one synthetic actual (2026-05, +10% GPR) ===');
    const lifecycleBefore = await getLifecycleRows(pool);
    await insertSyntheticActual(pool, '2026-05', syntheticGpr1);

    // ─── STEP 2: Second seed (V1-V4) ──────────────────────────────────────────
    console.log('\n=== STEP 2: Second seed (Part 1+2 fire) ===');
    await pool.query(`DELETE FROM deal_reconciliation_log WHERE deal_id=$1`, [DEAL_ID]);
    const step2 = await seedProFormaYear1(pool, DEAL_ID);
    console.log(`seeded=${step2.seeded} fields_seeded=${step2.fields_seeded}`);

    // ── V1: Reconciliation rows ────────────────────────────────────────────────
    console.log('\n=== V1: deal_reconciliation_log rows ===');
    const recon1 = await getReconLog(pool);
    const gprRows1 = recon1.filter(r => r.field_name === 'gpr' && r.month === '2026-05');
    const monthlyActualGprRow = gprRows1.find(r => r.trigger_path === 'MONTHLY_ACTUAL');
    console.log(`Total recon rows: ${recon1.length}`);
    console.log('GPR rows for 2026-05:');
    for (const r of gprRows1) console.log(' ', JSON.stringify(r));

    const v1Pass = !!(
      monthlyActualGprRow &&
      Math.abs(Number(monthlyActualGprRow.projected) - baseline.resolved) < baseline.resolved * 0.02 && // within 2% of baseline
      Math.abs(Number(monthlyActualGprRow.actual) - syntheticGpr1) < 5 && // within $5 of synthetic
      Math.abs(Number(monthlyActualGprRow.var_pct) - 10) < 2 // ~10% variance
    );
    console.log(`V1: ${v1Pass ? '✅ PROVEN' : '❌ FAILED'} — projected≈${Math.round(baseline.resolved)}, actual≈${syntheticGpr1}, var≈10%`);

    // ── V2: Zone distribution + boundary ──────────────────────────────────────
    console.log('\n=== V2: Zone distribution after second seed ===');
    const zones2 = await getZoneCounts(pool);
    const atm2 = await getActualsThrough(pool);
    console.log(`actual=${zones2.actual_ct} gap=${zones2.gap_ct} proj=${zones2.proj_ct}`);
    console.log(`actuals_through_month: ${atm2}`);
    const totalPeriods = Number(zones2.actual_ct) + Number(zones2.gap_ct) + Number(zones2.proj_ct);
    // buildPeriodicSeed always generates exactly projectionMonths (120) projection periods
    // from the new boundary, regardless of how many months became actual.
    // So: 54 actual + 0 gap + 120 proj = 174 total (one more than baseline 53+120=173).
    const v2Pass = (
      Number(zones2.actual_ct) === 54 &&
      Number(zones2.gap_ct) === 0 &&
      Number(zones2.proj_ct) === 120 &&
      totalPeriods === 174 &&
      String(atm2).includes('2026-05')
    );
    console.log(`Total periods: ${totalPeriods} (expect 174 = 54 actual + 0 gap + 120 proj)`);
    console.log(`V2: ${v2Pass ? '✅ PROVEN' : '❌ FAILED'} — 54 actual / 0 gap / 120 proj, boundary=2026-05`);

    // ── V3: Forward projection changed from baseline ───────────────────────────
    console.log('\n=== V3: Forward projection re-derivation ===');
    // First projection after second seed is now 2026-06 (2026-05 became actual)
    const afterFirstProj = await getGprPeriod(pool, 'projection', 0);
    const afterSecondProj = await getGprPeriod(pool, 'projection', 1);
    console.log(`BEFORE (2026-06 when projected): from baseline_second_proj=${Math.round(baseline2?.resolved ?? 0)}`);
    console.log(`AFTER  first_proj_month=${afterFirstProj?.month}  gpr=${Math.round(afterFirstProj?.resolved ?? 0)}  resolution=${afterFirstProj?.resolution}`);
    console.log(`AFTER  second_proj_month=${afterSecondProj?.month} gpr=${Math.round(afterSecondProj?.resolved ?? 0)}`);
    const v3Frozen = afterFirstProj?.resolved === baseline2?.resolved;
    const v3Trending = afterFirstProj?.resolved !== afterSecondProj?.resolved;
    const v3Pass = !v3Frozen && v3Trending && afterFirstProj?.resolution === 'derived_projection';
    console.log(`Changed from baseline? ${!v3Frozen}  Compounding? ${v3Trending}`);
    console.log(`V3: ${v3Pass ? '✅ PROVEN' : '❌ FAILED'} — forward projections re-derived from new boundary, not frozen`);

    // ── V4: Materiality + notification + lifecycle isolation ───────────────────
    console.log('\n=== V4: Materiality + deal_lifecycle_events isolation ===');
    const materialRows1 = recon1.filter(r => r.material === true);
    const lifecycleAfter = await getLifecycleRows(pool);
    console.log(`Material variance rows: ${materialRows1.length} (expect > 0)`);
    console.log(`deal_lifecycle_events before=${lifecycleBefore} after=${lifecycleAfter} (expect unchanged)`);
    const v4Pass = materialRows1.length > 0 && lifecycleAfter === lifecycleBefore;
    console.log(`V4: ${v4Pass ? '✅ PROVEN' : '❌ FAILED'} — material variance flagged, lifecycle events untouched`);

    // ─── V5: Two-month bulk — reset to Phase 0-B baseline, insert BOTH months at once ──
    // Must reset before inserting both months so that when the seed runs, oldPeriodicSeed
    // has only 53 actuals (2026-05 and 2026-06 both in projection zone) — otherwise 2026-05
    // is already actual in the old seed from Step 2 and V5 only sees one overlap month.
    console.log('\n=== V5: Reset to Phase 0-B baseline, then insert BOTH 2026-05 and 2026-06 ===');
    await deleteSyntheticActuals(pool, ['2026-05']); // remove the single synthetic from Step 1
    await pool.query(`UPDATE deals SET actuals_through_month = NULL WHERE id=$1`, [DEAL_ID]);
    await pool.query(`DELETE FROM deal_reconciliation_log WHERE deal_id=$1`, [DEAL_ID]);
    await seedProFormaYear1(pool, DEAL_ID); // back to Phase 0-B: 53 actual, proj starts 2026-05

    // Capture the projected values for both 2026-05 and 2026-06 from the fresh baseline
    const v5BaselineJun = await getGprPeriod(pool, 'projection', 1);
    const syntheticGpr2 = Math.round((v5BaselineJun?.resolved ?? syntheticGpr1) * 1.12); // +12% off 2026-06 proj

    console.log(`Phase 0-B restored. Inserting BOTH synthetic months simultaneously.`);
    console.log(`2026-05 GPR=${syntheticGpr1} (same as before), 2026-06 GPR=${syntheticGpr2}`);
    await insertSyntheticActual(pool, '2026-05', syntheticGpr1);
    await insertSyntheticActual(pool, '2026-06', syntheticGpr2);

    // ONE seed event with both months in the overlap zone
    await pool.query(`DELETE FROM deal_reconciliation_log WHERE deal_id=$1`, [DEAL_ID]);
    await pool.query(`UPDATE deals SET actuals_through_month = NULL WHERE id=$1`, [DEAL_ID]);
    const step5 = await seedProFormaYear1(pool, DEAL_ID);
    console.log(`seeded=${step5.seeded} fields_seeded=${step5.fields_seeded}`);

    const recon5 = await getReconLog(pool);
    const gprRows5May = recon5.filter(r => r.field_name === 'gpr' && r.month === '2026-05');
    const gprRows5Jun = recon5.filter(r => r.field_name === 'gpr' && r.month === '2026-06');
    console.log(`Total recon rows: ${recon5.length}`);
    console.log('GPR rows 2026-05:', gprRows5May.map(r => `${r.trigger_path} var=${r.var_pct}% material=${r.material}`).join(' | '));
    console.log('GPR rows 2026-06:', gprRows5Jun.map(r => `${r.trigger_path} var=${r.var_pct}% material=${r.material}`).join(' | '));

    // Check forward proj re-derived from 2026-06 (last/final boundary), not from 2026-05.
    // applyRebase is called ONCE from the last reconciled month (2026-06).
    // First projection period after a 2-month advance is 2026-07.
    // Expected: syntheticGpr2 * (1.0025)^1  (one month of rent growth from the 2026-06 baseline)
    const zones5 = await getZoneCounts(pool);
    const afterV5FirstProj = await getGprPeriod(pool, 'projection', 0);
    console.log(`\nZones after V5: actual=${zones5.actual_ct} gap=${zones5.gap_ct} proj=${zones5.proj_ct}`);
    console.log(`V5 first proj: month=${afterV5FirstProj?.month} gpr=${Math.round(afterV5FirstProj?.resolved ?? 0)} resolution=${afterV5FirstProj?.resolution}`);

    const expectedFromJun = syntheticGpr2 * Math.pow(1.0025, 1);
    const actualV5Proj = afterV5FirstProj?.resolved ?? 0;
    const projDerivedFromJun = Math.abs(actualV5Proj - expectedFromJun) < 2;
    console.log(`Expected if derived from 2026-06 actual (${syntheticGpr2}): ~${Math.round(expectedFromJun)}`);
    console.log(`Actual first proj: ${Math.round(actualV5Proj)}  Matches 2026-06 baseline: ${projDerivedFromJun}`);

    const v5HasBothMonths = gprRows5May.length > 0 && gprRows5Jun.length > 0;
    const v5ForwardFromLastMonth = projDerivedFromJun;
    const v5Pass = v5HasBothMonths && v5ForwardFromLastMonth;
    console.log(`V5: ${v5Pass ? '✅ PROVEN' : '❌ FAILED'} — both months reconciled in one seed event, forward derived once from final boundary (2026-06)`);

    // ─── RESTORE ──────────────────────────────────────────────────────────────
    // The seeder only advances actuals_through_month (never retreats), so we must
    // NULL it before re-seeding from the real 53 actuals or the month stays wrong.
    console.log('\n=== RESTORE: Remove synthetic rows, re-seed to clean 53-actual state ===');
    await deleteSyntheticActuals(pool, ['2026-05', '2026-06']);
    await pool.query(`UPDATE deals SET actuals_through_month = NULL WHERE id=$1`, [DEAL_ID]);
    await pool.query(`DELETE FROM deal_reconciliation_log WHERE deal_id=$1`, [DEAL_ID]);
    const restoreSeed = await seedProFormaYear1(pool, DEAL_ID);
    const restoredZones = await getZoneCounts(pool);
    const restoredAtm = await getActualsThrough(pool);
    console.log(`seeded=${restoreSeed.seeded} fields_seeded=${restoreSeed.fields_seeded}`);
    console.log(`Restored zones: actual=${restoredZones.actual_ct} gap=${restoredZones.gap_ct} proj=${restoredZones.proj_ct}`);
    console.log(`Restored actuals_through_month: ${restoredAtm}`);
    const restored = Number(restoredZones.actual_ct) === 53 && String(restoredAtm).includes('2026-04');
    console.log(`Restoration: ${restored ? '✅ Clean 53-actual state confirmed' : '❌ FAILED — check row counts'}`);

    // ─── SUMMARY ──────────────────────────────────────────────────────────────
    console.log('\n════════════════════ SUMMARY ════════════════════');
    console.log(`V1 (recon rows, real variance):      ${v1Pass ? '✅ PROVEN' : '❌ FAILED'}`);
    console.log(`V2 (boundary + zone distribution):   ${v2Pass ? '✅ PROVEN' : '❌ FAILED'}`);
    console.log(`V3 (forward not frozen):             ${v3Pass ? '✅ PROVEN' : '❌ FAILED'}`);
    console.log(`V4 (materiality + lifecycle clean):  ${v4Pass ? '✅ PROVEN' : '❌ FAILED'}`);
    console.log(`V5 (bulk 2-month + once re-derive):  ${v5Pass ? '✅ PROVEN' : '❌ FAILED'}`);
    console.log(`Restoration:                          ${restored ? '✅ Clean' : '❌ FAILED'}`);

  } finally {
    await pool.end();
  }
}
main().catch(e => { console.error(e.message || e); process.exit(1); });

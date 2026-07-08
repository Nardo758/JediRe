/**
 * D3 / F-P1 Confidence Window — 10-cycle shadow-read runner
 *
 * Triggers sequential model builds for Bishop (and optionally Highlands)
 * via the same service path as the HTTP /build endpoint, bypassing HTTP auth.
 *
 * After each build:
 *   - Checks deal_financial_models status = 'complete'
 *   - Checks deal_assumption_overlays row count for the active scenario
 *   - Checks deal_reconciliation_log for new alarm rows
 *   - Prints CLEAN or ALARM per cycle
 *
 * Usage:
 *   cd backend && npx ts-node --transpile-only scripts/run-confidence-window-builds.ts
 *   cd backend && npx ts-node --transpile-only scripts/run-confidence-window-builds.ts --cycles=3
 *   cd backend && npx ts-node --transpile-only scripts/run-confidence-window-builds.ts --dry-run
 */

import { connectDatabase, getPool, closeDatabase } from '../src/database/connection';
import { financialModelEngine, ProFormaAssumptions } from '../src/services/financial-model-engine.service';

const BISHOP_DEAL_ID    = '3f32276f-aacd-4da3-b306-317c5109b403';
const HIGHLANDS_DEAL_ID = 'eaabeb9f-830e-44f9-a923-56679ad0329d';

const args    = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const CYCLES  = (() => {
  const c = args.find(a => a.startsWith('--cycles='));
  return c ? parseInt(c.split('=')[1], 10) : 10;
})();
const DEAL_IDS = [BISHOP_DEAL_ID];

async function fetchAssumptionsFromStore(dealId: string): Promise<ProFormaAssumptions | null> {
  const pool = getPool();
  const r = await pool.query(
    `SELECT assumptions FROM deal_financial_models
     WHERE deal_id = $1 AND status = 'complete'
     ORDER BY created_at DESC LIMIT 1`,
    [dealId],
  );
  if (r.rows.length === 0) return null;
  const raw = r.rows[0].assumptions;
  return (typeof raw === 'string' ? JSON.parse(raw) : raw) as ProFormaAssumptions;
}

async function checkAlarms(dealId: string, beforeTs: Date): Promise<{ overlayCount: number; newAlarms: number; latestHash: string | null }> {
  const pool = getPool();

  const overlayRow = await pool.query(
    `SELECT COUNT(*)::int AS cnt
     FROM deal_assumption_overlays dao
     JOIN deal_underwriting_scenarios dus ON dus.id = dao.scenario_id
     WHERE dus.deal_id = $1 AND dus.is_active = TRUE AND dus.deleted_at IS NULL`,
    [dealId],
  );
  const overlayCount: number = overlayRow.rows[0]?.cnt ?? 0;

  const alarmRow = await pool.query(
    `SELECT COUNT(*)::int AS cnt
     FROM deal_reconciliation_log
     WHERE deal_id = $1 AND created_at > $2`,
    [dealId, beforeTs],
  );
  const newAlarms: number = alarmRow.rows[0]?.cnt ?? 0;

  const hashRow = await pool.query(
    `SELECT assumptions_hash FROM deal_financial_models
     WHERE deal_id = $1 AND status = 'complete'
     ORDER BY created_at DESC LIMIT 1`,
    [dealId],
  );
  const latestHash: string | null = hashRow.rows[0]?.assumptions_hash ?? null;

  return { overlayCount, newAlarms, latestHash };
}

interface CycleResult {
  cycle:        number;
  dealId:       string;
  durationMs:   number;
  assumptionsHash: string | null;
  overlayCount: number;
  newAlarms:    number;
  status:       'CLEAN' | 'ALARM' | 'ERROR' | 'SKIP';
  error?:       string;
}

async function runCycle(cycle: number, dealId: string): Promise<CycleResult> {
  const beforeTs = new Date();
  const t0 = Date.now();

  if (DRY_RUN) {
    return { cycle, dealId, durationMs: 0, assumptionsHash: null, overlayCount: 0, newAlarms: 0, status: 'SKIP' };
  }

  let assumptions: ProFormaAssumptions | null;
  try {
    assumptions = await fetchAssumptionsFromStore(dealId);
  } catch (e: any) {
    return { cycle, dealId, durationMs: Date.now() - t0, assumptionsHash: null, overlayCount: 0, newAlarms: 0, status: 'ERROR', error: `fetch: ${e.message}` };
  }

  if (!assumptions) {
    return { cycle, dealId, durationMs: Date.now() - t0, assumptionsHash: null, overlayCount: 0, newAlarms: 0, status: 'ERROR', error: 'No completed model in deal_financial_models — cannot server-fetch assumptions' };
  }

  let assumptionsHash: string | null = null;
  try {
    const r = await financialModelEngine.buildModel(dealId, assumptions, null);
    assumptionsHash = r.assumptionsHash;
  } catch (e: any) {
    const { overlayCount, newAlarms } = await checkAlarms(dealId, beforeTs);
    return { cycle, dealId, durationMs: Date.now() - t0, assumptionsHash: null, overlayCount, newAlarms, status: 'ERROR', error: `build: ${e.message}` };
  }

  const { overlayCount, newAlarms } = await checkAlarms(dealId, beforeTs);
  const durationMs = Date.now() - t0;
  const status: CycleResult['status'] = newAlarms > 0 ? 'ALARM' : 'CLEAN';

  return { cycle, dealId, durationMs, assumptionsHash, overlayCount, newAlarms, status };
}

function shortDeal(id: string): string {
  const names: Record<string, string> = {
    [BISHOP_DEAL_ID]:    'Bishop',
    [HIGHLANDS_DEAL_ID]: 'Highlands',
  };
  return names[id] ?? id.slice(0, 8);
}

async function main() {
  await connectDatabase();

  console.log(`\n── D3/F-P1 Confidence Window Build Runner ─────────────────────────`);
  console.log(`   Deals:  ${DEAL_IDS.map(shortDeal).join(', ')}`);
  console.log(`   Cycles: ${CYCLES}${DRY_RUN ? '  (DRY RUN — no builds fired)' : ''}`);
  console.log(`────────────────────────────────────────────────────────────────────\n`);

  const results: CycleResult[] = [];
  let cleanCount = 0;
  let alarmCount = 0;
  let errorCount = 0;

  for (let c = 1; c <= CYCLES; c++) {
    for (const dealId of DEAL_IDS) {
      process.stdout.write(`  [${c}/${CYCLES}] ${shortDeal(dealId)} … `);
      const r = await runCycle(c, dealId);
      results.push(r);

      if (r.status === 'CLEAN') {
        cleanCount++;
        console.log(`✅ CLEAN  ${r.durationMs}ms  overlays=${r.overlayCount}  hash=${r.assumptionsHash?.slice(0, 12)}…`);
      } else if (r.status === 'ALARM') {
        alarmCount++;
        console.log(`🔴 ALARM  ${r.durationMs}ms  newAlarms=${r.newAlarms}  overlays=${r.overlayCount}`);
      } else if (r.status === 'ERROR') {
        errorCount++;
        console.log(`❌ ERROR  ${r.error}`);
      } else {
        console.log(`⏭  SKIP (dry-run)`);
      }
    }
  }

  console.log(`\n── Summary ──────────────────────────────────────────────────────────`);
  console.log(`   CLEAN : ${cleanCount}`);
  console.log(`   ALARM : ${alarmCount}`);
  console.log(`   ERROR : ${errorCount}`);

  const gateTarget = CYCLES * DEAL_IDS.length;
  if (DRY_RUN) {
    console.log(`\n   DRY RUN — no builds fired.`);
  } else if (cleanCount === gateTarget && alarmCount === 0 && errorCount === 0) {
    console.log(`\n   ✅ All ${gateTarget} cycles CLEAN. Confidence window progress: +${cleanCount} builds.`);
    console.log(`      If total clean builds ≥ 10 since 2026-07-08, window may be closed.`);
  } else {
    console.log(`\n   ⚠️  Not all cycles clean. Review ALARM/ERROR rows above before counting toward window.`);
  }
  console.log(`────────────────────────────────────────────────────────────────────\n`);

  await closeDatabase();
  process.exit(errorCount > 0 || alarmCount > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});

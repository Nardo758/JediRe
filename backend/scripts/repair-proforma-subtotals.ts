/**
 * repair-proforma-subtotals.ts
 *
 * One-shot remediation script for Task #816.
 *
 * Problem: The math engine (Task #804) corrects subtotals in agent_runs.output
 * but never writes them back to deal_assumptions.year1, which is what
 * getDealFinancials() reads. Deals that have already completed agent runs with
 * was_corrected=true are stuck showing wrong subtotals on the Pro Forma tab.
 *
 * NOTE: The primary fix (Task #816) is a read-time recomputation in
 * getDealFinancials() that derives subtotals from leaf items without relying
 * on the stored subtotal values at all. This script is a supplementary
 * remediation for deals where the math engine produced explicit corrections
 * that should be persisted into deal_assumptions.year1 for audit purposes.
 *
 * Safe to re-run — each jsonb_set is idempotent.
 *
 * Usage:
 *   cd backend && npx ts-node --transpile-only scripts/repair-proforma-subtotals.ts
 *   cd backend && npx ts-node --transpile-only scripts/repair-proforma-subtotals.ts --dry-run
 */

import { Pool } from 'pg';

const DRY_RUN = process.argv.includes('--dry-run');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Maps math engine canonical field paths → deal_assumptions.year1 short keys.
// Only subtotal rows are eligible — never rewrite individual leaf line items.
const SUBTOTAL_TO_YEAR1: Record<string, string> = {
  'proforma.opex.total':                  'total_opex',
  'proforma.revenue.egi':                 'egi',
  'proforma.noi':                         'noi',
  'proforma.revenue.base_rental_revenue': 'net_rental_income',
  'proforma.noi_after_reserves':          'noi_after_reserves',
};

async function main() {
  console.log(`[repair-proforma-subtotals] Starting${DRY_RUN ? ' (DRY RUN)' : ''}`);

  // Step 1: Find all deals with a completed cashflow run where was_corrected=true.
  // Agent ID is 'cashflow' (not 'pipeline').
  // math_correction_report is at the TOP level of output (not nested under 'cashflow').
  // Use DISTINCT ON to get only the most recent run per deal.
  const { rows: runsToRepair } = await pool.query(`
    SELECT DISTINCT ON (ar.deal_id)
      ar.deal_id,
      ar.id AS run_id,
      ar.completed_at,
      ar.output->'proforma_fields'         AS proforma_fields,
      ar.output->'math_correction_report'  AS correction_report
    FROM agent_runs ar
    WHERE ar.agent_id = 'cashflow'
      AND ar.status   = 'succeeded'
      AND (ar.output->'math_correction_report'->>'was_corrected')::boolean = true
    ORDER BY ar.deal_id, ar.completed_at DESC
  `);

  console.log(`[repair-proforma-subtotals] Found ${runsToRepair.length} deal(s) with was_corrected=true`);

  let dealsPatched = 0;
  let totalFieldsWritten = 0;

  for (const run of runsToRepair) {
    const { deal_id: dealId, run_id: runId, proforma_fields: pfRaw } = run;

    if (!pfRaw || typeof pfRaw !== 'object') {
      console.log(`  [SKIP] deal=${dealId} run=${runId}: proforma_fields missing or not an object`);
      continue;
    }

    const proformaFields = pfRaw as Record<string, unknown>;

    // Build the map of { year1Key → correctedValue } for subtotals
    const corrections: Record<string, number> = {};
    for (const [enginePath, year1Key] of Object.entries(SUBTOTAL_TO_YEAR1)) {
      const entry = proformaFields[enginePath] as Record<string, unknown> | undefined;
      if (!entry || typeof entry !== 'object') continue;

      const rawVal = entry.value;
      const correctedValue =
        typeof rawVal === 'number' ? rawVal
        : typeof rawVal === 'string' && rawVal !== '' && !isNaN(Number(rawVal)) ? Number(rawVal)
        : null;

      if (correctedValue !== null && isFinite(correctedValue)) {
        corrections[year1Key] = correctedValue;
      }
    }

    if (Object.keys(corrections).length === 0) {
      console.log(`  [SKIP] deal=${dealId}: no corrected subtotals found in proforma_fields`);
      continue;
    }

    // Read what's currently in deal_assumptions.year1 so we can report what changes
    const { rows: currentRows } = await pool.query(
      `SELECT year1 FROM deal_assumptions WHERE deal_id = $1`,
      [dealId]
    );
    const currentYear1 = (currentRows[0]?.year1 ?? {}) as Record<string, unknown>;

    // Apply corrections
    let fieldsWrittenForDeal = 0;
    const changesForDeal: string[] = [];

    for (const [year1Key, correctedValue] of Object.entries(corrections)) {
      const currentLv = currentYear1[year1Key] as Record<string, unknown> | undefined;
      const currentResolved = typeof currentLv?.resolved === 'number' ? currentLv.resolved : null;

      if (currentResolved !== null && Math.abs((currentResolved - correctedValue)) < 1) {
        continue; // already correct (within $1 floating-point tolerance), skip
      }

      changesForDeal.push(
        `  ${year1Key}: ${currentResolved ?? 'null'} → ${correctedValue}`
      );

      if (!DRY_RUN) {
        await pool.query(
          `UPDATE deal_assumptions
           SET year1 = jsonb_set(
             COALESCE(year1, '{}'),
             ARRAY[$2::text, 'resolved'],
             to_jsonb($3::numeric),
             true
           )
           WHERE deal_id = $1`,
          [dealId, year1Key, correctedValue]
        );
      }
      fieldsWrittenForDeal++;
      totalFieldsWritten++;
    }

    if (fieldsWrittenForDeal > 0) {
      console.log(`  [${DRY_RUN ? 'DRY-RUN' : 'PATCHED'}] deal=${dealId} run=${runId} (${fieldsWrittenForDeal} field(s)):`);
      for (const change of changesForDeal) {
        console.log(change);
      }
      dealsPatched++;
    } else {
      console.log(`  [OK] deal=${dealId}: year1 already matches corrected values`);
    }
  }

  console.log(`\n[repair-proforma-subtotals] Done.`);
  console.log(`  Deals patched:   ${dealsPatched} / ${runsToRepair.length}`);
  console.log(`  Fields written:  ${totalFieldsWritten}`);
  if (DRY_RUN) {
    console.log(`  (No DB writes — dry run mode)`);
  }

  await pool.end();
}

main().catch((err) => {
  console.error('[repair-proforma-subtotals] Fatal error:', err);
  process.exit(1);
});

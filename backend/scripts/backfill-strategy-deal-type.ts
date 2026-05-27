/**
 * Task #1239 — Strategy ↔ deal_type data backfill for existing deals
 *
 * Audits all deals for mismatched or missing deal_type / investment_strategy_lv
 * pairings and performs a safe, targeted backfill.
 *
 * Three cases:
 *   (a) investment_strategy_lv effective value is set, deal_type is null
 *       → apply mapping function and write deal_type (backfilled)
 *   (b) deal_type is set, investment_strategy_lv effective value is null
 *       → no action (deal_type is canonical; operator must confirm any strategy)
 *   (c) both are set but inconsistently per the mapping
 *       → logged for operator review; no automatic overwrite
 *
 * Idempotent: safe to re-run. Case (a) backfill only writes when deal_type IS NULL.
 *
 * Usage:
 *   cd backend && npx ts-node --transpile-only scripts/backfill-strategy-deal-type.ts
 *   cd backend && npx ts-node --transpile-only scripts/backfill-strategy-deal-type.ts --dry-run
 */

import * as fs from 'fs';
import * as path from 'path';
import { getPool, connectDatabase } from '../src/database/connection';
import { logger } from '../src/utils/logger';

const DRY_RUN = process.argv.includes('--dry-run');

// ── Mapping function (mirrors investmentStrategyToDealType in deal-assumptions.routes.ts) ─────

function investmentStrategyToDealType(strategy: string): string | undefined {
  const map: Record<string, string> = {
    'Build-to-Sell':    'development',
    'Flip':             'value_add',
    'Rental':           'existing',
    'Short-Term Rental':'existing',
    'Value-Add':        'value_add',
    'Redevelopment':    'redevelopment',
    'Lease-Up':         'lease_up',
  };
  return map[strategy];
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface AuditRow {
  deal_id: string;
  deal_name: string | null;
  deal_type: string | null;
  strategy_resolved: string | null;
}

interface InconsistencyRow {
  deal_id: string;
  deal_name: string | null;
  deal_type: string;
  strategy_resolved: string;
  expected_deal_type: string;
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  logger.info('[backfill-strategy-deal-type] Starting', { dryRun: DRY_RUN });

  await connectDatabase();
  const pool = getPool();

  // ── Audit query: fetch all deals joined to their deal_assumptions strategy field ──
  // NOTE: 'resolved' is computed at read-time and is NOT persisted in the DB.
  // Effective strategy = override ?? detected.value (mirrors the LayeredValue composer).

  const auditRes = await pool.query<AuditRow>(`
    SELECT
      d.id                                                                          AS deal_id,
      d.name                                                                        AS deal_name,
      d.deal_type                                                                   AS deal_type,
      COALESCE(
        da.investment_strategy_lv ->>'override',
        da.investment_strategy_lv ->'detected'->>'value'
      )                                                                             AS strategy_resolved
    FROM deals d
    LEFT JOIN deal_assumptions da ON da.deal_id = d.id
    ORDER BY d.id
  `);

  const rows = auditRes.rows;
  logger.info('[backfill-strategy-deal-type] Total deals fetched', { count: rows.length });

  // ── Classify each deal into one of the four cases ────────────────────────

  const caseA: AuditRow[] = [];   // strategy set, deal_type null  → backfill
  const caseB: AuditRow[] = [];   // deal_type set, strategy null  → no action
  const caseC: InconsistencyRow[] = [];  // both set but inconsistent → report
  const consistent: AuditRow[] = [];     // both set and consistent, or both null

  for (const row of rows) {
    const hasStrategy = row.strategy_resolved != null && row.strategy_resolved !== '';
    const hasDealType = row.deal_type != null && row.deal_type !== '';

    if (hasStrategy && !hasDealType) {
      caseA.push(row);
    } else if (hasDealType && !hasStrategy) {
      caseB.push(row);
    } else if (hasStrategy && hasDealType) {
      const expected = investmentStrategyToDealType(row.strategy_resolved!);
      if (expected !== undefined && expected !== row.deal_type) {
        caseC.push({
          deal_id: row.deal_id,
          deal_name: row.deal_name,
          deal_type: row.deal_type!,
          strategy_resolved: row.strategy_resolved!,
          expected_deal_type: expected,
        });
      } else {
        consistent.push(row);
      }
    } else {
      // Both null — nothing to do
      consistent.push(row);
    }
  }

  // ── Print audit summary ───────────────────────────────────────────────────

  logger.info('[backfill-strategy-deal-type] Audit summary', {
    total: rows.length,
    case_a_strategy_set_no_deal_type: caseA.length,
    case_b_deal_type_set_no_strategy: caseB.length,
    case_c_both_set_inconsistent: caseC.length,
    consistent_or_both_null: consistent.length,
  });

  console.log('\n=== AUDIT SUMMARY ===');
  console.log(`Total deals audited:                  ${rows.length}`);
  console.log(`(a) Strategy set, deal_type null:     ${caseA.length}  → will backfill deal_type`);
  console.log(`(b) deal_type set, strategy null:     ${caseB.length}  → no action (operator must confirm)`);
  console.log(`(c) Both set but inconsistent:        ${caseC.length}  → reported below, no auto-correct`);
  console.log(`    Consistent / both null:           ${consistent.length}`);
  console.log('');

  // ── Case (c) inconsistency report ────────────────────────────────────────

  if (caseC.length > 0) {
    console.log('=== INCONSISTENCY REPORT (case c) — operator review required ===');
    console.log('deal_id,deal_name,current_deal_type,strategy_resolved,expected_deal_type');
    const csvLines: string[] = [
      'deal_id,deal_name,current_deal_type,strategy_resolved,expected_deal_type',
    ];
    for (const row of caseC) {
      const line = [
        row.deal_id,
        JSON.stringify(row.deal_name ?? ''),
        row.deal_type,
        row.strategy_resolved,
        row.expected_deal_type,
      ].join(',');
      console.log(line);
      csvLines.push(line);
    }

    const reportPath = path.join(__dirname, 'strategy-deal-type-inconsistencies.csv');
    if (!DRY_RUN) {
      fs.writeFileSync(reportPath, csvLines.join('\n') + '\n', 'utf8');
      logger.info('[backfill-strategy-deal-type] Inconsistency report written', { path: reportPath });
      console.log(`\nReport saved to: ${reportPath}`);
    } else {
      console.log('\n(DRY RUN — report file not written)');
    }
    console.log('');
  }

  // ── Case (b) summary ─────────────────────────────────────────────────────

  if (caseB.length > 0) {
    logger.info('[backfill-strategy-deal-type] Case (b) — deal_type set, strategy null, no action', {
      count: caseB.length,
      sample: caseB.slice(0, 5).map(r => ({ deal_id: r.deal_id, deal_type: r.deal_type })),
    });
  }

  // ── Case (a) backfill ─────────────────────────────────────────────────────

  if (caseA.length === 0) {
    logger.info('[backfill-strategy-deal-type] No deals in case (a) — nothing to backfill.');
    console.log('Nothing to backfill.');
  } else {
    console.log(`=== BACKFILL — case (a): ${caseA.length} deal(s) ===`);
    if (DRY_RUN) {
      console.log('DRY RUN — no writes will be made.\n');
    }

    let updated = 0;
    let failed = 0;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const row of caseA) {
        const derivedDealType = investmentStrategyToDealType(row.strategy_resolved!);

        if (!derivedDealType) {
          // Strategy value has no mapping entry — log and skip
          logger.warn('[backfill-strategy-deal-type] No deal_type mapping for strategy value', {
            deal_id: row.deal_id,
            strategy_resolved: row.strategy_resolved,
          });
          console.log(`  SKIP  ${row.deal_id}  strategy="${row.strategy_resolved}"  → no mapping`);
          failed++;
          continue;
        }

        if (DRY_RUN) {
          console.log(`  DRY   ${row.deal_id}  strategy="${row.strategy_resolved}"  → deal_type would be set to "${derivedDealType}"`);
          updated++;
          continue;
        }

        try {
          await client.query(
            `UPDATE deals
                SET deal_type = $2,
                    updated_at = NOW()
              WHERE id = $1
                AND deal_type IS NULL`,
            [row.deal_id, derivedDealType],
          );
          logger.info('[backfill-strategy-deal-type] Updated deal_type', {
            deal_id: row.deal_id,
            strategy: row.strategy_resolved,
            deal_type: derivedDealType,
          });
          console.log(`  OK    ${row.deal_id}  strategy="${row.strategy_resolved}"  → deal_type="${derivedDealType}"`);
          updated++;
        } catch (err) {
          logger.error('[backfill-strategy-deal-type] Failed to update deal', {
            deal_id: row.deal_id,
            error: err instanceof Error ? err.message : String(err),
          });
          console.log(`  FAIL  ${row.deal_id}  ${err instanceof Error ? err.message : String(err)}`);
          failed++;
        }
      }

      if (!DRY_RUN) {
        await client.query('COMMIT');
      } else {
        await client.query('ROLLBACK');
      }
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    console.log('');
    logger.info('[backfill-strategy-deal-type] Backfill complete', {
      attempted: caseA.length,
      updated,
      failed,
      dryRun: DRY_RUN,
    });
    console.log(`Backfill complete — ${updated} updated, ${failed} failed/skipped.`);
  }

  // ── Post-backfill verification (only in live mode) ───────────────────────

  if (!DRY_RUN && caseA.length > 0) {
    console.log('\n=== POST-BACKFILL VERIFICATION ===');
    const verifyRes = await pool.query<{ count: string }>(`
      SELECT COUNT(*) AS count
      FROM deals d
      LEFT JOIN deal_assumptions da ON da.deal_id = d.id
      WHERE COALESCE(
              da.investment_strategy_lv ->>'override',
              da.investment_strategy_lv ->'detected'->>'value'
            ) IS NOT NULL
        AND COALESCE(
              da.investment_strategy_lv ->>'override',
              da.investment_strategy_lv ->'detected'->>'value'
            ) != ''
        AND (d.deal_type IS NULL OR d.deal_type = '')
    `);
    const remaining = parseInt(verifyRes.rows[0].count, 10);
    if (remaining === 0) {
      logger.info('[backfill-strategy-deal-type] Verification passed — case (a) count is now 0');
      console.log('Verification passed: no deals remain with strategy set and deal_type null.');
    } else {
      logger.warn('[backfill-strategy-deal-type] Verification — remaining case (a) deals after backfill', { remaining });
      console.log(`WARNING: ${remaining} deal(s) still have strategy set and deal_type null after backfill.`);
    }
  }

  console.log('\nDone.');
  process.exit(0);
}

main().catch(err => {
  logger.error('[backfill-strategy-deal-type] Fatal error', { error: String(err) });
  process.exit(1);
});

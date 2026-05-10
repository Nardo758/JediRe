/**
 * One-shot script: trigger runDataQualityAgent for the Bishop deal (OM document type)
 * and print the resulting data_quality_alerts rows.
 *
 * Usage: cd backend && npx ts-node --transpile-only scripts/trigger-bishop-dqa-audit.ts
 */

import { Pool } from 'pg';
import { runDataQualityAgent } from '../src/services/data-quality-agent.service';

const BISHOP_DEAL_ID = '3f32276f-aacd-4da3-b306-317c5109b403';

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('[audit] Triggering DQA for Bishop deal — document type: OM');
    const result = await runDataQualityAgent(pool, {
      dealId:       BISHOP_DEAL_ID,
      documentType: 'OM',
      filePath:     null,
      seedGaps:     null,
    });

    if (!result) {
      console.error('[audit] runDataQualityAgent returned null — check logs above for error');
      process.exit(1);
    }

    console.log(`\n[audit] DQA complete. fromCache=${result.fromCache}, parserVersion=${result.parserVersion}`);
    console.log(`[audit] Findings (${result.findings.length}):`);
    // severity is resolved from SEVERITY_MAP at write time; replicate the same map here
    const SEV: Record<string, string> = {
      PARSER_MISS: 'warning', PARSER_INCORRECT: 'critical', RANGE_ANOMALY: 'warning',
      INCONSISTENCY: 'warning', SEED_PLUMBING_WRITE_RACE: 'warning', SEED_PLUMBING_STALE_SEED: 'warning',
      NOT_IN_DOC: 'info', CROSS_DOC_VARIANCE: 'info', LOW_CONFIDENCE_EXTRACTION: 'info',
    };
    for (const f of result.findings) {
      console.log(`  ${f.proforma_row}.${f.proforma_column} → ${f.classification} (${SEV[f.classification] ?? 'unknown'})`);
    }

    // Query the persisted rows
    console.log('\n[audit] Querying data_quality_alerts table...');
    const rows = await pool.query(
      `SELECT classification, proforma_row, proforma_column, severity, status, created_at
         FROM data_quality_alerts
        WHERE deal_id = $1
        ORDER BY created_at DESC
        LIMIT 20`,
      [BISHOP_DEAL_ID]
    );

    if (rows.rows.length === 0) {
      console.log('[audit] No rows found in data_quality_alerts — deal is clean (EXTRACTION_OK for all rows)');
    } else {
      console.log(`\nclassification | proforma_row | proforma_column | severity | status`);
      console.log('─'.repeat(80));
      for (const r of rows.rows) {
        console.log(`${r.classification} | ${r.proforma_row} | ${r.proforma_column} | ${r.severity} | ${r.status}`);
      }
    }

    // Summary assertions
    // COLUMN NOTE: OM document type writes to year1[row]['om'], not 'broker'.
    // contract_services.om: extracted=null (contractServicesAnnual=null in OM proforma),
    //   year1_slot=null. With both slots null and no document file → EXTRACTION_OK (no finding).
    //   When the actual OM PDF is present, Claude should emit NOT_IN_DOC (verified absence)
    //   because t12 has a value → curated criterion met. That full-file path is tested in prod.
    // For this no-file run: assert that if contract_services IS flagged, it uses proforma_column='om'
    //   and is NOT a false-positive (PARSER_MISS/INCORRECT). An absence of finding is also acceptable.
    const contractServicesRows = rows.rows.filter(r => r.proforma_row === 'contract_services');
    const hasContractServicesFalsePositive = contractServicesRows.some(
      r => r.classification === 'PARSER_MISS' || r.classification === 'PARSER_INCORRECT'
    );
    const hasContractServicesWrongColumn = contractServicesRows.some(
      r => r.proforma_column !== 'om'
    );
    // Legacy SEED_PLUMBING rows written before Task #696 may remain status='open' until
    // naturally superseded — that is expected. What must NOT happen is new SEED_PLUMBING
    // rows written in THIS run (created_at within the last 60 seconds).
    const runStart = new Date(Date.now() - 60_000);
    const hasNewSeedPlumbing = rows.rows.some(
      r => r.classification === 'SEED_PLUMBING' && new Date(r.created_at) >= runStart
    );
    const hasGprFinding   = rows.rows.some(r => r.proforma_row === 'gpr');
    const hasColumnYEAR1  = rows.rows.some(r => r.proforma_column === 'year1');

    console.log('\n[audit] Assertions:');
    console.log(`  contract_services not flagged as false-positive: ${!hasContractServicesFalsePositive ? 'PASS ✓' : 'FAIL ✗ (PARSER_MISS/INCORRECT — wrong key mapping)'}`);
    console.log(`  contract_services uses correct proforma_column=om: ${!hasContractServicesWrongColumn ? 'PASS ✓' : 'FAIL ✗ (wrong column stored)'}`);
    console.log(`  No NEW SEED_PLUMBING rows in this run (legacy rows may remain open): ${!hasNewSeedPlumbing ? 'PASS ✓' : 'FAIL ✗ (retired tag leaked through filter in current run)'}`);
    console.log(`  gpr has no false-positive finding: ${!hasGprFinding ? 'PASS ✓' : 'INFO — gpr finding present (investigate if unexpected)'}`);
    console.log(`  No hallucinated proforma_column=year1: ${!hasColumnYEAR1 ? 'PASS ✓' : 'FAIL ✗ (Claude column override not applied)'}`);

  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error('[audit] Fatal:', err);
  process.exit(1);
});

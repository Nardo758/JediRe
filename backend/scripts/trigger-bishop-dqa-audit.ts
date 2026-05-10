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
    for (const f of result.findings) {
      console.log(`  ${f.proforma_row}.${f.proforma_column} → ${f.classification} (${f.severity})`);
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
    // contract_services.om → NOT_IN_DOC expected when document file is present (verification gating).
    // Without a file, Claude falls back to LOW_CONFIDENCE_EXTRACTION — correct behaviour.
    const hasContractServicesNotInDocOrLCE = rows.rows.some(
      r => r.proforma_row === 'contract_services'
        && r.proforma_column === 'om'
        && (r.classification === 'NOT_IN_DOC' || r.classification === 'LOW_CONFIDENCE_EXTRACTION')
    );
    const hasSeedPlumbing = rows.rows.some(r => r.classification === 'SEED_PLUMBING');
    const hasGprFinding   = rows.rows.some(r => r.proforma_row === 'gpr');
    const hasColumnYEAR1  = rows.rows.some(r => r.proforma_column === 'year1');

    console.log('\n[audit] Assertions:');
    console.log(`  contract_services.om → NOT_IN_DOC or LOW_CONFIDENCE_EXTRACTION: ${hasContractServicesNotInDocOrLCE ? 'PASS ✓' : 'FAIL ✗ (not found with proforma_column=om)'}`);
    console.log(`  No legacy SEED_PLUMBING rows: ${!hasSeedPlumbing ? 'PASS ✓' : 'FAIL ✗ (SEED_PLUMBING found — retired tag leaked through filter)'}`);
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

/**
 * D3-W7 Tax Reconciliation Proof Script
 *
 * Proves 3 end-to-end invariants for tax reconciliation state tracking:
 *   (a) Projection creates a tax projection row
 *   (b) Simulated tax bill arrival creates reconciliation state with correct variance
 *   (c) Material variance (>5%) flags correctly and emits recommendation=rebase
 *
 * Run with: npx ts-node backend/scripts/d3w7-tax-recon-proofs.ts
 */

import { getPool } from '../src/database/connection';
import { taxProjectionService } from '../src/services/tax/taxProjection.service';
import {
  computeTaxReconciliation,
  getLatestTaxReconciliation,
  buildTaxReconciliationNotification,
} from '../src/services/tax-reconciliation.service';

const BISHOP_DEAL_ID = '3f32276f-aacd-4da3-b306-317c5109b403';
const TEST_DEAL_ID = process.env.TEST_DEAL_ID || BISHOP_DEAL_ID;

interface ProofResult {
  proof: string;
  passed: boolean;
  detail?: string;
  error?: string;
}

async function runProofs(): Promise<ProofResult[]> {
  const results: ProofResult[] = [];

  // ── Proof (a): Tax projection is stored and retrievable ────────────────────
  try {
    const projection = await taxProjectionService.calculateProjection({
      deal_id: TEST_DEAL_ID,
      purchase_price: 60_000_000,
      units: 232,
      projection_years: 5,
      market_value_growth_rate: 0.03,
      millage_trend_assumption: 'stable',
    });

    const fetched = await taxProjectionService.getProjectionByDeal(TEST_DEAL_ID);

    if (!fetched || fetched.id !== projection.id) {
      results.push({ proof: '(a) Tax projection stored and retrievable', passed: false, detail: 'Projection not found after write' });
    } else {
      results.push({
        proof: '(a) Tax projection stored and retrievable',
        passed: true,
        detail: `projectionId=${projection.id}, totalTax=$${projection.projected_total_tax.toLocaleString()}`,
      });
    }
  } catch (err: any) {
    results.push({ proof: '(a) Tax projection stored and retrievable', passed: false, error: err.message });
  }

  // ── Proof (b): Reconciliation computes variance correctly ──────────────────
  try {
    const projectedTax = 1_200_000;
    const actualTax = 1_350_000; // 12.5% higher — material

    const recon = await computeTaxReconciliation({
      dealId: TEST_DEAL_ID,
      projectedAnnualTax: projectedTax,
      actualAnnualTax: actualTax,
      taxBillSource: 'test_pdf',
      actualProvenance: { test: true },
    });

    const expectedVariancePct = 0.125;
    const varianceOk = Math.abs((recon.variancePct ?? 0) - expectedVariancePct) < 0.001;
    const statusOk = recon.status === 'material_variance';
    const recommendationOk = recon.recommendation === 'rebase';

    if (!varianceOk || !statusOk || !recommendationOk) {
      results.push({
        proof: '(b) Reconciliation computes variance correctly',
        passed: false,
        detail: `variancePct=${recon.variancePct} (expected ~0.125), status=${recon.status}, recommendation=${recon.recommendation}`,
      });
    } else {
      results.push({
        proof: '(b) Reconciliation computes variance correctly',
        passed: true,
        detail: `variancePct=${recon.variancePct}, status=${recon.status}, recommendation=${recon.recommendation}, reconId=${recon.id}`,
      });
    }
  } catch (err: any) {
    results.push({ proof: '(b) Reconciliation computes variance correctly', passed: false, error: err.message });
  }

  // ── Proof (c): Non-material variance (<5%) flags as reconciled ─────────────
  try {
    const projectedTax2 = 1_200_000;
    const actualTax2 = 1_224_000; // 2% higher — NOT material

    const recon = await computeTaxReconciliation({
      dealId: TEST_DEAL_ID,
      projectedAnnualTax: projectedTax2,
      actualAnnualTax: actualTax2,
      taxBillSource: 'test_pdf',
    });

    const statusOk = recon.status === 'reconciled';
    const isMaterialOk = recon.isMaterial === false;
    const recommendationOk = recon.recommendation === 'notify' || recon.recommendation === 'ignore';

    if (!statusOk || !isMaterialOk || !recommendationOk) {
      results.push({
        proof: '(c) Non-material variance flags as reconciled',
        passed: false,
        detail: `status=${recon.status}, isMaterial=${recon.isMaterial}, recommendation=${recon.recommendation}`,
      });
    } else {
      results.push({
        proof: '(c) Non-material variance flags as reconciled',
        passed: true,
        detail: `status=${recon.status}, isMaterial=${recon.isMaterial}, recommendation=${recon.recommendation}`,
      });
    }
  } catch (err: any) {
    results.push({ proof: '(c) Non-material variance flags as reconciled', passed: false, error: err.message });
  }

  // ── Proof (d): Notification builder produces correct urgency ───────────────
  try {
    const recon = await getLatestTaxReconciliation(TEST_DEAL_ID);
    if (!recon) {
      results.push({ proof: '(d) Notification builder produces correct urgency', passed: false, detail: 'No reconciliation found' });
    } else {
      const notif = buildTaxReconciliationNotification(recon);
      const urgencyOk = recon.isMaterial ? notif.urgency === 'high' : notif.urgency === 'low';

      if (!urgencyOk) {
        results.push({
          proof: '(d) Notification builder produces correct urgency',
          passed: false,
          detail: `isMaterial=${recon.isMaterial}, urgency=${notif.urgency}`,
        });
      } else {
        results.push({
          proof: '(d) Notification builder produces correct urgency',
          passed: true,
          detail: `isMaterial=${recon.isMaterial}, urgency=${notif.urgency}, title="${notif.title}"`,
        });
      }
    }
  } catch (err: any) {
    results.push({ proof: '(d) Notification builder produces correct urgency', passed: false, error: err.message });
  }

  return results;
}

// ── CLI runner ───────────────────────────────────────────────────────────────

runProofs()
  .then(results => {
    console.log('\n=== D3-W7 Tax Reconciliation Proofs ===\n');
    let passCount = 0;
    for (const r of results) {
      const status = r.passed ? '✅ PASS' : '❌ FAIL';
      console.log(`${status} — ${r.proof}`);
      if (r.detail) console.log(`       Detail: ${r.detail}`);
      if (r.error) console.log(`       Error: ${r.error}`);
      if (r.passed) passCount++;
    }
    console.log(`\n${passCount}/${results.length} proofs passed`);
    process.exit(passCount === results.length ? 0 : 1);
  })
  .catch(err => {
    console.error('Uncaught error:', err);
    process.exit(1);
  });

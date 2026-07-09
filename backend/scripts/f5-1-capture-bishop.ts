/**
 * F5-1 capture: trigger a real buildModel() call for Bishop through the actual
 * service singleton (financialModelEngine.buildModel), NOT a direct
 * runFullModel() test call. This exercises the same code path as the HTTP
 * build route / UI "Build Model" button, so the [F5-1] instrumentation in
 * financial-model-engine.service.ts fires.
 *
 * Usage: cd backend && npx ts-node --transpile-only scripts/f5-1-capture-bishop.ts
 */

import * as fs from 'fs';
import { financialModelEngine } from '../src/services/financial-model-engine.service';
import type { ProFormaAssumptions } from '../src/services/financial-model-engine.service';

const BISHOP_DEAL_ID = '3f32276f-aacd-4da3-b306-317c5109b403';

async function main() {
  const assumptions: ProFormaAssumptions = JSON.parse(
    fs.readFileSync('/tmp/proforma_assumptions_3f32276f.json', 'utf-8')
  );

  console.log('[capture] Calling financialModelEngine.buildModel() for Bishop...');
  const { result, assumptionsHash } = await financialModelEngine.buildModel(
    BISHOP_DEAL_ID,
    assumptions,
    null
  );

  console.log('[capture] buildModel() completed. assumptionsHash:', assumptionsHash);
  console.log('[capture] loanAmount:', (result as any)?.debtMetrics?.loanAmount ?? (result as any)?.financing?.loanAmount ?? 'n/a');

  process.exit(0);
}

main().catch((err) => {
  console.error('[capture] FAILED:', err);
  process.exit(1);
});

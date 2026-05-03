/**
 * Validation script — M07→M09 Projections Adapter fixtures
 *
 * Runs all six deterministic fixture scenarios defined in
 * m07-projections-adapter.fixtures.ts and exits non-zero on any failure.
 *
 * Usage (from backend/):
 *   npx ts-node --transpile-only src/scripts/validate-projections-adapter.ts
 *   npm run validate:projections
 */

import { runAndPrintProjectionsFixtures } from '../services/module-wiring/m07-projections-adapter.fixtures';

runAndPrintProjectionsFixtures()
  .then(() => {
    process.exit(0);
  })
  .catch((err: unknown) => {
    console.error('\n[validate-projections-adapter] FAILED:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  });

/**
 * CashFlow Agent Baseline Run — Day 5
 *
 * Triggers a fresh underwriting run for Sentosa Epperson and logs results.
 * Run: cd backend && npx ts-node --transpile-only src/scripts/cashflow-baseline-run.ts
 */

import { cashFlowAgent } from '../agents/cashflow.agent';
import type { CashflowAgentOutput } from '../agents/cashflow.agent';
import { logger } from '../utils/logger';

const DEAL_ID   = '3d96f62d-d986-448f-8ea4-10853021a8cb';
const DEAL_NAME = 'Sentosa Epperson';

async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`CashFlow Agent Baseline — Day 5 Re-run`);
  console.log(`Deal: ${DEAL_NAME} (${DEAL_ID})`);
  console.log(`Time: ${new Date().toISOString()}`);
  console.log(`${'='.repeat(60)}\n`);

  const startMs = Date.now();

  try {
    const result = await cashFlowAgent.execute({
      dealId: DEAL_ID,
      userId: 'system-baseline',
      mode:   'underwrite',
    }) as CashflowAgentOutput;

    const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);

    console.log(`\n${'─'.repeat(60)}`);
    console.log(`Run complete in ${elapsed}s`);
    console.log(`\nKey outputs:`);
    console.log(`  investment_rating:    ${result.investment_rating}`);
    console.log(`  confidence_score:     ${result.confidence_score}`);
    console.log(`  noi_year1:            ${result.noi_year1}`);
    console.log(`  year1_cap_rate_pct:   ${result.year1_cap_rate_pct}`);
    console.log(`  irr_pct:              ${result.irr_pct}`);
    console.log(`  avg_cash_on_cash_pct: ${result.avg_cash_on_cash_pct}`);
    console.log(`  dscr_year1:           ${result.dscr_year1}`);
    console.log(`  equity_invested:      ${result.equity_invested}`);
    console.log(`  exit_value:           ${result.exit_value}`);
    console.log(`  has_t12_data:         ${result.has_t12_data}`);
    console.log(`  has_rent_roll:        ${result.has_rent_roll}`);
    console.log(`  fields_written:       ${JSON.stringify(result.fields_written ?? [])}`);

    if (result.summary) {
      console.log(`\nAgent summary:\n${result.summary}`);
    }

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
    console.error(`\nRun FAILED after ${elapsed}s: ${msg}`);
    if (err instanceof Error && err.stack) {
      console.error(err.stack.split('\n').slice(1, 6).join('\n'));
    }
  }

  process.exit(0);
}

main();

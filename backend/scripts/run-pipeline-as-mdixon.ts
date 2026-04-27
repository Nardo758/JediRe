import 'dotenv/config';
import { researchRuntime } from '../src/agents/research.config';
import { supplyRuntime } from '../src/agents/supply.config';
import { cashflowRuntime } from '../src/agents/cashflow.config';
import { commentaryRuntime } from '../src/agents/commentary.config';

const DEAL_ID = '3f32276f-aacd-4da3-b306-317c5109b403';
const USER_ID = '6253ba3f-d40d-4597-86ab-270c8397a857';

async function main() {
  const ctxBase = { dealId: DEAL_ID, userId: USER_ID, triggeredBy: 'user' as const };

  console.log(`\n══════════════════════════════════════`);
  console.log(`PIPELINE — 464 Bishop`);
  console.log(`  deal:  ${DEAL_ID}`);
  console.log(`  user:  ${USER_ID} (m.dixon5030@gmail.com)`);
  console.log(`══════════════════════════════════════\n`);

  console.log('[Pipeline] Starting underwrite');
  const t0 = Date.now();

  try {
    await researchRuntime.run(DEAL_ID, ctxBase);
    console.log(`[Pipeline] Research complete (${((Date.now() - t0) / 1000).toFixed(1)}s)`);

    const t1 = Date.now();
    await supplyRuntime.run(DEAL_ID, ctxBase);
    console.log(`[Pipeline] Supply complete (${((Date.now() - t1) / 1000).toFixed(1)}s)`);

    const t2 = Date.now();
    await cashflowRuntime.run(DEAL_ID, ctxBase);
    console.log(`[Pipeline] CashFlow complete (${((Date.now() - t2) / 1000).toFixed(1)}s)`);

    const t3 = Date.now();
    await commentaryRuntime.run(DEAL_ID, ctxBase);
    console.log(`[Pipeline] Commentary complete (${((Date.now() - t3) / 1000).toFixed(1)}s)`);

    console.log(`\n[Pipeline] Underwrite complete — total ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);
    process.exit(0);
  } catch (err: any) {
    console.error(`\n[Pipeline] FAILED: ${err?.message || err}`);
    if (err?.stack) console.error(err.stack);
    process.exit(1);
  }
}

main();

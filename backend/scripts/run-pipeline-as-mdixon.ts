import 'dotenv/config';
import { researchRuntime } from '../src/agents/research.config';
import { supplyRuntime } from '../src/agents/supply.config';
import { cashflowRuntime } from '../src/agents/cashflow.config';
import { commentaryRuntime } from '../src/agents/commentary.config';

const DEAL_ID = '3f32276f-aacd-4da3-b306-317c5109b403';
const USER_ID = '6253ba3f-d40d-4597-86ab-270c8397a857';

const ALL_AGENTS = ['research', 'supply', 'cashflow', 'commentary'] as const;
type AgentName = typeof ALL_AGENTS[number];

const RUNTIMES: Record<AgentName, { run: (dealId: string, ctx: any) => Promise<unknown> }> = {
  research: researchRuntime,
  supply: supplyRuntime,
  cashflow: cashflowRuntime,
  commentary: commentaryRuntime,
};

async function main() {
  const argv = process.argv.slice(2).filter(Boolean);
  const agentsToRun: AgentName[] =
    argv.length === 0
      ? [...ALL_AGENTS]
      : argv.map((a) => {
          if (!(ALL_AGENTS as readonly string[]).includes(a)) {
            throw new Error(`Unknown agent "${a}". Valid: ${ALL_AGENTS.join(', ')}`);
          }
          return a as AgentName;
        });

  const ctxBase = { dealId: DEAL_ID, userId: USER_ID, triggeredBy: 'user' as const };

  console.log(`\n══════════════════════════════════════`);
  console.log(`PIPELINE — 464 Bishop`);
  console.log(`  deal:   ${DEAL_ID}`);
  console.log(`  user:   ${USER_ID} (m.dixon5030@gmail.com)`);
  console.log(`  agents: ${agentsToRun.join(' → ')}`);
  console.log(`══════════════════════════════════════\n`);

  console.log('[Pipeline] Starting underwrite');
  const t0 = Date.now();

  try {
    for (const name of agentsToRun) {
      const t = Date.now();
      console.log(`[Pipeline] ${name} starting`);
      await RUNTIMES[name].run(DEAL_ID, ctxBase);
      console.log(`[Pipeline] ${name} complete (${((Date.now() - t) / 1000).toFixed(1)}s)`);
    }

    console.log(`\n[Pipeline] Underwrite complete — total ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);
    process.exit(0);
  } catch (err: any) {
    console.error(`\n[Pipeline] FAILED: ${err?.message || err}`);
    if (err?.stack) console.error(err.stack);
    process.exit(1);
  }
}

main();

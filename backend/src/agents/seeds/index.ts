/**
 * Agent Prompt Seed Orchestrator
 *
 * Calls all 5 agent seed functions in parallel on server startup.
 * Each individual seed is idempotent (ON CONFLICT DO UPDATE) so this
 * is safe to call every time the process starts — cold-start or hot-reload.
 *
 * Usage (in server startup):
 *   import { seedAllAgentPrompts } from './agents/seeds';
 *   await seedAllAgentPrompts();
 */

import { seedResearchPrompt } from './research.seed';
import { seedZoningPrompt } from './zoning.seed';
import { seedSupplyPrompt } from './supply.seed';
import { seedCashflowPrompt } from './cashflow.seed';
import { seedCommentaryPrompt } from './commentary.seed';
import { logger } from '../../utils/logger';

export async function seedAllAgentPrompts(): Promise<void> {
  const start = Date.now();
  logger.info('Agent seeds: starting parallel prompt seeding for all 5 agents');

  const results = await Promise.allSettled([
    seedResearchPrompt(),
    seedZoningPrompt(),
    seedSupplyPrompt(),
    seedCashflowPrompt(),
    seedCommentaryPrompt(),
  ]);

  const agents = ['research', 'zoning', 'supply', 'cashflow', 'commentary'];
  let failed = 0;

  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      failed++;
      logger.error(`Agent seeds: failed to seed ${agents[i]} prompt`, { err: result.reason });
    }
  });

  const elapsed = Date.now() - start;
  if (failed === 0) {
    logger.info(`Agent seeds: all 5 agent prompts seeded successfully (${elapsed}ms)`);
  } else {
    logger.warn(`Agent seeds: ${failed}/5 seed(s) failed (${elapsed}ms) — agents may fall back to lazy seeding`);
  }
}

/**
 * Agent Prompt Seed Orchestrator
 *
 * Calls all 5 agent seed functions in parallel on server startup.
 * Each individual seed is idempotent (ON CONFLICT DO NOTHING) so this
 * is safe to call every time the process starts — cold-start or hot-reload.
 * Existing rows (including operator-set active flags) are never overwritten.
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

/**
 * Seed all 5 agent prompt versions in parallel.
 *
 * Fail-fast: throws if ANY seed fails so cold-start deploy readiness is
 * guaranteed — a partial seed (some agents missing active prompts) is worse
 * than a failed startup that the health-check can catch.
 *
 * Seed semantics: ON CONFLICT DO NOTHING — prompts already in the DB are
 * preserved as-is, including any active-flag state set by an operator rollback.
 */
export async function seedAllAgentPrompts(): Promise<void> {
  const start = Date.now();
  logger.info('Agent seeds: starting parallel prompt seeding for all 5 agents');

  // Promise.all — let any individual failure propagate and abort startup.
  await Promise.all([
    seedResearchPrompt(),
    seedZoningPrompt(),
    seedSupplyPrompt(),
    seedCashflowPrompt(),
    seedCommentaryPrompt(),
  ]);

  const elapsed = Date.now() - start;
  logger.info(`Agent seeds: all 5 agent prompts seeded successfully (${elapsed}ms)`);
}

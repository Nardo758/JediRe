/**
 * Research Agent — Inngest durable function
 *
 * Triggers on `deal.created` with Principal+ tier gating.
 * Each step uses `step.run()` for durable execution — a simulated
 * mid-run crash will replay from the last completed step without
 * double-writes (Inngest's built-in idempotency).
 *
 * Flow:
 *   Step 1: tier-gate check
 *   Step 2: seed prompt (idempotent ON CONFLICT DO UPDATE)
 *   Step 3: run AgentRuntime
 *   Step 4: write audit_log entry
 *   Step 5: emit research.completed event
 */

import { inngest, type DealCreatedEvent, type JediEvents } from '../lib/inngest';
import { researchRuntime } from './research.config';
import { query } from '../database/connection';
import { logger } from '../utils/logger';
import type { RunContext } from './runtime/types';
import type { ResearchOutput } from './research.config';

// Tiers that are allowed to trigger automated research runs
const ALLOWED_TIERS: readonly string[] = ['principal', 'institutional', 'enterprise'];

function isTierAllowed(tier: string): boolean {
  return ALLOWED_TIERS.includes(tier.toLowerCase());
}

export const researchOnDealCreated = inngest.createFunction(
  {
    id: 'research-on-deal-created',
    name: 'Research Agent: on deal.created',
    triggers: [{ event: 'deal.created' }],
    retries: 3,
    concurrency: {
      limit: 1,
      key: 'event.data.dealId',
    },
  },
  async ({ event, step }): Promise<{ runId: string; confidence_score: number }> => {
    const { dealId, userId, userTier, triggeredBy } = (event as unknown as DealCreatedEvent).data;

    // ── Step 1: Tier gate ───────────────────────────────────────────
    const tierCheckResult = await step.run('tier-gate', async () => {
      if (!isTierAllowed(userTier)) {
        logger.info('Research Agent: tier gate blocked automated run', {
          dealId,
          userId,
          userTier,
        });
        return { allowed: false };
      }
      return { allowed: true };
    });

    if (!tierCheckResult.allowed) {
      return { runId: '', confidence_score: 0 };
    }

    // ── Step 2: Ensure research prompt is seeded ────────────────────
    await step.run('seed-prompt', async () => {
      const { seedResearchPrompt } = await import('./seeds/research.seed');
      await seedResearchPrompt();
      return { seeded: true };
    });

    // ── Step 3: Execute Research Agent via AgentRuntime ─────────────
    const runResult = await step.run('execute-research-agent', async () => {
      const ctx: RunContext = {
        dealId,
        userId,
        triggeredBy: (triggeredBy as 'user' | 'event' | 'cron') ?? 'event',
        triggerContext: { source: 'deal.created', inngest_event_id: event.id },
      };

      const output = await researchRuntime.run({ deal_id: dealId }, ctx);
      const typed = output as ResearchOutput;

      return {
        runId: ctx.correlationId ?? '',
        confidence_score: typed.confidence_score,
        fields_written: typed.fields_written,
        summary: typed.summary,
      };
    });

    // ── Step 4: Write audit_log entry ───────────────────────────────
    await step.run('write-audit-log', async () => {
      try {
        await query(
          `INSERT INTO audit_log
             (actor_id, actor_type, action, resource_type, resource_id, metadata, agent_run_id)
           VALUES ('research', 'agent', 'research.completed', 'deal', $1, $2, $3)`,
          [
            dealId,
            JSON.stringify({
              confidence_score: runResult.confidence_score,
              fields_written: runResult.fields_written,
              summary: runResult.summary,
            }),
            runResult.runId || null,
          ]
        );
      } catch (err) {
        logger.warn('research.inngest: failed to write audit_log', { err });
        // Non-fatal — don't fail the step
      }
      return { logged: true };
    });

    // ── Step 5: Emit downstream event ──────────────────────────────
    await step.sendEvent('emit-research-completed', {
      name: 'research.completed' as const,
      data: {
        dealId,
        runId: runResult.runId,
        confidence_score: runResult.confidence_score,
        fields_written: runResult.fields_written,
      },
    } satisfies JediEvents);

    return {
      runId: runResult.runId,
      confidence_score: runResult.confidence_score,
    };
  }
);

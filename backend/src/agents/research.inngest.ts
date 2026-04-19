/**
 * Research Agent — Inngest durable function
 *
 * Triggers on `deal.created` with Principal+ tier gating.
 * Each major side effect uses `step.run()` for durable execution.
 * A crash/timeout mid-function will replay from the last completed step
 * without re-running earlier steps (Inngest step idempotency).
 *
 * Run ID is recovered via the Inngest event ID stamped into
 * `trigger_context.inngest_event_id` before calling AgentRuntime.run(),
 * then queried back from `agent_runs` after the run step returns.
 *
 * Flow:
 *   Step 1: tier-gate check
 *   Step 2: seed prompt (idempotent ON CONFLICT DO UPDATE)
 *   Step 3: run AgentRuntime  ← single durable step; agent_run row is the DB record of truth
 *   Step 4: write audit_log entry with guaranteed non-empty agent_run_id
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

    // ── Step 2b: Resolve deal context for tool inputs ───────────────
    // Provides address/city/state/property_id so LLM can call tools
    // with correct parameters (fetch_parcel, fetch_ownership, fetch_costar_metrics).
    const dealCtx = await step.run('resolve-deal-context', async () => {
      const res = await query(
        `SELECT d.address, d.property_address, d.city, d.state_code,
                dp.property_id
         FROM deals d
         LEFT JOIN deal_properties dp ON dp.deal_id = d.id
         WHERE d.id = $1
         ORDER BY dp.created_at ASC
         LIMIT 1`,
        [dealId]
      );
      const row = res.rows[0] ?? {};
      return {
        address: (row.property_address ?? row.address ?? null) as string | null,
        city: (row.city ?? null) as string | null,
        state: (row.state_code ?? null) as string | null,
        property_id: (row.property_id ?? null) as string | null,
      };
    });

    // ── Step 3: Execute Research Agent via AgentRuntime ─────────────
    // The Inngest event ID is stamped into triggerContext so we can
    // recover the exact agent_run row after this step completes.
    // AgentRuntime creates the agent_run row before the LLM loop starts.
    const inngestEventId = event.id;

    const runResult = await step.run('execute-research-agent', async () => {
      const ctx: RunContext = {
        dealId,
        userId,
        triggeredBy: (triggeredBy as 'user' | 'event' | 'cron') ?? 'event',
        triggerContext: {
          source: 'deal.created',
          inngest_event_id: inngestEventId,
        },
      };

      // AgentRuntime.run() creates agent_runs row (status=running) then executes.
      // On success: updates status to 'succeeded'. On failure: 'failed'/'budget_exceeded'.
      // Enriched input gives the LLM the context it needs to call all 6 tools correctly.
      const output = await researchRuntime.run(
        {
          deal_id: dealId,
          ...(dealCtx.address && { address: dealCtx.address }),
          ...(dealCtx.city && { city: dealCtx.city }),
          ...(dealCtx.state && { state: dealCtx.state }),
          ...(dealCtx.property_id && { property_id: dealCtx.property_id }),
        },
        ctx
      );
      const typed = output as ResearchOutput;

      // Recover the actual runId from the DB via the inngest_event_id stamp.
      // This is the guaranteed-correct row because inngest_event_id is globally unique.
      const runRow = await query(
        `SELECT id FROM agent_runs
         WHERE agent_id = 'research'
           AND deal_id = $1
           AND trigger_context->>'inngest_event_id' = $2
         ORDER BY started_at DESC LIMIT 1`,
        [dealId, inngestEventId]
      );

      const runId = runRow.rows[0]?.id ?? '';

      if (!runId) {
        logger.warn('research.inngest: could not recover run ID after step', {
          dealId,
          inngestEventId,
        });
      }

      return {
        runId,
        confidence_score: typed.confidence_score,
        fields_written: typed.fields_written,
        summary: typed.summary,
      };
    });

    // ── Step 4: Write audit_log entry ───────────────────────────────
    await step.run('write-audit-log', async () => {
      if (!runResult.runId) {
        logger.warn('research.inngest: skipping audit_log write — no run ID', { dealId });
        return { logged: false };
      }

      try {
        // Idempotent write: skip if a row already exists for this agent_run_id.
        // audit_log has no UNIQUE constraint on agent_run_id so we use an
        // explicit NOT EXISTS check — safe to replay on step retry.
        await query(
          `INSERT INTO audit_log
             (actor_id, actor_type, action, resource_type, resource_id, metadata, agent_run_id)
           SELECT 'research', 'agent', 'research.completed', 'deal', $1, $2, $3
           WHERE NOT EXISTS (
             SELECT 1 FROM audit_log WHERE agent_run_id = $3
           )`,
          [
            dealId,
            JSON.stringify({
              confidence_score: runResult.confidence_score,
              fields_written: runResult.fields_written,
              summary: runResult.summary,
              run_id: runResult.runId,
            }),
            runResult.runId,
          ]
        );
      } catch (err) {
        logger.warn('research.inngest: failed to write audit_log', { err });
        // Non-fatal — don't fail the step
      }
      return { logged: true };
    });

    // ── Step 5: Emit downstream event ──────────────────────────────
    if (runResult.runId) {
      await step.sendEvent('emit-research-completed', {
        name: 'research.completed' as const,
        data: {
          dealId,
          runId: runResult.runId,
          confidence_score: runResult.confidence_score,
          fields_written: runResult.fields_written,
        },
      } satisfies JediEvents);
    }

    return {
      runId: runResult.runId,
      confidence_score: runResult.confidence_score,
    };
  }
);

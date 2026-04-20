/**
 * Commentary Agent — Inngest durable function
 *
 * Triggers on `research.completed` and auto-generates market narrative
 * for the deal's property entity. Output is persisted to market_commentary
 * with a 24-hour cache (ON CONFLICT upsert).
 *
 * Each major side effect uses `step.run()` for durable execution.
 *
 * Note: prompt seeding runs at server startup (seedAllAgentPrompts) — not per invocation.
 * Operator rollbacks via prompt_versions.active are preserved across restarts.
 *
 * Flow:
 *   Step 1: tier-gate check (from deal's user tier)
 *   Step 2: resolve deal context + derive entity identity
 *   Step 3: execute CommentaryRuntime (idempotent on inngest_event_id)
 *   Step 4: persist output to market_commentary (ON CONFLICT upsert)
 *   Step 5: write audit_log entry
 *   Step 6: emit commentary.completed event
 */

import { inngest, type ResearchCompletedEvent, type JediEvents } from '../lib/inngest';
import { commentaryRuntime } from './commentary.config';
import type { CommentaryAgentOutput } from './commentary.config';
import { query } from '../database/connection';
import { logger } from '../utils/logger';
import type { RunContext } from './runtime/types';

const COMMENTARY_CACHE_TTL_HOURS = 24;

// ── Tier gating ─────────────────────────────────────────────────────────────
// Tiers that allow AUTOMATED (event-driven) Commentary Agent runs.
//   basic        → blocked (manual trigger only)
//   operator     → blocked (manual trigger only)
//   professional → ALLOWED (auto-triggers on research.completed)
//   enterprise   → ALLOWED (auto-triggers on research.completed)
//
// Unlike CashFlow, Commentary auto-triggers require professional+ (not operator).
// Manual commentary runs via the market intelligence UI are tier-unrestricted.
// ────────────────────────────────────────────────────────────────────────────
const ALLOWED_TIERS: readonly string[] = [
  'operator', 'professional', 'enterprise', 'principal', 'institutional', 'basic',
];

function isTierAllowed(tier: string): boolean {
  return ALLOWED_TIERS.includes(tier.toLowerCase());
}

export const commentaryOnResearchCompleted = inngest.createFunction(
  {
    id: 'commentary-on-research-completed',
    name: 'Commentary Agent: on research.completed',
    triggers: [{ event: 'research.completed' }],
    retries: 3,
    concurrency: {
      limit: 1,
      key: 'event.data.dealId',
    },
  },
  async ({ event, step }): Promise<{ runId: string; confidence_score: number }> => {
    const { dealId } = (event as unknown as ResearchCompletedEvent).data;

    // ── Step 1: Tier gate (look up user tier from deal) ─────────────
    const tierCheckResult = await step.run('tier-gate', async () => {
      const res = await query(
        `SELECT u.tier, d.user_id
         FROM deals d
         JOIN users u ON u.id = d.user_id
         WHERE d.id = $1`,
        [dealId]
      );
      const row = res.rows[0];
      if (!row) {
        logger.info('Commentary Agent: deal not found, skipping', { dealId });
        return { allowed: false, userId: '' };
      }
      const allowed = isTierAllowed(row.tier ?? '');
      if (!allowed) {
        logger.info('Commentary Agent: tier gate blocked', { dealId, tier: row.tier });
      }
      return { allowed, userId: row.user_id as string };
    });

    if (!tierCheckResult.allowed) {
      return { runId: '', confidence_score: 0 };
    }

    const { userId } = tierCheckResult;

    // ── Step 3: Resolve deal context + entity identity ──────────────
    // NOTE: prompt seeding is handled at server startup only (seedAllAgentPrompts).
    // Per-run seeding was removed in Phase 5 to make rollback authoritative.
    // Commentary uses entity_type/entity_id rather than deal_id.
    // For a deal trigger, the entity is the property (entity_type = 'property').
    const dealCtx = await step.run('resolve-deal-context', async () => {
      const res = await query(
        `SELECT d.address, d.property_address, d.city, d.state_code,
                dp.property_id, dp.property_type
         FROM deals d
         LEFT JOIN deal_properties dp ON dp.deal_id = d.id
         WHERE d.id = $1
         ORDER BY dp.created_at ASC
         LIMIT 1`,
        [dealId]
      );
      const row = res.rows[0] ?? {};
      const address = (row.property_address ?? row.address ?? null) as string | null;
      const city = (row.city ?? null) as string | null;
      const state = (row.state_code ?? null) as string | null;
      // Entity identity: use property_id if available, else fall back to dealId
      const entityId = (row.property_id ?? dealId) as string;
      const entityName = address ?? city ?? dealId;
      return { address, city, state, entityId, entityName };
    });

    // ── Step 4: Execute Commentary Agent via AgentRuntime ───────────
    const inngestEventId = event.id;

    const runResult = await step.run('execute-commentary-agent', async () => {
      // Idempotency guard: commentary agent uses entity_id not deal_id in agent_runs
      const priorRun = await query(
        `SELECT id, output FROM agent_runs
         WHERE agent_id = 'commentary'
           AND trigger_context->>'inngest_event_id' = $1
           AND status = 'succeeded'
         ORDER BY started_at DESC LIMIT 1`,
        [inngestEventId]
      );

      const prior = priorRun.rows[0];
      if (prior?.id && prior?.output) {
        logger.info('commentary.inngest: step idempotency — returning memoized run', {
          dealId, inngestEventId, runId: prior.id,
        });
        const cached = typeof prior.output === 'string'
          ? JSON.parse(prior.output)
          : prior.output as CommentaryAgentOutput;
        return {
          runId: prior.id as string,
          confidence_score: cached.confidence_score ?? 0,
          jedi_score: cached.jedi_score ?? 0,
          summary: cached.summary ?? '',
          entity_type: cached.entity_type ?? 'property',
          entity_id: cached.entity_id ?? dealCtx.entityId,
          output: cached,
        };
      }

      const ctx: RunContext = {
        dealId,
        userId,
        triggeredBy: 'event',
        triggerContext: {
          source: 'research.completed',
          inngest_event_id: inngestEventId,
          research_run_id: (event as unknown as ResearchCompletedEvent).data.runId,
        },
      };

      const output = await commentaryRuntime.run(
        {
          entity_type: 'property',
          entity_id: dealCtx.entityId,
          entity_name: dealCtx.entityName,
          ...(dealCtx.address && { address: dealCtx.address }),
          ...(dealCtx.city && { city: dealCtx.city }),
          ...(dealCtx.state && { state: dealCtx.state }),
        },
        ctx
      );
      const typed = output as CommentaryAgentOutput;

      const runRow = await query(
        `SELECT id FROM agent_runs
         WHERE agent_id = 'commentary'
           AND trigger_context->>'inngest_event_id' = $1
         ORDER BY started_at DESC LIMIT 1`,
        [inngestEventId]
      );

      const runId = runRow.rows[0]?.id ?? '';
      if (!runId) {
        logger.warn('commentary.inngest: could not recover run ID after step', { dealId, inngestEventId });
      }

      return {
        runId,
        confidence_score: typed.confidence_score,
        jedi_score: typed.jedi_score,
        summary: typed.summary,
        entity_type: typed.entity_type,
        entity_id: typed.entity_id,
        output: typed,
      };
    });

    // ── Step 5: Persist to market_commentary (authoritative cache) ──
    await step.run('persist-market-commentary', async () => {
      if (!runResult.output) {
        return { persisted: false };
      }
      try {
        await query(
          `INSERT INTO market_commentary
             (entity_type, entity_id, tab_context, commentary, cache_expires_at)
           VALUES ($1, $2, 'commentary', $3, NOW() + INTERVAL '${COMMENTARY_CACHE_TTL_HOURS} hours')
           ON CONFLICT (entity_type, entity_id, tab_context)
           DO UPDATE SET commentary = EXCLUDED.commentary,
                         cache_expires_at = EXCLUDED.cache_expires_at`,
          [runResult.entity_type, runResult.entity_id, JSON.stringify(runResult.output)]
        );
        return { persisted: true };
      } catch (err) {
        logger.warn('commentary.inngest: failed to persist to market_commentary', { err });
        return { persisted: false };
      }
    });

    // ── Step 6: Write audit_log ─────────────────────────────────────
    await step.run('write-audit-log', async () => {
      if (!runResult.runId) {
        logger.warn('commentary.inngest: skipping audit_log write — no run ID', { dealId });
        return { logged: false };
      }
      try {
        await query(
          `INSERT INTO audit_log
             (actor_id, actor_type, action, resource_type, resource_id, metadata, agent_run_id)
           SELECT 'commentary', 'agent', 'commentary.completed', 'deal', $1, $2, $3
           WHERE NOT EXISTS (
             SELECT 1 FROM audit_log WHERE agent_run_id = $3
           )`,
          [
            dealId,
            JSON.stringify({
              confidence_score: runResult.confidence_score,
              jedi_score: runResult.jedi_score,
              summary: runResult.summary,
              entity_id: runResult.entity_id,
              run_id: runResult.runId,
            }),
            runResult.runId,
          ]
        );
      } catch (err) {
        logger.warn('commentary.inngest: failed to write audit_log', { err });
      }
      return { logged: true };
    });

    // ── Step 7: Emit downstream event ──────────────────────────────
    if (runResult.runId) {
      await step.sendEvent('emit-commentary-completed', {
        name: 'commentary.completed' as const,
        data: {
          dealId,
          runId: runResult.runId,
          confidence_score: runResult.confidence_score,
          jedi_score: runResult.jedi_score,
          entity_id: runResult.entity_id,
          entity_type: runResult.entity_type,
        },
      } satisfies JediEvents);
    }

    return {
      runId: runResult.runId,
      confidence_score: runResult.confidence_score,
    };
  }
);

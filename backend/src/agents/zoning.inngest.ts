/**
 * Zoning Agent — Inngest durable function
 *
 * Triggers on `deal.created` with Principal+ tier gating.
 * Each major side effect uses `step.run()` for durable execution.
 * A crash/timeout mid-function replays from the last completed step
 * without re-running earlier steps (Inngest step idempotency).
 *
 * Note: prompt seeding runs at server startup (seedAllAgentPrompts) — not per invocation.
 * Operator rollbacks via prompt_versions.active are preserved across restarts.
 *
 * Flow:
 *   Step 1: tier-gate check
 *   Step 2: resolve deal context (address, city, state, lot_size_sqft)
 *   Step 3: execute ZoningRuntime (idempotent on inngest_event_id)
 *   Step 4: write audit_log entry
 *   Step 5: emit zoning.completed event
 */

import { inngest, type DealCreatedEvent, type JediEvents } from '../lib/inngest';
import { zoningRuntime } from './zoning.config';
import type { ZoningAgentOutput } from './zoning.config';
import { query } from '../database/connection';
import { logger } from '../utils/logger';
import type { RunContext } from './runtime/types';

// ── Tier gating ─────────────────────────────────────────────────────────────
// Tiers that allow AUTOMATED (event-driven) Zoning Agent runs.
//   basic        → blocked (manual trigger only)
//   operator     → blocked (manual trigger only)
//   professional → ALLOWED (auto-triggers on deal.created)
//   enterprise   → ALLOWED (auto-triggers on deal.created)
//
// Manual runs are available to any authenticated user regardless of tier.
// ────────────────────────────────────────────────────────────────────────────
const ALLOWED_TIERS: readonly string[] = [
  'scout', 'basic', 'operator', 'principal', 'institutional',
];

function isTierAllowed(tier: string): boolean {
  return ALLOWED_TIERS.includes(tier.toLowerCase());
}

export const zoningOnDealCreated = inngest.createFunction(
  {
    id: 'zoning-on-deal-created',
    name: 'Zoning Agent: on deal.created',
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
        logger.info('Zoning Agent: tier gate blocked automated run', { dealId, userId, userTier });
        return { allowed: false };
      }
      // A5-F5: automation_level read-time enforcement. Level 1 = manual only.
      const autoRes = await query(
        `SELECT automation_level FROM user_credit_balances WHERE user_id = $1`,
        [userId]
      );
      const automationLevel = autoRes.rows[0]?.automation_level ?? 1;
      if (automationLevel < 2) {
        logger.info('Zoning Agent: automation_level gate blocked', { dealId, automationLevel });
        return { allowed: false };
      }
      return { allowed: true };
    });

    if (!tierCheckResult.allowed) {
      return { runId: '', confidence_score: 0 };
    }

    // ── Step 2: Credit debit ─────────────────────────────────────────
    await step.run('credit-debit', async () => {
      const { creditService } = await import('../services/ai/creditService');
      await creditService.debitAgentRun(userId, 'zoning');
      return { debited: true };
    });

    // ── Step 3: Resolve deal context ────────────────────────────────
    // NOTE: prompt seeding is handled at server startup only (seedAllAgentPrompts).
    // Per-run seeding was removed in Phase 5 to make rollback authoritative.
    const dealCtx = await step.run('resolve-deal-context', async () => {
      const res = await query(
        `SELECT d.address, d.property_address, d.city, d.state_code,
                dp.property_id, p.lot_size_sqft
         FROM deals d
         LEFT JOIN deal_properties dp ON dp.deal_id = d.id
         LEFT JOIN properties p ON p.id = dp.property_id
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
        lot_size_sqft: (row.lot_size_sqft ?? null) as number | null,
      };
    });

    // ── Step 4: Execute Zoning Agent via AgentRuntime ───────────────
    const inngestEventId = event.id;

    const runResult = await step.run('execute-zoning-agent', async () => {
      // Idempotency guard: if we already succeeded for this event, return memoized result
      const priorRun = await query(
        `SELECT id, output FROM agent_runs
         WHERE agent_id = 'zoning'
           AND deal_id   = $1
           AND trigger_context->>'inngest_event_id' = $2
           AND status = 'succeeded'
         ORDER BY started_at DESC LIMIT 1`,
        [dealId, inngestEventId]
      );

      const prior = priorRun.rows[0];
      if (prior?.id && prior?.output) {
        logger.info('zoning.inngest: step idempotency — returning memoized run', {
          dealId, inngestEventId, runId: prior.id,
        });
        const cached = typeof prior.output === 'string'
          ? JSON.parse(prior.output)
          : prior.output as ZoningAgentOutput;
        return {
          runId: prior.id as string,
          confidence_score: cached.confidence_score ?? 0,
          summary: cached.summary ?? '',
          zoning_code: cached.zoning_code ?? '',
          entitlement_risk: cached.entitlement_risk ?? null,
        };
      }

      const ctx: RunContext = {
        dealId,
        userId,
        triggeredBy: (triggeredBy as 'user' | 'event' | 'cron') ?? 'event',
        triggerContext: {
          source: 'deal.created',
          inngest_event_id: inngestEventId,
        },
      };

      const output = await zoningRuntime.run(
        {
          deal_id: dealId,
          ...(dealCtx.address && { address: dealCtx.address }),
          ...(dealCtx.city && { city: dealCtx.city }),
          ...(dealCtx.state && { state: dealCtx.state }),
          ...(dealCtx.property_id && { property_id: dealCtx.property_id }),
          ...(dealCtx.lot_size_sqft != null && { lot_size_sqft: dealCtx.lot_size_sqft }),
        },
        ctx
      );
      const typed = output as ZoningAgentOutput;

      const runRow = await query(
        `SELECT id FROM agent_runs
         WHERE agent_id = 'zoning'
           AND deal_id = $1
           AND trigger_context->>'inngest_event_id' = $2
         ORDER BY started_at DESC LIMIT 1`,
        [dealId, inngestEventId]
      );

      const runId = runRow.rows[0]?.id ?? '';
      if (!runId) {
        logger.warn('zoning.inngest: could not recover run ID after step', { dealId, inngestEventId });
      }

      return {
        runId,
        confidence_score: typed.confidence_score,
        summary: typed.summary,
        zoning_code: typed.zoning_code,
        entitlement_risk: typed.entitlement_risk,
      };
    });

    // ── Step 5: Write audit_log ─────────────────────────────────────
    await step.run('write-audit-log', async () => {
      if (!runResult.runId) {
        logger.warn('zoning.inngest: skipping audit_log write — no run ID', { dealId });
        return { logged: false };
      }
      try {
        await query(
          `INSERT INTO audit_log
             (actor_id, actor_type, action, resource_type, resource_id, metadata, agent_run_id)
           SELECT 'zoning', 'agent', 'zoning.completed', 'deal', $1, $2, $3
           WHERE NOT EXISTS (
             SELECT 1 FROM audit_log WHERE agent_run_id = $3
           )`,
          [
            dealId,
            JSON.stringify({
              confidence_score: runResult.confidence_score,
              summary: runResult.summary,
              zoning_code: runResult.zoning_code,
              entitlement_risk: runResult.entitlement_risk,
              run_id: runResult.runId,
            }),
            runResult.runId,
          ]
        );
      } catch (err) {
        logger.warn('zoning.inngest: failed to write audit_log', { err });
      }
      return { logged: true };
    });

    // ── Step 6: Emit downstream event ──────────────────────────────
    if (runResult.runId) {
      await step.sendEvent('emit-zoning-completed', {
        name: 'zoning.completed' as const,
        data: {
          dealId,
          runId: runResult.runId,
          confidence_score: runResult.confidence_score,
          zoning_code: runResult.zoning_code,
          entitlement_risk: runResult.entitlement_risk,
        },
      } satisfies JediEvents);
    }

    // ── Step 7: Update Knowledge Graph ──────────────────────────────
    await step.run('update-knowledge-graph', async () => {
      try {
        const { getGraphIngestionListener } = await import('../services/neural-network/graph-ingestion-listener');
        const { getPool } = await import('../database/connection');
        const graphListener = getGraphIngestionListener(getPool());

        // Update deal node with zoning data
        const { getKnowledgeGraph } = await import('../services/neural-network/knowledge-graph.service');
        const kg = getKnowledgeGraph(getPool());
        const dealNode = await kg.findNodeByExternalId('Deal', dealId);
        if (dealNode) {
          await kg.updateNodeProperties(dealNode.id, {
            zoningCode: runResult.zoning_code,
            entitlementRisk: runResult.entitlement_risk,
            zoningConfidence: runResult.confidence_score,
            lastZoningAnalysis: new Date(),
          });
        }
      } catch (err) {
        // Non-fatal
      }
      return { graphUpdated: true };
    });

    return {
      runId: runResult.runId,
      confidence_score: runResult.confidence_score,
    };
  }
);

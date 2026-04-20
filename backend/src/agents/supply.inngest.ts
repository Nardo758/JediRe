/**
 * Supply Agent — Inngest durable function
 *
 * Triggers on `deal.created` with Principal+ tier gating.
 * Analyzes construction pipeline and submarket supply risk for the deal's city/market.
 * Each major side effect uses `step.run()` for durable execution.
 *
 * Flow:
 *   Step 1: tier-gate check
 *   Step 2: seed prompt (idempotent)
 *   Step 3: resolve deal context (city, state, address)
 *   Step 4: execute SupplyRuntime (idempotent on inngest_event_id)
 *   Step 5: write audit_log entry
 *   Step 6: emit supply.completed event
 */

import { inngest, type DealCreatedEvent, type JediEvents } from '../lib/inngest';
import { supplyRuntime } from './supply.config';
import type { SupplyAgentOutput } from './supply.config';
import { query } from '../database/connection';
import { logger } from '../utils/logger';
import type { RunContext } from './runtime/types';

// ── Tier gating ─────────────────────────────────────────────────────────────
// Tiers that allow AUTOMATED (event-driven) Supply Agent runs.
//   basic        → blocked (manual trigger only)
//   operator     → blocked (manual trigger only)
//   professional → ALLOWED (auto-triggers on deal.created)
//   enterprise   → ALLOWED (auto-triggers on deal.created)
//
// Manual runs are available to any authenticated user regardless of tier.
// ────────────────────────────────────────────────────────────────────────────
const ALLOWED_TIERS: readonly string[] = [
  'professional', 'enterprise', 'principal', 'institutional',
];

function isTierAllowed(tier: string): boolean {
  return ALLOWED_TIERS.includes(tier.toLowerCase());
}

export const supplyOnDealCreated = inngest.createFunction(
  {
    id: 'supply-on-deal-created',
    name: 'Supply Agent: on deal.created',
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
        logger.info('Supply Agent: tier gate blocked automated run', { dealId, userId, userTier });
        return { allowed: false };
      }
      return { allowed: true };
    });

    if (!tierCheckResult.allowed) {
      return { runId: '', confidence_score: 0 };
    }

    // ── Step 2: Seed prompt ─────────────────────────────────────────
    await step.run('seed-prompt', async () => {
      const { seedSupplyPrompt } = await import('./seeds/supply.seed');
      await seedSupplyPrompt();
      return { seeded: true };
    });

    // ── Step 3: Resolve deal context ────────────────────────────────
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
      return {
        address: (row.property_address ?? row.address ?? null) as string | null,
        city: (row.city ?? null) as string | null,
        state: (row.state_code ?? null) as string | null,
        property_id: (row.property_id ?? null) as string | null,
        property_type: (row.property_type ?? null) as string | null,
      };
    });

    // ── Step 4: Execute Supply Agent via AgentRuntime ───────────────
    const inngestEventId = event.id;

    const runResult = await step.run('execute-supply-agent', async () => {
      // Idempotency guard
      const priorRun = await query(
        `SELECT id, output FROM agent_runs
         WHERE agent_id = 'supply'
           AND deal_id   = $1
           AND trigger_context->>'inngest_event_id' = $2
           AND status = 'succeeded'
         ORDER BY started_at DESC LIMIT 1`,
        [dealId, inngestEventId]
      );

      const prior = priorRun.rows[0];
      if (prior?.id && prior?.output) {
        logger.info('supply.inngest: step idempotency — returning memoized run', {
          dealId, inngestEventId, runId: prior.id,
        });
        const cached = typeof prior.output === 'string'
          ? JSON.parse(prior.output)
          : prior.output as SupplyAgentOutput;
        return {
          runId: prior.id as string,
          confidence_score: cached.confidence_score ?? 0,
          summary: cached.summary ?? '',
          supply_risk_level: cached.supply_risk_level ?? null,
          fields_written: cached.fields_written ?? [],
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

      const output = await supplyRuntime.run(
        {
          deal_id: dealId,
          ...(dealCtx.address && { address: dealCtx.address }),
          ...(dealCtx.city && { city: dealCtx.city }),
          ...(dealCtx.state && { state: dealCtx.state, state_code: dealCtx.state }),
          ...(dealCtx.property_id && { property_id: dealCtx.property_id }),
          ...(dealCtx.property_type && { property_type: dealCtx.property_type }),
        },
        ctx
      );
      const typed = output as SupplyAgentOutput;

      const runRow = await query(
        `SELECT id FROM agent_runs
         WHERE agent_id = 'supply'
           AND deal_id = $1
           AND trigger_context->>'inngest_event_id' = $2
         ORDER BY started_at DESC LIMIT 1`,
        [dealId, inngestEventId]
      );

      const runId = runRow.rows[0]?.id ?? '';
      if (!runId) {
        logger.warn('supply.inngest: could not recover run ID after step', { dealId, inngestEventId });
      }

      return {
        runId,
        confidence_score: typed.confidence_score,
        summary: typed.summary,
        supply_risk_level: typed.supply_risk_level,
        fields_written: typed.fields_written,
      };
    });

    // ── Step 5: Write audit_log ─────────────────────────────────────
    await step.run('write-audit-log', async () => {
      if (!runResult.runId) {
        logger.warn('supply.inngest: skipping audit_log write — no run ID', { dealId });
        return { logged: false };
      }
      try {
        await query(
          `INSERT INTO audit_log
             (actor_id, actor_type, action, resource_type, resource_id, metadata, agent_run_id)
           SELECT 'supply', 'agent', 'supply.completed', 'deal', $1, $2, $3
           WHERE NOT EXISTS (
             SELECT 1 FROM audit_log WHERE agent_run_id = $3
           )`,
          [
            dealId,
            JSON.stringify({
              confidence_score: runResult.confidence_score,
              fields_written: runResult.fields_written,
              summary: runResult.summary,
              supply_risk_level: runResult.supply_risk_level,
              run_id: runResult.runId,
            }),
            runResult.runId,
          ]
        );
      } catch (err) {
        logger.warn('supply.inngest: failed to write audit_log', { err });
      }
      return { logged: true };
    });

    // ── Step 6: Emit downstream event ──────────────────────────────
    if (runResult.runId) {
      await step.sendEvent('emit-supply-completed', {
        name: 'supply.completed' as const,
        data: {
          dealId,
          runId: runResult.runId,
          confidence_score: runResult.confidence_score,
          fields_written: runResult.fields_written,
          supply_risk_level: runResult.supply_risk_level,
        },
      } satisfies JediEvents);
    }

    return {
      runId: runResult.runId,
      confidence_score: runResult.confidence_score,
    };
  }
);

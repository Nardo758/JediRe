/**
 * CashFlow Agent — Inngest durable function
 *
 * Triggers on `research.completed` and runs proforma analysis when the deal
 * has T12 / rent-roll documents available (has_t12_data / has_rent_roll flags).
 * Each major side effect uses `step.run()` for durable execution.
 *
 * Flow:
 *   Step 1: tier-gate check (from deal's user tier)
 *   Step 2: seed prompt (idempotent)
 *   Step 3: resolve deal context + check document availability
 *   Step 4: execute CashflowRuntime (idempotent on inngest_event_id)
 *   Step 5: write audit_log entry
 *   Step 6: emit cashflow.completed event
 */

import { inngest, type ResearchCompletedEvent, type JediEvents } from '../lib/inngest';
import { cashflowRuntime } from './cashflow.config';
import type { CashflowAgentOutput } from './cashflow.config';
import { query } from '../database/connection';
import { logger } from '../utils/logger';
import type { RunContext } from './runtime/types';

const ALLOWED_TIERS: readonly string[] = [
  'professional', 'enterprise', 'principal', 'institutional',
];

function isTierAllowed(tier: string): boolean {
  return ALLOWED_TIERS.includes(tier.toLowerCase());
}

export const cashflowOnResearchCompleted = inngest.createFunction(
  {
    id: 'cashflow-on-research-completed',
    name: 'CashFlow Agent: on research.completed',
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
        logger.info('CashFlow Agent: deal not found, skipping', { dealId });
        return { allowed: false, userId: '', userTier: '' };
      }
      const allowed = isTierAllowed(row.tier ?? '');
      if (!allowed) {
        logger.info('CashFlow Agent: tier gate blocked', { dealId, tier: row.tier });
      }
      return { allowed, userId: row.user_id as string, userTier: row.tier as string };
    });

    if (!tierCheckResult.allowed) {
      return { runId: '', confidence_score: 0 };
    }

    const { userId } = tierCheckResult;

    // ── Step 2: Seed prompt ─────────────────────────────────────────
    await step.run('seed-prompt', async () => {
      const { seedCashflowPrompt } = await import('./seeds/cashflow.seed');
      await seedCashflowPrompt();
      return { seeded: true };
    });

    // ── Step 3: Resolve deal context + document availability ────────
    const dealCtx = await step.run('resolve-deal-context', async () => {
      const res = await query(
        `SELECT d.address, d.property_address, d.city, d.state_code,
                dp.property_id, dp.property_type, dp.purchase_price
         FROM deals d
         LEFT JOIN deal_properties dp ON dp.deal_id = d.id
         WHERE d.id = $1
         ORDER BY dp.created_at ASC
         LIMIT 1`,
        [dealId]
      );
      const row = res.rows[0] ?? {};

      // Check for rent roll snapshots (proxy for "has financial document data")
      const rrRes = await query(
        `SELECT COUNT(*) AS cnt FROM rent_roll_snapshots WHERE deal_id = $1 LIMIT 1`,
        [dealId]
      );
      const hasRentRoll = parseInt(rrRes.rows[0]?.cnt ?? '0', 10) > 0;

      return {
        address: (row.property_address ?? row.address ?? null) as string | null,
        city: (row.city ?? null) as string | null,
        state: (row.state_code ?? null) as string | null,
        property_id: (row.property_id ?? null) as string | null,
        property_type: (row.property_type ?? null) as string | null,
        purchase_price: (row.purchase_price ?? null) as number | null,
        hasRentRoll,
      };
    });

    // ── Step 4: Execute CashFlow Agent via AgentRuntime ─────────────
    const inngestEventId = event.id;

    const runResult = await step.run('execute-cashflow-agent', async () => {
      // Idempotency guard
      const priorRun = await query(
        `SELECT id, output FROM agent_runs
         WHERE agent_id = 'cashflow'
           AND deal_id   = $1
           AND trigger_context->>'inngest_event_id' = $2
           AND status = 'succeeded'
         ORDER BY started_at DESC LIMIT 1`,
        [dealId, inngestEventId]
      );

      const prior = priorRun.rows[0];
      if (prior?.id && prior?.output) {
        logger.info('cashflow.inngest: step idempotency — returning memoized run', {
          dealId, inngestEventId, runId: prior.id,
        });
        const cached = typeof prior.output === 'string'
          ? JSON.parse(prior.output)
          : prior.output as CashflowAgentOutput;
        return {
          runId: prior.id as string,
          confidence_score: cached.confidence_score ?? 0,
          summary: cached.summary ?? '',
          investment_rating: cached.investment_rating ?? null,
          fields_written: cached.fields_written ?? [],
          has_t12_data: cached.has_t12_data ?? false,
          has_rent_roll: cached.has_rent_roll ?? false,
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

      const output = await cashflowRuntime.run(
        {
          deal_id: dealId,
          ...(dealCtx.address && { address: dealCtx.address }),
          ...(dealCtx.city && { city: dealCtx.city }),
          ...(dealCtx.state && { state: dealCtx.state }),
          ...(dealCtx.property_id && { property_id: dealCtx.property_id }),
          ...(dealCtx.property_type && { property_type: dealCtx.property_type }),
          ...(dealCtx.purchase_price != null && { purchase_price: dealCtx.purchase_price }),
          has_rent_roll: dealCtx.hasRentRoll,
        },
        ctx
      );
      const typed = output as CashflowAgentOutput;

      const runRow = await query(
        `SELECT id FROM agent_runs
         WHERE agent_id = 'cashflow'
           AND deal_id = $1
           AND trigger_context->>'inngest_event_id' = $2
         ORDER BY started_at DESC LIMIT 1`,
        [dealId, inngestEventId]
      );

      const runId = runRow.rows[0]?.id ?? '';
      if (!runId) {
        logger.warn('cashflow.inngest: could not recover run ID after step', { dealId, inngestEventId });
      }

      return {
        runId,
        confidence_score: typed.confidence_score,
        summary: typed.summary,
        investment_rating: typed.investment_rating,
        fields_written: typed.fields_written,
        has_t12_data: typed.has_t12_data,
        has_rent_roll: typed.has_rent_roll,
      };
    });

    // ── Step 5: Write audit_log ─────────────────────────────────────
    await step.run('write-audit-log', async () => {
      if (!runResult.runId) {
        logger.warn('cashflow.inngest: skipping audit_log write — no run ID', { dealId });
        return { logged: false };
      }
      try {
        await query(
          `INSERT INTO audit_log
             (actor_id, actor_type, action, resource_type, resource_id, metadata, agent_run_id)
           SELECT 'cashflow', 'agent', 'cashflow.completed', 'deal', $1, $2, $3
           WHERE NOT EXISTS (
             SELECT 1 FROM audit_log WHERE agent_run_id = $3
           )`,
          [
            dealId,
            JSON.stringify({
              confidence_score: runResult.confidence_score,
              fields_written: runResult.fields_written,
              summary: runResult.summary,
              investment_rating: runResult.investment_rating,
              has_t12_data: runResult.has_t12_data,
              has_rent_roll: runResult.has_rent_roll,
              run_id: runResult.runId,
            }),
            runResult.runId,
          ]
        );
      } catch (err) {
        logger.warn('cashflow.inngest: failed to write audit_log', { err });
      }
      return { logged: true };
    });

    // ── Step 6: Emit downstream event ──────────────────────────────
    if (runResult.runId) {
      await step.sendEvent('emit-cashflow-completed', {
        name: 'cashflow.completed' as const,
        data: {
          dealId,
          runId: runResult.runId,
          confidence_score: runResult.confidence_score,
          fields_written: runResult.fields_written,
          investment_rating: runResult.investment_rating,
        },
      } satisfies JediEvents);
    }

    return {
      runId: runResult.runId,
      confidence_score: runResult.confidence_score,
    };
  }
);

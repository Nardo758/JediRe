/**
 * CashFlow Agent — Inngest durable functions
 *
 * cashflowOnResearchCompleted: triggers on `research.completed`
 *   Runs proforma analysis when the deal has T12 / rent-roll documents.
 *   Each major side effect uses `step.run()` for durable execution.
 *
 *   Flow:
 *     Step 1: tier-gate check (from deal's user tier)
 *     Step 2: seed prompt (idempotent)
 *     Step 3: resolve deal context + check document availability
 *     Step 4: compose deal-type prompt (core + variant) + execute CashflowRuntime
 *     Step 5: write audit_log entry
 *     Step 6: emit cashflow.completed event
 *
 * cashflowOnWalkthroughRequested: triggers on `cashflow.walkthrough_requested`
 *   Invokes the Commentary Agent to generate the walkthrough narrative and
 *   write it to `deal_walkthrough_narratives`.
 */

import {
  inngest,
  type ResearchCompletedEvent,
  type CashflowWalkthroughRequestedEvent,
  type JediEvents,
} from '../lib/inngest';
import {
  cashflowRuntime,
  resolveProjectType,
  CASHFLOW_DEAL_TYPE_TO_PROMPT_TYPE,
} from './cashflow.config';
import type { CashflowAgentOutput } from './cashflow.config';
import { query } from '../database/connection';
import { logger } from '../utils/logger';
import type { RunContext } from './runtime/types';

// ── Helpers ───────────────────────────────────────────────────────

/**
 * Load and compose the core cashflow system prompt with the deal-type variant.
 * Returns the concatenated text — or the core-only text if no variant is found.
 */
async function buildCompositePrompt(dealRow: Record<string, unknown>): Promise<string> {
  const dealType = resolveProjectType(dealRow);
  const variantType = CASHFLOW_DEAL_TYPE_TO_PROMPT_TYPE[dealType];

  const coreRow = await query(
    `SELECT system_prompt FROM prompt_versions
     WHERE agent_id = 'cashflow' AND prompt_type = 'core' AND active = true
     ORDER BY created_at DESC LIMIT 1`
  );
  const corePrompt: string =
    coreRow.rows[0]?.system_prompt ??
    'You are the CashFlow Agent for JEDI RE. Analyze real estate data and return structured JSON.';

  const variantRow = await query(
    `SELECT system_prompt FROM prompt_versions
     WHERE agent_id = 'cashflow' AND prompt_type = $1 AND active = true
     ORDER BY created_at DESC LIMIT 1`,
    [variantType]
  );
  const variantPrompt: string = variantRow.rows[0]?.system_prompt ?? '';

  return variantPrompt
    ? `${corePrompt}\n\n## Deal-Type Addendum (${dealType})\n${variantPrompt}`
    : corePrompt;
}

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
    // Gate: only proceed if T12 financials OR rent-roll data exist.
    // Without financial documents the proforma would be pure estimation
    // with no deal-specific data to ground it — deferred until docs arrive.
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

      // Check T12 availability: deal_financials rows with at least one month of data
      const t12Res = await query(
        `SELECT COUNT(*) AS cnt FROM deal_financials WHERE deal_id = $1 LIMIT 1`,
        [dealId]
      );
      const hasT12Data = parseInt(t12Res.rows[0]?.cnt ?? '0', 10) > 0;

      // Check rent-roll availability via rent_roll_snapshots
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
        hasT12Data,
        hasRentRoll,
      };
    });

    // Document gate: skip cashflow analysis when no financial data is available.
    // The run will be triggered again by a future deal.document_uploaded event
    // once the user uploads T12 or rent-roll files.
    if (!dealCtx.hasT12Data && !dealCtx.hasRentRoll) {
      logger.info('CashFlow Agent: no T12 or rent-roll data found — deferring run', {
        dealId,
        hasT12Data: false,
        hasRentRoll: false,
      });
      return { runId: '', confidence_score: 0 };
    }

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

      // Build deal-type-aware system prompt (core + variant) so the model
      // receives instructions calibrated to the specific project strategy.
      const systemPromptOverride = await buildCompositePrompt({
        property_type: dealCtx.property_type ?? '',
      });

      const ctx: RunContext = {
        dealId,
        userId,
        triggeredBy: 'event',
        triggerContext: {
          source: 'research.completed',
          inngest_event_id: inngestEventId,
          research_run_id: (event as unknown as ResearchCompletedEvent).data.runId,
        },
        systemPromptOverride,
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
          has_t12_data: dealCtx.hasT12Data,
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

// ── Walkthrough handler ───────────────────────────────────────────

/**
 * Triggered by `cashflow.walkthrough_requested` (emitted by request_walkthrough_narrative tool).
 * Invokes the Commentary Agent with the underwriting snapshot to generate a
 * natural-language walkthrough narrative written to `audit_log`.
 */
export const cashflowOnWalkthroughRequested = inngest.createFunction(
  {
    id: 'cashflow-on-walkthrough-requested',
    name: 'CashFlow Agent: generate walkthrough narrative',
    triggers: [{ event: 'cashflow.walkthrough_requested' }],
    retries: 2,
    concurrency: {
      limit: 3,
      key: 'event.data.dealId',
    },
  },
  async ({ event, step }): Promise<{ narrative: string; runId: string }> => {
    const data = (event as unknown as CashflowWalkthroughRequestedEvent).data;
    const { dealId, agentRunId, snapshotId, focus, eventId } = data;

    // Step 1: Load snapshot or latest evidence for context
    const evidenceCtx = await step.run('load-evidence-context', async () => {
      if (snapshotId) {
        const snap = await query(
          `SELECT proforma_json, evidence_map FROM deal_underwriting_snapshots
           WHERE id = $1`,
          [snapshotId]
        );
        return {
          proforma: snap.rows[0]?.proforma_json ?? null,
          evidence: snap.rows[0]?.evidence_map ?? null,
        };
      }
      // Fall back to latest snapshot for this deal
      const snap = await query(
        `SELECT proforma_json, evidence_map FROM deal_underwriting_snapshots
         WHERE deal_id = $1
         ORDER BY created_at DESC LIMIT 1`,
        [dealId]
      );
      return {
        proforma: snap.rows[0]?.proforma_json ?? null,
        evidence: snap.rows[0]?.evidence_map ?? null,
      };
    });

    // Step 2: Invoke Commentary Agent to generate the narrative
    const result = await step.run('generate-walkthrough', async () => {
      const { commentaryRuntime } = await import('./commentary.config');
      const ctx: RunContext = {
        dealId,
        triggeredBy: 'event',
        triggerContext: {
          source: 'cashflow.walkthrough_requested',
          event_id: eventId,
          agent_run_id: agentRunId,
        },
      };

      const output = await commentaryRuntime.run(
        {
          deal_id: dealId,
          mode: 'walkthrough',
          focus: focus ?? 'proforma_evidence',
          proforma_snapshot: evidenceCtx.proforma,
          evidence_map: evidenceCtx.evidence,
        },
        ctx
      );

      return {
        narrative: (output as Record<string, unknown>).commentary_text as string ?? '',
        runId: ctx.correlationId ?? '',
      };
    });

    // Step 3: Write narrative to audit_log for UI consumption
    await step.run('persist-walkthrough', async () => {
      await query(
        `INSERT INTO audit_log
           (actor_id, actor_type, action, resource_type, resource_id, metadata)
         VALUES ('cashflow', 'agent', 'cashflow.walkthrough_completed', 'deal', $1, $2)`,
        [
          dealId,
          JSON.stringify({
            event_id: eventId,
            narrative: result.narrative,
            agent_run_id: agentRunId,
            walkthrough_run_id: result.runId,
            focus: focus ?? 'proforma_evidence',
            completed_at: new Date().toISOString(),
          }),
        ]
      );
      return { persisted: true };
    });

    logger.info('cashflow.walkthrough: narrative generated', {
      dealId,
      eventId,
      narrativeLength: result.narrative.length,
    });

    return { narrative: result.narrative, runId: result.runId };
  }
);

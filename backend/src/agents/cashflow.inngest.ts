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
  buildCompositePrompt,
  getAllowedTriggerModes,
} from './cashflow.config';
import type { CashflowAgentOutput } from './cashflow.config';
import { query } from '../database/connection';
import { logger } from '../utils/logger';
import type { RunContext } from './runtime/types';

/** Event-driven runs require at minimum 'event-driven' trigger mode. */
function isTierAllowedForEventDriven(tier: string): boolean {
  return getAllowedTriggerModes(tier).includes('event-driven');
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
      const allowed = isTierAllowedForEventDriven(row.tier ?? '');
      if (!allowed) {
        logger.info('CashFlow Agent: tier gate blocked (event-driven not permitted)', { dealId, tier: row.tier });
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
        const cConf = cached.confidence_distribution;
        const cTotal = cConf ? cConf.high + cConf.medium + cConf.low : 0;
        const cConfScore = (cTotal > 0 && cConf)
          ? cConf.high / cTotal
          : (cached.confidence_score ?? 0);
        return {
          runId: prior.id as string,
          confidence_score: cConfScore,
          summary: cached.summary ?? '',
          investment_rating: cached.investment_rating ?? null,
          fields_written: cached.fields_written?.length
            ? cached.fields_written
            : Object.keys(cached.proforma_fields ?? {}),
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

      // Derive run metadata from the evidence output schema.
      // confidence_score = fraction of high-confidence fields
      const confDist = typed.confidence_distribution;
      const totalFields = confDist ? confDist.high + confDist.medium + confDist.low : 0;
      const derivedConfidenceScore = (totalFields > 0 && confDist)
        ? confDist.high / totalFields
        : (typed.confidence_score ?? 0);

      const derivedFieldsWritten: string[] = typed.fields_written?.length
        ? typed.fields_written
        : Object.keys(typed.proforma_fields ?? {});

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
        confidence_score: derivedConfidenceScore,
        summary: typed.summary,
        investment_rating: typed.investment_rating ?? null,
        fields_written: derivedFieldsWritten,
        has_t12_data: typed.has_t12_data ?? dealCtx.hasT12Data,
        has_rent_roll: typed.has_rent_roll ?? dealCtx.hasRentRoll,
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

    // ── Step 7: Auto-trigger walkthrough for Principal+ tiers ────────
    // Principal and Institutional users receive a narrative walkthrough
    // automatically after every cashflow run completes, so they don't
    // need to manually request it via the UI or tool call.
    const WALKTHROUGH_AUTO_TIERS = ['principal', 'institutional'];
    if (runResult.runId && WALKTHROUGH_AUTO_TIERS.includes(tierCheckResult.userTier.toLowerCase())) {
      await step.sendEvent('emit-auto-walkthrough', {
        name: 'cashflow.walkthrough_requested' as const,
        data: {
          dealId,
          agentRunId: runResult.runId,
          snapshotId: null,
          focus: 'proforma_evidence',
          triggerReason: 'auto_principal',
          eventId: inngestEventId,
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

    // Step 2: Load deal entity identity needed by Commentary Agent
    const entityCtx = await step.run('load-entity-context', async () => {
      const res = await query(
        `SELECT d.property_id, d.property_type,
                COALESCE(p.name, d.deal_name, d.id::text) AS entity_name,
                COALESCE(p.id::text, d.property_id::text, d.id::text) AS entity_id
         FROM deals d
         LEFT JOIN properties p ON p.id = d.property_id
         WHERE d.id = $1`,
        [dealId]
      );
      const row = res.rows[0] as Record<string, unknown> | undefined;
      return {
        entity_id: (row?.entity_id as string | null) ?? dealId,
        entity_name: (row?.entity_name as string | null) ?? dealId,
      };
    });

    // Step 3: Invoke Commentary Agent to generate the walkthrough narrative
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

      // Commentary Agent expects entity identity in the input together with
      // deal evidence context so the LLM has full underwriting data available.
      const output = await commentaryRuntime.run(
        {
          entity_type: 'property',
          entity_id: entityCtx.entity_id,
          entity_name: entityCtx.entity_name,
          walkthrough_mode: true,
          focus: focus ?? 'proforma_evidence',
          proforma_snapshot: evidenceCtx.proforma,
          evidence_map: evidenceCtx.evidence,
        },
        ctx
      );

      // Extract narrative from Commentary Agent's validated output contract.
      // CommentaryOutputSchema fields: market_narrative.content (string),
      // investment_thesis.recommendation (string), summary (string).
      // Compose a human-readable walkthrough from the three natural-language fields.
      type CommentaryOut = {
        market_narrative?: { content?: string };
        investment_thesis?: { recommendation?: string };
        summary?: string;
      };
      const typed = output as CommentaryOut;
      const parts: string[] = [];
      if (typed.market_narrative?.content) parts.push(typed.market_narrative.content);
      if (typed.investment_thesis?.recommendation) parts.push(typed.investment_thesis.recommendation);
      if (typed.summary) parts.push(typed.summary);
      const narrative = parts.join('\n\n').trim();

      return {
        narrative,
        runId: ctx.correlationId ?? '',
      };
    });

    // Step 4: Write narrative to audit_log for UI consumption.
    // `completion_status` is always set so the polling endpoint can distinguish
    // "truly done (even with empty narrative)" from "still in-flight".
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
            completion_status: 'done',
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

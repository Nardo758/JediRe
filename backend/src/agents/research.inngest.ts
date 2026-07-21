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
 * Note: prompt seeding runs at server startup (seedAllAgentPrompts) — not per invocation.
 * Operator rollbacks via prompt_versions.active are preserved across restarts.
 *
 * Flow:
 *   Step 1: tier-gate check
 *   Step 2: run AgentRuntime  ← single durable step; agent_run row is the DB record of truth
 *   Step 3: write audit_log entry with guaranteed non-empty agent_run_id
 *   Step 4: emit research.completed event
 */

import { inngest, type DealCreatedEvent, type JediEvents } from '../lib/inngest';
import { researchRuntime, RESEARCH_AGENT_CONFIG } from './research.config';
import { query } from '../database/connection';
import { logger } from '../utils/logger';
import { resolveOrgForUser } from '../services/ai/orgCreditService';
import type { RunContext } from './runtime/types';
import type { ResearchOutput } from './research.config';
import {
  dealPropertyLinkService,
  AGENT_RUNNERS_FLAG,
  shouldUseNewPath,
  shouldRunShadow,
  phase3ShadowService,
} from '../services/property-entity';

// ── Tier gating ─────────────────────────────────────────────────────────────
// Tiers that allow AUTOMATED (event-driven) Research Agent runs.
// Matches actual platform tier values emitted by inline-deals.routes.ts:
//   basic        → blocked (manual trigger only via /api/v1/agents/research/run)
//   operator     → blocked (manual trigger only)
//   professional → ALLOWED (auto-triggers on deal.created)
//   enterprise   → ALLOWED (auto-triggers on deal.created)
//
// Manual runs (any authenticated user via POST /api/v1/agents/:agentId/run)
// are not gated by this check — only the Inngest function applies it.
// ────────────────────────────────────────────────────────────────────────────
const ALLOWED_TIERS: readonly string[] = [
  'scout', 'basic', 'operator', 'principal', 'institutional',
];

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
    const tierCheckResult = await step.run('tier-gate', async (): Promise<{ allowed: boolean; reason?: 'no_credits' }> => {
      if (!isTierAllowed(userTier)) {
        logger.info('Research Agent: tier gate blocked automated run', {
          dealId,
          userId,
          userTier,
        });
        return { allowed: false };
      }
      // C1 (CREATE-1 completion dispatch): the automation_level integer gate
      // is RETIRED as the research trigger. The old `automation_level >= 2`
      // check blocked 100% of platform users forever (no user ever had that
      // value set) — automated research never fired for anyone. The trigger
      // is now ORG CREDIT BALANCE: research fires whenever the org has
      // credits, and leaves an explicit, queryable skip reason (never a
      // silent skip) when it doesn't. `automation_level` is preserved as a
      // column (other readers: cashflow/commentary/zoning .inngest.ts,
      // creditService.ts, sessionStore.ts — untouched, out of scope here)
      // but is no longer read by this gate.
      const orgId = await resolveOrgForUser(userId);
      if (!orgId) {
        // No org pool record (bridge user / bot fixture) — allow through,
        // matching the existing "no pool → allow through" convention used
        // elsewhere in the credit system (orgCreditService.reserveOrgCredits).
        logger.info('Research Agent: no org credit pool — allowing through', { dealId, userId });
        return { allowed: true };
      }
      const creditRes = await query(
        `SELECT credits_remaining FROM org_credit_balances WHERE org_id = $1`,
        [orgId]
      );
      const creditsRemaining = creditRes.rows[0]?.credits_remaining;
      if (creditsRemaining !== undefined && Number(creditsRemaining) <= 0) {
        logger.info('Research Agent: org credit gate blocked — no credits', {
          dealId, orgId, creditsRemaining,
        });
        return { allowed: false, reason: 'no_credits' as const };
      }
      return { allowed: true };
    });

    if (!tierCheckResult.allowed) {
      // C1: never a silent skip — record an explicit, queryable reason.
      if (tierCheckResult.reason === 'no_credits') {
        await step.run('record-credit-skip', async () => {
          await query(
            `INSERT INTO agent_runs
               (agent_id, agent_version, prompt_version, deal_id, user_id,
                triggered_by, trigger_context, status, error, started_at, completed_at)
             VALUES ('research', $1, $2, $3, $4, 'event', $5, 'budget_exceeded',
                      'research skipped — no credits', NOW(), NOW())`,
            [
              RESEARCH_AGENT_CONFIG.agentVersion,
              RESEARCH_AGENT_CONFIG.promptVersion,
              dealId,
              userId,
              JSON.stringify({ source: 'deal.created', skip_reason: 'no_credits' }),
            ]
          );
        });
      }
      return { runId: '', confidence_score: 0 };
    }

    // ── Step 2: Credit debit ─────────────────────────────────────────
    await step.run('credit-debit', async () => {
      const { creditService } = await import('../services/ai/creditService');
      await creditService.debitAgentRun(userId, 'research');
      return { debited: true };
    });

    // ── Step 2b: Resolve deal context for tool inputs ───────────────
    // NOTE: prompt seeding is handled at server startup only (seedAllAgentPrompts).
    // Per-run seeding was removed in Phase 5 so that operator rollbacks
    // (flipping prompt_versions.active) are authoritative for all subsequent runs.
    // Provides address/city/state/property_id so LLM can call tools
    // with correct parameters (fetch_parcel, fetch_ownership, fetch_costar_metrics).
    //
    // R-006: Agent runners deal→property — Phase 3 reader migration
    // Flag: USE_NEW_PROPERTY_SCHEMA_AGENT_RUNNERS (default: false)
    const dealCtx = await step.run('resolve-deal-context', async () => {
      const agentFlag = AGENT_RUNNERS_FLAG();
      const useNew = shouldUseNewPath(agentFlag);
      const runShadow = shouldRunShadow(agentFlag);

      // ── Old path (deal_properties JOIN) ────────────────────────────
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
      const oldResult = {
        address: (row.property_address ?? row.address ?? null) as string | null,
        city: (row.city ?? null) as string | null,
        state: (row.state_code ?? null) as string | null,
        property_id: (row.property_id ?? null) as string | null,
      };

      // ── New path (DealPropertyLinkService → properties identity) ───
      if (useNew || runShadow) {
        try {
          const link = await dealPropertyLinkService.resolveDealProperty(dealId);
          const newPropertyId = link?.propertyId ?? null;

          const newResult = {
            address: oldResult.address,
            city: oldResult.city,
            state: oldResult.state,
            property_id: newPropertyId,
          };

          if (runShadow) {
            await phase3ShadowService.logBatch('agent_runners', dealId, {
              property_id: { old: oldResult.property_id, new: newResult.property_id },
            });
          }

          if (useNew) return newResult;
        } catch (err) {
          logger.warn('R-006 research_agent new path failed; falling back to old path', { err, dealId });
        }
      }

      return oldResult;
    });

    // ── Step 3: Execute Research Agent via AgentRuntime ─────────────
    // The Inngest event ID is stamped into triggerContext so we can
    // recover the exact agent_run row after this step completes.
    // AgentRuntime creates the agent_run row before the LLM loop starts.
    const inngestEventId = event.id;

    const runResult = await step.run('execute-research-agent', async () => {
      // ── Idempotency guard ─────────────────────────────────────────
      // Inngest may replay this step if the function crashed before the step
      // checkpoint was committed (mid-execution crash). Guard against
      // duplicate agent_runs rows by checking for a prior succeeded run
      // keyed on inngest_event_id. If found, return the cached result.
      const priorRun = await query(
        `SELECT id, output FROM agent_runs
         WHERE agent_id = 'research'
           AND deal_id   = $1
           AND trigger_context->>'inngest_event_id' = $2
           AND status = 'succeeded'
         ORDER BY started_at DESC LIMIT 1`,
        [dealId, inngestEventId]
      );

      const prior = priorRun.rows[0];
      if (prior?.id && prior?.output) {
        logger.info('research.inngest: step idempotency — returning memoized run', {
          dealId,
          inngestEventId,
          runId: prior.id,
        });
        const cached = typeof prior.output === 'string'
          ? JSON.parse(prior.output)
          : prior.output as ResearchOutput;
        return {
          runId: prior.id as string,
          confidence_score: cached.confidence_score ?? 0,
          fields_written: cached.fields_written ?? [],
          summary: cached.summary ?? '',
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

    // ── Step 6: Update Knowledge Graph ──────────────────────────────
    await step.run('update-knowledge-graph', async () => {
      // The Inngest step return type only declares the four core fields the
      // function needs downstream (runId, confidence_score, fields_written,
      // summary). Any KG-enrichment fields the agent may emit on top of those
      // (market_id / properties_found / web_comps) are optional and read
      // defensively here. This typed view documents that contract without
      // weakening the upstream return type.
      type ResearchKgEnrichment = {
        market_id?: string | null;
        properties_found?: Array<{
          id?: string;
          name?: string;
          address?: string;
          city?: string;
          state?: string;
          units?: number;
        }>;
        web_comps?: Array<{
          name?: string;
          address?: string;
          city?: string;
          units?: number;
          rent?: number;
          amenities?: unknown;
          fees?: unknown;
          other_income?: unknown;
          source_url?: string;
        }>;
      };
      const kgRunResult = runResult as unknown as typeof runResult & ResearchKgEnrichment;

      try {
        const { getGraphIngestionListener } = await import('../services/neural-network/graph-ingestion-listener');
        const { getPool } = await import('../database/connection');
        const pool = getPool();
        const graphListener = getGraphIngestionListener(pool);

        // Update market node with fresh research data
        if (kgRunResult.market_id) {
          await graphListener.handleEvent({
            type: 'market.updated',
            entityId: kgRunResult.market_id,
            entityType: 'Market',
            data: {
              lastResearchAnalysis: new Date(),
              researchConfidence: kgRunResult.confidence_score,
            },
            timestamp: new Date(),
          });
        }

        // Ingest any properties discovered
        if (kgRunResult.properties_found && kgRunResult.properties_found.length > 0) {
          for (const prop of kgRunResult.properties_found) {
            await graphListener.handleEvent({
              type: 'property.created',
              entityId: prop.id || `research-${dealId}-${Date.now()}`,
              entityType: 'Property',
              data: {
                name: prop.name,
                address: prop.address,
                city: prop.city,
                state: prop.state,
                units: prop.units,
                marketId: kgRunResult.market_id,
              },
              timestamp: new Date(),
            });
          }
        }

        // Ingest web-sourced comp data from research
        if (kgRunResult.web_comps && kgRunResult.web_comps.length > 0) {
          const { getKnowledgeGraph } = await import('../services/neural-network/knowledge-graph.service');
          const kg = getKnowledgeGraph(pool);
          for (const comp of kgRunResult.web_comps) {
            await kg.upsertNode({
              type: 'Property',
              externalId: `research-web-comp-${comp.name?.replace(/\s+/g, '-').toLowerCase()}-${dealId}`,
              name: comp.name || 'Research Comp',
              properties: {
                source: 'research_web_search',
                derivedFromSearch: true,
                address: comp.address,
                city: comp.city,
                units: comp.units,
                rent: comp.rent,
                amenities: comp.amenities,
                fees: comp.fees,
                otherIncome: comp.other_income,
                sourceUrl: comp.source_url,
                discoveredAt: new Date(),
              }
            } as any);
          }
        }

        // Refresh capsule intelligence after research completes
        if (dealId && runResult.confidence_score > 0.5) {
          try {
            const { getCapsuleIntelligence } = await import('../services/capsule-intelligence.service');
            const capsule = await pool.query(
              `SELECT property_address, deal_data FROM deal_capsules WHERE id = $1`,
              [dealId]
            );
            if (capsule.rows[0]) {
              const dd = capsule.rows[0].deal_data || {};
              await getCapsuleIntelligence().seedCapsule({
                capsuleId: dealId,
                propertyAddress: capsule.rows[0].property_address,
                city: dd.city,
                state: dd.state,
                propertyType: dd.property_type || 'multifamily',
                units: dd.units,
              });
              logger.info('research.inngest: refreshed capsule intelligence after research');
            }
          } catch (_) { /* non-fatal */ }
        }

        logger.info('research.inngest: updated knowledge graph', {
          marketId: kgRunResult.market_id,
          propertiesIngested: kgRunResult.properties_found?.length || 0,
          webCompsIngested: kgRunResult.web_comps?.length || 0,
        });
      } catch (err) {
        logger.warn('research.inngest: failed to update knowledge graph', { err });
      }
      return { graphUpdated: true };
    });

    return {
      runId: runResult.runId,
      confidence_score: runResult.confidence_score,
    };
  }
);

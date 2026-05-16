/**
 * Cashflow Agent — Post-processor
 *
 * Two responsibilities:
 *   1. Aggregate tool-persisted data from agent_run_steps (if model used tools).
 *   2. Handle inline JSON output from model — if the model returned JSON directly
 *      (no tool calls), parse it and fill in any missing schema-required fields.
 */

import { query } from '../database/connection';
import { logger } from '../utils/logger';
import type { RunContext } from './runtime/types';
import { getStanceForDeal, applyStanceToProformaFields, applyStanceReblend, suggestAgentInferredStance } from '../services/operatorStance.service';
import type { OperatorStancePatch } from '../types/operator-stance';
import { normalizeProformaFields } from './utils/evidenceNormalizer';

interface FieldOutput {
  value: unknown;
  source: string;
  evidence: string;
  archive_percentile?: number;
}

interface CollisionCounts {
  minor_count: number;
  material_count: number;
  severe_count: number;
}

const DEFAULT_SUMMARY = 'Underwriting analysis completed';

export async function cashflowPostProcess(
  rawOutput: Record<string, unknown>,
  ctx: RunContext,
  runId: string,
): Promise<Record<string, unknown>> {
  const output = { ...rawOutput };

  try {
    // ── Detect inline JSON mode ──────────────────────────────────
    // If rawOutput has proforma_fields from model output (not from tool_calls),
    // the values are already inline. We still fill in missing aggregate fields.
    const hasInlineProforma = hasField(output, 'proforma_fields');
    const hasToolCallData = await countToolCalls(runId, 'write_underwriting');

    if (!hasToolCallData && hasInlineProforma) {
      // Model output inline JSON — just fill in missing fields
      const inlineFields = output.proforma_fields as Record<string, FieldOutput>;
      logger.info(`[CashflowPostProcess] Inline JSON mode: ${Object.keys(inlineFields).length} fields`);
      fillMissingAggregates(output, inlineFields);
    } else if (hasToolCallData) {
      // Model used write_underwriting tool — aggregate from DB
      await aggregateFromToolCalls(output, runId);
    } else {
      // No tool calls AND no inline fields — create empty aggregates
      logger.warn(`[CashflowPostProcess] No tool calls or inline fields for ${runId}`);
      fillMissingAggregates(output, {});
    }

    // ── Evidence normalization ────────────────────────────────────────────────
    // Coerce any string or malformed evidence fields to CanonicalEvidence shape
    // before schema validation. Runs on every cashflow agent output, is
    // idempotent, and logs all repairs for conformance monitoring.
    if (output.proforma_fields && typeof output.proforma_fields === 'object') {
      try {
        const proformaRecord = output.proforma_fields as Record<string, unknown>;
        const keys = Object.keys(proformaRecord);

        if (keys.length > 0) {
          const fieldsArray = keys.map((key) => {
            const entry = proformaRecord[key];
            const fieldObj: Record<string, unknown> =
              entry !== null && typeof entry === 'object'
                ? (entry as Record<string, unknown>)
                : {};
            return {
              ...fieldObj,
              field_path: typeof fieldObj.field_path === 'string' ? fieldObj.field_path : key,
            };
          });

          const { proformaFields: normalizedArray, summary } = normalizeProformaFields(
            fieldsArray,
            {
              deal_id: ctx.dealId ?? 'unknown',
              run_id: runId,
              prompt_version: (output.prompt_version as string | undefined) ?? 'unknown',
              logger,
            },
          );

          // Rebuild record preserving original key order
          const normalizedRecord: Record<string, unknown> = {};
          keys.forEach((key, idx) => {
            normalizedRecord[key] = normalizedArray[idx];
          });
          output.proforma_fields = normalizedRecord;
          // Persistence: evidence_normalization_summary is declared as an optional
          // field in CashflowOutputSchema, so it survives outputSchema.parse() and
          // is written to agent_runs.output by AgentRuntime (UPDATE agent_runs SET
          // output = $1 WHERE id = $2). No dedicated column migration required.
          output.evidence_normalization_summary = summary;
        }
      } catch (normErr) {
        // Non-fatal: normalizer failure must never block agent output
        logger.warn('[CashflowPostProcess] Evidence normalizer failed (non-fatal)', {
          runId,
          err: normErr instanceof Error ? normErr.message : String(normErr),
        });
      }
    }

    // ── Backend-enforced stance modulation ───────────────────────────────────
    // This step is deterministic and runs regardless of LLM compliance.
    // The LLM provides raw tier-resolved values in proforma_fields; the
    // backend applies stance modulation here, ensuring the returned output
    // always reflects the operator's current stance — even if the LLM did
    // not call fetch_operator_stance or applied incorrect deltas.
    //
    // The snapshot written by write_underwriting during the agent run is
    // intentionally left as the BASELINE (unmodulated). A background reblend
    // updates the snapshot after this modulation step completes.
    if (ctx.dealId && ctx.userId && output.proforma_fields) {
      try {
        const stance = await getStanceForDeal(ctx.dealId, ctx.userId);
        const proformaFields = output.proforma_fields as Record<string, any>;
        const modulatedFields = applyStanceToProformaFields(proformaFields, stance);
        if (modulatedFields.length > 0) {
          logger.info('[CashflowPostProcess] Stance modulation enforced', {
            dealId: ctx.dealId,
            modulatedFields,
            underwritingPosture: stance.underwritingPosture,
            cyclePosition: stance.cyclePosition,
            rateEnvironment: stance.rateEnvironment,
            defaulted: stance.defaulted,
          });
        }
        // Background: update the snapshot to reflect stance modulation
        if (!stance.defaulted) {
          setImmediate(() => {
            applyStanceReblend(ctx.dealId!, stance).catch(err => {
              logger.warn('[CashflowPostProcess] Post-run reblend failed (non-fatal)', {
                dealId: ctx.dealId,
                err: err instanceof Error ? err.message : String(err),
              });
            });
          });
        }

        // P3-03: Agent-inferred stance suggestion — detect market signals from
        // what the agent just observed and write them back as a platform suggestion
        // when the operator has not yet set a stance. Never overwrites operator choice.
        if (stance.defaulted) {
          const signals = inferStanceSignals(proformaFields);
          if (signals) {
            setImmediate(() => {
              suggestAgentInferredStance(ctx.dealId!, signals).catch(err => {
                logger.warn('[CashflowPostProcess] Agent-inferred stance suggestion failed (non-fatal)', {
                  dealId: ctx.dealId,
                  err: err instanceof Error ? err.message : String(err),
                });
              });
            });
          }
        }
      } catch (err) {
        // Non-fatal: stance lookup failure must never block agent output
        logger.warn('[CashflowPostProcess] Stance modulation skipped (non-fatal)', {
          dealId: ctx.dealId,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Ensure required string fields
    if (typeof output.summary !== 'string' || output.summary === '') {
      // If summary is an object, try to extract a string from it
      if (typeof output.summary === 'object' && output.summary !== null) {
        const obj = output.summary as Record<string, unknown>;
        output.summary = typeof obj.text === 'string' ? obj.text
          : typeof obj.content === 'string' ? obj.content
          : typeof obj.message === 'string' ? obj.message
          : typeof obj.synthesis === 'string' ? obj.synthesis
          : typeof obj.findings === 'string' ? obj.findings
          : DEFAULT_SUMMARY;
      } else if (output.summary === null || output.summary === undefined) {
        output.summary = DEFAULT_SUMMARY;
      }
    }
    output.completed_at ??= new Date().toISOString();

  } catch (err) {
    const errInfo = err instanceof Error
      ? { message: err.message, stack: err.stack?.split('\n').slice(0, 3).join('; ') }
      : { raw: String(err) };
    logger.error('[CashflowPostProcess] Error during aggregation, falling back to raw output', { errInfo });
  }

  return output;
}

/**
 * Fill in missing aggregate fields (collision_summary, confidence_distribution,
 * tier_distribution) by scanning inline proforma_fields.
 */
function fillMissingAggregates(
  output: Record<string, unknown>,
  inlineFields: Record<string, FieldOutput>,
): void {
  if (!output.collision_summary) {
    output.collision_summary = { minor_count: 0, material_count: 0, severe_count: 0 };
  }

  if (!output.confidence_distribution) {
    const dist = { high: 0, medium: 0, low: 0 };
    for (const field of Object.values(inlineFields)) {
      const ev = typeof field.evidence === 'string' ? field.evidence : '';
      const full: Record<string, unknown> = {};
      try { Object.assign(full, typeof ev === 'string' && ev.startsWith('{') ? JSON.parse(ev) : {}); } catch {}
      if (full.confidence_level === 'high' || full.confidence === 'high') dist.high++;
      else if (full.confidence_level === 'medium' || full.confidence === 'medium') dist.medium++;
      else if (full.confidence_level === 'low' || full.confidence === 'low') dist.low++;
    }
    if (dist.high === 0 && dist.medium === 0 && dist.low === 0) dist.high = 1;
    output.confidence_distribution = dist;
  }

  if (!output.tier_distribution) {
    const tiers = { tier1: 0, tier2: 0, tier3: 0, tier4: 0 };
    for (const field of Object.values(inlineFields)) {
      const src = field.source ?? '';
      if (src.includes('t12') || src.includes('T12') || src.includes('rent_roll')) tiers.tier1++;
      else if (src.includes('owned') || src.includes('portfolio')) tiers.tier2++;
      else if (src.includes('archive') || src.includes('benchmark')) tiers.tier3++;
      else tiers.tier4++;
    }
    if (tiers.tier1 === 0 && tiers.tier2 === 0 && tiers.tier3 === 0 && tiers.tier4 === 0) tiers.tier1 = 1;
    output.tier_distribution = tiers;
  }
}

/**
 * Aggregate proforma_fields, collision_summary, confidence_distribution, and
 * tier_distribution from agent_run_steps where tool_name = 'write_underwriting'.
 */
async function aggregateFromToolCalls(
  output: Record<string, unknown>,
  runId: string,
): Promise<void> {
  // ── proforma_fields ──
  if (!output.proforma_fields || Object.keys(output.proforma_fields as Record<string, unknown>).length === 0) {
    const { rows } = await query(
      `SELECT payload
       FROM agent_run_steps
       WHERE agent_run_id = $1 AND step_type = 'tool_call' AND tool_name = 'write_underwriting'
       ORDER BY step_index ASC`,
      [runId]
    );
    const proformaFields: Record<string, FieldOutput> = {};
    for (const row of rows) {
      const payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
      if (payload?.field_path && payload?.value !== undefined) {
        proformaFields[payload.field_path] = {
          value: payload.value,
          source: payload.source ?? 'ai',
          evidence: payload.evidence ?? '',
          archive_percentile: payload.archive_percentile,
        };
      }
      if (payload?.input?.field_path) {
        proformaFields[payload.input.field_path] = {
          value: payload.input.value,
          source: payload.input.source ?? 'ai',
          evidence: payload.input.evidence ?? '',
          archive_percentile: payload.input.archive_percentile,
        };
      }
    }
    output.proforma_fields = proformaFields;
    logger.info(`[CashflowPostProcess] Aggregated ${Object.keys(proformaFields).length} proforma fields from agent_run_steps`);
  }

  // ── collision_summary ──
  if (!output.collision_summary) {
    const { rows: collRows } = await query(
      `SELECT payload
       FROM agent_run_steps
       WHERE agent_run_id = $1 AND step_type = 'tool_call' AND tool_name = 'detect_collision'
       ORDER BY step_index ASC`,
      [runId]
    );
    const counts: CollisionCounts = { minor_count: 0, material_count: 0, severe_count: 0 };
    for (const row of collRows) {
      const payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
      const input = payload?.input ?? payload;
      if (input?.severity === 'minor') counts.minor_count++;
      else if (input?.severity === 'material') counts.material_count++;
      else if (input?.severity === 'severe') counts.severe_count++;
    }
    output.collision_summary = counts;
    logger.info(`[CashflowPostProcess] Aggregated collision_summary from ${collRows.length} detect_collision calls`);
  }

  // ── confidence_distribution ──
  if (!output.confidence_distribution) {
    const { rows: confRows } = await query(
      `SELECT payload
       FROM agent_run_steps
       WHERE agent_run_id = $1 AND step_type = 'tool_call'
         AND tool_name = 'write_underwriting'
       ORDER BY step_index ASC`,
      [runId]
    );
    const dist = { high: 0, medium: 0, low: 0 };
    for (const row of confRows) {
      const payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
      const confidence = payload?.input?.confidence_level ?? payload?.confidence_level;
      if (confidence === 'high') dist.high++;
      else if (confidence === 'medium') dist.medium++;
      else if (confidence === 'low') dist.low++;
    }
    output.confidence_distribution = dist;
    logger.info(`[CashflowPostProcess] Aggregated confidence_distribution: ${JSON.stringify(dist)}`);
  }

  // ── tier_distribution ──
  if (!output.tier_distribution) {
    const { rows: tierRows } = await query(
      `SELECT payload
       FROM agent_run_steps
       WHERE agent_run_id = $1 AND step_type = 'tool_call'
         AND tool_name = 'write_underwriting'
       ORDER BY step_index ASC`,
      [runId]
    );
    const tiers = { tier1: 0, tier2: 0, tier3: 0, tier4: 0 };
    for (const row of tierRows) {
      const payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
      const tier = payload?.input?.evidence_tier ?? payload?.evidence_tier;
      if (tier === 1 || tier === '1') tiers.tier1++;
      else if (tier === 2 || tier === '2') tiers.tier2++;
      else if (tier === 3 || tier === '3') tiers.tier3++;
      else if (tier === 4 || tier === '4') tiers.tier4++;
    }
    output.tier_distribution = tiers;
    logger.info(`[CashflowPostProcess] Aggregated tier_distribution: ${JSON.stringify(tiers)}`);
  }
}

/**
 * P3-03: Scan agent-written proforma_fields for market signals that justify
 * a non-MARKET stance. Returns a partial stance patch when signals are found,
 * or null when market conditions look normal.
 *
 * Signal thresholds:
 *   vacancy > 0.08 pp       → cyclePosition: LATE
 *   vacancy > 0.07 pp       → stressVacancyFloor bump (1–5 pp)
 *   rent_growth < 0.02 /yr  → underwritingPosture: CONSERVATIVE
 */
function inferStanceSignals(
  proformaFields: Record<string, any>,
): OperatorStancePatch | null {
  const vacancyField = proformaFields['vacancy'];
  const rentGrowthField = proformaFields['rentGrowth'] ?? proformaFields['rent_growth'];

  const vacancy: number | null = typeof vacancyField?.value === 'number' ? vacancyField.value : null;
  const rentGrowth: number | null = typeof rentGrowthField?.value === 'number' ? rentGrowthField.value : null;

  const signals: OperatorStancePatch = {};
  let hasSignal = false;

  if (vacancy != null && vacancy > 0.08) {
    signals.cyclePosition = 'LATE';
    hasSignal = true;
  }

  if (vacancy != null && vacancy > 0.07) {
    // Express excess vacancy above typical 5% floor as an explicit stress dial (1–5 pp)
    const impliedFloor = Math.round((vacancy - 0.05) * 100); // pp as integer
    signals.stressVacancyFloor = Math.min(5, Math.max(1, impliedFloor));
    hasSignal = true;
  }

  if (rentGrowth != null && rentGrowth < 0.02) {
    signals.underwritingPosture = 'CONSERVATIVE';
    hasSignal = true;
  }

  return hasSignal ? signals : null;
}

async function countToolCalls(runId: string, toolName: string): Promise<number> {
  const { rows } = await query(
    `SELECT COUNT(*) AS cnt FROM agent_run_steps
     WHERE agent_run_id = $1 AND step_type = 'tool_call' AND tool_name = $2`,
    [runId, toolName]
  );
  return Number(rows[0]?.cnt ?? 0);
}

function hasField(obj: Record<string, unknown>, key: string): boolean {
  return key in obj && obj[key] != null;
}

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
import { correctSnapshotMath } from '../services/proforma/proFormaMathEngine';
import type { ProFormaSnapshot, SourceType } from '../services/proforma/proFormaMathEngine';

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

    // ── Pro Forma Math Engine v1.1: correctSnapshotMath ──────────────────────
    // Build a ProFormaSnapshot from the resolved proforma_fields, run the math
    // integrity validator, and auto-correct any subtotal mismatches or
    // breakdown-vs-aggregate divergences. Corrections are applied back to
    // proforma_fields in-place. The compact validation report is written to
    // output.math_correction_report for downstream consumers (Task #805 badge UI).
    // Non-fatal: any failure here never blocks agent output.
    if (output.proforma_fields && typeof output.proforma_fields === 'object') {
      try {
        const pfFields = output.proforma_fields as Record<string, any>;

        const resolvedColumn: Record<string, number> = {};
        const sourceMetadataResolved: Record<string, SourceType> = {};

        for (const [fieldPath, fieldEntry] of Object.entries(pfFields)) {
          const entry = fieldEntry as Record<string, unknown>;
          const raw = entry?.value;
          const numValue =
            typeof raw === 'number' ? raw
            : typeof raw === 'string' && raw !== '' && !isNaN(Number(raw)) ? Number(raw)
            : null;
          if (numValue !== null) {
            resolvedColumn[fieldPath] = numValue;
          }
          if (typeof entry?.source === 'string') {
            sourceMetadataResolved[fieldPath] = mapSourceLabel(entry.source);
          }
        }

        const snapshot: ProFormaSnapshot = {
          resolved: resolvedColumn,
          source_metadata: { resolved: sourceMetadataResolved },
        };

        const { corrected_snapshot, validation_report, was_corrected } = correctSnapshotMath(
          snapshot,
          {
            deal_id: ctx.dealId ?? 'unknown',
            run_id: runId,
            prompt_version: (output.prompt_version as string | undefined) ?? 'unknown',
            logger,
          },
        );

        if (was_corrected) {
          for (const [fieldPath, correctedValue] of Object.entries(corrected_snapshot.resolved)) {
            const existing = pfFields[fieldPath];
            if (existing && typeof existing === 'object') {
              const rec = existing as Record<string, unknown>;
              if (rec.value !== correctedValue) {
                rec.value = correctedValue;
              }
            }
          }

          // ── Write corrected subtotals back to deal_assumptions.year1 ──────────
          // correctSnapshotMath patches output.proforma_fields in-memory
          // (persisted to agent_runs.output) but never touches deal_assumptions.year1,
          // which is the data source getDealFinancials() reads.
          // Write only the subtotals that actually changed so the Pro Forma tab
          // displays the engine-corrected values. Non-fatal: never blocks agent output.
          if (ctx.dealId) {
            try {
              // Maps math engine canonical field paths → deal_assumptions.year1 short keys.
              // Only subtotal rows are eligible — never rewrite individual leaf line items.
              const SUBTOTAL_TO_YEAR1: Record<string, string> = {
                'proforma.opex.total':                  'total_opex',
                'proforma.revenue.egi':                 'egi',
                'proforma.noi':                         'noi',
                'proforma.revenue.base_rental_revenue': 'net_rental_income',
                'proforma.noi_after_reserves':          'noi_after_reserves',
              };

              let writeCount = 0;
              for (const [enginePath, correctedValue] of Object.entries(corrected_snapshot.resolved)) {
                const year1Key = SUBTOTAL_TO_YEAR1[enginePath];
                if (year1Key === undefined) continue;

                // Skip if the engine did not actually change this field
                const originalValue = resolvedColumn[enginePath];
                if (originalValue === correctedValue) continue;

                // jsonb_set(COALESCE(year1,'{}'), ARRAY[key,'resolved'], to_jsonb(value), create_missing=true)
                // Updates only the 'resolved' slot within the existing LayeredValue
                // envelope, preserving t12/broker/platform layers untouched.
                await query(
                  `UPDATE deal_assumptions
                   SET year1 = jsonb_set(
                     COALESCE(year1, '{}'),
                     ARRAY[$2::text, 'resolved'],
                     to_jsonb($3::numeric),
                     true
                   )
                   WHERE deal_id = $1`,
                  [ctx.dealId, year1Key, correctedValue],
                );
                writeCount++;
              }

              if (writeCount > 0) {
                logger.info('[CashflowPostProcess] Math-corrected subtotals written back to deal_assumptions.year1', {
                  dealId: ctx.dealId,
                  runId,
                  writeCount,
                });
              }
            } catch (writeBackErr) {
              logger.warn('[CashflowPostProcess] Math-engine subtotal write-back to year1 failed (non-fatal)', {
                dealId: ctx.dealId,
                runId,
                err: writeBackErr instanceof Error ? writeBackErr.message : String(writeBackErr),
              });
            }
          }
        }

        // Merge hierarchical_resolutions from all per-column reports into a
        // flat map keyed by field_path. The resolved column is authoritative
        // for the single-column snapshot the postprocessor builds.
        const mergedHierarchicalResolutions: Record<string, object> = {};
        for (const columnReport of Object.values(validation_report.per_column)) {
          for (const [path, resolution] of Object.entries(columnReport.hierarchical_resolutions)) {
            mergedHierarchicalResolutions[path] = resolution;
          }
        }

        output.math_correction_report = {
          passed: validation_report.passed,
          was_corrected,
          summary: validation_report.summary,
          hierarchical_resolutions: Object.keys(mergedHierarchicalResolutions).length > 0
            ? mergedHierarchicalResolutions
            : undefined,
        };
      } catch (mathErr) {
        logger.warn('[CashflowPostProcess] Math engine correctSnapshotMath failed (non-fatal)', {
          runId,
          err: mathErr instanceof Error ? mathErr.message : String(mathErr),
        });
      }
    }

    // ── Value-add GPR: fill + validate ───────────────────────────────────────
    // Two responsibilities (both non-fatal):
    //   A. FILL: deterministically compute missing math slots (post_reno_target_rent,
    //      gross_premium, captured_premium) from comp ceiling data the agent wrote.
    //   B. VALIDATE: scan for slot completeness; surface gaps in value_add_gpr_validation.
    //   C. COLLIDE: emit a capture-rate collision when agent assumption exceeds track record.
    //
    // Handles both agent path formats:
    //   format A (bracket): proforma.revenue.gpr.unit_mix[floor_plan_id].slot
    //   format B (dot):     proforma.revenue.gpr.unit_mix.floor_plan_id.slot
    if (output.proforma_fields && typeof output.proforma_fields === 'object') {
      try {
        await fillAndValidateValueAddGPR(output, runId);
      } catch (validationErr) {
        logger.warn('[CashflowPostProcess] Value-add GPR fill/validate failed (non-fatal)', {
          runId,
          err: validationErr instanceof Error ? validationErr.message : String(validationErr),
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
/**
 * Map an agent source label string to a canonical SourceType understood by
 * the Pro Forma Math Engine v1.1. Matches common variants the LLM writes.
 */
function mapSourceLabel(source: string): SourceType {
  const s = source.toLowerCase();
  if (s.includes('rent_roll') || s.includes('rentroll') || s.includes('rent roll')) return 'rent_roll';
  if (s.includes('t12') || s.includes('t-12') || s.includes('t 12') || s.includes('trailing')) return 't12';
  if (s.includes('user_override') || s.includes('override')) return 'user_override';
  // 'computed' must be checked before 'om' — 'computed' contains the substring 'om'
  // and would be incorrectly mapped to the lower-priority 'om' source if order were reversed.
  if (s === 'computed' || s.includes('math_fill') || s.includes('postprocessor')) return 'computed';
  if (s === 'om' || s.includes('broker') || s.includes('marketing') || s.includes('offering')) return 'om';
  return 'platform_fallback';
}

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

/**
 * VALUE-ADD GPR: FILL + VALIDATE
 *
 * Three responsibilities (all non-fatal, non-destructive):
 *
 * A. FILL — deterministically compute any missing math slots from what the
 *    agent already wrote (comp ceiling + current rent + capture rate → derived slots):
 *      post_reno_target_rent = comp_ceiling at positioning_percentile
 *      gross_premium         = post_reno_target_rent − current_market_rent
 *      captured_premium      = gross_premium × capture_rate
 *    Written with source='postprocessor_math_fill' so evidence chain is auditable.
 *
 * B. VALIDATE — scan for completeness; surface gaps in value_add_gpr_validation.
 *
 * C. COLLIDE — emit a collision when agent's chosen capture_rate exceeds the
 *    archive P50 anchor (0.80) by more than 0.05 without documented track record.
 *
 * Handles both agent path formats:
 *   bracket: proforma.revenue.gpr.unit_mix[floor_plan_id].slot
 *   dot:     proforma.revenue.gpr.unit_mix.floor_plan_id.slot
 */
const REQUIRED_UNIT_MIX_SLOTS = [
  'unit_count',
  'current_market_rent',
  'comp_ceiling_p25',
  'comp_ceiling_p50',
  'comp_ceiling_p75',
  'positioning_percentile',
  'post_reno_target_rent',
  'gross_premium',
  'capture_rate',
  'captured_premium',
] as const;

// Archive P50 capture rate anchor (matches fetch_owned_asset_actuals canonical default)
const ARCHIVE_P50_CAPTURE_RATE = 0.80;
// Threshold above P50 that triggers a collision (5pp above archive P50 = above archive P75)
const CAPTURE_RATE_COLLISION_THRESHOLD = ARCHIVE_P50_CAPTURE_RATE + 0.05;

async function fillAndValidateValueAddGPR(output: Record<string, unknown>, runId: string): Promise<void> {
  const proformaFields = output.proforma_fields as Record<string, unknown>;
  const allKeys = Object.keys(proformaFields);

  // ── Detect value-add GPR context ─────────────────────────────────────────
  // Primary gate: deal_type/investment_strategy carries a value-add keyword.
  // Supplemental: unit_mix slots are present (agent wrote floor-plan data).
  // Unit-mix alone is NOT sufficient — all deal types can have a unit mix.
  const dealTypeField = proformaFields['deal_type'] ?? proformaFields['investment_strategy'];
  const dealTypeValue = dealTypeField && typeof dealTypeField === 'object'
    ? String((dealTypeField as Record<string, unknown>).value ?? '')
    : String(dealTypeField ?? '');
  const valueAddSignalInDealType = /value.?add|rehab|reposit|renovati/i.test(dealTypeValue);

  const unitMixKeys = allKeys.filter(k =>
    k.includes('unit_mix[') || /unit_mix\.\w/.test(k)
  );
  // Require both: strategy signals value-add AND floor-plan slots were written.
  const isValueAddContext = valueAddSignalInDealType && unitMixKeys.length > 0;

  if (!isValueAddContext) return;

  // ── Detect floor plans — supports BOTH bracket and dot path formats ────
  const bracketPattern = /\.unit_mix\[([^\]]+)\]\./;
  const dotPattern = /\.unit_mix\.([^.[]+)\./;
  const floorPlanIds = new Set<string>();
  for (const key of unitMixKeys) {
    const bm = bracketPattern.exec(key);
    if (bm?.[1]) { floorPlanIds.add(bm[1]); continue; }
    const dm = dotPattern.exec(key);
    if (dm?.[1]) floorPlanIds.add(dm[1]);
  }

  if (floorPlanIds.size === 0) {
    logger.warn('[CashflowPostProcess] Value-add GPR: no unit_mix slots written despite value-add signal', { dealTypeValue });
    output.value_add_gpr_validation = {
      is_value_add_context: true,
      floor_plans_found: [],
      missing_slots: [{ floor_plan_id: '*', missing: REQUIRED_UNIT_MIX_SLOTS.slice(),
        note: 'No unit_mix slots written. Dual comp set protocol was not applied.' }],
      complete: false,
    };
    return;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  const getNumeric = (fieldValue: unknown): number | null => {
    if (fieldValue == null) return null;
    if (typeof fieldValue === 'number') return fieldValue;
    if (typeof fieldValue === 'object') {
      const v = (fieldValue as Record<string, unknown>).value;
      return typeof v === 'number' ? v : (typeof v === 'string' && !isNaN(Number(v)) ? Number(v) : null);
    }
    return typeof fieldValue === 'string' && !isNaN(Number(fieldValue)) ? Number(fieldValue) : null;
  };

  const getSlot = (prefix: string, slot: string): number | null =>
    getNumeric(proformaFields[`${prefix}.${slot}`]);

  const hasSlot = (prefix: string, slot: string): boolean =>
    `${prefix}.${slot}` in proformaFields && proformaFields[`${prefix}.${slot}`] != null;

  const writeSlot = (prefix: string, slot: string, value: number, formula: string): void => {
    proformaFields[`${prefix}.${slot}`] = {
      value: Math.round(value * 100) / 100,
      source: 'postprocessor_math_fill',
      // Canonical CanonicalEvidence shape: source_tier (1-4 number), source_label (string),
      // confidence ('high'|'medium'|'low'). Must match CanonicalEvidence interface exactly.
      evidence: {
        source_tier: 4,
        source_label: 'postprocessor_math_fill',
        confidence: 'medium',
        derivation_chain: [formula],
        source_doc_ref: null,
        source_doc_excerpt: null,
        data_points: [],
        collision_with_broker: null,
      },
    };
  };

  // ── D. DUAL-COMP-SET ENFORCEMENT ─────────────────────────────────────────
  // Deterministically verify that both comp roles (baseline + renovation_ceiling) were called.
  // For value-add context, both comp sets are required by the GPR methodology spec.
  const dualCompValidation = { baseline_called: false, renovation_ceiling_called: false };
  // Track which floor plans the renovation_ceiling comp call returned as low-confidence.
  const lowConfidenceFloorPlans = new Set<string>();
  try {
    const { rows: compCallRows } = await query(
      `SELECT payload FROM agent_run_steps
       WHERE agent_run_id = $1 AND step_type = 'tool_result' AND tool_name = 'fetch_peer_comp_noi_metrics'
       ORDER BY step_index ASC`,
      [runId]
    );
    for (const row of compCallRows) {
      const p = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
      const role: string = p?.comp_role ?? '';
      if (role === 'baseline') dualCompValidation.baseline_called = true;
      if (role === 'renovation_ceiling') {
        dualCompValidation.renovation_ceiling_called = true;
        // Collect low-confidence floor plans from this call (n < 3 → low).
        // rent_distribution_by_unit_type is a Record<unitType, { n, p25, p50, p75, confidence }>
        const dist = p?.rent_distribution_by_unit_type;
        if (dist && typeof dist === 'object' && !Array.isArray(dist)) {
          for (const [unitType, entry] of Object.entries(dist as Record<string, { confidence?: string }>)) {
            if (entry?.confidence === 'low') {
              lowConfidenceFloorPlans.add(unitType);
            }
          }
        }
      }
    }
  } catch {
    // Non-fatal: if DB query fails, dual-comp validation is inconclusive
  }

  const dualCompMissing: string[] = [];
  if (!dualCompValidation.baseline_called) dualCompMissing.push('baseline');
  if (!dualCompValidation.renovation_ceiling_called) dualCompMissing.push('renovation_ceiling');
  if (dualCompMissing.length > 0) {
    logger.warn('[CashflowPostProcess] Value-add GPR: missing required comp role calls', {
      runId, missing: dualCompMissing,
    });
  }

  // ── Fetch documented track record capture rate from fetch_owned_asset_actuals result ──
  // Query the tool_result step for this run to get renovation_capture_summary.recommended_capture_rate.
  // This is the S3-sourced rate against which the agent's chosen capture_rate is compared.
  // Falls back to ARCHIVE_P50_CAPTURE_RATE (0.80) if the tool was not called or returned no programs.
  let trackRecordCaptureRate = ARCHIVE_P50_CAPTURE_RATE;
  try {
    const { rows: assetActualsRows } = await query(
      `SELECT payload FROM agent_run_steps
       WHERE agent_run_id = $1 AND step_type = 'tool_result' AND tool_name = 'fetch_owned_asset_actuals'
       ORDER BY step_index DESC LIMIT 1`,
      [runId]
    );
    if (assetActualsRows.length > 0) {
      const payload = typeof assetActualsRows[0].payload === 'string'
        ? JSON.parse(assetActualsRows[0].payload)
        : assetActualsRows[0].payload;
      const rcs = payload?.renovation_capture_summary;
      if (rcs && typeof rcs.recommended_capture_rate === 'number') {
        trackRecordCaptureRate = rcs.recommended_capture_rate;
      }
    }
  } catch {
    // Non-fatal: if DB query fails, fall back to archive P50 anchor
  }
  // Collision threshold: agent's capture_rate > track_record + 5pp (materially above documented evidence)
  const captureRateCollisionThreshold = trackRecordCaptureRate + 0.05;

  // ── Per-floor-plan: FILL + COLLISION ──────────────────────────────────
  let captureRateCollisionCount = 0;

  for (const fpId of floorPlanIds) {
    // Determine which prefix format this floor plan uses
    const bracketPrefix = `proforma.revenue.gpr.unit_mix[${fpId}]`;
    const dotPrefix = `proforma.revenue.gpr.unit_mix.${fpId}`;
    const prefix = allKeys.some(k => k.startsWith(bracketPrefix + '.')) ? bracketPrefix : dotPrefix;

    // Read existing slot values
    const positioning_pct = getSlot(prefix, 'positioning_percentile') ?? 0.50;
    const current_market_rent = getSlot(prefix, 'current_market_rent');
    const p25 = getSlot(prefix, 'comp_ceiling_p25');
    const p50 = getSlot(prefix, 'comp_ceiling_p50');
    const p75 = getSlot(prefix, 'comp_ceiling_p75');
    const capture_rate = getSlot(prefix, 'capture_rate') ?? ARCHIVE_P50_CAPTURE_RATE;

    // ── A. FILL: compute post_reno_target_rent from comp ceiling at positioning percentile
    const ceilingAtPercentile: number | null = (() => {
      if (positioning_pct <= 0.375) return p25;
      if (positioning_pct <= 0.625) return p50;
      return p75 ?? p50 ?? p25;
    })();

    if (ceilingAtPercentile != null && !hasSlot(prefix, 'post_reno_target_rent')) {
      writeSlot(prefix, 'post_reno_target_rent', ceilingAtPercentile,
        `comp_ceiling at P${Math.round(positioning_pct * 100)} = ${ceilingAtPercentile}`);
    }

    const post_reno_target_rent = getSlot(prefix, 'post_reno_target_rent') ?? ceilingAtPercentile;

    if (post_reno_target_rent != null && current_market_rent != null && !hasSlot(prefix, 'gross_premium')) {
      const gp = post_reno_target_rent - current_market_rent;
      writeSlot(prefix, 'gross_premium', gp,
        `${post_reno_target_rent} (post_reno_target) − ${current_market_rent} (current) = ${gp.toFixed(2)}`);
    }

    const gross_premium = getSlot(prefix, 'gross_premium') ??
      (post_reno_target_rent != null && current_market_rent != null
        ? post_reno_target_rent - current_market_rent : null);

    if (gross_premium != null && !hasSlot(prefix, 'captured_premium')) {
      const cp = gross_premium * capture_rate;
      writeSlot(prefix, 'captured_premium', cp,
        `${gross_premium.toFixed(2)} (gross) × ${capture_rate} (capture_rate) = ${cp.toFixed(2)}`);
    }

    // ── C. COLLIDE: flag when agent's capture_rate exceeds documented track record ─────
    // Compare agent-written capture_rate against S3-sourced recommended_capture_rate
    // (from fetch_owned_asset_actuals). Collision when assertion materially exceeds evidence.
    if (capture_rate > captureRateCollisionThreshold) {
      captureRateCollisionCount++;
      logger.warn('[CashflowPostProcess] GPR capture rate exceeds documented track record', {
        fpId, capture_rate,
        track_record_recommended: trackRecordCaptureRate,
        threshold: captureRateCollisionThreshold,
      });
    }

    // ── E. SPONSOR ASSERTION INCONSISTENCY CHECK ─────────────────────────────
    // If the agent wrote post_reno_target_rent (sponsor assertion) but it differs from
    // comp_ceiling at the positioning percentile by > 10%, flag it as a methodology deviation.
    const agentWrittenPostReno = hasSlot(prefix, 'post_reno_target_rent')
      ? getSlot(prefix, 'post_reno_target_rent')
      : null;
    if (
      agentWrittenPostReno != null &&
      ceilingAtPercentile != null &&
      ceilingAtPercentile > 0
    ) {
      const deviationPct = Math.abs(agentWrittenPostReno - ceilingAtPercentile) / ceilingAtPercentile;
      if (deviationPct > 0.10) {
        logger.warn('[CashflowPostProcess] GPR sponsor-asserted post_reno_target_rent deviates > 10% from comp ceiling', {
          fpId, agentWrittenPostReno, ceilingAtPercentile, deviationPct: (deviationPct * 100).toFixed(1) + '%',
        });
        const inconsistencies = (output.value_add_gpr_assertion_inconsistencies ?? []) as Array<Record<string, unknown>>;
        inconsistencies.push({
          floor_plan_id: fpId,
          agent_post_reno_target_rent: agentWrittenPostReno,
          comp_ceiling_at_percentile: ceilingAtPercentile,
          deviation_pct: Math.round(deviationPct * 1000) / 10,
          note: `Agent asserted post_reno_target_rent deviates ${(deviationPct * 100).toFixed(1)}% from ` +
                `comp ceiling at P${Math.round(positioning_pct * 100)}. ` +
                'Sponsor assertion > 10% above comp ceiling requires documented evidence override.',
        });
        output.value_add_gpr_assertion_inconsistencies = inconsistencies;
      }
    }

    // ── F. CONFIDENCE-RATIONALE ENFORCEMENT ──────────────────────────────────
    // Low-confidence floor plans (n < 3 comps in renovation_ceiling call) require
    // confidence_rationale to be written. Compare case-insensitively to handle
    // naming variations (e.g. '1BR' vs '1br', 'Studio' vs 'studio').
    const fpIdNorm = fpId.toLowerCase();
    const isLowConf = [...lowConfidenceFloorPlans].some(lc => lc.toLowerCase() === fpIdNorm);
    if (isLowConf && !hasSlot(prefix, 'confidence_rationale')) {
      const ratGaps = (output.value_add_gpr_confidence_rationale_gaps ?? []) as string[];
      ratGaps.push(fpId);
      output.value_add_gpr_confidence_rationale_gaps = ratGaps;
      logger.warn('[CashflowPostProcess] GPR low-confidence floor plan missing confidence_rationale', { fpId });
    }
  }

  // Surface capture rate collisions in collision_summary
  if (captureRateCollisionCount > 0) {
    const cs = output.collision_summary as Record<string, number> | undefined;
    if (cs && typeof cs.minor_count === 'number') {
      cs.minor_count += captureRateCollisionCount;
    }
    output.value_add_gpr_capture_rate_collision = {
      floor_plan_count: captureRateCollisionCount,
      track_record_recommended_capture_rate: trackRecordCaptureRate,
      threshold: captureRateCollisionThreshold,
      note: `${captureRateCollisionCount} floor plan(s) have capture_rate > documented track record + 5pp ` +
            `(track record: ${trackRecordCaptureRate}, threshold: ${captureRateCollisionThreshold}). ` +
            'Requires explicit documented justification above buyer track record evidence.',
    };
  }

  // ── B. VALIDATE: completeness check after fill ────────────────────────
  const missingSlotsReport: Array<{ floor_plan_id: string; missing: string[]; note: string }> = [];

  for (const fpId of floorPlanIds) {
    const bracketPrefix = `proforma.revenue.gpr.unit_mix[${fpId}]`;
    const dotPrefix = `proforma.revenue.gpr.unit_mix.${fpId}`;
    const prefix = allKeys.some(k => k.startsWith(bracketPrefix + '.')) ? bracketPrefix : dotPrefix;

    const missing = REQUIRED_UNIT_MIX_SLOTS.filter(slot => !hasSlot(prefix, slot));
    if (missing.length > 0) {
      missingSlotsReport.push({
        floor_plan_id: fpId,
        missing,
        note: `"${fpId}" missing ${missing.length}/${REQUIRED_UNIT_MIX_SLOTS.length} slots after postprocessor fill.`,
      });
    }
  }

  const isFullyComplete = missingSlotsReport.length === 0;
  const confidenceRationaleGaps = (output.value_add_gpr_confidence_rationale_gaps ?? []) as string[];
  output.value_add_gpr_validation = {
    is_value_add_context: true,
    floor_plans_found: [...floorPlanIds],
    missing_slots: missingSlotsReport,
    complete: isFullyComplete,
    // Dual-comp-set enforcement: both baseline + renovation_ceiling must be called for value-add
    dual_comp_set: {
      baseline_called: dualCompValidation.baseline_called,
      renovation_ceiling_called: dualCompValidation.renovation_ceiling_called,
      compliant: dualCompValidation.baseline_called && dualCompValidation.renovation_ceiling_called,
      missing_roles: dualCompMissing,
    },
    // Low-confidence floor plans missing required confidence_rationale
    confidence_rationale_gaps: confidenceRationaleGaps,
  };

  if (!isFullyComplete) {
    logger.warn('[CashflowPostProcess] Value-add GPR: gaps after postprocessor fill', {
      floorPlansWithGaps: missingSlotsReport.map(r => r.floor_plan_id),
      totalRemaining: missingSlotsReport.reduce((acc, r) => acc + r.missing.length, 0),
    });
  } else {
    logger.info('[CashflowPostProcess] Value-add GPR: all unit_mix slots present (including postprocessor fills)', {
      floorPlansVerified: [...floorPlanIds],
    });
  }
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

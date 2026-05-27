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
import { VARIABLE_META } from '../services/sigma/sigma-engine';
import { getStanceForDeal, applyStanceToProformaFields, applyStanceReblend, suggestAgentInferredStance } from '../services/operatorStance.service';
import type { OperatorStancePatch } from '../types/operator-stance';
import { normalizeProformaFields } from './utils/evidenceNormalizer';
import { correctSnapshotMath } from '../services/proforma/proFormaMathEngine';
import { ABSOLUTE_MAX_HOLD_YEARS } from '../services/hold-period-profiles';
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
      // Model used write_underwriting tool — aggregate from DB.
      // Inner try-catch: a DB failure here must NOT prevent the evidence
      // normalization block below from running (which fixes string evidence).
      try {
        await aggregateFromToolCalls(output, runId);
      } catch (aggErr) {
        logger.warn('[CashflowPostProcess] aggregateFromToolCalls failed (non-fatal) — normalization will still run', {
          runId,
          err: aggErr instanceof Error ? aggErr.message : String(aggErr),
        });
      }
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
    //
    // Hoisted so the agent write-back block below can prefer math-corrected
    // values for any revenue subtotals touched by the engine.
    let correctedSnapshotResolved: Record<string, number> = {};
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

        // Hoist corrected values for use by the agent write-back block.
        correctedSnapshotResolved = corrected_snapshot.resolved;

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
                // M40: write corrected subtotal to the active underwriting scenario.
                // Trigger syncs deal_assumptions.year1; fallback for pre-migration deals.
                const subWriteRes = await query(
                  `UPDATE deal_underwriting_scenarios
                   SET year1 = jsonb_set(
                     COALESCE(year1, '{}'),
                     ARRAY[$2::text, 'resolved'],
                     to_jsonb($3::numeric),
                     true
                   ),
                   updated_at = NOW()
                   WHERE deal_id = $1 AND is_active = TRUE AND deleted_at IS NULL
                   RETURNING id`,
                  [ctx.dealId, year1Key, correctedValue],
                );
                if ((subWriteRes.rowCount ?? 0) === 0) {
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
                }
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

    // ── Agent line-item write-back to deal_assumptions.year1 ──────────────────
    // Writes the agent's resolved leaf values into year1 so the F9 Proforma
    // grid reflects them immediately. Operator overrides take precedence: if a
    // field's override slot is a non-null finite number, the agent write is
    // skipped for that field. Non-fatal — failures never block agent output.
    //
    // resolution: "agent" is the coarse operator-facing label. Full provenance
    // (residual derivations, archive cohort, source tier) is preserved in
    // deal_underwriting_snapshots and accessible via the evidence drawer.
    if (ctx.dealId && output.proforma_fields && typeof output.proforma_fields === 'object') {
      try {
        // Maps agent proforma_fields key → deal_assumptions.year1 short key.
        // Four _dollars keys avoid stomping on _pct / _per_unit fields that store
        // rate values for operator entry (management_fee_pct, vacancy_pct,
        // bad_debt_pct, other_income_per_unit). The new keys are created in JSONB
        // on first write; each holds the agent's annual dollar total directly.
        const AGENT_FIELD_TO_YEAR1: Record<string, string> = {
          'expense.payroll':                'payroll',
          'expense.property_tax':           'real_estate_tax',
          'expense.insurance':              'insurance',
          'expense.utilities':              'utilities',
          'expense.repairs_maintenance':    'repairs_maintenance',
          'expense.marketing':              'marketing',
          'expense.admin_general':          'g_and_a',
          'expense.management_fee':         'management_fee_dollars',  // new: dollars, not pct
          'expense.replacement_reserves':   'replacement_reserves',
          'expense.contract_services':      'contract_services',
          'expense.turnover':               'turnover',
          'revenue.gross_potential_rent':   'gpr',
          'revenue.effective_gross_income': 'egi',
          'revenue.other_income':           'other_income_dollars',    // new: annual dollars, not per-unit-per-month
          'revenue.vacancy_loss':           'vacancy_loss_dollars',    // new: dollars, not pct
          'revenue.bad_debt':               'bad_debt_dollars',        // new: dollars, not pct
          'revenue.concessions':            'concessions',
        };

        // Math engine uses different canonical paths for the fields it corrects.
        // When a corrected value exists, prefer it over the agent's raw value.
        // NOTE: proforma.revenue.base_rental_revenue is net rental income (NRI),
        // NOT gross potential rent — it deliberately does NOT map to GPR to avoid
        // overwriting GPR with NRI values. Only EGI has a direct 1-to-1 equivalent.
        const CORRECTED_PATH_TO_AGENT: Record<string, string> = {
          'proforma.revenue.egi': 'revenue.effective_gross_income',
        };

        // Build effective value map: agent's proforma_fields, overlaid with
        // math-engine corrections for any fields the engine touched.
        const pfFieldsForWriteback = output.proforma_fields as Record<string, any>;

        // F-HIGH-004 fix: normalize known non-canonical key variants to their
        // canonical equivalents before processing. The LLM emits variant names
        // across runs (e.g. 'expense.real_estate_taxes' instead of the canonical
        // 'expense.property_tax'). Without normalization, these silently skip
        // write-back. Alias only applied when canonical key is absent (never
        // overwrite an already-emitted canonical value with a variant).
        //
        // Excluded intentionally:
        //   expense.marketing_admin — combined marketing+G&A bucket, not a 1:1
        //   revenue.vacancy_pct / concessions_pct / bad_debt_pct — percentage units,
        //     require GPR to convert to dollars, defer to a dedicated fix.
        const KEY_ALIASES: Record<string, string> = {
          'expense.real_estate_taxes': 'expense.property_tax',  // 25 runs silently failing
          'expense.g_and_a':           'expense.admin_general', // variant spelling
          'expense.bad_debt':          'revenue.bad_debt',      // same annual dollar amount
        };
        for (const [alias, canonical] of Object.entries(KEY_ALIASES)) {
          if (
            pfFieldsForWriteback[alias] != null &&
            pfFieldsForWriteback[canonical] == null
          ) {
            pfFieldsForWriteback[canonical] = pfFieldsForWriteback[alias];
          }
        }

        const effectiveValues: Record<string, number | null> = {};

        for (const agentKey of Object.keys(AGENT_FIELD_TO_YEAR1)) {
          const field = pfFieldsForWriteback[agentKey];
          const raw = field?.value;
          const num =
            typeof raw === 'number' ? raw
            : typeof raw === 'string' && raw !== '' && !isNaN(Number(raw)) ? Number(raw)
            : null;
          if (num !== null) effectiveValues[agentKey] = num;
        }
        // Overlay math-engine-corrected values where available
        for (const [enginePath, correctedVal] of Object.entries(correctedSnapshotResolved)) {
          const agentKey = CORRECTED_PATH_TO_AGENT[enginePath];
          if (agentKey && typeof correctedVal === 'number') {
            effectiveValues[agentKey] = correctedVal;
          }
        }

        // Fetch current year1 once to evaluate per-field override status
        const { rows: daRows } = await query(
          `SELECT year1 FROM deal_assumptions WHERE deal_id = $1`,
          [ctx.dealId]
        );
        const currentYear1 = (daRows[0]?.year1 ?? {}) as Record<string, unknown>;

        let agentWriteCount = 0;
        const agentSkippedFields: string[] = [];
        const agentFailedFields: string[] = [];

        for (const [agentKey, year1Key] of Object.entries(AGENT_FIELD_TO_YEAR1)) {
          const agentValue = effectiveValues[agentKey];
          if (agentValue === null || agentValue === undefined) continue;

          // Skip if operator has a non-null, finite numeric override — it wins.
          // Also emit a divergence note when the agent's value differs from the
          // operator override by ≥20% — surfaces in collision_summary so the
          // operator is aware the agent disagrees with their manual entry.
          const existingLv = currentYear1[year1Key] as Record<string, unknown> | undefined;
          const existingOverride = existingLv?.override;
          if (
            existingOverride !== null &&
            existingOverride !== undefined &&
            typeof existingOverride === 'number' &&
            isFinite(existingOverride as number)
          ) {
            const numericAgent = typeof agentValue === 'number' ? agentValue : null;
            if (
              numericAgent !== null &&
              existingOverride !== 0 &&
              Math.abs(numericAgent - existingOverride) / Math.abs(existingOverride) >= 0.2
            ) {
              // Log divergence for downstream collision surfacing
              const pct = Math.round(
                ((numericAgent - existingOverride) / Math.abs(existingOverride)) * 100
              );
              logger.warn('agent_vs_operator_override_divergence', {
                dealId: ctx.dealId,
                field: year1Key,
                agent_value: numericAgent,
                operator_override: existingOverride,
                override_source: (existingLv as Record<string, unknown>)?.override_source ?? 'unknown',
                divergence_pct: pct,
              });
            }
            agentSkippedFields.push(year1Key);
            continue;
          }

          // Write agent slot, update resolved, set resolution = "agent".
          // Each field is wrapped in its own try/catch so a single failure never
          // prevents remaining fields from being written (per-field isolation).
          // Uses || (jsonb concatenation) to merge the three agent sub-keys into
          // the existing LayeredValue envelope (or create one from scratch for new
          // keys like management_fee_dollars / concessions). This preserves existing
          // slots (t12, om, override, platform) while adding/updating agent,
          // resolved, and resolution sub-keys.
          try {
            // M40: write agent value to the active underwriting scenario.
            // The DB trigger mirrors the change to deal_assumptions.year1.
            // Falls back to deal_assumptions for deals without a scenario.
            const agentScenarioRes = await query(
              `UPDATE deal_underwriting_scenarios
               SET year1 = jsonb_set(
                 COALESCE(year1, '{}'),
                 ARRAY[$2::text],
                 COALESCE(year1->$2::text, '{}') || jsonb_build_object(
                   'agent',      $3::numeric,
                   'resolved',   $3::numeric,
                   'resolution', $4::text
                 ),
                 true
               ),
               updated_at = NOW()
               WHERE deal_id = $1 AND is_active = TRUE AND deleted_at IS NULL
               RETURNING id`,
              [ctx.dealId, year1Key, agentValue, 'agent']
            );
            if ((agentScenarioRes.rowCount ?? 0) === 0) {
              await query(
                `UPDATE deal_assumptions
                 SET year1 = jsonb_set(
                   COALESCE(year1, '{}'),
                   ARRAY[$2::text],
                   COALESCE(year1->$2::text, '{}') || jsonb_build_object(
                     'agent',      $3::numeric,
                     'resolved',   $3::numeric,
                     'resolution', $4::text
                   ),
                   true
                 )
                 WHERE deal_id = $1`,
                [ctx.dealId, year1Key, agentValue, 'agent']
              );
            }
            agentWriteCount++;
          } catch (fieldWriteErr) {
            agentFailedFields.push(year1Key);
            logger.warn('[CashflowPostProcess] Agent write-back failed for field (non-fatal, continuing)', {
              dealId: ctx.dealId,
              runId,
              year1Key,
              err: fieldWriteErr instanceof Error ? fieldWriteErr.message : String(fieldWriteErr),
            });
          }
        }

        // ── Sub-field writeback (pre_renovation / post_stabilization) ─────────
        // For value-add and redevelopment deals, the agent may write pre/post
        // sub-fields on eligible regime-sensitive line items (v1.3 Sub-Field Write
        // Protocol). These are stored as separate year1 JSONB keys so that
        // regimeDataByField in proforma-adjustment.service.ts can merge them with
        // higher priority than the T12 baseline.
        // Key convention: `{year1Key}__pre_renovation` / `{year1Key}__post_stabilization`
        // Rejection rules (enforced here, mirroring prompt guardrails):
        //   - post_stabilization with confidence 'low' is rejected
        //   - pre_renovation without a numeric value is skipped
        {
          const SUB_FIELD_AGENT_TO_YEAR1: Record<string, string> = {
            'revenue.vacancy_loss':        'vacancy_loss_dollars',
            'revenue.concessions':         'concessions',
            'revenue.bad_debt':            'bad_debt_dollars',
            'revenue.other_income':        'other_income_dollars',
            'expense.repairs_maintenance': 'repairs_maintenance',
            'expense.marketing':           'marketing',
            'expense.contract_services':   'contract_services',
            'expense.turnover':            'turnover',
            'expense.replacement_reserves':'replacement_reserves',
          };

          // Directional validation: collect pre/post written values per agentKey for post-loop checks
          const _writtenPairs: Record<string, {
            preVal: number | null; preConf: string | null;
            postVal: number | null; postConf: string | null;
          }> = {};

          for (const [agentKey, year1Key] of Object.entries(SUB_FIELD_AGENT_TO_YEAR1)) {
            const field = pfFieldsForWriteback[agentKey];
            if (!field || typeof field !== 'object') continue;

            for (const subField of ['pre_renovation', 'post_stabilization'] as const) {
              const sub = (field as Record<string, unknown>)[subField];
              if (!sub || typeof sub !== 'object') continue;
              const subObj = sub as Record<string, unknown>;
              const subVal = subObj['value'];
              if (typeof subVal !== 'number' || !isFinite(subVal)) continue;

              // Confidence gate: post_stabilization requires 'medium' or 'high'
              const conf = subObj['confidence'] as string | undefined;
              if (subField === 'post_stabilization' && conf === 'low') {
                logger.debug('[CashflowPostProcess] Rejecting low-confidence post_stabilization sub-field', {
                  dealId: ctx.dealId, agentKey,
                });
                continue;
              }

              // Collect for Tier 2 directional validation (runs after outer loop completes)
              if (!_writtenPairs[agentKey]) {
                _writtenPairs[agentKey] = { preVal: null, preConf: null, postVal: null, postConf: null };
              }
              if (subField === 'pre_renovation') {
                _writtenPairs[agentKey].preVal  = subVal;
                _writtenPairs[agentKey].preConf = conf ?? null;
              } else {
                _writtenPairs[agentKey].postVal  = subVal;
                _writtenPairs[agentKey].postConf = conf ?? null;
              }

              const subKey = `${year1Key}__${subField}`;
              const subPayload = JSON.stringify({
                value:      subVal,
                confidence: conf ?? null,
                source:     (subObj['source'] as string | null) ?? 'agent:cashflow',
                note:       (subObj['note'] as string | null) ?? null,
              });

              try {
                const subScenarioRes = await query(
                  `UPDATE deal_underwriting_scenarios
                   SET year1 = jsonb_set(COALESCE(year1, '{}'), ARRAY[$2::text], $3::jsonb, true),
                       updated_at = NOW()
                   WHERE deal_id = $1 AND is_active = TRUE AND deleted_at IS NULL
                   RETURNING id`,
                  [ctx.dealId, subKey, subPayload]
                );
                if ((subScenarioRes.rowCount ?? 0) === 0) {
                  await query(
                    `UPDATE deal_assumptions
                     SET year1 = jsonb_set(COALESCE(year1, '{}'), ARRAY[$2::text], $3::jsonb, true)
                     WHERE deal_id = $1`,
                    [ctx.dealId, subKey, subPayload]
                  );
                }
                logger.debug('[CashflowPostProcess] Sub-field written', {
                  dealId: ctx.dealId, subKey, value: subVal, confidence: conf,
                });
              } catch (subWriteErr) {
                logger.warn('[CashflowPostProcess] Sub-field write failed (non-fatal)', {
                  dealId: ctx.dealId, runId, subKey,
                  err: subWriteErr instanceof Error ? subWriteErr.message : String(subWriteErr),
                });
              }
            }
          }

          // ── Tier 2 directional validation checks (MANDATE_CONSUMER_WIRING.md §4.3) ─────
          // Warning-level only — no rejection logic changes. Fires after both sub-fields for
          // each agentKey have been collected. Accumulates into output.validation_warnings.
          {
            const DIRECTIONAL_RULES: Record<string, 'post_lte_pre' | 'post_gte_pre'> = {
              'revenue.vacancy_loss':        'post_lte_pre',
              'revenue.concessions':         'post_lte_pre',
              'revenue.bad_debt':            'post_lte_pre',
              'revenue.other_income':        'post_gte_pre',
              'expense.repairs_maintenance': 'post_lte_pre',
              'expense.marketing':           'post_lte_pre',
              'expense.turnover':            'post_lte_pre',
            };
            const DELTA_THRESHOLDS: Record<string, number> = {
              'revenue.vacancy_loss':        0.60,
              'revenue.concessions':         0.60,
              'revenue.bad_debt':            0.60,
              'revenue.other_income':        0.80,
              'expense.repairs_maintenance': 0.80,
              'expense.turnover':            0.80,
              'expense.marketing':           0.60,
              'expense.contract_services':   0.50,
            };
            const CONF_RANK: Record<string, number> = { high: 3, medium: 2, low: 1 };

            if (!output.validation_warnings) output.validation_warnings = [];
            const _vwarn = output.validation_warnings as Array<Record<string, unknown>>;

            for (const [agentKey, pair] of Object.entries(_writtenPairs)) {
              const { preVal, preConf, postVal, postConf } = pair;

              // Check #1 — Directional consistency
              if (preVal !== null && postVal !== null) {
                const rule = DIRECTIONAL_RULES[agentKey];
                if (rule === 'post_lte_pre' && postVal > preVal) {
                  _vwarn.push({
                    lineItem: agentKey, check: 'directional_consistency',
                    values: { pre: preVal, post: postVal, expected: 'post ≤ pre' },
                    ruleRef: 'MANDATE_LIFT_DESIGN.md §4.4 — directional consistency',
                    action: 'Verify renovation plan supports lower post-stabilization value',
                  });
                  logger.warn('[CashflowPostProcess][V1] Directional inversion', { dealId: ctx.dealId, agentKey, preVal, postVal });
                }
                if (rule === 'post_gte_pre' && postVal < preVal) {
                  _vwarn.push({
                    lineItem: agentKey, check: 'directional_consistency',
                    values: { pre: preVal, post: postVal, expected: 'post ≥ pre' },
                    ruleRef: 'MANDATE_LIFT_DESIGN.md §4.4 — directional consistency',
                    action: 'Verify other income growth assumption is supported',
                  });
                  logger.warn('[CashflowPostProcess][V1] Directional inversion', { dealId: ctx.dealId, agentKey, preVal, postVal });
                }
              }

              // Check #2 — Primary value consistency (post_stabilization should match primary ±5%)
              if (postVal !== null) {
                const pf = pfFieldsForWriteback[agentKey] as Record<string, unknown> | undefined;
                const primaryVal = typeof pf?.['value']    === 'number' ? pf['value']    as number
                                 : typeof pf?.['resolved'] === 'number' ? pf['resolved'] as number
                                 : null;
                if (primaryVal !== null && Math.abs(primaryVal) > 0.01) {
                  const divergence = Math.abs(postVal - primaryVal) / Math.abs(primaryVal);
                  if (divergence > 0.05) {
                    _vwarn.push({
                      lineItem: agentKey, check: 'primary_value_consistency',
                      values: { post: postVal, primary: primaryVal, divergencePct: +(divergence * 100).toFixed(1) },
                      ruleRef: 'MANDATE_LIFT_DESIGN.md §4.4 — post_stabilization ≈ primary ±5%',
                      action: 'Verify post_stabilization value aligns with the main proforma field',
                    });
                    logger.warn('[CashflowPostProcess][V2] Primary value divergence >5%', { dealId: ctx.dealId, agentKey, postVal, primaryVal, divergencePct: +(divergence * 100).toFixed(1) });
                  }
                }
              }

              // Check #3 — Confidence inversion (pre should not be less confident than post)
              if (preConf && postConf) {
                const preRank  = CONF_RANK[preConf]  ?? 0;
                const postRank = CONF_RANK[postConf] ?? 0;
                if (preRank < postRank) {
                  _vwarn.push({
                    lineItem: agentKey, check: 'confidence_inversion',
                    values: { preConfidence: preConf, postConfidence: postConf },
                    ruleRef: 'MANDATE_LIFT_DESIGN.md §4.3 — pre confidence ≥ post confidence',
                    action: 'Pre-renovation is anchored in actuals; post is a projection and should not exceed pre confidence',
                  });
                  logger.warn('[CashflowPostProcess][V3] Confidence inversion', { dealId: ctx.dealId, agentKey, preConf, postConf });
                }
              }

              // Check #4 — Delta plausibility
              if (preVal !== null && postVal !== null && Math.abs(preVal) > 0.01) {
                const threshold = DELTA_THRESHOLDS[agentKey];
                if (threshold !== undefined) {
                  const delta = Math.abs(postVal - preVal) / Math.abs(preVal);
                  if (delta > threshold) {
                    _vwarn.push({
                      lineItem: agentKey, check: 'delta_plausibility',
                      values: { pre: preVal, post: postVal, deltaPct: +(delta * 100).toFixed(1), thresholdPct: +(threshold * 100) },
                      ruleRef: 'MANDATE_LIFT_DESIGN.md §4.4 — delta plausibility thresholds',
                      action: 'Large delta requires strong Tier 1 or Tier 2 evidence; verify evidence source and rationale',
                    });
                    logger.warn('[CashflowPostProcess][V4] Delta plausibility exceeded', { dealId: ctx.dealId, agentKey, deltaPct: +(delta * 100).toFixed(1), thresholdPct: +(threshold * 100) });
                  }
                }
              }
            }
          }
        }

        // ── Derived fallbacks for high-priority badge fields ──────────────────
        // When the agent omits revenue.bad_debt, revenue.concessions, or
        // expense.turnover (all three appear in AGENT_FIELD_TO_YEAR1 but are
        // frequently absent from proforma_fields output), derive them from
        // related seed data so the F9 AI badge always appears for these rows.
        // Fallback only fires when:
        //   (a) the agent did NOT write the field in the main loop above, AND
        //   (b) the operator has no non-null numeric override.
        // Resolution is labelled "agent" (same as the main loop) so the badge
        // behaviour is identical to an agent-written value.
        {
          const getResolvedNum = (lv: unknown): number | null => {
            if (!lv || typeof lv !== 'object') return null;
            const v = (lv as Record<string, unknown>).resolved;
            return typeof v === 'number' && isFinite(v) ? v : null;
          };

          const gpr   = getResolvedNum(currentYear1['gpr']);
          const bdPct  = getResolvedNum(currentYear1['bad_debt_pct']);
          const concPct = getResolvedNum(currentYear1['concessions_pct']);

          // turnover: prefer T12 slot, fall back to current resolved value
          // (avoids overwriting an agent value that might have just been written)
          const turnoverLv = currentYear1['turnover'] as Record<string, unknown> | undefined;
          const turnoverT12 = typeof turnoverLv?.t12 === 'number' && isFinite(turnoverLv.t12 as number)
            ? (turnoverLv.t12 as number) : null;
          const turnoverResolved = getResolvedNum(turnoverLv);

          const DERIVED: Array<{ agentKey: string; year1Key: string; value: number | null }> = [
            {
              agentKey: 'revenue.bad_debt',
              year1Key: 'bad_debt_dollars',
              value: bdPct != null && gpr != null ? Math.round(bdPct * gpr) : null,
            },
            {
              agentKey: 'revenue.concessions',
              year1Key: 'concessions',
              value: concPct != null && gpr != null ? Math.round(concPct * gpr) : null,
            },
            {
              agentKey: 'expense.turnover',
              year1Key: 'turnover',
              value: turnoverT12 ?? turnoverResolved,
            },
          ];

          let derivedWriteCount = 0;
          for (const fb of DERIVED) {
            // Skip when the agent already provided this field in the main loop
            if (effectiveValues[fb.agentKey] != null) continue;
            if (fb.value == null) continue;

            // Skip when operator has a non-null finite numeric override
            const existingLv2 = currentYear1[fb.year1Key] as Record<string, unknown> | undefined;
            const existingOverride2 = existingLv2?.override;
            if (
              existingOverride2 !== null &&
              existingOverride2 !== undefined &&
              typeof existingOverride2 === 'number' &&
              isFinite(existingOverride2 as number)
            ) continue;

            // Skip if field already carries resolution:"agent" (prior run already wrote it
            // and nothing has invalidated it — avoid a no-op re-write).
            const existingResolution = existingLv2?.resolution;
            if (existingResolution === 'agent') continue;

            try {
              const agentScenarioRes2 = await query(
                `UPDATE deal_underwriting_scenarios
                 SET year1 = jsonb_set(
                   COALESCE(year1, '{}'),
                   ARRAY[$2::text],
                   COALESCE(year1->$2::text, '{}') || jsonb_build_object(
                     'agent',      $3::numeric,
                     'resolved',   $3::numeric,
                     'resolution', $4::text
                   ),
                   true
                 ),
                 updated_at = NOW()
                 WHERE deal_id = $1 AND is_active = TRUE AND deleted_at IS NULL
                 RETURNING id`,
                [ctx.dealId, fb.year1Key, fb.value, 'agent']
              );
              if ((agentScenarioRes2.rowCount ?? 0) === 0) {
                await query(
                  `UPDATE deal_assumptions
                   SET year1 = jsonb_set(
                     COALESCE(year1, '{}'),
                     ARRAY[$2::text],
                     COALESCE(year1->$2::text, '{}') || jsonb_build_object(
                       'agent',      $3::numeric,
                       'resolved',   $3::numeric,
                       'resolution', $4::text
                     ),
                     true
                   )
                   WHERE deal_id = $1`,
                  [ctx.dealId, fb.year1Key, fb.value, 'agent']
                );
              }
              derivedWriteCount++;
            } catch (derivedErr) {
              logger.warn('[CashflowPostProcess] Derived fallback write failed (non-fatal)', {
                dealId: ctx.dealId,
                runId,
                field: fb.year1Key,
                err: derivedErr instanceof Error ? derivedErr.message : String(derivedErr),
              });
            }
          }

          if (derivedWriteCount > 0) {
            agentWriteCount += derivedWriteCount;
            logger.info('[CashflowPostProcess] Derived fallback fields written', {
              dealId: ctx.dealId,
              runId,
              derivedWriteCount,
            });
          }
        }

        logger.info('[CashflowPostProcess] Agent line-item write-back to deal_assumptions.year1', {
          dealId: ctx.dealId,
          runId,
          written: agentWriteCount,
          skipped: agentSkippedFields.length,
          skippedFields: agentSkippedFields,
          ...(agentFailedFields.length > 0 && { failedFields: agentFailedFields }),
        });

        // ── Agent-run version snapshot ───────────────────────────────────────
        // Save a point-in-time version after the agent finishes writing so
        // operators can see a before/after in the version history panel.
        // Only fires when at least one field was actually written (no-ops skipped).
        // Fire-and-catch: version save failure must never block agent output.
        if (ctx.dealId && agentWriteCount > 0) {
          try {
            // Read post-write year1 from the active scenario; fall back to
            // deal_assumptions for deals that pre-date the M40 migration.
            const snapRes = await query(
              `SELECT year1 FROM deal_underwriting_scenarios
                WHERE deal_id = $1 AND is_active = TRUE AND deleted_at IS NULL
               LIMIT 1`,
              [ctx.dealId]
            );
            let snapshot: Record<string, unknown> = {};
            if ((snapRes.rowCount ?? 0) > 0) {
              snapshot = (snapRes.rows[0]?.year1 ?? {}) as Record<string, unknown>;
            } else {
              const daRes = await query(
                `SELECT year1 FROM deal_assumptions WHERE deal_id = $1 LIMIT 1`,
                [ctx.dealId]
              );
              snapshot = (daRes.rows[0]?.year1 ?? {}) as Record<string, unknown>;
            }

            const { DealVersionsService } = await import('../services/proforma/deal-versions.service');
            const dvs = new DealVersionsService();
            await dvs.saveVersion({
              dealId:      ctx.dealId,
              userId:      ctx.userId ?? null,
              snapshot,
              trigger:     'agent_run',
              note:        `agent_run:${runId}`,
              divergences: [],
            });
            logger.info('[CashflowPostProcess] Agent-run version snapshot saved', {
              dealId: ctx.dealId,
              runId,
            });
          } catch (versionErr) {
            logger.warn('[CashflowPostProcess] Agent-run version snapshot failed (non-fatal)', {
              dealId: ctx.dealId,
              runId,
              err: versionErr instanceof Error ? versionErr.message : String(versionErr),
            });
          }
        }
      } catch (agentWriteErr) {
        logger.warn('[CashflowPostProcess] Agent line-item write-back to year1 failed (non-fatal)', {
          dealId: ctx.dealId,
          runId,
          err: agentWriteErr instanceof Error ? agentWriteErr.message : String(agentWriteErr),
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

    // ── Capital Structure Optimization Postprocessor Fallback (Task #889) ─────
    // The agent skipped optimize_capital_structure in 615/615 production runs.
    // Run it deterministically here whenever the agent output lacks the
    // optimization block, so the Returns tab always has a recommendation.
    // Non-fatal: failure must never block the agent response.
    if (ctx.dealId) {
      try {
        const csSection = (output.proforma as Record<string, unknown> | undefined)
          ?.capital_structure as Record<string, unknown> | undefined;
        const hasOptimization = csSection?.optimization != null &&
          typeof csSection.optimization === 'object';

        if (!hasOptimization) {
          // Extract current NOI from proforma_fields
          const pf = output.proforma_fields as Record<string, Record<string, unknown>> | undefined;
          const noiPaths = [
            'revenue.noi', 'income.noi', 'noi', 'net_operating_income',
            'revenue.net_operating_income',
          ];
          let noiYear1: number | null = null;
          for (const p of noiPaths) {
            const entry = pf?.[p];
            if (!entry) continue;
            const raw = entry.value ?? entry.resolved ?? entry.agent;
            if (typeof raw === 'number' && !isNaN(raw)) { noiYear1 = raw; break; }
            if (typeof raw === 'string' && raw !== '' && !isNaN(Number(raw))) {
              noiYear1 = Number(raw); break;
            }
          }

          // Query deal for purchase_price, strategy, and broker NOI fallback.
          // Use LEFT JOIN so deals without a deal_assumptions row still produce
          // a row from the deals table — we can still optimize using deal_data
          // fields (purchase_price, strategy) even without a year1 snapshot.
          const dealRow = await query(
            `SELECT da.year1, da.noi_stabilized, d.deal_category, d.deal_data,
                    d.strategy, d.project_type, d.development_type
               FROM deals d
               LEFT JOIN deal_assumptions da ON da.deal_id = d.id
              WHERE d.id = $1 LIMIT 1`,
            [ctx.dealId],
          );

          if (dealRow.rows.length > 0) {
            const yr1 = (dealRow.rows[0].year1 ?? {}) as Record<string, unknown>;
            const dealData = (dealRow.rows[0].deal_data ?? {}) as Record<string, unknown>;
            const dealCategory = (dealRow.rows[0].deal_category ?? '') as string;

            const resolveLv = (key: string): number | null => {
              const lv = yr1[key] as Record<string, unknown> | undefined;
              if (!lv) return null;
              const v = lv.resolved ?? lv.override ?? lv.agent ?? lv.platform ?? lv.broker;
              if (typeof v === 'number') return v;
              if (typeof v === 'string' && !isNaN(Number(v))) return Number(v);
              return null;
            };

            const purchasePrice = resolveLv('purchase_price')
              ?? (typeof dealData.purchase_price === 'number' ? dealData.purchase_price : null)
              ?? (typeof dealData.purchase_price === 'string' && !isNaN(Number(dealData.purchase_price))
                  ? Number(dealData.purchase_price) : null);

            // Known strategy values recognized by STRATEGY_METRIC_MAP.
            // Any unknown value (e.g. 'portfolio', 'pipeline', or an arbitrary
            // deal_category string) is normalized to 'existing' so the optimizer
            // defaults to cash_on_cash rather than silently falling through to IRR.
            const KNOWN_STRATEGIES = new Set([
              'existing', 'stabilized', 'value-add', 'value_add',
              'development', 'flip', 'lease-up', 'lease_up',
            ]);
            const rawStrategy = (dealRow.rows[0].strategy as string | undefined)
              ?? (dealRow.rows[0].project_type as string | undefined)
              ?? (dealRow.rows[0].development_type as string | undefined)
              ?? (dealData.strategy as string | undefined)
              ?? (dealData.investmentStrategy as string | undefined)
              ?? (dealData.deal_strategy as string | undefined);
            const dealStrategy = rawStrategy && KNOWN_STRATEGIES.has(rawStrategy)
              ? rawStrategy
              : 'existing';

            // If current NOI from proforma_fields is null/negative, try to find a
            // positive NOI from the database. Applies to any strategy — not just
            // lease-up — so that deals with negative current NOI (lease-up,
            // construction, value-add in progress) still get a valid optimization.
            if (noiYear1 === null || noiYear1 <= 0) {
              // 1. Try year1['noi'] LV slots: om (OM extraction) → broker → platform → resolved
              const yr1NoiRaw = yr1['noi'] as Record<string, unknown> | number | undefined;
              if (typeof yr1NoiRaw === 'number' && yr1NoiRaw > 0) {
                noiYear1 = yr1NoiRaw;
              } else if (yr1NoiRaw && typeof yr1NoiRaw === 'object') {
                for (const slot of ['om', 'broker', 'platform', 'resolved', 'agent']) {
                  const v = (yr1NoiRaw as Record<string, unknown>)[slot];
                  if (typeof v === 'number' && v > 0) { noiYear1 = v; break; }
                  if (typeof v === 'string' && !isNaN(Number(v)) && Number(v) > 0) {
                    noiYear1 = Number(v); break;
                  }
                }
              }
              // 2. Try dotted revenue.noi LV field (om → broker → platform → resolved)
              if (!noiYear1 || noiYear1 <= 0) {
                const noiLv = yr1['revenue.noi'] as Record<string, unknown> | undefined;
                for (const slot of ['om', 'broker', 'platform', 'resolved']) {
                  const v = noiLv?.[slot];
                  if (typeof v === 'number' && v > 0) { noiYear1 = v; break; }
                  if (typeof v === 'string' && !isNaN(Number(v)) && Number(v) > 0) {
                    noiYear1 = Number(v); break;
                  }
                }
              }
              // 3. Try da.noi_stabilized direct column
              if (!noiYear1 || noiYear1 <= 0) {
                const daNoiStab = dealRow.rows[0].noi_stabilized;
                const daNoiStabNum = typeof daNoiStab === 'string' ? parseFloat(daNoiStab)
                  : typeof daNoiStab === 'number' ? daNoiStab : NaN;
                if (!isNaN(daNoiStabNum) && daNoiStabNum > 0) noiYear1 = daNoiStabNum;
              }
              // 4. Misc direct year1 keys
              if (!noiYear1 || noiYear1 <= 0) {
                for (const k of ['broker_stabilized_noi', 'stabilized_noi', 'noi_stabilized']) {
                  const v = yr1[k];
                  if (typeof v === 'number' && v > 0) { noiYear1 = v; break; }
                }
              }
            }

            if (noiYear1 && noiYear1 > 0 && purchasePrice && purchasePrice > 0) {
              const exitCapRate = resolveLv('exit_cap_rate') ?? 0.055;
              const rawHold = resolveLv('hold_years') ?? resolveLv('hold_period') ?? 5;
              const holdYears = Math.max(1, Math.min(ABSOLUTE_MAX_HOLD_YEARS, Math.round(rawHold)));
              const debtRate = resolveLv('debt_rate') ?? resolveLv('interest_rate') ?? 0.065;

              let gprYear1: number | undefined;
              for (const gp of ['revenue.gpr', 'revenue.gross_potential_rent', 'gpr']) {
                const entry = pf?.[gp];
                const raw = entry?.value ?? entry?.resolved;
                if (typeof raw === 'number' && raw > 0) { gprYear1 = raw; break; }
              }

              const { optimizeCapitalStructure } = await import('./tools/optimize_capital_structure');
              const optResult = await optimizeCapitalStructure({
                noi_year1:          noiYear1,
                purchase_price:     purchasePrice,
                hold_years:         holdYears,
                exit_cap_rate:      exitCapRate,
                debt_rate:          debtRate,
                amortization_years: 30,
                io_period_months:   0,
                noi_growth_rate:    0.03,
                deal_strategy:      dealStrategy,
                selling_costs_pct:  0.02,
                ...(gprYear1 !== undefined ? { gpr_year1: gprYear1 } : {}),
              });

              if (!output.proforma || typeof output.proforma !== 'object') {
                output.proforma = {};
              }
              const proformaOut = output.proforma as Record<string, unknown>;
              if (!proformaOut.capital_structure || typeof proformaOut.capital_structure !== 'object') {
                proformaOut.capital_structure = {};
              }
              (proformaOut.capital_structure as Record<string, unknown>).optimization = optResult;

              logger.info('[CashflowPostProcess] CS optimization injected by postprocessor (agent skipped)', {
                dealId:        ctx.dealId,
                runId,
                strategy:      dealStrategy,
                noiYear1,
                purchasePrice,
                optimalLtv:    optResult.optimal_ltv,
                primaryMetric: optResult.primary_metric,
                infeasible:    optResult.infeasible,
              });

              // ── M36 Joint Goal Seek (Pareto Frontier) fallback ────────────────
              // Run run_joint_goal_seek across all 5 debt bundles to populate
              // proforma.capital_structure.optimization.pareto_frontier whenever
              // the agent skipped it (F-jgs-1). Reuses the same resolved inputs.
              // Non-fatal: wrapped in its own try/catch so JGS failures never
              // degrade the CS optimization result already written above.
              try {
                const csOpt = proformaOut.capital_structure as Record<string, unknown>;
                const optBlock = csOpt.optimization as Record<string, unknown> | undefined;
                const hasParetoFrontier = optBlock?.pareto_frontier != null;

                if (!hasParetoFrontier) {
                  const { runJointGoalSeek } = await import('./tools/run_joint_goal_seek');
                  const jgsResult = await runJointGoalSeek({
                    noi_year1:         noiYear1,
                    purchase_price:    purchasePrice,
                    hold_years:        holdYears,
                    exit_cap_rate:     exitCapRate,
                    noi_growth_rate:   0.03,
                    deal_strategy:     dealStrategy,
                    selling_costs_pct: 0.02,
                    ...(gprYear1 !== undefined ? { gpr_year1: gprYear1 } : {}),
                  });

                  csOpt.optimization = {
                    ...(optBlock ?? {}),
                    pareto_frontier:          jgsResult.pareto_frontier,
                    pareto_role:              jgsResult.role,
                    pareto_sort_key:          jgsResult.sort_key,
                    pareto_bundles_evaluated: jgsResult.bundles_evaluated,
                    pareto_feasible_count:    jgsResult.feasible_count,
                  };

                  logger.info('[CashflowPostProcess] JGS Pareto frontier injected by postprocessor (agent skipped)', {
                    dealId:           ctx.dealId,
                    runId,
                    strategy:         dealStrategy,
                    feasibleCount:    jgsResult.feasible_count,
                    bundlesEvaluated: jgsResult.bundles_evaluated,
                  });
                }
              } catch (jgsErr) {
                logger.warn('[CashflowPostProcess] JGS Pareto frontier postprocessor failed (non-fatal)', {
                  dealId: ctx.dealId,
                  runId,
                  err: jgsErr instanceof Error ? jgsErr.message : String(jgsErr),
                });
              }
            } else {
              logger.warn('[CashflowPostProcess] CS optimization postprocessor skipped — insufficient inputs', {
                dealId: ctx.dealId,
                runId,
                noiYear1,
                purchasePrice,
              });
            }
          }
        }
      } catch (csErr) {
        logger.warn('[CashflowPostProcess] CS optimization postprocessor failed (non-fatal)', {
          dealId: ctx.dealId,
          runId,
          err: csErr instanceof Error ? csErr.message : String(csErr),
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

  // ── Deterministic plausibility chip enrichment (Task #879 / M36) ────────
  // Guarantee every required evidence assumption carries plausibility_band,
  // plausibility_score, and plausibility_color regardless of LLM tool-call
  // compliance. Runs on every output; is idempotent; does not overwrite values
  // already set by get_plausibility_score tool calls during the agent run.
  //
  // Single-variable plausibility: d-score = |z| = |value − prior| / std
  // Band thresholds (same as sigma-engine computePlausibility):
  //   d ≤ 1.0 → Realistic / green
  //   d ≤ 1.5 → Stretch   / amber
  //   d ≤ 2.0 → Aggressive / amber
  //   d ≤ 3.0 → Heroic    / red
  //   d  > 3.0 → Unrealistic / red
  try {
    const PLAUSIBILITY_REQUIRED: Record<string, string> = {
      'revenue.rent_growth_y1':           'rentGrowthY1',
      'revenue.rent_growth_stabilized':   'rentGrowthStabilized',
      'revenue.vacancy_rate':             'vacancyAtStabilization',
      'revenue.vacancy':                  'vacancyAtStabilization',
      'revenue.vacancy_loss_pct':         'vacancyAtStabilization',
      'revenue.loss_to_lease_pct':        'lossToLeasePct',
      'revenue.concessions_pct':          'concessionsPct',
      'capital_structure.exit_cap_rate':  'exitCapRate',
      'expenses.expense_growth_rate':     'expenseGrowthRate',
      'expenses.opex_per_unit':           'opexPerUnit',
      'expenses.management_fee_pct':      'managementFeePct',
    };
    const bandFromD = (d: number): string =>
      d <= 1.0 ? 'Realistic'
      : d <= 1.5 ? 'Stretch'
      : d <= 2.0 ? 'Aggressive'
      : d <= 3.0 ? 'Heroic'
      : 'Unrealistic';
    const colorFromBand = (band: string): string =>
      band === 'Realistic' ? 'green'
      : band === 'Stretch' || band === 'Aggressive' ? 'amber'
      : 'red';

    if (output.proforma_fields && typeof output.proforma_fields === 'object') {
      const pf = output.proforma_fields as Record<string, Record<string, unknown>>;
      let enriched = 0;
      for (const [fieldPath, varKey] of Object.entries(PLAUSIBILITY_REQUIRED)) {
        const entry = pf[fieldPath];
        if (!entry || typeof entry !== 'object') continue;
        // Skip if already enriched (LLM called get_plausibility_score)
        if (entry.plausibility_band != null) continue;
        const meta = VARIABLE_META[varKey];
        if (!meta) continue;
        const raw = entry.value;
        const numVal = typeof raw === 'number' ? raw
          : typeof raw === 'string' && raw !== '' && !isNaN(Number(raw)) ? Number(raw)
          : null;
        if (numVal === null) continue;
        const d = Math.abs((numVal - meta.prior) / meta.std);
        const band  = bandFromD(d);
        const color = colorFromBand(band);
        entry.plausibility_score = parseFloat(d.toFixed(3));
        entry.plausibility_band  = band;
        entry.plausibility_color = color;
        enriched++;
      }
      if (enriched > 0) {
        logger.info('[CashflowPostProcess] Plausibility chips back-filled for missing fields', {
          runId, enriched,
        });
      }
    }
  } catch (plauErr) {
    logger.warn('[CashflowPostProcess] Plausibility enrichment failed (non-fatal)', {
      runId,
      err: plauErr instanceof Error ? plauErr.message : String(plauErr),
    });
  }

  // ── Deterministic role-framing selection (Task #878) ─────────────────────
  // The model always generates three role_framing variants (sponsor/lp/lender).
  // Here we deterministically promote the requesting user's variant to
  // `active_role_framing` so downstream consumers (API response, UI, saved run
  // output) always have a single, pre-selected string without needing to know
  // the requesting user's role at read time.
  // Non-fatal: any failure here never blocks output delivery.
  try {
    const effectiveRole = (ctx.platformRole ?? 'sponsor') as 'sponsor' | 'lp' | 'lender';
    const rf = output.role_framing as Record<string, string> | undefined;
    if (rf && typeof rf === 'object') {
      const selected = rf[effectiveRole] ?? rf['sponsor'] ?? '';
      output.active_role_framing = selected;
    }
  } catch (_) { /* non-fatal */ }

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

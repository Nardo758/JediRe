/**
 * D-MOD Assumption Extractors
 *
 * Config-driven layer between ASSUMPTION_MODULE_MAPPINGS and the ProFormaAssumptions
 * envelope.  For each of the 8 mapped assumption fields, this module provides:
 *
 *   extractAuth(assumptions)
 *     → Pull the current authoritative value from the ProFormaAssumptions object.
 *       This is the value set by the LLM-based cashflow agent using the authoritative
 *       module. It becomes the "auth" input to D-MOD-2 conflict resolution.
 *
 *   buildSupportingInputs(sources)
 *     → Derive the supporting ModuleValueInput[] entries from live module data
 *       (getFinancialInputsFromModules + DataFlowRouter).  These become the
 *       "supporting" inputs to D-MOD-2 conflict resolution.
 *
 *   applyResolved(assumptions, resolvedValue)
 *     → Write the D-MOD-2 resolved value back into the ProFormaAssumptions object.
 *       Called AFTER resolveAssumptionBatch() so that Step 2 blends (within-band
 *       adjustments) actually propagate into the model that callLLMForModel() sees.
 *
 * Iterating ASSUMPTION_MODULE_MAPPINGS and calling these extractors is what makes
 * the conflict-resolution pass CONFIG-DRIVEN rather than per-field hardcoded logic.
 */

import type { ProFormaAssumptions } from '../financial-model-engine.service';
import type { AssumptionField } from './assumption-module-mapping.config';
import type { ModuleValueInput } from './conflict-resolution.service';
import type { FinancialModuleInputs } from './data-flow-router';

// ─── Source bundle type ───────────────────────────────────────────────────────

export interface ModuleDataSources {
  market:   FinancialModuleInputs['market'];
  demand:   FinancialModuleInputs['demand'];
  traffic:  FinancialModuleInputs['traffic'];
  strategy: FinancialModuleInputs['strategy'];
  /** Raw DataFlowRouter cache packet for M11 (may be undefined). */
  m11Data:  Record<string, unknown> | undefined;
  /** Raw DataFlowRouter cache packet for M12 (may be undefined). */
  m12Data:  Record<string, unknown> | undefined;
  /** Raw DataFlowRouter cache packet for M14 (may be undefined). */
  m14Data:  Record<string, unknown> | undefined;
}

// ─── Extractor interface ──────────────────────────────────────────────────────

export interface AssumptionExtractor {
  /**
   * Read the authoritative assumption value from the ProFormaAssumptions envelope.
   * Returns null when the field is absent (not yet set by the agent).
   */
  extractAuth(a: ProFormaAssumptions): number | null;

  /**
   * Build the supporting ModuleValueInput[] from live module data sources.
   * Entries with value=null are valid — they tell D-MOD-2 the module has no data.
   * Do NOT set isAuthoritative here; the caller sets it to false for all returned inputs.
   */
  buildSupportingInputs(
    sources: ModuleDataSources,
  ): Array<Omit<ModuleValueInput, 'isAuthoritative'>>;

  /**
   * Apply the D-MOD-2 resolved value back into the ProFormaAssumptions envelope.
   * Only called when resolvedValue is non-null and differs from the original auth value.
   * Implementations must guard against nullish parent fields.
   */
  applyResolved(a: ProFormaAssumptions, resolvedValue: number): void;
}

// ─── Expense map helper ───────────────────────────────────────────────────────

type ExpenseEntry = { amount: number; type: string; growthRate: number };
type ExpenseMap   = Record<string, ExpenseEntry | undefined>;

function expenses(a: ProFormaAssumptions): ExpenseMap {
  return (a.expenses ?? {}) as ExpenseMap;
}

// ─── Extractor table ──────────────────────────────────────────────────────────
//
// Keys MUST match AssumptionField in assumption-module-mapping.config.ts exactly.
// When a new assumption is added to ASSUMPTION_MODULE_MAPPINGS, add a matching
// entry here — the D-MOD pass will include it automatically.

export const ASSUMPTION_EXTRACTORS: Record<AssumptionField, AssumptionExtractor> = {

  // 1. Rent Growth Y1 — authoritative: M05, supporting: M07, M06
  'revenue.rentGrowth.y1': {
    extractAuth(a) {
      return a.revenue?.rentGrowth?.[0] ?? null;
    },
    buildSupportingInputs({ market, demand, traffic }) {
      // M07: market baseline + traffic rent-growth delta
      const m07Value = (market.rentGrowthPct !== null && traffic.rentGrowthAdjustment !== null)
        ? market.rentGrowthPct + traffic.rentGrowthAdjustment
        : traffic.rentGrowthAdjustment ?? null;
      // M06: use market baseline only when demand signal is live
      const m06Value = demand.source === 'live' ? market.rentGrowthPct ?? null : null;
      return [
        { moduleId: 'M07', value: m07Value, confidence: traffic.source === 'live' ? 0.65 : 0.30, sourceLabel: 'M07 Traffic rent-growth delta' },
        { moduleId: 'M06', value: m06Value, confidence: demand.source === 'live' ? 0.55 : 0.25, sourceLabel: 'M06 Demand-weighted market growth' },
      ];
    },
    applyResolved(a, v) {
      if (a.revenue?.rentGrowth) { a.revenue.rentGrowth[0] = v; }
    },
  },

  // 2. Rent Growth Long-Run (Y2+) — authoritative: M05, supporting: M11
  'revenue.rentGrowth.longRun': {
    extractAuth(a) {
      return a.revenue?.rentGrowth?.[1] ?? a.revenue?.rentGrowth?.[0] ?? null;
    },
    buildSupportingInputs({ m11Data }) {
      const val = (m11Data?.rent_growth_forecast ?? m11Data?.rentGrowthForecast ?? null) as number | null;
      return [
        { moduleId: 'M11', value: val, confidence: m11Data ? 0.70 : 0.20, sourceLabel: 'M11 Rate environment rent forecast' },
      ];
    },
    applyResolved(a, v) {
      if (a.revenue?.rentGrowth) {
        if (a.revenue.rentGrowth.length > 1) { a.revenue.rentGrowth[1] = v; }
      }
    },
  },

  // 3. Stabilised Occupancy — authoritative: M05, supporting: M04, M07
  'revenue.stabilizedOccupancy': {
    extractAuth(a) {
      return a.revenue?.stabilizedOccupancy ?? null;
    },
    buildSupportingInputs({ market, traffic }) {
      return [
        {
          moduleId: 'M04',
          value: market.vacancyRate !== null ? 1 - market.vacancyRate : null,
          confidence: market.source === 'live' ? 0.65 : 0.30,
          sourceLabel: 'M04 Supply (1 − vacancyRate)',
        },
        {
          moduleId: 'M07',
          value: traffic.vacancyAssumption !== null ? 1 - traffic.vacancyAssumption : null,
          confidence: traffic.source === 'live' ? 0.60 : 0.25,
          sourceLabel: 'M07 Traffic vacancy assumption',
        },
      ];
    },
    applyResolved(a, v) {
      if (a.revenue) { a.revenue.stabilizedOccupancy = v; }
    },
  },

  // 4. Real Estate Tax — authoritative: M26 (applied via enhancer), supporting: M14
  'expenses.real_estate_tax': {
    extractAuth(a) {
      const exp = expenses(a);
      return exp['real_estate_tax']?.amount ?? exp['tax']?.amount ?? null;
    },
    buildSupportingInputs({ m14Data }) {
      const val = (m14Data?.tax_risk_adjustment ?? null) as number | null;
      return [
        { moduleId: 'M14', value: val, confidence: m14Data ? 0.55 : 0.20, sourceLabel: 'M14 Risk tax adjustment' },
      ];
    },
    applyResolved(a, v) {
      const exp = expenses(a);
      if (exp['real_estate_tax']) { exp['real_estate_tax']!.amount = v; }
      else if (exp['tax']) { exp['tax']!.amount = v; }
    },
  },

  // 5. Insurance — authoritative: M26, supporting: M14
  'expenses.insurance': {
    extractAuth(a) {
      return expenses(a)['insurance']?.amount ?? null;
    },
    buildSupportingInputs({ m14Data }) {
      const val = (m14Data?.insurance_risk_adjustment ?? null) as number | null;
      return [
        { moduleId: 'M14', value: val, confidence: m14Data ? 0.50 : 0.20, sourceLabel: 'M14 Risk insurance adjustment' },
      ];
    },
    applyResolved(a, v) {
      const exp = expenses(a);
      if (exp['insurance']) { exp['insurance']!.amount = v; }
    },
  },

  // 6. Exit Cap Rate — authoritative: M12, supporting: M05/M08, M11
  'disposition.exitCapRate': {
    extractAuth(a) {
      return a.disposition?.exitCapRate ?? null;
    },
    buildSupportingInputs({ strategy, m11Data }) {
      const m11Val = (m11Data?.exit_cap_estimate ?? m11Data?.exitCapEstimate ?? null) as number | null;
      return [
        { moduleId: 'M05', value: strategy.exitCap ?? null, confidence: strategy.source === 'live' ? 0.65 : 0.30, sourceLabel: 'M05/M08 Strategy exit cap' },
        { moduleId: 'M11', value: m11Val, confidence: m11Data ? 0.60 : 0.20, sourceLabel: 'M11 Rate-adjusted exit cap' },
      ];
    },
    applyResolved(a, v) {
      if (a.disposition) { a.disposition.exitCapRate = v; }
    },
  },

  // 7. Hold Period — authoritative: M08, supporting: M12
  'holdPeriod': {
    extractAuth(a) {
      return (a.holdPeriod ?? null) as number | null;
    },
    buildSupportingInputs({ strategy, m12Data }) {
      const m12Val = (strategy.holdPeriod ?? m12Data?.optimal_hold_years ?? m12Data?.optimalHoldYears ?? null) as number | null;
      return [
        { moduleId: 'M12', value: m12Val, confidence: strategy.source === 'live' ? 0.65 : 0.30, sourceLabel: 'M12 Optimal hold year' },
      ];
    },
    applyResolved(a, v) {
      a.holdPeriod = v;
    },
  },

  // 8. Absorption Rate — authoritative: M07, supporting: M06
  'revenue.absorptionRate': {
    extractAuth(a) {
      // Development deals: leaseUpVelocity; stabilised: absorptionRate not typically set
      return (a as unknown as { revenue?: { absorptionRate?: number } }).revenue?.absorptionRate
        ?? a.development?.leaseUpVelocity
        ?? null;
    },
    buildSupportingInputs({ demand, traffic }) {
      // M06: monthly demand units normalised to a fraction of total inventory
      // We don't know totalUnits here, so use raw demand units as a proxy
      const m06Val = demand.demandUnitsTotal !== null && demand.demandUnitsTotal > 0
        ? demand.demandUnitsTotal / 12 / 100  // crude fraction; used only for cross-check
        : null;
      return [
        { moduleId: 'M07', value: traffic.absorptionRate, confidence: traffic.source === 'live' ? 0.70 : 0.35, sourceLabel: 'M07 Traffic absorption rate' },
        { moduleId: 'M06', value: m06Val, confidence: demand.source === 'live' ? 0.55 : 0.25, sourceLabel: 'M06 Demand-implied absorption (normalised)' },
      ];
    },
    applyResolved(a, v) {
      if (a.development) { a.development.leaseUpVelocity = v; }
    },
  },

};

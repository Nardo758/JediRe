import { createHash } from 'crypto';
import { getPool } from '../database/connection';
import { getFinancialInputsFromModules, FinancialModuleInputs } from './module-wiring/data-flow-router';
import { dataFlowRouter } from './module-wiring/data-flow-router';
import { logger } from '../utils/logger';
import { applyFullAnchorInterceptor, normalizeExpensesForInterceptor, rekeyExpensesFromInterceptor } from './sigma/anchor-interceptor.service';
import { mapProFormaAssumptionsToModelAssumptions, buildEvidenceHintsFromSeed, modelResultsToFinancialModelResult } from './deterministic/proforma-assumptions-bridge';
import { runModel, runIntegrityChecks } from './deterministic/deterministic-model-runner';
import { runFullModel, type M14DataInput } from './deterministic/run-full-model';
import { writeM11ToFinancing, type M11CapitalStructureSummary } from './module-wiring/capital-structure-adapter';
import { evaluatePipeline, enforceStageGates } from './module-wiring/reasoning-pipeline';
import { resolveAssumptionBatch, type ModuleValueInput } from './module-wiring/conflict-resolution.service';
import { ASSUMPTION_MODULE_MAPPINGS, type AssumptionField } from './module-wiring/assumption-module-mapping.config';
import { ASSUMPTION_EXTRACTORS, type ModuleDataSources } from './module-wiring/d-mod-extractors';
import type { ProFormaYear1Seed } from './document-extraction/types';
import type { ProvenancedValue } from '../types/provenanced-value';


/**
 * Authoritative list of OPEX line-item keys the financial-model engine and
 * the proforma-seeder service emit on the `expenses` / `operatingExpenses`
 * records. The Tier-0 blueprint (`backend/src/services/proforma/blueprint/`)
 * declares its own 9-line OPEX stack and a mapping from each blueprint line
 * to one or more of these engine keys; the drift test asserts the two stay
 * in sync so a renamed engine key cannot silently bypass the blueprint.
 */
export const FINANCIAL_ENGINE_OPEX_KEYS = [
  'real_estate_tax',
  'personal_property_tax',
  'insurance',
  'utilities',
  'repairs_maintenance',
  'turnover',
  'contract_services',
  'payroll',
  'marketing',
  'g_and_a',
  'hoa_dues',
  'management_fee',
  'replacement_reserves',
] as const;
export type FinancialEngineOpexKey = (typeof FINANCIAL_ENGINE_OPEX_KEYS)[number];

export interface ProFormaAssumptions {
  dealInfo: {
    dealName: string;
    totalUnits: number;
    netRentableSF: number;
    vintage: number;
    address: string;
    city: string;
    state: string;
  };
  modelType: 'development' | 'existing';
  // Optional: granular deal mode forwarded from the frontend deal context.
  // Extends modelType with: 'redevelopment' | 'lease_up' | 'ground_up' | 'value_add'.
  dealMode?: string;
  holdPeriod: number;
  unitMix: Array<{
    floorPlan: string;
    unitSize: number;
    beds: number;
    units: number;
    occupied: number;
    vacant: number;
    marketRent: number;
    inPlaceRent: number;
  }>;
  acquisition: {
    purchasePrice: number;
    capRate: number;
    closingCosts: Record<string, number>;
  };
  disposition: {
    exitCapRate: number;
    sellingCosts: number;
    saleNOIMethod: string;
  };
  revenue: {
    rentGrowth: number[];
    lossToLease: number;
    stabilizedOccupancy: number;
    collectionLoss: number;
    otherIncome: Record<string, { perUnitMonth: number; penetration: number }>;
  };
  expenses: Record<string, { amount: number; type: string; growthRate: number }>;
  financing: {
    loanAmount: number;
    loanType: string;
    interestRate: number;
    spread: number;
    term: number;
    amortization: number;
    ioPeriod: number;
    originationFee: number;
    rateCapCost: number;
    prepayPenalty: number;
  };
  capex: {
    lineItems: Array<{ description: string; amount: number }>;
    contingencyPct: number;
    reservesPerUnit: number;
  };
  waterfall: {
    lpShare: number;
    gpShare: number;
    hurdles: Array<{
      hurdleRate: number;
      promoteToGP: number;
      lpSplit: number;
    }>;
    equityContribution: number;
  };
  development?: {
    landCost: number;
    hardCostPerSF: number;
    hardCostContingency: number;
    softCostPct: number;
    developerFee: number;
    constructionPeriod: number;
    leaseUpVelocity: number;
    constructionLoanLTC: number;
    constructionLoanRate: number;
  };
}

export interface FinancialModelResult {
  /** Deterministic evidence payload injected by buildModel() after verification. */
  evidence?: {
    confidence_distribution: { high: number; medium: number; low: number };
    fields: Array<{
      field: string;
      value: number | null;
      source: string;
      confidence: 'HIGH' | 'MEDIUM' | 'LOW';
      reasoning: string;
    }>;
  };
  /** Reasoning payload injected by buildModel() after verification. */
  reasoning?: {
    walkthrough: string;
    collisionReport: Array<{
      field: string;
      magnitude: 'material' | 'critical';
      sourceA_value: number;
      sourceB_value: number;
      delta: number;
      selectedSource: string;
      reason: string;
      narrative: string;
    }>;
  };
  /** Integrity checks merged from deterministic runner after verification. */
  integrityChecks?: Array<{
    id: string;
    status: 'pass' | 'warn' | 'error';
    message: string;
  }>;
  /** M11/M14 feedback-cycle metadata injected by buildModel(). */
  meta?: {
    m11Converged: boolean;
    m11Iterations: number;
    m14Applied: boolean;
    m14CapRateAdjBps: number;
    /**
     * All 7 capital structure assumptions as derived by M11 (Task #1412).
     * Present whenever the M11 cycle completed without error.
     * Absent when the cycle was skipped (e.g. purchasePrice = 0).
     */
    m11CapitalStructure?: M11CapitalStructureSummary;
    /**
     * True when the M14 DSCR floor (default 1.25) constrained the M11 loan
     * amount below the raw LTV cap — i.e. the deal is tight on debt service.
     * When true, an integrity-check warning with id='dscr_floor_binds' is
     * also present in result.integrityChecks.
     */
    m14DscrConstraintBinds: boolean;
  };
  summary: {
    irr: number;
    equityMultiple: number;
    cashOnCash: number[];
    noiYear1: number;
    noiStabilized: number;
    purchaseCapRate: number;
    yieldOnCost: number;
    exitValue: number;
    netProceeds: number;
    totalEquity: number;
    totalDebt: number;
    dscr: number[];
    debtYield: number[];
    // Partition + scalar fields populated from the deterministic runner after
    // verification. The LLM schema does not emit these, but the F9 Overview tab
    // (Returns Breakdown, Year table) reads them directly. Optional because
    // they're injected post-LLM-call.
    avgCoC?: number | null;
    lpIrr?: number | null;
    gpIrr?: number | null;
    lpEquityMultiple?: number | null;
    gpEquityMultiple?: number | null;
    lpCoC?: number | null;
    gpCoC?: number | null;
    lpTotalDistributions?: number;
    lpProfit?: number;
    gpTotalDistributions?: number;
    gpPromoteEarned?: number;
    totalProfit?: number;
  };
  annualCashFlow: Array<{
    year: number;
    potentialRent: number;
    lossToLease: number;
    vacancy: number;
    collectionLoss: number;
    netRentalIncome: number;
    otherIncome: number;
    effectiveGrossRevenue: number;
    operatingExpenses: Record<string, number>;
    totalExpenses: number;
    noi: number;
    replacementReserves: number;
    noiAfterReserves: number;
    debtService: number;
    capitalExpenditures: number;
    beforeTaxCashFlow: number;
    leveredCashFlow: number;
  }>;
  sourcesAndUses: {
    sources: Record<string, number>;
    uses: Record<string, number>;
  };
  debtMetrics: {
    loanAmount: number;
    annualDebtService: number;
    dscr: number;
    ltv: number;
    ltc: number;
    debtYield: number;
  };
  sensitivityAnalysis: {
    exitCapVsHoldPeriod: Array<{
      holdPeriod: number;
      capRate: number;
      irr: number;
      equityMultiple: number;
    }>;
    rentGrowthVsHoldPeriod: Array<{
      holdPeriod: number;
      rentGrowth: number;
      irr: number;
      equityMultiple: number;
    }>;
  };
  waterfallDistributions: Array<{
    year: number;
    lpDistribution: number;
    gpDistribution: number;
    gpPromote: number;
    totalDistribution: number;
  }>;
  developmentSchedule?: Array<{
    month: number;
    hardCostDraw: number;
    softCostDraw: number;
    interestDraw: number;
    loanBalance: number;
    equityDraw: number;
    occupiedUnits: number;
    revenue: number;
  }>;
  /**
   * M-L serialization (R5 7-field slice): one entry per operating month.
   * Fields: month (1-based absolute), year (operating year 1..holdYears),
   * occupancy, effectiveVacancy (post-floor), floorBinding, vacancyLoss ($), noi ($).
   * Absent on models built before F-P1 Phase 2.
   */
  monthlyProjection?: Array<{
    month: number;
    year: number;
    occupancy: number;
    effectiveVacancy: number;
    floorBinding: boolean;
    vacancyLoss: number;
    noi: number;
  }>;
}

// ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ Tier-2 ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§12 wiring: Agent fill-in registry + assumption helpers ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬
// The registry pattern keeps a hard build-time dependency out of the engine
// while still giving production code a single line to wire a real resolver:
//   import { financialModelEngineFillInRegistry } from '...';
//   financialModelEngineFillInRegistry.setResolver(realResolver);
// When no resolver is registered, the fill-in pass in buildModel() is a no-op.

import type { LibraryResolver, TemplateForFill } from './proforma/agent-fill-in';

/**
 * Tier-2 fill-in candidates keyed by the REAL nested ProFormaAssumptions
 * paths the engine consumes. Using dotted paths (not synthetic top-level
 * aliases) is required for the fill-in to materially influence model output.
 * Code-review #449 round 7 explicitly flagged the prior synthetic-key list as
 * schema-misaligned ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â this is the alignment fix.
 */
const REQUIRED_FIELDS_BY_MODEL_TYPE: Record<string, string[]> = {
  existing: [
    'revenue.rentGrowth.0',
    'revenue.stabilizedOccupancy',
    'revenue.lossToLease',
    'revenue.collectionLoss',
    'disposition.exitCapRate',
    'capex.reservesPerUnit',
    'capex.contingencyPct',
  ],
  development: [
    'revenue.rentGrowth.0',
    'revenue.stabilizedOccupancy',
    'disposition.exitCapRate',
    'development.hardCostPerSF',
    'development.softCostPct',
    'development.developerFee',
    'development.leaseUpVelocity',
  ],
};

/** Walk a dotted path (`a.b.0.c`) and return the value or `undefined`. */
export function getByPath(obj: any, path: string): any {
  const parts = path.split('.');
  let cur: any = obj;
  for (const p of parts) {
    if (cur === null || cur === undefined) return undefined;
    cur = cur[p];
  }
  return cur;
}

/** Set a dotted path, creating intermediate objects/arrays as needed. */
export function setByPath(obj: any, path: string, value: any): void {
  const parts = path.split('.');
  let cur: any = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    const nextIsIndex = /^\d+$/.test(parts[i + 1]);
    if (cur[k] === null || cur[k] === undefined) {
      cur[k] = nextIsIndex ? [] : {};
    }
    cur = cur[k];
  }
  cur[parts[parts.length - 1]] = value;
}

class FinancialModelEngineFillInRegistry {
  private resolver: LibraryResolver | null = null;

  setResolver(resolver: LibraryResolver | null): void {
    this.resolver = resolver;
  }

  getResolver(): LibraryResolver | null {
    return this.resolver;
  }

  getTemplate(modelType: string): TemplateForFill {
    const fields = REQUIRED_FIELDS_BY_MODEL_TYPE[modelType] ?? REQUIRED_FIELDS_BY_MODEL_TYPE.existing;
    return { sections: [{ id: 'tier2_required', fields, required: true }] };
  }
}

export const financialModelEngineFillInRegistry = new FinancialModelEngineFillInRegistry();

/**
 * Extract a flat map of {nested.path -> ProvenancedValue|null} from the
 * assumption envelope so the agent fill-in walker can detect which required
 * fields are already populated. Walks the union of all model-type paths to
 * stay schema-aligned with REQUIRED_FIELDS_BY_MODEL_TYPE.
 *
 * Treats `0` and falsy strings as PRESENT (not missing); only null/undefined
 * count as missing slots eligible for fill-in.
 */
function extractExistingForFillIn(
  assumptions: ProFormaAssumptions
): Record<string, any> {
  const flat: Record<string, any> = {};
  const allCandidates = new Set<string>([
    ...REQUIRED_FIELDS_BY_MODEL_TYPE.existing,
    ...REQUIRED_FIELDS_BY_MODEL_TYPE.development,
  ]);
  for (const path of allCandidates) {
    const v = getByPath(assumptions, path);
    if (v === null || v === undefined) {
      flat[path] = null;
    } else if (typeof v === 'object' && 'value' in v) {
      flat[path] = v; // Already a ProvenancedValue
    } else {
      flat[path] = {
        value: v,
        source: 'platform',
        confidence: 0.9,
        qualityFlag: 'green',
        asOf: new Date().toISOString(),
      };
    }
  }
  return flat;
}

/**
 * Merge filled ProvenancedValues back onto the assumption envelope using the
 * dotted paths. Only fills slots that were actually empty ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â never overwrites
 * a value the caller (or a higher-priority source) already provided.
 */
function applyFillInToAssumptions(
  assumptions: ProFormaAssumptions,
  fields: Record<string, any>
): void {
  for (const [path, pv] of Object.entries(fields)) {
    if (!pv || pv.value === null || pv.value === undefined) continue;
    const existing = getByPath(assumptions, path);
    if (existing === null || existing === undefined) {
      setByPath(assumptions, path, pv.value);
    }
  }
}

/**
 * Stable sha-256 of an assumptions envelope — sorts top-level keys so that
 * two objects with identical values but different insertion orders produce the
 * same hash. Exported so the routes layer can compute the same hash for the
 * pre-enhancement assumptions and include it in the build response envelope.
 */
export function hashAssumptions(obj: object): string {
  const deepSort = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(deepSort);
    if (value !== null && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => [k, deepSort(v)])
      );
    }
    return value;
  };
  return createHash('sha256').update(JSON.stringify(deepSort(obj))).digest('hex');
}

export class FinancialModelEngineService {
  async buildModel(dealId: string, assumptions: ProFormaAssumptions, userId?: string | null): Promise<{ result: FinancialModelResult; assumptionsHash: string }> {
    const pool = getPool();

    // Snapshot the hash BEFORE any mutation (fill-in pass, M26/M27 enhancement).
    // This is the canonical value stored in `assumptions_hash` and echoed in the
    // build response so the routes layer never needs to recompute independently.
    const assumptionsHash = hashAssumptions((assumptions ?? {}) as object);

    // ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ Tier-2 ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§12: Agent fill-in pass ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬
    // Walk a small required-fields template; for any field that's still
    // missing from the input assumptions, fill from the data library with
    // INFERRED quality (or DEFAULT placeholder if the library has no comp).
    // Production resolver is supplied via setAgentFillInResolver(); when no
    // resolver is registered, this pass is a no-op (no behavior change).
    try {
      const resolver = financialModelEngineFillInRegistry.getResolver();
      if (resolver) {
        const { agentFillIn } = await import('./proforma/agent-fill-in');
        const ctx = {
          dealId,
          state: assumptions.dealInfo?.state ?? null,
          msa: assumptions.dealInfo?.city ?? null,
          assetClass: assumptions.modelType,
          unitCount: assumptions.dealInfo?.totalUnits ?? null,
        };
        const fill = await agentFillIn({
          context: ctx,
          template: financialModelEngineFillInRegistry.getTemplate(assumptions.modelType),
          existing: extractExistingForFillIn(assumptions),
          resolver,
        });
        logger.info(
          `[Tier-2] Agent fill-in for ${dealId}: ` +
          `filled=${fill.filledCount} skipped=${fill.skippedCount} defaulted=${fill.defaultedCount}`
        );
        // Merge filled values back onto the assumptions envelope so the
        // downstream M26/M27 enhancer sees a complete-ish input.
        applyFillInToAssumptions(assumptions, fill.fields);
      }
    } catch (err: any) {
      logger.warn(`[Tier-2] Agent fill-in skipped for ${dealId}: ${err?.message}`);
    }

    // PHASE 2: Enhance assumptions with M26 tax and M27 comp data
    const { m26m27ProFormaEnhancer } = await import('./financial-model-engine.m26-m27-enhancer');
    const enhancedAssumptions = await m26m27ProFormaEnhancer.enhanceAssumptions(dealId, assumptions) as ProFormaAssumptions;
    
    // Phase B2: Apply anchor interceptor to replace flat growth rates with macro-anchored rates
    try {
      const stateCode = enhancedAssumptions.dealInfo?.state ?? null;
      if (stateCode) {
        const normalized = normalizeExpensesForInterceptor(enhancedAssumptions.expenses || {});
        const intercepted = applyFullAnchorInterceptor(
          {},
          normalized,
          stateCode,
        );
        enhancedAssumptions.expenses = rekeyExpensesFromInterceptor(intercepted.expenses);
        logger.info(`[Anchor-Interceptor] Applied anchor growth rates for ${dealId} in ${stateCode} (${Object.keys(normalized).length} source lines → ${Object.keys(intercepted.expenses).length} anchors mapped)`);
      }
    } catch (err: any) {
      logger.warn(`[Anchor-Interceptor] Skipped for ${dealId}: ${err?.message}`);
    }

    // Phase B2b: Override OPEX line growth rates with live CPI anchors from computeOpexAnchors.
    // This replaces the hardcoded macro-anchored rates from applyFullAnchorInterceptor with
    // dynamic CPI + state-specific spreads, ensuring the financial model engine path uses
    // the same live anchors as the getDealFinancials / projectProformaForDeal path.
    try {
      const stateCode = enhancedAssumptions.dealInfo?.state ?? null;
      if (stateCode) {
        const { computeOpexAnchors } = await import('./proforma/opex-anchors.service');
        const liveAnchors = await computeOpexAnchors(pool, stateCode);

        // Mapping from OpexLineKey (camelCase) → snake_case keys used in enhancedAssumptions.expenses
        const keyMap: Record<string, string[]> = {
          insurance: ['insurance'],
          utilities: ['utilities'],
          repairsMaintenance: ['repairs_maintenance'],
          payroll: ['payroll'],
          marketingAdmin: ['marketing', 'g_and_a'],
          replacementReserves: ['replacement_reserves'],
          other: ['other'],
        };

        let overriddenCount = 0;
        for (const [camelKey, anchorPV] of Object.entries(liveAnchors)) {
          const snakeKeys = keyMap[camelKey];
          if (!snakeKeys) continue;
          for (const sk of snakeKeys) {
            const expenseLine = (enhancedAssumptions.expenses as Record<string, { growthRate?: number }>)[sk];
            if (expenseLine && typeof expenseLine.growthRate === 'number') {
              expenseLine.growthRate = anchorPV.value;
              overriddenCount++;
            }
          }
        }

        // Also override property tax with state-specific anchor from computePropertyTaxAnchor.
        // This replaces the interceptor's ~4.5% flat (DEFAULT_COUNTY_GROWTH_RATE + premium)
        // with state-specific trends (e.g., CA 2%, TX 3%, GA 4%, FL 10%).
        try {
          const { computePropertyTaxAnchor } = await import('./proforma/property-tax-anchor.service');
          const ptAnchor = computePropertyTaxAnchor(stateCode, null);
          for (const ptKey of ['real_estate_tax', 'personal_property_tax']) {
            const expenseLine = (enhancedAssumptions.expenses as Record<string, { growthRate?: number }>)[ptKey];
            if (expenseLine && typeof expenseLine.growthRate === 'number') {
              expenseLine.growthRate = ptAnchor.value;
              overriddenCount++;
            }
          }
          logger.info(`[LiveCPI-Anchors] Property tax override for ${dealId} in ${stateCode}: ${(ptAnchor.value * 100).toFixed(2)}% (${ptAnchor.rationale})`);
        } catch (_ptErr) { /* non-fatal: keep interceptor default */ }
      }
    } catch (err: any) {
      logger.warn(`[LiveCPI-Anchors] Skipped for ${dealId}: ${err?.message}`);
    }

    // Phase Batch-4: Layered rent growth from CPI macro anchor + submarket momentum
    try {
      const { projectRentGrowthSeries } = await import('./proforma/layered-growth/rent-growth');
      const { MacroIndicatorsService } = await import('./macro-indicators.service');
      const { provenanced } = await import('../types/provenanced-value');
      const macroSvc = new MacroIndicatorsService(pool);
      const cpiResult = await macroSvc.getLatestCpi('national');
      const cpiShelterYoY = cpiResult ? cpiResult.value / 100 : null;

      const holdYears = enhancedAssumptions.holdPeriod || 5;
      const state = enhancedAssumptions.dealInfo?.state ?? null;
      const city  = enhancedAssumptions.dealInfo?.city  ?? null;

      let momentumVal: number | null = null;
      if (city && state) {
        try {
          const snapRows = await pool.query<{ avg_rent: string; snapshot_date: string }>(
            `SELECT avg_rent, snapshot_date
               FROM apartment_market_snapshots
              WHERE LOWER(city) = LOWER($1) AND LOWER(state) = LOWER($2)
                AND avg_rent IS NOT NULL
              ORDER BY snapshot_date DESC
              LIMIT 2`,
            [city, state]
          );
          if (snapRows.rows.length === 2) {
            const recent   = parseFloat(snapRows.rows[0].avg_rent);
            const older    = parseFloat(snapRows.rows[1].avg_rent);
            const daysDiff = Math.abs(
              new Date(snapRows.rows[0].snapshot_date).getTime() -
              new Date(snapRows.rows[1].snapshot_date).getTime()
            ) / (1000 * 60 * 60 * 24);
            if (older > 0 && daysDiff >= 60) {
              const rawYoY    = (recent - older) / older;
              const annualized = daysDiff < 330 ? rawYoY * (365 / daysDiff) : rawYoY;
              momentumVal     = Math.max(-0.15, Math.min(0.20, annualized));
            }
          }
        } catch (_snapErr) { /* non-fatal */ }
      }

      // ── Batch-4: M04/M05/M06 cycle pressure index ────────────────────────────
      let cyclePressureIndex: ProvenancedValue<number> | null = null;
      try {
        const { computeCyclePressureIndex } = await import('./proforma/cycle-pressure-index.service');
        cyclePressureIndex = await computeCyclePressureIndex(pool, city, state, enhancedAssumptions.dealInfo?.totalUnits ?? null);
        if (cyclePressureIndex) {
          logger.info(
            `[Batch4-Cycle] cyclePressureIndex for ${dealId}: ${cyclePressureIndex.value.toFixed(2)} ` +
            `(${cyclePressureIndex.rationale})`
          );
        }
      } catch (_cycleErr) { /* non-fatal */ }

      // ── Batch-4b: event deltas from M35 playbooks ─────────────────────────────
      let eventDeltas: ProvenancedValue<number>[] = [];
      try {
        const { computeEventDeltas } = await import('./proforma/event-deltas.service');
        eventDeltas = await computeEventDeltas(pool, dealId);
        if (eventDeltas.length > 0) {
          logger.info(
            `[Batch4-Events] ${eventDeltas.length} M35 playbook deltas for ${dealId}: ` +
            eventDeltas.map(d => `${(d.value * 10000).toFixed(0)}bps`).join(', ')
          );
        }
      } catch (_eventErr) { /* non-fatal */ }

      // ── Batch-4c: M15 position adjustment from comp set rank ────────────────────
      let position: ProvenancedValue<number> | null = null;
      try {
        const { computePositionAdjustment } = await import('./proforma/position-adjustment.service');
        position = await computePositionAdjustment(pool, dealId, city, state);
        if (position) {
          logger.info(
            `[Batch4-Position] position adjustment for ${dealId}: ${(position.value * 10000).toFixed(0)}bps ` +
            `(${position.rationale})`
          );
        }
      } catch (_posErr) { /* non-fatal */ }

      const growthSeries = projectRentGrowthSeries(
        {
          horizonYears: holdYears,
          assetClass: 'multifamily',
          momentum: momentumVal != null
            ? provenanced(momentumVal, 'platform', 0.75, 'derived',
                `submarket 12-mo rent trend ${city} ${state}`)
            : null,
          cyclePressureIndex,
          cpiShelterYoY: cpiShelterYoY != null
            ? provenanced(cpiShelterYoY, 'platform', 0.90, 'derived',
                `CPI proxy for shelter sub-index (${cpiResult!.periodDate})`)
            : null,
          eventDeltas,
          position,
        },
        holdYears,
      );

      const computedGrowthArray = growthSeries.map(r => r.growth.value ?? 0.03);

      const existing = enhancedAssumptions.revenue?.rentGrowth;
      const isFlat   =
        !Array.isArray(existing) || existing.length === 0 ||
        (existing as number[]).every((v: number) => Math.abs(v - ((existing as number[])[0] ?? 0)) < 0.0005);

      if (isFlat && enhancedAssumptions.revenue) {
        enhancedAssumptions.revenue.rentGrowth = computedGrowthArray;
        logger.info(
          `[Batch4-RentGrowth] Applied layered rent growth for ${dealId}: ` +
          `Y1=${(computedGrowthArray[0] * 100).toFixed(2)}% ` +
          `Y${holdYears}=${(computedGrowthArray[holdYears - 1] * 100).toFixed(2)}% ` +
          `(cpi=${cpiShelterYoY?.toFixed(3) ?? 'n/a'} momentum=${momentumVal?.toFixed(3) ?? 'none'})`
        );
      }

      // ── Batch-4b: Expense growth from M05 macro + OperatorStance posture ──────
      // After the anchor interceptor has already set per-line expense growth rates,
      // apply a posture multiplier from OperatorStance.expenseGrowthPosture and a
      // CPI macro modifier. This is the M05 contribution to expense growth layering.
      //   CONTAINED: ×0.85 (operator believes cost control will outpace inflation)
      //   INFLATION:  ×1.00 (default — no adjustment)
      //   STRESSED:   ×1.15 (operator expects opex to accelerate above CPI)
      // Additionally: when CPI > 4.5% (hot regime), apply a +5% uplift regardless
      // of posture so that expense growth tracks the inflationary environment.
      try {
        const stanceRow = await pool.query<{ operator_stance: Record<string, unknown> | null }>(
          `SELECT operator_stance FROM deals WHERE id = $1 LIMIT 1`,
          [dealId]
        );
        const rawStance = stanceRow.rows[0]?.operator_stance;
        const expensePosture: string =
          (rawStance?.expenseGrowthPosture as string | undefined) ?? 'INFLATION';

        const postureMultiplier =
          expensePosture === 'CONTAINED' ? 0.85 :
          expensePosture === 'STRESSED'  ? 1.15 : 1.0;

        const cpiHotUplift = cpiShelterYoY != null && cpiShelterYoY > 0.045 ? 1.05 : 1.0;
        const finalMultiplier = postureMultiplier * cpiHotUplift;

        if (finalMultiplier !== 1.0 && enhancedAssumptions.expenses) {
          let linesAdjusted = 0;
          for (const key of Object.keys(enhancedAssumptions.expenses)) {
            const line = (enhancedAssumptions.expenses as Record<string, { growthRate?: number }>)[key];
            if (line && typeof line.growthRate === 'number' && line.growthRate > 0) {
              line.growthRate = Math.max(0.0, Math.min(0.15, line.growthRate * finalMultiplier));
              linesAdjusted++;
            }
          }
          logger.info(
            `[Batch4b-ExpenseGrowth] Applied posture=${expensePosture} ` +
            `multiplier=${finalMultiplier.toFixed(3)} ` +
            `(postureX=${postureMultiplier} cpiHotX=${cpiHotUplift}) ` +
            `to ${linesAdjusted} expense lines for ${dealId}`
          );
        }
      } catch (_expErr: any) {
        logger.debug(`[Batch4b-ExpenseGrowth] Skipped for ${dealId}: ${_expErr?.message}`);
      }
    } catch (err: any) {
      logger.warn(`[Batch4-RentGrowth] Skipped for ${dealId}: ${err?.message}`);
    }

    // Phase Batch-5: M20 Exit Strategy — exit cap rate, selling costs, hold period
    try {
      const { getExitStrategyService } = await import('./exit-strategy.service');
      const exitSvc = getExitStrategyService(pool);

      const goingInCap = enhancedAssumptions.acquisition?.capRate ?? 0;
      const holdPeriod = enhancedAssumptions.holdPeriod || 5;
      const state      = enhancedAssumptions.dealInfo?.state ?? null;
      const dealMode   = enhancedAssumptions.dealMode ?? enhancedAssumptions.modelType ?? 'existing';
      const assetClass = (enhancedAssumptions as unknown as Record<string, unknown>).assetClass as string | null | undefined ?? null;
      const submarket  = (enhancedAssumptions as unknown as Record<string, unknown>).submarket  as string | null | undefined ?? null;

      const existingExitCap = enhancedAssumptions.disposition?.exitCapRate ?? 0;
      const isDefaultExitCap =
        !existingExitCap || existingExitCap <= 0 ||
        Math.abs(existingExitCap - 0.065) < 0.0001;

      if (isDefaultExitCap) {
        // Fetch year1NOI from deal_data for terminal value computation.
        // Non-fatal — terminalValue will be null if unavailable.
        let year1NOI: number | null = null;
        try {
          const noiRow = await pool.query<{ noi: string | null }>(
            `SELECT COALESCE(
               (deal_data->'extraction_t12'->>'noi_year1')::float,
               (deal_data->>'noi_year1')::float,
               (deal_data->>'noi')::float
             ) AS noi FROM deals WHERE id = $1`,
            [dealId]
          );
          const raw = noiRow.rows[0]?.noi;
          if (raw != null) year1NOI = parseFloat(String(raw));
          if (year1NOI != null && isNaN(year1NOI)) year1NOI = null;
        } catch (_noiErr) { /* non-fatal */ }

        const exitResult = await exitSvc.derive(
          { goingInCapRate: goingInCap, holdPeriod, state, dealMode, assetClass, submarket },
          year1NOI,
        );

        if (enhancedAssumptions.disposition) {
          enhancedAssumptions.disposition.exitCapRate  = exitResult.exitCapRate;
          enhancedAssumptions.disposition.sellingCosts = exitResult.sellingCosts;
          // Persist terminal metrics and provenance as extended fields.
          // These are not in the ProFormaAssumptions type contract but will be
          // serialized into the assumptions JSON blob and are accessible to
          // downstream F9 evidence surfaces + the audit trail.
          const disp = enhancedAssumptions.disposition as Record<string, unknown>;
          if (exitResult.terminalNOI  != null) disp._terminalNOI  = exitResult.terminalNOI;
          if (exitResult.terminalValue != null) disp._terminalValue = exitResult.terminalValue;
          disp._exitCapSource     = exitResult.source;
          disp._exitCapConfidence = exitResult.confidence;
          disp._exitCapProvenance = exitResult.provenance;
          if (exitResult.compBound)  disp._exitCapCompBound = exitResult.compBound;
        }

        // Wire holdPeriod back when LLM left it at 0 (M20 fallback = 5 years default).
        if (!enhancedAssumptions.holdPeriod || enhancedAssumptions.holdPeriod === 0) {
          enhancedAssumptions.holdPeriod = exitResult.holdPeriod;
        }

        const compNote = exitResult.provenance.compBounded
          ? ` [comp-bounded P25=${(exitResult.compBound!.p25 * 100).toFixed(2)}% P75=${(exitResult.compBound!.p75 * 100).toFixed(2)}% n=${exitResult.compBound!.nSamples}]`
          : '';
        logger.info(
          `[Batch5-ExitStrategy] Applied M20 exit cap for ${dealId}: ` +
          `${(exitResult.exitCapRate * 100).toFixed(2)}%${compNote} ` +
          `holdPeriod=${exitResult.holdPeriod}y` +
          (exitResult.terminalValue != null
            ? ` terminalValue=$${Math.round(exitResult.terminalValue).toLocaleString()}`
            : '') +
          ` (${exitResult.source})`
        );
      }
    } catch (err: any) {
      logger.warn(`[Batch5-ExitStrategy] Skipped for ${dealId}: ${err?.message}`);
    }

    // ── Batch-7A: Hydrate purchasePrice into enhancedAssumptions BEFORE bridge ──
    // This is the pre-bridge twin of the post-bridge Batch-7 block (below).
    // Writing here ensures the persisted assumptions row (built from enhancedAssumptions)
    // receives the reconciled value — not just the deterministic runner's model run.
    // Only fires when the LLM + extraction pipeline left purchasePrice absent or zero.
    // Surfaces method-level evidence (PPU, P50, weight) for the F9 audit trail.
    if (!enhancedAssumptions.acquisition?.purchasePrice ||
        enhancedAssumptions.acquisition.purchasePrice === 0) {
      try {
        const { ValuationGridService } = await import('./valuation/valuation-grid.service');
        const vgSvc = new ValuationGridService(pool);
        const vgResult = await vgSvc.compute(dealId);
        const reconciledValue = vgResult.reconciliation.reconciledValue;
        if (reconciledValue && reconciledValue > 0) {
          if (enhancedAssumptions.acquisition) {
            enhancedAssumptions.acquisition.purchasePrice = reconciledValue;
            // Persist the reconciliation range and method evidence as extended fields.
            // These survive serialization to the stored assumptions JSON blob
            // and are accessible to F9 evidence surfaces and audit trail consumers.
            const acq = enhancedAssumptions.acquisition as Record<string, unknown>;
            acq._purchasePriceLow  = vgResult.reconciliation.recommendedPriceLow;
            acq._purchasePriceHigh = vgResult.reconciliation.recommendedPriceHigh;
            acq._purchasePricePPU  = vgResult.reconciliation.reconciledPPU;
            acq._purchasePriceSignal = vgResult.reconciliation.convergenceSignal;
            acq._purchasePriceSource = 'valuation_grid';
            acq._valuationGridEvidence = (vgResult.methods as any[])
              .filter((m: any) => m.active !== false)
              .map((m: any) => ({
                methodId:   m.methodId ?? m.label ?? 'unknown',
                p50:        m.p50 ?? null,
                ppu:        m.ppu ?? null,
                confidence: m.confidence ?? null,
              }));
          }
          const methodSummary = (vgResult.methods as any[])
            .filter((m: any) => m.active !== false)
            .map((m: any) =>
              `${m.methodId ?? m.label ?? '?'}:P50=$${m.p50 != null ? Math.round(m.p50).toLocaleString() : 'n/a'}`
            )
            .join(', ');
          logger.info(
            `[Batch7A-PurchasePrice] Pre-bridge hydration for ${dealId}: ` +
            `reconciledValue=$${Math.round(reconciledValue).toLocaleString()} ` +
            `range=[$${vgResult.reconciliation.recommendedPriceLow != null ? Math.round(vgResult.reconciliation.recommendedPriceLow).toLocaleString() : 'n/a'}` +
            `–$${vgResult.reconciliation.recommendedPriceHigh != null ? Math.round(vgResult.reconciliation.recommendedPriceHigh).toLocaleString() : 'n/a'}] ` +
            `signal=${vgResult.reconciliation.convergenceSignal} ` +
            `activeMethods=${vgResult.reconciliation.activeMethodCount} ` +
            `[${methodSummary}]`
          );
        }
      } catch (_vg7aErr: any) {
        logger.debug(`[Batch7A-PurchasePrice] Valuation Grid unavailable pre-bridge for ${dealId}: ${_vg7aErr?.message}`);
      }
    }

    // ── Batch-6: Revenue assumptions — market rent, vacancy, concessions ─────────
    //
    // Data sources (in priority order):
    //   6a. compQueryService (v_comp_search)     — comp-anchored P25/P50/P75 rent band (PRIMARY)
    //       EC3 mv_market_rent_benchmarks         — city-level rent band (validation / bounding)
    //   6b. deal_monthly_actuals                  — trailing 12-month occupancy + market rent
    //                                               + concessions (as % of GPR)
    //   6c. apartment_market_snapshots (M05/M07) — submarket occupancy norm, monthly_absorption_rate
    //                                               (M07 proxy), avg_days_to_lease, concession_rate
    //   6d. apartment_supply_pipeline (M04)       — supply headwind (units delivering in 180d)
    //   6e. Other income audit                    — MISSING_DATA alert if otherIncome is empty
    //
    // NON-DESTRUCTIVE: market rent only applied when unit mix rents are all-zero or
    // flat; vacancy only written when existing value is the 0.93 default placeholder.
    // All outputs carry _-prefix provenance extended fields in enhancedAssumptions.revenue.
    try {
      const b6City  = (enhancedAssumptions.dealInfo?.city  ?? '').trim();
      const b6State = (enhancedAssumptions.dealInfo?.state ?? '').trim().toUpperCase();
      const b6Units = enhancedAssumptions.dealInfo?.totalUnits || 1;
      const rev6 = enhancedAssumptions.revenue as Record<string, unknown>;

      // ── 6a: Comp-anchored rent band (primary) + EC3 validation/bounding ──────
      // Primary source: rent comps from v_comp_search — median/P25/P75 of t12_avg_rent
      // for comparable properties in the same city/state with ≥3 months of data.
      // EC3 (mv_market_rent_benchmarks) is used for validation and band-bounding only.
      let compRentP50: number | null = null;
      let compRentP25: number | null = null;
      let compRentP75: number | null = null;
      let compRentCount = 0;
      let ec3P50: number | null = null;
      let ec3P25: number | null = null;
      let ec3P75: number | null = null;
      let ec3SampleSize = 0;

      if (b6City && b6State) {
        // Comp rent search — primary anchor
        try {
          const { compQueryService } = await import('./comp-query.service');
          const comps = await compQueryService.searchComps({
            city: b6City, state: b6State, limit: 20,
          });
          const validRents = comps
            .filter((c: any) => Number(c.t12_avg_rent) > 0 && Number(c.months_of_data) >= 3)
            .map((c: any) => parseFloat(String(c.t12_avg_rent)))
            .filter((r: number) => isFinite(r) && r > 0)
            .sort((a: number, b: number) => a - b);
          if (validRents.length >= 3) {
            const n = validRents.length;
            compRentP25 = validRents[Math.floor(n * 0.25)];
            compRentP50 = validRents[Math.floor(n * 0.50)];
            compRentP75 = validRents[Math.floor(n * 0.75)];
            compRentCount = n;
          } else if (validRents.length > 0) {
            compRentP50 = validRents[Math.floor(validRents.length / 2)];
            compRentCount = validRents.length;
          }
        } catch (_compErr) { /* non-fatal */ }

        // EC3 benchmark — validation / bounding only
        try {
          const ec3Rows = await pool.query(
            `SELECT p25_rent, p50_rent, p75_rent, sample_size
               FROM mv_market_rent_benchmarks
              WHERE LOWER(city) = LOWER($1) AND state = $2
              ORDER BY sample_size DESC NULLS LAST
              LIMIT 1`,
            [b6City, b6State]
          );
          if (ec3Rows.rows.length > 0) {
            const r = ec3Rows.rows[0];
            ec3P25 = r.p25_rent != null ? parseFloat(r.p25_rent) : null;
            ec3P50 = r.p50_rent != null ? parseFloat(r.p50_rent) : null;
            ec3P75 = r.p75_rent != null ? parseFloat(r.p75_rent) : null;
            ec3SampleSize = parseInt(String(r.sample_size ?? '0'), 10) || 0;
          }
        } catch (_ec3Err) { /* non-fatal — EC3 MV may be empty or refreshing */ }
      }

      // ── 6b: Trailing actuals — occupancy + market rent + concessions ──────────
      let trailingOccupancy: number | null = null;
      let trailingMarketRent: number | null = null;
      let trailingConcessionsPct: number | null = null;
      try {
        const actualsRows = await pool.query(
          `SELECT
             AVG(occupancy_rate)                  AS avg_occ,
             AVG(avg_market_rent)                  AS avg_mkt_rent,
             AVG(NULLIF(concessions, 0))            AS avg_concessions,
             AVG(NULLIF(gross_potential_rent, 0))   AS avg_gpr
           FROM deal_monthly_actuals
           WHERE deal_id = $1
             AND report_month >= NOW() - INTERVAL '12 months'`,
          [dealId]
        );
        if (actualsRows.rows.length > 0) {
          const rawOcc  = actualsRows.rows[0].avg_occ;
          const rawRent = actualsRows.rows[0].avg_mkt_rent;
          const rawConc = actualsRows.rows[0].avg_concessions;
          const rawGpr  = actualsRows.rows[0].avg_gpr;
          if (rawOcc != null) {
            let occ = parseFloat(String(rawOcc));
            if (occ > 1) occ = occ / 100;
            if (isFinite(occ) && occ > 0 && occ <= 1) trailingOccupancy = occ;
          }
          if (rawRent != null) {
            const rent = parseFloat(String(rawRent));
            if (isFinite(rent) && rent > 0) trailingMarketRent = rent;
          }
          if (rawConc != null && rawGpr != null) {
            const conc = parseFloat(String(rawConc));
            const gpr  = parseFloat(String(rawGpr));
            if (isFinite(conc) && isFinite(gpr) && gpr > 0) {
              const concPct = conc / gpr;
              if (concPct >= 0 && concPct < 0.5) trailingConcessionsPct = concPct;
            }
          }
        }
      } catch (_actualsErr) { /* non-fatal */ }

      // ── 6c: M05/M07 submarket snapshot — occupancy norm + absorption data ─────
      // monthly_absorption_rate = market-level units absorbed/month (M07 proxy).
      // avg_days_to_lease = leasing velocity proxy for absorption speed.
      let m05Occupancy: number | null = null;
      let m05ConcessionRate: number | null = null;
      let m05MonthlyAbsorptionRate: number | null = null;
      let m05AvgDaysToLease: number | null = null;
      let m05TotalMarketUnits = 0;
      if (b6City && b6State) {
        try {
          const snapRows = await pool.query(
            `SELECT avg_occupancy, concession_rate, monthly_absorption_rate,
                    avg_days_to_lease, total_units
               FROM apartment_market_snapshots
              WHERE LOWER(city) = LOWER($1) AND LOWER(state) = LOWER($2)
              ORDER BY snapshot_date DESC NULLS LAST, id DESC
              LIMIT 1`,
            [b6City, b6State]
          );
          if (snapRows.rows.length > 0) {
            const s = snapRows.rows[0];
            if (s.avg_occupancy != null) {
              let occ = parseFloat(String(s.avg_occupancy));
              if (occ > 1) occ = occ / 100;
              if (isFinite(occ) && occ > 0 && occ <= 1) m05Occupancy = occ;
            }
            if (s.concession_rate != null) {
              let concRate = parseFloat(String(s.concession_rate));
              if (concRate > 1) concRate = concRate / 100;
              if (isFinite(concRate) && concRate >= 0 && concRate < 0.5) m05ConcessionRate = concRate;
            }
            if (s.monthly_absorption_rate != null) {
              const absRate = parseFloat(String(s.monthly_absorption_rate));
              if (isFinite(absRate) && absRate > 0) m05MonthlyAbsorptionRate = absRate;
            }
            if (s.avg_days_to_lease != null) {
              const dtl = parseInt(String(s.avg_days_to_lease), 10);
              if (isFinite(dtl) && dtl > 0) m05AvgDaysToLease = dtl;
            }
            m05TotalMarketUnits = parseInt(String(s.total_units ?? '0'), 10) || 0;
          }
        } catch (_snapErr) { /* non-fatal */ }
      }

      // ── 6d: M04 supply pipeline — vacancy headwind factor ─────────────────────
      // For every 1% of market supply delivering in the next 6 months → +0.3% vacancy
      let supplyHeadwindFactor = 0;
      if (b6City && b6State) {
        try {
          const pipeRows = await pool.query(
            `SELECT COALESCE(SUM(units_delivering), 0) AS total_delivering
               FROM apartment_supply_pipeline
              WHERE LOWER(city) = LOWER($1) AND UPPER(state) = $2
                AND available_date BETWEEN NOW() AND NOW() + INTERVAL '180 days'`,
            [b6City, b6State]
          );
          const pipeSupply = parseInt(String(pipeRows.rows[0]?.total_delivering ?? '0'), 10) || 0;
          const marketBase = m05TotalMarketUnits > 0 ? m05TotalMarketUnits : b6Units * 10;
          if (pipeSupply > 0 && marketBase > 0) {
            const supplyPct = pipeSupply / marketBase;
            supplyHeadwindFactor = Math.min(0.03, supplyPct * 0.3);
          }
        } catch (_pipeErr) { /* non-fatal */ }
      }

      // ── Market rent synthesis ─────────────────────────────────────────────────
      // Primary anchor: comp-anchored P50 from v_comp_search rent comps.
      // Bounding: EC3 P25/P75 band ± 15% prevents out-of-market outliers.
      // Fallback chain: comp P50 → trailing actuals (blended with EC3) → EC3 P50.
      // Only hydrates when unit mix rents are all-zero or flat-default (< $200).
      const unitMixRents = (enhancedAssumptions.unitMix || [])
        .map((u: { marketRent?: number }) => u.marketRent ?? 0);
      const allSameOrZero =
        unitMixRents.length === 0 ||
        unitMixRents.every((r: number) => r <= 0) ||
        (unitMixRents.every((r: number) => r === unitMixRents[0]) && (unitMixRents[0] ?? 0) < 200);

      if (allSameOrZero && (compRentP50 != null || ec3P50 != null || trailingMarketRent != null)) {
        let synthesizedRent: number;
        let rentSource: string;

        if (compRentP50 != null) {
          // Comp-anchored primary: median of actual rent comps
          synthesizedRent = compRentP50;
          rentSource = `comp_anchored_n${compRentCount}`;
        } else if (trailingMarketRent != null && ec3P50 != null) {
          // No comps — blend trailing actuals (higher weight) + EC3
          synthesizedRent = trailingMarketRent * 0.6 + ec3P50 * 0.4;
          rentSource = 'trailing_actuals_ec3_blend';
        } else if (trailingMarketRent != null) {
          synthesizedRent = trailingMarketRent;
          rentSource = 'trailing_actuals';
        } else {
          synthesizedRent = ec3P50!;
          rentSource = 'ec3_p50_fallback';
        }

        // Bound against EC3 band (± 15%) when EC3 data is available
        if (ec3P25 != null && synthesizedRent < ec3P25 * 0.85) {
          synthesizedRent = ec3P25 * 0.85;
          rentSource += '+ec3_floor';
        }
        if (ec3P75 != null && synthesizedRent > ec3P75 * 1.15) {
          synthesizedRent = ec3P75 * 1.15;
          rentSource += '+ec3_ceiling';
        }

        for (const unit of (enhancedAssumptions.unitMix || [])) {
          if (!unit.marketRent || unit.marketRent <= 0) {
            (unit as Record<string, unknown>).marketRent = synthesizedRent;
          }
          if (!unit.inPlaceRent || unit.inPlaceRent <= 0) {
            (unit as Record<string, unknown>).inPlaceRent = synthesizedRent;
          }
        }

        rev6._marketRentSource         = rentSource;
        rev6._marketRentCompP25        = compRentP25;
        rev6._marketRentCompP50        = compRentP50;
        rev6._marketRentCompP75        = compRentP75;
        rev6._marketRentCompCount      = compRentCount;
        rev6._marketRentEC3P50         = ec3P50;
        rev6._marketRentEC3P25         = ec3P25;
        rev6._marketRentEC3P75         = ec3P75;
        rev6._marketRentEC3SampleSize  = ec3SampleSize;
        rev6._marketRentTrailingActual = trailingMarketRent;
        rev6._marketRentSynthesized    = synthesizedRent;

        logger.info(
          `[Batch6a-MarketRent] Hydrated unit mix for ${dealId}: ` +
          `rent=$${Math.round(synthesizedRent)} source=${rentSource} ` +
          `compP50=${compRentP50 != null ? `$${Math.round(compRentP50)}(n=${compRentCount})` : 'n/a'} ` +
          `ec3P50=${ec3P50 != null ? `$${Math.round(ec3P50)}` : 'n/a'} ` +
          `trailing=${trailingMarketRent != null ? `$${Math.round(trailingMarketRent)}` : 'n/a'}`
        );
      } else if (compRentP50 != null || ec3P50 != null) {
        // Unit mix already has rents — record comp/EC3 competitive position for audit
        const avgUnitRent = unitMixRents.length > 0
          ? unitMixRents.reduce((s: number, r: number) => s + r, 0) / unitMixRents.length
          : 0;
        const anchor = compRentP50 ?? ec3P50!;
        const vsP50Pct = anchor > 0 ? (avgUnitRent - anchor) / anchor : 0;
        rev6._marketRentCompP50       = compRentP50;
        rev6._marketRentCompCount     = compRentCount;
        rev6._marketRentEC3P50        = ec3P50;
        rev6._marketRentEC3SampleSize = ec3SampleSize;
        rev6._marketRentPosition      = vsP50Pct > 0.05 ? 'premium' : vsP50Pct < -0.05 ? 'discount' : 'market';
        rev6._marketRentVsAnchorPct   = vsP50Pct;
        rev6._marketRentSource        = compRentP50 != null ? 'unit_mix_validated_by_comps' : 'unit_mix_validated_by_ec3';
      }

      // ── Vacancy / stabilized occupancy ────────────────────────────────────────
      // Existing properties:  trailing actuals (12m) → M05 submarket norm → default
      // Lease-up/development: M07 absorption curve (monthly_absorption_rate from M05
      //   snapshot) models how many months to fill totalUnits from 0% → Y1 occupancy.
      //   Fallback absorption: derived from avg_days_to_lease or 15 units/month default.
      const existingOcc = enhancedAssumptions.revenue?.stabilizedOccupancy;
      const isDefaultOcc = !existingOcc || Math.abs(existingOcc - 0.93) < 0.001;
      const b6DealMode = enhancedAssumptions.dealMode ?? enhancedAssumptions.modelType ?? 'existing';
      const isLeaseUp = b6DealMode === 'lease_up' || b6DealMode === 'development' || b6DealMode === 'ground_up';

      let derivedOcc: number | null = null;
      let vacancySource = '';

      if (isLeaseUp) {
        // M07 absorption-based lease-up ramp
        // absorptionRate: market units absorbed per month (M07 proxy via M05 snapshot)
        // Subject's effective absorption = absorptionRate × competitive share fraction (0.15)
        // months_to_stabilize = subject_units / effective_absorption × 1.5 friction
        const absorptionRate =
          m05MonthlyAbsorptionRate ??
          (m05AvgDaysToLease != null && m05AvgDaysToLease > 0
            ? Math.min(200, (30 / m05AvgDaysToLease) * Math.max(b6Units, 50))
            : 100); // default: 100 units/month for the market
        const effectiveAbsorption = Math.max(absorptionRate * 0.15, 1); // subject's share
        const monthsToStabilize = (b6Units / effectiveAbsorption) * 1.5;
        const stabilizedTarget = m05Occupancy ?? 0.93;
        const y1Fraction = Math.min(1, 12 / Math.max(monthsToStabilize, 1));
        derivedOcc = Math.max(0.50, stabilizedTarget * y1Fraction);
        vacancySource = `m07_absorption_curve`;

        rev6._vacancyM07AbsorptionRate    = absorptionRate;
        rev6._vacancyM07EffectiveAbsorb   = effectiveAbsorption;
        rev6._vacancyM07MonthsToStabilize = monthsToStabilize;
        rev6._vacancyM07Y1Fraction        = y1Fraction;
        rev6._vacancyM07StabilizedTarget  = stabilizedTarget;

        logger.info(
          `[Batch6b-Vacancy] M07 absorption curve for ${dealId} (${b6DealMode}): ` +
          `absorptionRate=${absorptionRate.toFixed(1)}/mo effective=${effectiveAbsorption.toFixed(1)}/mo ` +
          `monthsToStab=${monthsToStabilize.toFixed(1)} y1Frac=${y1Fraction.toFixed(2)} ` +
          `y1Occ=${(derivedOcc * 100).toFixed(1)}%`
        );
      } else if (trailingOccupancy != null) {
        derivedOcc   = trailingOccupancy;
        vacancySource = 'trailing_actuals_12m';
      } else if (m05Occupancy != null) {
        derivedOcc   = m05Occupancy;
        vacancySource = 'm05_submarket_norm';
      }

      if (derivedOcc != null) {
        // Apply M04 supply headwind (reduces occupancy slightly)
        const withHeadwind = Math.max(0.50, Math.min(0.99, derivedOcc - supplyHeadwindFactor));

        if (isDefaultOcc && withHeadwind > 0) {
          if (enhancedAssumptions.revenue) {
            enhancedAssumptions.revenue.stabilizedOccupancy = withHeadwind;
          }
        }

        rev6._vacancySource             = vacancySource;
        rev6._vacancyTrailingOccupancy  = trailingOccupancy;
        rev6._vacancyM05Norm            = m05Occupancy;
        rev6._vacancySupplyHeadwind     = supplyHeadwindFactor;
        rev6._vacancyDerived            = withHeadwind;
        rev6._vacancyWroteToAssumptions = isDefaultOcc && withHeadwind > 0;

        if (!isLeaseUp) {
          logger.info(
            `[Batch6b-Vacancy] Derived stabilized occupancy for ${dealId}: ` +
            `${(withHeadwind * 100).toFixed(1)}% source=${vacancySource} ` +
            `headwind=${(supplyHeadwindFactor * 100).toFixed(2)}% wrote=${isDefaultOcc && withHeadwind > 0}`
          );
        }
      }

      // ── Concessions — trailing actuals primary, M05 fallback, operator override ─
      // Priority (highest → lowest):
      //   1. Operator override (_concessionsOperatorOverride flag set externally)
      //   2. Trailing actuals concession % (concessions / GPR from deal_monthly_actuals)
      //   3. M05 submarket snapshot concession_rate
      //   4. null (no data available)
      const operatorConcOverride = rev6._concessionsOperatorOverride === true;
      if (operatorConcOverride) {
        rev6._concessionsSource = 'operator_override';
        // _concessionsPct already holds the operator-supplied value — do not overwrite
      } else if (trailingConcessionsPct != null) {
        rev6._concessionsPct    = trailingConcessionsPct;
        rev6._concessionsSource = 'trailing_actuals';
        logger.info(
          `[Batch6c-Concessions] Trailing actuals for ${dealId}: ` +
          `${(trailingConcessionsPct * 100).toFixed(2)}%`
        );
      } else if (m05ConcessionRate != null) {
        rev6._concessionsPct    = m05ConcessionRate;
        rev6._concessionsSource = 'm05_submarket_snapshot';
        logger.info(
          `[Batch6c-Concessions] M05 snapshot for ${dealId}: ` +
          `${(m05ConcessionRate * 100).toFixed(2)}% (${b6City}, ${b6State})`
        );
      } else {
        rev6._concessionsPct    = null;
        rev6._concessionsSource = 'unavailable';
      }

      // ── Other income audit (6e) ───────────────────────────────────────────────
      const oiItems = enhancedAssumptions.revenue?.otherIncome
        ? Object.values(enhancedAssumptions.revenue.otherIncome)
        : [];
      const hasOI = oiItems.some((oi: any) => oi && (oi.perUnitMonth ?? 0) > 0);
      if (!hasOI) {
        rev6._otherIncomeAvailability = 'MISSING_DATA';
        rev6._otherIncomeAlertLevel   = 'MISSING_DATA';
      } else {
        const totalOIPerUnitMonth = oiItems.reduce(
          (s: number, oi: any) => s + (oi?.perUnitMonth ?? 0) * (oi?.penetration ?? 1),
          0
        );
        rev6._otherIncomeAvailability      = 'AVAILABLE';
        rev6._otherIncomeTotalPerUnitMonth = totalOIPerUnitMonth;
        rev6._otherIncomeAnnualTotal       = totalOIPerUnitMonth * 12 * b6Units;
      }

    } catch (err: any) {
      logger.warn(`[Batch6-Revenue] Skipped for ${dealId}: ${err?.message}`);
    }

    // ── D-MOD pass: pre-derivation stage-gate enforcement + conflict resolution ──
    //
    // ORDER OF OPERATIONS (do not reorder — each step depends on the previous):
    //
    //   1. evaluatePipeline()       — check which stages are satisfied NOW, before
    //                                  building the conflict batch.
    //   2. Build conflictBatch      — iterate ASSUMPTION_MODULE_MAPPINGS (config-driven,
    //                                  no per-field hardcoded logic).  Penalty applied to
    //                                  authoritative confidence for unsatisfied stages so
    //                                  gate violations propagate into D-MOD-2 resolution.
    //   3. resolveAssumptionBatch() — D-MOD-2: auth wins (Step 1), blend within band
    //                                  (Step 2), flag beyond band (Step 3).
    //   4. applyResolved()          — write resolved values BACK into enhancedAssumptions
    //                                  BEFORE the deterministic model run. This is the enforcement
    //                                  point: D-MOD-2 step-2 blends materialise in the
    //                                  model that the deterministic runner receives.
    //   5. enforceStageGates()      — collect gate violations for the evidence trail.
    //   6. Persist to DB            — evidence rows + violation rows → underwriting_evidence.
    //
    // Non-blocking: wrapped in try/catch; the model build never hard-fails on a D-MOD error.
    try {
      const moduleInputs = await getFinancialInputsFromModules(dealId);
      const sources: ModuleDataSources = {
        ...moduleInputs,
        m11Data: dataFlowRouter.getModuleData('M11', dealId)?.data as Record<string, unknown> | undefined,
        m12Data: dataFlowRouter.getModuleData('M12', dealId)?.data as Record<string, unknown> | undefined,
        m14Data: dataFlowRouter.getModuleData('M14', dealId)?.data as Record<string, unknown> | undefined,
      };
      const a = enhancedAssumptions as ProFormaAssumptions;

      // ── STEP 1: Pipeline evaluation — BEFORE building the conflict batch ────
      // Violations found here cause the affected assumption's authoritative
      // confidence to be penalised (×0.5). The lower confidence propagates
      // through D-MOD-2 resolution, producing a lower-confidence resolved value
      // that the downstream LLM and deterministic runner receive.
      const pipelineState = evaluatePipeline(dealId);
      const completedPct  = Math.round((pipelineState.completedStageIds.length / 11) * 100);
      logger.info(
        `[D-MOD-3] Pipeline for ${dealId}: ` +
        `${pipelineState.completedStageIds.length}/11 stages (${completedPct}%). ` +
        `${pipelineState.gatedStageId
          ? `Gated at "${pipelineState.gatedStageId}" — ${pipelineState.gatedReason}`
          : 'All stages satisfied.'}`
      );

      // ── STEP 2: Build conflict batch from ASSUMPTION_MODULE_MAPPINGS ────────
      // Config-driven: iterating ASSUMPTION_MODULE_MAPPINGS + ASSUMPTION_EXTRACTORS
      // means adding a new assumption mapping automatically includes it in this pass
      // without any further code changes.
      const conflictBatch: Array<{ field: AssumptionField; inputs: ModuleValueInput[] }> = [];

      for (const mapping of ASSUMPTION_MODULE_MAPPINGS) {
        const extractor = ASSUMPTION_EXTRACTORS[mapping.field];
        if (!extractor) {
          logger.warn(`[D-MOD] No extractor registered for field "${mapping.field}" — skipped`);
          continue;
        }

        // Stage gate pre-check: penalise auth confidence when the required stage
        // was not satisfied at the time the assumptions were derived.
        const stageResult     = pipelineState.stages.get(mapping.stageDependency);
        const stageSatisfied  = stageResult?.satisfied ?? false;
        const confidencePenalty = stageSatisfied ? 1.0 : 0.5;

        const authValue      = extractor.extractAuth(a);
        const baseConfidence = authValue !== null ? 0.75 : 0.30;
        const authConfidence = baseConfidence * confidencePenalty;

        const supportingInputs = extractor
          .buildSupportingInputs(sources)
          .map(s => ({ ...s, isAuthoritative: false as const }));

        conflictBatch.push({
          field: mapping.field,
          inputs: [
            {
              moduleId:        mapping.authoritativeModule,
              value:           authValue,
              confidence:      authConfidence,
              isAuthoritative: true,
              sourceLabel:
                `${mapping.authoritativeModule} (${mapping.label} — proforma value` +
                `${stageSatisfied ? '' : ' ⚠ stage not yet satisfied'})`,
            },
            ...supportingInputs,
          ],
        });
      }

      // ── STEP 3: D-MOD-2 conflict resolution ────────────────────────────────
      const resolutionResults = resolveAssumptionBatch(conflictBatch);

      // ── STEP 4: Apply resolved values back into enhancedAssumptions ─────────
      // HARD GATE: resolved values are only written back when the assumption's
      // required stage dependency is satisfied.  When a gate is violated, the
      // writeback is SKIPPED — the assumption value stays as the LLM derived it
      // (unverified) and the violation is surfaced via evidence in STEP 6.
      // This converts gate enforcement from advisory/observational to structural:
      // D-MOD-2 blends cannot materialise in assumptions that lack prerequisite
      // stage data, preventing quietly polluted model inputs.
      const stageDependencyByField = new Map<AssumptionField, string>(
        ASSUMPTION_MODULE_MAPPINGS.map(m => [m.field, m.stageDependency])
      );
      let writebackCount  = 0;
      let gatedBlockCount = 0;
      for (const [field, result] of resolutionResults) {
        if (result.resolvedValue === null) continue;
        const extractor = ASSUMPTION_EXTRACTORS[field];
        if (!extractor) continue;

        // Hard gate: skip writeback when stage not satisfied
        const stageDep     = stageDependencyByField.get(field);
        const stageResult  = stageDep ? pipelineState.stages.get(stageDep) : undefined;
        const gateBlocked  = stageDep !== undefined && !(stageResult?.satisfied ?? true);
        if (gateBlocked) {
          gatedBlockCount++;
          logger.warn(
            `[D-MOD-3] Writeback BLOCKED for "${field}" — ` +
            `stage "${stageDep}" not satisfied ` +
            `(missing: ${stageResult?.missingModules.join(', ') || 'upstream deps'}). ` +
            `Assumption value kept as-is (unverified).`
          );
          continue;
        }

        const origValue = extractor.extractAuth(a);
        if (origValue === null || Math.abs(result.resolvedValue - origValue) < 1e-9) continue;
        extractor.applyResolved(a, result.resolvedValue);
        writebackCount++;
        logger.debug(
          `[D-MOD-2] Writeback for "${field}": ` +
          `${origValue.toFixed(6)} → ${result.resolvedValue.toFixed(6)} ` +
          `(${result.bandAdjusted ? 'step-2 blend' : 'step-1 auth'})`
        );
      }
      if (writebackCount > 0 || gatedBlockCount > 0) {
        logger.info(
          `[D-MOD-2] Writeback: ${writebackCount} applied, ${gatedBlockCount} gate-blocked`
        );
      }

      // ── STEP 5: Gate-violation evidence collection ──────────────────────────
      const stageDeps = ASSUMPTION_MODULE_MAPPINGS.map(m => ({
        field:           m.field,
        stageDependency: m.stageDependency,
      }));
      const violations = enforceStageGates(pipelineState, stageDeps);
      if (violations.length > 0) {
        logger.warn(
          `[D-MOD-3] ${violations.length} gate violation(s) for ${dealId}: ` +
          violations.map(v => `${v.assumptionField}→${v.violatedStageId}(${v.severity})`).join(', ')
        );
      }

      // ── STEP 6: Persist evidence entries + gate violations ─────────────────
      const evidenceInserts: Array<Promise<unknown>> = [];

      for (const [, result] of resolutionResults) {
        const entry = result.evidenceEntry;
        evidenceInserts.push(
          pool.query(
            `INSERT INTO underwriting_evidence
               (deal_id, field_path, value_numeric, primary_tier, data_points, reasoning, alternatives, collision, confidence)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT DO NOTHING`,
            [
              dealId,
              `d_mod2.${entry.field_path}`,
              result.resolvedValue ?? null,
              entry.primary_tier,
              JSON.stringify(entry.data_points),
              entry.reasoning,
              JSON.stringify([]),
              entry.conflict_detail ? JSON.stringify({
                field_path:   `d_mod2.${entry.field_path}`,
                agent_value:  entry.conflict_detail.authoritativeValue,
                broker_value: entry.conflict_detail.divergingValue,
                delta_pct:    entry.conflict_detail.divergencePct,
                magnitude:    entry.conflict_detail.divergencePct > 0.30 ? 'severe' : entry.conflict_detail.divergencePct > 0.15 ? 'material' : 'minor',
                direction:    entry.conflict_detail.divergingValue > entry.conflict_detail.authoritativeValue ? 'agent_lower' : 'agent_higher',
                narrative:    entry.conflict_detail.narrative,
              }) : null,
              entry.confidence,
            ]
          ).catch((err: Error) => logger.warn(`[D-MOD-2] Evidence insert failed for ${entry.field_path}: ${err.message}`))
        );
      }

      for (const violation of violations) {
        evidenceInserts.push(
          pool.query(
            `INSERT INTO underwriting_evidence
               (deal_id, field_path, primary_tier, data_points, reasoning, alternatives, confidence)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT DO NOTHING`,
            [
              dealId,
              `d_mod3.gate_violation.${violation.violatedStageId}`,
              3,
              JSON.stringify([]),
              violation.narrative,
              JSON.stringify([]),
              violation.severity === 'error' ? 'low' : 'medium',
            ]
          ).catch((err: Error) => logger.warn(`[D-MOD-3] Violation insert failed: ${err.message}`))
        );
      }

      await Promise.allSettled(evidenceInserts);

      const conflictCount = [...resolutionResults.values()].filter(r => r.conflictFlagged).length;
      const blendCount    = [...resolutionResults.values()].filter(r => r.bandAdjusted).length;
      logger.info(
        `[D-MOD] Pass complete for ${dealId}: ` +
        `${resolutionResults.size} resolved, ${conflictCount} conflict(s), ` +
        `${blendCount} blend(s), ${writebackCount} writeback(s), ${violations.length} gate violation(s)`
      );

    } catch (dmodErr: any) {
      logger.warn(`[D-MOD] Pass skipped for ${dealId}: ${dmodErr?.message}`);
    }

    // Log enhancement summary
    const enhancementSummary = m26m27ProFormaEnhancer.getEnhancementSummary(enhancedAssumptions);
    logger.info(`M26/M27ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢M09 Enhancement for deal ${dealId}:\n${enhancementSummary}`);

    const insertResult = await pool.query(
      `INSERT INTO deal_financial_models (deal_id, model_type, assumptions, status, assumptions_hash)
       VALUES ($1, $2, $3, 'building', $4) RETURNING id`,
      [dealId, assumptions.modelType, JSON.stringify(enhancedAssumptions), assumptionsHash]
    );
    const modelId = insertResult.rows[0].id;

    try {
      // ── D2: Deterministic-primary build path ──────────────────────────────
      let result: FinancialModelResult;
      let verificationPassed = true;
      let verificationDiagnostics = '';

      try {
        const modelAssumptions = mapProFormaAssumptionsToModelAssumptions(enhancedAssumptions as ProFormaAssumptions);

        // ── Hydrate loanAmount from deal_data when bridge received zero ──────
        if (modelAssumptions.loanAmount === 0) {
          try {
            const laRow = await pool.query(
              `SELECT COALESCE(
                 (deal_data->>'loanAmount')::float,
                 (deal_data->'financing'->>'loanAmount')::float,
                 (deal_data->>'debtAmount')::float,
                 (deal_data->>'loan_amount')::float
               ) AS loan_amount
               FROM deals WHERE id = $1`,
              [dealId]
            );
            const fallbackLoan: number | null = laRow.rows[0]?.loan_amount ?? null;
            if (fallbackLoan !== null && fallbackLoan > 0) {
              modelAssumptions.loanAmount = fallbackLoan;
              logger.info(`[F9-Build] Hydrated loanAmount=${fallbackLoan.toFixed(0)} from deal_data for ${dealId}`);
            }
          } catch (_laErr) { /* non-fatal */ }
        }

        // ── Batch-7: Hydrate purchasePrice from Valuation Grid when zero ─────
        if (modelAssumptions.purchasePrice === 0) {
          try {
            const { ValuationGridService } = await import('./valuation/valuation-grid.service');
            const vgSvc = new ValuationGridService(pool);
            const vgResult = await vgSvc.compute(dealId);
            const reconciledValue = vgResult.reconciliation.reconciledValue;
            if (reconciledValue && reconciledValue > 0) {
              modelAssumptions.purchasePrice = reconciledValue;
              if (enhancedAssumptions.acquisition) {
                const acq7 = enhancedAssumptions.acquisition as Record<string, unknown>;
                if (!acq7._purchasePriceSource) {
                  acq7._purchasePriceLow  = vgResult.reconciliation.recommendedPriceLow;
                  acq7._purchasePriceHigh = vgResult.reconciliation.recommendedPriceHigh;
                  acq7._purchasePricePPU  = vgResult.reconciliation.reconciledPPU;
                  acq7._purchasePriceSignal = vgResult.reconciliation.convergenceSignal;
                  acq7._purchasePriceSource = 'valuation_grid_post_bridge';
                  acq7._valuationGridEvidence = (vgResult.methods as any[])
                    .filter((m: any) => m.active !== false)
                    .map((m: any) => ({
                      methodId:   m.methodId ?? m.label ?? 'unknown',
                      p50:        m.p50 ?? null,
                      ppu:        m.ppu ?? null,
                      confidence: m.confidence ?? null,
                    }));
                }
              }
            }
          } catch (_vgErr: any) {
            logger.debug(`[Batch7-PurchasePrice] Valuation Grid unavailable for ${dealId}: ${_vgErr?.message}`);
          }
        }

        // ── Enrich dealMode from rent-roll occupancy when not explicitly provided ─
        if (!enhancedAssumptions.dealMode && enhancedAssumptions.modelType !== 'development') {
          try {
            const rrRow = await pool.query(
              `SELECT (deal_data->'extraction_rent_roll'->>'occupied_units')::float /
                      NULLIF((deal_data->'extraction_rent_roll'->>'total_units')::float, 0)
                      AS occ_rate
               FROM deals WHERE id = $1`,
              [dealId]
            );
            const occRate: number | null = rrRow.rows[0]?.occ_rate ?? null;
            if (occRate !== null && occRate < 0.90) {
              modelAssumptions.dealMode = 'lease_up';
              logger.info(`[F9-Build] Inferred dealMode=lease_up from rent-roll occupancy ($${(occRate * 100).toFixed(1)}%) for ${dealId}`);
            }
          } catch (_rrErr) { /* non-fatal */ }
        }

        // Attach LayeredValue evidence hints from deal_assumptions.year1 if available
        try {
          const year1Row = await pool.query(
            `SELECT year1 FROM deal_assumptions WHERE deal_id = $1 LIMIT 1`,
            [dealId]
          );
          const year1Seed: ProFormaYear1Seed | null = year1Row.rows[0]?.year1 ?? null;
          if (year1Seed) {
            const { hints, collisions } = buildEvidenceHintsFromSeed(year1Seed);
            modelAssumptions._evidenceHints = hints;
            modelAssumptions._collisionReport = collisions;
            logger.info(`[F9-Evidence] Attached ${Object.keys(hints).length} evidence hints, ${collisions.length} collisions for ${dealId}`);
          }
        } catch (hintErr: any) {
          logger.warn(`[F9-Evidence] Could not load year1 seed for ${dealId}: ${hintErr?.message}`);
        }

        const deterministicResult = runModel(modelAssumptions, { skipSensitivity: true });
        result = modelResultsToFinancialModelResult(deterministicResult);

        // Pre-optimization integrity check: validates the raw deal_assumptions BEFORE
        // M11 debt optimization and M14 risk adjustments. The authoritative integrity
        // verdict lives in runFullModel(), which runs checks on the FINAL result.
        // This early check is relabeled so nothing downstream mistakes it for validation
        // of the shipped result (Finding O forensic).
        const preOptimizationChecks = runIntegrityChecks(modelAssumptions, deterministicResult);
        const preHardFailures = preOptimizationChecks.filter(c => c.status === 'error' && c.id.startsWith('INV-'));

        // INFORMATIONAL ONLY: pre-optimization state is pre-M11/M14; never fatal.
        // The authoritative integrity verdict lives in runFullModel()'s final-state check.
        if (preHardFailures.length > 0) {
          const preDiagnostics = preHardFailures.map(c => c.message).join('; ');
          logger.warn(
            `[F9-Verifier] Pre-optimization invariants flagged for ${dealId} ` +
            `(informational only — will be re-checked after M11/M14): ${preDiagnostics}`
          );
        }

        const cd = deterministicResult.evidence?.confidence_distribution;
          const cdSummary = cd ? `evidence confidence: H=${cd.high} M=${cd.medium} L=${cd.low}` : 'evidence: n/a';
          logger.info(
            `[F9-Verifier] Pre-optimization invariants pass for ${dealId} ` +
            `(${preOptimizationChecks.filter(c => c.status === 'warn').length} warnings, ${cdSummary})`
          );
          result.evidence = deterministicResult.evidence;
          result.reasoning = {
            walkthrough: deterministicResult.reasoning.walkthrough,
            collisionReport: deterministicResult.reasoning.collisionReport,
          };
          result.integrityChecks = deterministicResult.integrityChecks;

          // ── M11 + M14 + Final Model (runFullModel) ────────────────────────
          let adjustedAssumptions = modelAssumptions;
          let m11CapitalStructure: M11CapitalStructureSummary | undefined;
          let m14DscrConstraintBinds = false;
          let m11Converged = false;
          let m11Iterations = 0;
          let m14Applied = false;
          let m14CapRateAdjBps = 0;
          let m14DscrFloor = 1.25;

          try {
            // Fetch M14 data from DB (impure — stays in service layer)
            const m14Raw = dataFlowRouter.getModuleData('M14', dealId)?.data;
            const m14Data: M14DataInput | undefined = m14Raw ? {
              capRateAdjBps: typeof m14Raw.cap_rate_adjustment_bps === 'number' ? m14Raw.cap_rate_adjustment_bps : undefined,
              reserveOverrides: m14Raw.reserve_overrides ?? undefined,
              dscrFloor: typeof m14Raw.dscr_floor === 'number' && m14Raw.dscr_floor > 0 ? m14Raw.dscr_floor : undefined,
            } : undefined;

            // F5-1 instrumentation: capture effective assumptions at runFullModel boundary
            // for golden-fixture re-pin. Log to console when dealId matches Bishop.
            const isBishop = dealId === '3f32276f-aacd-4da3-b306-317c5109b403';
            if (isBishop) {
              console.log('[F5-1] Bishop effectiveAssumptions at runFullModel boundary:');
              console.log(JSON.stringify(modelAssumptions, null, 2));
            }

            const full = runFullModel(modelAssumptions, {
              skipSensitivity: true,
              maxM11Iter: 3,
              m14Data,
            });

            if (isBishop) {
              console.log('[F5-1] Bishop adjustedAssumptions post-runFullModel:');
              console.log(JSON.stringify(full.adjustedAssumptions, null, 2));
            }

            adjustedAssumptions = full.adjustedAssumptions;
            m11Converged = full.m11Converged;
            m11Iterations = full.m11Iterations;
            m14Applied = full.m14Applied;
            m14CapRateAdjBps = full.m14CapRateAdjBps;
            m14DscrFloor = full.m14DscrFloor;

            // Assemble result from final model run
            result = modelResultsToFinancialModelResult(full.result);
            result.integrityChecks = [...(result.integrityChecks ?? []), ...full.integrityChecks, ...full.m11Warnings];

            // ── M11 financing write-back (Task #1412) ─────────────────────
            try {
              const dscrActual: number | null = full.result.debtMetrics?.coverage?.dscrY1 ?? null;
              const capexBudget = adjustedAssumptions.capexBudget ?? 0;
              const { financing: updatedFinancing, summary } = writeM11ToFinancing(
                adjustedAssumptions,
                enhancedAssumptions.financing as {
                  loanAmount: number; loanType: string; interestRate: number; spread: number;
                  term: number; amortization: number; ioPeriod: number; originationFee: number;
                  rateCapCost: number; prepayPenalty: number;
                },
                capexBudget,
                dscrActual,
                m14DscrFloor,
              );
              enhancedAssumptions.financing = updatedFinancing as typeof enhancedAssumptions.financing;
              m11CapitalStructure = summary;
              m14DscrConstraintBinds = summary.constraintBinds;

              if (m14DscrConstraintBinds) {
                result.integrityChecks = [
                  ...(result.integrityChecks ?? []),
                  {
                    id: 'dscr_floor_binds',
                    status: 'warn' as const,
                    message:
                      `M14 DSCR floor of ${m14DscrFloor.toFixed(2)}× is binding: ` +
                      `actual DSCR ${dscrActual !== null ? dscrActual.toFixed(2) : 'n/a'}× ` +
                      `is below the floor. Loan may be undersized or NOI is thin — ` +
                      `review debt assumptions before proceeding.`,
                  },
                ];
              }

              logger.info(
                `[M11] Financing write-back complete for ${dealId}: ` +
                `loanAmount=${summary.loanAmount.toFixed(0)} ltv=${(summary.ltv * 100).toFixed(1)}% ` +
                `ltc=${(summary.ltc * 100).toFixed(1)}% rate=${(summary.rate * 100).toFixed(2)}% ` +
                `term=${summary.termYears}yr amort=${summary.amortYears}yr io=${summary.ioPeriodMonths}mo ` +
                `dscrActual=${dscrActual?.toFixed(2) ?? 'n/a'} floor=${m14DscrFloor.toFixed(2)} ` +
                `constraintBinds=${summary.constraintBinds}`,
              );
            } catch (writeBackErr: any) {
              logger.warn(`[M11] Financing write-back skipped for ${dealId}: ${writeBackErr?.message}`);
            }
          } catch (fullErr: any) {
            verificationPassed = false;
            verificationDiagnostics = `runFullModel_exception: ${fullErr?.message ?? 'unknown'}`;
            logger.error(`[runFullModel] failed for ${dealId}: ${fullErr?.message}`);
          }

          result.meta = {
            m11Converged,
            m11Iterations,
            m14Applied,
            m14CapRateAdjBps,
            m11CapitalStructure,
            m14DscrConstraintBinds,
          };

          // ── D2: Ribbon consumption — overlay engine monthly onto periodic seed ──
          try {
            const { overlayEngineMonthlyOnSeed } = await import('./proforma/periodic-seeder.service');
            const seedRow = await pool.query(
              `SELECT periodic_seed FROM deal_assumptions WHERE deal_id = $1`,
              [dealId]
            );
            const periodicSeed = seedRow.rows[0]?.periodic_seed ?? null;
            if (periodicSeed) {
              const updatedSeed = overlayEngineMonthlyOnSeed(
                periodicSeed,
                (deterministicResult.monthlyCashFlow as unknown as Array<Record<string, number>>),
                modelAssumptions.units,
              );
              await pool.query(
                `UPDATE deal_assumptions
                 SET periodic_seed = $2::jsonb,
                     updated_at = NOW()
                 WHERE deal_id = $1`,
                [dealId, JSON.stringify(updatedSeed)]
              );
              logger.info(
                `[D2-Ribbon] Engine monthly output overlaid onto periodic seed for ${dealId}: ` +
                `${deterministicResult.monthlyCashFlow.length} months, ${modelAssumptions.units} units`
              );
            }
          } catch (ribbonErr: any) {
            logger.warn(`[D2-Ribbon] Failed to overlay engine monthly onto periodic seed for ${dealId}: ${ribbonErr?.message}`);
          }
      } catch (verifyErr: any) {
        // Fail-closed: if the bridge or runner itself throws, treat as a hard failure.
        // We cannot confirm model integrity, so we must not persist as 'complete'.
        verificationPassed = false;
        verificationDiagnostics = `verifier_exception: ${verifyErr?.message ?? 'unknown'}`;
        logger.error(`[F9-Verifier] Verification threw for ${dealId}: ${verifyErr?.message}`, verifyErr);
      }

      if (!verificationPassed) {
        await pool.query(
          `UPDATE deal_financial_models SET status = 'error', error_message = $1, updated_at = NOW() WHERE id = $2`,
          [`F9 integrity checks failed: ${verificationDiagnostics}`, modelId]
        );
        throw new Error(`F9 integrity checks failed: ${verificationDiagnostics}`);
      }

      await pool.query(
        `UPDATE deal_financial_models SET results = $1, status = 'complete', updated_at = NOW() WHERE id = $2`,
        [JSON.stringify(result), modelId]
      );

      // ── Batch 4/5 → deal_assumptions sync (Lower #23) ───────────────────────
      // The model engine computes rent growth (Batch 4) and exit cap (Batch 5)
      // but previously only wrote them to deal_financial_models. The F9 UI reads
      // from deal_assumptions, so these computed values were invisible to the user.
      //
      // We now write them back to deal_assumptions top-level columns so the
      // F9 assumption surface shows the model engine's outputs, not stale
      // seed values.  We also write them to the active scenario's year1 so
      // the trigger keeps deal_assumptions.year1 in sync.
      try {
        const computedRentGrowth = enhancedAssumptions.revenue?.rentGrowth as number[] | undefined;
        const computedExitCap = enhancedAssumptions.disposition?.exitCapRate as number | undefined;
        const computedHoldPeriod = enhancedAssumptions.holdPeriod as number | undefined;
        const computedSellingCosts = enhancedAssumptions.disposition?.sellingCosts as number | undefined;

        const updates: Array<{ col: string; val: any }> = [];
        if (computedRentGrowth && computedRentGrowth.length > 0) {
          // R9: rent_growth_yr1 retired as output-scalar column — now lives only
          // in deal_assumptions.year1.rent_growth_yr1 (LayeredValue, via scenario
          // trigger below). Do not write back to the top-level scalar column.
          updates.push({ col: 'rent_growth_stabilized', val: computedRentGrowth[computedRentGrowth.length - 1] });
        }
        if (computedExitCap != null && computedExitCap > 0) {
          updates.push({ col: 'exit_cap', val: computedExitCap });
        }
        if (computedHoldPeriod != null && computedHoldPeriod > 0) {
          updates.push({ col: 'hold_period_years', val: computedHoldPeriod });
        }
        if (computedSellingCosts != null && computedSellingCosts >= 0) {
          updates.push({ col: 'selling_costs_pct', val: computedSellingCosts });
        }

        if (updates.length > 0) {
          const setClause = updates.map((u, i) => `${u.col} = $${i + 2}`).join(', ');
          const values = [dealId, ...updates.map(u => u.val)];
          await pool.query(
            `UPDATE deal_assumptions SET ${setClause}, updated_at = NOW() WHERE deal_id = $1`,
            values
          );
          logger.info(
            `[Batch4/5-Sync] Wrote ${updates.length} computed field(s) to deal_assumptions for ${dealId}: ` +
            updates.map(u => `${u.col}=${typeof u.val === 'number' ? u.val.toFixed(4) : u.val}`).join(', ')
          );
        }

        // Also write to the active scenario's year1 so the trigger keeps
        // deal_assumptions.year1 in sync.  We merge agent sub-keys into the
        // existing year1 JSON, preserving all other fields (user overrides,
        // extraction layers, etc.).
        const activeScen = await pool.query(
          `SELECT id, year1 FROM deal_underwriting_scenarios
           WHERE deal_id = $1 AND is_active = TRUE AND deleted_at IS NULL LIMIT 1`,
          [dealId]
        );
        if (activeScen.rows.length > 0) {
          const scenId = activeScen.rows[0].id;
          const scenYear1 = typeof activeScen.rows[0].year1 === 'string'
            ? JSON.parse(activeScen.rows[0].year1)
            : (activeScen.rows[0].year1 ?? {});

          const modelFields: Record<string, number> = {};
          if (computedRentGrowth && computedRentGrowth.length > 0) {
            modelFields.rent_growth_yr1 = computedRentGrowth[0];
            modelFields.rent_growth_stabilized = computedRentGrowth[computedRentGrowth.length - 1];
          }
          if (computedExitCap != null && computedExitCap > 0) modelFields.exit_cap = computedExitCap;
          if (computedHoldPeriod != null && computedHoldPeriod > 0) modelFields.hold_period_years = computedHoldPeriod;
          if (computedSellingCosts != null && computedSellingCosts >= 0) modelFields.selling_costs_pct = computedSellingCosts;

          for (const [key, val] of Object.entries(modelFields)) {
            const existing = scenYear1[key] ?? {};
            const hasOverride = existing.override != null && typeof existing.override === 'number' && isFinite(existing.override);
            scenYear1[key] = {
              ...existing,
              agent: val,
              resolved: hasOverride ? existing.override : val,
              resolution: hasOverride ? 'override' : 'agent:financial_model',
              updated_at: new Date().toISOString(),
            };
          }

          await pool.query(
            `UPDATE deal_underwriting_scenarios
             SET year1 = $1::jsonb, updated_at = NOW()
             WHERE id = $2`,
            [JSON.stringify(scenYear1), scenId]
          );
          // Trigger trg_sync_underwriting_scenario fires here and syncs
          // year1 to deal_assumptions.year1 automatically.
          logger.info(
            `[Batch4/5-Sync] Wrote ${Object.keys(modelFields).length} computed field(s) to active scenario ${scenId} for ${dealId}`
          );
        }
      } catch (syncErr: any) {
        logger.warn(`[Batch4/5-Sync] Failed to sync computed values to deal_assumptions for ${dealId}: ${syncErr.message}`);
      }

      return { result, assumptionsHash };
    } catch (error: any) {
      // Only update status to error if we haven't already done so above
      if (!error.message?.startsWith('F9 integrity checks failed')) {
        await pool.query(
          `UPDATE deal_financial_models SET status = 'error', error_message = $1, updated_at = NOW() WHERE id = $2`,
          [error.message, modelId]
        );
      }
      throw error;
    }
  }

  async getLatestModel(
    dealId: string,
    currentHash?: string,
  ): Promise<{ assumptions: ProFormaAssumptions; results: FinancialModelResult; createdAt: string; assumptionsHash?: string; stale?: boolean } | null> {
    const pool = getPool();
    const result = await pool.query(
      `SELECT assumptions, results, created_at, assumptions_hash FROM deal_financial_models
       WHERE deal_id = $1 AND status = 'complete' ORDER BY created_at DESC LIMIT 1`,
      [dealId]
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    const storedHash: string | null = row.assumptions_hash ?? null;
    // Return explicit boolean so the frontend always gets a defined signal when
    // a currentHash is provided; undefined only when no comparison was requested.
    const stale = currentHash != null && storedHash != null
      ? currentHash !== storedHash
      : currentHash != null ? true : undefined;
    return {
      assumptions: typeof row.assumptions === 'string' ? JSON.parse(row.assumptions) : row.assumptions,
      results: typeof row.results === 'string' ? JSON.parse(row.results) : row.results,
      createdAt: row.created_at,
      assumptionsHash: storedHash ?? undefined,
      stale,
    };
  }

  async getUpstreamModuleInputs(dealId: string): Promise<FinancialModuleInputs> {
    return getFinancialInputsFromModules(dealId);
  }

  publishResultsToDataFlow(dealId: string, result: FinancialModelResult): void {
    dataFlowRouter.publishModuleData('M09', dealId, {
      noi: result.summary.noiYear1,
      irr: result.summary.irr,
      coc_return: result.summary.cashOnCash?.[0] ?? null,
      cash_flow_projections: result.annualCashFlow,
      equity_multiple: result.summary.equityMultiple,
      cap_rate: result.summary.purchaseCapRate,
    });
    logger.info('Financial model results published to data flow router', { dealId });
  }
}

export const financialModelEngine = new FinancialModelEngineService();

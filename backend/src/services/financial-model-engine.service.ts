import axios from 'axios';
import { createHash } from 'crypto';
import { getPool } from '../database/connection';
import { getFinancialInputsFromModules, FinancialModuleInputs } from './module-wiring/data-flow-router';
import { dataFlowRouter } from './module-wiring/data-flow-router';
import { logger } from '../utils/logger';
import { applyFullAnchorInterceptor, normalizeExpensesForInterceptor, rekeyExpensesFromInterceptor } from './sigma/anchor-interceptor.service';
import OpenAI from 'openai';
import { mapProFormaAssumptionsToModelAssumptions, crossCheckLLMVsDeterministic, buildEvidenceHintsFromSeed } from './deterministic/proforma-assumptions-bridge';
import { runModel, runIntegrityChecks } from './deterministic/deterministic-model-runner';
import { runM11Cycle, applyM14RiskAdjustments } from './module-wiring/capital-structure-adapter';
import type { ProFormaYear1Seed } from './document-extraction/types';

/**
 * selectLLMClient — provider-selection strategy for the financial-model build path.
 *
 * Priority order mirrors the project-wide getLLMProvider() convention in
 * llm.service.ts, but explicitly prefers DeepSeek first because the financial
 * model build prompt is an analytical JSON workload where DeepSeek performs
 * well and is cost-efficient.
 *
 *  1. DeepSeek via DEEPSEEK_API_KEY
 *  2. OpenAI-compatible integration via AI_INTEGRATIONS_OPENAI_API_KEY (Replit connector)
 *  3. Plain OpenAI via OPENAI_API_KEY (fallback — uses gpt-4o)
 *
 * Returns { client, model, providerName } so callLLMForModel can log which
 * provider was selected.
 */
function selectLLMClient(): { client: OpenAI; model: string; providerName: string } {
  if (process.env.DEEPSEEK_API_KEY) {
    return {
      client: new OpenAI({
        apiKey: process.env.DEEPSEEK_API_KEY,
        baseURL: (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '') + '/v1',
      }),
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      providerName: 'deepseek',
    };
  }

  if (process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    const customBase = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
    // When a custom base URL is provided (e.g. a DeepSeek-compatible endpoint),
    // honour the DEEPSEEK_MODEL env-var.  When no custom URL is set the key
    // belongs to OpenAI's own endpoint, so use gpt-4o to avoid sending
    // 'deepseek-chat' to a host that doesn't know that model name.
    const model = customBase
      ? (process.env.DEEPSEEK_MODEL || 'deepseek-chat')
      : 'gpt-4o';
    return {
      client: new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: customBase || 'https://api.openai.com/v1',
      }),
      model,
      providerName: customBase ? 'ai-integrations-deepseek-compat' : 'ai-integrations-openai',
    };
  }

  if (process.env.OPENAI_API_KEY) {
    return {
      client: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
      model: 'gpt-4o',
      providerName: 'openai',
    };
  }

  throw new Error(
    'No LLM provider configured for financial-model build. ' +
    'Set DEEPSEEK_API_KEY, AI_INTEGRATIONS_OPENAI_API_KEY, or OPENAI_API_KEY.'
  );
}

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
  async buildModel(dealId: string, assumptions: ProFormaAssumptions): Promise<{ result: FinancialModelResult; assumptionsHash: string }> {
    const pool = getPool();

    // Snapshot the hash BEFORE any mutation (fill-in pass, M26/M27 enhancement).
    // This is the canonical value stored in `assumptions_hash` and echoed in the
    // build response so the routes layer never needs to recompute independently.
    const assumptionsHash = hashAssumptions(assumptions as object);

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
      const result = await this.callLLMForModel(enhancedAssumptions as any);

      // ── Phase 5: Server-side integrity verification (F9 wiring spec W1/W2) ──
      // Translate the ProFormaAssumptions envelope to the deterministic runner's
      // flat ModelAssumptions struct, run the full deterministic model, then
      // execute all hard invariant checks.  Any INV-X failure halts the build
      // and writes status='error' before we touch the DB with 'complete'.
      let verificationPassed = true;
      let verificationDiagnostics = '';
      try {
        const modelAssumptions = mapProFormaAssumptionsToModelAssumptions(enhancedAssumptions as ProFormaAssumptions);

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
        const checks = runIntegrityChecks(modelAssumptions, deterministicResult);
        // Only INV-* checks are hard invariants that halt the build.
        // SOFT checks (e.g. DSCR_BREACH) may have status='error' but are advisory only.
        const hardFailures = checks.filter(c => c.status === 'error' && c.id.startsWith('INV-'));

        // Cross-check LLM output KPIs against deterministic output for the same inputs
        const divergences = crossCheckLLMVsDeterministic(result, deterministicResult);
        const materialDivergences = divergences.filter(d => d.material);
        if (materialDivergences.length > 0) {
          logger.warn(
            `[F9-Verifier] LLM↔deterministic KPI divergences for ${dealId} (${materialDivergences.length} material):` +
            materialDivergences.map(d =>
              ` ${d.field}: LLM=${d.llmValue?.toFixed ? d.llmValue.toFixed(4) : d.llmValue}` +
              ` det=${d.deterministicValue?.toFixed ? d.deterministicValue.toFixed(4) : d.deterministicValue}` +
              ` (${d.deltaPct !== null ? (d.deltaPct * 100).toFixed(1) + '%' : 'abs=' + d.deltaAbsolute.toFixed(0)})`
            ).join(';')
          );
        }

        if (hardFailures.length > 0) {
          verificationPassed = false;
          verificationDiagnostics = hardFailures
            .map(c => `${c.id}: ${c.message}`)
            .join('; ');
          logger.error(
            `[F9-Verifier] Hard invariant failures for ${dealId}: ${verificationDiagnostics}`
          );
        } else {
          const cd = deterministicResult.evidence?.confidence_distribution;
          const cdSummary = cd
            ? `evidence confidence: H=${cd.high} M=${cd.medium} L=${cd.low}`
            : 'evidence: n/a';
          logger.info(
            `[F9-Verifier] All invariants pass for ${dealId}` +
            ` (${checks.filter(c => c.status === 'warn').length} warnings,` +
            ` ${materialDivergences.length} material LLM↔det divergences, ${cdSummary})`
          );
          // Inject deterministic evidence, reasoning, and integrity signals into LLM
          // result before persist. These fields come exclusively from the deterministic
          // runner and cannot be hallucinated by the LLM.
          result.evidence = deterministicResult.evidence;
          result.reasoning = {
            walkthrough: deterministicResult.reasoning.walkthrough,
            collisionReport: deterministicResult.reasoning.collisionReport,
          };
          // Merge deterministic integrity checks (including LOW_CONFIDENCE_MODEL warn)
          // into the persisted result so the full signal set is available to consumers.
          const existingChecks = Array.isArray(result.integrityChecks) ? result.integrityChecks : [];
          result.integrityChecks = [...existingChecks, ...deterministicResult.integrityChecks];

          // ── M11 Debt Optimizer Cycle ──────────────────────────────────────
          let adjustedAssumptions = modelAssumptions;
          let m11Converged = false;
          let m11Iterations = 0;
          try {
            const m11 = runM11Cycle(adjustedAssumptions);
            adjustedAssumptions = m11.assumptions;
            m11Converged = m11.converged;
            m11Iterations = m11.iterations;
            if (!m11Converged) {
              result.integrityChecks = [
                ...(result.integrityChecks ?? []),
                { id: 'capital_stack_unconverged', status: 'warn' as const, message: `M11 debt optimizer did not converge after ${m11Iterations} iterations` },
              ];
            }
            logger.info(`[M11] Cycle done for ${dealId}: iterations=${m11Iterations} converged=${m11Converged}`);
          } catch (m11Err: any) {
            logger.warn(`[M11] Cycle skipped for ${dealId}: ${m11Err?.message}`);
          }

          // ── M14 Risk Dashboard Cycle ──────────────────────────────────────
          let m14Applied = false;
          let m14CapRateAdjBps = 0;
          try {
            const m14 = await applyM14RiskAdjustments(dealId, adjustedAssumptions);
            adjustedAssumptions = m14.assumptions;
            m14Applied = m14.applied;
            m14CapRateAdjBps = m14.capRateAdjBps;
            if (m14Applied) {
              logger.info(`[M14] Risk adjustments applied for ${dealId}: capRateAdjBps=${m14CapRateAdjBps}`);
            }
          } catch (m14Err: any) {
            logger.warn(`[M14] Adjustment skipped for ${dealId}: ${m14Err?.message}`);
          }

          // Re-run deterministic model with M11/M14-adjusted assumptions and
          // overwrite evidence + reasoning so persisted result reflects the cycle.
          try {
            const adjustedDet = runModel(adjustedAssumptions, { skipSensitivity: true });
            result.evidence = adjustedDet.evidence;
            result.reasoning = {
              walkthrough: adjustedDet.reasoning.walkthrough,
              collisionReport: adjustedDet.reasoning.collisionReport,
            };
          } catch (reRunErr: any) {
            logger.warn(`[M11/M14] Post-cycle re-run skipped for ${dealId}: ${reRunErr?.message}`);
          }

          result.meta = { m11Converged, m11Iterations, m14Applied, m14CapRateAdjBps };
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

  private async callLLMForModel(assumptions: ProFormaAssumptions): Promise<FinancialModelResult> {
    const { client, model, providerName } = selectLLMClient();
    logger.info(`[Financial-Model] Using provider=${providerName} model=${model} for deal build`);

    const systemPrompt = this.buildSystemPrompt(assumptions.modelType);
    const userPrompt = this.buildUserPrompt(assumptions);

    const response = await client.chat.completions.create({
      model,
      max_tokens: 16000,
      temperature: 0.1,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    const text = response.choices?.[0]?.message?.content || '';

    let parsed: FinancialModelResult;
    try {
      parsed = JSON.parse(text);
    } catch {
      const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      const rawJson = codeBlockMatch ? codeBlockMatch[1].trim() : text.trim();

      let depth = 0;
      let start = -1;
      let end = -1;
      for (let i = 0; i < rawJson.length; i++) {
        if (rawJson[i] === '{') {
          if (depth === 0) start = i;
          depth++;
        } else if (rawJson[i] === '}') {
          depth--;
          if (depth === 0) { end = i + 1; break; }
        }
      }

      if (start === -1 || end === -1) {
        throw new Error('LLM did not return valid JSON. Response starts with: ' + text.substring(0, 200));
      }

      try {
        parsed = JSON.parse(rawJson.substring(start, end));
      } catch (parseErr: any) {
        throw new Error('Failed to parse LLM response as JSON: ' + parseErr.message);
      }
    }

    if (!parsed.summary || !parsed.annualCashFlow) {
      throw new Error('LLM response missing required fields (summary, annualCashFlow)');
    }

    return parsed;
  }

  private buildSystemPrompt(modelType: string): string {
    return `You are an expert real estate financial analyst who builds institutional-grade financial models for multifamily real estate investments. You produce precise, detailed financial projections.

You will receive a set of Pro Forma assumptions for a ${modelType === 'development' ? 'ground-up development' : 'stabilized existing asset acquisition'} deal. Your job is to build a complete financial model and return the results as structured JSON.

CRITICAL RULES:
1. All dollar amounts should be rounded to the nearest dollar (no cents).
2. All percentages should be expressed as decimals (0.05 = 5%).
3. Use monthly compounding for interest calculations.
4. Rent growth is applied at the beginning of each operating year.
5. Operating expenses grow at their specified rate (default 3% if not specified).
6. Management fee is calculated as a percentage of Effective Gross Revenue.
7. Replacement reserves grow at inflation rate.
8. IRR should be calculated using the standard XIRR methodology on equity cash flows.
9. DSCR = NOI / Annual Debt Service.
10. Debt Yield = NOI / Loan Amount.
11. For the sensitivity analysis, vary exit cap rate by -50bps, -25bps, 0, +25bps, +50bps and hold period by the given period and ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â±1 year.
12. For rent growth sensitivity, vary by -1%, -0.5%, 0, +0.5%, +1%.
${modelType === 'development' ? `
13. Construction costs are drawn monthly over the construction period.
14. Lease-up begins after construction completion at the specified velocity (units/month).
15. Operating income during lease-up is proportional to occupied units.
16. Construction loan interest accrues on drawn balance.
` : ''}

Return ONLY valid JSON matching the FinancialModelResult schema. No explanation, no markdown.`;
  }

  private buildUserPrompt(a: ProFormaAssumptions): string {
    const totalUnits = a.dealInfo.totalUnits;
    const avgRent = a.unitMix.length > 0
      ? a.unitMix.reduce((sum, u) => sum + u.marketRent * u.units, 0) / totalUnits
      : 1500;
    const totalSF = a.dealInfo.netRentableSF || a.unitMix.reduce((sum, u) => sum + u.unitSize * u.units, 0);

    const expenseLines = Object.entries(a.expenses).map(([name, e]) =>
      `  - ${name}: $${e.amount}/year, type: ${e.type}, growth: ${(e.growthRate * 100).toFixed(1)}%`
    ).join('\n');

    const otherIncomeLines = Object.entries(a.revenue.otherIncome || {}).map(([name, oi]) =>
      `  - ${name}: $${oi.perUnitMonth}/unit/month, penetration: ${(oi.penetration * 100).toFixed(0)}%`
    ).join('\n');

    const capexLines = (a.capex.lineItems || []).map(item =>
      `  - ${item.description}: $${item.amount}`
    ).join('\n');

    const waterfallLines = (a.waterfall.hurdles || []).map((h, i) =>
      `  Tier ${i + 1}: ${(h.hurdleRate * 100).toFixed(1)}% hurdle, GP promote ${(h.promoteToGP * 100).toFixed(0)}%, LP split ${(h.lpSplit * 100).toFixed(0)}%`
    ).join('\n');

    let prompt = `Build a complete financial model for this ${a.modelType === 'development' ? 'development' : 'existing asset'} deal:

DEAL INFO:
- Name: ${a.dealInfo.dealName}
- Location: ${a.dealInfo.city}, ${a.dealInfo.state}
- Total Units: ${totalUnits}
- Net Rentable SF: ${totalSF}
- Year Built: ${a.dealInfo.vintage}
- Hold Period: ${a.holdPeriod} years

UNIT MIX:
${a.unitMix.map(u => `- ${u.floorPlan}: ${u.units} units, ${u.unitSize} SF, ${u.beds} bed, Market Rent: $${u.marketRent}/mo, In-Place: $${u.inPlaceRent}/mo, Occupied: ${u.occupied}/${u.units}`).join('\n')}

Average Market Rent: $${avgRent.toFixed(0)}/unit/mo ($${(avgRent / (totalSF / totalUnits)).toFixed(2)}/SF)

ACQUISITION:
- Purchase Price: $${a.acquisition.purchasePrice}
- Going-In Cap Rate: ${(a.acquisition.capRate * 100).toFixed(2)}%
- Closing Costs: ${JSON.stringify(a.acquisition.closingCosts)}

DISPOSITION:
- Exit Cap Rate: ${(a.disposition.exitCapRate * 100).toFixed(2)}%
- Selling Costs: ${(a.disposition.sellingCosts * 100).toFixed(2)}% of sale price
- Sale NOI Method: ${a.disposition.saleNOIMethod}

REVENUE ASSUMPTIONS:
- Annual Rent Growth: ${a.revenue.rentGrowth.map(r => (r * 100).toFixed(1) + '%').join(', ')}
- Loss-to-Lease: ${(a.revenue.lossToLease * 100).toFixed(1)}%
- Stabilized Occupancy: ${(a.revenue.stabilizedOccupancy * 100).toFixed(1)}%
- Collection Loss: ${(a.revenue.collectionLoss * 100).toFixed(2)}%
- Other Income:
${otherIncomeLines || '  (none)'}

OPERATING EXPENSES:
${expenseLines || '  (none)'}

FINANCING:
- Loan Amount: $${a.financing.loanAmount}
- Type: ${a.financing.loanType}
- Interest Rate: ${(a.financing.interestRate * 100).toFixed(2)}%
- Spread: ${(a.financing.spread * 100).toFixed(2)}%
- Term: ${a.financing.term} years
- Amortization: ${a.financing.amortization} years
- IO Period: ${a.financing.ioPeriod} months
- Origination Fee: ${(a.financing.originationFee * 100).toFixed(2)}%
- Rate Cap Cost: $${a.financing.rateCapCost}
- Prepayment Penalty: ${(a.financing.prepayPenalty * 100).toFixed(2)}%

CAPITAL EXPENDITURES:
${capexLines || '  (none)'}
- Contingency: ${(a.capex.contingencyPct * 100).toFixed(0)}%
- Replacement Reserves: $${a.capex.reservesPerUnit}/unit/year

WATERFALL:
- Total Equity: $${a.waterfall.equityContribution}
- LP/GP Split: ${(a.waterfall.lpShare * 100).toFixed(0)}/${(a.waterfall.gpShare * 100).toFixed(0)}
${waterfallLines || '  No promote structure'}`;

    if (a.modelType === 'development' && a.development) {
      prompt += `

DEVELOPMENT SPECIFIC:
- Land Cost: $${a.development.landCost}
- Hard Cost: $${a.development.hardCostPerSF}/SF
- Hard Cost Contingency: ${(a.development.hardCostContingency * 100).toFixed(0)}%
- Soft Cost: ${(a.development.softCostPct * 100).toFixed(1)}% of hard cost
- Developer Fee: ${(a.development.developerFee * 100).toFixed(1)}% of cost
- Construction Period: ${a.development.constructionPeriod} months
- Lease-Up Velocity: ${a.development.leaseUpVelocity} units/month
- Construction Loan LTC: ${(a.development.constructionLoanLTC * 100).toFixed(0)}%
- Construction Loan Rate: ${(a.development.constructionLoanRate * 100).toFixed(2)}%`;
    }

    prompt += `

Now build the complete model and return the FinancialModelResult JSON with:
1. summary (IRR, equity multiple, CoC by year, NOI, cap rates, exit value, debt metrics)
2. annualCashFlow (one object per year with full income statement lines)
3. sourcesAndUses
4. debtMetrics
5. sensitivityAnalysis (exitCapVsHoldPeriod grid, rentGrowthVsHoldPeriod grid)
6. waterfallDistributions (by year)
${a.modelType === 'development' ? '7. developmentSchedule (monthly during construction + lease-up)' : ''}

Return ONLY valid JSON. No markdown, no explanation.`;

    return prompt;
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

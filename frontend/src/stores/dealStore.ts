// ============================================================================
// JEDI RE — dealStore: Zustand Store with Development Path Cascade
// ============================================================================
//
// This is the SINGLE SOURCE OF TRUTH for all deal data.
// Every module imports { useDealStore } and reads from it.
// No module maintains its own copy of deal data.
//
// KEYSTONE CASCADE:
// selectDevelopmentPath(pathId) → resolvedUnitMix updates →
// financial outputs recompute → strategy scores update → JEDI score updates
//
// HYDRATION:
// On deal load, fetchDealContext(dealId) calls the backend once.
// Individual modules can request fresh data via refreshSection(section).
// ============================================================================

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { useMemo } from 'react';
import { apiClient } from '../services/api.client';
import {
  DealContext,
  DealMode,
  DealStage,
  DevelopmentPath,
  UnitMixRow,
  LayeredValue,
  DataSource,
  StrategyType,
  EditLogEntry,
  getSelectedPath,
  resolveUnitMix,
  layered,
  computeAlertLevel,
  getFieldMeta,
  INPUT_FIELD_REGISTRY,
} from './dealContext.types';
import {
  getDealType,
  getDealTypeConfig,
  type DealType,
} from '@/shared/config/deal-type-visibility';
import { resolveProjectType } from '@/shared/utils/project-type';
import {
  getStrategyAvailability,
  getStrategyStrength,
  type ProductType,
} from '../shared/config/product-type-adaptation';
import {
  classifyOverride as f9ClassifyOverride,
  validateGordonGrowth as f9ValidateGordon,
  noiGrowthIdentity as f9NoiGrowthIdentity,
} from '../services/proforma/validators';
import type {
  ConfidenceBands,
  ValidationFlag,
  GordonValidationResult,
  OverrideClassificationResult,
} from '../services/proforma/types';

// ---------------------------------------------------------------------------
// Store actions interface
// ---------------------------------------------------------------------------

// ─── M08 Strategy Score types ─────────────────────────────────────────────

export interface M08StrategyScore {
  strategy_id: string;
  strategy_name: string;
  strategy_type?: 'rental' | 'bts' | 'flip' | 'str' | string;
  overall_score: number;
  sub_scores: Record<string, number>;
  signal_weights?: Record<string, number>;
  gate_result: 'PASS' | 'FAIL' | 'N/A';
  gate_failures: string[];
  soft_penalty: number;
  confidence: number;
  is_system_template?: boolean;
  sort_order?: number;
  roi_estimate?: {
    irr?: number;
    yoc?: number;
    profit_margin?: number;
    rev_par?: number;
  };
}

export interface M08ArbitrageResult {
  winning_strategy_id: string | null;
  winning_strategy_name: string | null;
  runner_up_strategy_id: string | null;
  runner_up_strategy_name: string | null;
  winning_score: number;
  runner_up_score: number;
  delta: number;
  arbitrage_detected: boolean;
}

// ─── M08 v2 Strategy Analysis slice ──────────────────────────────────────────
// Re-exported from hook types; duplicated here to avoid circular deps.
export interface StrategyAnalysisV2Slice {
  strategyAnalysisV2: import('../hooks/useStrategyAnalysisV2').StrategyAnalysisV2 | null;
  strategyAnalysisV2Loading: boolean;
  strategyAnalysisV2Recalculating: boolean;
  strategyAnalysisV2Error: string | null;
  fetchStrategyAnalysisV2: (dealId: string) => Promise<void>;
  triggerStrategyAnalysisV2Recalc: (dealId: string) => Promise<void>;
  confirmStrategyDetection: (dealId: string, confirmed: boolean) => Promise<void>;
  overrideStrategyClassification: (dealId: string, assetClass: string) => Promise<void>;
  /** Refines sub-strategy within detected asset class without changing the asset class itself */
  adjustStrategySubStrategy: (dealId: string, subStrategyKey: string) => Promise<void>;
  setStrategyAnalysisV2: (data: import('../hooks/useStrategyAnalysisV2').StrategyAnalysisV2 | null) => void;
}

// ─── F9 Y1 SOURCE PICKER ────────────────────────────────────────────────────
/** Which document source the F9 Y1 column is anchored to. Shared across Assumptions / Pro Forma / Projections tabs. */
export type Y1Source = 'BROKER' | 'T12' | 'T6' | 'T3' | 'T1' | 'PLATFORM';

/** Which source is displayed in the Platform comparison column of the Pro Forma operating statement. */
export type PlatformColSource = 'PLATFORM' | 'T12' | 'T6' | 'T3' | 'T1';

interface DealStoreActions {
  // ─── DEAL LIST (Dashboard) ────────────────────────────────
  deals: any[];
  isLoading: boolean;
  error: string | null;
  fetchDeals: () => Promise<void>;

  // ─── M08 v1 STRATEGY ARBITRAGE ───────────────────────────────
  strategyScores: M08StrategyScore[];
  arbitrageResult: M08ArbitrageResult | null;
  strategyScoresLoading: boolean;
  fetchStrategyScores: (dealId: string) => Promise<void>;
  recalculateStrategyScores: (dealId: string) => Promise<void>;
  fetchArbitrage: (dealId: string) => Promise<void>;

  // ─── M08 v2 DETECTION-FIRST STRATEGY ANALYSIS ────────────
  strategyAnalysisV2: import('../hooks/useStrategyAnalysisV2').StrategyAnalysisV2 | null;
  strategyAnalysisV2Loading: boolean;
  strategyAnalysisV2Recalculating: boolean;
  strategyAnalysisV2Error: string | null;
  fetchStrategyAnalysisV2: (dealId: string) => Promise<void>;
  triggerStrategyAnalysisV2Recalc: (dealId: string) => Promise<void>;
  confirmStrategyDetection: (dealId: string, confirmed: boolean) => Promise<void>;
  overrideStrategyClassification: (dealId: string, assetClass: string) => Promise<void>;
  /** Refines sub-strategy within detected asset class without changing the asset class itself */
  adjustStrategySubStrategy: (dealId: string, subStrategyKey: string) => Promise<void>;
  setStrategyAnalysisV2: (data: import('../hooks/useStrategyAnalysisV2').StrategyAnalysisV2 | null) => void;

  // ─── LIFECYCLE ────────────────────────────────────────────
  /** Create a new deal */
  createDeal: (payload: any) => Promise<any>;
  /** Hydrate entire deal context from backend */
  fetchDealContext: (dealId: string) => Promise<void>;
  /** Clear store (on navigate away from deal) */
  clearDeal: () => void;

  // ─── DEVELOPMENT ENVELOPE (from Dev Capacity) ─────────────
  /** Write zoning constraints from selected development path */
  setDevelopmentEnvelope: (envelope: {
    max_units: number;
    max_gfa: number;
    max_stories: number;
    units_per_floor: number;
    binding_constraint: string;
    selected_path: string;
    parking: { type: string; spaces: number; cost_per_space: number };
    buildable_area_sf: number;
    impact_fee_credit_units: number;
  } | null) => void;

  // ─── UNIT MIX PROPAGATION (Phase 11) ──────────────────────
  /**
   * Apply unit mix to all modules (Financial Model, 3D Design, etc.)
   * Called when:
   * - Development path selected
   * - Unit Mix Intelligence runs
   * - User manually sets unit mix
   */
  applyUnitMixToAllModules: () => Promise<{ success: boolean; modulesUpdated: string[] }>;
  
  /**
   * Set manual unit mix override and propagate
   */
  setManualUnitMix: (unitMix: {
    studio?: { count: number; avgSF?: number };
    oneBR?: { count: number; avgSF?: number };
    twoBR?: { count: number; avgSF?: number };
    threeBR?: { count: number; avgSF?: number };
  }) => Promise<{ success: boolean }>;
  
  /**
   * Get current unit mix status
   */
  getUnitMixStatus: () => Promise<{
    hasUnitMix: boolean;
    source: string | null;
    appliedAt: string | null;
  }>;

  // ─── THE KEYSTONE: DEVELOPMENT PATH SELECTION ─────────────
  /**
   * Select a development path. This is the most important action in the store.
   *
   * Cascade:
   *   1. Sets selectedDevelopmentPathId
   *   2. Propagates unit mix to all modules automatically
   *   2. Recomputes resolvedUnitMix from new path's program + existing overrides
   *   3. Recomputes totalUnits
   *   4. Marks financial/strategy/scores as stale (triggers recomputation)
   *   5. Optionally triggers backend recomputation of downstream modules
   *
   * Every module subscribed to resolvedUnitMix, totalUnits, financial,
   * strategy, or scores will re-render automatically.
   */
  selectDevelopmentPath: (pathId: string) => void;

  /** Add a new development path (from M03 massing AI or user) */
  addDevelopmentPath: (path: DevelopmentPath) => void;

  /** Remove a development path */
  removeDevelopmentPath: (pathId: string) => void;

  /** Update an existing development path (e.g., M03 refines massing) */
  updateDevelopmentPath: (pathId: string, updates: Partial<DevelopmentPath>) => void;

  // ─── UNIT MIX OVERRIDES (from M-PIE) ─────────────────────
  /**
   * Override a specific unit mix row. Applied on top of the base program
   * from the selected development path (or existing property).
   *
   * Use case: User edits rent or count in M-PIE → all modules see the change.
   */
  overrideUnitMix: (
    rowId: string,
    overrides: Partial<Pick<UnitMixRow, 'count' | 'avgSF' | 'targetRent'>>
  ) => void;

  /** Reset all user overrides (revert to base program) */
  clearUnitMixOverrides: () => void;

  /** Replace the entire unit mix program for existing deals */
  setExistingUnitMix: (program: UnitMixRow[]) => void;

  // ─── ASSUMPTION EDITING (Task #153 Keystone Cascade) ──────
  updateAssumption: (path: string, value: number) => void;
  revertAssumption: (path: string) => void;
  revertAllAssumptions: () => void;
  toggleVarianceAssumed: (enabled: boolean) => void;
  _triggerAssumptionCascade: () => void;
  assumptionCascadeStatus: 'idle' | 'pending' | 'computing' | 'error';

  // ─── GENERIC LAYERED VALUE UPDATES ────────────────────────
  updateLayeredValue: <T>(
    path: string,
    value: T,
    source: DataSource,
    confidence?: number
  ) => void;

  // ─── SECTION-LEVEL UPDATES ────────────────────────────────
  /** Update market context (from M05 / market agent) */
  updateMarket: (updates: Partial<DealContext['market']>) => void;
  /** Update supply context (from M04 / supply agent) */
  updateSupply: (updates: Partial<DealContext['supply']>) => void;
  /** Update financial assumptions or outputs */
  updateFinancial: (updates: Partial<DealContext['financial']>) => void;
  /** Update capital structure */
  updateCapital: (updates: Partial<DealContext['capital']>) => void;
  /** Update strategy scores (from M08 recomputation) */
  updateStrategy: (updates: Partial<DealContext['strategy']>) => void;
  /** Update JEDI score */
  updateScores: (updates: Partial<DealContext['scores']>) => void;
  /** Update risk assessment */
  updateRisk: (updates: Partial<DealContext['risk']>) => void;
  /** Update zoning context */
  updateZoning: (updates: Partial<DealContext['zoning']>) => void;
  /**
   * Write the canonical ZoningOutput produced by the Zoning Agent.
   * Called once agent analysis completes; all downstream modules read from here.
   */
  updateZoningOutput: (output: DealContext['zoningOutput']) => void;

  // ─── CORPORATE HEALTH (M33) ──────────────────────────────
  corporateHealth: {
    schi: number | null;
    divergence: number | null;
    signal: string | null;
    reHealth: number | null;
    herfindahl: number | null;
    minChs: number | null;
    topEmployerShare: number | null;
    loading: boolean;
  };
  fetchCorporateHealth: (dealId: string) => Promise<void>;
  fetchSubmarketHealth: (submarketId: number) => Promise<void>;

  // ─── DEAL STAGE ───────────────────────────────────────────
  /** Advance deal to next stage */
  setStage: (stage: DealStage) => void;

  // ─── FIELD REVIEW & IDENTITY GATE ────────────────────────
  markFieldReviewed: (path: string) => void;
  isIdentityComplete: () => boolean;
  hasBlockingAlerts: () => boolean;

  // ─── COMPUTED SELECTORS ───────────────────────────────────
  /** Get the currently selected development path object */
  getSelectedPath: () => DevelopmentPath | null;
  /** Check if deal is in development mode */
  isDevelopment: () => boolean;
  /** Get the base unit mix (before user overrides) */
  getBaseUnitMix: () => UnitMixRow[];

  // ─── F9 PRO FORMA TIER-1 PROTECTORS (spec §6-§9) ──────────
  /** Per-field confidence bands keyed by field path (e.g. 'rentGrowthStabilized'). */
  confidenceBands: Record<string, ConfidenceBands>;
  /** Active validator flags surfaced in F9. */
  validationFlags: ValidationFlag[];
  /**
   * Per-row refusal reasons keyed by field key (e.g. 'gpr', 'realEstateTax').
   * When non-null the platform is deliberately not forecasting that field
   * because evaluateRefusal() concluded it lacks the comp/history/asset-class
   * support to do so honestly (spec §9 refusal threshold).
   */
  refusalReasons: Record<string, string | null>;
  /** Bulk-set refusal reasons (typically from the AssumptionsTab refusal effect). */
  setRefusalReasons: (reasons: Record<string, string | null>) => void;
  /** Bulk-set bands at proforma generation time (typically from server). */
  setConfidenceBands: (bands: Record<string, ConfidenceBands>) => void;
  /** Replace the active validation flag list (e.g. after a recompute). */
  setValidationFlags: (flags: ValidationFlag[]) => void;
  /** Add or update a single flag (deduped by id). */
  upsertValidationFlag: (flag: ValidationFlag) => void;
  /** Drop a flag by id. */
  removeValidationFlag: (id: string) => void;
  /** Mark a flag as user-acknowledged with an optional justification note. */
  dismissValidationFlag: (id: string, justification?: string) => void;
  /** Run Gordon Growth validator and emit / clear the corresponding flag. */
  runGordonValidation: (input: {
    exitCap: number | null;
    terminalGrowth: number | null;
    requiredReturn: number | null;
  }) => GordonValidationResult;
  /** Classify a user override against the stored confidence band for that field. */
  classifyFieldOverride: (
    field: string,
    value: number,
  ) => OverrideClassificationResult | null;
  /** Compute NOI growth identity: (rent − opex×(1−margin)) / margin. */
  computeNoiGrowthIdentity: (
    rentGrowth: number | null,
    opexGrowth: number | null,
    noiMargin: number,
  ) => number | null;

  // ─── F9 Y1 SOURCE PICKER ────────────────────────────────────────────────────
  /** Document source the Y1 column in F9 tabs is anchored to. Default: 'PLATFORM'. */
  y1Source: Y1Source;
  setY1Source: (source: Y1Source) => void;

  // ─── F9 PLATFORM COLUMN SOURCE PICKER ───────────────────────────────────────
  /** Which source is shown in the Platform comparison column. Default: 'PLATFORM'. */
  platformColSource: PlatformColSource;
  setPlatformColSource: (source: PlatformColSource) => void;

  // ─── F9 VIEW MODE ────────────────────────────────────────────────────────────
  /** Pro Forma view mode — BROKER_VIEW shows OM numbers, BUILD_OWN shows platform underwriting. Shared across Pro Forma / Assumptions tabs. */
  viewMode: 'BROKER_VIEW' | 'BUILD_OWN';
  setViewMode: (mode: 'BROKER_VIEW' | 'BUILD_OWN') => void;

  // ─── LEASE VELOCITY — EVENT BUS ─────────────────────────────────────────────
  /**
   * Dispatch `lease_velocity.output.updated` on the shared window event bus.
   * Call this after a successful POST /api/v1/lease-velocity/run so that
   * downstream F9 consumers (S&U reserve, Returns IRR, JEDI Position sub-score)
   * re-fetch /financials with the latest LV output.
   */
  emitLeaseVelocityUpdated: () => void;
  /**
   * Dispatch `leasing_cost_treatment.changed` on the shared window event bus.
   * Call this whenever the top-bar cost-treatment toggle changes so that
   * all F9 consumers re-fetch /financials with the new treatment parameter.
   */
  emitLeasingCostTreatmentChanged: (treatment: string) => void;

  // ─── OPERATOR STANCE ──────────────────────────────────────────────────────
  /** Fetch the current OperatorStance for a deal from the backend. */
  fetchOperatorStance: (dealId: string) => Promise<void>;
  /** Persist a partial stance update (merge-patch). Triggers background reblend. */
  saveOperatorStance: (dealId: string, patch: import('./dealContext.types').OperatorStancePatch) => Promise<void>;
  /** Reset stance to MARKET defaults. */
  resetOperatorStance: (dealId: string) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Initial / empty state
// ---------------------------------------------------------------------------

const EMPTY_HYDRATION: DealContext['hydrationStatus'] = {
  identity: { hydrated: false, lastFetchedAt: null, source: 'mock' },
  zoning: { hydrated: false, lastFetchedAt: null, source: 'mock' },
  market: { hydrated: false, lastFetchedAt: null, source: 'mock' },
  supply: { hydrated: false, lastFetchedAt: null, source: 'mock' },
  financial: { hydrated: false, lastFetchedAt: null, source: 'mock' },
  capital: { hydrated: false, lastFetchedAt: null, source: 'mock' },
  strategy: { hydrated: false, lastFetchedAt: null, source: 'mock' },
  scores: { hydrated: false, lastFetchedAt: null, source: 'mock' },
  risk: { hydrated: false, lastFetchedAt: null, source: 'mock' },
};

const INITIAL_CONTEXT: DealContext = {
  zoningOutput: null,
  identity: {
    id: '',
    name: '',
    address: '',
    city: '',
    state: 'FL',
    zip: '',
    county: '',
    parcelIds: [],
    coordinates: { lat: 0, lng: 0 },
    mode: 'existing',
    stage: 'lead',
    sponsor: '',
    capitalIntent: '',
    createdAt: '',
    updatedAt: '',
  },
  projectType: 'existing',
  productType: 'mf_garden',
  site: {
    acreage: layered(0),
    buildableAcreage: layered(0),
    boundary: null,
    constraints: [],
    floodZone: layered(null),
  },
  zoning: {
    designation: layered(''),
    maxDensity: layered(0),
    maxHeight: layered(0),
    maxFAR: layered(0),
    maxLotCoverage: layered(0),
    setbacks: layered({ front: 0, side: 0, rear: 0 }),
    parkingRatio: layered(1.0),
    guestParkingRatio: layered(0.25),
    sourceUrl: null,
    verified: false,
    overlays: [],
    varianceAssumed: false,
  },
  developmentPaths: [],
  selectedDevelopmentPathId: null,
  developmentEnvelope: null,
  existingProperty: null,
  redevelopment: null,
  resolvedUnitMix: [],
  unitMixOverrides: {},
  totalUnits: 0,
  market: {
    submarketName: '',
    submarketId: '',
    avgRent: layered(0),
    avgOccupancy: layered(0),
    rentGrowthYoY: layered(0),
    absorptionRate: layered(0),
    medianHHI: layered(0),
    popGrowthPct: layered(0),
    employmentGrowthPct: layered(0),
  },
  supply: {
    pipelineUnits: layered(0),
    supplyPressureRatio: 0,
    monthsOfSupply: 0,
    projects: [],
  },
  financial: {
    assumptions: {
      rentGrowth: layered(0.03, 'platform', 0.6),
      expenseGrowth: layered(0.025, 'platform', 0.6),
      vacancy: layered(0.05, 'platform', 0.6),
      exitCapRate: layered(0.055, 'platform', 0.5),
      holdPeriod: layered(5, 'user', 0.9),
      capexPerUnit: layered(0, 'broker', 0.4),
      managementFee: layered(0.04, 'platform', 0.7),
    },
  },
  capital: {
    totalCapital: layered(0),
    debt: [],
    equity: [],
  },
  strategy: {
    scores: [],
    selectedStrategy: layered<StrategyType>('rental', 'platform', 0.5),
    arbitrageGap: 0,
    arbitrageAlert: false,
    verdict: '',
  },
  scores: {
    overall: 0,
    demand: 0,
    supply: 0,
    momentum: 0,
    position: 0,
    risk: 0,
    score30dAgo: null,
    confidence: 0,
    verdict: 'Neutral',
  },
  risk: {
    overall: 0,
    categories: { supply: 0, demand: 0, regulatory: 0, market: 0, execution: 0, climate: 0 },
    topRisk: { category: '', score: 0, detail: '', mitigationAvailable: false },
  },
  hydrationStatus: EMPTY_HYDRATION,
  stageHistory: [],
  editLog: [],
  operatorStance: null,
};

// ---------------------------------------------------------------------------
// Recomputation helpers
// ---------------------------------------------------------------------------

/**
 * Recompute the resolved unit mix from current state.
 * Called after path selection change OR unit mix override change.
 */
function recomputeResolvedMix(state: DealContext): {
  resolvedUnitMix: UnitMixRow[];
  totalUnits: number;
} {
  let baseProgram: UnitMixRow[];

  if (state.identity.mode === 'development') {
    const path = getSelectedPath(state);
    baseProgram = path?.unitMixProgram ?? [];
  } else if (state.identity.mode === 'redevelopment') {
    baseProgram = state.existingProperty?.unitMixProgram ?? [];
  } else {
    baseProgram = state.existingProperty?.unitMixProgram ?? [];
  }

  const resolved = resolveUnitMix(baseProgram, state.unitMixOverrides);
  const totalUnits = resolved.reduce((sum, row) => sum + row.count, 0);

  return { resolvedUnitMix: resolved, totalUnits };
}

/**
 * Mark downstream sections as needing recomputation.
 * In a full implementation, this would trigger backend calls or local recalc.
 * For now, it flags sections as stale.
 */
function markDownstreamStale(
  hydration: DealContext['hydrationStatus'],
  sections: string[]
): DealContext['hydrationStatus'] {
  const updated = { ...hydration };
  for (const section of sections) {
    if (updated[section]) {
      updated[section] = { ...updated[section], source: 'mock' as const };
    }
  }
  return updated;
}

// ---------------------------------------------------------------------------
// THE STORE
// ---------------------------------------------------------------------------

type DealStore = DealContext & DealStoreActions;

export const useDealStore = create<DealStore>()(
  subscribeWithSelector((set, get) => ({
    // Spread initial state
    ...INITIAL_CONTEXT,

    // ─── DEAL LIST (Dashboard) ────────────────────────────────
    deals: [],
    isLoading: false,
    error: null,
    fetchDeals: async () => {
      set({ isLoading: true, error: null });
      try {
        const response = await apiClient.get('/api/v1/deals');
        const data = response.data;
        const dealsList = Array.isArray(data) ? data : (Array.isArray(data?.deals) ? data.deals : []);
        set({ deals: dealsList, isLoading: false });
      } catch (error: any) {
        console.error('[dealStore] Failed to fetch deals:', error);
        set({ error: error.message, isLoading: false });
      }
    },

    // ─── M08 STRATEGY ARBITRAGE ───────────────────────────────
    strategyScores: [] as M08StrategyScore[],
    arbitrageResult: null as M08ArbitrageResult | null,
    strategyScoresLoading: false,

    fetchStrategyScores: async (dealId: string) => {
      set({ strategyScoresLoading: true });
      try {
        const res = await apiClient.get(`/api/v1/deals/${dealId}/strategy-scores`);
        // Backend returns { success, scores: M08StrategyScore[] }
        const scores: M08StrategyScore[] = Array.isArray(res.data?.scores) ? res.data.scores : [];
        set({ strategyScores: scores, strategyScoresLoading: false });
      } catch (err) {
        console.error('[dealStore] fetchStrategyScores failed:', err);
        set({ strategyScoresLoading: false });
      }
    },

    recalculateStrategyScores: async (dealId: string) => {
      set({ strategyScoresLoading: true });
      try {
        const res = await apiClient.post(`/api/v1/deals/${dealId}/strategy-scores/recalculate`);
        // Backend returns { success, scores: M08StrategyScore[], arbitrage?, freshlyCalculated }
        const scores: M08StrategyScore[] = Array.isArray(res.data?.scores) ? res.data.scores : [];
        const arbitrageResult: M08ArbitrageResult | null = res.data?.arbitrage ?? null;
        set({ strategyScores: scores, arbitrageResult, strategyScoresLoading: false });
      } catch (err) {
        console.error('[dealStore] recalculateStrategyScores failed:', err);
        set({ strategyScoresLoading: false });
      }
    },

    fetchArbitrage: async (dealId: string) => {
      try {
        const res = await apiClient.get(`/api/v1/deals/${dealId}/arbitrage`);
        const result: M08ArbitrageResult | null = res.data?.arbitrage ?? null;
        set({ arbitrageResult: result });
      } catch (err) {
        console.error('[dealStore] fetchArbitrage failed:', err);
      }
    },

    // ─── M08 v2 Detection-First Strategy Analysis ──────────────────────────
    strategyAnalysisV2: null,
    strategyAnalysisV2Loading: false,
    strategyAnalysisV2Recalculating: false,
    strategyAnalysisV2Error: null,

    setStrategyAnalysisV2: (data) => {
      set({ strategyAnalysisV2: data });
    },

    fetchStrategyAnalysisV2: async (dealId: string) => {
      set({ strategyAnalysisV2Loading: true, strategyAnalysisV2Error: null });
      try {
        const res = await apiClient.get(`/api/v1/deals/${dealId}/strategies`);
        const data = res.data?.data ?? res.data;
        if (data && (Array.isArray(data.subStrategies) || data.detection)) {
          set({ strategyAnalysisV2: data, strategyAnalysisV2Loading: false });
        } else {
          // null response — keep loading true and trigger recalc inline
          const storeActions = get();
          await storeActions.triggerStrategyAnalysisV2Recalc(dealId);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to load strategy analysis v2';
        console.error('[dealStore] fetchStrategyAnalysisV2 failed:', err);
        set({ strategyAnalysisV2Error: msg, strategyAnalysisV2Loading: false });
      }
    },

    triggerStrategyAnalysisV2Recalc: async (dealId: string) => {
      set({ strategyAnalysisV2Recalculating: true, strategyAnalysisV2Loading: true });
      try {
        await apiClient.post('/api/v1/strategy-analyses', {
          dealId,
          strategySlug: 'auto',
          assumptions: {},
        });
      } catch {
        // best-effort trigger
      }
      await new Promise(r => setTimeout(r, 2000));
      try {
        const res = await apiClient.get(`/api/v1/deals/${dealId}/strategies`);
        const data = res.data?.data ?? res.data;
        if (data && (Array.isArray(data.subStrategies) || data.detection)) {
          set({ strategyAnalysisV2: data });
        }
      } catch {
        // best-effort refetch
      } finally {
        set({ strategyAnalysisV2Recalculating: false, strategyAnalysisV2Loading: false });
      }
    },

    confirmStrategyDetection: async (dealId: string, confirmed: boolean) => {
      try {
        await apiClient.patch(`/api/v1/deals/${dealId}/detection-confirmation`, { userConfirmed: confirmed });
      } catch {
        // best-effort
      }
      const storeActions = get();
      await storeActions.fetchStrategyAnalysisV2(dealId);
    },

    overrideStrategyClassification: async (dealId: string, assetClass: string) => {
      try {
        await apiClient.patch(`/api/v1/deals/${dealId}/detection-confirmation`, {
          userConfirmed: true,
          userOverrideClassification: assetClass,
        });
      } catch {
        // best-effort
      }
      const storeActions = get();
      await storeActions.fetchStrategyAnalysisV2(dealId);
    },

    adjustStrategySubStrategy: async (dealId: string, subStrategyKey: string) => {
      // Sub-strategy refinement: confirms detection and sets the preferred sub-strategy
      // without changing the detected asset class (distinct from full override)
      try {
        await apiClient.patch(`/api/v1/deals/${dealId}/detection-confirmation`, {
          userConfirmed: true,
          adjustedSubStrategyKey: subStrategyKey,
        });
      } catch {
        // best-effort
      }
      const storeActions = get();
      await storeActions.fetchStrategyAnalysisV2(dealId);
    },

    createDeal: async (payload: any) => {
      set({ isLoading: true, error: null });
      try {
        const response = await apiClient.post('/api/v1/deals', payload);
        const deal = response.data?.deal;
        if (deal) {
          // Add to local deals list
          set(state => ({
            deals: [deal, ...state.deals],
            isLoading: false
          }));
          return deal;
        }
        set({ isLoading: false });
        return null;
      } catch (error: any) {
        const errorMsg = error.response?.data?.error || error.message || 'Failed to create deal';
        set({
          error: errorMsg,
          isLoading: false
        });
        throw error;
      }
    },

    // ─── LIFECYCLE ────────────────────────────────────────────

    fetchDealContext: async (dealId: string) => {
      try {
        const response = await apiClient.get(`/api/v1/deals/${dealId}/context`);
        const data: DealContext = response.data;

        // Recompute resolved unit mix from the fetched data
        const { resolvedUnitMix, totalUnits } = recomputeResolvedMix(data);

        const rawType = data.projectType ?? data.project_type ?? data.identity?.mode ?? 'existing';
        const resolvedType = resolveProjectType(rawType);
        console.log('[dealStore] projectType resolved to:', resolvedType);

        const rawIdentity = data.identity ?? {};
        const normalizedIdentity = {
          ...INITIAL_CONTEXT.identity,
          ...Object.fromEntries(
            Object.entries(rawIdentity).map(([k, v]) => [k, v ?? INITIAL_CONTEXT.identity[k as keyof typeof INITIAL_CONTEXT.identity] ?? ''])
          ),
          mode: resolvedType,
        };

        set({
          ...data,
          identity: normalizedIdentity,
          resolvedUnitMix,
          totalUnits,
          projectType: resolvedType,
          editLog: data.editLog ?? [],
          redevelopment: data.redevelopment ?? null,
        });
      } catch (error) {
        console.error('[dealStore] Failed to fetch deal context:', error);
        // In development, fall back to mock data (remove in production)
        // TODO: Replace with proper error handling
      }
    },

    clearDeal: () => {
      set({
        ...INITIAL_CONTEXT,
        strategyScores: [],
        arbitrageResult: null,
        strategyScoresLoading: false,
        strategyAnalysisV2: null,
        strategyAnalysisV2Loading: false,
        strategyAnalysisV2Recalculating: false,
        strategyAnalysisV2Error: null,
      });
    },

    // ─── DEVELOPMENT ENVELOPE (from Dev Capacity) ─────────────

    setDevelopmentEnvelope: (envelope) => {
      set({ developmentEnvelope: envelope });
    },

    // ─── UNIT MIX PROPAGATION (Phase 11) ──────────────────────

    applyUnitMixToAllModules: async () => {
      const state = get();
      const dealId = state.identity.id;

      if (!dealId) {
        console.warn('[dealStore] No deal ID for unit mix propagation');
        return { success: false, modulesUpdated: [] };
      }

      try {
        const response = await fetch(`/api/v1/deals/${dealId}/unit-mix/apply`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source: 'path' }),
        });

        if (!response.ok) {
          throw new Error(`Unit mix propagation failed: ${response.status}`);
        }

        const data = await response.json();
        return {
          success: data.success,
          modulesUpdated: data.data?.result?.modulesUpdated || [],
        };
      } catch (error) {
        console.error('[dealStore] applyUnitMixToAllModules failed:', error);
        return { success: false, modulesUpdated: [] };
      }
    },

    setManualUnitMix: async (unitMix) => {
      const state = get();
      const dealId = state.identity.id;

      if (!dealId) {
        console.warn('[dealStore] No deal ID for manual unit mix');
        return { success: false };
      }

      try {
        const response = await fetch(`/api/v1/deals/${dealId}/unit-mix/set`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ unitMix }),
        });

        if (!response.ok) {
          throw new Error(`Set manual unit mix failed: ${response.status}`);
        }

        const data = await response.json();
        
        // Refresh deal context to get updated unit mix
        await get().fetchDealContext(dealId);

        return { success: data.success };
      } catch (error) {
        console.error('[dealStore] setManualUnitMix failed:', error);
        return { success: false };
      }
    },

    getUnitMixStatus: async () => {
      const state = get();
      const dealId = state.identity.id;

      if (!dealId) {
        return { hasUnitMix: false, source: null, appliedAt: null };
      }

      try {
        const response = await fetch(`/api/v1/deals/${dealId}/unit-mix/status`);
        
        if (!response.ok) {
          throw new Error(`Get unit mix status failed: ${response.status}`);
        }

        const data = await response.json();
        return data.data || { hasUnitMix: false, source: null, appliedAt: null };
      } catch (error) {
        console.error('[dealStore] getUnitMixStatus failed:', error);
        return { hasUnitMix: false, source: null, appliedAt: null };
      }
    },

    // ─── THE KEYSTONE: DEVELOPMENT PATH SELECTION ─────────────

    selectDevelopmentPath: (pathId: string) => {
      const state = get();

      // Verify path exists
      const path = state.developmentPaths.find((p) => p.id === pathId);
      if (!path) {
        console.warn(`[dealStore] Path ${pathId} not found`);
        return;
      }

      // Step 1: Set the selected path
      // Step 2: Recompute resolved unit mix (path's program + user overrides)
      const nextState = {
        ...state,
        selectedDevelopmentPathId: pathId,
      };
      const { resolvedUnitMix, totalUnits } = recomputeResolvedMix(nextState);

      // Step 3: Mark downstream sections as stale
      const hydrationStatus = markDownstreamStale(state.hydrationStatus, [
        'financial',
        'strategy',
        'scores',
        'risk',
      ]);

      set({
        selectedDevelopmentPathId: pathId,
        resolvedUnitMix,
        totalUnits,
        hydrationStatus,
      });

      // Step 4: Propagate unit mix to ALL modules (Phase 11)
      // This ensures Financial Model, 3D Design, Dev Capacity all use same unit mix
      console.log('[dealStore] Propagating unit mix to all modules after path selection');
      get().applyUnitMixToAllModules().then((result) => {
        if (result.success) {
          console.log('[dealStore] Unit mix applied to:', result.modulesUpdated);
        } else {
          console.warn('[dealStore] Unit mix propagation had errors');
        }
      });

      // Step 5: Trigger async downstream recomputation
      // This calls backend to rerun ProForma, Strategy, JEDI Score
      // with the new unit mix and construction parameters
      get()._triggerDownstreamRecompute(pathId);
    },

    /**
     * Internal: trigger backend recomputation after path change.
     * Debounced to avoid rapid-fire during exploration.
     */
    _triggerDownstreamRecompute: debounce(async (pathId: string) => {
      const state = useDealStore.getState();
      const path = state.developmentPaths.find((p) => p.id === pathId);
      if (!path) return;

      try {
        // Backend recomputes ProForma, Strategy, JEDI Score based on new path
        const response = await fetch(
          `/api/v1/deals/${state.identity.id}/recompute`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              trigger: 'development_path_change',
              pathId,
              unitMix: state.resolvedUnitMix,
              constructionCost: path.constructionCost,
              timeline: path.timeline,
              zoningCompliance: path.zoningCompliance,
            }),
          }
        );

        if (!response.ok) return;

        const result = await response.json();

        // Apply recomputed downstream values
        useDealStore.setState({
          financial: result.financial ?? state.financial,
          strategy: result.strategy ?? state.strategy,
          scores: result.scores ?? state.scores,
          risk: result.risk ?? state.risk,
          hydrationStatus: {
            ...state.hydrationStatus,
            financial: { hydrated: true, lastFetchedAt: new Date().toISOString(), source: 'live' },
            strategy: { hydrated: true, lastFetchedAt: new Date().toISOString(), source: 'live' },
            scores: { hydrated: true, lastFetchedAt: new Date().toISOString(), source: 'live' },
            risk: { hydrated: true, lastFetchedAt: new Date().toISOString(), source: 'live' },
          },
        });
      } catch (error) {
        console.error('[dealStore] Downstream recompute failed:', error);
      }
    }, 500),

    addDevelopmentPath: (path: DevelopmentPath) => {
      const state = get();
      const paths = [...state.developmentPaths, path];
      const updates: Partial<DealStore> = { developmentPaths: paths };

      // Auto-select if this is the first path
      if (paths.length === 1) {
        updates.selectedDevelopmentPathId = path.id;
        const nextState = { ...state, ...updates };
        const { resolvedUnitMix, totalUnits } = recomputeResolvedMix(nextState);
        updates.resolvedUnitMix = resolvedUnitMix;
        updates.totalUnits = totalUnits;
      }

      set(updates);
    },

    removeDevelopmentPath: (pathId: string) => {
      const state = get();
      const paths = state.developmentPaths.filter((p) => p.id !== pathId);
      const updates: Partial<DealStore> = { developmentPaths: paths };

      // If we removed the selected path, select the first remaining
      if (state.selectedDevelopmentPathId === pathId) {
        updates.selectedDevelopmentPathId = paths[0]?.id ?? null;
        const nextState = { ...state, ...updates };
        const { resolvedUnitMix, totalUnits } = recomputeResolvedMix(nextState);
        updates.resolvedUnitMix = resolvedUnitMix;
        updates.totalUnits = totalUnits;
      }

      set(updates);
    },

    updateDevelopmentPath: (pathId: string, pathUpdates: Partial<DevelopmentPath>) => {
      const state = get();
      const paths = state.developmentPaths.map((p) =>
        p.id === pathId ? { ...p, ...pathUpdates } : p
      );
      const updates: Partial<DealStore> = { developmentPaths: paths };

      // If we updated the currently selected path's unit mix, recompute
      if (
        pathId === state.selectedDevelopmentPathId &&
        pathUpdates.unitMixProgram
      ) {
        const nextState = { ...state, developmentPaths: paths };
        const { resolvedUnitMix, totalUnits } = recomputeResolvedMix(nextState);
        updates.resolvedUnitMix = resolvedUnitMix;
        updates.totalUnits = totalUnits;
      }

      set(updates);
    },

    // ─── UNIT MIX OVERRIDES ─────────────────────────────────

    overrideUnitMix: (rowId, overrides) => {
      const state = get();
      const newOverrides = {
        ...state.unitMixOverrides,
        [rowId]: { ...(state.unitMixOverrides[rowId] ?? {}), ...overrides },
      };
      const nextState = { ...state, unitMixOverrides: newOverrides };
      const { resolvedUnitMix, totalUnits } = recomputeResolvedMix(nextState);

      set({
        unitMixOverrides: newOverrides,
        resolvedUnitMix,
        totalUnits,
        // Mark downstream as stale
        hydrationStatus: markDownstreamStale(state.hydrationStatus, [
          'financial',
          'strategy',
          'scores',
        ]),
      });

      // Debounced persist to backend
      debouncedPersistOverrides(state.identity.id, newOverrides);
    },

    clearUnitMixOverrides: () => {
      const state = get();
      const nextState = { ...state, unitMixOverrides: {} };
      const { resolvedUnitMix, totalUnits } = recomputeResolvedMix(nextState);
      set({ unitMixOverrides: {}, resolvedUnitMix, totalUnits });
    },

    setExistingUnitMix: (program: UnitMixRow[]) => {
      const state = get();
      if (!state.existingProperty) return;

      set({
        existingProperty: { ...state.existingProperty, unitMixProgram: program },
      });

      // Recompute resolved mix
      const nextState = {
        ...get(),
      };
      const { resolvedUnitMix, totalUnits } = recomputeResolvedMix(nextState);
      set({ resolvedUnitMix, totalUnits });
    },

    // ─── ASSUMPTION EDITING (Task #153) ────────────────────

    assumptionCascadeStatus: 'idle' as 'idle' | 'pending' | 'computing' | 'error',

    updateAssumption: (path: string, value: number) => {
      const state = get();
      const parts = path.split('.');
      const newState = { ...state };
      const now = new Date().toISOString();

      let current: any = newState;
      for (let i = 0; i < parts.length - 1; i++) {
        current[parts[i]] = { ...current[parts[i]] };
        current = current[parts[i]];
      }

      const key = parts[parts.length - 1];
      const existing = current[key] as LayeredValue<number> | undefined;

      const entry: EditLogEntry = {
        path,
        oldValue: existing?.value,
        newValue: value,
        timestamp: now,
        actor: 'user',
      };

      const fieldMeta = getFieldMeta(path);

      let baseLayers = existing?.layers ?? {};
      if (existing && !baseLayers.broker && !baseLayers.platform && !baseLayers.user) {
        const fallbackFrom: 'broker' | 'platform' =
          existing.resolvedFrom === 'broker' ? 'broker' : 'platform';
        baseLayers = {
          [fallbackFrom]: {
            value: existing.value,
            updatedAt: existing.updatedAt,
            confidence: existing.confidence,
          },
        };
      }

      const updated: LayeredValue<number> = {
        value,
        source: 'user',
        resolvedFrom: 'user',
        updatedAt: now,
        confidence: 1.0,
        alertLevel: 'none',
        userReviewed: true,
        layers: {
          ...baseLayers,
          user: { value, updatedAt: now, confidence: 1.0 },
        },
      };
      updated.alertLevel = computeAlertLevel(updated, {
        isIdentity: fieldMeta?.inputClass === 'identity',
        highSensitivity: fieldMeta?.highSensitivity ?? false,
      });

      current[key] = updated;

      const isZoningField = path.startsWith('zoning.') && path !== 'zoning.varianceAssumed';
      if (isZoningField && !state.zoning?.varianceAssumed) {
        return;
      }

      newState.editLog = [...(state.editLog || []), entry];
      newState.hydrationStatus = markDownstreamStale(state.hydrationStatus, [
        'financial', 'strategy', 'scores', 'risk',
      ]);

      set(newState);

      window.dispatchEvent(new CustomEvent('assumption:changed', {
        detail: { path, value, oldValue: existing?.value, timestamp: now },
      }));
    },

    revertAssumption: (path: string) => {
      const state = get();
      const parts = path.split('.');
      const newState = { ...state };
      const now = new Date().toISOString();

      let current: any = newState;
      for (let i = 0; i < parts.length - 1; i++) {
        current[parts[i]] = { ...current[parts[i]] };
        current = current[parts[i]];
      }

      const key = parts[parts.length - 1];
      const existing = current[key] as LayeredValue<number> | undefined;
      if (!existing?.layers) return;

      const { user: _removed, ...remainingLayers } = existing.layers;

      const platformVal = remainingLayers.platform;
      const brokerVal = remainingLayers.broker;
      let fallback = platformVal ?? brokerVal;
      let resolvedFrom: 'broker' | 'platform' = platformVal ? 'platform' : 'broker';

      if (!fallback) {
        const platformDefault = ASSUMPTION_PLATFORM_DEFAULTS[path];
        if (platformDefault === undefined) return;
        fallback = { value: platformDefault, updatedAt: now, confidence: 0.8 };
        resolvedFrom = 'platform';
        remainingLayers.platform = fallback;
      }
      const fieldMeta = getFieldMeta(path);

      const reverted: LayeredValue<number> = {
        value: fallback.value,
        source: resolvedFrom,
        resolvedFrom,
        updatedAt: now,
        confidence: fallback.confidence,
        alertLevel: 'none',
        userReviewed: true,
        layers: remainingLayers as LayeredValue<number>['layers'],
      };
      reverted.alertLevel = computeAlertLevel(reverted, {
        isIdentity: fieldMeta?.inputClass === 'identity',
        highSensitivity: fieldMeta?.highSensitivity ?? false,
      });

      current[key] = reverted;

      const entry: EditLogEntry = {
        path,
        oldValue: existing.value,
        newValue: fallback.value,
        timestamp: now,
        actor: 'user',
      };
      newState.editLog = [...(state.editLog || []), entry];
      newState.hydrationStatus = markDownstreamStale(state.hydrationStatus, [
        'financial', 'strategy', 'scores', 'risk',
      ]);

      const isZoningField = path.startsWith('zoning.');
      if (isZoningField) {
        const zoningKeys = ['designation', 'maxDensity', 'maxHeight', 'maxFAR', 'maxLotCoverage', 'setbacks', 'parkingRatio', 'guestParkingRatio'];
        type ZoningLVKey = 'designation' | 'maxDensity' | 'maxHeight' | 'maxFAR' | 'maxLotCoverage' | 'setbacks' | 'parkingRatio' | 'guestParkingRatio';
        const hasAnyUserZoning = (zoningKeys as ZoningLVKey[])
          .filter(k => k !== key)
          .some(k => newState.zoning[k]?.layers?.user);
        if (!hasAnyUserZoning) {
          newState.zoning = { ...newState.zoning, varianceAssumed: false };
        }
      }

      set(newState);

      window.dispatchEvent(new CustomEvent('assumption:changed', {
        detail: { path, value: fallback.value, oldValue: existing.value, timestamp: now, action: 'revert' },
      }));
    },

    revertAllAssumptions: () => {
      const state = get();
      const now = new Date().toISOString();

      const revertLV = <T>(lv: LayeredValue<T>, fieldPath: string): LayeredValue<T> => {
        if (!lv.layers?.user) return lv;
        const { user: _removed, ...remaining } = lv.layers;
        let fallback = remaining.platform ?? remaining.broker;
        let resolvedFrom: 'broker' | 'platform' = remaining.platform ? 'platform' : 'broker';

        if (!fallback) {
          const platformDefault = ASSUMPTION_PLATFORM_DEFAULTS[fieldPath];
          if (platformDefault === undefined) return lv;
          fallback = { value: platformDefault as T, updatedAt: now, confidence: 0.8 };
          resolvedFrom = 'platform';
          remaining.platform = fallback;
        }

        const reverted: LayeredValue<T> = {
          value: fallback.value,
          source: resolvedFrom,
          resolvedFrom,
          updatedAt: now,
          confidence: fallback.confidence,
          alertLevel: 'none',
          userReviewed: true,
          layers: remaining,
        };
        reverted.alertLevel = computeAlertLevel(reverted as LayeredValue<unknown>);
        return reverted;
      };

      const isLayeredValue = (v: unknown): v is LayeredValue<unknown> =>
        v !== null && typeof v === 'object' && 'layers' in v && 'value' in v;

      const getNestedValue = (obj: Record<string, unknown>, segments: string[]): unknown => {
        let cur: unknown = obj;
        for (const seg of segments) {
          if (cur === null || typeof cur !== 'object') return undefined;
          cur = (cur as Record<string, unknown>)[seg];
        }
        return cur;
      };

      const setNestedValue = (obj: Record<string, unknown>, segments: string[], val: unknown): void => {
        let cur: Record<string, unknown> = obj;
        for (let i = 0; i < segments.length - 1; i++) {
          const existing = cur[segments[i]];
          if (existing === null || typeof existing !== 'object') return;
          cur[segments[i]] = { ...(existing as Record<string, unknown>) };
          cur = cur[segments[i]] as Record<string, unknown>;
        }
        cur[segments[segments.length - 1]] = val;
      };

      const patch: Record<string, unknown> = {};
      const topLevelSections = new Set<string>();

      for (const field of INPUT_FIELD_REGISTRY) {
        const segments = field.path.split('.');
        const topKey = segments[0];
        const lv = getNestedValue(state as unknown as Record<string, unknown>, segments);
        if (!isLayeredValue(lv) || !lv.layers?.user) continue;

        if (!patch[topKey]) {
          patch[topKey] = JSON.parse(JSON.stringify(
            (state as unknown as Record<string, unknown>)[topKey]
          ));
          topLevelSections.add(topKey);
        }
        const reverted = revertLV(lv, field.path);
        setNestedValue(patch as Record<string, unknown>, segments, reverted);
      }

      if (patch.zoning && typeof patch.zoning === 'object') {
        (patch.zoning as Record<string, unknown>).varianceAssumed = false;
      }

      set({
        ...patch,
        hydrationStatus: markDownstreamStale(state.hydrationStatus, [
          'financial', 'strategy', 'scores', 'risk',
        ]),
        editLog: [...(state.editLog || []), {
          path: '*',
          oldValue: 'all',
          newValue: 'reverted',
          timestamp: now,
          actor: 'user' as const,
        }],
      });

      window.dispatchEvent(new CustomEvent('assumption:changed', {
        detail: { path: '*', action: 'revert_all', timestamp: now },
      }));
    },

    toggleVarianceAssumed: (enabled: boolean) => {
      const state = get();
      set({
        zoning: { ...state.zoning, varianceAssumed: enabled },
      });
      if (!enabled) {
        type ZoningLVKey = 'designation' | 'maxDensity' | 'maxHeight' | 'maxFAR' | 'maxLotCoverage' | 'setbacks' | 'parkingRatio' | 'guestParkingRatio';
        const zoningKeys: ZoningLVKey[] = ['designation', 'maxDensity', 'maxHeight', 'maxFAR', 'maxLotCoverage', 'setbacks', 'parkingRatio', 'guestParkingRatio'];
        for (const k of zoningKeys) {
          if (state.zoning[k]?.layers?.user) {
            get().revertAssumption(`zoning.${k}`);
          }
        }
      }
    },

    _triggerAssumptionCascade: debounce(async () => {
      const state = useDealStore.getState();
      const dealId = state.identity.id;
      if (!dealId) return;

      useDealStore.setState({ assumptionCascadeStatus: 'computing' });

      try {
        const response = await fetch(
          `/api/v1/deals/${dealId}/recompute`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              trigger: 'assumption_change',
              assumptions: {
                rentGrowth: state.financial.assumptions.rentGrowth.value,
                expenseGrowth: state.financial.assumptions.expenseGrowth.value,
                vacancy: state.financial.assumptions.vacancy.value,
                exitCapRate: state.financial.assumptions.exitCapRate.value,
                holdPeriod: state.financial.assumptions.holdPeriod.value,
                capexPerUnit: state.financial.assumptions.capexPerUnit.value,
                managementFee: state.financial.assumptions.managementFee.value,
              },
              unitMix: state.resolvedUnitMix.map(r => ({
                units: r.count,
                marketRent: r.marketRent?.value ?? r.targetRent.value,
              })),
            }),
          }
        );

        if (!response.ok) {
          useDealStore.setState({ assumptionCascadeStatus: 'error' });
          return;
        }

        const result = await response.json();
        const currentState = useDealStore.getState();
        const now = new Date().toISOString();

        const mergedFinancial = result.financial
          ? {
              ...currentState.financial,
              returns: result.financial.returns ?? currentState.financial.returns,
              recomputedAt: result.financial.recomputedAt,
            }
          : currentState.financial;

        const mergedScores = result.scores
          ? {
              ...currentState.scores,
              overall: result.scores.overall ?? currentState.scores.overall,
              demand: result.scores.demand ?? currentState.scores.demand,
              supply: result.scores.supply ?? currentState.scores.supply,
              momentum: result.scores.momentum ?? currentState.scores.momentum,
              position: result.scores.position ?? currentState.scores.position,
              risk: result.scores.risk ?? currentState.scores.risk,
              confidence: result.scores.confidence ?? currentState.scores.confidence,
              verdict: result.scores.verdict ?? currentState.scores.verdict,
            }
          : currentState.scores;

        const mergedStrategy = result.strategy
          ? {
              ...currentState.strategy,
              verdict: result.strategy.recommended ?? currentState.strategy.verdict,
              scores: result.strategy.scores ?? currentState.strategy.scores,
              arbitrageGap: result.strategy.arbitrageGap ?? currentState.strategy.arbitrageGap,
              arbitrageAlert: result.strategy.arbitrageAlert ?? currentState.strategy.arbitrageAlert,
            }
          : currentState.strategy;

        const mergedRisk = result.risk
          ? {
              ...currentState.risk,
              overall: typeof result.risk.level === 'string'
                ? (result.risk.level === 'high' ? 80 : result.risk.level === 'elevated' ? 60 : 40)
                : currentState.risk.overall,
            }
          : currentState.risk;

        useDealStore.setState({
          financial: mergedFinancial,
          strategy: mergedStrategy,
          scores: mergedScores,
          risk: mergedRisk,
          assumptionCascadeStatus: 'idle',
          hydrationStatus: {
            ...currentState.hydrationStatus,
            financial: { hydrated: true, lastFetchedAt: now, source: 'live' },
            strategy: { hydrated: true, lastFetchedAt: now, source: 'live' },
            scores: { hydrated: true, lastFetchedAt: now, source: 'live' },
            risk: { hydrated: true, lastFetchedAt: now, source: 'live' },
          },
        });
      } catch (error) {
        console.error('[dealStore] Assumption cascade recompute failed:', error);
        useDealStore.setState({ assumptionCascadeStatus: 'error' });
      }
    }, 600),

    // ─── GENERIC LAYERED VALUE UPDATE ───────────────────────

    updateLayeredValue: <T>(
      path: string,
      value: T,
      source: DataSource,
      confidence: number = 0.7
    ) => {
      const state = get();
      const parts = path.split('.');
      const newState = { ...state };

      let current: any = newState;
      for (let i = 0; i < parts.length - 1; i++) {
        current[parts[i]] = { ...current[parts[i]] };
        current = current[parts[i]];
      }

      const key = parts[parts.length - 1];
      const existing = current[key] as LayeredValue<T>;

      const resolvedFrom: 'broker' | 'platform' | 'user' =
        source === 'user' ? 'user'
        : source === 'broker' ? 'broker'
        : 'platform';

      const now = new Date().toISOString();

      const entry: EditLogEntry = {
        path,
        oldValue: existing?.value,
        newValue: value,
        timestamp: now,
        actor: source === 'user' ? 'user' : source === 'agent' ? 'agent' : 'platform',
      };
      newState.editLog = [...(state.editLog || []), entry];

      const fieldMeta = getFieldMeta(path);
      const userReviewed = source === 'user' || (existing?.userReviewed ?? false);

      const updated: LayeredValue<T> = {
        value,
        source,
        resolvedFrom,
        updatedAt: now,
        confidence,
        alertLevel: 'none',
        userReviewed,
        layers: {
          ...existing?.layers,
          [resolvedFrom]: { value, updatedAt: now, confidence },
        },
      };
      updated.alertLevel = computeAlertLevel(updated, {
        isIdentity: fieldMeta?.inputClass === 'identity',
        highSensitivity: fieldMeta?.highSensitivity ?? false,
      });

      current[key] = updated;

      set(newState);
    },

    // ─── SECTION UPDATES ────────────────────────────────────

    updateMarket: (updates) => set((s) => ({ market: { ...s.market, ...updates } })),
    updateSupply: (updates) => set((s) => ({ supply: { ...s.supply, ...updates } })),
    updateFinancial: (updates) => set((s) => ({ financial: { ...s.financial, ...updates } })),
    updateCapital: (updates) => set((s) => ({ capital: { ...s.capital, ...updates } })),
    updateStrategy: (updates) => set((s) => ({ strategy: { ...s.strategy, ...updates } })),
    updateScores: (updates) => set((s) => ({ scores: { ...s.scores, ...updates } })),
    updateRisk: (updates) => set((s) => ({ risk: { ...s.risk, ...updates } })),
    updateZoning: (updates) => set((s) => ({ zoning: { ...s.zoning, ...updates } })),
    updateZoningOutput: (output) => set({ zoningOutput: output }),

    // ─── CORPORATE HEALTH (M33) ─────────────────────────────

    corporateHealth: {
      schi: null,
      divergence: null,
      signal: null,
      reHealth: null,
      herfindahl: null,
      minChs: null,
      topEmployerShare: null,
      loading: false,
    },

    fetchCorporateHealth: async (dealId: string) => {
      set((s) => ({ corporateHealth: { ...s.corporateHealth, loading: true } }));
      try {
        const res = await apiClient.get(`/api/v1/corporate-health/deal/${dealId}`);
        const d = res.data?.data;
        if (d) {
          set({
            corporateHealth: {
              schi: d.weightedSCHI ?? null,
              divergence: d.divergence ?? null,
              signal: d.submarkets?.[0]?.signal ?? null,
              reHealth: null,
              herfindahl: d.herfindahl ?? null,
              minChs: d.minChs ?? null,
              topEmployerShare: d.topEmployerShare ?? null,
              loading: false,
            },
          });
        } else {
          set((s) => ({ corporateHealth: { ...s.corporateHealth, loading: false } }));
        }
      } catch {
        set((s) => ({ corporateHealth: { ...s.corporateHealth, loading: false } }));
      }
    },

    fetchSubmarketHealth: async (submarketId: number) => {
      set((s) => ({ corporateHealth: { ...s.corporateHealth, loading: true } }));
      try {
        const res = await apiClient.get(`/api/v1/corporate-health/submarket/${submarketId}`);
        const d = res.data?.data;
        if (d) {
          set({
            corporateHealth: {
              schi: d.schi ?? null,
              divergence: d.divergence ?? null,
              signal: d.signal ?? null,
              reHealth: d.reHealth ?? null,
              herfindahl: d.herfindahl ?? null,
              minChs: null,
              topEmployerShare: null,
              loading: false,
            },
          });
        } else {
          set((s) => ({ corporateHealth: { ...s.corporateHealth, loading: false } }));
        }
      } catch {
        set((s) => ({ corporateHealth: { ...s.corporateHealth, loading: false } }));
      }
    },

    // ─── STAGE MANAGEMENT ───────────────────────────────────

    setStage: (stage: DealStage) => {
      const state = get();
      const now = new Date().toISOString();

      // Close current stage
      const stageHistory = state.stageHistory.map((s, i) =>
        i === state.stageHistory.length - 1 && !s.exitedAt
          ? { ...s, exitedAt: now }
          : s
      );

      // Open new stage
      stageHistory.push({ stage, enteredAt: now, exitedAt: null });

      set({
        identity: { ...state.identity, stage, updatedAt: now },
        stageHistory,
      });
    },

    // ─── FIELD REVIEW & IDENTITY GATE ─────────────────────

    markFieldReviewed: (path: string) => {
      const segments = path.split('.');
      const state = get();

      let cur: unknown = state;
      for (const seg of segments) {
        if (!cur || typeof cur !== 'object') return;
        cur = (cur as Record<string, unknown>)[seg];
      }
      if (!cur || typeof cur !== 'object' || !('alertLevel' in cur) || !('userReviewed' in cur)) return;
      const lv = cur as { alertLevel: string; userReviewed: boolean };
      if (lv.userReviewed || lv.alertLevel !== 'info') return;

      const updated = { ...cur, userReviewed: true, alertLevel: 'none' };
      if (segments.length === 1) {
        set({ [segments[0]]: updated } as Partial<DealStore>);
      } else if (segments.length === 2) {
        const topKey = segments[0];
        const topObj = (state as Record<string, unknown>)[topKey];
        set({ [topKey]: { ...(topObj as Record<string, unknown>), [segments[1]]: updated } } as Partial<DealStore>);
      } else if (segments.length === 3) {
        const [s0, s1, s2] = segments;
        const top = (state as Record<string, unknown>)[s0] as Record<string, unknown>;
        const mid = top[s1] as Record<string, unknown>;
        set({ [s0]: { ...top, [s1]: { ...mid, [s2]: updated } } } as Partial<DealStore>);
      }
    },

    isIdentityComplete: () => {
      const { identity } = get();
      const requiredFields: (keyof typeof identity)[] = ['name', 'address', 'city', 'state', 'mode', 'sponsor', 'capitalIntent'];
      return requiredFields.every(f => {
        const val = identity[f];
        return val !== null && val !== undefined && val !== '' && val !== 0;
      });
    },

    hasBlockingAlerts: () => {
      const state = get();
      if (!state.isIdentityComplete()) return true;

      const dealType = getDealType({ projectType: state.projectType });
      const fields = INPUT_FIELD_REGISTRY.filter(f => f.appliesTo.includes(dealType));
      for (const field of fields) {
        const segments = field.path.split('.');
        let cur: unknown = state;
        for (const seg of segments) {
          if (cur === null || cur === undefined || typeof cur !== 'object') { cur = undefined; break; }
          cur = (cur as Record<string, unknown>)[seg];
        }
        if (cur && typeof cur === 'object' && 'alertLevel' in cur && (cur as { alertLevel: string }).alertLevel === 'block') {
          return true;
        }
      }
      return false;
    },

    // ─── COMPUTED SELECTORS ─────────────────────────────────

    getSelectedPath: () => getSelectedPath(get()),
    isDevelopment: () => get().identity.mode === 'development',
    getBaseUnitMix: () => {
      const state = get();
      if (state.identity.mode === 'development') {
        return getSelectedPath(state)?.unitMixProgram ?? [];
      }
      return state.existingProperty?.unitMixProgram ?? [];
    },

    // ─── F9 PRO FORMA TIER-1 PROTECTORS ─────────────────────
    confidenceBands: {},
    validationFlags: [],
    refusalReasons: {},

    // ─── F9 Y1 SOURCE PICKER ─────────────────────────────────
    y1Source: 'PLATFORM' as Y1Source,
    setY1Source: (source) => set({ y1Source: source }),

    // ─── F9 PLATFORM COLUMN SOURCE PICKER ────────────────────────────────
    platformColSource: 'PLATFORM' as PlatformColSource,
    setPlatformColSource: (source) => set({ platformColSource: source }),

    // ─── F9 VIEW MODE ────────────────────────────────────────
    viewMode: 'BUILD_OWN' as 'BROKER_VIEW' | 'BUILD_OWN',
    setViewMode: (mode) => set({ viewMode: mode }),

    setConfidenceBands: (bands) => set({ confidenceBands: bands }),

    setRefusalReasons: (reasons) => set({ refusalReasons: reasons }),

    setValidationFlags: (flags) => set({ validationFlags: flags }),

    upsertValidationFlag: (flag) => {
      const list = get().validationFlags;
      const idx = list.findIndex((f) => f.id === flag.id);
      const next = idx >= 0 ? [...list] : [...list, flag];
      if (idx >= 0) next[idx] = { ...next[idx], ...flag };
      set({ validationFlags: next });
    },

    removeValidationFlag: (id) => {
      set({ validationFlags: get().validationFlags.filter((f) => f.id !== id) });
    },

    dismissValidationFlag: (id, justification) => {
      set({
        validationFlags: get().validationFlags.map((f) =>
          f.id === id
            ? { ...f, dismissed: true, justification: justification ?? f.justification }
            : f,
        ),
      });
    },

    runGordonValidation: (input) => {
      const result = f9ValidateGordon(input);
      const flagId = 'gordon:exit_cap';
      const list = get().validationFlags;
      // Drop any prior gordon flag — we re-emit fresh each call.
      const filtered = list.filter((f) => f.id !== flagId);
      if (result.flag) {
        const flag: ValidationFlag = {
          id: flagId,
          source: 'gordon',
          severity: result.severity ?? 'info',
          field: 'exitCapRate',
          message: result.message ?? '',
          data: {
            impliedCap: result.impliedCap,
            divergenceBps: result.divergenceBps,
            exitCap: input.exitCap,
            terminalGrowth: input.terminalGrowth,
            requiredReturn: input.requiredReturn,
          },
          raisedAt: new Date().toISOString(),
        };
        set({ validationFlags: [...filtered, flag] });
      } else {
        set({ validationFlags: filtered });
      }
      return result;
    },

    emitLeaseVelocityUpdated: () => {
      window.dispatchEvent(new CustomEvent('lease_velocity.output.updated'));
    },

    emitLeasingCostTreatmentChanged: (treatment) => {
      window.dispatchEvent(new CustomEvent('leasing_cost_treatment.changed', { detail: { treatment } }));
    },

    // ─── OPERATOR STANCE implementation ─────────────────────────────────────

    fetchOperatorStance: async (dealId) => {
      try {
        const res = await fetch(`/api/v1/deals/${dealId}/stance`, {
          headers: { 'Content-Type': 'application/json' },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const { stance } = await res.json();
        set({ operatorStance: stance });
      } catch (err) {
        console.warn('[dealStore] fetchOperatorStance failed (non-fatal):', err);
      }
    },

    saveOperatorStance: async (dealId, patch) => {
      try {
        const res = await fetch(`/api/v1/deals/${dealId}/stance`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const { stance } = await res.json();
        set({ operatorStance: stance });
      } catch (err) {
        console.warn('[dealStore] saveOperatorStance failed:', err);
        throw err;
      }
    },

    resetOperatorStance: async (dealId) => {
      try {
        const res = await fetch(`/api/v1/deals/${dealId}/stance/reset`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const { stance } = await res.json();
        set({ operatorStance: stance });
      } catch (err) {
        console.warn('[dealStore] resetOperatorStance failed:', err);
        throw err;
      }
    },

    classifyFieldOverride: (field, value) => {
      const bands = get().confidenceBands[field];
      if (!bands) return null;
      return f9ClassifyOverride(value, bands);
    },

    computeNoiGrowthIdentity: (rentGrowth, opexGrowth, noiMargin) =>
      f9NoiGrowthIdentity(rentGrowth, opexGrowth, noiMargin),
  }))
);

// ---------------------------------------------------------------------------
// Assumption cascade listener — subscribes to assumption:changed events
// ---------------------------------------------------------------------------

if (typeof window !== 'undefined') {
  window.addEventListener('assumption:changed', () => {
    useDealStore.getState()._triggerAssumptionCascade();
  });
}

// ---------------------------------------------------------------------------
// Debounce utility
// ---------------------------------------------------------------------------

function debounce<T extends (...args: any[]) => any>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: any[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as any;
}

/** Persist unit mix overrides to backend (debounced) */
const debouncedPersistOverrides = debounce(
  async (dealId: string, overrides: Record<string, any>) => {
    if (!dealId) return;
    try {
      await fetch(`/api/v1/deals/${dealId}/context`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unitMixOverrides: overrides }),
      });
    } catch (error) {
      console.error('[dealStore] Failed to persist overrides:', error);
    }
  },
  1000
);

// ---------------------------------------------------------------------------
// Convenience hooks for modules
// ---------------------------------------------------------------------------

/** M01 Deal Overview — reads summary data */
export const useDealOverview = () =>
  useDealStore((s) => ({
    identity: s.identity,
    scores: s.scores,
    strategy: s.strategy,
    totalUnits: s.totalUnits,
    resolvedUnitMix: s.resolvedUnitMix,
    selectedPath: s.getSelectedPath(),
    isDevelopment: s.isDevelopment(),
  }));

/** M-PIE Unit Mix Intelligence — reads/writes unit mix */
export const useUnitMixIntelligence = () =>
  useDealStore((s) => ({
    mode: s.identity.mode,
    resolvedUnitMix: s.resolvedUnitMix,
    baseUnitMix: s.getBaseUnitMix(),
    overrides: s.unitMixOverrides,
    totalUnits: s.totalUnits,
    marketRent: s.market.avgRent,
    overrideUnitMix: s.overrideUnitMix,
    clearOverrides: s.clearUnitMixOverrides,
    // Development-specific
    developmentPaths: s.developmentPaths,
    selectedPathId: s.selectedDevelopmentPathId,
    selectPath: s.selectDevelopmentPath,
  }));

/** M03 Dev Capacity — manages development paths */
export const useDevCapacity = () =>
  useDealStore((s) => ({
    zoning: s.zoning,
    zoningOutput: s.zoningOutput,
    site: s.site,
    developmentPaths: s.developmentPaths,
    selectedPathId: s.selectedDevelopmentPathId,
    selectPath: s.selectDevelopmentPath,
    addPath: s.addDevelopmentPath,
    removePath: s.removeDevelopmentPath,
    updatePath: s.updateDevelopmentPath,
    updateZoningOutput: s.updateZoningOutput,
  }));

/** M08 Strategy Arbitrage — reads scores, unit mix, zoning + live M08 slices */
export const useStrategyArbitrage = () =>
  useDealStore((s) => ({
    strategy: s.strategy,
    scores: s.scores,
    resolvedUnitMix: s.resolvedUnitMix,
    totalUnits: s.totalUnits,
    selectedPath: s.getSelectedPath(),
    zoning: s.zoning,
    market: s.market,
    supply: s.supply,
    isDevelopment: s.isDevelopment(),
    projectType: s.projectType,
    productType: s.productType,
    // M08 live slices
    strategyScores: s.strategyScores,
    arbitrageResult: s.arbitrageResult,
    strategyScoresLoading: s.strategyScoresLoading,
    fetchStrategyScores: s.fetchStrategyScores,
    recalculateStrategyScores: s.recalculateStrategyScores,
    fetchArbitrage: s.fetchArbitrage,
  }));

/** M09 ProForma — reads unit mix, assumptions, capital */
export const useProForma = () =>
  useDealStore((s) => ({
    resolvedUnitMix: s.resolvedUnitMix,
    totalUnits: s.totalUnits,
    financial: s.financial,
    capital: s.capital,
    market: s.market,
    selectedPath: s.getSelectedPath(),
    isDevelopment: s.isDevelopment(),
    updateFinancial: s.updateFinancial,
  }));

/** Any module that just needs to know the deal mode and unit count */
export const useDealBasics = () =>
  useDealStore((s) => ({
    id: s.identity.id,
    name: s.identity.name,
    mode: s.identity.mode,
    stage: s.identity.stage,
    totalUnits: s.totalUnits,
    isDevelopment: s.identity.mode === 'development',
  }));

/** Get the canonical DealType from projectType (existing | development | redevelopment) */
export const useDealType = (): DealType => {
  const projectType = useDealStore((s) => s.projectType);
  return getDealType({ projectType });
};

/** Get full deal-type configuration (visible tabs, strategies, templates, etc.) */
export const useDealTypeConfig = () => {
  const projectType = useDealStore((s) => s.projectType);
  return useMemo(() => getDealTypeConfig({ projectType }), [projectType]);
};

/** Get strategy availability based on deal type × product type */
export const useStrategyAvailability = () => {
  const dealType = useDealType();
  const productType = useDealStore((s) => s.productType);

  return useMemo(
    () => ({
      availableStrategies: getStrategyAvailability(dealType, productType),
      getStrengthFor: (strategy: any) => getStrategyStrength(dealType, productType, strategy),
    }),
    [dealType, productType]
  );
};

export const ASSUMPTION_PLATFORM_DEFAULTS: Record<string, number> = {
  'financial.assumptions.exitCapRate': 0.06,
  'financial.assumptions.rentGrowth': 0.03,
  'financial.assumptions.vacancy': 0.05,
  'financial.assumptions.holdPeriod': 5,
  'financial.assumptions.capexPerUnit': 3000,
  'financial.assumptions.managementFee': 0.04,
  'financial.assumptions.expenseGrowth': 0.025,
  'financial.assumptions.loanToValue': 0.65,
  'financial.assumptions.interestRate': 0.055,
  'financial.assumptions.amortization': 30,
  'financial.assumptions.loanTerm': 10,
  'financial.assumptions.closingCosts': 0.02,
  'financial.assumptions.dispositionCosts': 0.02,
  'financial.assumptions.taxRate': 0.25,
  'financial.assumptions.capitalReserves': 250,
  'financial.assumptions.replacementReserves': 300,
  'financial.assumptions.insurancePerUnit': 800,
  'financial.assumptions.realEstateTaxGrowth': 0.02,
  'financial.assumptions.insuranceGrowth': 0.03,
  'financial.assumptions.generalInflation': 0.025,
  'financial.assumptions.tenantImprovements': 15,
  'financial.assumptions.leasingCommissions': 0.04,
  'financial.assumptions.downtime': 30,
  'financial.assumptions.freeRent': 0,
  'financial.assumptions.concessions': 0,
  'financial.assumptions.badDebt': 0.01,
  'financial.assumptions.creditLoss': 0.015,
  'financial.assumptions.otherIncome': 0,
  'financial.assumptions.parkingIncome': 0,
  'financial.assumptions.laundryIncome': 0,
  'financial.assumptions.petRent': 0,
  'financial.assumptions.storageIncome': 0,
  'financial.assumptions.utilityReimbursement': 0,
  'financial.assumptions.contractedRentEscalation': 0.03,
  'financial.assumptions.markToMarket': 0,
  'financial.assumptions.renewalProbability': 0.65,
  'financial.assumptions.developmentFee': 0.04,
  'financial.assumptions.architecturalFee': 0.03,
  'financial.assumptions.constructionContingency': 0.10,
  'financial.assumptions.softCostContingency': 0.05,
  'financial.assumptions.constructionDuration': 18,
  'financial.assumptions.leaseUpDuration': 12,
  'financial.assumptions.stabilizationVacancy': 0.05,
  'financial.assumptions.yieldOnCost': 0.065,
  'financial.assumptions.discountRate': 0.08,
  'financial.assumptions.terminalCapRate': 0.065,
  'financial.assumptions.goingInCapRate': 0.055,
};

export const SENSITIVITY_COEFFICIENTS: Record<string, { label: string; rank: number; unit: string; formatMultiplier: number }> = {
  'financial.assumptions.exitCapRate': { label: 'Exit Cap Rate', rank: 1, unit: '%', formatMultiplier: 100 },
  'financial.assumptions.rentGrowth': { label: 'Rent Growth', rank: 2, unit: '%', formatMultiplier: 100 },
  'financial.assumptions.vacancy': { label: 'Vacancy', rank: 3, unit: '%', formatMultiplier: 100 },
  'financial.assumptions.holdPeriod': { label: 'Hold Period', rank: 4, unit: 'yrs', formatMultiplier: 1 },
  'financial.assumptions.capexPerUnit': { label: 'CapEx / Unit', rank: 5, unit: '$', formatMultiplier: 1 },
  'financial.assumptions.managementFee': { label: 'Mgmt Fee', rank: 6, unit: '%', formatMultiplier: 100 },
  'financial.assumptions.expenseGrowth': { label: 'Expense Growth', rank: 7, unit: '%', formatMultiplier: 100 },
};

export const SENSITIVITY_PATHS = Object.keys(SENSITIVITY_COEFFICIENTS).sort(
  (a, b) => SENSITIVITY_COEFFICIENTS[a].rank - SENSITIVITY_COEFFICIENTS[b].rank
);

/** M09 Assumptions — reads/writes assumption LayeredValues */
export const useAssumptions = () =>
  useDealStore((s) => ({
    assumptions: s.financial.assumptions,
    zoning: s.zoning,
    scores: s.scores,
    cascadeStatus: s.assumptionCascadeStatus,
    editLog: s.editLog,
    updateAssumption: s.updateAssumption,
    revertAssumption: s.revertAssumption,
    revertAllAssumptions: s.revertAllAssumptions,
    toggleVarianceAssumed: s.toggleVarianceAssumed,
  }));

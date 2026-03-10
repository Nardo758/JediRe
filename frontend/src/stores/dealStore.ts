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
import {
  DealContext,
  DealMode,
  DealStage,
  DevelopmentPath,
  UnitMixRow,
  LayeredValue,
  DataSource,
  StrategyType,
  getSelectedPath,
  resolveUnitMix,
  layered,
} from './dealContext.types';

// ---------------------------------------------------------------------------
// Store actions interface
// ---------------------------------------------------------------------------

interface DealStoreActions {
  // ─── LIFECYCLE ────────────────────────────────────────────
  /** Hydrate entire deal context from backend */
  fetchDealContext: (dealId: string) => Promise<void>;
  /** Clear store (on navigate away from deal) */
  clearDeal: () => void;

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

  // ─── GENERIC LAYERED VALUE UPDATES ────────────────────────
  /**
   * Update any layered value in the context.
   * Path is dot-notation: "financial.assumptions.rentGrowth"
   * Preserves existing layers and adds the new one.
   */
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

  // ─── DEAL STAGE ───────────────────────────────────────────
  /** Advance deal to next stage */
  setStage: (stage: DealStage) => void;

  // ─── COMPUTED SELECTORS ───────────────────────────────────
  /** Get the currently selected development path object */
  getSelectedPath: () => DevelopmentPath | null;
  /** Check if deal is in development mode */
  isDevelopment: () => boolean;
  /** Get the base unit mix (before user overrides) */
  getBaseUnitMix: () => UnitMixRow[];
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
    createdAt: '',
    updatedAt: '',
  },
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
  },
  developmentPaths: [],
  selectedDevelopmentPathId: null,
  existingProperty: null,
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

    // ─── LIFECYCLE ────────────────────────────────────────────

    fetchDealContext: async (dealId: string) => {
      try {
        const response = await fetch(`/api/v1/deals/${dealId}/context`);
        if (!response.ok) throw new Error(`Failed to fetch deal context: ${response.status}`);

        const data: DealContext = await response.json();

        // Recompute resolved unit mix from the fetched data
        const { resolvedUnitMix, totalUnits } = recomputeResolvedMix(data);

        set({
          ...data,
          resolvedUnitMix,
          totalUnits,
        });
      } catch (error) {
        console.error('[dealStore] Failed to fetch deal context:', error);
        // In development, fall back to mock data (remove in production)
        // TODO: Replace with proper error handling
      }
    },

    clearDeal: () => {
      set(INITIAL_CONTEXT);
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

      // Navigate to the parent and update the target field
      let current: any = newState;
      for (let i = 0; i < parts.length - 1; i++) {
        current[parts[i]] = { ...current[parts[i]] };
        current = current[parts[i]];
      }

      const key = parts[parts.length - 1];
      const existing = current[key] as LayeredValue<T>;

      current[key] = {
        value,
        source,
        updatedAt: new Date().toISOString(),
        confidence,
        layers: {
          ...existing?.layers,
          [source]: { value, updatedAt: new Date().toISOString(), confidence },
        },
      };

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
  }))
);

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
    site: s.site,
    developmentPaths: s.developmentPaths,
    selectedPathId: s.selectedDevelopmentPathId,
    selectPath: s.selectDevelopmentPath,
    addPath: s.addDevelopmentPath,
    removePath: s.removeDevelopmentPath,
    updatePath: s.updateDevelopmentPath,
  }));

/** M08 Strategy Arbitrage — reads scores, unit mix, zoning */
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

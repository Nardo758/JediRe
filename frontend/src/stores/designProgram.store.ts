/**
 * DesignProgramStore — Zustand store slice for F3 Programming tab → F7 3D Design.
 *
 * Holds the approved program targets (unit mix, amenities, budget) set in the
 * F3 Market → Programming sub-tab and consumed by F7 DesignTargetsPanel.
 *
 * Independent from dealStore to avoid circular deps. Reads developmentEnvelope
 * from dealStore as a passive subscriber.
 *
 * Persistence: loadProgram(dealId) hydrates from the backend on mount.
 * saveProgram(dealId) writes back (called debounced by ProgrammingTab on change).
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { useDealStore } from './dealStore';
import { apiClient } from '../services/api.client';
import type { ProgramTargets, DesignTargets, ApprovedAmenity, UnitMixTarget } from '../types/designTargets.types';
import { DEFAULT_DESIGN_TARGETS } from '../types/designTargets.types';

// ─── State ──────────────────────────────────────────────────────────────────

export interface DesignProgramState {
  /** Approved program targets from F3 Programming tab */
  program: ProgramTargets;
  /** Whether program targets have been explicitly set (vs defaults) */
  isDirty: boolean;
  /** When the program was last updated */
  lastUpdated: number;
  /** Hydration status — null = not attempted, 'loading', 'loaded', 'error' */
  hydrateStatus: null | 'loading' | 'loaded' | 'error';
  /** The dealId that was last successfully hydrated — guards against cross-deal stale data */
  hydratedDealId: string | null;
  /** Save status for the debounced auto-save indicator */
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
}

export interface DesignProgramActions {
  /** Set all program targets at once */
  setProgram: (program: Partial<ProgramTargets>) => void;
  /** Set target unit count */
  setTargetUnits: (n: number) => void;
  /** Set target GFA */
  setTargetGFA: (sf: number) => void;
  /** Set target FAR */
  setTargetFAR: (far: number) => void;
  /** Set target floors */
  setTargetFloors: (n: number) => void;
  /** Set parking ratio */
  setTargetParkingRatio: (ratio: number) => void;
  /** Set target height */
  setTargetHeight: (ft: number) => void;
  /** Set unit mix percentages */
  setUnitMix: (mix: UnitMixTarget) => void;
  /** Add/update an approved amenity */
  upsertAmenity: (amenity: ApprovedAmenity) => void;
  /** Remove an approved amenity */
  removeAmenity: (id: string) => void;
  /** Set the budget */
  setBudget: (total: number, costPerSqft: number) => void;
  /** Build the full DesignTargets for F7 (combines program + zoning envelope) */
  buildDesignTargets: () => DesignTargets;
  /** Reset to defaults */
  reset: () => void;
  /**
   * Hydrate the store from the backend for the given deal.
   * No-ops if already loaded for the same dealId.
   */
  loadProgram: (dealId: string) => Promise<void>;
  /**
   * Persist the current program to the backend for the given deal.
   */
  saveProgram: (dealId: string) => Promise<void>;
}

export type DesignProgramStore = DesignProgramState & DesignProgramActions;

const DEFAULT_STATE: DesignProgramState = {
  program: { ...DEFAULT_DESIGN_TARGETS },
  isDirty: false,
  lastUpdated: Date.now(),
  hydrateStatus: null,
  hydratedDealId: null,
  saveStatus: 'idle',
};

// ─── Store ──────────────────────────────────────────────────────────────────

export const useDesignProgramStore = create<DesignProgramStore>()(
  subscribeWithSelector((set, get) => ({
    ...DEFAULT_STATE,

    setProgram: (partial) =>
      set((s) => ({
        program: { ...s.program, ...partial },
        isDirty: true,
        lastUpdated: Date.now(),
      })),

    setTargetUnits: (n) =>
      set((s) => ({
        program: { ...s.program, targetUnits: n },
        isDirty: true,
        lastUpdated: Date.now(),
      })),

    setTargetGFA: (sf) =>
      set((s) => ({
        program: { ...s.program, targetGFA: sf },
        isDirty: true,
        lastUpdated: Date.now(),
      })),

    setTargetFAR: (far) =>
      set((s) => ({
        program: { ...s.program, targetFAR: far },
        isDirty: true,
        lastUpdated: Date.now(),
      })),

    setTargetFloors: (n) =>
      set((s) => ({
        program: { ...s.program, targetFloors: n },
        isDirty: true,
        lastUpdated: Date.now(),
      })),

    setTargetParkingRatio: (ratio) =>
      set((s) => ({
        program: { ...s.program, targetParkingRatio: ratio },
        isDirty: true,
        lastUpdated: Date.now(),
      })),

    setTargetHeight: (ft) =>
      set((s) => ({
        program: { ...s.program, targetHeight: ft },
        isDirty: true,
        lastUpdated: Date.now(),
      })),

    setUnitMix: (mix) =>
      set((s) => ({
        program: { ...s.program, unitMix: { ...s.program.unitMix, ...mix } },
        isDirty: true,
        lastUpdated: Date.now(),
      })),

    upsertAmenity: (amenity) =>
      set((s) => {
        const existing = s.program.approvedAmenities.find((a) => a.id === amenity.id);
        if (existing) {
          return {
            program: {
              ...s.program,
              approvedAmenities: s.program.approvedAmenities.map((a) =>
                a.id === amenity.id ? { ...a, ...amenity } : a,
              ),
            },
            isDirty: true,
            lastUpdated: Date.now(),
          };
        }
        return {
          program: {
            ...s.program,
            approvedAmenities: [...s.program.approvedAmenities, amenity],
          },
          isDirty: true,
          lastUpdated: Date.now(),
        };
      }),

    removeAmenity: (id) =>
      set((s) => ({
        program: {
          ...s.program,
          approvedAmenities: s.program.approvedAmenities.filter((a) => a.id !== id),
        },
        isDirty: true,
        lastUpdated: Date.now(),
      })),

    setBudget: (total, costPerSqft) =>
      set((s) => ({
        program: {
          ...s.program,
          budget: { total, costPerSqft },
        },
        isDirty: true,
        lastUpdated: Date.now(),
      })),

    buildDesignTargets: () => {
      const state = get();
      const dealStoreState = useDealStore.getState();
      const env = dealStoreState.developmentEnvelope;

      const designTargets: DesignTargets = {
        program: state.program,
      };

      if (env) {
        const maxGfa = env.max_gfa || env.buildable_area_sf || 0;
        designTargets.zoningEnvelope = {
          maxUnits: env.max_units,
          maxGFA: maxGfa,
          maxStories: env.max_stories,
          maxHeight: env.max_stories * 12,
          maxFAR: maxGfa > 0 ? (state.program.targetGFA || maxGfa) / maxGfa : 0,
          bindingConstraint: env.binding_constraint,
        };
        designTargets.program.targetUnits = Math.min(
          state.program.targetUnits,
          env.max_units,
        );
        designTargets.program.targetGFA = Math.min(
          state.program.targetGFA || maxGfa,
          maxGfa,
        );
        designTargets.program.targetFloors = Math.min(
          state.program.targetFloors,
          env.max_stories,
        );
      }

      return designTargets;
    },

    reset: () => set({ ...DEFAULT_STATE, lastUpdated: Date.now() }),

    loadProgram: async (dealId: string) => {
      if (!dealId) return;
      const current = get();
      // Skip only if we are currently loading OR if this exact deal is already loaded.
      // When the user switches deals (hydratedDealId !== dealId), always re-fetch.
      if (current.hydrateStatus === 'loading') return;
      if (current.hydrateStatus === 'loaded' && current.hydratedDealId === dealId) return;

      set({ hydrateStatus: 'loading', hydratedDealId: null });
      try {
        const res = await apiClient.get<{ success: boolean; data: ProgramTargets | null }>(
          `/api/v1/deals/${dealId}/f3-program`,
        );
        const saved = res.data?.data;
        if (saved && typeof saved === 'object') {
          set({
            program: { ...DEFAULT_DESIGN_TARGETS, ...saved },
            isDirty: false,
            lastUpdated: Date.now(),
            hydrateStatus: 'loaded',
            hydratedDealId: dealId,
          });
        } else {
          set({ hydrateStatus: 'loaded', hydratedDealId: dealId });
        }
      } catch {
        set({ hydrateStatus: 'error', hydratedDealId: null });
      }
    },

    saveProgram: async (dealId: string) => {
      if (!dealId) return;
      const { program } = get();
      set({ saveStatus: 'saving' });
      try {
        await apiClient.put(`/api/v1/deals/${dealId}/f3-program`, { program });
        set({ saveStatus: 'saved' });
        setTimeout(() => {
          if (get().saveStatus === 'saved') set({ saveStatus: 'idle' });
        }, 2000);
      } catch {
        set({ saveStatus: 'error' });
      }
    },
  })),
);

// ─── Hook: get DesignTargets for F7 (auto-builds from store + zoning envelope) ──

export function useDesignTargets(): DesignTargets {
  const build = useDesignProgramStore((s) => s.buildDesignTargets);
  useDesignProgramStore((s) => s.lastUpdated);
  useDealStore.subscribe((state) => state.developmentEnvelope);
  return build();
}

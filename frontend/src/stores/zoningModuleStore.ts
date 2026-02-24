import { create } from 'zustand';
import type {
  ZoningTabId,
  Parcel,
  ZoningDistrict,
  Entitlement,
  EntitlementStatus,
  EntitlementType,
  CapacityScenario,
  RegulatoryAlert,
  ComparisonMode,
  TimelineScenario,
  MunicipalBenchmark,
  DealTimeline,
  ZoningModuleState,
} from '../types/zoning.types';

const DEFAULT_LAYERS: Record<string, boolean> = {
  zoningDistricts: true,
  parcelBoundaries: true,
  floodZones: false,
  historicDistricts: false,
  overlayDistricts: false,
  threeDEnvelope: false,
};

export const useZoningModuleStore = create<ZoningModuleState>((set) => ({
  activeTab: 'lookup',
  selectedParcel: null,
  selectedZoning: null,
  entitlements: [],
  entitlementFilter: {
    market: null,
    status: null,
    type: null,
    dealId: null,
    sortBy: 'filedDate',
  },
  capacityScenarios: [],
  regulatoryAlerts: [],
  selectedJurisdiction: null,
  comparisonMode: 'district',
  comparisonA: null,
  comparisonB: null,
  selectedDealForTimeline: null,
  timelineScenario: 'by_right',
  municipalBenchmarks: [],
  dealTimeline: null,
  timelineComparisonMarkets: [],
  layerVisibility: { ...DEFAULT_LAYERS },

  setActiveTab: (tab: ZoningTabId) => set({ activeTab: tab }),

  selectParcel: (parcel: Parcel | null) => set({ selectedParcel: parcel }),

  setSelectedZoning: (zoning: ZoningDistrict | null) => set({ selectedZoning: zoning }),

  setEntitlements: (entitlements: Entitlement[]) => set({ entitlements }),

  updateEntitlementFilter: (filter) =>
    set((state) => ({
      entitlementFilter: { ...state.entitlementFilter, ...filter },
    })),

  setCapacityScenarios: (scenarios: CapacityScenario[]) => set({ capacityScenarios: scenarios }),

  setRegulatoryAlerts: (alerts: RegulatoryAlert[]) => set({ regulatoryAlerts: alerts }),

  setSelectedJurisdiction: (jurisdiction: string | null) => set({ selectedJurisdiction: jurisdiction }),

  setComparisonMode: (mode: ComparisonMode) => set({ comparisonMode: mode }),

  setComparisonItems: (a: any, b: any) => set({ comparisonA: a, comparisonB: b }),

  setTimelineScenario: (scenario: TimelineScenario) => set({ timelineScenario: scenario }),

  setDealTimeline: (timeline: DealTimeline | null) => set({ dealTimeline: timeline }),

  setMunicipalBenchmarks: (benchmarks: MunicipalBenchmark[]) => set({ municipalBenchmarks: benchmarks }),

  toggleLayer: (layerId: string) =>
    set((state) => ({
      layerVisibility: {
        ...state.layerVisibility,
        [layerId]: !state.layerVisibility[layerId],
      },
    })),
}));

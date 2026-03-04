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
  DevelopmentPath,
  BuildingEnvelope,
  SelectedPathData,
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
  activeTab: 'boundary_zoning',
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

  // Phase 2: Development Path Selection
  development_path: null,
  selected_envelope: null,
  selected_path_data: null,
  path_target_code: null,

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

  selectDevelopmentPath: (path: DevelopmentPath | null, envelope: BuildingEnvelope | null, pathData?: SelectedPathData | null) =>
    set({ development_path: path, selected_envelope: envelope, selected_path_data: pathData ?? null }),
}));

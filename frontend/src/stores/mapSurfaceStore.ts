import { create } from 'zustand';
import type {
  MapViewport,
  ParcelRecord,
  LayerConfig,
  CustomOverlay,
  MapAgentContext,
  ParcelSummary,
  TrafficCount,
  SurfaceMode,
} from '../types/map-surface.types';

interface MapSurfaceState {
  // Viewport
  viewport: MapViewport;
  setViewport: (viewport: MapViewport) => void;

  // Mode
  mode: SurfaceMode;
  setMode: (mode: SurfaceMode) => void;

  // Selection
  selectedParcelId: string | null;
  selectedProperty: ParcelRecord | null;
  selectParcel: (parcel: ParcelRecord | null) => void;

  // Loading states
  isLoadingParcels: boolean;
  setIsLoadingParcels: (loading: boolean) => void;

  // Layers
  activeLayers: LayerConfig[];
  toggleLayer: (layerId: string) => void;
  setLayerVisible: (layerId: string, visible: boolean) => void;

  // Custom overlays
  customOverlays: CustomOverlay[];
  addOverlay: (overlay: CustomOverlay) => void;
  removeOverlay: (id: string) => void;

  // Nearby data
  nearbyParcels: ParcelSummary[];
  trafficCounts: TrafficCount[];
  setNearbyParcels: (parcels: ParcelSummary[]) => void;
  setTrafficCounts: (counts: TrafficCount[]) => void;

  // Agent context
  agentContext: MapAgentContext;
  buildAgentContext: () => MapAgentContext;

  // Reset
  reset: () => void;
}

const DEFAULT_VIEWPORT: MapViewport = {
  center: [-84.388, 33.749], // Atlanta default
  zoom: 13,
  bounds: [0, 0, 0, 0],
};

const DEFAULT_LAYERS: LayerConfig[] = [
  { id: 'parcels', name: 'Parcels', visible: true, type: 'parcel' },
  { id: 'traffic', name: 'Traffic Counts', visible: false, type: 'traffic' },
  { id: 'zoning', name: 'Zoning Districts', visible: false, type: 'zoning' },
  { id: 'listings', name: 'Property Listings', visible: false, type: 'listing' },
  { id: 'demographics', name: 'Demographics', visible: false, type: 'demographics' },
];

export const useMapSurfaceStore = create<MapSurfaceState>((set, get) => ({
  // Viewport
  viewport: DEFAULT_VIEWPORT,
  setViewport: (viewport) => set({ viewport }),

  // Mode
  mode: '2d',
  setMode: (mode) => set({ mode }),

  // Selection
  selectedParcelId: null,
  selectedProperty: null,
  selectParcel: (parcel) =>
    set({
      selectedProperty: parcel,
      selectedParcelId: parcel?.parcelId ?? null,
    }),

  // Loading
  isLoadingParcels: false,
  setIsLoadingParcels: (loading) => set({ isLoadingParcels: loading }),

  // Layers
  activeLayers: DEFAULT_LAYERS,
  toggleLayer: (layerId) =>
    set((state) => ({
      activeLayers: state.activeLayers.map((l) =>
        l.id === layerId ? { ...l, visible: !l.visible } : l
      ),
    })),
  setLayerVisible: (layerId, visible) =>
    set((state) => ({
      activeLayers: state.activeLayers.map((l) =>
        l.id === layerId ? { ...l, visible } : l
      ),
    })),

  // Custom overlays
  customOverlays: [],
  addOverlay: (overlay) =>
    set((state) => ({
      customOverlays: [...state.customOverlays, overlay],
    })),
  removeOverlay: (id) =>
    set((state) => ({
      customOverlays: state.customOverlays.filter((o) => o.id !== id),
    })),

  // Nearby data
  nearbyParcels: [],
  trafficCounts: [],
  setNearbyParcels: (nearbyParcels) => set({ nearbyParcels }),
  setTrafficCounts: (trafficCounts) => set({ trafficCounts }),

  // Agent context
  agentContext: {
    viewport: DEFAULT_VIEWPORT,
    visibleLayers: [],
    nearbyParcels: [],
    trafficOnSegment: [],
    listingsInView: [],
    compsInRadius: [],
  },
  buildAgentContext: () => {
    const state = get();
    const ctx: MapAgentContext = {
      viewport: state.viewport,
      visibleLayers: state.activeLayers.filter((l) => l.visible).map((l) => l.id),
      selectedParcel: state.selectedProperty ?? undefined,
      nearbyParcels: state.nearbyParcels,
      trafficOnSegment: state.trafficCounts,
      listingsInView: [],
      compsInRadius: [],
    };
    set({ agentContext: ctx });
    return ctx;
  },

  // Reset
  reset: () =>
    set({
      viewport: DEFAULT_VIEWPORT,
      mode: '2d',
      selectedParcelId: null,
      selectedProperty: null,
      isLoadingParcels: false,
      activeLayers: DEFAULT_LAYERS,
      customOverlays: [],
      nearbyParcels: [],
      trafficCounts: [],
    }),
}));

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Types
export interface SubjectProperty {
  id: string;
  boundary: [number, number][];
  parcelDetails: {
    apn: string;
    zoning: string;
    acres: number;
    owner?: string;
  };
  zoningInfo: {
    type: string;
    maxHeight: number;
    maxFAR: number;
    setbacks: {
      front: number;
      rear: number;
      side: number;
    };
  };
}

export interface CompetingProperty {
  id: string;
  name: string;
  location: [number, number];
  units: number;
  yearBuilt: number;
  monthlyRent: number;
  occupancy: number;
  distance: number;
  visible: boolean;
}

export interface TrafficGenerator {
  id: string;
  name: string;
  type: 'employer' | 'retail' | 'transit' | 'school' | 'entertainment';
  location: [number, number];
  employeeCount?: number;
  visitorTraffic?: number;
  score: number;
}

export interface ResearchItem {
  id: string;
  type: 'permit' | 'market' | 'news' | 'demographic';
  title: string;
  content: string;
  date: Date;
  source: string;
  url?: string;
}

export type MapMode = '2d' | '3d' | 'satellite' | 'split';
export type ViewPanel = 'subject' | 'competition' | 'traffic' | 'research';

export interface LayerVisibility {
  subjectProperty: boolean;
  zoningEnvelope: boolean;
  competition: boolean;
  trafficHeatMap: boolean;
  poi: boolean;
  transit: boolean;
  demographics: boolean;
}

export interface DesignMetrics {
  units: number;
  totalSF: number;
  rentableSF: number;
  efficiency: number;
  parkingSpaces: number;
  parkingRatio: number;
  far: number;
  buildingHeight: number;
  stories: number;
}

export interface FinancialSummary {
  estimatedCost: number;
  estimatedRevenue: number;
  estimatedNOI: number;
  capRate: number;
  returnOnCost: number;
}

// Store State Interface
interface DesignDashboardState {
  // Map & View
  mapMode: MapMode;
  mapCenter: [number, number];
  mapZoom: number;
  activePanel: ViewPanel | null;
  
  // Layers
  layerVisibility: LayerVisibility;
  
  // Data
  subjectProperty: SubjectProperty | null;
  competingProperties: CompetingProperty[];
  trafficGenerators: TrafficGenerator[];
  researchItems: ResearchItem[];
  
  // Design Metrics
  designMetrics: DesignMetrics;
  financialSummary: FinancialSummary | null;
  
  // UI State
  leftSidebarOpen: boolean;
  rightSidebarOpen: boolean;
  bottomPanelOpen: boolean;
  selectedCompetitor: string | null;
  selectedTrafficGen: string | null;
  
  // Actions
  setMapMode: (mode: MapMode) => void;
  setMapView: (center: [number, number], zoom: number) => void;
  setActivePanel: (panel: ViewPanel | null) => void;
  toggleLayer: (layer: keyof LayerVisibility) => void;
  
  // Data Actions
  setSubjectProperty: (property: SubjectProperty | null) => void;
  updateSubjectBoundary: (boundary: [number, number][]) => void;
  
  addCompetitor: (competitor: CompetingProperty) => void;
  updateCompetitor: (id: string, updates: Partial<CompetingProperty>) => void;
  removeCompetitor: (id: string) => void;
  toggleCompetitorVisibility: (id: string) => void;
  
  addTrafficGenerator: (generator: TrafficGenerator) => void;
  updateTrafficGenerator: (id: string, updates: Partial<TrafficGenerator>) => void;
  removeTrafficGenerator: (id: string) => void;
  
  addResearchItem: (item: ResearchItem) => void;
  removeResearchItem: (id: string) => void;
  
  updateDesignMetrics: (metrics: Partial<DesignMetrics>) => void;
  updateFinancialSummary: (summary: FinancialSummary | null) => void;
  
  // UI Actions
  toggleLeftSidebar: () => void;
  toggleRightSidebar: () => void;
  toggleBottomPanel: () => void;
  selectCompetitor: (id: string | null) => void;
  selectTrafficGen: (id: string | null) => void;
  
  // Utility Actions
  clearAllData: () => void;
  exportData: () => any;
  importData: (data: any) => void;
}

// Initial State
const initialState = {
  mapMode: '2d' as MapMode,
  mapCenter: [-118.2437, 34.0522] as [number, number], // Default to LA
  mapZoom: 14,
  activePanel: null,
  
  layerVisibility: {
    subjectProperty: true,
    zoningEnvelope: true,
    competition: true,
    trafficHeatMap: false,
    poi: false,
    transit: false,
    demographics: false,
  },
  
  subjectProperty: null,
  competingProperties: [],
  trafficGenerators: [],
  researchItems: [],
  
  designMetrics: {
    units: 0,
    totalSF: 0,
    rentableSF: 0,
    efficiency: 0.85,
    parkingSpaces: 0,
    parkingRatio: 0,
    far: 0,
    buildingHeight: 0,
    stories: 0,
  },
  
  financialSummary: null,
  
  leftSidebarOpen: true,
  rightSidebarOpen: true,
  bottomPanelOpen: false,
  selectedCompetitor: null,
  selectedTrafficGen: null,
};

// Create Store
export const useDesignDashboardStore = create<DesignDashboardState>()(
  persist(
    (set, get) => ({
      ...initialState,
      
      // Map Actions
      setMapMode: (mode) => set({ mapMode: mode }),
      setMapView: (center, zoom) => set({ mapCenter: center, mapZoom: zoom }),
      setActivePanel: (panel) => set({ activePanel: panel }),
      toggleLayer: (layer) => set((state) => ({
        layerVisibility: {
          ...state.layerVisibility,
          [layer]: !state.layerVisibility[layer],
        },
      })),
      
      // Subject Property Actions
      setSubjectProperty: (property) => set({ subjectProperty: property }),
      updateSubjectBoundary: (boundary) => set((state) => ({
        subjectProperty: state.subjectProperty
          ? { ...state.subjectProperty, boundary }
          : null,
      })),
      
      // Competition Actions
      addCompetitor: (competitor) => set((state) => ({
        competingProperties: [...state.competingProperties, competitor],
      })),
      updateCompetitor: (id, updates) => set((state) => ({
        competingProperties: state.competingProperties.map((c) =>
          c.id === id ? { ...c, ...updates } : c
        ),
      })),
      removeCompetitor: (id) => set((state) => ({
        competingProperties: state.competingProperties.filter((c) => c.id !== id),
      })),
      toggleCompetitorVisibility: (id) => set((state) => ({
        competingProperties: state.competingProperties.map((c) =>
          c.id === id ? { ...c, visible: !c.visible } : c
        ),
      })),
      
      // Traffic Actions
      addTrafficGenerator: (generator) => set((state) => ({
        trafficGenerators: [...state.trafficGenerators, generator],
      })),
      updateTrafficGenerator: (id, updates) => set((state) => ({
        trafficGenerators: state.trafficGenerators.map((g) =>
          g.id === id ? { ...g, ...updates } : g
        ),
      })),
      removeTrafficGenerator: (id) => set((state) => ({
        trafficGenerators: state.trafficGenerators.filter((g) => g.id !== id),
      })),
      
      // Research Actions
      addResearchItem: (item) => set((state) => ({
        researchItems: [...state.researchItems, item],
      })),
      removeResearchItem: (id) => set((state) => ({
        researchItems: state.researchItems.filter((r) => r.id !== id),
      })),
      
      // Metrics Actions
      updateDesignMetrics: (metrics) => set((state) => ({
        designMetrics: { ...state.designMetrics, ...metrics },
      })),
      updateFinancialSummary: (summary) => set({ financialSummary: summary }),
      
      // UI Actions
      toggleLeftSidebar: () => set((state) => ({
        leftSidebarOpen: !state.leftSidebarOpen,
      })),
      toggleRightSidebar: () => set((state) => ({
        rightSidebarOpen: !state.rightSidebarOpen,
      })),
      toggleBottomPanel: () => set((state) => ({
        bottomPanelOpen: !state.bottomPanelOpen,
      })),
      selectCompetitor: (id) => set({ selectedCompetitor: id }),
      selectTrafficGen: (id) => set({ selectedTrafficGen: id }),
      
      // Utility Actions
      clearAllData: () => set({
        subjectProperty: null,
        competingProperties: [],
        trafficGenerators: [],
        researchItems: [],
        designMetrics: initialState.designMetrics,
        financialSummary: null,
        selectedCompetitor: null,
        selectedTrafficGen: null,
      }),
      
      exportData: () => {
        const state = get();
        return {
          subjectProperty: state.subjectProperty,
          competingProperties: state.competingProperties,
          trafficGenerators: state.trafficGenerators,
          researchItems: state.researchItems,
          designMetrics: state.designMetrics,
          financialSummary: state.financialSummary,
        };
      },
      
      importData: (data) => set({
        subjectProperty: data.subjectProperty || null,
        competingProperties: data.competingProperties || [],
        trafficGenerators: data.trafficGenerators || [],
        researchItems: data.researchItems || [],
        designMetrics: data.designMetrics || initialState.designMetrics,
        financialSummary: data.financialSummary || null,
      }),
    }),
    {
      name: 'design-dashboard-storage',
      partialize: (state) => ({
        subjectProperty: state.subjectProperty,
        competingProperties: state.competingProperties,
        trafficGenerators: state.trafficGenerators,
        layerVisibility: state.layerVisibility,
      }),
    }
  )
);
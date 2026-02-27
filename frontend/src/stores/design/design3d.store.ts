/**
 * Zustand Store for 3D Building Design State Management
 * JEDI RE - Building3DEditor Component
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import {
  Design3DState,
  BuildingSection,
  BuildingMetrics,
  EditMode,
  ParcelBoundary,
  ZoningEnvelope,
  ContextBuilding,
  Point3D,
  Design3DSnapshot,
} from '@/types/design/design3d.types';

// ============================================================================
// Store Interface
// ============================================================================

interface Design3DStore extends Design3DState {
  // Actions - Parcel & Zoning
  setParcelBoundary: (parcel: ParcelBoundary | null) => void;
  setZoningEnvelope: (envelope: ZoningEnvelope | null) => void;
  
  // Actions - Building Sections
  addBuildingSection: (section: BuildingSection) => void;
  updateBuildingSection: (id: string, updates: Partial<BuildingSection>) => void;
  removeBuildingSection: (id: string) => void;
  setBuildingSections: (sections: BuildingSection[]) => void;
  
  // Actions - Context Buildings
  addContextBuilding: (building: ContextBuilding) => void;
  setContextBuildings: (buildings: ContextBuilding[]) => void;
  
  // Actions - Selection & Interaction
  selectSection: (id: string | null) => void;
  hoverSection: (id: string | null) => void;
  
  // Actions - Camera
  setCameraPosition: (position: Point3D) => void;
  setCameraTarget: (target: Point3D) => void;
  
  // Actions - View Settings
  toggleParcel: () => void;
  toggleZoningEnvelope: () => void;
  toggleContextBuildings: () => void;
  toggleGrid: () => void;
  toggleMeasurements: () => void;
  setEditMode: (mode: EditMode) => void;
  
  // Actions - Metrics
  updateMetrics: (metrics: Partial<BuildingMetrics>) => void;
  recalculateMetrics: () => void;
  
  // Actions - History (Undo/Redo)
  saveSnapshot: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  
  // Actions - State Management
  reset: () => void;
  loadDesign: (state: Partial<Design3DState>) => void;
  exportState: () => Design3DState;
}

// ============================================================================
// Initial State
// ============================================================================

const initialMetrics: BuildingMetrics = {
  unitCount: 0,
  totalSF: 0,
  residentialSF: 0,
  amenitySF: 0,
  parkingSpaces: 0,
  height: {
    feet: 0,
    stories: 0,
  },
  coverage: {
    percentage: 0,
    buildableArea: 0,
    usedArea: 0,
  },
  efficiency: 0,
  far: 0,
};

const initialState: Design3DState = {
  parcelBoundary: null,
  zoningEnvelope: null,
  buildingSections: [],
  contextBuildings: [],
  metrics: initialMetrics,
  selectedSectionId: null,
  hoveredSectionId: null,
  cameraPosition: { x: 50, y: 50, z: 50 },
  cameraTarget: { x: 0, y: 0, z: 0 },
  showParcel: true,
  showZoningEnvelope: true,
  showContextBuildings: true,
  showGrid: true,
  showMeasurements: false,
  editMode: 'view',
  history: [],
  historyIndex: -1,
  lastUpdated: Date.now(),
  lastSynced: Date.now(),
};

// ============================================================================
// Store Implementation
// ============================================================================

export const useDesign3DStore = create<Design3DStore>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        // Parcel & Zoning
        setParcelBoundary: (parcel) =>
          set({ parcelBoundary: parcel, lastUpdated: Date.now() }),

        setZoningEnvelope: (envelope) =>
          set({ zoningEnvelope: envelope, lastUpdated: Date.now() }),

        // Building Sections
        addBuildingSection: (section) =>
          set((state) => {
            const newState = {
              buildingSections: [...state.buildingSections, section],
              lastUpdated: Date.now(),
            };
            setTimeout(() => get().recalculateMetrics(), 0);
            return newState;
          }),

        updateBuildingSection: (id, updates) =>
          set((state) => {
            const newState = {
              buildingSections: state.buildingSections.map((section) =>
                section.id === id ? { ...section, ...updates } : section
              ),
              lastUpdated: Date.now(),
            };
            setTimeout(() => get().recalculateMetrics(), 0);
            return newState;
          }),

        removeBuildingSection: (id) =>
          set((state) => {
            const newState = {
              buildingSections: state.buildingSections.filter(
                (section) => section.id !== id
              ),
              selectedSectionId:
                state.selectedSectionId === id ? null : state.selectedSectionId,
              lastUpdated: Date.now(),
            };
            setTimeout(() => get().recalculateMetrics(), 0);
            return newState;
          }),

        setBuildingSections: (sections) =>
          set(() => {
            const newState = {
              buildingSections: sections,
              lastUpdated: Date.now(),
            };
            setTimeout(() => get().recalculateMetrics(), 0);
            return newState;
          }),

        // Context Buildings
        addContextBuilding: (building) =>
          set((state) => ({
            contextBuildings: [...state.contextBuildings, building],
            lastUpdated: Date.now(),
          })),

        setContextBuildings: (buildings) =>
          set({ contextBuildings: buildings, lastUpdated: Date.now() }),

        // Selection & Interaction
        selectSection: (id) => set({ selectedSectionId: id }),

        hoverSection: (id) => set({ hoveredSectionId: id }),

        // Camera
        setCameraPosition: (position) => set({ cameraPosition: position }),

        setCameraTarget: (target) => set({ cameraTarget: target }),

        // View Settings
        toggleParcel: () => set((state) => ({ showParcel: !state.showParcel })),

        toggleZoningEnvelope: () =>
          set((state) => ({ showZoningEnvelope: !state.showZoningEnvelope })),

        toggleContextBuildings: () =>
          set((state) => ({
            showContextBuildings: !state.showContextBuildings,
          })),

        toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),

        toggleMeasurements: () =>
          set((state) => ({ showMeasurements: !state.showMeasurements })),

        setEditMode: (mode) => set({ editMode: mode }),

        // Metrics
        updateMetrics: (metrics) =>
          set((state) => ({
            metrics: { ...state.metrics, ...metrics },
            lastUpdated: Date.now(),
          })),

        recalculateMetrics: () => {
          const state = get();
          const { buildingSections, parcelBoundary } = state;

          // Calculate total units and SF
          let totalUnits = 0;
          let totalSF = 0;
          let maxHeight = 0;
          let maxStories = 0;

          buildingSections.forEach((section) => {
            const sectionArea =
              section.geometry.footprint.points.reduce((sum, point, i, arr) => {
                const next = arr[(i + 1) % arr.length];
                return sum + (point.x * next.z - next.x * point.z);
              }, 0) / 2;

            const floors = section.geometry.floors;
            const floorArea = Math.abs(sectionArea);
            totalSF += floorArea * floors;
            totalUnits += Math.floor((floorArea * floors) / 750); // Estimate: avg 750 SF per unit

            if (section.geometry.height > maxHeight) {
              maxHeight = section.geometry.height;
              maxStories = floors;
            }
          });

          // Calculate coverage
          const parcelArea = parcelBoundary?.area || 1;
          const usedArea = buildingSections.reduce((sum, section) => {
            const footprintArea = Math.abs(
              section.geometry.footprint.points.reduce((s, point, i, arr) => {
                const next = arr[(i + 1) % arr.length];
                return s + (point.x * next.z - next.x * point.z);
              }, 0) / 2
            );
            return sum + footprintArea;
          }, 0);

          const coverage = (usedArea / parcelArea) * 100;

          // Estimate parking (0.8 spaces per unit for multifamily)
          const parkingSpaces = Math.floor(totalUnits * 0.8);

          // Estimate amenity space (5% of residential SF)
          const residentialSF = totalSF * 0.95;
          const amenitySF = totalSF * 0.05;

          // Calculate efficiency (assume 85% for multifamily)
          const efficiency = 85;

          // Calculate FAR
          const far = totalSF / parcelArea;

          set({
            metrics: {
              unitCount: totalUnits,
              totalSF: Math.round(totalSF),
              residentialSF: Math.round(residentialSF),
              amenitySF: Math.round(amenitySF),
              parkingSpaces,
              height: {
                feet: Math.round(maxHeight),
                stories: maxStories,
              },
              coverage: {
                percentage: Math.round(coverage * 10) / 10,
                buildableArea: Math.round(parcelArea),
                usedArea: Math.round(usedArea),
              },
              efficiency,
              far: Math.round(far * 100) / 100,
            },
          });
        },

        // History (Undo/Redo)
        saveSnapshot: () =>
          set((state) => {
            const snapshot: Design3DSnapshot = {
              timestamp: Date.now(),
              buildingSections: JSON.parse(
                JSON.stringify(state.buildingSections)
              ),
              metrics: { ...state.metrics },
            };

            const newHistory = state.history.slice(0, state.historyIndex + 1);
            newHistory.push(snapshot);

            // Limit history to 50 snapshots
            if (newHistory.length > 50) {
              newHistory.shift();
            }

            return {
              history: newHistory,
              historyIndex: newHistory.length - 1,
            };
          }),

        undo: () => {
          const state = get();
          if (!state.canUndo()) return;

          const prevIndex = state.historyIndex - 1;
          const snapshot = state.history[prevIndex];

          set({
            buildingSections: JSON.parse(
              JSON.stringify(snapshot.buildingSections)
            ),
            metrics: { ...snapshot.metrics },
            historyIndex: prevIndex,
            lastUpdated: Date.now(),
          });
        },

        redo: () => {
          const state = get();
          if (!state.canRedo()) return;

          const nextIndex = state.historyIndex + 1;
          const snapshot = state.history[nextIndex];

          set({
            buildingSections: JSON.parse(
              JSON.stringify(snapshot.buildingSections)
            ),
            metrics: { ...snapshot.metrics },
            historyIndex: nextIndex,
            lastUpdated: Date.now(),
          });
        },

        canUndo: () => {
          const state = get();
          return state.historyIndex > 0;
        },

        canRedo: () => {
          const state = get();
          return state.historyIndex < state.history.length - 1;
        },

        // State Management
        reset: () => set({ ...initialState, lastUpdated: Date.now() }),

        loadDesign: (partialState) =>
          set((state) => ({
            ...state,
            ...partialState,
            lastUpdated: Date.now(),
            lastSynced: Date.now(),
          })),

        exportState: () => {
          const state = get();
          return {
            parcelBoundary: state.parcelBoundary,
            zoningEnvelope: state.zoningEnvelope,
            buildingSections: state.buildingSections,
            contextBuildings: state.contextBuildings,
            metrics: state.metrics,
            selectedSectionId: state.selectedSectionId,
            hoveredSectionId: state.hoveredSectionId,
            cameraPosition: state.cameraPosition,
            cameraTarget: state.cameraTarget,
            showParcel: state.showParcel,
            showZoningEnvelope: state.showZoningEnvelope,
            showContextBuildings: state.showContextBuildings,
            showGrid: state.showGrid,
            showMeasurements: state.showMeasurements,
            editMode: state.editMode,
            history: state.history,
            historyIndex: state.historyIndex,
            lastUpdated: state.lastUpdated,
            lastSynced: state.lastSynced,
          };
        },
      }),
      {
        name: 'design3d-storage',
        partialize: (state) => ({
          // Only persist essential data
          parcelBoundary: state.parcelBoundary,
          zoningEnvelope: state.zoningEnvelope,
          buildingSections: state.buildingSections,
          metrics: state.metrics,
          showParcel: state.showParcel,
          showZoningEnvelope: state.showZoningEnvelope,
          showContextBuildings: state.showContextBuildings,
          showGrid: state.showGrid,
        }),
      }
    ),
    { name: 'Design3D' }
  )
);

// ============================================================================
// Selectors (for optimized re-renders)
// ============================================================================

export const selectBuildingSections = (state: Design3DStore) =>
  state.buildingSections;

export const selectMetrics = (state: Design3DStore) => state.metrics;

export const selectSelectedSection = (state: Design3DStore) =>
  state.buildingSections.find((s) => s.id === state.selectedSectionId);

export const selectViewSettings = (state: Design3DStore) => ({
  showParcel: state.showParcel,
  showZoningEnvelope: state.showZoningEnvelope,
  showContextBuildings: state.showContextBuildings,
  showGrid: state.showGrid,
  showMeasurements: state.showMeasurements,
});

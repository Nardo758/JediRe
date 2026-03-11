/**
 * Deal Data Store - Centralized persistence for all deal-related data
 * Handles 3D design, market analysis, competition, supply, due diligence, and timeline data
 * Features: LocalStorage backup, IndexedDB for large data, API sync, auto-save
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { apiClient } from '../services/api.client';
import type { Design3D } from '../types/financial.types';
import type { Deal } from '../types/deal';

// ===== TYPE DEFINITIONS =====

export interface MarketAnalysisData {
  demographics?: any;
  economicIndicators?: any;
  supplyDemand?: any;
  rentTrends?: any;
  lastUpdated?: string;
}

export interface CompetitionData {
  competitors?: any[];
  marketPosition?: any;
  swotAnalysis?: any;
  lastUpdated?: string;
}

export interface SupplyPipelineData {
  projects?: any[];
  timeline?: any;
  impact?: any;
  lastUpdated?: string;
}

export interface DDData {
  documents?: any[];
  findings?: any;
  risks?: any[];
  lastUpdated?: string;
}

export interface TimelineData {
  milestones?: any[];
  schedule?: any;
  critical?: any[];
  lastUpdated?: string;
}

export interface DealSnapshot {
  id: string;
  dealId: string;
  snapshotData: any;
  createdAt: string;
  name?: string;
}

interface DealDataState {
  // Current deal data
  currentDeal: Deal | null;
  design3D: Design3D | null;
  marketAnalysis: MarketAnalysisData | null;
  competitionData: CompetitionData | null;
  supplyData: SupplyPipelineData | null;
  dueDiligenceData: DDData | null;
  timelineData: TimelineData | null;
  
  // State tracking
  isLoading: boolean;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  lastSaved: string | null;
  error: string | null;
  
  // Version control
  version: number;
  snapshots: DealSnapshot[];
}

interface DealDataActions {
  // Data updates
  updateDeal: (deal: Partial<Deal>) => void;
  updateDesign3D: (design: Design3D) => void;
  updateMarketAnalysis: (data: MarketAnalysisData) => void;
  updateCompetitionData: (data: CompetitionData) => void;
  updateSupplyData: (data: SupplyPipelineData) => void;
  updateDueDiligenceData: (data: DDData) => void;
  updateTimelineData: (data: TimelineData) => void;
  
  // Persistence
  saveToDB: () => Promise<void>;
  loadFromDB: (dealId: string) => Promise<void>;
  clearDeal: () => void;
  
  // Snapshot management
  createSnapshot: (name?: string) => Promise<void>;
  loadSnapshots: (dealId: string) => Promise<void>;
  restoreSnapshot: (snapshotId: string) => Promise<void>;
  
  // State management
  setHasUnsavedChanges: (value: boolean) => void;
  setError: (error: string | null) => void;
}

export type DealDataStore = DealDataState & DealDataActions;

// ===== INDEXEDDB SETUP =====

const DB_NAME = 'jedire-deal-data';
const DB_VERSION = 1;
const STORE_NAME = 'design3d';

let db: IDBDatabase | null = null;

const initIndexedDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }
    
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    
    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'dealId' });
      }
    };
  });
};

const saveToIndexedDB = async (dealId: string, design3D: Design3D): Promise<void> => {
  try {
    const database = await initIndexedDB();
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    await new Promise<void>((resolve, reject) => {
      const request = store.put({ dealId, design3D, savedAt: new Date().toISOString() });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to save to IndexedDB:', error);
  }
};

const loadFromIndexedDB = async (dealId: string): Promise<Design3D | null> => {
  try {
    const database = await initIndexedDB();
    const transaction = database.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    
    return new Promise((resolve, reject) => {
      const request = store.get(dealId);
      request.onsuccess = () => {
        const result = request.result;
        resolve(result?.design3D || null);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to load from IndexedDB:', error);
    return null;
  }
};

// ===== ZUSTAND STORE =====

export const useDealDataStore = create<DealDataStore>()(
  persist(
    (set, get) => ({
      // Initial state
      currentDeal: null,
      design3D: null,
      marketAnalysis: null,
      competitionData: null,
      supplyData: null,
      dueDiligenceData: null,
      timelineData: null,
      isLoading: false,
      isSaving: false,
      hasUnsavedChanges: false,
      lastSaved: null,
      error: null,
      version: 1,
      snapshots: [],
      
      // Update deal
      updateDeal: (deal) => {
        set((state) => ({
          currentDeal: state.currentDeal ? { ...state.currentDeal, ...deal } : null,
          hasUnsavedChanges: true,
        }));
      },
      
      // Update design3D
      updateDesign3D: (design) => {
        set({
          design3D: design,
          hasUnsavedChanges: true,
        });
        
        // Save large 3D data to IndexedDB
        if (design.dealId) {
          saveToIndexedDB(design.dealId, design);
        }
      },
      
      // Update market analysis
      updateMarketAnalysis: (data) => {
        set({
          marketAnalysis: data,
          hasUnsavedChanges: true,
        });
      },
      
      // Update competition data
      updateCompetitionData: (data) => {
        set({
          competitionData: data,
          hasUnsavedChanges: true,
        });
      },
      
      // Update supply pipeline data
      updateSupplyData: (data) => {
        set({
          supplyData: data,
          hasUnsavedChanges: true,
        });
      },
      
      // Update due diligence data
      updateDueDiligenceData: (data) => {
        set({
          dueDiligenceData: data,
          hasUnsavedChanges: true,
        });
      },
      
      // Update timeline data
      updateTimelineData: (data) => {
        set({
          timelineData: data,
          hasUnsavedChanges: true,
        });
      },
      
      // Save to database
      saveToDB: async () => {
        const state = get();
        
        if (!state.currentDeal?.id || state.isSaving) {
          return;
        }
        
        set({ isSaving: true, error: null });
        
        try {
          const dealId = state.currentDeal.id;
          
          // Prepare state data (exclude design3D from API call as it's in IndexedDB)
          const stateData = {
            design_3d: state.design3D ? { id: state.design3D.id, dealId } : null, // Reference only
            market_analysis: state.marketAnalysis,
            competition_data: state.competitionData,
            supply_data: state.supplyData,
            due_diligence: state.dueDiligenceData,
            timeline_data: state.timelineData,
            version: state.version,
          };
          
          // Save to backend
          await apiClient.post(`/api/v1/deals/${dealId}/state`, stateData);
          
          set({
            isSaving: false,
            hasUnsavedChanges: false,
            lastSaved: new Date().toISOString(),
            version: state.version + 1,
          });
        } catch (error: any) {
          console.error('Failed to save deal state:', error);
          set({
            isSaving: false,
            error: error.response?.data?.message || error.message || 'Failed to save',
          });
        }
      },
      
      // Load from database
      loadFromDB: async (dealId: string) => {
        set({ isLoading: true, error: null });
        
        try {
          // Load deal state from API
          const response = await apiClient.get(`/api/v1/deals/${dealId}/state`);
          const data = response.data;
          
          // Load 3D design from IndexedDB
          const design3D = await loadFromIndexedDB(dealId);
          
          set({
            currentDeal: data.deal || null,
            design3D: design3D || data.design_3d || null,
            marketAnalysis: data.market_analysis || null,
            competitionData: data.competition_data || null,
            supplyData: data.supply_data || null,
            dueDiligenceData: data.due_diligence || null,
            timelineData: data.timeline_data || null,
            version: data.version || 1,
            lastSaved: data.last_saved || null,
            isLoading: false,
            hasUnsavedChanges: false,
          });
        } catch (error: any) {
          console.error('Failed to load deal state:', error);
          set({
            isLoading: false,
            error: error.response?.data?.message || error.message || 'Failed to load',
          });
        }
      },
      
      // Clear current deal
      clearDeal: () => {
        set({
          currentDeal: null,
          design3D: null,
          marketAnalysis: null,
          competitionData: null,
          supplyData: null,
          dueDiligenceData: null,
          timelineData: null,
          hasUnsavedChanges: false,
          lastSaved: null,
          error: null,
          version: 1,
          snapshots: [],
        });
      },
      
      // Create snapshot
      createSnapshot: async (name?: string) => {
        const state = get();
        
        if (!state.currentDeal?.id) {
          return;
        }
        
        try {
          const dealId = state.currentDeal.id;
          
          const snapshotData = {
            design_3d: state.design3D,
            market_analysis: state.marketAnalysis,
            competition_data: state.competitionData,
            supply_data: state.supplyData,
            due_diligence: state.dueDiligenceData,
            timeline_data: state.timelineData,
            name: name || `Snapshot ${new Date().toLocaleString()}`,
          };
          
          const response = await apiClient.post(`/api/v1/deals/${dealId}/snapshots`, snapshotData);
          const snapshot = response.data;
          
          set((state) => ({
            snapshots: [...state.snapshots, snapshot],
          }));
        } catch (error: any) {
          console.error('Failed to create snapshot:', error);
          set({
            error: error.response?.data?.message || error.message || 'Failed to create snapshot',
          });
        }
      },
      
      // Load snapshots
      loadSnapshots: async (dealId: string) => {
        try {
          const response = await apiClient.get(`/api/v1/deals/${dealId}/snapshots`);
          const snapshots = response.data;
          
          set({ snapshots });
        } catch (error: any) {
          console.error('Failed to load snapshots:', error);
          set({
            error: error.response?.data?.message || error.message || 'Failed to load snapshots',
          });
        }
      },
      
      // Restore snapshot
      restoreSnapshot: async (snapshotId: string) => {
        const state = get();
        
        if (!state.currentDeal?.id) {
          return;
        }
        
        try {
          const dealId = state.currentDeal.id;
          
          const response = await apiClient.post(`/api/v1/deals/${dealId}/restore`, {
            snapshot_id: snapshotId,
          });
          
          const data = response.data;
          
          set({
            design3D: data.design_3d || null,
            marketAnalysis: data.market_analysis || null,
            competitionData: data.competition_data || null,
            supplyData: data.supply_data || null,
            dueDiligenceData: data.due_diligence || null,
            timelineData: data.timeline_data || null,
            hasUnsavedChanges: true,
          });
          
          // Save restored 3D design to IndexedDB
          if (data.design_3d) {
            await saveToIndexedDB(dealId, data.design_3d);
          }
        } catch (error: any) {
          console.error('Failed to restore snapshot:', error);
          set({
            error: error.response?.data?.message || error.message || 'Failed to restore snapshot',
          });
        }
      },
      
      // Set unsaved changes flag
      setHasUnsavedChanges: (value) => {
        set({ hasUnsavedChanges: value });
      },
      
      // Set error
      setError: (error) => {
        set({ error });
      },
    }),
    {
      name: 'deal-data-storage',
      storage: createJSONStorage(() => localStorage),
      // Only persist non-volatile state to localStorage (not large 3D data)
      partialize: (state) => ({
        currentDeal: state.currentDeal,
        marketAnalysis: state.marketAnalysis,
        competitionData: state.competitionData,
        supplyData: state.supplyData,
        dueDiligenceData: state.dueDiligenceData,
        timelineData: state.timelineData,
        lastSaved: state.lastSaved,
        version: state.version,
      }),
    }
  )
);

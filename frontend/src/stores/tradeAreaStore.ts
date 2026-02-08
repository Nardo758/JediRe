import { create } from 'zustand';
import { DefinitionMethod, TradeArea, TradeAreaStats, GeographicScope } from '../types/trade-area';
import { api } from '../services/api';

interface TradeAreaStore {
  // Active context for current deal/property
  activeTradeArea: TradeArea | null;
  activeScope: GeographicScope;
  
  // Trade area creation state
  definitionMethod: DefinitionMethod | null;
  isDrawing: boolean;
  draftGeometry: GeoJSON.Polygon | null;
  radiusMiles: number;
  driveTimeMinutes: number;
  driveTimeProfile: 'driving' | 'walking';
  previewStats: TradeAreaStats | null;
  
  // Actions
  setScope: (scope: GeographicScope) => void;
  setDefinitionMethod: (method: DefinitionMethod) => void;
  setRadiusMiles: (miles: number) => void;
  setDriveTimeMinutes: (minutes: number) => void;
  setDriveTimeProfile: (profile: 'driving' | 'walking') => void;
  updateDraftGeometry: (geometry: GeoJSON.Polygon) => void;
  loadPreviewStats: (geometry: GeoJSON.Polygon) => Promise<void>;
  saveTradeArea: (name: string) => Promise<TradeArea>;
  loadTradeAreaForDeal: (dealId: number) => Promise<void>;
  clearDraft: () => void;
  setActiveTradeArea: (tradeArea: TradeArea | null) => void;
  
  // Generate radius circle
  generateRadiusCircle: (lat: number, lng: number, miles: number) => Promise<GeoJSON.Polygon>;
}

export const useTradeAreaStore = create<TradeAreaStore>((set, get) => ({
  // Initial state
  activeTradeArea: null,
  activeScope: 'submarket',
  definitionMethod: null,
  isDrawing: false,
  draftGeometry: null,
  radiusMiles: 3,
  driveTimeMinutes: 10,
  driveTimeProfile: 'driving',
  previewStats: null,
  
  // Actions
  setScope: (scope) => set({ activeScope: scope }),
  
  setDefinitionMethod: (method) => set({ 
    definitionMethod: method,
    isDrawing: method === 'custom_draw',
  }),
  
  setRadiusMiles: (miles) => set({ radiusMiles: miles }),
  
  setDriveTimeMinutes: (minutes) => set({ driveTimeMinutes: minutes }),
  
  setDriveTimeProfile: (profile) => set({ driveTimeProfile: profile }),
  
  updateDraftGeometry: (geometry) => {
    set({ draftGeometry: geometry });
    
    // Auto-load preview stats when geometry changes
    if (geometry) {
      get().loadPreviewStats(geometry);
    }
  },
  
  loadPreviewStats: async (geometry) => {
    try {
      const response = await api.post('/trade-areas/preview-stats', { geometry });
      set({ previewStats: response.data.data });
    } catch (error) {
      console.error('Error loading preview stats:', error);
      set({ previewStats: null });
    }
  },
  
  saveTradeArea: async (name) => {
    const { draftGeometry, definitionMethod, radiusMiles, driveTimeMinutes, driveTimeProfile } = get();
    
    if (!draftGeometry || !definitionMethod) {
      throw new Error('Geometry and definition method are required');
    }
    
    const method_params: any = {};
    if (definitionMethod === 'radius') {
      method_params.radius_miles = radiusMiles;
      method_params.traffic_adjusted = false; // TODO: Implement traffic adjustment
    } else if (definitionMethod === 'drive_time') {
      method_params.drive_time_minutes = driveTimeMinutes;
      method_params.profile = driveTimeProfile;
    }
    
    const response = await api.post('/trade-areas', {
      name,
      geometry: draftGeometry,
      definition_method: definitionMethod,
      method_params,
    });
    
    const tradeArea = response.data.data;
    set({ activeTradeArea: tradeArea });
    
    return tradeArea;
  },
  
  loadTradeAreaForDeal: async (dealId) => {
    try {
      const response = await api.get(`/deals/${dealId}/geographic-context`);
      const context = response.data.data;
      
      set({
        activeTradeArea: context.trade_area || null,
        activeScope: context.active_scope,
      });
    } catch (error) {
      console.error('Error loading trade area for deal:', error);
    }
  },
  
  clearDraft: () => set({
    definitionMethod: null,
    isDrawing: false,
    draftGeometry: null,
    previewStats: null,
  }),
  
  setActiveTradeArea: (tradeArea) => set({ activeTradeArea: tradeArea }),
  
  generateRadiusCircle: async (lat, lng, miles) => {
    try {
      const response = await api.post('/trade-areas/radius', { lat, lng, miles });
      const geometry = response.data.data.geometry;
      set({ draftGeometry: geometry });
      return geometry;
    } catch (error) {
      console.error('Error generating radius circle:', error);
      throw error;
    }
  },
}));

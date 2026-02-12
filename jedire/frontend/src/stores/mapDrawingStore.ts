import { create } from 'zustand';

/**
 * Shared state for map drawing across Dashboard and modals
 * Allows CreateDealModal to trigger drawing on Dashboard map
 */

interface MapDrawingStore {
  // Drawing state
  isDrawing: boolean;
  drawingMode: 'boundary' | 'trade-area' | null;
  drawnGeometry: GeoJSON.Polygon | null;
  centerPoint: [number, number] | null; // Property location to center map
  
  // Control
  startDrawing: (mode: 'boundary' | 'trade-area', center?: [number, number]) => void;
  stopDrawing: () => void;
  saveDrawing: (geometry: GeoJSON.Polygon) => void;
  clearDrawing: () => void;
}

export const useMapDrawingStore = create<MapDrawingStore>((set) => ({
  isDrawing: false,
  drawingMode: null,
  drawnGeometry: null,
  centerPoint: null,
  
  startDrawing: (mode, center) => {
    console.log('[MapDrawing] Starting drawing:', { mode, center });
    set({ 
      isDrawing: true, 
      drawingMode: mode,
      centerPoint: center || null,
      drawnGeometry: null // Clear previous drawing
    });
  },
  
  stopDrawing: () => {
    console.log('[MapDrawing] Stopping drawing');
    set({ 
      isDrawing: false,
      drawingMode: null,
    });
  },
  
  saveDrawing: (geometry) => {
    console.log('[MapDrawing] Saving drawing:', geometry);
    set({ drawnGeometry: geometry });
  },
  
  clearDrawing: () => {
    console.log('[MapDrawing] Clearing drawing');
    set({ 
      drawnGeometry: null,
      isDrawing: false,
      drawingMode: null,
      centerPoint: null,
    });
  },
}));

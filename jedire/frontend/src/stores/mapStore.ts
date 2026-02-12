import { create } from 'zustand';

export interface Property {
  id: string;
  address: string;
  city: string;
  state: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  lat: number;
  lng: number;
  photos: string[];
  property_type: string;
  listing_status: string;
  lease_expiration_date?: string;
  current_lease_amount?: number;
  lease_start_date?: string;
  renewal_status?: 'renewed' | 'expiring' | 'month_to_month' | 'unknown';
}

interface MapState {
  properties: Property[];
  selectedProperty: Property | null;
  mapCenter: [number, number];
  mapZoom: number;
  
  // Actions
  setProperties: (properties: Property[]) => void;
  selectProperty: (property: Property | null) => void;
  setMapView: (center: [number, number], zoom: number) => void;
  clearProperties: () => void;
}

export const useMapStore = create<MapState>((set) => ({
  properties: [],
  selectedProperty: null,
  mapCenter: [-84.3880, 33.7490], // Atlanta default
  mapZoom: 11,
  
  setProperties: (properties) => set({ properties }),
  selectProperty: (selectedProperty) => set({ selectedProperty }),
  setMapView: (mapCenter, mapZoom) => set({ mapCenter, mapZoom }),
  clearProperties: () => set({ properties: [], selectedProperty: null }),
}));

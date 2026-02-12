import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../services/api.client';

interface Property {
  id: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  lat: number;
  lng: number;
  rent: number;
  beds: number;
  baths: number;
  sqft: number;
  building_class?: string;
  lease_expiration_date?: string;
  current_lease_amount?: number;
}

interface PropertyFilters {
  city?: string;
  minRent?: number;
  maxRent?: number;
  beds?: number;
  building_class?: string;
  neighborhood?: string;
}

interface PropertyStore {
  properties: Property[];
  selectedProperty: Property | null;
  filters: PropertyFilters;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  fetchProperties: (filters?: PropertyFilters) => Promise<void>;
  selectProperty: (property: Property | null) => void;
  setFilters: (filters: PropertyFilters) => void;
  searchProperties: (query: any) => Promise<void>;
  clearProperties: () => void;
}

export const usePropertyStore = create<PropertyStore>()(
  persist(
    (set, get) => ({
      properties: [],
      selectedProperty: null,
      filters: {},
      isLoading: false,
      error: null,

      fetchProperties: async (filters) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.properties.list(filters);
          set({ properties: response.data, isLoading: false });
        } catch (error: any) {
          set({
            error: error.message || 'Failed to fetch properties',
            isLoading: false,
          });
        }
      },

      selectProperty: (property) => {
        set({ selectedProperty: property });
      },

      setFilters: (filters) => {
        set({ filters });
        get().fetchProperties(filters);
      },

      searchProperties: async (query) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.properties.search(query);
          set({ properties: response.data, isLoading: false });
        } catch (error: any) {
          set({
            error: error.message || 'Search failed',
            isLoading: false,
          });
        }
      },

      clearProperties: () => {
        set({ properties: [], selectedProperty: null, filters: {}, error: null });
      },
    }),
    {
      name: 'property-store',
      partialize: (state) => ({
        filters: state.filters,
        // Don't persist properties or selectedProperty
      }),
    }
  )
);

import { create } from 'zustand';
import { Property, User, MapFilter, ModuleType, CollaborationUser } from '@/types';

interface AppState {
  // User
  user: User | null;
  setUser: (user: User | null) => void;
  
  // Properties
  properties: Property[];
  selectedProperty: Property | null;
  setProperties: (properties: Property[]) => void;
  setSelectedProperty: (property: Property | null) => void;
  updateProperty: (propertyId: string, updates: Partial<Property>) => void;
  
  // Map
  mapCenter: [number, number];
  mapZoom: number;
  setMapCenter: (center: [number, number]) => void;
  setMapZoom: (zoom: number) => void;
  
  // Filters
  filters: MapFilter;
  setFilters: (filters: MapFilter) => void;
  
  // Modules
  activeModules: ModuleType[];
  toggleModule: (module: ModuleType) => void;
  
  // Collaboration
  collaborators: CollaborationUser[];
  setCollaborators: (users: CollaborationUser[]) => void;
  
  // UI
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  
  // Loading
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // User
  user: null,
  setUser: (user) => set({ user }),
  
  // Properties
  properties: [],
  selectedProperty: null,
  setProperties: (properties) => set({ properties }),
  setSelectedProperty: (property) => set({ selectedProperty: property }),
  updateProperty: (propertyId, updates) =>
    set((state) => ({
      properties: state.properties.map((p) =>
        p.id === propertyId ? { ...p, ...updates } : p
      ),
      selectedProperty:
        state.selectedProperty?.id === propertyId
          ? { ...state.selectedProperty, ...updates }
          : state.selectedProperty,
    })),
  
  // Map
  mapCenter: [-97.7431, 30.2672], // Austin, TX default
  mapZoom: 12,
  setMapCenter: (center) => set({ mapCenter: center }),
  setMapZoom: (zoom) => set({ mapZoom: zoom }),
  
  // Filters
  filters: {},
  setFilters: (filters) => set({ filters }),
  
  // Modules
  activeModules: ['zoning', 'supply', 'cashflow'],
  toggleModule: (module) =>
    set((state) => ({
      activeModules: state.activeModules.includes(module)
        ? state.activeModules.filter((m) => m !== module)
        : [...state.activeModules, module],
    })),
  
  // Collaboration
  collaborators: [],
  setCollaborators: (users) => set({ collaborators: users }),
  
  // UI
  sidebarOpen: true,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  
  // Loading
  isLoading: false,
  setIsLoading: (loading) => set({ isLoading: loading }),
}));

import { create } from 'zustand';
import { api } from '../services/api.client';
import type { Deal } from '../types/deal';

interface DealStore {
  // State
  deals: Deal[];
  selectedDealId: string | null;
  selectedDeal: Deal | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchDeals: () => Promise<void>;
  fetchDealById: (dealId: string) => Promise<void>;
  setSelectedDeal: (dealId: string | null) => void;
  createDeal: (dealData: any) => Promise<Deal>;
  updateDeal: (dealId: string, updates: any) => Promise<void>;
  deleteDeal: (dealId: string) => Promise<void>;
}

export const useDealStore = create<DealStore>((set, get) => ({
  // Initial state
  deals: [],
  selectedDealId: null,
  selectedDeal: null,
  isLoading: false,
  error: null,

  // Fetch all deals for current user
  fetchDeals: async () => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await api.deals.list();
      const data = response.data;
      const dealsList = Array.isArray(data) ? data : (Array.isArray(data?.deals) ? data.deals : []);
      set({ 
        deals: dealsList,
        isLoading: false 
      });
    } catch (error: any) {
      set({ 
        error: error.response?.data?.message || error.message || 'Failed to fetch deals',
        isLoading: false 
      });
    }
  },

  // Fetch a single deal by ID
  fetchDealById: async (dealId: string) => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await api.deals.get(dealId);
      const data = response.data;
      const deal = data?.deal || data;
      set({ 
        selectedDeal: deal,
        selectedDealId: dealId,
        isLoading: false 
      });
    } catch (error: any) {
      set({ 
        error: error.response?.data?.message || error.message || 'Failed to fetch deal',
        isLoading: false 
      });
    }
  },

  // Set selected deal
  setSelectedDeal: (dealId: string | null) => {
    if (dealId) {
      get().fetchDealById(dealId);
    } else {
      set({ 
        selectedDealId: null,
        selectedDeal: null 
      });
    }
  },

  // Create a new deal
  createDeal: async (dealData: any) => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await api.deals.create(dealData);
      const respData = response.data;
      const newDeal = respData?.deal || respData;
      
      set((state) => ({ 
        deals: [newDeal, ...state.deals],
        isLoading: false 
      }));
      
      return newDeal;
    } catch (error: any) {
      set({ 
        error: error.response?.data?.message || error.message || 'Failed to create deal',
        isLoading: false 
      });
      throw error;
    }
  },

  // Update a deal
  updateDeal: async (dealId: string, updates: any) => {
    set({ isLoading: true, error: null });
    
    try {
      await api.deals.update(dealId, updates);
      
      // Refresh deal list
      await get().fetchDeals();
      
      // Refresh selected deal if it's the one we updated
      if (get().selectedDealId === dealId) {
        await get().fetchDealById(dealId);
      }
      
      set({ isLoading: false });
    } catch (error: any) {
      set({ 
        error: error.response?.data?.message || error.message || 'Failed to update deal',
        isLoading: false 
      });
      throw error;
    }
  },

  // Delete (archive) a deal
  deleteDeal: async (dealId: string) => {
    set({ isLoading: true, error: null });
    
    try {
      await api.deals.delete(dealId);
      
      set((state) => ({ 
        deals: state.deals.filter(d => d.id !== dealId),
        selectedDealId: state.selectedDealId === dealId ? null : state.selectedDealId,
        selectedDeal: state.selectedDealId === dealId ? null : state.selectedDeal,
        isLoading: false 
      }));
    } catch (error: any) {
      set({ 
        error: error.response?.data?.message || error.message || 'Failed to delete deal',
        isLoading: false 
      });
      throw error;
    }
  }
}));

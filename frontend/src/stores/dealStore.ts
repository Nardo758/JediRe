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

// Transform snake_case backend fields to camelCase frontend fields
const transformDeal = (deal: any): Deal => {
  return {
    ...deal,
    projectType: deal.project_type || deal.projectType,
    propertyCount: deal.property_count || deal.propertyCount || 0,
    pendingTasks: deal.pending_tasks || deal.pendingTasks || 0,
    createdAt: deal.created_at || deal.createdAt,
    updatedAt: deal.updated_at || deal.updatedAt,
    triageStatus: deal.triage_status || deal.triageStatus,
    triageScore: deal.triage_score || deal.triageScore,
    signalConfidence: deal.signal_confidence || deal.signalConfidence,
    triagedAt: deal.triaged_at || deal.triagedAt,
    stateData: deal.state_data || deal.stateData,
    daysInStation: deal.days_in_station || deal.daysInStation || 0,
    developmentType: deal.development_type || deal.developmentType,
    propertyTypeKey: deal.property_type_key || deal.propertyTypeKey,
    propertyTypeId: deal.property_type_id || deal.propertyTypeId,
    purchasePrice: deal.purchase_price || deal.purchasePrice,
    callForOfferDate: deal.call_for_offer_date || deal.callForOfferDate,
    units: deal.units,
    occupancy: deal.occupancy,
    rentPerSf: deal.rent_per_sf || deal.rentPerSf,
    capRate: deal.cap_rate || deal.capRate,
    renovationBudget: deal.renovation_budget || deal.renovationBudget,
    dealCategory: deal.deal_category || deal.dealCategory,
  };
};

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
      const transformedDeals = dealsList.map(transformDeal);
      set({ 
        deals: transformedDeals,
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
      const transformedDeal = transformDeal(deal);
      set({ 
        selectedDeal: transformedDeal,
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
      const transformedDeal = transformDeal(newDeal);
      
      set((state) => ({ 
        deals: [transformedDeal, ...state.deals],
        isLoading: false 
      }));
      
      return transformedDeal;
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

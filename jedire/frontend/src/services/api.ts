import axios from 'axios';
import { Property, SearchResult, ZoningInsight, User, Lead, Commission, CommissionSummary } from '@/types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Property API
export const propertyAPI = {
  search: async (query: string, filters?: any): Promise<SearchResult> => {
    const { data } = await api.get('/properties/search', {
      params: { query, ...filters },
    });
    return data;
  },

  getById: async (id: string): Promise<Property> => {
    const { data } = await api.get(`/properties/${id}`);
    return data;
  },

  analyze: async (address: string, lotSize?: number): Promise<Property> => {
    const { data } = await api.post('/properties/analyze', {
      address,
      lot_size_sqft: lotSize,
    });
    return data;
  },

  list: async (filters?: any): Promise<Property[]> => {
    const { data } = await api.get('/properties', { params: filters });
    return data.data || [];
  },

  togglePin: async (id: string): Promise<Property> => {
    const { data } = await api.post(`/properties/${id}/pin`);
    return data;
  },

  addAnnotation: async (id: string, text: string, type: string) => {
    const { data } = await api.post(`/properties/${id}/annotations`, {
      text,
      type,
    });
    return data;
  },
};

// Zoning API
export const zoningAPI = {
  lookup: async (lat: number, lng: number, municipality: string): Promise<ZoningInsight> => {
    const { data } = await api.post('/zoning/lookup', {
      lat,
      lng,
      municipality,
    });
    return data;
  },

  getDistricts: async (municipality: string) => {
    const { data } = await api.get(`/zoning/districts/${municipality}`);
    return data;
  },
};

// Geocoding API
export const geocodingAPI = {
  geocode: async (address: string) => {
    const { data } = await api.get('/geocode', {
      params: { address },
    });
    return data;
  },

  reverseGeocode: async (lat: number, lng: number) => {
    const { data } = await api.get('/geocode/reverse', {
      params: { lat, lng },
    });
    return data;
  },
};

// Auth API
export const authAPI = {
  login: async (email: string, password: string): Promise<{ token: string; user: User }> => {
    const { data } = await api.post('/auth/login', { email, password });
    return data;
  },

  register: async (email: string, password: string, name: string): Promise<{ token: string; user: User }> => {
    const { data } = await api.post('/auth/register', { email, password, name });
    return data;
  },

  logout: async (): Promise<void> => {
    await api.post('/auth/logout');
  },

  me: async (): Promise<User> => {
    const { data } = await api.get('/auth/me');
    return data;
  },
};

// Lead Management API
export const leadAPI = {
  create: async (leadData: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>): Promise<Lead> => {
    const { data } = await api.post('/api/agent/leads', leadData);
    return data;
  },

  list: async (filters?: { status?: string; priority?: string; source?: string }): Promise<Lead[]> => {
    const { data } = await api.get('/api/agent/leads', { params: filters });
    return data.data || [];
  },

  getById: async (id: string): Promise<Lead> => {
    const { data } = await api.get(`/api/agent/leads/${id}`);
    return data;
  },

  update: async (id: string, updates: Partial<Lead>): Promise<Lead> => {
    const { data } = await api.patch(`/api/agent/leads/${id}`, updates);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/api/agent/leads/${id}`);
  },

  convertToClient: async (id: string): Promise<any> => {
    const { data } = await api.post(`/api/agent/leads/${id}/convert`);
    return data;
  },
};

// Commission API
export const commissionAPI = {
  calculate: (dealValue: number, rate: number, split: number) => {
    const grossCommission = dealValue * (rate / 100);
    const netCommission = grossCommission * (split / 100);
    return { grossCommission, netCommission };
  },

  getSummary: async (): Promise<CommissionSummary> => {
    const { data } = await api.get('/api/agent/commission/summary');
    return data;
  },

  getHistory: async (filters?: { status?: string; year?: number }): Promise<Commission[]> => {
    const { data } = await api.get('/api/agent/commission/history', { params: filters });
    return data.data || [];
  },

  create: async (commissionData: Omit<Commission, 'id' | 'createdAt'>): Promise<Commission> => {
    const { data } = await api.post('/api/agent/commission', commissionData);
    return data;
  },

  exportCSV: async (filters?: any): Promise<Blob> => {
    const { data } = await api.get('/api/agent/commission/export', {
      params: filters,
      responseType: 'blob',
    });
    return data;
  },
};

export default api;

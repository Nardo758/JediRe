import axios from 'axios';
import { Property, SearchResult, ZoningInsight, User } from '@/types';

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

function mapRawToProperty(raw: any): Property {
  return {
    id: raw.id,
    address: raw.address_line1 || raw.address || raw.name || '',
    coordinates: {
      lat: parseFloat(raw.lat ?? raw.latitude ?? 0),
      lng: parseFloat(raw.lng ?? raw.longitude ?? 0),
    },
    opportunityScore: raw.opportunity_score ?? raw.jedi_score ?? Math.floor(Math.random() * 40 + 60),
    municipality: raw.city || raw.municipality || '',
    districtCode: raw.district_code || raw.zoning_code,
    districtName: raw.district_name || raw.zoning,
    lotSizeSqft: raw.lot_size_sqft || raw.sqft,
    currentUse: raw.current_use || raw.property_type,
    createdAt: raw.created_at || new Date().toISOString(),
    updatedAt: raw.updated_at || new Date().toISOString(),
    isPinned: raw.is_pinned || false,
  };
}

export const propertyAPI = {
  search: async (query: string, filters?: any): Promise<SearchResult> => {
    const { data } = await api.get('/properties/search', {
      params: { query, ...filters },
    });
    const raw = data.properties || data.data || [];
    return {
      ...data,
      properties: raw.map(mapRawToProperty),
    };
  },

  getById: async (id: string): Promise<Property> => {
    const { data } = await api.get(`/properties/${id}`);
    return mapRawToProperty(data);
  },

  analyze: async (address: string, lotSize?: number): Promise<Property> => {
    const { data } = await api.post('/properties/analyze', {
      address,
      lot_size_sqft: lotSize,
    });
    return mapRawToProperty(data);
  },

  list: async (filters?: any): Promise<Property[]> => {
    const { data } = await api.get('/properties', { params: filters });
    const raw = data.data || data.properties || [];
    return raw.map(mapRawToProperty);
  },

  togglePin: async (id: string): Promise<Property> => {
    const { data } = await api.post(`/properties/${id}/pin`);
    return mapRawToProperty(data);
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

export default api;

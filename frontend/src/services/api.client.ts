import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Create axios instance
export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add auth token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('jedi_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle errors
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Unauthorized - clear auth and redirect to login
      localStorage.removeItem('jedi_token');
      localStorage.removeItem('jedi_user');
      window.location.href = '/login';
    }

    if (error.response?.status === 403) {
      // Forbidden - show upgrade message
      console.error('Access forbidden:', error.response.data);
    }

    if (error.response?.status === 429) {
      // Rate limited
      console.error('Rate limit exceeded');
    }

    return Promise.reject(error);
  }
);

// Typed API methods
export const api = {
  // Auth
  auth: {
    login: (email: string, password: string) =>
      apiClient.post('/api/v1/auth/login', { email, password }),
    register: (data: any) => apiClient.post('/api/v1/auth/register', data),
    logout: () => apiClient.post('/api/v1/auth/logout'),
    me: () => apiClient.get('/api/v1/auth/me'),
  },

  // Deals
  deals: {
    list: (params?: any) => apiClient.get('/api/v1/deals', { params }),
    get: (id: string) => apiClient.get(`/api/v1/deals/${id}`),
    create: (data: any) => apiClient.post('/api/v1/deals', data),
    update: (id: string, data: any) => apiClient.patch(`/api/v1/deals/${id}`, data),
    delete: (id: string) => apiClient.delete(`/api/v1/deals/${id}`),
    modules: (id: string) => apiClient.get(`/api/v1/deals/${id}/modules`),
    properties: (id: string, filters?: any) =>
      apiClient.get(`/api/v1/deals/${id}/properties`, { params: filters }),
    pipeline: (id: string) => apiClient.get(`/api/v1/deals/${id}/pipeline`),
    analysis: (id: string) => apiClient.post(`/api/v1/deals/${id}/analysis/trigger`),
    leaseAnalysis: (id: string) => apiClient.get(`/api/v1/deals/${id}/lease-analysis`),
  },

  // Properties
  properties: {
    list: (params?: any) => apiClient.get('/api/v1/properties', { params }),
    get: (id: string) => apiClient.get(`/api/v1/properties/${id}`),
    search: (query: any) => apiClient.post('/api/v1/properties/search', query),
  },

  // Analysis
  analysis: {
    trigger: (dealId: string) => apiClient.post(`/api/v1/deals/${dealId}/analysis/trigger`),
    latest: (dealId: string) => apiClient.get(`/api/v1/deals/${dealId}/analysis/latest`),
  },
};

export default apiClient;

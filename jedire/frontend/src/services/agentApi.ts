import api from './api';
import { Client, Deal, Lead, AgentStats, ActivityItem, ClientFilters, Commission } from '@/types/agent';

// Agent Dashboard API
export const agentAPI = {
  // Stats
  getStats: async (): Promise<AgentStats> => {
    const { data } = await api.get('/api/agent/stats');
    return data;
  },

  // Recent Activity
  getActivity: async (limit: number = 10): Promise<ActivityItem[]> => {
    const { data } = await api.get('/api/agent/activity', { params: { limit } });
    return data;
  },

  // Clients
  getClients: async (filters?: ClientFilters, page: number = 1, limit: number = 20): Promise<{ clients: Client[]; total: number }> => {
    const { data } = await api.get('/api/agent/clients', {
      params: { ...filters, page, limit }
    });
    return data;
  },

  getClient: async (id: string): Promise<Client> => {
    const { data } = await api.get(`/api/agent/clients/${id}`);
    return data;
  },

  createClient: async (client: Omit<Client, 'id' | 'dateAdded' | 'lastContact'>): Promise<Client> => {
    const { data } = await api.post('/api/agent/clients', client);
    return data;
  },

  updateClient: async (id: string, client: Partial<Client>): Promise<Client> => {
    const { data } = await api.put(`/api/agent/clients/${id}`, client);
    return data;
  },

  deleteClient: async (id: string): Promise<void> => {
    await api.delete(`/api/agent/clients/${id}`);
  },

  // Deals
  getDeals: async (filters?: any): Promise<Deal[]> => {
    const { data } = await api.get('/api/agent/deals', { params: filters });
    return data;
  },

  getDeal: async (id: string): Promise<Deal> => {
    const { data } = await api.get(`/api/agent/deals/${id}`);
    return data;
  },

  createDeal: async (deal: Omit<Deal, 'id' | 'createdAt' | 'updatedAt'>): Promise<Deal> => {
    const { data } = await api.post('/api/agent/deals', deal);
    return data;
  },

  updateDeal: async (id: string, deal: Partial<Deal>): Promise<Deal> => {
    const { data } = await api.put(`/api/agent/deals/${id}`, deal);
    return data;
  },

  // Leads
  getLeads: async (status?: string): Promise<Lead[]> => {
    const { data } = await api.get('/api/agent/leads', { params: { status } });
    return data;
  },

  getLead: async (id: string): Promise<Lead> => {
    const { data } = await api.get(`/api/agent/leads/${id}`);
    return data;
  },

  createLead: async (lead: Omit<Lead, 'id' | 'createdAt'>): Promise<Lead> => {
    const { data } = await api.post('/api/agent/leads', lead);
    return data;
  },

  updateLead: async (id: string, lead: Partial<Lead>): Promise<Lead> => {
    const { data } = await api.put(`/api/agent/leads/${id}`, lead);
    return data;
  },

  // Commission
  getCommissions: async (year?: number): Promise<Commission[]> => {
    const { data } = await api.get('/api/agent/commissions', { params: { year } });
    return data;
  },

  // Analytics
  getAnalytics: async (startDate: string, endDate: string): Promise<any> => {
    const { data } = await api.get('/api/agent/analytics', {
      params: { start: startDate, end: endDate }
    });
    return data;
  },
};

export default agentAPI;

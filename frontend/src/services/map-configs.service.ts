/**
 * Map Configurations API Service
 * Handle saved map tabs and War Maps
 */

import axios from 'axios';

const API_BASE = '/api/v1';

export interface MapConfiguration {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  icon?: string;
  config_type: 'war_map' | 'custom' | 'template';
  is_default: boolean;
  is_public: boolean;
  layer_config: LayerConfigItem[];
  map_center: { lng: number; lat: number };
  map_zoom: number;
  view_count: number;
  last_viewed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface LayerConfigItem {
  source_type: string;
  layer_type: string;
  name: string;
  visible: boolean;
  opacity: number;
  z_index: number;
  filters: Record<string, any>;
  style: Record<string, any>;
  source_config?: Record<string, any>;
}

export interface CreateMapConfigRequest {
  name: string;
  description?: string;
  icon?: string;
  config_type?: 'war_map' | 'custom' | 'template';
  is_default?: boolean;
  is_public?: boolean;
  layer_config: LayerConfigItem[];
  map_center?: { lng: number; lat: number };
  map_zoom?: number;
}

export interface UpdateMapConfigRequest {
  name?: string;
  description?: string;
  icon?: string;
  is_default?: boolean;
  is_public?: boolean;
  layer_config?: LayerConfigItem[];
  map_center?: { lng: number; lat: number };
  map_zoom?: number;
}

export const mapConfigsService = {
  /**
   * Get all map configurations
   */
  async getConfigs(type?: 'war_map' | 'custom' | 'template'): Promise<MapConfiguration[]> {
    const response = await axios.get(`${API_BASE}/map-configs`, {
      params: { type }
    });
    return response.data.data;
  },

  /**
   * Get default map configuration
   */
  async getDefaultConfig(): Promise<MapConfiguration | null> {
    const response = await axios.get(`${API_BASE}/map-configs/default`);
    return response.data.data;
  },

  /**
   * Get single map configuration
   */
  async getConfig(id: string): Promise<MapConfiguration> {
    const response = await axios.get(`${API_BASE}/map-configs/${id}`);
    return response.data.data;
  },

  /**
   * Create new map configuration
   */
  async createConfig(data: CreateMapConfigRequest): Promise<MapConfiguration> {
    const response = await axios.post(`${API_BASE}/map-configs`, data);
    return response.data.data;
  },

  /**
   * Update map configuration
   */
  async updateConfig(id: string, data: UpdateMapConfigRequest): Promise<MapConfiguration> {
    const response = await axios.put(`${API_BASE}/map-configs/${id}`, data);
    return response.data.data;
  },

  /**
   * Delete map configuration
   */
  async deleteConfig(id: string): Promise<void> {
    await axios.delete(`${API_BASE}/map-configs/${id}`);
  },

  /**
   * Clone map configuration
   */
  async cloneConfig(id: string, newName: string): Promise<MapConfiguration> {
    const response = await axios.post(`${API_BASE}/map-configs/${id}/clone`, {
      name: newName
    });
    return response.data.data;
  },

  /**
   * Set map configuration as default
   */
  async setDefault(id: string): Promise<MapConfiguration> {
    const response = await axios.post(`${API_BASE}/map-configs/${id}/set-default`);
    return response.data.data;
  }
};

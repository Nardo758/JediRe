/**
 * Layers API Service
 * Handle layer CRUD operations
 */

import axios from 'axios';
import {
  MapLayer,
  CreateLayerRequest,
  UpdateLayerRequest,
  ReorderLayersRequest,
  LayerDataPoint,
  SourceType
} from '../types/layers';

const API_BASE = '/api/v1';

export const layersService = {
  /**
   * Get all layers for a map
   */
  async getMapLayers(mapId: string, visibleOnly = false): Promise<MapLayer[]> {
    const response = await axios.get(`${API_BASE}/layers/map/${mapId}`, {
      params: { visible_only: visibleOnly }
    });
    return response.data.data;
  },

  /**
   * Get single layer by ID
   */
  async getLayer(layerId: string): Promise<MapLayer> {
    const response = await axios.get(`${API_BASE}/layers/${layerId}`);
    return response.data.data;
  },

  /**
   * Create new layer
   */
  async createLayer(data: CreateLayerRequest): Promise<MapLayer> {
    const response = await axios.post(`${API_BASE}/layers`, data);
    return response.data.data;
  },

  /**
   * Update layer
   */
  async updateLayer(layerId: string, data: UpdateLayerRequest): Promise<MapLayer> {
    const response = await axios.put(`${API_BASE}/layers/${layerId}`, data);
    return response.data.data;
  },

  /**
   * Delete layer
   */
  async deleteLayer(layerId: string): Promise<void> {
    await axios.delete(`${API_BASE}/layers/${layerId}`);
  },

  /**
   * Reorder layers (bulk z-index update)
   */
  async reorderLayers(data: ReorderLayersRequest): Promise<void> {
    await axios.post(`${API_BASE}/layers/reorder`, data);
  },

  /**
   * Fetch data for a layer source
   */
  async getLayerSourceData(sourceType: SourceType, mapId: string): Promise<LayerDataPoint[]> {
    const response = await axios.get(`${API_BASE}/layers/sources/${sourceType}`, {
      params: { map_id: mapId }
    });
    return response.data.data;
  },

  /**
   * Toggle layer visibility
   */
  async toggleLayerVisibility(layerId: string, visible: boolean): Promise<MapLayer> {
    return this.updateLayer(layerId, { visible });
  },

  /**
   * Update layer opacity
   */
  async updateLayerOpacity(layerId: string, opacity: number): Promise<MapLayer> {
    return this.updateLayer(layerId, { opacity });
  }
};

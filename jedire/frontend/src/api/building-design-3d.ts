/**
 * API client for 3D Building Design endpoints
 */

import { apiClient } from './client';
import type { BuildingSection } from '@/types/design/design3d.types';

export interface BuildingDesign3D {
  id: string;
  deal_id: string;
  scenario_id?: string;
  building_sections: BuildingSection[];
  total_units: number;
  total_gfa: number;
  total_parking_spaces: number;
  building_height_ft: number;
  stories: number;
  lot_coverage_percent: number;
  far: number;
  efficiency_percent: number;
  camera_state?: {
    position: { x: number; y: number; z: number };
    target: { x: number; y: number; z: number };
  };
  created_at: string;
  updated_at: string;
}

export interface SaveDesignRequest {
  scenarioId?: string;
  buildingSections: BuildingSection[];
  cameraState?: {
    position: { x: number; y: number; z: number };
    target: { x: number; y: number; z: number };
  };
  createdBy?: string;
}

/**
 * Load 3D building design for a deal
 */
export async function loadBuildingDesign3D(
  dealId: string,
  scenarioId?: string
): Promise<BuildingDesign3D> {
  const params = new URLSearchParams();
  if (scenarioId) {
    params.set('scenarioId', scenarioId);
  }
  
  const url = `/deals/${dealId}/design-3d${params.toString() ? `?${params.toString()}` : ''}`;
  const response = await apiClient.get<BuildingDesign3D>(url);
  return response.data;
}

/**
 * Save 3D building design
 */
export async function saveBuildingDesign3D(
  dealId: string,
  request: SaveDesignRequest
): Promise<{ success: boolean; design: BuildingDesign3D }> {
  const response = await apiClient.post(`/deals/${dealId}/design-3d`, request);
  return response.data;
}

/**
 * Delete 3D building design
 */
export async function deleteBuildingDesign3D(
  dealId: string,
  scenarioId?: string
): Promise<{ success: boolean; deletedId: string }> {
  const params = new URLSearchParams();
  if (scenarioId) {
    params.set('scenarioId', scenarioId);
  }
  
  const url = `/deals/${dealId}/design-3d${params.toString() ? `?${params.toString()}` : ''}`;
  const response = await apiClient.delete(url);
  return response.data;
}

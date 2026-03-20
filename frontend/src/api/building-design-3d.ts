import { apiClient } from '../services/api.client';

export interface BuildingDesign3D {
  id?: string;
  dealId: string;
  scenarioId?: string;
  totalUnits: number;
  totalGFA: number;
  rentableSF: number;
  parkingSpaces: number;
  amenitySF: number;
  floors: number;
  efficiency: number;
  buildingType: string;
  unitMix: {
    studio: number;
    oneBed: number;
    twoBed: number;
    threeBed: number;
  };
  config?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
}

export async function loadBuildingDesign3D(dealId: string, scenarioId?: string): Promise<BuildingDesign3D | null> {
  try {
    const params = scenarioId ? `?scenarioId=${scenarioId}` : '';
    const response = await apiClient.get(`/api/v1/deals/${dealId}/building-design${params}`);
    return (response as any)?.data?.design ?? null;
  } catch {
    return null;
  }
}

export async function saveBuildingDesign3D(dealId: string, design: Partial<BuildingDesign3D>): Promise<BuildingDesign3D | null> {
  try {
    const response = await apiClient.post(`/api/v1/deals/${dealId}/building-design`, design);
    return (response as any)?.data?.design ?? null;
  } catch {
    return null;
  }
}

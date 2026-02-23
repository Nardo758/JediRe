import { apiClient } from './api.client';

const BASE = '/api/v1/data-library';

export interface DataLibraryFile {
  id: number;
  user_id: number | null;
  file_name: string;
  file_size: number;
  mime_type: string;
  city: string | null;
  zip_code: string | null;
  property_type: string | null;
  property_height: string | null;
  year_built: string | null;
  unit_count: number | null;
  source_type: string;
  tags: string[];
  parsed_data: any;
  parsing_status: string;
  parsing_errors: string | null;
  uploaded_at: string;
}

export interface DataLibrarySearchParams {
  city?: string;
  zipCode?: string;
  propertyType?: string;
  propertyHeight?: string;
  sourceType?: string;
  unitCountMin?: number;
  unitCountMax?: number;
  limit?: number;
}

export const dataLibraryService = {
  async getFiles(params?: DataLibrarySearchParams): Promise<DataLibraryFile[]> {
    const { data } = await apiClient.get(BASE, { params });
    return data;
  },

  async getFile(id: number): Promise<DataLibraryFile> {
    const { data } = await apiClient.get(`${BASE}/${id}`);
    return data;
  },

  async uploadFile(file: File, metadata: {
    city?: string;
    zipCode?: string;
    propertyType?: string;
    propertyHeight?: string;
    yearBuilt?: string;
    unitCount?: number;
    sourceType?: string;
    tags?: string[];
  }): Promise<DataLibraryFile> {
    const formData = new FormData();
    formData.append('file', file);
    if (metadata.city) formData.append('city', metadata.city);
    if (metadata.zipCode) formData.append('zipCode', metadata.zipCode);
    if (metadata.propertyType) formData.append('propertyType', metadata.propertyType);
    if (metadata.propertyHeight) formData.append('propertyHeight', metadata.propertyHeight);
    if (metadata.yearBuilt) formData.append('yearBuilt', metadata.yearBuilt);
    if (metadata.unitCount) formData.append('unitCount', String(metadata.unitCount));
    if (metadata.sourceType) formData.append('sourceType', metadata.sourceType);
    if (metadata.tags) formData.append('tags', JSON.stringify(metadata.tags));

    const { data } = await apiClient.post(BASE, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  async updateFile(id: number, updates: Partial<DataLibraryFile>): Promise<DataLibraryFile> {
    const { data } = await apiClient.patch(`${BASE}/${id}`, updates);
    return data;
  },

  async deleteFile(id: number): Promise<void> {
    await apiClient.delete(`${BASE}/${id}`);
  },

  async findComparables(params: {
    city?: string;
    propertyType?: string;
    unitCount?: number;
    propertyHeight?: string;
  }): Promise<DataLibraryFile[]> {
    const { data } = await apiClient.get(`${BASE}/comparables`, { params });
    return data;
  },
};

import { apiClient } from './api.client';

export interface PstJobStatus {
  jobId: string;
  uploadId: string;
  status: 'parsing' | 'extracting' | 'storing' | 'completed' | 'failed';
  totalEmails: number;
  processedEmails: number;
  entitiesFound: number;
  emailsWithSignal?: number;
  errors: string[];
  startedAt: string;
  completedAt: string | null;
}

export interface PstEntity {
  id: string;
  entity_type: string;
  property_address?: string;
  deal_name?: string;
  contact_name?: string;
  organization?: string;
  asking_price?: string | number;
  unit_count?: number;
  cap_rate?: string | number;
  rent_figures?: string;
  email_subject?: string;
  email_sender?: string;
  confidence: string | number;
}

export const pstUploadService = {
  async uploadPst(file: File): Promise<{ jobId: string }> {
    const form = new FormData();
    form.append('file', file);
    const res = await apiClient.post<{ jobId: string }>('/api/v1/pst/upload', form);
    return res.data;
  },

  async getJobStatus(jobId: string): Promise<PstJobStatus> {
    const res = await apiClient.get<PstJobStatus>(`/api/v1/pst/jobs/${jobId}`);
    return res.data;
  },

  async getEntities(jobId: string, params?: { limit?: number }): Promise<{ entities: PstEntity[] }> {
    const res = await apiClient.get<{ entities: PstEntity[] }>(`/api/v1/pst/jobs/${jobId}/entities`, { params });
    return res.data;
  },
};

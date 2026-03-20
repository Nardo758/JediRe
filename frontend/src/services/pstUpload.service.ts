import { apiClient } from './api.client';

const BASE = '/api/v1/data-upload/pst';

export interface PstJobStatus {
  jobId: string;
  status: 'parsing' | 'extracting' | 'storing' | 'completed' | 'failed';
  uploadId: string;
  totalEmails: number;
  processedEmails: number;
  entitiesFound: number;
  emailsWithSignal?: number;
  errors: string[];
  startedAt: string;
  completedAt: string | null;
}

export interface PstEmail {
  id: string;
  email_index: number;
  subject: string;
  sender: string;
  recipients: string[];
  email_date: string;
  has_signal: boolean;
  has_attachments: boolean;
  body_preview: string;
}

export interface PstEntity {
  id: string;
  entity_type: string;
  property_address: string | null;
  deal_name: string | null;
  unit_count: number | null;
  asking_price: number | null;
  rent_figures: string | null;
  cap_rate: number | null;
  contact_name: string | null;
  organization: string | null;
  confidence: number;
  raw_snippet: string;
  email_subject: string;
  email_sender: string;
  email_date: string;
}

export const pstUploadService = {
  async uploadPst(file: File): Promise<{ jobId: string; uploadId: string }> {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await apiClient.post(BASE, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    });
    return { jobId: data.jobId, uploadId: data.uploadId };
  },

  async getJobStatus(jobId: string): Promise<PstJobStatus> {
    const { data } = await apiClient.get(`${BASE}/${jobId}/status`);
    return data;
  },

  async getEmails(jobId: string, options?: { signalOnly?: boolean; limit?: number; offset?: number }): Promise<{ total: number; emails: PstEmail[] }> {
    const { data } = await apiClient.get(`${BASE}/${jobId}/emails`, { params: options });
    return data;
  },

  async getEntities(jobId: string, options?: { entityType?: string; limit?: number; offset?: number }): Promise<{ total: number; entities: PstEntity[] }> {
    const { data } = await apiClient.get(`${BASE}/${jobId}/entities`, { params: options });
    return data;
  },
};

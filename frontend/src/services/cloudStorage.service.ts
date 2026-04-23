/**
 * Cloud Storage Service
 * 
 * API client for cloud storage integrations and bulk upload
 */

import { apiClient } from './api.client';

export interface CloudProvider {
  id: string;
  name: string;
  icon: string;
  color: string;
  supported: boolean;
}

export interface CloudConnection {
  id: string;
  provider: string;
  providerName: string;
  accountEmail: string;
  isActive: boolean;
  lastSyncAt?: string;
  createdAt: string;
}

export interface CloudFolder {
  id: string;
  name: string;
  path: string;
  provider: string;
  parentId: string | null;
  hasChildren: boolean;
  modifiedAt?: string;
}

export interface CloudFile {
  id: string;
  name: string;
  path: string;
  provider: string;
  parentId: string;
  mimeType: string;
  size: number;
  modifiedAt?: string;
}

export interface CloudSyncJob {
  id: string;
  connectionId: string;
  folderId: string;
  folderPath: string;
  status: 'pending' | 'scanning' | 'downloading' | 'parsing' | 'complete' | 'error';
  totalFiles: number;
  processedFiles: number;
  successCount: number;
  errorCount: number;
  errors: string[];
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

export interface BulkUploadJob {
  id: string;
  status: 'uploading' | 'extracting' | 'parsing' | 'complete' | 'error';
  totalFiles: number;
  processedFiles: number;
  dealsCreated: number;
  errors: string[];
  createdAt: string;
  completedAt?: string;
}

class CloudStorageService {
  // ─── Providers ────────────────────────────────────────────────────────────
  
  async getProviders(): Promise<CloudProvider[]> {
    const response = await apiClient.get('/api/v1/cloud-storage/providers');
    return response.data.providers;
  }
  
  // ─── Connections ──────────────────────────────────────────────────────────
  
  async getConnections(): Promise<CloudConnection[]> {
    const response = await apiClient.get('/api/v1/cloud-storage/connections');
    return response.data.connections;
  }
  
  async connectProvider(provider: string): Promise<string> {
    const response = await apiClient.get(`/api/v1/cloud-storage/connect/${provider}`);
    return response.data.authUrl;
  }
  
  async disconnectProvider(connectionId: string): Promise<void> {
    await apiClient.delete(`/api/v1/cloud-storage/connections/${connectionId}`);
  }
  
  // ─── Folder Browsing ──────────────────────────────────────────────────────
  
  async browseFolders(connectionId: string, parentId?: string): Promise<CloudFolder[]> {
    const params = parentId ? `?parentId=${encodeURIComponent(parentId)}` : '';
    const response = await apiClient.get(`/api/v1/cloud-storage/browse/${connectionId}${params}`);
    return response.data.folders;
  }
  
  async listFiles(connectionId: string, folderId: string): Promise<CloudFile[]> {
    const response = await apiClient.get(`/api/v1/cloud-storage/files/${connectionId}/${encodeURIComponent(folderId)}`);
    return response.data.files;
  }
  
  // ─── Cloud Sync ───────────────────────────────────────────────────────────
  
  async startSync(connectionId: string, folderId: string, folderPath: string): Promise<CloudSyncJob> {
    const response = await apiClient.post('/api/v1/cloud-storage/sync', {
      connectionId,
      folderId,
      folderPath,
    });
    return response.data.job;
  }
  
  async getSyncJob(jobId: string): Promise<CloudSyncJob> {
    const response = await apiClient.get(`/api/v1/cloud-storage/sync/${jobId}`);
    return response.data.job;
  }
  
  async listSyncJobs(limit = 10): Promise<CloudSyncJob[]> {
    const response = await apiClient.get(`/api/v1/cloud-storage/sync?limit=${limit}`);
    return response.data.jobs;
  }
  
  // ─── Bulk Upload ──────────────────────────────────────────────────────────
  
  async uploadFiles(files: File[], onProgress?: (progress: number) => void, dealId?: string, customLabel?: string): Promise<BulkUploadJob> {
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    if (dealId) formData.append('dealId', dealId);
    if (customLabel) formData.append('customLabel', customLabel);
    
    const response = await apiClient.post('/api/v1/bulk-upload/files', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          onProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
        }
      },
    });
    
    return { errors: [], id: response.data.jobId, ...response.data };
  }
  
  async uploadZip(file: File, onProgress?: (progress: number) => void, dealId?: string, customLabel?: string): Promise<BulkUploadJob> {
    const formData = new FormData();
    formData.append('file', file);
    if (dealId) formData.append('dealId', dealId);
    if (customLabel) formData.append('customLabel', customLabel);
    
    const response = await apiClient.post('/api/v1/bulk-upload/zip', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          onProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
        }
      },
    });
    
    return { errors: [], id: response.data.jobId, ...response.data };
  }
  
  async getUploadJob(jobId: string): Promise<BulkUploadJob> {
    const response = await apiClient.get(`/api/v1/bulk-upload/status/${jobId}`);
    const job = response.data.job;
    return { ...job, errors: job.errors ?? [] };
  }
  
  async listUploadJobs(): Promise<BulkUploadJob[]> {
    const response = await apiClient.get('/api/v1/bulk-upload/jobs');
    return response.data.jobs;
  }
}

export const cloudStorageService = new CloudStorageService();

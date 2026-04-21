/**
 * Cloud Storage Integration Types
 * 
 * Unified interface for Google Drive, Dropbox, ShareFile, Box, OneDrive
 */

export type CloudProvider = 'google_drive' | 'dropbox' | 'sharefile' | 'box' | 'onedrive';

export interface CloudStorageConnection {
  id: string;
  userId: string;
  provider: CloudProvider;
  accountEmail: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: Date;
  rootFolderId?: string;
  rootFolderName?: string;
  isActive: boolean;
  lastSyncAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CloudFolder {
  id: string;
  name: string;
  path: string;
  provider: CloudProvider;
  parentId: string | null;
  hasChildren: boolean;
  modifiedAt?: Date;
}

export interface CloudFile {
  id: string;
  name: string;
  path: string;
  provider: CloudProvider;
  parentId: string;
  mimeType: string;
  size: number;
  modifiedAt?: Date;
  downloadUrl?: string;
}

export interface CloudSyncJob {
  id: string;
  userId: string;
  connectionId: string;
  folderId: string;
  folderPath: string;
  status: 'pending' | 'scanning' | 'downloading' | 'parsing' | 'complete' | 'error';
  totalFiles: number;
  processedFiles: number;
  successCount: number;
  errorCount: number;
  errors: string[];
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
}

export interface CloudStorageAdapter {
  provider: CloudProvider;
  
  // OAuth flow
  getAuthUrl(state: string): string;
  exchangeCodeForTokens(code: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    email: string;
  }>;
  refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    expiresIn: number;
  }>;
  
  // Folder operations
  listFolders(accessToken: string, parentId?: string): Promise<CloudFolder[]>;
  listFiles(accessToken: string, folderId: string): Promise<CloudFile[]>;
  
  // File operations
  downloadFile(accessToken: string, fileId: string): Promise<Buffer>;
  getFileMetadata(accessToken: string, fileId: string): Promise<CloudFile>;
}

// OAuth config by provider
export interface CloudOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

export const CLOUD_PROVIDER_CONFIG: Record<CloudProvider, { name: string; icon: string; color: string }> = {
  google_drive: { name: 'Google Drive', icon: '📁', color: '#4285F4' },
  dropbox: { name: 'Dropbox', icon: '📦', color: '#0061FF' },
  sharefile: { name: 'ShareFile', icon: '📂', color: '#6B9E1F' },
  box: { name: 'Box', icon: '📋', color: '#0061D5' },
  onedrive: { name: 'OneDrive', icon: '☁️', color: '#0078D4' },
};

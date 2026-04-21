/**
 * Dropbox Adapter
 * 
 * Implements CloudStorageAdapter for Dropbox integration
 */

import type { CloudStorageAdapter, CloudFolder, CloudFile, CloudOAuthConfig } from './cloud-storage.types';

const DROPBOX_OAUTH_URL = 'https://www.dropbox.com/oauth2/authorize';
const DROPBOX_TOKEN_URL = 'https://api.dropboxapi.com/oauth2/token';
const DROPBOX_API = 'https://api.dropboxapi.com/2';
const DROPBOX_CONTENT_API = 'https://content.dropboxapi.com/2';

export function getDropboxConfig(): CloudOAuthConfig {
  return {
    clientId: process.env.DROPBOX_CLIENT_ID || '',
    clientSecret: process.env.DROPBOX_CLIENT_SECRET || '',
    redirectUri: process.env.DROPBOX_CALLBACK_URL || '',
    scopes: ['files.metadata.read', 'files.content.read', 'account_info.read'],
  };
}

export const dropboxAdapter: CloudStorageAdapter = {
  provider: 'dropbox',

  getAuthUrl(state: string): string {
    const config = getDropboxConfig();
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      token_access_type: 'offline',
      state,
    });
    return `${DROPBOX_OAUTH_URL}?${params.toString()}`;
  },

  async exchangeCodeForTokens(code: string) {
    const config = getDropboxConfig();
    
    const response = await fetch(DROPBOX_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: config.redirectUri,
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${error}`);
    }
    
    const data = await response.json();
    
    // Get user email
    const userResponse = await fetch(`${DROPBOX_API}/users/get_current_account`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    const userData = await userResponse.json();
    
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in || 14400, // Dropbox tokens last ~4 hours
      email: userData.email,
    };
  },

  async refreshAccessToken(refreshToken: string) {
    const config = getDropboxConfig();
    
    const response = await fetch(DROPBOX_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    
    if (!response.ok) {
      throw new Error('Token refresh failed');
    }
    
    const data = await response.json();
    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in || 14400,
    };
  },

  async listFolders(accessToken: string, parentId?: string): Promise<CloudFolder[]> {
    const path = parentId || '';
    
    const response = await fetch(`${DROPBOX_API}/files/list_folder`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        path: path === '' ? '' : path,
        recursive: false,
        include_mounted_folders: true,
      }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to list folders');
    }
    
    const data = await response.json();
    
    return data.entries
      .filter((e: any) => e['.tag'] === 'folder')
      .map((f: any) => ({
        id: f.id,
        name: f.name,
        path: f.path_display,
        provider: 'dropbox' as const,
        parentId: parentId || null,
        hasChildren: true,
        modifiedAt: undefined,
      }));
  },

  async listFiles(accessToken: string, folderId: string): Promise<CloudFile[]> {
    const response = await fetch(`${DROPBOX_API}/files/list_folder`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        path: folderId,
        recursive: false,
      }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to list files');
    }
    
    const data = await response.json();
    
    return data.entries
      .filter((e: any) => e['.tag'] === 'file')
      .map((f: any) => ({
        id: f.id,
        name: f.name,
        path: f.path_display,
        provider: 'dropbox' as const,
        parentId: folderId,
        mimeType: getMimeType(f.name),
        size: f.size || 0,
        modifiedAt: f.server_modified ? new Date(f.server_modified) : undefined,
      }));
  },

  async downloadFile(accessToken: string, fileId: string): Promise<Buffer> {
    const response = await fetch(`${DROPBOX_CONTENT_API}/files/download`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Dropbox-API-Arg': JSON.stringify({ path: fileId }),
      },
    });
    
    if (!response.ok) {
      throw new Error('Failed to download file');
    }
    
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  },

  async getFileMetadata(accessToken: string, fileId: string): Promise<CloudFile> {
    const response = await fetch(`${DROPBOX_API}/files/get_metadata`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ path: fileId }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to get file metadata');
    }
    
    const f = await response.json();
    
    return {
      id: f.id,
      name: f.name,
      path: f.path_display,
      provider: 'dropbox',
      parentId: '',
      mimeType: getMimeType(f.name),
      size: f.size || 0,
      modifiedAt: f.server_modified ? new Date(f.server_modified) : undefined,
    };
  },
};

function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    pdf: 'application/pdf',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    xls: 'application/vnd.ms-excel',
    csv: 'text/csv',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
  return mimeTypes[ext || ''] || 'application/octet-stream';
}

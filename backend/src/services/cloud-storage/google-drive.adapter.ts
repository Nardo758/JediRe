/**
 * Google Drive Adapter
 * 
 * Implements CloudStorageAdapter for Google Drive integration
 */

import type { CloudStorageAdapter, CloudFolder, CloudFile, CloudOAuthConfig } from './cloud-storage.types';

const GOOGLE_OAUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_DRIVE_API = 'https://www.googleapis.com/drive/v3';

export function getGoogleDriveConfig(): CloudOAuthConfig {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: process.env.GOOGLE_DRIVE_CALLBACK_URL || '',
    scopes: [
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
  };
}

export const googleDriveAdapter: CloudStorageAdapter = {
  provider: 'google_drive',

  getAuthUrl(state: string): string {
    const config = getGoogleDriveConfig();
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: config.scopes.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state,
    });
    return `${GOOGLE_OAUTH_URL}?${params.toString()}`;
  },

  async exchangeCodeForTokens(code: string) {
    const config = getGoogleDriveConfig();
    
    const response = await fetch(GOOGLE_TOKEN_URL, {
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
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    const userData = await userResponse.json();
    
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      email: userData.email,
    };
  },

  async refreshAccessToken(refreshToken: string) {
    const config = getGoogleDriveConfig();
    
    const response = await fetch(GOOGLE_TOKEN_URL, {
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
      expiresIn: data.expires_in,
    };
  },

  async listFolders(accessToken: string, parentId?: string): Promise<CloudFolder[]> {
    const query = parentId
      ? `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
      : `'root' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    
    const params = new URLSearchParams({
      q: query,
      fields: 'files(id,name,modifiedTime,parents)',
      pageSize: '100',
    });
    
    const response = await fetch(`${GOOGLE_DRIVE_API}/files?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    
    if (!response.ok) {
      throw new Error('Failed to list folders');
    }
    
    const data = await response.json();
    
    return data.files.map((f: any) => ({
      id: f.id,
      name: f.name,
      path: f.name, // Would need recursive call to build full path
      provider: 'google_drive' as const,
      parentId: f.parents?.[0] || null,
      hasChildren: true, // Assume true, will be checked on expand
      modifiedAt: f.modifiedTime ? new Date(f.modifiedTime) : undefined,
    }));
  },

  async listFiles(accessToken: string, folderId: string): Promise<CloudFile[]> {
    const query = `'${folderId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false`;
    
    const params = new URLSearchParams({
      q: query,
      fields: 'files(id,name,mimeType,size,modifiedTime,parents)',
      pageSize: '1000',
    });
    
    const response = await fetch(`${GOOGLE_DRIVE_API}/files?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    
    if (!response.ok) {
      throw new Error('Failed to list files');
    }
    
    const data = await response.json();
    
    return data.files.map((f: any) => ({
      id: f.id,
      name: f.name,
      path: f.name,
      provider: 'google_drive' as const,
      parentId: f.parents?.[0] || folderId,
      mimeType: f.mimeType,
      size: parseInt(f.size) || 0,
      modifiedAt: f.modifiedTime ? new Date(f.modifiedTime) : undefined,
    }));
  },

  async downloadFile(accessToken: string, fileId: string): Promise<Buffer> {
    const response = await fetch(`${GOOGLE_DRIVE_API}/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    
    if (!response.ok) {
      throw new Error('Failed to download file');
    }
    
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  },

  async getFileMetadata(accessToken: string, fileId: string): Promise<CloudFile> {
    const params = new URLSearchParams({
      fields: 'id,name,mimeType,size,modifiedTime,parents',
    });
    
    const response = await fetch(`${GOOGLE_DRIVE_API}/files/${fileId}?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    
    if (!response.ok) {
      throw new Error('Failed to get file metadata');
    }
    
    const f = await response.json();
    
    return {
      id: f.id,
      name: f.name,
      path: f.name,
      provider: 'google_drive',
      parentId: f.parents?.[0] || '',
      mimeType: f.mimeType,
      size: parseInt(f.size) || 0,
      modifiedAt: f.modifiedTime ? new Date(f.modifiedTime) : undefined,
    };
  },
};

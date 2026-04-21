/**
 * Cloud Storage Service
 * 
 * Manages cloud storage connections and file syncing
 */

import { Pool } from 'pg';
import { getPool } from '../../database/connection';
import { logger } from '../../utils/logger';
import type { 
  CloudProvider, 
  CloudStorageConnection, 
  CloudStorageAdapter,
  CloudFolder,
  CloudFile,
  CloudSyncJob,
} from './cloud-storage.types';
import { googleDriveAdapter } from './google-drive.adapter';
import { dropboxAdapter } from './dropbox.adapter';
import { ingestArchiveDeals, scanArchiveFolder } from '../archive-ingestion.service';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Adapter registry
const adapters: Record<CloudProvider, CloudStorageAdapter> = {
  google_drive: googleDriveAdapter,
  dropbox: dropboxAdapter,
  sharefile: null as any, // TODO: implement
  box: null as any, // TODO: implement
  onedrive: null as any, // TODO: implement
};

export function getAdapter(provider: CloudProvider): CloudStorageAdapter {
  const adapter = adapters[provider];
  if (!adapter) {
    throw new Error(`Cloud provider ${provider} is not yet supported`);
  }
  return adapter;
}

// ─── Connection Management ────────────────────────────────────────────────────

export async function createConnection(
  userId: string,
  provider: CloudProvider,
  code: string
): Promise<CloudStorageConnection> {
  const pool = getPool();
  const adapter = getAdapter(provider);
  
  // Exchange code for tokens
  const tokens = await adapter.exchangeCodeForTokens(code);
  
  // Check if connection already exists for this account
  const existing = await pool.query(
    `SELECT id FROM cloud_storage_connections 
     WHERE user_id = $1 AND provider = $2 AND account_email = $3`,
    [userId, provider, tokens.email]
  );
  
  const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000);
  
  if (existing.rows.length > 0) {
    // Update existing connection
    const result = await pool.query(
      `UPDATE cloud_storage_connections SET
         access_token = $1,
         refresh_token = $2,
         token_expires_at = $3,
         is_active = true,
         updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [tokens.accessToken, tokens.refreshToken, expiresAt, existing.rows[0].id]
    );
    return mapConnectionRow(result.rows[0]);
  }
  
  // Create new connection
  const result = await pool.query(
    `INSERT INTO cloud_storage_connections (
       user_id, provider, account_email, access_token, refresh_token,
       token_expires_at, is_active, created_at, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())
     RETURNING *`,
    [userId, provider, tokens.email, tokens.accessToken, tokens.refreshToken, expiresAt]
  );
  
  return mapConnectionRow(result.rows[0]);
}

export async function listConnections(userId: string): Promise<CloudStorageConnection[]> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT * FROM cloud_storage_connections WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );
  return result.rows.map(mapConnectionRow);
}

export async function getConnection(connectionId: string, userId: string): Promise<CloudStorageConnection | null> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT * FROM cloud_storage_connections WHERE id = $1 AND user_id = $2`,
    [connectionId, userId]
  );
  return result.rows[0] ? mapConnectionRow(result.rows[0]) : null;
}

export async function deleteConnection(connectionId: string, userId: string): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query(
    `DELETE FROM cloud_storage_connections WHERE id = $1 AND user_id = $2`,
    [connectionId, userId]
  );
  return (result.rowCount || 0) > 0;
}

async function refreshTokenIfNeeded(connection: CloudStorageConnection): Promise<string> {
  // Check if token is expired or will expire in 5 minutes
  const expiresIn = connection.tokenExpiresAt.getTime() - Date.now();
  if (expiresIn > 5 * 60 * 1000) {
    return connection.accessToken;
  }
  
  const pool = getPool();
  const adapter = getAdapter(connection.provider);
  
  try {
    const tokens = await adapter.refreshAccessToken(connection.refreshToken);
    const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000);
    
    await pool.query(
      `UPDATE cloud_storage_connections SET
         access_token = $1,
         token_expires_at = $2,
         updated_at = NOW()
       WHERE id = $3`,
      [tokens.accessToken, expiresAt, connection.id]
    );
    
    return tokens.accessToken;
  } catch (err) {
    logger.error('Token refresh failed:', err);
    
    // Mark connection as inactive
    await pool.query(
      `UPDATE cloud_storage_connections SET is_active = false, updated_at = NOW() WHERE id = $1`,
      [connection.id]
    );
    
    throw new Error('Cloud connection expired. Please reconnect.');
  }
}

// ─── Folder/File Browsing ─────────────────────────────────────────────────────

export async function listFolders(
  connectionId: string, 
  userId: string, 
  parentId?: string
): Promise<CloudFolder[]> {
  const connection = await getConnection(connectionId, userId);
  if (!connection) throw new Error('Connection not found');
  
  const adapter = getAdapter(connection.provider);
  const accessToken = await refreshTokenIfNeeded(connection);
  
  return adapter.listFolders(accessToken, parentId);
}

export async function listFiles(
  connectionId: string,
  userId: string,
  folderId: string
): Promise<CloudFile[]> {
  const connection = await getConnection(connectionId, userId);
  if (!connection) throw new Error('Connection not found');
  
  const adapter = getAdapter(connection.provider);
  const accessToken = await refreshTokenIfNeeded(connection);
  
  return adapter.listFiles(accessToken, folderId);
}

// ─── Bulk Sync ────────────────────────────────────────────────────────────────

export async function startBulkSync(
  connectionId: string,
  userId: string,
  folderId: string,
  folderPath: string
): Promise<CloudSyncJob> {
  const pool = getPool();
  const connection = await getConnection(connectionId, userId);
  if (!connection) throw new Error('Connection not found');
  
  // Create sync job
  const result = await pool.query(
    `INSERT INTO cloud_sync_jobs (
       user_id, connection_id, folder_id, folder_path, status,
       total_files, processed_files, success_count, error_count, errors,
       created_at
     ) VALUES ($1, $2, $3, $4, 'pending', 0, 0, 0, 0, '{}', NOW())
     RETURNING *`,
    [userId, connectionId, folderId, folderPath]
  );
  
  const job = mapSyncJobRow(result.rows[0]);
  
  // Start async processing
  processCloudSync(job.id, connection).catch(err => {
    logger.error(`Cloud sync job ${job.id} failed:`, err);
  });
  
  return job;
}

async function processCloudSync(jobId: string, connection: CloudStorageConnection): Promise<void> {
  const pool = getPool();
  
  try {
    // Update status to scanning
    await pool.query(
      `UPDATE cloud_sync_jobs SET status = 'scanning', started_at = NOW() WHERE id = $1`,
      [jobId]
    );
    
    const job = await getJobById(jobId);
    if (!job) throw new Error('Job not found');
    
    const adapter = getAdapter(connection.provider);
    const accessToken = await refreshTokenIfNeeded(connection);
    
    // List all files in the folder
    const files = await adapter.listFiles(accessToken, job.folderId);
    const supportedFiles = files.filter(f => 
      ['.xlsx', '.xls', '.pdf', '.csv'].some(ext => f.name.toLowerCase().endsWith(ext))
    );
    
    await pool.query(
      `UPDATE cloud_sync_jobs SET total_files = $1 WHERE id = $2`,
      [supportedFiles.length, jobId]
    );
    
    // Create temp directory for downloads
    const tempDir = path.join(os.tmpdir(), `cloud-sync-${jobId}`);
    fs.mkdirSync(tempDir, { recursive: true });
    
    // Update status to downloading
    await pool.query(
      `UPDATE cloud_sync_jobs SET status = 'downloading' WHERE id = $1`,
      [jobId]
    );
    
    let processedCount = 0;
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];
    
    // Download and save each file
    for (const file of supportedFiles) {
      try {
        const buffer = await adapter.downloadFile(accessToken, file.id);
        const filePath = path.join(tempDir, file.name);
        fs.writeFileSync(filePath, buffer);
        successCount++;
      } catch (err) {
        errorCount++;
        errors.push(`${file.name}: ${err instanceof Error ? err.message : 'Download failed'}`);
      }
      
      processedCount++;
      await pool.query(
        `UPDATE cloud_sync_jobs SET processed_files = $1, success_count = $2, error_count = $3 WHERE id = $4`,
        [processedCount, successCount, errorCount, jobId]
      );
    }
    
    // Update status to parsing
    await pool.query(
      `UPDATE cloud_sync_jobs SET status = 'parsing' WHERE id = $1`,
      [jobId]
    );
    
    // Run archive ingestion on the temp folder
    const ingestionResult = await ingestArchiveDeals(tempDir, { skipExisting: false });
    
    // Cleanup temp directory
    fs.rmSync(tempDir, { recursive: true, force: true });
    
    // Update job as complete
    await pool.query(
      `UPDATE cloud_sync_jobs SET 
         status = 'complete',
         errors = $1,
         completed_at = NOW()
       WHERE id = $2`,
      [JSON.stringify([...errors, ...ingestionResult.errors]), jobId]
    );
    
    logger.info(`Cloud sync job ${jobId} completed: ${successCount} files, ${ingestionResult.parsedFolders} parsed`);
    
  } catch (err) {
    logger.error(`Cloud sync job ${jobId} error:`, err);
    await pool.query(
      `UPDATE cloud_sync_jobs SET 
         status = 'error',
         errors = $1,
         completed_at = NOW()
       WHERE id = $2`,
      [JSON.stringify([err instanceof Error ? err.message : 'Unknown error']), jobId]
    );
  }
}

export async function getSyncJob(jobId: string, userId: string): Promise<CloudSyncJob | null> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT * FROM cloud_sync_jobs WHERE id = $1 AND user_id = $2`,
    [jobId, userId]
  );
  return result.rows[0] ? mapSyncJobRow(result.rows[0]) : null;
}

export async function listSyncJobs(userId: string, limit = 10): Promise<CloudSyncJob[]> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT * FROM cloud_sync_jobs WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [userId, limit]
  );
  return result.rows.map(mapSyncJobRow);
}

async function getJobById(jobId: string): Promise<CloudSyncJob | null> {
  const pool = getPool();
  const result = await pool.query(`SELECT * FROM cloud_sync_jobs WHERE id = $1`, [jobId]);
  return result.rows[0] ? mapSyncJobRow(result.rows[0]) : null;
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

function mapConnectionRow(row: any): CloudStorageConnection {
  return {
    id: row.id,
    userId: row.user_id,
    provider: row.provider,
    accountEmail: row.account_email,
    accessToken: row.access_token,
    refreshToken: row.refresh_token,
    tokenExpiresAt: new Date(row.token_expires_at),
    rootFolderId: row.root_folder_id,
    rootFolderName: row.root_folder_name,
    isActive: row.is_active,
    lastSyncAt: row.last_sync_at ? new Date(row.last_sync_at) : undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapSyncJobRow(row: any): CloudSyncJob {
  return {
    id: row.id,
    userId: row.user_id,
    connectionId: row.connection_id,
    folderId: row.folder_id,
    folderPath: row.folder_path,
    status: row.status,
    totalFiles: row.total_files,
    processedFiles: row.processed_files,
    successCount: row.success_count,
    errorCount: row.error_count,
    errors: typeof row.errors === 'string' ? JSON.parse(row.errors) : row.errors || [],
    startedAt: row.started_at ? new Date(row.started_at) : undefined,
    completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
    createdAt: new Date(row.created_at),
  };
}

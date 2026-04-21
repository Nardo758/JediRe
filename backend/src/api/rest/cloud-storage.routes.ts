/**
 * Cloud Storage API Routes
 * 
 * Endpoints for managing cloud storage connections and bulk syncing
 */

import { Router, Request, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { 
  getAdapter,
  createConnection,
  listConnections,
  getConnection,
  deleteConnection,
  listFolders,
  listFiles,
  startBulkSync,
  getSyncJob,
  listSyncJobs,
} from '../../services/cloud-storage/cloud-storage.service';
import { CLOUD_PROVIDER_CONFIG, type CloudProvider } from '../../services/cloud-storage/cloud-storage.types';
import { logger } from '../../utils/logger';
import * as crypto from 'crypto';

const router = Router();

// Store pending OAuth states (in production, use Redis)
const pendingOAuthStates = new Map<string, { userId: string; provider: CloudProvider; expiresAt: number }>();

/**
 * GET /api/v1/cloud-storage/providers
 * List available cloud storage providers
 */
router.get('/providers', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  res.json({
    success: true,
    providers: Object.entries(CLOUD_PROVIDER_CONFIG).map(([id, config]) => ({
      id,
      ...config,
      supported: ['google_drive', 'dropbox'].includes(id), // Mark which are implemented
    })),
  });
});

/**
 * GET /api/v1/cloud-storage/connections
 * List user's cloud storage connections
 */
router.get('/connections', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const connections = await listConnections(req.user!.userId);
    
    // Don't send tokens to client
    const safeConnections = connections.map(c => ({
      id: c.id,
      provider: c.provider,
      providerName: CLOUD_PROVIDER_CONFIG[c.provider]?.name || c.provider,
      accountEmail: c.accountEmail,
      isActive: c.isActive,
      lastSyncAt: c.lastSyncAt,
      createdAt: c.createdAt,
    }));
    
    res.json({ success: true, connections: safeConnections });
  } catch (err) {
    logger.error('List connections error:', err);
    res.status(500).json({ success: false, error: 'Failed to list connections' });
  }
});

/**
 * GET /api/v1/cloud-storage/connect/:provider
 * Get OAuth URL for connecting a cloud storage provider
 */
router.get('/connect/:provider', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const provider = req.params.provider as CloudProvider;
    
    if (!['google_drive', 'dropbox'].includes(provider)) {
      return res.status(400).json({ success: false, error: 'Provider not supported yet' });
    }
    
    const adapter = getAdapter(provider);
    
    // Generate state for CSRF protection
    const state = crypto.randomBytes(32).toString('hex');
    pendingOAuthStates.set(state, {
      userId: req.user!.userId,
      provider,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
    });
    
    const authUrl = adapter.getAuthUrl(state);
    
    res.json({ success: true, authUrl });
  } catch (err) {
    logger.error('Connect error:', err);
    res.status(500).json({ success: false, error: 'Failed to generate auth URL' });
  }
});

/**
 * GET /api/v1/cloud-storage/callback/:provider
 * OAuth callback handler
 */
router.get('/callback/:provider', async (req: Request, res: Response) => {
  try {
    const provider = req.params.provider as CloudProvider;
    const { code, state, error } = req.query;
    
    if (error) {
      return res.redirect(`/settings/data-library?error=${encodeURIComponent(error as string)}`);
    }
    
    if (!code || !state) {
      return res.redirect('/settings/data-library?error=missing_params');
    }
    
    // Verify state
    const pending = pendingOAuthStates.get(state as string);
    if (!pending || pending.expiresAt < Date.now()) {
      pendingOAuthStates.delete(state as string);
      return res.redirect('/settings/data-library?error=invalid_state');
    }
    
    if (pending.provider !== provider) {
      return res.redirect('/settings/data-library?error=provider_mismatch');
    }
    
    pendingOAuthStates.delete(state as string);
    
    // Exchange code for tokens and create connection
    await createConnection(pending.userId, provider, code as string);
    
    res.redirect('/settings/data-library?connected=' + provider);
  } catch (err) {
    logger.error('OAuth callback error:', err);
    res.redirect('/settings/data-library?error=connection_failed');
  }
});

/**
 * DELETE /api/v1/cloud-storage/connections/:id
 * Disconnect a cloud storage provider
 */
router.delete('/connections/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const deleted = await deleteConnection(req.params.id, req.user!.userId);
    
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Connection not found' });
    }
    
    res.json({ success: true });
  } catch (err) {
    logger.error('Delete connection error:', err);
    res.status(500).json({ success: false, error: 'Failed to delete connection' });
  }
});

/**
 * GET /api/v1/cloud-storage/browse/:connectionId
 * Browse folders in a cloud storage connection
 */
router.get('/browse/:connectionId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { parentId } = req.query;
    const folders = await listFolders(
      req.params.connectionId,
      req.user!.userId,
      parentId as string | undefined
    );
    
    res.json({ success: true, folders });
  } catch (err) {
    logger.error('Browse folders error:', err);
    res.status(500).json({ 
      success: false, 
      error: err instanceof Error ? err.message : 'Failed to browse folders' 
    });
  }
});

/**
 * GET /api/v1/cloud-storage/files/:connectionId/:folderId
 * List files in a cloud storage folder
 */
router.get('/files/:connectionId/:folderId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const files = await listFiles(
      req.params.connectionId,
      req.user!.userId,
      req.params.folderId
    );
    
    res.json({ success: true, files });
  } catch (err) {
    logger.error('List files error:', err);
    res.status(500).json({ 
      success: false, 
      error: err instanceof Error ? err.message : 'Failed to list files' 
    });
  }
});

/**
 * POST /api/v1/cloud-storage/sync
 * Start bulk sync from a cloud folder
 */
router.post('/sync', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { connectionId, folderId, folderPath } = req.body;
    
    if (!connectionId || !folderId) {
      return res.status(400).json({ success: false, error: 'Missing connectionId or folderId' });
    }
    
    const job = await startBulkSync(
      connectionId,
      req.user!.userId,
      folderId,
      folderPath || folderId
    );
    
    res.json({ success: true, job });
  } catch (err) {
    logger.error('Start sync error:', err);
    res.status(500).json({ 
      success: false, 
      error: err instanceof Error ? err.message : 'Failed to start sync' 
    });
  }
});

/**
 * GET /api/v1/cloud-storage/sync/:jobId
 * Get sync job status
 */
router.get('/sync/:jobId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const job = await getSyncJob(req.params.jobId, req.user!.userId);
    
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }
    
    res.json({ success: true, job });
  } catch (err) {
    logger.error('Get sync job error:', err);
    res.status(500).json({ success: false, error: 'Failed to get job status' });
  }
});

/**
 * GET /api/v1/cloud-storage/sync
 * List recent sync jobs
 */
router.get('/sync', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const jobs = await listSyncJobs(req.user!.userId, limit);
    
    res.json({ success: true, jobs });
  } catch (err) {
    logger.error('List sync jobs error:', err);
    res.status(500).json({ success: false, error: 'Failed to list jobs' });
  }
});

export default router;

/**
 * Bulk Upload API Routes
 * 
 * Handles bulk file uploads for archive ingestion
 */

import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import multer from 'multer';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { ingestArchiveDeals } from '../../services/archive-ingestion.service';
import { logger } from '../../utils/logger';
import AdmZip from 'adm-zip';
import { query as dbQuery } from '../../database/connection';

const router = Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(os.tmpdir(), 'bulk-uploads', uuidv4());
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Sanitize filename
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, safeName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB max per file
    files: 100, // Max 100 files per upload
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      'application/zip',
      'application/x-zip-compressed',
    ];
    
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = ['.pdf', '.xlsx', '.xls', '.csv', '.zip'];
    
    if (allowedTypes.includes(file.mimetype) || allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not supported: ${file.originalname}`));
    }
  },
});

// Track upload jobs
interface UploadJob {
  id: string;
  userId: string;
  status: 'uploading' | 'extracting' | 'parsing' | 'complete' | 'error';
  totalFiles: number;
  processedFiles: number;
  dealsCreated: number;
  errors: string[];
  uploadPath: string;
  dealId?: string;
  createdAt: Date;
  completedAt?: Date;
}

const uploadJobs = new Map<string, UploadJob>();

/**
 * POST /api/v1/bulk-upload/files
 * Upload multiple files for archive ingestion
 */
router.post('/files', requireAuth, upload.array('files', 100), async (req: AuthenticatedRequest, res: Response) => {
  const jobId = uuidv4();
  const files = req.files as Express.Multer.File[];
  const dealId = req.body?.dealId as string | undefined;
  
  if (!files || files.length === 0) {
    return res.status(400).json({ success: false, error: 'No files uploaded' });
  }
  
  const uploadPath = files[0].destination;
  
  // Create job
  const job: UploadJob = {
    id: jobId,
    userId: req.user!.userId,
    status: 'uploading',
    totalFiles: files.length,
    processedFiles: 0,
    dealsCreated: 0,
    errors: [],
    uploadPath,
    dealId,
    createdAt: new Date(),
  };
  
  uploadJobs.set(jobId, job);
  
  // Return immediately with job ID
  res.json({ 
    success: true, 
    jobId,
    filesUploaded: files.length,
    message: 'Upload started. Poll /api/v1/bulk-upload/status/:jobId for progress.',
  });
  
  // Process in background
  processUploadJob(job).catch(err => {
    logger.error(`Upload job ${jobId} failed:`, err);
    job.status = 'error';
    job.errors.push(err.message);
  });
});

/**
 * POST /api/v1/bulk-upload/zip
 * Upload a ZIP file containing deal folders
 */
router.post('/zip', requireAuth, upload.single('file'), async (req: AuthenticatedRequest, res: Response) => {
  const jobId = uuidv4();
  const file = req.file;
  const dealId = req.body?.dealId as string | undefined;
  
  if (!file) {
    return res.status(400).json({ success: false, error: 'No file uploaded' });
  }
  
  if (!file.originalname.toLowerCase().endsWith('.zip')) {
    return res.status(400).json({ success: false, error: 'File must be a ZIP archive' });
  }
  
  // Create extraction directory
  const extractPath = path.join(os.tmpdir(), 'bulk-uploads', jobId);
  fs.mkdirSync(extractPath, { recursive: true });
  
  // Create job
  const job: UploadJob = {
    id: jobId,
    userId: req.user!.userId,
    status: 'uploading',
    totalFiles: 0,
    processedFiles: 0,
    dealsCreated: 0,
    errors: [],
    uploadPath: extractPath,
    dealId,
    createdAt: new Date(),
  };
  
  uploadJobs.set(jobId, job);
  
  // Return immediately with job ID
  res.json({ 
    success: true, 
    jobId,
    message: 'ZIP upload started. Poll /api/v1/bulk-upload/status/:jobId for progress.',
  });
  
  // Process in background
  processZipUpload(job, file.path).catch(err => {
    logger.error(`ZIP upload job ${jobId} failed:`, err);
    job.status = 'error';
    job.errors.push(err.message);
  });
});

async function linkDealToLibrary(dealId: string): Promise<void> {
  try {
    await dbQuery('SELECT populate_data_library_from_deal($1)', [dealId]);
    logger.info(`Populated data library from deal ${dealId}`);
  } catch (err) {
    logger.warn(`Could not populate data library from deal ${dealId}:`, err);
  }
}

async function processUploadJob(job: UploadJob): Promise<void> {
  try {
    job.status = 'parsing';
    
    const result = await ingestArchiveDeals(job.uploadPath, { skipExisting: false });
    
    job.dealsCreated = result.parsedFolders;
    job.errors = result.errors;

    // If a deal was selected, link it to the data library regardless of archive parsing
    if (job.dealId) {
      await linkDealToLibrary(job.dealId);
      if (result.parsedFolders === 0) job.dealsCreated = 1;
    }

    job.status = 'complete';
    job.completedAt = new Date();
    
    logger.info(`Upload job ${job.id} complete: ${job.dealsCreated} assets added`);
    
    // Cleanup after 1 hour
    setTimeout(() => {
      fs.rmSync(job.uploadPath, { recursive: true, force: true });
      uploadJobs.delete(job.id);
    }, 60 * 60 * 1000);
    
  } catch (err) {
    job.status = 'error';
    job.errors.push(err instanceof Error ? err.message : 'Unknown error');
    throw err;
  }
}

async function processZipUpload(job: UploadJob, zipPath: string): Promise<void> {
  try {
    job.status = 'extracting';
    
    // Extract ZIP
    const zip = new AdmZip(zipPath);
    const entries = zip.getEntries();
    job.totalFiles = entries.filter(e => !e.isDirectory).length;
    
    zip.extractAllTo(job.uploadPath, true);
    
    // Delete original ZIP
    fs.unlinkSync(zipPath);
    
    job.status = 'parsing';
    
    // Run archive ingestion
    const result = await ingestArchiveDeals(job.uploadPath, { skipExisting: false });
    
    job.dealsCreated = result.parsedFolders;
    job.processedFiles = job.totalFiles;
    job.errors = result.errors;

    // If a deal was selected, link it to the data library regardless of archive parsing
    if (job.dealId) {
      await linkDealToLibrary(job.dealId);
      if (result.parsedFolders === 0) job.dealsCreated = 1;
    }

    job.status = 'complete';
    job.completedAt = new Date();
    
    logger.info(`ZIP upload job ${job.id} complete: ${job.dealsCreated} assets added from ${job.totalFiles} files`);
    
    // Cleanup after 1 hour
    setTimeout(() => {
      fs.rmSync(job.uploadPath, { recursive: true, force: true });
      uploadJobs.delete(job.id);
    }, 60 * 60 * 1000);
    
  } catch (err) {
    job.status = 'error';
    job.errors.push(err instanceof Error ? err.message : 'Unknown error');
    throw err;
  }
}

/**
 * GET /api/v1/bulk-upload/status/:jobId
 * Get upload job status
 */
router.get('/status/:jobId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const job = uploadJobs.get(req.params.jobId);
  
  if (!job) {
    return res.status(404).json({ success: false, error: 'Job not found' });
  }
  
  if (job.userId !== req.user!.userId) {
    return res.status(403).json({ success: false, error: 'Not authorized' });
  }
  
  res.json({
    success: true,
    job: {
      id: job.id,
      status: job.status,
      totalFiles: job.totalFiles,
      processedFiles: job.processedFiles,
      dealsCreated: job.dealsCreated,
      errors: job.errors,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
    },
  });
});

/**
 * GET /api/v1/bulk-upload/jobs
 * List recent upload jobs for the user
 */
router.get('/jobs', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const userJobs = Array.from(uploadJobs.values())
    .filter(j => j.userId === req.user!.userId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 10)
    .map(job => ({
      id: job.id,
      status: job.status,
      totalFiles: job.totalFiles,
      dealsCreated: job.dealsCreated,
      errorCount: job.errors.length,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
    }));
  
  res.json({ success: true, jobs: userJobs });
});

export default router;

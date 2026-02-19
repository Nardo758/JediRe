/**
 * Module Libraries API Routes
 * 
 * Endpoints for uploading and managing historical data files for Opus learning.
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import { logger } from '../../utils/logger';
import { moduleLibraryService } from '../../services/moduleLibrary.service';
import * as fs from 'fs';

const router = Router();

// Configure multer for file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel.sheet.macroEnabled.12',
      'application/pdf',
      'text/csv',
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only Excel, PDF, and CSV files are allowed.'));
    }
  },
});

/**
 * POST /api/v1/module-libraries/:module/upload
 * Upload file to module library
 */
router.post('/:module/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const { module } = req.params;
    const { category } = req.body;
    const userId = (req as any).user?.userId;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (!category) {
      return res.status(400).json({ error: 'Category is required' });
    }

    const validModules = ['financial', 'market', 'due_diligence'];
    if (!validModules.includes(module)) {
      return res.status(400).json({ error: 'Invalid module name' });
    }

    const file = await moduleLibraryService.uploadFile({
      userId,
      module,
      category,
      file: {
        originalname: req.file.originalname,
        buffer: req.file.buffer,
        mimetype: req.file.mimetype,
        size: req.file.size,
      },
    });

    res.json({
      fileId: file.id,
      status: 'uploaded',
      fileName: file.fileName,
      parsingStatus: file.parsingStatus,
    });
  } catch (error) {
    logger.error('[ModuleLibraries] Upload error:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

/**
 * GET /api/v1/module-libraries/:module/files
 * List files in module library
 */
router.get('/:module/files', async (req: Request, res: Response) => {
  try {
    const { module } = req.params;
    const { category } = req.query;
    const userId = (req as any).user?.userId;

    const files = await moduleLibraryService.getFiles(
      userId,
      module,
      category as string | undefined
    );

    res.json({
      files: files.map(f => ({
        id: f.id,
        fileName: f.fileName,
        category: f.category,
        fileSize: f.fileSize,
        mimeType: f.mimeType,
        uploadedAt: f.uploadedAt,
        parsingStatus: f.parsingStatus,
        parsedAt: f.parsedAt,
        parsingErrors: f.parsingErrors,
      })),
      total: files.length,
    });
  } catch (error) {
    logger.error('[ModuleLibraries] Error fetching files:', error);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

/**
 * GET /api/v1/module-libraries/:module/files/:fileId
 * Get file details
 */
router.get('/:module/files/:fileId', async (req: Request, res: Response) => {
  try {
    const { fileId } = req.params;
    const userId = (req as any).user?.userId;

    const file = await moduleLibraryService.getFileById(parseInt(fileId));

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Check ownership
    if (file.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({
      id: file.id,
      fileName: file.fileName,
      category: file.category,
      fileSize: file.fileSize,
      mimeType: file.mimeType,
      uploadedAt: file.uploadedAt,
      parsingStatus: file.parsingStatus,
      parsedAt: file.parsedAt,
      parsingErrors: file.parsingErrors,
    });
  } catch (error) {
    logger.error('[ModuleLibraries] Error fetching file details:', error);
    res.status(500).json({ error: 'Failed to fetch file details' });
  }
});

/**
 * DELETE /api/v1/module-libraries/:module/files/:fileId
 * Delete file
 */
router.delete('/:module/files/:fileId', async (req: Request, res: Response) => {
  try {
    const { fileId } = req.params;
    const userId = (req as any).user?.userId;

    const success = await moduleLibraryService.deleteFile(parseInt(fileId), userId);

    if (!success) {
      return res.status(404).json({ error: 'File not found or access denied' });
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('[ModuleLibraries] Error deleting file:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

/**
 * GET /api/v1/module-libraries/:module/files/:fileId/download
 * Download file
 */
router.get('/:module/files/:fileId/download', async (req: Request, res: Response) => {
  try {
    const { fileId } = req.params;
    const userId = (req as any).user?.userId;

    const file = await moduleLibraryService.getFileById(parseInt(fileId));

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Check ownership
    if (file.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if file exists on disk
    if (!fs.existsSync(file.filePath)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    // Send file
    res.download(file.filePath, file.fileName);
  } catch (error) {
    logger.error('[ModuleLibraries] Error downloading file:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

/**
 * GET /api/v1/module-libraries/:module/learning-status
 * Get Opus learning status
 */
router.get('/:module/learning-status', async (req: Request, res: Response) => {
  try {
    const { module } = req.params;
    const userId = (req as any).user?.userId;

    const status = await moduleLibraryService.getLearningStatus(userId, module);

    res.json({
      filesAnalyzed: status.filesAnalyzed,
      totalFiles: status.totalFiles,
      patterns: status.patterns.map(p => ({
        id: p.id,
        patternType: p.patternType,
        patternValue: p.patternValue,
        confidenceScore: p.confidenceScore,
        sampleSize: p.sampleSize,
      })),
      templates: status.templates,
    });
  } catch (error) {
    logger.error('[ModuleLibraries] Error fetching learning status:', error);
    res.status(500).json({ error: 'Failed to fetch learning status' });
  }
});

/**
 * POST /api/v1/module-libraries/:module/analyze
 * Trigger Opus analysis (async)
 */
router.post('/:module/analyze', async (req: Request, res: Response) => {
  try {
    const { module } = req.params;
    const { fileIds } = req.body;
    const userId = (req as any).user?.userId;

    if (!fileIds || !Array.isArray(fileIds)) {
      return res.status(400).json({ error: 'fileIds array is required' });
    }

    // TODO: Implement async job queue for analysis
    logger.info(`[ModuleLibraries] Analysis requested for module ${module}, files:`, fileIds);

    res.json({
      jobId: `job_${Date.now()}`,
      status: 'queued',
      message: 'Analysis job queued successfully',
    });
  } catch (error) {
    logger.error('[ModuleLibraries] Error triggering analysis:', error);
    res.status(500).json({ error: 'Failed to trigger analysis' });
  }
});

export default router;

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import multer from 'multer';
import { DataLibraryService } from '../../services/dataLibrary.service';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'text/csv', 'application/csv',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/pdf',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV, Excel, and PDF files are allowed'));
    }
  },
});

export function createDataLibraryRoutes(pool: Pool): Router {
  const router = Router();
  const service = new DataLibraryService(pool);

  router.get('/', async (req: Request, res: Response) => {
    try {
      const files = await service.getFiles({
        city: req.query.city as string,
        zipCode: req.query.zipCode as string,
        propertyType: req.query.propertyType as string,
        propertyHeight: req.query.propertyHeight as string,
        sourceType: req.query.sourceType as string,
        unitCountMin: req.query.unitCountMin ? parseInt(req.query.unitCountMin as string) : undefined,
        unitCountMax: req.query.unitCountMax ? parseInt(req.query.unitCountMax as string) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
      });
      res.json(files);
    } catch (err: any) {
      console.error('Data library list error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/comparables', async (req: Request, res: Response) => {
    try {
      const comparables = await service.findComparables({
        city: req.query.city as string,
        propertyType: req.query.propertyType as string,
        unitCount: req.query.unitCount ? parseInt(req.query.unitCount as string) : undefined,
        propertyHeight: req.query.propertyHeight as string,
      });
      res.json(comparables);
    } catch (err: any) {
      console.error('Data library comparables error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/:id', async (req: Request, res: Response) => {
    try {
      // Owner-scoped — closes IDOR on file-id GET (T383 architect review).
      const userId = (req as any).user?.userId;
      if (!userId) return res.status(401).json({ error: 'Unauthenticated' });
      const file = await service.getFile(parseInt(req.params.id), userId);
      if (!file) return res.status(404).json({ error: 'Not found' });
      res.json(file);
    } catch (err: any) {
      console.error('Data library get error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/', upload.single('file') as any, async (req: Request, res: Response) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'File required' });

      const file = await service.uploadFile({
        userId: (req as any).user?.userId,
        file: {
          originalname: req.file.originalname,
          buffer: req.file.buffer,
          mimetype: req.file.mimetype,
          size: req.file.size,
        },
        city: req.body.city,
        zipCode: req.body.zipCode,
        propertyType: req.body.propertyType,
        propertyHeight: req.body.propertyHeight,
        yearBuilt: req.body.yearBuilt,
        unitCount: req.body.unitCount ? parseInt(req.body.unitCount) : undefined,
        sourceType: req.body.sourceType,
        tags: req.body.tags ? JSON.parse(req.body.tags) : [],
      });

      res.status(201).json(file);
    } catch (err: any) {
      console.error('Data library upload error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  router.patch('/:id', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) return res.status(401).json({ error: 'Unauthenticated' });
      const file = await service.updateFile(parseInt(req.params.id), req.body, userId);
      if (!file) return res.status(404).json({ error: 'Not found' });
      res.json(file);
    } catch (err: any) {
      console.error('Data library update error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) return res.status(401).json({ error: 'Unauthenticated' });
      const ok = await service.deleteFile(parseInt(req.params.id), userId);
      if (!ok) return res.status(404).json({ error: 'Not found' });
      res.status(204).send();
    } catch (err: any) {
      console.error('Data library delete error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Re-run the upload-time parse pipeline for a file. Used by the Retry
  // button on the Data Library page when an OM upload fails OCR or the
  // model returns malformed JSON.
  //
  // Concurrency: claimForRetry atomically transitions parsing_status to
  // 'parsing' only when it isn't already 'parsing'. Concurrent retry
  // requests therefore see exactly one winner (HTTP 202) and one loser
  // (HTTP 409) — eliminates the duplicate-pipeline race the architect
  // flagged in T383 review. Owner-scoped to close the IDOR gap.
  router.post('/:id/retry', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) return res.status(401).json({ error: 'Unauthenticated' });

      const id = parseInt(req.params.id);

      // Pre-flight: distinguish "not found / not yours" (404) from "already
      // running" (409). We do an owner-scoped fetch first, then attempt the
      // atomic claim — keeps the error semantics clean for the UI.
      const existing = await service.getFile(id, userId);
      if (!existing) return res.status(404).json({ error: 'Not found' });

      const claimed = await service.claimForRetry(id, userId);
      if (!claimed) {
        return res.status(409).json({
          id, status: 'already_parsing',
          error: 'Parse pipeline is already running for this file',
        });
      }

      // Fire-and-forget; the dataLibrary service handles state transitions.
      service.parseFileAsync(id, claimed.file_path, claimed.mime_type).catch((err: unknown) => {
        console.error('Data library retry parse error:', err);
      });

      res.status(202).json({ id, status: 'retry_queued' });
    } catch (err: any) {
      console.error('Data library retry error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

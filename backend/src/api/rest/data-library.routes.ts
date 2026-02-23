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
      const file = await service.getFile(parseInt(req.params.id));
      if (!file) return res.status(404).json({ error: 'Not found' });
      res.json(file);
    } catch (err: any) {
      console.error('Data library get error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/', upload.single('file'), async (req: Request, res: Response) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'File required' });

      const file = await service.uploadFile({
        userId: (req as any).userId,
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
      const file = await service.updateFile(parseInt(req.params.id), req.body);
      if (!file) return res.status(404).json({ error: 'Not found' });
      res.json(file);
    } catch (err: any) {
      console.error('Data library update error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      await service.deleteFile(parseInt(req.params.id));
      res.status(204).send();
    } catch (err: any) {
      console.error('Data library delete error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

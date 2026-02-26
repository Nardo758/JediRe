import { Router, Request, Response } from 'express';
import multer from 'multer';
import { dataUploadService } from '../../services/data-upload.service';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/tab-separated-values',
    ];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(csv|xlsx|xls|tsv)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only CSV, Excel, and TSV files are allowed.'));
    }
  },
});

function getFileType(filename: string, mimetype: string): string {
  if (filename.endsWith('.csv') || mimetype === 'text/csv') return 'csv';
  if (filename.endsWith('.tsv') || mimetype === 'text/tab-separated-values') return 'tsv';
  if (filename.endsWith('.xlsx')) return 'xlsx';
  if (filename.endsWith('.xls')) return 'xls';
  return 'csv';
}

router.post('/:propertyId/actuals/detect-columns', upload.single('file') as any, async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const fileType = getFileType(req.file.originalname, req.file.mimetype);
    const result = await dataUploadService.detectColumns(req.file.buffer, fileType);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:propertyId/actuals/upload', upload.single('file') as any, async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { propertyId } = req.params;
    const userId = (req as any).user?.userId || 'system';
    const { columnMapping, isBudget } = req.body;

    let mapping: Record<string, string>;
    if (columnMapping) {
      mapping = typeof columnMapping === 'string' ? JSON.parse(columnMapping) : columnMapping;
    } else {
      const fileType = getFileType(req.file.originalname, req.file.mimetype);
      const detected = await dataUploadService.detectColumns(req.file.buffer, fileType);
      mapping = detected.mapping;
    }

    const fileType = getFileType(req.file.originalname, req.file.mimetype);
    const result = await dataUploadService.processUpload(
      propertyId, userId, req.file.buffer, fileType, req.file.originalname,
      mapping, isBudget === 'true' || isBudget === true
    );

    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:propertyId/actuals', async (req: Request, res: Response) => {
  try {
    const { propertyId } = req.params;
    const { startDate, endDate, isBudget, limit } = req.query;
    const result = await dataUploadService.getActuals(propertyId, {
      startDate: startDate as string,
      endDate: endDate as string,
      isBudget: isBudget !== undefined ? isBudget === 'true' : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:propertyId/uploads', async (req: Request, res: Response) => {
  try {
    const result = await dataUploadService.getUploadHistory(req.params.propertyId);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

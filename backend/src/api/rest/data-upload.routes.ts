import { Router, Request, Response } from 'express';
import multer from 'multer';
import { dataUploadService } from '../../services/data-upload.service';
import {
  parseFile,
  detectFormat,
  autoMapColumns,
  processRows,
  insertActuals,
  createUploadRecord,
  updateUploadRecord,
} from '../../services/uploadService';
import { getDb } from '../../database/drizzle';

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

router.post('/:propertyId/actuals/detect-columns', upload.single('file') as any, async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const { rows, columns } = parseFile(req.file.buffer, req.file.originalname);
    const format = detectFormat(columns);
    const { mapped, unmapped } = autoMapColumns(columns, rows);

    const dates = rows.slice(0, 5).map(r => {
      const dateCol = mapped.find(m => m.targetColumn === 'report_month');
      return dateCol ? r[dateCol.sourceColumn] : null;
    }).filter(Boolean);

    const warnings: string[] = [];
    if (!mapped.find(m => m.targetColumn === 'report_month')) {
      warnings.push('No date/month column detected. You must map one manually.');
    }
    if (unmapped.length > columns.length * 0.5) {
      warnings.push(`${unmapped.length} of ${columns.length} columns could not be auto-mapped.`);
    }

    res.json({
      success: true,
      detectedFormat: format,
      totalRows: rows.length,
      columnsFound: columns,
      suggestedMappings: mapped,
      unmappedColumns: unmapped,
      sampleDates: dates,
      warnings,
    });
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
    const db = getDb();

    const { rows, columns } = parseFile(req.file.buffer, req.file.originalname);

    let mapping: Record<string, string>;
    if (columnMapping) {
      const parsed = typeof columnMapping === 'string' ? JSON.parse(columnMapping) : columnMapping;
      mapping = {};
      if (Array.isArray(parsed)) {
        for (const m of parsed) {
          mapping[m.sourceColumn] = m.targetColumn;
        }
      } else {
        mapping = parsed;
      }
    } else {
      const { mapped } = autoMapColumns(columns, rows);
      mapping = {};
      for (const m of mapped) {
        mapping[m.sourceColumn] = m.targetColumn;
      }
    }

    const uploadId = await createUploadRecord(db as any, {
      userId,
      propertyId,
      originalFilename: req.file.originalname,
      fileSizeBytes: req.file.size,
      fileType: req.file.originalname.split('.').pop()?.toLowerCase() || 'csv',
      status: 'processing',
      columnMapping: mapping,
      sourceFormat: detectFormat(columns),
      rowsTotal: rows.length,
    });

    const result = processRows(
      rows,
      mapping,
      propertyId,
      uploadId,
      isBudget === 'true' || isBudget === true,
    );

    if (result._records.length > 0) {
      await insertActuals(db as any, result._records);
    }

    await updateUploadRecord(db as any, uploadId, result);

    res.json({
      success: true,
      uploadId: result.uploadId,
      status: result.status,
      rowsTotal: result.rowsTotal,
      rowsSucceeded: result.rowsSucceeded,
      rowsFailed: result.rowsFailed,
      errors: result.errors,
      dateRange: result.dateRange,
    });
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

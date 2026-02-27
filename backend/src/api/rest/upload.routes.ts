import { Router, Request, Response } from 'express';
import multer from 'multer';
import { randomUUID } from 'crypto';
import { eq, desc } from 'drizzle-orm';
import {
  parseFile,
  detectFormat,
  autoMapColumns,
  parseDate,
  processRows,
  insertActuals,
  createUploadRecord,
  updateUploadRecord,
} from '../../services/uploadService';
import { getDb } from '../../database/drizzle';
import { uploadTemplates, dataUploads } from '../../db/schema/dataPipeline';
import { query } from '../../database/connection';

async function verifyPropertyAccess(propertyId: string, userId: string): Promise<boolean> {
  const result = await query(
    'SELECT id FROM properties WHERE id = $1',
    [propertyId]
  );
  return result.rows.length > 0;
}

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = file.originalname.split('.').pop()?.toLowerCase() ?? '';
    if (['csv', 'xlsx', 'xls', 'tsv'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: .${ext}. Use .csv, .xlsx, .xls, or .tsv`));
    }
  },
});

const uploadCache = new Map<string, { rows: any[]; columns: string[]; filename: string; fileType: string; buffer: Buffer }>();

router.post('/preview', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filename = req.file.originalname;
    const fileType = filename.split('.').pop()?.toLowerCase() ?? '';

    const { rows, columns } = parseFile(req.file.buffer, filename);

    const detectedFormat = detectFormat(columns);
    const { mapped, unmapped } = autoMapColumns(columns, rows);

    let dateRange: { start: string; end: string } | null = null;
    const dateMapping = mapped.find((m) => m.targetColumn === 'report_month');
    if (dateMapping) {
      const dates = rows
        .map((r) => parseDate(r[dateMapping.sourceColumn]))
        .filter(Boolean) as string[];
      if (dates.length > 0) {
        dates.sort();
        dateRange = { start: dates[0], end: dates[dates.length - 1] };
      }
    }

    const warnings: string[] = [];
    if (!mapped.some((m) => m.targetColumn === 'report_month')) {
      warnings.push('No date/month column detected — map one manually');
    }
    const hasRevenue = mapped.some((m) =>
      ['noi', 'effective_gross_income', 'gross_potential_rent', 'net_rental_income'].includes(m.targetColumn)
    );
    if (!hasRevenue) {
      warnings.push('No revenue columns detected — check your column mapping');
    }
    if (unmapped.length > mapped.length) {
      warnings.push(`${unmapped.length} columns couldn't be auto-mapped — review the mapping`);
    }

    const uploadId = randomUUID();
    uploadCache.set(uploadId, {
      rows,
      columns,
      filename,
      fileType,
      buffer: req.file.buffer,
    });

    setTimeout(() => uploadCache.delete(uploadId), 30 * 60 * 1000);

    return res.json({
      uploadId,
      filename,
      fileType,
      detectedFormat,
      totalRows: rows.length,
      columnsFound: columns,
      suggestedMappings: mapped,
      unmappedColumns: unmapped,
      dateRange,
      warnings,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    return res.status(400).json({ error: message });
  }
});

router.post('/process', async (req: Request, res: Response) => {
  let dbUploadId: string | null = null;
  const db = getDb();

  try {
    const { uploadId, propertyId, columnMapping, isBudget = false, dataSource = 'csv_upload' } = req.body;

    if (!uploadId || !propertyId || !columnMapping) {
      return res.status(400).json({ error: 'Missing uploadId, propertyId, or columnMapping' });
    }

    if (!Object.values(columnMapping).includes('report_month')) {
      return res.status(400).json({ error: "Must map at least one column to 'report_month'" });
    }

    const userId = (req as any).user?.userId ?? 'system';

    const hasAccess = await verifyPropertyAccess(propertyId, userId);
    if (!hasAccess) {
      return res.status(404).json({ error: 'Property not found' });
    }

    const cached = uploadCache.get(uploadId);
    if (!cached) {
      return res.status(404).json({ error: 'Upload not found — re-upload the file' });
    }

    dbUploadId = await createUploadRecord(db as any, {
      userId,
      propertyId,
      originalFilename: cached.filename,
      fileSizeBytes: cached.buffer.length,
      fileType: cached.fileType,
      status: 'processing',
      columnMapping,
      sourceFormat: detectFormat(cached.columns),
    });

    const result = processRows(
      cached.rows,
      columnMapping,
      propertyId,
      dbUploadId,
      isBudget,
      dataSource,
    );

    const records = result._records;

    if (records.length > 0) {
      await insertActuals(db as any, records);
    }

    await updateUploadRecord(db as any, dbUploadId, result);

    uploadCache.delete(uploadId);

    return res.json({
      uploadId: dbUploadId,
      status: result.status,
      rowsTotal: result.rowsTotal,
      rowsSucceeded: result.rowsSucceeded,
      rowsFailed: result.rowsFailed,
      errors: result.errors,
      dateRange: result.dateRange,
    });
  } catch (err) {
    if (dbUploadId) {
      try {
        await updateUploadRecord(db as any, dbUploadId, {
          uploadId: dbUploadId,
          status: 'failed',
          rowsTotal: 0,
          rowsSucceeded: 0,
          rowsFailed: 0,
          errors: [{ row: 0, error: err instanceof Error ? err.message : 'Processing failed' }],
          dateRange: null,
        });
      } catch (_) {}
    }
    const message = err instanceof Error ? err.message : 'Processing failed';
    return res.status(500).json({ error: message });
  }
});

router.get('/templates', async (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const templates = await db.select().from(uploadTemplates);
    return res.json(templates);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch templates';
    return res.status(500).json({ error: message });
  }
});

router.get('/history/:propertyId', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId ?? 'system';
    const hasAccess = await verifyPropertyAccess(req.params.propertyId, userId);
    if (!hasAccess) {
      return res.status(404).json({ error: 'Property not found' });
    }

    const db = getDb();
    const uploads = await db
      .select()
      .from(dataUploads)
      .where(eq(dataUploads.propertyId, req.params.propertyId))
      .orderBy(desc(dataUploads.createdAt));
    return res.json({ propertyId: req.params.propertyId, uploads });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch history';
    return res.status(500).json({ error: message });
  }
});

export default router;

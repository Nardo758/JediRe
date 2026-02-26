/**
 * JEDI RE: Upload Routes
 * =======================
 * Place in: backend/src/api/rest/upload.routes.ts
 * Mount in index.ts: app.use('/api/v1/uploads', uploadRoutes);
 * 
 * Dependencies: multer (file upload middleware), your db instance
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import { randomUUID } from 'crypto';
import {
  parseFile,
  detectFormat,
  autoMapColumns,
  processRows,
  insertActuals,
  createUploadRecord,
  updateUploadRecord,
} from '../../services/uploadService';
// Import your Drizzle db instance — adjust path to match your project
// import { db } from '../../db';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
  fileFilter: (_req, file, cb) => {
    const ext = file.originalname.split('.').pop()?.toLowerCase() ?? '';
    if (['csv', 'xlsx', 'xls', 'tsv'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: .${ext}. Use .csv, .xlsx, .xls, or .tsv`));
    }
  },
});

// In-memory staging cache (swap for Redis in production)
const uploadCache = new Map<string, { rows: any[]; columns: string[]; filename: string; fileType: string; buffer: Buffer }>();

/**
 * POST /api/v1/uploads/preview
 * Upload a file, detect format, return column mapping preview.
 * User reviews suggested mappings before processing.
 */
router.post('/preview', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filename = req.file.originalname;
    const fileType = filename.split('.').pop()?.toLowerCase() ?? '';

    // Parse file
    const { rows, columns } = parseFile(req.file.buffer, filename);

    // Detect format + auto-map
    const detectedFormat = detectFormat(columns);
    const { mapped, unmapped } = autoMapColumns(columns, rows);

    // Detect date range
    let dateRange: { start: string; end: string } | null = null;
    const dateMapping = mapped.find((m) => m.targetColumn === 'report_month');
    if (dateMapping) {
      const { parseDate } = await import('../../services/uploadService');
      const dates = rows
        .map((r) => parseDate(r[dateMapping.sourceColumn]))
        .filter(Boolean) as string[];
      if (dates.length > 0) {
        dates.sort();
        dateRange = { start: dates[0], end: dates[dates.length - 1] };
      }
    }

    // Warnings
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

    // Cache for processing step
    const uploadId = randomUUID();
    uploadCache.set(uploadId, {
      rows,
      columns,
      filename,
      fileType,
      buffer: req.file.buffer,
    });

    // Auto-expire cache after 30 minutes
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

/**
 * POST /api/v1/uploads/process
 * Confirm column mapping, process rows into deal_monthly_actuals.
 */
router.post('/process', async (req: Request, res: Response) => {
  try {
    const { uploadId, propertyId, columnMapping, isBudget = false, dataSource = 'csv_upload' } = req.body;

    if (!uploadId || !propertyId || !columnMapping) {
      return res.status(400).json({ error: 'Missing uploadId, propertyId, or columnMapping' });
    }

    // Check report_month is mapped
    if (!Object.values(columnMapping).includes('report_month')) {
      return res.status(400).json({ error: "Must map at least one column to 'report_month'" });
    }

    const cached = uploadCache.get(uploadId);
    if (!cached) {
      return res.status(404).json({ error: 'Upload not found — re-upload the file' });
    }

    // Process rows
    const result = processRows(
      cached.rows,
      columnMapping,
      propertyId,
      uploadId,
      isBudget,
      dataSource,
    ) as any;

    // Insert into database
    // TODO: Uncomment when db is wired
    // const records = result._records;
    // delete result._records;
    //
    // // Create upload tracking record
    // const userId = req.user?.id ?? 'system'; // from your auth middleware
    // await createUploadRecord(db, {
    //   id: uploadId,
    //   userId,
    //   propertyId,
    //   originalFilename: cached.filename,
    //   fileSizeBytes: cached.buffer.length,
    //   fileType: cached.fileType,
    //   status: 'processing',
    //   columnMapping,
    //   sourceFormat: dataSource,
    // });
    //
    // // Bulk insert actuals
    // await insertActuals(db, records);
    //
    // // Update upload record with results
    // await updateUploadRecord(db, uploadId, result);

    // Clean up cache
    uploadCache.delete(uploadId);

    return res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Processing failed';
    return res.status(500).json({ error: message });
  }
});

/**
 * GET /api/v1/uploads/templates
 * List available upload mapping templates.
 */
router.get('/templates', async (_req: Request, res: Response) => {
  // TODO: Query from upload_templates table
  // const templates = await db.select().from(uploadTemplates);
  return res.json([
    {
      name: 'JEDI RE Standard Template',
      sourceFormat: 'manual',
      description: 'All 30+ columns pre-formatted. Recommended for manual entry.',
    },
    {
      name: 'AppFolio Export',
      sourceFormat: 'appfolio',
      description: 'Pre-mapped for standard AppFolio P&L exports.',
    },
    {
      name: 'Yardi Voyager',
      sourceFormat: 'yardi',
      description: 'Pre-mapped for Yardi Voyager financial exports.',
    },
  ]);
});

/**
 * GET /api/v1/uploads/history/:propertyId
 * Get upload history for a property.
 */
router.get('/history/:propertyId', async (req: Request, res: Response) => {
  // TODO: Query data_uploads by propertyId, order by created_at desc
  // const uploads = await db
  //   .select()
  //   .from(dataUploads)
  //   .where(eq(dataUploads.propertyId, req.params.propertyId))
  //   .orderBy(desc(dataUploads.createdAt));
  return res.json({ propertyId: req.params.propertyId, uploads: [] });
});

export default router;

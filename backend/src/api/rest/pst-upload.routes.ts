import { Router, Request, Response, RequestHandler } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { query } from '../../database/connection';
import { pstIngestionService } from '../../services/pst-ingestion.service';
import { pstAiExtractionService } from '../../services/pst-ai-extraction.service';
import { logger } from '../../utils/logger';

const router = Router();

const PST_UPLOAD_DIR = path.join(__dirname, '../../../uploads/pst');

function ensureUploadDir(): void {
  if (!fs.existsSync(PST_UPLOAD_DIR)) {
    fs.mkdirSync(PST_UPLOAD_DIR, { recursive: true });
  }
}

const pstUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.originalname.match(/\.pst$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only .pst files are allowed.'));
    }
  },
});

const activeJobs = new Map<string, {
  status: 'parsing' | 'extracting' | 'storing' | 'completed' | 'failed';
  uploadId: string;
  totalEmails: number;
  processedEmails: number;
  entitiesFound: number;
  errors: string[];
  startedAt: Date;
  completedAt: Date | null;
}>();

function persistPstFile(buffer: Buffer, uploadId: string, originalFilename: string): string {
  ensureUploadDir();
  const ext = path.extname(originalFilename) || '.pst';
  const safeFilename = `${uploadId}${ext}`;
  const filePath = path.join(PST_UPLOAD_DIR, safeFilename);
  fs.writeFileSync(filePath, buffer);
  return `uploads/pst/${safeFilename}`;
}

const handlePstUpload: RequestHandler = (req, res, next) => {
  pstUpload.single('file')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
};

router.post('/', handlePstUpload, async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No .pst file uploaded' });
    }

    const userId = (req as Request & { user?: { userId: string } }).user?.userId || '00000000-0000-0000-0000-000000000000';
    const buffer = req.file.buffer;
    const filename = req.file.originalname;

    const uploadResult = await query(
      `INSERT INTO data_uploads (user_id, original_filename, file_size_bytes, file_type, column_mapping, status, source_format)
       VALUES ($1, $2, $3, 'pst', '{}', 'processing', 'pst_email_archive')
       RETURNING id`,
      [userId, filename, buffer.length]
    );
    const uploadId = uploadResult.rows[0].id;

    const storagePath = persistPstFile(buffer, uploadId, filename);
    await query(
      `UPDATE data_uploads SET storage_path = $1 WHERE id = $2`,
      [storagePath, uploadId]
    );

    const jobId = uploadId;
    activeJobs.set(jobId, {
      status: 'parsing',
      uploadId,
      totalEmails: 0,
      processedEmails: 0,
      entitiesFound: 0,
      errors: [],
      startedAt: new Date(),
      completedAt: null,
    });

    res.json({
      success: true,
      jobId,
      uploadId,
      message: 'PST file upload accepted. Processing has started.',
    });

    processPstAsync(jobId, uploadId, buffer, userId).catch(err => {
      logger.error(`PST async processing failed for job ${jobId}: ${err.message}`);
    });

  } catch (err: any) {
    logger.error(`PST upload error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/:jobId/status', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;

    const job = activeJobs.get(jobId);
    if (job) {
      return res.json({
        success: true,
        jobId,
        ...job,
      });
    }

    const result = await query(
      `SELECT du.id as upload_id, du.status, du.rows_total, du.rows_succeeded, du.rows_failed,
              du.error_log, du.created_at, du.completed_at,
              (SELECT COUNT(*)::int FROM pst_email_imports WHERE upload_id = du.id) as email_count,
              (SELECT COUNT(*)::int FROM pst_extracted_entities WHERE upload_id = du.id) as entity_count,
              (SELECT COUNT(*)::int FROM pst_email_imports WHERE upload_id = du.id AND has_signal = true) as signal_count
       FROM data_uploads du WHERE du.id = $1`,
      [jobId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const row = result.rows[0];
    const terminalStatus = ['completed', 'partial'].includes(row.status) ? 'completed' : row.status;
    res.json({
      success: true,
      jobId,
      status: terminalStatus,
      uploadId: row.upload_id,
      totalEmails: row.email_count,
      processedEmails: row.email_count,
      entitiesFound: row.entity_count,
      emailsWithSignal: row.signal_count,
      errors: row.error_log || [],
      startedAt: row.created_at,
      completedAt: row.completed_at,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:jobId/emails', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const { signalOnly, limit = '100', offset = '0' } = req.query;

    let whereClause = 'upload_id = $1';
    const params: any[] = [jobId];

    if (signalOnly === 'true') {
      whereClause += ' AND has_signal = true';
    }

    const result = await query(
      `SELECT id, email_index, subject, sender, recipients, email_date, has_signal, has_attachments,
              LEFT(raw_body, 500) as body_preview
       FROM pst_email_imports
       WHERE ${whereClause}
       ORDER BY email_date DESC NULLS LAST
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, parseInt(limit as string), parseInt(offset as string)]
    );

    const countResult = await query(
      `SELECT COUNT(*)::int as total FROM pst_email_imports WHERE ${whereClause}`,
      params
    );

    res.json({
      success: true,
      total: countResult.rows[0].total,
      emails: result.rows,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:jobId/entities', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const { entityType, limit = '100', offset = '0' } = req.query;

    let whereClause = 'e.upload_id = $1';
    const params: any[] = [jobId];

    if (entityType) {
      whereClause += ` AND e.entity_type = $${params.length + 1}`;
      params.push(entityType);
    }

    const result = await query(
      `SELECT e.*, ei.subject as email_subject, ei.sender as email_sender, ei.email_date
       FROM pst_extracted_entities e
       JOIN pst_email_imports ei ON ei.id = e.email_id
       WHERE ${whereClause}
       ORDER BY e.confidence DESC NULLS LAST
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, parseInt(limit as string), parseInt(offset as string)]
    );

    const countResult = await query(
      `SELECT COUNT(*)::int as total FROM pst_extracted_entities e WHERE ${whereClause}`,
      params
    );

    res.json({
      success: true,
      total: countResult.rows[0].total,
      entities: result.rows,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

async function processPstAsync(jobId: string, uploadId: string, buffer: Buffer, userId: string): Promise<void> {
  const job = activeJobs.get(jobId)!;

  try {
    job.status = 'parsing';
    const emails = await pstIngestionService.parseFromBuffer(buffer);
    job.totalEmails = emails.length;

    await query(
      `UPDATE data_uploads SET rows_total = $1 WHERE id = $2`,
      [emails.length, uploadId]
    );

    job.status = 'extracting';
    const extractionResults = await pstAiExtractionService.extractFromEmails(
      emails,
      (processed) => {
        job.processedEmails = processed;
      }
    );

    job.status = 'storing';
    let entitiesTotal = 0;
    let succeeded = 0;
    let failed = 0;
    const errors: Array<{ row: number; error: string }> = [];

    const extractionMap = new Map<number, typeof extractionResults[0]>();
    for (const r of extractionResults) {
      extractionMap.set(r.emailIndex, r);
    }

    for (let i = 0; i < emails.length; i++) {
      try {
        const email = emails[i];
        const extraction = extractionMap.get(i) || extractionResults[i];
        const hasSignal = extraction?.hasSignal || false;

        const emailResult = await query(
          `INSERT INTO pst_email_imports (upload_id, email_index, subject, sender, recipients, email_date, raw_body, has_signal, has_attachments)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING id`,
          [
            uploadId,
            i,
            email.subject || null,
            email.from || null,
            email.to || [],
            email.date || null,
            email.body || null,
            hasSignal,
            email.hasAttachments,
          ]
        );
        const emailId = emailResult.rows[0].id;

        if (extraction?.entities?.length > 0) {
          for (const entity of extraction.entities) {
            try {
              await query(
                `INSERT INTO pst_extracted_entities
                 (email_id, upload_id, entity_type, property_address, deal_name, unit_count,
                  asking_price, rent_figures, cap_rate, contact_name, organization, confidence, raw_snippet)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
                [
                  emailId,
                  uploadId,
                  entity.entityType || 'property',
                  entity.propertyAddress || null,
                  entity.dealName || null,
                  entity.unitCount || null,
                  entity.askingPrice || null,
                  entity.rentFigures || null,
                  entity.capRate || null,
                  entity.contactName || null,
                  entity.organization || null,
                  entity.confidence || null,
                  entity.rawSnippet || null,
                ]
              );
              entitiesTotal++;
            } catch (err: any) {
              logger.warn(`Failed to store entity for email ${i}: ${err.message}`);
            }
          }
        }

        succeeded++;
      } catch (err: any) {
        logger.warn(`Failed to store email ${i}: ${err.message}`);
        errors.push({ row: i, error: err.message });
        failed++;
      }
    }

    const status = failed === 0 ? 'completed' : (succeeded === 0 ? 'failed' : 'partial');
    await query(
      `UPDATE data_uploads SET status = $1, rows_succeeded = $2, rows_failed = $3,
       error_log = $4, completed_at = NOW()
       WHERE id = $5`,
      [status, succeeded, failed, JSON.stringify(errors), uploadId]
    );

    job.status = 'completed';
    job.entitiesFound = entitiesTotal;
    job.processedEmails = emails.length;
    job.completedAt = new Date();
    if (errors.length > 0) {
      job.errors = errors.map(e => e.error);
    }

    logger.info(`PST ingestion complete: ${succeeded} emails stored, ${entitiesTotal} entities extracted, ${failed} failures`);

    setTimeout(() => activeJobs.delete(jobId), 30 * 60 * 1000);

  } catch (err: any) {
    logger.error(`PST processing failed: ${err.message}`);
    job.status = 'failed';
    job.errors.push(err.message);
    job.completedAt = new Date();

    await query(
      `UPDATE data_uploads SET status = 'failed', error_log = $1, completed_at = NOW() WHERE id = $2`,
      [JSON.stringify([{ error: err.message }]), uploadId]
    ).catch(() => {});

    setTimeout(() => activeJobs.delete(jobId), 30 * 60 * 1000);
  }
}

export default router;

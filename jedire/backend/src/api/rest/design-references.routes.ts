import { Router, Request, Response } from 'express';
import multer from 'multer';
import * as fs from 'fs';
import * as path from 'path';
import { getPool } from '../../database/connection';
import { logger } from '../../utils/logger';

const router = Router();

const uploadDir = path.join(process.cwd(), 'uploads', 'design-references');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/svg+xml',
      'image/tiff',
      'application/pdf',
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images and PDFs are allowed.'));
    }
  },
});

router.post('/:dealId/upload', upload.single('file') as any, async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const { category, tags, notes } = req.body;
    const userId = (req as any).user?.userId;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const pool = getPool();
    const result = await pool.query(
      `INSERT INTO design_references (deal_id, user_id, file_name, file_path, file_size, mime_type, category, tags, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        dealId,
        userId,
        req.file.originalname,
        req.file.filename,
        req.file.size,
        req.file.mimetype,
        category || 'general',
        tags ? (Array.isArray(tags) ? tags : JSON.parse(tags)) : [],
        notes || null,
      ]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('[DesignReferences] Upload error:', error);
    res.status(500).json({ error: 'Failed to upload design reference' });
  }
});

router.get('/:dealId', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const { category } = req.query;
    const pool = getPool();

    let query = 'SELECT * FROM design_references WHERE deal_id = $1';
    const params: any[] = [dealId];

    if (category) {
      query += ' AND category = $2';
      params.push(category);
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('[DesignReferences] List error:', error);
    res.status(500).json({ error: 'Failed to list design references' });
  }
});

router.get('/:dealId/:referenceId', async (req: Request, res: Response) => {
  try {
    const { dealId, referenceId } = req.params;
    const pool = getPool();

    const result = await pool.query(
      'SELECT * FROM design_references WHERE id = $1 AND deal_id = $2',
      [referenceId, dealId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Design reference not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('[DesignReferences] Get error:', error);
    res.status(500).json({ error: 'Failed to get design reference' });
  }
});

router.put('/:dealId/:referenceId', async (req: Request, res: Response) => {
  try {
    const { dealId, referenceId } = req.params;
    const { category, tags, notes } = req.body;
    const pool = getPool();

    const result = await pool.query(
      `UPDATE design_references 
       SET category = COALESCE($1, category),
           tags = COALESCE($2, tags),
           notes = COALESCE($3, notes),
           updated_at = NOW()
       WHERE id = $4 AND deal_id = $5
       RETURNING *`,
      [category, tags, notes, referenceId, dealId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Design reference not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('[DesignReferences] Update error:', error);
    res.status(500).json({ error: 'Failed to update design reference' });
  }
});

router.delete('/:dealId/:referenceId', async (req: Request, res: Response) => {
  try {
    const { dealId, referenceId } = req.params;
    const pool = getPool();

    const result = await pool.query(
      'DELETE FROM design_references WHERE id = $1 AND deal_id = $2 RETURNING file_path',
      [referenceId, dealId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Design reference not found' });
    }

    const filePath = path.join(uploadDir, result.rows[0].file_path);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('[DesignReferences] Delete error:', error);
    res.status(500).json({ error: 'Failed to delete design reference' });
  }
});

router.post('/:dealId/:referenceId/analyze', async (req: Request, res: Response) => {
  try {
    const { dealId, referenceId } = req.params;
    const pool = getPool();

    const refResult = await pool.query(
      'SELECT * FROM design_references WHERE id = $1 AND deal_id = $2',
      [referenceId, dealId]
    );

    if (refResult.rows.length === 0) {
      return res.status(404).json({ error: 'Design reference not found' });
    }

    const analysis = {
      analyzed_at: new Date().toISOString(),
      building_type: 'multifamily',
      estimated_stories: null,
      material_palette: [],
      style_notes: 'AI analysis pending - Qwen integration required',
      confidence: 0,
    };

    await pool.query(
      'UPDATE design_references SET ai_analysis = $1, updated_at = NOW() WHERE id = $2',
      [JSON.stringify(analysis), referenceId]
    );

    res.json({ success: true, data: { analysis } });
  } catch (error) {
    logger.error('[DesignReferences] Analyze error:', error);
    res.status(500).json({ error: 'Failed to analyze design reference' });
  }
});

router.get('/file/:filename', async (req: Request, res: Response) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(uploadDir, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.sendFile(filePath);
  } catch (error) {
    logger.error('[DesignReferences] File serve error:', error);
    res.status(500).json({ error: 'Failed to serve file' });
  }
});

export default router;

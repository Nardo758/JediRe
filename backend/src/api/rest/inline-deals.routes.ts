import { Router } from 'express';
import { getPool } from '../../database/connection';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { validate, createDealSchema, updateDealSchema } from './validation';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const pool = getPool();

const DEAL_UPLOAD_DIR = path.join(__dirname, '../../uploads/deals');

if (!fs.existsSync(DEAL_UPLOAD_DIR)) {
  fs.mkdirSync(DEAL_UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, DEAL_UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = crypto.randomBytes(16).toString('hex');
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${uniqueSuffix}${ext}`);
  }
});

const dealDocumentUpload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/png',
      'image/jpg',
      'text/plain',
      'text/csv',
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOC, DOCX, XLS, XLSX, JPG, PNG, TXT, CSV allowed.'));
    }
  }
});

router.get('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const client = req.dbClient || pool;
    const result = await client.query(`
      SELECT 
        d.*,
        ST_AsGeoJSON(d.boundary)::json as boundary_geojson,
        (SELECT count(*) FROM deal_properties dp WHERE dp.deal_id = d.id)::int as "propertyCount",
        (SELECT count(*) FROM deal_tasks dt WHERE dt.deal_id = d.id AND dt.status != 'done')::int as "pendingTasks",
        CASE 
          WHEN d.boundary IS NOT NULL THEN 
            ST_Area(d.boundary::geography) / 4046.86
          ELSE 0
        END as acres
      FROM deals d
      WHERE d.user_id = $1 AND d.archived_at IS NULL
      ORDER BY d.created_at DESC
    `, [req.user!.userId]);

    res.json({
      success: true,
      deals: result.rows.map(row => ({
        id: row.id,
        name: row.name,
        projectType: row.project_type,
        projectIntent: row.project_intent,
        tier: row.tier || 'basic',
        status: row.status,
        state: row.state || 'SIGNAL_INTAKE',
        budget: parseFloat(row.budget) || 0,
        boundary: row.boundary_geojson,
        targetUnits: row.target_units,
        timelineStart: row.timeline_start,
        timelineEnd: row.timeline_end,
        acres: parseFloat(row.acres) || 0,
        propertyCount: row.propertyCount || 0,
        pendingTasks: row.pendingTasks || 0,
        dealCategory: row.deal_category || 'pipeline',
        developmentType: row.development_type,
        address: row.address,
        description: row.description,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }))
    });
  } catch (error) {
    console.error('Error fetching deals:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch deals' });
  }
});

router.get('/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const client = req.dbClient || pool;
    const result = await client.query(`
      SELECT 
        d.*,
        ST_AsGeoJSON(d.boundary)::json as boundary_geojson,
        (SELECT count(*) FROM deal_properties dp WHERE dp.deal_id = d.id)::int as "propertyCount",
        (SELECT count(*) FROM deal_tasks dt WHERE dt.deal_id = d.id AND dt.status != 'done')::int as "pendingTasks",
        (SELECT count(*) FROM deal_tasks dt WHERE dt.deal_id = d.id)::int as "taskCount",
        (SELECT dp2.stage FROM deal_pipeline dp2 WHERE dp2.deal_id = d.id ORDER BY dp2.entered_stage_at DESC LIMIT 1) as "pipelineStage",
        (SELECT EXTRACT(DAY FROM NOW() - dp2.entered_stage_at)::int FROM deal_pipeline dp2 WHERE dp2.deal_id = d.id ORDER BY dp2.entered_stage_at DESC LIMIT 1) as "daysInStage",
        CASE 
          WHEN d.boundary IS NOT NULL THEN 
            ST_Area(d.boundary::geography) / 4046.86
          ELSE 0
        END as acres
      FROM deals d
      WHERE d.id = $1 AND d.user_id = $2 AND d.archived_at IS NULL
    `, [req.params.id, req.user!.userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }

    const row = result.rows[0];
    res.json({
      success: true,
      deal: {
        id: row.id,
        name: row.name,
        projectType: row.project_type || 'multifamily',
        projectIntent: row.project_intent,
        tier: row.tier || 'basic',
        status: row.status,
        state: row.state || 'SIGNAL_INTAKE',
        budget: parseFloat(row.budget) || 0,
        boundary: row.boundary_geojson,
        targetUnits: row.target_units,
        timelineStart: row.timeline_start,
        timelineEnd: row.timeline_end,
        acres: parseFloat(row.acres) || 0,
        propertyCount: row.propertyCount || 0,
        pendingTasks: row.pendingTasks || 0,
        taskCount: row.taskCount || 0,
        pipelineStage: row.pipelineStage || null,
        daysInStage: row.daysInStage || 0,
        dealCategory: row.deal_category || 'pipeline',
        developmentType: row.development_type,
        address: row.address,
        description: row.description,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }
    });
  } catch (error) {
    console.error('Error fetching deal:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch deal' });
  }
});

router.post('/', requireAuth, validate(createDealSchema), async (req: AuthenticatedRequest, res) => {
  try {
    const client = req.dbClient || pool;
    const {
      name, boundary, projectType, projectIntent, targetUnits,
      budget, timelineStart, timelineEnd, tier,
      deal_category, development_type, address, description
    } = req.body;

    const userTier = tier || 'basic';
    const boundaryGeom = boundary.type === 'Point'
      ? `ST_Buffer(ST_GeomFromGeoJSON($3)::geography, 200)::geometry`
      : `ST_GeomFromGeoJSON($3)`;
    const result = await client.query(`
      INSERT INTO deals (
        user_id, name, boundary, project_type, project_intent,
        target_units, budget, timeline_start, timeline_end, tier, status,
        deal_category, development_type, address, description
      )
      VALUES ($1, $2, ${boundaryGeom}, $4, $5, $6, $7, $8, $9, $10, 'active', $11, $12, $13, $14)
      RETURNING *
    `, [
      req.user!.userId,
      name,
      JSON.stringify(boundary),
      projectType || 'multifamily',
      projectIntent || null,
      targetUnits || null,
      budget || null,
      timelineStart || null,
      timelineEnd || null,
      userTier,
      deal_category || 'pipeline',
      development_type || 'new',
      address || null,
      description || null,
    ]);

    const row = result.rows[0];
    res.status(201).json({
      success: true,
      deal: {
        id: row.id,
        name: row.name,
        projectType: row.project_type,
        tier: row.tier || 'basic',
        status: row.status,
        budget: parseFloat(row.budget) || 0,
        acres: 0,
        propertyCount: 0,
        pendingTasks: 0,
        dealCategory: row.deal_category,
        developmentType: row.development_type,
        address: row.address,
        createdAt: row.created_at,
      }
    });
  } catch (error) {
    console.error('Error creating deal:', error);
    res.status(500).json({ success: false, error: 'Failed to create deal' });
  }
});

router.patch('/:id', requireAuth, validate(updateDealSchema), async (req: AuthenticatedRequest, res) => {
  try {
    const client = req.dbClient || pool;
    const dealId = req.params.id;
    const updates = req.body;

    const dealCheck = await client.query(
      'SELECT id FROM deals WHERE id = $1 AND user_id = $2 AND archived_at IS NULL',
      [dealId, req.user!.userId]
    );

    if (dealCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }

    const allowedFields: Record<string, string> = {
      name: 'name', projectType: 'project_type', projectIntent: 'project_intent',
      targetUnits: 'target_units', budget: 'budget', status: 'status',
      timelineStart: 'timeline_start', timelineEnd: 'timeline_end',
      description: 'description', address: 'address',
    };

    const setClauses: string[] = ['updated_at = NOW()'];
    const values: any[] = [];
    let paramIndex = 1;

    for (const [key, dbCol] of Object.entries(allowedFields)) {
      if (updates[key] !== undefined) {
        setClauses.push(`${dbCol} = $${paramIndex}`);
        values.push(updates[key]);
        paramIndex++;
      }
    }

    values.push(dealId);
    const result = await client.query(
      `UPDATE deals SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    res.json({ success: true, deal: result.rows[0] });
  } catch (error) {
    console.error('Error updating deal:', error);
    res.status(500).json({ success: false, error: 'Failed to update deal' });
  }
});

router.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const client = req.dbClient || pool;
    const dealId = req.params.id;
    const result = await client.query(
      'UPDATE deals SET archived_at = NOW(), updated_at = NOW() WHERE id = $1 AND user_id = $2 AND archived_at IS NULL RETURNING id',
      [dealId, req.user!.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }

    res.json({ success: true, message: 'Deal archived' });
  } catch (error) {
    console.error('Error deleting deal:', error);
    res.status(500).json({ success: false, error: 'Failed to delete deal' });
  }
});

router.get('/:id/modules', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const client = req.dbClient || pool;
    const dealId = req.params.id;

    const dealCheck = await client.query(
      'SELECT id, status FROM deals WHERE id = $1 AND user_id = $2',
      [dealId, req.user!.userId]
    );

    if (dealCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }

    const result = await client.query(
      'SELECT * FROM deal_modules WHERE deal_id = $1',
      [dealId]
    );

    const dealStatus = dealCheck.rows[0]?.status;
    const isOwned = dealStatus === 'owned' || dealStatus === 'closed_won';

    const pipelineModules = [
      { module_name: 'map', is_enabled: true, config: {} },
      { module_name: 'overview', is_enabled: true, config: {} },
      { module_name: 'ai-agent', is_enabled: true, config: {} },
      { module_name: 'competition', is_enabled: true, config: {} },
      { module_name: 'supply', is_enabled: true, config: {} },
      { module_name: 'market', is_enabled: true, config: {} },
      { module_name: 'debt', is_enabled: true, config: {} },
      { module_name: 'financial', is_enabled: true, config: {} },
      { module_name: 'strategy', is_enabled: true, config: {} },
      { module_name: 'due-diligence', is_enabled: true, config: {} },
      { module_name: 'team', is_enabled: true, config: {} },
      { module_name: 'documents', is_enabled: true, config: {} },
      { module_name: 'timeline', is_enabled: true, config: {} },
      { module_name: 'notes', is_enabled: true, config: {} },
      { module_name: 'files', is_enabled: true, config: {} },
      { module_name: 'exit', is_enabled: true, config: {} },
      { module_name: 'context', is_enabled: true, config: {} },
    ];

    const assetModules = [
      { module_name: 'map', is_enabled: true, config: {} },
      { module_name: 'overview', is_enabled: true, config: {} },
      { module_name: 'ai-agent', is_enabled: true, config: {} },
      { module_name: 'financial', is_enabled: true, config: {} },
      { module_name: 'market', is_enabled: true, config: {} },
      { module_name: 'strategy', is_enabled: true, config: {} },
      { module_name: 'exit', is_enabled: true, config: {} },
      { module_name: 'team', is_enabled: true, config: {} },
      { module_name: 'documents', is_enabled: true, config: {} },
      { module_name: 'timeline', is_enabled: true, config: {} },
      { module_name: 'notes', is_enabled: true, config: {} },
      { module_name: 'files', is_enabled: true, config: {} },
      { module_name: 'context', is_enabled: true, config: {} },
    ];

    const modules = result.rows.length > 0 ? result.rows : (isOwned ? assetModules : pipelineModules);

    res.json({ success: true, data: modules });
  } catch (error) {
    console.error('Error fetching deal modules:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch modules' });
  }
});

router.get('/:id/properties', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const client = req.dbClient || pool;
    const dealId = req.params.id;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await client.query(
      `SELECT p.*, dp.created_at as added_at
       FROM deal_properties dp
       JOIN properties p ON dp.property_id = p.id
       WHERE dp.deal_id = $1
       ORDER BY dp.created_at DESC
       LIMIT $2 OFFSET $3`,
      [dealId, limit, offset]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching deal properties:', error);
    res.json({ success: true, data: [] });
  }
});

router.get('/:id/activity', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const client = req.dbClient || pool;
    const dealId = req.params.id;
    const limit = parseInt(req.query.limit as string) || 50;

    try {
      const result = await client.query(
        `SELECT id, deal_id, user_id, action_type, entity_type, entity_id, description, metadata, created_at
         FROM deal_activity
         WHERE deal_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [dealId, limit]
      );

      const activities = result.rows.map((row: any) => ({
        id: row.id,
        dealId: row.deal_id,
        userId: row.user_id,
        activityType: row.action_type || 'note_added',
        description: row.description || '',
        metadata: row.metadata || {},
        createdAt: row.created_at,
      }));

      res.json({ success: true, data: activities, count: activities.length });
    } catch (dbError: any) {
      if (dbError.code === '42P01' || dbError.code === '22P02') {
        res.json({ success: true, data: [], count: 0 });
      } else {
        throw dbError;
      }
    }
  } catch (error) {
    console.error('Error fetching deal activity:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch activity' });
  }
});

router.get('/:id/timeline', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const client = req.dbClient || pool;
    const dealId = req.params.id;

    try {
      const result = await client.query(
        `SELECT id, deal_id, action_type, description, metadata, created_at
         FROM deal_activity
         WHERE deal_id = $1
         ORDER BY created_at ASC`,
        [dealId]
      );

      const now = new Date();
      const eventsByDate: Record<string, any[]> = {};

      for (const row of result.rows) {
        const dateKey = new Date(row.created_at).toISOString().split('T')[0];
        if (!eventsByDate[dateKey]) {
          eventsByDate[dateKey] = [];
        }
        eventsByDate[dateKey].push({
          id: row.id,
          description: row.description || row.action_type,
          activityType: row.action_type || 'note_added',
          createdAt: row.created_at,
        });
      }

      const timeline = Object.entries(eventsByDate).map(([date, activities]) => ({
        date,
        title: `${activities.length} activit${activities.length === 1 ? 'y' : 'ies'}`,
        type: new Date(date) < now ? 'past' : new Date(date).toDateString() === now.toDateString() ? 'current' : 'future',
        completed: new Date(date) < now,
        activities,
      }));

      res.json({ success: true, data: timeline });
    } catch (dbError: any) {
      if (dbError.code === '42P01' || dbError.code === '22P02') {
        res.json({ success: true, data: [] });
      } else {
        throw dbError;
      }
    }
  } catch (error) {
    console.error('Error fetching deal timeline:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch timeline' });
  }
});

router.get('/:id/key-moments', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const client = req.dbClient || pool;
    const dealId = req.params.id;

    try {
      const result = await client.query(
        `SELECT id, deal_id, action_type, description, metadata, created_at
         FROM deal_activity
         WHERE deal_id = $1
           AND action_type IN ('milestone_hit', 'status_change', 'risk_flagged', 'financial_update')
         ORDER BY created_at DESC`,
        [dealId]
      );

      const momentTypeMap: Record<string, string> = {
        milestone_hit: 'milestone',
        status_change: 'decision',
        risk_flagged: 'risk',
        financial_update: 'achievement',
      };
      const importanceMap: Record<string, string> = {
        milestone_hit: 'high',
        status_change: 'medium',
        risk_flagged: 'critical',
        financial_update: 'medium',
      };

      const moments = result.rows.map((row: any) => ({
        id: row.id,
        dealId: row.deal_id,
        title: row.description || row.action_type,
        description: row.description || '',
        momentType: momentTypeMap[row.action_type] || 'milestone',
        date: row.created_at,
        importance: importanceMap[row.action_type] || 'medium',
        metadata: row.metadata || {},
      }));

      res.json({ success: true, data: moments });
    } catch (dbError: any) {
      if (dbError.code === '42P01' || dbError.code === '22P02') {
        res.json({ success: true, data: [] });
      } else {
        throw dbError;
      }
    }
  } catch (error) {
    console.error('Error fetching deal key moments:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch key moments' });
  }
});

router.get('/:id/lease-analysis', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const dealId = req.params.id;
    const client = req.dbClient || pool;

    const dealCheck = await client.query(
      'SELECT id FROM deals WHERE id = $1 AND user_id = $2',
      [dealId, req.user!.userId]
    );
    if (dealCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }

    const result = await client.query(`
      SELECT 
        p.*,
        p.lease_expiration_date,
        p.current_lease_amount,
        p.lease_start_date,
        p.renewal_status
      FROM properties p
      JOIN deals d ON d.id = $1
      WHERE ST_Contains(d.boundary, ST_Point(p.lng, p.lat))
    `, [dealId]);

    const properties = result.rows;
    const now = new Date();
    const next30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const next90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    const expiringNext30 = properties.filter((p: any) =>
      p.lease_expiration_date &&
      new Date(p.lease_expiration_date) <= next30Days &&
      new Date(p.lease_expiration_date) >= now
    ).length;

    const expiringNext90 = properties.filter((p: any) =>
      p.lease_expiration_date &&
      new Date(p.lease_expiration_date) <= next90Days &&
      new Date(p.lease_expiration_date) >= now
    ).length;

    const totalUnits = properties.length;
    const rolloverRiskScore = totalUnits > 0 ? Math.round((expiringNext90 / totalUnits) * 100) : 0;

    const belowMarketUnits = properties.filter((p: any) =>
      p.current_lease_amount && p.rent && p.current_lease_amount < p.rent
    );

    const totalRentGap = belowMarketUnits.reduce((sum: number, p: any) =>
      sum + (p.rent - p.current_lease_amount), 0
    );

    const annualOpportunity = totalRentGap * 12;

    const timeline: Record<string, number> = {};
    for (let i = 0; i < 12; i++) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + i + 1, 0);
      const monthKey = monthStart.toISOString().slice(0, 7);

      timeline[monthKey] = properties.filter((p: any) => {
        if (!p.lease_expiration_date) return false;
        const expDate = new Date(p.lease_expiration_date);
        return expDate >= monthStart && expDate <= monthEnd;
      }).length;
    }

    res.json({
      success: true,
      data: {
        totalUnits,
        expiringNext30,
        expiringNext90,
        rolloverRiskScore,
        rolloverRiskLevel: rolloverRiskScore > 40 ? 'high' : rolloverRiskScore > 20 ? 'medium' : 'low',
        rentGapOpportunity: {
          unitsBelow: belowMarketUnits.length,
          monthlyGap: Math.round(totalRentGap),
          annualUpside: Math.round(annualOpportunity)
        },
        expirationTimeline: timeline
      }
    });
  } catch (error) {
    console.error('Lease analysis error:', error);
    res.status(500).json({ success: false, error: 'Lease analysis failed' });
  }
});

router.post('/upload-document', requireAuth, dealDocumentUpload.single('file') as any, async (req: AuthenticatedRequest, res) => {
  try {
    const file = req.file;
    const { dealId, documentType, description } = req.body;

    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'No file provided'
      });
    }

    if (!dealId) {
      fs.unlinkSync(file.path);
      return res.status(400).json({
        success: false,
        error: 'dealId is required'
      });
    }

    const client = req.dbClient || pool;

    const dealCheck = await client.query(
      `SELECT id FROM deals WHERE id = $1 AND user_id = $2`,
      [dealId, req.user!.userId]
    );
    if (dealCheck.rows.length === 0) {
      fs.unlinkSync(file.path);
      return res.status(403).json({
        success: false,
        error: 'Deal not found or access denied'
      });
    }

    const docId = uuidv4();
    const storedPath = file.path;

    try {
      await client.query(`
        INSERT INTO deal_documents (
          id, deal_id, file_name, file_type, file_url,
          file_size, uploaded_by, uploaded_at, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)
      `, [
        docId,
        dealId,
        file.originalname,
        file.mimetype,
        storedPath,
        file.size,
        req.user!.userId,
        JSON.stringify({ documentType: documentType || 'general', description: description || '', storedFilename: file.filename })
      ]);
    } catch (dbError: any) {
      console.error('DB insert failed for document:', dbError.message);
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      return res.status(500).json({
        success: false,
        error: 'Failed to save document record'
      });
    }

    res.json({
      success: true,
      document: {
        id: docId,
        filename: file.filename,
        originalName: file.originalname,
        size: file.size,
        mimeType: file.mimetype,
        dealId: dealId || null,
        documentType: documentType || 'general',
        description: description || '',
        uploadedAt: new Date().toISOString(),
      },
      message: 'Document uploaded successfully'
    });

  } catch (error) {
    console.error('Error uploading document:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upload document'
    });
  }
});

router.get('/:dealId/documents', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { dealId } = req.params;
    const client = req.dbClient || pool;

    const result = await client.query(`
      SELECT 
        id, file_name as "fileName", file_type as "fileType",
        file_url as "fileUrl", file_size as "fileSize",
        uploaded_at as "uploadedAt", metadata
      FROM deal_documents
      WHERE deal_id = $1 AND uploaded_by = $2
      ORDER BY uploaded_at DESC
    `, [dealId, req.user!.userId]);

    res.json({
      success: true,
      documents: result.rows
    });
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({
      success: false,
      documents: [],
      error: 'Failed to fetch documents'
    });
  }
});

router.delete('/documents/:documentId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { documentId } = req.params;
    const client = req.dbClient || pool;

    const result = await client.query(`
      SELECT file_url FROM deal_documents
      WHERE id = $1 AND uploaded_by = $2
    `, [documentId, req.user!.userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }

    const filePath = result.rows[0].file_url;

    await client.query(`
      DELETE FROM deal_documents
      WHERE id = $1 AND uploaded_by = $2
    `, [documentId, req.user!.userId]);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.json({
      success: true,
      message: 'Document deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete document'
    });
  }
});

export default router;

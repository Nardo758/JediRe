import { Router } from 'express';
import multer from 'multer';
import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs';
import { getPool } from '../../database/connection';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { validate, createDealSchema, updateDealSchema } from './validation';
import { autoDiscoverComps } from '../../services/comp-set-discovery.service';
import { processDocument, processDealDocuments } from '../../services/document-extraction/extraction-pipeline';
import { computeAndPersistTrafficSnapshot } from '../../services/traffic-analytics.service';
import { cashflowRuntime } from '../../agents/cashflow.config';
import { researchRuntime } from '../../agents/research.config';
import { supplyRuntime } from '../../agents/supply.config';
import { commentaryRuntime } from '../../agents/commentary.config';
import { logger } from '../../utils/logger';

const router = Router();
const pool = getPool();

const uploadsDir = path.join(process.cwd(), 'uploads', 'deal-documents');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const documentUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
});

router.get('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;
    const userRole = (req.user as any)?.role || 'user';
    const isAdmin = userRole === 'admin';

    // Use pool directly instead of req.dbClient
    const client = pool;
    const result = await client.query(`
      SELECT 
        d.*,
        ST_AsGeoJSON(d.boundary)::json as boundary_geojson,
        (SELECT count(*) FROM deal_properties dp WHERE dp.deal_id = d.id)::int as "propertyCount",
        (SELECT count(*) FROM deal_tasks dt WHERE dt.deal_id = d.id AND dt.status != 'done')::int as "pendingTasks",
        COALESCE(d.acres, CASE 
          WHEN d.boundary IS NOT NULL THEN 
            ST_Area(d.boundary::geography) / 4046.86
          ELSE 0
        END) as acres
      FROM deals d
      WHERE ${isAdmin ? 'TRUE' : 'd.user_id = $1'} AND d.archived_at IS NULL
      ORDER BY d.created_at DESC
    `, isAdmin ? [] : [userId]);

    res.json({
      success: true,
      deals: result.rows.map(row => ({
        id: row.id,
        name: row.name,
        project_type: row.project_type || 'existing',
        projectType: row.project_type || 'existing',
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
    const userId = req.user!.userId;
    const userRole = (req.user as any)?.role || 'user';
    const isAdmin = userRole === 'admin';

    // Use pool directly instead of req.dbClient
    const client = pool;
    const result = await client.query(`
      SELECT 
        d.*,
        ST_AsGeoJSON(d.boundary)::json as boundary_geojson,
        (SELECT count(*) FROM deal_properties dp WHERE dp.deal_id = d.id)::int as "propertyCount",
        (SELECT count(*) FROM deal_tasks dt WHERE dt.deal_id = d.id AND dt.status != 'done')::int as "pendingTasks",
        (SELECT count(*) FROM deal_tasks dt WHERE dt.deal_id = d.id)::int as "taskCount",
        (SELECT dp2.stage FROM deal_pipeline dp2 WHERE dp2.deal_id = d.id ORDER BY dp2.entered_stage_at DESC LIMIT 1) as "pipelineStage",
        (SELECT EXTRACT(DAY FROM NOW() - dp2.entered_stage_at)::int FROM deal_pipeline dp2 WHERE dp2.deal_id = d.id ORDER BY dp2.entered_stage_at DESC LIMIT 1) as "daysInStage",
        COALESCE(d.acres, CASE 
          WHEN d.boundary IS NOT NULL THEN 
            ST_Area(d.boundary::geography) / 4046.86
          ELSE 0
        END) as acres,
        p_linked.parcel_id as "linkedParcelId",
        p_linked.zoning_code as "linkedZoningCode",
        p_linked.lot_size_acres as "linkedLotSizeAcres",
        p_linked.land_cost as "linkedLandCost"
      FROM deals d
      LEFT JOIN deal_properties dp_link ON dp_link.deal_id = d.id
      LEFT JOIN properties p_linked ON p_linked.id = dp_link.property_id
      WHERE d.id = $1 AND ${isAdmin ? 'TRUE' : 'd.user_id = $2'} AND d.archived_at IS NULL
    `, isAdmin ? [req.params.id] : [req.params.id, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }

    const row = result.rows[0];
    res.json({
      success: true,
      deal: {
        id: row.id,
        name: row.name,
        project_type: row.project_type || 'existing',
        projectType: row.project_type || 'existing',
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
        deal_category: row.deal_category || 'pipeline',
        stage: row.stage || 'prospect',
        pipeline_stage: row.pipelineStage || row.stage || null,
        triage_score: row.triage_score ?? null,
        jedi_score: row.jedi_score ?? row.triage_score ?? null,
        timeline_end: row.timeline_end,
        developmentType: row.development_type,
        address: row.address,
        description: row.description,
        property_data: row.property_data || null,
        zoningProfile: row.zoning_profile || null,
        purchasePrice: parseFloat(row.purchase_price) || null,
        deal_data: row.deal_data || {},
        parcelId: row.linkedParcelId || null,
        zoningCode: row.linkedZoningCode || null,
        lotSizeAcres: parseFloat(row.linkedLotSizeAcres) || null,
        landCost: parseFloat(row.linkedLandCost) || null,
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
    // Use pool directly instead of req.dbClient
    const client = pool;
    const {
      name, boundary, projectType, project_type, projectIntent, targetUnits,
      budget, timelineStart, timelineEnd, tier,
      deal_category, development_type, address, description,
      property_type_key, documentFileIds, uploaded_documents
    } = req.body;

    let resolvedProjectType = projectType || project_type;
    if (!resolvedProjectType && property_type_key) {
      const ptResult = await client.query(
        'SELECT category FROM property_types WHERE type_key = $1 LIMIT 1',
        [property_type_key]
      );
      if (ptResult.rows.length > 0) {
        const categoryMap: Record<string, string> = {
          'Residential': 'residential', 'Multifamily': 'multifamily',
          'Commercial': 'office', 'Retail': 'retail', 'Industrial': 'industrial',
          'Hospitality': 'hospitality', 'Mixed-Use': 'mixed_use',
          'Land': 'land', 'Special Purpose': 'special_purpose',
        };
        resolvedProjectType = categoryMap[ptResult.rows[0].category] || 'existing';
      }
    }

    const userTier = tier || 'basic';

    const orgResult = await client.query(
      'SELECT org_id FROM org_members WHERE user_id = $1 ORDER BY joined_at ASC LIMIT 1',
      [req.user!.userId]
    );
    const userOrgId = orgResult.rows.length > 0 ? orgResult.rows[0].org_id : null;

    const boundaryGeom = boundary.type === 'Point'
      ? `ST_Buffer(ST_GeomFromGeoJSON($3)::geography, 200)::geometry`
      : `ST_GeomFromGeoJSON($3)`;
    const result = await client.query(`
      INSERT INTO deals (
        user_id, name, boundary, project_type, project_intent,
        target_units, budget, timeline_start, timeline_end, tier, status,
        deal_category, development_type, address, description, org_id
      )
      VALUES ($1, $2, ${boundaryGeom}, $4, $5, $6, $7, $8, $9, $10, 'active', $11, $12, $13, $14, $15)
      RETURNING *
    `, [
      req.user!.userId,
      name,
      JSON.stringify(boundary),
      resolvedProjectType || 'existing',
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
      userOrgId,
    ]);

    const row = result.rows[0];

    autoDiscoverComps(row.id).catch(err => {
      console.error(`[CompDiscovery] Failed for deal ${row.id}:`, err.message);
    });

    const docIds = Array.isArray(documentFileIds) ? documentFileIds
      : Array.isArray(uploaded_documents) ? uploaded_documents
      : [];
    setImmediate(async () => {
      try {
        if (docIds.length > 0) {
          await pool.query(
            `UPDATE deal_document_files SET deal_id = $1, updated_at = NOW()
             WHERE id = ANY($2::uuid[]) AND uploaded_by = $3 AND deal_id IS NULL`,
            [row.id, docIds, req.user!.userId]
          );
        }
        await processDealDocuments(row.id, req.user!.userId);

        const seedExists = await pool.query(
          `SELECT 1 FROM deal_assumptions WHERE deal_id = $1 AND year1 IS NOT NULL`,
          [row.id]
        );
        if (seedExists.rows.length > 0) {
          console.log(`[Seeder] Year1 seed available for deal ${row.id}`);
        }
      } catch (err) {
        console.error(`[ExtractionPipeline] Deal creation trigger failed for ${row.id}:`, err instanceof Error ? err.message : err);
      }
    });

    // M27 AUTO-TRIGGER: Generate comp set when deal is created with location
    // Fire async (don't block response)
    if (boundary && (boundary.type === 'Point' || boundary.type === 'Polygon')) {
      setImmediate(async () => {
        try {
          const { m26m27Integration } = await import('../../services/module-wiring/m26-m27-integration');
          await m26m27Integration.triggerCompSetOnLocationSet(row.id);
        } catch (e) {
          console.error('M27 auto-trigger error:', e);
        }
      });
    }

    // Emit deal.created event for durable agent processing (Inngest)
    setImmediate(async () => {
      try {
        const { inngest } = await import('../../lib/inngest');
        await inngest.send({
          name: 'deal.created',
          data: {
            dealId: row.id,
            userId: req.user!.userId,
            userTier: row.tier || 'basic',
            address: row.address || undefined,
            triggeredBy: 'user',
          },
        });
      } catch (inngestErr) {
        // Non-fatal — platform still functional without agent run
        console.error('[Inngest] Failed to emit deal.created:', inngestErr instanceof Error ? inngestErr.message : inngestErr);
      }

      // Ingest deal into Knowledge Graph
      try {
        const { getGraphIngestionListener } = await import('../../services/neural-network/graph-ingestion-listener');
        const { getPool } = await import('../../database/connection');
        const graphListener = getGraphIngestionListener(getPool());
        await graphListener.handleEvent({
          type: 'deal.created',
          entityId: row.id,
          entityType: 'Deal',
          data: {
            name: row.name,
            stage: 'underwriting',
            status: row.status,
            askingPrice: parseFloat(row.budget) || undefined,
            units: row.target_units,
            propertyType: row.deal_category || 'multifamily',
            createdAt: new Date(),
          },
          timestamp: new Date(),
          userId: req.user!.userId,
        });
        console.log('[Graph] Deal node created:', row.id);
      } catch (graphErr) {
        console.error('[Graph] Failed to ingest deal:', graphErr instanceof Error ? graphErr.message : graphErr);
      }

      // Trigger autonomous agent system
      try {
        const { onDealCreated } = await import('../../services/agents/platform-hooks');
        await onDealCreated({
          dealId: row.id,
          userId: req.user!.userId,
          name: row.name,
          propertyType: row.deal_category || 'multifamily',
          city: '', // Will be populated from property
          state: '',
          units: row.target_units,
          askingPrice: parseFloat(row.budget) || undefined,
        });
      } catch (agentErr) {
        console.error('[Agents] Failed to trigger onDealCreated:', agentErr instanceof Error ? agentErr.message : agentErr);
      }

      // Seed capsule with intelligence from Data Library + Knowledge Graph
      try {
        const { getCapsuleIntelligence } = await import('../../services/capsule-intelligence.service');
        const capsuleIntel = getCapsuleIntelligence();
        await capsuleIntel.seedCapsule({
          capsuleId: row.id,
          propertyAddress: row.address || '',
          city: row.city || '',
          state: row.state || '',
          propertyType: row.deal_category || 'multifamily',
          units: row.target_units,
          userId: req.user?.userId,
        });
        console.log('[CapsuleIntelligence] Seeded capsule:', row.id);
      } catch (intelErr) {
        console.error('[CapsuleIntelligence] Failed to seed capsule:', intelErr instanceof Error ? intelErr.message : intelErr);
      }
    });

    res.status(201).json({
      success: true,
      deal: {
        id: row.id,
        name: row.name,
        project_type: row.project_type || 'existing',
        projectType: row.project_type || 'existing',
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
    // Use pool directly instead of req.dbClient
    const client = pool;
    const dealId = req.params.id;
    const updates = req.body;

    const dealCheck = await client.query(
      'SELECT id, budget, target_units, status FROM deals WHERE id = $1 AND user_id = $2 AND archived_at IS NULL',
      [dealId, req.user!.userId]
    );

    if (dealCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }

    const previousDeal = dealCheck.rows[0];
    const priceChanged = updates.budget !== undefined && updates.budget !== previousDeal.budget;
    const statusChanged = updates.status !== undefined && updates.status !== previousDeal.status;

    const allowedFields: Record<string, string> = {
      name: 'name', projectType: 'project_type', project_type: 'project_type',
      projectIntent: 'project_intent',
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

    // Trigger agent system on status change
    if (statusChanged) {
      setImmediate(async () => {
        try {
          const { onDealStatusChanged } = await import('../../services/agents/platform-hooks');
          await onDealStatusChanged({
            dealId,
            userId: req.user!.userId,
            previousStatus: previousDeal.status,
            newStatus: updates.status,
          });
        } catch (agentErr) {
          console.error('[Agents] Failed to trigger onDealStatusChanged:', agentErr instanceof Error ? agentErr.message : agentErr);
        }
      });
    }

    // M26 AUTO-TRIGGER: Recalculate tax projection when purchase price changes
    if (priceChanged) {
      const newPrice = updates.budget;
      const units = updates.targetUnits || previousDeal.target_units;
      
      if (newPrice && units) {
        // Fire async (don't block response)
        setImmediate(async () => {
          try {
            const { m26m27Integration } = await import('../../services/module-wiring/m26-m27-integration');
            await m26m27Integration.triggerTaxProjectionOnPriceChange(
              dealId,
              newPrice,
              units
            );
          } catch (e) {
            console.error('M26 auto-trigger error:', e);
          }
        });
      }
    }

    res.json({ success: true, deal: result.rows[0] });
  } catch (error) {
    console.error('Error updating deal:', error);
    res.status(500).json({ success: false, error: 'Failed to update deal' });
  }
});

router.patch('/:id/property', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const dealId = req.params.id;

    const dealCheck = await pool.query(
      'SELECT id FROM deals WHERE id = $1 AND user_id = $2 AND archived_at IS NULL',
      [dealId, req.user!.userId]
    );
    if (dealCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }

    const propResult = await pool.query(
      'SELECT property_id FROM deal_properties WHERE deal_id = $1 LIMIT 1',
      [dealId]
    );

    const allowedFields = ['parcel_id', 'lot_size_acres', 'land_cost', 'zoning_code', 'year_built', 'property_type', 'total_sf', 'units', 'stories'];
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${paramIndex}`);
        values.push(req.body[field]);
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid fields to update' });
    }

    if (propResult.rows.length > 0) {
      const propertyId = propResult.rows[0].property_id;
      updates.push('updated_at = NOW()');
      values.push(propertyId);
      await pool.query(
        `UPDATE properties SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
        values
      );
    } else {
      const insertFields = [];
      const insertValues = [];
      const insertPlaceholders = [];
      let idx = 1;

      const { v4: uuidv4 } = await import('uuid');
      const newPropertyId = uuidv4();
      insertFields.push('id');
      insertValues.push(newPropertyId);
      insertPlaceholders.push(`$${idx++}`);

      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          insertFields.push(field);
          insertValues.push(req.body[field]);
          insertPlaceholders.push(`$${idx++}`);
        }
      }

      await pool.query(
        `INSERT INTO properties (${insertFields.join(', ')}) VALUES (${insertPlaceholders.join(', ')})`,
        insertValues
      );
      await pool.query(
        'INSERT INTO deal_properties (deal_id, property_id) VALUES ($1, $2)',
        [dealId, newPropertyId]
      );
    }

    const dealUpdates: string[] = ['updated_at = NOW()'];
    const dealValues: any[] = [];
    let dealParamIndex = 1;

    if (req.body.lot_size_acres !== undefined) {
      dealUpdates.push(`acres = $${dealParamIndex}`);
      dealValues.push(req.body.lot_size_acres);
      dealParamIndex++;
    }
    if (req.body.land_cost !== undefined) {
      dealUpdates.push(`budget = $${dealParamIndex}`);
      dealValues.push(req.body.land_cost);
      dealParamIndex++;
    }

    if (dealValues.length > 0) {
      dealValues.push(dealId);
      await pool.query(
        `UPDATE deals SET ${dealUpdates.join(', ')} WHERE id = $${dealParamIndex}`,
        dealValues
      );
    }

    res.json({ success: true, message: 'Property updated' });
  } catch (error) {
    console.error('Error updating property:', error);
    res.status(500).json({ success: false, error: 'Failed to update property' });
  }
});

router.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    // Use pool directly instead of req.dbClient
    const client = pool;
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
    // Use pool directly instead of req.dbClient
    const client = pool;
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
      { module_name: 'comps', is_enabled: true, config: {} },         // M27: Sale Comps
      { module_name: 'tax', is_enabled: true, config: {} },           // M26: Tax Intelligence
      { module_name: 'financial', is_enabled: true, config: {} },
      { module_name: 'debt', is_enabled: true, config: {} },
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
      { module_name: 'market', is_enabled: true, config: {} },
      { module_name: 'comps', is_enabled: true, config: {} },         // M27: Sale Comps
      { module_name: 'tax', is_enabled: true, config: {} },           // M26: Tax Intelligence
      { module_name: 'financial', is_enabled: true, config: {} },
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
    // Use pool directly instead of req.dbClient
    const client = pool;
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
    // Use pool directly instead of req.dbClient
    const client = pool;
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
    // Use pool directly instead of req.dbClient
    const client = pool;
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
    // Use pool directly instead of req.dbClient
    const client = pool;
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
    // Use pool directly instead of req.dbClient
    const client = pool;

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
      WHERE d.boundary IS NOT NULL
        AND ST_Contains(d.boundary, ST_SetSRID(ST_Point(p.lng, p.lat), 4326))
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

/**
 * GET /deals/:dealId/trade-area
 * Get trade area for a specific deal
 */
router.get('/:dealId/trade-area', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { dealId } = req.params;
    const client = pool;
    
    const result = await client.query(
      `SELECT ta.id, ta.name, ta.metadata,
              ST_AsGeoJSON(ta.boundary)::json as geometry,
              ta.created_at, ta.updated_at
       FROM trade_areas ta
       INNER JOIN deals d ON d.trade_area_id = ta.id
       WHERE d.id = $1`,
      [dealId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No trade area assigned to this deal'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error: any) {
    console.error('Error fetching deal trade area:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch trade area'
    });
  }
});

/**
 * GET /deals/:dealId/zoning-analysis
 * Get zoning analysis for a deal (alias to zoning-capacity)
 */
router.get('/:dealId/zoning-analysis', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { dealId } = req.params;
    const client = pool;
    
    // Fetch zoning capacity data
    const result = await client.query(
      `SELECT zoning_code, max_density, max_far, max_height_feet, max_stories 
       FROM zoning_capacity 
       WHERE deal_id = $1 
       LIMIT 1`,
      [dealId]
    );
    
    if (result.rows.length === 0) {
      return res.json({
        success: true,
        data: {
          dealId,
          message: 'No zoning data available yet. Run zoning capacity analysis first.',
          hasData: false
        }
      });
    }
    
    const zoningData = result.rows[0];
    
    res.json({
      success: true,
      data: {
        dealId,
        hasData: true,
        zoning: zoningData
      }
    });
  } catch (error: any) {
    console.error('Error fetching zoning analysis:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch zoning analysis'
    });
  }
});

/**
 * GET /deals/:dealId/analysis/latest
 * Get latest strategy analysis for a deal
 */
router.get('/:dealId/analysis/latest', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { dealId } = req.params;
    const client = pool;
    
    // Fetch latest strategy analysis from strategy_analyses table
    const result = await client.query(
      `SELECT * FROM strategy_analyses 
       WHERE deal_id = $1 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [dealId]
    );
    
    if (result.rows.length === 0) {
      return res.json({
        success: true,
        data: null,
        message: 'No analysis available yet. Trigger analysis first.'
      });
    }
    
    const analysis = result.rows[0];
    
    res.json({
      success: true,
      data: {
        strategies: analysis.strategies || [],
        recommendedStrategyId: analysis.recommended_strategy_id,
        analysisCompletedAt: analysis.created_at
      }
    });
  } catch (error: any) {
    console.error('Error fetching latest analysis:', error);
    
    // Return empty result instead of error (graceful degradation)
    res.json({
      success: true,
      data: null,
      message: 'Analysis data not available'
    });
  }
});

/**
 * POST /deals/:dealId/analysis/trigger
 * Trigger strategy analysis for a deal
 */
router.post('/:dealId/analysis/trigger', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { dealId } = req.params;
    const client = pool;
    
    // Verify deal exists
    const dealResult = await client.query(
      `SELECT id, name, project_type FROM deals WHERE id = $1`,
      [dealId]
    );
    
    if (dealResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Deal not found'
      });
    }
    
    // Fire the full underwriting pipeline asynchronously
    // Research → Supply → CashFlow → Commentary
    setImmediate(async () => {
      try {
        const ctxBase = { dealId, userId: req.user!.userId, triggeredBy: 'user' as const };
        console.log(`[Pipeline] Starting underwrite for ${dealId} (user=${ctxBase.userId})`);

        // Step 1: Research agent — market context
        const researchResult = await researchRuntime.run(dealId, ctxBase);
        console.log(`[Pipeline] Research complete for ${dealId} — score=${researchResult?.confidence_score}`);

        // Step 2: Supply agent — supply pipeline
        const supplyResult = await supplyRuntime.run(dealId, ctxBase);
        console.log(`[Pipeline] Supply complete for ${dealId}`);

        // Step 3: CashFlow agent — pro forma + underwriting
        const cashflowResult = await cashflowRuntime.run(dealId, ctxBase);
        console.log(`[Pipeline] CashFlow complete for ${dealId}`);

        // Step 4: Commentary agent — narrative summary
        const commentaryResult = await commentaryRuntime.run(dealId, ctxBase);
        console.log(`[Pipeline] Commentary complete for ${dealId}`);

        console.log(`[Pipeline] Underwrite complete for ${dealId}`);
      } catch (err: any) {
        console.error(`[Pipeline] FAILED for ${dealId}:`, err.message);
        console.error(err.stack?.slice(0, 1000));
      }
    });

    res.json({
      success: true,
      message: 'Underwriting pipeline triggered. Agents: Research → Supply → CashFlow → Commentary.',
      dealId
    });
  } catch (error: any) {
    console.error('Error triggering analysis:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to trigger analysis'
    });
  }
});

router.post('/upload-document', requireAuth, documentUpload.single('file') as any, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const dealId = req.body?.dealId || req.query?.dealId;
    let verifiedDealId: string | null = null;

    if (dealId) {
      const ownerResult = await pool.query(
        'SELECT id FROM deals WHERE id = $1 AND user_id = $2',
        [dealId, req.user!.userId]
      );
      if (ownerResult.rows.length > 0) {
        verifiedDealId = dealId as string;
      } else {
        return res.status(403).json({ success: false, error: 'Not authorized for this deal' });
      }
    }

    const insertResult = await pool.query(
      `INSERT INTO deal_document_files (deal_id, filename, original_filename, file_path, uploaded_by, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING id`,
      [verifiedDealId, path.basename(req.file.path), req.file.originalname, req.file.path, req.user!.userId]
    );

    const docId = insertResult.rows[0].id;

    const fileMeta = {
      id: docId,
      name: req.file.originalname,
      type: req.file.mimetype,
      size: req.file.size,
      path: req.file.path,
      uploadedAt: new Date().toISOString(),
      uploadedBy: req.user!.userId,
    };

    if (!verifiedDealId) {
      console.warn(`[Upload] File "${req.file.originalname}" (id=${docId}) stored without a dealId — extraction deferred until linked to a deal`);
    }

    if (verifiedDealId) {
      processDocument(req.file.path, req.file.originalname, verifiedDealId, req.user!.userId, docId, req.file.mimetype)
        .then(async (result) => {
          const seedTag = result.proformaSeeded ? ' +seed' : '';
          const xvalTag = result.crossValidationVariances ? ` +xval(${result.crossValidationVariances})` : '';
          console.log(`[ExtractionPipeline] ${req.file!.originalname} → ${result.documentType} (${result.success ? 'OK' : 'FAIL'}${result.rowsInserted ? `, ${result.rowsInserted} rows` : ''}${seedTag}${xvalTag})`);
          if (result.alerts.length > 0) {
            console.log(`[ExtractionPipeline] Alerts: ${result.alerts.join('; ')}`);
          }
          try {
            await pool.query(
              `UPDATE deal_document_files SET
                 document_type = $1, extraction_status = $2,
                 extraction_result = $3, updated_at = NOW()
               WHERE id = $4`,
              [result.documentType, result.success ? 'completed' : 'failed',
               JSON.stringify({
                 success: result.success,
                 error: result.error,
                 rowsInserted: result.rowsInserted,
                 capsuleUpdated: result.capsuleUpdated,
                 libraryUpdated: result.libraryUpdated,
                 proformaSeeded: result.proformaSeeded,
                 crossValidationVariances: result.crossValidationVariances,
                 alerts: result.alerts,
               }),
               docId]
            );

            try {
              const wsModule = await import('../../services/websocket.service') as Record<string, unknown>;
              const broadcastToDeal = wsModule.broadcastToDeal as ((dealId: string, payload: Record<string, unknown>) => void) | undefined;
              if (broadcastToDeal) {
                broadcastToDeal(verifiedDealId, {
                  type: 'extraction_complete',
                  documentId: docId,
                  documentType: result.documentType,
                  success: result.success,
                  capsuleUpdated: result.capsuleUpdated,
                  proformaSeeded: result.proformaSeeded,
                  crossValidationVariances: result.crossValidationVariances,
                });
              }
            } catch { /* websocket optional */ }
          } catch (e) { console.error('[ExtractionPipeline] Status update error:', e); }
        })
        .catch(err => {
          console.error(`[ExtractionPipeline] Error processing ${req.file!.originalname}:`, err);
        });
    }

    res.json({ success: true, data: fileMeta });
  } catch (error: any) {
    console.error('Error uploading deal document:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to upload document' });
  }
});

router.get('/:dealId/extraction-accuracy', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { dealId } = req.params;
    const ownerCheck = await pool.query(
      'SELECT id FROM deals WHERE id = $1 AND user_id = $2',
      [dealId, req.user!.userId]
    );
    if (ownerCheck.rows.length === 0) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }
    const { computeExtractionAccuracy } = await import('../../services/extraction-accuracy.service');
    const report = await computeExtractionAccuracy(pool, dealId);
    return res.json({ success: true, data: report });
  } catch (error: any) {
    console.error('extraction-accuracy error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to compute accuracy' });
  }
});

router.post('/:dealId/reprocess-documents', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { dealId } = req.params;

    const ownerCheck = await pool.query(
      'SELECT id FROM deals WHERE id = $1 AND user_id = $2',
      [dealId, req.user!.userId]
    );
    if (ownerCheck.rows.length === 0) {
      return res.status(403).json({ success: false, error: 'Not authorized to access this deal' });
    }

    const result = await processDealDocuments(dealId, req.user!.userId);

    res.json({
      success: true,
      data: {
        dealId: result.dealId,
        documentsProcessed: result.documentsProcessed,
        results: result.results,
        capsuleUpdated: result.capsuleUpdated,
        libraryUpdated: result.libraryUpdated,
        alerts: result.alerts,
      },
    });
  } catch (error: any) {
    console.error('Error reprocessing deal documents:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to reprocess documents' });
  }
});

router.post('/:dealId/extract-document', requireAuth, documentUpload.single('file') as any, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const { dealId } = req.params;

    const ownerCheck = await pool.query(
      'SELECT id FROM deals WHERE id = $1 AND user_id = $2',
      [dealId, req.user!.userId]
    );
    if (ownerCheck.rows.length === 0) {
      return res.status(403).json({ success: false, error: 'Not authorized to access this deal' });
    }

    const result = await processDocument(req.file.path, req.file.originalname, dealId, req.user!.userId);

    res.json({
      success: true,
      data: {
        filename: req.file.originalname,
        documentType: result.documentType,
        extractionSuccess: result.success,
        rowsInserted: result.rowsInserted,
        alerts: result.alerts,
        error: result.error,
      },
    });
  } catch (error: any) {
    console.error('Error extracting document:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to extract document' });
  }
});

router.get('/:dealId/proforma/year1', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { dealId } = req.params;
    const ownerCheck = await pool.query(
      'SELECT id FROM deals WHERE id = $1 AND user_id = $2',
      [dealId, req.user!.userId]
    );
    if (ownerCheck.rows.length === 0) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }
    const result = await pool.query(
      `SELECT year1, source_type, source_date, updated_at
       FROM deal_assumptions WHERE deal_id = $1`,
      [dealId]
    );
    if (result.rows.length === 0 || !result.rows[0].year1) {
      return res.json({ success: true, data: null, message: 'No proforma seed available — upload a T12 or rent roll first' });
    }
    res.json({
      success: true,
      data: {
        year1: result.rows[0].year1,
        sourceType: result.rows[0].source_type,
        seededAt: result.rows[0].source_date,
        updatedAt: result.rows[0].updated_at,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

router.patch('/:dealId/proforma/year1/override', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { dealId } = req.params;
    const { fieldPath, value } = req.body;

    if (!fieldPath || typeof fieldPath !== 'string') {
      return res.status(400).json({ success: false, error: 'fieldPath required' });
    }

    if (value !== null && (typeof value !== 'number' || !isFinite(value))) {
      return res.status(400).json({ success: false, error: 'value must be a finite number or null' });
    }

    const ownerCheck = await pool.query(
      'SELECT id FROM deals WHERE id = $1 AND user_id = $2',
      [dealId, req.user!.userId]
    );
    if (ownerCheck.rows.length === 0) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    const { applyUserOverride } = await import('../../services/proforma-seeder.service');
    await applyUserOverride(pool, dealId, fieldPath, value, req.user!.userId);
    res.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

router.post('/:dealId/proforma/seed', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { dealId } = req.params;

    const ownerCheck = await pool.query(
      'SELECT id FROM deals WHERE id = $1 AND user_id = $2',
      [dealId, req.user!.userId]
    );
    if (ownerCheck.rows.length === 0) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    const { seedProFormaYear1 } = await import('../../services/proforma-seeder.service');
    const result = await seedProFormaYear1(pool, dealId);
    res.json({ success: true, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

router.post('/:dealId/validate/cross-doc', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { dealId } = req.params;

    const ownerCheck = await pool.query(
      'SELECT id FROM deals WHERE id = $1 AND user_id = $2',
      [dealId, req.user!.userId]
    );
    if (ownerCheck.rows.length === 0) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    const { runCrossValidation } = await import('../../services/multi-doc-cross-validation.service');
    const result = await runCrossValidation(pool, dealId);
    res.json({ success: true, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

router.post('/:dealId/traffic-snapshot', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { dealId } = req.params;

    const ownerCheck = await pool.query(
      'SELECT id FROM deals WHERE id = $1 AND user_id = $2',
      [dealId, req.user!.userId]
    );
    if (ownerCheck.rows.length === 0) {
      return res.status(403).json({ success: false, error: 'Not authorized to access this deal' });
    }

    const snapshot = await computeAndPersistTrafficSnapshot(dealId);

    res.json({
      success: true,
      data: {
        snapshotDate: snapshot.snapshotDate,
        summary: snapshot.summary,
        signingVelocity: snapshot.signingVelocity,
        seasonalityCurve: snapshot.seasonalityCurve,
        expirationWaterfall: snapshot.expirationWaterfall,
        velocityVariance: snapshot.velocityVariance,
        leaseTermDistribution: snapshot.leaseTermDistribution,
        tradeOutAnalytics: snapshot.tradeOutAnalytics,
        mtmExposure: snapshot.mtmExposure,
        conversionFunnel: snapshot.conversionFunnel,
        sourceDocumentTypes: snapshot.sourceDocumentTypes,
      },
    });
  } catch (error: any) {
    console.error('Error computing traffic snapshot:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to compute traffic snapshot' });
  }
});

router.get('/:dealId/traffic-snapshot', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { dealId } = req.params;

    const ownerCheck = await pool.query(
      'SELECT id FROM deals WHERE id = $1 AND user_id = $2',
      [dealId, req.user!.userId]
    );
    if (ownerCheck.rows.length === 0) {
      return res.status(403).json({ success: false, error: 'Not authorized to access this deal' });
    }

    const result = await pool.query(
      `SELECT snapshot_date, signing_velocity, seasonality_curve, expiration_waterfall,
              velocity_variance, lease_term_distribution, trade_out_analytics,
              mtm_exposure, conversion_funnel, summary, source_document_types, created_at
       FROM deal_traffic_snapshots
       WHERE deal_id = $1
       ORDER BY snapshot_date DESC
       LIMIT 1`,
      [dealId]
    );

    if (result.rows.length === 0) {
      return res.json({ success: true, data: null });
    }

    const row = result.rows[0];
    res.json({
      success: true,
      data: {
        snapshotDate: row.snapshot_date,
        summary: row.summary,
        signingVelocity: row.signing_velocity,
        seasonalityCurve: row.seasonality_curve,
        expirationWaterfall: row.expiration_waterfall,
        velocityVariance: row.velocity_variance,
        leaseTermDistribution: row.lease_term_distribution,
        tradeOutAnalytics: row.trade_out_analytics,
        mtmExposure: row.mtm_exposure,
        conversionFunnel: row.conversion_funnel,
        sourceDocumentTypes: row.source_document_types,
        createdAt: row.created_at,
      },
    });
  } catch (error: any) {
    console.error('Error fetching traffic snapshot:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch traffic snapshot' });
  }
});

export default router;

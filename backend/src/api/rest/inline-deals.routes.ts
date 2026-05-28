import { Router } from 'express';
import multer from 'multer';
import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs';
import { getPool } from '../../database/connection';
import { requireAuth, requireAuthOrApiKey, AuthenticatedRequest } from '../../middleware/auth';
import { requireCapability } from '../../middleware/rbac';
import { refreshAllDqaAlerts } from '../../services/data-quality-agent.service';
import { validate, createDealSchema, updateDealSchema } from './validation';
import { autoDiscoverComps } from '../../services/comp-set-discovery.service';
import { processDocument, processDealDocuments } from '../../services/document-extraction/extraction-pipeline';
import { computeAndPersistTrafficSnapshot } from '../../services/traffic-analytics.service';
import { getDealFinancials } from '../../services/proforma-adjustment.service';
import { seedProFormaYear1 } from '../../services/proforma-seeder.service';
import { buildProjectionsForExport } from '../../services/f9-financial-export.service';
import {
  ABSOLUTE_MAX_HOLD_YEARS,
  resolveTypicalHold,
  type DevelopmentType,
} from '../../services/hold-period-profiles';
import {
  getStanceForDeal,
  applyStanceToFinancials,
  type StanceModulation,
} from '../../services/operatorStance.service';
import { cashflowRuntime } from '../../agents/cashflow.config';
import { researchRuntime } from '../../agents/research.config';
import { supplyRuntime } from '../../agents/supply.config';
import { commentaryRuntime } from '../../agents/commentary.config';
import { logger } from '../../utils/logger';


// ── Pipeline-to-deal-data sync ────────────────────────────────────────

/**
 * Extract the JEDI score from pipeline results (prefer Commentary's computed score).
 */
function extractJediScore(results: Record<string, unknown>): number | null {
  const commentary = results.commentary as Record<string, unknown> | undefined;
  if (typeof commentary?.jedi_score === 'number') return commentary.jedi_score;
  const cashflow = results.cashflow as Record<string, unknown> | undefined;
  if (typeof cashflow?.jedi_score === 'number') return cashflow.jedi_score;
  return null;
}

/**
 * Extract the market / property name from pipeline results.
 */
function extractEntityName(results: Record<string, unknown>): string {
  const commentary = results.commentary as Record<string, unknown> | undefined;
  if (typeof commentary?.entity_name === 'string') return commentary.entity_name;
  return 'Deal';
}

/**
 * Sync pipeline agent results into deals.deal_data JSONB so the capsule UI,
 * deal detail views, and any other consumer that reads deal_data can display
 * agent-generated intelligence without extra queries.
 *
 * This runs after all 4 agents (Research → Supply → CashFlow → Commentary)
 * complete or fail in the setImmediate pipeline closure.
 */
async function syncPipelineToDealData(
  db: any,
  dealId: string,
  results: Record<string, unknown>,
  errors: string[]
): Promise<void> {
  const commentary = results.commentary as Record<string, unknown> | undefined;
  const cashflow = results.cashflow as Record<string, unknown> | undefined;
  const research = results.research as Record<string, unknown> | undefined;
  const supply = results.supply as Record<string, unknown> | undefined;

  // Build pipeline summary block for deal_data
  const pipelineResults: Record<string, unknown> = {
    last_run_at: new Date().toISOString(),
    status: errors.length === 0 ? 'complete' : errors.length === 4 ? 'failed' : 'partial',
    errors: errors.length > 0 ? errors : undefined,
    run_id: null, // will be populated by the caller if needed

    // JEDI Score from Commentary
    jedi_score: extractJediScore(results),
    entity_name: extractEntityName(results),

    // Narrative from Commentary
    market_narrative: commentary?.market_narrative ?? null,
    investment_thesis: commentary?.investment_thesis ?? null,
    supply_narrative: commentary?.supply_narrative ?? null,
    summary: commentary?.summary ?? null,
    recommendation: commentary?.recommended_strategy ?? null,
    arbitrage_flag: commentary?.arbitrage_flag ?? null,
    arbitrage_delta: typeof commentary?.arbitrage_delta === 'number' ? commentary.arbitrage_delta : null,

    // Proforma fields from Cashflow
    proforma_fields: cashflow?.proforma_fields ?? null,
    collision_summary: cashflow?.collision_summary ?? null,
    confidence_distribution: cashflow?.confidence_distribution ?? null,
    investment_rating: cashflow?.investment_rating ?? null,
    cashflow_summary: cashflow?.summary ?? null,

    // Per-agent timestamps (set when each agent completed)
    research_completed: typeof research?.completed_at === 'string' ? research.completed_at : null,
    supply_completed: typeof supply?.completed_at === 'string' ? supply.completed_at : null,
    cashflow_completed: typeof cashflow?.completed_at === 'string' ? cashflow.completed_at : null,
    commentary_completed: typeof commentary?.completed_at === 'string' ? commentary.completed_at : null,
  };

  // Merge into deals.deal_data (JSONB || operation)
  // Use the 'agent_intelligence' top-level key to namespace agent output
  // so it doesn't collide with other deal_data fields.
  await db.query(
    `UPDATE deals
     SET deal_data = COALESCE(deal_data, '{}'::jsonb) || $1::jsonb,
         updated_at = NOW()
     WHERE id = $2`,
    [
      JSON.stringify({ agent_intelligence: pipelineResults }),
      dealId,
    ]
  );

  logger.info(`[PipelineSync] deal_data updated for ${dealId}` + 
    (pipelineResults.jedi_score !== null ? ` (JEDI: ${pipelineResults.jedi_score})` : ''));
}

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
      deal_category, development_type, strategy, address, description,
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

    // F-strategy-1: Derive strategy deterministically at creation time so
    // deals.strategy is never null. Explicit body value wins; otherwise a
    // simple keyword scan of projectIntent provides a non-null default.
    // KNOWN_STRATEGIES in the postprocessor recognises all values below.
    let resolvedStrategy: string = strategy || 'existing';
    if (!strategy) {
      const intentLower = (projectIntent || '').toLowerCase();
      if (
        intentLower.includes('value-add') ||
        intentLower.includes('value add') ||
        intentLower.includes('renovation')
      ) {
        resolvedStrategy = 'value-add';
      } else if (
        intentLower.includes('development') ||
        intentLower.includes('construction') ||
        intentLower.includes('ground-up') ||
        intentLower.includes('ground up')
      ) {
        resolvedStrategy = 'development';
      } else if (
        intentLower.includes('lease-up') ||
        intentLower.includes('lease up') ||
        intentLower.includes('lease_up')
      ) {
        resolvedStrategy = 'lease-up';
      } else if (intentLower.includes('flip')) {
        resolvedStrategy = 'flip';
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
        deal_category, development_type, address, description, org_id, strategy
      )
      VALUES ($1, $2, ${boundaryGeom}, $4, $5, $6, $7, $8, $9, $10, 'active', $11, $12, $13, $14, $15, $16)
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
      resolvedStrategy,
    ]);

    const row = result.rows[0];

    // Task #623 — Dual-write purchase_price into deal_data so the proforma
    // fallback chain (deal_data.purchase_price → deal_data.asking_price →
    // deals.budget) finds a value immediately. Without this write the chain
    // produces null for deals created before the #617 Deal Terms save runs,
    // making IRR/EM/CoC blank for newly created deals with a budget.
    if (budget) {
      await client.query(
        `UPDATE deals
         SET deal_data = COALESCE(deal_data, '{}') || jsonb_build_object('purchase_price', $1::numeric)
         WHERE id = $2`,
        [budget, row.id]
      );
    }

    // D-DEAL-1 fix (Task #1405 / Wave A): Guarantee a linked properties row exists for every
    // new deal so the Valuation Grid join `properties p ON p.deal_id = d.id` always returns
    // a subject record.  Uses update-or-insert to handle the unique index on address_line1:
    //
    //   Step A — UPDATE any existing properties row whose address matches this deal's address
    //            and whose deal_id is still NULL.  Covers the common case where ApartmentIQ
    //            seeding or a prior user search already created the row.
    //
    //   Step B — If Step A linked nothing (rowCount === 0), INSERT a stub row with
    //            address_line1 = NULL so the unique index is never triggered.  Enrichment
    //            pipeline fills in address, city, state, building_class, etc.
    //
    // Both steps run inside the same try block; an exception is hard-logged (not swallowed)
    // but still non-fatal so the deal creation response is never blocked.
    try {
      let propLat: number | null = null;
      let propLng: number | null = null;
      if (boundary.type === 'Point' && Array.isArray(boundary.coordinates) && boundary.coordinates.length >= 2) {
        propLng = Number(boundary.coordinates[0]) || null;
        propLat = Number(boundary.coordinates[1]) || null;
      } else if (boundary.type === 'Polygon' && Array.isArray(boundary.coordinates) && boundary.coordinates.length > 0) {
        const ring = boundary.coordinates[0] as [number, number][];
        if (ring.length > 0) {
          propLng = ring.reduce((s: number, c: [number, number]) => s + c[0], 0) / ring.length;
          propLat = ring.reduce((s: number, c: [number, number]) => s + c[1], 0) / ring.length;
        }
      }

      // Step A: link by address match (avoids unique-index violation on address_line1)
      let linked = false;
      if (address) {
        const updateRes = await client.query(
          `UPDATE properties
           SET deal_id           = $1,
               units             = COALESCE(units, $2),
               acquisition_price = COALESCE(acquisition_price, $3),
               lat               = COALESCE(lat, $4),
               lng               = COALESCE(lng, $5),
               latitude          = COALESCE(latitude, $4),
               longitude         = COALESCE(longitude, $5),
               updated_at        = NOW()
           WHERE address_line1 = $6
             AND deal_id IS NULL
             AND NOT EXISTS (SELECT 1 FROM properties p2 WHERE p2.deal_id = $1)`,
          [row.id, targetUnits || null, budget || null, propLat, propLng, address]
        );
        linked = (updateRes.rowCount ?? 0) > 0;
      }

      // Step B: insert stub row if no address match linked anything
      if (!linked) {
        await client.query(
          `INSERT INTO properties (
             deal_id, address_line1, units, acquisition_price,
             lat, lng, latitude, longitude, created_by, ownership_status
           )
           SELECT $1, NULL, $2, $3, $4, $5, $4, $5, $6, 'pipeline'
           WHERE NOT EXISTS (SELECT 1 FROM properties WHERE deal_id = $1)`,
          [row.id, targetUnits || null, budget || null, propLat, propLng, req.user!.userId]
        );
      }
    } catch (propErr) {
      // Log as error (not warn) — linkage failure means Valuation Grid will degrade.
      // Non-fatal: deal creation response must not be blocked by a properties-table issue.
      logger.error(`[DealCreation] D-DEAL-1: failed to link properties row for deal ${row.id}`, {
        dealId: row.id,
        err: propErr instanceof Error ? propErr.message : String(propErr),
      });
    }

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

        // D-DEAL-2: Populate subject fields on the linked properties row
        // after document extraction so OM/rent-roll values are available.
        try {
          const { SubjectPopulationService } = await import('../../services/subject-population.service');
          const populationSvc = new SubjectPopulationService(pool);
          await populationSvc.populateSubjectFields(row.id);
        } catch (populateErr) {
          // Non-fatal — subject population must never break the deal creation flow
          console.warn(
            `[SubjectPopulation] Post-extraction populate failed for ${row.id}:`,
            populateErr instanceof Error ? populateErr.message : populateErr
          );
        }

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

    // Task #624 — Dual-write purchase_price to deal_data when budget is
    // explicitly in the PATCH body. Guard: only fires when budget is present
    // AND non-null — do NOT write unconditionally or we would clobber the
    // value set by the #617 dedicated dual-write endpoint.
    if (updates.budget !== undefined && updates.budget != null) {
      await client.query(
        `UPDATE deals
         SET deal_data = COALESCE(deal_data, '{}') || jsonb_build_object('purchase_price', $1::numeric)
         WHERE id = $2`,
        [updates.budget, dealId]
      );
    }

    // Trigger agent system on status change
    if (statusChanged) {
      // H1 — Record lifecycle event (spec §7.9 Invariant 2).
      // Fire before downstream hooks so the event timestamp precedes any
      // corpus bootstrap or agent work triggered by the same status change.
      setImmediate(async () => {
        try {
          const { recordDealLifecycleEvent } = await import('../../services/portfolio/lifecycle-transition.service');
          await recordDealLifecycleEvent(
            dealId,
            previousDeal.status as string | null,
            updates.status as string,
            req.user!.userId,
          );
        } catch (lcErr) {
          console.warn('[LifecycleEvents] Failed to record lifecycle event (non-fatal):', lcErr instanceof Error ? lcErr.message : lcErr);
        }
      });

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

      // Lifecycle transition → corpus bootstrap (Phase 1)
      // When a deal moves into portfolio/owned/closed, bootstrap an initial
      // historical_observations row so the realized-output windows begin
      // accumulating from day one of the hold period.
      setImmediate(async () => {
        try {
          const { onDealStatusTransitionToPortfolio } = await import('../../services/portfolio/lifecycle-transition.service');
          await onDealStatusTransitionToPortfolio(
            dealId,
            updates.status,
            req.user!.userId,
          );
        } catch (lcErr) {
          console.warn('[LifecycleTransition] Corpus bootstrap failed (non-fatal):', lcErr instanceof Error ? lcErr.message : lcErr);
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

    // D-DEAL-2: Re-populate subject fields when intake fields change so the
    // linked properties row stays in sync with the latest deal data.
    // Runs after the response so it never delays the update acknowledgement.
    setImmediate(async () => {
      try {
        const { SubjectPopulationService } = await import('../../services/subject-population.service');
        const populationSvc = new SubjectPopulationService(pool);
        await populationSvc.populateSubjectFields(dealId);
      } catch (populateErr) {
        console.warn(
          `[SubjectPopulation] Post-update populate failed for ${dealId}:`,
          populateErr instanceof Error ? populateErr.message : populateErr
        );
      }
    });

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
router.get('/:dealId/analysis/latest', requireAuthOrApiKey, async (req: AuthenticatedRequest, res) => {
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
 * Trigger full underwriting pipeline for a deal.
 * Returns immediately with a runId; agents run asynchronously.
 * Check /api/agent-runs/:runId for status.
 */
router.post('/:dealId/analysis/trigger', requireAuthOrApiKey, async (req: AuthenticatedRequest, res) => {
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
    
    // Create a pipeline run record for tracking
    const pipelineRunId = randomUUID();
    await client.query(
      `INSERT INTO agent_runs (id, agent_id, agent_version, prompt_version, deal_id, user_id, triggered_by, status, input, started_at)
       VALUES ($1, 'pipeline', '1.0.0', 'pipeline-v1', $2, $3, 'user', 'running', '{}', NOW())`,
      [pipelineRunId, dealId, req.user!.userId]
    );

    // Fire the full underwriting pipeline asynchronously
    // Research → Supply → CashFlow → Commentary
    (async () => {
      const results: Record<string, unknown> = {};
      const errors: string[] = [];

      const ctxBase: import('../../agents/runtime/types').RunContext =
        { dealId, userId: req.user!.userId, triggeredBy: 'user' as const };

      // ── Build enriched deal input from extracted deal_data ──
      let enrichedDealInput: Record<string, unknown> = { dealId };
      let dataPreamble = '';
      try {
        const dealRow = await pool.query('SELECT deal_data FROM deals WHERE id = $1', [dealId]);
        const dd = dealRow.rows[0]?.deal_data || {};
        const extractionT12 = dd.extraction_t12 || null;
        const extractionRentRoll = dd.extraction_rent_roll || null;
        const extractionOM = dd.extraction_om || null;
        const brokerClaims = dd.broker_claims || null;
        const geographicContext = dd.geographic_context || null;
        const platformIntel = dd.platform_intel || null;

        if (extractionT12 || extractionRentRoll || extractionOM || brokerClaims || geographicContext || platformIntel) {
          // Keep user message lean — just dealId. The preamble (system prompt)
          // tells the agent what extracted data exists, and fetch_data_matrix
          // now returns it via context.extractedData.
          enrichedDealInput = { dealId };

          // Build a human-readable preamble so agents know what's available via fetch_data_matrix
          const lines: string[] = ['## EXTRACTED DEAL DATA (via fetch_data_matrix → context.extractedData)'];
          if (extractionRentRoll) {
            const rr = extractionRentRoll;
            lines.push(`Units: ${rr.total_units ?? '?'} | Occupied: ${rr.occupied_units ?? '?'} (${rr.occupancy_by_unit_pct != null ? (rr.occupancy_by_unit_pct * 100).toFixed(1) : '?'}%)`);
            lines.push(`Avg Market Rent: ${rr.avg_market_rent != null ? '$' + rr.avg_market_rent.toLocaleString() + '/mo' : '?'}`);
            lines.push(`Avg Effective Rent: ${rr.avg_effective_rent != null ? '$' + rr.avg_effective_rent.toLocaleString() + '/mo' : '?'}`);
            lines.push(`GPR Monthly: ${rr.gpr_monthly != null ? '$' + rr.gpr_monthly.toLocaleString() : '?'}`);
          }
          if (extractionT12) {
            const t12 = extractionT12;
            lines.push(`T12: ${t12.months_captured ?? '?'}mo captured | GPR: ${t12.gpr != null ? '$' + t12.gpr.toLocaleString() : '?'} | EGI: ${t12.egi != null ? '$' + t12.egi.toLocaleString() : '?'}`);
            if (t12.noi != null) lines.push(`T12 NOI: ${'$' + t12.noi.toLocaleString()}`);
            if (t12.expense_ratio != null) lines.push(`Expense Ratio: ${(t12.expense_ratio * 100).toFixed(1)}%`);
            if (t12.noi_margin != null) lines.push(`NOI Margin: ${(t12.noi_margin * 100).toFixed(1)}%`);
            if (t12.opex?.total != null) lines.push(`Total OpEx: ${'$' + t12.opex.total.toLocaleString()}`);
          }
          if (brokerClaims?.proforma) {
            const pf = brokerClaims.proforma;
            if (pf.purchasePrice) lines.push(`Broker Asking: ${'$' + pf.purchasePrice.toLocaleString()}`);
            if (pf.capRate) lines.push(`Broker Cap: ${(pf.capRate * 100).toFixed(1)}%`);
            if (pf.pricePerUnit) lines.push(`Broker $/Unit: ${'$' + pf.pricePerUnit.toLocaleString()}`);
            if (pf.currentNOI) lines.push(`Broker NOI: ${'$' + pf.currentNOI.toLocaleString()}`);
          }
          if (extractionOM?.source_ref) {
            lines.push(`OM Source: ${extractionOM.source_ref}`);
          }
          dataPreamble = lines.join('\n');
          ctxBase.dataPreamble = dataPreamble;

          logger.info(`[Pipeline] Enriched input for ${dealId}` +
            (extractionT12 ? ' [T12]' : '') +
            (extractionRentRoll ? ' [RentRoll]' : '') +
            (extractionOM ? ' [OM]' : '') +
            (brokerClaims ? ' [BrokerClaims]' : ''));
        }
      } catch (dataErr: any) {
        logger.warn(`[Pipeline] Could not enrich deal data for ${dealId}: ${dataErr.message} — falling back to bare dealId`);
      }

      // Step 0: Seed proforma year1 from extraction capsules
      try {
        const { seedProFormaYear1 } = await import('../../services/proforma-seeder.service');
        const seedResult = await seedProFormaYear1(pool, dealId);
        if (seedResult.seeded) {
          logger.info(`[Pipeline] Proforma seeded: ${seedResult.fields_seeded} fields, NOI $${seedResult.resolved_noi}`);
        } else {
          logger.info(`[Pipeline] Proforma seed skipped: ${seedResult.warnings.join('; ')}`);
        }
      } catch (seedErr: any) {
        logger.warn(`[Pipeline] Proforma seeding failed (non-fatal): ${seedErr.message}`);
      }

      // Step 1: Research agent — market context
      try {
        logger.info(`[Pipeline] Starting Research for ${dealId}`);
        results.research = await researchRuntime.run(enrichedDealInput, ctxBase);
        logger.info(`[Pipeline] Research complete for ${dealId}`);
      } catch (err: any) {
        logger.error(`[Pipeline] Research failed for ${dealId}: ${err.message}`);
        errors.push(`Research: ${err.message}`);
      }

      // Step 2: Supply agent — supply pipeline
      try {
        logger.info(`[Pipeline] Starting Supply for ${dealId}`);
        results.supply = await supplyRuntime.run(enrichedDealInput, ctxBase);
        logger.info(`[Pipeline] Supply complete for ${dealId}`);
      } catch (err: any) {
        logger.error(`[Pipeline] Supply failed for ${dealId}: ${err.message}`);
        errors.push(`Supply: ${err.message}`);
      }

      // Step 3: CashFlow agent — pro forma + underwriting
      try {
        logger.info(`[Pipeline] Starting CashFlow for ${dealId}`);
        results.cashflow = await cashflowRuntime.run(enrichedDealInput, ctxBase);
        logger.info(`[Pipeline] CashFlow complete for ${dealId}`);
      } catch (err: any) {
        logger.error(`[Pipeline] CashFlow failed for ${dealId}: ${err.message}`);
        errors.push(`CashFlow: ${err.message}`);
      }

      // Step 4: Commentary agent — narrative summary
      try {
        logger.info(`[Pipeline] Starting Commentary for ${dealId}`);
        results.commentary = await commentaryRuntime.run(enrichedDealInput, ctxBase);
        logger.info(`[Pipeline] Commentary complete for ${dealId}`);
      } catch (err: any) {
        logger.error(`[Pipeline] Commentary failed for ${dealId}: ${err.message}`);
        errors.push(`Commentary: ${err.message}`);
      }

      // Mark pipeline run (use fresh pool connection — don't capture from outer scope)
      try {
        const status = errors.length === 0 ? 'succeeded' : errors.length === 4 ? 'failed' : 'partial';
        let outputPayload: Record<string, unknown> = { errors: errors.length > 0 ? errors : undefined };
        // Strip circular/non-serializable refs from rich agent run objects
        try {
          outputPayload.results = JSON.parse(JSON.stringify(results));
        } catch {
          // Fall back to a summary if full results can't serialize
          outputPayload = {
            ...outputPayload,
            results: Object.fromEntries(
              Object.entries(results).map(([k, v]) => [k, typeof v === 'object' ? '[serialized]' : v])
            ),
          };
        }
        await pool.query(
          `UPDATE agent_runs SET status = $1, output = $2, completed_at = NOW() WHERE id = $3`,
          [status, JSON.stringify(outputPayload), pipelineRunId]
        );
        logger.info(`[Pipeline] Underwrite ${status} for ${dealId}` + 
          (errors.length > 0 ? ` (${errors.length} failures)` : ''));

        // ── Sync pipeline results into deals.deal_data for capsule UI ──
        try {
          await syncPipelineToDealData(pool, dealId, results, errors);
        } catch (syncErr: any) {
          logger.error(`[Pipeline] Capsule sync failed for ${dealId}: ${syncErr.message}`);
        }
      } catch (dbErr: any) {
        logger.error(`[Pipeline] DB update failed for ${dealId}: ${dbErr.message}`);
      }
    })().catch((fatal: any) => {
      logger.error(`[Pipeline] Fatal unhandled rejection for ${dealId}: ${fatal?.message ?? String(fatal)}`);
      pool.query(
        `UPDATE agent_runs SET status = 'failed', error = $1, completed_at = NOW() WHERE id = $2`,
        [String(fatal?.message ?? fatal), pipelineRunId]
      ).catch((e: any) => logger.error(`[Pipeline] Failed to mark pipeline failed after fatal: ${e.message}`));
    });

    res.json({
      success: true,
      message: 'Underwriting pipeline triggered. Agents: Research → Supply → CashFlow → Commentary.',
      dealId,
      pipelineRunId
    });
  } catch (error: any) {
    console.error('Error triggering analysis:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to trigger analysis'
    });
  }
});

/**
 * GET /deals/:dealId/analysis/status
 * Check the status of the most recent pipeline run for a deal.
 */
router.get('/:dealId/analysis/status', requireAuthOrApiKey, async (req: AuthenticatedRequest, res) => {
  try {
    const { dealId } = req.params;
    const client = pool;
    
    const result = await client.query(
      `SELECT id, status, output, started_at, completed_at,
              COALESCE(EXTRACT(EPOCH FROM (completed_at - started_at)), 0)::int AS duration_sec
       FROM agent_runs
       WHERE deal_id = $1 AND agent_id = 'pipeline'
       ORDER BY started_at DESC LIMIT 1`,
      [dealId]
    );
    
    if (result.rows.length === 0) {
      return res.json({ success: true, run: null });
    }
    
    res.json({
      success: true,
      run: result.rows[0]
    });
  } catch (error: any) {
    console.error('Error checking pipeline status:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to check pipeline status'
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

            // Wire agent system: fire after extraction so the detected
            // document type (category) is known before dispatching.
            try {
              const { onFileUploaded, onFinancialsUploaded } = await import('../../services/agents/platform-hooks');
              await onFileUploaded({
                dealId: verifiedDealId,
                userId: req.user!.userId,
                fileId: docId,
                filename: req.file!.originalname,
                category: result.documentType || 'document',
                mimeType: req.file!.mimetype,
              });
              const docTypeLower = (result.documentType || '').toLowerCase();
              if (docTypeLower.includes('t12') || docTypeLower.includes('financial')) {
                await onFinancialsUploaded({ dealId: verifiedDealId, userId: req.user!.userId, type: 't12' });
              } else if (docTypeLower.includes('rent')) {
                await onFinancialsUploaded({ dealId: verifiedDealId, userId: req.user!.userId, type: 'rent_roll' });
              }
            } catch { /* non-fatal */ }
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

/**
 * GET /api/v1/deals/:dealId/financials
 *
 * Composes the full DealFinancials response for the ProFormaSummaryTab.
 * Auto-initializes the proforma seed if none exists yet.
 *
 * Returns the shape the frontend DealFinancials interface expects:
 *   { success, data: { dealId, dealName, totalUnits, proforma: { year1, integrityChecks, unitEconomics, valuationSnapshot } } }
 */
// NOTE: GET /:dealId/financials is intentionally deferred to the canonical
// rich handler in deal-assumptions.routes.ts (mounted later on the same
// '/api/v1/deals' prefix). That handler returns the full DealFinancials shape
// (operatingStatement, rentRollSummary, year1Seed, projections, returns…)
// expected by ProFormaSummaryTab and the rest of the F9 Financial Engine.
// A duplicate slim implementation was previously inlined here but it (a)
// referenced a non-existent `data` column on `deals` (the column is
// `deal_data`) and (b) returned an incomplete shape that broke the F9 UI.
/**
 * GET /api/v1/deals/:dealId/financials
 *
 * Composes the full F9DealFinancials shape from multiple DB tables.
 * Auto-initializes the proforma seed if none exists yet.
 */
router.get('/:dealId/financials', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { dealId } = req.params;
    // Hold period resolution: explicit ?hold= query > deal's strategy-typical hold
    // (from STRATEGY_HOLD_PROFILES) > 5-year fallback. The cap is the absolute
    // ceiling derived from the longest profile.max across all strategy/debt
    // profiles — see services/hold-period-profiles.ts.
    const requestedHold = parseInt(req.query.hold as string);
    let dealStrategy: DevelopmentType | null = null;
    if (!Number.isFinite(requestedHold) || requestedHold <= 0) {
      const stratRes = await pool.query(
        `SELECT development_type FROM deals WHERE id = $1`,
        [dealId],
      );
      dealStrategy = (stratRes.rows[0]?.development_type as DevelopmentType) ?? null;
    }
    const defaultHold = resolveTypicalHold({ strategy: dealStrategy });
    const holdYears = Math.min(
      Math.max(Number.isFinite(requestedHold) && requestedHold > 0 ? requestedHold : defaultHold, 1),
      ABSOLUTE_MAX_HOLD_YEARS,
    );
    const runSeed = req.query.seed === 'true';

    if (runSeed) {
      await seedProFormaYear1(pool, dealId);
    }

    const data = await getDealFinancials(pool, dealId, holdYears);

    // ── OperatorStance modulation ──────────────────────────────────────────────
    // MUST run BEFORE buildProjectionsForExport: applyStanceToFinancials mutates
    // data.assumptions.perYear (rentGrowthPct, vacancyPct, exitCap) which
    // buildProjectionsForExport reads to derive per-year cash flows. Running
    // modulation first means returned projections, NOI, and IRR all reflect the
    // operator's current stance. stanceModulations provides per-field trace for
    // UI amber markers.
    let stanceModulations: StanceModulation[] = [];
    let stanceDefaulted = true;
    try {
      const stance = await getStanceForDeal(dealId, req.user!.userId);
      stanceDefaulted = stance.defaulted ?? true;
      if (!stance.defaulted && data.assumptions) {
        stanceModulations = applyStanceToFinancials(data, stance);
      }
    } catch (_stanceErr) {
      // Non-fatal — stance failure must not block the financials response.
    }

    // ── Per-year projections ───────────────────────────────────────────────────
    // Build after stance modulation so modulated perYear assumptions flow into
    // the projection recomputation. cfads is aliased from cfbt so existing
    // ReturnsTab / FinancialEnginePage consumers that read r.cfads keep working.
    // NOTE: data.returns is intentionally passed through unchanged — getDealFinancials
    // already computes the full rich returns object (lpNetIrr, lpEquityMultiple, …).
    // Overwriting it with a simplified {irr,equityMultiple,cashOnCash} stripped
    // those fields and left the ReturnsTab hero strip blank for every deal that
    // hadn't yet run the cashflow model.
    const projs = buildProjectionsForExport(data, holdYears);
    const projections = projs.map(p => ({ ...p, cfads: p.cfbt }));

    // Fetch close/sale dates stored in deal_data jsonb
    const dateRes = await pool.query(
      `SELECT deal_data->>'close_date' AS close_date, deal_data->>'sale_date' AS sale_date FROM deals WHERE id = $1`,
      [dealId]
    );
    const closeDate: string | null = dateRes.rows[0]?.close_date ?? null;
    const saleDate: string | null  = dateRes.rows[0]?.sale_date  ?? null;

    // Fetch math_correction_report.hierarchical_resolutions from the latest
    // completed cashflow agent run (Task #804 / #805). Null when agent hasn't run yet.
    let mathCorrectionReport: {
      hierarchical_resolutions?: Record<string, {
        resolved_value: number;
        resolution_source: string;
        resolution_method: string;
        breakdown_sum?: number;
        aggregate_value?: number;
        reconciliation_delta?: number;
        reconciliation_delta_pct?: number;
        reconciliation_status: string;
      }>;
    } | null = null;
    try {
      const mathRes = await pool.query(
        `SELECT output->'cashflow'->'math_correction_report' AS math_correction_report
         FROM agent_runs
         WHERE deal_id = $1
           AND agent_id = 'pipeline'
           AND status = 'completed'
           AND output->'cashflow'->'math_correction_report' IS NOT NULL
         ORDER BY completed_at DESC
         LIMIT 1`,
        [dealId]
      );
      if (mathRes.rows.length > 0 && mathRes.rows[0].math_correction_report) {
        mathCorrectionReport = mathRes.rows[0].math_correction_report;
      }
    } catch (mathErr: unknown) {
      // Non-fatal — UI degrades gracefully without reconciliation data.
      logger.warn('math_correction_report fetch failed (non-fatal):', mathErr instanceof Error ? mathErr.message : String(mathErr));
    }

    res.json({
      success: true,
      data: { ...data, closeDate, saleDate, mathCorrectionReport, projections },
      stanceModulations,
      stanceDefaulted,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('Financials endpoint error:', message);
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

/**
 * PATCH /:dealId/financials/override
 *
 * Saves a unit mix rent override. Called by UnitMixTab when the user edits
 * inPlaceRent or marketRent for a row. Dual persistence path:
 *   • If a real `rent_roll` row exists at the given index, the rent column is
 *     UPDATEd in place (or set to NULL when value=null to clear an override).
 *   • If no row exists at index 0 (the synthesized Default row backed by
 *     capsule aggregates) — or the legacy `rent_roll` table is gracefully
 *     absent — the value is upserted into `deal_assumptions.per_year_overrides`
 *     JSONB under keys `da:unit_mix:0:in_place_rent` / `:market_rent`. The
 *     composer reads those keys on every load and layers them on top of the
 *     capsule-synthesized row, so the Unit Mix tab and the Pro Forma OS see
 *     the same numbers.
 * After write, recalculates the deal's GPR from the updated unit mix.
 */
router.patch('/:dealId/financials/override', requireAuth, requireCapability('edit:operating_assumptions'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { dealId } = req.params;
    const userId = req.user!.userId;
    const { field, value } = req.body;

    if (!field || typeof field !== 'string') {
      return res.status(400).json({ success: false, error: 'field is required' });
    }

    // This handler is unit-mix specific. Other override field paths (e.g.
    // `other_income_breakdown.<cat>` from the F11 ancillary panel — Task #519)
    // are owned by the downstream `deal-assumptions.routes` handler that
    // delegates to `applyFinancialsOverride`. Pass through so Express keeps
    // matching subsequent routes mounted at the same path.
    if (!field.startsWith('unit_mix:')) {
      return next();
    }

    // Validate ownership
    const ownerCheck = await pool.query(
      'SELECT id FROM deals WHERE id = $1 AND user_id = $2',
      [dealId, userId]
    );
    if (ownerCheck.rows.length === 0) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    // Parse the field path: unit_mix:<rowIdx>:<field>
    // Accepts both legacy short forms (`inPlace` / `market`) and the canonical
    // `in_place_rent` / `market_rent` the frontend now sends.
    // E.g. unit_mix:2:in_place_rent → row 2 (ordered by type ASC).
    const match = field.match(/^unit_mix:(\d+):(inPlace|market|in_place_rent|market_rent)$/);
    if (!match) {
      return res.status(400).json({ success: false, error: `Invalid field path: ${field}` });
    }

    const rowIdx = parseInt(match[1], 10);
    const rawCell = match[2];
    // Normalize to the legacy short form used downstream for human messages,
    // and to the snake_case used as the DB column / per_year_overrides key.
    const cellField: 'inPlace' | 'market' =
      (rawCell === 'inPlace' || rawCell === 'in_place_rent') ? 'inPlace' : 'market';

    // Fetch existing rent_roll rows ordered the same way the frontend expects.
    // The legacy `rent_roll` table is intentionally gracefully absent in many
    // environments (the canonical store is `rent_roll_snapshots`). When it's
    // missing or empty, we store overrides in `deal_assumptions.per_year_overrides`
    // (an already-existing JSON column that the composer reads on every load),
    // keyed by row index + cell field — naturally idempotent.
    let rrRes: { rows: Array<{ id: string; type: string; in_place_rent: number | null; market_rent: number | null }> };
    let rentRollAvailable = true;
    try {
      rrRes = await pool.query(
        `SELECT id, type, in_place_rent, market_rent
         FROM rent_roll WHERE deal_id = $1 ORDER BY type ASC`,
        [dealId]
      );
    } catch (selErr: any) {
      console.warn('rent_roll SELECT failed; using per_year_overrides for persistence:', selErr?.message);
      rrRes = { rows: [] };
      rentRollAvailable = false;
    }

    let rowType = 'Default';

    if (!rrRes.rows[rowIdx]) {
      // No rent_roll SQL row at this index. This is the common path now that
      // most deals are sourced from `extraction_rent_roll` (capsule JSONB) or
      // the synthesized capsule-aggregate Default row. Persist the edit in
      // `deal_assumptions.per_year_overrides` — a JSON column that already
      // exists and is keyed, so writes are naturally idempotent. The composer
      // reads `da:unit_mix:<idx>:<field>` and applies the overrides on top of
      // the extraction-derived (multi-row) or capsule-synthesized rows.
      if (rrRes.rows.length === 0 || !rentRollAvailable) {
        const numVal = value === null ? null : parseFloat(value);
        if (value !== null && isNaN(numVal as number)) {
          return res.status(400).json({ success: false, error: 'Invalid numeric value' });
        }

        const ovKey = cellField === 'inPlace'
          ? `da:unit_mix:${rowIdx}:in_place_rent`
          : `da:unit_mix:${rowIdx}:market_rent`;

        try {
          // Upsert the override into per_year_overrides JSONB. jsonb_set is used
          // to write a single key without clobbering siblings; the row in
          // deal_assumptions is created if it doesn't exist.
          await pool.query(
            `INSERT INTO deal_assumptions (deal_id, per_year_overrides, created_at, updated_at)
             VALUES ($1, jsonb_build_object($2::text, jsonb_build_object('value', $3::jsonb)), NOW(), NOW())
             ON CONFLICT (deal_id) DO UPDATE
               SET per_year_overrides = jsonb_set(
                     COALESCE(deal_assumptions.per_year_overrides, '{}'::jsonb),
                     ARRAY[$2::text],
                     jsonb_build_object('value', $3::jsonb),
                     true
                   ),
                   updated_at = NOW()`,
            [dealId, ovKey, numVal === null ? 'null' : JSON.stringify(numVal)]
          );
        } catch (ovErr: any) {
          console.error('per_year_overrides upsert failed:', ovErr?.message);
          return res.status(500).json({
            success: false,
            error: 'Could not persist edit.',
          });
        }
      } else {
        return res.status(404).json({ success: false, error: `Rent roll row ${rowIdx} not found. Expected ${rrRes.rows.length} rows.` });
      }
    } else {
      const row = rrRes.rows[rowIdx];
      rowType = row.type;
      const dbColumn = cellField === 'inPlace' ? 'in_place_rent' : 'market_rent';

      if (value === null) {
        // Reset to null (remove override)
        await pool.query(
          `UPDATE rent_roll SET ${dbColumn} = NULL, updated_at = NOW() WHERE id = $1`,
          [row.id]
        );
      } else {
        const numVal = parseFloat(value);
        if (isNaN(numVal)) {
          return res.status(400).json({ success: false, error: 'Invalid numeric value' });
        }
        await pool.query(
          `UPDATE rent_roll SET ${dbColumn} = $1, updated_at = NOW() WHERE id = $2`,
          [numVal, row.id]
        );
      }
    }

    // Recalculate and return the updated deal financials
    const { composeDealFinancials } = await import('../../services/financials-composer.service');
    const result = await composeDealFinancials(pool, dealId, userId);

    res.json({
      success: true,
      data: result.data,
      message: `${cellField === 'inPlace' ? 'In-place rent' : 'Market rent'} updated for ${rowType}`,
    });
  } catch (error: any) {
    console.error('Error in financials/override:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to save override' });
  }
});

// ── Data Quality Alerts ───────────────────────────────────────────────────────

/**
 * In-memory rate-limit guard for DQA refresh: max 1 refresh per deal per hour.
 * Keyed by dealId → last successful refresh timestamp (ms).
 */
const dqaRefreshLastRun = new Map<string, number>();
const DQA_REFRESH_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour
const DQA_STALENESS_HOURS = parseInt(process.env.DQA_STALENESS_HOURS ?? '24', 10);

/**
 * GET /:dealId/data-quality-alerts/staleness
 * Returns the age of the newest finding for this deal and whether it exceeds
 * the configured staleness threshold (DQA_STALENESS_HOURS env var, default 24).
 */
router.get('/:dealId/data-quality-alerts/staleness', requireAuth, async (req: AuthenticatedRequest, res) => {
  const { dealId } = req.params;
  try {
    const result = await pool.query<{ newest_at: string; oldest_at: string; total: string }>(
      `SELECT MAX(created_at) AS newest_at,
              MIN(created_at) AS oldest_at,
              COUNT(*)::text  AS total
         FROM data_quality_alerts
        WHERE deal_id = $1
          AND superseded_by IS NULL
          AND status != 'dismissed'`,
      [dealId]
    );
    const row = result.rows[0];
    if (!row || row.newest_at == null) {
      return res.json({
        success: true,
        dealId,
        hasAlerts: false,
        newestAlertAt: null,
        ageHours: null,
        isStale: false,
        thresholdHours: DQA_STALENESS_HOURS,
      });
    }
    const newestAt = new Date(row.newest_at);
    const ageHours = (Date.now() - newestAt.getTime()) / (1000 * 60 * 60);
    res.json({
      success: true,
      dealId,
      hasAlerts: true,
      newestAlertAt: newestAt.toISOString(),
      oldestAlertAt: row.oldest_at ? new Date(row.oldest_at).toISOString() : null,
      ageHours: Math.round(ageHours * 10) / 10,
      isStale: ageHours > DQA_STALENESS_HOURS,
      thresholdHours: DQA_STALENESS_HOURS,
      totalAlerts: parseInt(row.total, 10),
    });
  } catch (err: any) {
    console.error('[data-quality-alerts staleness]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /:dealId/data-quality-alerts/refresh
 * Triggers a background re-audit for all uploaded documents on the deal.
 * Rate-limited: one refresh per deal per hour (returns 429 if called too soon).
 * The agent's cache layer means this is cheap when document/parser are unchanged.
 */
router.post('/:dealId/data-quality-alerts/refresh', requireAuth, async (req: AuthenticatedRequest, res) => {
  const { dealId } = req.params;
  const now = Date.now();
  const lastRun = dqaRefreshLastRun.get(dealId) ?? 0;
  if (now - lastRun < DQA_REFRESH_COOLDOWN_MS) {
    const waitMinutes = Math.ceil((DQA_REFRESH_COOLDOWN_MS - (now - lastRun)) / 60000);
    return res.status(429).json({
      success: false,
      error: `Rate limited — next refresh available in ${waitMinutes} minute(s)`,
    });
  }
  dqaRefreshLastRun.set(dealId, now);
  // Fire-and-forget: do not await so the response is immediate (202 Accepted)
  refreshAllDqaAlerts(pool, dealId).catch(() => {});
  res.status(202).json({
    success: true,
    dealId,
    message: 'DQA refresh queued — findings will update shortly',
  });
});

/**
 * GET /:dealId/data-quality-alerts
 * Returns all open (non-superseded) data quality findings for a deal.
 * Optionally filtered by ?documentType= or ?proformaRow=.
 */
router.get('/:dealId/data-quality-alerts', requireAuth, async (req: AuthenticatedRequest, res) => {
  const { dealId } = req.params;
  const { documentType, proformaRow, status } = req.query as Record<string, string | undefined>;
  try {
    const conditions: string[] = [
      'deal_id = $1',
      'superseded_by IS NULL',
    ];
    const params: unknown[] = [dealId];

    if (status) {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    } else {
      conditions.push("status != 'dismissed'");
    }
    if (documentType) {
      params.push(documentType.toUpperCase());
      conditions.push(`document_type = $${params.length}`);
    }
    if (proformaRow) {
      params.push(proformaRow);
      conditions.push(`proforma_row = $${params.length}`);
    }

    const result = await pool.query(
      `SELECT id, document_type, proforma_column, proforma_row,
              classification, severity, agent_finding,
              status, dismissed_at, dismissal_reason,
              created_at, updated_at
         FROM data_quality_alerts
        WHERE ${conditions.join(' AND ')}
        ORDER BY
          CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END,
          created_at DESC`,
      params
    );

    // Group by proforma_row for convenient front-end consumption
    const byRow: Record<string, unknown[]> = {};
    for (const row of result.rows) {
      if (!byRow[row.proforma_row]) byRow[row.proforma_row] = [];
      byRow[row.proforma_row].push(row);
    }

    res.json({ success: true, alerts: result.rows, byRow, total: result.rows.length });
  } catch (err: any) {
    console.error('[data-quality-alerts GET]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PATCH /data-quality-alerts/:id
 * Update the status of a data quality alert.
 * Body: { status: 'dismissed' | 'acknowledged' | 'fixed', dismissalReason?: string }
 */
router.patch('/data-quality-alerts/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const userId = req.user?.userId ?? 'unknown';
  const { status, dismissalReason } = req.body as { status?: string; dismissalReason?: string };

  const VALID_STATUSES = ['dismissed', 'acknowledged', 'fixed', 'open'];
  if (!status || !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ success: false, error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
  }

  try {
    const result = await pool.query(
      `UPDATE data_quality_alerts
          SET status          = $2,
              dismissed_at    = CASE WHEN $2 = 'dismissed' THEN NOW() ELSE dismissed_at END,
              dismissed_by    = CASE WHEN $2 = 'dismissed' THEN $3 ELSE dismissed_by END,
              dismissal_reason = CASE WHEN $2 = 'dismissed' THEN $4 ELSE dismissal_reason END,
              updated_at      = NOW()
        WHERE id = $1
        RETURNING id, status, updated_at`,
      [id, status, userId, dismissalReason ?? null]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Alert not found' });
    }

    res.json({ success: true, alert: result.rows[0] });
  } catch (err: any) {
    console.error('[data-quality-alerts PATCH]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

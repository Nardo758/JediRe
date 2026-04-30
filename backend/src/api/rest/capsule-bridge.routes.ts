/**
 * Deal Capsule Bridge — Auto-creates and seeds deal capsules from F-tab data
 *
 * Problem: The capsule detail page is blank because no capsule is ever created
 * for a deal. Capsules are the wrapper for deal_data + platform_intel +
 * user_adjustments, and the proforma lives separately in proforma_assumptions.
 *
 * This bridge:
 *   1. Auto-creates a capsule from deal data on first access
 *   2. Seeds platform_intel from F2/F3/F7 outputs (zoning, program, massing)
 *   3. Initializes the proforma_assumptions row with market baselines
 *   4. Provides a unified response: capsule + proforma in one call
 *
 * Routes (mounted under /api/v1/deals/:dealId):
 *   GET  /capsule          → Get or auto-create capsule, returns { capsule, proforma }
 *   POST /capsule/seed     → Manually seed capsule from F-tab outputs
 *   POST /capsule/trigger  → Initialize capsule + trigger full analysis pipeline
 */
import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { randomUUID } from 'crypto';

// ─── Types ──────────────────────────────────────────────────────────────────

interface DealCapsuleRow {
  id: string;
  deal_id: string;
  user_id: string;
  property_address: string;
  asset_class: string;
  status: string;
  deal_data: Record<string, any>;
  platform_intel: Record<string, any>;
  user_adjustments: Record<string, any>;
  jedi_score: number;
  created_at: string;
  updated_at: string;
}

interface ProFormaRow {
  id: string;
  deal_id: string;
  strategy: string;
  rent_growth_baseline: number;
  rent_growth_current: number;
  vacancy_baseline: number;
  vacancy_current: number;
  opex_growth_baseline: number;
  opex_growth_current: number;
  exit_cap_baseline: number;
  exit_cap_current: number;
  created_at: string;
  updated_at: string;
}

// ─── Route factory ──────────────────────────────────────────────────────────

export function createDealCapsuleBridge(pool: Pool): Router {
  const router = Router({ mergeParams: true });

  // ── Helpers ────────────────────────────────────────────────────────────

  async function getDeal(dealId: string) {
    const result = await pool.query(
      `SELECT id, user_id, name, address, project_type, status, deal_data, boundary, created_at
       FROM deals WHERE id = $1`,
      [dealId]
    );
    return result.rows[0] || null;
  }

  async function findCapsuleByDeal(dealId: string): Promise<DealCapsuleRow | null> {
    const result = await pool.query(
      `SELECT * FROM deal_capsules WHERE deal_data->>'deal_id' = $1 ORDER BY created_at DESC LIMIT 1`,
      [dealId]
    );
    return result.rows[0] || null;
  }

  async function findOrCreateCapsule(dealId: string, userId: string): Promise<DealCapsuleRow> {
    // Try existing
    const existing = await findCapsuleByDeal(dealId);
    if (existing) return existing;

    // Get deal info
    const deal = await getDeal(dealId);
    if (!deal) throw new Error('Deal not found');

    const capsuleId = randomUUID();
    const propertyAddress = deal.address || deal.name || 'Unknown';
    const assetClass = deal.project_type || 'mixed-use';

    // Seed deal_data with what we know from the deal record
    // Flat keys (layer1.*) live at the top level for the capsule detail page
    const dealDataObj = deal.deal_data || {};
    const dealData: Record<string, any> = {
      deal_id: dealId,
      property_address: propertyAddress,
      project_type: assetClass,
      boundary: deal.boundary,
      status: deal.status || 'discovery',
      broker_claims: {},
      // Promote flat keys for the capsule overview page (layer1)
      asking_price: dealDataObj.asking_price || null,
      units: dealDataObj.target_units || dealDataObj.units || deal.target_units || null,
      year_built: dealDataObj.year_built || null,
      broker_noi: dealDataObj.broker_noi || null,
      broker_cap_rate: dealDataObj.broker_cap_rate || null,
      broker_occupancy: dealDataObj.broker_occupancy || null,
      broker_rent_1br: dealDataObj.broker_rent_1br || null,
      broker_rent_2br: dealDataObj.broker_rent_2br || null,
    };

    // Create capsule
    const result = await pool.query(
      `INSERT INTO deal_capsules (id, user_id, property_address, deal_data, platform_intel, user_adjustments, asset_class, status)
       VALUES ($1, $2, $3, $4, '{}'::jsonb, '{}'::jsonb, $5, 'DISCOVER')
       RETURNING *`,
      [capsuleId, userId, propertyAddress, JSON.stringify(dealData), assetClass]
    );

    // Log creation
    await pool.query(
      `INSERT INTO capsule_activity (capsule_id, user_id, activity_type, activity_data)
       VALUES ($1, $2, 'created', $3)`,
      [capsuleId, userId, JSON.stringify({ message: 'Capsule auto-created from deal', deal_id: dealId })]
    );

    return result.rows[0];
  }

  async function getOrInitProForma(dealId: string, userId: string, strategy = 'rental'): Promise<ProFormaRow> {
    // Check existing
    const existing = await pool.query(
      `SELECT * FROM proforma_assumptions WHERE deal_id = $1`,
      [dealId]
    );
    if (existing.rows.length > 0) return existing.rows[0];

    // Initialize with market-default values
    const proformaId = randomUUID();
    const result = await pool.query(
      `INSERT INTO proforma_assumptions (id, deal_id, strategy, user_id,
        rent_growth_baseline, rent_growth_current,
        vacancy_baseline, vacancy_current,
        opex_growth_baseline, opex_growth_current,
        exit_cap_baseline, exit_cap_current,
        platform_rent_growth, platform_vacancy, platform_exit_cap)
       VALUES ($1, $2, $3, $4,
        3.0, 3.0,
        5.0, 5.0,
        2.5, 2.5,
        6.0, 6.0,
        3.0, 5.0, 6.0)
       RETURNING *`,
      [proformaId, dealId, strategy, userId]
    );

    return result.rows[0];
  }

  // ── Routes ─────────────────────────────────────────────────────────────

  /**
   * GET /api/v1/deals/:dealId/capsule
   *
   * Returns the deal's capsule (auto-creates if first access), proforma,
   * and summary stats. This is the single endpoint the capsule detail page
   * should call instead of /api/v1/capsules/:capsuleId.
   *
   * Response:
   *   { capsule, proforma, summary }
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const { dealId } = req.params;
      const userId = (req as any).user?.userId || (req.query.user_id as string) || 'demo-user';

      if (!dealId) {
        return res.status(400).json({ error: 'dealId is required' });
      }

      // Auto-create capsule + proforma
      const capsule = await findOrCreateCapsule(dealId, userId);
      const proforma = await getOrInitProForma(dealId, userId);

      // Build summary
      const dealData = capsule.deal_data || {};
      const platformIntel = capsule.platform_intel || {};
      const userAdjusts = capsule.user_adjustments || {};

      const summary = {
        propertyAddress: capsule.property_address,
        assetClass: capsule.asset_class,
        status: capsule.status,
        jediScore: capsule.jedi_score || 0,
        // Layer 1: Broker deal data
        layer1: {
          askingPrice: dealData.asking_price || null,
          targetUnits: dealData.target_units || dealData.units || null,
          projectType: dealData.project_type || null,
          totalGFA: dealData.total_gfa || dealData.gfa || null,
          far: dealData.far || null,
          brokerClaims: dealData.broker_claims || {},
        },
        // Layer 2: Platform intel (from agents, KG, comps)
        layer2: {
          marketRent1BR: platformIntel.market_rent_1br || null,
          marketRent2BR: platformIntel.market_rent_2br || null,
          vacancyRate: platformIntel.vacancy_rate || proforma.vacancy_current,
          rentGrowth: platformIntel.rent_growth || proforma.rent_growth_current,
          exitCapRate: platformIntel.exit_cap_rate || proforma.exit_cap_current,
          replacementCost: platformIntel.replacement_cost || null,
          capRate: platformIntel.cap_rate || null,
          pricePerUnit: platformIntel.price_per_unit || null,
          sourceCount: platformIntel.source_count || 0,
          confidence: platformIntel.confidence || 0,
        },
        // Layer 3: User adjustments
        layer3: {
          ...userAdjusts,
        },
        // F-tab outputs (seeded into deal_data)
        ftab: {
          zoning: dealData.zoning || null,
          program: dealData.program || null,
          massing: dealData.massing || null,
        },
      };

      res.json({
        success: true,
        capsule,
        proforma,
        summary,
      });
    } catch (error: any) {
      console.error('Error getting deal capsule:', error);
      res.status(500).json({ error: error.message || 'Failed to get deal capsule' });
    }
  });

  /**
   * POST /api/v1/deals/:dealId/capsule/seed
   *
   * Seeds the capsule with F-tab output data. Call this after:
   *   - F2 zoning analysis complete → seeds zoning into deal_data
   *   - F3 program targets set → seeds program targets into deal_data
   *   - F7 massing generated → seeds massing + capital costs into deal_data
   *
   * Body:
   *   { source: 'zoning' | 'program' | 'massing' | 'research',
   *     data: { ... } }
   */
  router.post('/seed', async (req: Request, res: Response) => {
    try {
      const { dealId } = req.params;
      const { source, data, userId: reqUserId } = req.body;
      const userId = (req as any).user?.userId || reqUserId || 'demo-user';

      if (!source || !data) {
        return res.status(400).json({ error: 'source and data are required' });
      }

      const validSources = ['zoning', 'program', 'massing', 'research', 'design_targets', 'manual'];
      if (!validSources.includes(source)) {
        return res.status(400).json({ error: `Invalid source. Must be one of: ${validSources.join(', ')}` });
      }

      // Get or create capsule
      const capsule = await findOrCreateCapsule(dealId, userId);

      // Update deal_data with the seeded information
      const dealData = { ...capsule.deal_data };

      switch (source) {
        case 'zoning':
          dealData.zoning = {
            ...dealData.zoning,
            ...data,
            updated_at: new Date().toISOString(),
          };
          // Extract key metrics into the top level
          dealData.far = data.far || dealData.far || null;
          dealData.max_height = data.maxHeight || data.max_height || null;
          dealData.zoning_code = data.zoneCode || data.zoningCode || data.zoning_code || null;
          dealData.jurisdiction = data.jurisdiction || data.municipality || null;
          break;

        case 'program':
          dealData.program = {
            ...dealData.program,
            ...data,
            updated_at: new Date().toISOString(),
          };
          dealData.target_units = data.totalUnits || data.target_units || dealData.target_units || null;
          dealData.total_gfa = data.totalGFA || data.total_gfa || dealData.total_gfa || null;
          dealData.unit_mix = data.unitMix || data.units || data.unit_mix || null;
          // Also promote flat keys for capsule overview page
          dealData.units = data.totalUnits || data.target_units || dealData.units || null;
          break;

        case 'massing':
          dealData.massing = {
            ...dealData.massing,
            ...data,
            updated_at: new Date().toISOString(),
          };
          dealData.total_gfa = data.totalGFA || data.total_gfa || dealData.total_gfa || null;
          dealData.building_count = data.buildingCount || dealData.building_count || null;
          dealData.estimated_cost = data.estimatedCost || dealData.estimated_cost || null;

          // Also seed into proforma capital costs if available
          if (data.estimatedCost) {
            try {
              await pool.query(
                `UPDATE proforma_assumptions 
                 SET platform_construction_cost = $1,
                     platform_hard_cost = $2,
                     updated_at = NOW()
                 WHERE deal_id = $3`,
                [data.estimatedCost, data.estimatedCost * 0.7, dealId]
              );
            } catch (e) {
              // Non-critical: proforma columns might not exist
            }
          }
          break;

        case 'research':
          dealData.research = {
            ...dealData.research,
            ...data,
            updated_at: new Date().toISOString(),
          };
          break;

        case 'design_targets':
          dealData.design_targets = {
            ...dealData.design_targets,
            ...data,
            updated_at: new Date().toISOString(),
          };
          dealData.target_units = data.totalUnits || dealData.target_units || null;
          break;
      }

      // Persist updated deal_data
      await pool.query(
        `UPDATE deal_capsules SET deal_data = $1::jsonb, updated_at = NOW() WHERE id = $2`,
        [JSON.stringify(dealData), capsule.id]
      );

      // Log activity
      await pool.query(
        `INSERT INTO capsule_activity (capsule_id, user_id, activity_type, activity_data)
         VALUES ($1, $2, $3, $4)`,
        [capsule.id, userId, `${source}_seeded`, JSON.stringify({
          message: `Seeded capsule from ${source}`,
          keys: Object.keys(data),
        })]
      );

      res.json({
        success: true,
        message: `Capsule seeded from ${source}`,
        capsule_id: capsule.id,
        keys_seeded: Object.keys(data),
      });
    } catch (error: any) {
      console.error('Error seeding capsule:', error);
      res.status(500).json({ error: error.message || 'Failed to seed capsule' });
    }
  });

  /**
   * POST /api/v1/deals/:dealId/capsule/trigger
   *
   * One-shot: create/seed capsule + initialize proforma + fire the full
   * analysis pipeline (Research → Cashflow → Commentary).
   */
  router.post('/trigger', async (req: Request, res: Response) => {
    try {
      const { dealId } = req.params;
      const { seedData } = req.body;
      const userId = (req as any).user?.userId || 'demo-user';

      // 1. Create/modify capsule
      const capsule = await findOrCreateCapsule(dealId, userId);

      // 2. Apply any seed data provided
      if (seedData) {
        for (const [source, data] of Object.entries(seedData)) {
          if (data && typeof data === 'object') {
            const dealData = { ...capsule.deal_data };
            (dealData as any)[source] = {
              ...(dealData as any)[source],
              ...data,
              updated_at: new Date().toISOString(),
            };
            await pool.query(
              `UPDATE deal_capsules SET deal_data = $1::jsonb, updated_at = NOW() WHERE id = $2`,
              [JSON.stringify(dealData), capsule.id]
            );
          }
        }
      }

      // 3. Initialize proforma
      const proforma = await getOrInitProForma(dealId, userId);

      // 4. Update capsule status
      await pool.query(
        `UPDATE deal_capsules SET status = 'RESEARCH', updated_at = NOW() WHERE id = $1`,
        [capsule.id]
      );

      // 5. Fire the underwriting pipeline (async, don't await)
      const pipelineRunId = randomUUID();
      await pool.query(
        `INSERT INTO agent_runs (id, agent_id, agent_version, prompt_version, deal_id, user_id, triggered_by, status, input, started_at)
         VALUES ($1, 'pipeline', '1.0.0', 'pipeline-v1', $2, $3, 'capsule_bridge', 'running', '{"source":"capsule_trigger"}'::jsonb, NOW())`,
        [pipelineRunId, dealId, userId]
      );

      // Fire the pipeline asynchronously (don't await)
      (async () => {
        try {
          const result = await pool.query(
            `SELECT * FROM research_agents_run($1)`,
            [dealId]
          );
          await pool.query(
            `UPDATE agent_runs SET status = 'completed', completed_at = NOW(), output = $1::jsonb WHERE id = $2`,
            [JSON.stringify(result.rows), pipelineRunId]
          );

          // Update capsule with pipeline results
          await pool.query(
            `UPDATE deal_capsules SET status = 'ANALYZED', updated_at = NOW() WHERE deal_data->>'deal_id' = $1`,
            [dealId]
          );
        } catch (err: any) {
          console.error('Pipeline run failed:', err);
          await pool.query(
            `UPDATE agent_runs SET status = 'failed', error = $1, completed_at = NOW() WHERE id = $2`,
            [err.message || 'Unknown error', pipelineRunId]
          );
        }
      })();

      res.json({
        success: true,
        message: 'Capsule created, proforma initialized, pipeline triggered',
        capsule_id: capsule.id,
        pipeline_run_id: pipelineRunId,
        capsule,
        proforma,
      });
    } catch (error: any) {
      console.error('Error triggering capsule pipeline:', error);
      res.status(500).json({ error: error.message || 'Failed to trigger capsule pipeline' });
    }
  });

  /**
   * POST /api/v1/deals/:dealId/capsule/adjust
   *
   * Update user_adjustments (Layer 3) with new values. These are the
   * user's overrides that feed into the financial model.
   *
   * Body: { adjustments: { rent: number, vacancy: number, ... } }
   */
  router.post('/adjust', async (req: Request, res: Response) => {
    try {
      const { dealId } = req.params;
      const { adjustments } = req.body;
      const userId = (req as any).user?.userId || 'demo-user';

      if (!adjustments) {
        return res.status(400).json({ error: 'adjustments object is required' });
      }

      const capsule = await findOrCreateCapsule(dealId, userId);

      // Merge adjustments into existing user_adjustments
      const currentAdjusts = capsule.user_adjustments || {};
      const merged = { ...currentAdjusts, ...adjustments };

      await pool.query(
        `UPDATE deal_capsules SET user_adjustments = $1::jsonb, updated_at = NOW() WHERE id = $2`,
        [JSON.stringify(merged), capsule.id]
      );

      // If specific proforma fields were adjusted, sync them
      if (adjustments.rentGrowth != null) {
        await pool.query(
          `UPDATE proforma_assumptions SET user_rent_growth = $1, updated_at = NOW() WHERE deal_id = $2`,
          [adjustments.rentGrowth, dealId]
        );
      }
      if (adjustments.vacancy != null) {
        await pool.query(
          `UPDATE proforma_assumptions SET user_vacancy = $1, updated_at = NOW() WHERE deal_id = $2`,
          [adjustments.vacancy, dealId]
        );
      }
      if (adjustments.exitCap != null) {
        await pool.query(
          `UPDATE proforma_assumptions SET user_exit_cap = $1, updated_at = NOW() WHERE deal_id = $2`,
          [adjustments.exitCap, dealId]
        );
      }

      await pool.query(
        `INSERT INTO capsule_activity (capsule_id, user_id, activity_type, activity_data)
         VALUES ($1, $2, 'adjustment', $3)`,
        [capsule.id, userId, JSON.stringify({
          message: 'User adjustments applied',
          keys: Object.keys(adjustments),
        })]
      );

      res.json({
        success: true,
        message: 'Adjustments applied',
        adjustments: merged,
      });
    } catch (error: any) {
      console.error('Error adjusting capsule:', error);
      res.status(500).json({ error: error.message || 'Failed to adjust capsule' });
    }
  });

  return router;
}

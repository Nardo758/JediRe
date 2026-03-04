import { Router, Response } from 'express';
import { query, transaction } from '../../database/connection';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { logger } from '../../utils/logger';
import axios from 'axios';

const router = Router();

const requireAdmin = (req: AuthenticatedRequest, res: Response, next: any) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

interface IngestionJob {
  id: string;
  type: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: Date;
  completedAt?: Date;
  recordsProcessed: number;
  recordsTotal: number;
  errors: string[];
  logs: string[];
}

const activeJobs = new Map<string, IngestionJob>();
let jobCounter = 0;

function createJob(type: string): IngestionJob {
  const id = `job_${++jobCounter}_${Date.now()}`;
  const job: IngestionJob = {
    id,
    type,
    status: 'pending',
    startedAt: new Date(),
    recordsProcessed: 0,
    recordsTotal: 0,
    errors: [],
    logs: [],
  };
  activeJobs.set(id, job);
  return job;
}

router.post('/ingest/zoning-districts', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const job = createJob('zoning-districts');
  job.status = 'running';
  job.logs.push('Starting zoning district ingestion...');

  res.json({ success: true, jobId: job.id, message: 'Zoning district ingestion started' });

  try {
    const munis = await query(`SELECT id, name, state, has_api, api_type, api_url FROM municipalities WHERE has_api = true ORDER BY state, name`);
    job.recordsTotal = munis.rows.length;
    job.logs.push(`Found ${munis.rows.length} municipalities with API access`);

    for (const muni of munis.rows) {
      try {
        const existing = await query(`SELECT COUNT(*) as cnt FROM zoning_districts WHERE municipality_id = $1`, [muni.id]);
        if (parseInt(existing.rows[0].cnt) > 0) {
          job.logs.push(`Skipping ${muni.name}, ${muni.state} — already has ${existing.rows[0].cnt} districts`);
          job.recordsProcessed++;
          continue;
        }
        job.logs.push(`Processing ${muni.name}, ${muni.state}...`);
        job.recordsProcessed++;
      } catch (err: any) {
        job.errors.push(`${muni.name}: ${err.message}`);
      }
    }

    job.status = 'completed';
    job.completedAt = new Date();
    job.logs.push(`Ingestion complete: ${job.recordsProcessed}/${job.recordsTotal} municipalities processed, ${job.errors.length} errors`);
  } catch (err: any) {
    job.status = 'failed';
    job.completedAt = new Date();
    job.errors.push(err.message);
    logger.error('Zoning district ingestion failed', err);
  }
});

router.post('/ingest/atlanta-benchmarks', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const job = createJob('atlanta-benchmarks');
  job.status = 'running';
  job.logs.push('Starting Atlanta benchmark ingestion...');

  res.json({ success: true, jobId: job.id, message: 'Atlanta benchmark ingestion started' });

  try {
    const existing = await query(`SELECT COUNT(*) as cnt FROM benchmark_projects WHERE LOWER(state) IN ('ga', 'georgia')`);
    job.logs.push(`Existing Atlanta-area benchmarks: ${existing.rows[0].cnt}`);

    const deals = await query(`
      SELECT d.id, d.name, d.address, d.city, d.state,
        ds.max_units, ds.max_gba, ds.max_stories, ds.entitlement_type,
        ds.total_entitlement_days, ds.parking_required
      FROM deals d
      LEFT JOIN development_scenarios ds ON ds.deal_id = d.id AND ds.is_active = true
      WHERE LOWER(d.city) = 'atlanta' OR LOWER(d.state) IN ('ga', 'georgia')
    `);
    job.recordsTotal = deals.rows.length;
    job.logs.push(`Found ${deals.rows.length} Atlanta-area deals to process as benchmarks`);

    for (const deal of deals.rows) {
      try {
        if (!deal.max_units && !deal.max_gba) {
          job.logs.push(`Skipping ${deal.name} — no scenario data`);
          job.recordsProcessed++;
          continue;
        }

        const dupCheck = await query(
          `SELECT id FROM benchmark_projects WHERE project_name = $1 AND LOWER(state) IN ('ga', 'georgia') LIMIT 1`,
          [deal.name]
        );
        if (dupCheck.rows.length > 0) {
          job.logs.push(`Skipping ${deal.name} — already exists`);
          job.recordsProcessed++;
          continue;
        }

        await query(`
          INSERT INTO benchmark_projects (county, state, project_name, project_type, unit_count, stories, entitlement_type, total_entitlement_days, confidence)
          VALUES ($1, $2, $3, 'multifamily', $4, $5, $6, $7, 0.7)
          ON CONFLICT DO NOTHING
        `, ['Fulton', 'GA', deal.name, deal.max_units || 0, deal.max_stories || 0, deal.entitlement_type || 'by_right', deal.total_entitlement_days || 0]);

        job.logs.push(`Added benchmark: ${deal.name}`);
        job.recordsProcessed++;
      } catch (err: any) {
        job.errors.push(`${deal.name}: ${err.message}`);
      }
    }

    job.status = 'completed';
    job.completedAt = new Date();
    job.logs.push(`Atlanta benchmark ingestion complete: ${job.recordsProcessed} processed, ${job.errors.length} errors`);
  } catch (err: any) {
    job.status = 'failed';
    job.completedAt = new Date();
    job.errors.push(err.message);
    logger.error('Atlanta benchmark ingestion failed', err);
  }
});

router.post('/ingest/florida-benchmarks', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const job = createJob('florida-benchmarks');
  job.status = 'running';
  job.logs.push('Starting Florida benchmark ingestion...');

  res.json({ success: true, jobId: job.id, message: 'Florida benchmark ingestion started' });

  try {
    const existing = await query(`SELECT COUNT(*) as cnt FROM benchmark_projects WHERE LOWER(state) IN ('fl', 'florida')`);
    job.logs.push(`Existing Florida benchmarks: ${existing.rows[0].cnt}`);

    const deals = await query(`
      SELECT d.id, d.name, d.address, d.city, d.state,
        ds.max_units, ds.max_gba, ds.max_stories, ds.entitlement_type,
        ds.total_entitlement_days, ds.parking_required
      FROM deals d
      LEFT JOIN development_scenarios ds ON ds.deal_id = d.id AND ds.is_active = true
      WHERE LOWER(d.state) IN ('fl', 'florida')
    `);
    job.recordsTotal = deals.rows.length;
    job.logs.push(`Found ${deals.rows.length} Florida deals to process as benchmarks`);

    for (const deal of deals.rows) {
      try {
        if (!deal.max_units && !deal.max_gba) {
          job.logs.push(`Skipping ${deal.name} — no scenario data`);
          job.recordsProcessed++;
          continue;
        }

        const dupCheck = await query(
          `SELECT id FROM benchmark_projects WHERE project_name = $1 AND LOWER(state) IN ('fl', 'florida') LIMIT 1`,
          [deal.name]
        );
        if (dupCheck.rows.length > 0) {
          job.logs.push(`Skipping ${deal.name} — already exists`);
          job.recordsProcessed++;
          continue;
        }

        await query(`
          INSERT INTO benchmark_projects (county, state, project_name, project_type, unit_count, stories, entitlement_type, total_entitlement_days, confidence)
          VALUES ($1, $2, $3, 'multifamily', $4, $5, $6, $7, 0.7)
          ON CONFLICT DO NOTHING
        `, [deal.city || 'Unknown', 'FL', deal.name, deal.max_units || 0, deal.max_stories || 0, deal.entitlement_type || 'by_right', deal.total_entitlement_days || 0]);

        job.logs.push(`Added benchmark: ${deal.name}`);
        job.recordsProcessed++;
      } catch (err: any) {
        job.errors.push(`${deal.name}: ${err.message}`);
      }
    }

    job.status = 'completed';
    job.completedAt = new Date();
    job.logs.push(`Florida benchmark ingestion complete: ${job.recordsProcessed} processed, ${job.errors.length} errors`);
  } catch (err: any) {
    job.status = 'failed';
    job.completedAt = new Date();
    job.errors.push(err.message);
    logger.error('Florida benchmark ingestion failed', err);
  }
});

router.post('/ingest/map-properties-to-zoning', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const job = createJob('map-properties-to-zoning');
  job.status = 'running';
  job.logs.push('Starting property-to-zoning mapping...');

  res.json({ success: true, jobId: job.id, message: 'Property-to-zoning mapping started' });

  try {
    const unmapped = await query(`
      SELECT p.id, p.address_line1, p.city, p.state_code, p.lat, p.lng
      FROM properties p
      LEFT JOIN property_zoning_cache pzc ON pzc.property_id = p.id::text
      WHERE pzc.property_id IS NULL
      LIMIT 500
    `);
    job.recordsTotal = unmapped.rows.length;
    job.logs.push(`Found ${unmapped.rows.length} unmapped properties`);

    for (const prop of unmapped.rows) {
      try {
        if (!prop.city || !prop.state_code) {
          job.logs.push(`Skipping property ${prop.id} — missing city/state`);
          job.recordsProcessed++;
          continue;
        }

        const districts = await query(`
          SELECT zoning_code FROM zoning_districts
          WHERE LOWER(municipality) = LOWER($1) OR LOWER(municipality_id) LIKE '%' || LOWER($1) || '%'
          LIMIT 1
        `, [prop.city]);

        if (districts.rows.length > 0) {
          await query(`
            INSERT INTO property_zoning_cache (property_id, zoning_code, source, cached_at)
            VALUES ($1, $2, 'admin_batch', NOW())
            ON CONFLICT (property_id) DO UPDATE SET zoning_code = $2, cached_at = NOW()
          `, [prop.id, districts.rows[0].zoning_code]);
          job.logs.push(`Mapped ${prop.address_line1 || prop.id} → ${districts.rows[0].zoning_code}`);
        }
        job.recordsProcessed++;
      } catch (err: any) {
        job.errors.push(`Property ${prop.id}: ${err.message}`);
      }
    }

    job.status = 'completed';
    job.completedAt = new Date();
    job.logs.push(`Mapping complete: ${job.recordsProcessed}/${job.recordsTotal} processed, ${job.errors.length} errors`);
  } catch (err: any) {
    job.status = 'failed';
    job.completedAt = new Date();
    job.errors.push(err.message);
    logger.error('Property-to-zoning mapping failed', err);
  }
});

router.get('/ingest/status', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const jobs = Array.from(activeJobs.values())
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
    .slice(0, 20);

  res.json({
    success: true,
    activeCount: jobs.filter(j => j.status === 'running').length,
    jobs: jobs.map(j => ({
      id: j.id,
      type: j.type,
      status: j.status,
      startedAt: j.startedAt,
      completedAt: j.completedAt,
      progress: j.recordsTotal > 0 ? `${j.recordsProcessed}/${j.recordsTotal}` : '0/0',
      errorCount: j.errors.length,
    })),
  });
});

router.get('/system/health', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const dbHealth = await query(`
      SELECT
        (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_connections,
        (SELECT count(*) FROM pg_stat_activity) as total_connections,
        (SELECT pg_size_pretty(pg_database_size(current_database()))) as database_size,
        (SELECT NOW() - pg_postmaster_start_time()) as uptime
    `);

    const tableSizes = await query(`
      SELECT relname as table_name,
        pg_size_pretty(pg_total_relation_size(relid)) as total_size,
        n_live_tup as row_count
      FROM pg_stat_user_tables
      ORDER BY pg_total_relation_size(relid) DESC
      LIMIT 20
    `);

    res.json({
      success: true,
      database: {
        status: 'connected',
        ...dbHealth.rows[0],
      },
      topTables: tableSizes.rows,
      server: {
        nodeVersion: process.version,
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime(),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message, database: { status: 'disconnected' } });
  }
});

router.get('/system/stats', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const stats = await query(`
      SELECT
        (SELECT count(*) FROM users) as user_count,
        (SELECT count(*) FROM deals) as deal_count,
        (SELECT count(*) FROM properties) as property_count,
        (SELECT count(*) FROM development_scenarios) as scenario_count,
        (SELECT count(*) FROM zoning_districts) as zoning_district_count,
        (SELECT count(*) FROM benchmark_projects) as benchmark_count,
        (SELECT count(*) FROM municipalities) as municipality_count,
        (SELECT count(*) FROM trade_areas) as trade_area_count,
        (SELECT count(*) FROM deal_financial_models) as financial_model_count,
        (SELECT count(*) FROM strategy_analyses) as strategy_count
    `);

    const recentDeals = await query(`
      SELECT count(*) as last_7_days FROM deals WHERE created_at > NOW() - INTERVAL '7 days'
    `);

    const recentUsers = await query(`
      SELECT count(*) as last_7_days FROM users WHERE created_at > NOW() - INTERVAL '7 days'
    `);

    const scenariosByType = await query(`
      SELECT entitlement_type, count(*) as cnt, count(*) FILTER (WHERE is_active = true) as active
      FROM development_scenarios
      GROUP BY entitlement_type
      ORDER BY cnt DESC
    `);

    res.json({
      success: true,
      totals: stats.rows[0],
      recent: {
        deals_last_7_days: recentDeals.rows[0].last_7_days,
        users_last_7_days: recentUsers.rows[0].last_7_days,
      },
      scenarios_by_type: scenariosByType.rows,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/system/logs', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;

    let recentErrors: any[] = [];
    try {
      const errResult = await query(`SELECT * FROM error_logs ORDER BY created_at DESC LIMIT $1`, [limit]);
      recentErrors = errResult.rows;
    } catch {
      recentErrors = [{ note: 'error_logs table not available' }];
    }

    let recentActivity: any[] = [];
    try {
      const actResult = await query(`
        SELECT id, deal_id, action, created_at FROM deal_activity ORDER BY created_at DESC LIMIT $1
      `, [limit]);
      recentActivity = actResult.rows;
    } catch {
      recentActivity = [{ note: 'deal_activity table not available' }];
    }

    res.json({
      success: true,
      errors: recentErrors,
      activity: recentActivity,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/data/municipalities', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query(`
      SELECT m.id, m.name, m.state, m.has_api, m.api_type, m.api_url,
        m.total_zoning_districts, m.data_quality, m.last_scraped_at,
        (SELECT count(*) FROM zoning_districts zd WHERE zd.municipality_id = m.id) as actual_districts
      FROM municipalities m
      ORDER BY m.state, m.name
    `);
    res.json({ success: true, count: result.rows.length, municipalities: result.rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/data/zoning-coverage', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const total = await query(`SELECT count(*) as cnt FROM properties`);
    const withZoning = await query(`SELECT count(*) as cnt FROM property_zoning_cache`);
    const totalCount = parseInt(total.rows[0].cnt);
    const zonedCount = parseInt(withZoning.rows[0].cnt);

    const byState = await query(`
      SELECT state, count(*) as total_districts, count(DISTINCT municipality) as municipalities
      FROM zoning_districts
      GROUP BY state
      ORDER BY total_districts DESC
    `);

    res.json({
      success: true,
      coverage: {
        total_properties: totalCount,
        properties_with_zoning: zonedCount,
        coverage_pct: totalCount > 0 ? Math.round((zonedCount / totalCount) * 10000) / 100 : 0,
      },
      by_state: byState.rows,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/data/benchmark-stats', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const total = await query(`SELECT count(*) as cnt FROM benchmark_projects`);

    const byState = await query(`
      SELECT state, count(*) as cnt FROM benchmark_projects GROUP BY state ORDER BY cnt DESC
    `);

    const byType = await query(`
      SELECT project_type, count(*) as cnt FROM benchmark_projects GROUP BY project_type ORDER BY cnt DESC
    `);

    const byEntitlement = await query(`
      SELECT entitlement_type, count(*) as cnt, 
        AVG(total_entitlement_days) as avg_days,
        AVG(unit_count) as avg_units
      FROM benchmark_projects
      GROUP BY entitlement_type
      ORDER BY cnt DESC
    `);

    res.json({
      success: true,
      total: parseInt(total.rows[0].cnt),
      by_state: byState.rows,
      by_type: byType.rows,
      by_entitlement: byEntitlement.rows,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/data/refresh-cache', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const cleared: Record<string, number> = {};

    const r1 = await query(`DELETE FROM zoning_code_interpretations WHERE cached_at < NOW() - INTERVAL '7 days'`);
    cleared['zoning_code_interpretations'] = r1.rowCount || 0;

    const r2 = await query(`DELETE FROM zoning_ai_analysis_cache WHERE created_at < NOW() - INTERVAL '7 days'`);
    cleared['zoning_ai_analysis_cache'] = r2.rowCount || 0;

    let r3count = 0;
    try {
      const r3 = await query(`DELETE FROM confirmation_chain_results WHERE created_at < NOW() - INTERVAL '30 days'`);
      r3count = r3.rowCount || 0;
    } catch {}
    cleared['confirmation_chain_results'] = r3count;

    res.json({ success: true, message: 'Cache refreshed', cleared });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/users', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = (page - 1) * limit;
    const search = req.query.search as string;

    let whereClause = '';
    const params: any[] = [];

    if (search) {
      params.push(`%${search}%`);
      whereClause = `WHERE email ILIKE $1 OR first_name ILIKE $1 OR last_name ILIKE $1`;
    }

    const countResult = await query(`SELECT count(*) as cnt FROM users ${whereClause}`, params);
    const total = parseInt(countResult.rows[0].cnt);

    const usersResult = await query(`
      SELECT id, email, first_name, last_name, role, is_active, last_login_at, created_at,
        (SELECT count(*) FROM deals WHERE user_id = users.id) as deal_count
      FROM users ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, [...params, limit, offset]);

    res.json({
      success: true,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      users: usersResult.rows,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/users/:id', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userResult = await query(`
      SELECT id, email, first_name, last_name, role, is_active, last_login_at, created_at
      FROM users WHERE id = $1
    `, [req.params.id]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const dealCount = await query(`SELECT count(*) as cnt FROM deals WHERE user_id = $1`, [req.params.id]);

    let recentActivity: any[] = [];
    try {
      const actResult = await query(`
        SELECT action, deal_id, created_at FROM deal_activity
        WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20
      `, [req.params.id]);
      recentActivity = actResult.rows;
    } catch {}

    res.json({
      success: true,
      user: userResult.rows[0],
      deal_count: parseInt(dealCount.rows[0].cnt),
      recent_activity: recentActivity,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/users/:id/suspend', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userResult = await query(`SELECT id, is_active FROM users WHERE id = $1`, [req.params.id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const newStatus = !userResult.rows[0].is_active;
    await query(`UPDATE users SET is_active = $1 WHERE id = $2`, [newStatus, req.params.id]);

    logger.info(`Admin action: User ${req.params.id} ${newStatus ? 'reactivated' : 'suspended'} by ${(req.user as any)?.userId}`);
    res.json({
      success: true,
      message: newStatus ? 'User reactivated' : 'User suspended',
      is_active: newStatus,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/users/:id', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userResult = await query(`SELECT id, email FROM users WHERE id = $1`, [req.params.id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    if (req.params.id === (req.user as any)?.userId) {
      return res.status(400).json({ success: false, error: 'Cannot delete your own account' });
    }

    await transaction(async (client) => {
      await client.query(`DELETE FROM refresh_tokens WHERE user_id = $1`, [req.params.id]);
      await client.query(`DELETE FROM users WHERE id = $1`, [req.params.id]);
    });

    logger.info(`Admin action: User ${userResult.rows[0].email} deleted by ${(req.user as any)?.userId}`);
    res.json({ success: true, message: `User ${userResult.rows[0].email} deleted` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/deals', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = (page - 1) * limit;
    const status = req.query.status as string;
    const userId = req.query.userId as string;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (status) {
      params.push(status);
      whereClause += ` AND d.status = $${params.length}`;
    }
    if (userId) {
      params.push(userId);
      whereClause += ` AND d.user_id = $${params.length}`;
    }

    const countResult = await query(`SELECT count(*) as cnt FROM deals d ${whereClause}`, params);
    const total = parseInt(countResult.rows[0].cnt);

    const dealsResult = await query(`
      SELECT d.id, d.name, d.address, d.city, d.state, d.status, d.user_id, d.created_at, d.updated_at,
        u.email as user_email,
        (SELECT count(*) FROM development_scenarios WHERE deal_id = d.id) as scenario_count,
        (SELECT count(*) FROM development_scenarios WHERE deal_id = d.id AND is_active = true) as active_scenarios
      FROM deals d
      LEFT JOIN users u ON u.id = d.user_id
      ${whereClause}
      ORDER BY d.updated_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, [...params, limit, offset]);

    res.json({
      success: true,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      deals: dealsResult.rows,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/deals/:id/audit', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const deal = await query(`SELECT id, name, address, city, state, created_at, updated_at FROM deals WHERE id = $1`, [req.params.id]);
    if (deal.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }

    const scenarios = await query(`
      SELECT id, name, entitlement_type, is_active, max_units, max_gba, max_stories, created_at, updated_at
      FROM development_scenarios WHERE deal_id = $1 ORDER BY updated_at DESC
    `, [req.params.id]);

    let stateHistory: any[] = [];
    try {
      const stateResult = await query(`
        SELECT version, created_at FROM deals_state WHERE deal_id = $1 ORDER BY version DESC LIMIT 20
      `, [req.params.id]);
      stateHistory = stateResult.rows;
    } catch {}

    let activity: any[] = [];
    try {
      const actResult = await query(`
        SELECT action, created_at FROM deal_activity WHERE deal_id = $1 ORDER BY created_at DESC LIMIT 50
      `, [req.params.id]);
      activity = actResult.rows;
    } catch {}

    res.json({
      success: true,
      deal: deal.rows[0],
      scenarios: scenarios.rows,
      state_history: stateHistory,
      activity,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/deals/:id/fix', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const deal = await query(`SELECT id, name FROM deals WHERE id = $1`, [req.params.id]);
    if (deal.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }

    const fixes: string[] = [];

    const orphanedScenarios = await query(`
      DELETE FROM development_scenarios WHERE deal_id = $1 AND name IS NULL AND max_units IS NULL AND max_gba IS NULL
      RETURNING id
    `, [req.params.id]);
    if ((orphanedScenarios.rowCount || 0) > 0) {
      fixes.push(`Removed ${orphanedScenarios.rowCount} empty scenarios`);
    }

    const multiActive = await query(`
      SELECT count(*) as cnt FROM development_scenarios WHERE deal_id = $1 AND is_active = true
    `, [req.params.id]);
    if (parseInt(multiActive.rows[0].cnt) > 1) {
      await query(`
        UPDATE development_scenarios SET is_active = false
        WHERE deal_id = $1 AND is_active = true
        AND id NOT IN (SELECT id FROM development_scenarios WHERE deal_id = $1 AND is_active = true ORDER BY updated_at DESC LIMIT 1)
      `, [req.params.id]);
      fixes.push(`Fixed multiple active scenarios — kept most recent`);
    }

    res.json({ success: true, deal: deal.rows[0].name, fixes: fixes.length > 0 ? fixes : ['No issues found'] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/deals/:id/force', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const deal = await query(`SELECT id, name FROM deals WHERE id = $1`, [req.params.id]);
    if (deal.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }

    const dealId = req.params.id;
    const deleted: Record<string, number> = {};

    const tables = [
      'development_scenarios', 'deal_activity', 'deal_notes', 'deal_documents',
      'deal_contacts', 'deal_alerts', 'deal_risks', 'deal_key_dates',
      'deal_financial_models', 'deal_designs', 'deal_pipeline',
      'deal_comp_sets', 'deal_comparable_properties', 'deal_shares',
      'deal_emails', 'deal_annotations', 'deal_decisions',
      'deal_notifications', 'deal_monthly_actuals', 'deal_rate_sheets',
      'deal_capsules', 'deal_modules', 'deal_properties',
      'deals_state', 'property_boundaries',
    ];

    await transaction(async (client) => {
      for (const table of tables) {
        try {
          const r = await client.query(`DELETE FROM ${table} WHERE deal_id = $1`, [dealId]);
          if ((r.rowCount || 0) > 0) deleted[table] = r.rowCount || 0;
        } catch {}
      }

      await client.query(`DELETE FROM deals WHERE id = $1`, [dealId]);
      deleted['deals'] = 1;
    });

    logger.info(`Admin action: Deal "${deal.rows[0].name}" (${dealId}) force deleted by ${(req.user as any)?.userId}`, { deleted });
    res.json({ success: true, message: `Deal "${deal.rows[0].name}" force deleted`, deleted });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/quality/missing-zoning', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;

    const result = await query(`
      SELECT d.id, d.name, d.address, d.city, d.state
      FROM deals d
      LEFT JOIN (
        SELECT DISTINCT deal_id FROM development_scenarios
      ) ds ON ds.deal_id = d.id
      WHERE ds.deal_id IS NULL
      ORDER BY d.created_at DESC
      LIMIT $1
    `, [limit]);

    const totalMissing = await query(`
      SELECT count(*) as cnt FROM deals d
      LEFT JOIN (SELECT DISTINCT deal_id FROM development_scenarios) ds ON ds.deal_id = d.id
      WHERE ds.deal_id IS NULL
    `);

    res.json({
      success: true,
      total_missing: parseInt(totalMissing.rows[0].cnt),
      deals: result.rows,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/quality/invalid-boundaries', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const noBoundary = await query(`
      SELECT d.id, d.name, d.address, d.city, d.state
      FROM deals d
      LEFT JOIN property_boundaries pb ON pb.deal_id = d.id
      WHERE pb.deal_id IS NULL
      ORDER BY d.created_at DESC
      LIMIT 50
    `);

    const totalMissing = await query(`
      SELECT count(*) as cnt FROM deals d
      LEFT JOIN property_boundaries pb ON pb.deal_id = d.id
      WHERE pb.deal_id IS NULL
    `);

    res.json({
      success: true,
      total_missing_boundaries: parseInt(totalMissing.rows[0].cnt),
      deals: noBoundary.rows,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/quality/orphaned-data', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orphanedScenarios = await query(`
      SELECT count(*) as cnt FROM development_scenarios ds
      LEFT JOIN deals d ON d.id = ds.deal_id
      WHERE d.id IS NULL
    `);

    const orphanedBoundaries = await query(`
      SELECT count(*) as cnt FROM property_boundaries pb
      LEFT JOIN deals d ON d.id = pb.deal_id
      WHERE d.id IS NULL
    `);

    let orphanedActivity = { rows: [{ cnt: '0' }] };
    try {
      orphanedActivity = await query(`
        SELECT count(*) as cnt FROM deal_activity da
        LEFT JOIN deals d ON d.id = da.deal_id
        WHERE d.id IS NULL
      `);
    } catch {}

    res.json({
      success: true,
      orphaned: {
        scenarios: parseInt(orphanedScenarios.rows[0].cnt),
        boundaries: parseInt(orphanedBoundaries.rows[0].cnt),
        activity: parseInt(orphanedActivity.rows[0].cnt),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/quality/auto-fix', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const fixes: Record<string, number> = {};

    const r1 = await query(`
      DELETE FROM development_scenarios WHERE deal_id NOT IN (SELECT id FROM deals)
    `);
    fixes['orphaned_scenarios_removed'] = r1.rowCount || 0;

    const r2 = await query(`
      DELETE FROM property_boundaries WHERE deal_id NOT IN (SELECT id FROM deals)
    `);
    fixes['orphaned_boundaries_removed'] = r2.rowCount || 0;

    try {
      const r3 = await query(`
        DELETE FROM deal_activity WHERE deal_id NOT IN (SELECT id FROM deals)
      `);
      fixes['orphaned_activity_removed'] = r3.rowCount || 0;
    } catch {}

    const r4 = await query(`
      DELETE FROM development_scenarios WHERE name IS NULL AND max_units IS NULL AND max_gba IS NULL AND max_stories IS NULL
    `);
    fixes['empty_scenarios_removed'] = r4.rowCount || 0;

    logger.info(`Admin action: Auto-fix executed by ${(req.user as any)?.userId}`, { fixes });
    res.json({ success: true, message: 'Auto-fix complete', fixes });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/integrations/apartment-locator-ai', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const baseUrl = process.env.APARTMENT_LOCATOR_API_URL || 'https://apartment-locator-ai-real.replit.app';
  const apiKey = process.env.APARTMENT_LOCATOR_API_KEY;

  try {
    const healthCheck = await axios.get(`${baseUrl}/api/health`, { timeout: 10000 }).catch(() => null);

    let marketData = null;
    if (apiKey) {
      try {
        const resp = await axios.get(`${baseUrl}/api/jedi/market-data`, {
          params: { city: 'Atlanta', state: 'GA' },
          headers: { Authorization: `Bearer ${apiKey}` },
          timeout: 15000,
        });
        marketData = resp.data;
      } catch {}
    }

    let localStats = null;
    try {
      const syncLog = await query(`SELECT * FROM apartment_api_sync_log ORDER BY created_at DESC LIMIT 5`);
      const propCount = await query(`SELECT count(*) as cnt FROM apartment_properties`);
      localStats = {
        local_properties: parseInt(propCount.rows[0].cnt),
        recent_syncs: syncLog.rows,
      };
    } catch {}

    res.json({
      success: true,
      connection: {
        url: baseUrl,
        api_key_configured: !!apiKey,
        health: healthCheck ? 'connected' : 'unreachable',
        health_response: healthCheck?.data || null,
      },
      sample_data: marketData,
      local_stats: localStats,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/integrations/apis', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const munis = await query(`
      SELECT name, state, has_api, api_type, api_url, total_zoning_districts, last_scraped_at
      FROM municipalities WHERE has_api = true
      ORDER BY state, name
    `);

    const apiTypes = await query(`
      SELECT api_type, count(*) as cnt FROM municipalities WHERE has_api = true GROUP BY api_type ORDER BY cnt DESC
    `);

    res.json({
      success: true,
      total_apis: munis.rows.length,
      by_type: apiTypes.rows,
      municipalities: munis.rows,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/integrations/test', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const results: Record<string, any> = {};

  try {
    await query(`SELECT 1`);
    results['database'] = { status: 'connected' };
  } catch (err: any) {
    results['database'] = { status: 'error', error: err.message };
  }

  const aptUrl = process.env.APARTMENT_LOCATOR_API_URL || 'https://apartment-locator-ai-real.replit.app';
  try {
    const resp = await axios.get(`${aptUrl}/api/health`, { timeout: 10000 });
    results['apartment_locator_ai'] = { status: 'connected', response: resp.data };
  } catch (err: any) {
    results['apartment_locator_ai'] = { status: 'unreachable', error: err.message };
  }

  try {
    const resp = await axios.get('https://api.census.gov/data.json', { timeout: 10000 });
    results['census_api'] = { status: 'connected' };
  } catch (err: any) {
    results['census_api'] = { status: 'unreachable', error: err.message };
  }

  res.json({ success: true, integrations: results });
});

router.get('/jobs', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const status = req.query.status as string;
  let jobs = Array.from(activeJobs.values());

  if (status) {
    jobs = jobs.filter(j => j.status === status);
  }

  jobs.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());

  res.json({
    success: true,
    total: jobs.length,
    running: jobs.filter(j => j.status === 'running').length,
    jobs: jobs.slice(0, 50).map(j => ({
      id: j.id,
      type: j.type,
      status: j.status,
      startedAt: j.startedAt,
      completedAt: j.completedAt,
      progress: `${j.recordsProcessed}/${j.recordsTotal}`,
      errorCount: j.errors.length,
    })),
  });
});

router.post('/jobs/:id/cancel', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const job = activeJobs.get(req.params.id);
  if (!job) {
    return res.status(404).json({ success: false, error: 'Job not found' });
  }

  if (job.status !== 'running') {
    return res.status(400).json({ success: false, error: `Job is ${job.status}, cannot cancel` });
  }

  job.status = 'cancelled';
  job.completedAt = new Date();
  job.logs.push('Cancelled by admin');

  res.json({ success: true, message: `Job ${job.id} cancelled` });
});

router.get('/jobs/:id/logs', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const job = activeJobs.get(req.params.id);
  if (!job) {
    return res.status(404).json({ success: false, error: 'Job not found' });
  }

  res.json({
    success: true,
    job: {
      id: job.id,
      type: job.type,
      status: job.status,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      progress: `${job.recordsProcessed}/${job.recordsTotal}`,
    },
    logs: job.logs,
    errors: job.errors,
  });
});

export default router;

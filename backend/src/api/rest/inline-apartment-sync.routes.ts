import { Router } from 'express';
import { getPool } from '../../database/connection';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { ApartmentDataSyncService } from '../../services/apartmentDataSync';
import { apartmentSyncScheduler, COVERED_METROS } from '../../services/apartment-sync-scheduler';
import { validate, apartmentSyncPullSchema } from './validation';

export function createApartmentSyncRoutes(apartmentSyncService: ApartmentDataSyncService) {
  const router = Router();
  const pool = getPool();

  router.post('/pull', requireAuth, validate(apartmentSyncPullSchema), async (req: AuthenticatedRequest, res) => {
    try {
      if (apartmentSyncScheduler.getStatus().syncInProgress) {
        return res.status(409).json({ success: false, error: 'Sync already in progress. Try again later.' });
      }
      const { city = 'Atlanta', state = 'GA' } = req.body;
      console.log(`Starting apartment data sync for ${city}, ${state}...`);
      const result = await apartmentSyncService.syncAll(city, state);
      res.json({ success: true, data: result });
    } catch (error: any) {
      console.error('Apartment sync error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/status', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const status = await apartmentSyncService.getSyncStatus();
      const scheduler = apartmentSyncScheduler.getStatus();
      res.json({ success: true, data: { ...status, scheduler } });
    } catch (error: any) {
      console.error('Sync status error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/properties', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { city, state, property_class, limit = '100' } = req.query;
      let query = 'SELECT * FROM apartment_properties WHERE 1=1';
      const params: any[] = [];
      let paramIdx = 1;
      if (city) { query += ` AND city ILIKE $${paramIdx}`; params.push(`%${city}%`); paramIdx++; }
      if (state) { query += ` AND state = $${paramIdx}`; params.push(state); paramIdx++; }
      if (property_class) { query += ` AND property_class = $${paramIdx}`; params.push(property_class); paramIdx++; }
      query += ` ORDER BY synced_at DESC LIMIT $${paramIdx}`;
      params.push(parseInt(limit as string));
      const result = await pool.query(query, params);
      res.json({ success: true, count: result.rows.length, data: result.rows });
    } catch (error: any) {
      console.error('Properties query error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/market-snapshots', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { city = 'Atlanta', state = 'GA' } = req.query;
      const result = await pool.query(
        'SELECT * FROM apartment_market_snapshots WHERE city = $1 AND state = $2 ORDER BY snapshot_date DESC LIMIT 30',
        [city, state]
      );
      res.json({ success: true, count: result.rows.length, data: result.rows });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/rent-comps', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { city = 'Atlanta', state = 'GA', unit_type } = req.query;
      let query = 'SELECT * FROM apartment_rent_comps WHERE city = $1 AND state = $2';
      const params: any[] = [city, state];
      if (unit_type) {
        query += ' AND unit_type = $3';
        params.push(unit_type);
      }
      query += ' ORDER BY rent DESC';
      const result = await pool.query(query, params);
      res.json({ success: true, count: result.rows.length, data: result.rows });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/supply-pipeline', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { city = 'Atlanta', state = 'GA' } = req.query;
      const result = await pool.query(
        'SELECT * FROM apartment_supply_pipeline WHERE city = $1 AND state = $2 ORDER BY available_date ASC',
        [city, state]
      );
      res.json({ success: true, count: result.rows.length, data: result.rows });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/trends', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { city = 'Atlanta' } = req.query;
      const result = await pool.query(
        'SELECT * FROM apartment_trends WHERE city = $1 ORDER BY snapshot_date DESC LIMIT 30',
        [city]
      );
      res.json({ success: true, count: result.rows.length, data: result.rows });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/submarkets', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { city = 'Atlanta' } = req.query;
      const result = await pool.query(
        'SELECT * FROM apartment_submarkets WHERE city = $1 ORDER BY snapshot_date DESC LIMIT 30',
        [city]
      );
      res.json({ success: true, count: result.rows.length, data: result.rows });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/user-analytics', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { type } = req.query;
      let query = 'SELECT * FROM apartment_user_analytics';
      const params: any[] = [];
      if (type) {
        query += ' WHERE analytics_type = $1';
        params.push(type);
      }
      query += ' ORDER BY snapshot_date DESC LIMIT 50';
      const result = await pool.query(query, params);
      res.json({ success: true, count: result.rows.length, data: result.rows });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/demand-signals', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const result = await pool.query(
        "SELECT * FROM apartment_user_analytics WHERE analytics_type = 'demand-signals' ORDER BY snapshot_date DESC LIMIT 1"
      );
      res.json({ success: true, data: result.rows[0] || null });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/zip-stats', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const coverage = apartmentSyncScheduler.getCoverage();
      const snapshotCounts = await pool.query(
        `SELECT city, state, COUNT(*) as snapshot_count, MAX(snapshot_date) as last_snapshot
         FROM apartment_market_snapshots
         GROUP BY city, state
         ORDER BY city`
      );

      const syncedMetros = new Map(
        snapshotCounts.rows.map((r: any) => [`${r.city}:${r.state}`, { snapshots: parseInt(r.snapshot_count), lastSnapshot: r.last_snapshot }])
      );

      const metroStats = coverage.metros.map(metro => {
        const syncInfo = syncedMetros.get(`${metro.city}:${metro.state}`);
        return {
          city: metro.city,
          state: metro.state,
          zipCodes: metro.zipCount,
          estimatedListings: metro.zipCount * 30,
          synced: !!syncInfo,
          snapshots: syncInfo?.snapshots || 0,
          lastSnapshot: syncInfo?.lastSnapshot || null,
        };
      });

      res.json({
        success: true,
        data: {
          scrapingModel: coverage.scrapingModel,
          schedule: coverage.schedule,
          estimatedCostPerRun: coverage.estimatedCostPerRun,
          totalMetros: coverage.metros.length,
          totalZipCodes: coverage.totalZipCodes,
          totalEstimatedListings: coverage.totalZipCodes * 30,
          syncedMetros: metroStats.filter(m => m.synced).length,
          unsyncedMetros: metroStats.filter(m => !m.synced).length,
          metros: metroStats,
        },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/zip-batch', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (apartmentSyncScheduler.getStatus().syncInProgress) {
        return res.status(409).json({ success: false, error: 'Sync already in progress. Try again later.' });
      }
      const { metros } = req.body;

      if (!metros || !Array.isArray(metros) || metros.length === 0) {
        return res.status(400).json({ success: false, error: 'metros array required, e.g. [{"city":"Atlanta","state":"GA"}]' });
      }

      const validMetros = metros.filter((m: any) =>
        m.city && m.state && COVERED_METROS.some(cm => cm.city === m.city && cm.state === m.state)
      );

      if (validMetros.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No valid metros provided. Available: ' + COVERED_METROS.map(m => `${m.city}, ${m.state}`).join('; '),
        });
      }

      const results: any[] = [];
      for (const metro of validMetros) {
        try {
          const result = await apartmentSyncService.syncAll(metro.city, metro.state);
          results.push({ city: metro.city, state: metro.state, success: true, errors: result.errors.length, duration: result.duration });
        } catch (error: any) {
          results.push({ city: metro.city, state: metro.state, success: false, error: error.message });
        }
      }

      res.json({
        success: true,
        data: {
          requested: metros.length,
          synced: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length,
          results,
        },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/sync-all-metros', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (apartmentSyncScheduler.getStatus().syncInProgress) {
        return res.status(409).json({ success: false, error: 'Sync already in progress' });
      }

      res.json({ success: true, message: `Starting sync across all ${COVERED_METROS.length} metros. This will take several minutes.` });

      apartmentSyncScheduler.syncNow().catch(err => {
        console.error('Background full sync failed:', err.message);
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}

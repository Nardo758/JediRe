import { Router } from 'express';
import { getPool } from '../../database/connection';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { ApartmentDataSyncService } from '../../services/apartmentDataSync';
import { validate, apartmentSyncPullSchema } from './validation';

export function createApartmentSyncRoutes(apartmentSyncService: ApartmentDataSyncService) {
  const router = Router();
  const pool = getPool();

  router.post('/pull', requireAuth, validate(apartmentSyncPullSchema), async (req: AuthenticatedRequest, res) => {
    try {
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
      res.json({ success: true, data: status });
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

  return router;
}

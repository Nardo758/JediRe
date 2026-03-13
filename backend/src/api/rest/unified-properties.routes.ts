import { Router } from 'express';
import { Pool } from 'pg';
import { requireAuth } from '../../middleware/auth';

export default function createUnifiedPropertiesRoutes(pool: Pool) {
  const router = Router();

  router.get('/unified', requireAuth, async (req, res) => {
    try {
      const city = (req.query.city as string) || (req.query.market as string);
      const search = req.query.search as string;
      const source = req.query.source as string;
      const sortBy = (req.query.sortBy as string) || 'unit_count';
      const sortDir = (req.query.sortDir as string) === 'asc' ? 'ASC' : 'DESC';
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 50));
      const offset = (page - 1) * limit;

      const allowedSorts: Record<string, string> = {
        unit_count: 'unit_count',
        year_built: 'year_built',
        assessed_value: 'assessed_value',
        name: 'name',
        city: 'city',
        jedi_score: 'jedi_score',
        google_rating: 'google_rating',
        last_updated: 'last_updated',
      };
      const sortColumn = allowedSorts[sortBy] || 'unit_count';

      const conditions: string[] = [];
      const params: any[] = [];
      let paramIdx = 1;

      if (city) {
        conditions.push(`city ILIKE $${paramIdx}`);
        params.push(city);
        paramIdx++;
      }

      if (search) {
        conditions.push(`(name ILIKE $${paramIdx} OR address ILIKE $${paramIdx} OR owner_name ILIKE $${paramIdx})`);
        params.push(`%${search}%`);
        paramIdx++;
      }

      if (source) {
        conditions.push(`$${paramIdx} = ANY(sources)`);
        params.push(source);
        paramIdx++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const countResult = await pool.query(
        `SELECT COUNT(*) as total FROM v_unified_properties ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].total);

      const dataParams = [...params, limit, offset];
      const result = await pool.query(
        `SELECT * FROM v_unified_properties
         ${whereClause}
         ORDER BY ${sortColumn} ${sortDir} NULLS LAST
         LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
        dataParams
      );

      res.json({
        properties: result.rows,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
    } catch (error) {
      console.error('Error fetching unified properties:', error);
      res.status(500).json({ error: 'Failed to fetch unified properties' });
    }
  });

  router.post('/unified/refresh', requireAuth, async (req, res) => {
    try {
      await pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY v_unified_properties');
      const countResult = await pool.query('SELECT COUNT(*) as total FROM v_unified_properties');
      res.json({
        success: true,
        message: 'Materialized view refreshed',
        totalRows: parseInt(countResult.rows[0].total),
        refreshedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error refreshing unified view:', error);
      res.status(500).json({ error: 'Failed to refresh materialized view' });
    }
  });

  return router;
}

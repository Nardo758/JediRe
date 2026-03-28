import { Router, Request, Response } from 'express';
import { Pool } from 'pg';

export function createDataLibraryAssetsRoutes(pool: Pool): Router {
  const router = Router();

  router.get('/', async (req: Request, res: Response) => {
    try {
      const {
        property_type, asset_class, city, state, msa_name, submarket_name,
        source_type, search, limit = '50', offset = '0',
        sort_by = 'created_at', sort_dir = 'desc',
      } = req.query as Record<string, string>;

      const conditions: string[] = [];
      const params: any[] = [];
      let idx = 1;

      if (property_type) { conditions.push(`property_type = $${idx++}`); params.push(property_type); }
      if (asset_class) { conditions.push(`asset_class = $${idx++}`); params.push(asset_class); }
      if (city) { conditions.push(`city ILIKE $${idx++}`); params.push(`%${city}%`); }
      if (state) { conditions.push(`state = $${idx++}`); params.push(state); }
      if (msa_name) { conditions.push(`msa_name ILIKE $${idx++}`); params.push(`%${msa_name}%`); }
      if (submarket_name) { conditions.push(`submarket_name ILIKE $${idx++}`); params.push(`%${submarket_name}%`); }
      if (source_type) { conditions.push(`source_type = $${idx++}`); params.push(source_type); }
      if (search) {
        conditions.push(`(property_name ILIKE $${idx} OR address ILIKE $${idx} OR city ILIKE $${idx})`);
        params.push(`%${search}%`);
        idx++;
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const allowedSorts = ['created_at', 'property_name', 'city', 'unit_count', 'avg_rent', 'cap_rate', 'sale_price', 'data_quality_score'];
      const sortCol = allowedSorts.includes(sort_by) ? sort_by : 'created_at';
      const dir = sort_dir === 'asc' ? 'ASC' : 'DESC';

      const countResult = await pool.query(`SELECT COUNT(*) FROM data_library_assets ${where}`, params);
      const total = parseInt(countResult.rows[0].count);

      params.push(parseInt(limit), parseInt(offset));
      const result = await pool.query(
        `SELECT * FROM data_library_assets ${where} ORDER BY ${sortCol} ${dir} LIMIT $${idx} OFFSET $${idx + 1}`,
        params
      );

      res.json({ assets: result.rows, total, limit: parseInt(limit), offset: parseInt(offset) });
    } catch (err: any) {
      console.error('Data library assets list error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/stats', async (_req: Request, res: Response) => {
    try {
      const result = await pool.query(`
        SELECT 
          COUNT(*) as total_assets,
          COUNT(DISTINCT city) as cities,
          COUNT(DISTINCT msa_name) as msas,
          COUNT(DISTINCT property_type) as property_types,
          COALESCE(SUM(unit_count), 0) as total_units,
          ROUND(AVG(data_quality_score)) as avg_quality,
          COUNT(*) FILTER (WHERE source_type = 'owned_deal') as owned,
          COUNT(*) FILTER (WHERE source_type = 'market_comp') as comps,
          COUNT(*) FILTER (WHERE source_type = 'broker_om') as broker,
          COUNT(*) FILTER (WHERE source_type = 'manual') as manual
        FROM data_library_assets
      `);
      res.json(result.rows[0]);
    } catch (err: any) {
      console.error('Data library assets stats error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const result = await pool.query('SELECT * FROM data_library_assets WHERE id = $1', [req.params.id]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Asset not found' });
      res.json(result.rows[0]);
    } catch (err: any) {
      console.error('Data library asset get error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/', async (req: Request, res: Response) => {
    try {
      const fields = [
        'deal_id', 'source_type', 'property_name', 'address', 'city', 'state', 'zip_code', 'county',
        'msa_id', 'msa_name', 'submarket_id', 'submarket_name', 'latitude', 'longitude',
        'property_type', 'property_subtype', 'year_built', 'year_renovated',
        'unit_count', 'net_rentable_sqft', 'avg_unit_sqft', 'lot_size_acres',
        'stories', 'density_units_per_acre', 'construction_type', 'parking_type', 'parking_ratio',
        'unit_mix', 'avg_bedrooms', 'asset_class', 'finish_level', 'amenities', 'amenity_score',
        'management_company', 'owner_operator', 'ownership_type',
        'avg_rent', 'avg_rent_psf', 'rent_by_unit_type', 'rent_as_of_date',
        'occupancy_rate', 'occupancy_as_of_date', 'noi', 'noi_per_unit', 'expense_ratio', 'noi_as_of_date',
        'sale_price', 'sale_date', 'price_per_unit', 'price_per_sqft', 'cap_rate', 'buyer', 'seller',
        'notes', 'tags',
      ];

      const present = fields.filter(f => req.body[f] !== undefined);
      const cols = present.join(', ');
      const vals = present.map((_, i) => `$${i + 1}`).join(', ');
      const params = present.map(f => {
        const v = req.body[f];
        if (typeof v === 'object' && !Array.isArray(v)) return JSON.stringify(v);
        return v;
      });

      const result = await pool.query(
        `INSERT INTO data_library_assets (${cols}) VALUES (${vals}) RETURNING *`,
        params
      );
      res.status(201).json(result.rows[0]);
    } catch (err: any) {
      console.error('Data library asset create error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      await pool.query('DELETE FROM data_library_assets WHERE id = $1', [req.params.id]);
      res.status(204).send();
    } catch (err: any) {
      console.error('Data library asset delete error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/populate-from-deal/:dealId', async (req: Request, res: Response) => {
    try {
      const result = await pool.query('SELECT populate_data_library_from_deal($1)', [req.params.dealId]);
      res.json({ success: true, asset_id: result.rows[0]?.populate_data_library_from_deal });
    } catch (err: any) {
      console.error('Populate from deal error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import multer from 'multer';
import { parseOM } from '../../services/document-extraction/parsers/om-parser';
import { logger } from '../../utils/logger';

const memUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

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

  router.get('/file-counts', async (_req: Request, res: Response) => {
    try {
      const result = await pool.query(`
        SELECT asset_id, COUNT(*)::int AS cnt
        FROM data_library_files
        WHERE asset_id IS NOT NULL
        GROUP BY asset_id
      `);
      const counts: Record<string, number> = {};
      for (const row of result.rows) {
        counts[row.asset_id as string] = row.cnt as number;
      }
      res.json({ counts });
    } catch (err: any) {
      console.error('Data library file-counts error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/rollup-stub', async (_req: Request, res: Response) => {
    try {
      const [ptResult, msaResult, unclResult] = await Promise.all([
        pool.query(`
          SELECT
            COALESCE(property_type, 'Unknown') AS product_type,
            COUNT(*)::int AS count,
            ROUND(AVG(unit_count))::int AS avg_units,
            ROUND(AVG(avg_rent))::int AS avg_rent
          FROM data_library_assets
          GROUP BY property_type
          ORDER BY count DESC
          LIMIT 20
        `),
        pool.query(`
          SELECT
            msa_name,
            COUNT(*)::int AS count,
            ROUND(AVG(unit_count))::int AS avg_units,
            ROUND(AVG(avg_rent))::int AS avg_rent
          FROM data_library_assets
          WHERE msa_name IS NOT NULL AND msa_name <> ''
          GROUP BY msa_name
          ORDER BY count DESC
          LIMIT 20
        `),
        pool.query(`
          SELECT COUNT(*)::int AS cnt
          FROM data_library_assets
          WHERE property_type IS NULL
        `),
      ]);
      res.json({
        product_type_groups: ptResult.rows,
        msa_groups: msaResult.rows,
        unclassified: unclResult.rows[0]?.cnt ?? 0,
      });
    } catch (err: any) {
      console.error('Data library rollup-stub error:', err);
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

  /**
   * GET /:id/files
   * List all files attached to a data-library asset.
   * Returns file name, size, mime type, upload date, and parse status.
   */
  router.get('/:id/files', async (req: Request, res: Response) => {
    try {
      const result = await pool.query(
        `SELECT
           df.id, df.file_name, df.file_size, df.mime_type, df.parsing_status, df.parsing_stage,
           df.uploaded_at, df.source_type
         FROM data_library_files df
         WHERE df.asset_id = $1
            OR (
              df.deal_id IS NOT NULL
              AND df.deal_id = (SELECT deal_id FROM data_library_assets WHERE id = $1)
            )
         ORDER BY df.uploaded_at DESC`,
        [req.params.id],
      );
      res.json({ files: result.rows });
    } catch (err: any) {
      console.error('Asset files list error:', err);
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
        'asking_price',
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

  router.patch('/:id', async (req: Request, res: Response) => {
    try {
      const updateableFields = [
        'property_name', 'address', 'city', 'state', 'zip_code', 'county',
        'msa_name', 'submarket_name', 'latitude', 'longitude',
        'property_type', 'property_subtype', 'year_built', 'year_renovated',
        'unit_count', 'net_rentable_sqft', 'avg_unit_sqft', 'lot_size_acres',
        'stories', 'density_units_per_acre', 'construction_type', 'parking_type', 'parking_ratio',
        'asset_class', 'finish_level', 'amenities', 'amenity_score', 'deal_type',
        'vintage_band', 'unit_count_band',
        'management_company', 'owner_operator', 'ownership_type',
        'avg_rent', 'avg_rent_psf', 'rent_as_of_date',
        'occupancy_rate', 'occupancy_as_of_date',
        'noi', 'noi_per_unit', 'expense_ratio', 'noi_as_of_date',
        'asking_price',
        'sale_price', 'sale_date', 'price_per_unit', 'price_per_sqft', 'cap_rate', 'buyer', 'seller',
        'notes', 'tags', 'data_quality_score',
      ];

      const updates: string[] = [];
      const params: any[] = [];
      let idx = 1;

      for (const field of updateableFields) {
        if (req.body[field] !== undefined) {
          updates.push(`${field} = $${idx++}`);
          params.push(req.body[field]);
        }
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      updates.push(`updated_at = NOW()`);
      params.push(req.params.id);

      const result = await pool.query(
        `UPDATE data_library_assets SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
        params
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Asset not found' });
      }

      res.json(result.rows[0]);
    } catch (err: any) {
      console.error('Data library asset update error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * POST /:id/parse-om
   * Upload a PDF OM, run OCR-backed extraction, and backfill any blank
   * fields on the data_library_assets row. Returns the extracted fields so
   * the frontend can pre-populate the edit form without a page reload.
   */
  router.post('/:id/parse-om', memUpload.single('file'), async (req: Request, res: Response) => {
    const { id } = req.params;
    const file = (req as Request & { file?: Express.Multer.File }).file;

    if (!file) {
      return res.status(400).json({ success: false, error: 'No file uploaded. Send PDF as multipart field "file".' });
    }
    if (!file.originalname.toLowerCase().endsWith('.pdf')) {
      return res.status(400).json({ success: false, error: 'Only PDF files are accepted.' });
    }

    logger.info('[data-library-assets/parse-om] Parsing OM PDF', {
      assetId: id,
      filename: file.originalname,
      sizeKb: Math.round(file.size / 1024),
    });

    try {
      const result = await parseOM(file.buffer, file.originalname);

      if (!result.success || !result.data) {
        return res.status(422).json({
          success: false,
          error: result.error ?? 'parseOM returned no data',
          usedOcr: result.meta?.usedOcr ?? false,
        });
      }

      const e = result.data;
      const prop = e.property;
      const meta = e.metadata;
      const pf   = e.brokerProforma;
      const mix  = e.unitMix ?? [];

      // Derive weighted avg in-place rent from unit mix (inPlaceRent × count / totalUnits)
      const mixWithRent = mix.filter(m => m.inPlaceRent != null && m.count != null);
      const totalMixUnits = mixWithRent.reduce((s, m) => s + (m.count ?? 0), 0);
      const weightedRent = totalMixUnits > 0
        ? mixWithRent.reduce((s, m) => s + (m.inPlaceRent ?? 0) * (m.count ?? 0), 0) / totalMixUnits
        : null;

      // Derive market-rate avg rent if no in-place rent available
      const mixWithMarket = mix.filter(m => m.marketRent != null && m.count != null);
      const totalMarketUnits = mixWithMarket.reduce((s, m) => s + (m.count ?? 0), 0);
      const weightedMarketRent = totalMarketUnits > 0
        ? mixWithMarket.reduce((s, m) => s + (m.marketRent ?? 0) * (m.count ?? 0), 0) / totalMarketUnits
        : null;

      const avgRent = weightedRent ?? weightedMarketRent;

      // Cap rate: prefer going-in cap, fall back to guidance cap from metadata
      const rawCapRate = pf?.goingInCapRate ?? meta?.guidanceCapRate ?? null;
      const capRateStored = rawCapRate != null
        ? (rawCapRate > 1 ? rawCapRate / 100 : rawCapRate) : null;

      // Occupancy: broker advertises (1 - stabilizedVacancy) as going-in occupancy
      const rawVacancy = pf?.stabilizedVacancy ?? null;
      const occStored = rawVacancy != null
        ? 1 - (rawVacancy > 1 ? rawVacancy / 100 : rawVacancy) : null;

      // NOI: prefer yearOneNOI, fall back to stabilizedNOI
      const noi = pf?.yearOneNOI ?? pf?.stabilizedNOI ?? null;

      // Property type mapping: OM uses 'garden'|'mid-rise'|'high-rise'|'townhome'
      // data_library_assets stores it verbatim in property_type
      const propertyType = prop?.propertyType ?? null;

      // Map OM extraction fields → data_library_assets columns.
      // COALESCE: only fills NULL columns — never overwrites user-entered data.
      const updates: string[] = [];
      const params: any[] = [];
      let idx = 1;

      const maybe = (col: string, val: unknown) => {
        if (val == null || val === '') return;
        updates.push(`${col} = COALESCE(${col}, $${idx++})`);
        params.push(val);
      };

      maybe('property_name', prop?.name);
      maybe('address', prop?.address);
      maybe('city', prop?.city);
      maybe('state', prop?.state);
      maybe('property_type', propertyType);
      maybe('unit_count', prop?.units != null ? Math.round(Number(prop.units)) : null);
      maybe('year_built', prop?.yearBuilt != null ? Math.round(Number(prop.yearBuilt)) : null);
      maybe('year_renovated', prop?.yearRenovated != null ? Math.round(Number(prop.yearRenovated)) : null);
      maybe('stories', prop?.stories != null ? Math.round(Number(prop.stories)) : null);
      maybe('avg_rent', avgRent != null ? Math.round(avgRent) : null);
      maybe('occupancy_rate', occStored);
      maybe('cap_rate', capRateStored);
      maybe('asking_price', meta?.askingPrice != null ? Number(meta.askingPrice) : null);
      maybe('noi', noi != null ? Math.round(Number(noi)) : null);
      maybe('gross_potential_rent', pf?.stabilizedGpr != null ? Math.round(Number(pf.stabilizedGpr)) : null);
      maybe('management_fee_pct', pf?.managementFeePct != null
        ? (Number(pf.managementFeePct) > 1 ? Number(pf.managementFeePct) / 100 : Number(pf.managementFeePct))
        : null);

      if (updates.length > 0) {
        updates.push(`data_type = COALESCE(data_type, 'om')`);
        updates.push(`updated_at = NOW()`);
        params.push(id);
        await pool.query(
          `UPDATE data_library_assets SET ${updates.join(', ')} WHERE id = $${idx}`,
          params,
        );
        logger.info('[data-library-assets/parse-om] Updated asset with OM fields', { assetId: id, fields: updates.length });
      }

      // Percent display helpers (stored as 0–1 fraction → displayed as 0–100)
      const toDisplayPct = (frac: number | null): string | null =>
        frac == null ? null : String(parseFloat((frac * 100).toFixed(4)).toString().replace(/\.?0+$/, ''));

      // Return extracted values as frontend-friendly field names
      return res.json({
        success: true,
        usedOcr: result.meta?.usedOcr ?? false,
        extracted: {
          propertyName: prop?.name ?? null,
          address:      prop?.address ?? null,
          city:         prop?.city ?? null,
          state:        prop?.state ?? null,
          units:        prop?.units != null ? String(Math.round(Number(prop.units))) : null,
          yearBuilt:    prop?.yearBuilt != null ? String(Math.round(Number(prop.yearBuilt))) : null,
          stories:      prop?.stories != null ? String(Math.round(Number(prop.stories))) : null,
          avgRent:      avgRent != null ? String(Math.round(avgRent)) : null,
          occupancyPct: toDisplayPct(occStored),
          capRate:      toDisplayPct(capRateStored),
          askingPrice:  meta?.askingPrice != null ? String(Math.round(Number(meta.askingPrice))) : null,
          noi:          noi != null ? String(Math.round(Number(noi))) : null,
          soldPrice:    null,
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('[data-library-assets/parse-om] Error', { assetId: id, error: msg });
      return res.status(500).json({ success: false, error: msg });
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

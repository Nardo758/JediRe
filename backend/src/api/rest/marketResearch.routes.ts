/**
 * Market Research Dashboard API Routes
 * Property records, active owners, and future supply
 */

import { Router } from 'express';
import { pool } from '../../database';
import { requireAuth } from '../../middleware/auth';

const router = Router();

// Apply auth middleware to all routes
router.use(requireAuth);

/**
 * GET /api/v1/market-research/properties
 * List all properties with filtering and sorting
 */
router.get('/properties', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      sortBy = 'address',
      sortOrder = 'asc',
      minUnits,
      maxUnits,
      minPricePerUnit,
      maxPricePerUnit,
      city,
      search
    } = req.query;

    const offset = (Number(page) - 1) * Number(limit);
    
    let whereConditions: string[] = ['property_type = $1'];
    let queryParams: any[] = ['Multifamily'];
    let paramCounter = 2;

    // Filters
    if (minUnits) {
      whereConditions.push(`units >= $${paramCounter}`);
      queryParams.push(Number(minUnits));
      paramCounter++;
    }
    
    if (maxUnits) {
      whereConditions.push(`units <= $${paramCounter}`);
      queryParams.push(Number(maxUnits));
      paramCounter++;
    }

    if (minPricePerUnit) {
      whereConditions.push(`(total_assessed_value / NULLIF(units, 0)) >= $${paramCounter}`);
      queryParams.push(Number(minPricePerUnit));
      paramCounter++;
    }

    if (maxPricePerUnit) {
      whereConditions.push(`(total_assessed_value / NULLIF(units, 0)) <= $${paramCounter}`);
      queryParams.push(Number(maxPricePerUnit));
      paramCounter++;
    }

    if (city) {
      whereConditions.push(`LOWER(city) = LOWER($${paramCounter})`);
      queryParams.push(city);
      paramCounter++;
    }

    if (search) {
      whereConditions.push(`(
        LOWER(address) LIKE LOWER($${paramCounter}) OR 
        LOWER(owner_name) LIKE LOWER($${paramCounter})
      )`);
      queryParams.push(`%${search}%`);
      paramCounter++;
    }

    const whereClause = whereConditions.join(' AND ');
    
    // Validate sort column
    const allowedSortColumns = ['address', 'units', 'owner_name', 'total_assessed_value', 'year_built', 'city'];
    const sortColumn = allowedSortColumns.includes(sortBy as string) ? sortBy : 'address';
    const order = sortOrder === 'desc' ? 'DESC' : 'ASC';

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM property_records
      WHERE ${whereClause}
    `;
    const countResult = await pool.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].total);

    // Get paginated data
    const dataQuery = `
      SELECT 
        id,
        address,
        city,
        units,
        owner_name,
        total_assessed_value,
        year_built,
        building_sqft,
        property_class,
        ROUND(total_assessed_value / NULLIF(units, 0), 0) as price_per_unit,
        ROUND(taxes_per_unit, 0) as taxes_per_unit,
        latitude,
        longitude,
        scraped_at
      FROM property_records
      WHERE ${whereClause}
      ORDER BY ${sortColumn} ${order}
      LIMIT $${paramCounter} OFFSET $${paramCounter + 1}
    `;
    
    queryParams.push(Number(limit), offset);
    const dataResult = await pool.query(dataQuery, queryParams);

    res.json({
      success: true,
      data: dataResult.rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit))
      }
    });

  } catch (error: any) {
    console.error('Get properties error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/market-research/properties/:id
 * Get single property details
 */
router.get('/properties/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT 
        pr.*,
        ROUND(pr.total_assessed_value / NULLIF(pr.units, 0), 0) as price_per_unit,
        (
          SELECT COUNT(*)
          FROM property_sales ps
          WHERE ps.property_record_id = pr.id
        ) as sales_count,
        (
          SELECT json_agg(json_build_object(
            'sale_date', ps.sale_date,
            'sale_price', ps.sale_price,
            'buyer_name', ps.buyer_name,
            'price_per_unit', ps.price_per_unit
          ) ORDER BY ps.sale_date DESC)
          FROM property_sales ps
          WHERE ps.property_record_id = pr.id
          LIMIT 5
        ) as recent_sales
      FROM property_records pr
      WHERE pr.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Property not found' });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error: any) {
    console.error('Get property error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/market-research/active-owners
 * Get owner transaction rankings
 */
router.get('/active-owners', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      startDate = '2018-01-01',
      endDate = '2022-12-31',
      minProperties = 1
    } = req.query;

    const offset = (Number(page) - 1) * Number(limit);

    // Get owner aggregations
    const query = `
      WITH owner_stats AS (
        SELECT 
          pr.owner_name,
          COUNT(DISTINCT pr.id) as properties_owned,
          SUM(pr.units) as total_units,
          AVG(pr.total_assessed_value / NULLIF(pr.units, 0)) as avg_price_per_unit,
          SUM(pr.total_assessed_value) as total_portfolio_value,
          COUNT(ps.id) as transaction_count,
          AVG(ps.price_per_unit) as avg_transaction_price_per_unit,
          MIN(ps.sale_date) as first_transaction,
          MAX(ps.sale_date) as last_transaction,
          pr.owner_city,
          pr.owner_state,
          BOOL_OR(pr.is_out_of_state) as has_out_of_state_ownership
        FROM property_records pr
        LEFT JOIN property_sales ps ON ps.buyer_name = pr.owner_name
          AND ps.sale_date BETWEEN $1 AND $2
        WHERE 
          pr.owner_name IS NOT NULL 
          AND pr.property_type = 'Multifamily'
          AND pr.units > 0
        GROUP BY pr.owner_name, pr.owner_city, pr.owner_state
        HAVING COUNT(DISTINCT pr.id) >= $3
      )
      SELECT 
        *,
        ROUND(avg_price_per_unit::numeric, 0) as avg_price_per_unit,
        ROUND(avg_transaction_price_per_unit::numeric, 0) as avg_transaction_price_per_unit,
        ROUND(total_portfolio_value::numeric, 0) as total_portfolio_value
      FROM owner_stats
      ORDER BY total_units DESC, properties_owned DESC
      LIMIT $4 OFFSET $5
    `;

    const result = await pool.query(query, [
      startDate,
      endDate,
      Number(minProperties),
      Number(limit),
      offset
    ]);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM (
        SELECT pr.owner_name
        FROM property_records pr
        WHERE 
          pr.owner_name IS NOT NULL 
          AND pr.property_type = 'Multifamily'
          AND pr.units > 0
        GROUP BY pr.owner_name
        HAVING COUNT(DISTINCT pr.id) >= $1
      ) subq
    `;
    const countResult = await pool.query(countQuery, [Number(minProperties)]);
    const total = parseInt(countResult.rows[0].total);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit))
      },
      filters: {
        startDate,
        endDate,
        minProperties
      }
    });

  } catch (error: any) {
    console.error('Get active owners error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/market-research/active-owners/:name
 * Get owner portfolio details
 */
router.get('/active-owners/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const decodedName = decodeURIComponent(name);

    // Get owner summary
    const summaryQuery = `
      SELECT 
        owner_name,
        COUNT(*) as properties_owned,
        SUM(units) as total_units,
        AVG(total_assessed_value / NULLIF(units, 0)) as avg_price_per_unit,
        SUM(total_assessed_value) as total_portfolio_value,
        owner_city,
        owner_state,
        owner_type,
        BOOL_OR(is_out_of_state) as has_out_of_state_ownership
      FROM property_records
      WHERE owner_name = $1 AND property_type = 'Multifamily'
      GROUP BY owner_name, owner_city, owner_state, owner_type
    `;
    const summaryResult = await pool.query(summaryQuery, [decodedName]);

    if (summaryResult.rows.length === 0) {
      return res.status(404).json({ error: 'Owner not found' });
    }

    // Get owner properties
    const propertiesQuery = `
      SELECT 
        id,
        address,
        city,
        units,
        total_assessed_value,
        year_built,
        property_class,
        ROUND(total_assessed_value / NULLIF(units, 0), 0) as price_per_unit,
        latitude,
        longitude
      FROM property_records
      WHERE owner_name = $1 AND property_type = 'Multifamily'
      ORDER BY units DESC
    `;
    const propertiesResult = await pool.query(propertiesQuery, [decodedName]);

    // Get transaction history
    const transactionsQuery = `
      SELECT 
        ps.sale_date,
        ps.sale_price,
        ps.buyer_name,
        ps.seller_name,
        ps.price_per_unit,
        pr.address,
        pr.city,
        pr.units
      FROM property_sales ps
      JOIN property_records pr ON ps.property_record_id = pr.id
      WHERE ps.buyer_name = $1 OR ps.seller_name = $1
      ORDER BY ps.sale_date DESC
      LIMIT 20
    `;
    const transactionsResult = await pool.query(transactionsQuery, [decodedName]);

    res.json({
      success: true,
      data: {
        summary: summaryResult.rows[0],
        properties: propertiesResult.rows,
        transactions: transactionsResult.rows
      }
    });

  } catch (error: any) {
    console.error('Get owner portfolio error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/market-research/future-supply
 * Get construction pipeline projects
 */
router.get('/future-supply', async (req, res) => {
  try {
    const {
      phase,
      minUnits,
      maxUnits,
      city
    } = req.query;

    let whereConditions: string[] = [];
    let queryParams: any[] = [];
    let paramCounter = 1;

    if (phase) {
      whereConditions.push(`phase = $${paramCounter}`);
      queryParams.push(phase);
      paramCounter++;
    }

    if (minUnits) {
      whereConditions.push(`projected_units >= $${paramCounter}`);
      queryParams.push(Number(minUnits));
      paramCounter++;
    }

    if (maxUnits) {
      whereConditions.push(`projected_units <= $${paramCounter}`);
      queryParams.push(Number(maxUnits));
      paramCounter++;
    }

    if (city) {
      whereConditions.push(`LOWER(location) LIKE LOWER($${paramCounter})`);
      queryParams.push(`%${city}%`);
      paramCounter++;
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}` 
      : '';

    // Get pipeline projects
    const projectsQuery = `
      SELECT 
        id,
        project_name,
        location,
        developer,
        projected_units,
        phase,
        estimated_completion_date,
        created_at,
        updated_at
      FROM supply_pipeline_projects
      ${whereClause}
      ORDER BY estimated_completion_date ASC NULLS LAST, projected_units DESC
    `;
    const projectsResult = await pool.query(projectsQuery, queryParams);

    // Get phase summary
    const summaryQuery = `
      SELECT 
        phase,
        COUNT(*) as project_count,
        SUM(projected_units) as total_units
      FROM supply_pipeline_projects
      GROUP BY phase
      ORDER BY 
        CASE phase
          WHEN 'Planning' THEN 1
          WHEN 'Permitted' THEN 2
          WHEN 'Construction' THEN 3
          WHEN 'Completion' THEN 4
          ELSE 5
        END
    `;
    const summaryResult = await pool.query(summaryQuery);

    // Get alerts related to supply
    const alertsQuery = `
      SELECT 
        id,
        title,
        description,
        alert_type,
        severity,
        created_at
      FROM alerts
      WHERE alert_type IN ('CONSTRUCTION', 'DEVELOPMENT', 'ZONING')
      ORDER BY created_at DESC
      LIMIT 10
    `;
    const alertsResult = await pool.query(alertsQuery);

    res.json({
      success: true,
      data: {
        projects: projectsResult.rows,
        phaseSummary: summaryResult.rows,
        relatedAlerts: alertsResult.rows
      }
    });

  } catch (error: any) {
    console.error('Get future supply error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/market-research/export
 * Export data in various formats
 */
router.get('/export', async (req, res) => {
  try {
    const { type = 'properties', format = 'csv' } = req.query;

    let query = '';
    let filename = '';

    if (type === 'properties') {
      query = `
        SELECT 
          address,
          city,
          units,
          owner_name,
          total_assessed_value,
          ROUND(total_assessed_value / NULLIF(units, 0), 0) as price_per_unit,
          year_built,
          property_class,
          building_sqft
        FROM property_records
        WHERE property_type = 'Multifamily' AND units > 0
        ORDER BY units DESC
      `;
      filename = 'market-research-properties';
    } else if (type === 'owners') {
      query = `
        SELECT 
          owner_name,
          COUNT(*) as properties_owned,
          SUM(units) as total_units,
          ROUND(AVG(total_assessed_value / NULLIF(units, 0)), 0) as avg_price_per_unit,
          owner_city,
          owner_state
        FROM property_records
        WHERE property_type = 'Multifamily' AND units > 0 AND owner_name IS NOT NULL
        GROUP BY owner_name, owner_city, owner_state
        ORDER BY total_units DESC
      `;
      filename = 'market-research-active-owners';
    }

    const result = await pool.query(query);

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
      return res.json(result.rows);
    }

    // CSV format
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No data to export' });
    }

    const headers = Object.keys(result.rows[0]);
    const csvRows = [
      headers.join(','),
      ...result.rows.map(row => 
        headers.map(header => {
          const value = row[header];
          // Escape commas and quotes
          if (value === null || value === undefined) return '';
          const stringValue = String(value);
          if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        }).join(',')
      )
    ];

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
    res.send(csvRows.join('\n'));

  } catch (error: any) {
    console.error('Export error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/market-research/stats
 * Get dashboard statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_properties,
        SUM(units) as total_units,
        AVG(total_assessed_value / NULLIF(units, 0)) as avg_price_per_unit,
        COUNT(DISTINCT owner_name) as unique_owners,
        COUNT(DISTINCT city) as cities_covered
      FROM property_records
      WHERE property_type = 'Multifamily' AND units > 0
    `;
    const statsResult = await pool.query(statsQuery);

    const salesStatsQuery = `
      SELECT 
        COUNT(*) as total_sales,
        AVG(price_per_unit) as avg_sale_price_per_unit
      FROM property_sales
      WHERE sale_date >= '2018-01-01'
    `;
    const salesStatsResult = await pool.query(salesStatsQuery);

    res.json({
      success: true,
      data: {
        ...statsResult.rows[0],
        ...salesStatsResult.rows[0]
      }
    });

  } catch (error: any) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

import { Router, Request, Response } from 'express';
import { query } from '../../database/connection';

const router = Router();

router.get('/', async (req: Request, res: Response, next) => {
  try {
    const municipalitiesResult = await query(`
      SELECT 
        name, state, has_api, api_type, api_url,
        total_zoning_districts, data_quality, 
        last_scraped_at,
        CASE 
          WHEN total_zoning_districts > 0 THEN 'has_data'
          WHEN has_api = true THEN 'api_available'
          ELSE 'no_api'
        END as coverage_status
      FROM municipalities 
      ORDER BY state, name
    `);

    const zoningStatsResult = await query(`
      SELECT 
        COUNT(*) as total_districts,
        COUNT(DISTINCT municipality || '|' || state) as municipalities_with_data,
        COUNT(DISTINCT state) as states_with_data,
        COUNT(*) FILTER (WHERE source = 'api') as api_sourced,
        COUNT(*) FILTER (WHERE source = 'ai_retrieved') as ai_sourced,
        COUNT(*) FILTER (WHERE source IS NULL OR source NOT IN ('api', 'ai_retrieved')) as manual_sourced
      FROM zoning_districts
    `);

    const propertyStatsResult = await query(`
      SELECT 
        COUNT(*) as total_properties,
        COUNT(DISTINCT city) as cities_covered,
        COUNT(DISTINCT state_code) as states_covered
      FROM properties
    `);

    const rentCompStatsResult = await query(`
      SELECT 
        COUNT(*) as total_comps,
        COUNT(DISTINCT market) as markets_covered
      FROM rent_comps
    `);

    const dealStatsResult = await query(`
      SELECT 
        COUNT(*) as total_deals,
        COUNT(*) FILTER (WHERE status = 'active' OR status = 'Active') as active_deals
      FROM deals
    `);

    let propertyTypes = { total_types: '0', enabled_types: '0', categories: '0' };
    try {
      const propertyTypesResult = await query(`
        SELECT 
          COUNT(*) as total_types,
          COUNT(*) FILTER (WHERE enabled = true) as enabled_types,
          COUNT(DISTINCT category) as categories
        FROM property_types
      `);
      propertyTypes = propertyTypesResult.rows[0] || propertyTypes;
    } catch (e) {}

    let dataLibrary = { total_files: '0' };
    try {
      const dataLibraryResult = await query(`
        SELECT COUNT(*) as total_files FROM data_library_files
      `);
      dataLibrary = dataLibraryResult.rows[0] || dataLibrary;
    } catch (e) {}

    const stateBreakdownResult = await query(`
      SELECT 
        m.state,
        COUNT(*) as total_municipalities,
        SUM(CASE WHEN m.total_zoning_districts > 0 THEN 1 ELSE 0 END) as with_data,
        SUM(CASE WHEN m.has_api = true THEN 1 ELSE 0 END) as with_api,
        SUM(m.total_zoning_districts) as total_districts
      FROM municipalities m
      GROUP BY m.state
      ORDER BY m.state
    `);

    const municipalities = municipalitiesResult.rows;
    const zoningStats = zoningStatsResult.rows[0];
    const propertyStats = propertyStatsResult.rows[0];
    const rentCompStats = rentCompStatsResult.rows[0];
    const dealStats = dealStatsResult.rows[0];
    const stateBreakdown = stateBreakdownResult.rows;

    const totalMunicipalities = municipalities.length;
    const withData = municipalities.filter((m: any) => m.coverage_status === 'has_data').length;
    const withApiOnly = municipalities.filter((m: any) => m.coverage_status === 'api_available').length;
    const noApi = municipalities.filter((m: any) => m.coverage_status === 'no_api').length;

    const completenessScore = Math.round(
      ((withData / Math.max(totalMunicipalities, 1)) * 40) +
      ((parseInt(zoningStats.total_districts) > 100 ? 1 : parseInt(zoningStats.total_districts) / 100) * 20) +
      ((parseInt(propertyStats.total_properties) > 0 ? 1 : 0) * 15) +
      ((parseInt(rentCompStats.total_comps) > 0 ? 1 : 0) * 10) +
      ((parseInt(dataLibrary.total_files) > 0 ? 1 : 0) * 10) +
      ((parseInt(dealStats.total_deals) > 0 ? 1 : 0) * 5)
    );

    res.json({
      completenessScore,
      summary: {
        municipalities: {
          total: totalMunicipalities,
          withData,
          withApiOnly,
          noApi,
        },
        zoning: {
          totalDistricts: parseInt(zoningStats.total_districts),
          municipalitiesWithData: parseInt(zoningStats.municipalities_with_data),
          statesWithData: parseInt(zoningStats.states_with_data),
          apiSourced: parseInt(zoningStats.api_sourced),
          aiSourced: parseInt(zoningStats.ai_sourced),
          manualSourced: parseInt(zoningStats.manual_sourced),
        },
        properties: {
          total: parseInt(propertyStats.total_properties),
          citiesCovered: parseInt(propertyStats.cities_covered),
          statesCovered: parseInt(propertyStats.states_covered),
        },
        rentComps: {
          total: parseInt(rentCompStats.total_comps),
          marketsCovered: parseInt(rentCompStats.markets_covered),
        },
        deals: {
          total: parseInt(dealStats.total_deals),
          active: parseInt(dealStats.active_deals),
        },
        propertyTypes: {
          total: parseInt(propertyTypes.total_types),
          enabled: parseInt(propertyTypes.enabled_types),
          categories: parseInt(propertyTypes.categories),
        },
        dataLibrary: {
          totalFiles: parseInt(dataLibrary.total_files),
        },
      },
      municipalities,
      stateBreakdown,
    });
  } catch (error) {
    console.error('Data tracker error:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

export default router;

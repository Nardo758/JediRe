import { Router } from 'express';
import { Pool } from 'pg';

const router = Router();

/**
 * GET /api/v1/deals/:dealId/design-3d
 * Load 3D building design for a deal (optionally filtered by scenario)
 */
router.get('/:dealId/design-3d', async (req, res) => {
  const { dealId } = req.params;
  const { scenarioId } = req.query;
  
  try {
    const pool: Pool = req.app.get('db');
    
    let query = `
      SELECT 
        id,
        deal_id,
        scenario_id,
        building_sections,
        total_units,
        total_gfa,
        total_parking_spaces,
        building_height_ft,
        stories,
        lot_coverage_percent,
        far,
        efficiency_percent,
        camera_state,
        created_at,
        updated_at
      FROM building_designs_3d
      WHERE deal_id = $1
    `;
    
    const params: any[] = [dealId];
    
    if (scenarioId) {
      query += ` AND scenario_id = $2`;
      params.push(scenarioId);
    }
    
    query += ` ORDER BY updated_at DESC LIMIT 1`;
    
    const result = await pool.query(query, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'No 3D design found for this deal',
        dealId,
        scenarioId: scenarioId || null
      });
    }
    
    res.json(result.rows[0]);
    
  } catch (error) {
    console.error('Error loading 3D design:', error);
    res.status(500).json({
      error: 'Failed to load 3D design',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/v1/deals/:dealId/design-3d
 * Save or update 3D building design
 */
router.post('/:dealId/design-3d', async (req, res) => {
  const { dealId } = req.params;
  const {
    scenarioId,
    buildingSections,
    cameraState,
    createdBy
  } = req.body;
  
  try {
    const pool: Pool = req.app.get('db');
    
    // Validate required fields
    if (!buildingSections || !Array.isArray(buildingSections)) {
      return res.status(400).json({
        error: 'buildingSections must be an array'
      });
    }
    
    // Calculate metrics from building sections
    const metrics = calculateMetrics(buildingSections, dealId, pool);
    
    const query = `
      INSERT INTO building_designs_3d (
        deal_id,
        scenario_id,
        building_sections,
        total_units,
        total_gfa,
        total_parking_spaces,
        building_height_ft,
        stories,
        lot_coverage_percent,
        far,
        efficiency_percent,
        camera_state,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (deal_id, scenario_id) 
      DO UPDATE SET
        building_sections = EXCLUDED.building_sections,
        total_units = EXCLUDED.total_units,
        total_gfa = EXCLUDED.total_gfa,
        total_parking_spaces = EXCLUDED.total_parking_spaces,
        building_height_ft = EXCLUDED.building_height_ft,
        stories = EXCLUDED.stories,
        lot_coverage_percent = EXCLUDED.lot_coverage_percent,
        far = EXCLUDED.far,
        efficiency_percent = EXCLUDED.efficiency_percent,
        camera_state = EXCLUDED.camera_state,
        updated_at = NOW()
      RETURNING *
    `;
    
    const {
      totalUnits,
      totalGFA,
      totalParkingSpaces,
      buildingHeightFt,
      stories,
      lotCoveragePercent,
      far,
      efficiencyPercent
    } = await metrics;
    
    const params = [
      dealId,
      scenarioId || null,
      JSON.stringify(buildingSections),
      totalUnits,
      totalGFA,
      totalParkingSpaces,
      buildingHeightFt,
      stories,
      lotCoveragePercent,
      far,
      efficiencyPercent,
      cameraState ? JSON.stringify(cameraState) : null,
      createdBy || null
    ];
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      design: result.rows[0]
    });
    
  } catch (error) {
    console.error('Error saving 3D design:', error);
    res.status(500).json({
      error: 'Failed to save 3D design',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE /api/v1/deals/:dealId/design-3d
 * Delete a 3D building design
 */
router.delete('/:dealId/design-3d', async (req, res) => {
  const { dealId } = req.params;
  const { scenarioId } = req.query;
  
  try {
    const pool: Pool = req.app.get('db');
    
    let query = `DELETE FROM building_designs_3d WHERE deal_id = $1`;
    const params: any[] = [dealId];
    
    if (scenarioId) {
      query += ` AND scenario_id = $2`;
      params.push(scenarioId);
    }
    
    query += ` RETURNING id`;
    
    const result = await pool.query(query, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'No 3D design found to delete'
      });
    }
    
    res.json({
      success: true,
      deletedId: result.rows[0].id
    });
    
  } catch (error) {
    console.error('Error deleting 3D design:', error);
    res.status(500).json({
      error: 'Failed to delete 3D design',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Calculate building metrics from sections
 */
async function calculateMetrics(buildingSections: any[], dealId: string, pool: Pool) {
  let totalUnits = 0;
  let totalGFA = 0;
  let totalParkingSpaces = 0;
  let buildingHeightFt = 0;
  let stories = 0;
  
  // Sum up all sections
  for (const section of buildingSections) {
    if (!section.visible) continue;
    
    totalUnits += section.units || 0;
    
    // Calculate GFA from footprint area * floors
    const footprintArea = calculateFootprintArea(section.geometry.footprint.points);
    const sectionGFA = footprintArea * (section.geometry.floors || 1);
    totalGFA += sectionGFA;
    
    // Track max height and total stories
    const sectionHeight = (section.position?.z || 0) + section.geometry.height;
    buildingHeightFt = Math.max(buildingHeightFt, sectionHeight);
    stories = Math.max(stories, section.geometry.floors || 1);
    
    // Parking spaces (if section has parking metadata)
    if (section.parkingSpaces) {
      totalParkingSpaces += section.parkingSpaces;
    }
  }
  
  // Get parcel area to calculate FAR and lot coverage
  const parcelResult = await pool.query(
    `SELECT parcel_area_sf, buildable_area_sf FROM property_boundaries WHERE deal_id = $1 LIMIT 1`,
    [dealId]
  );
  
  const parcelAreaSF = parcelResult.rows[0]?.parcel_area_sf || 1;
  const buildableAreaSF = parcelResult.rows[0]?.buildable_area_sf || parcelAreaSF;
  
  const far = totalGFA / parcelAreaSF;
  
  // Lot coverage = footprint of first floor / parcel area
  const firstFloorFootprint = buildingSections
    .filter(s => s.visible && (!s.position || s.position.z === 0))
    .reduce((sum, s) => sum + calculateFootprintArea(s.geometry.footprint.points), 0);
  
  const lotCoveragePercent = (firstFloorFootprint / parcelAreaSF) * 100;
  
  // Efficiency (default 85%, can be customized per section)
  const efficiencyPercent = 85;
  
  return {
    totalUnits,
    totalGFA: Math.round(totalGFA),
    totalParkingSpaces,
    buildingHeightFt: Math.round(buildingHeightFt * 10) / 10,
    stories,
    lotCoveragePercent: Math.round(lotCoveragePercent * 10) / 10,
    far: Math.round(far * 100) / 100,
    efficiencyPercent
  };
}

/**
 * Calculate area of a polygon footprint using the Shoelace formula
 */
function calculateFootprintArea(points: Array<{x: number, z: number}>): number {
  if (!points || points.length < 3) return 0;
  
  let area = 0;
  const n = points.length;
  
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i].x * points[j].z;
    area -= points[j].x * points[i].z;
  }
  
  return Math.abs(area / 2);
}

export default router;

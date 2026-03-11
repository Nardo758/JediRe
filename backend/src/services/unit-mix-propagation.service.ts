/**
 * Unit Mix Propagation Service
 * 
 * When development path is selected or Unit Mix Intelligence updates,
 * propagate that data to ALL dependent modules:
 * - Financial Model (rent roll structure)
 * - 3D Design (units per floor, floor plans)
 * - Development Capacity (unit count assumptions)
 * - Pro Forma Intelligence (revenue projections)
 * 
 * Unit Mix Intelligence is the SOURCE OF TRUTH for:
 * - Total unit count
 * - Unit type breakdown (Studios/1BR/2BR/3BR)
 * - Average square footage per unit type
 * - Unit type percentages
 */

import { query } from '../database/connection';
import { logger } from '../utils/logger';

interface UnitMixBreakdown {
  studio: { count: number; avgSF: number; percent: number };
  oneBR: { count: number; avgSF: number; percent: number };
  twoBR: { count: number; avgSF: number; percent: number };
  threeBR: { count: number; avgSF: number; percent: number };
  total: number;
  totalSF: number;
  avgSF: number;
}

interface PropagationResult {
  success: boolean;
  modulesUpdated: string[];
  errors: string[];
  unitMix: UnitMixBreakdown;
}

/**
 * Main orchestration function
 * Called when:
 * 1. Development path selected
 * 2. Unit Mix Intelligence module runs
 * 3. User manually overrides unit mix
 */
export async function propagateUnitMix(dealId: string, source: 'path' | 'intelligence' | 'manual'): Promise<PropagationResult> {
  const modulesUpdated: string[] = [];
  const errors: string[] = [];
  
  try {
    logger.info('Starting unit mix propagation:', { dealId, source });
    
    // Step 1: Get authoritative unit mix data
    const unitMix = await getAuthoritativeUnitMix(dealId);
    
    if (!unitMix) {
      throw new Error('No unit mix data available to propagate');
    }
    
    logger.info('Unit mix to propagate:', unitMix);
    
    // Step 2: Update all dependent modules
    
    // Update financial model assumptions
    try {
      await updateFinancialModelUnitMix(dealId, unitMix);
      modulesUpdated.push('financial_model');
      logger.info('Financial model updated with unit mix');
    } catch (error: any) {
      errors.push(`Financial model update failed: ${error.message}`);
      logger.error('Failed to update financial model:', error);
    }
    
    // Update 3D design
    try {
      await update3DDesignUnitMix(dealId, unitMix);
      modulesUpdated.push('3d_design');
      logger.info('3D design updated with unit mix');
    } catch (error: any) {
      errors.push(`3D design update failed: ${error.message}`);
      logger.error('Failed to update 3D design:', error);
    }
    
    // Update development capacity
    try {
      await updateDevelopmentCapacityUnitMix(dealId, unitMix);
      modulesUpdated.push('development_capacity');
      logger.info('Development capacity updated with unit mix');
    } catch (error: any) {
      errors.push(`Development capacity update failed: ${error.message}`);
      logger.error('Failed to update development capacity:', error);
    }
    
    // Update deal-level unit count
    try {
      await updateDealTargetUnits(dealId, unitMix.total);
      modulesUpdated.push('deal_metadata');
      logger.info('Deal target units updated');
    } catch (error: any) {
      errors.push(`Deal metadata update failed: ${error.message}`);
      logger.error('Failed to update deal metadata:', error);
    }
    
    // Mark unit mix as applied
    try {
      await markUnitMixApplied(dealId, source);
      logger.info('Unit mix marked as applied');
    } catch (error: any) {
      logger.error('Failed to mark unit mix as applied:', error);
    }
    
    return {
      success: errors.length === 0,
      modulesUpdated,
      errors,
      unitMix,
    };
    
  } catch (error: any) {
    logger.error('Unit mix propagation failed:', { dealId, error: error.message });
    return {
      success: false,
      modulesUpdated,
      errors: [error.message],
      unitMix: null as any,
    };
  }
}

/**
 * Get the authoritative unit mix
 * Priority:
 * 1. User manual override (highest priority)
 * 2. Unit Mix Intelligence output
 * 3. Development path default
 */
async function getAuthoritativeUnitMix(dealId: string): Promise<UnitMixBreakdown | null> {
  // Check for manual override first
  const overrideResult = await query(
    `SELECT module_outputs->'unitMixOverride' as override_data
     FROM deals WHERE id = $1`,
    [dealId]
  );
  
  if (overrideResult.rows[0]?.override_data) {
    logger.info('Using manual unit mix override');
    return parseUnitMixData(overrideResult.rows[0].override_data);
  }
  
  // Check Unit Mix Intelligence module
  const intelligenceResult = await query(
    `SELECT module_outputs->'unitMix' as unit_mix_data
     FROM deals WHERE id = $1`,
    [dealId]
  );
  
  if (intelligenceResult.rows[0]?.unit_mix_data) {
    logger.info('Using Unit Mix Intelligence output');
    return parseUnitMixData(intelligenceResult.rows[0].unit_mix_data);
  }
  
  // Fallback: check selected development path
  const pathResult = await query(
    `SELECT 
      module_outputs->'developmentStrategy'->'selectedPath' as selected_path
     FROM deals WHERE id = $1`,
    [dealId]
  );
  
  if (pathResult.rows[0]?.selected_path?.unitMix) {
    logger.info('Using development path unit mix');
    return parseUnitMixData(pathResult.rows[0].selected_path.unitMix);
  }
  
  return null;
}

/**
 * Parse unit mix data into standardized format
 */
function parseUnitMixData(rawData: any): UnitMixBreakdown {
  // Handle different input formats
  let program = rawData.program || rawData.breakdown || rawData;
  
  const breakdown: UnitMixBreakdown = {
    studio: { count: 0, avgSF: 550, percent: 0 },
    oneBR: { count: 0, avgSF: 750, percent: 0 },
    twoBR: { count: 0, avgSF: 1000, percent: 0 },
    threeBR: { count: 0, avgSF: 1600, percent: 0 },
    total: 0,
    totalSF: 0,
    avgSF: 0,
  };
  
  // If it's an array (from Unit Mix Intelligence)
  if (Array.isArray(program)) {
    program.forEach((item: any) => {
      const type = (item.unitType || item.type || '').toLowerCase();
      const count = item.count || item.units || 0;
      const avgSF = item.avgSF || item.averageSF || item.sf || 0;
      
      if (type.includes('studio')) {
        breakdown.studio.count = count;
        if (avgSF) breakdown.studio.avgSF = avgSF;
      } else if (type.includes('1') && type.includes('br')) {
        breakdown.oneBR.count = count;
        if (avgSF) breakdown.oneBR.avgSF = avgSF;
      } else if (type.includes('2') && type.includes('br')) {
        breakdown.twoBR.count = count;
        if (avgSF) breakdown.twoBR.avgSF = avgSF;
      } else if (type.includes('3') && type.includes('br')) {
        breakdown.threeBR.count = count;
        if (avgSF) breakdown.threeBR.avgSF = avgSF;
      }
    });
  }
  
  // Calculate totals and percentages
  breakdown.total = 
    breakdown.studio.count + 
    breakdown.oneBR.count + 
    breakdown.twoBR.count + 
    breakdown.threeBR.count;
  
  if (breakdown.total > 0) {
    breakdown.studio.percent = (breakdown.studio.count / breakdown.total) * 100;
    breakdown.oneBR.percent = (breakdown.oneBR.count / breakdown.total) * 100;
    breakdown.twoBR.percent = (breakdown.twoBR.count / breakdown.total) * 100;
    breakdown.threeBR.percent = (breakdown.threeBR.count / breakdown.total) * 100;
  }
  
  breakdown.totalSF = 
    (breakdown.studio.count * breakdown.studio.avgSF) +
    (breakdown.oneBR.count * breakdown.oneBR.avgSF) +
    (breakdown.twoBR.count * breakdown.twoBR.avgSF) +
    (breakdown.threeBR.count * breakdown.threeBR.avgSF);
  
  breakdown.avgSF = breakdown.total > 0 ? breakdown.totalSF / breakdown.total : 0;
  
  return breakdown;
}

/**
 * Update financial model with unit mix
 */
async function updateFinancialModelUnitMix(dealId: string, unitMix: UnitMixBreakdown): Promise<void> {
  // Get existing financial model
  const modelResult = await query(
    'SELECT id, assumptions FROM financial_models WHERE deal_id = $1 ORDER BY created_at DESC LIMIT 1',
    [dealId]
  );
  
  if (modelResult.rows.length === 0) {
    logger.info('No financial model exists yet - will be used when created');
    return;
  }
  
  const model = modelResult.rows[0];
  const assumptions = model.assumptions || {};
  
  // Update unit mix in assumptions
  assumptions.unitMix = [
    {
      unitType: 'Studio',
      count: unitMix.studio.count,
      avgSF: unitMix.studio.avgSF,
      percent: unitMix.studio.percent,
    },
    {
      unitType: '1BR',
      count: unitMix.oneBR.count,
      avgSF: unitMix.oneBR.avgSF,
      percent: unitMix.oneBR.percent,
    },
    {
      unitType: '2BR',
      count: unitMix.twoBR.count,
      avgSF: unitMix.twoBR.avgSF,
      percent: unitMix.twoBR.percent,
    },
    {
      unitType: '3BR',
      count: unitMix.threeBR.count,
      avgSF: unitMix.threeBR.avgSF,
      percent: unitMix.threeBR.percent,
    },
  ].filter(item => item.count > 0); // Only include unit types with count > 0
  
  assumptions.totalUnits = unitMix.total;
  assumptions.totalSF = unitMix.totalSF;
  assumptions.avgSF = unitMix.avgSF;
  
  // Mark as needs recompute
  assumptions._unitMixUpdated = new Date().toISOString();
  
  await query(
    `UPDATE financial_models 
     SET assumptions = $1,
         status = 'draft',
         updated_at = NOW()
     WHERE id = $2`,
    [JSON.stringify(assumptions), model.id]
  );
  
  logger.info('Financial model assumptions updated with unit mix');
}

/**
 * Update 3D design with unit mix
 */
async function update3DDesignUnitMix(dealId: string, unitMix: UnitMixBreakdown): Promise<void> {
  // Get existing 3D design
  const designResult = await query(
    'SELECT id, building_sections FROM building_designs_3d WHERE deal_id = $1 ORDER BY created_at DESC LIMIT 1',
    [dealId]
  );
  
  if (designResult.rows.length === 0) {
    logger.info('No 3D design exists yet - will be used when created');
    return;
  }
  
  const design = designResult.rows[0];
  
  // Store unit mix in design metadata
  await query(
    `UPDATE building_designs_3d 
     SET metadata = jsonb_set(
       COALESCE(metadata, '{}'::jsonb),
       '{unitMix}',
       $1::jsonb
     ),
     updated_at = NOW()
     WHERE id = $2`,
    [
      JSON.stringify({
        studio: unitMix.studio,
        oneBR: unitMix.oneBR,
        twoBR: unitMix.twoBR,
        threeBR: unitMix.threeBR,
        total: unitMix.total,
        totalSF: unitMix.totalSF,
        updatedAt: new Date().toISOString(),
      }),
      design.id
    ]
  );
  
  logger.info('3D design updated with unit mix metadata');
}

/**
 * Update development capacity with unit mix
 */
async function updateDevelopmentCapacityUnitMix(dealId: string, unitMix: UnitMixBreakdown): Promise<void> {
  // Update in module_outputs
  await query(
    `UPDATE deals
     SET module_outputs = jsonb_set(
       COALESCE(module_outputs, '{}'::jsonb),
       '{developmentCapacity,unitMix}',
       $1::jsonb
     ),
     updated_at = NOW()
     WHERE id = $2`,
    [
      JSON.stringify({
        studio: unitMix.studio,
        oneBR: unitMix.oneBR,
        twoBR: unitMix.twoBR,
        threeBR: unitMix.threeBR,
        total: unitMix.total,
        totalSF: unitMix.totalSF,
        updatedAt: new Date().toISOString(),
      }),
      dealId
    ]
  );
  
  logger.info('Development capacity updated with unit mix');
}

/**
 * Update deal target units
 */
async function updateDealTargetUnits(dealId: string, totalUnits: number): Promise<void> {
  await query(
    'UPDATE deals SET target_units = $1, updated_at = NOW() WHERE id = $2',
    [totalUnits, dealId]
  );
  
  logger.info('Deal target units updated:', { dealId, totalUnits });
}

/**
 * Mark unit mix as applied
 */
async function markUnitMixApplied(dealId: string, source: string): Promise<void> {
  await query(
    `UPDATE deals
     SET module_outputs = jsonb_set(
       COALESCE(module_outputs, '{}'::jsonb),
       '{unitMixStatus}',
       $1::jsonb
     ),
     updated_at = NOW()
     WHERE id = $2`,
    [
      JSON.stringify({
        applied: true,
        source,
        appliedAt: new Date().toISOString(),
      }),
      dealId
    ]
  );
}

/**
 * Get unit mix propagation status
 */
export async function getUnitMixStatus(dealId: string): Promise<{
  hasUnitMix: boolean;
  source: string | null;
  appliedAt: string | null;
  unitMix: UnitMixBreakdown | null;
}> {
  const result = await query(
    `SELECT 
      module_outputs->'unitMixStatus' as status,
      module_outputs->'unitMix' as unit_mix_data
     FROM deals WHERE id = $1`,
    [dealId]
  );
  
  const status = result.rows[0]?.status;
  const unitMixData = result.rows[0]?.unit_mix_data;
  
  return {
    hasUnitMix: !!unitMixData,
    source: status?.source || null,
    appliedAt: status?.appliedAt || null,
    unitMix: unitMixData ? parseUnitMixData(unitMixData) : null,
  };
}

/**
 * Manually set unit mix (user override)
 */
export async function setManualUnitMix(
  dealId: string, 
  unitMix: {
    studio?: { count: number; avgSF?: number };
    oneBR?: { count: number; avgSF?: number };
    twoBR?: { count: number; avgSF?: number };
    threeBR?: { count: number; avgSF?: number };
  }
): Promise<PropagationResult> {
  // Store as override
  await query(
    `UPDATE deals
     SET module_outputs = jsonb_set(
       COALESCE(module_outputs, '{}'::jsonb),
       '{unitMixOverride}',
       $1::jsonb
     ),
     updated_at = NOW()
     WHERE id = $2`,
    [
      JSON.stringify({
        program: [
          unitMix.studio && { unitType: 'Studio', ...unitMix.studio },
          unitMix.oneBR && { unitType: '1BR', ...unitMix.oneBR },
          unitMix.twoBR && { unitType: '2BR', ...unitMix.twoBR },
          unitMix.threeBR && { unitType: '3BR', ...unitMix.threeBR },
        ].filter(Boolean),
        updatedAt: new Date().toISOString(),
      }),
      dealId
    ]
  );
  
  // Propagate to all modules
  return propagateUnitMix(dealId, 'manual');
}

/**
 * Deal Consistency Validator Service
 * 
 * Validates data consistency across all modules:
 * - Unit mix consistency (Studios/1BR/2BR/3BR counts)
 * - Site data (acreage, lot size)
 * - Zoning compliance (stories, parking, FAR)
 * - Financial assumptions vs. physical design
 * - Development capacity vs. actual design
 */

import { query } from '../database/connection';
import { logger } from '../utils/logger';

interface ValidationError {
  code: string;
  severity: 'critical' | 'warning' | 'info';
  module: string;
  field: string;
  message: string;
  expected?: any;
  actual?: any;
  impact?: string;
}

interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  info: ValidationError[];
  summary: string;
}

/**
 * Main validation function
 */
export async function validateDealConsistency(dealId: string): Promise<ValidationResult> {
  const errors: ValidationError[] = [];
  
  try {
    // Fetch all module data
    const deal = await getDealData(dealId);
    const property = await getPropertyData(dealId);
    const zoning = await getZoningData(dealId);
    const design3D = await get3DDesignData(dealId);
    const unitMix = await getUnitMixData(dealId);
    const financial = await getFinancialModelData(dealId);
    const devCapacity = await getDevelopmentCapacityData(dealId);
    
    // Run all validation checks
    errors.push(...validateAcreageConsistency(deal, property));
    errors.push(...validateUnitMixConsistency(deal, unitMix, financial, design3D, devCapacity));
    errors.push(...validateZoningCompliance(design3D, zoning, devCapacity));
    errors.push(...validateParkingRequirements(design3D, zoning));
    errors.push(...validateFARUtilization(design3D, zoning, property));
    errors.push(...validateFinancialAssumptions(financial, unitMix, design3D));
    errors.push(...validateDevelopmentCapacity(design3D, devCapacity, zoning));
    
  } catch (error: any) {
    logger.error('Consistency validation failed:', error);
    errors.push({
      code: 'VALIDATION_ERROR',
      severity: 'critical',
      module: 'validator',
      field: 'general',
      message: `Validation failed: ${error.message}`,
    });
  }
  
  // Separate by severity
  const criticalErrors = errors.filter(e => e.severity === 'critical');
  const warnings = errors.filter(e => e.severity === 'warning');
  const info = errors.filter(e => e.severity === 'info');
  
  return {
    isValid: criticalErrors.length === 0,
    errors: criticalErrors,
    warnings,
    info,
    summary: generateSummary(criticalErrors, warnings, info),
  };
}

/**
 * Validate acreage consistency across modules
 */
function validateAcreageConsistency(deal: any, property: any): ValidationError[] {
  const errors: ValidationError[] = [];
  
  // Check deal.acres vs description
  if (deal.description) {
    const descriptionAcres = extractAcresFromDescription(deal.description);
    if (descriptionAcres && Math.abs(deal.acres - descriptionAcres) > 0.1) {
      errors.push({
        code: 'ACRES_MISMATCH',
        severity: 'critical',
        module: 'deal',
        field: 'acres',
        message: 'Acreage mismatch between database field and description',
        expected: descriptionAcres,
        actual: deal.acres,
        impact: 'Affects all density, FAR, and land cost calculations',
      });
    }
  }
  
  // Check deal.acres vs property boundary
  if (property?.parcel_area) {
    const boundaryAcres = property.parcel_area;
    if (Math.abs(deal.acres - boundaryAcres) > 0.1) {
      errors.push({
        code: 'ACRES_BOUNDARY_MISMATCH',
        severity: 'critical',
        module: 'property',
        field: 'acres',
        message: 'Acreage mismatch between deal and property boundary',
        expected: boundaryAcres,
        actual: deal.acres,
        impact: 'Site plan and design may be based on wrong parcel size',
      });
    }
  }
  
  return errors;
}

/**
 * Validate unit mix consistency across ALL modules
 * This is the critical one - unit mix should match everywhere
 */
function validateUnitMixConsistency(
  deal: any,
  unitMix: any,
  financial: any,
  design3D: any,
  devCapacity: any
): ValidationError[] {
  const errors: ValidationError[] = [];
  
  // Collect unit counts from all sources
  const sources = {
    deal: {
      total: deal.targetUnits,
      breakdown: null,
    },
    unitMix: unitMix ? parseUnitMixBreakdown(unitMix) : null,
    financial: financial ? parseFinancialUnitMix(financial) : null,
    design3D: design3D ? parse3DDesignUnits(design3D) : null,
    devCapacity: devCapacity ? parseDevCapacityUnits(devCapacity) : null,
  };
  
  // Check total unit count consistency
  const totals = Object.entries(sources)
    .filter(([_, data]) => data && (data.total || data.breakdown?.total))
    .map(([module, data]) => ({
      module,
      total: data.total || data.breakdown?.total,
    }));
  
  if (totals.length > 1) {
    const expectedTotal = totals[0].total;
    for (let i = 1; i < totals.length; i++) {
      if (totals[i].total !== expectedTotal) {
        errors.push({
          code: 'UNIT_COUNT_MISMATCH',
          severity: 'critical',
          module: totals[i].module,
          field: 'total_units',
          message: `Total unit count mismatch: ${totals[0].module} has ${expectedTotal}, ${totals[i].module} has ${totals[i].total}`,
          expected: expectedTotal,
          actual: totals[i].total,
          impact: 'Financial projections, design, and capacity analysis are inconsistent',
        });
      }
    }
  }
  
  // Check unit mix breakdown consistency (Studios/1BR/2BR/3BR)
  const breakdowns = Object.entries(sources)
    .filter(([_, data]) => data && data.breakdown)
    .map(([module, data]) => ({ module, breakdown: data.breakdown }));
  
  if (breakdowns.length > 1) {
    const baseBreakdown = breakdowns[0].breakdown;
    for (let i = 1; i < breakdowns.length; i++) {
      const currentBreakdown = breakdowns[i].breakdown;
      
      // Check each unit type
      ['studio', '1br', '2br', '3br'].forEach(type => {
        const baseCount = baseBreakdown[type] || 0;
        const currentCount = currentBreakdown[type] || 0;
        
        if (baseCount !== currentCount) {
          errors.push({
            code: 'UNIT_MIX_MISMATCH',
            severity: 'critical',
            module: breakdowns[i].module,
            field: `${type}_count`,
            message: `${type.toUpperCase()} count mismatch: ${breakdowns[0].module} has ${baseCount}, ${breakdowns[i].module} has ${currentCount}`,
            expected: baseCount,
            actual: currentCount,
            impact: 'Rent roll, absorption, and design are inconsistent',
          });
        }
      });
    }
  }
  
  // Check if unit mix breakdown exists but is zero/empty
  if (sources.unitMix === null && totals.length > 0) {
    errors.push({
      code: 'UNIT_MIX_MISSING',
      severity: 'warning',
      module: 'unit_mix',
      field: 'unit_mix_breakdown',
      message: 'Unit mix breakdown not defined (Studios/1BR/2BR/3BR counts)',
      impact: 'Cannot validate rent roll or design unit layouts',
    });
  }
  
  return errors;
}

/**
 * Validate zoning compliance
 */
function validateZoningCompliance(design3D: any, zoning: any, devCapacity: any): ValidationError[] {
  const errors: ValidationError[] = [];
  
  if (!zoning || !design3D) return errors;
  
  // Check max stories
  if (design3D.stories > zoning.maxStories) {
    errors.push({
      code: 'ZONING_HEIGHT_VIOLATION',
      severity: 'critical',
      module: '3d_design',
      field: 'stories',
      message: `Building design exceeds zoning height limit`,
      expected: `${zoning.maxStories} stories max`,
      actual: `${design3D.stories} stories`,
      impact: 'Permits will be denied, requires redesign',
    });
  }
  
  // Check max units
  if (zoning.maxUnits && design3D.units > zoning.maxUnits) {
    errors.push({
      code: 'ZONING_DENSITY_VIOLATION',
      severity: 'critical',
      module: '3d_design',
      field: 'units',
      message: `Unit count exceeds zoning density limit`,
      expected: `${zoning.maxUnits} units max`,
      actual: `${design3D.units} units`,
      impact: 'Zoning variance required or unit reduction needed',
    });
  }
  
  // Check FAR
  if (zoning.maxFAR && design3D.far > zoning.maxFAR) {
    errors.push({
      code: 'ZONING_FAR_VIOLATION',
      severity: 'critical',
      module: '3d_design',
      field: 'far',
      message: `Building FAR exceeds zoning limit`,
      expected: `${zoning.maxFAR} FAR max`,
      actual: `${design3D.far} FAR`,
      impact: 'Building size must be reduced',
    });
  }
  
  // Check setbacks (if defined)
  if (zoning.setbacks && design3D.setbacks) {
    ['front', 'side', 'rear'].forEach(side => {
      if (design3D.setbacks[side] < zoning.setbacks[side]) {
        errors.push({
          code: 'ZONING_SETBACK_VIOLATION',
          severity: 'critical',
          module: '3d_design',
          field: `${side}_setback`,
          message: `${side} setback violation`,
          expected: `${zoning.setbacks[side]} ft min`,
          actual: `${design3D.setbacks[side]} ft`,
          impact: 'Building footprint must be adjusted',
        });
      }
    });
  }
  
  return errors;
}

/**
 * Validate parking requirements
 */
function validateParkingRequirements(design3D: any, zoning: any): ValidationError[] {
  const errors: ValidationError[] = [];
  
  if (!zoning || !design3D) return errors;
  
  const required = zoning.parkingRequired || (zoning.parkingRatio * design3D.units);
  const provided = design3D.parkingSpaces || 0;
  
  // Check if parking is required but not provided
  if (required > 0 && provided < required) {
    errors.push({
      code: 'PARKING_INSUFFICIENT',
      severity: 'critical',
      module: '3d_design',
      field: 'parking_spaces',
      message: `Insufficient parking spaces`,
      expected: `${required} spaces required`,
      actual: `${provided} spaces provided`,
      impact: 'Zoning compliance issue, permits denied',
    });
  }
  
  // Check if parking is provided but NOT required (like Atlanta BeltLine)
  if (required === 0 && provided > 0) {
    errors.push({
      code: 'PARKING_UNNECESSARY',
      severity: 'warning',
      module: '3d_design',
      field: 'parking_spaces',
      message: `Parking structure included but not required by zoning`,
      expected: `0 spaces (zoning exemption)`,
      actual: `${provided} spaces`,
      impact: `Potential cost savings: ~$${Math.round((provided * 30000) / 1000000)}M`,
    });
  }
  
  return errors;
}

/**
 * Validate FAR utilization
 */
function validateFARUtilization(design3D: any, zoning: any, property: any): ValidationError[] {
  const errors: ValidationError[] = [];
  
  if (!zoning || !design3D || !property) return errors;
  
  const allowedFAR = zoning.maxFAR;
  const currentFAR = design3D.far;
  
  // Severe underutilization (using less than 50% of allowed FAR)
  if (currentFAR < allowedFAR * 0.5) {
    const maxGFA = property.parcel_area_sf * allowedFAR;
    const currentGFA = property.parcel_area_sf * currentFAR;
    const unused = maxGFA - currentGFA;
    
    errors.push({
      code: 'FAR_UNDERUTILIZED',
      severity: 'info',
      module: '3d_design',
      field: 'far',
      message: `Severe FAR underutilization - using ${Math.round((currentFAR / allowedFAR) * 100)}% of allowed`,
      expected: `Up to ${allowedFAR} FAR (${Math.round(maxGFA)} SF)`,
      actual: `${currentFAR} FAR (${Math.round(currentGFA)} SF)`,
      impact: `${Math.round(unused)} SF unused potential (~${Math.round(unused / 850)} additional units possible)`,
    });
  }
  
  return errors;
}

/**
 * Validate financial assumptions match physical design
 */
function validateFinancialAssumptions(financial: any, unitMix: any, design3D: any): ValidationError[] {
  const errors: ValidationError[] = [];
  
  if (!financial) return errors;
  
  // Check if financial model unit count matches design
  if (design3D && financial.totalUnits !== design3D.units) {
    errors.push({
      code: 'FINANCIAL_UNITS_MISMATCH',
      severity: 'critical',
      module: 'financial_model',
      field: 'total_units',
      message: `Financial model unit count doesn't match design`,
      expected: `${design3D.units} units (from design)`,
      actual: `${financial.totalUnits} units (in financial model)`,
      impact: 'Revenue projections are based on wrong unit count',
    });
  }
  
  // Check if financial model has rent roll but no unit mix breakdown
  if (financial.rentRoll && !unitMix) {
    errors.push({
      code: 'RENT_ROLL_NO_UNIT_MIX',
      severity: 'warning',
      module: 'financial_model',
      field: 'rent_roll',
      message: `Rent roll exists but unit mix breakdown not defined`,
      impact: 'Cannot verify rent roll accuracy',
    });
  }
  
  return errors;
}

/**
 * Validate development capacity matches design
 */
function validateDevelopmentCapacity(design3D: any, devCapacity: any, zoning: any): ValidationError[] {
  const errors: ValidationError[] = [];
  
  if (!devCapacity || !design3D) return errors;
  
  // Check if design exceeds calculated capacity
  if (design3D.units > devCapacity.maxUnits) {
    errors.push({
      code: 'DESIGN_EXCEEDS_CAPACITY',
      severity: 'critical',
      module: '3d_design',
      field: 'units',
      message: `Design exceeds calculated development capacity`,
      expected: `${devCapacity.maxUnits} units max (from capacity analysis)`,
      actual: `${design3D.units} units (in design)`,
      impact: 'Design is not buildable under current zoning',
    });
  }
  
  return errors;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract acres from deal description
 */
function extractAcresFromDescription(description: string): number | null {
  const acresMatch = description.match(/(\d+\.?\d*)-acre/i);
  return acresMatch ? parseFloat(acresMatch[1]) : null;
}

/**
 * Parse unit mix breakdown from unit mix module
 */
function parseUnitMixBreakdown(unitMix: any): any {
  if (!unitMix || !unitMix.program) return null;
  
  const breakdown = {
    studio: 0,
    '1br': 0,
    '2br': 0,
    '3br': 0,
    total: 0,
  };
  
  unitMix.program.forEach((row: any) => {
    const type = row.unitType?.toLowerCase() || '';
    const count = row.count || 0;
    
    if (type.includes('studio')) breakdown.studio += count;
    else if (type.includes('1') && type.includes('br')) breakdown['1br'] += count;
    else if (type.includes('2') && type.includes('br')) breakdown['2br'] += count;
    else if (type.includes('3') && type.includes('br')) breakdown['3br'] += count;
    
    breakdown.total += count;
  });
  
  return breakdown;
}

/**
 * Parse unit mix from financial model
 */
function parseFinancialUnitMix(financial: any): any {
  // Implementation depends on financial model structure
  return null;
}

/**
 * Parse units from 3D design
 */
function parse3DDesignUnits(design3D: any): any {
  if (!design3D.building_sections) return null;
  
  const totalUnits = design3D.building_sections.reduce((sum: number, section: any) => {
    return sum + (section.units || 0);
  }, 0);
  
  return { total: totalUnits, breakdown: null };
}

/**
 * Parse units from development capacity
 */
function parseDevCapacityUnits(devCapacity: any): any {
  return devCapacity.maxUnits ? { total: devCapacity.maxUnits, breakdown: null } : null;
}

/**
 * Generate summary message
 */
function generateSummary(errors: ValidationError[], warnings: ValidationError[], info: ValidationError[]): string {
  if (errors.length === 0 && warnings.length === 0) {
    return '✅ All modules are consistent';
  }
  
  const parts = [];
  if (errors.length > 0) parts.push(`${errors.length} critical error(s)`);
  if (warnings.length > 0) parts.push(`${warnings.length} warning(s)`);
  if (info.length > 0) parts.push(`${info.length} info item(s)`);
  
  return `⚠️ Found ${parts.join(', ')}`;
}

// ============================================================================
// Data Fetch Functions
// ============================================================================

async function getDealData(dealId: string) {
  const result = await query('SELECT * FROM deals WHERE id = $1', [dealId]);
  return result.rows[0];
}

async function getPropertyData(dealId: string) {
  const result = await query('SELECT * FROM property_boundaries WHERE deal_id = $1', [dealId]);
  return result.rows[0];
}

async function getZoningData(dealId: string) {
  const result = await query(
    `SELECT 
      module_outputs->'zoningIntelligence' as zoning_data
     FROM deals WHERE id = $1`,
    [dealId]
  );
  return result.rows[0]?.zoning_data;
}

async function get3DDesignData(dealId: string) {
  const result = await query('SELECT * FROM building_designs_3d WHERE deal_id = $1 ORDER BY created_at DESC LIMIT 1', [dealId]);
  return result.rows[0];
}

async function getUnitMixData(dealId: string) {
  const result = await query(
    `SELECT 
      module_outputs->'unitMix' as unit_mix_data
     FROM deals WHERE id = $1`,
    [dealId]
  );
  return result.rows[0]?.unit_mix_data;
}

async function getFinancialModelData(dealId: string) {
  const result = await query('SELECT * FROM financial_models WHERE deal_id = $1 ORDER BY created_at DESC LIMIT 1', [dealId]);
  return result.rows[0];
}

async function getDevelopmentCapacityData(dealId: string) {
  const result = await query(
    `SELECT 
      module_outputs->'developmentCapacity' as dev_capacity_data
     FROM deals WHERE id = $1`,
    [dealId]
  );
  return result.rows[0]?.dev_capacity_data;
}

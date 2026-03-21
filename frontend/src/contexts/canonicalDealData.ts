/**
 * Canonical Deal Data
 * 
 * Two sources of truth:
 * 1. Deal Creation Inputs - User-entered data during deal creation
 * 2. Municipal API Data - Parcel/zoning data from county/city APIs
 * 
 * All modules read from these canonical structures - never compute their own.
 */

/**
 * Site Data - FROM MUNICIPAL API (Zoning Module)
 * This is the authoritative source for parcel and zoning information.
 */
export interface CanonicalSiteData {
  // Parcel Info
  parcelId: string | null;
  lotSizeAcres: number | null;
  lotSizeSqft: number | null;
  
  // Zoning Info
  zoningCode: string | null;
  zoningDescription: string | null;
  municipality: string | null;
  jurisdiction: string | null;
  
  // Zoning Constraints
  maxFar: number | null;
  maxHeight: number | null;       // feet
  maxStories: number | null;
  maxDensity: number | null;      // units per acre
  maxUnits: number | null;        // calculated from density × acres
  minParkingRatio: number | null; // spaces per unit
  
  // Setbacks
  frontSetback: number | null;    // feet
  sideSetback: number | null;
  rearSetback: number | null;
  
  // Coverage
  maxLotCoverage: number | null;  // percentage
  maxBuildableArea: number | null; // sqft
  
  // Source tracking
  source: 'municipal_api' | 'manual' | 'pending';
  lastUpdated: number;
  confidence: number; // 0-100
}

/**
 * Deal Inputs - FROM DEAL CREATION FLOW
 * User-entered data that overrides or supplements municipal data.
 */
export interface CanonicalDealInputs {
  // Project Info
  dealName: string;
  developmentType: 'acquisition' | 'ground_up' | 'redevelopment';
  projectType: string; // multifamily, retail, office, etc.
  
  // Financial Inputs
  purchasePrice: number | null;
  landCost: number | null;
  budget: number | null;
  targetUnits: number | null;
  
  // Strategy
  strategyName: string | null;
  holdPeriod: number | null; // years
  exitStrategy: string | null;
  
  // Timeline
  expectedCloseDate: string | null;
  constructionStart: string | null;
  stabilizationDate: string | null;
  
  // Source tracking
  createdAt: number;
  lastUpdated: number;
}

/**
 * Merged Canonical Data
 * Single source of truth that all modules read from.
 * Municipal data takes precedence for site/zoning info.
 * Deal inputs take precedence for financial/strategy info.
 */
export interface CanonicalDealData {
  siteData: CanonicalSiteData;
  dealInputs: CanonicalDealInputs;
  
  // Computed/merged values for easy access
  computed: {
    lotSizeAcres: number | null;   // siteData.lotSizeAcres
    maxUnits: number | null;       // siteData.maxUnits or dealInputs.targetUnits
    zoningCode: string | null;     // siteData.zoningCode
    landCost: number | null;       // dealInputs.landCost or dealInputs.purchasePrice
    targetUnits: number | null;    // dealInputs.targetUnits or siteData.maxUnits
  };
  
  // Validation status
  validation: {
    hasConflicts: boolean;
    conflicts: DataConflict[];
    lastValidated: number;
  };
}

export interface DataConflict {
  field: string;
  municipalValue: any;
  userValue: any;
  resolution: 'use_municipal' | 'use_user' | 'unresolved';
  message: string;
}

/**
 * Create empty canonical site data
 */
export function createEmptySiteData(): CanonicalSiteData {
  return {
    parcelId: null,
    lotSizeAcres: null,
    lotSizeSqft: null,
    zoningCode: null,
    zoningDescription: null,
    municipality: null,
    jurisdiction: null,
    maxFar: null,
    maxHeight: null,
    maxStories: null,
    maxDensity: null,
    maxUnits: null,
    minParkingRatio: null,
    frontSetback: null,
    sideSetback: null,
    rearSetback: null,
    maxLotCoverage: null,
    maxBuildableArea: null,
    source: 'pending',
    lastUpdated: 0,
    confidence: 0,
  };
}

/**
 * Create empty deal inputs
 */
export function createEmptyDealInputs(): CanonicalDealInputs {
  return {
    dealName: '',
    developmentType: 'ground_up',
    projectType: 'multifamily',
    purchasePrice: null,
    landCost: null,
    budget: null,
    targetUnits: null,
    strategyName: null,
    holdPeriod: null,
    exitStrategy: null,
    expectedCloseDate: null,
    constructionStart: null,
    stabilizationDate: null,
    createdAt: Date.now(),
    lastUpdated: Date.now(),
  };
}

/**
 * Merge deal object into canonical deal inputs
 */
export function parseDealInputs(deal: any): CanonicalDealInputs {
  return {
    dealName: deal.name || '',
    developmentType: parseDevelopmentType(deal.developmentType || deal.projectType),
    projectType: deal.projectType || 'multifamily',
    purchasePrice: deal.purchasePrice || deal.purchase_price || null,
    landCost: deal.landCost || deal.land_cost || null,
    budget: parseFloat(deal.budget) || null,
    targetUnits: deal.targetUnits || deal.target_units || null,
    strategyName: deal.strategyName || deal.strategy_name || null,
    holdPeriod: deal.holdPeriod || deal.hold_period || null,
    exitStrategy: deal.exitStrategy || deal.exit_strategy || null,
    expectedCloseDate: deal.expectedCloseDate || deal.expected_close_date || null,
    constructionStart: deal.constructionStart || deal.construction_start || null,
    stabilizationDate: deal.stabilizationDate || deal.stabilization_date || null,
    createdAt: new Date(deal.createdAt || deal.created_at || Date.now()).getTime(),
    lastUpdated: Date.now(),
  };
}

/**
 * Parse zoning data into canonical site data
 */
export function parseZoningToSiteData(zoning: any, property?: any): CanonicalSiteData {
  const explicitAcres = property?.lot_size_acres || property?.property_data?.lot_size_acres || null;
  const lotSizeSqft = zoning?.lotAreaSf || zoning?.lot_area_sf || property?.lot_size_sqft || null;
  const lotSizeAcres = explicitAcres || (lotSizeSqft ? lotSizeSqft / 43560 : null);
  
  return {
    parcelId: property?.parcel_id || zoning?.parcelId || null,
    lotSizeAcres: lotSizeAcres && lotSizeAcres < 100 ? lotSizeAcres : null, // Skip bad data
    lotSizeSqft,
    zoningCode: zoning?.baseDistrictCode || zoning?.zoning_code || property?.zoning_code || null,
    zoningDescription: zoning?.zoningDescription || zoning?.description || null,
    municipality: zoning?.municipality || null,
    jurisdiction: zoning?.jurisdiction || null,
    maxFar: zoning?.appliedFar || zoning?.far || null,
    maxHeight: zoning?.maxHeight || zoning?.max_height || null,
    maxStories: zoning?.maxStories || zoning?.max_stories || null,
    maxDensity: zoning?.maxDensity || zoning?.max_density || null,
    maxUnits: zoning?.maxUnits || zoning?.max_units || null,
    minParkingRatio: zoning?.parkingRatio || zoning?.parking_ratio || null,
    frontSetback: zoning?.frontSetback || zoning?.front_setback || null,
    sideSetback: zoning?.sideSetback || zoning?.side_setback || null,
    rearSetback: zoning?.rearSetback || zoning?.rear_setback || null,
    maxLotCoverage: zoning?.lotCoverage || zoning?.lot_coverage || null,
    maxBuildableArea: zoning?.buildableAreaSf || zoning?.buildable_area_sf || null,
    source: zoning ? 'municipal_api' : 'pending',
    lastUpdated: Date.now(),
    confidence: zoning ? 85 : 0,
  };
}

/**
 * Merge site data and deal inputs into computed values
 */
export function computeCanonicalData(
  siteData: CanonicalSiteData,
  dealInputs: CanonicalDealInputs
): CanonicalDealData {
  const conflicts: DataConflict[] = [];
  
  // Check for conflicts
  if (siteData.maxUnits && dealInputs.targetUnits && 
      dealInputs.targetUnits > siteData.maxUnits) {
    conflicts.push({
      field: 'units',
      municipalValue: siteData.maxUnits,
      userValue: dealInputs.targetUnits,
      resolution: 'unresolved',
      message: `Target units (${dealInputs.targetUnits}) exceeds zoning max (${siteData.maxUnits})`,
    });
  }
  
  return {
    siteData,
    dealInputs,
    computed: {
      lotSizeAcres: siteData.lotSizeAcres,
      maxUnits: siteData.maxUnits || dealInputs.targetUnits,
      zoningCode: siteData.zoningCode,
      landCost: dealInputs.landCost || dealInputs.purchasePrice,
      targetUnits: dealInputs.targetUnits || siteData.maxUnits,
    },
    validation: {
      hasConflicts: conflicts.length > 0,
      conflicts,
      lastValidated: Date.now(),
    },
  };
}

function parseDevelopmentType(type: string): 'acquisition' | 'ground_up' | 'redevelopment' {
  const lower = (type || '').toLowerCase();
  if (lower.includes('acqui') || lower === 'existing') return 'acquisition';
  if (lower.includes('redev') || lower.includes('rehab')) return 'redevelopment';
  return 'ground_up';
}

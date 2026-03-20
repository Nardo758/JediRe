export interface CanonicalSiteData {
  lotAreaSf: number | null;
  buildableAreaSf: number | null;
  acreage: number | null;
  buildableAcreage: number | null;
  zoningDesignation: string | null;
  maxFAR: number | null;
  maxHeight: number | null;
  maxDensity: number | null;
  maxLotCoverage: number | null;
  setbackFront: number | null;
  setbackSide: number | null;
  setbackRear: number | null;
  parkingRatio: number | null;
  floodZone: string | null;
  constraints: string[];
  overlays: string[];
  lastUpdated?: number;
}

export interface CanonicalDealInputs {
  dealId: string | null;
  dealName: string | null;
  projectType: string | null;
  productType: string | null;
  targetUnits: number | null;
  targetRent: number | null;
  targetOccupancy: number | null;
  holdPeriod: number | null;
  exitCapRate: number | null;
  purchasePrice: number | null;
  renovationBudget: number | null;
  lastUpdated?: number;
}

export interface CanonicalDealData {
  siteData: CanonicalSiteData;
  dealInputs: CanonicalDealInputs;
  computedAt: number;
}

export function createEmptySiteData(): CanonicalSiteData {
  return {
    lotAreaSf: null,
    buildableAreaSf: null,
    acreage: null,
    buildableAcreage: null,
    zoningDesignation: null,
    maxFAR: null,
    maxHeight: null,
    maxDensity: null,
    maxLotCoverage: null,
    setbackFront: null,
    setbackSide: null,
    setbackRear: null,
    parkingRatio: null,
    floodZone: null,
    constraints: [],
    overlays: [],
    lastUpdated: Date.now(),
  };
}

export function createEmptyDealInputs(): CanonicalDealInputs {
  return {
    dealId: null,
    dealName: null,
    projectType: null,
    productType: null,
    targetUnits: null,
    targetRent: null,
    targetOccupancy: null,
    holdPeriod: null,
    exitCapRate: null,
    purchasePrice: null,
    renovationBudget: null,
    lastUpdated: Date.now(),
  };
}

export function parseZoningToSiteData(zoningProfile: any, property?: any): CanonicalSiteData {
  const z = zoningProfile || {};
  const p = property || {};

  const lotAreaSf = z.lotAreaSf ?? z.lot_area_sf ?? p.lot_area_sf ?? p.lotAreaSf ?? null;
  const acreage = lotAreaSf ? lotAreaSf / 43560 : (z.acreage ?? p.acreage ?? null);

  return {
    lotAreaSf: lotAreaSf ? Number(lotAreaSf) : null,
    buildableAreaSf: z.buildableAreaSf ?? z.buildable_area_sf ?? null,
    acreage: acreage ? Number(acreage) : null,
    buildableAcreage: z.buildableAcreage ?? null,
    zoningDesignation: z.baseDistrictCode ?? z.designation ?? z.zoning_code ?? null,
    maxFAR: z.appliedFar ?? z.maxFAR ?? z.max_far ?? null,
    maxHeight: z.maxHeightFt ?? z.max_height ?? null,
    maxDensity: z.maxDensity ?? z.max_density ?? null,
    maxLotCoverage: z.maxLotCoverage ?? z.max_lot_coverage ?? null,
    setbackFront: z.setbacks?.front ?? z.setback_front ?? null,
    setbackSide: z.setbacks?.side ?? z.setback_side ?? null,
    setbackRear: z.setbacks?.rear ?? z.setback_rear ?? null,
    parkingRatio: z.parkingRatio ?? z.parking_ratio ?? null,
    floodZone: z.floodZone ?? p.flood_zone ?? null,
    constraints: Array.isArray(z.constraints) ? z.constraints : [],
    overlays: Array.isArray(z.overlays) ? z.overlays : [],
    lastUpdated: Date.now(),
  };
}

export function parseDealInputs(deal: any): CanonicalDealInputs {
  const d = deal || {};
  return {
    dealId: d.id ?? d.deal_id ?? null,
    dealName: d.name ?? d.deal_name ?? null,
    projectType: d.projectType ?? d.project_type ?? null,
    productType: d.productType ?? d.product_type ?? null,
    targetUnits: d.targetUnits ?? d.target_units ?? d.units ?? null,
    targetRent: d.targetRent ?? d.target_rent ?? null,
    targetOccupancy: d.targetOccupancy ?? d.target_occupancy ?? null,
    holdPeriod: d.holdPeriod ?? d.hold_period ?? null,
    exitCapRate: d.exitCapRate ?? d.exit_cap_rate ?? null,
    purchasePrice: d.purchasePrice ?? d.purchase_price ?? d.ask_price ?? null,
    renovationBudget: d.renovationBudget ?? d.renovation_budget ?? null,
    lastUpdated: Date.now(),
  };
}

export function computeCanonicalData(siteData: CanonicalSiteData, dealInputs: CanonicalDealInputs): CanonicalDealData {
  return { siteData, dealInputs, computedAt: Date.now() };
}

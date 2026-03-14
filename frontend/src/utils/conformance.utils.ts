// ═══════════════════════════════════════════════════════════════════════════════
// CONFORMANCE CHECK UTILITIES — Existing/Redevelopment Deals
// ═══════════════════════════════════════════════════════════════════════════════

export interface ConformanceMetric {
  current: number;
  allowed: number;
  utilization: number;        // 0-100 percentage
  passing: boolean;           // utilization <= 100
  grandfathered?: string;     // e.g., "1988 code"
  severity: 'ok' | 'warning' | 'critical';
}

export interface ConformanceCheckData {
  density: ConformanceMetric;
  far: ConformanceMetric;
  height: ConformanceMetric;
  coverage: ConformanceMetric;
  parking: ConformanceMetric;
  nonconformingItems: Array<{
    item: string;
    detail: string;
    grandfatheredUntil?: string;
  }>;
  totalConforming: number;  // count of passing metrics
}

export interface ExistingPropertyContext {
  units?: number;
  totalSF?: number;
  stories?: number;
  parkingSpaces?: number;
  buildingFootprintSF?: number;
  yearBuilt?: number;
}

export interface ZoningContext {
  max_density_units_per_acre?: number;
  applied_far?: number;
  max_height_ft?: number;
  max_lot_coverage_pct?: number;
  min_parking_per_unit?: number;
  lot_area_sf?: number;
}

/**
 * Compute conformance metrics comparing existing building to current zoning.
 * Identifies pass/fail for each constraint and flags nonconforming items.
 */
export function computeConformanceMetrics(
  existingProperty: ExistingPropertyContext,
  zoning: ZoningContext,
  lotAreaSF: number
): ConformanceCheckData {
  const nonconformingItems: ConformanceCheckData['nonconformingItems'] = [];
  let totalConforming = 0;

  // ─── DENSITY ───
  const lotAcres = lotAreaSF / 43560;
  const allowedDensity = zoning.max_density_units_per_acre || 100;
  const currentUnits = existingProperty.units || 0;
  const densityAllowedUnits = Math.floor(allowedDensity * lotAcres);
  const densityUtilization = densityAllowedUnits > 0 ? (currentUnits / densityAllowedUnits) * 100 : 0;

  const density: ConformanceMetric = {
    current: currentUnits,
    allowed: densityAllowedUnits,
    utilization: Math.round(densityUtilization),
    passing: densityUtilization <= 100,
    severity: densityUtilization > 95 ? 'critical' : densityUtilization > 80 ? 'warning' : 'ok',
  };

  if (!density.passing) {
    nonconformingItems.push({
      item: 'Density (units)',
      detail: `Current ${currentUnits} exceeds allowed ${densityAllowedUnits}`,
    });
  } else {
    totalConforming++;
  }

  // ─── FAR ───
  const allowedFAR = zoning.applied_far || 3.0;
  const currentGFA = existingProperty.totalSF || 0;
  const allowedGFA = allowedFAR * lotAreaSF;
  const farUtilization = allowedGFA > 0 ? (currentGFA / allowedGFA) * 100 : 0;

  const far: ConformanceMetric = {
    current: currentGFA,
    allowed: Math.round(allowedGFA),
    utilization: Math.round(farUtilization),
    passing: farUtilization <= 100,
    severity: farUtilization > 95 ? 'critical' : farUtilization > 80 ? 'warning' : 'ok',
  };

  if (!far.passing) {
    nonconformingItems.push({
      item: 'FAR (Floor Area Ratio)',
      detail: `Current ${currentGFA.toLocaleString()} SF exceeds allowed ${Math.round(allowedGFA).toLocaleString()} SF`,
    });
  } else {
    totalConforming++;
  }

  // ─── HEIGHT ───
  const allowedHeight = zoning.max_height_ft || 85;
  const currentStories = existingProperty.stories || estimateStoriesFromGFA(currentGFA);
  const estimatedCurrentHeight = estimateHeightFromStories(currentStories);
  const heightUtilization = allowedHeight > 0 ? (estimatedCurrentHeight / allowedHeight) * 100 : 0;

  const height: ConformanceMetric = {
    current: estimatedCurrentHeight,
    allowed: allowedHeight,
    utilization: Math.round(heightUtilization),
    passing: heightUtilization <= 100,
    severity: heightUtilization > 95 ? 'critical' : heightUtilization > 80 ? 'warning' : 'ok',
  };

  if (!height.passing) {
    nonconformingItems.push({
      item: 'Height (stories)',
      detail: `Estimated ${currentStories} stories (${estimatedCurrentHeight}ft) exceeds allowed ${Math.round(allowedHeight)}ft`,
    });
  } else {
    totalConforming++;
  }

  // ─── COVERAGE ───
  const allowedCoveragePct = zoning.max_lot_coverage_pct || 80;
  const buildingFootprint = existingProperty.buildingFootprintSF || currentGFA / currentStories;
  const currentCoveragePct = (buildingFootprint / lotAreaSF) * 100;
  const coverageUtilization = allowedCoveragePct > 0 ? (currentCoveragePct / allowedCoveragePct) * 100 : 0;

  const coverage: ConformanceMetric = {
    current: Math.round(currentCoveragePct),
    allowed: allowedCoveragePct,
    utilization: Math.round(coverageUtilization),
    passing: coverageUtilization <= 100,
    severity: coverageUtilization > 95 ? 'critical' : coverageUtilization > 80 ? 'warning' : 'ok',
  };

  if (!coverage.passing) {
    nonconformingItems.push({
      item: 'Lot Coverage',
      detail: `Current ${Math.round(currentCoveragePct)}% exceeds allowed ${allowedCoveragePct}%`,
    });
  } else {
    totalConforming++;
  }

  // ─── PARKING ───
  const parkingRequired = Math.ceil(currentUnits * (zoning.min_parking_per_unit || 1.0));
  const currentParking = existingProperty.parkingSpaces || parkingRequired;
  const parkingUtilization = parkingRequired > 0 ? (currentParking / parkingRequired) * 100 : 0;

  const parking: ConformanceMetric = {
    current: currentParking,
    allowed: parkingRequired,
    utilization: Math.round(parkingUtilization),
    passing: parkingUtilization >= 100,  // Parking passes if >= required
    severity: parkingUtilization < 80 ? 'critical' : parkingUtilization < 95 ? 'warning' : 'ok',
  };

  if (!parking.passing) {
    nonconformingItems.push({
      item: 'Parking',
      detail: `Current ${currentParking} spaces below required ${parkingRequired} spaces`,
      grandfatheredUntil: existingProperty.yearBuilt ? `${existingProperty.yearBuilt} code` : 'prior code',
    });
  } else {
    totalConforming++;
  }

  return {
    density,
    far,
    height,
    coverage,
    parking,
    nonconformingItems,
    totalConforming,
  };
}

/**
 * Get color for utilization visualization
 */
export function getUtilizationColor(utilization: number): 'green' | 'amber' | 'red' {
  if (utilization < 80) return 'green';
  if (utilization < 95) return 'amber';
  return 'red';
}

/**
 * Get readable label for utilization status
 */
export function getUtilizationLabel(utilization: number): string {
  if (utilization < 80) return 'Within Capacity';
  if (utilization < 95) return 'High Utilization';
  return 'At/Exceeds Capacity';
}

/**
 * Estimate building height (ft) from number of stories
 * Ground floor: 14ft, upper floors: 10ft each
 */
function estimateHeightFromStories(stories: number): number {
  if (stories <= 0) return 0;
  return 14 + (stories - 1) * 10;
}

/**
 * Estimate stories from gross floor area
 * Assumes ~15,000 SF per residential floor
 */
function estimateStoriesFromGFA(gfa: number): number {
  if (gfa <= 0) return 0;
  return Math.ceil(gfa / 15000);
}

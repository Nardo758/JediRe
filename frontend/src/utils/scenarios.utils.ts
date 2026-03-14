// ═══════════════════════════════════════════════════════════════════════════════
// EXPANSION & REDEVELOPMENT SCENARIO GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

export interface ExpansionScenario {
  id: string;
  name: string;
  description: string;
  maxUnits: number;
  unitAdditions?: number;
  sfAdditions?: number;
  storiesAdditions?: number;
  approvalPath: 'by-right' | 'cup' | 'variance' | 'rezone';
  timelineMonths: { min: number; median: number; max: number };
  complianceCost?: number;  // Estimated cost to meet full compliance
  flagsCompliance: boolean; // True if triggers full code compliance
  notes?: string;
  riskLevel: 'low' | 'medium' | 'high';
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
 * Generate 4 expansion scenarios for EXISTING deals
 * Cards: No Expansion, Minor Expansion, Major Expansion, Use Conversion
 */
export function generateExpansionScenarios(
  existingProperty: ExistingPropertyContext,
  zoningMaxes: { units: number; gfa: number; stories: number },
  zoning: ZoningContext
): ExpansionScenario[] {
  const currentUnits = existingProperty.units || 0;
  const currentGFA = existingProperty.totalSF || 0;
  const currentStories = existingProperty.stories || 1;

  // Scenario 1: No Expansion (baseline)
  const noExpansion: ExpansionScenario = {
    id: 'no_expansion',
    name: 'No Expansion',
    description: 'Keep operating as-is. No capital improvements.',
    maxUnits: currentUnits,
    unitAdditions: 0,
    approvalPath: 'by-right',
    timelineMonths: { min: 0, median: 0, max: 0 },
    flagsCompliance: false,
    riskLevel: 'low',
  };

  // Scenario 2: Minor Expansion (within 10% of GFA threshold - no compliance trigger)
  // Most codes trigger at 10-25% of existing SF expansion
  const minorExpansionGFA = currentGFA * 1.10;  // 10% increase
  const minorExpansionUnits = currentUnits + 12;
  const noExpansionScenario: ExpansionScenario = {
    id: 'minor_expansion',
    name: 'Add Wing',
    description: 'Horizontal expansion without triggering full code compliance upgrade.',
    maxUnits: minorExpansionUnits,
    unitAdditions: 12,
    sfAdditions: Math.round(minorExpansionGFA - currentGFA),
    approvalPath: 'by-right',
    timelineMonths: { min: 6, median: 8, max: 12 },
    flagsCompliance: false,
    riskLevel: 'low',
    notes: 'Expansion of <15% of existing SF typically avoids triggering full ADA/parking/fire compliance.',
  };

  // Scenario 3: Major Expansion (>25% of GFA - triggers full compliance)
  // Shows compliance cost
  const majorExpansionUnits = currentUnits + 30;
  const fullComplianceCost = estimateFullComplianceCost(currentUnits, majorExpansionUnits, zoning);
  const majorExpansionScenario: ExpansionScenario = {
    id: 'major_expansion',
    name: 'Add Floor',
    description: 'Vertical expansion that triggers full ADA, parking, and fire code compliance for entire property.',
    maxUnits: majorExpansionUnits,
    unitAdditions: 30,
    sfAdditions: Math.round(currentGFA * 0.35),
    storiesAdditions: 1,
    approvalPath: 'by-right',
    timelineMonths: { min: 8, median: 12, max: 18 },
    complianceCost: fullComplianceCost,
    flagsCompliance: true,
    riskLevel: 'medium',
    notes: `Expansion >25% of existing SF triggers full code compliance upgrade. Estimated compliance cost: $${(fullComplianceCost / 1e6).toFixed(1)}M`,
  };

  // Scenario 4: Use Conversion (office/retail → residential, or add ADUs)
  const conversionUnits = currentUnits + 8;
  const conversionScenario: ExpansionScenario = {
    id: 'use_conversion',
    name: 'Use Conversion',
    description: 'Convert office or retail space to residential units, or add ADUs.',
    maxUnits: conversionUnits,
    unitAdditions: 8,
    approvalPath: 'cup',  // Conditional Use Permit typically required
    timelineMonths: { min: 12, median: 16, max: 24 },
    flagsCompliance: true,  // Change of use may trigger parking/ADA upgrades
    riskLevel: 'medium',
    notes: 'Change of use from commercial to residential may trigger different parking/density rules and may require CUP approval.',
  };

  return [noExpansion, noExpansionScenario, majorExpansionScenario, conversionScenario];
}

/**
 * Generate 4-5 redevelopment scenarios for REDEVELOPMENT deals
 * Cards: Renovate in Place, Partial Demo + Infill, Full Demo + Rebuild, Vertical Addition
 */
export function generateRedevelopmentScenarios(
  existingProperty: ExistingPropertyContext,
  zoningMaxes: { units: number; gfa: number; stories: number },
  zoning: ZoningContext
): ExpansionScenario[] {
  const currentUnits = existingProperty.units || 0;
  const currentGFA = existingProperty.totalSF || 0;
  const currentStories = existingProperty.stories || 1;
  const buildingValue = estimateBuildingValue(currentUnits, currentGFA);

  // Scenario 1: Renovate in Place
  // Keep all units, interior/exterior reno, no demolition, no compliance trigger
  const renovateInPlace: ExpansionScenario = {
    id: 'renovate_in_place',
    name: 'Renovate in Place',
    description: 'Interior and exterior renovation with no demolition. Existing unit count maintained.',
    maxUnits: currentUnits,
    unitAdditions: 0,
    approvalPath: 'by-right',
    timelineMonths: { min: 12, median: 18, max: 24 },
    complianceCost: 0,
    flagsCompliance: false,
    riskLevel: 'low',
    notes: 'No structural changes means no code upgrade required.',
  };

  // Scenario 2: Partial Demo + Infill
  // Keep 60% of building, demolish worst 40%, build new on freed footprint
  const keepUnits = Math.floor(currentUnits * 0.6);
  const demoUnits = currentUnits - keepUnits;
  const newUnits = Math.min(30, zoningMaxes.units - keepUnits);
  const partialDemoUnits = keepUnits + newUnits;
  const partialDemoCost = estimateFullComplianceCost(currentUnits, partialDemoUnits, zoning) + estimateDemoCost(demoUnits);

  const partialDemoScenario: ExpansionScenario = {
    id: 'partial_demo',
    name: 'Partial Demo + Infill',
    description: 'Demolish lower-performing buildings, keep better-performing assets, build new on freed footprint.',
    maxUnits: partialDemoUnits,
    unitAdditions: newUnits,
    approvalPath: 'by-right',
    timelineMonths: { min: 18, median: 24, max: 36 },
    complianceCost: partialDemoCost,
    flagsCompliance: true,
    riskLevel: 'medium',
    notes: `Keep ${keepUnits} units, demo ${demoUnits} units, add ${newUnits} new units. Triggers full code compliance.`,
  };

  // Scenario 3: Full Demo + Ground-Up
  // Demolish everything, build maximum zoning envelope
  const fullDemoCost = estimateDemoCost(currentUnits) + estimateHazmatCost(currentGFA, existingProperty.yearBuilt);
  const fullDemoUnits = zoningMaxes.units;

  const fullDemoScenario: ExpansionScenario = {
    id: 'full_demo',
    name: 'Full Demo + Rebuild',
    description: 'Demolish entire existing structure and rebuild to maximum zoning envelope.',
    maxUnits: fullDemoUnits,
    unitAdditions: fullDemoUnits - currentUnits,
    storiesAdditions: zoningMaxes.stories - currentStories,
    approvalPath: 'by-right',
    timelineMonths: { min: 24, median: 30, max: 42 },
    complianceCost: fullDemoCost,
    flagsCompliance: true,
    riskLevel: 'high',
    notes: `Full development scenario. Demo cost ~$${(fullDemoCost / 1e6).toFixed(1)}M. Total project ~36+ months.`,
  };

  // Scenario 4: Vertical Addition
  // Add floors to existing structure (if structurally feasible)
  const additionalFloors = zoningMaxes.stories - currentStories;
  const additionalUnits = Math.min(40, additionalFloors * 20);  // Assume 20 units/floor
  const verticalAdditionUnits = currentUnits + additionalUnits;
  const structuralUpgradeCost = estimateStructuralUpgradeCost(currentGFA, additionalFloors);

  const verticalAdditionScenario: ExpansionScenario = {
    id: 'vertical_addition',
    name: 'Add Floors (Vertical)',
    description: 'Add new floors on top of existing structure. Requires structural engineering analysis.',
    maxUnits: verticalAdditionUnits,
    unitAdditions: additionalUnits,
    storiesAdditions: additionalFloors,
    approvalPath: 'by-right',
    timelineMonths: { min: 16, median: 20, max: 28 },
    complianceCost: structuralUpgradeCost,
    flagsCompliance: true,
    riskLevel: 'medium',
    notes: `Feasibility depends on structural capacity. Requires structural engineer review. Estimated structural upgrade cost: $${(structuralUpgradeCost / 1e6).toFixed(1)}M.`,
  };

  return [renovateInPlace, partialDemoScenario, fullDemoScenario, verticalAdditionScenario];
}

/**
 * Compute compliance trigger costs
 */
export interface ComplianceTrigger {
  item: string;
  estimatedCost: number;
}

export function computeComplianceCosts(
  units: number,
  expansionRatio: number = 0.5  // 50% expansion threshold
): ComplianceTrigger[] {
  const triggers: ComplianceTrigger[] = [];

  if (expansionRatio > 0.25) {
    // Typical compliance triggers when expansion exceeds 25% of building value
    triggers.push({
      item: 'ADA Accessibility Upgrade',
      estimatedCost: 380000,
    });
    triggers.push({
      item: 'Parking Code Compliance (new spaces)',
      estimatedCost: Math.max(100000, units * 5000),
    });
    triggers.push({
      item: 'Fire/Life Safety Sprinkler Retrofit',
      estimatedCost: 220000,
    });
    triggers.push({
      item: 'Energy Code Envelope Upgrade',
      estimatedCost: 450000,
    });
  }

  return triggers;
}

// ═════════════════════════════════════════════════════════════════════════════
// COST ESTIMATION HELPERS
// ═════════════════════════════════════════════════════════════════════════════

function estimateFullComplianceCost(currentUnits: number, newUnits: number, zoning: ZoningContext): number {
  // ADA upgrade (~$380K), parking (~$5K/space), fire safety (~$220K), energy code (~$450K)
  const additionalUnits = Math.max(0, newUnits - currentUnits);
  const parkingCost = additionalUnits * 5000;  // $5K per new space needed
  return 380000 + parkingCost + 220000 + 450000;  // Total ~$1.05M baseline + parking
}

function estimateDemoCost(units: number): number {
  // $15K per unit for demolition labor, equipment, haul-away
  return units * 15000;
}

function estimateHazmatCost(gfa: number, yearBuilt?: number): number {
  // Hazmat survey + abatement if pre-1980 (asbestos, lead)
  if (!yearBuilt || yearBuilt < 1980) {
    return Math.round(gfa * 2);  // $2/SF for hazmat remediation (conservative)
  }
  return 0;
}

function estimateStructuralUpgradeCost(gfa: number, additionalFloors: number): number {
  // Foundation reinforcement, shear wall upgrades, etc.
  // Rough estimate: $50-100 per SF for structural upgrades
  return Math.round(gfa * additionalFloors * 75);
}

function estimateBuildingValue(units: number, gfa: number): number {
  // Rough estimate: $250K per unit or $100/SF, whichever is higher
  return Math.max(units * 250000, gfa * 100);
}

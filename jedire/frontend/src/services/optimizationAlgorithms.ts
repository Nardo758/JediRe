/**
 * Optimization Algorithms
 * 
 * Core mathematical algorithms for real estate development optimization.
 * Contains unit mix, parking, amenity, and massing generation logic.
 */

import type {
  MarketDemandData,
  ParcelData,
  ZoningRequirements,
  ConstructionCosts,
  OptimizationOptions
} from './designOptimizer.service';

// ============================================================================
// TYPES
// ============================================================================

export interface UnitMixParams {
  marketData: MarketDemandData;
  parcel: ParcelData;
  zoning: ZoningRequirements;
  options: OptimizationOptions;
}

export interface UnitMixResult {
  studio: number;
  oneBR: number;
  twoBR: number;
  threeBR: number;
  totalUnits: number;
  avgUnitSqft: number;
  projectedNOI: number;
  projectedGrossRent: number;
  estimatedConstructionCost: number;
  absorptionMonths: number;
  confidenceScore: number;
  reasoning: string[];
}

export interface ParkingParams {
  unitCount: number;
  unitMix: UnitMixResult;
  zoning: ZoningRequirements;
  costs: ConstructionCosts;
  parcel: ParcelData;
  options: OptimizationOptions;
}

export interface ParkingResult {
  spaces: number;
  ratio: number; // spaces per unit
  type: 'surface' | 'podium' | 'structured' | 'mixed';
  surfaceSpaces: number;
  structuredSpaces: number;
  constructionCost: number;
  annualOperatingCost: number;
  landUseSqft: number;
  costPerSpace: number;
  reasoning: string[];
}

export interface AmenityParams {
  unitCount: number;
  unitMix: UnitMixResult;
  marketData: MarketDemandData;
  costs: ConstructionCosts;
  options: OptimizationOptions;
}

export interface AmenityResult {
  amenities: Array<{
    name: string;
    type: 'fitness' | 'social' | 'outdoor' | 'business' | 'wellness';
    sqft: number;
    cost: number;
    rentPremium: number; // monthly per unit
    roi: number; // annual
    priority: 'must-have' | 'recommended' | 'nice-to-have';
  }>;
  totalSqft: number;
  totalCost: number;
  rentPremiumTotal: number; // annual
  paybackYears: number;
  reasoning: string[];
}

export interface MassingParams {
  parcel: ParcelData;
  zoning: ZoningRequirements;
  unitCount: number;
  unitMix: UnitMixResult;
}

export interface MassingResult {
  buildingFootprint: {
    type: 'Polygon';
    coordinates: number[][][];
    sqft: number;
  };
  floors: number;
  totalGrossSqft: number;
  floorPlateGrossSqft: number;
  farUtilization: number;
  heightFt: number;
  geometry3D: {
    vertices: Array<{ x: number; y: number; z: number }>;
    faces: Array<number[]>;
  };
  warnings: string[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

const UNIT_SIZES = {
  studio: 600,
  oneBR: 750,
  twoBR: 1000,
  threeBR: 1300
};

const CONSTRUCTION_COST_PSF = 250; // Base cost per sqft
const FLOOR_TO_FLOOR_HEIGHT = 10; // feet
const OPERATING_EXPENSE_RATIO = 0.40; // 40% of gross rent

// ============================================================================
// UNIT MIX OPTIMIZATION
// ============================================================================

export function optimizeUnitMixAlgorithm(params: UnitMixParams): UnitMixResult {
  const { marketData, parcel, zoning, options } = params;
  const reasoning: string[] = [];

  // Calculate maximum buildable GFA
  const maxGFA = parcel.lotSizeSqft * parcel.zoningFAR;
  const netUsableArea = maxGFA * zoning.buildingEfficiency;

  // Weight each unit type by NOI contribution per sqft
  const unitTypes = ['studio', 'oneBR', 'twoBR', 'threeBR'] as const;
  const scores: Record<string, number> = {};

  unitTypes.forEach(type => {
    const size = UNIT_SIZES[type];
    const rentPSF = marketData[`${type}RentPSF` as keyof MarketDemandData] as number;
    const absorption = marketData[`${type}Absorption` as keyof MarketDemandData] as number;
    
    // Monthly rent per unit
    const monthlyRent = size * rentPSF;
    const annualRent = monthlyRent * 12;
    
    // NOI per unit (after operating expenses)
    const noiPerUnit = annualRent * (1 - OPERATING_EXPENSE_RATIO);
    
    // Score: NOI per sqft * absorption rate (demand factor)
    const noiPerSqft = noiPerUnit / size;
    const demandFactor = Math.min(absorption / 5, 1.5); // Cap at 1.5x
    scores[type] = noiPerSqft * demandFactor;
  });

  reasoning.push(`NOI scores: Studio=${scores.studio.toFixed(2)}, 1BR=${scores.oneBR.toFixed(2)}, 2BR=${scores.twoBR.toFixed(2)}, 3BR=${scores.threeBR.toFixed(2)}`);

  // Greedy algorithm: Fill with highest-scoring unit type until space runs out
  // But maintain diversity for risk mitigation (min 15% each for top 3 types)
  const mix: Record<string, number> = { studio: 0, oneBR: 0, twoBR: 0, threeBR: 0 };
  let remainingArea = netUsableArea;

  // Sort by score
  const sortedTypes = [...unitTypes].sort((a, b) => scores[b] - scores[a]);
  
  // First pass: Allocate minimum 15% to top 3 unit types for diversification
  const minUnitsPerType = Math.floor(netUsableArea / UNIT_SIZES.oneBR * 0.15);
  sortedTypes.slice(0, 3).forEach(type => {
    const unitsToAdd = minUnitsPerType;
    mix[type] = unitsToAdd;
    remainingArea -= unitsToAdd * UNIT_SIZES[type];
  });

  reasoning.push(`Minimum diversification: 15% each for top 3 unit types`);

  // Second pass: Allocate remaining space to maximize NOI
  while (remainingArea > UNIT_SIZES.threeBR) {
    let bestType: string | null = null;
    let bestScore = 0;

    sortedTypes.forEach(type => {
      if (remainingArea >= UNIT_SIZES[type] && scores[type] > bestScore) {
        bestScore = scores[type];
        bestType = type;
      }
    });

    if (!bestType) break;
    
    mix[bestType]++;
    remainingArea -= UNIT_SIZES[bestType];
  }

  // Calculate totals
  const totalUnits = mix.studio + mix.oneBR + mix.twoBR + mix.threeBR;
  const totalSqft = 
    mix.studio * UNIT_SIZES.studio +
    mix.oneBR * UNIT_SIZES.oneBR +
    mix.twoBR * UNIT_SIZES.twoBR +
    mix.threeBR * UNIT_SIZES.threeBR;
  
  const avgUnitSqft = totalSqft / totalUnits;

  // Calculate projected financials
  const projectedGrossRent =
    mix.studio * UNIT_SIZES.studio * marketData.studioRentPSF * 12 +
    mix.oneBR * UNIT_SIZES.oneBR * marketData.oneBrRentPSF * 12 +
    mix.twoBR * UNIT_SIZES.twoBR * marketData.twoBrRentPSF * 12 +
    mix.threeBR * UNIT_SIZES.threeBR * marketData.threeBrRentPSF * 12;

  const projectedNOI = projectedGrossRent * (1 - OPERATING_EXPENSE_RATIO);
  const estimatedConstructionCost = totalSqft * CONSTRUCTION_COST_PSF;

  // Calculate absorption (weighted by unit type)
  const absorptionMonths = Math.max(
    mix.studio / Math.max(marketData.studioAbsorption, 0.5),
    mix.oneBR / Math.max(marketData.oneBrAbsorption, 0.5),
    mix.twoBR / Math.max(marketData.twoBrAbsorption, 0.5),
    mix.threeBR / Math.max(marketData.threeBrAbsorption, 0.5)
  );

  // Confidence score based on market balance
  const distribution = [
    mix.studio / totalUnits,
    mix.oneBR / totalUnits,
    mix.twoBR / totalUnits,
    mix.threeBR / totalUnits
  ];
  const entropy = -distribution.reduce((sum, p) => p > 0 ? sum + p * Math.log(p) : sum, 0);
  const maxEntropy = Math.log(4);
  const confidenceScore = 0.5 + (entropy / maxEntropy) * 0.5; // 0.5 to 1.0

  reasoning.push(`Total units: ${totalUnits}, Average size: ${avgUnitSqft.toFixed(0)} sqft`);
  reasoning.push(`Projected NOI: $${(projectedNOI / 1000).toFixed(0)}k/year`);
  reasoning.push(`Estimated absorption: ${absorptionMonths.toFixed(1)} months`);

  return {
    studio: mix.studio,
    oneBR: mix.oneBR,
    twoBR: mix.twoBR,
    threeBR: mix.threeBR,
    totalUnits,
    avgUnitSqft,
    projectedNOI,
    projectedGrossRent,
    estimatedConstructionCost,
    absorptionMonths,
    confidenceScore,
    reasoning
  };
}

// ============================================================================
// PARKING OPTIMIZATION
// ============================================================================

export function optimizeParkingAlgorithm(params: ParkingParams): ParkingResult {
  const { unitCount, zoning, costs, parcel, options } = params;
  const reasoning: string[] = [];

  // Minimum required parking
  const minSpaces = Math.ceil(unitCount * zoning.parkingRatioMin);
  const maxSpaces = zoning.parkingRatioMax 
    ? Math.ceil(unitCount * zoning.parkingRatioMax)
    : Math.ceil(unitCount * 2.0);

  reasoning.push(`Required parking: ${minSpaces} spaces (ratio ${zoning.parkingRatioMin})`);

  // Calculate land availability for surface parking
  const buildingFootprintEstimate = parcel.lotSizeSqft * 0.4; // 40% coverage typical
  const availableForParking = parcel.lotSizeSqft - buildingFootprintEstimate;
  const surfaceParkingSqftPerSpace = 350; // Including circulation
  const maxSurfaceSpaces = Math.floor(availableForParking / surfaceParkingSqftPerSpace);

  reasoning.push(`Maximum surface parking: ${maxSurfaceSpaces} spaces`);

  // Decision logic based on cost-benefit
  let type: ParkingResult['type'];
  let spaces: number;
  let surfaceSpaces: number;
  let structuredSpaces: number;
  let constructionCost: number;

  if (minSpaces <= maxSurfaceSpaces * 0.8) {
    // Surface parking is sufficient and most cost-effective
    type = 'surface';
    spaces = minSpaces;
    surfaceSpaces = spaces;
    structuredSpaces = 0;
    constructionCost = spaces * costs.surfaceParkingPerSpace;
    reasoning.push('Surface parking selected: most cost-effective solution');
  } else if (minSpaces <= maxSurfaceSpaces) {
    // Tight fit with surface parking
    type = 'surface';
    spaces = minSpaces;
    surfaceSpaces = spaces;
    structuredSpaces = 0;
    constructionCost = spaces * costs.surfaceParkingPerSpace;
    reasoning.push('Surface parking at capacity: consider structured for future flexibility');
  } else {
    // Need structured parking
    const ratio = options?.riskTolerance === 'aggressive' ? 1.2 : 1.0;
    spaces = Math.ceil(minSpaces * ratio);
    surfaceSpaces = maxSurfaceSpaces;
    structuredSpaces = spaces - surfaceSpaces;

    // Choose between podium and structured based on project size
    const avgCost = unitCount > 100 
      ? costs.podiumParkingPerSpace 
      : costs.structuredParkingPerSpace;
    
    type = unitCount > 100 ? 'podium' : 'structured';
    
    constructionCost = 
      surfaceSpaces * costs.surfaceParkingPerSpace +
      structuredSpaces * avgCost;

    reasoning.push(`Mixed parking: ${surfaceSpaces} surface + ${structuredSpaces} ${type}`);
  }

  const ratio = spaces / unitCount;
  const costPerSpace = constructionCost / spaces;
  const landUseSqft = surfaceSpaces * surfaceParkingSqftPerSpace;
  
  // Operating costs: $500-800/space/year for structured, $100/space/year for surface
  const annualOperatingCost = 
    surfaceSpaces * 100 + 
    structuredSpaces * (type === 'podium' ? 600 : 700);

  reasoning.push(`Total cost: $${(constructionCost / 1000).toFixed(0)}k ($${costPerSpace.toFixed(0)}/space)`);
  reasoning.push(`Annual operating: $${(annualOperatingCost / 1000).toFixed(0)}k`);

  return {
    spaces,
    ratio,
    type,
    surfaceSpaces,
    structuredSpaces,
    constructionCost,
    annualOperatingCost,
    landUseSqft,
    costPerSpace,
    reasoning
  };
}

// ============================================================================
// AMENITY OPTIMIZATION
// ============================================================================

export function optimizeAmenitiesAlgorithm(params: AmenityParams): AmenityResult {
  const { unitCount, marketData, costs, options } = params;
  const reasoning: string[] = [];

  // Amenity library with typical metrics
  const amenityLibrary = [
    {
      name: 'Fitness Center',
      type: 'fitness' as const,
      sqftPerUnit: 20,
      costPSF: 150,
      rentPremiumPerUnit: 25, // monthly
      minUnits: 50,
      priority: 'must-have' as const
    },
    {
      name: 'Pool',
      type: 'outdoor' as const,
      sqftPerUnit: 30,
      costPSF: 200,
      rentPremiumPerUnit: 35,
      minUnits: 75,
      priority: 'recommended' as const
    },
    {
      name: 'Clubhouse / Lounge',
      type: 'social' as const,
      sqftPerUnit: 15,
      costPSF: 120,
      rentPremiumPerUnit: 20,
      minUnits: 30,
      priority: 'must-have' as const
    },
    {
      name: 'Business Center',
      type: 'business' as const,
      sqftPerUnit: 10,
      costPSF: 100,
      rentPremiumPerUnit: 15,
      minUnits: 75,
      priority: 'recommended' as const
    },
    {
      name: 'Dog Park',
      type: 'outdoor' as const,
      sqftPerUnit: 25,
      costPSF: 50,
      rentPremiumPerUnit: 20,
      minUnits: 50,
      priority: 'nice-to-have' as const
    },
    {
      name: 'Yoga Studio',
      type: 'wellness' as const,
      sqftPerUnit: 12,
      costPSF: 130,
      rentPremiumPerUnit: 18,
      minUnits: 100,
      priority: 'nice-to-have' as const
    },
    {
      name: 'Rooftop Terrace',
      type: 'outdoor' as const,
      sqftPerUnit: 20,
      costPSF: 80,
      rentPremiumPerUnit: 30,
      minUnits: 75,
      priority: 'recommended' as const
    },
    {
      name: 'Package Lockers',
      type: 'business' as const,
      sqftPerUnit: 2,
      costPSF: 500,
      rentPremiumPerUnit: 5,
      minUnits: 20,
      priority: 'must-have' as const
    }
  ];

  // Filter by unit count threshold
  const eligibleAmenities = amenityLibrary.filter(a => unitCount >= a.minUnits);

  // Calculate ROI for each amenity
  const scoredAmenities = eligibleAmenities.map(amenity => {
    const sqft = Math.ceil(amenity.sqftPerUnit * unitCount);
    const cost = sqft * amenity.costPSF;
    const annualRentPremium = amenity.rentPremiumPerUnit * 12 * unitCount;
    const roi = annualRentPremium / cost;
    
    return {
      ...amenity,
      sqft,
      cost,
      rentPremium: amenity.rentPremiumPerUnit,
      roi
    };
  });

  // Selection strategy: Must-haves + best ROI
  const selected: typeof scoredAmenities = scoredAmenities.filter(a => a.priority === 'must-have');
  reasoning.push(`Must-have amenities: ${selected.map(a => a.name).join(', ')}`);

  // Add recommended amenities with ROI > 0.15 (15% annual return)
  const recommended = scoredAmenities
    .filter(a => a.priority === 'recommended' && a.roi > 0.15)
    .sort((a, b) => b.roi - a.roi);

  recommended.forEach(amenity => {
    selected.push(amenity);
    reasoning.push(`Added ${amenity.name}: ${(amenity.roi * 100).toFixed(0)}% ROI`);
  });

  // Add nice-to-haves only if aggressive risk tolerance and ROI > 0.20
  if (options?.riskTolerance === 'aggressive') {
    const niceToHave = scoredAmenities
      .filter(a => a.priority === 'nice-to-have' && a.roi > 0.20)
      .sort((a, b) => b.roi - a.roi)
      .slice(0, 2); // Max 2 nice-to-haves

    niceToHave.forEach(amenity => {
      selected.push(amenity);
      reasoning.push(`Premium amenity: ${amenity.name} (${(amenity.roi * 100).toFixed(0)}% ROI)`);
    });
  }

  // Calculate totals
  const totalSqft = selected.reduce((sum, a) => sum + a.sqft, 0);
  const totalCost = selected.reduce((sum, a) => sum + a.cost, 0);
  const rentPremiumTotal = selected.reduce((sum, a) => sum + a.rentPremium * 12 * unitCount, 0);
  const paybackYears = totalCost / rentPremiumTotal;

  reasoning.push(`Total amenity investment: $${(totalCost / 1000).toFixed(0)}k`);
  reasoning.push(`Annual rent premium: $${(rentPremiumTotal / 1000).toFixed(0)}k (${paybackYears.toFixed(1)} year payback)`);

  return {
    amenities: selected,
    totalSqft,
    totalCost,
    rentPremiumTotal,
    paybackYears,
    reasoning
  };
}

// ============================================================================
// MASSING GENERATION
// ============================================================================

export function generateMassingGeometry(params: MassingParams): MassingResult {
  const { parcel, zoning, unitCount, unitMix } = params;
  const warnings: string[] = [];

  // Calculate required gross square footage
  const avgUnitSqft = unitMix.avgUnitSqft;
  const totalUnitSqft = unitCount * avgUnitSqft;
  const grossUpFactor = 1 / zoning.buildingEfficiency;
  const totalGrossSqft = totalUnitSqft * grossUpFactor;

  // Determine optimal floor count
  const maxGFA = parcel.lotSizeSqft * parcel.zoningFAR;
  const minFootprint = 5000; // Minimum practical floor plate
  const maxFootprint = Math.min(parcel.lotSizeSqft * 0.5, 25000); // Max 50% coverage or 25k sqft

  let floors: number;
  let floorPlateGrossSqft: number;

  if (totalGrossSqft <= maxFootprint) {
    // Single floor possible
    floors = 1;
    floorPlateGrossSqft = totalGrossSqft;
    warnings.push('Single-story building: Consider multi-story for better land use');
  } else {
    // Multi-story required
    floorPlateGrossSqft = Math.min(maxFootprint, totalGrossSqft / 3); // Target 3+ floors
    floors = Math.ceil(totalGrossSqft / floorPlateGrossSqft);

    // Check against max stories
    if (parcel.maxStories && floors > parcel.maxStories) {
      floors = parcel.maxStories;
      floorPlateGrossSqft = totalGrossSqft / floors;
      
      if (floorPlateGrossSqft > maxFootprint) {
        warnings.push('Floor plate exceeds optimal size: Consider zoning variance');
      }
    }
  }

  const heightFt = floors * FLOOR_TO_FLOOR_HEIGHT;
  const farUtilization = totalGrossSqft / parcel.lotSizeSqft;

  // Generate simple rectangular footprint
  // If parcel has geometry, use it; otherwise create square
  let footprintCoordinates: number[][][];
  let footprintSqft: number;

  if (parcel.geometry) {
    // Simplified: Use parcel geometry but scale to target footprint
    const parcelCoords = parcel.geometry.coordinates[0];
    const scale = Math.sqrt(floorPlateGrossSqft / parcel.lotSizeSqft);
    
    // Apply setbacks (simplified)
    const setbackFt = Math.max(
      parcel.setbacks?.front || 20,
      parcel.setbacks?.side || 15,
      parcel.setbacks?.rear || 20
    );
    
    footprintCoordinates = [parcelCoords]; // In production, apply actual setback geometry
    footprintSqft = floorPlateGrossSqft;
  } else {
    // Create rectangular footprint
    const ratio = 0.6; // Width to length ratio (60%)
    const width = Math.sqrt(floorPlateGrossSqft * ratio);
    const length = floorPlateGrossSqft / width;
    
    footprintCoordinates = [[
      [0, 0],
      [width, 0],
      [width, length],
      [0, length],
      [0, 0]
    ]];
    footprintSqft = floorPlateGrossSqft;
  }

  // Generate 3D geometry (simplified box for Three.js)
  const vertices: Array<{ x: number; y: number; z: number }> = [];
  const faces: Array<number[]> = [];

  // Base vertices (z=0)
  footprintCoordinates[0].forEach(([x, y]) => {
    vertices.push({ x, y, z: 0 });
  });

  // Top vertices (z=height)
  footprintCoordinates[0].forEach(([x, y]) => {
    vertices.push({ x, y, z: heightFt });
  });

  // Generate faces (simplified - just vertical walls)
  const baseCount = footprintCoordinates[0].length - 1; // Exclude closing point
  for (let i = 0; i < baseCount; i++) {
    const next = (i + 1) % baseCount;
    // Two triangles per wall face
    faces.push([i, next, next + baseCount]);
    faces.push([i, next + baseCount, i + baseCount]);
  }

  if (farUtilization > parcel.zoningFAR * 1.05) {
    warnings.push(`FAR utilization ${farUtilization.toFixed(2)} exceeds zoning ${parcel.zoningFAR}`);
  }

  return {
    buildingFootprint: {
      type: 'Polygon',
      coordinates: footprintCoordinates,
      sqft: footprintSqft
    },
    floors,
    totalGrossSqft,
    floorPlateGrossSqft,
    farUtilization,
    heightFt,
    geometry3D: {
      vertices,
      faces
    },
    warnings
  };
}

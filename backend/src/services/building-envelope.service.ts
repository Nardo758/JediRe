export type PropertyType = 'multifamily' | 'office' | 'retail' | 'industrial' | 'mixed-use' | 'hospitality';

export interface PropertyTypeConfig {
  avgUnitSize: number;
  floorHeight: number;
  densityMetric: string;
  parkingRatio: number;
  parkingRatioUnit: string;
  revenueMetric: string;
  defaultRevenue: number;
  capRate: number;
  expenseRatio: number;
}

export const PROPERTY_TYPE_CONFIGS: Record<PropertyType, PropertyTypeConfig> = {
  multifamily: {
    avgUnitSize: 850,
    floorHeight: 10,
    densityMetric: 'units/acre',
    parkingRatio: 1,
    parkingRatioUnit: 'per unit',
    revenueMetric: 'rent/unit/month',
    defaultRevenue: 1800,
    capRate: 0.05,
    expenseRatio: 0.40,
  },
  office: {
    avgUnitSize: 5000,
    floorHeight: 13,
    densityMetric: 'FAR',
    parkingRatio: 3,
    parkingRatioUnit: 'per 1000 sqft',
    revenueMetric: '$/psf/year',
    defaultRevenue: 28,
    capRate: 0.07,
    expenseRatio: 0.45,
  },
  retail: {
    avgUnitSize: 3000,
    floorHeight: 14,
    densityMetric: 'FAR',
    parkingRatio: 4,
    parkingRatioUnit: 'per 1000 sqft',
    revenueMetric: '$/psf/year NNN',
    defaultRevenue: 32,
    capRate: 0.065,
    expenseRatio: 0.30,
  },
  industrial: {
    avgUnitSize: 10000,
    floorHeight: 24,
    densityMetric: 'FAR',
    parkingRatio: 1,
    parkingRatioUnit: 'per 1000 sqft',
    revenueMetric: '$/psf/year',
    defaultRevenue: 8,
    capRate: 0.06,
    expenseRatio: 0.25,
  },
  'mixed-use': {
    avgUnitSize: 850,
    floorHeight: 12,
    densityMetric: 'FAR',
    parkingRatio: 1,
    parkingRatioUnit: 'per unit',
    revenueMetric: 'blended',
    defaultRevenue: 0,
    capRate: 0.06,
    expenseRatio: 0.38,
  },
  hospitality: {
    avgUnitSize: 400,
    floorHeight: 10,
    densityMetric: 'rooms/acre',
    parkingRatio: 0.8,
    parkingRatioUnit: 'per room',
    revenueMetric: 'ADR',
    defaultRevenue: 150,
    capRate: 0.08,
    expenseRatio: 0.55,
  },
};

export interface Setbacks {
  front: number;
  side: number;
  rear: number;
}

export interface LotDimensions {
  frontage: number;
  depth: number;
}

export interface ZoningConstraints {
  maxDensity?: number | null;
  maxFAR?: number | null;
  maxHeight?: number | null;
  maxStories?: number | null;
  minParkingPerUnit?: number | null;
  maxLotCoverage?: number | null;
}

export interface DensityBonuses {
  affordableBonusPercent?: number;
  tdrBonusPercent?: number;
}

export interface BuildingEnvelopeInputs {
  landArea: number;
  setbacks: Setbacks;
  lotDimensions?: LotDimensions | null;
  zoningConstraints: ZoningConstraints;
  propertyType: PropertyType;
  densityBonuses?: DensityBonuses | null;
}

export interface CapacityByConstraint {
  byDensity: number | null;
  byFAR: number | null;
  byHeight: number | null;
  byParking: number | null;
}

export interface BuildingEnvelopeResult {
  buildableArea: number;
  maxFootprint: number;
  maxFloors: number;
  maxGFA: number;
  maxCapacity: number;
  capacityByConstraint: CapacityByConstraint;
  limitingFactor: string;
  parkingRequired: number;
  parkingArea: { surface: number; structured: number };
  propertyType: PropertyType;
  config: PropertyTypeConfig;
}

export interface RevenueAssumptions {
  multifamily?: number;
  office?: number;
  retail?: number;
  industrial?: number;
  hospitality?: { adr: number; occupancy: number };
}

export interface HighestBestUseResult {
  propertyType: PropertyType;
  maxCapacity: number;
  maxGFA: number;
  annualGrossRevenue: number;
  estimatedNOI: number;
  estimatedValue: number;
  capRate: number;
  expenseRatio: number;
  limitingFactor: string;
  recommended: boolean;
  reasoning: string;
}

export class BuildingEnvelopeService {
  calculateEnvelope(inputs: BuildingEnvelopeInputs): BuildingEnvelopeResult {
    const config = PROPERTY_TYPE_CONFIGS[inputs.propertyType];
    const { landArea, setbacks, lotDimensions, zoningConstraints, densityBonuses } = inputs;

    const buildableArea = this.calculateBuildableArea(landArea, setbacks, lotDimensions);

    const lotCoverageFraction = zoningConstraints.maxLotCoverage != null
      ? zoningConstraints.maxLotCoverage / 100
      : 1.0;
    const maxFootprint = buildableArea * lotCoverageFraction;

    const maxFloors = this.calculateMaxFloors(zoningConstraints, config.floorHeight);

    let maxGFA = maxFootprint * maxFloors;
    if (zoningConstraints.maxFAR != null) {
      const farLimit = zoningConstraints.maxFAR * landArea;
      maxGFA = Math.min(maxGFA, farLimit);
    }

    const bonusMultiplier = this.getBonusMultiplier(densityBonuses);

    const capacityByConstraint = this.calculateCapacityByConstraint(
      inputs, config, maxFootprint, maxFloors
    );

    const constraintEntries: [string, number | null][] = [
      ['density', capacityByConstraint.byDensity],
      ['FAR', capacityByConstraint.byFAR],
      ['height', capacityByConstraint.byHeight],
      ['parking', capacityByConstraint.byParking],
    ];

    const validConstraints = constraintEntries.filter(([, v]) => v != null) as [string, number][];
    let limitingFactor = 'none';
    let maxCapacity: number;

    if (validConstraints.length > 0) {
      validConstraints.sort((a, b) => a[1] - b[1]);
      limitingFactor = validConstraints[0][0];
      maxCapacity = Math.floor(validConstraints[0][1] * bonusMultiplier);
    } else {
      maxCapacity = Math.floor((maxGFA / config.avgUnitSize) * bonusMultiplier);
    }

    const parkingRequired = this.calculateParkingRequired(maxCapacity, maxGFA, config, zoningConstraints);
    const parkingArea = {
      surface: Math.ceil(parkingRequired * 350),
      structured: Math.ceil(parkingRequired * 300),
    };

    return {
      buildableArea: Math.round(buildableArea * 100) / 100,
      maxFootprint: Math.round(maxFootprint * 100) / 100,
      maxFloors,
      maxGFA: Math.round(maxGFA * 100) / 100,
      maxCapacity,
      capacityByConstraint,
      limitingFactor,
      parkingRequired: Math.ceil(parkingRequired),
      parkingArea,
      propertyType: inputs.propertyType,
      config,
    };
  }

  calculateHighestBestUse(
    inputs: Omit<BuildingEnvelopeInputs, 'propertyType'>,
    revenueAssumptions?: RevenueAssumptions
  ): HighestBestUseResult[] {
    const propertyTypes: PropertyType[] = [
      'multifamily', 'office', 'retail', 'industrial', 'mixed-use', 'hospitality'
    ];

    const results: HighestBestUseResult[] = propertyTypes.map((type) => {
      const envelope = this.calculateEnvelope({ ...inputs, propertyType: type });
      const config = PROPERTY_TYPE_CONFIGS[type];

      const annualGrossRevenue = this.calculateAnnualRevenue(
        type, envelope.maxCapacity, envelope.maxGFA, config, revenueAssumptions
      );
      const estimatedNOI = annualGrossRevenue * (1 - config.expenseRatio);
      const estimatedValue = config.capRate > 0 ? estimatedNOI / config.capRate : 0;

      const reasoning = this.buildReasoning(
        type, envelope, annualGrossRevenue, estimatedNOI, estimatedValue, config
      );

      return {
        propertyType: type,
        maxCapacity: envelope.maxCapacity,
        maxGFA: envelope.maxGFA,
        annualGrossRevenue: Math.round(annualGrossRevenue * 100) / 100,
        estimatedNOI: Math.round(estimatedNOI * 100) / 100,
        estimatedValue: Math.round(estimatedValue * 100) / 100,
        capRate: config.capRate,
        expenseRatio: config.expenseRatio,
        limitingFactor: envelope.limitingFactor,
        recommended: false,
        reasoning,
      };
    });

    results.sort((a, b) => b.estimatedValue - a.estimatedValue);

    if (results.length > 0) {
      results[0].recommended = true;
    }

    return results;
  }

  private calculateBuildableArea(
    landArea: number,
    setbacks: Setbacks,
    lotDimensions?: LotDimensions | null
  ): number {
    if (lotDimensions && lotDimensions.frontage > 0 && lotDimensions.depth > 0) {
      const effectiveWidth = Math.max(0, lotDimensions.frontage - (2 * setbacks.side));
      const effectiveDepth = Math.max(0, lotDimensions.depth - setbacks.front - setbacks.rear);
      return effectiveWidth * effectiveDepth;
    }

    const side = Math.sqrt(landArea);
    const effectiveWidth = Math.max(0, side - (2 * setbacks.side));
    const effectiveDepth = Math.max(0, side - setbacks.front - setbacks.rear);
    return effectiveWidth * effectiveDepth;
  }

  private calculateMaxFloors(constraints: ZoningConstraints, floorHeight: number): number {
    const byHeight = constraints.maxHeight != null
      ? Math.floor(constraints.maxHeight / floorHeight)
      : Infinity;
    const byStories = constraints.maxStories != null
      ? constraints.maxStories
      : Infinity;

    const result = Math.min(byHeight, byStories);
    return result === Infinity ? 1 : result;
  }

  private getBonusMultiplier(bonuses?: DensityBonuses | null): number {
    if (!bonuses) return 1.0;
    let totalBonus = 0;
    if (bonuses.affordableBonusPercent) totalBonus += bonuses.affordableBonusPercent;
    if (bonuses.tdrBonusPercent) totalBonus += bonuses.tdrBonusPercent;
    return 1 + totalBonus / 100;
  }

  private calculateCapacityByConstraint(
    inputs: BuildingEnvelopeInputs,
    config: PropertyTypeConfig,
    maxFootprint: number,
    maxFloors: number
  ): CapacityByConstraint {
    const { landArea, zoningConstraints } = inputs;
    const acres = landArea / 43560;

    const byDensity = zoningConstraints.maxDensity != null
      ? Math.floor(zoningConstraints.maxDensity * acres)
      : null;

    const byFAR = zoningConstraints.maxFAR != null
      ? Math.floor((zoningConstraints.maxFAR * landArea) / config.avgUnitSize)
      : null;

    const byHeight = maxFloors > 0
      ? Math.floor((maxFootprint * maxFloors) / config.avgUnitSize)
      : null;

    let byParking: number | null = null;
    if (zoningConstraints.minParkingPerUnit != null && zoningConstraints.minParkingPerUnit > 0) {
      if (config.parkingRatioUnit === 'per unit' || config.parkingRatioUnit === 'per room') {
        const parkingRatio = zoningConstraints.minParkingPerUnit;
        const availableSpaces = (landArea * 0.3) / 350;
        byParking = Math.floor(availableSpaces / parkingRatio);
      } else {
        const availableSpaces = (landArea * 0.3) / 350;
        const spacesPerUnit = (config.avgUnitSize / 1000) * config.parkingRatio;
        byParking = spacesPerUnit > 0 ? Math.floor(availableSpaces / spacesPerUnit) : null;
      }
    }

    return { byDensity, byFAR, byHeight, byParking };
  }

  private calculateParkingRequired(
    capacity: number,
    maxGFA: number,
    config: PropertyTypeConfig,
    constraints: ZoningConstraints
  ): number {
    if (config.parkingRatioUnit === 'per unit' || config.parkingRatioUnit === 'per room') {
      const ratio = constraints.minParkingPerUnit ?? config.parkingRatio;
      return capacity * ratio;
    }
    return (maxGFA / 1000) * config.parkingRatio;
  }

  private calculateAnnualRevenue(
    type: PropertyType,
    capacity: number,
    maxGFA: number,
    config: PropertyTypeConfig,
    assumptions?: RevenueAssumptions
  ): number {
    switch (type) {
      case 'multifamily': {
        const rent = assumptions?.multifamily ?? config.defaultRevenue;
        return capacity * rent * 12;
      }
      case 'office': {
        const rate = assumptions?.office ?? config.defaultRevenue;
        return maxGFA * rate;
      }
      case 'retail': {
        const rate = assumptions?.retail ?? config.defaultRevenue;
        return maxGFA * rate;
      }
      case 'industrial': {
        const rate = assumptions?.industrial ?? config.defaultRevenue;
        return maxGFA * rate;
      }
      case 'hospitality': {
        const adr = assumptions?.hospitality?.adr ?? 150;
        const occupancy = assumptions?.hospitality?.occupancy ?? 0.70;
        return capacity * adr * 365 * occupancy;
      }
      case 'mixed-use': {
        const retailConfig = PROPERTY_TYPE_CONFIGS.retail;
        const mfConfig = PROPERTY_TYPE_CONFIGS.multifamily;
        const retailGFA = maxGFA * 0.25;
        const mfGFA = maxGFA * 0.75;
        const retailRevenue = retailGFA * (assumptions?.retail ?? retailConfig.defaultRevenue);
        const mfUnits = Math.floor(mfGFA / mfConfig.avgUnitSize);
        const mfRevenue = mfUnits * (assumptions?.multifamily ?? mfConfig.defaultRevenue) * 12;
        return retailRevenue + mfRevenue;
      }
      default:
        return 0;
    }
  }

  private buildReasoning(
    type: PropertyType,
    envelope: BuildingEnvelopeResult,
    annualRevenue: number,
    noi: number,
    value: number,
    config: PropertyTypeConfig
  ): string {
    const capacityLabel = type === 'multifamily' ? 'units'
      : type === 'hospitality' ? 'rooms'
      : type === 'mixed-use' ? 'units (mixed)'
      : 'sqft';

    const capacityDisplay = (type === 'office' || type === 'retail' || type === 'industrial')
      ? `${envelope.maxGFA.toLocaleString()} sqft GFA`
      : `${envelope.maxCapacity.toLocaleString()} ${capacityLabel}`;

    return `${type}: ${capacityDisplay} across ${envelope.maxFloors} floors. ` +
      `Annual gross revenue $${Math.round(annualRevenue).toLocaleString()}, ` +
      `NOI $${Math.round(noi).toLocaleString()} (${Math.round((1 - config.expenseRatio) * 100)}% margin), ` +
      `estimated value $${Math.round(value).toLocaleString()} at ${(config.capRate * 100).toFixed(1)}% cap rate. ` +
      `Limiting factor: ${envelope.limitingFactor}.`;
  }
}

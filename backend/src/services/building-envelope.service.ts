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
    avgUnitSize: 900,
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
    avgUnitSize: 900,
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
  residentialFAR?: number | null;
  nonresidentialFAR?: number | null;
  appliedFAR?: number | null;
  maxHeight?: number | null;
  maxStories?: number | null;
  minParkingPerUnit?: number | null;
  maxLotCoverage?: number | null;
  densityMethod?: 'units_per_acre' | 'far_derived' | null;
}

export interface DensityBonuses {
  affordableBonusPercent?: number;
  tdrBonusPercent?: number;
}

export interface SourceRule {
  field: string;
  displayLabel: string;
  sectionNumber: string | null;
  sectionTitle: string | null;
  sourceUrl: string | null;
  sourceType: 'municode' | 'search' | 'chapter';
}

export interface BuildingEnvelopeInputs {
  landArea: number;
  setbacks: Setbacks;
  lotDimensions?: LotDimensions | null;
  zoningConstraints: ZoningConstraints;
  propertyType: PropertyType;
  dealType?: 'residential' | 'commercial' | 'mixed-use';
  densityBonuses?: DensityBonuses | null;
  sourceRules?: SourceRule[] | null;
  avgUnitSizeOverride?: number | null;
}

export interface CapacityByConstraint {
  byDensity: number | null;
  byFAR: number | null;
  byHeight: number | null;
  byParking: number | null;
}

export interface SourceCitation {
  field: string;
  displayLabel: string;
  value: number | string | null;
  unit: string;
  sectionNumber: string | null;
  sectionTitle: string | null;
  sourceUrl: string | null;
  sourceType: 'municode' | 'search' | 'chapter' | 'derived';
}

export interface CalculationBreakdown {
  name: string;
  formula: string;
  result: number;
  unit: string;
  sectionNumber: string | null;
  sourceUrl: string | null;
}

export interface EnvelopeInsights {
  envelope: string;
  density: string;
  height: string;
  parking: string;
  controllingFactor: string;
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
  sources: Record<string, SourceCitation>;
  calculations: CalculationBreakdown[];
  insights: EnvelopeInsights;
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
    const baseConfig = PROPERTY_TYPE_CONFIGS[inputs.propertyType];
    const config = inputs.avgUnitSizeOverride && inputs.avgUnitSizeOverride > 0
      ? { ...baseConfig, avgUnitSize: inputs.avgUnitSizeOverride }
      : baseConfig;
    const { landArea, setbacks, lotDimensions, zoningConstraints, densityBonuses, sourceRules } = inputs;
    const dealType = inputs.dealType || 'residential';

    const ruleMap = new Map<string, SourceRule>();
    if (sourceRules) {
      for (const rule of sourceRules) {
        ruleMap.set(rule.field, rule);
      }
    }

    let appliedFAR = zoningConstraints.maxFAR;
    if (zoningConstraints.residentialFAR != null || zoningConstraints.nonresidentialFAR != null) {
      if (dealType === 'residential' && zoningConstraints.residentialFAR != null) {
        appliedFAR = zoningConstraints.residentialFAR;
      } else if (dealType === 'commercial' && zoningConstraints.nonresidentialFAR != null) {
        appliedFAR = zoningConstraints.nonresidentialFAR;
      }
    }
    zoningConstraints.appliedFAR = appliedFAR;

    const buildableArea = this.calculateBuildableArea(landArea, setbacks, lotDimensions);

    const lotCoverageFraction = zoningConstraints.maxLotCoverage != null
      ? zoningConstraints.maxLotCoverage / 100
      : 1.0;
    const lotCoverageCap = landArea * lotCoverageFraction;
    const maxFootprint = Math.min(buildableArea, lotCoverageCap);

    const maxFloors = this.calculateMaxFloors(zoningConstraints, config.floorHeight, appliedFAR, lotCoverageFraction);

    let maxGFA = maxFootprint * maxFloors;
    if (appliedFAR != null) {
      const farLimit = appliedFAR * landArea;
      maxGFA = Math.min(maxGFA, farLimit);
    }

    const bonusMultiplier = this.getBonusMultiplier(densityBonuses);

    const capacityByConstraint = this.calculateCapacityByConstraint(
      inputs, config, maxFootprint, maxFloors
    );

    const constraintEntries: [string, number | null][] = [];
    if (zoningConstraints.densityMethod !== 'far_derived') {
      constraintEntries.push(['density', capacityByConstraint.byDensity]);
    }
    constraintEntries.push(
      ['FAR', capacityByConstraint.byFAR],
      ['height', capacityByConstraint.byHeight],
      ['parking', capacityByConstraint.byParking],
    );

    const validConstraints = constraintEntries.filter(([, v]) => v != null) as [string, number][];
    let limitingFactor = 'none';
    let maxCapacity: number;

    if (zoningConstraints.densityMethod === 'far_derived') {
      const efficiencyFactor = 0.85;
      maxCapacity = Math.floor((maxGFA * efficiencyFactor / config.avgUnitSize) * bonusMultiplier);
      if (validConstraints.length > 0) {
        validConstraints.sort((a, b) => a[1] - b[1]);
        limitingFactor = validConstraints[0][0];
      }
    } else if (validConstraints.length > 0) {
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

    const sources = this.buildSourceCitations(zoningConstraints, setbacks, ruleMap);
    const calculations = this.buildCalculationBreakdowns(
      inputs, config, buildableArea, maxFootprint, maxFloors, maxGFA, maxCapacity,
      appliedFAR, parkingRequired, capacityByConstraint, ruleMap
    );
    const insights = this.buildInsights(
      inputs, config, buildableArea, maxFootprint, maxFloors, maxGFA,
      maxCapacity, limitingFactor, capacityByConstraint, parkingRequired
    );

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
      sources,
      calculations,
      insights,
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

  private calculateMaxFloors(
    constraints: ZoningConstraints,
    floorHeight: number,
    appliedFAR?: number | null,
    lotCoverageFraction?: number,
  ): number {
    const byHeight = constraints.maxHeight != null
      ? Math.floor(constraints.maxHeight / floorHeight)
      : Infinity;
    const byStories = constraints.maxStories != null
      ? constraints.maxStories
      : Infinity;

    const result = Math.min(byHeight, byStories);
    if (result !== Infinity) return result;

    if (appliedFAR != null && appliedFAR > 0) {
      const coverage = lotCoverageFraction != null && lotCoverageFraction > 0 ? lotCoverageFraction : 1.0;
      return Math.ceil(appliedFAR / coverage);
    }

    return 1;
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

    const effectiveFAR = zoningConstraints.appliedFAR ?? zoningConstraints.maxFAR;
    const byFAR = effectiveFAR != null
      ? Math.floor((effectiveFAR * landArea) / config.avgUnitSize)
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

  private buildSourceCitations(
    constraints: ZoningConstraints,
    setbacks: Setbacks,
    ruleMap: Map<string, SourceRule>
  ): Record<string, SourceCitation> {
    const sources: Record<string, SourceCitation> = {};

    const addSource = (
      key: string,
      displayLabel: string,
      value: number | string | null | undefined,
      unit: string,
      ruleField: string
    ) => {
      const rule = ruleMap.get(ruleField);
      sources[key] = {
        field: key,
        displayLabel,
        value: value ?? null,
        unit,
        sectionNumber: rule?.sectionNumber ?? null,
        sectionTitle: rule?.sectionTitle ?? null,
        sourceUrl: rule?.sourceUrl ?? null,
        sourceType: rule?.sourceType ?? 'derived',
      };
    };

    addSource('maxHeight', 'Maximum Height', constraints.maxHeight, 'ft', 'maxHeight');
    addSource('maxStories', 'Maximum Stories', constraints.maxStories, 'stories', 'maxStories');
    addSource('maxFAR', 'Floor Area Ratio', constraints.appliedFAR ?? constraints.maxFAR, '', 'maxFAR');
    addSource('maxDensity', 'Maximum Density', constraints.maxDensity, 'units/acre', 'maxDensity');
    addSource('maxLotCoverage', 'Maximum Lot Coverage', constraints.maxLotCoverage, '%', 'lotCoverage');
    addSource('parking', 'Parking Requirement', constraints.minParkingPerUnit, 'spaces/unit', 'parking');
    addSource('frontSetback', 'Front Setback', setbacks.front, 'ft', 'frontSetback');
    addSource('sideSetback', 'Side Setback', setbacks.side, 'ft', 'sideSetback');
    addSource('rearSetback', 'Rear Setback', setbacks.rear, 'ft', 'rearSetback');

    return sources;
  }

  private buildCalculationBreakdowns(
    inputs: BuildingEnvelopeInputs,
    config: PropertyTypeConfig,
    buildableArea: number,
    maxFootprint: number,
    maxFloors: number,
    maxGFA: number,
    maxCapacity: number,
    appliedFAR: number | null | undefined,
    parkingRequired: number,
    capacity: CapacityByConstraint,
    ruleMap: Map<string, SourceRule>
  ): CalculationBreakdown[] {
    const calcs: CalculationBreakdown[] = [];
    const { landArea, setbacks, lotDimensions, zoningConstraints } = inputs;

    const hasLotDims = lotDimensions && lotDimensions.frontage > 0 && lotDimensions.depth > 0;
    if (hasLotDims) {
      calcs.push({
        name: 'Buildable Area',
        formula: `(${lotDimensions!.frontage}ft frontage - 2×${setbacks.side}ft side setback) × (${lotDimensions!.depth}ft depth - ${setbacks.front}ft front - ${setbacks.rear}ft rear) = ${Math.round(buildableArea).toLocaleString()} sqft`,
        result: Math.round(buildableArea),
        unit: 'sqft',
        sectionNumber: ruleMap.get('frontSetback')?.sectionNumber ?? null,
        sourceUrl: ruleMap.get('frontSetback')?.sourceUrl ?? null,
      });
    } else {
      const side = Math.sqrt(landArea);
      calcs.push({
        name: 'Buildable Area',
        formula: `√${landArea.toLocaleString()} sqft lot ≈ ${Math.round(side)}ft side, minus setbacks (F:${setbacks.front}ft, S:${setbacks.side}ft, R:${setbacks.rear}ft) = ${Math.round(buildableArea).toLocaleString()} sqft`,
        result: Math.round(buildableArea),
        unit: 'sqft',
        sectionNumber: ruleMap.get('frontSetback')?.sectionNumber ?? null,
        sourceUrl: ruleMap.get('frontSetback')?.sourceUrl ?? null,
      });
    }

    if (zoningConstraints.maxLotCoverage != null) {
      calcs.push({
        name: 'Max Footprint (Lot Coverage)',
        formula: `min(${Math.round(buildableArea).toLocaleString()} sqft buildable, ${landArea.toLocaleString()} sqft × ${zoningConstraints.maxLotCoverage}%) = ${Math.round(maxFootprint).toLocaleString()} sqft`,
        result: Math.round(maxFootprint),
        unit: 'sqft',
        sectionNumber: ruleMap.get('lotCoverage')?.sectionNumber ?? null,
        sourceUrl: ruleMap.get('lotCoverage')?.sourceUrl ?? null,
      });
    }

    if (zoningConstraints.maxHeight != null) {
      const heightRule = ruleMap.get('maxHeight');
      calcs.push({
        name: 'Max Floors (by Height)',
        formula: `${zoningConstraints.maxHeight}ft max height ÷ ${config.floorHeight}ft floor height = ${maxFloors} floors`,
        result: maxFloors,
        unit: 'floors',
        sectionNumber: heightRule?.sectionNumber ?? null,
        sourceUrl: heightRule?.sourceUrl ?? null,
      });
    }

    if (appliedFAR != null) {
      const farRule = ruleMap.get('maxFAR');
      calcs.push({
        name: 'Max GFA (by FAR)',
        formula: `${appliedFAR} FAR × ${landArea.toLocaleString()} sqft lot = ${Math.round(appliedFAR * landArea).toLocaleString()} sqft`,
        result: Math.round(appliedFAR * landArea),
        unit: 'sqft',
        sectionNumber: farRule?.sectionNumber ?? null,
        sourceUrl: farRule?.sourceUrl ?? null,
      });
    }

    calcs.push({
      name: 'Max GFA (by Envelope)',
      formula: `${Math.round(maxFootprint).toLocaleString()} sqft footprint × ${maxFloors} floors = ${Math.round(maxFootprint * maxFloors).toLocaleString()} sqft`,
      result: Math.round(maxGFA),
      unit: 'sqft',
      sectionNumber: null,
      sourceUrl: null,
    });

    const acres = landArea / 43560;
    if (capacity.byDensity != null && zoningConstraints.maxDensity != null) {
      const densityRule = ruleMap.get('maxDensity');
      calcs.push({
        name: 'Capacity by Density',
        formula: `${zoningConstraints.maxDensity} units/acre × ${acres.toFixed(2)} acres = ${capacity.byDensity} units`,
        result: capacity.byDensity,
        unit: 'units',
        sectionNumber: densityRule?.sectionNumber ?? null,
        sourceUrl: densityRule?.sourceUrl ?? null,
      });
    }

    if (capacity.byFAR != null && appliedFAR != null) {
      const farRule = ruleMap.get('maxFAR');
      calcs.push({
        name: 'Capacity by FAR',
        formula: `(${appliedFAR} FAR × ${landArea.toLocaleString()} sqft) ÷ ${config.avgUnitSize} sqft/unit = ${capacity.byFAR} units`,
        result: capacity.byFAR,
        unit: 'units',
        sectionNumber: farRule?.sectionNumber ?? null,
        sourceUrl: farRule?.sourceUrl ?? null,
      });
    }

    if (capacity.byHeight != null) {
      const heightRule = ruleMap.get('maxHeight');
      calcs.push({
        name: 'Capacity by Height',
        formula: `(${Math.round(maxFootprint).toLocaleString()} sqft × ${maxFloors} floors) ÷ ${config.avgUnitSize} sqft/unit = ${capacity.byHeight} units`,
        result: capacity.byHeight,
        unit: 'units',
        sectionNumber: heightRule?.sectionNumber ?? null,
        sourceUrl: heightRule?.sourceUrl ?? null,
      });
    }

    calcs.push({
      name: 'Max Capacity',
      formula: `Binding constraint (${inputs.zoningConstraints.densityMethod === 'far_derived' ? 'FAR-derived' : 'lowest of all constraints'}) = ${maxCapacity} ${config.densityMetric === 'units/acre' ? 'units' : config.densityMetric === 'rooms/acre' ? 'rooms' : 'units'}`,
      result: maxCapacity,
      unit: config.densityMetric === 'units/acre' ? 'units' : config.densityMetric === 'rooms/acre' ? 'rooms' : 'units',
      sectionNumber: null,
      sourceUrl: null,
    });

    const parkingRule = ruleMap.get('parking');
    calcs.push({
      name: 'Parking Required',
      formula: `${maxCapacity} units × ${zoningConstraints.minParkingPerUnit ?? config.parkingRatio} spaces/${config.parkingRatioUnit} = ${Math.ceil(parkingRequired)} spaces`,
      result: Math.ceil(parkingRequired),
      unit: 'spaces',
      sectionNumber: parkingRule?.sectionNumber ?? null,
      sourceUrl: parkingRule?.sourceUrl ?? null,
    });

    return calcs;
  }

  private buildInsights(
    inputs: BuildingEnvelopeInputs,
    config: PropertyTypeConfig,
    buildableArea: number,
    maxFootprint: number,
    maxFloors: number,
    maxGFA: number,
    maxCapacity: number,
    limitingFactor: string,
    capacity: CapacityByConstraint,
    parkingRequired: number
  ): EnvelopeInsights {
    const { landArea, setbacks, zoningConstraints } = inputs;
    const coveragePercent = landArea > 0 ? Math.round((maxFootprint / landArea) * 100) : 0;

    const envelope = `After setbacks (F:${setbacks.front}ft, S:${setbacks.side}ft, R:${setbacks.rear}ft), the buildable area is ${Math.round(buildableArea).toLocaleString()} sqft (${coveragePercent}% of lot). ` +
      `The building envelope allows up to ${maxFloors} floor${maxFloors !== 1 ? 's' : ''} with a maximum GFA of ${Math.round(maxGFA).toLocaleString()} sqft.`;

    let density: string;
    if (zoningConstraints.densityMethod === 'far_derived') {
      density = `Density is derived from FAR (${zoningConstraints.appliedFAR ?? zoningConstraints.maxFAR}). ` +
        `At 85% efficiency with ${config.avgUnitSize} sqft average unit size, this yields ${maxCapacity} units.`;
    } else if (zoningConstraints.maxDensity != null) {
      const acres = landArea / 43560;
      density = `Zoning allows ${zoningConstraints.maxDensity} units per acre. On this ${acres.toFixed(2)}-acre site, ` +
        `that's ${capacity.byDensity ?? 0} units by density alone.`;
    } else {
      density = `No explicit density limit is set. Capacity of ${maxCapacity} units is determined by building envelope and FAR constraints.`;
    }

    let height: string;
    if (zoningConstraints.maxHeight != null && zoningConstraints.maxStories != null) {
      height = `Height is limited to ${zoningConstraints.maxHeight}ft and ${zoningConstraints.maxStories} stories. ` +
        `With ${config.floorHeight}ft floor heights, this allows ${maxFloors} floors.`;
    } else if (zoningConstraints.maxHeight != null) {
      height = `Height is limited to ${zoningConstraints.maxHeight}ft. With ${config.floorHeight}ft floor heights, this allows ${maxFloors} floors.`;
    } else if (zoningConstraints.maxStories != null) {
      height = `Building is limited to ${zoningConstraints.maxStories} stories (${maxFloors} floors).`;
    } else {
      height = `No height limit is specified. The envelope defaults to ${maxFloors} floor${maxFloors !== 1 ? 's' : ''}.`;
    }

    let parking: string;
    const parkingRatio = zoningConstraints.minParkingPerUnit ?? config.parkingRatio;
    parking = `Parking requires ${parkingRatio} spaces ${config.parkingRatioUnit}, totaling ${Math.ceil(parkingRequired)} spaces. ` +
      `This needs approximately ${Math.ceil(parkingRequired * 350).toLocaleString()} sqft for surface parking or ` +
      `${Math.ceil(parkingRequired * 300).toLocaleString()} sqft for structured parking.`;
    if (capacity.byParking != null && limitingFactor === 'parking') {
      parking += ` Parking is the binding constraint, limiting capacity to ${capacity.byParking} units.`;
    }

    const constraintLabels: Record<string, string> = {
      density: 'maximum density',
      FAR: 'floor area ratio',
      height: 'building height',
      parking: 'parking requirements',
      none: 'no single constraint',
    };
    const factorLabel = constraintLabels[limitingFactor] || limitingFactor;

    let controllingFactor: string;
    if (limitingFactor === 'none') {
      controllingFactor = `No single constraint is binding. Capacity of ${maxCapacity} units is derived from the overall building envelope.`;
    } else {
      const constraintValues: Record<string, number | null> = {
        density: capacity.byDensity,
        FAR: capacity.byFAR,
        height: capacity.byHeight,
        parking: capacity.byParking,
      };
      const bindingValue = constraintValues[limitingFactor];
      controllingFactor = `The controlling factor is ${factorLabel}, which limits development to ${bindingValue ?? maxCapacity} units. ` +
        `This is the most restrictive of all applicable zoning constraints.`;
    }

    return { envelope, density, height, parking, controllingFactor };
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

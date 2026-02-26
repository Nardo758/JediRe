import { Pool } from 'pg';
import {
  BuildingEnvelopeService,
  BuildingEnvelopeInputs,
  BuildingEnvelopeResult,
  PropertyType,
  PROPERTY_TYPE_CONFIGS,
  SourceRule,
  SourceCitation,
} from './building-envelope.service';
import { municodeUrlService } from './municode-url.service';

export interface RezoneAnalysisInput {
  currentDistrictCode: string;
  municipality: string;
  municipalityId?: string;
  lotAreaSf: number;
  lotDimensions?: { frontage: number; depth: number } | null;
  propertyType: PropertyType;
  dealType?: 'residential' | 'commercial' | 'mixed-use';
  revenueAssumptions?: {
    rentPerUnit?: number;
    ratePerSf?: number;
    capRate?: number;
  };
}

export interface RezoneOpportunity {
  targetDistrictCode: string;
  targetDistrictName: string | null;
  targetDistrictId: string;
  category: string | null;
  currentEnvelope: {
    maxCapacity: number;
    maxGFA: number;
    maxFloors: number;
    limitingFactor: string;
  };
  targetEnvelope: {
    maxCapacity: number;
    maxGFA: number;
    maxFloors: number;
    limitingFactor: string;
  };
  delta: {
    additionalUnits: number;
    additionalGFA: number;
    heightDifference: number;
    unitUpliftPct: number;
    gfaUpliftPct: number;
  };
  revenue: {
    currentAnnualRevenue: number;
    targetAnnualRevenue: number;
    revenueUplift: number;
    currentEstimatedValue: number;
    targetEstimatedValue: number;
    valueUplift: number;
  };
  sources: Record<string, SourceCitation>;
  sourceRules: SourceRule[];
  districtMunicodeUrl: string | null;
  risk: string;
  estimatedTimeline: string;
  estimatedCost: string;
  recommended: boolean;
  insight: string;
}

export interface RezoneAnalysisResult {
  currentDistrictCode: string;
  municipality: string;
  propertyType: PropertyType;
  opportunities: RezoneOpportunity[];
  bestTarget: RezoneOpportunity | null;
  generatedAt: string;
}

export class RezoneAnalysisService {
  private envelopeService: BuildingEnvelopeService;

  constructor(private pool: Pool) {
    this.envelopeService = new BuildingEnvelopeService();
  }

  async analyze(input: RezoneAnalysisInput): Promise<RezoneAnalysisResult> {
    const currentDistrict = await this.lookupDistrict(
      input.currentDistrictCode,
      input.municipality,
      input.municipalityId,
    );

    if (!currentDistrict) {
      return {
        currentDistrictCode: input.currentDistrictCode,
        municipality: input.municipality,
        propertyType: input.propertyType,
        opportunities: [],
        bestTarget: null,
        generatedAt: new Date().toISOString(),
      };
    }

    const municipalityId = currentDistrict.municipality_id;

    let sourceRulesCurrent: SourceRule[] = [];
    if (municipalityId) {
      try {
        const ruleUrls = await municodeUrlService.getDistrictRuleUrls(
          municipalityId,
          input.currentDistrictCode,
        );
        sourceRulesCurrent = ruleUrls.rules;
      } catch {}
    }

    const currentInputs = this.buildEnvelopeInputs(
      currentDistrict,
      input,
      sourceRulesCurrent,
    );
    const currentEnvelope = this.envelopeService.calculateEnvelope(currentInputs);
    const currentRevenue = this.calculateRevenue(
      input.propertyType,
      currentEnvelope,
      input.revenueAssumptions,
    );

    const targets = await this.fetchRezoneTargets(
      currentDistrict,
      municipalityId,
      input.municipality,
    );

    const opportunities: RezoneOpportunity[] = [];

    for (const target of targets) {
      const targetCode = target.zoning_code || target.district_code;
      let targetSourceRules: SourceRule[] = [];
      let targetMunicodeUrl: string | null = null;

      if (municipalityId && targetCode) {
        try {
          const ruleUrls = await municodeUrlService.getDistrictRuleUrls(
            municipalityId,
            targetCode,
          );
          targetSourceRules = ruleUrls.rules;
          targetMunicodeUrl = ruleUrls.districtUrl;
        } catch {}
      }

      const targetInputs = this.buildEnvelopeInputs(target, input, targetSourceRules);
      const targetEnvelope = this.envelopeService.calculateEnvelope(targetInputs);
      const targetRevenue = this.calculateRevenue(
        input.propertyType,
        targetEnvelope,
        input.revenueAssumptions,
      );

      const additionalUnits = targetEnvelope.maxCapacity - currentEnvelope.maxCapacity;
      const additionalGFA = targetEnvelope.maxGFA - currentEnvelope.maxGFA;
      const heightDifference = targetEnvelope.maxFloors - currentEnvelope.maxFloors;

      if (additionalUnits <= 0 && additionalGFA <= 0) continue;

      const unitUpliftPct = currentEnvelope.maxCapacity > 0
        ? Math.round((additionalUnits / currentEnvelope.maxCapacity) * 100)
        : 0;
      const gfaUpliftPct = currentEnvelope.maxGFA > 0
        ? Math.round((additionalGFA / currentEnvelope.maxGFA) * 100)
        : 0;

      const revenueUplift = targetRevenue.annualRevenue - currentRevenue.annualRevenue;
      const valueUplift = targetRevenue.estimatedValue - currentRevenue.estimatedValue;

      const insight = this.generateInsight(
        targetCode,
        input.currentDistrictCode,
        additionalUnits,
        additionalGFA,
        heightDifference,
        valueUplift,
        targetEnvelope.limitingFactor,
      );

      opportunities.push({
        targetDistrictCode: targetCode,
        targetDistrictName: target.district_name || null,
        targetDistrictId: target.id,
        category: target.category || null,
        currentEnvelope: {
          maxCapacity: currentEnvelope.maxCapacity,
          maxGFA: Math.round(currentEnvelope.maxGFA),
          maxFloors: currentEnvelope.maxFloors,
          limitingFactor: currentEnvelope.limitingFactor,
        },
        targetEnvelope: {
          maxCapacity: targetEnvelope.maxCapacity,
          maxGFA: Math.round(targetEnvelope.maxGFA),
          maxFloors: targetEnvelope.maxFloors,
          limitingFactor: targetEnvelope.limitingFactor,
        },
        delta: {
          additionalUnits,
          additionalGFA: Math.round(additionalGFA),
          heightDifference,
          unitUpliftPct,
          gfaUpliftPct,
        },
        revenue: {
          currentAnnualRevenue: Math.round(currentRevenue.annualRevenue),
          targetAnnualRevenue: Math.round(targetRevenue.annualRevenue),
          revenueUplift: Math.round(revenueUplift),
          currentEstimatedValue: Math.round(currentRevenue.estimatedValue),
          targetEstimatedValue: Math.round(targetRevenue.estimatedValue),
          valueUplift: Math.round(valueUplift),
        },
        sources: targetEnvelope.sources,
        sourceRules: targetSourceRules,
        districtMunicodeUrl: targetMunicodeUrl,
        risk: 'High',
        estimatedTimeline: '12-24 months',
        estimatedCost: '$75K-$200K',
        recommended: false,
        insight,
      });
    }

    opportunities.sort((a, b) => b.revenue.valueUplift - a.revenue.valueUplift);

    let bestTarget: RezoneOpportunity | null = null;
    if (opportunities.length > 0) {
      opportunities[0].recommended = true;
      bestTarget = opportunities[0];
    }

    return {
      currentDistrictCode: input.currentDistrictCode,
      municipality: input.municipality,
      propertyType: input.propertyType,
      opportunities,
      bestTarget,
      generatedAt: new Date().toISOString(),
    };
  }

  private buildEnvelopeInputs(
    district: any,
    input: RezoneAnalysisInput,
    sourceRules: SourceRule[],
  ): BuildingEnvelopeInputs {
    const maxDensity = parseFloat(district.max_density_per_acre || district.max_units_per_acre) || null;
    const maxFAR = parseFloat(district.max_far) || null;
    const residentialFAR = parseFloat(district.residential_far) || null;
    const nonresidentialFAR = parseFloat(district.nonresidential_far) || null;
    const maxHeight = parseInt(district.max_height_feet || district.max_building_height_ft) || null;
    const maxStories = parseInt(district.max_stories) || null;
    const minParkingPerUnit = parseFloat(district.min_parking_per_unit || district.parking_per_unit) || null;
    const maxLotCoverage = parseFloat(district.max_lot_coverage || district.max_lot_coverage_percent) || null;
    const densityMethod = district.density_method || 'units_per_acre';

    const setbackFront = parseInt(district.setback_front_ft || district.min_front_setback_ft) || 0;
    const setbackSide = parseInt(district.setback_side_ft || district.min_side_setback_ft) || 0;
    const setbackRear = parseInt(district.setback_rear_ft || district.min_rear_setback_ft) || 0;

    const dealType = input.dealType || 'residential';
    let appliedFAR: number | null = null;
    if (dealType === 'residential' && residentialFAR != null) {
      appliedFAR = residentialFAR;
    } else if (dealType === 'commercial' && nonresidentialFAR != null) {
      appliedFAR = nonresidentialFAR;
    } else {
      appliedFAR = maxFAR;
    }

    return {
      landArea: input.lotAreaSf,
      setbacks: { front: setbackFront, side: setbackSide, rear: setbackRear },
      lotDimensions: input.lotDimensions || null,
      zoningConstraints: {
        maxDensity: densityMethod === 'far_derived' ? null : maxDensity,
        maxFAR: appliedFAR,
        residentialFAR,
        nonresidentialFAR,
        appliedFAR,
        maxHeight,
        maxStories,
        minParkingPerUnit,
        maxLotCoverage,
        densityMethod: densityMethod as any,
      },
      propertyType: input.propertyType,
      dealType,
      sourceRules,
    };
  }

  private calculateRevenue(
    propertyType: PropertyType,
    envelope: BuildingEnvelopeResult,
    assumptions?: RezoneAnalysisInput['revenueAssumptions'],
  ): { annualRevenue: number; estimatedValue: number } {
    const config = PROPERTY_TYPE_CONFIGS[propertyType];
    let annualRevenue = 0;

    switch (propertyType) {
      case 'multifamily': {
        const rent = assumptions?.rentPerUnit ?? config.defaultRevenue;
        annualRevenue = envelope.maxCapacity * rent * 12;
        break;
      }
      case 'office':
      case 'retail':
      case 'industrial': {
        const rate = assumptions?.ratePerSf ?? config.defaultRevenue;
        annualRevenue = envelope.maxGFA * rate;
        break;
      }
      case 'hospitality': {
        annualRevenue = envelope.maxCapacity * 150 * 365 * 0.70;
        break;
      }
      case 'mixed-use': {
        const retailConfig = PROPERTY_TYPE_CONFIGS.retail;
        const mfConfig = PROPERTY_TYPE_CONFIGS.multifamily;
        const retailGFA = envelope.maxGFA * 0.25;
        const mfGFA = envelope.maxGFA * 0.75;
        const retailRevenue = retailGFA * retailConfig.defaultRevenue;
        const mfUnits = Math.floor(mfGFA / mfConfig.avgUnitSize);
        const mfRevenue = mfUnits * mfConfig.defaultRevenue * 12;
        annualRevenue = retailRevenue + mfRevenue;
        break;
      }
    }

    const capRate = assumptions?.capRate ?? config.capRate;
    const noi = annualRevenue * (1 - config.expenseRatio);
    const estimatedValue = capRate > 0 ? noi / capRate : 0;

    return { annualRevenue, estimatedValue };
  }

  private async lookupDistrict(
    code: string,
    municipality: string,
    municipalityId?: string,
  ): Promise<any | null> {
    let result;
    if (municipalityId) {
      result = await this.pool.query(
        `SELECT zd.*, m.name as municipality_name, m.state as municipality_state
         FROM zoning_districts zd
         LEFT JOIN municipalities m ON m.id = zd.municipality_id
         WHERE UPPER(COALESCE(zd.zoning_code, zd.district_code)) = UPPER($1)
           AND zd.municipality_id = $2
         LIMIT 1`,
        [code, municipalityId],
      );
    } else {
      result = await this.pool.query(
        `SELECT zd.*, m.name as municipality_name, m.state as municipality_state
         FROM zoning_districts zd
         LEFT JOIN municipalities m ON m.id = zd.municipality_id
         WHERE UPPER(COALESCE(zd.zoning_code, zd.district_code)) = UPPER($1)
           AND UPPER(COALESCE(zd.municipality, m.name)) = UPPER($2)
         LIMIT 1`,
        [code, municipality],
      );
    }
    return result.rows[0] || null;
  }

  private async fetchRezoneTargets(
    currentDistrict: any,
    municipalityId: string | null,
    municipality: string,
  ): Promise<any[]> {
    const currentDensity = parseFloat(
      currentDistrict.max_density_per_acre || currentDistrict.max_units_per_acre || '0',
    );
    const currentFar = parseFloat(currentDistrict.max_far || '0');

    const result = await this.pool.query(
      `SELECT zd.*, m.name as municipality_name, m.state as municipality_state
       FROM zoning_districts zd
       LEFT JOIN municipalities m ON m.id = zd.municipality_id
       WHERE (zd.municipality_id = $1 OR UPPER(COALESCE(zd.municipality, m.name)) = UPPER($2))
         AND zd.id != $3
         AND (
           COALESCE(zd.max_density_per_acre, zd.max_units_per_acre, 0) > $4
           OR COALESCE(zd.max_far, 0) > $5
         )
       ORDER BY COALESCE(zd.max_density_per_acre, zd.max_units_per_acre, 0) DESC NULLS LAST
       LIMIT 5`,
      [municipalityId, municipality, currentDistrict.id, currentDensity, currentFar],
    );

    return result.rows;
  }

  private generateInsight(
    targetCode: string,
    currentCode: string,
    additionalUnits: number,
    additionalGFA: number,
    heightDifference: number,
    valueUplift: number,
    limitingFactor: string,
  ): string {
    const parts: string[] = [];

    parts.push(
      `Rezoning from ${currentCode} to ${targetCode} would unlock ${additionalUnits} additional units (+${Math.round(additionalGFA).toLocaleString()} sqft GFA).`,
    );

    if (heightDifference > 0) {
      parts.push(`The target district allows ${heightDifference} additional floors.`);
    }

    if (valueUplift > 0) {
      parts.push(
        `Estimated value uplift of $${Math.round(valueUplift / 1000).toLocaleString()}K.`,
      );
    }

    if (limitingFactor !== 'none') {
      parts.push(`Development would be constrained by ${limitingFactor} in the target district.`);
    }

    return parts.join(' ');
  }
}

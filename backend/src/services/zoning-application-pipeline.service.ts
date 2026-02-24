import { Pool } from 'pg';
import { ZoningKnowledgeService, ZoningDistrictProfile } from './zoning-knowledge.service';
import { ZoningReasoningService } from './zoning-reasoning.service';
import { BuildingEnvelopeService, PropertyType, PROPERTY_TYPE_CONFIGS } from './building-envelope.service';

export interface PipelineInput {
  dealId?: string;
  address?: string;
  lat?: number;
  lng?: number;
  municipality: string;
  state: string;
  districtCode: string;
  landAreaSf: number;
  setbacks?: { front: number; side: number; rear: number };
  propertyType?: PropertyType;
}

export interface CapacityScenario {
  name: string;
  description: string;
  maxUnits: number;
  maxGFA: number;
  limitingFactor: string;
  parkingRequired: number;
  riskScore: number;
  timelineMonths: number;
  estimatedCost: number;
}

export interface IncentiveProgram {
  program: string;
  trigger: string;
  benefit: string;
  codeRef?: string;
  netBenefitEstimate?: string;
  applicable: boolean;
}

export interface EntitlementPath {
  name: string;
  description: string;
  riskScore: number;
  approvalProbability: number;
  timelineMonths: number;
  estimatedCost: number;
  units: number;
  keyFactors: string[];
  recommendation: string;
}

export interface ConfidenceBreakdown {
  dimensionalStandards: number;
  parkingCalculations: number;
  overlayApplication: number;
  incentiveEligibility: number;
  approvalProbability: number;
  overall: number;
  jurisdictionMaturity: string;
}

export interface PipelineResult {
  step1_ruleStack: {
    baseDistrict: ZoningDistrictProfile | null;
    overlays: any[];
    proximityTriggers: string[];
  };
  step2_baseApplication: {
    landAreaSf: number;
    acres: number;
    maxDensityUnits: number | null;
    maxFARGfa: number | null;
    maxLotCoverage: number | null;
    buildableFootprint: number;
    setbacks: { front: number; side: number; rear: number };
  };
  step3_overlayAdjustments: any[];
  step4_capacityScenarios: CapacityScenario[];
  step5_incentivePrograms: IncentiveProgram[];
  step6_entitlementPaths: EntitlementPath[];
  step7_strategyRecommendation: string;
  step8_confidence: ConfidenceBreakdown;
  citations: string[];
  processingTimeMs: number;
}

export class ZoningApplicationPipeline {
  private pool: Pool;
  private knowledgeService: ZoningKnowledgeService;
  private reasoningService: ZoningReasoningService;
  private envelopeService: BuildingEnvelopeService;

  constructor(pool: Pool, knowledgeService: ZoningKnowledgeService, reasoningService: ZoningReasoningService) {
    this.pool = pool;
    this.knowledgeService = knowledgeService;
    this.reasoningService = reasoningService;
    this.envelopeService = new BuildingEnvelopeService();
  }

  async execute(input: PipelineInput): Promise<PipelineResult> {
    const startTime = Date.now();
    const citations: string[] = [];

    const step1 = await this.step1_identifyRules(input);
    if (step1.baseDistrict?.codeSection) {
      citations.push(step1.baseDistrict.codeSection);
    }

    const profile = step1.baseDistrict;
    const setbacks = input.setbacks || profile?.dimensional.setbacks || { front: 25, side: 10, rear: 20 };

    const step2 = this.step2_applyBaseDistrict(input, profile, setbacks);
    const step3 = this.step3_applyOverlays(step1.overlays, step2);
    const step4 = this.step4_calculateCapacity(input, profile, setbacks);
    const step5 = this.step5_identifyIncentives(profile);
    const step6 = this.step6_assessEntitlementPaths(step4, profile, input);

    let step7 = '';
    try {
      step7 = await this.step7_generateRecommendation(input, step4, step5, step6, profile);
    } catch (e) {
      step7 = this.generateFallbackRecommendation(step4, step6);
    }

    const maturity = await this.knowledgeService.getJurisdictionMaturity(input.municipality);
    const step8 = this.step8_scoreConfidence(profile, maturity);

    citations.push(...(profile?.crossReferences?.map(cr => cr.ref) || []));
    citations.push(...(profile?.incentives?.map(i => i.codeRef).filter(Boolean) as string[] || []));

    const result: PipelineResult = {
      step1_ruleStack: step1,
      step2_baseApplication: step2,
      step3_overlayAdjustments: step3,
      step4_capacityScenarios: step4,
      step5_incentivePrograms: step5,
      step6_entitlementPaths: step6,
      step7_strategyRecommendation: step7,
      step8_confidence: step8,
      citations: [...new Set(citations)],
      processingTimeMs: Date.now() - startTime,
    };

    await this.saveAnalysis(input, result);

    return result;
  }

  private async step1_identifyRules(input: PipelineInput): Promise<PipelineResult['step1_ruleStack']> {
    const lookup = await this.knowledgeService.lookupDistrict(input.districtCode, input.municipality);
    const profile = lookup.found ? lookup.profile : null;

    const overlays = profile?.applicableOverlays || [];
    const proximityTriggers: string[] = [];

    if (profile) {
      for (const reduction of profile.parking.reductions) {
        if (reduction.trigger.toLowerCase().includes('transit')) {
          proximityTriggers.push(`Transit proximity: ${reduction.trigger} (${reduction.reductionPct}% parking reduction)`);
        }
      }
    }

    return { baseDistrict: profile, overlays, proximityTriggers };
  }

  private step2_applyBaseDistrict(
    input: PipelineInput,
    profile: ZoningDistrictProfile | null,
    setbacks: { front: number; side: number; rear: number }
  ): PipelineResult['step2_baseApplication'] {
    const landAreaSf = input.landAreaSf;
    const acres = landAreaSf / 43560;
    const dim = profile?.dimensional;

    const maxDensityUnits = dim?.maxDensityUnitsPerAcre ? Math.floor(dim.maxDensityUnitsPerAcre * acres) : null;
    const maxFARGfa = dim?.maxFAR ? Math.round(dim.maxFAR * landAreaSf) : null;
    const maxLotCoverage = dim?.maxLotCoveragePct ? dim.maxLotCoveragePct : null;

    const side = Math.sqrt(landAreaSf);
    const effectiveWidth = Math.max(0, side - (2 * setbacks.side));
    const effectiveDepth = Math.max(0, side - setbacks.front - setbacks.rear);
    const buildableFootprint = effectiveWidth * effectiveDepth;

    return {
      landAreaSf,
      acres,
      maxDensityUnits,
      maxFARGfa,
      maxLotCoverage,
      buildableFootprint: Math.round(buildableFootprint),
      setbacks,
    };
  }

  private step3_applyOverlays(overlays: any[], baseApplication: any): any[] {
    return overlays.map(overlay => ({
      overlay: overlay.overlay,
      name: overlay.name,
      overrides: overlay.overrides || [],
      additionalRequirements: overlay.additionalRequirements || [],
      impact: 'See overlay-specific requirements',
    }));
  }

  private step4_calculateCapacity(
    input: PipelineInput,
    profile: ZoningDistrictProfile | null,
    setbacks: { front: number; side: number; rear: number }
  ): CapacityScenario[] {
    const scenarios: CapacityScenario[] = [];
    const propertyType = input.propertyType || 'multifamily';
    const dim = profile?.dimensional;

    const envelopeResult = this.envelopeService.calculateEnvelope({
      landArea: input.landAreaSf,
      setbacks,
      zoningConstraints: {
        maxDensity: dim?.maxDensityUnitsPerAcre || null,
        maxFAR: dim?.maxFAR || null,
        maxHeight: dim?.maxHeightFt || null,
        maxStories: dim?.maxStories || null,
        minParkingPerUnit: profile?.parking.residential?.perUnit || null,
        maxLotCoverage: dim?.maxLotCoveragePct || null,
      },
      propertyType,
    });

    scenarios.push({
      name: 'By Right',
      description: 'Maximum development under current zoning without any approvals',
      maxUnits: envelopeResult.maxCapacity,
      maxGFA: Math.round(envelopeResult.maxGFA),
      limitingFactor: envelopeResult.limitingFactor,
      parkingRequired: envelopeResult.parkingRequired,
      riskScore: 0,
      timelineMonths: 0,
      estimatedCost: 0,
    });

    if (profile?.incentives.some(i => i.program.toLowerCase().includes('density'))) {
      const bonusEnvelope = this.envelopeService.calculateEnvelope({
        landArea: input.landAreaSf,
        setbacks,
        zoningConstraints: {
          maxDensity: dim?.maxDensityUnitsPerAcre || null,
          maxFAR: dim?.maxFAR || null,
          maxHeight: dim?.maxHeightFt || null,
          maxStories: dim?.maxStories || null,
          minParkingPerUnit: profile?.parking.residential?.perUnit || null,
          maxLotCoverage: dim?.maxLotCoveragePct || null,
        },
        propertyType,
        densityBonuses: { affordableBonusPercent: 15 },
      });

      scenarios.push({
        name: 'With Density Bonus',
        description: 'By-right capacity plus density bonus for affordable housing commitment',
        maxUnits: bonusEnvelope.maxCapacity,
        maxGFA: Math.round(bonusEnvelope.maxGFA),
        limitingFactor: bonusEnvelope.limitingFactor,
        parkingRequired: bonusEnvelope.parkingRequired,
        riskScore: 15,
        timelineMonths: 2,
        estimatedCost: 5000,
      });
    }

    const varianceMultiplier = 1.3;
    const varianceUnits = Math.floor(envelopeResult.maxCapacity * varianceMultiplier);
    scenarios.push({
      name: 'SAP Variance',
      description: `Variance to exceed by-right by ~30% (${varianceUnits} units)`,
      maxUnits: varianceUnits,
      maxGFA: Math.round(envelopeResult.maxGFA * varianceMultiplier),
      limitingFactor: 'variance_cap',
      parkingRequired: Math.ceil(envelopeResult.parkingRequired * varianceMultiplier),
      riskScore: 35,
      timelineMonths: 5,
      estimatedCost: 75000,
    });

    const rezoneMultiplier = 1.7;
    const rezoneUnits = Math.floor(envelopeResult.maxCapacity * rezoneMultiplier);
    scenarios.push({
      name: 'Rezone',
      description: `Rezone to higher-density district (~70% increase to ${rezoneUnits} units)`,
      maxUnits: rezoneUnits,
      maxGFA: Math.round(envelopeResult.maxGFA * rezoneMultiplier),
      limitingFactor: 'rezone_cap',
      parkingRequired: Math.ceil(envelopeResult.parkingRequired * rezoneMultiplier),
      riskScore: 55,
      timelineMonths: 8,
      estimatedCost: 150000,
    });

    return scenarios;
  }

  private step5_identifyIncentives(profile: ZoningDistrictProfile | null): IncentiveProgram[] {
    if (!profile) return [];

    return profile.incentives.map(incentive => ({
      program: incentive.program,
      trigger: incentive.trigger,
      benefit: incentive.benefit,
      codeRef: incentive.codeRef,
      applicable: true,
    }));
  }

  private step6_assessEntitlementPaths(
    scenarios: CapacityScenario[],
    profile: ZoningDistrictProfile | null,
    input: PipelineInput
  ): EntitlementPath[] {
    return scenarios.map(scenario => ({
      name: scenario.name,
      description: scenario.description,
      riskScore: scenario.riskScore,
      approvalProbability: 100 - scenario.riskScore,
      timelineMonths: scenario.timelineMonths,
      estimatedCost: scenario.estimatedCost,
      units: scenario.maxUnits,
      keyFactors: this.getKeyFactors(scenario.name),
      recommendation: scenario.riskScore === 0
        ? 'Proceed — no entitlement risk'
        : scenario.riskScore <= 20
          ? 'Low risk — administrative approval typically straightforward'
          : scenario.riskScore <= 40
            ? 'Moderate risk — prepare traffic study and community engagement'
            : 'Higher risk — consider phased approach or density bonus alternative',
    }));
  }

  private async step7_generateRecommendation(
    input: PipelineInput,
    scenarios: CapacityScenario[],
    incentives: IncentiveProgram[],
    paths: EntitlementPath[],
    profile: ZoningDistrictProfile | null
  ): Promise<string> {
    const question = `Based on this analysis, provide a strategy recommendation for a ${input.propertyType || 'multifamily'} development on ${(input.landAreaSf / 43560).toFixed(2)} acres zoned ${input.districtCode} in ${input.municipality}, ${input.state}.

SCENARIOS:
${JSON.stringify(scenarios, null, 2)}

INCENTIVE PROGRAMS:
${JSON.stringify(incentives, null, 2)}

ENTITLEMENT PATHS:
${JSON.stringify(paths, null, 2)}

Provide a clear, actionable recommendation. Consider risk-adjusted value, timeline, and the optimal sequencing of entitlement steps. Be specific about which path to pursue and why.`;

    const result = await this.reasoningService.reason({
      question,
      districtCode: input.districtCode,
      municipality: input.municipality,
      state: input.state,
      parcelContext: { landAreaSf: input.landAreaSf, lat: input.lat, lng: input.lng, address: input.address },
    });

    return result.answer;
  }

  private generateFallbackRecommendation(scenarios: CapacityScenario[], paths: EntitlementPath[]): string {
    const byRight = scenarios.find(s => s.name === 'By Right');
    const withBonus = scenarios.find(s => s.name === 'With Density Bonus');

    if (withBonus && byRight) {
      const bonusUnits = withBonus.maxUnits - byRight.maxUnits;
      return `Recommended path: ${withBonus.name} (${withBonus.maxUnits} units). This captures ${bonusUnits} additional units over by-right (${byRight.maxUnits} units) with minimal risk (${withBonus.riskScore}/100) and a ${withBonus.timelineMonths}-month timeline. The density bonus provides the best risk-adjusted value without requiring variance approval.`;
    }

    if (byRight) {
      return `Recommended path: By Right (${byRight.maxUnits} units). No entitlement risk, immediate development possible.`;
    }

    return 'Insufficient data to generate strategy recommendation. Please ensure zoning parameters are populated.';
  }

  private step8_scoreConfidence(
    profile: ZoningDistrictProfile | null,
    maturity: { level: string; confidenceCap: number }
  ): ConfidenceBreakdown {
    const hasProfile = !!profile;
    const hasDimensional = hasProfile && (profile!.dimensional.maxFAR != null || profile!.dimensional.maxDensityUnitsPerAcre != null);
    const hasParking = hasProfile && profile!.parking.residential != null;
    const hasOverlays = hasProfile && profile!.applicableOverlays.length > 0;
    const hasIncentives = hasProfile && profile!.incentives.length > 0;

    const dimensionalStandards = hasDimensional ? 90 : 50;
    const parkingCalculations = hasParking ? 85 : 55;
    const overlayApplication = hasOverlays ? 80 : 60;
    const incentiveEligibility = hasIncentives ? 82 : 55;
    const approvalProbability = 70;

    const rawOverall = Math.round(
      dimensionalStandards * 0.30 +
      parkingCalculations * 0.20 +
      overlayApplication * 0.15 +
      incentiveEligibility * 0.15 +
      approvalProbability * 0.20
    );

    const overall = Math.min(rawOverall, maturity.confidenceCap);

    return {
      dimensionalStandards,
      parkingCalculations,
      overlayApplication,
      incentiveEligibility,
      approvalProbability,
      overall,
      jurisdictionMaturity: maturity.level,
    };
  }

  private getKeyFactors(scenarioName: string): string[] {
    switch (scenarioName) {
      case 'By Right':
        return ['No approval required', 'Compliant with all zoning standards'];
      case 'With Density Bonus':
        return ['Affordable housing commitment required', 'Administrative review process', 'Lower risk than variance'];
      case 'SAP Variance':
        return ['BZA/ZBA hearing required', 'Traffic study recommended', 'Community engagement important', 'NPU/neighborhood support helps'];
      case 'Rezone':
        return ['City council approval required', 'Comprehensive plan consistency needed', 'Longer timeline', 'Political considerations'];
      default:
        return [];
    }
  }

  private async saveAnalysis(input: PipelineInput, result: PipelineResult): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO zoning_agent_analyses (
          deal_id, address, lat, lng, municipality, state, district_code,
          analysis_type, rule_stack, base_district_result, overlay_results,
          capacity_scenarios, incentive_programs, entitlement_paths,
          strategy_recommendation, confidence_scores, overall_confidence,
          citations, query_intent, processing_time_ms
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'full', $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'application', $18)`,
        [
          input.dealId || null,
          input.address || null,
          input.lat || null,
          input.lng || null,
          input.municipality,
          input.state,
          input.districtCode,
          JSON.stringify(result.step1_ruleStack),
          JSON.stringify(result.step2_baseApplication),
          JSON.stringify(result.step3_overlayAdjustments),
          JSON.stringify(result.step4_capacityScenarios),
          JSON.stringify(result.step5_incentivePrograms),
          JSON.stringify(result.step6_entitlementPaths),
          result.step7_strategyRecommendation,
          JSON.stringify(result.step8_confidence),
          result.step8_confidence.overall,
          result.citations,
          result.processingTimeMs,
        ]
      );
    } catch (e) {
      console.error('Failed to save zoning analysis:', e);
    }
  }
}

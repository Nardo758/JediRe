import { Pool } from 'pg';
import { ZoningTriangulationService, TriangulationResult, FieldReconciliation } from './zoning-triangulation.service';
import { ZoningKnowledgeService, ZoningDistrictProfile, UsePermissionResult } from './zoning-knowledge.service';
import { BuildingEnvelopeService, BuildingEnvelopeResult, HighestBestUseResult, PropertyType, PROPERTY_TYPE_CONFIGS, ZoningConstraints, Setbacks } from './building-envelope.service';
import { zoningEventBus } from './zoning-event-bus.service';
import { logger } from '../utils/logger';

export interface ChainLink {
  link: number;
  name: string;
  status: 'confirmed' | 'partial' | 'unconfirmed' | 'gap';
  confidence: number;
  source: string[];
  citations: string[];
  feedsInto: number[];
  gap?: string;
  data: any;
}

export interface UseConfirmation {
  use: string;
  status: 'by_right' | 'conditional' | 'prohibited' | 'unknown';
  conditions: string | null;
  approval: string | null;
  confidence: number;
  citation: string | null;
}

export interface CapacityConfirmation {
  maxUnits: number;
  maxGFA: number;
  maxFloors: number;
  buildableArea: number;
  limitingFactor: string;
  parkingRequired: number;
  inputsConfirmed: boolean;
}

export interface HBUConfirmation {
  rankings: Array<{
    propertyType: PropertyType;
    maxCapacity: number;
    maxGFA: number;
    estimatedNOI: number;
    estimatedValue: number;
    recommended: boolean;
    reasoning: string;
    marketAdjusted: boolean;
  }>;
  topUse: PropertyType;
  topValue: number;
  marketDataAvailable: boolean;
}

export interface StrategyConfirmation {
  scores: Record<string, number>;
  recommended: string;
  arbitrageDetected: boolean;
  arbitrageDelta: number;
  signalBreakdown: Record<string, any>;
  capacityFed: boolean;
}

export interface CostConfirmation {
  applicationFees: number | null;
  impactFees: number | null;
  legalEstimate: number | null;
  consultantEstimate: number | null;
  totalSoftCosts: number | null;
  hardCostPerSf: number | null;
  totalDevelopmentCost: number | null;
  source: 'fee_schedule' | 'precedent' | 'estimate' | 'unknown';
  feeScheduleUrl: string | null;
}

export interface OverlayConfirmation {
  overlays: Array<{
    name: string;
    code: string;
    type: 'historic' | 'environmental' | 'tod' | 'opportunity_zone' | 'floodplain' | 'conservation' | 'design_review' | 'other';
    impactOnCapacity: 'increases' | 'decreases' | 'neutral' | 'unknown';
    capacityModifier: number | null;
    additionalRequirements: string[];
    overrides: string[];
    citation: string | null;
  }>;
  netCapacityModifier: number;
  hasRestrictions: boolean;
}

export interface PrecedentConfirmation {
  totalCases: number;
  approvalRate: number;
  avgTimelineMonths: number;
  avgApprovedUnits: number | null;
  recentExamples: Array<{
    address: string | null;
    zoningCode: string;
    outcome: string;
    timelineMonths: number | null;
    units: number | null;
    year: number | null;
  }>;
  riskLevel: 'low' | 'moderate' | 'high' | 'very_high' | 'unknown';
  approvalProbability: number;
}

export interface ConfirmationChainResult {
  dealId: string;
  parcelId: string | null;
  municipality: string;
  state: string;
  zoningCode: string | null;

  chain: ChainLink[];
  overallConfidence: number;
  overallStatus: 'complete' | 'partial' | 'critical_gaps';
  criticalGaps: string[];

  definitions: TriangulationResult['reconciledStandards'] | null;
  uses: UseConfirmation[];
  capacity: CapacityConfirmation | null;
  highestBestUse: HBUConfirmation | null;
  strategy: StrategyConfirmation | null;
  process: { path: string; confidence: number } | null;
  timeline: { months: number; confidence: number } | null;
  cost: CostConfirmation | null;
  overlays: OverlayConfirmation | null;
  precedent: PrecedentConfirmation | null;

  executedAt: string;
  executionMs: number;
}

const LINK_WEIGHTS: Record<number, number> = {
  1: 0.20,
  2: 0.12,
  3: 0.15,
  4: 0.10,
  5: 0.10,
  6: 0.08,
  7: 0.05,
  8: 0.08,
  9: 0.05,
  10: 0.07,
};


export class ConfirmationChainService {
  private triangulationService: ZoningTriangulationService;
  private knowledgeService: ZoningKnowledgeService;
  private envelopeService: BuildingEnvelopeService;

  constructor(private pool: Pool) {
    this.triangulationService = new ZoningTriangulationService(pool);
    this.knowledgeService = new ZoningKnowledgeService(pool);
    this.envelopeService = new BuildingEnvelopeService();
  }

  async execute(input: {
    dealId: string;
    parcelId?: string;
    lat?: number;
    lng?: number;
    municipality: string;
    state: string;
    userProvidedZoningCode?: string;
    propertyType?: PropertyType;
    targetUses?: string[];
    marketData?: {
      avgRentPerUnit?: number;
      avgRentPsf?: number;
      vacancyRate?: number;
      capRate?: number;
      rentGrowthPct?: number;
    };
    demandScore?: number;
    supplyPressureScore?: number;
    momentumScore?: number;
  }): Promise<ConfirmationChainResult> {
    const start = Date.now();
    const chain: ChainLink[] = [];
    const criticalGaps: string[] = [];

    const triangulation = await this.triangulationService.triangulate({
      dealId: input.dealId,
      parcelId: input.parcelId,
      lat: input.lat,
      lng: input.lng,
      municipality: input.municipality,
      state: input.state,
      userProvidedZoningCode: input.userProvidedZoningCode,
    });

    const zoningCode = triangulation.reconciledZoningCode;

    chain.push({
      link: 1,
      name: 'Definitions',
      status: triangulation.status === 'complete' || triangulation.status === 'confirmed' ? 'confirmed' : 'partial',
      confidence: triangulation.overallConfidence,
      source: [
        triangulation.sourceA.available ? 'county_parcel' : null,
        triangulation.sourceB.available ? 'county_category' : null,
        triangulation.sourceC.available ? 'municode' : null,
      ].filter(Boolean) as string[],
      citations: triangulation.sourceC.municodeUrl ? [triangulation.sourceC.municodeUrl] : [],
      feedsInto: [2, 3, 6, 9],
      gap: !triangulation.sourceA.available ? 'No county parcel record loaded — code unconfirmed by authoritative source' : undefined,
      data: triangulation.reconciledStandards,
    });

    if (!zoningCode) {
      criticalGaps.push('LINK 1: No zoning code resolved — entire chain is unanchored');
    }

    const useConfirmations: UseConfirmation[] = [];
    const usesToCheck = input.targetUses || ['multifamily', 'mixed_use', 'retail', 'office'];

    let profile: ZoningDistrictProfile | null = null;
    if (zoningCode) {
      const lookup = await this.knowledgeService.lookupDistrict(zoningCode, input.municipality);
      profile = lookup.profile;

      for (const use of usesToCheck) {
        const result = await this.knowledgeService.checkUsePermission(zoningCode, input.municipality, use);
        useConfirmations.push({
          use: result.use,
          status: result.status,
          conditions: result.conditions,
          approval: result.approvalRequired,
          confidence: result.confidence,
          citation: result.citation,
        });
      }
    }

    const byRightUses = useConfirmations.filter(u => u.status === 'by_right');
    const conditionalUses = useConfirmations.filter(u => u.status === 'conditional');
    const unknownUses = useConfirmations.filter(u => u.status === 'unknown');

    chain.push({
      link: 2,
      name: 'Permitted Uses',
      status: unknownUses.length === usesToCheck.length ? 'gap' : byRightUses.length > 0 ? 'confirmed' : 'partial',
      confidence: useConfirmations.length > 0
        ? useConfirmations.reduce((s, u) => s + u.confidence, 0) / useConfirmations.length / 100
        : 0,
      source: profile ? ['municode'] : [],
      citations: useConfirmations.map(u => u.citation).filter(Boolean) as string[],
      feedsInto: [3, 4, 5, 6],
      gap: unknownUses.length > 0 ? `${unknownUses.length} target use(s) have unknown status — use table may be incomplete` : undefined,
      data: useConfirmations,
    });

    if (byRightUses.length === 0 && conditionalUses.length === 0) {
      criticalGaps.push('LINK 2: No confirmed by-right or conditional uses — cannot determine buildable program');
    }

    const overlayConfirmation = await this.confirmOverlays(zoningCode, input.municipality, profile);

    chain.push({
      link: 9,
      name: 'Overlays & Special Districts',
      status: overlayConfirmation.overlays.length > 0 ? 'confirmed' : 'partial',
      confidence: overlayConfirmation.overlays.length > 0 ? 0.70 : 0.50,
      source: profile?.applicableOverlays?.length ? ['municode'] : ['inferred'],
      citations: overlayConfirmation.overlays.map(o => o.citation).filter(Boolean) as string[],
      feedsInto: [3, 4, 8],
      gap: overlayConfirmation.overlays.length === 0 ? 'No overlay data — if parcel is in historic/TOD/flood district, capacity may be wrong' : undefined,
      data: overlayConfirmation,
    });

    const capacityConfirmation = this.confirmCapacity(
      triangulation,
      input.propertyType || 'multifamily',
      overlayConfirmation.netCapacityModifier,
    );

    chain.push({
      link: 3,
      name: 'Development Capacity',
      status: capacityConfirmation.inputsConfirmed ? 'confirmed' : 'partial',
      confidence: capacityConfirmation.inputsConfirmed
        ? Math.min(triangulation.overallConfidence, 0.90)
        : 0.50,
      source: capacityConfirmation.inputsConfirmed ? ['triangulated'] : ['defaults'],
      citations: [],
      feedsInto: [4, 5, 8],
      gap: !capacityConfirmation.inputsConfirmed
        ? 'Capacity calculated on default/partial inputs — key dimensional standards missing'
        : undefined,
      data: capacityConfirmation,
    });

    const hbuConfirmation = this.confirmHBU(
      triangulation,
      input.propertyType,
      input.marketData,
      byRightUses.map(u => u.use),
      overlayConfirmation.netCapacityModifier,
    );

    chain.push({
      link: 4,
      name: 'Highest & Best Use',
      status: hbuConfirmation.marketDataAvailable ? 'confirmed' : 'partial',
      confidence: hbuConfirmation.marketDataAvailable ? 0.80 : 0.55,
      source: hbuConfirmation.marketDataAvailable ? ['triangulated', 'M05_market'] : ['triangulated', 'defaults'],
      citations: [],
      feedsInto: [5, 8],
      gap: !hbuConfirmation.marketDataAvailable
        ? 'HBU using default revenue assumptions — wire M05 market data for accurate ranking'
        : undefined,
      data: hbuConfirmation,
    });

    if (!hbuConfirmation.marketDataAvailable) {
      criticalGaps.push('LINK 4: HBU ranking uses default cap rates & revenue — not property-specific');
    }

    const strategyConfirmation = this.confirmStrategy(
      hbuConfirmation,
      capacityConfirmation,
      input.demandScore,
      input.supplyPressureScore,
      input.momentumScore,
      triangulation.overallConfidence,
    );

    chain.push({
      link: 5,
      name: 'Strategy Recommendation',
      status: strategyConfirmation.capacityFed ? 'confirmed' : 'partial',
      confidence: strategyConfirmation.capacityFed ? 0.75 : 0.40,
      source: [
        strategyConfirmation.capacityFed ? 'M03_capacity' : null,
        input.demandScore ? 'M06_demand' : null,
        input.supplyPressureScore ? 'M04_supply' : null,
        input.momentumScore ? 'M05_momentum' : null,
      ].filter(Boolean) as string[],
      citations: [],
      feedsInto: [8],
      gap: !input.demandScore ? 'No demand/supply/momentum signals — strategy scores are capacity-only' : undefined,
      data: strategyConfirmation,
    });

    chain.push({
      link: 6,
      name: 'Entitlement Process',
      status: triangulation.entitlementPath ? 'confirmed' : 'partial',
      confidence: triangulation.processConfidence,
      source: triangulation.processConfidence > 0.60 ? ['precedent', 'municode'] : ['inferred'],
      citations: [],
      feedsInto: [7, 8, 10],
      gap: triangulation.processConfidence < 0.50
        ? 'Low process confidence — no precedent outcomes for this code in this jurisdiction'
        : undefined,
      data: { path: triangulation.entitlementPath, confidence: triangulation.processConfidence },
    });

    chain.push({
      link: 7,
      name: 'Timeline',
      status: triangulation.predictedTimelineMonths ? 'confirmed' : 'partial',
      confidence: triangulation.timelineConfidence,
      source: triangulation.timelineConfidence > 0.50 ? ['calibrated_outcomes'] : ['default_estimate'],
      citations: [],
      feedsInto: [8],
      gap: triangulation.timelineConfidence < 0.50
        ? 'Timeline is default estimate — no calibration data for this entitlement path'
        : undefined,
      data: { months: triangulation.predictedTimelineMonths, confidence: triangulation.timelineConfidence },
    });

    const costConfirmation = await this.confirmCost(
      input.municipality,
      input.state,
      triangulation.entitlementPath,
      capacityConfirmation.maxUnits,
      capacityConfirmation.maxGFA,
    );

    chain.push({
      link: 8,
      name: 'Cost',
      status: costConfirmation.source === 'fee_schedule' ? 'confirmed'
        : costConfirmation.source === 'precedent' ? 'partial' : 'gap',
      confidence: costConfirmation.source === 'fee_schedule' ? 0.80
        : costConfirmation.source === 'precedent' ? 0.60 : 0.30,
      source: [costConfirmation.source],
      citations: costConfirmation.feeScheduleUrl ? [costConfirmation.feeScheduleUrl] : [],
      feedsInto: [],
      gap: costConfirmation.source === 'estimate'
        ? 'No fee schedule or precedent cost data — using regional estimates'
        : costConfirmation.source === 'unknown'
          ? 'No cost data available — critical gap for proforma accuracy'
          : undefined,
      data: costConfirmation,
    });

    if (costConfirmation.source === 'unknown' || costConfirmation.source === 'estimate') {
      criticalGaps.push('LINK 8: No fee schedule data — soft cost estimates may be significantly off');
    }

    const precedentConfirmation = await this.confirmPrecedent(
      zoningCode,
      input.municipality,
      input.state,
      triangulation.entitlementPath,
    );

    chain.push({
      link: 10,
      name: 'Precedent & Risk',
      status: precedentConfirmation.totalCases > 5 ? 'confirmed'
        : precedentConfirmation.totalCases > 0 ? 'partial' : 'gap',
      confidence: precedentConfirmation.totalCases > 10 ? 0.85
        : precedentConfirmation.totalCases > 3 ? 0.65
          : precedentConfirmation.totalCases > 0 ? 0.45 : 0.20,
      source: precedentConfirmation.totalCases > 0 ? ['outcome_history'] : [],
      citations: [],
      feedsInto: [6, 7],
      gap: precedentConfirmation.totalCases < 3
        ? `Only ${precedentConfirmation.totalCases} precedent case(s) — approval probability is unreliable`
        : undefined,
      data: precedentConfirmation,
    });

    chain.sort((a, b) => a.link - b.link);

    const confirmedLinks = chain.filter(l => l.status === 'confirmed').length;
    const gapLinks = chain.filter(l => l.status === 'gap').length;

    const weightedConfidence = chain.reduce((sum, link) => {
      const weight = LINK_WEIGHTS[link.link] || 0.10;
      return sum + (link.confidence * weight);
    }, 0);

    const overallStatus: ConfirmationChainResult['overallStatus'] =
      confirmedLinks >= 7 ? 'complete'
        : gapLinks >= 3 ? 'critical_gaps'
          : 'partial';

    const result: ConfirmationChainResult = {
      dealId: input.dealId,
      parcelId: input.parcelId || null,
      municipality: input.municipality,
      state: input.state,
      zoningCode,
      chain,
      overallConfidence: Math.round(weightedConfidence * 100) / 100,
      overallStatus,
      criticalGaps,
      definitions: triangulation.reconciledStandards,
      uses: useConfirmations,
      capacity: capacityConfirmation,
      highestBestUse: hbuConfirmation,
      strategy: strategyConfirmation,
      process: triangulation.entitlementPath
        ? { path: triangulation.entitlementPath, confidence: triangulation.processConfidence }
        : null,
      timeline: triangulation.predictedTimelineMonths
        ? { months: triangulation.predictedTimelineMonths, confidence: triangulation.timelineConfidence }
        : null,
      cost: costConfirmation,
      overlays: overlayConfirmation,
      precedent: precedentConfirmation,
      executedAt: new Date().toISOString(),
      executionMs: Date.now() - start,
    };

    await this.persistChain(result);

    zoningEventBus.publish('confirmation_chain:completed', {
      dealId: input.dealId,
      overallStatus,
      overallConfidence: result.overallConfidence,
      criticalGaps: criticalGaps.length,
      confirmedLinks,
    });

    return result;
  }

  async getForDeal(dealId: string): Promise<ConfirmationChainResult | null> {
    try {
      const result = await this.pool.query(
        'SELECT * FROM confirmation_chain_results WHERE deal_id = $1 ORDER BY executed_at DESC LIMIT 1',
        [dealId]
      );
      if (result.rows.length === 0) return null;
      const row = result.rows[0];
      const chainData = row.chain_json || {};
      return {
        dealId: row.deal_id,
        parcelId: row.parcel_id,
        municipality: row.municipality,
        state: row.state,
        zoningCode: row.zoning_code,
        chain: chainData.chain || [],
        overallConfidence: parseFloat(row.overall_confidence) || 0,
        overallStatus: row.overall_status,
        criticalGaps: row.critical_gaps || [],
        definitions: chainData.definitions || null,
        uses: chainData.uses || [],
        capacity: chainData.capacity || null,
        highestBestUse: chainData.hbu || null,
        strategy: chainData.strategy || null,
        process: chainData.process || null,
        timeline: chainData.timeline || null,
        cost: chainData.cost || null,
        overlays: chainData.overlays || null,
        precedent: chainData.precedent || null,
        executedAt: row.executed_at,
        executionMs: row.execution_ms,
      };
    } catch {
      return null;
    }
  }


  private confirmCapacity(
    tri: TriangulationResult,
    propertyType: PropertyType,
    overlayModifier: number,
  ): CapacityConfirmation {
    const std = tri.reconciledStandards;

    const hasFar = std.maxFar.value !== null;
    const hasDensity = std.maxDensityPerAcre.value !== null;
    const hasHeight = std.maxHeightFt.value !== null;
    const hasSetbacks = std.setbackFrontFt.value !== null;
    const inputsConfirmed = (hasFar || hasDensity) && hasHeight;

    const constraints: ZoningConstraints = {
      maxFAR: std.maxFar.value ? parseFloat(std.maxFar.value) : null,
      maxDensity: std.maxDensityPerAcre.value ? parseFloat(std.maxDensityPerAcre.value) : null,
      maxHeight: std.maxHeightFt.value ? parseInt(std.maxHeightFt.value) : null,
      minParkingPerUnit: std.parkingPerUnit.value ? parseFloat(std.parkingPerUnit.value) : null,
      maxLotCoverage: std.maxLotCoverage.value ? parseFloat(std.maxLotCoverage.value) : null,
    };

    const setbacks: Setbacks = {
      front: std.setbackFrontFt.value ? parseInt(std.setbackFrontFt.value) : 25,
      side: std.setbackSideFt.value ? parseInt(std.setbackSideFt.value) : 10,
      rear: std.setbackRearFt.value ? parseInt(std.setbackRearFt.value) : 20,
    };

    const landArea = 43560;

    const envelope = this.envelopeService.calculateEnvelope({
      landArea,
      setbacks,
      zoningConstraints: constraints,
      propertyType,
    });

    const adjustedUnits = Math.floor(envelope.maxCapacity * overlayModifier);
    const adjustedGFA = Math.floor(envelope.maxGFA * overlayModifier);

    return {
      maxUnits: adjustedUnits,
      maxGFA: adjustedGFA,
      maxFloors: envelope.maxFloors,
      buildableArea: envelope.buildableArea,
      limitingFactor: envelope.limitingFactor,
      parkingRequired: envelope.parkingRequired,
      inputsConfirmed,
    };
  }

  private confirmHBU(
    tri: TriangulationResult,
    preferredType: PropertyType | undefined,
    marketData: any | undefined,
    byRightUses: string[],
    overlayModifier: number,
  ): HBUConfirmation {
    const std = tri.reconciledStandards;

    const constraints: ZoningConstraints = {
      maxFAR: std.maxFar.value ? parseFloat(std.maxFar.value) : null,
      maxDensity: std.maxDensityPerAcre.value ? parseFloat(std.maxDensityPerAcre.value) : null,
      maxHeight: std.maxHeightFt.value ? parseInt(std.maxHeightFt.value) : null,
      minParkingPerUnit: std.parkingPerUnit.value ? parseFloat(std.parkingPerUnit.value) : null,
      maxLotCoverage: std.maxLotCoverage.value ? parseFloat(std.maxLotCoverage.value) : null,
    };

    const setbacks: Setbacks = {
      front: std.setbackFrontFt.value ? parseInt(std.setbackFrontFt.value) : 25,
      side: std.setbackSideFt.value ? parseInt(std.setbackSideFt.value) : 10,
      rear: std.setbackRearFt.value ? parseInt(std.setbackRearFt.value) : 20,
    };

    const landArea = 43560;

    const revenueAssumptions = marketData ? {
      multifamily: marketData.avgRentPerUnit || undefined,
      office: marketData.avgRentPsf ? marketData.avgRentPsf * 12 : undefined,
      retail: marketData.avgRentPsf ? marketData.avgRentPsf * 14 : undefined,
    } : undefined;

    const hbuResults = this.envelopeService.calculateHighestBestUse(
      { landArea, setbacks, zoningConstraints: constraints },
      revenueAssumptions,
    );

    const filteredResults = byRightUses.length > 0
      ? hbuResults.filter(r => this.useMatchesPropertyType(byRightUses, r.propertyType))
      : hbuResults;

    const finalResults = (filteredResults.length > 0 ? filteredResults : hbuResults);

    const rankings = finalResults.map((r, i) => ({
      propertyType: r.propertyType,
      maxCapacity: Math.floor(r.maxCapacity * overlayModifier),
      maxGFA: Math.floor(r.maxGFA * overlayModifier),
      estimatedNOI: Math.round(r.estimatedNOI * overlayModifier),
      estimatedValue: Math.round(r.estimatedValue * overlayModifier),
      recommended: i === 0,
      reasoning: r.reasoning,
      marketAdjusted: !!marketData,
    }));

    return {
      rankings,
      topUse: rankings[0]?.propertyType || 'multifamily',
      topValue: rankings[0]?.estimatedValue || 0,
      marketDataAvailable: !!marketData,
    };
  }

  private confirmStrategy(
    hbu: HBUConfirmation,
    capacity: CapacityConfirmation,
    demandScore?: number,
    supplyScore?: number,
    momentumScore?: number,
    positionConfidence?: number,
  ): StrategyConfirmation {
    const STRATEGY_WEIGHTS: Record<string, Record<string, number>> = {
      BTS:    { demand: 0.30, supply: 0.25, momentum: 0.20, position: 0.15, risk: 0.10 },
      Flip:   { demand: 0.15, supply: 0.20, momentum: 0.30, position: 0.20, risk: 0.15 },
      Rental: { demand: 0.25, supply: 0.25, momentum: 0.20, position: 0.20, risk: 0.10 },
      STR:    { demand: 0.25, supply: 0.20, momentum: 0.25, position: 0.20, risk: 0.10 },
    };

    const signals = {
      demand: demandScore || 50,
      supply: supplyScore ? 100 - supplyScore : 50,
      momentum: momentumScore || 50,
      position: (positionConfidence || 0.50) * 100,
      risk: 50,
    };

    const btsBonus = capacity.maxUnits > 20 ? 10 : capacity.maxUnits > 10 ? 5 : 0;

    const scores: Record<string, number> = {};
    const signalBreakdown: Record<string, any> = {};

    for (const [strategy, weights] of Object.entries(STRATEGY_WEIGHTS)) {
      let score = 0;
      const breakdown: Record<string, number> = {};
      for (const [signal, weight] of Object.entries(weights)) {
        const contribution = (signals[signal as keyof typeof signals] || 50) * weight;
        score += contribution;
        breakdown[signal] = Math.round(contribution * 10) / 10;
      }
      if (strategy === 'BTS') score += btsBonus;
      scores[strategy] = Math.round(Math.min(100, score));
      signalBreakdown[strategy] = breakdown;
    }

    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const recommended = sorted[0][0];
    const delta = sorted[0][1] - sorted[1][1];

    return {
      scores,
      recommended,
      arbitrageDetected: delta >= 10,
      arbitrageDelta: delta,
      signalBreakdown,
      capacityFed: capacity.inputsConfirmed,
    };
  }

  private async confirmCost(
    municipality: string,
    state: string,
    entitlementPath: string | null,
    units: number,
    gfa: number,
  ): Promise<CostConfirmation> {
    const feeResult = await this.pool.query(
      `SELECT * FROM municipality_fee_schedules
       WHERE LOWER(municipality) = LOWER($1) AND state = $2
       ORDER BY effective_date DESC LIMIT 1`,
      [municipality, state.toUpperCase()]
    ).catch(() => ({ rows: [] }));

    if (feeResult.rows.length > 0) {
      const fees = feeResult.rows[0];
      return {
        applicationFees: fees.application_fee ? parseFloat(fees.application_fee) : null,
        impactFees: fees.impact_fee_per_unit ? parseFloat(fees.impact_fee_per_unit) * units : null,
        legalEstimate: 15000,
        consultantEstimate: entitlementPath === 'by_right' ? 5000 : 25000,
        totalSoftCosts: null,
        hardCostPerSf: fees.construction_cost_per_sf ? parseFloat(fees.construction_cost_per_sf) : null,
        totalDevelopmentCost: null,
        source: 'fee_schedule',
        feeScheduleUrl: fees.source_url || null,
      };
    }

    const precedentCost = await this.pool.query(
      `SELECT AVG(actual_cost) as avg_cost, COUNT(*) as cnt
       FROM triangulation_outcomes
       WHERE actual_cost IS NOT NULL
         AND actual_outcome IN ('approved_as_predicted', 'approved_with_conditions')`,
    ).catch(() => ({ rows: [{ avg_cost: null, cnt: 0 }] }));

    if (parseInt(precedentCost.rows[0]?.cnt) > 2) {
      const avgCost = parseFloat(precedentCost.rows[0].avg_cost);
      return {
        applicationFees: null,
        impactFees: null,
        legalEstimate: null,
        consultantEstimate: null,
        totalSoftCosts: avgCost,
        hardCostPerSf: null,
        totalDevelopmentCost: null,
        source: 'precedent',
        feeScheduleUrl: null,
      };
    }

    const estimatedSoftCosts = entitlementPath === 'by_right' ? 20000
      : entitlementPath === 'variance' ? 40000
        : entitlementPath === 'cup' ? 60000
          : entitlementPath === 'rezone' ? 100000
            : 50000;

    const hardCostPerSf = 175;

    return {
      applicationFees: null,
      impactFees: null,
      legalEstimate: null,
      consultantEstimate: null,
      totalSoftCosts: estimatedSoftCosts,
      hardCostPerSf,
      totalDevelopmentCost: Math.round(gfa * hardCostPerSf + estimatedSoftCosts),
      source: 'estimate',
      feeScheduleUrl: null,
    };
  }

  private async confirmOverlays(
    zoningCode: string | null,
    municipality: string,
    profile: ZoningDistrictProfile | null,
  ): Promise<OverlayConfirmation> {
    const overlays: OverlayConfirmation['overlays'] = [];

    if (profile?.applicableOverlays) {
      for (const overlay of profile.applicableOverlays) {
        const type = this.classifyOverlay(overlay.overlay, overlay.name);
        const modifier = this.overlayCapacityModifier(type, overlay.overrides || []);

        overlays.push({
          name: overlay.name || overlay.overlay,
          code: overlay.overlay,
          type,
          impactOnCapacity: modifier < 1 ? 'decreases' : modifier > 1 ? 'increases' : 'neutral',
          capacityModifier: modifier,
          additionalRequirements: overlay.additionalRequirements || [],
          overrides: overlay.overrides || [],
          citation: null,
        });
      }
    }

    if (zoningCode) {
      const dealOverlays = await this.pool.query(
        `SELECT * FROM zoning_overlays
         WHERE LOWER(municipality) = LOWER($1)
           AND (applies_to_code = $2 OR applies_to_code IS NULL)`,
        [municipality, zoningCode]
      ).catch(() => ({ rows: [] }));

      for (const row of dealOverlays.rows) {
        if (!overlays.find(o => o.code === row.overlay_code)) {
          const type = this.classifyOverlay(row.overlay_code, row.overlay_name);
          overlays.push({
            name: row.overlay_name,
            code: row.overlay_code,
            type,
            impactOnCapacity: row.capacity_impact || 'unknown',
            capacityModifier: row.capacity_modifier ? parseFloat(row.capacity_modifier) : null,
            additionalRequirements: row.requirements || [],
            overrides: row.overrides || [],
            citation: row.code_section || null,
          });
        }
      }
    }

    const netModifier = overlays.reduce((product, o) => {
      return product * (o.capacityModifier || 1.0);
    }, 1.0);

    return {
      overlays,
      netCapacityModifier: Math.round(netModifier * 100) / 100,
      hasRestrictions: overlays.some(o => o.impactOnCapacity === 'decreases'),
    };
  }

  private async confirmPrecedent(
    zoningCode: string | null,
    municipality: string,
    state: string,
    entitlementPath: string | null,
  ): Promise<PrecedentConfirmation> {
    if (!zoningCode) {
      return { totalCases: 0, approvalRate: 0, avgTimelineMonths: 0, avgApprovedUnits: null, recentExamples: [], riskLevel: 'unknown', approvalProbability: 0 };
    }

    const outcomes = await this.pool.query(
      `SELECT to2.*, zt.reconciled_zoning_code
       FROM triangulation_outcomes to2
       JOIN zoning_triangulations zt ON zt.id = to2.triangulation_id
       WHERE UPPER(zt.reconciled_zoning_code) = UPPER($1)
         AND to2.actual_outcome != 'pending'
       ORDER BY to2.reported_at DESC
       LIMIT 50`,
      [zoningCode]
    ).catch(() => ({ rows: [] }));

    const rezonePrecedents = await this.pool.query(
      `SELECT * FROM zoning_precedents
       WHERE UPPER(from_zone) = UPPER($1) OR UPPER(to_zone) = UPPER($1)
       ORDER BY decided_at DESC
       LIMIT 20`,
      [zoningCode]
    ).catch(() => ({ rows: [] }));

    const allCases = outcomes.rows.length + rezonePrecedents.rows.length;
    const approved = outcomes.rows.filter((r: any) =>
      r.actual_outcome === 'approved_as_predicted' || r.actual_outcome === 'approved_with_conditions'
    ).length + rezonePrecedents.rows.filter((r: any) => r.outcome === 'approved').length;

    const approvalRate = allCases > 0 ? (approved / allCases) * 100 : 0;

    const timelinesMonths = outcomes.rows
      .filter((r: any) => r.actual_timeline_months)
      .map((r: any) => parseFloat(r.actual_timeline_months));
    const avgTimeline = timelinesMonths.length > 0
      ? timelinesMonths.reduce((s: number, t: number) => s + t, 0) / timelinesMonths.length
      : 0;

    const approvedUnits = outcomes.rows
      .filter((r: any) => r.actual_approved_units)
      .map((r: any) => parseInt(r.actual_approved_units));
    const avgUnits = approvedUnits.length > 0
      ? Math.round(approvedUnits.reduce((s: number, u: number) => s + u, 0) / approvedUnits.length)
      : null;

    const recentExamples = [
      ...outcomes.rows.slice(0, 5).map((r: any) => ({
        address: null,
        zoningCode: r.predicted_zoning_code || zoningCode,
        outcome: r.actual_outcome,
        timelineMonths: r.actual_timeline_months ? parseFloat(r.actual_timeline_months) : null,
        units: r.actual_approved_units ? parseInt(r.actual_approved_units) : null,
        year: r.reported_at ? new Date(r.reported_at).getFullYear() : null,
      })),
      ...rezonePrecedents.rows.slice(0, 3).map((r: any) => ({
        address: r.address || null,
        zoningCode: `${r.from_zone} → ${r.to_zone}`,
        outcome: r.outcome || 'unknown',
        timelineMonths: r.total_days ? Math.round(parseInt(r.total_days) / 30) : null,
        units: r.units ? parseInt(r.units) : null,
        year: r.decided_at ? new Date(r.decided_at).getFullYear() : null,
      })),
    ];

    let riskLevel: PrecedentConfirmation['riskLevel'] = 'unknown';
    if (allCases >= 5) {
      if (approvalRate >= 80) riskLevel = 'low';
      else if (approvalRate >= 60) riskLevel = 'moderate';
      else if (approvalRate >= 40) riskLevel = 'high';
      else riskLevel = 'very_high';
    } else if (allCases > 0) {
      riskLevel = 'moderate';
    }

    const dataPenalty = allCases < 5 ? 0.20 : allCases < 10 ? 0.10 : 0;
    const approvalProbability = Math.max(0, (approvalRate / 100) - dataPenalty);

    return {
      totalCases: allCases,
      approvalRate: Math.round(approvalRate * 10) / 10,
      avgTimelineMonths: Math.round(avgTimeline * 10) / 10,
      avgApprovedUnits: avgUnits,
      recentExamples,
      riskLevel,
      approvalProbability: Math.round(approvalProbability * 100) / 100,
    };
  }


  private useMatchesPropertyType(uses: string[], propertyType: PropertyType): boolean {
    const typeMap: Record<PropertyType, string[]> = {
      multifamily: ['multifamily', 'multi_family', 'residential', 'apartment', 'dwelling'],
      office: ['office', 'commercial', 'professional'],
      retail: ['retail', 'commercial', 'restaurant', 'store', 'shop'],
      industrial: ['industrial', 'warehouse', 'manufacturing', 'logistics'],
      'mixed-use': ['mixed', 'mixed_use', 'multifamily', 'retail', 'commercial'],
      hospitality: ['hotel', 'hospitality', 'lodging', 'motel', 'inn'],
    };
    const keywords = typeMap[propertyType] || [];
    return uses.some(u => keywords.some(k => u.toLowerCase().includes(k)));
  }

  private classifyOverlay(code: string, name: string): OverlayConfirmation['overlays'][0]['type'] {
    const combined = `${code} ${name}`.toLowerCase();
    if (combined.includes('historic') || combined.includes('landmark') || combined.includes('preservation')) return 'historic';
    if (combined.includes('flood') || combined.includes('fema') || combined.includes('sfha')) return 'floodplain';
    if (combined.includes('tod') || combined.includes('transit') || combined.includes('marta')) return 'tod';
    if (combined.includes('opportunity') || combined.includes('oz') || combined.includes('qoz')) return 'opportunity_zone';
    if (combined.includes('conservation') || combined.includes('wetland') || combined.includes('stream')) return 'conservation';
    if (combined.includes('environment') || combined.includes('protected')) return 'environmental';
    if (combined.includes('design') || combined.includes('review') || combined.includes('architecture')) return 'design_review';
    return 'other';
  }

  private overlayCapacityModifier(type: OverlayConfirmation['overlays'][0]['type'], overrides: string[]): number {
    const baseModifiers: Record<string, number> = {
      historic: 0.80,
      floodplain: 0.70,
      conservation: 0.60,
      environmental: 0.75,
      design_review: 0.95,
      tod: 1.15,
      opportunity_zone: 1.00,
      other: 1.00,
    };
    return baseModifiers[type] || 1.00;
  }

  private async persistChain(result: ConfirmationChainResult): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO confirmation_chain_results (
          deal_id, parcel_id, municipality, state, zoning_code,
          chain_json, overall_confidence, overall_status,
          critical_gaps, executed_at, execution_ms
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        ON CONFLICT (deal_id) DO UPDATE SET
          chain_json = EXCLUDED.chain_json,
          overall_confidence = EXCLUDED.overall_confidence,
          overall_status = EXCLUDED.overall_status,
          critical_gaps = EXCLUDED.critical_gaps,
          executed_at = EXCLUDED.executed_at,
          execution_ms = EXCLUDED.execution_ms,
          updated_at = NOW()`,
        [
          result.dealId,
          result.parcelId,
          result.municipality,
          result.state,
          result.zoningCode,
          JSON.stringify({ chain: result.chain, definitions: result.definitions, uses: result.uses, capacity: result.capacity, hbu: result.highestBestUse, strategy: result.strategy, process: result.process, timeline: result.timeline, cost: result.cost, overlays: result.overlays, precedent: result.precedent }),
          result.overallConfidence,
          result.overallStatus,
          result.criticalGaps,
          result.executedAt,
          result.executionMs,
        ]
      ).catch(() => {
        logger.warn('confirmation_chain_results table not available, skipping persist');
      });
    } catch (e) {
      logger.warn('Failed to persist chain result:', e);
    }
  }
}

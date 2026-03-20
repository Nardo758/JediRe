import { Pool } from 'pg';
import { ZoningKnowledgeService } from './zoning-knowledge.service';
import { ZoningReasoningService, ReasoningResponse } from './zoning-reasoning.service';

export type QueryIntent = 'lookup' | 'calculation' | 'reasoning' | 'application';

export interface RoutedQuery {
  intent: QueryIntent;
  question: string;
  districtCode?: string;
  municipality?: string;
  state?: string;
  parcelContext?: {
    landAreaSf?: number;
    lat?: number;
    lng?: number;
    address?: string;
  };
  dealId?: string;
}

export interface RoutedResponse {
  intent: QueryIntent;
  answer: string;
  data: any;
  confidence: number;
  citations: string[];
  processingLayer: 'A' | 'B' | 'A+B';
  processingTimeMs: number;
  followUpQuestions?: string[];
}

const LOOKUP_PATTERNS = [
  /what(?:'s| is) the (?:max |maximum )?(?:height|far|density|lot coverage|setback|parking|stories)/i,
  /how (?:tall|high|many (?:units|stories|floors))/i,
  /is .+ (?:a )?(?:by.?right|permitted|allowed|conditional|prohibited)/i,
  /what are the (?:setbacks|parking requirements|dimensional standards)/i,
  /what (?:uses|types) are (?:allowed|permitted|by.?right)/i,
];

const CALCULATION_PATTERNS = [
  /how many (?:units|rooms|sqft|square feet) can (?:i|we) (?:build|develop|fit)/i,
  /what(?:'s| is) the (?:buildable|max|maximum) (?:envelope|capacity|area|gfa)/i,
  /calculate|compute|how much parking/i,
  /what can (?:i|we) build on/i,
];

const APPLICATION_PATTERNS = [
  /(?:full|complete|comprehensive) (?:zoning )?(?:analysis|report|review)/i,
  /(?:analyze|analyse) (?:this |the )?(?:site|parcel|property|deal)/i,
  /what can (?:i|we) build at/i,
  /run (?:a |an )?(?:full )?(?:zoning )?analysis/i,
  /highest.?(?:and|&).?best.?use/i,
];

export class ZoningQueryRouter {
  private pool: Pool;
  private knowledgeService: ZoningKnowledgeService;
  private reasoningService: ZoningReasoningService;

  constructor(pool: Pool, knowledgeService: ZoningKnowledgeService, reasoningService: ZoningReasoningService) {
    this.pool = pool;
    this.knowledgeService = knowledgeService;
    this.reasoningService = reasoningService;
  }

  classifyIntent(question: string): QueryIntent {
    if (APPLICATION_PATTERNS.some(p => p.test(question))) return 'application';
    if (CALCULATION_PATTERNS.some(p => p.test(question))) return 'calculation';
    if (LOOKUP_PATTERNS.some(p => p.test(question))) return 'lookup';
    return 'reasoning';
  }

  async route(query: RoutedQuery): Promise<RoutedResponse> {
    const startTime = Date.now();
    const intent = query.intent || this.classifyIntent(query.question);

    try {
      switch (intent) {
        case 'lookup':
          return await this.handleLookup(query, startTime);
        case 'calculation':
          return await this.handleCalculation(query, startTime);
        case 'reasoning':
          return await this.handleReasoning(query, startTime);
        case 'application':
          return await this.handleApplication(query, startTime);
        default:
          return await this.handleReasoning(query, startTime);
      }
    } catch (error: any) {
      return {
        intent,
        answer: `Analysis could not be completed: ${error.message}`,
        data: null,
        confidence: 0,
        citations: [],
        processingLayer: 'A',
        processingTimeMs: Date.now() - startTime,
      };
    }
  }

  private async handleLookup(query: RoutedQuery, startTime: number): Promise<RoutedResponse> {
    if (!query.districtCode || !query.municipality) {
      return this.fallToReasoning(query, startTime);
    }

    const lookup = await this.knowledgeService.lookupDistrict(query.districtCode, query.municipality);
    if (!lookup.found || !lookup.profile) {
      return this.fallToReasoning(query, startTime);
    }

    const profile = lookup.profile;
    const q = query.question.toLowerCase();

    let answer = '';
    let data: any = {};

    if (q.includes('height')) {
      answer = `Maximum height in ${profile.code}: ${profile.dimensional.maxHeightFt || 'not specified'} ft` +
        (profile.dimensional.maxStories ? `, ${profile.dimensional.maxStories} stories` : '');
      data = { maxHeightFt: profile.dimensional.maxHeightFt, maxStories: profile.dimensional.maxStories };
    } else if (q.includes('far') || q.includes('floor area ratio')) {
      answer = `Maximum FAR in ${profile.code}: ${profile.dimensional.maxFAR || 'not specified'}`;
      data = { maxFAR: profile.dimensional.maxFAR };
    } else if (q.includes('density') || q.includes('units')) {
      answer = `Maximum density in ${profile.code}: ${profile.dimensional.maxDensityUnitsPerAcre || 'not specified'} units/acre`;
      data = { maxDensityUnitsPerAcre: profile.dimensional.maxDensityUnitsPerAcre };
    } else if (q.includes('setback')) {
      answer = `Setbacks in ${profile.code}: Front ${profile.dimensional.setbacks.front} ft, Side ${profile.dimensional.setbacks.side} ft, Rear ${profile.dimensional.setbacks.rear} ft`;
      data = profile.dimensional.setbacks;
    } else if (q.includes('parking')) {
      answer = `Parking in ${profile.code}: ` +
        (profile.parking.residential ? `${profile.parking.residential.perUnit} per unit` : '') +
        (profile.parking.commercial ? `, ${profile.parking.commercial.per1000sf} per 1000 sqft commercial` : '');
      data = profile.parking;
    } else if (q.includes('permitted') || q.includes('allowed') || q.includes('by right') || q.includes('uses')) {
      answer = `By-right uses in ${profile.code}: ${profile.uses.byRight.map(u => u.use).join(', ')}`;
      data = profile.uses;
    } else {
      answer = `District ${profile.code} (${profile.fullName}): FAR ${profile.dimensional.maxFAR || 'N/A'}, Height ${profile.dimensional.maxHeightFt || 'N/A'} ft, Density ${profile.dimensional.maxDensityUnitsPerAcre || 'N/A'} u/ac`;
      data = profile.dimensional;
    }

    return {
      intent: 'lookup',
      answer,
      data,
      confidence: lookup.confidence,
      citations: lookup.citations,
      processingLayer: 'A',
      processingTimeMs: Date.now() - startTime,
    };
  }

  private async handleCalculation(query: RoutedQuery, startTime: number): Promise<RoutedResponse> {
    if (!query.districtCode || !query.municipality) {
      return this.fallToReasoning(query, startTime);
    }

    const lookup = await this.knowledgeService.lookupDistrict(query.districtCode, query.municipality);
    if (!lookup.found || !lookup.profile) {
      return this.fallToReasoning(query, startTime);
    }

    const profile = lookup.profile;
    const landAreaSf = query.parcelContext?.landAreaSf || 0;

    if (landAreaSf <= 0) {
      return {
        intent: 'calculation',
        answer: 'Land area is required for capacity calculations. Please provide the parcel size.',
        data: null,
        confidence: 0,
        citations: [],
        processingLayer: 'A',
        processingTimeMs: Date.now() - startTime,
      };
    }

    const acres = landAreaSf / 43560;
    const dim = profile.dimensional;

    const byDensity = dim.maxDensityUnitsPerAcre ? Math.floor(dim.maxDensityUnitsPerAcre * acres) : null;
    const byFAR = dim.maxFAR ? Math.floor((dim.maxFAR * landAreaSf) / 850) : null;

    const floorHeight = 10;
    const maxFloors = dim.maxHeightFt ? Math.floor(dim.maxHeightFt / floorHeight) : (dim.maxStories || null);
    const buildableArea = this.estimateBuildableArea(landAreaSf, dim.setbacks);
    const byHeight = maxFloors ? Math.floor((buildableArea * maxFloors) / 850) : null;

    const constraints = [
      byDensity != null ? { name: 'Density', value: byDensity } : null,
      byFAR != null ? { name: 'FAR', value: byFAR } : null,
      byHeight != null ? { name: 'Height', value: byHeight } : null,
    ].filter(Boolean) as Array<{ name: string; value: number }>;

    constraints.sort((a, b) => a.value - b.value);
    const limitingFactor = constraints.length > 0 ? constraints[0] : null;
    const maxCapacity = limitingFactor ? limitingFactor.value : 0;

    const answer = `On ${acres.toFixed(2)} acres zoned ${profile.code}: maximum ${maxCapacity} units` +
      (limitingFactor ? ` (limited by ${limitingFactor.name})` : '') +
      `.\n\nConstraint breakdown: ` +
      constraints.map(c => `${c.name}: ${c.value} units`).join(', ');

    return {
      intent: 'calculation',
      answer,
      data: {
        landAreaSf,
        acres,
        maxCapacity,
        limitingFactor: limitingFactor?.name || 'none',
        constraints: constraints.reduce((acc, c) => ({ ...acc, [c.name.toLowerCase()]: c.value }), {}),
        buildableAreaSf: buildableArea,
        setbacks: dim.setbacks,
      },
      confidence: lookup.confidence,
      citations: lookup.citations,
      processingLayer: 'A',
      processingTimeMs: Date.now() - startTime,
    };
  }

  private async handleReasoning(query: RoutedQuery, startTime: number): Promise<RoutedResponse> {
    const result = await this.reasoningService.reason({
      question: query.question,
      districtCode: query.districtCode,
      municipality: query.municipality,
      state: query.state,
      parcelContext: query.parcelContext,
      dealId: query.dealId,
    });

    return {
      intent: 'reasoning',
      answer: result.answer,
      data: null,
      confidence: result.confidence,
      citations: result.citations,
      processingLayer: result.dataUsed.structuredRules ? 'A+B' : 'B',
      processingTimeMs: Date.now() - startTime,
      followUpQuestions: result.followUpQuestions,
    };
  }

  private async handleApplication(query: RoutedQuery, startTime: number): Promise<RoutedResponse> {
    const result = await this.reasoningService.reason({
      question: `Run a full zoning analysis. ${query.question}\n\nProvide:\n1. All applicable rules (base district + overlays)\n2. Buildable capacity under each constraint\n3. Available incentive programs with cost/benefit\n4. Entitlement paths (by-right, variance, rezone) with risk and timeline estimates\n5. Strategy recommendation with reasoning\n6. Confidence scoring per claim`,
      districtCode: query.districtCode,
      municipality: query.municipality,
      state: query.state,
      parcelContext: query.parcelContext,
      dealId: query.dealId,
    });

    return {
      intent: 'application',
      answer: result.answer,
      data: null,
      confidence: result.confidence,
      citations: result.citations,
      processingLayer: 'A+B',
      processingTimeMs: Date.now() - startTime,
      followUpQuestions: result.followUpQuestions,
    };
  }

  private fallToReasoning(query: RoutedQuery, startTime: number): Promise<RoutedResponse> {
    return this.handleReasoning({ ...query, intent: 'reasoning' }, startTime);
  }

  private estimateBuildableArea(landAreaSf: number, setbacks: { front: number; side: number; rear: number }): number {
    const side = Math.sqrt(landAreaSf);
    const effectiveWidth = Math.max(0, side - (2 * setbacks.side));
    const effectiveDepth = Math.max(0, side - setbacks.front - setbacks.rear);
    return effectiveWidth * effectiveDepth;
  }
}

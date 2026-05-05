/**
 * Submarket Peer Intelligence Engine — M39
 *
 * Dual-ranking service: direct competitors (within MSA) and structural
 * analogs (cross-MSA). Thin wrapper over M36 multi-tier factor loadings
 * and M37 similarity primitives.
 *
 * spec: Submarket_Peer_Intelligence_Spec.md
 *
 * Similarity modes (spec §3):
 *
 * Direct competitors (within MSA):
 *   sim = sim_geographic · sim_msa_factor · sim_character
 *
 * Structural analogs (cross-MSA):
 *   sim = sim_national_factor · sim_character · sim_macro_tier
 */

import type { Logger } from 'pino';
import { createLogger } from '../utils/logger';
import { spatialKernel } from './spatial-kernel';
import { multiTierFactorDecomposition, type SubmarketFactors } from './multi-tier-factor';

// ─── Types ───────────────────────────────────────────────────────────────────

export type RankingType = 'competitor' | 'analog' | 'combined';
export type UseCase = 'traffic' | 'forecast' | 'comp_set' | 'memo' | 'default';

export interface SubmarketCharacter {
  submarketId: string;
  assetClass: string;
  vintageDecade?: string;
  densityTier?: string;
  demographicIncomeTier?: string;
  demographicAgeTier?: string;
  unitCountEstimate?: number;
  avgRentPsf?: number;
  estimationDate: Date;
}

export interface VectorSimilarityBreakdown {
  total: number;
  geographic: number;
  msaFactor: number;
  nationalFactor: number;
  character: number;
  macroTier: number;
}

export interface PeerScore {
  submarketId: string;
  name?: string;
  msaId: string;
  similarity: number;
  breakdown: Partial<VectorSimilarityBreakdown>;
  recentMetrics?: { rentGrowth?: number; occupancy?: number };
}

export interface DualRankingResult {
  subjectSubmarketId: string;
  assetClass: string;
  competitors: PeerScore[];
  analogs: PeerScore[];
  computedAt: Date;
}

export interface CombinedRankingResult {
  subjectSubmarketId: string;
  assetClass: string;
  useCase: UseCase;
  candidates: PeerScore[];
  computedAt: Date;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const TOP_N_DEFAULT = 5;
const TOP_N_CAP = 25;

const MACRO_TIER_SIMILARITY: Record<string, Record<string, number>> = {
  high: { high: 1.0, medium: 0.6, low: 0.2 },
  medium: { medium: 1.0, low: 0.6 },
  low: { low: 1.0 },
};

const USE_CASE_WEIGHTS: Record<UseCase, { wCompete: number; wAnalog: number }> = {
  traffic: { wCompete: 0.80, wAnalog: 0.20 },
  forecast: { wCompete: 0.20, wAnalog: 0.80 },
  comp_set: { wCompete: 1.00, wAnalog: 0.00 },
  memo: { wCompete: 0.50, wAnalog: 0.50 },
  default: { wCompete: 0.50, wAnalog: 0.50 },
};

// Default character vector weights
const CHARACTER_WEIGHTS: Record<string, number> = {
  assetClass: 0.25,
  vintageDecade: 0.20,
  densityTier: 0.20,
  demographicIncomeTier: 0.15,
  demographicAgeTier: 0.10,
  unitCount: 0.05,
  rentPsf: 0.05,
};

// National factor distance bandwidth
const LAMBDA_BETA = 0.8;
const LAMBDA_GAMMA = 0.6;

// ─── Logger ──────────────────────────────────────────────────────────────────

const log: Logger = createLogger('peer-intelligence');

// ─── Class ───────────────────────────────────────────────────────────────────

export class PeerIntelligenceService {
  private characters: Map<string, SubmarketCharacter> = new Map();
  private rankingCache: Map<string, { competitors: PeerScore[]; analogs: PeerScore[]; expiresAt: Date }> = new Map();

  constructor() {}

  // ─── Character Vector Management ────────────────────────────────────

  registerCharacter(character: SubmarketCharacter): void {
    this.characters.set(character.submarketId, character);
    log.info({ submarketId: character.submarketId, assetClass: character.assetClass }, 'Character registered');
  }

  getCharacter(submarketId: string): SubmarketCharacter | undefined {
    return this.characters.get(submarketId);
  }

  bulkRegisterCharacters(characters: SubmarketCharacter[]): void {
    for (const c of characters) {
      this.characters.set(c.submarketId, c);
    }
    log.info({ count: characters.length }, 'Bulk character registration');
  }

  // ─── Direct Competitor Similarity (spec §3.1) ────────────────────────

  /**
   * Compute competitor similarity within MSA.
   * spec §3.1:
   *   sim = sim_geographic · sim_msa_factor · sim_character
   *
   *   sim_geographic = exp(-drive_time / λ_msa)
   *   sim_msa_factor = exp(-‖γᵢ - γⱼ‖ / λ_γ)
   */
  computeCompetitorSimilarity(
    subjectSmId: string,
    candidateSmId: string,
    subjectMsaId: string,
    candidateMsaId: string,
    subjectFactors: SubmarketFactors,
    candidateFactors: SubmarketFactors,
    characterOverrides?: SubmarketCharacter,
  ): { similarity: number; breakdown: Partial<VectorSimilarityBreakdown> } {
    // Constraint: same MSA
    if (subjectMsaId !== candidateMsaId) {
      return { similarity: 0, breakdown: { geographic: 0, msaFactor: 0, character: 0 } };
    }

    // Geographic: drive-time using spatial kernel
    const geoResult = spatialKernel.getSpatialCorrelation(subjectSmId, candidateSmId);
    const driveTimeMinutes = (geoResult as any).driveMinutes ?? geoResult.driveMinutes ?? subjectSmId === candidateSmId ? 0 : 10;
    const geographic = Math.exp(-driveTimeMinutes / (geoResult.sameMsa ? 12 : 25));
    const geoNorm = subjectSmId === candidateSmId ? 1.0 : geographic;

    // MSA factor exposure (γ loadings)
    const gammaSubject = Object.values(subjectFactors.msaLoadings);
    const gammaCandidate = Object.values(candidateFactors.msaLoadings);

    let gammaDist = 0;
    const maxLen = Math.max(gammaSubject.length, gammaCandidate.length);
    for (let i = 0; i < maxLen; i++) {
      const gs = gammaSubject[i] ?? 0;
      const gc = gammaCandidate[i] ?? 0;
      gammaDist += (gs - gc) ** 2;
    }
    gammaDist = Math.sqrt(gammaDist);
    const msaFactor = Math.exp(-gammaDist / LAMBDA_GAMMA);

    // Character similarity
    const subjChar = characterOverrides ?? this.characters.get(subjectSmId);
    const candChar = this.characters.get(candidateSmId);
    let character = 0.5; // default

    if (subjChar && candChar) {
      character = this.computeCharacterSimilarity(subjChar, candChar);
    }

    const total = geoNorm * msaFactor * character;

    return {
      similarity: Math.round(total * 10000) / 10000,
      breakdown: {
        geographic: Math.round(geoNorm * 10000) / 10000,
        msaFactor: Math.round(msaFactor * 10000) / 10000,
        character: Math.round(character * 10000) / 10000,
      },
    };
  }

  // ─── Structural Analog Similarity (spec §3.2) ────────────────────────

  /**
   * Compute analog similarity across MSAs.
   * spec §3.2:
   *   sim = sim_national_factor · sim_character · sim_macro_tier
   *
   *   sim_national_factor = exp(-‖βᵢ - βⱼ‖ / λ_β)
   *   sim_macro_tier = 1.0 if same tier, 0.6 if adjacent, 0.2 otherwise
   */
  computeAnalogSimilarity(
    subjectSmId: string,
    candidateSmId: string,
    subjectMsaId: string,
    candidateMsaId: string,
    subjectFactors: SubmarketFactors,
    candidateFactors: SubmarketFactors,
    characterOverrides?: SubmarketCharacter,
  ): { similarity: number; breakdown: Partial<VectorSimilarityBreakdown> } {
    // Constraint: different MSA
    if (subjectMsaId === candidateMsaId) {
      return { similarity: 0, breakdown: { nationalFactor: 0, character: 0, macroTier: 0 } };
    }

    // National factor exposure (β loadings)
    const betaSubject = Object.values(subjectFactors.nationalLoadings);
    const betaCandidate = Object.values(candidateFactors.nationalLoadings);

    let betaDist = 0;
    const maxLen = Math.max(betaSubject.length, betaCandidate.length);
    for (let i = 0; i < maxLen; i++) {
      const bs = betaSubject[i] ?? 0;
      const bc = betaCandidate[i] ?? 0;
      betaDist += (bs - bc) ** 2;
    }
    betaDist = Math.sqrt(betaDist);
    const nationalFactor = Math.exp(-betaDist / LAMBDA_BETA);

    // Character similarity
    const subjChar = characterOverrides ?? this.characters.get(subjectSmId);
    const candChar = this.characters.get(candidateSmId);
    let character = 0.5;

    if (subjChar && candChar) {
      character = this.computeCharacterSimilarity(subjChar, candChar);
    }

    // Macro tier
    const subjTier = this.inferTierFromAssetClass(subjectFactors.assetClass);
    const candTier = this.inferTierFromAssetClass(candidateFactors.assetClass);
    const macroTier = this.computeMacroTierSimilarity(subjTier, candTier);

    const total = nationalFactor * character * macroTier;

    return {
      similarity: Math.round(total * 10000) / 10000,
      breakdown: {
        nationalFactor: Math.round(nationalFactor * 10000) / 10000,
        character: Math.round(character * 10000) / 10000,
        macroTier: Math.round(macroTier * 10000) / 10000,
      },
    };
  }

  // ─── Full Dual Ranking (spec §3) ─────────────────────────────────────

  /**
   * Compute full dual ranking for a submarket.
   * Returns top-N competitors and top-N analogs.
   * spec §2.2, §3.4.
   */
  computeDualRanking(
    subjectSmId: string,
    assetClass: string,
    topN: number = TOP_N_DEFAULT,
    characterOverrides?: SubmarketCharacter,
  ): DualRankingResult {
    const allResults = multiTierFactorDecomposition.getAllSubmarketResults();
    const subjectResult = multiTierFactorDecomposition.getSubmarketFactors(subjectSmId);

    if (!subjectResult) {
      log.warn({ subjectSmId }, 'Subject submarket not found in factor decomposition');
      return { subjectSubmarketId: subjectSmId, assetClass, competitors: [], analogs: [], computedAt: new Date() };
    }

    const subjectMsaId = subjectResult.msaId;
    const competitors: { score: number; result: PeerScore }[] = [];
    const analogs: { score: number; result: PeerScore }[] = [];

    for (const result of allResults) {
      if (result.submarketId === subjectSmId) continue;
      if (result.assetClass !== assetClass) continue;

      const sameMsa = result.msaId === subjectMsaId;

      if (sameMsa) {
        // Competitor ranking
        const { similarity, breakdown } = this.computeCompetitorSimilarity(
          subjectSmId, result.submarketId,
          subjectMsaId, result.msaId,
          subjectResult, result, characterOverrides,
        );
        if (similarity > 0) {
          competitors.push({
            score: similarity,
            result: {
              submarketId: result.submarketId,
              msaId: result.msaId,
              similarity,
              breakdown,
            },
          });
        }
      } else {
        // Analog ranking
        const { similarity, breakdown } = this.computeAnalogSimilarity(
          subjectSmId, result.submarketId,
          subjectMsaId, result.msaId,
          subjectResult, result, characterOverrides,
        );
        if (similarity > 0) {
          analogs.push({
            score: similarity,
            result: {
              submarketId: result.submarketId,
              msaId: result.msaId,
              similarity,
              breakdown,
            },
          });
        }
      }
    }

    const cappedN = Math.min(topN, TOP_N_CAP);

    competitors.sort((a, b) => b.score - a.score);
    analogs.sort((a, b) => b.score - a.score);

    return {
      subjectSubmarketId: subjectSmId,
      assetClass,
      competitors: competitors.slice(0, cappedN).map(p => p.result),
      analogs: analogs.slice(0, cappedN).map(p => p.result),
      computedAt: new Date(),
    };
  }

  // ─── Combined Ranking (spec §4) ─────────────────────────────────────

  /**
   * Compute combined ranking for a specific use case.
   * spec §4.2: combined_score = w_compete · sim_competitor + w_analog · sim_analog
   */
  computeCombinedRanking(
    subjectSmId: string,
    assetClass: string,
    useCase: UseCase,
    topN: number = TOP_N_DEFAULT,
  ): CombinedRankingResult {
    const weights = USE_CASE_WEIGHTS[useCase];
    const dual = this.computeDualRanking(subjectSmId, assetClass, TOP_N_CAP);

    // Build combined map: candidate -> weighted score
    const combinedMap = new Map<string, PeerScore>();

    for (const comp of dual.competitors) {
      combinedMap.set(comp.submarketId, {
        ...comp,
        similarity: comp.similarity * weights.wCompete,
      });
    }

    for (const analog of dual.analogs) {
      const existing = combinedMap.get(analog.submarketId);
      if (existing) {
        existing.similarity += analog.similarity * weights.wAnalog;
      } else {
        combinedMap.set(analog.submarketId, {
          ...analog,
          similarity: analog.similarity * weights.wAnalog,
        });
      }
    }

    const sorted = Array.from(combinedMap.values()).sort((a, b) => b.similarity - a.similarity);
    const cappedN = Math.min(topN, TOP_N_CAP);

    return {
      subjectSubmarketId: subjectSmId,
      assetClass,
      useCase,
      candidates: sorted.slice(0, cappedN),
      computedAt: new Date(),
    };
  }

  // ─── Character Similarity ───────────────────────────────────────────

  private computeCharacterSimilarity(a: SubmarketCharacter, b: SubmarketCharacter): number {
    let score = 0;
    let totalWeight = 0;

    // Asset class (categorical match)
    const wAc = CHARACTER_WEIGHTS.assetClass;
    if (a.assetClass && b.assetClass && a.assetClass === b.assetClass) {
      score += wAc;
    }
    totalWeight += wAc;

    // Vintage decade
    const wV = CHARACTER_WEIGHTS.vintageDecade;
    if (a.vintageDecade && b.vintageDecade) {
      const decades = ['pre-1980', '1980s', '1990s', '2000s', '2010s', '2020s'];
      const idxA = decades.indexOf(a.vintageDecade);
      const idxB = decades.indexOf(b.vintageDecade);
      if (idxA >= 0 && idxB >= 0) {
        const gap = Math.abs(idxA - idxB);
        score += wV * (1 - gap * 0.3);
      }
    }
    totalWeight += wV;

    // Density tier
    const wD = CHARACTER_WEIGHTS.densityTier;
    if (a.densityTier && b.densityTier && a.densityTier === b.densityTier) {
      score += wD;
    }
    totalWeight += wD;

    // Income tier
    const wI = CHARACTER_WEIGHTS.demographicIncomeTier;
    if (a.demographicIncomeTier && b.demographicIncomeTier && a.demographicIncomeTier === b.demographicIncomeTier) {
      score += wI;
    }
    totalWeight += wI;

    // Age tier
    const wA = CHARACTER_WEIGHTS.demographicAgeTier;
    if (a.demographicAgeTier && b.demographicAgeTier && a.demographicAgeTier === b.demographicAgeTier) {
      score += wA;
    }
    totalWeight += wA;

    // Unit count
    const wU = CHARACTER_WEIGHTS.unitCount;
    if (a.unitCountEstimate && b.unitCountEstimate) {
      const ratio = Math.min(a.unitCountEstimate, b.unitCountEstimate) / Math.max(a.unitCountEstimate, b.unitCountEstimate);
      score += wU * ratio;
    }
    totalWeight += wU;

    // Rent PSF
    const wR = CHARACTER_WEIGHTS.rentPsf;
    if (a.avgRentPsf && b.avgRentPsf) {
      const ratio = Math.min(a.avgRentPsf, b.avgRentPsf) / Math.max(a.avgRentPsf, b.avgRentPsf);
      score += wR * ratio;
    }
    totalWeight += wR;

    return totalWeight > 0 ? score / totalWeight : 0.5;
  }

  /**
   * Infer tier from asset class. Simplified mapping.
   */
  private inferTierFromAssetClass(assetClass: string): 'high' | 'medium' | 'low' {
    const map: Record<string, 'high' | 'medium' | 'low'> = {
      'multifamily_class_a': 'high',
      'multifamily_class_b': 'medium',
      'multifamily_class_c': 'low',
      'office_class_a': 'high',
      'office_class_b': 'medium',
      'industrial_logistics': 'medium',
      'industrial_manufacturing': 'low',
      'retail_power_center': 'medium',
    };
    return map[assetClass] ?? 'medium';
  }

  private computeMacroTierSimilarity(a: string, b: string): number {
    return MACRO_TIER_SIMILARITY[a]?.[b] ?? 0.2;
  }

  // ─── Cache Management ───────────────────────────────────────────────

  /**
   * Get cached ranking if valid.
   */
  getCachedRanking(subjectSmId: string, assetClass: string): { competitors: PeerScore[]; analogs: PeerScore[] } | undefined {
    const cacheKey = `${subjectSmId}|${assetClass}`;
    const cached = this.rankingCache.get(cacheKey);
    if (cached && cached.expiresAt > new Date()) {
      return { competitors: cached.competitors, analogs: cached.analogs };
    }
    return undefined;
  }

  /**
   * Cache a ranking.
   */
  cacheRanking(subjectSmId: string, assetClass: string, ranking: DualRankingResult, ttlMs: number = 604800000 /* 1 week */): void {
    const cacheKey = `${subjectSmId}|${assetClass}`;
    this.rankingCache.set(cacheKey, {
      competitors: ranking.competitors,
      analogs: ranking.analogs,
      expiresAt: new Date(Date.now() + ttlMs),
    });
  }

  /**
   * Invalidate cache for rank refresh.
   */
  invalidateCache(subjectSmId?: string): void {
    if (subjectSmId) {
      for (const [key] of this.rankingCache.entries()) {
        if (key.startsWith(subjectSmId)) this.rankingCache.delete(key);
      }
    } else {
      this.rankingCache.clear();
    }
    log.info({ subjectSmId: subjectSmId ?? 'all' }, 'Ranking cache invalidated');
  }

  // ─── Stats ─────────────────────────────────────────────────────────

  getStats(): { nRegisteredCharacters: number; nCachedRankings: number } {
    return {
      nRegisteredCharacters: this.characters.size,
      nCachedRankings: this.rankingCache.size,
    };
  }
}

export const peerIntelligenceService = new PeerIntelligenceService();
export default peerIntelligenceService;

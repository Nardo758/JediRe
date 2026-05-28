/**
 * Comp Relevance Scoring Engine — D-COMP-1
 *
 * Scores a candidate comp pool against a subject property using six
 * deterministic factor functions, weighted by investment strategy.
 *
 * Formula:
 *   relevance = distance_decay    × W_dist
 *             + recency_decay     × W_recency
 *             + asset_class_match × W_class
 *             + size_similarity   × W_size
 *             + vintage_similarity× W_vintage
 *             + data_quality_tier × W_quality
 *
 * Tier labels (thresholds loaded from config):
 *   C1 ≥ 0.70 — Core comp (tightest match)
 *   C2 ≥ 0.45 — Comparable (good match)
 *   M1 ≥ 0.25 — Marginal (limited match)
 *   M2  < 0.25 — Weak (geographic fill only)
 *
 * Strategy weights are loaded from:
 *   backend/src/config/comp-relevance-weights.config.json
 */

import * as fs from 'fs';
import * as path from 'path';

export type InvestmentStrategy =
  | 'stabilized'
  | 'value_add'
  | 'ground_up'
  | 'redevelopment';

export type CompTier = 'C1' | 'C2' | 'M1' | 'M2';

export interface CompRelevanceWeights {
  w_distance: number;
  w_recency: number;
  w_class: number;
  w_size: number;
  w_vintage: number;
  w_quality: number;
}

export interface CompRelevanceFactors {
  distance_decay: number;
  recency_decay: number;
  asset_class_match: number;
  size_similarity: number;
  vintage_similarity: number;
  data_quality_tier: number;
}

export interface ScoredComp<T> {
  comp: T;
  relevance_score: number;
  relevance_tier: CompTier;
  factors: CompRelevanceFactors;
}

export interface SubjectProperty {
  units?: number | null;
  year_built?: number | null;
  asset_class?: string | null;
}

export interface CompCandidate {
  id: string;
  units?: number | null;
  year_built?: number | null;
  asset_class?: string | null;
  sale_date?: Date | string | null;
  distance_miles?: number | null;
  source?: string | null;
}

// ---------------------------------------------------------------------------
// Config loading — weights are read from the JSON config at module load time.
// ---------------------------------------------------------------------------
interface WeightsConfig {
  strategies: Record<string, CompRelevanceWeights>;
  tier_thresholds: { C1: number; C2: number; M1: number };
  default_display_count: number;
}

function loadWeightsConfig(): WeightsConfig {
  const configPath = path.resolve(__dirname, '../../config/comp-relevance-weights.config.json');
  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(raw) as WeightsConfig;
  } catch (err) {
    // Fallback defaults if config file is missing — fail loudly in test environments
    process.stderr.write(`[comp-relevance-scoring] WARNING: could not load weights config from ${configPath}: ${err}\n`);
    return {
      strategies: {
        stabilized:    { w_distance: 0.25, w_recency: 0.25, w_class: 0.20, w_size: 0.15, w_vintage: 0.10, w_quality: 0.05 },
        value_add:     { w_distance: 0.20, w_recency: 0.20, w_class: 0.20, w_size: 0.15, w_vintage: 0.15, w_quality: 0.10 },
        ground_up:     { w_distance: 0.20, w_recency: 0.15, w_class: 0.20, w_size: 0.15, w_vintage: 0.05, w_quality: 0.25 },
        redevelopment: { w_distance: 0.25, w_recency: 0.15, w_class: 0.15, w_size: 0.10, w_vintage: 0.05, w_quality: 0.30 },
      },
      tier_thresholds: { C1: 0.70, C2: 0.45, M1: 0.25 },
      default_display_count: 8,
    };
  }
}

const CONFIG = loadWeightsConfig();

function getWeights(strategy: InvestmentStrategy): CompRelevanceWeights {
  const w = CONFIG.strategies[strategy];
  if (!w) {
    process.stderr.write(`[comp-relevance-scoring] Unknown strategy "${strategy}", falling back to stabilized\n`);
    return CONFIG.strategies['stabilized'];
  }
  return w;
}

// ---------------------------------------------------------------------------
// Factor helpers (each returns 0–1)
// ---------------------------------------------------------------------------

function distanceDecayFactor(distanceMiles: number | null | undefined): number {
  if (distanceMiles == null || distanceMiles < 0) return 0.5;
  if (distanceMiles === 0) return 1.0;
  // Exponential decay: half-life of 1.5 miles
  // ≈1.0 at 0 mi, ≈0.72 at 0.6 mi, ≈0.50 at 1.5 mi, ≈0.14 at 5 mi
  return Math.exp(-distanceMiles / 1.5);
}

function recencyDecayFactor(saleDate: Date | string | null | undefined): number {
  if (!saleDate) return 0.3;
  const d = saleDate instanceof Date ? saleDate : new Date(saleDate);
  if (isNaN(d.getTime())) return 0.3;
  const monthsAgo = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
  // Linear decay: 1.0 at 0 months, 0.0 at 36 months
  return Math.max(0, 1 - monthsAgo / 36);
}

const CLASS_ORDER: Record<string, number> = { A: 4, B: 3, C: 2, D: 1 };

function assetClassMatchFactor(
  subjectClass: string | null | undefined,
  compClass: string | null | undefined,
): number {
  if (!subjectClass || !compClass) return 0.4;
  const s = subjectClass.toUpperCase().charAt(0);
  const c = compClass.toUpperCase().charAt(0);
  if (s === c) return 1.0;
  const sDiff = Math.abs((CLASS_ORDER[s] ?? 2) - (CLASS_ORDER[c] ?? 2));
  if (sDiff === 1) return 0.60;
  if (sDiff === 2) return 0.25;
  return 0.05;
}

function sizeSimilarityFactor(
  subjectUnits: number | null | undefined,
  compUnits: number | null | undefined,
): number {
  if (!subjectUnits || !compUnits || subjectUnits <= 0 || compUnits <= 0) return 0.4;
  const ratio = compUnits / subjectUnits;
  if (ratio >= 0.90 && ratio <= 1.10) return 1.0;
  if (ratio >= 0.70 && ratio <= 1.30) return 0.75;
  if (ratio >= 0.50 && ratio <= 1.50) return 0.45;
  if (ratio >= 0.30 && ratio <= 1.70) return 0.20;
  return 0.05;
}

function vintageSimilarityFactor(
  subjectYear: number | null | undefined,
  compYear: number | null | undefined,
): number {
  if (!subjectYear || !compYear) return 0.4;
  const diff = Math.abs(subjectYear - compYear);
  if (diff <= 5)  return 1.0;
  if (diff <= 10) return 0.75;
  if (diff <= 20) return 0.40;
  if (diff <= 30) return 0.15;
  return 0.05;
}

function dataQualityTierFactor(source: string | null | undefined): number {
  if (!source) return 0.40;
  const s = source.toLowerCase();
  if (s === 'county_recorded' || s === 'georgia_county' || s.startsWith('county')) return 1.00;
  if (s === 'research_agent') return 0.80;
  if (s === 'costar_upload')  return 0.70;
  if (s === 'om_extraction')  return 0.60;
  return 0.40;
}

// ---------------------------------------------------------------------------
// Tier classification
// ---------------------------------------------------------------------------
function classifyTier(score: number): CompTier {
  const t = CONFIG.tier_thresholds;
  if (score >= t.C1) return 'C1';
  if (score >= t.C2) return 'C2';
  if (score >= t.M1) return 'M1';
  return 'M2';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve a raw strategy string to a canonical InvestmentStrategy.
 * Order matters: 'redev...' must match before 'development' to avoid
 * 'redevelopment' resolving to 'ground_up'.
 */
export function resolveStrategy(raw: string | null | undefined): InvestmentStrategy {
  if (!raw) return 'stabilized';
  const lower = raw.toLowerCase().replace(/[^a-z_]/g, '_');
  if (lower.includes('value') || lower.includes('add')) return 'value_add';
  if (lower.includes('redev')) return 'redevelopment';         // ← before 'development'
  if (lower.includes('ground') || lower.includes('development')) return 'ground_up';
  return 'stabilized';
}

/**
 * Score a single candidate against a subject property.
 */
export function scoreComp(
  subject: SubjectProperty,
  candidate: CompCandidate,
  strategy: InvestmentStrategy = 'stabilized',
): { relevance_score: number; relevance_tier: CompTier; factors: CompRelevanceFactors } {
  const W = getWeights(strategy);

  const factors: CompRelevanceFactors = {
    distance_decay:    distanceDecayFactor(candidate.distance_miles),
    recency_decay:     recencyDecayFactor(candidate.sale_date),
    asset_class_match: assetClassMatchFactor(subject.asset_class, candidate.asset_class),
    size_similarity:   sizeSimilarityFactor(subject.units, candidate.units),
    vintage_similarity:vintageSimilarityFactor(subject.year_built, candidate.year_built),
    data_quality_tier: dataQualityTierFactor(candidate.source),
  };

  const relevance_score =
    factors.distance_decay    * W.w_distance +
    factors.recency_decay     * W.w_recency  +
    factors.asset_class_match * W.w_class    +
    factors.size_similarity   * W.w_size     +
    factors.vintage_similarity* W.w_vintage  +
    factors.data_quality_tier * W.w_quality;

  return {
    relevance_score: Math.round(relevance_score * 1000) / 1000,
    relevance_tier:  classifyTier(relevance_score),
    factors,
  };
}

/**
 * Score and rank an entire candidate pool.
 * Returns sorted descending by relevance_score.
 */
export function rankComps<T extends CompCandidate>(
  subject: SubjectProperty,
  candidates: T[],
  strategy: InvestmentStrategy = 'stabilized',
  defaultCount = CONFIG.default_display_count,
): {
  ranked: Array<ScoredComp<T>>;
  top: Array<ScoredComp<T>>;
  strategy: InvestmentStrategy;
  weights: CompRelevanceWeights;
} {
  const ranked: Array<ScoredComp<T>> = candidates.map((comp) => {
    const scoring = scoreComp(subject, comp, strategy);
    return { comp, ...scoring };
  });

  ranked.sort((a, b) => b.relevance_score - a.relevance_score);
  const top = ranked.slice(0, defaultCount);

  return { ranked, top, strategy, weights: getWeights(strategy) };
}

// ---------------------------------------------------------------------------
// UI metadata
// ---------------------------------------------------------------------------

export const TIER_LABELS: Record<CompTier, { label: string; description: string }> = {
  C1: { label: 'C1 — Core',       description: 'Tightest match across all factors' },
  C2: { label: 'C2 — Comparable', description: 'Good match; minor deviations' },
  M1: { label: 'M1 — Marginal',   description: 'Limited match; use with caution' },
  M2: { label: 'M2 — Weak',       description: 'Geographic fill only' },
};

export const WEIGHT_LABELS: Record<keyof CompRelevanceWeights, string> = {
  w_distance: 'Distance',
  w_recency:  'Recency',
  w_class:    'Asset Class',
  w_size:     'Size',
  w_vintage:  'Vintage',
  w_quality:  'Data Quality',
};

export const FACTOR_LABELS: Record<keyof CompRelevanceFactors, string> = {
  distance_decay:    'Distance',
  recency_decay:     'Recency',
  asset_class_match: 'Asset Class',
  size_similarity:   'Size',
  vintage_similarity:'Vintage',
  data_quality_tier: 'Data Quality',
};

/**
 * Derive geographic source tier from distance_miles.
 * Used when explicit geographic_tier metadata is not available from the query.
 *
 * Thresholds:
 *   trade_area:  ≤ radiusMiles (default 3 mi)
 *   submarket:   ≤ radiusMiles × 3 (default 9 mi)
 *   msa:         > radiusMiles × 3
 */
export function deriveGeographicTier(
  distanceMiles: number | null | undefined,
  radiusMiles = 3,
): 'trade_area' | 'submarket' | 'msa' {
  if (distanceMiles == null) return 'msa';
  if (distanceMiles <= radiusMiles) return 'trade_area';
  if (distanceMiles <= radiusMiles * 3) return 'submarket';
  return 'msa';
}

export const GEO_TIER_LABELS: Record<'trade_area' | 'submarket' | 'msa', string> = {
  trade_area: 'Trade Area',
  submarket:  'Submarket',
  msa:        'MSA',
};

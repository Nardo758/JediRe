/**
 * Comp Story Service — D-COMP-2 / D-COMP-3
 *
 * Implements two Wave C dispatches on top of the Wave B scoring engine:
 *
 *   D-COMP-2: Strategy-aware comp story grouping
 *     - value_add   → Rent Ceiling Gap (current-condition vs. renovated split)
 *     - stabilized  → Cap Rate Convergence (spread + recency emphasis)
 *     - ground_up   → Lease-Up Achievement (recently-delivered comps)
 *     - redevelopment → Repositioning Potential (obsolete-vintage pool)
 *
 *   D-COMP-3: Geographic cascade with explicit expansion flags
 *     - trade_area first (≥ 5 qualifying comps)
 *     - widen to submarket if fewer
 *     - widen to MSA if still fewer
 *     - each widening is recorded in CascadeMetadata
 */

import * as fs from 'fs';
import * as path from 'path';
import type { InvestmentStrategy } from './comp-relevance-scoring.service';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
interface StoryConfig {
  strategies: Record<string, {
    story_key: string;
    story_label: string;
    description: string;
    groups?: {
      lower: { key: string; label: string; description: string };
      upper: { key: string; label: string; description: string };
    };
    emphasize_recent_months?: number;
    recently_delivered_years?: number;
    obsolete_vintage_years?: number;
  }>;
  cascade_threshold: number;
}

function loadStoryConfig(): StoryConfig {
  const configPath = path.resolve(__dirname, '../../config/comp-story.config.json');
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8')) as StoryConfig;
  } catch (err) {
    process.stderr.write(`[comp-story] WARNING: could not load config from ${configPath}: ${err}\n`);
    return {
      cascade_threshold: 5,
      strategies: {
        value_add:     { story_key: 'rent_ceiling_gap',       story_label: 'Rent Ceiling Gap',         description: '', groups: { lower: { key: 'current_condition', label: 'Current Condition',         description: 'In-place ceiling' }, upper: { key: 'renovated', label: 'Renovated / Repositioned', description: 'Post-stab target' } } },
        stabilized:    { story_key: 'cap_rate_convergence',   story_label: 'Cap Rate Convergence',      description: '', emphasize_recent_months: 18 },
        ground_up:     { story_key: 'lease_up_achievement',   story_label: 'Lease-Up Achievement',      description: '', recently_delivered_years: 3 },
        redevelopment: { story_key: 'repositioning_potential',story_label: 'Repositioning Potential',   description: '', obsolete_vintage_years: 30 },
      },
    };
  }
}

const CONFIG = loadStoryConfig();

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Cascade metadata: which geographic tier was the widening floor. */
export interface CascadeMetadata {
  trade_area_count: number;
  submarket_count:  number;
  msa_count:        number;
  /** The widest tier that was actually needed. 'trade_area' = no widening occurred. */
  widened_to: 'trade_area' | 'submarket' | 'msa';
  threshold: number;
}

/** A strategy-driven grouping of comp IDs. */
export interface CompGroup {
  group_key:         string;
  label:             string;
  description:       string;
  comp_ids:          string[];
  avg_price_per_unit: number | null;
  median_cap_rate:   number | null;
}

/** Cap rate spread metadata for stabilized deals. */
export interface CapRateSpread {
  min:        number;
  max:        number;
  median:     number;
  p25:        number;
  p75:        number;
  spread_bps: number;
  recent_count: number;
}

/** Complete comp story for one API response. */
export interface CompStoryResult {
  story_key:   string;
  story_label: string;
  description: string;
  cascade:     CascadeMetadata;

  // value_add
  groups?:           CompGroup[];
  price_gap_per_unit?: number | null;
  price_gap_pct?:      number | null;

  // stabilized
  cap_rate_spread?: CapRateSpread;

  // ground_up
  recently_delivered_count?: number;
  recently_delivered_ids?:   string[];

  // redevelopment
  obsolete_vintage_count?: number;
  obsolete_vintage_ids?:   string[];
}

/** Minimal comp shape required by this service. */
export interface StoryComp {
  id:              string;
  year_built?:     number | null;
  implied_cap_rate?: number | null;
  price_per_unit:  number;
  recording_date?: Date | string | null;
  geographic_tier: 'trade_area' | 'submarket' | 'msa';
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lo  = Math.floor(idx);
  const hi  = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function avgOrNull(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function medianOrNull(values: number[]): number | null {
  if (values.length === 0) return null;
  return median([...values].sort((a, b) => a - b));
}

// ---------------------------------------------------------------------------
// Cascade computation (D-COMP-3)
// ---------------------------------------------------------------------------

function buildCascade(comps: StoryComp[]): CascadeMetadata {
  const threshold = CONFIG.cascade_threshold;
  let trade_area_count = 0;
  let submarket_count  = 0;
  let msa_count        = 0;

  for (const c of comps) {
    if (c.geographic_tier === 'trade_area') trade_area_count++;
    else if (c.geographic_tier === 'submarket') submarket_count++;
    else msa_count++;
  }

  let widened_to: 'trade_area' | 'submarket' | 'msa';
  if (trade_area_count >= threshold) {
    widened_to = 'trade_area';
  } else if (trade_area_count + submarket_count >= threshold) {
    widened_to = 'submarket';
  } else {
    widened_to = 'msa';
  }

  return { trade_area_count, submarket_count, msa_count, widened_to, threshold };
}

// ---------------------------------------------------------------------------
// Strategy story builders
// ---------------------------------------------------------------------------

function buildValueAddStory(comps: StoryComp[], cfg: typeof CONFIG['strategies'][string]): Partial<CompStoryResult> {
  if (comps.length === 0) return {};

  const prices = comps.map(c => c.price_per_unit).filter(p => p > 0);
  if (prices.length === 0) return {};

  const med = median([...prices].sort((a, b) => a - b));

  const lowerComps = comps.filter(c => c.price_per_unit < med);
  const upperComps = comps.filter(c => c.price_per_unit >= med);

  const lowerAvg  = avgOrNull(lowerComps.map(c => c.price_per_unit));
  const upperAvg  = avgOrNull(upperComps.map(c => c.price_per_unit));
  const lowerCapR = medianOrNull(lowerComps.map(c => c.implied_cap_rate).filter((v): v is number => v != null));
  const upperCapR = medianOrNull(upperComps.map(c => c.implied_cap_rate).filter((v): v is number => v != null));

  const groupCfg = cfg.groups!;
  const groups: CompGroup[] = [
    {
      group_key:          groupCfg.lower.key,
      label:              groupCfg.lower.label,
      description:        groupCfg.lower.description,
      comp_ids:           lowerComps.map(c => c.id),
      avg_price_per_unit: lowerAvg != null ? Math.round(lowerAvg) : null,
      median_cap_rate:    lowerCapR,
    },
    {
      group_key:          groupCfg.upper.key,
      label:              groupCfg.upper.label,
      description:        groupCfg.upper.description,
      comp_ids:           upperComps.map(c => c.id),
      avg_price_per_unit: upperAvg != null ? Math.round(upperAvg) : null,
      median_cap_rate:    upperCapR,
    },
  ];

  let price_gap_per_unit: number | null = null;
  let price_gap_pct:      number | null = null;
  if (lowerAvg != null && upperAvg != null && lowerAvg > 0) {
    price_gap_per_unit = Math.round(upperAvg - lowerAvg);
    price_gap_pct      = Math.round(((upperAvg - lowerAvg) / lowerAvg) * 1000) / 10;
  }

  return { groups, price_gap_per_unit, price_gap_pct };
}

function buildStabilizedStory(comps: StoryComp[], cfg: typeof CONFIG['strategies'][string]): Partial<CompStoryResult> {
  const recentMonths = cfg.emphasize_recent_months ?? 18;
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - recentMonths);

  const capRates = comps
    .map(c => c.implied_cap_rate)
    .filter((v): v is number => v != null && v > 0);

  if (capRates.length === 0) return {};

  const sorted = [...capRates].sort((a, b) => a - b);
  const med    = median(sorted);
  const p25    = percentile(sorted, 25);
  const p75    = percentile(sorted, 75);
  const spreadBps = Math.round((sorted[sorted.length - 1] - sorted[0]) * 10000);

  const recentComps = comps.filter(c => {
    if (!c.recording_date) return false;
    const d = c.recording_date instanceof Date ? c.recording_date : new Date(c.recording_date);
    return !isNaN(d.getTime()) && d >= cutoff;
  });

  const cap_rate_spread: CapRateSpread = {
    min:          Math.round(sorted[0] * 10000) / 10000,
    max:          Math.round(sorted[sorted.length - 1] * 10000) / 10000,
    median:       Math.round(med * 10000) / 10000,
    p25:          Math.round(p25 * 10000) / 10000,
    p75:          Math.round(p75 * 10000) / 10000,
    spread_bps:   spreadBps,
    recent_count: recentComps.length,
  };

  return { cap_rate_spread };
}

function buildGroundUpStory(comps: StoryComp[], cfg: typeof CONFIG['strategies'][string]): Partial<CompStoryResult> {
  const deliveredYears = cfg.recently_delivered_years ?? 3;
  const currentYear    = new Date().getFullYear();
  const cutoffYear     = currentYear - deliveredYears;

  const recent = comps.filter(c => c.year_built != null && c.year_built >= cutoffYear);

  return {
    recently_delivered_count: recent.length,
    recently_delivered_ids:   recent.map(c => c.id),
  };
}

function buildRedevelopmentStory(comps: StoryComp[], cfg: typeof CONFIG['strategies'][string]): Partial<CompStoryResult> {
  const obsoleteYears  = cfg.obsolete_vintage_years ?? 30;
  const currentYear    = new Date().getFullYear();
  const cutoffYear     = currentYear - obsoleteYears;

  const obsolete = comps.filter(c => c.year_built != null && c.year_built <= cutoffYear);

  return {
    obsolete_vintage_count: obsolete.length,
    obsolete_vintage_ids:   obsolete.map(c => c.id),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build the comp story for a ranked pool given the investment strategy.
 *
 * @param comps       Full ranked comp pool (must include geographic_tier).
 * @param strategy    One of the four canonical InvestmentStrategy values.
 * @returns           CompStoryResult with cascade metadata + strategy groups.
 */
export function buildCompStory(
  comps: StoryComp[],
  strategy: InvestmentStrategy,
): CompStoryResult {
  const cfg = CONFIG.strategies[strategy] ?? CONFIG.strategies['stabilized'];

  const cascade = buildCascade(comps);

  let extras: Partial<CompStoryResult> = {};
  switch (strategy) {
    case 'value_add':
      extras = buildValueAddStory(comps, cfg);
      break;
    case 'stabilized':
      extras = buildStabilizedStory(comps, cfg);
      break;
    case 'ground_up':
      extras = buildGroundUpStory(comps, cfg);
      break;
    case 'redevelopment':
      extras = buildRedevelopmentStory(comps, cfg);
      break;
  }

  return {
    story_key:   cfg.story_key,
    story_label: cfg.story_label,
    description: cfg.description,
    cascade,
    ...extras,
  };
}

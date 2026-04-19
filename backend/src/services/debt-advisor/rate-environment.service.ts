/**
 * Rate Environment Service
 * Classifies rate environment as Dropping | Flat | Rising based on SOFR forward curve.
 * Provides fixed/floating recommendation and narrative for the Debt Advisor.
 * Enriched with FRED macro indicators (GDP, CPI, UNRATE, consumer sentiment)
 * read from the m28_rate_environment DB table.
 */
import { fetchLiveRates, LiveRates } from '../rate-index.service';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';

export type RateEnvironment = 'Dropping' | 'Flat' | 'Rising';

export interface RateEnvironmentResult {
  classification: RateEnvironment;
  sofr: number;
  sofrAvg30: number;
  sofrAvg90: number;
  treasury10y: number;
  fedFundsTarget: number;
  sofrForward12moBps: number;
  ratePreference: 'Fixed' | 'Floating' | 'Either';
  termPreference: string;
  ratCapAdvice: string;
  narrative: string;
  pricingWindowScore: number;
  pricingWindowLabel: string;
  computedAt: string;
  // FRED macro enrichment (from m28_rate_environment DB)
  macroContext?: {
    gdpGrowthPct: number | null;
    cpiYoyPct: number | null;
    unrate: number | null;
    consumerSentiment: number | null;
    m2Yoy: number | null;
    dxy: number | null;
    snapshotDate: string | null;
    narrativeBlock: string;
  };
}

interface CacheEntry {
  data: RateEnvironmentResult;
  expiresAt: number;
}

let cache: CacheEntry | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000;

/**
 * Builds a 5-element SOFR forward curve from real trailing-average data.
 *
 * The NY Fed publishes SOFR 30/90/180-day compounded averages.  The slope
 * from 180d→30d average tells us the observed direction rates have been
 * moving; we extrapolate that trend forward 12 months to derive a
 * data-driven curve instead of a simple static heuristic.
 *
 * If `sofrAvg30 === 0` (data unavailable), falls back to a conservative
 * level-shift heuristic keyed on the absolute spot SOFR level.
 *
 * Returns annual rates in decimal form (e.g. 0.053), indexed [0..4] = Year 1..5.
 */
function buildSofrForwardCurve(
  sofr: number,
  sofrAvg30: number = 0,
  sofrAvg90: number = 0,
  sofrAvg180: number = 0
): number[] {
  if (sofrAvg30 > 0 && sofrAvg180 > 0) {
    // Observed monthly rate-change: 30d avg is the midpoint of last 30 days,
    // 180d avg is midpoint of last 180 days; gap between midpoints ≈ 75 days (~2.5 mo).
    // Per-month change = (sofrAvg30 - sofrAvg90) / 2 months (30d→90d midpoint gap ≈ 2 mo).
    const monthlyChangeDec = (sofrAvg30 - sofrAvg90) / 2;
    const annualChangeDec  = monthlyChangeDec * 12;
    return [
      sofr,
      sofr + annualChangeDec * (1 / 5),
      sofr + annualChangeDec * (2 / 5),
      sofr + annualChangeDec * (3 / 5),
      sofr + annualChangeDec * (4 / 5),
    ];
  }
  // Fallback: level-shift heuristic when averages are unavailable
  const baseDecline = sofr > 0.055 ? -0.0025 : sofr > 0.045 ? -0.0010 : 0.0005;
  return [
    sofr,
    sofr + baseDecline,
    sofr + baseDecline * 2,
    sofr + baseDecline * 3,
    sofr + baseDecline * 4,
  ];
}

function classifyEnvironment(sofrForward12moBps: number): RateEnvironment {
  if (sofrForward12moBps < -50) return 'Dropping';
  if (sofrForward12moBps > 50) return 'Rising';
  return 'Flat';
}

function computePricingWindowScore(
  env: RateEnvironment,
  sofr: number,
  treasury10y: number
): { score: number; label: string } {
  let score = 50;
  if (env === 'Dropping') score += 20;
  else if (env === 'Rising') score -= 20;
  const spread = treasury10y - sofr;
  if (spread > 0.015) score += 10;
  else if (spread < 0.005) score -= 10;
  if (sofr < 0.04) score += 15;
  else if (sofr > 0.06) score -= 15;
  const clamped = Math.max(0, Math.min(100, score));
  let label = 'Neutral';
  if (clamped >= 70) label = 'Favorable to Lock';
  else if (clamped >= 55) label = 'Slightly Favorable';
  else if (clamped <= 30) label = 'Avoid Locking Long';
  else if (clamped <= 45) label = 'Slightly Unfavorable';
  return { score: clamped, label };
}

interface MacroDbRow {
  gdp_growth_pct: number | null;
  cpi_yoy_pct: number | null;
  unrate: number | null;
  consumer_sentiment: number | null;
  m2_yoy: number | null;
  dxy: number | null;
  snapshot_date: string | null;
}

async function fetchLatestMacroFromDb(): Promise<MacroDbRow | null> {
  try {
    const result = await query(
      `SELECT gdp_growth_pct, cpi_yoy_pct, unrate, consumer_sentiment,
              m2_yoy, dxy, snapshot_date::text
       FROM m28_rate_environment
       WHERE gdp_growth_pct IS NOT NULL OR cpi_yoy_pct IS NOT NULL
       ORDER BY snapshot_date DESC LIMIT 1`,
      []
    );
    return result.rows[0] ?? null;
  } catch (err: any) {
    logger.warn('[RateEnvironment] Failed to fetch macro DB context', { error: err.message });
    return null;
  }
}

function buildMacroNarrativeBlock(macro: MacroDbRow): string {
  const parts: string[] = [];
  if (macro.gdp_growth_pct !== null) {
    const gdpSignal = macro.gdp_growth_pct >= 2.5 ? 'solid' : macro.gdp_growth_pct >= 1.0 ? 'moderate' : 'weak';
    parts.push(`Real GDP growth ${macro.gdp_growth_pct >= 0 ? '+' : ''}${macro.gdp_growth_pct}% YoY (${gdpSignal}) [FRED GDPC1]`);
  }
  if (macro.cpi_yoy_pct !== null) {
    const inflSignal = macro.cpi_yoy_pct > 4 ? 'elevated — upward rate pressure' : macro.cpi_yoy_pct > 2.5 ? 'moderately elevated' : 'near-target';
    parts.push(`CPI inflation ${macro.cpi_yoy_pct}% YoY (${inflSignal}) [FRED CPIAUCSL]`);
  }
  if (macro.unrate !== null) {
    const unrateSignal = macro.unrate < 4.5 ? 'tight labor market supports rent growth' : macro.unrate < 6 ? 'softening labor — watch occupancy trends' : 'elevated unemployment — demand risk factor';
    parts.push(`Unemployment ${macro.unrate}% (${unrateSignal}) [FRED UNRATE]`);
  }
  if (macro.consumer_sentiment !== null) {
    const sentSignal = macro.consumer_sentiment >= 80 ? 'strong consumer confidence' : macro.consumer_sentiment >= 65 ? 'neutral consumer confidence' : 'weak consumer confidence — demand headwind';
    parts.push(`Consumer sentiment ${macro.consumer_sentiment} (${sentSignal}) [FRED UMCSENT]`);
  }
  return parts.length > 0 ? '\nMacro backdrop: ' + parts.join('. ') + '.' : '';
}

function buildNarrative(
  env: RateEnvironment,
  sofr: number,
  forward12moBps: number,
  treasury10y: number,
  macroBlock?: string
): string {
  const sofrPct = (sofr * 100).toFixed(2);
  const forwardChange = Math.abs(forward12moBps).toFixed(0);
  const forwardDir = forward12moBps < 0 ? 'falling' : 'rising';
  const projectedSofr = ((sofr + forward12moBps / 10000) * 100).toFixed(2);
  const macro = macroBlock || '';

  if (env === 'Dropping') {
    return `Forward curve shows SOFR at ${sofrPct}% today ${forwardDir} ~${forwardChange}bps to ${projectedSofr}% over the next 12 months. For bridge loans, floating SOFR+ pricing beats comparable fixed-rate by an expected 30-50bps over a 3-year hold. Recommend floating with a rate cap. Alternative if rate certainty is required: short-term fixed (3-5yr) with open prepay.${macro}`;
  }
  if (env === 'Rising') {
    return `Forward curve shows SOFR at ${sofrPct}% today ${forwardDir} ~${forwardChange}bps to ${projectedSofr}% over the next 12 months. Fixed-rate financing significantly outperforms floating over the hold. Recommend locking long (10yr+) now. Rate caps are expensive in rising environments — consider higher strike or fixed alternative. 10yr Treasury at ${(treasury10y * 100).toFixed(2)}%.${macro}`;
  }
  return `Forward curve shows SOFR at ${sofrPct}% in a stable range (±25bps over 12mo). Fixed vs floating decision driven by hold period and prepayment needs. Match loan term to strategy timeline. 10yr Treasury at ${(treasury10y * 100).toFixed(2)}%.${macro}`;
}

export async function classifyRateEnvironment(): Promise<RateEnvironmentResult> {
  if (cache && Date.now() < cache.expiresAt) {
    return cache.data;
  }

  try {
    // Fetch live rates + macro DB context in parallel
    const [liveRates, macroRow] = await Promise.all([
      fetchLiveRates(),
      fetchLatestMacroFromDb(),
    ]);

    const sofr = (liveRates.sofr || 5.3) / 100;
    const sofrAvg30  = (liveRates.sofrAvg30  || 0) / 100;
    const sofrAvg90  = (liveRates.sofrAvg90  || 0) / 100;
    const sofrAvg180 = (liveRates.sofrAvg180 || 0) / 100;
    const treasury10y = (liveRates.treasury10Y || 4.3) / 100;
    const fedFundsTarget = ((liveRates.effrTargetLow || 5.25) + (liveRates.effrTargetHigh || 5.5)) / 2 / 100;

    const fwdCurve = buildSofrForwardCurve(sofr, sofrAvg30, sofrAvg90, sofrAvg180);
    const sofrForward12moBps = (fwdCurve[4] - fwdCurve[0]) * 10000;

    const classification = classifyEnvironment(sofrForward12moBps);

    const ratePreference: 'Fixed' | 'Floating' | 'Either' =
      classification === 'Dropping' ? 'Floating' :
      classification === 'Rising' ? 'Fixed' : 'Either';

    const termPreference =
      classification === 'Dropping' ? 'Shorter fixed 3-5yr or floating' :
      classification === 'Rising' ? 'Long fixed 10yr+' :
      'Match hold period';

    const ratCapAdvice =
      classification === 'Dropping' ? 'Buy cap at reasonable cost; priced in rate optimism' :
      classification === 'Rising' ? 'Cap expensive; consider higher strike or fixed alternative' :
      'Standard rate cap sizing';

    // Build macro narrative block from DB data (GDP, CPI, UNRATE, sentiment)
    const macroBlock = macroRow ? buildMacroNarrativeBlock(macroRow) : '';
    const narrative = buildNarrative(classification, sofr, sofrForward12moBps, treasury10y, macroBlock);

    const { score: pricingWindowScore, label: pricingWindowLabel } =
      computePricingWindowScore(classification, sofr, treasury10y);

    const macroContext = macroRow ? {
      gdpGrowthPct: macroRow.gdp_growth_pct,
      cpiYoyPct: macroRow.cpi_yoy_pct,
      unrate: macroRow.unrate,
      consumerSentiment: macroRow.consumer_sentiment,
      m2Yoy: macroRow.m2_yoy,
      dxy: macroRow.dxy,
      snapshotDate: macroRow.snapshot_date,
      narrativeBlock: macroBlock,
    } : undefined;

    const result: RateEnvironmentResult = {
      classification,
      sofr,
      sofrAvg30,
      sofrAvg90,
      treasury10y,
      fedFundsTarget,
      sofrForward12moBps,
      ratePreference,
      termPreference,
      ratCapAdvice,
      narrative,
      pricingWindowScore,
      pricingWindowLabel,
      computedAt: new Date().toISOString(),
      macroContext,
    };

    cache = { data: result, expiresAt: Date.now() + CACHE_TTL_MS };
    return result;
  } catch (err: any) {
    logger.warn('[RateEnvironment] Live rates unavailable, using fallback', { error: err.message });
    const sofr = 0.053;
    const treasury10y = 0.043;
    const sofrForward12moBps = -40;
    const classification: RateEnvironment = 'Flat';
    const result: RateEnvironmentResult = {
      classification,
      sofr,
      sofrAvg30: sofr,
      sofrAvg90: sofr,
      treasury10y,
      fedFundsTarget: 0.0538,
      sofrForward12moBps,
      ratePreference: 'Either',
      termPreference: 'Match hold period',
      ratCapAdvice: 'Standard rate cap sizing',
      narrative: `SOFR at ${(sofr * 100).toFixed(2)}% (estimated, live data unavailable). 10yr Treasury ~${(treasury10y * 100).toFixed(2)}%. Rate environment classification pending live data refresh.`,
      pricingWindowScore: 50,
      pricingWindowLabel: 'Neutral',
      computedAt: new Date().toISOString(),
    };
    cache = { data: result, expiresAt: Date.now() + 5 * 60 * 1000 };
    return result;
  }
}

export function bustRateCache(): void {
  cache = null;
}

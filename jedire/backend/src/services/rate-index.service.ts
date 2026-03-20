import { logger } from '../utils/logger';

export interface LiveRates {
  sofr: number;
  sofrAvg30: number;
  sofrAvg90: number;
  sofrAvg180: number;
  effr: number;
  effrTargetLow: number;
  effrTargetHigh: number;
  obfr: number;
  prime: number;
  treasury1Y: number;
  treasury2Y: number;
  treasury3Y: number;
  treasury5Y: number;
  treasury7Y: number;
  treasury10Y: number;
  treasury20Y: number;
  treasury30Y: number;
  swap10Y: number;
  lastUpdated: string;
  source: string;
}

export interface RateDataPoint {
  date: string;
  rate: number;
}

export interface EffrDataPoint {
  date: string;
  rate: number;
  targetLow: number;
  targetHigh: number;
}

export interface RateHistory {
  sofr: RateDataPoint[];
  effr: EffrDataPoint[];
  treasury5Y: RateDataPoint[];
  treasury7Y: RateDataPoint[];
  treasury10Y: RateDataPoint[];
  treasury30Y: RateDataPoint[];
  prime: RateDataPoint[];
  period: string;
  dataPoints: number;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const LIVE_CACHE_TTL = 15 * 60 * 1000;
const HISTORY_CACHE_TTL = 60 * 60 * 1000;

const NY_FED_BASE = 'https://markets.newyorkfed.org/api';
const TREASURY_BASE = 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/all';

const FETCH_HEADERS = {
  'Accept': 'application/json',
  'User-Agent': 'JediRE/1.0',
};

let liveCache: CacheEntry<LiveRates> | null = null;
let historyCache: Map<string, CacheEntry<RateHistory>> = new Map();
let lastKnownLive: LiveRates | null = null;

function isCacheValid<T>(cache: CacheEntry<T> | null | undefined, ttl: number): cache is CacheEntry<T> {
  return cache != null && (Date.now() - cache.timestamp) < ttl;
}

async function fetchJson(url: string, timeoutMs = 10000): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: FETCH_HEADERS, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchText(url: string, timeoutMs = 15000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'JediRE/1.0' },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

function parseTreasuryCsv(csv: string): Record<string, number> {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return {};

  const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
  const latestRow = lines[1].split(',').map(v => v.replace(/"/g, '').trim());

  const result: Record<string, number> = {};
  const mapping: Record<string, string> = {
    '1 Yr': 'treasury1Y',
    '2 Yr': 'treasury2Y',
    '3 Yr': 'treasury3Y',
    '5 Yr': 'treasury5Y',
    '7 Yr': 'treasury7Y',
    '10 Yr': 'treasury10Y',
    '20 Yr': 'treasury20Y',
    '30 Yr': 'treasury30Y',
  };

  headers.forEach((header, i) => {
    const key = mapping[header];
    if (key && latestRow[i]) {
      const val = parseFloat(latestRow[i]);
      if (!isNaN(val)) result[key] = val;
    }
  });

  return result;
}

function parseTreasuryHistoryCsv(csv: string): { date: string; values: Record<string, number> }[] {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
  const mapping: Record<string, string> = {
    '5 Yr': 'treasury5Y',
    '7 Yr': 'treasury7Y',
    '10 Yr': 'treasury10Y',
    '30 Yr': 'treasury30Y',
  };

  const rows: { date: string; values: Record<string, number> }[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(v => v.replace(/"/g, '').trim());
    if (!cols[0]) continue;

    const dateParts = cols[0].split('/');
    if (dateParts.length !== 3) continue;
    const isoDate = `${dateParts[2]}-${dateParts[0].padStart(2, '0')}-${dateParts[1].padStart(2, '0')}`;

    const values: Record<string, number> = {};
    headers.forEach((header, idx) => {
      const key = mapping[header];
      if (key && cols[idx]) {
        const val = parseFloat(cols[idx]);
        if (!isNaN(val)) values[key] = val;
      }
    });

    if (Object.keys(values).length > 0) {
      rows.push({ date: isoDate, values });
    }
  }

  return rows;
}

export async function fetchLiveRates(): Promise<LiveRates> {
  if (isCacheValid(liveCache, LIVE_CACHE_TTL)) {
    return liveCache.data;
  }

  try {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');

    const [nyFedData, treasuryCsv] = await Promise.allSettled([
      fetchJson(`${NY_FED_BASE}/rates/all/latest.json`),
      fetchText(`${TREASURY_BASE}/${yyyy}${mm}?type=daily_treasury_yield_curve&field_tdr_date_value=${yyyy}&page&_format=csv`),
    ]);

    let sofr = 0, sofrAvg30 = 0, sofrAvg90 = 0, sofrAvg180 = 0;
    let effr = 0, effrTargetLow = 0, effrTargetHigh = 0, obfr = 0;
    let nyFedDate = '';

    if (nyFedData.status === 'fulfilled' && nyFedData.value?.refRates) {
      for (const rate of nyFedData.value.refRates) {
        switch (rate.type) {
          case 'SOFR':
            sofr = rate.percentRate || 0;
            nyFedDate = rate.effectiveDate || '';
            break;
          case 'SOFRAI':
            sofrAvg30 = rate.average30day || 0;
            sofrAvg90 = rate.average90day || 0;
            sofrAvg180 = rate.average180day || 0;
            break;
          case 'EFFR':
            effr = rate.percentRate || 0;
            effrTargetLow = rate.targetRateFrom || 0;
            effrTargetHigh = rate.targetRateTo || 0;
            if (!nyFedDate) nyFedDate = rate.effectiveDate || '';
            break;
          case 'OBFR':
            obfr = rate.percentRate || 0;
            break;
        }
      }
    }

    let treasuryRates: Record<string, number> = {};
    if (treasuryCsv.status === 'fulfilled') {
      treasuryRates = parseTreasuryCsv(treasuryCsv.value);
    }

    const prime = effrTargetHigh > 0 ? effrTargetHigh + 3.25 : effr + 3.25;
    const treasury10Y = treasuryRates.treasury10Y || 0;
    const swap10Y = treasury10Y > 0 ? +(treasury10Y + 0.07).toFixed(2) : 0;

    const rates: LiveRates = {
      sofr,
      sofrAvg30,
      sofrAvg90,
      sofrAvg180,
      effr,
      effrTargetLow,
      effrTargetHigh,
      obfr,
      prime,
      treasury1Y: treasuryRates.treasury1Y || 0,
      treasury2Y: treasuryRates.treasury2Y || 0,
      treasury3Y: treasuryRates.treasury3Y || 0,
      treasury5Y: treasuryRates.treasury5Y || 0,
      treasury7Y: treasuryRates.treasury7Y || 0,
      treasury10Y,
      treasury20Y: treasuryRates.treasury20Y || 0,
      treasury30Y: treasuryRates.treasury30Y || 0,
      swap10Y,
      lastUpdated: nyFedDate || new Date().toISOString().split('T')[0],
      source: 'NY Fed Markets API + Treasury.gov',
    };

    liveCache = { data: rates, timestamp: Date.now() };
    lastKnownLive = rates;

    logger.info('[RateIndex] Live rates fetched', {
      sofr: rates.sofr,
      effr: rates.effr,
      treasury10Y: rates.treasury10Y,
      prime: rates.prime,
    });

    return rates;
  } catch (error: any) {
    logger.error('[RateIndex] Failed to fetch live rates, using fallback', { error: error.message });
    if (lastKnownLive) return lastKnownLive;
    throw new Error('Unable to fetch live rates and no fallback available');
  }
}

export async function fetchRateHistory(period: string = '2y'): Promise<RateHistory> {
  const cacheKey = `history_${period}`;
  const cached = historyCache.get(cacheKey);
  if (isCacheValid(cached, HISTORY_CACHE_TTL)) {
    return cached!.data;
  }

  const now = new Date();
  let startDate: Date;
  switch (period) {
    case '6m':
      startDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
      break;
    case '1y':
      startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      break;
    case '2y':
    default:
      startDate = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());
      break;
  }

  const fmtDate = (d: Date) => d.toISOString().split('T')[0];

  try {
    const [sofrData, effrData] = await Promise.allSettled([
      fetchJson(`${NY_FED_BASE}/rates/secured/sofr/search.json?startDate=${fmtDate(startDate)}&endDate=${fmtDate(now)}`),
      fetchJson(`${NY_FED_BASE}/rates/unsecured/effr/search.json?startDate=${fmtDate(startDate)}&endDate=${fmtDate(now)}`),
    ]);

    const sofrHistory: RateDataPoint[] = [];
    if (sofrData.status === 'fulfilled' && sofrData.value?.refRates) {
      for (const r of sofrData.value.refRates) {
        if (r.effectiveDate && r.percentRate != null) {
          sofrHistory.push({ date: r.effectiveDate, rate: r.percentRate });
        }
      }
    }

    const effrHistory: EffrDataPoint[] = [];
    if (effrData.status === 'fulfilled' && effrData.value?.refRates) {
      for (const r of effrData.value.refRates) {
        if (r.effectiveDate && r.percentRate != null) {
          effrHistory.push({
            date: r.effectiveDate,
            rate: r.percentRate,
            targetLow: r.targetRateFrom || 0,
            targetHigh: r.targetRateTo || 0,
          });
        }
      }
    }

    const months: string[] = [];
    const cursor = new Date(startDate);
    while (cursor <= now) {
      months.push(`${cursor.getFullYear()}${String(cursor.getMonth() + 1).padStart(2, '0')}`);
      cursor.setMonth(cursor.getMonth() + 1);
    }

    const treasuryFetches = await Promise.allSettled(
      months.map(ym => {
        const y = ym.substring(0, 4);
        return fetchText(
          `${TREASURY_BASE}/${ym}?type=daily_treasury_yield_curve&field_tdr_date_value=${y}&page&_format=csv`,
          8000,
        );
      })
    );

    const treasury5Y: RateDataPoint[] = [];
    const treasury7Y: RateDataPoint[] = [];
    const treasury10Y: RateDataPoint[] = [];
    const treasury30Y: RateDataPoint[] = [];

    for (const result of treasuryFetches) {
      if (result.status !== 'fulfilled') continue;
      const rows = parseTreasuryHistoryCsv(result.value);
      for (const row of rows) {
        if (row.values.treasury5Y) treasury5Y.push({ date: row.date, rate: row.values.treasury5Y });
        if (row.values.treasury7Y) treasury7Y.push({ date: row.date, rate: row.values.treasury7Y });
        if (row.values.treasury10Y) treasury10Y.push({ date: row.date, rate: row.values.treasury10Y });
        if (row.values.treasury30Y) treasury30Y.push({ date: row.date, rate: row.values.treasury30Y });
      }
    }

    const sortByDate = (a: { date: string }, b: { date: string }) => a.date.localeCompare(b.date);
    sofrHistory.sort(sortByDate);
    effrHistory.sort(sortByDate);
    treasury5Y.sort(sortByDate);
    treasury7Y.sort(sortByDate);
    treasury10Y.sort(sortByDate);
    treasury30Y.sort(sortByDate);

    const primeHistory: RateDataPoint[] = effrHistory.map(e => ({
      date: e.date,
      rate: +(((e.targetHigh || e.rate) + 3.25).toFixed(2)),
    }));

    const totalPoints = sofrHistory.length + effrHistory.length + treasury10Y.length;

    const history: RateHistory = {
      sofr: sofrHistory,
      effr: effrHistory,
      treasury5Y,
      treasury7Y,
      treasury10Y,
      treasury30Y,
      prime: primeHistory,
      period,
      dataPoints: totalPoints,
    };

    historyCache.set(cacheKey, { data: history, timestamp: Date.now() });

    logger.info('[RateIndex] Historical rates fetched', {
      period,
      sofrPoints: sofrHistory.length,
      effrPoints: effrHistory.length,
      treasuryPoints: treasury10Y.length,
    });

    return history;
  } catch (error: any) {
    logger.error('[RateIndex] Failed to fetch rate history', { error: error.message });
    throw new Error('Unable to fetch historical rate data');
  }
}

export interface OptimalStrategyInput {
  propertyType?: string;
  propertyValue?: number;
  noi?: number;
  holdPeriod?: string;
  strategy?: string;
  loanAmount?: number;
}

export interface OptimalStrategyResult {
  recommendedProduct: { type: string; reasoning: string };
  optimalRateType: { type: string; reasoning: string };
  lockVsFloat: { recommendation: string; dollarImpact: string; reasoning: string };
  costOfCapitalScore: number;
  entryTiming: { recommendation: string; reasoning: string };
  exitSignal: { recommendation: string; reasoning: string };
  keyRisks: string[];
  cyclePosition: string;
  summary: string;
}

const ANTHROPIC_API_KEY = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
const ANTHROPIC_BASE_URL = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL || 'https://api.anthropic.com';

export async function getOptimalStrategy(
  input: OptimalStrategyInput,
  liveRates: LiveRates,
): Promise<OptimalStrategyResult> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('Anthropic API key not configured');
  }

  const yieldCurveSlope = liveRates.treasury10Y - liveRates.treasury2Y;
  const curveShape = yieldCurveSlope > 0.5 ? 'steep' : yieldCurveSlope > 0 ? 'normal' : 'inverted';
  const fedDirection = liveRates.effrTargetHigh < 5.0 ? 'easing' : 'tightening';

  const prompt = `You are a senior CRE debt strategist. Analyze the current rate environment and deal specifics to recommend the optimal debt strategy. The goal is to minimize cost of capital and identify the best entry/exit timing.

CURRENT LIVE RATE DATA (from NY Fed + Treasury.gov):
- SOFR: ${liveRates.sofr}%
- SOFR 30-day avg: ${liveRates.sofrAvg30}% | 90-day: ${liveRates.sofrAvg90}% | 180-day: ${liveRates.sofrAvg180}%
- Fed Funds (EFFR): ${liveRates.effr}% (target range: ${liveRates.effrTargetLow}%-${liveRates.effrTargetHigh}%)
- Prime Rate: ${liveRates.prime}%
- Treasury 2Y: ${liveRates.treasury2Y}% | 5Y: ${liveRates.treasury5Y}% | 7Y: ${liveRates.treasury7Y}% | 10Y: ${liveRates.treasury10Y}% | 30Y: ${liveRates.treasury30Y}%
- 10Y Swap: ${liveRates.swap10Y}%
- Yield curve slope (10Y-2Y): ${yieldCurveSlope.toFixed(2)}% (${curveShape})
- Fed direction: ${fedDirection}

DEAL SPECIFICS:
- Property type: ${input.propertyType || 'Multifamily'}
- Property value: $${(input.propertyValue || 45000000).toLocaleString()}
- NOI: $${(input.noi || 3000000).toLocaleString()}
- Hold period: ${input.holdPeriod || '5 years'}
- Strategy: ${input.strategy || 'Value-Add'}
- Target loan amount: $${(input.loanAmount || 33750000).toLocaleString()}

Return ONLY valid JSON:
{
  "recommendedProduct": { "type": "Agency|CMBS|Bridge|Bank|LifeCo", "reasoning": "..." },
  "optimalRateType": { "type": "Fixed|Floating|Hybrid", "reasoning": "..." },
  "lockVsFloat": { "recommendation": "Lock|Float|Wait", "dollarImpact": "$X savings over Y years", "reasoning": "..." },
  "costOfCapitalScore": 1-100,
  "entryTiming": { "recommendation": "Lock now|Wait 3-6 months|Market favorable", "reasoning": "..." },
  "exitSignal": { "recommendation": "...", "reasoning": "..." },
  "keyRisks": ["risk1", "risk2", "risk3"],
  "cyclePosition": "early easing|mid easing|late easing|neutral|early tightening|peak",
  "summary": "2-3 sentence executive summary"
}

costOfCapitalScore: 100 = historically cheapest (best time to lock), 1 = historically expensive.
exitSignal: When should the owner sell based on where cost of capital is heading (cap rate compression = sell, widening = hold).`;

  const response = await fetch(`${ANTHROPIC_BASE_URL}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Claude API error: ${response.status} ${errText}`);
  }

  const data = await response.json() as any;
  const text = data.content?.[0]?.text || '';

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Claude did not return valid JSON for strategy');

  let depth = 0, end = -1;
  for (let i = 0; i < jsonMatch[0].length; i++) {
    if (jsonMatch[0][i] === '{') depth++;
    else if (jsonMatch[0][i] === '}') {
      depth--;
      if (depth === 0) { end = i + 1; break; }
    }
  }

  const parsed = JSON.parse(end > 0 ? jsonMatch[0].substring(0, end) : jsonMatch[0]);

  logger.info('[RateIndex] Optimal strategy generated', {
    score: parsed.costOfCapitalScore,
    product: parsed.recommendedProduct?.type,
    rateType: parsed.optimalRateType?.type,
  });

  return parsed;
}

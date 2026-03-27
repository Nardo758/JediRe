import { Router, Request, Response } from 'express';

const router = Router();

interface TickerItem {
  symbol: string;
  label: string;
  value: string;
  change: string;
  direction: 'up' | 'down' | 'flat';
}

interface FredSeries {
  id: string;
  symbol: string;
  label: string;
  isBps: boolean;
  isIndex: boolean;
}

const FRED_SERIES: FredSeries[] = [
  { id: 'DGS10',    symbol: '10Y TREASURY', label: '10Y TREASURY', isBps: true,  isIndex: false },
  { id: 'SOFR',     symbol: 'SOFR',         label: 'SOFR',         isBps: true,  isIndex: false },
  { id: 'CPIAUCSL', symbol: 'CPI',          label: 'CPI (Index)',  isBps: false, isIndex: true  },
  { id: 'UNRATE',   symbol: 'UNEMPLOYMENT', label: 'UNEMPLOYMENT', isBps: false, isIndex: false },
];

const FALLBACK: TickerItem[] = [
  { symbol: '10Y TREASURY', label: '10Y TREASURY', value: '4.41%',    change: '+6bps',  direction: 'up'   },
  { symbol: 'SOFR',         label: 'SOFR',         value: '5.31%',    change: '-2bps',  direction: 'down' },
  { symbol: 'CPI',          label: 'CPI (Index)',   value: '324.8pts', change: '+0.3pts', direction: 'up'  },
  { symbol: 'UNEMPLOYMENT', label: 'UNEMPLOYMENT', value: '3.9%',     change: '+0.1%',  direction: 'up'   },
];

let cacheData: TickerItem[] | null = null;
let cacheTime = 0;
const CACHE_TTL_MS = 15 * 60 * 1000;

async function fetchFredObservations(seriesId: string, apiKey: string): Promise<{ current: number; prev: number } | null> {
  try {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=2`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const json = await res.json() as { observations?: { value: string }[] };
    const obs = json.observations ?? [];
    const current = parseFloat(obs[0]?.value ?? '');
    const prev = parseFloat(obs[1]?.value ?? obs[0]?.value ?? '');
    if (isNaN(current)) return null;
    return { current, prev: isNaN(prev) ? current : prev };
  } catch {
    return null;
  }
}

/**
 * GET /feed
 *
 * Returns live macro rate data from FRED (10Y Treasury, SOFR, CPI, Unemployment).
 * No authentication required — this is public macro data.
 * Responses are cached for 15 minutes.
 * Falls back to static values if FRED_API_KEY is absent or FRED is unreachable.
 */
router.get('/feed', async (_req: Request, res: Response) => {
  if (cacheData && Date.now() - cacheTime < CACHE_TTL_MS) {
    return res.json({ data: cacheData, cached: true });
  }

  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) {
    return res.json({ data: FALLBACK, cached: false, source: 'fallback_no_key' });
  }

  try {
    const settled = await Promise.allSettled(
      FRED_SERIES.map(async (s) => {
        const obs = await fetchFredObservations(s.id, apiKey);
        if (!obs) return null;
        const delta = obs.current - obs.prev;

        let changeStr: string;
        let valueStr: string;

        if (s.isBps) {
          changeStr = `${delta >= 0 ? '+' : ''}${Math.round(delta * 100)}bps`;
          valueStr = `${obs.current.toFixed(2)}%`;
        } else if (s.isIndex) {
          changeStr = `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}pts`;
          valueStr = `${obs.current.toFixed(1)}pts`;
        } else {
          changeStr = `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`;
          valueStr = `${obs.current.toFixed(2)}%`;
        }

        const direction: TickerItem['direction'] =
          Math.abs(delta) < 0.005 ? 'flat' : delta > 0 ? 'up' : 'down';

        return {
          symbol: s.symbol,
          label: s.label,
          value: valueStr,
          change: changeStr,
          direction,
        } as TickerItem;
      })
    );

    const items: TickerItem[] = settled
      .filter((r): r is PromiseFulfilledResult<TickerItem | null> =>
        r.status === 'fulfilled' && r.value !== null)
      .map(r => r.value as TickerItem);

    if (items.length === 0) {
      return res.json({ data: FALLBACK, cached: false, source: 'fallback_no_data' });
    }

    cacheData = items;
    cacheTime = Date.now();
    return res.json({ data: items, cached: false, source: 'fred' });
  } catch (err: any) {
    return res.json({ data: FALLBACK, cached: false, source: 'fallback_error', error: err?.message });
  }
});

export default router;

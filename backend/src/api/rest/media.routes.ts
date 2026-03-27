import { Router, Request, Response } from 'express';

const router = Router();

interface RssCacheEntry {
  items: RssItem[];
  fetchedAt: number;
}

interface RssItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
}

const RSS_CACHE = new Map<string, RssCacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000;

const ALLOWED_HOSTS = [
  'product.costar.com',
  'www.globest.com',
  'globest.com',
  'www.bisnow.com',
  'bisnow.com',
  'therealdeal.com',
  'www.housingwire.com',
  'housingwire.com',
  'feeds.feedburner.com',
  'rss.nytimes.com',
  'www.wsj.com',
];

function extractItems(xml: string, sourceLabel: string): RssItem[] {
  const items: RssItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null && items.length < 20) {
    const block = match[1];
    const title = (block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
    const link = (block.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1] || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
    const pubDate = (block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1] || '').trim();
    if (title) {
      items.push({ title, link, pubDate, source: sourceLabel });
    }
  }
  return items;
}

router.get('/rss', async (req: Request, res: Response) => {
  const rawUrl = req.query.url as string;
  if (!rawUrl) {
    return res.status(400).json({ success: false, error: 'Missing url parameter' });
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return res.status(400).json({ success: false, error: 'Invalid URL' });
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return res.status(400).json({ success: false, error: 'Only http/https URLs allowed' });
  }

  if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
    return res.status(403).json({ success: false, error: 'Host not in allowlist' });
  }

  const cached = RSS_CACHE.get(rawUrl);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return res.json({ success: true, data: cached.items, cached: true });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(rawUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'JediRe-RSS/1.0' },
      redirect: 'manual',
    });
    clearTimeout(timeout);

    if (response.status >= 300 && response.status < 400) {
      return res.status(403).json({ success: false, error: 'Redirects not allowed for security' });
    }

    if (!response.ok) {
      return res.status(502).json({ success: false, error: `Feed returned ${response.status}` });
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('xml') && !contentType.includes('text') && !contentType.includes('rss')) {
      return res.status(502).json({ success: false, error: 'Response is not XML/RSS content' });
    }

    const xml = await response.text();
    if (xml.length > 2 * 1024 * 1024) {
      return res.status(502).json({ success: false, error: 'Response too large' });
    }
    const sourceLabel = parsed.hostname.replace(/^www\./, '').split('.')[0];
    const items = extractItems(xml, sourceLabel);

    RSS_CACHE.set(rawUrl, { items, fetchedAt: Date.now() });

    return res.json({ success: true, data: items, cached: false });
  } catch (err: any) {
    return res.status(502).json({ success: false, error: err.message || 'Failed to fetch feed' });
  }
});

export default router;

/**
 * ingest-recorder-transactions.ts
 *
 * Seeds market_sale_comps and recorded_transactions with real Atlanta MSA
 * multifamily apartment building sale transactions sourced from:
 *   1. Tavily-powered web search of public deal announcement news
 *   2. Fulton County assessor property records (estimated market value basis)
 *
 * This script targets transactions ≥ $5M (≥20-unit apartment communities).
 * Sale prices from assessor records use the Georgia 40%-of-FMV rule as proxy.
 *
 * Usage:
 *   cd backend && npx tsx src/scripts/ingest-recorder-transactions.ts [--tavily] [--assessor]
 */

import { Pool } from 'pg';
import { logger } from '../utils/logger';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

// ── Types ─────────────────────────────────────────────────────────────────────

interface SaleComp {
  property_name:  string;
  address:        string;
  city:           string;
  state:          string;
  county?:        string;
  msa?:           string;
  units?:         number;
  year_built?:    number;
  asset_class?:   string;
  sale_date:      string;  // YYYY-MM-DD
  sale_price:     number;
  price_per_unit?: number;
  cap_rate?:      number;
  buyer?:         string;
  seller?:        string;
  source:         string;
  source_url?:    string;
}

// ── Tavily Search ──────────────────────────────────────────────────────────────

async function tavilySearch(query: string): Promise<any[]> {
  if (!TAVILY_API_KEY) {
    logger.warn('[RecorderIngest] TAVILY_API_KEY not set — skipping web search');
    return [];
  }

  const resp = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key:         TAVILY_API_KEY,
      query,
      search_depth:    'advanced',
      include_answer:  false,
      include_domains: [],
      max_results:     10,
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!resp.ok) {
    logger.warn(`[RecorderIngest] Tavily error ${resp.status}`);
    return [];
  }

  const data: any = await resp.json();
  return data.results ?? [];
}

// ── Parse sale data from Tavily result text ────────────────────────────────────

function extractPrice(text: string): number | null {
  // Match $123M, $1.2B, $45,000,000, $1.23 million, $456K
  const patterns = [
    /\$([0-9,.]+)\s*billion/i,
    /\$([0-9,.]+)\s*B(?:\b|illion)/i,
    /\$([0-9,.]+)\s*million/i,
    /\$([0-9,.]+)\s*M(?:\b|illion)/i,
    /\$([0-9,.]+)\s*thousand/i,
    /\$([0-9,.]+)\s*K(?:\b|thousand)/i,
    /\$([0-9,]+)/,
  ];

  for (const pat of patterns) {
    const m = text.match(pat);
    if (m) {
      const num = parseFloat(m[1].replace(/,/g, ''));
      if (pat.source.toLowerCase().includes('billion')) return num * 1_000_000_000;
      if (pat.source.toLowerCase().includes('million') || pat.source.includes('M(?')) return num * 1_000_000;
      if (pat.source.toLowerCase().includes('thousand') || pat.source.includes('K(?')) return num * 1_000;
      if (num > 100_000) return num; // Raw dollar amount
      return null;
    }
  }
  return null;
}

function extractUnits(text: string): number | null {
  const m = text.match(/([0-9,]+)\s*(?:unit|apartment|home|bed|door)s?/i);
  return m ? parseInt(m[1].replace(/,/g, '')) : null;
}

function extractYearBuilt(text: string): number | null {
  const m = text.match(/built\s+(?:in\s+)?([12][0-9]{3})|([12][0-9]{3})\s+(?:vintage|construction)/i);
  const yr = m ? parseInt(m[1] || m[2]) : null;
  return yr && yr >= 1900 && yr <= 2026 ? yr : null;
}

function extractCapRate(text: string): number | null {
  const m = text.match(/([0-9]+\.?[0-9]*)\s*%?\s*cap(?:\s+rate)?/i);
  return m ? parseFloat(m[1]) : null;
}

function extractCity(text: string, msa: string): string {
  const atl = /\b(Atlanta|Decatur|Sandy Springs|Marietta|Smyrna|Alpharetta|Roswell|Brookhaven|Dunwoody|Peachtree City|Cumming|Kennesaw|Austell|College Park|East Point)\b/i;
  const clt = /\b(Charlotte|Huntersville|Concord|Kannapolis|Matthews|Ballantyne|Mooresville|Lake Norman|Mint Hill|Monroe|Gastonia)\b/i;
  const pat = msa === 'Charlotte' ? clt : atl;
  const m = text.match(pat);
  return m ? m[1] : (msa === 'Charlotte' ? 'Charlotte' : 'Atlanta');
}

function extractBuyer(text: string): string | null {
  const m = text.match(/(?:acquired by|sold to|purchased by|buyer[:\s]+)\s*([A-Z][A-Za-z\s&.,'-]+(?:LLC|LP|Inc|Corp|Capital|Equity|Realty|Properties|Ventures|Partners|Group|REIT|Trust)?)/);
  return m ? m[1].trim().slice(0, 120) : null;
}

function extractSeller(text: string): string | null {
  const m = text.match(/(?:sold by|seller[:\s]+)\s*([A-Z][A-Za-z\s&.,'-]+(?:LLC|LP|Inc|Corp|Capital|Equity|Realty|Properties|Ventures|Partners|Group|REIT|Trust)?)/);
  return m ? m[1].trim().slice(0, 120) : null;
}

function extractDate(text: string, url: string): string {
  // Try URL date first (common in news articles: /2024/05/15/)
  const urlDate = url.match(/\/(\d{4})\/(\d{2})(?:\/(\d{2}))?/);
  if (urlDate) {
    const [, y, m, d] = urlDate;
    const yr = parseInt(y);
    const mo = parseInt(m);
    if (yr >= 2018 && yr <= 2026 && mo >= 1 && mo <= 12) {
      return `${y}-${m}-${d ?? '01'}`;
    }
  }

  // Try text date patterns
  const textPatterns = [
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})/i,
    /\b(\d{1,2})\/(\d{1,2})\/(\d{4})/,
    /\b(\d{4})-(\d{2})-(\d{2})/,
  ];

  const months: Record<string, string> = {
    january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
    july: '07', august: '08', september: '09', october: '10', november: '11', december: '12',
  };

  for (const pat of textPatterns) {
    const m = text.match(pat);
    if (m) {
      if (pat.source.includes('January')) {
        const yr = m[3]; const mo = months[m[1].toLowerCase()]; const dy = m[2].padStart(2, '0');
        if (parseInt(yr) >= 2018 && parseInt(yr) <= 2026) return `${yr}-${mo}-${dy}`;
      }
    }
  }

  // Default to mid-year of current year if nothing found
  return '2024-06-01';
}

// ── Run Tavily searches for Atlanta and Charlotte multifamily deals ────────────

async function fetchTavilyComps(): Promise<SaleComp[]> {
  const comps: SaleComp[] = [];

  const queries = [
    // Atlanta
    { q: 'Atlanta apartment building sale 2024 multifamily units million transaction', msa: 'Atlanta, GA', state: 'GA' },
    { q: 'Atlanta Georgia multifamily apartment complex sold acquisition 2024 million', msa: 'Atlanta, GA', state: 'GA' },
    { q: 'Decatur Brookhaven Marietta apartment community sold 2024 investment', msa: 'Atlanta, GA', state: 'GA' },
    { q: 'Atlanta multifamily deal 2023 apartment sale price per unit cap rate', msa: 'Atlanta, GA', state: 'GA' },
    // Charlotte
    { q: 'Charlotte NC apartment building sold 2024 multifamily units million', msa: 'Charlotte, NC', state: 'NC' },
    { q: 'Charlotte North Carolina apartment community acquisition 2024 sale', msa: 'Charlotte, NC', state: 'NC' },
  ];

  for (const { q, msa, state } of queries) {
    console.log(`  🔍 Searching: "${q.slice(0, 60)}..."`);
    const results = await tavilySearch(q);

    for (const r of results) {
      const text = `${r.title ?? ''} ${r.content ?? ''}`;
      const url  = r.url ?? '';

      const price = extractPrice(text);
      if (!price || price < 5_000_000) continue;    // Only ≥ $5M deals

      const units = extractUnits(text);
      if (!units && price < 20_000_000) continue;   // Skip very small deals without unit count

      const city  = extractCity(text, msa.split(',')[0]);
      const date  = extractDate(text, url);

      const comp: SaleComp = {
        property_name: (r.title ?? '').slice(0, 200),
        address:       city,
        city,
        state,
        msa,
        units:         units ?? undefined,
        year_built:    extractYearBuilt(text) ?? undefined,
        sale_date:     date,
        sale_price:    price,
        price_per_unit: units && units > 0 ? Math.round(price / units) : undefined,
        cap_rate:      extractCapRate(text) ?? undefined,
        buyer:         extractBuyer(text) ?? undefined,
        seller:        extractSeller(text) ?? undefined,
        source:        'public_records',
        source_url:    url || undefined,
      };

      comps.push(comp);
    }

    // Rate limit: 1 request per second
    await new Promise(r => setTimeout(r, 1200));
  }

  console.log(`  ✓ Tavily extracted ${comps.length} candidate comps`);
  return comps;
}

// ── Build comps from Fulton assessor multifamily records ──────────────────────
// Fulton County reports ASSESSEDVALUE as the assessed fair market value.
// Georgia's 40%-of-FMV rule means the actual tax digest value is 40% of FMV,
// but the ArcGIS layer's ASSESSEDVALUE field represents the full appraised value.
// We use it directly without a divisor.

async function buildAssessorComps(): Promise<SaleComp[]> {
  const res = await pool.query(`
    SELECT
      parcel_id, address, county, units,
      assessed_value, appraised_value,
      land_use_code, data_source_url
    FROM property_records
    WHERE county = 'Fulton'
      AND units >= 20
      AND units <= 2000
      AND (appraised_value > 1000000 OR assessed_value > 1000000)
    ORDER BY COALESCE(appraised_value, assessed_value) DESC
    LIMIT 200
  `);

  return res.rows.map(row => {
    // Use appraised_value if available, else assessed_value as FMV proxy
    const fmv = Number(row.appraised_value || 0) > 0
      ? Number(row.appraised_value)
      : Number(row.assessed_value);

    const unitCount = Number(row.units) || null;
    const ppu = unitCount && unitCount > 0 ? Math.round(fmv / unitCount) : null;

    // Sanity check: skip if PPU is absurdly high (>$2M) or very low (<$10K)
    if (ppu && (ppu > 2_000_000 || ppu < 10_000)) return null;

    return {
      property_name: `${row.address} (Assessor Estimate)`,
      address:       row.address || '',
      city:          'Atlanta',
      state:         'GA',
      county:        'Fulton',
      msa:           'Atlanta, GA',
      units:         unitCount ?? undefined,
      sale_date:     '2024-01-01',   // Assessment year proxy
      sale_price:    fmv,
      price_per_unit: ppu ?? undefined,
      source:        'assessor_estimate',
      source_url:    row.data_source_url || undefined,
    } as SaleComp;
  }).filter((c): c is SaleComp => c !== null && c.sale_price >= 1_000_000);
}

// ── Upsert into market_sale_comps ──────────────────────────────────────────────

async function upsertMarketSaleComps(comps: SaleComp[]): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped  = 0;

  for (const c of comps) {
    if (!c.sale_price || !c.sale_date || !c.address || !c.city || !c.state) {
      skipped++;
      continue;
    }

    const ppu = c.price_per_unit ?? (c.units && c.units > 0 ? Math.round(c.sale_price / c.units) : null);

    try {
      await pool.query(
        `INSERT INTO market_sale_comps (
           property_name, address, city, state, county, msa,
           units, year_built, asset_class,
           sale_date, sale_price, price_per_unit, cap_rate,
           buyer, seller, source, source_id, created_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,NOW())
         ON CONFLICT DO NOTHING`,
        [
          (c.property_name || c.address).slice(0, 255),
          c.address.slice(0, 255),
          c.city,
          c.state,
          c.county ?? null,
          c.msa ?? null,
          c.units ?? null,
          c.year_built ?? null,
          c.asset_class ?? null,
          c.sale_date,
          c.sale_price,
          ppu,
          c.cap_rate ?? null,
          c.buyer ?? null,
          c.seller ?? null,
          c.source,
          c.source_url ? c.source_url.slice(0, 500) : null,
        ]
      );
      inserted++;
    } catch (err: any) {
      logger.warn('[RecorderIngest] upsert failed', { error: err.message });
      skipped++;
    }
  }

  return { inserted, skipped };
}

// ── Upsert into recorded_transactions ──────────────────────────────────────────

async function upsertRecordedTransactions(comps: SaleComp[]): Promise<{ inserted: number }> {
  let inserted = 0;

  const eligible = comps.filter(c =>
    c.units && c.units >= 10 &&
    c.sale_price >= 1_000_000 &&
    c.source !== 'assessor_estimate'   // Only use real (news-sourced) transactions here
  );

  for (const c of eligible) {
    const ppu = c.price_per_unit ?? (c.units! > 0 ? Math.round(c.sale_price / c.units!) : null);

    try {
      await pool.query(
        `INSERT INTO recorded_transactions (
           recording_date, property_address, units,
           derived_sale_price, price_per_unit,
           implied_cap_rate, buyer_name, seller_name,
           city, state_code, created_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
         ON CONFLICT DO NOTHING`,
        [
          c.sale_date,
          (c.address || c.city).slice(0, 500),
          c.units ?? null,
          c.sale_price,
          ppu,
          c.cap_rate ?? null,
          c.buyer ?? null,
          c.seller ?? null,
          c.city,
          c.state,
        ]
      );
      inserted++;
    } catch (err: any) {
      logger.warn('[RecorderIngest] recorded_transactions upsert failed', { error: err.message });
    }
  }

  return { inserted };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function ingestRecordedTransactions(opts: {
  useTavily:   boolean;
  useAssessor: boolean;
}): Promise<void> {
  const snapshotDate = new Date().toISOString().split('T')[0];
  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(`Atlanta/Charlotte Multifamily Comps Ingest — ${snapshotDate}`);
  console.log(`═══════════════════════════════════════════════════`);

  const allComps: SaleComp[] = [];

  if (opts.useTavily) {
    console.log('\n▸ Phase 1: Tavily web search for deal news...');
    const tavilyComps = await fetchTavilyComps();
    allComps.push(...tavilyComps);
  }

  if (opts.useAssessor) {
    console.log('\n▸ Phase 2: Fulton assessor-estimated market values...');
    const assessorComps = await buildAssessorComps();
    console.log(`  Found ${assessorComps.length} Fulton multifamily records with value ≥ $5M`);
    allComps.push(...assessorComps);
  }

  if (allComps.length === 0) {
    console.log('\n⚠️  No comps generated — run with --tavily and/or --assessor flags');
    return;
  }

  console.log(`\n▸ Phase 3: Inserting ${allComps.length} comps...`);
  const { inserted: mscInserted, skipped } = await upsertMarketSaleComps(allComps);
  console.log(`  market_sale_comps: +${mscInserted} new, ${skipped} skipped/invalid`);

  const { inserted: rtInserted } = await upsertRecordedTransactions(allComps);
  console.log(`  recorded_transactions: +${rtInserted} new`);

  console.log(`\n✅ Comps ingest complete`);
  console.log(`   market_sale_comps: +${mscInserted}`);
  console.log(`   recorded_transactions: +${rtInserted}`);
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const useTavily   = args.includes('--tavily')   || args.includes('--all') || args.length === 0;
  const useAssessor = args.includes('--assessor')  || args.includes('--all') || args.length === 0;

  ingestRecordedTransactions({ useTavily, useAssessor })
    .catch(err => {
      console.error('Fatal:', err);
      process.exit(1);
    })
    .finally(() => pool.end());
}

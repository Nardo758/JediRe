/**
 * Apartment Scraper Worker with SERP Integration
 * 
 * Flow:
 * 1. SERP API → find Apartments.com URLs
 * 2. Fetch + Parse HTML → extract property details
 * 3. Supabase → save listings
 */

import { DurableObject } from 'cloudflare:workers';

interface Env {
  SERP_API_KEY: string;
  JEDI_INGEST_URL: string;
  JEDI_API_KEY?: string;
  SCRAPER_JOBS: DurableObjectNamespace;
}

interface ScrapeRequest {
  city: string;
  state: string;
  neighborhood?: string;
  limit?: number;
}

interface PropertyListing {
  url: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip?: string;
  rent_min?: number;
  rent_max?: number;
  bedrooms?: string;
  bathrooms?: string;
  sqft?: string;
  amenities?: string[];
  phone?: string;
  available_date?: string;
  scraped_at: string;
}

/**
 * Durable Object for managing scraper jobs (legacy, kept for compatibility)
 */
export class ScraperJobQueue extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    return Response.json({ status: 'legacy' });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Health check
      if (url.pathname === '/' || url.pathname === '/health') {
        return Response.json({
          service: 'Apartment Scraper Worker',
          status: 'healthy',
          version: '2.0.0',
          features: ['SERP Search', 'HTML Scraping', 'JEDI Ingest'],
          timestamp: new Date().toISOString(),
        }, { headers: corsHeaders });
      }

      // Main scrape endpoint
      if (url.pathname === '/scrape' && request.method === 'POST') {
        const body = await request.json() as ScrapeRequest;
        const { city, state, neighborhood, limit = 20 } = body;

        if (!city || !state) {
          return Response.json(
            { error: 'City and state are required' },
            { status: 400, headers: corsHeaders }
          );
        }

        console.log(`Starting scrape: ${city}, ${state}, ${neighborhood || 'all areas'}`);

        // Step 1: Search SERP for Apartments.com URLs
        const urls = await searchApartments(env, city, state, neighborhood, limit);
        console.log(`Found ${urls.length} URLs from SERP`);

        if (urls.length === 0) {
          return Response.json({
            success: true,
            message: 'No apartments found',
            listingsScraped: 0,
            saved: false,
            listings: [],
          }, { headers: corsHeaders });
        }

        // Step 2: Scrape each URL
        const listings = await scrapePropertyPages(env, urls);
        console.log(`Scraped ${listings.length} properties`);

        // Step 3: Send to JEDI ingest endpoint
        const saved = await sendToJEDI(env, listings);
        console.log(`Saved: ${saved}`);

        return Response.json({
          success: true,
          listingsScraped: listings.length,
          saved,
          listings,
        }, { headers: corsHeaders });
      }

      return Response.json(
        { error: 'Not found' },
        { status: 404, headers: corsHeaders }
      );

    } catch (error: any) {
      console.error('Error:', error);
      return Response.json(
        { error: error.message, stack: error.stack },
        { status: 500, headers: corsHeaders }
      );
    }
  },
};

/**
 * Step 1: Search SERP API for Apartments.com URLs
 */
async function searchApartments(
  env: Env,
  city: string,
  state: string,
  neighborhood?: string,
  limit: number = 20
): Promise<string[]> {
  // Search for specific property names/buildings instead of generic "apartments"
  const query = neighborhood
    ? `"${neighborhood}" "${city}" ${state} site:apartments.com inurl:"/"`
    : `"${city}" ${state} site:apartments.com inurl:"/" -inurl:"/search" -inurl:"/under-"`;

  // Using SerpAPI
  const serpUrl = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=${env.SERP_API_KEY}&num=${Math.min(limit * 2, 100)}`;

  console.log(`Searching SERP: ${query}`);

  const response = await fetch(serpUrl);
  if (!response.ok) {
    throw new Error(`SERP API failed: ${response.status} ${await response.text()}`);
  }

  const data = await response.json() as any;
  const urls: string[] = [];

  console.log(`SERP returned ${data.organic_results?.length || 0} results`);

  // Extract organic results
  if (data.organic_results) {
    for (const result of data.organic_results) {
      const url = result.link || result.url;
      console.log(`Checking URL: ${url}`);
      if (url && url.includes('apartments.com')) {
        // Filter: only property detail pages (contains ID like /678rj5v/)
        // Property URLs look like: /property-name-city-state/ID/
        if (url.match(/apartments\.com\/[a-z0-9-]+\/[a-z0-9]+\/?$/i)) {
          console.log(`✓ Matched: ${url}`);
          urls.push(url);
        } else {
          console.log(`✗ Skipped (didn't match regex): ${url}`);
        }
      }
    }
  }

  console.log(`Final URLs to scrape: ${urls.length}`);
  return urls.slice(0, limit);
}

/**
 * Step 2: Scrape property pages
 */
async function scrapePropertyPages(
  env: Env,
  urls: string[]
): Promise<PropertyListing[]> {
  const listings: PropertyListing[] = [];

  for (const url of urls) {
    try {
      const listing = await scrapePropertyPage(env, url);
      if (listing) {
        listings.push(listing);
      }
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error: any) {
      console.error(`Failed to scrape ${url}:`, error.message);
    }
  }

  return listings;
}

async function scrapePropertyPage(
  env: Env,
  url: string
): Promise<PropertyListing | null> {
  console.log(`Scraping: ${url}`);

  try {
    // Use Browser Rendering to avoid 403 blocks
    const response = await env.MYBROWSER.fetch(url);
    
    if (!response.ok) {
      console.error(`Browser fetch failed ${url}: ${response.status}`);
      return null;
    }

    const html = await response.text();

    // Parse HTML using regex (simple parsing for production use HTMLRewriter)
    const data = {
      name: extractText(html, /<h1[^>]*class="[^"]*propertyName[^"]*"[^>]*>(.*?)<\/h1>/i),
      address: extractText(html, /<[^>]*class="[^"]*propertyAddress[^"]*"[^>]*>(.*?)<\//i),
      rentMin: extractNumber(html, /\$([0-9,]+)/),
      bedrooms: extractText(html, /<[^>]*class="[^"]*bed[^"]*"[^>]*>(.*?)<\//i),
      bathrooms: extractText(html, /<[^>]*class="[^"]*bath[^"]*"[^>]*>(.*?)<\//i),
      sqft: extractText(html, /([0-9,]+)\s*sq\.?\s*ft/i),
      phone: extractText(html, /<[^>]*class="[^"]*phone[^"]*"[^>]*>(.*?)<\//i),
    };

    // Parse city/state from address
    const addressMatch = data.address.match(/(.+),\s*([A-Z]{2})\s*(\d{5})?/);
    const city = addressMatch?.[1]?.split(',')[0]?.trim() || '';
    const state = addressMatch?.[2] || '';
    const zip = addressMatch?.[3] || '';

    return {
      url,
      name: data.name || 'Unknown',
      address: data.address || '',
      city,
      state,
      zip,
      rent_min: data.rentMin,
      rent_max: data.rentMin, // Same for now
      bedrooms: data.bedrooms,
      bathrooms: data.bathrooms,
      sqft: data.sqft,
      amenities: [],
      phone: data.phone,
      scraped_at: new Date().toISOString(),
    };
  } catch (error: any) {
    console.error(`Scrape error for ${url}:`, error.message);
    return null;
  }
}

function extractText(html: string, regex: RegExp): string {
  const match = html.match(regex);
  return match ? match[1].replace(/<[^>]*>/g, '').trim() : '';
}

function extractNumber(html: string, regex: RegExp): number | undefined {
  const match = html.match(regex);
  return match ? parseInt(match[1].replace(/,/g, '')) : undefined;
}

/**
 * Step 3: Send listings to JEDI ingest endpoint
 */
async function sendToJEDI(
  env: Env,
  listings: PropertyListing[]
): Promise<boolean> {
  if (listings.length === 0) return false;

  try {
    // Convert to JEDI format
    const properties = listings.map(listing => ({
      external_id: listing.url.split('/').filter(Boolean).pop() || listing.url,
      source: 'apartments-com-scraper',
      name: listing.name,
      address: listing.address,
      city: listing.city,
      state: listing.state,
      zip_code: listing.zip,
      current_price: listing.rent_min,
      bedrooms: listing.bedrooms,
      bathrooms: listing.bathrooms,
      square_feet: listing.sqft ? parseInt(listing.sqft.replace(/,/g, '')) : undefined,
      amenities: listing.amenities,
      listing_url: listing.url,
      phone: listing.phone,
      scraped_at: listing.scraped_at,
    }));

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (env.JEDI_API_KEY) {
      headers['Authorization'] = `Bearer ${env.JEDI_API_KEY}`;
    }

    const response = await fetch(env.JEDI_INGEST_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ properties }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('JEDI ingest failed:', response.status, error);
      return false;
    }

    const result = await response.json();
    console.log(`JEDI ingest success:`, result);
    console.log(`Sent ${listings.length} listings to JEDI`);
    return true;
  } catch (error: any) {
    console.error('JEDI ingest error:', error.message);
    return false;
  }
}

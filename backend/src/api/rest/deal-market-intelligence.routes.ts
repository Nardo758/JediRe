import { Router, Request, Response, NextFunction } from 'express';
import { pool } from '../../database/connection';
import { authMiddleware } from '../../middleware/auth';
import { logger } from '../../utils/logger';
import { getCensusStatsForTradeArea } from '../../services/census.service';
import Anthropic from '@anthropic-ai/sdk';

const router = Router();

const CACHE_TTL_HOURS = 24;
const EXTERNAL_API_TIMEOUT_MS = 10000;

function isCacheValid(cached: any): boolean {
  if (!cached || !cached.timestamp) return false;
  const age = Date.now() - cached.timestamp;
  return age < CACHE_TTL_HOURS * 60 * 60 * 1000;
}

async function getDealCentroid(dealId: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const result = await pool.query(
      `SELECT ST_Y(ST_Centroid(boundary::geometry)) as lat, ST_X(ST_Centroid(boundary::geometry)) as lng
       FROM deals WHERE id = $1 AND boundary IS NOT NULL`,
      [dealId]
    );
    if (result.rows.length > 0 && result.rows[0].lat && result.rows[0].lng) {
      return { lat: parseFloat(result.rows[0].lat), lng: parseFloat(result.rows[0].lng) };
    }
  } catch {}
  return null;
}

async function getSubmarketStats(centroid: { lat: number; lng: number }) {
  try {
    const result = await pool.query(
      `SELECT id, name, avg_occupancy, avg_rent, properties_count, total_units
       FROM submarkets
       WHERE geometry IS NOT NULL
       ORDER BY geometry <-> ST_SetSRID(ST_MakePoint($1, $2), 4326)
       LIMIT 1`,
      [centroid.lng, centroid.lat]
    );
    if (result.rows.length > 0) {
      const sm = result.rows[0];
      return {
        id: sm.id,
        name: sm.name,
        avg_occupancy: sm.avg_occupancy ? parseFloat(sm.avg_occupancy) : null,
        avg_rent: sm.avg_rent ? parseFloat(sm.avg_rent) : null,
        properties_count: sm.properties_count,
        total_units: sm.total_units,
      };
    }
  } catch {}
  return null;
}

async function getMsaStats(centroid: { lat: number; lng: number }) {
  try {
    const result = await pool.query(
      `SELECT id, name, avg_occupancy, avg_rent, total_properties, total_units, population
       FROM msas
       WHERE ST_Contains(geometry, ST_SetSRID(ST_MakePoint($1, $2), 4326))
       LIMIT 1`,
      [centroid.lng, centroid.lat]
    );
    if (result.rows.length > 0) {
      const m = result.rows[0];
      return {
        id: m.id,
        name: m.name,
        avg_occupancy: m.avg_occupancy ? parseFloat(m.avg_occupancy) : null,
        avg_rent: m.avg_rent ? parseFloat(m.avg_rent) : null,
        total_properties: m.total_properties,
        total_units: m.total_units,
        population: m.population ? parseInt(m.population) : null,
      };
    }
  } catch {}
  return null;
}

const STATE_ABBREV: Record<string, string> = {
  'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR', 'california': 'CA',
  'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE', 'florida': 'FL', 'georgia': 'GA',
  'hawaii': 'HI', 'idaho': 'ID', 'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA',
  'kansas': 'KS', 'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
  'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS', 'missouri': 'MO',
  'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
  'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH',
  'oklahoma': 'OK', 'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT', 'vermont': 'VT',
  'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV', 'wisconsin': 'WI', 'wyoming': 'WY',
};

function toStateAbbrev(state: string): string {
  if (!state) return '';
  const trimmed = state.trim();
  if (trimmed.length === 2) return trimmed.toUpperCase();
  return STATE_ABBREV[trimmed.toLowerCase()] || trimmed;
}

async function getNewsEvents(city: string, state: string) {
  try {
    const stateAbbr = toStateAbbrev(state);
    const result = await pool.query(
      `SELECT id, event_category, event_type, event_status, source_type, source_name, source_url,
              extracted_data, impact_analysis, impact_severity, location_raw, city, state,
              published_at, created_at
       FROM news_events
       WHERE (city ILIKE $1 OR state ILIKE $2 OR state ILIKE $3)
       ORDER BY published_at DESC
       LIMIT 20`,
      [`%${city}%`, stateAbbr, state]
    );
    return result.rows;
  } catch {
    return [];
  }
}

async function getCompetingProperties(centroid: { lat: number; lng: number }, radiusMiles: number = 3) {
  try {
    const result = await pool.query(
      `SELECT COUNT(*) as count, 
              AVG(total_units) as avg_units,
              AVG(occupancy_rate) as avg_occupancy,
              AVG(avg_rent) as avg_rent,
              SUM(total_units) as total_units
       FROM property_records
       WHERE latitude IS NOT NULL AND longitude IS NOT NULL
       AND ST_DWithin(
         ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
         ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
         $3
       )`,
      [centroid.lng, centroid.lat, radiusMiles * 1609.34]
    );
    return result.rows[0] || null;
  } catch {
    return null;
  }
}

async function generateMarketIntelligence(
  deal: any,
  centroid: { lat: number; lng: number },
  censusData: any,
  submarketData: any,
  msaData: any,
  newsEvents: any[],
  competingProps: any
) {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    logger.warn('No Anthropic API key — returning template market intelligence');
    return buildTemplateResponse(deal, censusData, submarketData, msaData, newsEvents, competingProps);
  }

  const anthropic = new Anthropic({ apiKey: anthropicKey });

  const units = deal.deal_data?.units || deal.deal_data?.total_units || 'Unknown';
  const contextPrompt = `You are a real estate market intelligence analyst. Analyze the following data for a multifamily investment property and produce a comprehensive market intelligence report.

PROPERTY:
- Name: ${deal.name || 'Subject Property'}
- Address: ${deal.address || 'N/A'}
- Units: ${units}
- Year Built: ${deal.deal_data?.year_built || 'Unknown'}
- Class: ${deal.deal_data?.property_class || 'Unknown'}
- Location: ${centroid.lat.toFixed(4)}, ${centroid.lng.toFixed(4)}

CENSUS DATA (Trade Area):
${censusData ? `Population: ${censusData.population}, Median Income: $${censusData.medianIncome}, Housing Units: ${censusData.totalHousingUnits}, Median Rent: $${censusData.medianRent}` : 'Not available'}

SUBMARKET: ${submarketData ? `${submarketData.name} — Occupancy: ${submarketData.avg_occupancy}%, Avg Rent: $${submarketData.avg_rent}, Properties: ${submarketData.properties_count}, Units: ${submarketData.total_units}` : 'Not available'}

MSA: ${msaData ? `${msaData.name} — Occupancy: ${msaData.avg_occupancy}%, Avg Rent: $${msaData.avg_rent}, Population: ${msaData.population}` : 'Not available'}

COMPETING PROPERTIES (within 3mi): ${competingProps ? `Count: ${competingProps.count}, Avg Units: ${Math.round(competingProps.avg_units || 0)}, Avg Occupancy: ${(competingProps.avg_occupancy || 0).toFixed(1)}%, Avg Rent: $${Math.round(competingProps.avg_rent || 0)}, Total Units: ${competingProps.total_units}` : 'Not available'}

NEWS EVENTS (Recent, for this market):
${newsEvents.slice(0, 10).map(e => `- [${e.event_category}/${e.event_type}] ${JSON.stringify(e.extracted_data)} (${e.city}, ${e.state})`).join('\n') || 'None'}

Based on this data, generate realistic market intelligence. For any data points you don't have direct evidence for, make reasonable estimates based on the location and available context. Use the news events to identify specific employers and development projects.

Respond with ONLY valid JSON (no markdown, no code fences):
{
  "economicHealthScore": <number 0-100>,
  "economicHealthTrend": "<string>",
  "economicHealthInsight": "<string: 1-2 sentences>",
  "jobsAdded": { "value": "<string>", "trend": "<string>", "detail": "<string>" },
  "wageGrowth": { "value": "<string>", "trend": "<string>", "detail": "<string>" },
  "netMigration": { "value": "<string>", "trend": "<string>", "detail": "<string>" },
  "affordabilityRatio": { "value": "<string: e.g. 28%>", "status": "<green|yellow|red>", "detail": "<string>" },
  "employers": [
    { "name": "<string>", "industry": "<string>", "employees": "<string>", "distance": "<string>", "status": "<expanding|stable|watch|contracting>", "statusText": "<string>", "demandImpact": "<string>", "sourceType": "<NEWS|BLS|PLATFORM>" }
  ],
  "developmentPipeline": [
    { "project": "<string>", "type": "<Infrastructure|Corporate|Mixed-Use|Residential|Retail>", "timeline": "<string>", "impact": "<string>", "confidence": "<HIGH|MEDIUM|LOW>" }
  ],
  "industryComposition": [
    { "name": "<string>", "pct": <number>, "growth": "<string>", "trend": "<up|down|flat>" }
  ],
  "wageRentAlignment": {
    "wageGrowth": "<string>",
    "rentGrowth": "<string>",
    "trafficSurge": "<string>",
    "searchMomentum": "<string>",
    "insight": "<string: 2-3 sentences>"
  },
  "renterDemandFunnel": {
    "totalPopulation": "<string>",
    "renters": "<string>",
    "renterPct": <number>,
    "incomeQualified": "<string>",
    "incomeQualifiedPct": <number>,
    "ageAppropriate": "<string>",
    "ageAppropriatePct": <number>,
    "unitTypeMatch": "<string>",
    "unitTypeMatchPct": <number>,
    "demandPool": "<string>",
    "captureRate": "<string>",
    "captureInsight": "<string>"
  }
}

Generate 5-8 employers and 3-5 pipeline projects. Make industry composition add up to 100%.`;

  try {
    const aiPromise = anthropic.messages.create({
      model: 'claude-sonnet-4-6-20250514',
      max_tokens: 4000,
      messages: [{ role: 'user', content: contextPrompt }],
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('AI analysis timed out after 25s')), 25000)
    );

    const response = await Promise.race([aiPromise, timeoutPromise]);

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    return JSON.parse(cleaned);
  } catch (err: any) {
    logger.warn('[MarketIntel] AI generation failed, using template:', err.message);
    return buildTemplateResponse(deal, censusData, submarketData, msaData, newsEvents, competingProps);
  }
}

function buildTemplateResponse(deal: any, census: any, submarket: any, msa: any, news: any[], competing: any) {
  const avgRent = submarket?.avg_rent || msa?.avg_rent || census?.medianRent || 1500;
  const medianIncome = census?.medianIncome || 65000;
  const affordability = ((avgRent * 12) / medianIncome * 100).toFixed(0);
  const population = census?.population || msa?.population || 50000;
  const units = deal.deal_data?.units || deal.deal_data?.total_units || 200;

  const employerData = news
    .filter((e: any) => e.event_category === 'employment')
    .slice(0, 5)
    .map((e: any) => ({
      name: e.extracted_data?.company_name || 'Unknown Employer',
      industry: e.extracted_data?.office_type || 'General',
      employees: e.extracted_data?.employee_count?.toLocaleString() || 'N/A',
      distance: 'N/A',
      status: e.event_type?.includes('inbound') ? 'expanding' : 'stable',
      statusText: e.event_type?.replace(/_/g, ' ') || '',
      demandImpact: e.extracted_data?.employee_count ? `+${Math.round(e.extracted_data.employee_count * 0.1)} renter HH` : 'N/A',
      sourceType: 'NEWS',
    }));

  const pipelineData = news
    .filter((e: any) => e.event_category === 'development')
    .slice(0, 3)
    .map((e: any) => ({
      project: e.extracted_data?.project_name || 'Unknown Project',
      type: 'Mixed-Use',
      timeline: e.extracted_data?.expected_completion || 'TBD',
      impact: e.extracted_data?.unit_count ? `${e.extracted_data.unit_count} units` : 'TBD',
      confidence: 'MEDIUM',
    }));

  const demandPool = Math.round(population * 0.6 * 0.7 * 0.7 * 0.7);
  const captureRate = units !== 'Unknown' ? ((parseInt(units) / demandPool) * 100).toFixed(1) : 'N/A';

  return {
    economicHealthScore: 72,
    economicHealthTrend: 'Stable',
    economicHealthInsight: `Market shows steady fundamentals with ${submarket?.avg_occupancy || 92}% occupancy in the ${submarket?.name || 'local'} submarket.`,
    jobsAdded: { value: 'N/A', trend: 'Data pending', detail: 'BLS employment data integration pending' },
    wageGrowth: { value: 'N/A', trend: `Avg rent $${Math.round(avgRent).toLocaleString()}`, detail: 'Wage data pending' },
    netMigration: { value: 'N/A', trend: 'Data pending', detail: 'IRS SOI migration data pending' },
    affordabilityRatio: {
      value: `${affordability}%`,
      status: parseInt(affordability) < 28 ? 'green' : parseInt(affordability) < 32 ? 'yellow' : 'red',
      detail: `Median income $${medianIncome.toLocaleString()} vs avg rent $${Math.round(avgRent).toLocaleString()}`,
    },
    employers: employerData,
    developmentPipeline: pipelineData,
    industryComposition: [
      { name: 'Healthcare', pct: 22, growth: '+8%', trend: 'up' },
      { name: 'Technology', pct: 18, growth: '+12%', trend: 'up' },
      { name: 'Education', pct: 15, growth: '+3%', trend: 'flat' },
      { name: 'Professional Services', pct: 14, growth: '+5%', trend: 'up' },
      { name: 'Retail & Food', pct: 12, growth: '-2%', trend: 'down' },
      { name: 'Government', pct: 10, growth: '+1%', trend: 'flat' },
      { name: 'Other', pct: 9, growth: '+2%', trend: 'flat' },
    ],
    wageRentAlignment: {
      wageGrowth: 'N/A',
      rentGrowth: 'N/A',
      trafficSurge: 'N/A',
      searchMomentum: 'N/A',
      insight: 'Full wage-rent correlation data requires BLS and SpyFu integration. Current market fundamentals suggest stable rent support.',
    },
    renterDemandFunnel: {
      totalPopulation: population.toLocaleString(),
      renters: Math.round(population * 0.6).toLocaleString(),
      renterPct: 60,
      incomeQualified: Math.round(population * 0.6 * 0.7).toLocaleString(),
      incomeQualifiedPct: 70,
      ageAppropriate: Math.round(population * 0.6 * 0.7 * 0.7).toLocaleString(),
      ageAppropriatePct: 70,
      unitTypeMatch: Math.round(population * 0.6 * 0.7 * 0.7 * 0.7).toLocaleString(),
      unitTypeMatchPct: 70,
      demandPool: demandPool.toLocaleString(),
      captureRate: `${captureRate}%`,
      captureInsight: demandPool > 0 ? `Demand pool is ${Math.round(demandPool / (parseInt(String(units)) || 200))}x unit count — healthy absorption potential.` : 'Upload data to refine.',
    },
  };
}

function formatNewsForResponse(events: any[]) {
  const categoryMap: Record<string, string> = {
    employment: 'DEMAND',
    development: 'SUPPLY',
    amenities: 'INFRASTRUCTURE',
    government: 'REGULATORY',
    transactions: 'ECONOMIC',
    education: 'DEMAND',
  };

  return events.map(e => ({
    id: e.id,
    type: categoryMap[e.event_category] || 'ECONOMIC',
    category: e.event_category,
    eventType: e.event_type,
    headline: e.extracted_data?.headline || e.extracted_data?.project_name || e.extracted_data?.company_name || `${e.event_category}: ${e.event_type}`.replace(/_/g, ' '),
    source: e.source_name || e.source_type,
    sourceUrl: e.source_url,
    date: e.published_at,
    city: e.city,
    state: e.state,
    location: e.location_raw,
    impact: e.impact_analysis,
    severity: e.impact_severity,
    extractedData: e.extracted_data,
    status: e.event_status,
  }));
}

router.get('/:dealId/market-intelligence', authMiddleware.requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { dealId } = req.params;
    const forceRefresh = req.query.refresh === 'true';

    const dealResult = await pool.query(
      `SELECT id, name, address, boundary, deal_data FROM deals WHERE id = $1`,
      [dealId]
    );

    if (dealResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Deal not found' });
    }

    const deal = dealResult.rows[0];

    if (!forceRefresh) {
      const cached = deal.deal_data?.market_intelligence;
      if (isCacheValid(cached)) {
        return res.json({ success: true, data: cached.data, cached: true });
      }
    }

    const centroid = await getDealCentroid(dealId);
    if (!centroid) {
      return res.json({
        success: true,
        data: { economy: null, demographics: null, news: [], supplyContext: null, documentIntelligence: null },
        message: 'Deal has no boundary — cannot compute market intelligence',
      });
    }

    const addressParts = (deal.address || '').split(',').map((s: string) => s.trim());
    const city = addressParts.length >= 2 ? addressParts[1] : 'Atlanta';
    const stateZipPart = addressParts.length >= 3 ? addressParts[2] : '';
    const stateMatch = stateZipPart.match(/^([A-Za-z\s]+?)(?:\s+\d{5})?$/);
    const state = stateMatch ? stateMatch[1].trim() : 'GA';

    logger.info(`[MarketIntel] Fetching data for deal ${dealId} at ${centroid.lat},${centroid.lng}`);

    const withTimeout = <T>(promise: Promise<T>, ms: number, label: string): Promise<T | null> =>
      Promise.race([
        promise,
        new Promise<null>((resolve) => setTimeout(() => {
          logger.warn(`[MarketIntel] ${label} timed out after ${ms}ms`);
          resolve(null);
        }, ms)),
      ]);

    const [censusData, submarketData, msaData, newsEvents, competingProps] = await Promise.all([
      withTimeout(getCensusStatsForTradeArea(centroid.lat, centroid.lng, 3).catch(() => null), EXTERNAL_API_TIMEOUT_MS, 'Census API'),
      getSubmarketStats(centroid),
      getMsaStats(centroid),
      getNewsEvents(city, state),
      getCompetingProperties(centroid, 3),
    ]);

    logger.info(`[MarketIntel] Data fetched — census: ${!!censusData}, submarket: ${!!submarketData}, msa: ${!!msaData}, news: ${(newsEvents || []).length}, competing: ${!!competingProps}`);

    const aiAnalysis = await generateMarketIntelligence(
      deal, centroid, censusData, submarketData, msaData, newsEvents || [], competingProps
    );

    logger.info(`[MarketIntel] Analysis complete for deal ${dealId}`);

    const responseData = {
      economy: {
        healthScore: aiAnalysis.economicHealthScore,
        healthTrend: aiAnalysis.economicHealthTrend,
        healthInsight: aiAnalysis.economicHealthInsight,
        metrics: {
          jobsAdded: aiAnalysis.jobsAdded,
          wageGrowth: aiAnalysis.wageGrowth,
          netMigration: aiAnalysis.netMigration,
          affordabilityRatio: aiAnalysis.affordabilityRatio,
        },
        employers: aiAnalysis.employers || [],
        developmentPipeline: aiAnalysis.developmentPipeline || [],
        industryComposition: aiAnalysis.industryComposition || [],
        wageRentAlignment: aiAnalysis.wageRentAlignment,
      },
      demographics: {
        census: censusData,
        submarket: submarketData,
        msa: msaData,
        renterDemandFunnel: aiAnalysis.renterDemandFunnel,
      },
      news: formatNewsForResponse(newsEvents),
      supplyContext: {
        competingProperties: competingProps ? {
          count: parseInt(competingProps.count),
          avgUnits: Math.round(competingProps.avg_units || 0),
          avgOccupancy: parseFloat((competingProps.avg_occupancy || 0).toFixed(1)),
          avgRent: Math.round(competingProps.avg_rent || 0),
          totalPipelineUnits: parseInt(competingProps.total_units || 0),
        } : null,
        radiusMiles: 3,
      },
      documentIntelligence: null,
    };

    try {
      const cachePayload = { timestamp: Date.now(), data: responseData };
      await pool.query(
        `UPDATE deals SET deal_data = jsonb_set(COALESCE(deal_data, '{}'), '{market_intelligence}', $1::jsonb) WHERE id = $2`,
        [JSON.stringify(cachePayload), dealId]
      );
    } catch (cacheErr: any) {
      logger.warn('Failed to cache market intelligence:', cacheErr.message);
    }

    res.json({ success: true, data: responseData, cached: false });
  } catch (err) {
    next(err);
  }
});

export default router;

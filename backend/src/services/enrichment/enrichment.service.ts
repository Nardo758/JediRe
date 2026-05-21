import Anthropic from '@anthropic-ai/sdk';
import { Pool } from 'pg';
import { logger } from '../../utils/logger';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Job tracking (in-memory) ─────────────────────────────────────────────────

export interface EnrichmentJob {
  jobId: string;
  status: 'running' | 'completed' | 'failed';
  completed: number;
  remaining: number;
  failed: number;
  startedAt: string;
  completedAt?: string;
  errors: string[];
}

const jobs = new Map<string, EnrichmentJob>();

export function getJob(jobId: string): EnrichmentJob | undefined {
  return jobs.get(jobId);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeLV(value: unknown, sourceName: string, confidence: number): string {
  return JSON.stringify({ value, source: sourceName, confidence, updatedAt: new Date().toISOString() });
}

function normalizeClass(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = raw.match(/([A-D][+-]?)/i);
  return m ? m[1].toUpperCase() : null;
}

// ─── Claude web-research extraction ──────────────────────────────────────────

interface EnrichedFields {
  yearBuilt?: number | null;
  buildingClass?: string | null;
  stories?: number | null;
  unitCount?: number | null;
  constructionType?: string | null;
  lotSizeAcres?: number | null;
  parkingSpaces?: number | null;
  parkingRatio?: number | null;
  amenities?: string[];
  submarket?: string | null;
  msaName?: string | null;
  county?: string | null;
  rentableSqft?: number | null;
  propertyType?: string | null;
  source_hint?: string | null;
}

async function researchProperty(
  parcelId: string,
  propertyName: string | null,
  address: string | null,
  city: string | null,
  state: string | null,
  sources: string[],
): Promise<EnrichedFields | null> {
  const identity = [propertyName, address, city, state].filter(Boolean).join(', ');
  if (!identity) {
    logger.warn('[enrichment] no identity info for property', { parcelId });
    return null;
  }

  const sourcePriority = [
    sources.includes('county') ? 'county assessor records' : null,
    sources.includes('apartments_com') ? 'apartments.com' : null,
    sources.includes('apartment_list') ? 'Apartment List' : null,
    sources.includes('web') ? 'public real estate databases' : null,
  ].filter(Boolean).join(', ');

  const prompt = `You are a real estate data researcher. Look up this apartment property and extract the fields listed below.

Property: ${identity}

Search ${sourcePriority || 'any available public records'} to find accurate data. Focus on:
- County assessor / appraisal district records for year built, lot size, construction type
- Listing platforms (apartments.com, Apartment List) for unit count, amenities, building class
- Any authoritative public source for the remaining fields

Return ONLY a JSON object — no markdown fences, no commentary. Use null for anything you cannot find with confidence.

{
  "yearBuilt": null,
  "buildingClass": "Class A|B|C|D or null",
  "stories": null,
  "unitCount": null,
  "constructionType": "Wood Frame|Concrete|Steel Frame|Masonry|Mixed or null",
  "lotSizeAcres": null,
  "parkingSpaces": null,
  "parkingRatio": null,
  "amenities": [],
  "submarket": null,
  "msaName": null,
  "county": null,
  "rentableSqft": null,
  "propertyType": "garden|mid-rise|high-rise|townhome or null",
  "source_hint": "brief note on source used"
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 1024,
      tools: [{ type: 'web_search_20250305' as any, name: 'web_search' }],
      messages: [{ role: 'user', content: prompt }],
    });

    for (const block of response.content) {
      if (block.type === 'text') {
        const match = block.text.match(/\{[\s\S]*\}/);
        if (match) {
          try {
            return JSON.parse(match[0]) as EnrichedFields;
          } catch {
            logger.warn('[enrichment] JSON parse failed', { parcelId, raw: match[0].slice(0, 200) });
          }
        }
      }
    }
    return null;
  } catch (err) {
    logger.warn('[enrichment] Claude extraction failed', { parcelId, error: String(err) });
    return null;
  }
}

// ─── property_descriptions upsert ────────────────────────────────────────────

async function upsertEnrichedFields(
  pool: Pool,
  parcelId: string,
  fields: EnrichedFields,
  sourceName: string,
  confidence: number,
): Promise<void> {
  const candidates: Array<{ col: string; lval: string }> = [];

  const maybe = (col: string, val: unknown, conf = confidence) => {
    if (val == null || (Array.isArray(val) && val.length === 0)) return;
    candidates.push({ col, lval: makeLV(val, sourceName, conf) });
  };

  maybe('year_built',       fields.yearBuilt);
  maybe('asset_class',      normalizeClass(fields.buildingClass));
  maybe('stories',          fields.stories);
  maybe('unit_count',       fields.unitCount);
  maybe('construction_type',fields.constructionType);
  maybe('lot_size_acres',   fields.lotSizeAcres);
  maybe('parking_spaces',   fields.parkingSpaces);
  maybe('parking_ratio',    fields.parkingRatio);
  maybe('amenities',        fields.amenities?.length ? fields.amenities : null);
  maybe('submarket',        fields.submarket);
  maybe('msa',              fields.msaName);
  maybe('county',           fields.county);
  maybe('rentable_sqft',    fields.rentableSqft);
  maybe('property_type',    fields.propertyType);

  if (candidates.length === 0) return;

  const colNames     = candidates.map(c => c.col).join(', ');
  const placeholders = candidates.map((_, i) => `$${i + 2}::jsonb`).join(', ');
  const updates      = candidates
    .map(c => `${c.col} = COALESCE(property_descriptions.${c.col}, EXCLUDED.${c.col})`)
    .join(',\n    ');

  await pool.query(
    `INSERT INTO property_descriptions (parcel_id, ${colNames}, updated_at)
     VALUES ($1, ${placeholders}, NOW())
     ON CONFLICT (parcel_id) DO UPDATE SET
       ${updates},
       updated_at = NOW()`,
    [parcelId, ...candidates.map(c => c.lval)],
  );
}

// ─── Batch runner ─────────────────────────────────────────────────────────────

export async function runEnrichmentBatch(
  pool: Pool,
  options: {
    parcelIds?: string[];
    sources?: string[];
    dryRun?: boolean;
    concurrency?: number;
  },
): Promise<string> {
  const {
    sources     = ['county', 'apartments_com', 'apartment_list', 'web'],
    dryRun      = false,
    concurrency = 4,
  } = options;

  let parcelIds = options.parcelIds;
  if (!parcelIds || parcelIds.length === 0) {
    const res = await pool.query<{ parcel_id: string }>(
      `SELECT parcel_id FROM property_descriptions
       WHERE year_built IS NULL
          OR asset_class IS NULL
          OR unit_count IS NULL
          OR stories IS NULL
          OR construction_type IS NULL`,
    );
    parcelIds = res.rows.map(r => r.parcel_id);
  }

  const jobId = `enrich-${Date.now()}`;
  const job: EnrichmentJob = {
    jobId,
    status:     'running',
    completed:  0,
    remaining:  parcelIds.length,
    failed:     0,
    startedAt:  new Date().toISOString(),
    errors:     [],
  };
  jobs.set(jobId, job);

  logger.info('[enrichment] batch started', { jobId, total: parcelIds.length, dryRun });

  (async () => {
    try {
      const infoRes = await pool.query<{
        parcel_id:     string;
        property_name: string | null;
        address:       string | null;
        city:          string | null;
        state:         string | null;
      }>(
        `SELECT
           pd.parcel_id,
           pd.property_name->>'value' AS property_name,
           pd.address->>'value'       AS address,
           p.city                     AS city,
           p.state                    AS state
         FROM property_descriptions pd
         LEFT JOIN properties p ON p.parcel_id = pd.parcel_id
         WHERE pd.parcel_id = ANY($1)`,
        [parcelIds],
      );

      const infoMap = new Map(infoRes.rows.map(r => [r.parcel_id, r]));

      for (let i = 0; i < parcelIds!.length; i += concurrency) {
        const batch = parcelIds!.slice(i, i + concurrency);
        await Promise.all(batch.map(async (parcelId) => {
          try {
            const info = infoMap.get(parcelId);
            if (!info) {
              job.failed++;
              job.remaining--;
              job.errors.push(`${parcelId}: no address info found`);
              return;
            }

            if (!dryRun) {
              const fields = await researchProperty(
                parcelId,
                info.property_name,
                info.address,
                info.city,
                info.state,
                sources,
              );
              if (fields) {
                await upsertEnrichedFields(pool, parcelId, fields, 'web_enrichment', 0.65);
              }
            }

            job.completed++;
            job.remaining--;
          } catch (err) {
            job.failed++;
            job.remaining--;
            const msg = err instanceof Error ? err.message : String(err);
            job.errors.push(`${parcelId}: ${msg}`);
            logger.warn('[enrichment] property failed', { parcelId, error: msg });
          }
        }));
      }

      job.status       = 'completed';
      job.completedAt  = new Date().toISOString();
      logger.info('[enrichment] batch complete', { jobId, completed: job.completed, failed: job.failed });
    } catch (err) {
      job.status = 'failed';
      job.errors.push(String(err));
      logger.error('[enrichment] batch failed', { jobId, error: String(err) });
    }
  })();

  return jobId;
}

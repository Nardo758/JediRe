/**
 * Agent Tool: fetch_property_vault_intel
 *
 * Retrieves the enriched property profile from the vault (property_descriptions)
 * for the deal's subject property.  Returns municipal attributes, web search
 * narrative, Places amenity flags, regulatory constraints, and enrichment step
 * outcomes from the most recent intake_jobs run.
 *
 * Returns null when no vault record exists for the parcel — the caller MUST
 * handle the null case gracefully (e.g. note "vault absent" in evidence).
 *
 * CALL PATTERN (Phase 2 — after fetch_deal_capsule / fetch_data_matrix):
 *   1. Inspect context.dealRow.parcel_id (or linkedParcelId) from the data matrix.
 *   2. If present, call fetch_property_vault_intel({ deal_id }) to retrieve vault intel.
 *   3. Incorporate physical attributes (year_built, units, parking, amenities) and
 *      market context (narrative, recent_events, Places rating) into the underwriting
 *      narrative and evidence data_points.
 */

import { z } from 'zod';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';
import type { ToolDefinition, RunContext } from '../runtime/types';

const InputSchema = z.object({
  deal_id: z.string().uuid().describe(
    'Deal UUID — used to look up the linked parcel_id from deal properties. ' +
    'If the deal has no linked parcel the tool returns null.'
  ),
  parcel_id: z.string().optional().describe(
    'Optional explicit parcel ID. When provided, the parcel lookup from deal is skipped.'
  ),
});

const AmenityFlagsSchema = z.object({
  has_pool:              z.boolean().nullable(),
  has_fitness:           z.boolean().nullable(),
  has_clubhouse:         z.boolean().nullable(),
  has_concierge:         z.boolean().nullable(),
  has_business_center:   z.boolean().nullable(),
  has_dog_park:          z.boolean().nullable(),
  is_master_metered:     z.boolean().nullable(),
  is_individual_metered: z.boolean().nullable(),
  parking_type:          z.string().nullable().describe('resolved parking type from property_descriptions or properties table'),
});

const MunicipalSchema = z.object({
  owner:          z.string().nullable(),
  year_built:     z.number().nullable(),
  total_units:    z.number().nullable(),
  assessed_value: z.number().nullable(),
  land_area_acres: z.number().nullable(),
  county:         z.string().nullable(),
  city:           z.string().nullable(),
  zip_code:       z.string().nullable(),
  source:         z.string().describe('e.g. "municipal:arcgis_fulton"'),
});

const WebSearchSchema = z.object({
  narrative:      z.string().nullable().describe('Synthesized property narrative from web search enrichment'),
  citations:      z.array(z.string()).describe('Source URLs cited in the narrative'),
  recent_events:  z.array(z.object({
    title:       z.string(),
    summary:     z.string().nullable(),
    date:        z.string().nullable(),
  })).describe('Recent news/events from web search enrichment'),
}).nullable();

const PlacesSchema = z.object({
  rating:      z.number().nullable().describe('Google Places composite rating 0-5'),
  review_count: z.number().nullable(),
  photo_count:  z.number().nullable(),
  sentiment_summary: z.string().nullable().describe('Summarised sentiment from reviews'),
}).nullable();

const RegulatorySchema = z.object({
  zone_code:   z.string().nullable(),
  jurisdiction: z.string().nullable(),
  max_height:  z.number().nullable().describe('Max building height in feet'),
  max_fsr:     z.number().nullable().describe('Floor Space Ratio / FAR'),
  source:      z.string().nullable(),
}).nullable();

const EnrichmentStepSchema = z.object({
  step:    z.string(),
  status:  z.enum(['ok', 'error', 'skipped', 'pending']),
  message: z.string().nullable(),
  ran_at:  z.string().nullable(),
});

const OutputSchema = z.object({
  found:         z.boolean().describe('False when no vault record exists for this parcel'),
  parcel_id:     z.string().nullable(),
  municipal:     MunicipalSchema.nullable(),
  amenity_flags: AmenityFlagsSchema.nullable(),
  web_search:    WebSearchSchema,
  places:        PlacesSchema,
  regulatory:    RegulatorySchema,
  enrichment_steps: z.array(EnrichmentStepSchema).describe('Step outcomes from the most recent intake_jobs enrichment_log'),
  vault_updated_at: z.string().nullable().describe('ISO timestamp when the vault record was last updated'),
  note: z.string().describe('Guidance for incorporating vault intel into underwriting evidence'),
});

export const fetchPropertyVaultIntelTool: ToolDefinition<
  z.infer<typeof InputSchema>,
  z.infer<typeof OutputSchema>
> = {
  name: 'fetch_property_vault_intel',
  description: `
Retrieve the enriched property profile from the vault (property_descriptions) for the
deal's subject property.  The vault assembles municipal assessor data, web search
narratives, Google Places amenity signals, and regulatory (M02) outputs into a single
enriched record.

WHEN TO CALL:
  • In Phase 2, AFTER fetch_data_matrix, when deal.parcel_id is known.
  • Use it to enrich physical quality evidence (amenities, year_built, parking) and to
    surface market context (recent events, Places rating) in the underwriting narrative.

RETURN VALUE:
  • found=false → no vault record; note "property vault absent" in evidence, continue with
    deal document data only.
  • found=true  → incorporate: amenity_flags into physical quality evidence; web_search
    narrative into market context; places.rating as a comparability signal; regulatory
    zone_code/max_height into entitlement risk commentary.

SOURCE BADGES (for evidence data_points):
  • municipal attributes  → tier=3, source="municipal:assessor"
  • web_search narrative  → tier=3, source="web_search:enrichment"
  • places signals        → tier=3, source="places:google"
  • regulatory            → tier=3, source="municipal:m02_zoning"
`.trim(),

  inputSchema:  InputSchema,
  outputSchema: OutputSchema,
  requiresCapability: 'read:all',

  execute: async (
    input: z.infer<typeof InputSchema>,
    ctx: RunContext,
  ): Promise<z.infer<typeof OutputSchema>> => {
    const { deal_id } = input;

    const absent = (parcelId: string | null = null): z.infer<typeof OutputSchema> => ({
      found: false,
      parcel_id: parcelId,
      municipal: null,
      amenity_flags: null,
      web_search: null,
      places: null,
      regulatory: null,
      enrichment_steps: [],
      vault_updated_at: null,
      note: 'No vault record found for this parcel. Continue underwriting from deal document data only.',
    });

    let parcelId: string | null = input.parcel_id ?? null;

    if (!parcelId) {
      const dealRes = await query(
        `SELECT p.parcel_id
         FROM properties p
         WHERE p.deal_id = $1
           AND p.parcel_id IS NOT NULL
         LIMIT 1`,
        [deal_id],
      );
      if (dealRes.rows.length === 0) {
        logger.info('[fetch_property_vault_intel] no parcel linked to deal', { dealId: deal_id });
        return absent();
      }
      parcelId = dealRes.rows[0].parcel_id as string;
    }

    const pdRes = await query(
      `SELECT pd.*,
              p.county, p.city, p.zip_code, p.parking_type,
              p.year_built AS prop_year_built,
              p.units      AS prop_units
       FROM property_descriptions pd
       LEFT JOIN properties p ON p.parcel_id = pd.parcel_id
       WHERE pd.parcel_id = $1
       LIMIT 1`,
      [parcelId],
    );

    if (pdRes.rows.length === 0) {
      logger.info('[fetch_property_vault_intel] no property_descriptions row', { parcelId });
      return absent(parcelId);
    }

    const pd = pdRes.rows[0];

    const intakeRes = await query(
      `SELECT enrichment_log, updated_at
       FROM intake_jobs
       WHERE parcel_id = $1
       ORDER BY updated_at DESC
       LIMIT 1`,
      [parcelId],
    );

    const rawLog: unknown[] = intakeRes.rows[0]?.enrichment_log ?? [];
    const enrichmentSteps: z.infer<typeof EnrichmentStepSchema>[] = Array.isArray(rawLog)
      ? rawLog.map((s: any) => ({
          step:    String(s.step ?? s.name ?? 'unknown'),
          status:  (['ok', 'error', 'skipped', 'pending'].includes(s.status) ? s.status : 'pending') as 'ok' | 'error' | 'skipped' | 'pending',
          message: s.message ?? s.error ?? null,
          ran_at:  s.ran_at ?? s.runAt ?? null,
        }))
      : [];

    const resolvedLV = (lv: any): any => {
      if (lv == null) return null;
      if (typeof lv === 'object' && 'value' in lv) return lv.value ?? null;
      if (typeof lv === 'object' && 'resolved' in lv) return lv.resolved ?? null;
      return lv;
    };

    const resolvedSource = (lv: any): string => {
      if (lv == null) return 'municipal:assessor';
      if (typeof lv === 'object' && 'source' in lv) return String(lv.source);
      return 'municipal:assessor';
    };

    const municipal: z.infer<typeof MunicipalSchema> = {
      owner:          resolvedLV(pd.owner) ?? null,
      year_built:     resolvedLV(pd.year_built) ?? pd.prop_year_built ?? null,
      total_units:    resolvedLV(pd.unit_count) ?? pd.prop_units ?? null,
      assessed_value: resolvedLV(pd.assessed_value) != null ? parseFloat(resolvedLV(pd.assessed_value)) : null,
      land_area_acres: resolvedLV(pd.lot_size_acres) != null ? parseFloat(resolvedLV(pd.lot_size_acres)) : null,
      county:   pd.county ?? null,
      city:     pd.city ?? null,
      zip_code: pd.zip_code ?? null,
      source:   resolvedSource(pd.assessed_value),
    };

    const amenityFlags: z.infer<typeof AmenityFlagsSchema> = {
      has_pool:              resolvedLV(pd.has_pool) ?? null,
      has_fitness:           resolvedLV(pd.has_fitness) ?? null,
      has_clubhouse:         resolvedLV(pd.has_clubhouse) ?? null,
      has_concierge:         resolvedLV(pd.has_concierge) ?? null,
      has_business_center:   resolvedLV(pd.has_business_center) ?? null,
      has_dog_park:          resolvedLV(pd.has_dog_park) ?? null,
      is_master_metered:     resolvedLV(pd.is_master_metered) ?? null,
      is_individual_metered: resolvedLV(pd.is_individual_metered) ?? null,
      parking_type:          pd.parking_type ?? null,
    };

    const reviews   = pd.reviews   ?? null;
    const photos    = pd.photos    ?? null;
    const sentiment = pd.sentiment_summary ?? null;
    const recentRaw = pd.recent_events ?? null;

    const placesRating = Array.isArray(reviews) && reviews.length > 0
      ? (() => {
          const ratings = reviews.map((r: any) => r.rating ?? r.stars).filter((r: any) => r != null && !isNaN(Number(r)));
          return ratings.length > 0
            ? parseFloat((ratings.reduce((a: number, b: any) => a + Number(b), 0) / ratings.length).toFixed(1))
            : null;
        })()
      : (typeof reviews === 'object' && reviews !== null && 'rating' in (reviews as object))
        ? parseFloat(String((reviews as any).rating)) ?? null
        : null;

    const places: z.infer<typeof PlacesSchema> = (placesRating != null || photos != null || sentiment != null) ? {
      rating:       placesRating,
      review_count: Array.isArray(reviews) ? reviews.length : null,
      photo_count:  Array.isArray(photos)  ? photos.length  : null,
      sentiment_summary: typeof sentiment === 'string' ? sentiment
        : (typeof sentiment === 'object' && sentiment !== null) ? String((sentiment as any).summary ?? '') : null,
    } : null;

    const rc = pd.regulatory_constraints ?? null;
    const regulatory: z.infer<typeof RegulatorySchema> = rc ? {
      zone_code:   resolvedLV(rc.zone_code)   ?? null,
      jurisdiction: resolvedLV(rc.jurisdiction) ?? null,
      max_height:  resolvedLV(rc.max_height) != null ? parseFloat(String(resolvedLV(rc.max_height))) : null,
      max_fsr:     resolvedLV(rc.max_fsr ?? rc.far) != null ? parseFloat(String(resolvedLV(rc.max_fsr ?? rc.far))) : null,
      source:      rc.source_chain ? String(rc.source_chain[0] ?? 'municipal:m02_zoning') : 'municipal:m02_zoning',
    } : null;

    const recentEvents: { title: string; summary: string | null; date: string | null }[] = Array.isArray(recentRaw)
      ? recentRaw.slice(0, 10).map((e: any) => ({
          title:   String(e.title ?? e.headline ?? 'Untitled'),
          summary: e.summary ?? e.description ?? null,
          date:    e.date ?? e.published_at ?? null,
        }))
      : [];

    const webSearch: z.infer<typeof WebSearchSchema> = (pd.narrative || recentEvents.length > 0) ? {
      narrative:     pd.narrative ?? null,
      citations:     Array.isArray(pd.citations) ? pd.citations.map(String) : [],
      recent_events: recentEvents,
    } : null;

    const note = buildNote({ municipal, amenityFlags, webSearch, places, regulatory, enrichmentSteps });

    logger.info('[fetch_property_vault_intel] retrieved', {
      dealId: deal_id,
      parcelId,
      hasAmenities: Object.values(amenityFlags).some(v => v !== null),
      hasWebSearch: webSearch !== null,
      hasPlaces:    places !== null,
      hasRegulatory: regulatory !== null,
      enrichmentStepCount: enrichmentSteps.length,
    });

    return {
      found: true,
      parcel_id: parcelId,
      municipal,
      amenity_flags: amenityFlags,
      web_search: webSearch,
      places,
      regulatory,
      enrichment_steps: enrichmentSteps,
      vault_updated_at: pd.updated_at ? new Date(pd.updated_at).toISOString() : null,
      note,
    };
  },
};

function buildNote(data: {
  municipal:       z.infer<typeof MunicipalSchema> | null;
  amenityFlags:    z.infer<typeof AmenityFlagsSchema> | null;
  webSearch:       z.infer<typeof WebSearchSchema>;
  places:          z.infer<typeof PlacesSchema>;
  regulatory:      z.infer<typeof RegulatorySchema>;
  enrichmentSteps: z.infer<typeof EnrichmentStepSchema>[];
}): string {
  const lines: string[] = [
    'Vault intel retrieved. Incorporate as follows:',
  ];

  if (data.amenityFlags) {
    const confirmed = (Object.entries(data.amenityFlags) as [string, boolean | string | null][])
      .filter(([, v]) => v === true || (typeof v === 'string' && v))
      .map(([k]) => k);
    if (confirmed.length > 0) {
      lines.push(`• Amenities confirmed: ${confirmed.join(', ')} — use as Tier 3 evidence for physical quality.`);
    }
  }

  if (data.places?.rating) {
    lines.push(`• Places rating ${data.places.rating}/5 (${data.places.review_count ?? '?'} reviews) — cite in market context evidence (tier=3, source="places:google").`);
  }

  if (data.webSearch?.narrative) {
    lines.push('• Web search narrative available — incorporate into market context block of underwriting summary.');
  }

  if (data.regulatory?.zone_code) {
    lines.push(`• Zoning: ${data.regulatory.zone_code} in ${data.regulatory.jurisdiction ?? 'jurisdiction unknown'} — cite in regulatory risk commentary (tier=3, source="municipal:m02_zoning").`);
  }

  const failedSteps = data.enrichmentSteps.filter(s => s.status === 'error');
  if (failedSteps.length > 0) {
    lines.push(`• ${failedSteps.length} enrichment step(s) failed: ${failedSteps.map(s => s.step).join(', ')} — treat those fields as absent.`);
  }

  lines.push('Write VAULT as the evidence source prefix for each field sourced from this tool (e.g. source="vault:municipal", source="vault:places").');
  return lines.join('\n');
}

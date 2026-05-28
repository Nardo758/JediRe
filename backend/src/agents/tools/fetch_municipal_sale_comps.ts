/**
 * Tool: fetch_municipal_sale_comps — Task #1416 / D-COSTAR-4
 *
 * Fetches recorded sale transactions directly from FL county property appraiser
 * APIs (Hillsborough, Orange, Miami-Dade, Duval) and writes them into the
 * platform sale comp pool with:
 *   source: 'municipal'
 *   county: <county name>
 *   data_as_of: <today>
 *   source_labels: [county PA name, endpoint URL]
 *
 * Quality tier: C1 — authoritative public transaction record.
 *
 * Fulton County / Atlanta note:
 *   Georgia is a non-disclosure state (O.C.G.A. § 48-5-15). Fulton County
 *   property appraiser ArcGIS layers omit sale price fields. No municipal feed
 *   exists for Atlanta-MSA transaction comps. CoStar or broker data required.
 *
 * Required capability: write:deal_context (covers comp pool writes)
 */

import { z } from 'zod';
import { logger } from '../../utils/logger';
import type { ToolDefinition } from '../runtime/types';
import {
  floridaMunicipalSaleCompsService,
  type FLCounty,
} from '../../services/saleComps/florida-municipal-sale-comps.service';

// ── Schemas ───────────────────────────────────────────────────────────────────

const InputSchema = z.object({
  county: z
    .enum(['hillsborough', 'orange', 'miami_dade', 'duval'])
    .describe(
      'FL county to fetch from. ' +
      'hillsborough=Tampa, orange=Orlando, miami_dade=Miami, duval=Jacksonville.'
    ),
  date_from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')
    .describe('Earliest sale date to include (YYYY-MM-DD)'),
  date_to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')
    .describe('Latest sale date to include (YYYY-MM-DD)'),
  min_sale_price: z
    .number()
    .min(100_000)
    .default(500_000)
    .describe('Minimum transaction price filter — default $500k to focus on investment-grade assets'),
  page_size: z
    .number()
    .int()
    .min(10)
    .max(100)
    .default(100)
    .describe('Records per API page. Max 100 (ArcGIS limit). Lower to reduce timeout risk.'),
});

const OutputSchema = z.object({
  county: z.string(),
  state: z.literal('FL'),
  endpoint: z.string(),
  date_from: z.string(),
  date_to: z.string(),
  total_fetched: z.number().describe('Raw records returned by county API'),
  inserted: z.number().describe('New rows added to market_sale_comps'),
  skipped_dup: z.number().describe('Rows that already existed (UPSERT no-op)'),
  skipped_invalid: z.number().describe('Rows missing required fields (parcel ID, date, price)'),
  quality_tier: z.literal('C1').describe('Municipal records are full transaction records — C1 tier'),
  data_as_of: z.string().describe('Date data was fetched (YYYY-MM-DD)'),
  provenance: z.object({
    source: z.literal('municipal'),
    source_labels: z.array(z.string()),
    dedup_method: z.literal('source_id').describe('Unique key: {county}_{parcelId}_{saleDate}'),
  }),
  fulton_county_note: z.string().describe('Availability status for Atlanta/Fulton County feed'),
  errors: z.array(z.string()).describe('Any page-level errors encountered during fetch'),
  success: z.boolean(),
});

type FetchMunicipalSaleCompsInput = z.infer<typeof InputSchema>;
type FetchMunicipalSaleCompsOutput = z.infer<typeof OutputSchema>;

// ── Tool ──────────────────────────────────────────────────────────────────────

export const fetchMunicipalSaleCompsTool: ToolDefinition<
  FetchMunicipalSaleCompsInput,
  FetchMunicipalSaleCompsOutput
> = {
  name: 'fetch_municipal_sale_comps',
  description:
    'Fetch recorded sale transactions from FL county property appraiser APIs ' +
    '(Hillsborough/Tampa, Orange/Orlando, Miami-Dade/Miami, Duval/Jacksonville) ' +
    'and write them to the platform sale comp pool. ' +
    'Use when you need ground-truth transaction comps for a FL market — ' +
    'these are authoritative public records (C1 quality tier), not broker estimates. ' +
    'Results are deduplicated against existing comps via parcel ID. ' +
    'NOTE: Fulton County (Atlanta) has no equivalent public price feed — ' +
    'Georgia is a non-disclosure state.',

  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  requiresCapability: 'write:deal_context',

  execute: async (input) => {
    logger.info('[fetch_municipal_sale_comps] Tool invoked', {
      county: input.county,
      dateFrom: input.date_from,
      dateTo: input.date_to,
      minSalePrice: input.min_sale_price,
    });

    const FULTON_NOTE =
      'NOT AVAILABLE — Georgia is a non-disclosure state (O.C.G.A. § 48-5-15). ' +
      'Fulton County property appraiser ArcGIS layers omit sale price. ' +
      'Use CoStar or broker data for Atlanta-MSA transaction comps.';

    try {
      const result = await floridaMunicipalSaleCompsService.fetchAndIngest({
        county: input.county as FLCounty,
        dateFrom: input.date_from,
        dateTo: input.date_to,
        minSalePrice: input.min_sale_price,
        pageSize: input.page_size,
      });

      return {
        county: result.county,
        state: 'FL',
        endpoint: result.endpoint,
        date_from: input.date_from,
        date_to: input.date_to,
        total_fetched: result.totalFetched,
        inserted: result.inserted,
        skipped_dup: result.skippedDup,
        skipped_invalid: result.skippedInvalid,
        quality_tier: 'C1',
        data_as_of: result.dataAsOf,
        provenance: {
          source: 'municipal',
          source_labels: [
            `${result.county.toUpperCase()} County Property Appraiser`,
            result.endpoint,
          ],
          dedup_method: 'source_id',
        },
        fulton_county_note: FULTON_NOTE,
        errors: result.errors,
        success: result.errors.length === 0 || result.inserted > 0,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('[fetch_municipal_sale_comps] Fatal error', { error: msg });

      return {
        county: input.county,
        state: 'FL',
        endpoint: COUNTY_ENDPOINTS[input.county] ?? 'unknown',
        date_from: input.date_from,
        date_to: input.date_to,
        total_fetched: 0,
        inserted: 0,
        skipped_dup: 0,
        skipped_invalid: 0,
        quality_tier: 'C1',
        data_as_of: new Date().toISOString().slice(0, 10),
        provenance: {
          source: 'municipal',
          source_labels: [],
          dedup_method: 'source_id',
        },
        fulton_county_note: FULTON_NOTE,
        errors: [msg],
        success: false,
      };
    }
  },
};

// Endpoint summary for error path (avoids importing full service config)
const COUNTY_ENDPOINTS: Record<string, string> = {
  hillsborough:
    'https://maps.hcpafl.org/arcgis/rest/services/PublicAccess/HCPAInfoLayers/MapServer/4/query',
  orange:
    'https://gisweb.ocpafl.org/arcgis/rest/services/Prod_AGOL/Property_Sales/MapServer/0/query',
  miami_dade:
    'https://opendata.miamidade.gov/resource/nev3-m88i.json',
  duval:
    'https://services1.arcgis.com/O1JpcwDW8sjYuddV/arcgis/rest/services/Duval_Property_Sales/FeatureServer/0/query',
};

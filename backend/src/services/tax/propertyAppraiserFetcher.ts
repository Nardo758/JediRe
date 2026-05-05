/**
 * PropertyAppraiserFetcher — Tier-routing implementation (spec §8)
 *
 * Tier 1: Uploaded tax bill PDF (highest trust — user-supplied)
 * Tier 2: ATTOM property detail API
 * Tier 3: Placeholder county PA adapter (returns null; deferred until Phase 5)
 * Tier 4: Null / fallback — signals low confidence to compositeResolver
 *
 * Each tier is attempted in order; the first successful non-null result wins.
 * The result is always wrapped with { tier, tier_label, confidence, warnings }.
 *
 * Cache layer: parcelCache wraps every successful Tier 2+ result so that
 * successive forecasts for the same deal within the same fiscal year never
 * hit ATTOM. The cache is bypassed (and then updated) when a fresh fetch occurs.
 *
 * Usage:
 *   const fetcher = new GeneralPropertyAppraiserFetcher();
 *   const result = await fetcher.fetch({ dealId, parcelId, state, county });
 */

import { parseTaxBillAsync } from '../document-extraction/parsers/tax-bill-parser';
import { fetchFromAttom } from './attomAdapter';
import { parcelCache } from './parcelCache';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';
import type { NormalizedParcel, PropertyAppraiserResult } from './types';

// ── Interface ─────────────────────────────────────────────────────────────────

export interface FetchInput {
  dealId: string;
  parcelId: string | null;
  state: string;
  county: string | null;
  fiscalYear?: number;
}

export interface PropertyAppraiserFetcher {
  fetch(input: FetchInput): Promise<PropertyAppraiserResult>;
}

// ── Tier 1: Tax bill PDF parser ───────────────────────────────────────────────

/**
 * Look up the most recently uploaded tax bill PDF for the deal in deal_documents.
 * Returns null when no uploaded tax bill exists or parsing fails.
 */
async function fetchFromTaxBillPdf(dealId: string): Promise<NormalizedParcel | null> {
  let row: { file_url: string; metadata: any } | undefined;
  try {
    const res = await query<{ file_url: string; metadata: any }>(
      `SELECT file_url, metadata
         FROM deal_documents
        WHERE deal_id   = $1
          AND (LOWER(file_type) LIKE '%tax%' OR LOWER(file_name) LIKE '%tax%bill%'
               OR LOWER(file_name) LIKE '%property%tax%')
          AND deleted_at IS NULL
        ORDER BY uploaded_at DESC
        LIMIT 1`,
      [dealId],
    );
    row = res.rows[0];
  } catch {
    return null;
  }

  if (!row) return null;

  // Prefer already-parsed metadata from prior extraction runs
  const meta = row.metadata ?? {};
  if (meta.extraction_result?.success && meta.extraction_result?.data) {
    const d = meta.extraction_result.data;
    const parcel: NormalizedParcel = {
      parcel_id: d.parcelId ?? `deal:${dealId}`,
      state: '',   // not stored in extraction metadata; caller fills from deal
      county: null,
      just_value: d.fairMarketValue ?? d.totalAppraisal ?? null,
      assessed_value: d.assessedValue ?? d.baseAssessment ?? null,
      land_value: d.assessedLand ?? null,
      improvement_value: d.assessedImprovement ?? null,
      exemptions_total: null,
      millage_rate: d.millageRate != null ? d.millageRate * 1000 : null, // convert fraction → mills
      annual_tax: d.totalAnnualTax > 0 ? d.totalAnnualTax : null,
      tax_year: d.taxYear ?? null,
      last_updated: null,
      staleness_days: null,
      source: 'tax_bill_pdf',
    };
    return parcel;
  }

  // Try to fetch and re-parse the file from its URL
  try {
    const https = await import('https');
    const buf = await new Promise<Buffer>((resolve, reject) => {
      https.get(row!.file_url, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      }).on('error', reject);
    });

    const result = await parseTaxBillAsync(buf, 'tax_bill.pdf');
    if (!result.success || !result.data) return null;

    const d = result.data;
    return {
      parcel_id: d.parcelId ?? `deal:${dealId}`,
      state: '',
      county: null,
      just_value: d.fairMarketValue ?? null,
      assessed_value: d.assessedValue ?? null,
      land_value: d.assessedLand ?? null,
      improvement_value: d.assessedImprovement ?? null,
      exemptions_total: null,
      millage_rate: d.millageRate != null ? d.millageRate * 1000 : null,
      annual_tax: d.totalAnnualTax > 0 ? d.totalAnnualTax : null,
      tax_year: d.taxYear ?? null,
      last_updated: null,
      staleness_days: null,
      source: 'tax_bill_pdf',
    };
  } catch {
    return null;
  }
}

// ── GeneralPropertyAppraiserFetcher ──────────────────────────────────────────

export class GeneralPropertyAppraiserFetcher implements PropertyAppraiserFetcher {
  async fetch(input: FetchInput): Promise<PropertyAppraiserResult> {
    const { dealId, parcelId, state, county, fiscalYear } = input;
    const warnings: string[] = [];

    // ── Tier 1: Tax bill PDF ────────────────────────────────────────────────
    try {
      const pdfParcel = await fetchFromTaxBillPdf(dealId);
      if (pdfParcel) {
        // Fill state/county from deal context (not stored in extracted data)
        pdfParcel.state = state.toUpperCase();
        pdfParcel.county = county;
        logger.debug('[PropertyAppraiserFetcher] Tier 1 (tax bill PDF) hit', { dealId });
        return {
          parcel: pdfParcel,
          confidence: 'high',
          tier: 1,
          tier_label: 'tax_bill_pdf',
          warnings,
        };
      }
    } catch (err: any) {
      warnings.push(`Tier 1 (tax bill PDF) error: ${err?.message ?? err}`);
    }

    // ── Tier 2: ATTOM (with parcel cache) ──────────────────────────────────
    if (parcelId) {
      // Check cache first
      const cached = await parcelCache.get(parcelId, fiscalYear);
      if (cached) {
        logger.debug('[PropertyAppraiserFetcher] Tier 2 cache hit', { parcelId });
        return {
          parcel: cached,
          confidence: 'high',
          tier: 2,
          tier_label: 'attom',
          warnings,
        };
      }

      const attomResult = await fetchFromAttom(parcelId, state, county);
      warnings.push(...attomResult.warnings);

      if (attomResult.parcel) {
        // Populate cache for future forecasts this fiscal year
        await parcelCache.set(parcelId, attomResult.parcel, 'attom', fiscalYear);
        logger.debug('[PropertyAppraiserFetcher] Tier 2 (ATTOM) hit', { parcelId });
        return {
          parcel: attomResult.parcel,
          confidence: 'high',
          tier: 2,
          tier_label: 'attom',
          warnings,
        };
      }
    } else {
      warnings.push('No parcel_id provided — Tier 2 (ATTOM) skipped');
    }

    // ── Tier 3: Placeholder county adapters (deferred — Phase 5) ──────────
    // Miami-Dade, Broward, Fulton, Harris direct PA APIs will be implemented
    // once ATTOM cost/staleness metrics justify the additional adapter.
    warnings.push('Tier 3 (county adapters) not yet implemented — proceeding to Tier 4');

    // ── Tier 4: Null / fallback ─────────────────────────────────────────────
    logger.debug('[PropertyAppraiserFetcher] Tier 4 fallback', { dealId, parcelId });
    return {
      parcel: null,
      confidence: 'low',
      tier: 4,
      tier_label: 'fallback',
      warnings,
    };
  }
}

export const generalPropertyAppraiserFetcher = new GeneralPropertyAppraiserFetcher();

/**
 * Document → Corpus Transformer
 *
 * Thin write functions that translate each parsed document type into a
 * historical_observations row. Called inline by data-router.ts BEFORE the
 * surrounding transaction commits — if a write function throws the entire
 * upload rolls back (per HISTORICAL_OBSERVATIONS_SPEC.md §7.5).
 *
 * T12 and RentRoll delegate to the shared PropertyPerformanceIngestor so
 * the tier-promotion logic lives in one place. OM and TaxBill are handled
 * here directly since they write different columns (OM → property state,
 * TaxBill → capital_event_* columns).
 *
 * @see HISTORICAL_OBSERVATIONS_SPEC.md Section 7.6
 */

import { Pool } from 'pg';
import { logger } from '../../utils/logger';
import { corpusQueryService } from './query.service';
import { ingestPropertyPerformance } from './property-performance-ingestor';
import type { T12Data, RentRollData, TaxBillData } from '../document-extraction/types';
import type { OMExtraction } from '../document-extraction/parsers/om-parser';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Look up the parcel_id for a deal's primary property.
 * Falls back to the property UUID if the assessor parcel_id is not yet set.
 */
async function resolveParcelId(pool: Pool, dealId: string): Promise<{ propertyId: string; parcelId: string } | null> {
  const result = await pool.query(
    `SELECT dp.property_id, COALESCE(p.parcel_id, dp.property_id::text) AS parcel_id
     FROM deal_properties dp
     LEFT JOIN properties p ON p.id = dp.property_id
     WHERE dp.deal_id = $1
     LIMIT 1`,
    [dealId],
  );
  if (!result.rows[0]) return null;
  return {
    propertyId: result.rows[0].property_id as string,
    parcelId: result.rows[0].parcel_id as string,
  };
}

/** Normalize a Date to the 1st of its UTC month. */
function firstOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

/** Determine data_quality_tier from source_signals already on the row. */
function computeTier(signals: string[]): string {
  if (signals.includes('t12') && signals.includes('rent_roll')) return 'S1';
  if (signals.includes('t12')) return 'S2';
  if (signals.includes('rent_roll')) return 'S2';
  if (signals.includes('om')) return 'S3';
  if (signals.includes('tax_bill')) return 'S3';
  return 'S4';
}

/**
 * Upsert helper: if a row already exists at (parcel_id × observation_date),
 * append new source signal(s) and update any non-null fields; otherwise INSERT.
 * Returns the row UUID.
 */
async function upsertCorpusRow(
  pool: Pool,
  parcelId: string,
  observationDate: Date,
  fields: Record<string, unknown>,
  newSignals: string[],
): Promise<string> {
  // Check for existing row
  const existing = await pool.query(
    `SELECT id, source_signals FROM historical_observations
     WHERE parcel_id = $1 AND observation_date = $2::DATE AND geography_level = 'parcel'
     LIMIT 1`,
    [parcelId, observationDate],
  );

  if (existing.rows[0]) {
    const existingId = existing.rows[0].id as string;
    const existingSignals: string[] = (existing.rows[0].source_signals as string[]) ?? [];
    const mergedSignals = Array.from(new Set([...existingSignals, ...newSignals]));

    // Build SET clause from non-undefined, non-null fields only
    const assignments: string[] = ['source_signals = $1', 'data_quality_tier = $2', 'updated_at = NOW()'];
    const params: unknown[] = [mergedSignals, computeTier(mergedSignals)];
    let idx = params.length;

    for (const [key, val] of Object.entries(fields)) {
      if (val !== null && val !== undefined) {
        idx++;
        params.push(val);
        assignments.push(`${key} = $${idx}`);
      }
    }
    params.push(existingId);
    idx++;

    await pool.query(
      `UPDATE historical_observations SET ${assignments.join(', ')} WHERE id = $${idx}`,
      params,
    );

    logger.info('[DocumentToCorpus] Upserted existing row', {
      id: existingId,
      parcelId,
      date: observationDate.toISOString().slice(0, 7),
      signals: mergedSignals,
    });
    return existingId;
  }

  // INSERT new row
  const allFields: Record<string, unknown> = {
    parcel_id: parcelId,
    observation_date: observationDate,
    geography_level: 'parcel',
    observation_window: 'monthly',
    is_subject_property: true,
    source_signals: newSignals,
    data_quality_tier: computeTier(newSignals),
    ...fields,
  };

  const cols = Object.keys(allFields);
  const vals = Object.values(allFields);
  const placeholders = vals.map((_, i) => `$${i + 1}`);

  const insertResult = await pool.query(
    `INSERT INTO historical_observations (${cols.join(', ')})
     VALUES (${placeholders.join(', ')})
     RETURNING id`,
    vals,
  );

  const newId = insertResult.rows[0].id as string;
  logger.info('[DocumentToCorpus] Inserted new row', {
    id: newId,
    parcelId,
    date: observationDate.toISOString().slice(0, 7),
    signals: newSignals,
  });
  return newId;
}

// ─── T12 ─────────────────────────────────────────────────────────────────────

/**
 * Write a T12 parsed result into the corpus.
 * Delegates to PropertyPerformanceIngestor for field extraction and tier
 * promotion logic. Uses the pool-level connection so it participates in the
 * caller's transaction.
 */
export async function writeT12ToCorpus(
  _pool: Pool,
  dealId: string,
  parsedT12: T12Data,
  reportPeriod: Date,
): Promise<void> {
  try {
    await ingestPropertyPerformance({
      dealId,
      propertyId: '',
      parcelId: '',
      documentType: 'T12',
      observationDate: reportPeriod,
      t12Data: parsedT12,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[DocumentToCorpus] writeT12ToCorpus failed', { dealId, error: msg });
    throw err;
  }
}

// ─── RentRoll ────────────────────────────────────────────────────────────────

/**
 * Write a rent roll parsed result into the corpus.
 */
export async function writeRentRollToCorpus(
  _pool: Pool,
  dealId: string,
  parsedRentRoll: RentRollData,
  snapshotDate: Date,
): Promise<void> {
  try {
    await ingestPropertyPerformance({
      dealId,
      propertyId: '',
      parcelId: '',
      documentType: 'RENT_ROLL',
      observationDate: snapshotDate,
      rentRollData: parsedRentRoll,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[DocumentToCorpus] writeRentRollToCorpus failed', { dealId, error: msg });
    throw err;
  }
}

// ─── OM ──────────────────────────────────────────────────────────────────────

/**
 * Write an Offering Memorandum extraction into the corpus.
 * OM rows carry property state (unit count, occupancy from vacancy, avg rent
 * from unit mix) and a capital_event_type='asking_price' entry when the OM's
 * asking price is known. Geography level is 'parcel' keyed on the deal's
 * primary property. Observation date defaults to today (OMs describe current
 * state at time of listing).
 */
export async function writeOMToCorpus(
  pool: Pool,
  dealId: string,
  parsedOM: OMExtraction,
): Promise<void> {
  const resolved = await resolveParcelId(pool, dealId);
  if (!resolved) {
    logger.warn('[DocumentToCorpus] writeOMToCorpus: no property linked to deal', { dealId });
    return;
  }

  const observationDate = firstOfMonth(new Date());

  // Derive property state from OM
  const { property, brokerProforma, unitMix, metadata } = parsedOM;

  // Estimated occupancy: 1 - stabilizedVacancy (from broker proforma) OR null
  const propertyOccupancy =
    brokerProforma.stabilizedVacancy != null
      ? Math.max(0, 1 - brokerProforma.stabilizedVacancy)
      : null;

  // Average unit mix rent (inPlace preferred, then market)
  let propertyAvgRent: number | null = null;
  if (unitMix && unitMix.length > 0) {
    const rents = unitMix
      .map((u) => u.inPlaceRent ?? u.marketRent)
      .filter((r): r is number => r != null && r > 0);
    if (rents.length > 0) {
      propertyAvgRent = rents.reduce((a, b) => a + b, 0) / rents.length;
    }
  }

  // Asking rent (market rent from unit mix)
  let propertyAskingRent: number | null = null;
  if (unitMix && unitMix.length > 0) {
    const marketRents = unitMix
      .map((u) => u.marketRent)
      .filter((r): r is number => r != null && r > 0);
    if (marketRents.length > 0) {
      propertyAskingRent = marketRents.reduce((a, b) => a + b, 0) / marketRents.length;
    }
  }

  // Capital event: asking price from metadata
  const capitalEventType = metadata.askingPrice != null ? 'asking_price' : null;
  const capitalEventAmount = metadata.askingPrice ?? null;
  const capitalEventMetadata =
    metadata.askingPrice != null
      ? JSON.stringify({
          askingPrice: metadata.askingPrice,
          pricePerUnit: metadata.guidancePricePerUnit ?? null,
          capRate: metadata.guidanceCapRate ?? null,
          broker: metadata.broker ?? null,
          listingDate: metadata.listingDate ?? null,
        })
      : null;

  const fields: Record<string, unknown> = {
    property_unit_count: property.units ?? null,
    property_year_built: property.yearBuilt ?? null,
    property_occupancy: propertyOccupancy,
    property_avg_rent: propertyAvgRent,
    property_asking_rent: propertyAskingRent,
    capital_event_type: capitalEventType,
    capital_event_amount: capitalEventAmount,
    capital_event_metadata: capitalEventMetadata,
  };

  await upsertCorpusRow(pool, resolved.parcelId, observationDate, fields, ['om']);
}

// ─── TaxBill ─────────────────────────────────────────────────────────────────

/**
 * Write a tax bill parsed result into the corpus.
 * Tax bills are capital events: capital_event_type = 'tax_assessment'.
 * Observation date is January 1st of the tax year (the assessment date).
 */
export async function writeTaxBillToCorpus(
  pool: Pool,
  dealId: string,
  parsedTaxBill: TaxBillData,
  taxYear: number,
): Promise<void> {
  const resolved = await resolveParcelId(pool, dealId);
  if (!resolved) {
    logger.warn('[DocumentToCorpus] writeTaxBillToCorpus: no property linked to deal', { dealId });
    return;
  }

  // Tax assessment is as-of January 1st of the tax year
  const observationDate = new Date(Date.UTC(taxYear, 0, 1));

  const capitalEventMetadata = JSON.stringify({
    assessedValue: parsedTaxBill.assessedValue ?? null,
    assessedLand: parsedTaxBill.assessedLand ?? null,
    assessedImprovement: parsedTaxBill.assessedImprovement ?? null,
    fairMarketValue: parsedTaxBill.fairMarketValue ?? null,
    millageRate: parsedTaxBill.millageRate ?? null,
    taxingAuthority: parsedTaxBill.taxingAuthority ?? null,
    appealStatus: parsedTaxBill.appealStatus ?? null,
    taxYear,
    authorities: parsedTaxBill.authorities ?? [],
  });

  const fields: Record<string, unknown> = {
    capital_event_type: 'tax_assessment',
    capital_event_amount: parsedTaxBill.totalAnnualTax ?? null,
    capital_event_metadata: capitalEventMetadata,
  };

  await upsertCorpusRow(pool, resolved.parcelId, observationDate, fields, ['tax_bill']);
}

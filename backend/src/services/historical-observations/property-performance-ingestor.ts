/**
 * Property Performance → Corpus Ingestion Orchestrator
 *
 * Phase 2: Takes parsed T12 / rent-roll output and writes it into
 * historical_observations as a labeled (is_subject_property=TRUE) row.
 *
 * Architecture (per spec Section 7):
 *
 *   Document uploaded → existing parser (t12-parser / rent-roll-parser)
 *     → data-router.ts routes to deal_monthly_actuals
 *     → NEW: this orchestrator also receives the parsed result
 *     → Transforms to PartialHistoricalObservationRow
 *     → INSERT into historical_observations
 *     → Triggers realized outputs backfill for prior rows at same parcel
 *
 * The orchestrator is idempotent — it checks for an existing row at the
 * same (parcel_id × observation_date) and skips INSERT if one exists.
 *
 * @see HISTORICAL_OBSERVATIONS_SPEC.md Section 7
 */

import { query } from '../../database/connection';
import { logger } from '../../utils/logger';
import { corpusQueryService } from './query.service';
import { realizedOutputsService } from './realized-outputs.service';
import type {
  PartialHistoricalObservationRow,
} from '../historical-observations/types';
import type { T12Data, T12Month, RentRollData, RentRollUnit, LeasingStatsData } from '../../services/document-extraction/types';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ParsedPropertyDocument {
  dealId: string;
  propertyId: string;
  parcelId: string;
  documentType: 'T12' | 'RENT_ROLL' | 'LEASING_STATS';
  observationDate: Date;          // the month this document covers
  t12Data?: T12Data;
  rentRollData?: RentRollData;
  leasingStatsData?: LeasingStatsData;
}

export interface IngestionResult {
  inserted: boolean;              // true if a new row was created
  rowId?: string;                 // UUID of the inserted row
  backfillCount: number;          // realized outputs backfilled for prior rows
  warnings: string[];
}

// ─── Month extraction helpers ────────────────────────────────────────────────

/**
 * Extract the observation month from a T12's months array.
 * Returns the first month's reportMonth parsed as a Date.
 */
function extractMonthFromT12(data: T12Data, docDate: Date): Date {
  if (data.months.length > 0 && data.months[0].reportMonth) {
    const parsed = new Date(data.months[0].reportMonth);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return docDate;
}

/**
 * Extract the observation month from a rent roll document.
 * RentRollData has no top-level asOfDate, so we use the caller-supplied
 * docDate directly. Using lease_start dates from individual units is
 * incorrect — a long-term tenant's lease_start can be years in the past,
 * which would misalign all T+N realized-output windows.
 */
function extractMonthFromRentRoll(_data: RentRollData, docDate: Date): Date {
  return docDate;
}

// ─── Row equivalence check ───────────────────────────────────────────────────

async function existingCorpusRow(
  parcelId: string,
  observationDate: Date,
): Promise<string | null> {
  const sql = `
    SELECT id FROM historical_observations
    WHERE parcel_id = $1 AND observation_date = $2::DATE AND geography_level = 'parcel'
    LIMIT 1
  `;
  const result = await query(sql, [parcelId, observationDate]);
  return result.rows[0]?.id ?? null;
}

// ─── T12 → corpus row ────────────────────────────────────────────────────────

export function t12ToCorpusRow(
  data: T12Data,
  parcelId: string,
  observationDate: Date,
  propertyId: string,
  isSubjectProperty = true,
): PartialHistoricalObservationRow {
  const { summary, months } = data;

  // Find a month with unit counts
  const monthWithUnits = months.find(
    (m: T12Month) => m.totalUnits != null && m.totalUnits > 0,
  );

  // Average occupancy across months that have occupancy info
  const monthsWithOcc = months.filter(
    (m: T12Month) => m.occupiedUnits != null && m.totalUnits != null && m.totalUnits > 0,
  );
  const avgOccupancy = monthsWithOcc.length > 0
    ? monthsWithOcc.reduce((s: number, m: T12Month) => s + (m.occupiedUnits! / m.totalUnits!), 0) / monthsWithOcc.length
    : null;

  // Average rent: netRentalIncome / occupiedUnits across months
  const monthsWithRent = months.filter(
    (m: T12Month) => m.netRentalIncome != null && m.occupiedUnits != null && m.occupiedUnits > 0,
  );
  const avgRent = monthsWithRent.length > 0
    ? monthsWithRent.reduce((s: number, m: T12Month) => s + (m.netRentalIncome! / m.occupiedUnits!), 0) / monthsWithRent.length
    : null;

  return {
    parcelId,
    observationDate,
    geographyLevel: 'parcel',
    observationWindow: 'monthly',
    isSubjectProperty,
    sourceSignals: ['t12'],
    propertyUnitCount: monthWithUnits?.totalUnits ?? summary.totalUnits ?? null,
    propertyOccupancy: avgOccupancy,
    propertyAvgRent: avgRent,
  };
}

// ─── Leasing stats → corpus row ──────────────────────────────────────────────

export function leasingStatsToCorpusRow(
  data: LeasingStatsData,
  parcelId: string,
  observationDate: Date,
  propertyId: string,
  isSubjectProperty = true,
): PartialHistoricalObservationRow {
  const { summary, activity } = data;

  // Signing velocity: total new leases (not renewals) per month
  // BoxScore period is typically weekly, so compute monthly-equivalent rate
  const propertySigningVelocity = summary.total_new_leases > 0 ? summary.total_new_leases : null;

  // Concession estimate from average concession in individual lease records
  const leasesWithConcession = data.new_leases.filter(l => l.concession != null && l.concession > 0);
  const avgConcession = leasesWithConcession.length > 0
    ? leasesWithConcession.reduce((s, l) => s + (l.concession ?? 0), 0) / leasesWithConcession.length
    : null;

  // Occupancy not directly available from leasing activity section
  // (unit status section is separate) — leave null for BoxScore-only docs
  const qualityFlags: string[] = [];
  if (summary.total_occupied === 0) {
    qualityFlags.push('occupancy_not_in_leasing_section');
  }

  return {
    parcelId,
    observationDate,
    geographyLevel: 'parcel',
    observationWindow: 'monthly',
    isSubjectProperty,
    sourceSignals: ['leasing_stats'],
    propertyUnitCount: summary.total_units > 0 ? summary.total_units : null,
    propertyOccupancy: summary.total_units > 0 ? (summary.total_occupied / summary.total_units) : null,
    propertyConcessionPerUnit: avgConcession,
    propertySigningVelocity,
    dataQualityFlags: qualityFlags.length > 0 ? qualityFlags : null,
    dataQualityTier: 'C1',
  };
}

// ─── Rent roll → corpus row ──────────────────────────────────────────────────

export function rentRollToCorpusRow(
  data: RentRollData,
  parcelId: string,
  observationDate: Date,
  propertyId: string,
  isSubjectProperty = true,
): PartialHistoricalObservationRow {
  const units = data.units;

  const totalUnits = units.length;
  const occupiedUnits = units.filter(
    (u: RentRollUnit) => u.status && /occupied|leased|rented/i.test(u.status),
  ).length;
  const occupancy = totalUnits > 0 ? occupiedUnits / totalUnits : null;

  // Average rent: use effectiveRent (post-concession) for occupied units, else marketRent
  const unitsWithRent = units.filter(
    (u: RentRollUnit) => u.effectiveRent != null || u.marketRent != null,
  );
  const avgRent = unitsWithRent.length > 0
    ? unitsWithRent.reduce((s: number, u: RentRollUnit) => s + (u.effectiveRent ?? u.marketRent ?? 0), 0) / unitsWithRent.length
    : null;

  // Concession = marketRent - effectiveRent for units with both
  const unitsWithConcession = units.filter(
    (u: RentRollUnit) => u.marketRent != null && u.effectiveRent != null && u.marketRent > u.effectiveRent,
  );
  const avgConcession = unitsWithConcession.length > 0
    ? unitsWithConcession.reduce((s: number, u: RentRollUnit) => s + (u.marketRent! - u.effectiveRent!), 0) / unitsWithConcession.length
    : null;

  // Signing velocity: leases starting in trailing 3-month window (spec §7.6 / H4)
  const obsMonthEnd = new Date(Date.UTC(
    observationDate.getUTCFullYear(),
    observationDate.getUTCMonth() + 1,
    0,
  ));
  const trailingWindowStart = new Date(Date.UTC(
    observationDate.getUTCFullYear(),
    observationDate.getUTCMonth() - 2,
    1,
  ));
  const unitsWithLeaseStart = units.filter((u: RentRollUnit) => u.leaseStart != null);
  let propertySigningVelocity: number | null = null;
  const qualityFlags: string[] = [];

  if (unitsWithLeaseStart.length > 0) {
    const recentSignings = unitsWithLeaseStart.filter((u: RentRollUnit) => {
      const startDate = new Date(u.leaseStart!);
      return startDate >= trailingWindowStart && startDate <= obsMonthEnd;
    }).length;

    // Determine how many months of leaseStart data are available
    const earliestStartMs = Math.min(
      ...unitsWithLeaseStart.map((u: RentRollUnit) => new Date(u.leaseStart!).getTime()),
    );
    const availableMonths = Math.min(
      3,
      Math.max(
        1,
        Math.ceil((obsMonthEnd.getTime() - earliestStartMs) / (30.44 * 24 * 60 * 60 * 1000)),
      ),
    );

    propertySigningVelocity = recentSignings / availableMonths;

    if (availableMonths < 3) {
      qualityFlags.push('signing_velocity_partial_window');
    }
  }

  return {
    parcelId,
    observationDate,
    geographyLevel: 'parcel',
    observationWindow: 'monthly',
    isSubjectProperty,
    sourceSignals: ['rent_roll'],
    propertyUnitCount: totalUnits,
    propertyOccupancy: occupancy,
    propertyAvgRent: avgRent,
    propertyConcessionPerUnit: avgConcession,
    propertySigningVelocity,
    dataQualityFlags: qualityFlags.length > 0 ? qualityFlags : null,
  };
}

// ─── Orchestrator ────────────────────────────────────────────────────────────

/**
 * @deprecated Use the OM/TaxBill upsert pattern instead:
 *   resolveParcelId(pool, dealId) → transformer → upsertCorpusRow(pool, ...)
 *
 * This function passes parcelId through from the caller, which means callers
 * must resolve the parcel themselves. writeT12ToCorpus and writeRentRollToCorpus
 * in document-to-corpus.ts now call upsertCorpusRow directly and no longer go
 * through this function. See document-to-corpus.ts for the canonical pattern.
 */
export async function ingestPropertyPerformance(
  doc: ParsedPropertyDocument,
): Promise<IngestionResult> {
  const warnings: string[] = [];

  // Determine observation date
  let obsDate: Date;
  if (doc.documentType === 'T12' && doc.t12Data) {
    obsDate = extractMonthFromT12(doc.t12Data, doc.observationDate);
  } else if (doc.documentType === 'RENT_ROLL' && doc.rentRollData) {
    obsDate = extractMonthFromRentRoll(doc.rentRollData, doc.observationDate);
  } else if (doc.documentType === 'LEASING_STATS' && doc.leasingStatsData) {
    // Use reporting_period.start if available, fall back to doc date
    const lsStart = doc.leasingStatsData.reporting_period?.start;
    if (lsStart) {
      const parsed = new Date(lsStart);
      obsDate = isNaN(parsed.getTime()) ? doc.observationDate : parsed;
    } else {
      obsDate = doc.observationDate;
    }
  } else {
    obsDate = doc.observationDate;
  }

  // Normalize to 1st of month
  obsDate = new Date(Date.UTC(obsDate.getUTCFullYear(), obsDate.getUTCMonth(), 1));

  // Check for existing row (idempotent)
  const existingId = await existingCorpusRow(doc.parcelId, obsDate);
  if (existingId) {
    logger.info('[PropertyPerformanceIngestor] Row already exists, skipping', {
      parcelId: doc.parcelId,
      date: obsDate.toISOString().slice(0, 7),
      existingId,
    });
    return { inserted: false, backfillCount: 0, warnings };
  }

  // Derive is_subject_property from deal status (owned/closed/portfolio only)
  const SUBJECT_STATUSES = new Set(['owned', 'closed', 'portfolio']);
  let dealStatus = 'unknown';
  try {
    const dsResult = await query('SELECT status FROM deals WHERE id = $1', [doc.dealId]);
    dealStatus = (dsResult.rows[0]?.status as string) ?? 'unknown';
  } catch {
    warnings.push('Could not resolve deal status for is_subject_property — defaulting to FALSE');
  }
  const isSubjectProperty = SUBJECT_STATUSES.has(dealStatus);

  // Build corpus row
  let row: PartialHistoricalObservationRow;
  if (doc.documentType === 'T12' && doc.t12Data) {
    row = t12ToCorpusRow(doc.t12Data, doc.parcelId, obsDate, doc.propertyId, isSubjectProperty);
  } else if (doc.documentType === 'RENT_ROLL' && doc.rentRollData) {
    row = rentRollToCorpusRow(doc.rentRollData, doc.parcelId, obsDate, doc.propertyId, isSubjectProperty);
  } else if (doc.documentType === 'LEASING_STATS' && doc.leasingStatsData) {
    row = leasingStatsToCorpusRow(doc.leasingStatsData, doc.parcelId, obsDate, doc.propertyId, isSubjectProperty);
  } else {
    warnings.push(`Unsupported document type: ${doc.documentType} or missing parsed data`);
    return { inserted: false, backfillCount: 0, warnings };
  }

  // Thread dealId so the row is linkable without relying on parcel-join fallback
  row = { ...row, dealId: doc.dealId ?? null };

  // Insert the row
  const rowId = await corpusQueryService.insertRow(row);
  logger.info('[PropertyPerformanceIngestor] Corpus row inserted', {
    parcelId: doc.parcelId,
    date: obsDate.toISOString().slice(0, 7),
    rowId,
    source: doc.documentType,
  });

  // Trigger realized outputs backfill for prior rows at same parcel
  let backfillCount = 0;
  try {
    backfillCount = await realizedOutputsService.backfillForParcel(doc.parcelId);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn('[PropertyPerformanceIngestor] Backfill failed (non-fatal)', {
      parcelId: doc.parcelId,
      error: msg,
    });
    warnings.push(`Realized output backfill error: ${msg}`);
  }

  return { inserted: true, rowId, backfillCount, warnings };
}

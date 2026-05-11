/**
 * Property Performance → Corpus Transformer (Stub)
 *
 * Phase 2 implementation. For now this is a stub that logs its intent.
 * When fully implemented, it will:
 *
 *   1. Take a parsed T12 / rent-roll result from existing parsers
 *      (t12-parser.ts / rent-roll-parser.ts)
 *   2. Join against parcel_id from the deal record
 *   3. Compute property_occupancy, property_avg_rent, etc.
 *   4. INSERT into historical_observations as a labeled (is_subject_property=TRUE) row
 *   5. Trigger the realized outputs backfill for earlier rows at the same parcel
 *
 * @see HISTORICAL_OBSERVATIONS_SPEC.md Section 7
 */

import { logger } from '../../utils/logger';
import type { PartialHistoricalObservationRow } from './types';

export interface PropertyPerformanceInput {
  dealId: string;
  parcelId: string;
  observationDate: Date;
  pAndL?: {
    grossRevenue: number;
    vacancyLoss: number;
    operatingExpenses: number;
    noi: number;
    totalUnits: number;
    occupancyRate: number;
    avgRent: number;
  };
  rentRoll?: {
    totalUnits: number;
    occupiedUnits: number;
    avgRent: number;
    concessionsTotal: number;
    avgConcessionPerUnit: number;
    yearBuilt: number;
    propertyClass: string;
  };
}

/**
 * Transform parsed property performance data into a
 * PartialHistoricalObservationRow for insertion into the corpus.
 *
 * Currently returns a stub row with only mandatory fields populated.
 * Phase 2 will implement the full mapping.
 */
export function transformPropertyPerformance(
  input: PropertyPerformanceInput,
): PartialHistoricalObservationRow {
  const stubRow: PartialHistoricalObservationRow = {
    parcelId: input.parcelId,
    observationDate: input.observationDate,
    geographyLevel: 'parcel',
    observationWindow: 'monthly',
    isSubjectProperty: true,
    sourceSignals: ['t12', 'rent_roll'],
  };

  // Populate from P&L if available
  if (input.pAndL) {
    const p = input.pAndL;
    stubRow.propertyUnitCount = p.totalUnits;
    stubRow.propertyOccupancy = p.totalUnits > 0
      ? (p.totalUnits - p.vacancyLoss) / p.totalUnits
      : null;
    stubRow.propertyAvgRent = p.avgRent || (p.grossRevenue / (p.totalUnits * 12));
  }

  // Populate from rent roll if available
  if (input.rentRoll) {
    const r = input.rentRoll;
    stubRow.propertyUnitCount = r.totalUnits;
    stubRow.propertyOccupancy = r.occupiedUnits / r.totalUnits;
    stubRow.propertyAvgRent = r.avgRent;
    stubRow.propertyConcessionPerUnit = r.avgConcessionPerUnit;
    stubRow.propertyYearBuilt = r.yearBuilt;
    stubRow.propertyClass = r.propertyClass;
  }

  logger.info('[PropertyPerformanceTransformer] Stub transform applied', {
    parcelId: input.parcelId,
    date: input.observationDate.toISOString().slice(0, 7),
  });

  return stubRow;
}

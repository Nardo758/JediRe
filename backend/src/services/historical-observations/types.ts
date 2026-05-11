/**
 * Historical Observations — Type Definitions
 *
 * Core types for the empirical calibration substrate. These map to the
 * `historical_observations` table schema (snake_case in DB, camelCase
 * in TypeScript per existing codebase convention).
 *
 * @see HISTORICAL_OBSERVATIONS_SPEC.md Section 3
 */

// ─── Geography & Time ───────────────────────────────────────────────────────

export type GeographyLevel = 'msa' | 'submarket' | 'parcel' | 'point';
export type ObservationWindow = 'monthly' | 'quarterly' | 'annual';
export type RealizationWindow = '3mo' | '12mo' | '24mo';

// ─── Row Interface ──────────────────────────────────────────────────────────

export interface HistoricalObservationRow {
  // Primary key
  id: string;

  // Geography
  msaId: string | null;
  submarketId: string | null;
  parcelId: string | null;
  latitude: number | null;
  longitude: number | null;
  geographyLevel: GeographyLevel;

  // Time
  observationDate: Date;
  observationWindow: ObservationWindow;

  // ─── Inputs: Mobility ─────────────────────────────────────────────────────
  commuteShedWorkers: number | null;
  commuteShedWagePct: number | null;
  mobilityVisitsMonthly: number | null;
  mobilityUniqueVisitors: number | null;
  mobilityVisitsPsf: number | null;

  // ─── Inputs: Events ──────────────────────────────────────────────────────
  activeEventCount: number | null;
  eventEmployerJobsAdded: number | null;
  eventEmployerJobsLost: number | null;
  eventSupplyUnitsDelivered: number | null;
  eventSupplyUnitsAnnounced: number | null;
  eventSubtypes: string[] | null;

  // ─── Inputs: MSA macro ──────────────────────────────────────────────────
  msaEmploymentTotal: number | null;
  msaEmploymentGrowthYoy: number | null;
  msaAvgWage: number | null;
  msaWageGrowthYoy: number | null;
  msaUnemploymentRate: number | null;
  msaPopulation: number | null;
  msaHouseholdGrowthYoy: number | null;
  msaInMigrationNet: number | null;
  msaTreasury10y: number | null;
  msaFedFundsRate: number | null;

  // ─── Inputs: Submarket ──────────────────────────────────────────────────
  submarketAvgAskingRent: number | null;
  submarketAvgEffectiveRent: number | null;
  submarketVacancyRate: number | null;
  submarketConcessionPct: number | null;
  submarketUnderConstruction: number | null;
  submarketPipelineUnits24mo: number | null;
  submarketClassAShare: number | null;

  // ─── Inputs: Property state ──────────────────────────────────────────────
  propertyOccupancy: number | null;
  propertyAvgRent: number | null;
  propertyConcessionPerUnit: number | null;
  propertyUnitCount: number | null;
  propertyYearBuilt: number | null;
  propertyClass: string | null;

  // ─── Outputs: Realized changes ───────────────────────────────────────────
  realizedRentChangeT3: number | null;
  realizedRentChangeT12: number | null;
  realizedRentChangeT24: number | null;
  realizedOccupancyChangeT3: number | null;
  realizedOccupancyChangeT12: number | null;
  realizedConcessionChangeT12: number | null;
  realizedSigningVelocityT3: number | null;
  realizedSigningVelocityT12: number | null;
  realizedCapRateChangeT12Bps: number | null;
  realizedCapRateChangeT24Bps: number | null;
  realizedWalkinsPsfT12: number | null;

  // ─── Metadata ────────────────────────────────────────────────────────────
  sourceSignals: string[];
  signalFreshnessDays: Record<string, number> | null;
  isSubjectProperty: boolean;
  realizationComplete: boolean;
  realizationCompleteDate: Date | null;
  dataQualityFlags: string[] | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Partial row for inserts/updates ────────────────────────────────────────

export type PartialHistoricalObservationRow = Partial<HistoricalObservationRow> &
  Pick<HistoricalObservationRow, 'geographyLevel' | 'observationDate' | 'observationWindow'>;

// ─── Query Interface ────────────────────────────────────────────────────────

export interface CorpusQuery {
  geography: {
    msaId?: string;
    submarketId?: string;
    parcelId?: string;
    radius?: {
      lat: number;
      lng: number;
      miles: number;
    };
  };
  timeRange: {
    start: Date;
    end: Date;
  };
  observationWindow?: ObservationWindow;
  requireFields?: Array<keyof HistoricalObservationRow>;
  requireRealization?: RealizationWindow;
  isSubjectOnly?: boolean;
  isUnlabeledOnly?: boolean;
}

// ─── Response Types ─────────────────────────────────────────────────────────

export interface CorpusSummary {
  totalRows: number;
  dateRange: { earliest: Date | null; latest: Date | null };
  geographyLevels: GeographyLevel[];
  signalSources: string[];
  subjectPropertyCount: number;
  realizationCompleteCount: number;
}

export interface CoverageReport {
  submarketId: string;
  msaId: string;
  propertyPerformance: {
    status: 'current' | 'stale' | 'missing' | 'not_applicable';
    totalMonths: number;
    lastUpload: Date | null;
    gaps: number;
    coveragePct: number;
  };
  submarketData: {
    status: 'strong' | 'partial' | 'sparse' | 'missing';
    totalMonths: number;
    dateRange: { earliest: Date | null; latest: Date | null };
  };
  externalSignals: Array<{
    name: string;
    status: 'available' | 'partial' | 'pending' | 'missing';
    throughDate: Date | null;
    note?: string;
  }>;
  confidence: 'high' | 'medium' | 'low';
}

// ─── Mapped field helper (spec Section 4.2) ─────────────────────────────────

/**
 * Maps a metric + window to the corresponding realized_* column name.
 * Consuming modules use this to know which corpus column to query.
 */
export function realizedFieldFor(
  metric: 'rent_change' | 'occupancy_change' | 'concession_change' | 'signing_velocity' | 'cap_rate_change_bps',
  window: RealizationWindow,
): keyof HistoricalObservationRow {
  const map: Record<string, keyof HistoricalObservationRow> = {
    'rent_change_3mo': 'realizedRentChangeT3',
    'rent_change_12mo': 'realizedRentChangeT12',
    'rent_change_24mo': 'realizedRentChangeT24',
    'occupancy_change_3mo': 'realizedOccupancyChangeT3',
    'occupancy_change_12mo': 'realizedOccupancyChangeT12',
    'concession_change_12mo': 'realizedConcessionChangeT12',
    'signing_velocity_3mo': 'realizedSigningVelocityT3',
    'signing_velocity_12mo': 'realizedSigningVelocityT12',
    'cap_rate_change_bps_12mo': 'realizedCapRateChangeT12Bps',
    'cap_rate_change_bps_24mo': 'realizedCapRateChangeT24Bps',
  };

  const key = `${metric}_${window}`;
  const field = map[key];
  if (!field) {
    throw new Error(`Unknown metric/window combination: ${key}`);
  }
  return field;
}

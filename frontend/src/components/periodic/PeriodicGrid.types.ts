/**
 * Periodic Grid — Phase 5 Frontend Types
 *
 * Shared types for the period-indexed field rendering infrastructure.
 */

export interface PeriodicPeriod {
  month: string;
  resolved: number | null;
  zone: 'actual' | 'gap' | 'projection' | 'override' | 'computed' | string;
}

export interface PeriodicBoundary {
  actuals_through_month: string | null;
  acquisition_date: string | null;
  first_projection_month: string | null;
  gap_start_month: string | null;
  gap_end_month: string | null;
}

export interface PeriodicResponse {
  success: boolean;
  boundary: PeriodicBoundary;
  fields: Record<string, PeriodicPeriod[]>;
}

export interface PeriodicSingleFieldResponse {
  success: boolean;
  field: string;
  series: PeriodicPeriod[];
}

/** Which rendering preset to use. */
export type PeriodicGridPreset = 'full' | 'monitoring' | 'overview';

/** Key metrics to show in monitoring / overview presets. */
export const MONITORING_FIELDS = [
  'gpr',
  'egi',
  'total_opex',
  'noi',
  'noi_per_unit',
  'vacancy_pct',
  'loss_to_lease_pct',
  'management_fee_pct',
] as const;

/** All canonical fields supported by the periodic model. */
export const ALL_PERIODIC_FIELDS = [
  'gpr',
  'loss_to_lease_pct',
  'vacancy_pct',
  'concessions_pct',
  'bad_debt_pct',
  'non_revenue_units_pct',
  'net_rental_income',
  'other_income_per_unit',
  'egi',
  'payroll',
  'repairs_maintenance',
  'turnover',
  'amenities',
  'contract_services',
  'marketing',
  'office',
  'g_and_a',
  'hoa_dues',
  'utilities',
  'water_sewer',
  'electric',
  'gas_fuel',
  'landscaping',
  'management_fee_pct',
  'insurance',
  'real_estate_tax',
  'personal_property_tax',
  'replacement_reserves',
  'total_opex',
  'noi',
  'noi_per_unit',
] as const;

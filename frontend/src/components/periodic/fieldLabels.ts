/**
 * Human-readable labels for periodic field names.
 *
 * Maps canonical field names (from the backend periodic seed) to
 * display labels used in the PeriodicGrid component.
 */

export const FIELD_LABELS: Record<string, string> = {
  gpr: 'GPR',
  loss_to_lease_pct: 'Loss to Lease %',
  vacancy_pct: 'Vacancy %',
  concessions_pct: 'Concessions %',
  bad_debt_pct: 'Bad Debt %',
  non_revenue_units_pct: 'Non-Revenue Units %',
  net_rental_income: 'Net Rental Income',
  other_income_per_unit: 'Other Income / Unit',
  egi: 'EGI',
  payroll: 'Payroll',
  repairs_maintenance: 'R&M',
  turnover: 'Turnover',
  amenities: 'Amenities',
  contract_services: 'Contract Services',
  marketing: 'Marketing',
  office: 'Office / Admin',
  g_and_a: 'G&A',
  hoa_dues: 'HOA Dues',
  utilities: 'Utilities',
  water_sewer: 'Water / Sewer',
  electric: 'Electric',
  gas_fuel: 'Gas / Fuel',
  landscaping: 'Landscaping',
  management_fee_pct: 'Mgmt Fee %',
  insurance: 'Insurance',
  real_estate_tax: 'Property Tax',
  personal_property_tax: 'Personal Property Tax',
  replacement_reserves: 'Replacement Reserves',
  total_opex: 'Total OpEx',
  noi: 'NOI',
  noi_per_unit: 'NOI / Unit',
};

/** Format a periodic field value for display. */
export function fmtPeriodicValue(
  value: number | null,
  fieldName: string,
): string {
  if (value == null || !Number.isFinite(value)) return '—';

  const isPct = fieldName.endsWith('_pct');
  const isDollar = !isPct && !fieldName.includes('units');

  if (isPct) {
    return `${(value * 100).toFixed(2)}%`;
  }
  if (isDollar) {
    if (Math.abs(value) >= 1_000_000) {
      return `$${(value / 1_000_000).toFixed(2)}M`;
    }
    if (Math.abs(value) >= 1_000) {
      return `$${(value / 1_000).toFixed(1)}k`;
    }
    return `$${value.toFixed(0)}`;
  }
  return value.toFixed(2);
}

/** Zone type → CSS color (from BT tokens). */
export const ZONE_COLORS: Record<string, string> = {
  actual: '#00BCD4',      // cyan
  gap: '#F5A623',         // amber
  projection: '#6B7A8D',  // muted
  override: '#A78BFA',    // purple
  computed: '#00E5A0',    // teal
  unresolved: '#3B3B3B',
};

/** Zone type → background color (subtle). */
export const ZONE_BG_COLORS: Record<string, string> = {
  actual: '#00BCD411',
  gap: '#F5A62311',
  projection: '#6B7A8D08',
  override: '#A78BFA11',
  computed: '#00E5A011',
  unresolved: '#3B3B3B11',
};

/**
 * Canonical human-readable labels for pro forma field keys.
 *
 * Co-located with REVENUE_FIELDS / CTRL_OPEX_FIELDS / NCTRL_OPEX_FIELDS
 * (defined in ProFormaSummaryTab.tsx) so additions to either the field sets
 * or this label map stay in the same directory and are easy to keep in sync.
 *
 * Used by:
 *   - FinancialEnginePage.tsx  → formatOverrideNote() in version history dropdown
 */
export const FIELD_LABEL_MAP: Record<string, string> = {
  // ── Revenue ─────────────────────────────────────────────────────────────────
  gpr:                   'Gross Potential Rent',
  loss_to_lease:         'Loss to Lease',
  vacancy_loss:          'Vacancy',
  vacancy:               'Vacancy',
  vacancy_pct:           'Vacancy %',
  concessions:           'Concessions',
  concessions_pct:       'Concessions %',
  bad_debt:              'Bad Debt',
  bad_debt_pct:          'Bad Debt %',
  non_revenue_units:     'Non-Revenue Units',
  net_rental_income:     'Net Rental Income',
  other_income:          'Other Income',
  egi:                   'Effective Gross Income',

  // ── Controllable Opex ────────────────────────────────────────────────────────
  payroll:               'Payroll',
  repairs_maintenance:   'Repairs & Maintenance',
  repairs_multiplier:    'Repairs Multiplier',
  turnover:              'Turnover',
  turnover_ratio:        'Turnover Ratio',
  contract_services:     'Contract Services',
  marketing:             'Marketing',
  marketing_multiplier:  'Marketing Multiplier',
  utilities:             'Utilities',
  g_and_a:               'G&A',

  // ── Non-controllable Opex ────────────────────────────────────────────────────
  management_fee:        'Management Fee',
  management_fee_pct:    'Management Fee',
  insurance:             'Insurance',
  insurance_pct:         'Insurance %',
  real_estate_tax:       'Real Estate Tax',
  real_estate_taxes:     'Real Estate Tax',
  total_opex:            'Total Opex',

  // ── Key underwriting assumptions ─────────────────────────────────────────────
  rent_growth:              'Rent Growth',
  rent_growth_stabilized:   'Rent Growth (Stabilized)',
  exit_cap_rate:            'Exit Cap Rate',
  going_in_cap_rate:        'Going-In Cap Rate',
  expense_growth:           'Expense Growth',
  capex:                    'CapEx',
  capex_per_unit:           'CapEx / Unit',
  renovation_budget:        'Renovation Budget',
  renovation_period_years:  'Renovation Period',
  noi:                      'NOI',
  purchase_price:           'Purchase Price',
  loan_amount:              'Loan Amount',
  ltv:                      'LTV',
  interest_rate:            'Interest Rate',
  amortization:             'Amortization',
};

/**
 * Converts an `operator_override:some.nested.field_name` note string into a
 * human-readable version history label.
 *
 * Examples:
 *   "operator_override:management_fee_pct"      → "Override: Management Fee"
 *   "operator_override:opex.insurance"          → "Override: Insurance"
 *   "operator_override:unknown_custom_field"    → "Override: Unknown Custom Field"
 *   null                                        → "Override saved"
 *   "some other note"                           → "some other note"  (returned as-is)
 */
export function formatOverrideNote(note: string | null): string {
  if (!note) return 'Override saved';
  const match = note.match(/^operator_override:(.+)$/);
  if (!match) return note;
  const raw = match[1];
  const segment = raw.split('.').pop() ?? raw;
  const label = FIELD_LABEL_MAP[segment];
  if (label) return `Override: ${label}`;
  // Fallback: snake_case → Title Case
  return `Override: ${segment.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}`;
}

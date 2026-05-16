/**
 * M09 Line-Item Pattern Routing
 *
 * Every Pro Forma row renders one of three expand patterns:
 *   A — Floor-Plan Grid with Cost + Yield (GPR only)
 *   B — Simple Regime Expand (pre-reno / post-stab sub-rows)
 *   C — Single-Value (existing 3-layer pattern, no expand)
 *
 * Pattern assignment is per-line-item per-deal-type. Deal types that
 * do not have a specific entry fall back to 'C'.
 *
 * Source of truth: PRO_FORMA_REGIME_INPUT_UI_SPEC v1.0 § 3 Line-Item
 * Pattern Assignment table.
 */

export type LineItemPattern = 'A' | 'B' | 'C';

export type DealTypeKey =
  | 'value_add'
  | 'redevelopment'
  | 'development'
  | 'lease_up'
  | 'stabilized'
  | 'existing';

interface PatternEntry {
  pattern: LineItemPattern;
  dealTypes: DealTypeKey[];
}

/**
 * Spec § 3 pattern table. Only B-pattern entries are listed here
 * (C is the default fallback). GPR (A) is the one A-pattern entry.
 *
 * Omissions vs spec that remain C for all deal types:
 *   property_tax, insurance, payroll, management_fee, capex_reserve,
 *   cap_rate, debt_assumptions, exit_cap
 */
const PATTERN_TABLE: Record<string, PatternEntry> = {
  // ── Pattern A ─────────────────────────────────────────────────────────────
  gpr: {
    pattern: 'A',
    dealTypes: ['value_add', 'redevelopment', 'development', 'lease_up', 'stabilized', 'existing'],
  },

  // ── Pattern B ─────────────────────────────────────────────────────────────
  // Vacancy: B for value_add, development, redevelopment; C for stabilized
  vacancy_loss: {
    pattern: 'B',
    dealTypes: ['value_add', 'redevelopment', 'development'],
  },

  // Concessions: B for value_add, development, redevelopment
  concessions: {
    pattern: 'B',
    dealTypes: ['value_add', 'redevelopment', 'development'],
  },

  // Bad Debt: B for value_add and redevelopment; C for development
  bad_debt: {
    pattern: 'B',
    dealTypes: ['value_add', 'redevelopment'],
  },

  // Other Income: B for value_add and redevelopment; C for development
  other_income: {
    pattern: 'B',
    dealTypes: ['value_add', 'redevelopment'],
  },

  // Utilities: B for redevelopment only
  utilities: {
    pattern: 'B',
    dealTypes: ['redevelopment'],
  },

  // R&M: B for value_add and redevelopment; C for development
  repairs_maintenance: {
    pattern: 'B',
    dealTypes: ['value_add', 'redevelopment'],
  },

  // Marketing: B for value_add, development, redevelopment
  marketing: {
    pattern: 'B',
    dealTypes: ['value_add', 'redevelopment', 'development'],
  },

  // Service Contracts: B when structural change expected (value_add, redevelopment)
  contract_services: {
    pattern: 'B',
    dealTypes: ['value_add', 'redevelopment'],
  },

  // Turnover Cost: B for value_add, development, redevelopment
  turnover: {
    pattern: 'B',
    dealTypes: ['value_add', 'redevelopment', 'development'],
  },
};

/**
 * Returns the expand pattern for a given line item field and deal type.
 * Falls back to 'C' (no expand) when the field is not in the table,
 * or when the deal type does not match the table entry's deal type list.
 */
export function getLineItemPattern(
  field: string,
  dealType: DealTypeKey | string | null | undefined,
): LineItemPattern {
  const entry = PATTERN_TABLE[field];
  if (!entry) return 'C';
  if (!dealType) return 'C';
  const dt = dealType as DealTypeKey;
  if (entry.dealTypes.includes(dt)) return entry.pattern;
  return 'C';
}

/**
 * Returns true for fields that use Pattern B (regime expand) for the given
 * deal type. Used in ProFormaSummaryTab to gate which rows get the expand
 * affordance.
 */
export function isPatternB(
  field: string,
  dealType: DealTypeKey | string | null | undefined,
): boolean {
  return getLineItemPattern(field, dealType) === 'B';
}

/**
 * Returns true for GPR (always Pattern A regardless of deal type).
 */
export function isPatternA(field: string): boolean {
  return field === 'gpr';
}

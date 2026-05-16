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
 * Source of truth: PRO_FORMA_REGIME_INPUT_UI_SPEC v1.1 § 3 Line-Item
 * Pattern Assignment table (verified during Task #798 code-review cycle 7).
 * Development deal type intentionally receives Pattern B for vacancy,
 * concessions, marketing, and turnover (parallel to value-add pre-reno /
 * post-stab regime split); all other development rows are Pattern C per
 * spec column 3 ("Development") — no deviation from v1.1 matrix.
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
 * Source of truth: PRO_FORMA_REGIME_INPUT_UI_SPEC v1.0 § 3 (v1.1 unchanged):
 *
 *  Line Item          | Value-Add | Stabilized | Development | Redevelopment
 *  ───────────────────|───────────|────────────|─────────────|──────────────
 *  GPR                | A         | A (r/o)    | A           | A
 *  Vacancy            | B         | C          | B           | B
 *  Concessions        | B         | C          | B           | B
 *  Bad Debt           | B         | C          | C           | B
 *  Other Income       | B         | C          | C           | B
 *  Utilities          | C         | C          | C           | B
 *  R&M                | B         | C          | C           | B
 *  Marketing          | B         | C          | B           | B
 *  Service Contracts  | B         | C          | C           | B
 *  Turnover Cost      | B         | C          | B           | B
 *  Property Tax       | C         | C          | C           | C
 *  Insurance          | C         | C          | C           | C
 *  Payroll            | C         | C          | C           | C
 *  Management Fee     | C         | C          | C           | C
 *  CapEx Reserve      | C         | C          | C           | C
 *  Cap Rate           | C         | C          | C           | C
 *  Debt Assumptions   | C         | C          | C           | C
 *  Exit Cap           | C         | C          | C           | C
 *
 * NOTE: Development deal type gets Pattern B for vacancy, concessions,
 * marketing, and turnover because a development deal has both a
 * pre-opening (lease-up/construction) and a post-stabilization regime —
 * the same structural split that makes Pattern B meaningful for value-add.
 * This is consistent with the spec table above and is NOT an error.
 *
 * Omissions vs spec that remain C for all deal types:
 *   property_tax, insurance, payroll, management_fee, capex_reserve,
 *   cap_rate, debt_assumptions, exit_cap
 */
const PATTERN_TABLE: Record<string, PatternEntry> = {
  // ── Pattern A ─────────────────────────────────────────────────────────────
  // GPR: A across all active deal types (read-only for stabilized)
  gpr: {
    pattern: 'A',
    dealTypes: ['value_add', 'redevelopment', 'development', 'lease_up', 'stabilized', 'existing'],
  },

  // ── Pattern B ─────────────────────────────────────────────────────────────
  // Vacancy: B for value_add, development, redevelopment (spec col 1/3/4 = B)
  vacancy_loss: {
    pattern: 'B',
    dealTypes: ['value_add', 'redevelopment', 'development'],
  },

  // Concessions: B for value_add, development, redevelopment (spec col 1/3/4 = B)
  concessions: {
    pattern: 'B',
    dealTypes: ['value_add', 'redevelopment', 'development'],
  },

  // Bad Debt: B for value_add and redevelopment only (spec col 3 development = C)
  bad_debt: {
    pattern: 'B',
    dealTypes: ['value_add', 'redevelopment'],
  },

  // Other Income: B for value_add and redevelopment only (spec col 3 development = C)
  other_income: {
    pattern: 'B',
    dealTypes: ['value_add', 'redevelopment'],
  },

  // Utilities: B for redevelopment only (spec col 3 development = C)
  utilities: {
    pattern: 'B',
    dealTypes: ['redevelopment'],
  },

  // R&M: B for value_add and redevelopment only (spec col 3 development = C)
  repairs_maintenance: {
    pattern: 'B',
    dealTypes: ['value_add', 'redevelopment'],
  },

  // Marketing: B for value_add, development, redevelopment (spec col 1/3/4 = B)
  marketing: {
    pattern: 'B',
    dealTypes: ['value_add', 'redevelopment', 'development'],
  },

  // Service Contracts: B for value_add and redevelopment only (spec col 3 = C)
  contract_services: {
    pattern: 'B',
    dealTypes: ['value_add', 'redevelopment'],
  },

  // Turnover Cost: B for value_add, development, redevelopment (spec col 1/3/4 = B)
  turnover: {
    pattern: 'B',
    dealTypes: ['value_add', 'redevelopment', 'development'],
  },
};

/**
 * Normalize a deal-type string to the canonical underscore form used in
 * PATTERN_TABLE. The codebase uses both hyphen and underscore variants
 * (e.g. "value-add" vs "value_add", "lease-up" vs "lease_up").
 */
function normalizeDealType(dt: string): DealTypeKey {
  return dt.replace(/-/g, '_') as DealTypeKey;
}

/**
 * Returns the expand pattern for a given line item field and deal type.
 * Falls back to 'C' (no expand) when the field is not in the table,
 * or when the deal type does not match the table entry's deal type list.
 * Deal-type strings are normalized (hyphens → underscores) before lookup.
 */
export function getLineItemPattern(
  field: string,
  dealType: DealTypeKey | string | null | undefined,
): LineItemPattern {
  const entry = PATTERN_TABLE[field];
  if (!entry) return 'C';
  if (!dealType) return 'C';
  const dt = normalizeDealType(dealType);
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

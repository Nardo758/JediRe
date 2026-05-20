/**
 * Hold-period profiles — typical, min, and max hold years keyed by either
 * investment strategy (development_type) or debt structure (loanType).
 *
 * Single source of truth: replaces hardcoded `30` / `36` literals that used to
 * be scattered across the cashflow agent, projection loops, route validators,
 * and Zod schemas. A hold-year cap is no longer a magic number — it is the
 * `max` field on a named profile, derived from industry-standard underwriting
 * norms and the typical term of the deal's debt.
 *
 * Resolution order for a deal:
 *   1. Explicit user/analyst override (request query, deal_assumptions)
 *   2. Strategy profile (development_type)
 *   3. Debt profile (loanType)
 *   4. Safe fallback (5 yr)
 *
 * Profile sources: NCREIF / NMHC / IPA institutional underwriting norms and
 * matching loan-term conventions from `fetch_debt_assumptions.ts`.
 */

/**
 * Investment-strategy categories. Values mirror the `deals.development_type`
 * column. Previously this was an implicit string union scattered across
 * conditional comparisons — defining it once here gives the rest of the
 * codebase a single import point.
 */
export type DevelopmentType = 'value-add' | 'core' | 'core-plus' | 'opportunistic';

/** Loan types recognised by the debt-position model. Mirrors DebtPosition.loanType. */
export type LoanType = 'agency' | 'cmbs' | 'bank' | 'bridge' | 'life_co' | 'debt_fund';

export interface HoldPeriodProfile {
  /** Industry-typical hold for this profile — used as a default. */
  typical: number;
  /** Shortest hold that still fits the strategy/debt structure. */
  min: number;
  /** Longest hold before the structure stops making sense. */
  max: number;
}

/**
 * Strategy-based hold profiles. Keys mirror the values of `deals.development_type`
 * in the deals table. `typical` matches the legacy `value-add → 5, others → 7`
 * hardcoded split in `deals.service.ts` so existing deals see no number change.
 */
export const STRATEGY_HOLD_PROFILES: Record<DevelopmentType, HoldPeriodProfile> = {
  'value-add':     { typical: 5,  min: 3, max: 10 },
  'core':          { typical: 7,  min: 5, max: 36 },
  'core-plus':     { typical: 7,  min: 5, max: 15 },
  'opportunistic': { typical: 7,  min: 5, max: 12 },
};

/**
 * Debt-implied hold profiles. Hold horizon ≈ loan term + typical extension
 * window. Numbers mirror the loan-type defaults in
 * `agents/tools/fetch_debt_assumptions.ts` so the two stay in sync.
 */
export const DEBT_HOLD_PROFILES: Record<LoanType, HoldPeriodProfile> = {
  agency:    { typical: 10, min: 7, max: 12 },
  cmbs:      { typical: 10, min: 5, max: 10 },
  life_co:   { typical: 10, min: 7, max: 15 },
  bank:      { typical: 5,  min: 3, max: 7 },
  bridge:    { typical: 3,  min: 1, max: 5 },
  debt_fund: { typical: 3,  min: 1, max: 5 },
};

/**
 * Outer ceiling, computed from the longest `max` across all profiles. Use this
 * only at validation boundaries where deal context isn't available — Zod
 * schemas in agent tools, defense-in-depth clamps in shared services. Where
 * deal data IS available, call `resolveMaxHold()` for a per-deal bound.
 *
 * Computed (not hardcoded) so adding or changing a profile flows through
 * automatically without needing to touch every consumer.
 */
export const ABSOLUTE_MAX_HOLD_YEARS: number = Math.max(
  ...Object.values(STRATEGY_HOLD_PROFILES).map(p => p.max),
  ...Object.values(DEBT_HOLD_PROFILES).map(p => p.max),
);

export interface HoldContext {
  strategy?: DevelopmentType | null;
  loanType?: LoanType | null;
}

/** Typical hold for a deal. Strategy wins over debt; falls back to 5 yr. */
export function resolveTypicalHold(ctx: HoldContext): number {
  if (ctx.strategy && STRATEGY_HOLD_PROFILES[ctx.strategy]) {
    return STRATEGY_HOLD_PROFILES[ctx.strategy].typical;
  }
  if (ctx.loanType && DEBT_HOLD_PROFILES[ctx.loanType]) {
    return DEBT_HOLD_PROFILES[ctx.loanType].typical;
  }
  return 5;
}

/** Max sensible hold for a deal. Falls back to the absolute ceiling. */
export function resolveMaxHold(ctx: HoldContext): number {
  if (ctx.strategy && STRATEGY_HOLD_PROFILES[ctx.strategy]) {
    return STRATEGY_HOLD_PROFILES[ctx.strategy].max;
  }
  if (ctx.loanType && DEBT_HOLD_PROFILES[ctx.loanType]) {
    return DEBT_HOLD_PROFILES[ctx.loanType].max;
  }
  return ABSOLUTE_MAX_HOLD_YEARS;
}

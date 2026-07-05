/**
 * Highlands golden fixture — seed path.
 *
 * FINDING K RULING (operator-ratified):
 * Highlands is `owned_import` — it entered at Owned/Operate, was never underwritten
 * on-platform. Hand-creating acquisition/financing/exit assumptions to force an
 * underwriting that never happened (Option 1) is REJECTED — that would violate
 * origin-class honesty.
 *
 * STATUS: NOT PINNED. See Finding N in W5-DISPATCH.md (2026-07-05).
 *
 * Highlands does have ONE deal_assumptions row (auto-seeded from actuals —
 * egi/gpr/noi/opex line items, vacancy_pct, etc.), but it has no purchase_price,
 * exit_cap_rate, hold_period, or loan_amount anywhere in year1 or
 * per_year_overrides. That's expected: those inputs genuinely don't exist for an
 * already-owned asset that was never acquired-and-underwritten on-platform.
 *
 * The blocker: `GoldenFixture.expected` (golden.types.ts) is one required 12-field
 * proforma/return shape shared by every fixture class — irr, equityMultiple,
 * dscrY1, cashOnCashY1, goingInCapRate, exitCapRate, totalEquity, totalDebt,
 * netProceeds, etc. Eight of those twelve fields require acquisition/financing/exit
 * assumptions Highlands does not and should not have. There is no honest way to
 * populate them from the seed/actuals surface alone — attempting to would mean
 * either fabricating inputs (rejected above) or writing placeholder/known-wrong
 * values into `expected` (also rejected, per operator standing rule).
 *
 * Authoritative actuals-surface numbers ARE known (for whichever narrower shape
 * this fixture eventually gets):
 *   - NOI margin: 57.17%
 *   - EGI 2025: $6,315,308
 *   - Boundary: 2026-04-01
 *
 * Do not pin `expected` here until one of Finding N's remediation options is
 * decided: either give seed-path fixtures a narrower actuals-only expected shape
 * (distinct from the 12-field proforma/return shape), or scope the 12-field
 * regression contract to build_path/synthetic fixtures only and drop the
 * seed-path fixture from that specific acceptance criterion.
 *
 * The build-path Highlands golden is NOT CREATED. Bishop alone is the build-path
 * golden (architecturally right: Bishop has real underwriting history) — though
 * Bishop is separately blocked by Finding M.
 *
 * rawAssumptions remains null — seed path validates post-engine values, not inputs.
 */

import type { GoldenFixture } from './golden.types';

export const highlandsFixture: GoldenFixture = {
  dealId: 'eaabeb9f',
  dealIdFull: 'eaabeb9f-830e-44f9-a923-56679ad0329d',
  dealName: 'Highlands',
  fixtureClass: 'seed_path',
  rawAssumptions: null, // Seed path: no ProFormaAssumptions — values are post-engine
  expected: null,       // PIN AFTER seed-path capture (margin 57.17%, EGI $6,315,308 known)
  provenance: null,     // CAPTURE with seed endpoint, origin_class: owned_import
};

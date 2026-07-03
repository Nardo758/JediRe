/**
 * Excel Parity Test — Operator Workbook as Oracle
 *
 * TODO (W4/W5): Operator supplies workbook values for one real deal.
 * This test asserts line-by-line agreement GPR→IRR within rounding tolerance.
 *
 * Discipline: The workbook wins unless the workbook has the bug — disagreement
 * is itself a finding for operator review.
 *
 * Tolerance rules:
 *   - Dollar fields (GPR, EGI, NOI, debt service, etc.): ±$1
 *   - Rates (IRR, cap rate, yield): ±0.0001 (4 decimals)
 *   - Percentages (vacancy, bad debt, etc.): ±0.01% (2 decimals)
 *   - Multiples (EM): ±0.001 (3 decimals)
 */

import { describe, it, expect } from 'vitest';

// Placeholder — populate after operator supplies workbook values
describe.skip('Excel Parity — Operator Workbook (TODO W4/W5)', () => {
  it('matches workbook line-by-line for one real deal', () => {
    // Operator supplies:
    //   1. Assumption set (units, rents, expenses, debt terms, etc.)
    //   2. Workbook row-by-row outputs (Year 1-5 GPR, EGI, NOI, debt service, cash flow, IRR, EM)
    //
    // This test:
    //   a. Runs the deterministic engine with the same assumptions
    //   b. Asserts each workbook row == engine row within tolerance
    //   c. Any disagreement → logged as finding for operator review
    //
    // Example assertion structure:
    // const workbook = loadWorkbookValues(/* operator file */);
    // const engine = runModel(workbook.assumptions);
    // for (let y = 1; y <= 5; y++) {
    //   expect(engine.annualCashFlow[y-1].grossPotentialRent).toBeCloseTo(workbook.gpr[y], 0);
    //   expect(engine.annualCashFlow[y-1].noi).toBeCloseTo(workbook.noi[y], 0);
    // }
    // expect(engine.summary.irr).toBeCloseTo(workbook.irr, 4);
  });
});

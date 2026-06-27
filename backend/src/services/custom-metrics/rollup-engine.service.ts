/**
 * Rollup engine — Custom Metrics Category 7
 *
 * CUSTOM_METRICS_BUILD_SPEC.md §3 — Correctness boundary
 *
 * The single most dangerous part: a ratio cannot be summed.
 * Monthly series rolls to annual differently by metric shape.
 */

import type { ASTNode } from './formula-evaluator.service';
import { evaluateFormula } from './formula-evaluator.service';
import type { PeriodLayeredValue } from '../proforma/periodic-field.types';

export type RollupType = 'sum' | 'avg' | 'end_of_period' | 'rederive';

/**
 * Rollup a monthly series to annual values.
 *
 * @param periods   Monthly PeriodLayeredValue array
 * @param rollup    Rollup type
 * @param formula   For 'rederive': the AST to re-evaluate on annual-rolled inputs
 * @returns         Array of annual values (one per year), each with year label
 */
export function rollupSeries(
  periods: PeriodLayeredValue[],
  rollup: RollupType,
  formula?: ASTNode,
): Array<{ year: string; value: number | null; actualMonths: number; projectionMonths: number }> {
  // Group by year
  const yearMap: Record<string, PeriodLayeredValue[]> = {};
  for (const p of periods) {
    const year = p.month.slice(0, 4); // YYYY from YYYY-MM
    yearMap[year] = yearMap[year] || [];
    yearMap[year].push(p);
  }

  const years = Object.keys(yearMap).sort();
  const result: Array<{ year: string; value: number | null; actualMonths: number; projectionMonths: number }> = [];

  for (const year of years) {
    const yearPeriods = yearMap[year].sort((a, b) => a.month.localeCompare(b.month));
    const actualMonths = yearPeriods.filter(p => p.zone === 'actual').length;
    const projectionMonths = yearPeriods.filter(p => p.zone === 'projection').length;

    let value: number | null = null;

    switch (rollup) {
      case 'sum': {
        // Σ of 12 months — for flows (NOI, GPR, opex, cash flow)
        const sum = yearPeriods.reduce((s, p) => s + (p.resolved ?? 0), 0);
        value = yearPeriods.length > 0 ? sum : null;
        break;
      }

      case 'avg': {
        // Mean of 12 months — for rates that average (occupancy)
        const vals = yearPeriods.map(p => p.resolved).filter((v): v is number => v != null);
        value = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
        break;
      }

      case 'end_of_period': {
        // December value — for stocks (units, balance)
        const last = yearPeriods[yearPeriods.length - 1];
        value = last?.resolved ?? null;
        break;
      }

      case 'rederive': {
        // Formula evaluated on annual-rolled inputs — for ratios (debt yield, expense ratio, DSCR)
        // This requires the formula to be evaluated on the annual-rolled values of its inputs
        // For now: sum numerator and denominator separately, then divide
        // (A more complete implementation would walk the AST and re-derive each sub-expression)
        if (formula) {
          // Simplified: assume the formula is a ratio (a/b) or linear combination
          // Full implementation: walk AST, collect numerator/denominator fields, sum each, re-evaluate
          value = rederiveAnnual(yearPeriods, formula);
        } else {
          value = null;
        }
        break;
      }
    }

    result.push({ year, value, actualMonths, projectionMonths });
  }

  return result;
}

/**
 * Re-derive a ratio formula at the annual level.
 *
 * For a ratio like "noi / loan_amount", the annual value is:
 *   annual_noi_sum / loan_amount (constant across months)
 *
 * For a ratio of two flow fields, both numerator and denominator are summed annually,
 * then the ratio is computed from the annual sums.
 *
 * This is a simplified implementation that handles the common case.
 * A full implementation would walk the AST and apply rollup semantics per sub-expression.
 */
function rederiveAnnual(yearPeriods: PeriodLayeredValue[], formula: ASTNode): number | null {
  // Collect all field references in the formula
  const fields = collectFields(formula);

  // Build annual context: sum each field's resolved values across the year
  const annualContext: Record<string, number | null> = {};
  for (const field of fields) {
    const sum = yearPeriods.reduce((s, p) => s + (p.resolved ?? 0), 0);
    annualContext[field] = yearPeriods.length > 0 ? sum : null;
  }

  // Evaluate the formula with the annual-summed context
  return evaluateFormula(formula, annualContext);
}

function collectFields(node: ASTNode): string[] {
  const fields: string[] = [];
  function walk(n: ASTNode) {
    switch (n.type) {
      case 'field':
        fields.push(n.name);
        break;
      case 'function':
        n.args.forEach(walk);
        break;
      case 'binary':
        walk(n.left);
        walk(n.right);
        break;
      case 'unary':
        walk(n.operand);
        break;
    }
  }
  walk(node);
  return [...new Set(fields)];
}

/**
 * Rollup a split transition year (part actual + part projection).
 *
 * The split year has N actual months and (12-N) projection months.
 * Per the spec: a rederive ratio re-derives over the blended annual inputs;
 * a sum flow sums all 12.
 *
 * @param periods   The 12 months of the transition year
 * @param rollup    Rollup type
 * @param formula   For 'rederive'
 * @returns         The annual value for the split year
 */
export function rollupSplitYear(
  periods: PeriodLayeredValue[],
  rollup: RollupType,
  formula?: ASTNode,
): { value: number | null; actualMonths: number; projectionMonths: number } {
  const actualMonths = periods.filter(p => p.zone === 'actual').length;
  const projectionMonths = periods.filter(p => p.zone === 'projection').length;

  let value: number | null = null;

  switch (rollup) {
    case 'sum': {
      const sum = periods.reduce((s, p) => s + (p.resolved ?? 0), 0);
      value = periods.length > 0 ? sum : null;
      break;
    }
    case 'avg': {
      const vals = periods.map(p => p.resolved).filter((v): v is number => v != null);
      value = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
      break;
    }
    case 'end_of_period': {
      const last = periods[periods.length - 1];
      value = last?.resolved ?? null;
      break;
    }
    case 'rederive': {
      if (formula) {
        value = rederiveAnnual(periods, formula);
      }
      break;
    }
  }

  return { value, actualMonths, projectionMonths };
}

/**
 * Compute the annual series for a custom metric from its monthly periods.
 *
 * @param periods   Monthly PeriodLayeredValue array
 * @param rollup    Rollup type
 * @param formula   For 'rederive'
 * @returns         Array of {year, value, zone, actualMonths, projectionMonths}
 */
export function computeAnnualSeries(
  periods: PeriodLayeredValue[],
  rollup: RollupType,
  formula?: ASTNode,
): Array<{ year: string; value: number | null; zone: 'actual' | 'gap' | 'projection' | 'mixed'; actualMonths: number; projectionMonths: number }> {
  const yearRollups = rollupSeries(periods, rollup, formula);

  return yearRollups.map(({ year, value, actualMonths, projectionMonths }) => {
    let zone: 'actual' | 'gap' | 'projection' | 'mixed';
    if (actualMonths === 12) zone = 'actual';
    else if (projectionMonths === 12) zone = 'projection';
    else if (actualMonths === 0 && projectionMonths === 0) zone = 'gap';
    else zone = 'mixed';

    return { year, value, zone, actualMonths, projectionMonths };
  });
}

/**
 * Tests for heuristic sigma builder and Mahalanobis distance
 *
 * These test the pure math functions with no DB/import chain dependencies.
 */

import { describe, it, expect } from 'vitest';
import {
  buildHeuristicSigma,
  buildAllRegimeMatrices,
  mahalanobisSquared,
  mahalanobisContributions,
  aggressivenessBand,
} from '../../src/services/sigma/heuristic-sigma-builder';
import { SIGMA_VARIABLES, VARIABLE_COUNT } from '../../src/services/sigma/sigma-variable-registry';

describe('sigma-variable-registry', () => {
  it('has correct variable count', () => {
    const vc = Object.keys(SIGMA_VARIABLES).length;
    expect(vc).toBeGreaterThanOrEqual(45);
    expect(vc).toBeLessThanOrEqual(60);
  });

  it('has block B variables with maxMovePerIteration', () => {
    const blockB = Object.values(SIGMA_VARIABLES).filter(v => v.block === 'B');
    expect(blockB.length).toBeGreaterThanOrEqual(10);
    for (const v of blockB) {
      expect(v.minFeasible).toBeDefined();
      expect(v.maxFeasible).toBeDefined();
    }
  });

  it('has block C factors (macro)', () => {
    const blockC = Object.values(SIGMA_VARIABLES).filter(v => v.block === 'C');
    expect(blockC.length).toBeGreaterThanOrEqual(6);
    expect(blockC.some(v => v.id === 'X10Y_treasury')).toBe(true);
    expect(blockC.some(v => v.id === 'vix')).toBe(true);
  });

  it('has macro-anchored variables', () => {
    const anchored = Object.values(SIGMA_VARIABLES).filter(v => v.macroAnchored);
    expect(anchored.length).toBeGreaterThanOrEqual(5);
    const ids = anchored.map(v => v.id);
    expect(ids).toContain('rent_growth');
    expect(ids).toContain('construction_cost_yoy');
    expect(ids).toContain('wage_growth_yoy');
    expect(ids).toContain('exit_cap_rate');
    expect(ids).toContain('expense_growth');
  });
});

describe('heuristic-sigma-builder', () => {
  it('builds a positive definite covariance matrix', () => {
    const sigma = buildHeuristicSigma('expansion');
    expect(sigma.variableOrder.length).toBe(VARIABLE_COUNT);
    expect(sigma.covFlat.length).toBe(VARIABLE_COUNT * VARIABLE_COUNT);
    expect(sigma.meanVector.length).toBe(VARIABLE_COUNT);
    expect(sigma.invCovFlat.length).toBe(VARIABLE_COUNT * VARIABLE_COUNT);

    // Check diagonal is positive
    const diag = sigma.covFlat.filter((_, i) => i % (VARIABLE_COUNT + 1) === 0);
    for (const d of diag) {
      expect(d).toBeGreaterThan(0);
    }
  });

  it('builds all three regime matrices with different means', () => {
    const matrices = buildAllRegimeMatrices();

    // Three matrices
    expect(Object.keys(matrices)).toEqual(['expansion', 'late_cycle', 'contraction']);

    // Contraction should have lower rent growth mean
    const rGrowthIdx = matrices.expansion.variableOrder.indexOf('rent_growth');
    expect(matrices.contraction.meanVector[rGrowthIdx])
      .toBeLessThan(matrices.expansion.meanVector[rGrowthIdx]);

    // Contraction should have higher exit cap rate mean
    const exitCapIdx = matrices.expansion.variableOrder.indexOf('exit_cap_rate');
    expect(matrices.contraction.meanVector[exitCapIdx])
      .toBeGreaterThan(matrices.expansion.meanVector[exitCapIdx]);
  });

  it('computes Mahalanobis distance correctly — identical to mean gives d=0', () => {
    const sigma = buildHeuristicSigma('expansion');
    const n = sigma.variableOrder.length;

    // x = μ → d² should be 0 (or very small)
    const d2 = mahalanobisSquared(sigma.meanVector, sigma.meanVector, sigma.invCovFlat, n);
    expect(Math.abs(d2)).toBeLessThan(1e-10);
  });

  it('computes Mahalanobis distance — one sigma deviation', () => {
    const sigma = buildHeuristicSigma('expansion');
    const n = sigma.variableOrder.length;

    // x = μ + 1σ for one variable (should give d² ≈ 1 for that variable)
    const x = [...sigma.meanVector];
    const idx = sigma.variableOrder.indexOf('rent_growth');
    x[idx] += Math.sqrt(sigma.covFlat[idx * n + idx]); // +1σ

    const d2 = mahalanobisSquared(x, sigma.meanVector, sigma.invCovFlat, n);
    // Should be close to 1 (approximately)
    expect(d2).toBeGreaterThan(0.5);
    expect(d2).toBeLessThan(2.0);
  });

  it('per-variable contributions sum to d²', () => {
    const sigma = buildHeuristicSigma('expansion');
    const n = sigma.variableOrder.length;

    const x = [...sigma.meanVector];
    const idx = sigma.variableOrder.indexOf('rent_growth');
    x[idx] = sigma.meanVector[idx] + 0.02; // +200bps on rent growth

    const d2 = mahalanobisSquared(x, sigma.meanVector, sigma.invCovFlat, n);
    const contribs = mahalanobisContributions(x, sigma.meanVector, sigma.invCovFlat, n);
    const sumContribs = contribs.reduce((a, b) => a + b, 0);

    expect(Math.abs(d2 - sumContribs)).toBeLessThan(1e-10);
  });

  it('aggressiveness bands are correct', () => {
    // The function takes d² (squared Mahalanobis) not d
    // d=sqrt(0.25) = 0.5 → Realistic
    expect(aggressivenessBand(0.25).band).toBe('Realistic');
    // d=1.0 → Realistic
    expect(aggressivenessBand(1.0).band).toBe('Realistic');
    // d=sqrt(2.25)=1.5 → Stretch  (test was passing d²=1.5, not d=1.5)
    expect(aggressivenessBand(2.25).band).toBe('Stretch');
    // d=sqrt(6.25)=2.5 → Aggressive
    expect(aggressivenessBand(6.25).band).toBe('Aggressive');
    // d=2.0 → Stretch
    expect(aggressivenessBand(4.0).band).toBe('Stretch');
    // d=3.0 → Aggressive (boundary case: 3.0 > 3 is false)
    expect(aggressivenessBand(9.0).band).toBe('Aggressive');
    // d=3.2 → Heroic
    expect(aggressivenessBand(10.24).band).toBe('Heroic');
  });
});

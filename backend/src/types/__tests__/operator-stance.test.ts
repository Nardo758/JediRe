/**
 * Unit tests for OperatorStance modulation rules and helpers.
 *
 * Tests cover:
 *   - computeStanceDelta for each rule
 *   - Additive combination of multiple rules
 *   - MARKET defaults produce zero deltas
 *   - Stress dials accumulate on top of rule deltas
 *   - buildStanceTrace produces non-empty strings
 *   - resolveStance with null/partial/full input
 *   - rentGrowthStabilized covered by cyclePosition rules
 */

import {
  computeStanceDelta,
  buildStanceTrace,
  resolveStance,
  PLATFORM_STANCE_DEFAULTS,
  type OperatorStance,
} from '../operator-stance';

// ── Helpers ──────────────────────────────────────────────────────────────────

function marketStance(): OperatorStance {
  return { ...PLATFORM_STANCE_DEFAULTS, defaulted: false };
}

// ── resolveStance ─────────────────────────────────────────────────────────────

describe('resolveStance', () => {
  it('returns platform defaults when called with null', () => {
    const s = resolveStance(null);
    expect(s.underwritingPosture).toBe('MARKET');
    expect(s.rateEnvironment).toBe('NORMALIZING');
    expect(s.cyclePosition).toBe('MID');
    expect(s.defaulted).toBe(true);
  });

  it('returns platform defaults when called with undefined', () => {
    const s = resolveStance(undefined);
    expect(s.defaulted).toBe(true);
  });

  it('merges partial with defaults', () => {
    const s = resolveStance({ underwritingPosture: 'CONSERVATIVE' });
    expect(s.underwritingPosture).toBe('CONSERVATIVE');
    expect(s.rateEnvironment).toBe('NORMALIZING'); // still default
    expect(s.defaulted).toBe(false);
  });

  it('returns full persisted stance unchanged', () => {
    const full: OperatorStance = { ...PLATFORM_STANCE_DEFAULTS, underwritingPosture: 'AGGRESSIVE', defaulted: false };
    const s = resolveStance(full);
    expect(s.underwritingPosture).toBe('AGGRESSIVE');
    expect(s.defaulted).toBe(false);
  });
});

// ── MARKET baseline → zero deltas ─────────────────────────────────────────────

describe('computeStanceDelta — MARKET stance (all defaults)', () => {
  const stance = marketStance();

  const stanceFields = ['rentGrowth', 'rentGrowthStabilized', 'exitCapRate', 'vacancy', 'expenseGrowth'];

  for (const field of stanceFields) {
    it(`produces zero delta for ${field}`, () => {
      const { deltaBps } = computeStanceDelta(stance, field);
      expect(deltaBps).toBe(0);
    });
  }
});

// ── underwritingPosture rules ─────────────────────────────────────────────────

describe('computeStanceDelta — underwritingPosture', () => {
  it('CONSERVATIVE: rentGrowth -25bps', () => {
    const { deltaBps } = computeStanceDelta({ ...marketStance(), underwritingPosture: 'CONSERVATIVE' }, 'rentGrowth');
    expect(deltaBps).toBe(-25);
  });

  it('CONSERVATIVE: exitCapRate +50bps', () => {
    const { deltaBps } = computeStanceDelta({ ...marketStance(), underwritingPosture: 'CONSERVATIVE' }, 'exitCapRate');
    expect(deltaBps).toBe(50);
  });

  it('CONSERVATIVE: vacancy +100bps', () => {
    const { deltaBps } = computeStanceDelta({ ...marketStance(), underwritingPosture: 'CONSERVATIVE' }, 'vacancy');
    expect(deltaBps).toBe(100);
  });

  it('AGGRESSIVE: rentGrowth +25bps', () => {
    const { deltaBps } = computeStanceDelta({ ...marketStance(), underwritingPosture: 'AGGRESSIVE' }, 'rentGrowth');
    expect(deltaBps).toBe(25);
  });

  it('AGGRESSIVE: exitCapRate -25bps', () => {
    const { deltaBps } = computeStanceDelta({ ...marketStance(), underwritingPosture: 'AGGRESSIVE' }, 'exitCapRate');
    expect(deltaBps).toBe(-25);
  });

  it('AGGRESSIVE: vacancy -50bps', () => {
    const { deltaBps } = computeStanceDelta({ ...marketStance(), underwritingPosture: 'AGGRESSIVE' }, 'vacancy');
    expect(deltaBps).toBe(-50);
  });
});

// ── rateEnvironment rules ─────────────────────────────────────────────────────

describe('computeStanceDelta — rateEnvironment', () => {
  it('CUTTING: exitCapRate -25bps', () => {
    const { deltaBps } = computeStanceDelta({ ...marketStance(), rateEnvironment: 'CUTTING' }, 'exitCapRate');
    expect(deltaBps).toBe(-25);
  });

  it('HIGHER_FOR_LONGER: exitCapRate +50bps', () => {
    const { deltaBps } = computeStanceDelta({ ...marketStance(), rateEnvironment: 'HIGHER_FOR_LONGER' }, 'exitCapRate');
    expect(deltaBps).toBe(50);
  });

  it('HIGHER_FOR_LONGER: expenseGrowth +50bps', () => {
    const { deltaBps } = computeStanceDelta({ ...marketStance(), rateEnvironment: 'HIGHER_FOR_LONGER' }, 'expenseGrowth');
    expect(deltaBps).toBe(50);
  });

  it('NORMALIZING: zero delta on exitCapRate', () => {
    const { deltaBps } = computeStanceDelta({ ...marketStance(), rateEnvironment: 'NORMALIZING' }, 'exitCapRate');
    expect(deltaBps).toBe(0);
  });
});

// ── cyclePosition rules ───────────────────────────────────────────────────────

describe('computeStanceDelta — cyclePosition', () => {
  it('EARLY: rentGrowth +50bps', () => {
    const { deltaBps } = computeStanceDelta({ ...marketStance(), cyclePosition: 'EARLY' }, 'rentGrowth');
    expect(deltaBps).toBe(50);
  });

  it('EARLY: rentGrowthStabilized +50bps (spec coverage)', () => {
    const { deltaBps } = computeStanceDelta({ ...marketStance(), cyclePosition: 'EARLY' }, 'rentGrowthStabilized');
    expect(deltaBps).toBe(50);
  });

  it('LATE: rentGrowth -50bps', () => {
    const { deltaBps } = computeStanceDelta({ ...marketStance(), cyclePosition: 'LATE' }, 'rentGrowth');
    expect(deltaBps).toBe(-50);
  });

  it('LATE: rentGrowthStabilized -50bps (spec coverage)', () => {
    const { deltaBps } = computeStanceDelta({ ...marketStance(), cyclePosition: 'LATE' }, 'rentGrowthStabilized');
    expect(deltaBps).toBe(-50);
  });

  it('LATE: vacancy +50bps', () => {
    const { deltaBps } = computeStanceDelta({ ...marketStance(), cyclePosition: 'LATE' }, 'vacancy');
    expect(deltaBps).toBe(50);
  });

  it('LATE: exitCapRate +25bps', () => {
    const { deltaBps } = computeStanceDelta({ ...marketStance(), cyclePosition: 'LATE' }, 'exitCapRate');
    expect(deltaBps).toBe(25);
  });

  it('MID: zero delta on all fields', () => {
    const s = { ...marketStance(), cyclePosition: 'MID' as const };
    expect(computeStanceDelta(s, 'rentGrowth').deltaBps).toBe(0);
    expect(computeStanceDelta(s, 'exitCapRate').deltaBps).toBe(0);
    expect(computeStanceDelta(s, 'vacancy').deltaBps).toBe(0);
  });
});

// ── expenseGrowthPosture rules ────────────────────────────────────────────────

describe('computeStanceDelta — expenseGrowthPosture', () => {
  it('CONTAINED: expenseGrowth -50bps', () => {
    const { deltaBps } = computeStanceDelta({ ...marketStance(), expenseGrowthPosture: 'CONTAINED' }, 'expenseGrowth');
    expect(deltaBps).toBe(-50);
  });

  it('STRESSED: expenseGrowth +100bps', () => {
    const { deltaBps } = computeStanceDelta({ ...marketStance(), expenseGrowthPosture: 'STRESSED' }, 'expenseGrowth');
    expect(deltaBps).toBe(100);
  });
});

// ── Stress dials accumulate ───────────────────────────────────────────────────

describe('computeStanceDelta — stress dials', () => {
  it('stressRentGrowthHaircut accumulates on top of CONSERVATIVE posture', () => {
    const stance: OperatorStance = {
      ...marketStance(),
      underwritingPosture: 'CONSERVATIVE',
      stressRentGrowthHaircut: 50,
    };
    const { deltaBps } = computeStanceDelta(stance, 'rentGrowth');
    // CONSERVATIVE = -25bps, stressHaircut = -50bps → total = -75bps
    expect(deltaBps).toBe(-75);
  });

  it('stressExitCapWiden accumulates on top of HIGHER_FOR_LONGER', () => {
    const stance: OperatorStance = {
      ...marketStance(),
      rateEnvironment: 'HIGHER_FOR_LONGER',
      stressExitCapWiden: 25,
    };
    const { deltaBps } = computeStanceDelta(stance, 'exitCapRate');
    // HIGHER_FOR_LONGER = +50bps, stressWiden = +25bps → total = +75bps
    expect(deltaBps).toBe(75);
  });

  it('stressVacancyFloor (in pp) accumulates — 2pp = 200bps equivalent', () => {
    const stance: OperatorStance = {
      ...marketStance(),
      stressVacancyFloor: 2, // 2pp
    };
    const { deltaBps } = computeStanceDelta(stance, 'vacancy');
    // 2pp × 100 = 200bps
    expect(deltaBps).toBe(200);
  });

  it('zero stress dials on MARKET produce zero delta', () => {
    const stance: OperatorStance = {
      ...marketStance(),
      stressRentGrowthHaircut: 0,
      stressExitCapWiden: 0,
      stressVacancyFloor: 0,
    };
    expect(computeStanceDelta(stance, 'rentGrowth').deltaBps).toBe(0);
    expect(computeStanceDelta(stance, 'exitCapRate').deltaBps).toBe(0);
    expect(computeStanceDelta(stance, 'vacancy').deltaBps).toBe(0);
  });
});

// ── Additive combination of multiple active rules ─────────────────────────────

describe('computeStanceDelta — additive multi-rule combinations', () => {
  it('CONSERVATIVE + HIGHER_FOR_LONGER → exitCapRate = +50 + +50 = +100bps', () => {
    const stance: OperatorStance = {
      ...marketStance(),
      underwritingPosture: 'CONSERVATIVE',
      rateEnvironment: 'HIGHER_FOR_LONGER',
    };
    const { deltaBps } = computeStanceDelta(stance, 'exitCapRate');
    expect(deltaBps).toBe(100);
  });

  it('AGGRESSIVE + CUTTING → exitCapRate = -25 + -25 = -50bps', () => {
    const stance: OperatorStance = {
      ...marketStance(),
      underwritingPosture: 'AGGRESSIVE',
      rateEnvironment: 'CUTTING',
    };
    const { deltaBps } = computeStanceDelta(stance, 'exitCapRate');
    expect(deltaBps).toBe(-50);
  });

  it('CONSERVATIVE + LATE → rentGrowth = -25 + -50 = -75bps', () => {
    const stance: OperatorStance = {
      ...marketStance(),
      underwritingPosture: 'CONSERVATIVE',
      cyclePosition: 'LATE',
    };
    const { deltaBps } = computeStanceDelta(stance, 'rentGrowth');
    expect(deltaBps).toBe(-75);
  });
});

// ── Idempotency: applying a delta is deterministic ────────────────────────────

describe('computeStanceDelta — idempotency (same stance → same delta)', () => {
  it('same stance input always produces same deltaBps', () => {
    const stance: OperatorStance = {
      ...marketStance(),
      underwritingPosture: 'CONSERVATIVE',
      rateEnvironment: 'HIGHER_FOR_LONGER',
      stressExitCapWiden: 25,
    };
    const a = computeStanceDelta(stance, 'exitCapRate');
    const b = computeStanceDelta(stance, 'exitCapRate');
    expect(a.deltaBps).toBe(b.deltaBps);
    // CONSERVATIVE (+50) + HIGHER_FOR_LONGER (+50) + stress (+25) = +125bps
    expect(a.deltaBps).toBe(125);
  });
});

// ── buildStanceTrace ──────────────────────────────────────────────────────────

describe('buildStanceTrace', () => {
  it('returns a non-empty string when rules fired', () => {
    const stance: OperatorStance = { ...marketStance(), underwritingPosture: 'CONSERVATIVE' };
    const { deltaBps, firedRules } = computeStanceDelta(stance, 'exitCapRate');
    const trace = buildStanceTrace(stance, 'exitCapRate', deltaBps, firedRules);
    expect(trace).toBeTruthy();
    expect(trace).toContain('posture_conservative_exit_cap');
    expect(trace).toContain('+50bps');
  });

  it('includes stress dial traces when active', () => {
    const stance: OperatorStance = { ...marketStance(), stressExitCapWiden: 75 };
    const { deltaBps, firedRules } = computeStanceDelta(stance, 'exitCapRate');
    const trace = buildStanceTrace(stance, 'exitCapRate', deltaBps, firedRules);
    expect(trace).toContain('stressExitCapWiden(+75bps)');
  });

  it('returns "no stance adjustment" string for zero-delta MARKET defaults', () => {
    const stance = marketStance();
    const { deltaBps, firedRules } = computeStanceDelta(stance, 'rentGrowth');
    expect(deltaBps).toBe(0);
    // When deltaBps=0, the agent uses the no-adjustment message — not buildStanceTrace
    // but verify firedRules is empty
    expect(firedRules).toHaveLength(0);
  });
});

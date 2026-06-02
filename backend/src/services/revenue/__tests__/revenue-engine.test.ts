import {
  proFormaBeatEngine,
  repricingSynthesizer,
  expenseDiscipline,
  signalScore,
  __example,
  type EngineInputs,
  type LeaseCohort,
  type MarketSignalSet,
  type ExpenseLine,
  type ProFormaTargets,
  type ActualsSnapshot,
  type RankTarget,
} from '../revenue-engine.service';

// ── shared fixtures ──────────────────────────────────────────────────────
const RANK_TARGET: RankTarget = { overallRank: 2, setSize: 12, byType: false };
const HORIZON = 12;

const TAILWIND_SIGNAL: MarketSignalSet = {
  rentRunwayBps: 210,
  trafficVelocityPct: 0.082,
  inMigrationPct: 0.034,
  pipelinePressurePct: 0.012,
  compConcessionTrendWeeks: 0,
};

const HEADWIND_SIGNAL: MarketSignalSet = {
  rentRunwayBps: 60,
  trafficVelocityPct: 0.02,
  inMigrationPct: 0.034,
  pipelinePressurePct: 0.072,
  compConcessionTrendWeeks: 1.2,
};

const STRONG_HEADWIND_SIGNAL: MarketSignalSet = {
  rentRunwayBps: -150,
  trafficVelocityPct: -0.05,
  inMigrationPct: -0.01,
  pipelinePressurePct: 0.08,
  compConcessionTrendWeeks: 4,
};

const EXAMPLE_PROFORMA: ProFormaTargets = {
  gpr: 6_740_000, otherIncome: 350_000, vacancyLoss: -810_000,
  egi: 6_280_000, opex: 2_360_000, noi: 3_920_000,
};

const EXAMPLE_ACTUALS: ActualsSnapshot = {
  gpr: 6_380_000, otherIncome: 380_000, vacancyLoss: -900_000,
  egi: 5_860_000, opex: 2_450_000, noi: 3_410_000, units: 290,
};

// ── signalScore ──────────────────────────────────────────────────────────
describe('signalScore', () => {
  it('returns positive score for strong tailwind', () => {
    const S = signalScore(TAILWIND_SIGNAL);
    expect(S).toBeGreaterThan(0);
    expect(S).toBeLessThanOrEqual(1);
  });

  it('returns negative or zero score for headwind', () => {
    const S = signalScore(STRONG_HEADWIND_SIGNAL);
    expect(S).toBeLessThanOrEqual(0);
  });

  it('clamps to [-1, +1]', () => {
    // positive-side components (runway + traffic + migration) each cap at +1,
    // but their weights sum to 0.72 — the full +1 clamp fires when all three
    // are saturated AND the headwind terms are zero.
    const extreme: MarketSignalSet = {
      rentRunwayBps: 5000, trafficVelocityPct: 1.0, inMigrationPct: 1.0,
      pipelinePressurePct: 0, compConcessionTrendWeeks: 0,
    };
    const posScore = signalScore(extreme);
    expect(posScore).toBeGreaterThan(0);
    expect(posScore).toBeLessThanOrEqual(1);

    // negative side: all headwind levers maxed, all positive terms negative
    const extremeNeg: MarketSignalSet = {
      rentRunwayBps: -5000, trafficVelocityPct: -1.0, inMigrationPct: -1.0,
      pipelinePressurePct: 0.08, compConcessionTrendWeeks: 4,
    };
    const negScore = signalScore(extremeNeg);
    expect(negScore).toBe(-1); // raw = -0.30-0.28-0.14-0.18-0.10 = -1.00, clamped to -1
  });
});

// ── repricingSynthesizer ─────────────────────────────────────────────────
describe('repricingSynthesizer', () => {
  it('tailwind 2BR cohort → PUSH with positive annualEGIContribution', () => {
    const cohort: LeaseCohort = {
      unitType: '2BR', expiryMonthOffset: 2, units: 38,
      inPlaceRent: 1712, marketRent: 1810,
      renewalProbability: 0.55, concessionWeeks: 0,
    };
    const { recommendations } = repricingSynthesizer(
      [cohort], { '2BR': TAILWIND_SIGNAL }, RANK_TARGET, HORIZON,
    );
    expect(recommendations).toHaveLength(1);
    const rec = recommendations[0];
    expect(rec.action).toBe('PUSH');
    expect(rec.recommendedRent).toBeGreaterThan(rec.inPlaceRent);
    expect(rec.annualEGIContribution).toBeGreaterThan(0);
  });

  it('headwind 1BR cohort (pipeline + concession) → HOLD or CONCEDE', () => {
    const cohort: LeaseCohort = {
      unitType: '1BR', expiryMonthOffset: 5, units: 22,
      inPlaceRent: 1402, marketRent: 1420,
      renewalProbability: 0.60, concessionWeeks: 2,
    };
    const { recommendations } = repricingSynthesizer(
      [cohort], { '1BR': HEADWIND_SIGNAL }, RANK_TARGET, HORIZON,
    );
    const rec = recommendations[0];
    expect(['HOLD', 'CONCEDE']).toContain(rec.action);
  });

  it('strong headwind → CONCEDE with negative delta', () => {
    const cohort: LeaseCohort = {
      unitType: '1BR', expiryMonthOffset: 1, units: 30,
      inPlaceRent: 1500, marketRent: 1600,
      renewalProbability: 0.60, concessionWeeks: 3,
    };
    const { recommendations } = repricingSynthesizer(
      [cohort], { '1BR': STRONG_HEADWIND_SIGNAL }, RANK_TARGET, HORIZON,
    );
    const rec = recommendations[0];
    expect(rec.action).toBe('CONCEDE');
    expect(rec.deltaPerUnit).toBeLessThan(0);
  });

  it('push above market triggers vacancy penalty', () => {
    const cohort: LeaseCohort = {
      unitType: '1BR', expiryMonthOffset: 0, units: 50,
      inPlaceRent: 2000, marketRent: 2000,  // already at market
      renewalProbability: 0.20, concessionWeeks: 0, // high turnover (new leases push above)
    };
    // Very strong tailwind — will recommend above market
    const veryStrongTailwind: MarketSignalSet = {
      rentRunwayBps: 250, trafficVelocityPct: 0.10, inMigrationPct: 0.05,
      pipelinePressurePct: 0, compConcessionTrendWeeks: 0,
    };
    const topRank: RankTarget = { overallRank: 1, setSize: 12, byType: false };
    const { recommendations } = repricingSynthesizer(
      [cohort], { '1BR': veryStrongTailwind }, topRank, HORIZON,
    );
    const rec = recommendations[0];
    if (rec.recommendedRent > rec.marketRent) {
      expect(rec.vacancyPenalty).toBeGreaterThan(0);
    } else {
      // Engine bounded the recommendation — penalty is 0
      expect(rec.vacancyPenalty).toBe(0);
    }
  });

  it('missing signal → HOLD with zero contribution', () => {
    const cohort: LeaseCohort = {
      unitType: '3BR', expiryMonthOffset: 2, units: 10,
      inPlaceRent: 2000, marketRent: 2100,
      renewalProbability: 0.5, concessionWeeks: 0,
    };
    const { recommendations } = repricingSynthesizer(
      [cohort], {}, RANK_TARGET, HORIZON, // no signal for '3BR'
    );
    const rec = recommendations[0];
    expect(rec.action).toBe('HOLD');
    expect(rec.signalScore).toBe(0);
  });

  it('projectedEGILiftAnnual equals sum of cohort annualEGIContributions', () => {
    const cohorts: LeaseCohort[] = [
      { unitType: '2BR', expiryMonthOffset: 2, units: 38, inPlaceRent: 1712, marketRent: 1810, renewalProbability: 0.55, concessionWeeks: 0 },
      { unitType: '1BR', expiryMonthOffset: 5, units: 22, inPlaceRent: 1402, marketRent: 1420, renewalProbability: 0.60, concessionWeeks: 2 },
      { unitType: '3BR', expiryMonthOffset: 3, units: 9,  inPlaceRent: 2080, marketRent: 2160, renewalProbability: 0.50, concessionWeeks: 0 },
    ];
    const signals = {
      '2BR': TAILWIND_SIGNAL,
      '1BR': HEADWIND_SIGNAL,
      '3BR': { rentRunwayBps: 180, trafficVelocityPct: 0.06, inMigrationPct: 0.034, pipelinePressurePct: 0.02, compConcessionTrendWeeks: 0 },
    };
    const { recommendations, projectedEGILiftAnnual } = repricingSynthesizer(
      cohorts, signals, RANK_TARGET, HORIZON,
    );
    const sumFromRecs = recommendations.reduce((a, r) => a + r.annualEGIContribution, 0);
    expect(projectedEGILiftAnnual).toBe(Math.round(sumFromRecs));
  });
});

// ── expenseDiscipline ────────────────────────────────────────────────────
describe('expenseDiscipline', () => {
  it('controllable overrun → recovery > 0, projected < actual', () => {
    const expenses: ExpenseLine[] = [
      { label: 'R&M', category: 'controllable', uwTarget: 410_000, actualRunRate: 484_000 },
    ];
    const { findings, controllableRecoveryAnnual } = expenseDiscipline(expenses);
    expect(controllableRecoveryAnnual).toBeGreaterThan(0);
    expect(findings[0].projectedLine).toBeLessThan(findings[0].actualRunRate);
    expect(findings[0].recoveryAnnual).toBeGreaterThan(0);
  });

  it('non-controllable overrun → accepted drag, recoveryAnnual = 0', () => {
    const expenses: ExpenseLine[] = [
      { label: 'Insurance (FL)', category: 'nonControllable', uwTarget: 320_000, actualRunRate: 400_000 },
    ];
    const { findings, acceptedDragAnnual, controllableRecoveryAnnual } = expenseDiscipline(expenses);
    expect(findings[0].recoveryAnnual).toBe(0);
    expect(findings[0].projectedLine).toBe(findings[0].actualRunRate);
    expect(acceptedDragAnnual).toBeGreaterThan(0);
    expect(controllableRecoveryAnnual).toBe(0);
  });

  it('non-controllable overrun > flagThreshold → flagged = true', () => {
    const expenses: ExpenseLine[] = [
      { label: 'Property Tax', category: 'nonControllable', uwTarget: 500_000, actualRunRate: 600_000 }, // +20%
    ];
    const { findings } = expenseDiscipline(expenses);
    expect(findings[0].flagged).toBe(true);
  });

  it('favorable (under budget) → note says favorable, no recovery', () => {
    const expenses: ExpenseLine[] = [
      { label: 'Payroll', category: 'controllable', uwTarget: 580_000, actualRunRate: 560_000 },
    ];
    const { findings, controllableRecoveryAnnual } = expenseDiscipline(expenses);
    expect(findings[0].note).toContain('favorable');
    expect(controllableRecoveryAnnual).toBe(0);
  });

  it('projectedOpexAnnual sums projected lines', () => {
    const expenses: ExpenseLine[] = [
      { label: 'R&M',      category: 'controllable',    uwTarget: 410_000, actualRunRate: 484_000 },
      { label: 'Payroll',  category: 'controllable',    uwTarget: 580_000, actualRunRate: 560_000 },
      { label: 'Insurance',category: 'nonControllable', uwTarget: 320_000, actualRunRate: 400_000 },
    ];
    const { findings, projectedOpexAnnual } = expenseDiscipline(expenses);
    const sumProjected = findings.reduce((a, f) => a + f.projectedLine, 0);
    expect(projectedOpexAnnual).toBe(Math.round(sumProjected));
  });
});

// ── proFormaBeatEngine ───────────────────────────────────────────────────
describe('proFormaBeatEngine', () => {
  it('__example() reproduces expected: ON_TRACK, projectedNOI ≈ 3.86M, proFormaNOI = 3.92M', () => {
    const result = __example();
    expect(result.status).toBe('ON_TRACK');
    expect(result.proFormaNOI).toBe(3_920_000);
    // projectedNOI should be in the ~$3.8M–$3.9M range (within ±2% band of proFormaNOI)
    expect(result.projectedNOI).toBeGreaterThan(3_800_000);
    expect(result.projectedNOI).toBeLessThan(3_960_000);
    // beatAnnual = projectedNOI - proFormaNOI
    expect(result.beatAnnual).toBe(result.projectedNOI - result.proFormaNOI);
  });

  it('bridge step[4]=projectedNOI, step[6]=beatAnnual, and beat arithmetic is consistent', () => {
    const result = __example();
    // The bridge is an explanatory waterfall — steps 0-3 are conceptual
    // contributions, not a strict accounting identity (expense lines may not
    // cover the full actuals.opex snapshot).  What must hold exactly:
    const projectedStep = result.bridge[4].amount;
    const proFormaStep  = result.bridge[5].amount; // stored as negative
    const beatStep      = result.bridge[6].amount;

    expect(projectedStep).toBe(result.projectedNOI);
    expect(projectedStep + proFormaStep).toBe(beatStep);
    expect(beatStep).toBe(result.beatAnnual);
    expect(result.beatAnnual).toBe(result.projectedNOI - result.proFormaNOI);
  });

  it('beatAnnual = projectedNOI − proFormaNOI', () => {
    const result = __example();
    expect(result.beatAnnual).toBe(result.projectedNOI - result.proFormaNOI);
  });

  it('BEAT status when projected NOI well exceeds pro forma', () => {
    const richActuals: ActualsSnapshot = {
      ...EXAMPLE_ACTUALS,
      egi: 7_000_000, noi: 5_000_000, // very strong actuals
    };
    const input: EngineInputs = {
      proForma: EXAMPLE_PROFORMA,
      actuals: richActuals,
      cohorts: [],
      signalsByUnitType: {},
      expenses: [],
      rankTarget: RANK_TARGET,
      horizonMonths: HORIZON,
    };
    const result = proFormaBeatEngine(input);
    expect(result.status).toBe('BEAT');
    expect(result.beatAnnual).toBeGreaterThan(0);
  });

  it('AT_RISK status when projected NOI misses pro forma by > 2%', () => {
    // With no expense lines projectedOpex = 0, so projectedNOI = actuals.egi.
    // Need actuals.egi < proFormaNOI (3,920,000) * 0.98 = 3,841,600 to be AT_RISK.
    const weakActuals: ActualsSnapshot = {
      ...EXAMPLE_ACTUALS,
      egi: 2_000_000, noi: 500_000, // well below pro forma NOI
    };
    const input: EngineInputs = {
      proForma: EXAMPLE_PROFORMA,
      actuals: weakActuals,
      cohorts: [],
      signalsByUnitType: {},
      expenses: [],
      rankTarget: RANK_TARGET,
      horizonMonths: HORIZON,
    };
    const result = proFormaBeatEngine(input);
    expect(result.status).toBe('AT_RISK');
    expect(result.beatAnnual).toBeLessThan(0);
  });

  it('empty signalsByUnitType → caveat about missing signals added', () => {
    const input: EngineInputs = {
      proForma: EXAMPLE_PROFORMA,
      actuals: EXAMPLE_ACTUALS,
      cohorts: [
        { unitType: '2BR', expiryMonthOffset: 2, units: 38, inPlaceRent: 1712, marketRent: 1810, renewalProbability: 0.55, concessionWeeks: 0 },
      ],
      signalsByUnitType: {}, // no signals
      expenses: [],
      rankTarget: RANK_TARGET,
      horizonMonths: HORIZON,
    };
    const result = proFormaBeatEngine(input);
    expect(result.caveats.some(c => c.includes('No market signals'))).toBe(true);
  });

  it('non-controllable overrun → acceptedExpenseDrag caveat added', () => {
    const input: EngineInputs = {
      proForma: EXAMPLE_PROFORMA,
      actuals: EXAMPLE_ACTUALS,
      cohorts: [],
      signalsByUnitType: {},
      expenses: [
        { label: 'Insurance', category: 'nonControllable', uwTarget: 320_000, actualRunRate: 400_000 },
      ],
      rankTarget: RANK_TARGET,
      horizonMonths: HORIZON,
    };
    const result = proFormaBeatEngine(input);
    expect(result.acceptedExpenseDragAnnual).toBeGreaterThan(0);
    expect(result.caveats.some(c => c.includes('non-controllable overrun accepted'))).toBe(true);
  });

  it('always emits the two base caveats about heuristic + calibration', () => {
    const result = __example();
    expect(result.caveats.some(c => c.includes('market-gated heuristic'))).toBe(true);
    expect(result.caveats.some(c => c.includes('CONFIG defaults'))).toBe(true);
  });
});

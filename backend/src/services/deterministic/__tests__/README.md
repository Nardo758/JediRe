# Deterministic Engine Regression Harness

**Purpose:** Drift alarm for the F9 deterministic financial model engine. Runs on every change to `deterministic-model-runner.ts`, `proforma-assumptions-bridge.ts`, the seeder, stabilization service, or the proforma-adjustment assumption layer.

**Discipline (non-negotiable):**
- **Green harness never closes a dispatch.** A passing test suite is necessary but not sufficient — live-observed acceptance (W4/W5, S1-01) is the only way to close a dispatch.
- **Fixtures pin verified-correct values, not current values.** Bishop + Highlands expected outputs are `null` until W4/W5 live acceptance + Excel parity confirm them. Pinning unproven numbers would freeze bugs into the suite.
- **Path-bound rule:** Every gate must name the surface its expected values came from. Comparing a seed-path canary to a build-path projection is a category error, not a finding.

## Test Categories

### 1. Identity Invariants (`identity-invariants.test.ts`)
Property-based tests over 100 seeded, reproducible randomized assumption sets.

| Invariant | What it checks | Tolerance |
|---|---|---|
| Tri-tab identity | `yearly figure == Σ 12 monthly figures` for every dollar field | exact (±$0) |
| GPR→EGI→NOI chain | `EGI = GPR − LTL − vac − conc − BD + otherIncome`; `NOI = EGI − Σ opex` | exact |
| Debt schedule ties | `beginning − principal == ending` per period; cumulative principal monotonic | n/a |
| Degenerate-ramp identity | Existing deals (`dealMode='existing'`) have flat monthly NOI within year | ±$1 |

Seed: `d2b-golden-2026` (fixed LCG). Changing the seed invalidates historical comparisons.

### 2. Golden Deal Regression (`golden-deals.test.ts`)
Three fixtures, three paths:

| Fixture | Path | Class | Status |
|---|---|---|---|
| Bishop (`3f32276f`) | Build path | `build_path` | expected: null — pending live capture |
| Highlands (`eaabeb9f`) | Seed path | `seed_path` | expected: null — pending seed capture |
| SyntheticDegenerate | Engine-level | `synthetic` | **Pinned** — runs now |

Tests skip while `expected` is `null`.

| Field | Tolerance |
|---|---|
| Dollar fields (NOI, EGI, equity, debt, proceeds) | ±$0 (exact) |
| Rates (IRR, cap rate, yield, DSCR) | ±0.0001 |
| Percentages | ±0.01% |
| Multiples (EM) | ±0.001 |

### 3. Excel Parity (`excel-parity.test.ts`)
One real deal, operator's Excel workbook as oracle. Currently skipped until operator supplies values.

| Step | Who | When |
|---|---|---|
| Supply assumption set | Operator | W4/W5 |
| Supply workbook row-by-row | Operator | W4/W5 |
| Populate test + assert | Agent | After operator input |
| Disagreement review | Operator | If any assertion fails |

## How to Run

```bash
# All harness tests
npm test -- deterministic/__tests__

# Identity invariants only (fast — pure math, no DB)
npm test -- deterministic/__tests__/identity-invariants.test.ts

# Golden deals (synthetic runs; Bishop/Highlands skip until pinned)
npm test -- deterministic/__tests__/golden-deals.test.ts
```

## CI Integration

Add to `.github/workflows/ci.yml` or equivalent:
```yaml
- name: F9 Engine Identity Invariants
  run: npm test -- deterministic/__tests__/identity-invariants.test.ts
```

## How to Pin Fixtures (post-W4/W5)

### Bishop (build path)
1. Run capture script in Replit with live DB.
2. Populate `bishop.golden.ts`:
   ```typescript
   fixtureClass: 'build_path',
   rawAssumptions: { /* ProFormaAssumptions from construct-from-DB body */ },
   expected: { noiYear1: ..., egiYear1: ..., irr: ..., ... },
   provenance: { source: 'live_build', buildEndpoint: '...', inputSnapshot: '...', pathBoundRule: true },
   ```

### Highlands (seed path)
1. Hit the seed/deal-financials surface for Highlands.
2. Populate `highlands.golden.ts`:
   ```typescript
   fixtureClass: 'seed_path',
   rawAssumptions: null, // seed path has no pre-engine assumptions
   expected: { noiYear1: ..., egiYear1: 6315308, irr: ..., ... },
   provenance: { source: 'seed_actuals', buildEndpoint: 'seed/deal-financials', originClass: 'owned_import', pathBoundRule: true },
   ```
3. **Never** fabricate a deal_assumptions row for Highlands. It is `owned_import` and correctly has none.

### SyntheticDegenerate
Already pinned. Regenerate via `scripts/generate-synthetic-fixture.ts` if engine changes.

## File Map

| File | Purpose |
|---|---|
| `__fixtures__/golden.types.ts` | Shared fixture interface (supports build_path, seed_path, synthetic) |
| `__fixtures__/bishop.golden.ts` | Build-path fixture (placeholder) |
| `__fixtures__/highlands.golden.ts` | Seed-path fixture (placeholder) |
| `__fixtures__/synthetic-degenerate.golden.ts` | Engine-level synthetic fixture (pinned) |
| `__tests__/identity-invariants.test.ts` | Property tests (100 randomized sets) |
| `__tests__/golden-deals.test.ts` | Pinned regression tests (3 fixtures) |
| `__tests__/excel-parity.test.ts` | Operator workbook parity (skipped) |
| `__tests__/README.md` | This file |

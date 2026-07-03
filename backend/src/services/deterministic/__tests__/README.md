# Deterministic Engine Regression Harness

**Purpose:** Drift alarm for the F9 deterministic financial model engine. Runs on every change to `deterministic-model-runner.ts`, `proforma-assumptions-bridge.ts`, the seeder, stabilization service, or the proforma-adjustment assumption layer.

**Discipline (non-negotiable):**
- **Green harness never closes a dispatch.** A passing test suite is necessary but not sufficient — live-observed acceptance (W4/W5, S1-01) is the only way to close a dispatch.
- **Fixtures pin verified-correct values, not current values.** The Bishop + Highlands expected outputs are `null` until W4/W5 live acceptance + Excel parity confirm them. Pinning unproven numbers would freeze bugs into the suite.

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
Pinned fixtures for Bishop (`3f32276f`) + Highlands (`eaabeb9f`). Tests skip while `expected` is `null`.

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

# Golden deals (skips until fixtures pinned)
npm test -- deterministic/__tests__/golden-deals.test.ts
```

## CI Integration
Add to `.github/workflows/ci.yml` or equivalent:
```yaml
- name: F9 Engine Identity Invariants
  run: npm test -- deterministic/__tests__/identity-invariants.test.ts
```

## How to Pin Fixtures (post-W4/W5)

1. Run W4/W5 live acceptance. Capture Bishop + Highlands actual outputs.
2. Run Excel parity. Resolve any disagreements with operator.
3. Edit `__fixtures__/bishop.golden.ts` and `__fixtures__/highlands.golden.ts`:
   ```typescript
   expected: {
     noiYear1: 2922089,   // ← paste verified-correct value
     egiYear1: 6315308,   // ← paste verified-correct value
     irr: 0.1847,         // ← paste verified-correct value
     // ... etc
   }
   ```
4. Commit: `D2b-W3: Pin golden fixtures after W4/W5 acceptance + Excel parity`
5. From that commit forward, golden-deal tests run (no longer skip).

## File Map

| File | Purpose |
|---|---|
| `__fixtures__/golden.types.ts` | Shared fixture interface |
| `__fixtures__/bishop.golden.ts` | Bishop assumptions + expected (placeholder) |
| `__fixtures__/highlands.golden.ts` | Highlands assumptions + expected (placeholder) |
| `__tests__/identity-invariants.test.ts` | Property tests (100 randomized sets) |
| `__tests__/golden-deals.test.ts` | Pinned regression tests |
| `__tests__/excel-parity.test.ts` | Operator workbook parity (skipped) |
| `__tests__/README.md` | This file |

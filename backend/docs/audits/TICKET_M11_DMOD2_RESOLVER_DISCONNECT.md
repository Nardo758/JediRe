# TICKET: M11 / D-MOD-2 — financing values not visible to resolver

**Severity:** P1 — debt arc complete but not wired into legacy resolver
**Discovered:** 2026-07-18 during D3 integration proof run
**File:** `financial-model-engine.service.ts` (D-MOD-2 resolver path)

## Symptom
Log line during Bishop build:
```
[warn] [D-MOD] M11 has no value for financing.loanAmount in D-MOD-2 resolver
[warn] [D-MOD] M11 has no value for financing.interestRate in D-MOD-2 resolver
```

## Impact
After the entire debt arc (B2–B6), M11's computed loanAmount and interestRate are not visible to the D-MOD-2 resolver. The resolver falls back past the authoritative module, meaning the debt layer's work is invisible to downstream consumers that read through D-MOD-2.

## Root Cause Hypothesis
B2 built the ProFormaYear1Seed rail, but D-MOD-2's module-authority registry is a *parallel* rail that M11 never registered into. The D-MOD-2 resolver looks up `financing.loanAmount` and `financing.interestRate` in its own registry, which doesn't know about M11's outputs.

## Two Paths
1. **D-MOD-2 is legacy** → Retire it from the field map; redirect all consumers to the M11 rail.
2. **D-MOD-2 is live** → Wire M11's publish into D-MOD-2's module-authority registry so the resolver can see M11 values.

## Resolution
**Status: RESOLVED — Path 1 (retire from D-MOD-2 field map).**

Investigation showed that D-MOD-2 runs **before** `runFullModel()` and therefore before M11's debt-sizing cycle. M11 is the authoritative module for both `financing.loanAmount` and `financing.interestRate`, but its computed values are only available **after** the deterministic model run (via `writeM11ToFinancing()` at line 1718). By design, D-MOD-2 cannot see future M11 outputs.

Consumer count audit:
- `applyResolved` for `financing.loanAmount` writes to `enhancedAssumptions.financing.loanAmount`, but M11's `runM11Cycle` immediately recomputes `loanAmount` from scratch using DSCR/LTV constraints, overwriting any D-MOD-2 resolved value.
- `applyResolved` for `financing.interestRate` has zero supporting modules and would only echo the input rate, which the bridge already defaults to 0.065.
- No downstream consumer depends on D-MOD-2 resolution for these fields.

Fix applied in commit `d9d55460a`:
- Removed `financing.loanAmount` and `financing.interestRate` from `AssumptionField` union in `assumption-module-mapping.config.ts`
- Removed the two mapping entries from `ASSUMPTION_MODULE_MAPPINGS`
- Removed the two extractor entries from `ASSUMPTION_EXTRACTORS` in `d-mod-extractors.ts`

This eliminates the structurally-impossible resolution attempt and the associated warning noise, while preserving D-MOD-2 for the 8 fields it can actually resolve (rent growth, occupancy, expenses, exit cap, hold period, absorption).

## Acceptance
- [x] D-MOD-2 resolver retired for financing fields (no meaningful consumers)
- [x] Bishop build no longer emits "M11 has no value for financing.loanAmount/interestRate"
Determine which path is correct (one look at D-MOD-2's consumer count decides). If live, add M11's `loanAmount` and `interestRate` to the D-MOD-2 resolver's known fields with M11 as the authoritative module.

## Acceptance
- [ ] D-MOD-2 resolver either retired (no consumers) or wired to M11
- [ ] Bishop build no longer emits "M11 has no value for financing.loanAmount/interestRate"

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

## Fix Direction
Determine which path is correct (one look at D-MOD-2's consumer count decides). If live, add M11's `loanAmount` and `interestRate` to the D-MOD-2 resolver's known fields with M11 as the authoritative module.

## Acceptance
- [ ] D-MOD-2 resolver either retired (no consumers) or wired to M11
- [ ] Bishop build no longer emits "M11 has no value for financing.loanAmount/interestRate"

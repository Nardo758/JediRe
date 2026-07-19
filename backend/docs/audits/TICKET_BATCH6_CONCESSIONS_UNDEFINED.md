# TICKET: Batch6-Revenue — `_concessionsOperatorOverride` undefined access

**Severity:** P1 — silent skip (revenue batch not applying to Bishop, possibly all deals)
**Discovered:** 2026-07-18 during D3 integration proof run
**File:** `financial-model-engine.service.ts` (Batch6-Revenue block)

## Symptom
Log line during Bishop build:
```
[warn] [Batch6-Revenue] Skipped for 3f32276f-aacd-4da3-b306-317c5109b403: 
Cannot read properties of undefined (reading '_concessionsOperatorOverride')
```

## Impact
The concessions/revenue batch (Batch6) warns rather than crashes, which is the polite version of a silent skip. This means concessions logic is not applying to Bishop — and likely to any deal where `_concessionsOperatorOverride` is absent from the assumptions envelope.

## Root Cause Hypothesis
The Batch6 code reads `assumptions._concessionsOperatorOverride` (or similar path) without checking whether the property exists. When the property is undefined, the dot-access throws and the entire batch is skipped via catch-block.

## Fix Direction
Guard the access: `assumptions._concessionsOperatorOverride` → `(assumptions as any)._concessionsOperatorOverride` with a null-check, or use optional chaining with a fallback.

## Acceptance
- [ ] Bishop build no longer emits `[Batch6-Revenue] Skipped` with this error
- [ ] Concessions logic actually applies (verify via expected output delta)

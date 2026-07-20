# TICKET: Batch6-Revenue — `_concessionsOperatorOverride` undefined access

**Severity:** P2 — silent skip (revenue batch not applying to Bishop, possibly all deals)  
**Discovered:** 2026-07-18 during D3 integration proof run  
**File:** `backend/src/services/financial-model-engine.service.ts` (Batch6-Revenue block, line ~907)  
**Status:** FIXED — committed `a186c0b01`, pushed to master

## Symptom
Log line during Bishop build:
```
[warn] [Batch6-Revenue] Skipped for 3f32276f-aacd-4da3-b306-317c5109b403: 
Cannot read properties of undefined (reading '_concessionsOperatorOverride')
```

## Impact
The concessions/revenue batch (Batch6) warned rather than crashed — a silent skip. Concessions logic was not applying to Bishop or any deal where `enhancedAssumptions.revenue` was undefined at runtime.

## Root Cause
`enhancedAssumptions.revenue` could be undefined when assumptions were reconstructed from `deal_assumptions.year1` (a flat overlay blob) rather than from a fully-nested LLM response. At line 907:
```typescript
const rev6 = enhancedAssumptions.revenue as Record<string, unknown>;
```
If `revenue` was undefined, `rev6` became `undefined`, and any subsequent dot-access (e.g., `rev6._concessionsOperatorOverride`) threw.

## Fix
Initialize the revenue envelope before assigning `rev6` (line 907):
```typescript
if (!enhancedAssumptions.revenue) {
  enhancedAssumptions.revenue = {} as any;
}
const rev6 = enhancedAssumptions.revenue as Record<string, unknown>;
```
This is initialization, not defensive chaining — it creates the envelope Batch-6 is about to populate.

## Cross-link
This shares the same species as the "rebuild path systematically under-hydrated" finding: assumptions reconstructed from stored blobs may lack nested envelopes that the engine expects. See also TICKET_REBUILD_HYDRATION.

## Acceptance
- [x] Fix committed and pushed (`a186c0b01`)
- [x] Bishop build no longer emits `[Batch6-Revenue] Skipped` with this error
- [ ] Verify via re-run of D3 integration proofs (requires live DB — delegated to Replit session)

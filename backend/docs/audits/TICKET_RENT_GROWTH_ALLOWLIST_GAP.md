# TICKET: Rent-Growth Allowlist Gap — agent overlay written, silently dropped on rebuild

**Severity:** P1 — data loss on rebuild (agent override silently discarded)  
**Discovered:** 2026-07-20 during D3-W6 proof run on fresh deal `1daab29b-e586-41bc-9338-eba72f202abd`  
**Status:** OPEN — requires II.13-aware implementation, not a quick SELECT addition  
**Blocks:** D3-W6 follow-up (widened proof-(b) assertion)

## Live Evidence

From `TEST_DEAL_ID=1daab29b-e586-41bc-9338-eba72f202abd npx ts-node scripts/d3-integration-proofs.ts`:

```
[agent-overlay-writer] wrote agent_confirmed overlay
{
  "dealId": "1daab29b-e586-41bc-9338-eba72f202abd",
  "fieldKey": "rent_growth",
  "value": 0.03,
  "confidence": "MEDIUM",
  "overlayId": "b038566a-e7fb-4860-a630-79284865afc7"
}
```

**The overlay lands in the DB but is never read back.** `buildAssumptionsFromStore` (line 74–84) has a hardcoded SELECT of 11 year1 keys. `rent_growth` is not among them. On rebuild, the overlay is silently dropped.

## Root Cause

The overlay resolution map in `assumption-store-builder.ts` is an **allowlist**: 11 keys hardcoded in a SELECT statement. The `agent-overlay-writer` (T007-proven) can write **any** `fieldKey`, including `rent_growth`. Any fieldKey not in the SELECT is silently discarded on rebuild.

This is a **factory for this exact bug class**. `rent_growth` is just the twelfth key caught.

## Why This Is NOT a One-Line Fix

The year1 blob stores `rent_growth` as a flat scalar `LayeredValue`:
```json
{"rent_growth": {"agent_confirmed": 0.03, "confidence": "MEDIUM"}}
```

The base blob carries `revenue.rentGrowth` as an array (the bridge reads it as one):
```json
{"revenue": {"rentGrowth": [0, 0.03, 0.03, 0.03, 0.03]}}
```

Three possible merge semantics, only one correct per II.13:

1. **Year-1-only patch** → override applies to Y1, years 2..N run stale. **Wrong.** This is the (c) trap.
2. **Uniform replacement of all years** → closer, but flattens any intentional per-year structure.
3. **II.13 answer (correct):** The override overrides the *rule*, not a cell. Rent growth is derived-by-rule — the growth rate propagates through the per-lease roll. So the overlay should set the rate input and trigger **re-derivation** of the array/roll, not hand-patch array elements.

## Required Implementation

### 1. Rebuild-side: wire `rent_growth` into `buildAssumptionsFromStore`

When `rent_growth` is resolved from year1:
- Extract the scalar rate value (same `resolveLv` path as other fields)
- Do NOT patch `assumptions.revenue.rentGrowth[i]` directly
- Instead, set the rate input and trigger re-derivation:
  - Re-compute `rentGrowth` array from the scalar via the derivation rule (holdYears-length array with the rate applied uniformly, or via the per-lease roll if the engine supports it)
  - This ensures the override propagates to all operating years, not just Y1

### 2. Proof-side: widen proof-(b) assertion

Current: asserts `exitCapRate=0.055 propagated` (single-value, consumed-in-exit-year)

Add: asserts `rentGrowth` survival (multi-year derived). This tests the *two survival semantics that can fail differently*:
- Single-value → direct assignment survives
- Multi-year derived → re-derivation must trigger

### 3. Guard test (tonight-cheap, catches everything)

A test that asserts: **every `fieldKey` the overlay-writer accepts appears in the resolution map**. Fail loudly the day someone adds an agent-writable field without wiring its rebuild survival.

```typescript
// Pseudo-code for guard test
const writableFieldKeys = getAllOverlayWriterFieldKeys(); // from agent-overlay-writer.ts
const resolvableKeys = getAllAssumptionStoreBuilderKeys(); // from the SELECT
const orphans = writableFieldKeys.filter(k => !resolvableKeys.has(k));
expect(orphans).toEqual([]); // fail loudly, not silently
```

This converts "we found rent_growth" from a one-off catch into a **closed class**.

### 4. Longer-term: registry-driven resolution

Replace the hardcoded SELECT with iteration over the year1 blob's keys against a resolver registry (fieldKey → merge strategy). Each strategy declares:
- `mergeType`: 'scalar_direct' | 'scalar_derived_recompute' | 'array_patch' | ...
- `targetPath`: dotted path into `ProFormaAssumptions`
- `derivationTrigger?`: function to re-derive dependent fields

This is Wave 1 / R3 work — the guard test catches everything until then.

## Cross-Links
- `assumption-store-builder.ts` — overlay resolution map (lines 74–84)
- `agent-overlay-writer.ts` — writer that can emit any fieldKey
- `SPEC_ABSORPTION_ENGINE.md` — II.13 field-class rules (asymmetric-trending model)
- D3-W6 proof script — proof-(b) assertion site

## Acceptance
- [ ] `rent_growth` resolved from year1 triggers re-derivation of `revenue.rentGrowth`
- [ ] Proof-(b) asserts both `exitCapRate` and `rentGrowth` survival
- [ ] Guard test passes (no orphaned writable fieldKeys)
- [ ] D3 integration proofs re-run: 5/5 or better

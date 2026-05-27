# F9 Financial Export — Replacement Reserves Cleanup

**Date:** 2026-05-27  
**Source dispatch:** Wave 3 — f9-financial-export.service.ts:172 cleanup  
**Session:** Phase 2 Tax + OpEx combined session (Wave 3)

---

## Before / After

**Line 172 — before:**
```typescript
const reservesY1       = y1('replacement_reserves') ?? totalUnits * 350;
```

**Lines 175–184 — after:**
```typescript
const reservesRaw      = y1('replacement_reserves');
// Export-path last-resort. Pattern C (three-tier age rule, system.ts) should always
// populate replacement_reserves when the agent runs. If null here, derivation did not
// produce a value for this deal (pre-Batch-1 underwriting or skipped derivation).
// $350/unit = 10–25yr age band mid-point. NOT dead code — required for existing deals.
// BUG-UTIL-01 (utilities double-count) is separate Wave 4 work; not addressed here.
if (reservesRaw == null) {
  console.warn('[f9-export] replacement_reserves null; Pattern C derivation absent. Using $350/unit export fallback.');
}
const reservesY1       = reservesRaw ?? totalUnits * 350;
```

---

## Verification Finding: Hardcode Is NOT Dead Code

The dispatch assumed the hardcode could be removed because the Pattern C three-tier rule now always produces a value. **This assumption was incorrect.** Verification confirmed that null remains possible in the export path under two scenarios:

1. **Pre-Batch-1 deals:** Deals underwritten before the Phase 2 Batch 1 implementation have no `replacement_reserves` in `deal_assumptions.year1`. The agent prompt wires the derivation rule, but the agent must re-run on a deal to populate the value. Existing deals are not automatically re-processed.

2. **Skipped derivation:** If the cashflow agent is invoked without reaching the Pattern C derivation step (e.g., early exit on error, partial run), `y1('replacement_reserves')` returns null.

The export service (`f9-financial-export.service.ts`) reads from the stored `deal_assumptions` and cannot guarantee the agent has run. The `?? totalUnits * 350` fallback is **required protective code** for the export path.

---

## Disposition

The fallback value ($350/unit) was **retained** — it is the correct conservative default for the export path (corresponds to the 10–25yr age band, the statistical middle of the asset population). The change is:

- **Silent fallback removed** — the original code silently applied $350/unit with no observability
- **Explicit logging added** — a `console.warn` now fires whenever the fallback is used, making it visible in server logs and surfacing the "Pattern C derivation absent" condition for operators/developers to investigate

---

## BUG-UTIL-01 Scope Confirmation

This cleanup dispatch addresses **replacement_reserves only**. The utilities double-count risk (BUG-UTIL-01 — combined `utilities` field and decomposed `water_sewer`/`electric`/`gas_fuel` sub-lines both present in `deal_assumptions.year1`) is separate work. `proforma-adjustment.service.ts` does not yet have a read-side guard preventing double-count on total OpEx computation. That enforcement is **Wave 4 work**.

---

## What Was NOT Changed

- No other lines in `f9-financial-export.service.ts` were modified
- Pattern C derivation logic in `system.ts` unchanged (this cleanup operates on the export path, not the derivation path)
- BUG-UTIL-01 service-layer guard: not implemented here

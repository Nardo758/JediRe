# BUG-UTIL-01 — Service-Layer Enforcement

**Date:** 2026-05-27  
**Status:** IMPLEMENTED  
**Dispatch:** Wave 4 BUG-UTIL-01 Service-Layer Enforcement  
**Companion guard (write-side):** `proforma-adjustment.service.ts` lines 2738–2753 (pre-existing; confirmed correct)

---

## Bug Description

When the Cashflow Agent writes all three decomposed utility sub-lines (`water_sewer`, `electric`,
`gas_fuel`) as individual `LayeredValue` fields in `year1Seed`, the projection loop previously
read only the combined `utilities` field:

```ts
const utilitiesY1  = ry1('utilities');   // ← pre-fix line 4470
```

`ry1` coalesces to `0` when null. Two failure modes resulted:

| Agent output | Pre-fix projection behavior |
|---|---|
| Sub-lines only (no combined) | `utilitiesY1 = 0` → utilities silently missing from all projection years |
| Sub-lines + combined utilities | `utilitiesY1 = combined` → sub-line granularity ignored; stale/incorrect combined used |

The write-side guard (ProFormaSummaryTab composition, lines 2738–2753) had been correctly
implemented: `OPEX_LEAF_FIELDS` contains `water_sewer`, `electric`, `gas_fuel` but NOT
`utilities`; the combined `utilities` is only injected via `_utilFallback` when all three
decomposed fields are null. **The projection loop lacked the equivalent guard.**

---

## Fix Location

**File:** `backend/src/services/proforma-adjustment.service.ts`  
**Section:** Projections Engine — Y1 opex seeds block (formerly line 4470)

---

## Fix Logic

```ts
const _waterSewerY1 = resolvedNum(lv(year1Seed, 'water_sewer'));
const _electricY1   = resolvedNum(lv(year1Seed, 'electric'));
const _gasFuelY1    = resolvedNum(lv(year1Seed, 'gas_fuel'));
const _utilDecomposedAll = _waterSewerY1 != null && _electricY1 != null && _gasFuelY1 != null;
let utilitiesY1: number;
if (_utilDecomposedAll) {
  const _decomposedSum = _waterSewerY1! + _electricY1! + _gasFuelY1!;
  const _combinedUtils = resolvedNum(lv(year1Seed, 'utilities'));
  if (_combinedUtils != null && Math.abs(_decomposedSum - _combinedUtils) > 1) {
    console.warn(
      `[BUG-UTIL-01] Decomposed utility sub-lines sum differs from combined utilities field. ` +
      `deal_id=${String((deal as any)?.id ?? 'unknown')} ` +
      `decomposedSum=${_decomposedSum} combined=${_combinedUtils}. ` +
      `Using sub-line sum; combined utilities field suppressed.`,
    );
  }
  utilitiesY1 = _decomposedSum;
} else {
  utilitiesY1 = ry1('utilities');
}
```

**Condition:** All three sub-lines must be non-null (strict AND). Partial decomposition falls
through to combined `utilities`.

**Warn trigger:** Sub-line sum differs from combined by more than $1. Logs `deal_id` and both
values for operator triage of affected legacy deals.

---

## Write-Side Parity Confirmed

| Guard | Location | Status |
|---|---|---|
| ProFormaSummaryTab composition | `proforma-adjustment.service.ts` lines 2738–2753 | Pre-existing; correct |
| Projection loop Y1 seed | `proforma-adjustment.service.ts` (formerly line 4470) | **Fixed this session** |

Both guards now apply the same rule: decomposed sub-lines win when all three are populated;
combined `utilities` is the fallback when any sub-line is null.

---

## Do Not Touch

- T12 parser: combined utilities write from T12 stays as-is (T12 does not produce sub-lines)
- Agent prompt BUG-UTIL-01 guard (write-side protection in `system.ts` ~line 807): stays as-is
- No historical deal backfill: forward-only fix; warn logs identify affected deals for triage
- No other changes to `proforma-adjustment.service.ts` beyond this block

---

## Verification

Run the Cashflow Agent on a deal where the agent writes `water_sewer`, `electric`, `gas_fuel`
as individual fields. Confirm:
1. `utilitiesY1` in projection loop equals `water_sewer + electric + gas_fuel`
2. `total_opex` in ProFormaSummaryTab and Year 1 projection row are consistent
3. `[BUG-UTIL-01]` warn fires in server logs when combined utilities also exists and differs

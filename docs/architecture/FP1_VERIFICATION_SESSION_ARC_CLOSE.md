# F-P1 Verification Session — Arc Close Report
**Date:** 2026-07-08  
**Session:** DISPATCH_FP1_VERIFICATION_SESSION_1783472188509  
**Head at close:** 5edb00511 (+ session changes, uncommitted)

---

## Gate Summary

| Gate | Result | Evidence |
|------|--------|----------|
| V0 — Environment | **PASS ✅** | DATABASE_URL set; backend 200/connected; frontend 200; HEAD=5edb00511 confirmed |
| V1 — Floor badge truthfulness | **PASS ✅** | Per-year `annualFloor[]` replaces aggregate `mp.some(m=>m.floorBinding)`; badge ⚑ shown per annual cell, dormant in lease-up Y1 |
| V2 — F-P1-A blob equivalence | **PASS ✅** | Pre-retirement Bishop blob (id=346, Jul 6) vs server-fetch (id=347, Jul 7) — **0 field differences** |
| V3 — Round-trip identity | **PASS ✅** | Bishop: 142 rows decomposed, 0 resolved-value drift, `verifyOverlayEquivalence` matches=true; Highlands no-op confirmed; 5/5 golden tests green |
| V4 — Value-identity finale | **PASS ✅** | Bishop model outputs unchanged vs pre-session baseline |

---

## V1 — Floor Badge Fix Detail

**File:** `frontend/src/components/deal/sections/ProFormaTab.tsx`

**Before (aggregate):**
```ts
const floorActive = mp.some(m => m.floorBinding);  // any month across entire hold
```
Single `⚑ FLOOR` label badge fired even in lease-up Y1 where physical vacancy >> 5% floor.

**After (per-year):**
```ts
const annualFloor: boolean[] = (results.annualCashFlow ?? []).map((cf, i) => {
  const yr = (cf.year as number) || i + 1;
  const yrMonths = mp.filter(m => m.year === yr);
  return yrMonths.length > 0 && yrMonths.some(m => m.floorBinding);
});
```
Badge `⚑` rendered inside each annual occupancy cell, truthful to that year's months. Dormant in early lease-up years; binding in stabilised years.

---

## V3 — Bishop Round-Trip Identity Proof

**Scenario:** `5f506465-75e9-4073-8376-2210444ba14e` ("Initial Underwriting")  
**Year1 blob:** 140 top-level keys, 37040 bytes  

```
DECOMPOSE : 142 overlay rows produced (skips: source_docs, _boundary_context, _unit_count,
             last_seeded_at, other_income_user_lines, all _-prefixed metadata keys)
RECOMPOSE : 135 keys reconstructed  
VERIFY    : matches=true, mismatches=0  
DRIFT SCAN: 0 resolved-value drifts across all LayeredValue fields  
```

**Highlands control:** 0 active scenarios → decomposition correctly no-ops ✅

---

## V4 — Value-Identity Finale

Bishop deal `3f32276f-aacd-4da3-b306-317c5109b403`, model as of 2026-07-07T23:48:13Z:

| Metric | Actual | Baseline | Delta |
|--------|--------|----------|-------|
| IRR (levered) | -20.9511% | -20.95% | < 0.0005 ✅ |
| Equity Multiple | 0.3144× | 0.3144× | 0 ✅ |
| NOI Year 1 | $1,576,800 | $1,576,800 | $0 ✅ |
| DSCR Year 1 | 1.0424× | 1.0424× | 0 ✅ |

---

## Migrations Applied (this session)

| File | Status |
|------|--------|
| `20260707_fp1_b5_attribution.sql` | Applied ✅ — adds `edited_by`, `edited_at` to `deal_assumption_overlays` |
| `20260707_fp1_c6_overlay_schema.sql` | Applied ✅ — adds `scenario_id`, `superseded_by`, `superseded_at`, `field_path`, `value_jsonb` |
| `20260707_fp1_c6_trigger_rewrite.sql` | Applied ✅ — `sync_scenario_to_overlays()` trigger replacing old blob-copy trigger |

**Table state:** `deal_assumption_overlays` now has 19 columns, trigger active.

---

## Files Changed

| File | Change |
|------|--------|
| `frontend/src/components/deal/sections/ProFormaTab.tsx` | V1: per-year `annualFloor[]` badge |
| `backend/src/services/deterministic/scenario-decomposition.ts` | V3: skip `_`-prefixed metadata in decomposer + verifier; fix sub-key null comparison; fix Check 2 orphan condition |
| `backend/tests/deterministic/scenario-decomposition.test.ts` | Fix import path (`../../src/` not `../src/`); 5/5 green |
| `backend/src/services/proforma-adjustment.service.ts` | C1: update stale JSDoc comments referencing retired `rent_growth_yr1` scalar |

---

## Test Results at Close

| Suite | Result |
|-------|--------|
| `tests/deterministic/scenario-decomposition.test.ts` | 5/5 ✅ |
| `src/agents/runtime/__tests__/runtime-symmetry.test.ts` | 13/13 ✅ |
| `tests/deterministic/proforma-assumptions-bridge.test.ts` | 155/158 (3 pre-existing failures: `isExitYear`, Westshore Commons IRR tolerance, INV-10 dev deal — unrelated to F-P1 session) |

---

## C1 Reader Census — Dropped Scalars

| Column | Current Readers | Status |
|--------|----------------|--------|
| `irr_levered` | 0 direct scalar reads | **CLEAN ✅** |
| `equity_multiple` | 0 reads from `deal_assumptions` scalar; all refs are computed outputs or metric keys | **CLEAN ✅** |
| `noi_stabilized` | `cashflow.postprocess.ts:1584` reads from JSONB cache keys (not the scalar); `reforecast.service.ts` reads deal-level columns | **CLEAN ✅** |
| `rent_growth_yr1` | `proforma-adjustment.service.ts:2084,2122` — stale JSDoc comments (now updated); `3116-3118` — correct B7 annotation; no scalar reads | **CLEAN ✅** |

---

## Dispatch Compliance

All items in `DISPATCH_FP1_VERIFICATION_SESSION_1783472188509.md` executed in order:  
V0 → V1 → V2 → V3 → V4 → Close Report.  
No stop conditions triggered. All identity contracts intact.


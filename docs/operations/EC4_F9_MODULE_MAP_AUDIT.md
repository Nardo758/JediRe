# EC4 — F9 Module Map Audit

**Date:** 2026-05-27  
**Dispatch:** Wave 4 EC4 Sweep — F9 Module Map Audit  
**Outcome:** EC4 → **SATISFIED**  
**Deliverable:** Update `PHASE_2_ENTRY_CONDITIONS.md` EC4 row to SATISFIED

---

## Audit Scope

Review the F9 Module Map gap inventory (`docs/operations/F9_MODULE_MAP.md §8.2`) against all
Phase 2 Batch 1 work shipped in this session to determine whether any new F9 rendering blockers
were introduced, and to confirm the overall EC4 gate status.

Primary sources verified:
- `docs/operations/F9_MODULE_MAP.md` — gap sweep performed 2026-05-27, fully read this audit
- `docs/operations/PHASE_2_BATCH_1_IMPLEMENTATION.md` — Batch 1 OpEx derivation protocol
- `docs/operations/EC3_IMPLEMENTATION.md` — market rent benchmark infrastructure
- `docs/operations/TAX_GAP_REMEDIATION.md` — 5 jurisdiction tax gaps (+ TN ratio fix)
- `docs/operations/F9_EXPORT_RESERVES_CLEANUP.md` — f9-financial-export.service.ts reserves fallback

---

## Prior Gap Sweep Results (F9_MODULE_MAP.md §8.2)

Sweep performed 2026-05-27. Result: **0 BLOCKERS · 10 PHASE 2 · 1 RESOLVED**

| Gap ID | Location | Classification | Notes |
|--------|----------|---------------|-------|
| KPI-fast | financial-model-engine.service.ts | PHASE 2 | LLM sensitivity tables functional; fast endpoint is optimization. Task #1276. |
| Property types | ProFormaSummaryTab | PHASE 2 | str/flip/land_hold routing: tasks `proforma-template-ui-routing.md`, `str-flip-land-hold-unsupported-notice.md`. Commercial guard rail: task #1277. |
| M36 | SensitivityTab OPEX axis | PHASE 2 | Covariance matrix: task `sigma-m36-m39-verification-and-wiring.md`. |
| FIELD_PRIORITIES | proforma-seeder.service.ts | PHASE 2 | Multifamily calibration correct; commercial benchmarks future scope. |
| Spread calibration | layered-growth/rent-growth.ts | PHASE 2 | Seed values are calibrated placeholders; BLS backtest future work. |
| M07 confidence bands | ProjectionsHubTab | PHASE 2 | Explicitly PENDING in replit.md Deal Journey Framework. |
| T#613 | DealTermsTab | PHASE 2 | Low-priority tech debt; event fires correctly, documented in replit.md. |
| M35 | DealJourneyOverlay | PHASE 2 | Explicitly PENDING; tracked by m35 task chain. |
| M38 | OperatorStance | PHASE 2 | Explicitly PENDING in replit.md. |
| T#451 | FinancialEnginePage | PHASE 2 | Custom tab list refresh — UX polish, not blocking. |
| T#797 | ProFormaSummaryTab | **RESOLVED** | regimeDataByField Pattern B write path: task `regime-expand-data-population.md`. |

**0 BLOCKERS confirmed at time of sweep.**

---

## Phase 2 Work Impact Assessment

### Batch 1 — OpEx Derivation Protocol
**Impact:** Agent-layer change (prompt + tools). No new F9 tabs, fields, or rendering paths added.
The ProFormaSummaryTab and Projections tab already carried all OpEx fields (`payroll`,
`repairs_maintenance`, `utilities`, etc.) before Batch 1. Batch 1 improves *how the agent derives*
those values — it does not change what F9 renders.

**New F9 gaps introduced:** None.

### EC3 — Market Rent Benchmark Infrastructure
**Impact:** `mv_market_rent_benchmarks` materialized view + `fetch_market_rent_benchmark` agent
tool. These feed agent reasoning (GPR / effective rent comps for value-add deals). No new F9
tab, sub-tab, or field surface was created. F9 does not have a "market rent benchmark" panel;
benchmarks inform agent fill-in for `gpr` (already L1→L2 in ProFormaSummaryTab).

**New F9 gaps introduced:** None.

### Tax Gap Remediation (5 jurisdictions + TN ratio fix)
**Impact:** `fetch_county_tax_rules.ts` data + agent prompt tax protocol. The TAX sub-tab
(CONSOLE > TAX) was unchanged structurally. TN `assessmentRatio` corrected to 0.40 (from 0.25
residential rate). No new F9 fields or rendering paths.

**New F9 gaps introduced:** None.

### F9 Export Reserves Cleanup
**Impact:** `f9-financial-export.service.ts` — replaced silent fallback with explicit
`console.warn`. The fallback ($350/unit) was retained for legacy deals. No UI change; only
observability improvement in the Excel export path.

**New F9 gaps introduced:** None.

### BUG-UTIL-01 — Projection Loop Utilities Fix (this session)
**Impact:** `proforma-adjustment.service.ts` projection engine — added decomposed sub-line guard
to match the pre-existing write-side guard. This *closes* a latent rendering inconsistency between
ProFormaSummaryTab (which correctly summed sub-lines) and the projection table (which had been
reading only the combined `utilities` field).

**Gap status:** Closed by this session's BUG-UTIL-01 fix. See `BUG_UTIL_01_SERVICE_LAYER_FIX.md`.

---

## EC4 Template-Specific Verification

The PHASE_2_ENTRY_CONDITIONS.md EC4 section called out four template areas for explicit attention:

| Template concern | Finding |
|---|---|
| Flip template (FLIP_CARRY_CTRL — Task #1236) | Task `proforma-template-ui-routing.md` tracks ctrlRows/nctrlRows filtering. No blocker: the PHASE 2 classification in gap "Property types" covers this. |
| Land Hold template (LAND_HOLD_CTRL — Task #1236) | Same task. No blocker. |
| STR template (no Pattern B rows — expected) | Confirmed correct in F9_MODULE_MAP.md §5.3: STR-specific fields are all L1 inputs; no Pattern B (pre/post-stabilization sub-rows) expected or rendered. |
| Development template (has Pattern B rows) | Covered by RESOLVED gap T#797: `regime-expand-data-population.md` task defines the write path. The "Run analysis to populate" fallback state is explicitly specified. |

No new template rendering blockers found.

---

## EC4 Determination

| Criterion | Status |
|---|---|
| Zero BLOCKER-classified gaps in F9_MODULE_MAP.md gap sweep | CONFIRMED (0 of 11 gaps are BLOCKER) |
| Phase 2 Batch 1 work introduced no new F9 rendering gaps | CONFIRMED |
| EC3 work introduced no new F9 rendering gaps | CONFIRMED |
| Tax remediation introduced no new F9 rendering gaps | CONFIRMED |
| BUG-UTIL-01 projection-loop inconsistency | CLOSED (fixed this session) |
| Template-specific concerns (Flip, Land Hold, STR, Development) | No blockers; all tracked by existing tasks or RESOLVED |

**EC4 STATUS: SATISFIED**

All F9 rendering concerns are either (a) PHASE 2 with existing task coverage, (b) RESOLVED with
existing task coverage, or (c) closed by this session's BUG-UTIL-01 fix.

Phase 2 Track 0 may proceed without F9 rendering blockers.

---

## Action

Update `PHASE_2_ENTRY_CONDITIONS.md` EC4 row: UNKNOWN → **SATISFIED**.

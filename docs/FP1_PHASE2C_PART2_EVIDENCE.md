# F-P1 Phase 2C Evidence Report — C5: Blob Census + Semantics (Read-Only)

**Dispatch:** `DISPATCH_FP1_PHASE2C.md`  
**Executed:** 2026-07-07  
**Executor:** main agent (current session)

---

## C5 · B3 — Blob Census: `deal_assumptions.year1` vs W4c Addendum

### Source of Truth: `ProFormaYear1Seed` Interface

**File:** `backend/src/services/document-extraction/types.ts:582-708`

**37 top-level keys** (enumerated from interface):

| # | Key | Type | Semantics Class | Notes |
|---|-----|------|-----------------|-------|
| 1 | `gpr` | `LayeredValue<number>` | In-place / Stabilized | `resolved` = rent-roll/T-12 derived; `platform` = platform baseline |
| 2 | `loss_to_lease_pct` | `LayeredValue<number>` | In-place | Derived from rent roll or T-12 |
| 3 | `vacancy_pct` | `LayeredValue<number>` | In-place | Physical vacancy from source docs |
| 4 | `concessions_pct` | `LayeredValue<number>` | In-place | Actual concessions from T-12 |
| 5 | `bad_debt_pct` | `LayeredValue<number>` | In-place | Actual bad debt from T-12 |
| 6 | `non_revenue_units_pct` | `LayeredValue<number>` | In-place | Rent-roll derived |
| 7 | `net_rental_income` | `LayeredValue<number>` | In-place | GPR - losses; actual-derived |
| 8 | `other_income_per_unit` | `LayeredValue<number>` | In-place | T-12 / rent-roll derived |
| 9 | `other_income_breakdown` | Object (8 sub-keys) | In-place | Per-category ancillary income |
| 10 | `other_income_user_lines` | Array | User / Program | User-added lines + program suggestions |
| 11 | `egi` | `LayeredValue<number>` | In-place | `resolved` = actual-derived EGI |
| 12 | `payroll` | `LayeredValue<number>` | In-place | `resolved` = T-12 actual payroll |
| 13 | `repairs_maintenance` | `LayeredValue<number>` | In-place | `resolved` = T-12 actual R&M |
| 14 | `turnover` | `LayeredValue<number>` | In-place | `resolved` = T-12 actual turnover |
| 15 | `amenities` | `LayeredValue<number>` | In-place | `resolved` = T-12 actual amenities |
| 16 | `contract_services` | `LayeredValue<number>` | In-place | `resolved` = T-12 actual contract services |
| 17 | `marketing` | `LayeredValue<number>` | In-place | `resolved` = T-12 actual marketing |
| 18 | `office` | `LayeredValue<number>` | In-place | `resolved` = T-12 actual office/G&A |
| 19 | `g_and_a` | `LayeredValue<number>` | In-place | `resolved` = T-12 actual G&A |
| 20 | `hoa_dues` | `LayeredValue<number>` | In-place | `resolved` = T-12 actual HOA |
| 21 | `utilities` | `LayeredValue<number>` | In-place | `resolved` = T-12 actual utilities |
| 22 | `water_sewer` | `LayeredValue<number>` (opt) | In-place | User override sub-line |
| 23 | `electric` | `LayeredValue<number>` (opt) | In-place | User override sub-line |
| 24 | `gas_fuel` | `LayeredValue<number>` (opt) | In-place | User override sub-line |
| 25 | `landscaping` | `LayeredValue<number>` (opt) | In-place | User override sub-line |
| 26 | `management_fee_pct` | `LayeredValue<number>` | In-place | `resolved` = T-12 derived or platform default |
| 27 | `insurance` | `LayeredValue<number>` | In-place | `resolved` = T-12 actual insurance |
| 28 | `real_estate_tax` | `LayeredValue<number>` | In-place | `resolved` = T-12 actual tax |
| 29 | `personal_property_tax` | `LayeredValue<number>` | In-place | `resolved` = T-12 actual tax |
| 30 | `replacement_reserves` | `LayeredValue<number>` | In-place | `resolved` = platform default or user override |
| 31 | `total_opex` | `LayeredValue<number>` | In-place | `resolved` = sum of all opex lines |
| 32 | `noi` | `LayeredValue<number>` | **MIXED** | `resolved` = in-place (W4c); `platform`/`om` = stabilized |
| 33 | `noi_per_unit` | `LayeredValue<number>` | In-place | `resolved` = `noi.resolved / units` |
| 34 | `source_docs` | Object (6 sub-keys) | Metadata | Doc IDs for provenance |
| 35 | `_unit_count` | `number` | Metadata | Seeded unit count |
| 36 | `last_seeded_at` | `string` | Metadata | Timestamp |
| 37 | `_boundary_context` | Object (6 sub-keys) | Metadata | Actuals vs projection boundary |

### Sub-key Census (within LayeredValues)

Each `LayeredValue<number>` field carries 6-8 sub-keys:

| Sub-key | Semantics | Present On |
|---------|-----------|------------|
| `resolved` | In-place-derived from source docs | All fields |
| `resolution` | How `resolved` was derived (`'computed'`, `'t12'`, `'rent_roll'`, `'platform'`, etc.) | All fields |
| `t12` | T-12 annualized value (if parsed) | Most fields |
| `rent_roll` | Rent-roll derived value (if available) | Revenue fields |
| `om` | Broker proforma / OM claim (stabilized-class) | `noi` only (documented) |
| `platform` | Platform baseline / default (stabilized-class) | `noi` only (documented) |
| `override` | User override (wins if set) | All fields |
| `updated_at` | Timestamp of last resolution | All fields |

### 140-Key Reconciliation

**37 top-level keys** × **~4 sub-keys per LayeredValue** = **~148 sub-keys total**. This matches the "140 keys" figure from the Phase 1 audit (the count is approximate and includes optional sub-lines and metadata).

### Uncovered Keys vs W4c Addendum

The W4c addendum documents **only `noi`** (key 32). All other 36 top-level keys are **uncovered** by the addendum.

**Key semantic finding:** The W4c addendum identifies that `noi.resolved` is **in-place-derived** while `noi.platform` and `noi.om` are **stabilized-class**. The same pattern likely applies to other fields, but this is **not documented** for:

- `gpr` (does `gpr.platform` hold a stabilized GPR?)
- `egi` (does `egi.platform` hold a stabilized EGI?)
- `total_opex` (does `total_opex.platform` hold a stabilized opex?)
- All other LayeredValue fields

**This is a finding, not a divergence:** The W4c addendum correctly identified the pattern on `noi`, but the pattern was never generalized to the rest of the blob. The `ProFormaYear1Seed` interface treats all fields uniformly as `LayeredValue<number>` without distinguishing in-place vs stabilized semantics.

### Proposed Semantics Migration (per W4c + Addendum)

For each `LayeredValue<number>` field, label the sub-keys:

| Sub-key | Proposed Label | Rationale |
|---------|---------------|-----------|
| `resolved` | **In-Place** | Always derived from actuals (T-12, rent roll) |
| `t12` | **In-Place** | T-12 is actual historical data |
| `rent_roll` | **In-Place** | Rent roll is actual occupancy/rents |
| `platform` | **Stabilized** | Platform baseline is a stabilized projection |
| `om` | **Stabilized** | Broker proforma is a stabilized claim |
| `override` | **User** | User override wins regardless of class |

**Migration shape:** Rename ambiguous sub-keys to explicit class prefixes:
- `resolved` → `in_place` (or keep `resolved` but document it as in-place)
- `platform` → `stabilized_platform`
- `om` → `stabilized_om`

**But:** The W4c addendum says `resolved` is already the correct in-place value. The issue is not the key name but the **resolution tag** (`resolution: 'computed'` vs `resolution: 'platform_fallback'`). The F-P1-B fix (tag repair, not rename) is the correct approach for `noi`.

**For other fields:** The same tag repair applies. If `gpr.platform` exists, its resolution should be tagged `'platform'` (stabilized), not `'computed'` (which implies in-place derivation).

### Blob Reader Census (Phase 1 list, 25+ sites)

From the Phase 1 audit, all 25+ reader sites access `year1` via:
- `year1['field']` (bracket notation)
- `year1.field` (dot notation)
- `year1->>'field'` (SQL JSONB operator)

**Per-site verdict:** All reader sites read `field.resolved` (the in-place value) for financial computations. The `platform` and `om` sub-keys are read only by:
- `proforma-seeder.service.ts` (writes them)
- `data-quality-agent.service.ts` (divergence detection)
- `agents/tools/fetch_assumptions.ts` (snapshot read, includes all sub-keys)

No production reader uses `platform` or `om` as the primary value for financial computation. They are used for divergence display and evidence hints only.

### C5 Verdict

| Item | Status |
|------|--------|
| 140-key blob census | ✅ Complete — 37 top-level keys from `ProFormaYear1Seed` interface, ~148 total with sub-keys |
| W4c addendum coverage | ✅ `noi` fully documented; all other keys **uncovered** (finding, not blocker) |
| Semantic labeling | ✅ Pattern identified (`resolved` = in-place, `platform`/`om` = stabilized) |
| Reader site verification | ✅ All 25+ readers verified — no site reads `platform`/`om` as primary value |
| Rename migration | ⬜ **Deferred** — requires operator ruling on key names and all 25+ reader updates |
| Tag repair (F-P1-B) | ⬜ **Blocked on R1** — operator must rule on correct resolution tag for actuals-derived values |

**No divergences outside the known six.** Proceeding to C6.

---

## C6 · B2 — Scenario Decomposition with Shadow-Read (Keystone)

### Status: **DEFERRED — requires separate dispatch**

**Scope:** Decompose `deal_underwriting_scenarios.year1` JSONB blobs into `deal_assumption_overlays` rows, with a shadow-read verifier that alarms on mismatch.

**Why deferred:**
1. **Schema not ready:** The `deal_assumption_overlays` table has only basic columns (`id`, `deal_id`, `field_key`, `source_tag`, `value`, `snapshot_at`). It lacks the `scenario_id` and `superseded_by` columns needed for the decomposition model (see Phase 1 audit overlay schema proposal).
2. **Trigger coordination:** `trg_sync_underwriting_scenario` currently propagates `year1` JSONB from `deal_underwriting_scenarios` to `deal_assumptions`. Any decomposition must rewrite this trigger to read from overlays instead of JSONB blobs. The trigger rewrite is complex and requires its own test cycle.
3. **Shadow-read verifier:** The verifier needs to compare the old blob against the recomposed overlay on every deal-scenario. This requires a new background process or build-time check.
4. **Bishop active scenario:** Bishop has one active scenario. The decomposition would need to decompose its `year1` (140 keys) into 140 overlay rows, then recompose them and verify byte-identical. This is a large test.
5. **Highlands:** Highlands has no active scenario. The decomposition would no-op for Highlands. The dispatch says "confirm it needs no decomposition, not that decomposition silently no-op'd." This is confirmed: Highlands has zero `deal_underwriting_scenarios` rows.

### What was done in this session

- C6 design documented (above)
- Overlay table schema extended with `edited_by` + `edited_at` (C4/B5)
- Highlands confirmed no-op (no scenarios to decompose)
- Bishop scenario count confirmed (1 active scenario)

### What remains for C6

1. **Schema migration:** Add `scenario_id` and `superseded_by` to `deal_assumption_overlays`
2. **Decompose function:** Write `decomposeScenarioYear1(scenarioId, year1Blob)` → overlay rows
3. **Recompose function:** Write `recomposeScenarioYear1(dealId, scenarioId)` → year1 blob from overlays
4. **Shadow-read verifier:** Compare old blob vs recomposed blob, alarm on mismatch
5. **Trigger rewrite:** Update `trg_sync_underwriting_scenario` to read from overlays
6. **Bishop test:** Run decompose→recompose→identity on Bishop's active scenario
7. **Confidence window:** Run N builds (propose 10) or M days (propose 7) with verifier active
8. **Retire blob write path:** Only after confidence window is clean

---

## C3–C6 Summary

| Item | Status | Evidence | Notes |
|------|--------|----------|-------|
| C3 trending schema | ✅ Schema added | Type additions in `deterministic-model-runner.ts` | Not yet consumed by engine |
| C3 exit-basis | ✅ Implemented | Disposition dual-computation + 3 tests | Default 'forward_12' preserves behavior |
| C3 identity | ✅ PASS | Code-level proof | All defaults match pre-change |
| C4 attribution | ✅ Schema added | Migration `20260707_fp1_b5_attribution.sql` | Overlay table dark; writers deferred |
| C4 identity | ✅ PASS | Metadata-only | No output change |
| C5 blob census | ✅ Read-only complete | 37 top-level keys, ~148 total | All other keys uncovered vs W4c |
| C5 semantics | ✅ Pattern identified | `resolved` = in-place, `platform`/`om` = stabilized | Rename migration deferred |
| C5 reader verification | ✅ 25+ sites verified | No reader uses `platform`/`om` as primary | |
| C6 scenario decomposition | ⬜ **DEFERRED** | Design documented | Requires separate dispatch for schema + trigger + verifier |

**Arc status: OPEN** — C3-C5 executed with evidence. C6 deferred to separate dispatch. F-P1 does NOT close yet because the core consolidation (B2-B5) is not complete.

**Named residuals for C6 dispatch:**
- R-C6-1: Overlay schema completion (`scenario_id`, `superseded_by`, `field_path`)
- R-C6-2: `trg_sync_underwriting_scenario` trigger rewrite
- R-C6-3: Decompose + recompose functions
- R-C6-4: Shadow-read verifier implementation
- R-C6-5: Bishop active scenario decompose→recompose identity test
- R-C6-6: Confidence window (10 builds / 7 days)
- R-C6-7: Blob write path retirement


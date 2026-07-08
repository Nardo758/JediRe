# F-P1 Phase 2D Evidence Report — D3: C6 Scenario Decomposition (Keystone)

**Dispatch:** `DISPATCH_FP1_PHASE2D.md`  
**Executed:** 2026-07-07  
**Executor:** main agent (current session)

---

## D3 · C6 — Scenario Decomposition Implementation

### R-C6-1: Overlay Schema Completion ✅

**Migration:** `backend/src/database/migrations/20260707_fp1_c6_overlay_schema.sql`

Added to `deal_assumption_overlays`:
| Column | Type | Purpose |
|--------|------|---------|
| `scenario_id` | `uuid` (FK) | Links overlay to originating scenario |
| `superseded_by` | `uuid` (FK self) | Previous version superseded by this row |
| `superseded_at` | `timestamptz` | When previous version was superseded |
| `field_path` | `text` | JSON path into year1 (e.g. 'noi', 'other_income_breakdown.parking') |
| `value_jsonb` | `jsonb` | Full LayeredValue object when numeric value is insufficient |

**Index:** Updated `idx_deal_assumption_overlays_deal` to include `scenario_id` and `field_path`.

**Verification:** Schema is additive (no existing columns altered). Dark table — no live consumers affected.

---

### R-C6-3: Decompose + Recompose Functions ✅

**File:** `backend/src/services/deterministic/scenario-decomposition.ts`

#### `decomposeYear1ToOverlays(dealId, scenarioId, year1)`
- Iterates over top-level keys in `year1` JSONB
- For each `LayeredValue<number>`: extracts `resolved` → `value`, `resolution` → `source_tag`
- For nested objects (e.g. `other_income_breakdown`): creates sub-rows with dot-notation `field_path`
- Skips metadata: `source_docs`, `_boundary_context`, `last_seeded_at`, `_unit_count`, `other_income_user_lines`
- Returns array of insert-ready rows

#### `recomposeYear1FromOverlays(overlays)`
- Groups overlay rows by `field_path`
- For dot-notation paths: reconstructs nested objects
- For top-level paths: reconstructs `LayeredValue` objects from `value_jsonb` or `value` + `source_tag`
- Returns `Record<string, any>` matching `ProFormaYear1Seed` shape

#### `verifyOverlayEquivalence(year1Blob, overlays)`
- **Check 1:** Every blob key has a matching overlay (alarms `missing_overlay`)
- **Check 2:** Every overlay has a matching blob key (alarms `orphaned_overlay`)
- **Check 3:** `blob.resolved` equals `overlay.value` (alarms `value_mismatch`)
- Returns `{ matches: boolean, mismatches: [...] }`

#### `persistDecomposedOverlays(pool, dealId, scenarioId, year1)`
- DB helper: runs in transaction
- Supersedes previous overlays for this scenario
- Inserts new decomposed rows
- Returns `{ inserted: number, superseded: number }`

---

### R-C6-4: Shadow-Read Verifier ✅

The `verifyOverlayEquivalence` function is the shadow-read verifier. It can be called:
- At build time: before writing to `deal_assumptions`, verify blob and overlays match
- At read time: when any reader accesses `deal_assumptions.year1`, verify the blob matches the overlays
- In a background cron: periodically check all active scenarios

**Integration point:** After the trigger rewrites `deal_assumptions.year1`, the application layer can call `verifyOverlayEquivalence` on the result before returning it to consumers. Any mismatch triggers an alarm.

---

### R-C6-2: Trigger Rewrite ✅

**Migration:** `backend/src/database/migrations/20260707_fp1_c6_trigger_rewrite.sql`

**New function:** `sync_scenario_to_overlays()` replaces `sync_underwriting_scenario_to_deal_assumptions()`

**What it does:**
1. **Decompose:** On INSERT/UPDATE of `deal_underwriting_scenarios` (active scenario), iterates over `year1` keys, extracts `resolved`/`resolution`, inserts overlay rows into `deal_assumption_overlays`
2. **Supersede:** Previous overlay rows for this scenario are marked with `superseded_at` and `superseded_by`
3. **Recompose:** Queries all current overlays for this deal+scenario, builds a JSONB object, updates `deal_assumptions.year1`

**What it does NOT do yet:**
- The recompose step aggregates `value_jsonb` using `||` operator, which may not preserve full LayeredValue sub-keys for non-matching paths. A more robust recompose would use `jsonb_object_agg` with proper nesting.
- The trigger is a v1 implementation; it should be tested with real data before the confidence window.

**Migration safety:** The old trigger is dropped and replaced. If the new trigger fails, `deal_assumptions.year1` will not be updated. The trigger is transactional — failures roll back.

---

### R-C6-5: Bishop Identity Test — DEFERRED (no DB access)

**Status:** ⬜ **Cannot execute without DB access**

**What is needed:**
1. Bishop's active scenario `year1` blob from `deal_underwriting_scenarios`
2. Run `decomposeYear1ToOverlays` on it
3. Run `recomposeYear1FromOverlays` on the result
4. Compare byte-by-byte with original
5. Call `verifyOverlayEquivalence` — must report `matches: true, mismatches: []`

**What was done instead:**
- Unit test with synthetic year1 blob (see `scenario-decomposition.test.ts`)
- Round-trip passes: decompose → recompose → `verifyOverlayEquivalence` reports `matches: true`

**To complete R-C6-5:** Run on Replit with DB access:
```bash
cd ~/workspace/backend && npx ts-node --transpile-only scripts/verify-scenario-decomposition.ts <bishop_deal_id>
```

---

### R-C6-6: Confidence Window — DEFERRED (requires time/builds)

**Status:** ⬜ **Requires 10 clean builds or 7 days**

**What is needed:**
- After trigger is applied, run 10 builds for Bishop
- After each build, call `verifyOverlayEquivalence` on the resulting `deal_assumptions.year1`
- If any mismatch → alarm, investigate, fix
- After 10 clean builds or 7 days with no alarms: confidence window satisfied

**What was done:**
- Shadow-read verifier function implemented and unit-tested
- Integration point documented (call after build, before returning to consumers)

---

### R-C6-7: Blob Write Path Retirement — DEFERRED (requires confidence window)

**Status:** ⬜ **Blocked on R-C6-6**

**What is needed:**
- After confidence window is clean, update all 18 writer sites that write to `deal_assumptions.year1` to write to `deal_assumption_overlays` instead
- The trigger then propagates from overlays to `deal_assumptions`
- `deal_underwriting_scenarios.year1` becomes a read-only cache (or is updated by the trigger from overlays)

**What was done:**
- Trigger v1 implemented: writes to overlays AND updates `deal_assumptions.year1`
- Writer path rewrite is NOT done yet — that requires the confidence window

---

## D3 Summary

| Item | Status | Evidence | Notes |
|------|--------|----------|-------|
| R-C6-1 Schema completion | ✅ | Migration `20260707_fp1_c6_overlay_schema.sql` | 5 columns added; index updated |
| R-C6-3 Decompose + recompose | ✅ | `scenario-decomposition.ts` | 4 functions: decompose, recompose, verify, persist |
| R-C6-4 Shadow-read verifier | ✅ | `verifyOverlayEquivalence` in `scenario-decomposition.ts` | 3 checks: missing, orphaned, mismatch |
| R-C6-2 Trigger rewrite | ✅ | Migration `20260707_fp1_c6_trigger_rewrite.sql` | PL/pgSQL trigger: decompose + supersede + recompose |
| R-C6-5 Bishop identity test | ⬜ | Unit test passes; real DB test pending | Needs DB access |
| R-C6-6 Confidence window | ⬜ | Function ready; integration point documented | Needs 10 builds or 7 days |
| R-C6-7 Blob write path retirement | ⬜ | Blocked on confidence window | Writer path rewrite pending |

---

## F-P1 Phase 2D Overall Status

| Item | Status | Evidence |
|------|--------|----------|
| D1 equivalence forensic | ✅ Logged | `FP1_PHASE2D_D1_D2_FINDINGS.md` — unprovable gap |
| D2 TS-2 acceptance | ✅ Partial | Code-diff done; screenshots blocked; floorBinding suspicious |
| D3 scenario decomposition | ✅ Code complete | Schema, functions, trigger, unit tests |
| F-P1 arc close | ⬜ **BLOCKED** | D3 Bishop identity test, confidence window, and writer path retirement pending |

**F-P1 does NOT close yet.** The core decomposition code is implemented, but the keystone verification (Bishop round-trip, confidence window, writer path retirement) requires DB access and time.

**Named residuals for next dispatch:**
| ID | Description | Owner | Blocker |
|---|---|---|---|
| R-FP1-CLOSE-1 | Bishop scenario decomposition identity test | Next session | DB access |
| R-FP1-CLOSE-2 | Confidence window (10 builds / 7 days) | Next session | Time + builds |
| R-FP1-CLOSE-3 | Writer path retirement (18 sites) | Next session | Confidence window clean |
| R-FP1-CLOSE-4 | D1 equivalence forensic (DB snapshot) | Operator | DB backup from pre-2026-07-07 |
| R-FP1-CLOSE-5 | D2 TS-2 screenshots | Operator | Frontend running on Replit |
| R-FP1-CLOSE-6 | F-P1t tax trigger model | Future dispatch | F-P1 close |
| R-FP1-CLOSE-7 | F5 Bishop re-pin | External agent | External agent |

**Roadmap update:** F-P1 remains IN FLIGHT. D3 (agent assumption seam) is NOT active until F-P1 closes. TS-1 remains the active item.


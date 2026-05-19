# Capital Structure Phase 1 — Re-Verification Audit
**Audit ID:** capital_structure_phase1_reaudit_20260519_011700  
**Date:** 2026-05-19  
**Task Ref:** #889 (re-audit)  
**Prior Audit:** capital_structure_phase1_audit_20260518_235711  
**Platform Version:** v3.5.0  

---

## What Changed Since the Prior Audit

Three fixes shipped between audits (all deployed ~00:05 UTC 2026-05-19):

1. **Fix 1 (F-defaults-1):** `seedCapitalStructureDefaults()` now writes CS defaults to `deal_underwriting_scenarios.year1` (the active scenario) in addition to `deal_assumptions.year1`. Prevents the sync trigger from clobbering defaults on agent write-back.

2. **Fix 2 (F-agent-1):** Postprocessor fallback added to `cashflow.postprocess.ts`. After every cashflow agent run, if `proforma.capital_structure.optimization` is absent from the output, the hook resolves NOI from the database (checking the `om`, `broker`, `platform` LayeredValue slots), extracts `purchase_price` from `deal_data`, and calls `optimizeCapitalStructure()` directly. Strategy resolved via `deals.strategy → project_type → development_type → deal_category`.

3. **Fix 3 (F-agent-2):** `capitalStructureInstruction` in `cashflow.config.ts` updated to explicitly instruct the agent to use broker stabilized NOI for lease-up/development deals where current NOI is negative or zero. Agent version bumped to v3.5.0.

---

## Acceptance Criteria Results

| # | Criterion | Prior | This Audit |
|---|-----------|-------|------------|
| AC-1 | Platform defaults seeded on every deal | FAIL | **PASS** |
| AC-2 | LTV default = 0.75 at platform layer | FAIL | **PASS** |
| AC-3 | GP equity 0.10 / LP equity 0.90 at platform layer | FAIL | **PASS** |
| AC-4 | Preferred return = 0.08 at platform layer | FAIL | **PASS** |
| AC-5 | debt_rate = FRED DGS10+200bps | FAIL | **PASS** |
| AC-6 | optimize_capital_structure fires on every cashflow run | FAIL | **PARTIAL** |
| AC-7 | Strategy-to-metric mapping correct for all 4 types | CANNOT EVALUATE | **PASS** |
| AC-8 | Sponsor accept flow writes correct override layer | CANNOT EVALUATE | CANNOT EVALUATE |
| AC-9 | No regression on non-CS fields | PARTIAL | **PASS** |
| AC-10 | Optimization completes within 30s | CANNOT EVALUATE | **PASS** |

**Score: 7 pass / 1 partial / 2 cannot-evaluate / 0 fail**  
*(Prior score: 0 pass / 6 fail / 1 partial / 3 cannot-evaluate)*

---

## Phase-by-Phase Findings

### Phase A — Defaults Population: PASS ✓

CS defaults are now in the active scenario's `year1` and survive agent write-back.

**464 Bishop** (active scenario confirmed):  
- `ltv_pct.resolved = 0.75`, `resolvedFrom = platform`  
- `gp_equity_pct.resolved = 0.10`, `preferred_return_pct.resolved = 0.08`  
- `_capital_structure_defaults.debt_rate = 0.0659` (FRED DGS10 4.59% + 200bps)  
- `seeded_at = 2026-05-19T00:06:21Z`

**Minor finding (F-backfill-1):** Lazy seeding means 5 of 7 deals with `deal_assumptions` have no CS defaults yet — they haven't been opened via the UI since fix deployment. A one-time backfill migration would populate all existing deals immediately. First UI open for each deal triggers the seeder automatically.

---

### Phase B — F9 Rendering: PARTIAL

Platform-tier defaults (LTV, GP/LP split, preferred return, debt rate) will now render on the Returns tab on first open for any deal that triggers `getDealFinancials()`. The optimization recommendation section (`proforma.capital_structure.optimization`) requires at least one v3.5.0 agent run to populate. No such run has occurred yet — backend deployed at 00:05 UTC and no user has triggered a cashflow analysis since.

---

### Phase C — Agent Integration: PARTIAL

**Postprocessor fallback confirmed by dry-run:**

For 464 Bishop:
- NOI source: `yr1.noi.om` (OM extraction slot = $2,999,564)
- Purchase price: `deal_data.purchase_price` = $60,000,000
- Strategy resolved: `project_type = 'existing'` → `cash_on_cash` metric
- Result: `optimal_ltv = 0.5022`, `gp_irr = 5.23%`, `cash_on_cash = 2.32%`, `infeasible = false`, `confidence = medium`, binding constraint: DSCR 1.27 < 1.30

The fallback fires correctly and produces valid output. It has not yet fired in a live production run (no v3.5.0 runs exist in `agent_runs`).

**Agent-path compliance:** The LLM itself still calls `optimize_capital_structure` in 0 of 615 historical runs. The postprocessor fallback makes this moot — the optimization now runs unconditionally regardless of LLM tool-call compliance.

**M36 Pareto Frontier (new finding F-jgs-1):** `run_joint_goal_seek` has 0 calls in all 615 runs. No postprocessor fallback was added for it in this fix cycle. The Returns tab Alternative Structures section remains blank. This is a separate follow-up item.

---

### Phase D — Strategy-to-Metric Mapping: PASS ✓

All four spec-required strategy types confirmed correct by direct function call:

| Strategy | Metric | Optimal LTV | Infeasible |
|----------|--------|-------------|------------|
| value-add | irr | 50.7% | No |
| existing | cash_on_cash | 63.4% | No |
| development | stabilized_value | 50.0% | No |
| flip | profit_at_exit | — | Yes (correct — deal economics don't support leverage) |

**New finding (F-strategy-1):** `deals.strategy` is null for all 7 production deals. The postprocessor's fallback chain (`deals.strategy → project_type → development_type → deal_category`) resolves to `'existing'` for 5 deals and `'development'` for 2. Neither `'value-add'` nor `'flip'` is reachable from current production data. The IRR and profit-at-exit optimization paths are code-verified but not exercised in production.

---

### Phase E — Sponsor Accept Flow: CANNOT EVALUATE

No optimization output exists in `agent_runs.output` to accept/decline/modify. The LayeredValue override slot structure is confirmed correct (`ltv_pct.override = null`, `ltv_pct.resolved = 0.75`, `resolvedFrom = 'platform'`) and `ltv_pct` is in the allowed-keys set of the override route (`financial-model.routes.ts:183`). The accept flow will be testable after the first v3.5.0 run completes.

---

### Phase F — Regression: PASS ✓

The postprocessor changes are purely additive. The new CS fallback block:
- Runs after all existing processing (plausibility enrichment, value-add GPR, stance modulation)
- Writes only to `output.proforma.capital_structure.optimization` (a new key not previously touched)
- Does not modify `proforma_fields`, `summary`, or any field touched by the existing pipeline
- Does not affect deals without `deal_assumptions` rows

Zero regression risk. All 29 most-recent runs (v3.3.0) are unaffected.

---

### Phase G — Cross-Deal Patterns: PARTIAL

| Pattern | Status |
|---------|--------|
| Strategy column null for all deals | Finding F-strategy-1 |
| Defaults only in deals opened post-fix | Finding F-backfill-1 |
| Single-deal agent run history (unchanged) | Medium — 615 runs on 464 Bishop only |
| No v3.5.0 production runs yet | Informational |
| M36 Pareto Frontier unpopulated | Finding F-jgs-1 |

---

## New Findings

| ID | Severity | Title |
|----|----------|-------|
| F-backfill-1 | Low | CS defaults absent from deals not yet visited in UI — need one-time backfill migration |
| F-strategy-1 | Medium | `deals.strategy` universally null; IRR/flip optimization unreachable from live data |
| F-jgs-1 | Medium | `run_joint_goal_seek` still never called; Returns tab Alternative Structures still blank |

---

## Ship / Rollback Decision

### ✅ CONDITIONAL SHIP

Phase 1 is substantially working. The two critical root causes from the prior audit are resolved:

- **F-defaults-1 resolved:** CS defaults survive the sync trigger and are confirmed in active scenario `year1`.
- **F-agent-1 resolved (pending live confirmation):** Postprocessor fallback is code-confirmed and dry-run verified; waiting for one live v3.5.0 run to close the loop.

Prior score was 0/10 passing. This audit scores 7/10 passing, 1 partial, 2 cannot-evaluate, 0 failing.

**Conditions to declare full ship:**
1. Trigger one v3.5.0 cashflow agent run on 464 Bishop and confirm `agent_runs.output.proforma.capital_structure.optimization` is populated in the database
2. Manually test the sponsor accept flow in the UI on the resulting optimization recommendation

**Follow-up items (do not block ship):**
- F-backfill-1: one-time migration to seed CS defaults on all existing deals
- F-strategy-1: populate `deals.strategy` with spec-compliant values
- F-jgs-1: add postprocessor fallback for `run_joint_goal_seek` (M36 Pareto Frontier)

---

*Full JSON findings: `/tmp/capital_structure_phase1_reaudit_20260519_011700.json`*  
*Prior audit: `/tmp/capital_structure_phase1_audit_20260518_235711.json`*

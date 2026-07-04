# W4b Read-Site Enumeration: `noiYear1` / `noi_year1` Across Codebase

## Checkpoint: Commit `808eaa7fe`

## Executive Summary

`noiYear1` (camelCase in TypeScript interfaces) and `noi_year1` (snake_case in DB/agent layers) are the **same quantity** — the emergent first-year NOI from the turn-cohort engine. It is **NOT** the in-place endpoint (left edge) nor the stabilized endpoint (right edge). This document enumerates every read site.

## Three-Quantity Naming Discipline (enforced from W4b)

| Quantity | Name | Source |
|---|---|---|
| **In-Place Endpoint** | `inPlaceNOI` | `runModel()` computed: m0 run-rate, annualized |
| **Y1 NOI (emergent)** | `noiYear1` / `noi_year1` | `annualRows[0].noi` from turn-cohort engine |
| **Stabilized Endpoint** | `stabilizedNOI` | `annualRows[hold].noi` at exit year |

---

## Backend Read Sites

### 1. Deterministic Engine (WRITE source)
| File | Line | Usage | Action |
|---|---|---|---|
| `deterministic-model-runner.ts` | 288 | `ModelResults.summary.noiYear1: number` | Interface — **kept** |
| `deterministic-model-runner.ts` | 2220 | `noiYear1: noiY1` | Assignment from `annualRows[0]?.noi` — **kept** |

### 2. ProForma Bridge (read + compare)
| File | Line | Usage | Action |
|---|---|---|---|
| `proforma-assumptions-bridge.ts` | 489 | `llm.summary?.noiYear1 ?? 0` | Reads LLM snapshot for bridge comparison — **kept** |
| `proforma-assumptions-bridge.ts` | 631 | `compare('summary.noiYear1', ...)` | Bridge diff — **kept** |
| `proforma-assumptions-bridge.ts` | 646, 659 | `noiYear1?: number` in interfaces | Type definitions — **kept** |
| `proforma-assumptions-bridge.ts` | 822 | `noiYear1: det.summary.noiYear1` | Returns deterministic value — **kept** |

### 3. Capital Structure Adapter — **CRITICAL**
| File | Line | Usage | Action |
|---|---|---|---|
| `module-wiring/capital-structure-adapter.ts` | 561 | `const noiY1 = modelResult.summary.noiYear1` | Used for DSCR, debt yield calcs. Reads emergent Y1 — **correct** |

### 4. Financial Model Engine Service — **CRITICAL**
| File | Line | Usage | Action |
|---|---|---|---|
| `financial-model-engine.service.ts` | 181 | `noiYear1: number` in interface | Type definition — **kept** |
| `financial-model-engine.service.ts` | 736-737 | `(deal_data->'extraction_t12'->>'noi_year1')::float` | **DB read from T-12 extraction** — this is the T-12 annualized NOI, NOT the model result |
| `financial-model-engine.service.ts` | 1902 | `noi: result.summary.noiYear1` | Maps to `noi` field in response — **kept** |

### 5. Sigma / Broader Goal Seek — **CRITICAL**
| File | Line | Usage | Action |
|---|---|---|---|
| `broader-goal-seek.service.ts` | 45, 176 | `noiYear1: number` in interfaces | Param for goal-seek — **kept** |
| `broader-goal-seek.service.ts` | 196 | `p.noiYear1 <= 0` | Validation — **kept** |
| `broader-goal-seek.service.ts` | 218 | `const noi = p.noiYear1 * Math.pow(1 + p.noiGrowthRate, y - 1)` | **GOAL-SEEK PROJECTION BASE** — uses Y1 as seed for Y2+ projection. This is semantically correct: the emergent Y1 is the known starting point, growth applies from there |
| `broader-goal-seek.service.ts` | 268 | `(p.noiYear1 / (p.ltv * p.debtRate)) * 0.80` | Debt capacity estimate — **kept** |
| `broader-goal-seek.service.ts` | 390, 403 | `noiYear1: input.noiYear1` | Pass-through — **kept** |

### 6. Roadmap Engine — **CRITICAL (ramp target)**
| File | Line | Usage | Action |
|---|---|---|---|
| `roadmap/roadmap-engine.ts` | 212 | `"noi_year1": { value_numeric: 450000, layer: "t12_derived" }` | Snapshot field documentation |
| `roadmap/roadmap-engine.ts` | 270 | `snapshotField(pf, 'noi_year1', 'noi', 'revenue.noi')` | **Reads from pro forma snapshot** — this is the stored assumption, not the computed model result |
| `roadmap/roadmap-engine.ts` | 273 | `if (!noiYear1 \|\| noiYear1 <= 0)` | Validation |
| `roadmap/roadmap-engine.ts` | 296 | `(noiYear2 - noiYear1) / noiYear1` | **GROWTH RATE CALC** — uses Y1 as base for Y1→Y2 growth |
| `roadmap/roadmap-engine.ts` | 314 | `noiYear1` | Returned in roadmap payload |
| `roadmap/roadmap-engine.ts` | 322 | `baseNoi: noiYear1` | **RAMP TARGET** — `baseNoi` is the starting point for the roadmap ramp. If this is supposed to be the in-place endpoint, it should read `inPlaceNOI` instead |

> **⚠️ ROADMAP SEMANTICS ISSUE**: `roadmap-engine.ts:322` sets `baseNoi = noiYear1` (the emergent Y1 aggregate). If the roadmap ramp should start from the in-place endpoint (left edge), this should be `inPlaceNOI` from the model results. However, `roadmap-engine.ts` reads from the **pro forma snapshot** (`snapshotField`), not from `ModelResults`. The snapshot stores the pre-model assumption, which may or may not align with the computed in-place endpoint. This is a **data flow gap** — the snapshot does not receive `inPlaceNOI` from the runner.

### 7. Reforecast Service
| File | Line | Usage | Action |
|---|---|---|---|
| `reforecast.service.ts` | 21 | `noiYear1DeltaPct: number` | Interface — **kept** |
| `reforecast.service.ts` | 102 | `Number(snapshot.projected_noi_year1 ?? 0)` | Reads from snapshot |
| `reforecast.service.ts` | 167 | `original_noi_year1, reforecast_noi_year1` | DB column names |
| `reforecast.service.ts` | 213 | `((reforecastNoiYear1 - originalNoiYear1) / originalNoiYear1) * 100` | Delta calc — **kept** |
| `reforecast.service.ts` | 446 | `noiYear1DeltaPct: result.noiYear1DeltaPct` | Pass-through — **kept** |

### 8. Cashflow Post-Process — **CRITICAL (complex fallback chain)**
| File | Line | Usage | Action |
|---|---|---|---|
| `cashflow.postprocess.ts` | 1488-1594 | Complex fallback: `summary.noiYear1` → `annualCashFlow[0].noi` → `dealAssumptions.noi_year1` → `stabilizedNOI` | **FALLBACK CHAIN** — if model result is missing, falls back to stored assumptions. This conflates computed emergent with stored assumption. Needs `inPlaceNOI` added to fallback chain |
| `cashflow.postprocess.ts` | 1609, 1656, 1694 | `noi_year1: noiYear1` | Writes to agent payload — **kept** |

### 9. API Routes
| File | Line | Usage | Action |
|---|---|---|---|
| `capital-structure.routes.ts` | 518 | `summary.noiYear1 \|\| annualCashFlow[0].noi` | Capital structure calc — **kept** |
| `clawdbot-webhooks.routes.ts` | 1574 | `noiYear1: summary.noiYear1` | Webhook payload — **kept** |
| `financial-dashboard.routes.ts` | 464 | `NOI Year 1: $${(summary.noiYear1 \|\| 0).toLocaleString()}` | **DISPLAY STRING** — label should say "Y1 NOI (emergent)" or similar |
| `sigma-full.routes.ts` | 176, 203-212 | Reads from request body | Input validation — **kept** |
| `financial-model.routes.ts` | 108, 160, 183 | `pickNum('noi', 'noi_year1')` | Metric extraction — **kept** |
| `calibration.routes.ts` | 267 | `pred.metric === 'noi_year1'` | Calibration target — **kept** |

### 10. Agent Tools
| File | Line | Usage | Action |
|---|---|---|---|
| `compute_proforma.ts` | 19, 85, 88, 143 | `noi_year1: z.number()` | Tool param — **kept** |
| `optimize_capital_structure.ts` | 105, 215, 227, 250, 276, 389 | `noi_year1` param | Tool param — **kept** |
| `run_joint_goal_seek.ts` | 97, 114, 151, 185, 198, 273, 320, 333, 370 | `noi_year1` param | Tool param — **kept** |
| `fetch_cashflow_snapshot.ts` | 31, 69, 100, 125, 152, 170 | `noi_year1` in schema + extraction | Snapshot tool — **kept** |
| `fetch_reforecast_summary.ts` | 136-137 | `original_noi_year1`, `reforecast_noi_year1` | DB columns — **kept** |
| `write_underwriting.ts` | 117 | `metrics['noi'] ?? metrics['noi_year1']` | Fallback — **kept** |

### 11. Excel Export
| File | Line | Usage | Action |
|---|---|---|---|
| `excel-export.service.ts` | 415 | `['NOI (Year 1 Stabilized)', r.summary.noiYear1]` | **LABEL IS WRONG** — says "Stabilized" but value is Y1 emergent. Should be "Y1 NOI (emergent)" or left as-is with corrected label |

### 12. Calibration Cron
| File | Line | Usage | Action |
|---|---|---|---|
| `calibrationRealizationCron.ts` | 16, 175-180 | `noi_year1` → `t12.noi` | Maps realized T-12 to `noi_year1` for calibration — **kept** |

### 13. Learning Feedback
| File | Line | Usage | Action |
|---|---|---|---|
| `learning-feedback.service.ts` | 93, 105, 252 | `projected_noi_year1` | DB column — **kept** |

### 14. AI Coordinator
| File | Line | Usage | Action |
|---|---|---|---|
| `ai/coordinator.ts` | 766 | `(r.noi_year1 as number) ?? (r.annualNOI as number) ?? 0` | Fallback chain — **kept** |

---

## Frontend Read Sites

| File | Line | Usage | Action |
|---|---|---|---|
| `FinancialDashboard.tsx` | 172, 181, 190 | `s.noiYear1` for stress scenarios | Display + calc — **kept** |
| `ProFormaTab.tsx` | 786, 801, 905, 912, 2208 | `summary.noiYear1` for metrics + display | Display — **kept** |
| `OverviewTab.tsx` | 119 | `results.noiYear1` | Terminal view — **kept** |
| `ReturnsTab.tsx` | 196, 384 | `ret?.noiYear1` | Returns tab — **kept** |
| `FinancialEnginePage.tsx` | 316-317, 324, 1277, 1294 | `s.noiYear1` / `modelResults?.summary?.noi` | Engine page — **kept** |
| `LifecycleSection.tsx` | 24-26, 200-203, 261 | `original_noi_year1`, `reforecast_noi_year1`, `noi_year1_delta_pct` | Reforecast lifecycle — **kept** |

---

## Test Fixtures

| File | Line | Usage | Action |
|---|---|---|---|
| `golden.types.ts` | 16 | `noiYear1: number` | Fixture type — **kept** |
| `golden-deals.test.ts` | 30, 52 | `expect(result.summary.noiYear1).toBeCloseTo(...)` | Assertion — **kept** |
| `buildmodel-integrity.integration.test.ts` | 25 | `noiYear1: 1050000` | Expected value — **kept** |
| `proforma-assumptions-bridge.test.ts` | 425, 447 | `noiYear1: det.summary.noiYear1` | Test assertion — **kept** |

---

## Critical Issues Identified

### Issue 1: `roadmap-engine.ts:322` — `baseNoi` uses snapshot assumption, not computed in-place endpoint
- **Impact**: Roadmap ramp starts from the stored assumption rather than the computed m0 run-rate
- **Fix required**: Pipe `inPlaceNOI` from `ModelResults` to the snapshot, then update `roadmap-engine.ts:322` to use it
- **Status**: **NOT YET DONE** — requires snapshot schema update + data flow change

### Issue 2: `excel-export.service.ts:415` — Label says "Year 1 Stabilized"
- **Impact**: Exported spreadsheets mislabel Y1 emergent NOI as "stabilized"
- **Fix**: Change label to "Y1 NOI (emergent)" or "Year 1 NOI"
- **Status**: **NOT YET DONE**

### Issue 3: `financial-dashboard.routes.ts:464` — Display says "NOI Year 1"
- **Impact**: Dashboard label is vague; doesn't distinguish from in-place endpoint
- **Fix**: Update label to "Y1 NOI (emergent)" or add tooltip
- **Status**: **NOT YET DONE**

### Issue 4: `cashflow.postprocess.ts` — Fallback chain lacks `inPlaceNOI`
- **Impact**: If model result is missing, agent tools fall back to stale assumptions without knowing the in-place endpoint
- **Fix**: Add `inPlaceNOI` to the fallback chain after `noiYear1`
- **Status**: **NOT YET DONE**

### Issue 5: `financial-model-engine.service.ts:736-737` — DB read from `extraction_t12.noi_year1`
- **Impact**: T-12 extraction field name is `noi_year1` but it stores T-12 annualized NOI (in-place-like), not model-computed Y1
- **Note**: This is a **DB schema naming issue** — the column stores a pre-model estimate, not the emergent Y1
- **Status**: **REQUIRES DB MIGRATION** to rename or document

---

## Done in W4b

1. ✅ Evidence block: `NOI` field restored (was `inPlaceNOI`); reasoning says "emergent — turn-cohort monthly aggregate, between in-place and stabilized endpoints"
2. ✅ New `inPlaceNOI` evidence entry: m0 run-rate annualized, left edge of M09 bridge
3. ✅ goingInCap reasoning: "In-Place NOI" → "Y1 NOI"
4. ✅ Walkthrough: "In-Place NOI" → "Y1 NOI"
5. ✅ Engine: `inPlaceNOI` computed after `noiY1` in `runModel()`
6. ✅ Hook versioned: `.githooks/pre-push` committed; `core.hooksPath` configured

## Pending (P1 — do before W5)

1. `roadmap-engine.ts:322` — pipe `inPlaceNOI` to snapshot, update `baseNoi`
2. `excel-export.service.ts:415` — fix label "Year 1 Stabilized"
3. `financial-dashboard.routes.ts:464` — clarify display label
4. `cashflow.postprocess.ts` — add `inPlaceNOI` to fallback chain
5. `financial-model-engine.service.ts:736-737` — document DB field semantics (T-12 vs model-computed)

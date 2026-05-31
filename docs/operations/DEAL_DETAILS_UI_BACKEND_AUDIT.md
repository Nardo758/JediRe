# Deal Details UI ↔ Backend Audit

**Audit date:** 2026-05-31  
**Reference deal:** 464 Bishop — `3f32276f-aacd-4da3-b306-317c5109b403`  
**Basis:** Live codebase + live DB queries; prior data audit (`DEAL_DETAILS_DATA_AUDIT.md`, 2026-05-30) used as anchor  
**Scope:** UI-to-backend wiring for all Deal Details surfaces (F1–F12, Validation Grid, Valuation Grid, Document Library, Subject Property Header)  
**Status:** Read-only investigation. No code changes made.

---

## 1. Executive Summary

### Surfaces Audited
| Category | Count |
|---|---:|
| F-key surfaces (F1–F12) | 12 |
| Sub-tabs within F9 | 8 |
| Embedded grids / libraries | 4 (Validation Grid, Valuation Grid, Document Library, Subject Property Header) |
| **Total surfaces** | **24** |

### Fetch Call Inventory
| Category | Count |
|---|---:|
| Distinct endpoints called by Deal Details UI | ~48 |
| Endpoints confirmed mounted and reachable | ~39 |
| Endpoints not mounted (route file exists, not wired) | 6 |
| Endpoints that do not exist (UI calls a ghost path) | 3 |
| Endpoints mounted but returning broken/incomplete data | 9 |

### Status Summary
| Status | Count | Notes |
|---|---:|---|
| ✅ Mounted, working, correctly consumed | 24 | Core deal, financials, assumptions, comps, traffic |
| 🟡 Mounted, working, cross-surface inconsistent | 5 | NOI, EGI, GPR, exit_cap, hold_period across surfaces |
| 🟡 Mounted, working, schema drift exists | 4 | LayeredValue leakage in AssumptionsTab, OverviewTab, DealTermsTab, SourcesUsesTab |
| 🟠 Mounted, returns incomplete / broken data | 9 | JEDI score, market intelligence, monthly actuals, utility lines, etc. |
| 🔴 Unmounted route called by UI | 6 | investor-capital, capsule-intelligence, demand-intelligence, reporting-package, zoning-comparator, audit |
| 🔴 UI calls endpoint that doesn't exist | 3 | `/financials/override` (wrong path), `/deals/:id/balance-sheets`, `/deals/:id/roadmap` |
| ⬜ Dead UI code / unfinished sketch | 4 | F12 Custom Tabs, F11 Roadmap, deal_comparable_properties, deal_monthly_actuals write path |

### Top 5 Most Impactful Misalignments

| # | Issue | Operator Visible Impact |
|---|---|---|
| 1 | **CF-01: NOI = $840K vs $2.99M** — `getFieldValues` formula forces `egi − total_opex` which ignores the OM-extracted NOI ($2,999,564) stored in `year1.noi.om`. Every downstream computed value (cap rate, IRR, EM, sale proceeds, sensitivity matrix) cascades from the wrong figure. | P1 — entire Returns/Decision surface is misleading |
| 2 | **CF-02: per_year_overrides partially ignored** — Operator projection-year edits (e.g. `payroll:yr3`, `gpr:yr4`) are stored in `deal_assumptions.per_year_overrides` but the projection loop in `proforma-adjustment.service.ts` does not read them on fetch; was fixed for GPR/OpEx/Vacancy/Other Income by Task #1521, but LTL remains unread (Task #1536 pending). | P1 — operators edit projection years and see no effect |
| 3 | **CF-06: 5 hollow tables** — `deal_debt_schedule`, `deal_waterfall_config`, `deal_capex_items`, `deal_risks`, `deal_comparable_properties` all have 0 rows for 464 Bishop. F5 Capital, F6 Returns, F8 Decision, and Valuation Grid sale comp methods are completely empty. | P1 — Capital and Returns tabs non-functional |
| 4 | **CF-04 / CF-05: JEDI Score and Market Intelligence not populated** — `jedi_scores` has 0 rows; `deal_market_intelligence` has 0 rows. JEDI score display on F1 / F8 returns NULL; market signal overlay on F8 is empty. Both are COMPUTED/RESEARCH-PULL fields with no trigger that fires at deal creation. | P2 — key decision-support indicators missing |
| 5 | **LayeredValue leakage in 4 tabs** — `AssumptionsTab`, `OverviewTab`, `DealTermsTab`, `SourcesUsesTab` each have direct reads of `.platform`, `.broker`, `.detected`, or `.platformRaw` instead of `.resolved`. Operator overrides in Layer 1 are silently bypassed in these code paths. | P2 — override affordances present in UI but have no visual effect on adjacent display |

---

## 2. Per-Surface Audit

### F1 — Overview

**Component:** `frontend/src/pages/development/financial-engine/OverviewTab.tsx`

**Fetch calls:**
| Endpoint | Method | Trigger | UI Consumption |
|---|---|---|---|
| `GET /api/v1/deals/:dealId` | GET | Mount | Name, address, pipeline_stage, strategy |
| `GET /api/v1/deal-assumptions/:dealId/assumptions` | GET | Mount | IRR, EM, NOI (Year 1) |
| `GET /api/v1/jedi/score/:dealId` | GET | Mount | JEDI score composite + dimensions |
| `GET /api/v1/deals/:dealId/market-intelligence` | GET | Mount | Market context strip |

**Route mount status:**
- `/api/v1/deals` → `inline-deals.routes.ts` — ✅ mounted
- `/api/v1/deal-assumptions` → `deal-assumptions.routes.ts` — ✅ mounted (within `/api/v1/deals`)
- `/api/v1/jedi` → `jedi.routes.ts` — ✅ mounted at line 534
- `/api/v1/deals/:dealId/market-intelligence` → `dealMarketIntelligenceRoutes` — ✅ mounted at line 528

**Schema alignment:**
- `GET /api/v1/jedi/score/:dealId` returns `{ total_score, demand_score, supply_score, ... }`. UI consumes all sub-scores correctly via destructuring. No drift.
- `GET /api/v1/deal-assumptions` returns `irr_levered`, `equity_multiple` as top-level scalar columns. UI reads `assumptions.irr_levered`. Both are NULL for 464 Bishop (table rows exist, columns un-populated).

**464 Bishop gap status:**
- JEDI Score: 0 rows in `jedi_scores` → all 6 score tiles return NULL (root cause: compute trigger not fired at deal creation)
- Market Intelligence strip: 0 rows in `deal_market_intelligence` → empty (root cause: Research Agent not triggered)
- IRR / EM: NULL (root cause: Engine A hasn't produced a model result stored back to scalar columns)
- NOI (Year 1): BROKEN — $840,231 (see CF-01)

**Broken / misaligned:**
- JEDI score: (a) data doesn't exist — genuine data gap from missing trigger
- Market intelligence: (a) data doesn't exist — genuine data gap from missing trigger

---

### F2 / Console — Assumptions Hub

**Sub-tabs:** Deal Terms, Inputs/Assumptions, Unit Mix, Other Income, Taxes, Leasing Assumptions, OperatorStance

**Primary fetch calls:**
| Endpoint | Method | Trigger | UI Consumption |
|---|---|---|---|
| `GET /api/v1/deals/:dealId/financials` | GET | Mount / hold toggle | `f9Financials` global state fed into all sub-tabs |
| `GET /api/v1/deal-assumptions/:dealId/assumptions` | GET | Mount | `assumptions` prop for all Console sub-tabs |
| `GET /api/v1/deals/:dealId/assumptions/monthly` | GET | AssumptionsTab mount | `per_year_overrides` grid |
| `PATCH /api/v1/deal-assumptions/:dealId/purchase-price` | PATCH | DealTermsTab save | Dual-writes `deals.budget` + `deals.deal_data.purchase_price` |
| `PATCH /api/v1/deal-assumptions/:dealId/assumptions/hold-period` | PATCH | DealTermsTab save | Updates `deal_assumptions.hold_period_years` |
| `PATCH /api/v1/deals/:dealId/assumptions/per-year` | PATCH | AssumptionsTab / ProjectionsTab cell edit | Writes `deal_assumptions.per_year_overrides` |

**Route mount status:** All of the above are ✅ mounted under `/api/v1/deals` or `/api/v1/deal-assumptions`.

**Schema alignment — DealTermsTab:**
- The `exit_strategy_lv` and `investment_strategy_lv` fields are shown as dropdown selectors. The UI reads `.detected` and `.override` directly to determine which label to show (lines 1583–1610 of `DealTermsTab.tsx`). This is a **🟡 schema drift** — the UI is bypassing `.resolved` and manually implementing a resolution step that should use the canonical `resolvedFrom` chain.

**Schema alignment — AssumptionsTab:**
- `AssumptionsTab.tsx` has direct fallbacks to `.platform` and `.broker` at lines 483, 775, 800. These fire when the helper `getResolved()` doesn't find a value in `.resolved`, meaning if an operator sets a Layer 1 override, the tab would show the override in the `InlineAssumptionBlock` but a sibling column might still show the `.platform` raw value — visual inconsistency.

**464 Bishop gap status:**
- Unit mix: `deal_assumptions.unit_mix = {}` — EMPTY. The `unit_mix_overrides` JSONB is populated, but the `da:use_unit_mix_for_gpr` flag in `per_year_overrides` is not set, so unit mix overrides have no effect on GPR or Pro Forma (CF-09). No UI toggle exists to set this flag.
- OperatorStance: SPARSELY POPULATED — posture fields set to baseline values, no non-default stance.
- Growth scalars (`proforma_assumptions`): All at baseline (3.5% rent, 5.0% vacancy, 2.8% opex), no module calibration has occurred (Finding 2 in prior audit).

**Broken / misaligned:**
- CF-09: Unit mix flag gap — (d) consumer gap: data exists (unit_mix_overrides), route works, but the activating flag has no UI write path

---

### F2a — Validation Grid

**Component:** `frontend/src/pages/development/financial-engine/ValidationGridTab.tsx`

**Fetch calls:**
| Endpoint | Method | Trigger | UI Consumption |
|---|---|---|---|
| `GET /api/v1/deals/:dealId/financials` | GET | Parent | `f9Financials` prop — Year 1 rows |
| `GET /api/v1/deal-assumptions/:dealId/assumptions` | GET | Parent | `assumptions` prop |
| `GET /api/v1/deals/:dealId/implied-cap-rate` | GET | Mount | Comp-set implied cap rate banner |
| `GET /api/v1/deals/:dealId/field-divergences` | GET | Mount | CONTESTED badge data (added Task #1567) |

**Route mount status:** All ✅ mounted. `field-divergences.routes.ts` is mounted under `/api/v1/deals` at line 529 (via `dealCompSetsRoutes` which includes it).

**Schema alignment:**
- The `field-divergences` endpoint now includes `egi` and `total_opex` (fixed in Task #1567). The `CONTESTABLE_FIELD_MAP` in `ValuationGridTab.tsx` maps `grm → ['gpr']` and `gim → ['egi']`. No drift.
- The `implied-cap-rate` endpoint reads from `sale_comp_set_members` for the deal. For 464 Bishop, the comp set now has 42 Georgia county rows, so this should return a value.

**Cross-surface note (Dimension 4):**
- The Validation Grid reads `f9Financials.proforma.year1` for its field rows. The Pro Forma Summary also reads from this same `getDealFinancials()` response. These are the same data source — ✅ consistent.
- However, the Validation Grid also receives `evidenceFieldMap` (per-field confidence metadata from the underwriting evidence system). This is a separate fetch via `GET /api/v1/deals/:dealId/underwriting/evidence-summary`. If this fetch fails, confidence chips silently disappear — no error state.

**464 Bishop gap status:**
- Going-in cap rate: BROKEN — depends on NOI (CF-01)
- Evidence confidence chips: SPARSELY POPULATED — some fields have evidence, others don't

---

### F3 — Pro Forma Summary

**Component:** `frontend/src/pages/development/financial-engine/ProFormaSummaryTab.tsx`

**Fetch calls:**
| Endpoint | Method | Trigger | UI Consumption |
|---|---|---|---|
| `GET /api/v1/deals/:dealId/financials` | GET | Parent (FinancialEnginePage) | All Year-1 P&L rows |
| `GET /api/v1/deals/:dealId/dqa/findings` | GET | Mount | Data quality alert banners |
| `GET /api/v1/deals/:dealId/underwriting/evidence-summary` | GET | Parent | Source pill + collision stats |

**Route mount status:** All ✅ mounted.

**Schema alignment:**
- `getDealFinancials()` returns `proforma.year1` as an array of `{ field, label, resolved, resolvedFrom, platform, broker, agent, override, ... }` objects. `ProFormaSummaryTab` reads `.resolved` for display values — ✅ correct.
- Year N columns come from `projections[]` in the same response. Per-year overrides for Year 2–10 are in `getDealFinancials().projections` — this depends on whether `proforma-adjustment.service.ts:3278` reads `per_year_overrides`. **Status:** GPR, vacancy, OpEx, Other Income overrides were fixed by Task #1521. LTL per-year override is not yet consumed (Task #1536 pending) — 🟠 partially broken.

**464 Bishop gap status:**
- Electric / Gas Fuel: BROKEN — `year1.electric` and `year1.gas_fuel` resolve to NULL (CF-08). Root cause: T12 parser aggregates all utilities into a single `utilities` field; sub-line extraction (`electric`, `gas_fuel`) is blocked pending Task #672 (noted in `cashflow/system.ts` BUG-UTIL-01 comment).
- NOI: BROKEN — $840,231 (CF-01)
- Expense Ratio / NOI Margin: Both BROKEN (cascade from CF-01)

---

### F4 — Projections Hub

**Component:** `frontend/src/pages/development/financial-engine/ProjectionsHubTab.tsx` → `ProjectionsTab.tsx`, `LeaseVelocitySection.tsx`

**Fetch calls:**
| Endpoint | Method | Trigger | UI Consumption |
|---|---|---|---|
| `GET /api/v1/deals/:dealId/financials` | GET | Parent | `projections[]` — Year 2–10 rows |
| `POST /api/v1/lease-velocity/run` | POST | LeaseVelocitySection | Lease velocity prediction |
| `PATCH /api/v1/deals/:dealId/assumptions/per-year` | PATCH | Cell edit in projection grid | Write per-year overrides |
| `PATCH /api/v1/deals/:dealId/assumptions/ltl-controls` | PATCH | LTL panel save | Write LTL baseline source + capture rate |

**Route mount status:**
- `lease-velocity.routes.ts` → ✅ mounted at line 740
- `ltl-controls` PATCH → ✅ exists within `deal-assumptions.routes.ts`

**LTL wiring:** `LTLTrajectoryPanel` in `ProjectionsTab.tsx` controls `ltlBaselineSource` and `markToMarketCaptureRate`. This writes via `PATCH /api/v1/deals/:dealId/assumptions/ltl-controls`. The corresponding read path in `getDealFinancials()` consumes these controls to project LTL trajectory. ✅ Wired.

**464 Bishop gap status:**
- GPR / OpEx per-year overrides: PARTIALLY FIXED (Task #1521) — stored and now read for GPR, vacancy, OpEx, Other Income. LTL still ignored (Task #1536).
- Monthly Actuals overlay: BROKEN — 24 rows exist in `deal_monthly_actuals` but all financial columns (GPR, NOI, EGI, occupancy_rate) are NULL. No ETL or upload write path populates these columns (CF-03 / CF-07).
- Adoption Timeline fields (`construction_months`, `lease_up_months`, `f3_design_program`): EMPTY — 464 Bishop is `SIGNAL_INTAKE` deal type; these fields are only relevant to development deals.

---

### F5 — Capital Hub

**Components:** `CapitalHubTab.tsx` → `SourcesUsesTab.tsx`, `DebtTab.tsx`, `WaterfallTab.tsx`

**Fetch calls:**
| Endpoint | Method | Trigger | UI Consumption |
|---|---|---|---|
| `GET /api/v1/deals/:dealId/financials` | GET | Parent | Capital stack KPIs |
| `GET /api/v1/deals/:dealId/balance-sheets` | GET | CapitalHubTab | Balance sheet summary |
| `GET /api/v1/deals/:dealId/debt-schedule` | GET | DebtTab | `deal_debt_schedule` rows |
| `GET /api/v1/deals/:dealId/capex-items` | GET | SourcesUsesTab | `deal_capex_items` rows |
| `GET /api/v1/capital/deals/:id/investments` | GET | WaterfallTab | LP/GP investor commitments |

**Route mount status:**
- `GET /api/v1/deals/:dealId/balance-sheets` — 🔴 **endpoint does not exist**. No route handler found for this path. CapitalHubTab fetches it on mount and silently receives 404. Balance sheet summary is always empty.
- `GET /api/v1/deals/:dealId/debt-schedule` — ✅ mounted via `inline-deals.routes.ts`
- `GET /api/v1/deals/:dealId/capex-items` — ✅ mounted
- `GET /api/v1/capital/deals/:id/investments` — `investor-capital.routes.ts` exists but is **🔴 NOT mounted** in `index.replit.ts`. The `/api/v1/capital-structure` router IS mounted (line 656) but it is a different file (`capital-structure.routes.ts`) covering LTC/LTV computations, not investor-level LP/GP commitments. WaterfallTab calls `/capital/deals/:id/investments`, which returns 404 for all deals.

**LP/GP wiring status (Tasks #1522/#1523/#1525):**
- The model side is wired: `FinancialEnginePage` maps `f9Financials.returns.lpNetIrr` / `gpNetIrr` to display.
- The real-world investor side (`deal_investments`, `capital_calls`, `distributions` tables) is fully implemented in `investor-capital.routes.ts` but the route is unmounted — **the LP/GP investor management grid in WaterfallTab always returns 404 and shows empty**.
- LP/GP equity share defaults silently to 90/10 split from `per_year_overrides['wf:lpShare'/'wf:gpShare']`; no UI write path to change this exists.

**`waterfall_config` table note:** The system uses `waterfall_distributions` (JSONB array) in `ModelResults` rather than a dedicated `waterfall_config` table. `WaterfallTab.tsx` reads `f9Financials.waterfall.tiers`. The prior audit's reference to `deal_waterfall_config` as a table name may reflect a legacy or planned schema that was superseded by the JSONB approach. The operational gap is that `f9Financials.waterfall.tiers` is empty because Engine A has not produced a model result for this deal.

**464 Bishop gap status:**
- Debt schedule: EMPTY — 0 rows in `deal_debt_schedule`. No document upload or operator entry.
- Capex items: EMPTY — 0 rows in `deal_capex_items`.
- Balance sheets: Always 404 (missing endpoint).
- LP/GP investor records: Always 404 (unmounted route).

---

### F6 — Returns Hub

**Components:** `ReturnsHubTab.tsx` → `ReturnsTab.tsx`

**Fetch calls:**
| Endpoint | Method | Trigger | UI Consumption |
|---|---|---|---|
| `GET /api/v1/deals/:dealId/financials` | GET | Parent | `f9Financials.returns` — IRR, EM, waterfall tiers |

**Route mount status:** ✅ mounted.

**Schema alignment:** `ReturnsTab` consumes `f9Financials.returns.lpNetIrr`, `.gpNetIrr`, `.lpEquityMultiple`, `.waterfallTiers[]`. These are populated by Engine A's Newton-Raphson IRR solver. For 464 Bishop, Engine A has not been invoked for a full model build (no `deal_debt_schedule`, no waterfall config), so all these fields are null/empty.

**464 Bishop gap status:**
- Levered IRR, Unlevered IRR, EM: BROKEN — cascade from CF-01 (wrong NOI) and missing debt schedule
- LP/GP IRR, LP EM, Promote %: EMPTY — no waterfall config or investor rows
- Sale Proceeds: BROKEN — cascade from CF-01

---

### F7 — Valuation Grid

**Component:** `frontend/src/pages/development/financial-engine/ValuationGridTab.tsx`

**Fetch calls:**
| Endpoint | Method | Trigger | UI Consumption |
|---|---|---|---|
| `GET /api/v1/deals/:dealId/valuation-grid` | GET | Mount | All method cards + subject property |
| `GET /api/v1/deals/:dealId/valuation-grid/comps` | GET | Mount | Comp criteria + comp pool |
| `PATCH /api/v1/deals/:dealId/valuation-grid/override` | PATCH | Manual override | Persist operator valuation override |
| `PATCH /api/v1/deals/:dealId/valuation-grid/comps/criteria` | PATCH | Criteria edit | Write `deal_assumptions.comp_criteria` |
| `GET /api/v1/deals/:dealId/field-divergences` | GET | Mount | CONTESTED badge data |

**Route mount status:** All ✅ mounted via `valuation-grid.routes.ts` at line 311.

**Cross-surface inconsistency (Dimension 4 — CF-01 context):**
The `ValuationGridService.compute()` reads NOI via `getFieldValues(pool, dealId, ['noi', ...])`. This service uses a **computed aggregate formula** for NOI: `egi − total_opex`. The formula takes precedence over any stored `year1.noi.resolved` value. For 464 Bishop: `egi = $3,669,151`, `total_opex = $2,828,920`, so the computed NOI = `$840,231`. This is the source of the CF-01 divergence — the OM-extracted NOI of $2,999,564 stored in `year1.noi.om` is never consulted by `getFieldValues` because the formula always wins.

Pro Forma (`getDealFinancials`) reads `year1.noi.resolved` = $840,231 (platform_fallback), so both surfaces actually show $840K — they agree, but both are wrong relative to the OM-extracted value. The CF-01 divergence observed earlier was between the stored `year1.noi.om` value ($2,999,564) and the resolved value ($840K), not between two UI surfaces.

**Schema alignment post Task #1569:**
- `exit_cap` and `hold_period_years` now read via canonical `getFieldValues` chain in `getSubjectProperty()`. Shadow SQL columns (`shadow_exit_cap_stored`, `shadow_hold_period_stored`) are present for canary divergence detection. ✅ Migrated.

**464 Bishop gap status:**
- Cap Rate × NOI method: BROKEN (CF-01)
- Sale Comp PPU / PSF methods: Previously EMPTY; now `sale_comp_set_members` has 42 Georgia county comps — this method should be activating for the first time.
- GRM / GIM methods: Now ACTIVE (Task #1568) once `gross_rent_annual` / `gross_income_annual` fields are populated in `market_sale_comps`.
- Comp criteria: NULL for 464 Bishop — comp pool uses geographic fallback defaults.
- Reconciled value / convergence signal: BROKEN (insufficient active methods; Cap Rate method broken; Sale Comp method may be newly active).

---

### F8 — Decision Tab

**Component:** `frontend/src/pages/development/financial-engine/DecisionTab.tsx`

**Fetch calls:**
| Endpoint | Method | Trigger | UI Consumption |
|---|---|---|---|
| `GET /api/v1/deals/:dealId/financials` | GET | Parent | IRR vs target, integrity checks |
| `GET /api/v1/deals/:dealId/market-intelligence` | GET | Mount | Market signal overlay |
| `GET /api/v1/jedi/score/:dealId` | GET | Mount | JEDI Score composite |

**Route mount status:** All ✅ mounted.

**JEDI Score wiring note:** The `DecisionTab` does not use the `jedi_scores` table value for its primary verdict display. Instead, it derives a `CAUTION / FAVORABLE` verdict from: `f9Financials.proforma.integrityChecks`, comparison of assumptions vs M07 platform calibration benchmarks, and the exit cap vs benchmark spread. This means the Decision Tab produces a live verdict even when `jedi_scores` is empty — but it is different from (and not synchronized with) the stored JEDI Score surfaced in F1. **Cross-surface inconsistency**: F1 shows the stored `jedi_scores` value (NULL), F8 shows a live derived verdict (non-null). These are different constructs but share no labeling distinction in the UI.

**464 Bishop gap status:**
- JEDI Score: NULL (0 rows)
- Strategy Verdict: Displayed (live derived, not from `jedi_scores`)
- Risk Flags: EMPTY (0 rows in `deal_risks`)
- Market Signal Overlay: EMPTY (`deal_market_intelligence` 0 rows)
- IRR vs Target: BROKEN (CF-01 cascade)

---

### F9 — Pro Forma (8 tabs)

**Container:** `frontend/src/pages/development/FinancialEnginePage.tsx`  
**Primary data flow:** `GET /api/v1/deals/:dealId/financials` → `f9Financials` state → all 8 tabs

#### Tab-by-tab status:

| Tab | Key Endpoints | per_year_overrides? | LTL? | LayeredValue | 464 Bishop Status |
|---|---|---|---|---|---|
| Overview | `GET /financials`, `GET /strategy-analyses/:dealId` | No (reads summary KPIs) | No | `.resolved` correctly used | Populated minus NOI cascade |
| Assumptions | `PATCH /assumptions/per-year`, `PATCH /assumptions/rationale` | ✅ Read+write | Partial (concession/LTL %) | Leakage: direct `.platform`, `.broker` at lines 483, 775, 800 | Working; unit mix flag gap |
| Pro Forma | `GET /financials`, `GET /dqa/findings` | No (Year 1 only) | No | ✅ `.resolved` | BROKEN (NOI CF-01, utility CF-08) |
| Projections | `PATCH /assumptions/per-year`, `PATCH /assumptions/ltl-controls` | ✅ Read+write | ✅ `LTLTrajectoryPanel` wired | ✅ `.resolved` | LTL wired; LTL per-year still pending |
| Capital | `PATCH /financial-model/assumptions` | No | No | ✅ `.resolved` | Hollow (no debt schedule/capex) |
| Returns | `GET /financials` | No | No | ✅ `.resolved` | BROKEN (CF-01 cascade) |
| Scenarios/Sensitivity | `POST /api/v2/sigma/broader-goal-seek` | No | No | ✅ `.resolved` | BROKEN (CF-01 cascade) |
| Compare | `GET /financial-model/versions/:dealId` | No | No | ✅ `.resolved` | EMPTY (no saved versions) |

**Note on `GET /api/v2/sigma/broader-goal-seek`:** This uses the `/api/v2/sigma` mount (line 738 of `index.replit.ts` with `sigmaFullRouter`). ✅ Mounted.

---

### F10 — Risks

**Component:** `frontend/src/components/deal/sections/RiskIntelligence.tsx`

**Fetch calls:**
| Endpoint | Method | Trigger | UI Consumption |
|---|---|---|---|
| `GET /api/v1/risk/comprehensive/:dealId` | GET | Mount | 7-category risk framework |
| `GET /api/v1/corporate-health/deal-overlay/:dealId` | GET | Mount | HHI / corporate concentration |

**Route mount status:**
- `risk.routes.ts` → ✅ mounted at `/api/v1/risk` (line 669)
- `corporate-health.routes.ts` → ✅ mounted at `/api/v1/corporate-health` (line 536)

**Completeness signal:** When `tradeAreaRisks` is empty, the component silently falls back to `defaultRiskCategories` (pre-populated placeholder data). **This is silent degradation** — operators cannot distinguish computed risks from scaffolded defaults. No "Risk analysis not yet run" message is shown.

**464 Bishop gap status:**
- `deal_risks` / `tradeAreaRisks`: EMPTY (0 rows). Component shows default scaffolding, not a "not run" state.
- Corporate health overlay: Depends on submarket employer linkage — SPARSELY POPULATED.

---

### F11 — Comps (Property Card / CompsModule)

**Component:** `frontend/src/components/deal/sections/CompsModule.tsx`

**Fetch calls:**
| Endpoint | Method | Trigger | UI Consumption |
|---|---|---|---|
| `GET /deals/:dealId/comps/ranked?strategy=...` | GET | Strategy change | Ranked comp set with relevance scores |
| `POST /deals/:dealId/comps/generate` | POST | Refresh button | Re-triggers comp selection agent |

**Route mount status:** ✅ mounted via `dealCompSetsRoutes` at line 529.

**Completeness signal gap:** When no comps are found, the component shows an empty state with "Generate" CTA but does not explain *why* the set is empty (tight filters, missing coordinates, no comp pool coverage). No explicit "this analysis requires X" treatment.

**Vendor badge wiring (Task #1570):** `resolveCompVendor()` helper now checks `vendor_source`, then `source`, then iterates `source_labels` for D-COSTAR dedup compat. `VendorProvenanceBadge` renders for CoStar / Yardi rows. ✅ Working.

**464 Bishop gap status:**
- `deal_comparable_properties`: 0 rows (legacy sale comp table). The `sale_comp_set_members` table now has 42 Georgia county comps plus any CoStar uploads (Task #1595).
- Ranked comp endpoint reads from `sale_comp_set_members` via the comp-query service, so data is available.

---

### F12 — Roadmap Tab

**Component:** `frontend/src/pages/development/financial-engine/RoadmapTab.tsx`

**Fetch calls:**
| Endpoint | Method | Trigger | UI Consumption |
|---|---|---|---|
| `GET /api/v1/deals/:dealId/roadmap` | GET | Mount | Timeline + milestone data |
| `GET /api/v1/deals/:dealId/timeline` | GET | Mount | Key dates |

**Route mount status:** 🔴 **Neither endpoint exists.** No route handler found for `/deals/:dealId/roadmap` or `/deals/:dealId/timeline`. Both return 404 on every load.

**Dead code classification:** The Roadmap Tab is a ⬜ **development-deal-only surface** (F11 per the original audit numbering). For `SIGNAL_INTAKE` deals like 464 Bishop, all underlying tables (`deal_roadmaps`, `deal_key_dates`, `construction_cost_tracking`, `entitlement_milestones`, `planning_applications`) are empty. Even if routes were mounted, all fields would return empty for this deal type. The route gap compounds a structural data gap.

---

### F13 — Custom Tabs (Opus-generated)

**Component:** `frontend/src/pages/development/financial-engine/CustomTabRenderer.tsx`

**Fetch calls:**
| Endpoint | Method | Trigger | UI Consumption |
|---|---|---|---|
| `GET /api/v1/deals/:dealId/proforma/custom-tabs` | GET | Mount | Custom tab definitions from Opus |

**Route mount status:** ✅ `/api/v1/proforma` is mounted and the `proforma.routes.ts` includes a `custom-tabs` endpoint.

**464 Bishop gap status:** No Opus sessions run for this deal — `deal_custom_tabs`, `opus_conversations`, `opus_messages` all empty. Tab shows "No custom tabs" state.

---

### Embedded: Document Library

**Component:** `frontend/src/components/deal/sections/DocumentsFilesSection.tsx`

**Fetch calls:**
| Endpoint | Method | Trigger | UI Consumption |
|---|---|---|---|
| `GET /api/v1/deals/:dealId/files` | GET | Mount | File list with categories |
| `GET /api/v1/deals/:dealId/files/stats` | GET | Mount | Extraction stats summary |
| `GET /api/v1/deals/:dealId/extraction` | GET | Polling | Per-file extraction status |

**Route mount status:** All ✅ mounted under `inline-deals.routes.ts`.

**464 Bishop status:** 10 files present; T12, Rent Roll, OM, Tax Bill all extracted (has_t12=true, has_rr=true, has_om=true, has_tax=true). 2 files failed extraction. Document filename stored as UUID (human-readable name gap, noted in prior audit Finding 3).

---

### Embedded: Subject Property Header

**Component:** `frontend/src/components/deal/sections/OverviewSection.tsx` → `DealHeader` → `PropertyDetailsForm`

**Resolution path:** `deal-property-link.service.ts` implements two-step resolution:
1. Check `deals.property_id` (new FK — NULL for 464 Bishop, CF-10)
2. Fallback to `deal_properties` join table (legacy)

**464 Bishop status:** `deals.property_id = NULL` is confirmed from the live DB query. The header resolves via the legacy join table fallback. Unit count, year built, and building SF are read from `deals.deal_data` JSONB or extraction capsule data — not from the canonical `properties` table. All surfaces that read through the `properties` entity (lat/lng for proximity scoring, canonical address) use fallback paths.

**Freshness:** No "Last Updated" signal for core property characteristics. No indicator that the property identity is resolved via a fallback path rather than the canonical FK.

---

## 3. Cross-Surface Inconsistency Inventory

| Logical Value | Surface A | Read Path A | Surface B | Read Path B | Divergence? | Severity |
|---|---|---|---|---|---|---|
| **NOI (Year 1)** | Valuation Grid | `getFieldValues` formula: `egi − total_opex` → $840K | Pro Forma Summary | `getDealFinancials()` reads `year1.noi.resolved` → $840K | Same value, both wrong vs OM $2,999,564 | P1 — both surfaces show incorrect value |
| **NOI (displayed vs OM)** | F3 Pro Forma | `year1.noi.resolved` = $840K (platform_fallback) | OM extraction | `year1.noi.om` = $2,999,564 | OM value ignored by resolution chain | P1 — platform_fallback wins over OM extraction |
| **JEDI Score** | F1 Overview | `jedi_scores.total_score` (NULL — 0 rows) | F8 Decision | Live derived verdict from integrity checks + benchmark deltas | Different constructs, no labeling distinction | P2 — operator sees NULL in F1 but non-null verdict in F8 |
| **Exit Cap Rate** | Valuation Grid `getSubjectProperty()` | `getFieldValues(['exit_cap'])` canonical chain (Task #1569) | F2 Deal Terms | `deal_assumptions.exit_cap` direct column read | ✅ Now consistent post-Task #1569 | Resolved |
| **Hold Period** | Valuation Grid | `getFieldValues(['hold_period_years'])` (Task #1569) | F2 Deal Terms | `deal_assumptions.hold_period_years` direct | ✅ Now consistent post-Task #1569 | Resolved |
| **EGI** | Valuation Grid | `getFieldValues`: computed `nri + other_income` | Pro Forma | `getDealFinancials()`: complex `other_income` logic with 12× correction (line 2493) | Potential divergence if `other_income` 12× correction fires | P2 — investigate when other_income has monthly vs annual representation |
| **GPR** | Valuation Grid | `getFieldValues(['gpr'])` leaf: `year1.gpr.resolved` | Pro Forma | `getDealFinancials()`: if `useUnitMixForGpr` flag is on, GPR is mutated in memory | Diverges when unit mix flag is active | P2 — flagged in CF-09; flag has no UI write path so rarely fires |
| **Total OpEx** | Valuation Grid | `getFieldValues`: leaf `year1.total_opex.resolved` | Pro Forma | `getDealFinancials()`: aggregates individual OpEx lines | Diverges if individual lines don't sum to `total_opex.resolved` | P2 — no divergence confirmed for 464 Bishop but risk exists |
| **Market rent / vacancy** | F7 Valuation Grid comps | `deal_rent_comp_sets` (apartment_locator) avg_rent | F2 Assumptions | `proforma_assumptions.vacancy_current` + `year1.vacancy_pct` | Different backing tables, no canonical reconciliation | P3 — noted in prior audit Finding 4 |

---

## 4. Unmounted Route Inventory (Deal Details subset)

These route files **exist in `backend/src/api/rest/`** but are **not mounted** in `backend/src/index.replit.ts`. All were confirmed by scanning every `app.use()` call in `index.replit.ts`.

| Route File | What It Covers | UI Calls That Hit 404 | Recommended Disposition |
|---|---|---|---|
| `investor-capital.routes.ts` | `deal_investments`, `capital_calls`, `distributions` tables; LP/GP investor management | `GET /api/v1/capital/deals/:id/investments` (WaterfallTab) | **Mount** — the route is fully implemented; unmounting breaks LP/GP investor grid |
| `capsule-intelligence.routes.ts` | Advanced AI intelligence for deal capsules | Unknown — no confirmed UI caller found in Deal Details scope | Investigate — may be called by DealCapsule bridge or terminal |
| `demand-intelligence.routes.ts` | Advanced demand modeling | `GET /api/v1/demand-intelligence/...` — called by supply pipeline panels | **Mount** — F4 supply/demand balance panel depends on this |
| `reporting-package.routes.ts` | PDF / export generation for financial packages | No confirmed Deal Details caller; likely portfolio-level | Defer — not blocking any Deal Details surface |
| `zoning-comparator.routes.ts` | Cross-parcel zoning comparison | Not called by any confirmed Deal Details surface | Defer — development workflow only |
| `audit.routes.ts` | System audit logs / health | Not called by any confirmed Deal Details surface | Low priority |

---

## 5. Dead UI Code Inventory

| UI Location | Dead Fetch Call / Component | Endpoint Status | Recommended Disposition |
|---|---|---|---|
| `CapitalHubTab.tsx` | `GET /api/v1/deals/:dealId/balance-sheets` | ❌ Endpoint does not exist (no route handler) | Either implement a `/balance-sheets` handler in `inline-deals.routes.ts`, or remove the fetch and derive balance sheet from existing `financials` response |
| `RoadmapTab.tsx` | `GET /api/v1/deals/:dealId/roadmap` and `GET /api/v1/deals/:dealId/timeline` | ❌ Neither endpoint exists | Mount `roadmap.routes.ts` if the feature is intended; or gate the tab behind `dealType === 'DEVELOPMENT'` and mark as "Coming soon" for non-development deals |
| `CustomTabRenderer.tsx` | Entire tab for deals with no Opus sessions | Tables (`deal_custom_tabs`, `opus_conversations`) are empty for all non-Opus deals | Not dead code per se — the empty state is handled. No action needed. |
| `CompsModule.tsx` | `deal_comparable_properties` legacy table | Superseded by `sale_comp_set_members`; `comparable_properties` has 0 rows for all audited deals | Remove the legacy table fetch path; consolidate on `sale_comp_set_members` via the ranked comps endpoint |
| `AssumptionsTab.tsx` direct `.platform` / `.broker` reads | Lines 483, 775, 800 — fallback reads bypassing `useLayeredValue` | Routes are mounted and working; this is a consumer-side schema drift | Replace direct property reads with `getResolved()` helper or `useLayeredValue` hook |
| `deal_monthly_actuals` write path | No confirmed write path exists in the codebase (CF-07) | Route for reading exists; no POST/PUT/PATCH handler found | Either implement an ETL writer or mark the feature as deferred and remove the overlay from ProjectionsTab |

---

## 6. Schema Drift Inventory

### 6a. UI expects fields the backend doesn't return

| Surface | UI Expects | Backend Returns | Impact |
|---|---|---|---|
| CapitalHubTab balance sheet | `{ assets, liabilities, equity }` from `/balance-sheets` | 404 (no handler) | Balance sheet strip always empty |
| WaterfallTab investor grid | `{ investments: [], total_committed, ... }` from `/capital/deals/:id/investments` | 404 (unmounted route) | Investor grid always empty |
| F8 DecisionTab risk flags | `{ risks: [{ category, severity, description }] }` from `deal_risks` table | Empty array (0 rows, but route works) | Risk flags always blank |
| F1 OverviewTab market intelligence | `{ submarketSummary, absorptionTrend, ... }` from `deal_market_intelligence` | Empty (0 rows, but route works) | Market context strip always blank |

### 6b. Backend returns fields the UI doesn't consume

| Endpoint | Unreconsumed Fields | Potential UX Opportunity |
|---|---|---|
| `GET /api/v1/deals/:dealId/valuation-grid` | `shadowDivergence` (canary log for exit_cap, hold_period, NOI) | Could surface as a developer warning badge in Valuation Grid header |
| `GET /api/v1/deals/:dealId/field-divergences` | `deltaAbsolute`, `deltaRelative`, `directionVsResolved` per point (added Task #1573) | Used by CONTESTED badge but not yet used for sort/filter |
| `GET /api/v1/deals/:dealId/completeness` | `signals[].ctaLink`, `signals[].ctaLabel` | CompletenesBadge renders these — ✅ consumed |
| `GET /api/v1/jedi/score/:dealId` | `jedi_score_history[]` (if returned) | Score trend sparkline not rendered anywhere |

### 6c. Type mismatches (confirmed)

| Field | Backend Type | UI Assumption | Risk |
|---|---|---|---|
| `market_sale_comps.sale_price` | `NUMERIC` → returned as string | `parseFloat()` in service layer | Low — `safeFloat()` used consistently in service |
| `deal_assumptions.year1` | JSONB | `F9Year1Row[]` TypeScript type | Implicit cast at API boundary; if JSONB shape drifts, no runtime error — silent NULL |
| `f9Financials.projections[n].gpr` | `number \| null` | UI does `toFixed(0)` without null check | Medium — would throw on null; currently masked by NOI being wrong for other reasons |

### 6d. LayeredValue misuse (direct layer access bypassing `.resolved`)

| Component | Line(s) | Misuse Pattern | Risk |
|---|---|---|---|
| `AssumptionsTab.tsx` | 483, 775, 800 | `row.platform`, `row.broker` read directly | Operator override silently bypassed in adjacent column display |
| `OverviewTab.tsx` | 86, 309 | `row.platformRaw`, `row.brokerRaw` for collision detection | Display logic correct but bypasses `resolvedFrom` for collision badge trigger |
| `DealTermsTab.tsx` | 1583–1610 | `lv.detected`, `lv.override` directly for label logic | Reimplements resolution logic; won't handle future `.computedValue` or `.agent` layers |
| `SourcesUsesTab.tsx` | 140 | `lv.platform` for Mezz amount fallback | Operator override of Mezz amount won't propagate to S&U display |

---

## 7. Layer 1 Override Coverage

The F9 calc-vs-assumption doc defines a 6-point override wiring checklist:
1. PATCH endpoint exists
2. UI affordance present (input / override button)
3. Resolution chain selects override (`.override` layer wins)
4. Reset-to-agent available
5. Alert level fires on material divergence vs platform
6. `resolvedFrom: 'override'` visible to operator

| Field | (1) PATCH | (2) UI Input | (3) Override wins | (4) Reset | (5) Alert | (6) Provenance |
|---|---|---|---|---|---|---|
| Purchase Price | ✅ | ✅ DealTerms | ✅ | ✅ | ✅ amber | ✅ |
| Hold Period | ✅ | ✅ DealTerms | ✅ | ✅ | ✅ | ✅ |
| Exit Cap Rate | ✅ | ✅ DealTerms | ✅ | ✅ | ✅ | ✅ |
| GPR (Year 1) | ✅ | ✅ InlineAssumptionBlock | ✅ | ✅ | ✅ | ✅ |
| Vacancy % | ✅ | ✅ InlineAssumptionBlock | ✅ | ✅ | ✅ | ✅ |
| OpEx Growth % | ✅ | ✅ InlineAssumptionBlock | ✅ | ✅ | ✅ | ✅ |
| Rent Growth % | ✅ | ✅ InlineAssumptionBlock | ✅ | ✅ | ✅ | ✅ |
| NOI (Year 1) | ⚠️ Task #1520 in progress | ⚠️ No direct NOI override UI | ❌ `getFieldValues` formula always wins | ❌ | ❌ | ❌ |
| EGI | ✅ (indirect via GPR + vacancy) | ⚠️ No direct EGI override | ❌ EGI is computed, no override slot | ❌ | ❌ | ⚠️ shows 'agent' |
| Investment Strategy | ✅ (dropdown) | ✅ dropdown | ⚠️ Uses `.detected`/`.override` directly — not canonical `.resolved` | ⚠️ | ⚠️ | ⚠️ |
| Exit Strategy | ✅ (dropdown) | ✅ dropdown | ⚠️ Same as above | ⚠️ | ⚠️ | ⚠️ |
| Other Income / unit | ✅ OtherIncomeTab | ⚠️ No standard InlineAssumptionBlock | ✅ | ⚠️ | ⚠️ | ⚠️ |
| Electric / Gas Fuel | ❌ No PATCH path (sub-line not extractable) | ❌ No UI | ❌ | ❌ | ❌ | ❌ |
| Unit Mix GPR gate (`da:use_unit_mix_for_gpr`) | ✅ per_year_overrides PATCH | ❌ No toggle | N/A | N/A | N/A | N/A |
| LP/GP Share | ✅ per_year_overrides (`wf:lpShare`) | ❌ No UI write path | N/A | N/A | N/A | N/A |

**Fully wired (6/6):** Purchase Price, Hold Period, Exit Cap, GPR, Vacancy, OpEx Growth, Rent Growth — 7 fields  
**Partially wired (3–5/6):** Investment Strategy, Exit Strategy, Other Income — 3 fields  
**Not wired (0–2/6):** NOI direct override, EGI direct override, Electric/Gas Fuel, Unit Mix GPR gate, LP/GP Share — 5 fields

---

## 8. Freshness Indicator Coverage

| Surface | Has Freshness Indicator | Source | Gap |
|---|---|---|---|
| F11 Comps (CompsModule) | ✅ VendorProvenanceBadge with `vendor_data_as_of` | `market_sale_comps.vendor_data_as_of` | Only for vendor-sourced rows; county comps show no date |
| F10 Risk (RiskIntelligence) | ✅ BLiveBadge + 30-day trend sparkline | `tradeAreaRisks.trend30d` | Defaults to placeholder when 0 rows |
| Document Library | ✅ `extraction_status`, `auto_category_confidence` | `deal_files.extraction_completed_at` | No "extracted N days ago" display |
| Financial Engine (vendor data) | ✅ VendorFreshnessPrompt banner | `historical_observations.vendor_data_as_of` | Only shows when vendor data is stale; no "fresh as of" display when current |
| CompletenesBadge | ✅ vendor_data_stale signal | Signal registry → VendorFreshnessPrompt scroll | ✅ Full wiring (Task #1571) |
| F1 Overview | ❌ No freshness on JEDI score | `jedi_scores.updated_at` exists but not shown | Should show "last computed N days ago" |
| F2a Validation Grid | ❌ No freshness on evidence confidence chips | `evidenceFieldMap` has no `as_of` date | No indicator of when underlying agent run occurred |
| F7 Valuation Grid methods | ❌ No freshness on comp pool | `market_sale_comps.created_at` not surfaced | Operators can't tell if comp pool is 1 month or 18 months old |
| F8 Decision market overlay | ❌ No freshness | `deal_market_intelligence.created_at` not shown | Always 0 rows for 464 Bishop anyway |
| F2 Assumptions growth scalars | ❌ No freshness | `proforma_assumptions.updated_at` not shown | Operators can't tell when last calibration occurred |
| Subject Property Header | ❌ No freshness | `deals.updated_at` not shown | No indicator of property record age or fallback path being used |

---

## 9. Completeness Signal Coverage

Surfaces audited against the Deal Completeness Framework (Task #1574):

| Surface | Handles Missing Signal Explicitly | How | Gap |
|---|---|---|---|
| Deal Header (all F-keys) | ✅ CompletenesBadge | READY / N SIGNALS / N SIGNALS with severity | Full framework (Task #1574) |
| DealCard (portfolio) | ✅ CompletenesBadge with stopPropagation | Same badge | ✅ |
| TrafficModule (F4) | ✅ Explicit "M07 TRAFFIC ENGINE — NOT RUN" panel | When `projection === null` after load | ✅ (Task #1574) |
| ValuationGridTab | ✅ `costar_upload_missing` warning banner | Reads completeness API | Only wired for CoStar gap, not for M07/rent roll gaps |
| F10 Risk | ❌ Silent degradation | Falls back to `defaultRiskCategories` when empty | No "risk analysis not run" state |
| F11 Comps | ❌ Silent degradation | Generic "Generate" CTA when empty | Doesn't explain why empty |
| F8 Decision market overlay | ❌ Silent absence | Overlay just doesn't render | Should show "Market analysis not run" |
| F1 JEDI Score tiles | ❌ Silent NULL | Tiles show "--" with no explanation | Should show "Score not yet computed" state |
| Compare Hub / Scenarios | ❌ Silent empty | Empty list when no versions | Should show "No saved versions — run a model to compare" |
| F2a Validation Grid evidence | ⚠️ Partial | Shows "no evidence" per-row but no panel-level signal | Evidence absence vs. evidence gap is ambiguous |

---

## 10. Empty/Broken Root Cause Classification

Using the prior audit's 65 EMPTY and 19 BROKEN fields, classified per the 5 Dimension 5 categories:

### BROKEN fields (19 total)

| Field / Area | Root Cause | Category | Evidence |
|---|---|---|---|
| NOI = $840K (CF-01) | `getFieldValues` formula `egi − total_opex` overrides OM-extracted value stored in `year1.noi.om` | **(c) handler gap** — data exists, route mounted, but handler logic picks wrong source | `year1.noi.om = 2,999,564`; formula produces $840K |
| Going-in Cap Rate (F2a) | Cascades from NOI CF-01 | **(c) handler gap** (inherited) | — |
| Electric / Gas Fuel (CF-08) | T12 parser aggregates to single `utilities` field; sub-line extraction blocked (Task #672) | **(a) data gap** — data exists in T12 but ETL does not extract sub-lines | `BUG-UTIL-01` comment in `cashflow/system.ts` |
| Unit Mix GPR gate (CF-09) | `da:use_unit_mix_for_gpr` flag not set; no UI toggle to set it | **(d) consumer gap** — data (`unit_mix_overrides`) exists, route works, but activating flag has no UI write path | `UnitMixTab.tsx` line 1830 |
| deal_monthly_actuals financial data (CF-03) | Shell rows created with no ETL or upload write path | **(a) data gap** — records exist but are empty shell rows; author is UNKNOWN | 24 rows, all financial fields NULL |
| Levered/Unlevered IRR, Equity Multiple | Cascades from NOI CF-01 + missing debt schedule | **(a) + (c)** composite | — |
| LP/GP Net IRR, Promote % | No waterfall config rows; `investor-capital.routes.ts` unmounted | **(b) wiring gap** — route unmounted + (a) data gap | Route file exists, not in index.replit.ts |
| Reconciled Valuation (F7) | Only 1 active valuation method (Per-Unit Benchmark); Cap Rate broken (CF-01) | **(c) handler gap** (inherited from CF-01) | — |
| Convergence Signal (F7) | Insufficient active methods | **(c) handler gap** (inherited) | — |
| Source document filename (UUID) | No human-readable name stored in `deal_document_files` | **(a) data gap** — schema doesn't store filename, only UUID | Prior audit Finding 3 |
| EGI `resolution: 'agent'` layer violation | Agent writes to `year1.egi.agent` for COMPUTED field | **(c) handler gap** — EGI should never have an agent author layer | Prior audit Finding 1 |
| GPR `resolution: 'agent'` takes priority over T12 | `agent` priority not in published `FIELD_PRIORITIES` spec | **(c) handler gap** — undocumented priority ordering | Prior audit Finding 1 |
| Balance sheet strip (CapitalHubTab) | `GET /deals/:dealId/balance-sheets` endpoint does not exist | **(b) wiring gap** — UI calls ghost endpoint → 404 | No route handler found |
| Roadmap tab (F11) | `GET /deals/:dealId/roadmap` and `/timeline` do not exist | **(b) wiring gap** — both endpoints are ghost | No route handlers found |
| Deal Score History (F8) | No write path for `jedi_score_history`; `jedi_scores` has 0 rows | **(a) data gap** — no compute trigger | CF-04 |
| Debt feasibility signal (F8) | Cascades from missing debt schedule + broken NOI | **(a) + (c)** composite | — |
| Sensitivity matrix (F10) | Cascades from CF-01 NOI | **(c)** inherited | — |
| Goal-seek results (F10) | Cascades from CF-01 | **(c)** inherited | — |
| Hold Period Sensitivity (F6) | Cascades from CF-01 | **(c)** inherited | — |

### EMPTY fields (65 total — classified by root cause category)

| Category | Count | Representative Fields |
|---|---|---|
| **(a) Data gap — genuine missing data** | 38 | JEDI scores (CF-04), market intelligence (CF-05), debt schedule, capex items, waterfall tiers, deal_risks, roadmap milestones, model versions, scenarios, stress tests, construction timeline, lease-up months, LP/GP equity split |
| **(b) Wiring gap — route exists but unmounted** | 5 | LP/GP investor grid (`investor-capital.routes.ts`), demand-intelligence endpoints |
| **(c) Handler gap — route mounted, logic broken** | 6 | Deal monthly actuals (24 shell rows, no data), `deal_comparable_properties` (superseded by `sale_comp_set_members`), Closing Cost sub-lines (no default write at deal creation), scenario results, stress test results |
| **(d) Consumer gap — data exists, UI wrong path** | 8 | Unit mix GPR gate (CF-09), investment/exit strategy LayeredValue misuse, LTL per-year override (Task #1536 pending), peer intelligence table (exists, UI endpoint not wired), lease velocity on some projection cells |
| **(e) Display gap — data exists, filtered/transformed incorrectly** | 3 | `proforma_assumptions` growth scalars showing at baseline despite module calibration paths existing; `real_estate_tax` partially populated but shown as sparse; correlation adjustments stored but inconsistently surfaced |
| **(f) Other** | 5 | F11 Roadmap (dev-only surface with correct empty state for SIGNAL_INTAKE deal), F12 Custom Tabs (requires Opus session), F9 Compare versions (requires prior model saves), `peer_intelligence` table (table may not exist at all) |

---

## 11. Architectural Pattern Synthesis

### What the aggregate findings show

**1. Compute triggers are the largest single class of data gap (category a)**

Of the 65 EMPTY fields, ~38 are genuinely missing data — not wiring issues, not consumer issues. The pattern is consistent: platform has a table and a service, but no trigger fires to populate it at deal creation or on any predictable schedule. Affected systems: `jedi_scores` (no trigger), `deal_market_intelligence` (Research Agent not auto-invoked), `deal_risks` (Risk Agent not auto-invoked), `proforma_assumptions` module calibration (M05/M07/M35 not auto-triggered). The deal completeness framework (Task #1574) surfaces these gaps post-hoc; the architectural fix is on-demand triggers at deal creation and/or completeness-gated CTAs that make the gap visible and actionable before operators rely on the surface.

**2. The NOI resolution chain is the single highest-leverage bug**

CF-01 cascades into: Going-in Cap Rate (F2a), NOI Margin / Expense Ratio (F3), IRR / EM / Cash-on-Cash (F6), Strategy Verdict (F8), Sale Proceeds (F6), Sensitivity matrix (F10), Valuation Grid Cap Rate method (F7), Goal-seek results (F10). Fixing `getFieldValues` to respect the OM-extracted NOI ($2,999,564) when `year1.noi.om` is present and `year1.noi.resolved` is `platform_fallback` would unblock more operator-visible surfaces than any other single fix. Task #1520 tracks this.

**3. Two unmounted routes block distinct functional areas**

`investor-capital.routes.ts` blocks the LP/GP investor grid in F5 WaterfallTab — a commonly-used operational surface. Mounting it is a one-line change in `index.replit.ts`. The `demand-intelligence.routes.ts` unmounting blocks the supply/demand balance panel in F4. Both should be mounted before other UI work in these surfaces.

**4. LayeredValue consumer leakage creates override blind spots**

Four components (`AssumptionsTab`, `OverviewTab`, `DealTermsTab`, `SourcesUsesTab`) have direct reads of `.platform`, `.broker`, `.detected`, or raw layer properties. These are exactly the surfaces where operators would expect their Layer 1 overrides to be reflected. The `useLayeredValue` hook and `getResolved()` helper already exist — the fix is replacing direct property access with these utilities. This affects 5 of the 15 "partially wired" override fields in the Layer 1 coverage table.

**5. Two ghost endpoints need resolution (not just mounting)**

`GET /api/v1/deals/:dealId/balance-sheets` and `GET /api/v1/deals/:dealId/roadmap` both return 404 because no handler exists. Unlike unmounted routes (where the file exists), these would require either: (a) implementing a handler, or (b) removing the UI fetch. The balance sheet endpoint could be derived from the existing `financials` response without a new route.

**6. Silent degradation is pervasive across non-core surfaces**

F10 Risk (shows placeholder data), F11 Comps (shows generic CTA), F8 market overlay (silently absent), F1 JEDI tiles (show "--"), F9 Compare (empty list). The Deal Completeness framework (Task #1574) addresses this architecturally for the headline surfaces; the per-surface "not yet run" treatment still needs to be applied to Risk Intelligence, market overlay, and JEDI score tiles specifically.

**7. The `agent` resolution layer is unauthorized in the published spec**

Fields like `gpr`, `egi`, `payroll`, `g_and_a` carry `resolution: 'agent'` in the `year1` JSONB. This layer is not in the published `FIELD_PRIORITIES` constant in `proforma-seeder.service.ts`. The agent is writing to `year1[field].agent` and a resolution step is selecting it at a priority not visible in the seeder spec. This is the Layer 1/2 boundary violation identified as Finding 1 in the prior audit. Until the `agent` layer is either (a) formally added to `FIELD_PRIORITIES` with a defined priority position, or (b) the agent is refactored to write to `detected` or `om`, the resolution behavior is undocumented and fragile.

### Implications for Piece B priorities

- **B.1 (single canonical read path per logical value):** NOI is the most urgent violation. The `getFieldValues` formula should either compute correctly (using OM-extracted components) or yield to the stored `year1.noi.resolved` when it is sourced from a higher-confidence layer than `platform_fallback`. All other cross-surface inconsistencies are less severe.
- **B.2 (Layer 1 override wiring):** NOI, EGI, Electric/Gas Fuel, LP/GP Share, and Unit Mix GPR gate are the 5 fields with zero override wiring. NOI is highest priority given CF-01.
- **B.3 (freshness indicators):** JEDI score (F1), comp pool age (F7), growth scalar last-calibrated date (F2) are the three most operator-visible gaps.
- **Piece C (completeness signals):** F10 Risk, F8 market overlay, and F1 JEDI tiles are the three surfaces that silently degrade without a completeness signal — the framework is in place, they just need to be opted in.

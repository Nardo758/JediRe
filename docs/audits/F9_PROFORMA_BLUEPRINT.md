# F9 PRO FORMA BLUEPRINT — Complete Feature, Computation & Interaction Inventory

**Type:** READ-ONLY audit. No code, schema, or config changes made. All "proposed chassis home" entries are recommendations for operator review, not a plan of record.
**Scope:** Every ProForma-related surface as of current `master` (post-D2). Anything D2 removed is noted where found; this blueprint documents the CURRENT state only.
**Method:** Parallel code exploration (4 explorer passes covering B1–B4) + direct spot-checks against source (file:line verified for the highest-leverage claims: `BUILTIN_TAB_LABELS`, GPR/NOI formula lines, and existence of `module-registry.ts`, `SourcesUsesTab.tsx`, `WaterfallTab.tsx`, `DebtTab.tsx`). Findings not independently re-verified line-by-line are marked from explorer output; treat those as directionally reliable but not to the same evidentiary standard as the spot-checked items.

---

## B1/B5-1 · Feature Table

Columns: **Feature** | **Surface** | **Data source** | **Interactions** | **Condition** | **file:line** | **Proposed chassis home**

### ProFormaSummaryTab (`frontend/src/pages/development/financial-engine/ProFormaSummaryTab.tsx`)

| Feature | Data source | Interactions | Condition | file:line | Proposed home |
|---|---|---|---|---|---|
| Header KPI pills (GPR, EGI, NOI/unit) | `deal_financials` (resolved) | none | always | `:1398-1407` | PRO FORMA header |
| Revenue row set (gpr, loss_to_lease, vacancy_loss, concessions, bad_debt, other_income, egi) | `deal_financials` / `periodic_seed` when stabilization year > 1 | pencil-icon override, T-period cycle click-to-adopt | always | `:260-272`, `:971-999` | PRO FORMA section |
| Controllable/Non-controllable OpEx rows | same | same | always | `:260-272` | PRO FORMA section |
| NOI Bridge (EGI − OpEx tiers → NOI) | derived from above | none | always | `:4384-4413` | PRO FORMA section |
| FLIP template rows (purchase price, hard/soft costs, exit price, profit margin) | `proforma-template-row-sets.ts` | none (renders "Not Yet Supported" overlay) | `isFlipTemplate` | row-sets `:45-63`; overlay `:1492-1520` | Strategy overlay — **currently non-functional**, see Gap Register |
| STR template rows (ADR, occupancy, RevPAR, cleaning/platform fees) | same | none (same overlay) | `isStrTemplate` | row-sets `:75-81` | Strategy overlay — non-functional |
| LAND HOLD template rows | same | none (same overlay) | `isLandHoldTemplate` | row-sets `:90-95` | Strategy overlay — non-functional |
| Stabilization Window Strip | `deal_assumptions` (adoption timeline) | none | always unless special template | `:1596-1650` | ASSUMPTIONS section (read-only echo) |
| Valuation Snapshot Strip | derived | none | always | `:1548-1550` | Exhibit candidate |
| REPARSE button | — | `POST /api/v1/deals/:id/financials/reparse` | always | `:858` | PRO FORMA action |
| GPR-from-unit-mix toggle | `deal_assumptions` | `PATCH .../financials/override` (`da:use_unit_mix_for_gpr`) | always | `:904` | ASSUMPTIONS |
| Pencil override / RotateCcw reset | `deal_assumptions` overrides | `PATCH .../financials/override` (value or null) | always | `:873`, `:936` | PRO FORMA (inline editing) |
| DQA shield / alert drawer | — | opens drawer, no mutation | `dqaAbsenceCount > 0` | `:1245`, `:1261` | Exhibit / audit trail |
| Evidence panel launch | — | dispatches `fe-evidence-click` | on SourceBadge click | `:4259` | Exhibit |
| BROKER VIEW / T-period cycling | local state | cycles T12/T6/T3/T1 highlight | `viewMode` | `:511`, `:495`, `:3972` | PRO FORMA view toggle |
| T-period cell → adopt as override | `deal_assumptions` | `onSaveCorrection` | on cell click | `:4124` | PRO FORMA |
| Concession drilldown modal | — | opens `ConcessionDrilldownModal` | on row click | `:4054` | Exhibit |
| Stance-active banner | `deal.operator_stance` | none | `stanceAffectedFields` present | `:1459-1485` | ASSUMPTIONS (provenance echo) |
| Collision badge | evidence resolution meta | none | `has_collision` | `:4320` | Exhibit |

### FinancialEnginePage tab shell (`frontend/src/pages/development/FinancialEnginePage.tsx`)

Confirmed by direct read (`:501-513`, `:1530`): `BUILTIN_TAB_LABELS` = **OVERVIEW, CONSOLE, PROJECTIONS, VALIDATION, CAPITAL, RETURNS, VALUATION, SCENARIOS, COMPARE, GOAL SEEK, ROADMAP** (11 tabs; ROADMAP conditional on `isRoadmapEligibleDealType`, appended/sliced at `:1530`). Custom tabs (Opus-generated, marked ✦) appended dynamically.

| Tab | Renders | Condition | file:line | Proposed home |
|---|---|---|---|---|
| OVERVIEW | `OverviewTab.tsx` — KPI strip (IRR/EM/CoC/Y1 NOI/DSCR), Sources & Uses, Returns breakdown/by-year, Disposition summary, F9 unit economics, market snapshot | always | `:2143` | CHASSIS-EQUIVALENT → summary header |
| CONSOLE | `ConsoleHubTab.tsx` → sub-tabs STANCE, DEAL TERMS, PRO FORMA (`ProFormaSummaryTab`), INPUTS (`AssumptionsTab`), UNIT MIX, OTHER INCOME, TAX | always | `:2147` | Splits across ASSUMPTIONS + PRO FORMA chassis sections |
| PROJECTIONS | `ProjectionsHubTab.tsx` → PROJECTIONS (10-yr grid), LEASE VELOCITY (M07 handoff, `POST /api/v1/lease-velocity/run`) | always | `:2153` | PRO FORMA (multi-year) + dynamic module (Lease Velocity) |
| VALIDATION | `ValidationGridTab.tsx` | always | `:2156` | Exhibit / audit |
| CAPITAL | `CapitalHubTab.tsx` — debt sizing, S&U, waterfall access | always | `:2157` | RETURNS/debt chassis section |
| RETURNS | `ReturnsHubTab.tsx` | always | `:2158` | CHASSIS-EQUIVALENT |
| VALUATION | `ValuationGridTab.tsx` — submarket benchmark comparison | always | `:2159` | Exhibit candidate |
| SCENARIOS | `ScenarioManagementTab.tsx` | always | `:2160` | Overlaps M10 Scenario Engine (metadata-only per B3) — **DUPLICATE-CANDIDATE**, see Gap Register |
| COMPARE | `CompareHubTab.tsx` | always | `:2161` | DYNAMIC-CANDIDATE |
| GOAL SEEK | `SensitivityTab.tsx` (+ `GoalSeekWidget.tsx`, inverse-solves for purchase price / exit cap given target IRR) | always | `:2164` | RETURNS/sensitivity chassis section |
| ROADMAP | `RoadmapTab.tsx` | value-add/redevelopment/rehab/renovation deal types only | `:2173`, `:519-522` | DYNAMIC-CANDIDATE (already input-gated — closest existing analog to the factory model's "flag ⇒ module" contract) |
| Custom (✦) | `CustomTabRenderer.tsx`, Opus-generated | user/agent-created | `:2174` | DYNAMIC — already fully dynamic, arguably the most factory-aligned surface in the whole page |

### Other ProForma-adjacent surfaces

| Surface | Feature | Data source | file:line | Proposed home |
|---|---|---|---|---|
| `ProFormaWithTrafficSection.tsx` | Traffic→ProForma "4 pipes" (occupancy/rent/leases/lease-up weeks) visualization | `trafficToProFormaService.ts` handoff | `:144-179`, `:190` | Exhibit (M07↔M09 bridge) |
| same | 3-layer assumption comparison (Baseline/Platform-Adjusted/User Override) | layered assumptions | `:252-256` | ASSUMPTIONS |
| same | 10-year combined income statement (traffic + financials) | M07 + M09 | `:424-451` | PRO FORMA |
| same | Platform vs Baseline returns comparison | derived | `:98-103` | RETURNS |
| Terminal `FinancialsTab.tsx` | NOI/cash-flow chart, 10-yr operating statement table | `results.annualCashFlow` | `:167`, `:179` | **DUPLICATE** of F9 PROJECTIONS tab — separate surface, same content class |
| same | Assumption cards (Acquisition/Revenue/CapEx/Derived) | `deal.model`/`deal.latestModel` hybrid | `:333-471` | **DUPLICATE** of CONSOLE→INPUTS |
| same | Periodic Timeline modal trigger | `periodic_seed` via `usePeriodicField` | `:476`, `:122` | Keep as modal (already factory-like: summoned by trigger, not always-rendered) |

---

## B2/B5-2 · Computation Table

Canonical runner: `backend/src/services/deterministic/deterministic-model-runner.ts` (spot-checked directly).

| Metric | Formula | file:line | Spec verdict |
|---|---|---|---|
| GPR | `units * marketRent * 12 * cumGrowthVal` | `:602` (verified) | SPEC'D-AND-BUILT (`PROFORMA_CALCULATION_TEMPLATE.md` `REV-001`) |
| Loss to lease | `GPR * lossToLease` | `:603` (verified) | SPEC'D-AND-BUILT |
| Vacancy | `GPR * vacancySched[y-1]` | `:604` (verified) | SPEC'D-AND-BUILT |
| Concessions | `GPR * concessions` | `:605` (verified) | SPEC'D-AND-BUILT |
| Bad debt | `GPR * badDebt` | `:606` (verified) | **BUILT-WITH-KNOWN-DRIFT** — per `PROFORMA_CALCULATION_TEMPLATE.md`, seeder applies bad debt to EGI while projections (here) apply it to GPR. Flagged in spec itself, not resolved.
| Base revenue | `GPR - loss - vac - conc - bd` | `:607` (verified) | SPEC'D-AND-BUILT |
| EGI | `baseRev + otherIncome` | ~`:608-609` | SPEC'D-AND-BUILT |
| OpEx lines | `itemPerUnit * units * expenseGrowthCum` | `:611-617` | SPEC'D-AND-BUILT |
| Management fee | `EGI * managementFee` | `:618` | SPEC'D-AND-BUILT |
| NOI | `EGR - totalExp` (EGR = effective gross revenue, i.e. EGI net of any pass-throughs) | `:622` (verified) | SPEC'D-AND-BUILT |
| DSCR | `NOI / debtService` | `:1330` | SPEC'D-AND-BUILT |
| Debt yield | `NOI / loanAmount` | `:108` | SPEC'D-AND-BUILT |
| Cap rate on cost | `NOI / totalAcquisitionCost` | `:109` | SPEC'D-AND-BUILT |
| IRR | Newton-Raphson on `Σ CF_i / (1+r)^i` | `:544-572` | SPEC'D-AND-BUILT |
| Equity multiple | `Σ(positive CF) / |initial equity|` | `:574-584` | SPEC'D-AND-BUILT |
| Cash-on-cash | `Annual CFBT / initial equity` | `:586-590` | SPEC'D-AND-BUILT |
| LTV at close / maturity | `loanAmount / purchasePrice`; `endingBalance / grossSalePrice` | `:220-221` | SPEC'D-AND-BUILT |
| Break-even occupancy | `(totalExpenses + debtService) / GPR` | `:1337` | SPEC'D-AND-BUILT |

**Spec documents located:**
- `docs/architecture/M09_PROFORMA_SPEC.md` — defines the Stabilized Potential Engine and a promised Bridge Decomposition (`Δ = Δ_market + Δ_platform + Δ_operator + Δ_capex`).
- `docs/specs/PROFORMA_CALCULATION_TEMPLATE.md` — the line-item schema (`REV-xxx`, `CTRLL-xxx` IDs), maps each to category/source-tier/formula; itself documents the bad-debt EGI-vs-GPR drift.
- `docs/architecture/F9_MODULE_MAP.md` — identifies **Engine A** (`proforma-adjustment.service.ts`) as canonical production engine and **Engine C** (`financial-model-engine.service.ts`) as the LLM-compatible deterministic runner — i.e., **two engines exist**, both live. This is a structural finding, see Gap Register.
- `PROFORMA_TIMELINE_MODEL_SPEC.md` (in `attached_assets`, not `docs/`) — promises tiered stabilization-timing resolution `user > agent > traffic_engine > platform_default`.

**Frontend computation leakage (tri-tab-identity risk — math beyond display formatting, found in components):**

| Location | Computation | Risk |
|---|---|---|
| `ProFormaSummaryTab.tsx:702-704` | `noiAfterReserves = NOI - replacementReserves` | Duplicates a derivation that should live in the runner |
| `ProFormaSummaryTab.tsx:711-727` | Client-side annual debt service (IO or PMT-style amortizing) | Duplicates debt math also present in `DebtTab.tsx`/runner — two independent implementations of debt service = drift risk |
| `GoalSeekWidget.tsx:85-110` | Inverse return math solving for purchase price / exit cap | Legitimate UI-side solver, but re-implements return formulas rather than calling the runner in reverse |
| `PlausibilityPanel.tsx:42-58` | Variance % and plausibility score math | Should be server-computed for consistency across surfaces |
| `SensitivityBar.tsx` | Dynamic IRR/EM interpolation across cap-rate axis | Interpolation of runner outputs — lower risk (display-adjacent) but still logic, not formatting |

---

## B3 · Sub-tab & module reality

**ProForma-internal sub-tab bar** lives inside `ConsoleHubTab.tsx` (not a separate free-floating `SubTabBar` — it's the CONSOLE tab's own sub-navigation): STANCE, DEAL TERMS, PRO FORMA, INPUTS, UNIT MIX, OTHER INCOME, TAX.

**MODULE_REGISTRY** (`backend/src/services/module-wiring/module-registry.ts:91`) catalogues M01–M27, M29.

- **Rendered footprint confirmed:** M01 (Overview), M02 (Zoning), M04 (Supply), M05 (Market), M07 (Traffic), M08 (Strategy), M09 (Pro Forma/F9), M11 (Capital Structure) — all map to a live Deal Capsule tab.
- **Metadata-only / partial:** M03 (Dev Capacity — "Partial", placeholder), M10 (Scenario Engine — defined but often merged into Sensitivity, and overlaps the F9 SCENARIOS tab noted above), M12–M25 — mostly registry stubs with limited or no functional UI today.

**Four institutional-model sections:**

| Section | Status | file:line |
|---|---|---|
| Sources & Uses | **EXISTS** | `frontend/src/pages/development/financial-engine/SourcesUsesTab.tsx` (confirmed present); also surfaced in terminal `CapitalTab.tsx:33` |
| Debt schedule | **EXISTS** | `frontend/src/pages/development/financial-engine/DebtTab.tsx` (confirmed present, amortization build ~`:140`, multi-loan support) |
| Sensitivity | **EXISTS** | `SensitivityTab.tsx` — 2-way heatmap + Goal Seek widget |
| Waterfall | **EXISTS** | `frontend/src/pages/development/financial-engine/WaterfallTab.tsx` (confirmed present); also `terminal/tabs/CapitalTab.tsx:125` |

All four institutional sections already exist as dedicated surfaces — this is a rehoming exercise for these four, not a build.

---

## B4 · Strategy & scenario touchpoints

BTS/Flip/Rental/STR are represented via **`proformaTemplateId`** branching inside `ProFormaSummaryTab.tsx:89-93`, keyed off `investment_strategy_lv` (the nullable LV field noted in `replit.md` gotchas). Row sets live in `proforma-template-row-sets.ts` (`FLIP_BASIS_ROWS`, `FLIP_EXIT_ROWS`, `STR_REVENUE_ROWS`, land-hold rows).

**This is logic branching, not separate assumption copies or computed variants** — one component conditionally swaps which `TemplateRowDef[]` it renders. Practically: for FLIP/STR/LAND HOLD templates, the component currently renders a **"Not Yet Supported" overlay instead of the actual rows** (`ProFormaSummaryTab.tsx:1492-1520`). So while the row-set data model exists, the strategies beyond standard rental are **not functionally live today** — this is a bigger gap than "needs rehoming," it's a gap the migration must decide whether to inherit or finally close.

---

## Gap Register

**SPEC'D-NOT-BUILT:**
- Bridge Decomposition (`Δ_market + Δ_platform + Δ_operator + Δ_capex`) promised by `M09_PROFORMA_SPEC.md` — no corresponding computed breakdown found in the runner or UI.
- Tiered stabilization-timing resolution (`user > agent > traffic_engine > platform_default`) promised by `PROFORMA_TIMELINE_MODEL_SPEC.md` — not confirmed as implemented in this pass (needs a dedicated follow-up read of `stabilization.service.ts` against the spec's exact tier order).

**BUILT-NO-SPEC:**
- Client-side debt service formula (`ProFormaSummaryTab.tsx:711-727`) — no spec document backs this specific implementation, and it duplicates logic that should live once in the runner/`DebtTab`.
- `noiAfterReserves` adjustment (`ProFormaSummaryTab.tsx:702-704`) — not traced to any of the four cited specs.

**STRUCTURAL (not mechanical, needs its own gated dispatch):**
- **Two live engines**: Engine A (`proforma-adjustment.service.ts`, canonical production) and Engine C (`financial-model-engine.service.ts`, LLM-compatible deterministic runner) both exist per `F9_MODULE_MAP.md`. Any chassis migration must state which engine the chassis reads from, or risk building on top of two sources of truth.
- **FLIP/STR/LAND HOLD non-functional overlay**: the template row-set data model exists but is gated behind a "not yet supported" block. A migration to strategy overlays needs an explicit decision: inherit the current non-functional state, or treat this as the moment to finish it.
- **SCENARIOS tab vs. M10 Scenario Engine**: F9's own SCENARIOS tab (`ScenarioManagementTab.tsx`) appears to duplicate/precede the registry's M10 module, which is itself only partially built. Needs a decision on which is canonical before either is migrated.
- **Terminal FinancialsTab duplication**: the terminal surface independently re-renders the 10-year operating statement and assumption cards that also exist in F9's PROJECTIONS and CONSOLE→INPUTS tabs, against overlapping but not identical data sources (`deal.model`/`deal.latestModel` hybrid vs. F9's `deal_financial_models`/`periodic_seed`). This is a duplicate-surface risk independent of the chassis migration and should be sequenced against it, not folded in blind.

---

## Rehoming Risks (flagged for operator decision, not decided here)

1. **SCENARIOS (F9) vs. M10 (registry)** — ambiguous which is canonical; migrating either without resolving the other risks orphaning data or UI.
2. **FLIP/STR/LAND HOLD templates** — chassis home is moot if the feature stays non-functional; the migration plan needs to know whether "strategy overlay" work is inheriting a stub or a real feature.
3. **Two-engine split (A vs. C)** — the chassis must pick a read source; this is a prerequisite decision, not a rehoming detail.
4. **Debt-service dual implementation** (client-side in ProFormaSummaryTab vs. DebtTab/runner) — whichever chassis section owns "debt," the duplicate client math should be retired in the same pass or it will silently drift from the canonical figure.
5. **Terminal FinancialsTab vs. F9 PROJECTIONS/CONSOLE** — two surfaces render materially the same content from adjacent-but-different data sources; migrating F9 alone without addressing terminal leaves a stale twin.

---

**STOP.** This blueprint is a rehoming map for operator review. No migration, spec ratification, or code changes have been made as part of this dispatch.

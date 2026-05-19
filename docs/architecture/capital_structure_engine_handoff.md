# Capital Structure Engine — Build Handoff

## What This Is

Replace the Debt tab (M11) with a full Capital Structure Engine. This module also absorbs Debt Market and Capital Events — those become tabs inside this engine instead of separate sections.

**The decision it answers:** "How should I capitalize this deal to maximize risk-adjusted returns given my chosen strategy?"

---

## Files to Attach

Attach these 7 files. Claude needs them to match your patterns.

1. `capital_structure_engine.jsx` — THE SPEC (7 sections, formulas F40-F66)
2. `DebtSection.tsx` — Component being replaced (688 lines, shows pattern)
3. `debtMockData.ts` — Types to migrate (514 lines)
4. `FinancialSection.tsx` — ProForma integration target (516 lines)
5. `financial.types.ts` — Shared type system
6. `DealPageEnhanced.tsx` — Where it gets mounted
7. `DealModuleContext.tsx` — Cross-module event bus (already built)

---

## The Prompt

Copy-paste this to Claude after attaching the files:

```
Build the Capital Structure Engine for JEDI RE. This replaces DebtSection.tsx.

TECH STACK: React 18 + TypeScript + Vite + Tailwind (custom theme, no shadcn/radix). Follow the EXACT patterns from the attached files.

WHAT TO BUILD (Phase 1 — frontend + mock data only):

1. `types/capital-structure.types.ts` (~150 lines)
   - CapitalLayer (type: 'senior_debt' | 'mezz' | 'equity' | 'incentive', amount, rate, term, etc.)
   - CapitalStack (layers[], totalSources, totalUses, sourcesEqualsUses boolean)
   - DebtProduct (name, type, rate, ltv, term, io_period, strategy_fit[])
   - EquityWaterfall (tiers[], lpEquity, gpEquity, prefReturn, catchUp, promoteSchedule)
   - RateEnvironment (fedFunds, treasury10y, sofr, cyclePhase, lockVsFloatNPV)
   - CapitalEvent (type: 'refi' | 'recap' | '1031' | 'disposition', date, details)
   - CapitalStructureState (extends the DealModuleContext financial slice)

2. `data/capitalStructureMockData.ts` (~400 lines)
   - 5 strategy templates: BTS (construction loan), Flip (hard money), Rental Value-Add (bridge→perm), Rental Stabilized (agency), STR (DSCR loan)
   - Each template has realistic layers, rates, terms from the Strategy × Debt Matrix in the spec
   - Mock rate environment with current-ish numbers
   - Mock equity waterfall with 3-tier promote
   - Mock capital events timeline

3. `components/deal/sections/CapitalStructureSection.tsx` (~800 lines)
   6 tabs inside this one component:
   - Tab 1: CAPITAL STACK DESIGNER — Interactive stacked bar showing debt/equity/mezz layers. Strategy dropdown auto-loads template. Sources = Uses validation (hard constraint). Visual hero element.
   - Tab 2: DEBT PRODUCT SELECTOR — Cards for each debt product (construction, hard money, agency, CMBS, DSCR). Strategy-based highlighting. Mismatch warnings.
   - Tab 3: RATE ENVIRONMENT — Fed/Treasury/SOFR display. Cycle phase classification. Lock vs float analysis.
   - Tab 4: EQUITY WATERFALL — LP/GP distribution calculator with multi-tier promotes. Visual stepped bar chart.
   - Tab 5: SCENARIO COMPARISON — Side-by-side capital structures (e.g., 70/30 vs 80/20 leverage).
   - Tab 6: CAPITAL LIFECYCLE — Horizontal timeline: acquisition → hold → exit. Shows refi events, rate resets, LP distributions. This replaces the old Capital Events section.

   CRITICAL PATTERNS:
   - Component receives `deal: Deal` prop (see DealPageEnhanced pattern)
   - Use `useDealMode()` hook for pipeline vs owned mode
   - Use `useDealModule()` for cross-module events
   - Wrap in <DealSection> like every other section
   - Tab navigation follows ZoningModuleSection pattern (best example in codebase)
   - Every data element needs 3 layers: DATA → INSIGHT → ACTION

   STRATEGY-AWARENESS IS THE KEY FEATURE:
   - When user selects "Flip" in Strategy tab → Capital Structure auto-loads hard money template
   - When user selects "Rental" → loads agency debt template  
   - When user selects "BTS" → loads construction loan template
   - Mismatch warnings: "10yr fixed for a flip = prepayment penalty eats 3.2% of your profit"

4. Update `DealPageEnhanced.tsx` — 3 changes:
   - Import: swap DebtSection → CapitalStructureSection
   - Tab nav: change { id: 'debt', icon: '💳', title: 'Debt' } → { id: 'capital-structure', icon: '◈', title: 'Capital Structure' }
   - Render: mount <CapitalStructureSection deal={deal} />

DO NOT delete DebtSection.tsx — rename to DebtSection.legacy.tsx.

OUTPUT: Give me all 4 files with complete, production-ready code. No placeholders, no "// TODO" comments, no abbreviated sections.
```

---

## What It Should Produce

4 files totaling ~1,500 lines:

| File | Lines | Key Thing to Check |
|------|-------|--------------------|
| `capital-structure.types.ts` | ~150 | CapitalLayer has strategy_fit field |
| `capitalStructureMockData.ts` | ~400 | 5 strategy templates with realistic numbers |
| `CapitalStructureSection.tsx` | ~800 | 6 working tabs, strategy dropdown loads templates |
| `DealPageEnhanced.tsx` | 2 lines changed | Old debt → new capital structure |

---

## Quick Validation

After build, check these 10 things:

- [ ] Strategy dropdown exists and loads different templates
- [ ] Capital stack bar shows layers that add up (sources = uses)
- [ ] Debt products highlight based on selected strategy
- [ ] Mismatch warning appears when product doesn't fit strategy
- [ ] Equity waterfall shows LP/GP split with promote tiers
- [ ] Rate environment shows cycle phase (Peak/Easing/Trough/Tightening)
- [ ] Timeline tab shows financing events on horizontal axis
- [ ] Tab navigation works (6 tabs, smooth transitions)
- [ ] Component matches Tailwind theme from other sections
- [ ] DealPageEnhanced renders the new section without errors

---

## How It Connects (see Module Wiring Map for full details)

```
M08 Strategy ──→ emits 'strategy-selected' ──→ Capital Structure loads template
Capital Structure ──→ emits 'capital-updated' ──→ M09 ProForma reads debt service
Capital Structure ──→ updates financial.dscr, financial.ltv ──→ M14 Risk reads covenant exposure
Capital Structure ──→ provides exit debt balance ──→ M12 Exit calculates net sale proceeds
```

These cross-module events use the existing DealModuleContext. Phase 1 is mock data only — the wiring happens in Phase 2.

---

## Modules This Replaces

| Old Module | What Happens | Where It Goes |
|-----------|-------------|--------------|
| Debt Section (M11) | REPLACED | → Capital Structure tabs 1-3 |
| Debt Market Section | ABSORBED | → Capital Structure tab 3 (Rate Environment) |
| Capital Events Section | ABSORBED | → Capital Structure tab 6 (Capital Lifecycle) |

Net effect: 3 tabs become 1 tab with 6 internal tabs. Fewer clicks, single source of truth.

---

## Phase 3 Shipping Status (as of 2026-05-19)

The core product capability of Phase 3 — the Pareto frontier with role-aware sorting and plausibility banding — is shipped via the cashflow postprocessor fallback (F-jgs-1). What is and is not built:

### Shipped

| Capability | Where | Notes |
|-----------|-------|-------|
| 5-bundle Pareto frontier | `backend/src/agents/tools/run_joint_goal_seek.ts` | HUD 221(d)(4), Agency Fixed, Agency Floating, Bridge, CMBS — each evaluated against their own LTV ceiling, rate, IO period, and DSCR floor |
| Bisection LTV optimization per bundle | `backend/src/agents/tools/optimize_capital_structure.ts` | Called once per bundle; finds highest feasible LTV satisfying the bundle's DSCR floor |
| Role-aware Pareto sorting | `run_joint_goal_seek.ts` lines 448–482 | sponsor → GP IRR desc; LP → LP IRR desc (tiebreaker: LP dist. yield); lender → min DSCR desc |
| LP cash flow model | `run_joint_goal_seek.ts` `computeLpMetrics()` | Year-by-year LP operating CF + LP exit proceeds at 90% LP equity split; bisection IRR solver |
| Plausibility scoring | `backend/src/services/sigma/sigma-engine.ts` `computePlausibility()` | Mahalanobis distance against a market comps distribution; bands: Realistic / Stretch / Aggressive / Heroic / Unrealistic |
| Postprocessor fallback | `backend/src/agents/cashflow.postprocess.ts` lines 817–864 | Fires after every cashflow run when `pareto_frontier` absent; writes to `proforma.capital_structure.optimization` |
| CS defaults seeding | `backend/src/services/proforma-seeder.service.ts` `seedCapitalStructureDefaults()` | ltv_pct=0.75, gp_equity_pct=0.10, lp_equity_pct=0.90, preferred_return_pct=0.08, debt_rate=FRED DGS10+200bps |
| Single-bundle CS optimization | `optimize_capital_structure.ts` (postprocessor fallback) | Also fires via postprocessor; writes to `proforma.capital_structure.optimization.{optimal_ltv, primary_metric, ...}` |

### Not Yet Built (Phase 2 scope)

| Capability | Description | Dependency |
|-----------|-------------|------------|
| Σ matrix (joint distribution math) | Full covariance matrix per bundle modeling joint distribution of returns; rolling window factor models | Historical observations corpus (see `HISTORICAL_OBSERVATIONS_SPEC.md`) |
| Regime detection | Rate-environment-conditional recommendations ("in a high-cap-rate regime…") | Σ matrix + regime classification |
| Distributional stress testing | Tail risk assessment; IRR distribution under different scenarios | Σ matrix |
| `POST /api/sigma/plausibility` REST endpoint | Standalone plausibility check without a full cashflow run | Low priority — current path via postprocessor covers most cases |
| Per-variable aggressiveness decomposition | `mahalanobisD` + `perVariableContribution[]` per the M36 contract in `deal-journey-framework.md` Section 6.3 | Requires full Σ matrix |
| UI rendering — Alternative Structures tab | Frontend consuming `pareto_frontier` from agent output | Data layer complete; UI wiring is a separate frontend task |

---

## Role Resolution — How Platform Role Is Determined

This is platform infrastructure the original spec did not explicitly document. Applies to `run_joint_goal_seek` and any future tool that needs user-context-aware sorting.

### Resolution chain

```
1. requesting_user_id present?
   YES → query investors.type WHERE user_id = requesting_user_id
         'lp'                  → resolvedRole = 'lp'
         'gp' | 'co_invest'   → resolvedRole = 'sponsor'
         other / no row       → fall through to step 2
   NO  → fall through to step 2

2. Use LLM-provided platform_role from tool input (default: 'sponsor')
```

### Why requesting_user_id (not deal owner's user_id)

In a multi-user collaborative deal, the deal owner is a GP/sponsor. An LP or lender who has been given access to that deal should see the Pareto frontier sorted by LP IRR or DSCR — not by the owner's GP IRR. Using `requesting_user_id` (the authenticated user currently viewing the deal) rather than `deals.user_id` (the deal creator) produces the correct sorting for every viewer independently.

### Where this is injected

The requesting user's ID is injected into the cashflow agent's system prompt as `REQUESTING_USER_ID`. The agent includes it when calling `run_joint_goal_seek`. If the agent omits it, the DB lookup step is skipped and the LLM-provided `platform_role` is used as fallback.

### investors table

| Column | Values | Maps to |
|--------|--------|---------|
| `type` | `'lp'` | `resolvedRole = 'lp'` |
| `type` | `'gp'` | `resolvedRole = 'sponsor'` |
| `type` | `'co_invest'` | `resolvedRole = 'sponsor'` |
| `type` | `'lender'` or null | LLM fallback (lender type not stored in investors table) |

**Implementation:** `run_joint_goal_seek.ts` lines 399–435.

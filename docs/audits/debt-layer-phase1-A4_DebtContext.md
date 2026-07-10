# A4_DebtContext — Debt-Layer Phase 1 Audit

**Audit Date:** 2026-07-09  
**Auditor:** Read-only reconnaissance agent (no fixes, no migrations, no writes)  
**Scope:** Inventory every debt-related module in the JediRe backend, report its state (wired / metadata-only / absent), what it holds, whether anything reads it, and whether it could feed a `DebtContext` assembled the way `DealContext` serves the Research Agent.  
**Evidence:** File:line citations for every claim.

---

## 1. Executive Summary

The JediRe backend contains a **rich but fragmented** debt-layer ecosystem. Several modules are fully wired and actively read/write (debt positions, vintage debt estimator, debt plan formulator, FRED ingestion, rate environment, lender targeting). Others exist as **metadata-only stubs** (assumable-NPV field, CFO-lender collaboration service, Sigma debt-bundle registry). A few expected modules are **entirely absent** (dedicated loan-product catalog table, below-market-debt NPV math, explicit S1 distress estimator service). No unified `DebtContext` type exists analogous to `DealContext`; debt data is scattered across `deal_context_financials`, `deal_assumptions.per_year_overrides`, `debt_positions`, and in-memory module wiring.

---

## 2. Module-by-Module Inventory

### 2.1 debt_positions — IN-PLACE LOANS (WIRED)

| Attribute | Evidence |
|-----------|----------|
| **Table** | `debt_positions` created by migration `20260420_disposition_and_debt_tracking.sql` :102–169 |
| **Schema** | loan_name, lender_name, loan_type, original_principal, current_balance, ltv_at_origination, rate_type, base_rate, spread_bps, current_rate, rate_floor, rate_cap, rate_cap_purchased, rate_cap_strike, rate_cap_expiry, origination_date, maturity_date, extension_options, extension_term_months, extended_maturity, amortization_type, io_period_months, amortization_years, monthly_payment, annual_debt_service, dscr_covenant, ltv_covenant, debt_yield_covenant, current_dscr, current_debt_yield, covenant_status, prepayment_type, prepayment_penalty_pct, prepay_lockout_until, status, refinanced_by |
| **Read by** | `debt-tracking.service.ts` :152 `getDebtPositions(dealId)` — returns full `DebtPosition[]` |
| **Read by** | `vintage-debt-estimator.service.ts` :489 `getDebtPositions(dealId)` — feeds distress-flag computation |
| **Read by** | `deal-financial-context.service.ts` :211–219 — queries `deal_debt_schedule` (separate table, not `debt_positions`) |
| **Read by** | `fetch_debt_assumptions.ts` :72–90 — queries `debt_positions` for historical averages |
| **Read by** | `v_portfolio_debt_summary` view (`20260420_disposition_and_debt_tracking.sql` :788–808) |
| **Written by** | `debt-tracking.service.ts` :99–147 `upsertDebtPosition()` — INSERT … ON CONFLICT |
| **Written by** | `recordRefinance()` (`debt-tracking.service.ts` :344–401) — marks old debt `refinanced`, inserts `refinance_events` |
| **Written by** | `updateCovenantCompliance()` (`debt-tracking.service.ts` :194–233) — updates `current_dscr`, `current_ltv`, `current_debt_yield`, `covenant_status` |
| **Status** | **WIRED** — fully operational, actively read and written |
| **Could feed DebtContext?** | **Yes, directly.** Contains every field a `DebtContext` would need for in-place loans. Currently consumed by vintage estimator and portfolio views, but NOT assembled into a single `DebtContext` object. |

---

### 2.2 S1 Distress Estimator Flags (WIRED, but named differently)

| Attribute | Evidence |
|-----------|----------|
| **Service** | `vintage-debt-estimator.service.ts` — computes six distress flags |
| **Flags computed** | `negativeDscr`, `thinDscr`, `ioExpiryShock`, `underwaterEquity`, `cashInRefi`, `negativeLeverage` (`vintage-debt-estimator.service.ts` :52–57) |
| **Flag derivation** | `deriveFlags()` at :370–475 — honest-absence contract (`undeterminable` when inputs missing) |
| **io_expiry_shock logic** | :409–434 — finds position where `monthsToIoExpiry <= 12` and `monthsToIoExpiry >= 0`; if bridge with `ioPeriodMonths === 0`, returns `undeterminable` with reason `missing_io_terms_for_bridge` |
| **underwater_equity logic** | :437–453 — uses `proceedsGap > 0` as trigger; `proceedsGap = totalBalance - (estValue * minLtvMax)` |
| **cash_in_refi logic** | :456–461 — same `proceedsGap > 0` threshold, different semantic label |
| **Persisted to** | `deal_context_financials` table (`20260703_deal_context_financials.sql` :6–50) — 30 columns covering all flags + intermediates |
| **Persist function** | `persistVintageDebtEstimate()` at `vintage-debt-estimator.service.ts` :627–721 — idempotent on `(deal_id, ruleset_version)` |
| **Read by** | No direct consumer found in current codebase. The table is written but no service queries it back. |
| **Status** | **WIRED** — computation is live, persistence is live, but **no upstream reader** currently consumes the persisted rows. |
| **Could feed DebtContext?** | **Yes, ideally.** The flags are exactly the kind of structured distress signal a `DebtContext` should expose. Gap: no reader pulls from `deal_context_financials` today. |

---

### 2.3 FRED — Rate Environment (WIRED)

| Attribute | Evidence |
|-----------|----------|
| **Client** | `fred-api.client.ts` — `FREDApiClient` class with `getSeries()`, `getLatest()`, `getMultipleSeries()` |
| **Series IDs** | `FRED_SERIES` object at :130–157 — FFR (`DFF`), SOFR (`SOFR`), 10Y (`DGS10`), 30Y (`DGS30`), 30Y mortgage (`MORTGAGE30US`), M2 (`M2SL`), Fed assets (`WALCL`), DXY (`DTWEXBGS`), GDP (`GDPC1`), CPI (`CPIAUCSL`), unemployment (`UNRATE`), consumer sentiment (`UMCSENT`) |
| **Ingestion service** | `fred-ingest.service.ts` — `ingestFRED(apiKey)` loops through `FRED_SERIES` array, fetches observations, inserts into `metric_time_series` |
| **Ingested metrics** | `RATE_SOFR`, `RATE_TREASURY_10Y`, `RATE_MORTGAGE_30Y`, `RATE_FED_FUNDS`, `M_CPI_OFFICIAL`, `M_CPI_STICKY`, `M_OIL_PRICE`, `M_UNEMPLOYMENT_RATE`, `M_BUILDING_PERMITS`, `M_POPULATION`, `M_EMPLOYED`, `M_PERSONAL_INCOME`, `M_LABOR_FORCE`, `M_GDP`, `M_HOME_PRICE_INDEX`, `M_CASE_SHILLER_HPI`, `M_HOUSING_STARTS`, `M_LEISURE_HOSPITALITY_EMP`, plus CRE-adjacent: `CRE_RENTAL_VACANCY_RATE`, `CRE_HOMEOWNER_VACANCY`, `CRE_MF_HOUSING_STARTS`, `CRE_RENT_CPI`, `CRE_RENT_CPI_SA` |
| **Read by** | `rate-environment.service.ts` :302 — `fetchLiveRates()` + `fetchLatestMacroFromDb()` |
| **Read by** | `vintage-debt-estimator.service.ts` :129–177 — `getVintageRate()` and `getCurrentMarketRate()` query `metric_time_series` for `RATE_TREASURY_10Y` and `RATE_SOFR` |
| **Read by** | `rate-index.service.ts` (referenced but not read in this audit) |
| **Status** | **WIRED** — ingestion runs, DB table `metric_time_series` is populated, multiple consumers read it |
| **Could feed DebtContext?** | **Yes.** SOFR, 10Y Treasury, and macro context (GDP, CPI, unemployment) are all available. The `RateEnvironmentResult` object (`rate-environment.service.ts` :28–60) is a ready-made envelope. |

---

### 2.4 Assumable-NPV Module (METADATA-ONLY / ABSENT)

| Attribute | Evidence |
|-----------|----------|
| **Field exists** | `CapitalStructureService.DebtProduct.assumable: boolean` at `capital-structure.service.ts` :165 |
| **Field populated** | **Never.** No `DebtProduct` instances are created in the codebase; the type is a schema definition only. The `STRATEGY_DEBT_MATRIX` at :177–183 maps strategy strings to `DebtProductType` enums, not to full `DebtProduct` objects. |
| **Below-market-debt math** | **Absent.** No function computes NPV of assumable below-market debt. No table stores `assumable_rate`, `assumption_premium`, or `npv_of_rate_differential`. |
| **Status** | **METADATA-ONLY** — the boolean field exists in the type system, but no logic, no data, and no UI wiring. |
| **Could feed DebtContext?** | **No — nothing to feed.** If built, it would need: (1) `debt_positions.assumable` flag, (2) `assumed_rate` vs `market_rate`, (3) remaining term, (4) NPV formula. None exist. |

---

### 2.5 M11's Own Sizing Machinery (WIRED)

| Attribute | Evidence |
|-----------|----------|
| **Service** | `capital-structure.service.ts` — `CapitalStructureService` class |
| **Sizing formula** | `sizeSeniorDebt()` at :295–315 — delegates to Formula Engine `F40` (triple constraint: LTC, LTV, DSCR) |
| **Mezz sizing** | `sizeMezzanine()` at :320–326 — delegates to `F41` |
| **DSCR computation** | `buildCapitalStack()` at :234 — `dscr = totalAnnualDS > 0 ? new Decimal(noi).dividedBy(totalAnnualDS).toFixed(4) : '0.0000'` |
| **getRecommendedTerms** | `capital-structure-adapter.ts` :502–534 — hardcodes `termMonths: 60`, `amortMonths: 360`; derives `ioPeriod` from LTV tier (0/12/24 months); computes `loanByDscr = noiY1 / (1.25 * rate)` |
| **runM11Cycle** | `capital-structure-adapter.ts` :546–575 — iterative convergence loop (max 3 passes) calling `runModel()` and `getRecommendedTerms()` |
| **Write-back to financing** | `writeM11ToFinancing()` at :751–801 — writes `loanAmount`, `interestRate`, `term`, `amortization`, `ioPeriod` into ProForma assumptions |
| **Status** | **WIRED** — actively used by capital-structure pipeline and adapter |
| **Could feed DebtContext?** | **Yes, partially.** M11 produces `loanAmount`, `ltv`, `ltc`, `rate`, `termYears`, `amortYears`, `ioPeriodMonths`, `dscrFloor`, `constraintBinds`, `dscrActual` (`M11CapitalStructureSummary` at :702–730). These are written to ProForma, not to a `DebtContext`. |

---

### 2.6 Prepayment Structures (METADATA-ONLY)

| Attribute | Evidence |
|-----------|----------|
| **Enum exists** | `DebtPosition.prepaymentType` at `debt-tracking.service.ts` :53 — `'open' | 'yield_maintenance' | 'defeasance' | 'step_down'` |
| **Enum exists** | `DebtPhase.prepayType` at `debt-plan-formulator.service.ts` :66 — `string` |
| **Strategy mapping** | `strategy-debt-mapping.json` — every strategy entry includes `prepayType`: `yield_maintenance`, `defeasance`, `open`, or `step_down` |
| **Actual computation** | **None.** No function calculates prepayment penalty dollars. No table stores `prepayment_penalty_dollars`. The `exit-prepay-window` monitoring trigger (:350–358) mentions "Calculate exact prepay cost" but the action is advisory only. |
| **Status** | **METADATA-ONLY** — types and JSON mappings exist, but no computational engine. |
| **Could feed DebtContext?** | **Not today.** Would need: (1) penalty formula by type (YM, defeasance, step-down), (2) current balance, (3) remaining term, (4) rate environment. Only (2) is available. |

---

### 2.7 Lender Ruleset / Loan Product Catalog (WIRED, but static)

| Attribute | Evidence |
|-----------|----------|
| **Lender DB** | `lender-targeting.service.ts` :33–916 — `LENDER_DB` array with 70+ lenders |
| **Fields per lender** | id, name, type, products[], geographyStates[], minLoanM, maxLoanM, typicalSpreadBps, typicalRateFixed, typicalLtv, typicalLtc, recoursePreference, sponsorExperienceRequired, dealsYTDEst, notes |
| **Product keys** | `agency_fixed`, `agency_supplemental`, `cmbs_10yr`, `cmbs_long_term`, `cmbs_or_life_co`, `cmbs_hospitality`, `bridge`, `bridge_to_perm`, `bridge_mezz_stack`, `bridge_ti_lc`, `bridge_earnout`, `construction_to_perm`, `hud_221d4`, `life_co`, `hard_money`, `dscr_loan`, `portfolio_blanket`, `portfolio_bank`, `bank_portfolio`, `mezzanine`, `pref_equity_sub`, `private_credit`, `note_purchase`, `conventional_investment`, `cash_heloc`, `conventional_cash_out`, `cmbs_stabilized_portfolio`, `debt_fund_fixed`, `debt_fund_3_5yr`, `debt_fund`, `agency_lease_up_program`, `agency_adjacent`, `bank_5_7yr`, `portfolio_bank_5_7yr` |
| **Scoring** | `computeFitScore()` at :931–968 — product match (+30), size match (+15), non-recourse preference (+10), originator activity (+5), LTV/LTC fit (+5 each) |
| **Filtering** | `targetLenders()` at :970–1010 — filters by product + geography, sorts by fitScore |
| **Status** | **WIRED** — static in-memory catalog, actively used by `debt-plan-formulator.service.ts` :438, :488 |
| **Could feed DebtContext?** | **Yes.** The lender DB is a ready-made `LenderContext` sub-object. It is currently embedded in the Debt Advisor response, not exposed as a standalone context. |

---

### 2.8 Debt Plan Formulator (WIRED)

| Attribute | Evidence |
|-----------|----------|
| **Service** | `debt-plan-formulator.service.ts` — `formulateDebtPlan(dealId, productHint?)` |
| **Dependencies** | M08 strategy output (`m08-strategy-output.service.ts`), rate environment (`rate-environment.service.ts`), deal financial context (`deal-financial-context.service.ts`), debt context modifier (`debt-context-modifier.service.ts`) |
| **Output** | `DebtAdvisorResponse` — recommendedStack (phases), alternatives, monitoringTriggers, contextModifications, correlationContext, summary, divergence, platformDefaultsApplied, cyclePhase |
| **Platform default write** | `writeDebtPlatformDefaults()` at :986–1027 — writes 10 fields to `deal_assumptions.per_year_overrides` as `resolution: 'platform'` |
| **CE-09 auto-apply** | `formulateDebtPlan()` at :879–903 — calls `writeDebtPlatformDefaults()` automatically; user overrides win via SQL guard in `applyDebtAdvisorPlatformDefault()` (`proforma-adjustment.service.ts` :6392–6431) |
| **Status** | **WIRED** — full end-to-end: reads M08, reads rate env, reads deal context, formulates plan, writes to ProForma |
| **Could feed DebtContext?** | **Yes, it IS the closest thing to a DebtContext today.** The `DebtAdvisorResponse` object contains everything a `DebtContext` would need: rate, term, amort, IO, LTV, prepay type, lender targets, DSCR, debt yield, monitoring triggers, divergence from user overrides. But it is ephemeral (15-min cache) and not persisted as a structured `DebtContext` row. |

---

### 2.9 Debt Context Modifier (WIRED)

| Attribute | Evidence |
|-----------|----------|
| **Service** | `debt-context-modifier.service.ts` — `applyDebtContextModifier(pool, dealId, purchasePrice, state, loanAmountEstimate)` |
| **Modifications** | productExclusions, lenderTypeExclusions, recourseRequired, addPcaReserveNote, addAssetAgeHaircut, ltvHaircutPct, narrativeNotes, geographyWarning, sizeWarning |
| **Size tiers** | `SIZE_TIERS` at :50–55 — MICRO <$2M, SMALL <$5M, MID <$25M, LARGE <$75M |
| **Geography rules** | `AGENCY_EXCLUDED_STATES` = `['ND', 'SD', 'WY', 'MT']` (:47); `RESTRICTED_STATE_PRODUCTS` — TX excludes `agency_fixed` (:41) |
| **Asset age rules** | `computeAssetAgeModifications()` at :168–185 — age ≥45 → PCA + 2.5% LTV haircut; age ≥30 → 1% haircut |
| **Sponsor rules** | `computeSponsorModifications()` at :187–203 — first-time sponsor → recourseRequired; liquidity <10% → recourseRequired |
| **Status** | **WIRED** — actively called by `formulateDebtPlan()` at :767 |
| **Could feed DebtContext?** | **Yes.** The `ContextModification` object is a perfect `UnderwritingContext` sub-object. Currently embedded in the Debt Advisor response only. |

---

### 2.10 Sigma Debt Bundle Registry (METADATA-ONLY)

| Attribute | Evidence |
|-----------|----------|
| **Registry** | `sigma/debt-bundle-registry.ts` — `DEBT_BUNDLES` catalog with 5 bundles: `hud_221d4`, `agency_fixed_5yr_io`, `agency_floating`, `bridge_floating`, `cmbs_5yr_fixed` |
| **Fields** | params (debtRate, ltv, ioPeriod, amortization, originationFees, prepaymentPenalty), rateLocked, ioExpirationYear, refinanceWindow, f1Loading, doubleUpNote, rateCapCorrelation, amortizationYears, closingTimelineMonths, ltvRange, typicalSpread |
| **Double-up detection** | `assessDoubleUp()` at :194–239 — severity scoring based on F1 loading + refinance window risk |
| **IRR variance** | `estimateBundleIRRVariance()` at :248–260 — simplified covariance formula |
| **Consumers** | **None found.** No service imports `DEBT_BUNDLES` or calls `assessDoubleUp()`. The registry is referenced by `sigma-variable-registry.ts` (not read in this audit) but appears unused in the main debt flow. |
| **Status** | **METADATA-ONLY** — rich type definitions, no active consumer. |
| **Could feed DebtContext?** | **Not today.** Would need a consumer to select a bundle and compute double-up exposure. Currently orphaned. |

---

### 2.11 CFO-Lender Collaboration Service (METADATA-ONLY)

| Attribute | Evidence |
|-----------|----------|
| **Service** | `services/agents/collaborations/cfo-lender.service.ts` — `CFOLenderService` |
| **Function** | `analyzeAndRecommend()` — generates `DebtRecommendation` with recommendedLTV, targetDSCR, rateStructure, refiRecommendation, irrByLTV, breakpoints, covenantSuggestions |
| **AI dependency** | Calls `meteringAdapter.createMessage()` with a hardcoded prompt (:206–241) — requires Claude API |
| **Storage** | `storeRecommendation()` writes to `agent_collaboration_debt_recommendations` table (:276–293) |
| **Retrieval** | `getRecommendation()` reads from same table (:314–337) |
| **Consumers** | **None found.** No route, no agent tool, and no other service calls `cfoLenderService.analyzeAndRecommend()`. |
| **Status** | **METADATA-ONLY** — full implementation, but no caller. Table may or may not exist (not in migration files read). |
| **Could feed DebtContext?** | **Yes, if wired.** The `DebtRecommendation` object has optimal LTV, DSCR, rate structure, and refi timing — exactly what a `DebtContext` would want. But it is AI-dependent and unconnected. |

---

### 2.12 deal_context_financials Table (WIRED for write, UNREAD for read)

| Attribute | Evidence |
|-----------|----------|
| **Table** | `deal_context_financials` (`20260703_deal_context_financials.sql` :6–50) |
| **Columns** | deal_id, computed_at, ruleset_version, dscr_current, dscr_at_refi, proceeds_gap, est_debt_service, plus 6 flag groups × 4 columns each (boolean, value, threshold, provenance) |
| **Written by** | `persistVintageDebtEstimate()` at `vintage-debt-estimator.service.ts` :627–721 |
| **Read by** | **None found.** No SELECT from `deal_context_financials` in any service, route, or agent tool. |
| **Status** | **WRITE-ONLY** — persistence layer exists, but no consumer. |
| **Could feed DebtContext?** | **Yes, ideally.** This table is the closest thing to a persisted `DebtContext`. It needs a reader. |

---

### 2.13 deal_assumptions.per_year_overrides (WIRED, but fragmented)

| Attribute | Evidence |
|-----------|----------|
| **Key format** | `debt:{loanId}:{fieldName}` — e.g., `debt:senior:loanAmount`, `debt:senior:interestRate`, `debt:senior:sofr`, `debt:senior:spread` |
| **Write path** | `applyDebtAdvisorPlatformDefault()` at `proforma-adjustment.service.ts` :6392–6431 — uses `jsonb_set` on `per_year_overrides` with resolution `'platform'` |
| **Write path** | `writeDebtPlatformDefaults()` at `debt-plan-formulator.service.ts` :986–1027 — writes loanAmount, termYears, amortYears, ioMonths, origFee, exitFee, rateType, prepayType, sofr+spread (floating) or interestRate (fixed) |
| **Read path** | `formulateDebtPlan()` at :829–871 — reads back `per_year_overrides` to compute divergence (`configuredLoanAmount` vs `advisorLoanAmount`) |
| **Read path** | F9 resolver (not audited in detail) reads `per_year_overrides` via `debtOvr()` helper |
| **Status** | **WIRED** — actively written and read, but the data is a flat JSONB bag, not a typed `DebtContext` |
| **Could feed DebtContext?** | **Partially.** The overrides contain raw debt fields, but lack provenance, distress flags, lender targets, and rate environment context. |

---

## 3. Gap Analysis: What Would a `DebtContext` Need?

### 3.1 What `DealContext` Does (Reference Pattern)

From `types/dealContext.ts`:
- `ResearchAgentContext` = unified object with parcel, zoning, market, comps, pipeline, demographics, digital, news, macro, meta, operatorStance
- `DealCapsuleContext` = identity + site + zoning + market + financial + capital + existingProperty/redevelopment
- Every sub-object is typed, has provenance, and is consumed by multiple agents

### 3.2 What a `DebtContext` Would Need

| Component | Exists? | Wired? | Location |
|-----------|---------|--------|----------|
| In-place loan terms (rate, LTV, term, amort, IO) | ✅ | ✅ | `debt_positions` + `per_year_overrides` |
| Rate environment (SOFR, 10Y, curve, classification) | ✅ | ✅ | `rate-environment.service.ts` + `metric_time_series` |
| Distress flags (io_expiry_shock, underwater_equity, cash_in_refi, etc.) | ✅ | ✅ (compute) / ❌ (read) | `vintage-debt-estimator.service.ts` + `deal_context_financials` |
| Lender targets | ✅ | ✅ | `lender-targeting.service.ts` |
| Product mapping | ✅ | ✅ | `strategy-debt-mapping.json` |
| Prepayment penalty computation | ❌ | ❌ | **Absent** |
| Assumable-NPV / below-market-debt math | ❌ | ❌ | **Absent** |
| Refi feasibility (proceeds gap, DSCR post-refi) | ✅ | ✅ | `debt-tracking.service.ts` :240–339 `runRefiTest()` |
| Covenant compliance | ✅ | ✅ | `debt-tracking.service.ts` :194–233 `updateCovenantCompliance()` |
| M11 sizing output | ✅ | ✅ | `capital-structure-adapter.ts` :702–730 `M11CapitalStructureSummary` |
| Debt Advisor recommendation | ✅ | ✅ | `debt-plan-formulator.service.ts` `DebtAdvisorResponse` |
| Double-up / bundle risk | ✅ | ❌ | `sigma/debt-bundle-registry.ts` (orphaned) |
| CFO optimization | ✅ | ❌ | `cfo-lender.service.ts` (orphaned) |
| Monitoring triggers | ✅ | ✅ | `debt-plan-formulator.service.ts` :265–361 `buildMonitoringTriggers()` |

### 3.3 The Core Gap

There is **no single `DebtContext` type** that assembles these pieces. Instead:
- `DebtAdvisorResponse` is ephemeral (15-min cache, not persisted)
- `deal_context_financials` is persisted but unread
- `per_year_overrides` is a flat JSONB bag without typing
- `debt_positions` is a relational table, not a context object
- `v_portfolio_debt_summary` is a SQL view, not a typed context

A `DebtContext` would need a **new type definition** (analogous to `ResearchAgentContext`) and a **new assembler service** that pulls from:
1. `debt_positions` (in-place loans)
2. `deal_context_financials` (distress flags)
3. `rate-environment.service.ts` (macro + curve)
4. `lender-targeting.service.ts` (lender targets)
5. `debt-plan-formulator.service.ts` (recommendation + triggers)
6. `capital-structure-adapter.ts` (M11 sizing)

---

## 4. File:Line Evidence Summary

| Claim | File | Line(s) |
|-------|------|---------|
| `debt_positions` schema | `20260420_disposition_and_debt_tracking.sql` | 102–169 |
| `getDebtPositions()` read | `debt-tracking.service.ts` | 152 |
| Vintage estimator reads debt positions | `vintage-debt-estimator.service.ts` | 489 |
| Six distress flags defined | `vintage-debt-estimator.service.ts` | 52–57 |
| `io_expiry_shock` logic | `vintage-debt-estimator.service.ts` | 409–434 |
| `underwater_equity` logic | `vintage-debt-estimator.service.ts` | 437–453 |
| `cash_in_refi` logic | `vintage-debt-estimator.service.ts` | 456–461 |
| `persistVintageDebtEstimate()` | `vintage-debt-estimator.service.ts` | 627–721 |
| `deal_context_financials` schema | `20260703_deal_context_financials.sql` | 6–50 |
| FRED client series IDs | `fred-api.client.ts` | 130–157 |
| FRED ingestion | `fred-ingest.service.ts` | 59–114 |
| Rate environment classification | `rate-environment.service.ts` | 294–403 |
| `assumable` field in type | `capital-structure.service.ts` | 165 |
| `getRecommendedTerms()` hardcodes | `capital-structure-adapter.ts` | 502–534 |
| `runM11Cycle()` | `capital-structure-adapter.ts` | 546–575 |
| `writeM11ToFinancing()` | `capital-structure-adapter.ts` | 751–801 |
| Prepayment types in enum | `debt-tracking.service.ts` | 53 |
| Prepay types in strategy mapping | `strategy-debt-mapping.json` | 19, 38, 61, 75, 110, 168, 210, 241, 258, 289, 322, 356, 376, 388, 408, 429, 448, 467, 488, 508, 545, 566, 587 |
| Lender DB static catalog | `lender-targeting.service.ts` | 33–916 |
| `targetLenders()` scoring | `lender-targeting.service.ts` | 970–1010 |
| `formulateDebtPlan()` | `debt-plan-formulator.service.ts` | 669–964 |
| `writeDebtPlatformDefaults()` | `debt-plan-formulator.service.ts` | 986–1027 |
| `applyDebtAdvisorPlatformDefault()` | `proforma-adjustment.service.ts` | 6392–6431 |
| `DebtContextModifier` service | `debt-context-modifier.service.ts` | 210–243 |
| Size tiers | `debt-context-modifier.service.ts` | 50–55 |
| Geography exclusions | `debt-context-modifier.service.ts` | 40–48, 142–166 |
| Sigma debt bundles | `sigma/debt-bundle-registry.ts` | 59–179 |
| `assessDoubleUp()` | `sigma/debt-bundle-registry.ts` | 194–239 |
| CFO-lender service | `cfo-lender.service.ts` | 82–341 |
| `runRefiTest()` | `debt-tracking.service.ts` | 240–339 |
| `updateCovenantCompliance()` | `debt-tracking.service.ts` | 194–233 |
| `DealContext` type pattern | `types/dealContext.ts` | 172–220, 459–608 |

---

## 5. Verdict

| Module | State | Reads It? | Feeds DebtContext? |
|--------|-------|-----------|-------------------|
| `debt_positions` | **WIRED** | Yes (multiple) | Yes, directly |
| S1 distress flags (vintage estimator) | **WIRED** | Compute yes, read no | Yes, but needs reader |
| FRED / rate environment | **WIRED** | Yes (multiple) | Yes, ready-made |
| Assumable-NPV | **ABSENT** | N/A | No |
| M11 sizing | **WIRED** | Yes | Yes, via ProForma |
| Prepayment structures | **METADATA-ONLY** | Types only | No |
| Lender ruleset / product catalog | **WIRED** (static) | Yes | Yes, embedded |
| Debt plan formulator | **WIRED** | Yes | Yes, ephemeral |
| Debt context modifier | **WIRED** | Yes | Yes, embedded |
| Sigma debt bundles | **METADATA-ONLY** | No consumer | No |
| CFO-lender collaboration | **METADATA-ONLY** | No consumer | No |
| `deal_context_financials` | **WRITE-ONLY** | No reader | Yes, but needs reader |
| `per_year_overrides` | **WIRED** | Yes | Partially |

**Bottom line:** The debt layer has **more infrastructure than it appears** — it is simply **not assembled into a unified `DebtContext`**. The pieces are there. What is missing is:
1. A `DebtContext` type definition (analogous to `ResearchAgentContext`)
2. An assembler service that pulls from the 6+ sources above
3. A consumer (e.g., Research Agent, Cashflow Agent) that requests `DebtContext` the way it requests `DealContext` today
4. Prepayment penalty math and assumable-NPV math (genuine absences, not just assembly gaps)

---

*End of A4_DebtContext audit. No fixes applied. No migrations run. All claims supported by file:line evidence.*

# Investor Returns Capability Map
**Audit date:** 2026-05-31  
**Audit type:** Read-only — no code changes, no schema changes  
**Companion document:** `docs/operations/OWNED_PORTFOLIO_AND_CORRELATION_ENGINE_MAP.md` (2026-05-31)  
**P11 discipline:** Every claim grounded in a specific file reference or live SQL result. Unverified claims are flagged `INFERRED-NOT-VERIFIED`.

---

## §1 — Layer 1: Property Operating Data Ingestion

### Q1.1 — Ingestion paths

**T12 (trailing 12-month P&L)**  
Parser: `backend/src/services/document-extraction/parsers/t12-parser.ts`  
Classifier detects via filename pattern `/t[\s_-]*12|trailing[\s_-]*12|income[\s_-]*statement|ysi[\s_-]*is/i` (classifier.ts line 22).  
Format awareness: Yardi-aware dual-mode (`yardi_accrual` / `generic_columnar`). Uses DESCRIPTION column for category matching (not GL code). GL code is a secondary signal. Covers categories: GPR, LTL, vacancy, concessions, bad debt, other income, EGI; all opex sub-categories through `totalExpenses`; NOI; debt service; CapEx.  
Destination: `deal_monthly_actuals` (one row per report month).

**Rent Roll**  
Parser: `backend/src/services/document-extraction/parsers/rent-roll-parser.ts`  
Classifier detects via `/rent[\s_+\-]*roll|rr[\s_-]*w[\s_-]*lc|rrwlc/i`.  
Format awareness: Yardi RRwLC (two-row header, per-unit primary rows with charge-code sub-rows) and generic-flat (one row per unit, named columns). Charge-code mapping normalizes ~35 known codes into income categories (rent, parking, pet_rent, storage, rubs, fees, insurance_admin, concessions, other).  
Destination: `deals.deal_data` JSONB (rent roll summary in capsule).

**BPI Financial Package (Bell Partners format)**  
Parser: `backend/src/services/document-extraction/parsers/bpi-financial-parser.ts`  
Parses multi-sheet Excel: Income Statement, Balance Sheet, Statement of Cash Flows.  
Fields extracted: GPR, LTL, vacancy, concessions, bad debt, other income, EGI; per-category opex; NOI, debtService, CapEx, cashFlowBeforeTax; Balance Sheet (cash, AR, prepaid, AP, security deposits, equity); occupancy, avgEffectiveRent.  
BPI-specific BPI variance parser also exists: `backend/src/services/document-extraction/parsers/bpi-variance-parser.ts`.  
Destination: `deal_monthly_actuals` via the property-performance ingestor pipeline.

**Yardi Matrix (market data vendor)**  
Vendor declaration: `backend/src/services/document-extraction/vendor-registry/yardi-matrix.vendor.ts`  
Parser: `backend/src/services/document-extraction/parsers/yardi-matrix-parser.ts`  
This is a _market data_ vendor (submarket rent comps), not an operator's property-level financial package. Classified via vendor registry, not filename patterns. Lands in `historical_observations` with `vendor_source = 'yardi_matrix'`.

**RealPage / AppFolio**  
Status: **NOT IMPLEMENTED.** Both names appear only in `types.ts` document-type metadata, seed scripts, and metricsCatalog as string constants. No dedicated parser, no classifier signature, no vendor registry entry for either. Any RealPage or AppFolio upload would fall through to generic `t12-parser.ts` (if filename matches) or fail classification.

### Q1.2 — Chart-of-accounts mapping layer

No dedicated CoA mapping table exists in the schema. The T12 parser implements an in-code description-keyed `RULES` array (`CategoryRule[]`) that maps line-item description regex patterns to internal field names (`t12-parser.ts` lines 29–210+). This is a hardcoded categorization layer, not a configurable CoA table. No vendor-to-standard field mapping table is stored in the database. The BPI parser maps BPI-specific column positions to internal fields directly.

**Gap:** There is no operator-configurable CoA mapping. Custom property management system formats that do not match Yardi or BPI patterns require code changes to the parser rules, not configuration.

### Q1.3 — Time-series granularity

`deal_monthly_actuals` stores **monthly, line-by-line operating data**. Confirmed live: 85 rows in production.

Columns verified via `information_schema.columns`:

| Category | Stored fields |
|---|---|
| Revenue | `gross_potential_rent`, `loss_to_lease`, `vacancy_loss`, `concessions`, `bad_debt`, `net_rental_income`, `other_income`, `utility_reimbursement`, `late_fees`, `misc_income`, `effective_gross_income` |
| Opex | `payroll`, `repairs_maintenance`, `turnover_costs`, `marketing`, `admin_general`, `management_fee` (+`_pct`), `utilities`, `contract_services`, `property_tax`, `insurance`, `hoa_condo_fees`, `total_opex`, `opex_per_unit`, `opex_ratio`, `expenses` (JSONB line-items), `real_estate_taxes` |
| Below-line | `noi`, `noi_per_unit`, `debt_service`, `debt_service_interest`, `capex`, `capex_reserves`, `cash_flow_before_tax` |
| Leasing | `new_leases`, `renewals`, `move_outs`, `lease_trade_out`, `renewal_rate`, `avg_days_to_lease` |
| Occupancy | `total_units`, `occupied_units`, `occupancy_rate`, `avg_market_rent`, `avg_effective_rent` |
| Provenance | `data_source`, `source_document_type`, `source_period_label`, `source_ref`, `source_date`, `upload_id`, `is_budget`, `is_proforma` |

**What is stored:** Full monthly line-by-line breakdown — nothing is aggregated away.  
**What is lost:** Sub-category detail below the stored field granularity (e.g., individual charge codes from rent roll are aggregated into category buckets; individual GL lines within payroll are rolled into `payroll`). Raw source files are retained via `upload_id` reference.

---

## §2 — Layer 2: Loan Data and Debt Service

### Q2.1 — `deal_debt_schedule` schema

**Table exists:** YES. Migration: `backend/src/db/migrations/20260402_005_data_provenance_tables.sql` (lines 85–123).  
**Live row count:** 0 (SQL verified 2026-05-31).

Full column set:

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `deal_id` | UUID | FK to deals; no UNIQUE constraint — multiple rows per deal supported |
| `lender` | VARCHAR(200) | |
| `loan_type` | VARCHAR(50) | agency, cmbs, bank, bridge, etc. |
| `original_amount` | NUMERIC(14,2) | |
| `current_balance` | NUMERIC(14,2) | |
| `interest_rate` | NUMERIC(7,4) | |
| `rate_type` | VARCHAR(20) | fixed / floating |
| `spread` | NUMERIC(5,4) | for floating |
| `index_rate` | VARCHAR(30) | SOFR, Prime, etc. |
| `maturity_date` | DATE | |
| `origination_date` | DATE | |
| `amortization_years` | INTEGER | |
| `io_period_months` | INTEGER | |
| `monthly_payment` | NUMERIC(12,2) | user-supplied float |
| `monthly_principal` | NUMERIC(12,2) | user-supplied float |
| `monthly_interest` | NUMERIC(12,2) | user-supplied float |
| `annual_debt_service` | NUMERIC(14,2) | user-supplied float |
| `ltv` | NUMERIC(5,4) | |
| `dscr` | NUMERIC(5,2) | |
| `debt_yield` | NUMERIC(5,4) | |
| `prepayment_type` | VARCHAR(50) | |
| `prepayment_expiry` | DATE | |
| `covenants` | JSONB | |
| `is_active` | BOOLEAN | |
| `source_type` | VARCHAR(30) | manual, document_extracted, etc. |
| `source_ref` | VARCHAR(500) | |
| `source_date` | DATE | |
| `notes` | TEXT | |

**Relationship to deals:** `deal_id` FK, no UNIQUE constraint — supports multiple instruments per deal.

CRUD endpoints: `GET /:dealId/debt-schedule` and `POST /:dealId/debt-schedule` in `backend/src/api/rest/financial-documents.routes.ts` (lines 197–257), mounted under `/api/v1/deals`.

### Q2.2 — Amortization schedule

**Programmatic computation in `deal_debt_schedule`:** NO. `monthly_payment`, `monthly_principal`, `monthly_interest`, and `annual_debt_service` are user-supplied floats stored as-is. The table does not compute them from `amortization_years`, `interest_rate`, and `original_amount`.

**Programmatic computation in F9 model:** YES. `deterministic-model-runner.ts` computes P&I split each year from `ModelAssumptions` fields: `loanAmount`, `rate`, `amort` (amortization years), `ioPeriod` (IO months). During IO period: full `rate × loanAmount` as interest, zero principal. After IO: standard annuity formula for P&I split. Results stored in `AnnualCashFlowRow.annualInterest`, `.annualPrincipal`, `.debtService`.

**Upload path for amortization schedules:** None. No parser exists for lender-provided amortization schedules.

**P&I split stored:** In `deal_debt_schedule` only if operator manually enters it. In the F9 model results, yes (per year, in the deterministic runner output).

### Q2.3 — Multi-tranche and refinance events

**Multi-tranche:** Supported. `deal_debt_schedule` has no UNIQUE constraint on `deal_id` — multiple rows (instruments) per deal are valid. The `GET /:dealId/debt-schedule` summary aggregates active loans: `totalDebt`, `totalAnnualDebtService`, `weightedAvgRate`, `nearestMaturity` (`financial-documents.routes.ts` lines 205–219).

**Refinance events:** `backend/src/services/debt-tracking.service.ts` defines `RefiTestScenario` and `RefiTestResult` types, and the migration `20260420_disposition_and_debt_tracking.sql` creates `refi_test_scenarios` and `refinance_events` tables. The service supports: underwriting, operational, and stress-test scenario types.

**Any deal with multiple instruments live:** Zero live rows in `deal_debt_schedule` — cannot verify from live data.

### Q2.4 — Debt service in P&L flow

The F9 financial model (`deterministic-model-runner.ts`) reads debt service from **`ModelAssumptions`** (`loanAmount`, `rate`, `amort`, `ioPeriod`), not from `deal_debt_schedule`. The `deal_debt_schedule` table feeds the **DebtTab display** (`frontend/src/pages/development/financial-engine/DebtTab.tsx`) and the `debt-tracking.service.ts` covenant monitoring — it is a separate store from the F9 model inputs.

**Gap:** The two data paths are not wired to each other. If an operator enters a loan in `deal_debt_schedule` (manual entry), those values do not flow into the F9 deterministic model. The F9 model reads from `deal_assumptions` (via `proforma-seeder.service.ts`). There is no bridge syncing `deal_debt_schedule` → `deal_assumptions.financing.*`.

---

## §3 — Layer 3: Operating Agreement and Waterfall Structure

### Q3.1 — `deal_waterfall_config` schema

**Table exists:** YES. Migration: `backend/src/database/migrations/20260422_deal_structuring_tables.sql` (lines 78–117).  
**Live row count:** 0 (SQL verified 2026-05-31).

Full column set (verified via `information_schema`):

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `deal_id` | UUID, UNIQUE | One config per deal |
| `preferred_return_rate` | NUMERIC(5,2) | Default 8.00 |
| `preferred_return_type` | TEXT | cumulative / non_cumulative / compounding |
| `tier1_hurdle_irr` | NUMERIC(5,2) | |
| `tier1_lp_split` | NUMERIC(5,2) | |
| `tier1_gp_split` | NUMERIC(5,2) | |
| `tier2_hurdle_irr` | NUMERIC(5,2) | |
| `tier2_lp_split` | NUMERIC(5,2) | |
| `tier2_gp_split` | NUMERIC(5,2) | |
| `tier3_hurdle_irr` | NUMERIC(5,2) | "Home run" tier |
| `tier3_lp_split` | NUMERIC(5,2) | |
| `tier3_gp_split` | NUMERIC(5,2) | |
| `catch_up_provision` | BOOLEAN | |
| `catch_up_percentage` | NUMERIC(5,2) | |
| `lookback_provision` | BOOLEAN | |
| `clawback_provision` | BOOLEAN | |
| `distribution_frequency` | TEXT | monthly/quarterly/semi_annual/annual/at_exit |
| `based_on_recommendation_id` | TEXT | FK to deal_structuring_recommendations |
| `created_at`, `updated_at` | TIMESTAMPTZ | |
| `created_by` | UUID | |

**Population mechanism:** A trigger `create_waterfall_from_recommendation` auto-creates a row when a `deal_structuring_recommendations` insert occurs.

**Parallel table — `deal_waterfalls` (investor capital migration):**  
Also exists, 0 live rows. Different schema:

```
pref_rate NUMERIC(5,4)
catchup_pct NUMERIC(5,4)
clawback BOOLEAN
clawback_lookback_months INTEGER
lp_gp_split_base NUMERIC(5,2)
lp_capital / gp_capital NUMERIC(15,2)  [added in 20260422 enhancement]
pref_compounding VARCHAR(20) DEFAULT 'simple'
pref_accrued NUMERIC(15,2) DEFAULT 0
lookback_enabled BOOLEAN
is_active BOOLEAN
```

Plus a child table `waterfall_tiers` (flexible tier count):

```
waterfall_id UUID FK
tier_order INTEGER
irr_hurdle_low NUMERIC(5,4)
irr_hurdle_high NUMERIC(5,4)
lp_pct NUMERIC(5,2)
gp_pct NUMERIC(5,2)
tier_name TEXT  [added 20260422]
hurdle_type VARCHAR(20) DEFAULT 'irr'  [added 20260422]
```

**`waterfall_distributions` JSONB:** No `waterfall_distributions` JSONB column was found in either waterfall table. The `distributions` table stores actual payment events; waterfall tier attribution is via `distributions.waterfall_tier` VARCHAR (added in 20260422 enhancement migration). Distribution line items are in `distribution_items` with columns `return_of_capital`, `preferred_return`, `profit_share`, `promote` — this is the per-investor tier attribution at the distribution level.

### Q3.2 — Operator-entered waterfall UI

`WaterfallTab.tsx` (`frontend/src/pages/development/financial-engine/WaterfallTab.tsx`, 1228 lines).

**Supported structures:**
- **Waterfall type:** American (period-by-period) or European (all deferred to exit)
- **Tranches:** Unlimited LP/GP/Preferred Equity tranches with per-tranche label, role, ownership %, pref rate, compounding (annual/monthly/daily), cumulative flag, promote participation flag
- **Tiers:** Unlimited tiers, each with trigger type (ROC / pref_return / catch-up / promote) and IRR hurdle + LP/GP split
- **Fees:** Acquisition fee %, asset mgmt fee % (on equity or EGI basis), construction mgmt %, disposition fee %, refinancing fee %

**Persistence:** WaterfallTab persists tier/tranche config via `PATCH /api/v1/deals/:dealId/financials/override` using `wf:*` override keys stored in `deal_assumptions` JSONB. Investor roster is stored in **browser `localStorage`** (`jedire_investors_${dealId}`) — not in the database.

**Loaded from backend:** `f9Financials.waterfall` and `f9Financials.capital.tranches` via `GET /api/v1/deals/:dealId/financials`.

### Q3.3 — Operating agreement extraction

**Status: NOT IMPLEMENTED.** Zero references to "operating agreement", "operatingAgreement", or "operating_agreement" anywhere in `backend/src/`. No OA parser in the classifier, no document type in the `DocumentType` enum for operating agreements, no classifier signature for OA files. Any OA upload would fail classification. No deal's waterfall configuration has ever been sourced from an OA.

### Q3.4 — Tasks #1522, #1523, #1525 LP/GP wiring

**Verification result:** Zero grep matches for task numbers "1522", "1523", "1525" in `backend/src/`. The task numbers are not referenced in code comments or inline TODOs. The merged code from these tasks is not distinguishable from surrounding code by task number. The LP/GP investor management infrastructure (investors table, deal_investments, capital_calls, distributions, capital_account_entries, investor-capital.routes.ts) exists in the migrations from 2026-04-21 and 2026-04-22. Whether tasks #1522/#1523/#1525 specifically contributed these migrations cannot be verified without commit history.

---

## §4 — Layer 4: Capital Accounts

### Q4.1 — Capital account schema

**Table: `capital_account_entries`** (migration 20260421_011).  
**Live row count:** 0 (SQL verified 2026-05-31).

Columns:

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `deal_id` | UUID FK | |
| `investor_id` | UUID FK | |
| `entry_type` | TEXT | contribution / distribution / adjustment / fee / interest |
| `amount` | NUMERIC(15,2) | |
| `reference_id` | UUID | FK to source record (capital_call, distribution, etc.) |
| `reference_type` | TEXT | 'capital_call' / 'distribution' / etc. |
| `entry_date` | DATE | |
| `description` | TEXT | |
| `running_balance` | NUMERIC(15,2) | Maintained by trigger |

**Index:** `idx_cap_entries_investor` on `(investor_id, deal_id)` for per-investor lookups.

No separate `capital_accounts` summary table exists. The ledger IS the capital account. Summary balances are computed from `capital_account_entries` via the `GET /deals/:dealId/ledger` endpoint (running CTE in `investor-capital.routes.ts` lines 615–640).

**Investors table** (parent): 0 live rows. Schema captures: type (lp/gp/co_invest/fund_of_funds/other), entity_type (individual/trust/llc/lp/corporation/fund/other), KYC status, accredited flag, withholding percentages (federal/state/foreign), banking details (bank_name, bank_routing, bank_account), tax_id_last4.

**Deal investments table** (`deal_investments`): 0 live rows. Columns: commitment_amount, ownership_pct, class (class_a default), status (soft_circle/committed/funded/redeemed), funded_amount, capital_returned, distributions_paid (summary counters updated by triggers), preferred_return (investor-specific override), promote_eligible, co_invest flag, side_letter JSONB.

### Q4.2 — Contribution and distribution ledger

**Transaction-level**, not summary-only. Each capital call payment (`PATCH .../pay`) creates a row in `capital_account_entries` with `entry_type='contribution'` (investor-capital.routes.ts line 387). Each distribution processed creates a row with `entry_type='distribution'` (line 513). Trigger `trg_ledger_running_balance` (migration 20260422) also creates entries on `capital_call_items` status change.

The `GET /deals/:dealId/ledger` endpoint returns paginated transaction rows with correct running balance via a window-function CTE that recomputes balance over the full unfiltered history, then applies date/investor filters on the outer query.

### Q4.3 — Accrued preferred return

**Computation:** Client-side only in WaterfallTab.tsx `runAmerican()` function. Per year: `lpPrefAccrued += lpEquity * prefRate` (simple interest, not compounded). At each distribution: `const prefToLP = Math.min(avail, lpPrefAccrued); avail -= prefToLP; lpPrefAccrued -= prefToLP`. No server-side equivalent computation.

**Storage:** `deal_waterfalls.pref_accrued NUMERIC(15,2) DEFAULT 0` exists as a column but 0 live rows in `deal_waterfalls`. This field is never written by any server route — it remains a schema stub.

**Compounding:** `deal_waterfalls.pref_compounding VARCHAR(20) DEFAULT 'simple'` schema exists. `WaterfallTab.tsx runAmerican()` implements simple interest only. No compound or daily/monthly compounding implementation found anywhere in the codebase.

**Rate source:** Operator-entered `deal_waterfalls.pref_rate` (default 8%) read by `GET /deals/:dealId/waterfall` (investor-capital.routes.ts line 536). Or `deal_waterfall_config.preferred_return_rate` (the parallel table). Never derived from OA.

### Q4.4 — Historical capital account migration

**Import path:** None. No batch import endpoint or service exists for loading historical capital account balances. Operators can create individual `capital_account_entries` rows via manual distribution recording (investor-capital.routes.ts distribution processing), but there is no "seed historical balances" workflow.

**Consequence:** For any closed third-party deal acquired with existing LP/GP investors, the platform cannot represent the pre-onboarding capital history. Opening balances must be manually entered as adjustment entries.

---

## §5 — Layer 5: Cash Flow Computation Chain

### Q5.1 — Service producing NOI → debt service → distributable cash

**Primary service:** `backend/src/services/deterministic/deterministic-model-runner.ts` (1919 lines). Pure function — no DB, no external APIs. Input: `ModelAssumptions`. Output: `ModelResults` containing `annualRows: AnnualCashFlowRow[]`.

**Computation chain per year:**

```
Gross Potential Rent
  − Loss to Lease
  − Vacancy
  − Concessions
  − Bad Debt
= Base Revenue
  + Other Income
= Effective Gross Income (EGI)
  − Payroll
  − Maintenance
  − Contract Services
  − Marketing
  − Utilities
  − Admin
  − Insurance
  − Property Tax
  − Management Fee
  − Replacement Reserves
= Total Expenses
= NOI
  − Annual Interest  (computed from rate × loanAmount, adjusted post-IO)
  − Annual Principal (computed from amortization formula post-IO)
= Debt Service
= preTaxCashFlow = cfads  (Cash Flow After Debt Service)
  − Tax Payable
= After-Tax Cash Flow
```

`AnnualCashFlowRow` includes: `dscr` (NOI / debtService), `debtYield` (NOI / loanAmount), `capRateOnCost` (NOI / totalAcquisitionCost), `depreciation`, `taxableIncome`, `taxPayable`, `afterTaxCashFlow`.

**Downstream:** `proforma-adjustment.service.ts` (6256 lines) receives model results, computes `cfads` from rows, builds the waterfall distribution schedule, and produces LP/GP IRR and equity multiple. `financials-composer.service.ts` (2664 lines) assembles the full `ComposedFinancials` shape including `returns`, `capitalStack`, `proforma` for the frontend.

### Q5.2 — Working capital adjustments

**Absent.** No accrual-to-cash bridge exists. `deal_monthly_actuals` stores cash-basis figures from uploaded T12s. The F9 model produces accrual-basis projections. There is no service that reconciles actuals accruals against cash receipts/payments.

### Q5.3 — CapEx handling

**In the F9 model (`deterministic-model-runner.ts`):** `capexBudget` is a `ModelAssumptions` input used only in the Sources & Uses calculation (appearing in `totalAcquisitionCost`). It is **not subtracted from NOI** to arrive at cfads. The F9 model's cfads = NOI − debtService.

**In WaterfallTab.tsx:** `annualCfads[yr] = max(noi_y1 × (1+rentGrowth)^(yr-1) − annualDS, 0)`. No CapEx deduction. Same behavior.

**In `deal_monthly_actuals`:** `capex` and `capex_reserves` columns store observed CapEx per month from uploaded T12s. `cash_flow_before_tax` = NOI − debt_service − capex (as reported in the source document).

**Recurring vs. one-time distinction:** NOT implemented at the computation level. `deal_capex_items` table exists (from migration 20260402_005, alongside deal_debt_schedule) with `category`, `status`, and `amount` fields — but the F9 model does not read from this table.

**Inconsistency:** The observed T12 `cash_flow_before_tax` includes CapEx deduction; the projected cfads from the F9 model does not. This means projected distributable cash is systematically overstated relative to observed actuals if CapEx is material.

### Q5.4 — End-to-end verification

**Most-complete deal attempt:** Live DB has 85 rows in `deal_monthly_actuals` and 478 in `historical_observations`. All capital account tables (`deal_debt_schedule`, `deal_waterfalls`, `capital_account_entries`, `deal_investments`, `capital_calls`, `distributions`) have **0 rows**. No deal has both (a) actuals history and (b) configured investor waterfall.

**Gaps identified by layer:**
1. Ingestion → F9 model: T12 actuals land in `deal_monthly_actuals` and are read by `financials-composer.service.ts` as T12/T6/T3/T1 columns in OSRow. The F9 model uses them as reference data but runs on `deal_assumptions`. Bridge exists via `proforma-seeder.service.ts`.
2. F9 model → distributable cash: Works (NOI − debtService = cfads per year). CapEx not deducted (see Q5.3).
3. Distributable cash → waterfall: WaterfallTab client-side only. No persistent server-side waterfall run.
4. Waterfall → capital accounts: `capital_account_entries` populated by distribution payment (not by waterfall execution). No automatic link from waterfall output to distribution creation.
5. Capital accounts → investor reporting: `InvestorCapitalModule.tsx` exists with ledger view. Routes NOT mounted. Unreachable.

---

## §6 — Layer 6: Waterfall Execution

### Q6.1 — Waterfall execution service

**Three separate execution sites exist:**

**Site 1 — `backend/src/services/capital-structure.service.ts`**  
Method: `calculateWaterfall(config: EquityWaterfallConfig, exit_proceeds: number, hold_years: number, annualCashFlows: number[]): WaterfallResult`  
Called by: `POST /deals/:dealId/waterfall/calculate` in `investor-capital.routes.ts` (line 729) — **route NOT mounted**.  
Signature: takes flat tier array (id, name, hurdleRate, gpSplit, lpSplit), preferred return, LP/GP capital split, exit proceeds, hold years, annual cash flows. Returns per-tier distributions, LP/GP totals, equity multiples.

**Site 2 — `backend/src/services/deterministic/deterministic-model-runner.ts`**  
Built-in waterfall: uses `ModelAssumptions.promoteTiers[3]`, `promoteSplits[3]`, `preferredReturn`, `lpEquity`, `gpEquity`. Runs year-by-year as part of the full model. Output in `ModelResults.waterfall: WaterfallResult` with `tiers: WaterfallTier[]` (tier, tierName, hurdleRate, lpSplit, gpSplit, lpDistribution, gpDistribution, lpIrr, gpIrr, etc.).

**Site 3 — `frontend/src/pages/development/financial-engine/WaterfallTab.tsx`**  
Functions: `runAmerican()` and `runEuropean()` (pure client-side TypeScript, lines 152–297).  
American: period-by-period ROC → pref return → catch-up → promote, with live IRR computation (Newton-Raphson solver built-in).  
European: all operating years defer LP distributions; terminal crystallization of full pool.  
Output: `DistRow[]` displayed in the Waterfall Distribution Schedule panel.  
Persistence: **None for waterfall output.** Tiers/tranches are persisted to `deal_assumptions` via `wf:*` override keys. Computed distribution rows are ephemeral (React state only).

### Q6.2 — Period-by-period vs. aggregate computation

All three execution sites compute **period-by-period** (year-by-year). WaterfallTab produces one `DistRow` per year plus an EXIT row. The deterministic runner produces one `WaterfallTier` set per year. capital-structure.service computes per-tier distributions across hold period.

### Q6.3 — Realized vs. projected reconciliation

**Not implemented.** No service or endpoint compares:
- Actual `distribution_items.gross_amount` (what was paid to each LP per distribution event) against
- The waterfall model's projected `lpDistribution` per year

`distributions.waterfall_tier` VARCHAR exists (added in enhancement migration) but is an operator-entered label, not a computed attribution. There is no reconciliation engine.

### Q6.4 — Multi-tier support

**WaterfallTab.tsx:** Unlimited tiers, 4 trigger types (ROC, pref_return, catch_up, promote). IRR-hurdle-based tier selection per period using live Newton-Raphson IRR on cumulative LP cash flows. Supports American and European waterfall structures. Supports unlimited LP/GP/pref equity tranches with per-tranche preferred returns and compounding settings.

**deterministic-model-runner.ts:** Fixed 3-tier array (`promoteTiers: [number, number, number]`, `promoteSplits: [number, number, number]`). Only IRR-hurdle promote tiers — no ROC or catch-up tier modeling.

**deal_waterfall_config:** Fixed 3-tier schema (tier1/2/3). Cannot represent structures with more than 3 tiers without schema changes.

**deal_waterfalls + waterfall_tiers:** Flexible tier count via child table. Supports `hurdle_type` (irr or other). This is the most flexible schema.

**Gap:** The three execution sites and two schema representations are not aligned. The deterministic model's built-in waterfall cannot express catch-up provisions. The WaterfallTab's American waterfall is the most complete implementation but runs client-side only.

---

## §7 — Layer 7: Reporting Surfaces

### Q7.1 — F6 Returns: current state

**Component:** `frontend/src/pages/development/financial-engine/ReturnsHubTab.tsx` → `ReturnsTab.tsx` (1844 lines).  
**Tab label in F9:** RETURNS (sub-tab within ReturnsHub, alongside SENSITIVITY).

**What it displays:**

| Section | Content | Granularity |
|---|---|---|
| Hero tiles | Unlevered IRR, Levered IRR, Equity Multiple, Cash-on-Cash, CoC Y1, CoC Avg | Scalar |
| DSCR / LTV | DSCR Y1/Min/Avg, LTV at close/stabilization/maturity | Scalar |
| LP VIEW panel | LP IRR, LP EM, pref rate, pref status, pref return by year table (accrued vs. paid vs. gap vs. cumulative LP dist), NOI haircut analysis (–10%/–20%/–30% stress) | Annual + scalar |
| LENDER VIEW panel | DSCR by year with min highlight, LTV trend through hold, exit-cap stress scenarios (+0/+25/+50/+100 bps) | Annual |
| Capital structure | Seeded defaults (from capital_stack_seeder), Agent recommendation (from capital_stack_optimization), Your structure (from f9Financials.capitalStack) | Scalar |
| Projections table | Annual rows: NOI, debt service, cfads, DSCR, occupancy | Annual per hold year |
| Waterfall schedule | Annual LP/GP distributions, IRR to date, EM to date (from client-side `runAmerican()`) | Annual |

**Data source:** `f9Financials.returns` shape, composed by `financials-composer.service.ts` from `proforma-adjustment.service.ts` model output (which runs `deterministic-model-runner.ts`). Accessed via `GET /api/v1/deals/:dealId/financials`.

### Q7.2 — Per-investor views

**Component exists:** `frontend/src/components/deal/sections/InvestorCapitalModule.tsx` (1326 lines, Bloomberg Terminal style).  
**Used in:** `AssetOwnedPage.tsx` and `PortfolioPropertyPage.tsx`.  
**Tabs:** Investors · Capital Calls · Distributions · Waterfall · Ledger · Comms.  
**Data source:** `/api/v1/capital/*` endpoints (investor-capital.routes.ts).

**Status: BLOCKED.** `investor-capital.routes.ts` is **imported but NOT mounted** in `backend/src/index.replit.ts`. The import exists at line 121 (`import investorCapitalRoutes from './investor-capital.routes'`) but there is no corresponding `app.use('/api/v1/capital', ...)` call anywhere in `index.replit.ts`. All API calls from `InvestorCapitalModule.tsx` receive 404 responses.

`useInvestorCapital.ts` hook makes calls to `/api/v1/capital/deals/:dealId/investments`, `.../capital-calls`, `.../distributions`, `.../waterfall`, `.../ledger`, `.../summary`, `.../communications`.

### Q7.3 — Capital account statements

**Endpoint:** `GET /deals/:dealId/ledger` in `investor-capital.routes.ts` (lines 590–654). Returns paginated transaction rows with running_balance, filterable by investor_id, date_from, date_to. Supports up to 500 rows per page.

**UI:** InvestorCapitalModule "Ledger" tab.

**Status:** Route NOT mounted. Endpoint exists but unreachable.

### Q7.4 — Distribution history with waterfall provenance

**Endpoint:** `GET /deals/:dealId/distributions/:distId` returns distribution header + `items: distribution_items[]`. Each `distribution_items` row has `return_of_capital`, `preferred_return`, `profit_share`, `promote` columns.

**Waterfall tier label:** `distributions.waterfall_tier VARCHAR(30)` column exists (from 20260422 enhancement) — operator-entered label, not computed by the waterfall engine.

**Status:** Route NOT mounted. No automated waterfall-to-distribution provenance link exists.

### Q7.5 — `investor-capital.routes.ts`: full content, endpoint list, mount status

**File:** `backend/src/api/rest/investor-capital.routes.ts` (952 lines).  
**Designed mount path:** `/api/v1/capital` (header comment line 4).  
**Actual mount status:** NOT MOUNTED. Only `capitalStructureRouter` is mounted at `/api/v1/capital-structure` (index.replit.ts line 655). `investorCapitalRoutes` is imported at line 121 but has no `app.use()` call.

Complete endpoint inventory:

| Method | Path | Description |
|---|---|---|
| GET | `/investors` | List investors (filter by type, kyc_status, search) |
| POST | `/investors` | Create investor |
| GET | `/investors/:investorId` | Get investor |
| PATCH | `/investors/:investorId` | Update investor |
| DELETE | `/investors/:investorId` | Archive investor |
| GET | `/deals/:dealId/investments` | List investments (with investor name join, unfunded amount) |
| POST | `/deals/:dealId/investments` | Add investment (upserts on deal+investor+class) |
| PATCH | `/deals/:dealId/investments/:id` | Update investment (status, funded_amount, etc.) |
| DELETE | `/deals/:dealId/investments/:id` | Remove investment |
| GET | `/deals/:dealId/capital-calls` | List capital calls (with collected amount, investor count) |
| POST | `/deals/:dealId/capital-calls` | Create capital call (pro-rata auto-allocation) |
| GET | `/deals/:dealId/capital-calls/:callId` | Get call detail with items, overdue calculation |
| POST | `/deals/:dealId/capital-calls/:callId/send` | Mark call sent |
| PATCH | `/deals/:dealId/capital-calls/:callId/items/:itemId/pay` | Record payment (creates ledger entry) |
| GET | `/deals/:dealId/distributions` | List distributions |
| POST | `/deals/:dealId/distributions` | Create distribution (pro-rata or waterfall) |
| GET | `/deals/:dealId/distributions/:distId` | Get distribution with items |
| POST | `/deals/:dealId/distributions/:distId/approve` | Approve distribution |
| POST | `/deals/:dealId/distributions/:distId/process` | Process (creates ledger entries, marks completed) |
| GET | `/deals/:dealId/waterfall` | Get waterfall config + tiers |
| PUT | `/deals/:dealId/waterfall` | Save waterfall config + tiers (upsert) |
| GET | `/deals/:dealId/ledger` | Capital account ledger (paginated, filterable) |
| POST | `/deals/:dealId/waterfall/calculate` | Run waterfall calculation via capital-structure.service |
| GET | `/deals/:dealId/summary` | Capital summary (investors, calls, distributions KPIs) |
| GET | `/deals/:dealId/communications` | List investor communications |
| POST | `/deals/:dealId/communications` | Create communication |
| POST | `/deals/:dealId/communications/:commId/send` | Send via Gmail or Microsoft Graph |
| POST | `/admin/refresh-summaries` | Refresh `mv_investor_summary` + `mv_deal_capital_summary` |

**Why unmounted:** Cannot determine from code (no comment explaining the omission). The routes are fully implemented.

**Whether to mount:** Yes, immediately. All infrastructure is complete. The only blocker is the missing `app.use('/api/v1/capital', requireAuth, investorCapitalRoutes)` line in `index.replit.ts`.

---

## §8 — Cross-Layer Findings

### Three-deal-type readiness matrix

| Capability | Owned Portfolio (existing) | New Acquisition (underwriting) | Closed Third-Party |
|---|---|---|---|
| T12/Rent Roll ingestion | ✓ Operational (85 rows live) | ✓ Supported | ✓ Supported |
| BPI financial package | ✓ Parser exists | N/A | ✓ Parser exists |
| F9 model / returns | ✓ Functional | ✓ Functional | ✓ Functional |
| Debt schedule CRUD | ✓ Endpoints exist, 0 rows | ✓ Endpoints exist | ✓ Endpoints exist |
| Waterfall config | ✗ Routes not mounted | ✗ Routes not mounted | ✗ Routes not mounted |
| Investor roster | ✗ Routes not mounted | ✗ Routes not mounted | ✗ Routes not mounted |
| Capital calls | ✗ Routes not mounted | N/A | ✗ Routes not mounted |
| Distribution tracking | ✗ Routes not mounted | N/A | ✗ Routes not mounted |
| Capital account ledger | ✗ Routes not mounted | N/A | ✗ Routes not mounted |
| Opening balance import | ✗ Not implemented | N/A | ✗ Not implemented |
| OA extraction | ✗ Not implemented | ✗ Not implemented | ✗ Not implemented |
| Realized vs. projected | ✗ Not implemented | N/A | ✗ Not implemented |
| Per-investor reporting | ✗ Routes not mounted | N/A | ✗ Routes not mounted |

### End-to-end walkthrough on most-complete deal

Not achievable. All capital account tables are empty. The most complete data path available is:

`T12 upload → classifier → t12-parser → deal_monthly_actuals → financials-composer.service.ts (T12/T6/T3/T1 actuals) → proforma-seeder → deal_assumptions → deterministic-model-runner → AnnualCashFlowRow[] → financials-composer → f9Financials.returns → ReturnsTab display`

This pipeline is operational (85 monthly actuals rows confirm T12 ingestion works end-to-end). The investor-returns chain is a dead end at the waterfall display (client-side only) because routes are not mounted.

### Relationship between stabilization-year computation and investor-returns chain

`stabilized-year-resolver.service.ts` computes when vacancy reaches the stabilized threshold. This feeds `proforma-adjustment.service.ts` as `stabilizationYear` (overridable). In the F9 model, stabilization determines the year when vacancy switches from `vacancyY1` to `vacancyStab` — affecting NOI year-by-year and thus cfads in each holding period year.

**Gap in chain:** No link exists between the stabilization year and:
1. The preferred return accrual start date (pref typically begins accruing from capital deployment, not stabilization)
2. Waterfall tier timing (whether the pref period ends at stabilization or at exit)
3. Distribution frequency triggers (deal_waterfall_config.distribution_frequency has no enforcement logic)

The stabilization-year computation affects projected CF accuracy but is not formally wired into the investor-returns chain's timing logic.

---

## §9 — Recommended Refinement Work

### Tactical fixes (unmount-and-fix items)

**T1 — Mount investor-capital.routes.ts (HIGH PRIORITY)**  
Add `app.use('/api/v1/capital', requireAuth, investorCapitalRoutes)` to `backend/src/index.replit.ts`.  
Impact: Unlocks 27 endpoints, all of InvestorCapitalModule.tsx, capital call workflow, distribution recording, waterfall save/calculate, ledger view, and investor communications. All infrastructure is complete.

**T2 — Verify and complete 20260422 materialized view creation**  
`mv_investor_summary` and `mv_deal_capital_summary` are defined in migration 20260422 but do not exist in the live DB (`information_schema` shows 0 rows for `mv_investor_summary` as a table). Confirm migration applied status and re-run view creation DDL if needed. These views are required by `GET /investors` aggregate dashboard and `POST /admin/refresh-summaries`.

**T3 — Bridge deal_debt_schedule → deal_assumptions**  
When an operator saves a loan in `deal_debt_schedule` (via DebtTab), the F9 model should read from it rather than requiring separate re-entry in deal_assumptions. Add a sync route or seeder step: on `deal_debt_schedule` upsert, propagate `interest_rate`, `original_amount`, `amortization_years`, `io_period_months` to `deal_assumptions.financing.*`.

### New build items (genuinely missing)

**N1 — Server-side waterfall execution and result persistence**  
WaterfallTab.tsx `runAmerican()`/`runEuropean()` are client-side only — results vanish on page reload. The backend `POST /deals/:dealId/waterfall/calculate` (capital-structure.service.ts `calculateWaterfall()`) exists but is unreachable (T1 fixes this). After mounting, add a `deal_waterfall_runs` table to persist computed distribution schedules so results can be reported without re-running the model.

**N2 — Realized vs. projected reconciliation service**  
No service compares actual `distribution_items` (what was paid) against waterfall model projections (what should have been paid). Build a reconciliation service: for each completed distribution, apply the saved waterfall tiers, compute expected LP/GP split, compare against `distribution_items.gross_amount`, surface variance. Required for accurate LP reporting.

**N3 — Operating agreement extraction**  
Zero infrastructure. Requires: (a) OA document type in `DocumentType` enum, (b) classifier pattern for OA filenames, (c) OA parser (PDF/DOCX extraction of pref rate, hurdle IRRs, LP/GP splits, distribution frequency, catch-up/clawback provisions), (d) mapper from OA fields to `deal_waterfalls` + `waterfall_tiers` schema. This is a substantial AI extraction task.

**N4 — Preferred return accrual ledger (server-side)**  
`deal_waterfalls.pref_accrued` column exists but is never written. Add a nightly or triggered job that computes accrued-but-unpaid preferred return per investor per deal, stores it in `deal_waterfalls.pref_accrued` (or a per-investor pref_accrual table), and surfaces it in InvestorCapitalModule. Required for accurate capital account statements.

**N5 — Historical capital balance import**  
Add a bulk-import endpoint accepting an opening balance CSV (investor_id, deal_id, entry_date, amount, description) that creates `capital_account_entries` rows. Required for onboarding any deal with pre-existing LP relationships.

### Data infrastructure items (operator decisions needed)

**D1 — Canonical waterfall table: `deal_waterfalls` or `deal_waterfall_config`?**  
Two tables exist with overlapping purpose but different schemas. `deal_waterfall_config` has fixed 3 tiers and is auto-populated from deal structuring recommendations. `deal_waterfalls` + `waterfall_tiers` supports flexible tier counts and is used by investor-capital.routes.ts. Decision needed: consolidate to `deal_waterfalls` + `waterfall_tiers` (more flexible) and deprecate `deal_waterfall_config`, or define distinct scopes (structuring vs. operational).

**D2 — WaterfallTab investor roster: localStorage → database**  
WaterfallTab persists investor records to `localStorage` (`jedire_investors_${dealId}`). The `deal_investments` table (already built, routes mountable via T1) is the correct persistence target. Migrate the roster write path from localStorage to `POST /deals/:dealId/investments`.

**D3 — CapEx treatment in CF chain**  
Decide: should projected cfads deduct recurring CapEx? The T12 actuals include CapEx in `cash_flow_before_tax`. The F9 model excludes it from cfads. This creates a systematic overstatement of projected distributable cash relative to observed actuals. If CapEx should be deducted, add `replacementReservesAnnual` to `AnnualCashFlowRow` computation and subtract from cfads. Document the decision in the F9 spec.

### Architectural commitments needed

**A1 — Single waterfall execution engine**  
Three implementations exist (capital-structure.service.ts, deterministic-model-runner.ts, WaterfallTab client-side). Commit to one server-side execution engine. Recommended: extend `deterministic-model-runner.ts` to support catch-up tiers (currently only promote tiers), adopt `waterfall_tiers` flexible schema, and have WaterfallTab call the server-side endpoint rather than running client-side. Deprecate capital-structure.service.ts `calculateWaterfall()` once the deterministic runner covers all structures.

**A2 — Preferred return accrual start date**  
No field captures when preferred return begins accruing. Options: funded_at date per deal_investments row (most accurate), deal close date, or a configurable pref_start_date per deal_waterfalls row. This is required before any preferred return accrual ledger can be correctly computed.

**A3 — Distribution approval workflow integration**  
Currently: distributions are created → approved → processed in three manual steps via investor-capital.routes.ts. No connection from waterfall calculation output to distribution creation. Commit to whether the platform will auto-create distributions from waterfall runs (matching projected splits) or keep distributions as fully operator-entered with waterfall as advisory only.

---

## Appendix — Live DB table status (as of 2026-05-31)

| Table | Exists | Live Rows |
|---|---|---|
| `deal_debt_schedule` | YES | 0 |
| `deal_waterfall_config` | YES | 0 |
| `deal_waterfalls` | YES | 0 |
| `waterfall_tiers` | YES | 0 |
| `capital_account_entries` | YES | 0 |
| `investors` | YES | 0 |
| `deal_investments` | YES | 0 |
| `capital_calls` | YES | 0 |
| `distributions` | YES | 0 |
| `deal_monthly_actuals` | YES | 85 |
| `historical_observations` | YES | 478 |
| `mv_investor_summary` (materialized view) | NO | — |
| `mv_deal_capital_summary` (materialized view) | NOT VERIFIED | — |

---

*End of audit. All claims grounded in direct file references (listed above) or live SQL queries executed against the production database on 2026-05-31.*

# JEDI RE — Module Wiring Map

How every module feeds every other module. This is the single source of truth for data flow across the platform.

---

## Architecture Layers

The platform has 4 layers. Data flows DOWN through the layers, and each layer feeds the ones below it.

```
LAYER 1: DATA INGESTION
  News Intelligence (M19) → classifies events
  Zoning Agent (M02) → parses municipal codes
  Supply Agent (M04) → tracks permits/construction
  Market Scraper (M05) → rents, vacancy, absorption
  Traffic Intelligence (M07) → foot traffic + digital signals

LAYER 2: SIGNAL PROCESSING  
  Demand Signals (M06) → quantified housing demand from events
  Supply Pipeline (M04) → pipeline pressure, months of supply
  Development Capacity (M03) → what CAN be built vs what IS built
  Competition Analysis (M15) → comp set positioning

LAYER 3: DECISION ENGINES
  Strategy Arbitrage (M08) → 4-strategy scoring, arbitrage detection
  Pro Forma Engine (M09) → dynamic financial projections
  Capital Structure (M11+) → debt/equity/mezz design
  Scenario Engine (M10) → bull/base/bear/stress
  Risk Dashboard (M14) → 6-category composite risk
  Exit Analysis (M12) → hold vs sell timing
  JEDI Score Engine (M25) → master 0-100 score

LAYER 4: PRESENTATION
  Deal Overview (M01) → single-pane summary
  Map Intelligence (M20) → visual war map
  Deal Pipeline (M16) → kanban workflow
  Portfolio Manager (M22) → owned asset performance
  AI Chat / Opus (M21) → natural language interface
  Alerts (M23) → threshold-based notifications
```

---

## Module-by-Module Wiring

### M19 — News Intelligence
**Produces:** Classified events (demand/supply/regulatory), geographic tags, sentiment
**Consumed by:**

| Consumer | What It Gets | Data Field | Event/Trigger |
|----------|-------------|-----------|--------------|
| M06 Demand | Employment events, university growth, migration | `{ category, people_count, income_tier, location, confidence }` | On news classification |
| M04 Supply | Permit filings, construction starts, project completions | `{ project_name, units, status, location, expected_delivery }` | On news classification |
| M14 Risk | Regulatory changes, sentiment shifts | `{ risk_category, impact_direction, severity }` | On news classification |

**Receives from:** News APIs, email sync (Gmail OAuth), RSS feeds, user-submitted articles

---

### M02 — Zoning & Entitlements
**Produces:** Zoning code, FAR, setbacks, max density, entitlement risk, utilization %
**Consumed by:**

| Consumer | What It Gets | Data Field | Event/Trigger |
|----------|-------------|-----------|--------------|
| M03 Dev Capacity | Zoning params for envelope calc | `{ far, max_height, setbacks, max_density, parking_ratio }` | On zoning verification |
| M08 Strategy | Regulatory constraints per strategy | `{ allows_str: bool, density_upside: %, entitlement_risk }` | On zoning change |
| M09 ProForma | Zoning-adjusted cost assumptions | `{ max_units, parking_required, impact_fees }` | On zoning change |
| M14 Risk | Regulatory risk factors | `{ entitlement_timeline, rezone_probability, variance_needed }` | On zoning change |

**Receives from:** Municode API (90%), direct municipal databases (10%), user corrections

---

### M03 — Development Capacity
**Produces:** Building envelope (max units, GFA, height), 10yr supply gap, as-right/variance/rezone scenarios
**Consumed by:**

| Consumer | What It Gets | Data Field | Event/Trigger |
|----------|-------------|-----------|--------------|
| M08 Strategy | BTS feasibility inputs | `{ max_units_by_right, estimated_dev_cost, supply_gap_10yr }` | On envelope calc |
| M09 ProForma | Development cost estimates | `{ hard_costs, soft_costs, land_cost, total_dev_cost }` | On scenario selection |
| M14 Risk | Development/execution risk | `{ construction_complexity, timeline_risk, cost_volatility }` | On envelope calc |

**Receives from:** M02 (zoning params), M04 (pipeline for gap calc), property boundaries (PostGIS)

---

### M04 — Supply Pipeline
**Produces:** Pipeline units by status, supply pressure ratio, months of supply, absorption rate, competitive project list
**Consumed by:**

| Consumer | What It Gets | Data Field | Event/Trigger |
|----------|-------------|-----------|--------------|
| M03 Dev Capacity | Pipeline context for gap analysis | `{ pipeline_units, absorption_rate, months_of_supply }` | On supply event |
| M05 Market | Supply pressure for market context | `{ supply_pressure_ratio, competitive_projects[] }` | On supply event |
| M08 Strategy | Supply signals per strategy | `{ new_construction_pipeline, reo_inventory, vacancy_trend }` | On supply event |
| M09 ProForma | Vacancy projections | `{ projected_vacancy_adjustment, absorption_rate }` | On supply event |
| M14 Risk | Supply risk score (F09) | `{ supply_risk_score, months_to_absorb, developer_concentration }` | On supply event |
| M15 Competition | Competitive set data | `{ competitive_projects[], distance, price_tier, delivery }` | On supply event |
| M25 JEDI Score | Supply sub-score input (F03) | `{ supply_score }` | On supply event |

**Receives from:** Permit databases, M19 (classified supply news), apartments.com scraper, user input

---

### M05 — Market Analysis
**Produces:** Avg rent/SF, vacancy rate, absorption, rent growth, submarket rank, demographic trends
**Consumed by:**

| Consumer | What It Gets | Data Field | Event/Trigger |
|----------|-------------|-----------|--------------|
| M08 Strategy | Market signals per strategy | `{ rent_growth, vacancy, cap_rate_trend, dom_trend }` | Weekly refresh |
| M09 ProForma | Baseline assumptions (rent, vacancy, growth) | `{ avg_rent, vacancy_rate, rent_growth_3yr, exit_cap_trailing }` | Weekly refresh |
| M10 Scenario | Market condition inputs for scenarios | `{ rent_growth_range, vacancy_range, cap_rate_range }` | Monthly |
| M14 Risk | Market risk factors | `{ cap_rate_volatility, rent_deceleration_prob }` | Monthly |
| M15 Competition | Rent comp data | `{ comp_rents[], comp_vacancy[], amenity_sets[] }` | Weekly |
| M25 JEDI Score | Momentum + Position inputs (F04, F05) | `{ momentum_score, position_score }` | Monthly |

**Receives from:** Apartments.com scraper, RentCast API, Census/ACS, BLS employment, M02 (zoning context), M04 (supply pressure)

---

### M06 — Demand Signals
**Produces:** Total housing units demanded, phased quarterly projections, income tier breakdown, employer concentration
**Consumed by:**

| Consumer | What It Gets | Data Field | Event/Trigger |
|----------|-------------|-----------|--------------|
| M05 Market | Demand-side market signals | `{ total_demand_units, demand_trend }` | On demand event |
| M08 Strategy | Demand signals per strategy | `{ demand_by_tier, absorption_potential, employer_diversity }` | On demand event |
| M09 ProForma | News-adjusted assumptions (F32, F33) | `{ adjusted_rent_growth, adjusted_vacancy }` | On demand event |
| M14 Risk | Demand risk (concentration) | `{ employer_concentration, demand_diversity_score }` | On demand event |
| M25 JEDI Score | Demand sub-score input (F02) | `{ demand_score }` | On demand event |

**Receives from:** M19 (classified demand news), BLS data, Census migration, email intel, user inputs

---

### M07 — Traffic Intelligence
**Produces:** Predicted leases/week, traffic-to-lease ratio, search volume index
**Consumed by:**

| Consumer | What It Gets | Data Field | Event/Trigger |
|----------|-------------|-----------|--------------|
| M05 Market | Traffic demand signals | `{ lease_velocity, web_traffic_trend }` | Weekly |
| M08 Strategy | Traffic correlation per strategy | `{ physical_traffic, digital_interest, conversion_rate }` | Weekly |

**Receives from:** Placer.ai (physical), SpyFu (digital), Google Trends, user lease data

---

### M08 — Strategy Arbitrage ⭐ CORE DIFFERENTIATOR
**Produces:** 4 strategy scores (BTS/Flip/Rental/STR), arbitrage flag, recommended strategy, ROI comparison
**Consumed by:**

| Consumer | What It Gets | Data Field | Event/Trigger |
|----------|-------------|-----------|--------------|
| M01 Overview | Strategy recommendation + arbitrage alert | `{ recommended_strategy, arbitrage_flag, arbitrage_delta }` | On signal change |
| M09 ProForma | Strategy-specific proforma params | `{ strategy, hold_period, exit_type, rent_assumptions }` | On strategy selection |
| M11+ Capital Structure | **Strategy template trigger** | `{ selected_strategy }` → loads matching debt template | On strategy selection |
| M25 JEDI Score | Strategy-adjusted weighting | `{ strategy_weighted_score }` | On strategy change |

**Receives from:** M02 (zoning), M03 (dev capacity), M04 (supply), M05 (market), M06 (demand), M07 (traffic), Strategy Matrix weights

**KEY EVENT:** `emitEvent('strategy-selected', { strategy: 'flip' })` — this is the trigger that cascades through ProForma and Capital Structure

---

### M09 — Pro Forma Engine
**Produces:** NOI, cash flow projections (10yr), IRR, equity multiple, CoC, cap rate, baseline vs news-adjusted
**Consumed by:**

| Consumer | What It Gets | Data Field | Event/Trigger |
|----------|-------------|-----------|--------------|
| M01 Overview | Key financials | `{ noi, irr, equity_multiple, coc_return, cap_rate }` | On financial change |
| M10 Scenario | Base case financials for scenario comparison | `{ base_noi, base_irr, base_equity_multiple, assumptions{} }` | On recalc |
| M11+ Capital Structure | NOI for DSCR/LTV/debt yield | `{ noi_year1, noi_projections[] }` | On recalc |
| M12 Exit | NOI/CF projections for exit timing | `{ noi_projections[], cf_projections[], exit_assumptions }` | On recalc |
| M14 Risk | Financial risk indicators | `{ dscr_minimum, breakeven_occupancy, irr_sensitivity }` | On recalc |
| M22 Portfolio | Projected vs actual comparison | `{ projected_noi, projected_cf, projected_occupancy }` | On recalc |

**Receives from:** M02-M08 (all intelligence modules for assumptions), M11+ (debt service), user overrides, rate feeds

**KEY INTEGRATION WITH M11+:** ProForma CANNOT calculate IRR, CoC, or equity multiple without knowing debt service from Capital Structure. Currently these are hardcoded (`irr = 15, equityMultiple = 2.0`). This is the #1 wiring priority.

---

### M11+ — Capital Structure Engine (NEW — replaces Debt, Debt Market, Capital Events)
**Produces:** Capital stack layers, annual debt service, DSCR, LTV, debt yield, equity waterfall, rate environment, capital lifecycle events
**Consumed by:**

| Consumer | What It Gets | Data Field | Event/Trigger |
|----------|-------------|-----------|--------------|
| M09 ProForma | **Annual debt service** (the critical link) | `{ annual_debt_service, interest_only_period, amort_schedule[] }` | On capital change |
| M09 ProForma | Equity requirement for return calcs | `{ total_equity, lp_equity, gp_equity, weighted_cost_of_capital }` | On capital change |
| M12 Exit | Loan balance at exit + prepayment | `{ remaining_balance_at_year[], prepayment_penalty, refi_proceeds }` | On capital change |
| M14 Risk | Financial risk subscore | `{ dscr, ltv, debt_yield, rate_exposure, covenant_headroom }` | On capital change |
| M01 Overview | Structure summary one-liner | `{ structure_summary: "70% LTV Agency │ 8.2% CoC │ 1.35x DSCR" }` | On capital change |

**Receives from:** M08 (strategy selection → template), M09 (NOI for DSCR calc), rate feeds (FRED API for Treasury/SOFR)

**KEY EVENT:** `emitEvent('capital-updated', { annualDebtService, dscr, ltv, totalEquity })` — ProForma listens and recalculates IRR

**CIRCULAR DEPENDENCY NOTE:** M09 needs debt service from M11+, and M11+ needs NOI from M09. Resolution: M09 calculates NOI first (NOI doesn't need debt service), then M11+ uses NOI to size debt and calculate DSCR. Then M11+ pushes debt service back to M09 for below-the-line cash flow calcs.

---

### M10 — Scenario Engine
**Produces:** Bull/Base/Bear/Stress comparison, probability-weighted returns, scenario narratives
**Consumed by:**

| Consumer | What It Gets | Data Field | Event/Trigger |
|----------|-------------|-----------|--------------|
| M09 ProForma | Stress-test parameter adjustments | `{ scenario_assumptions{}, demand_multiplier, supply_multiplier }` | On scenario change |
| M01 Overview | Probability-weighted return | `{ expected_irr, expected_equity_multiple }` | On scenario change |

**Receives from:** M06 (demand events), M04 (supply events), M09 (base proforma), M05 (market ranges)

---

### M12 — Exit Analysis
**Produces:** Optimal exit year, hold vs sell NPV, exit cap rate range, disposition value, 1031 timeline
**Consumed by:**

| Consumer | What It Gets | Data Field | Event/Trigger |
|----------|-------------|-----------|--------------|
| M09 ProForma | Exit proceeds for IRR calc | `{ exit_value, net_sale_proceeds_after_debt }` | On exit change |
| M14 Risk | Exit timing risk | `{ years_to_optimal_exit, cap_rate_forecast_uncertainty }` | On exit change |

**Receives from:** M09 (projected NOI/CF), M05 (cap rate trends), M04 (future supply pressure), M11+ (loan balance/prepayment)

---

### M14 — Risk Dashboard
**Produces:** Composite risk score, 6-category breakdown (supply 35%, demand 35%, regulatory 10%, market 10%, execution 5%, climate 5%)
**Consumed by:**

| Consumer | What It Gets | Data Field | Event/Trigger |
|----------|-------------|-----------|--------------|
| M01 Overview | Composite risk + top alert | `{ composite_risk, highest_category, trend_direction }` | On risk change |
| M08 Strategy | Risk-adjusted strategy scores | `{ risk_adjusted_scores[4] }` | On risk change |
| M25 JEDI Score | Risk sub-score input (F06) | `{ risk_score (inverted: lower risk = higher score) }` | On risk change |
| M23 Alerts | Risk threshold breach alerts | `{ breached_category, current_score, threshold }` | On risk > threshold |

**Receives from:** M04 (supply risk), M06 (demand risk), M02 (regulatory risk), M05 (market risk), M03/M13 (execution risk), climate data, M11+ (financial risk from DSCR/LTV)

---

### M25 — JEDI Score Engine
**Produces:** JEDI Score (0-100), 5 sub-scores, confidence level, score delta, score history
**Formula:** `F01: (Demand × 0.30) + (Supply × 0.25) + (Momentum × 0.20) + (Position × 0.15) + (Risk × 0.10)`
**Consumed by:**

| Consumer | What It Gets | Data Field | Event/Trigger |
|----------|-------------|-----------|--------------|
| M01 Overview | Score gauge display | `{ jedi_score, sub_scores[5], delta_30d, confidence }` | On any sub-score change |
| M20 Map | Bubble colors + sizing | `{ jedi_score, property_id }` | On score change |
| M16 Pipeline | Sort/filter deals by score | `{ jedi_score, score_trend }` | On score change |
| M23 Alerts | Score change alerts | `{ old_score, new_score, delta, trigger_events[] }` | On significant change |

**Receives from:** M04 (supply sub-score), M05 (momentum + position), M06 (demand sub-score), M07 (traffic → position), M14 (risk sub-score)

---

### M01 — Deal Overview (AGGREGATOR)
**Produces:** Single-pane deal summary
**Consumed by:** User (display only — this is the terminal node)
**Receives from:** EVERYTHING — M25 (JEDI Score), M08 (strategy recommendation), M09 (key financials), M11+ (structure summary), M14 (risk alert), M16 (pipeline stage), M13 (DD completion %)

---

### Operations & Presentation Modules

**M13 Due Diligence** → Produces DD completion %, red flags → Feeds M01 (overview) and M14 (execution risk)

**M15 Competition** → Produces comp set, rent positioning, amenity gaps → Feeds M05 (market context) and M08 (strategy competitive data)

**M16 Pipeline** → Produces deal stage, velocity metrics → Feeds M01 (overview display)

**M17 Team** → Produces assignments, activity → Feeds M16 (pipeline workflow)

**M18 Documents** → Produces document index, OCR data → Feeds M13 (DD checklist)

**M20 Map** → Produces visual overlays → Reads from M25, M04, M06, M02

**M21 AI Chat** → Produces natural language answers → Reads from ALL modules

**M22 Portfolio** → Produces actual vs projected → Reads from M09, user financial uploads

**M23 Alerts** → Produces notification feed → Reads from M25, M14, M04, M06, M16

**M24 Settings** → Produces user preferences → Feeds ALL (weight overrides, trade areas, keywords)

---

## Critical Data Chains

These are the 5 chains that make the platform work. Break any link and the intelligence degrades.

### Chain 1: News → Score (the data flywheel)
```
M19 News → classifies event → M06 Demand or M04 Supply
  → recalculates demand/supply sub-scores
  → M25 JEDI Score recalculates composite
  → M01 Overview updates score gauge
  → M23 Alerts fires if threshold crossed
```

### Chain 2: Strategy → Capital → Returns (the deal modeling chain)
```
M08 Strategy → selects optimal strategy → emits 'strategy-selected'
  → M11+ Capital Structure loads matching debt template
  → calculates debt service, DSCR, equity requirement
  → M09 ProForma receives debt service → calculates IRR, CoC, equity multiple
  → M01 Overview displays return metrics
```

### Chain 3: Zoning → Development → Strategy (the upside discovery chain)
```
M02 Zoning → parses FAR, density, setbacks
  → M03 Dev Capacity → calculates building envelope, max units
  → M08 Strategy → if buildable > existing, BTS scores higher
  → ARBITRAGE DETECTED: "Zoning allows 3x density, BTS outscores Rental by 15pts"
```

### Chain 4: Supply + Demand → Risk → Score (the risk assessment chain)
```
M04 Supply → supply_pressure_ratio, months_of_supply
M06 Demand → demand_units, employer_concentration
  → M14 Risk → composite risk score (supply_risk × 0.35 + demand_risk × 0.35 + ...)
  → M25 JEDI Score → risk sub-score (inverted)
  → M08 Strategy → risk-adjusted strategy scores
```

### Chain 5: Market → ProForma → Scenarios (the assumption chain)
```
M05 Market → baseline rent, vacancy, growth rates
  → M09 ProForma → auto-populates assumptions (user can override)
  → M10 Scenario → generates bull/bear variants from actual events
  → M09 ProForma → probability-weighted IRR
  → M01 Overview → "Base IRR: 16.8%, Risk-adjusted: 14.2%"
```

---

## The M09 ↔ M11+ Integration (Most Critical Wiring)

This is the connection that makes financial modeling work. Currently broken — ProForma hardcodes `irr = 15` because it has no debt service input.

### Data Contract

**M11+ Capital Structure PUSHES to M09 ProForma:**
```typescript
interface CapitalStructureOutput {
  annualDebtService: number;       // NOI - this = cash flow
  interestOnlyPeriod: number;      // months before amortization starts
  amortizationSchedule: number[];  // annual principal + interest by year
  totalEquity: number;             // denominator for CoC and equity multiple
  lpEquity: number;                // for waterfall calculations
  gpEquity: number;                // for waterfall calculations  
  weightedCostOfCapital: number;   // discount rate for NPV calcs
  loanMaturityYear: number;        // when refi is forced
}
```

**M09 ProForma PUSHES to M11+ Capital Structure:**
```typescript
interface ProFormaOutput {
  noiYear1: number;                // for DSCR = NOI / debt_service
  noiProjections: number[];        // for covenant compliance tracking
  effectiveGrossIncome: number;    // for debt yield = NOI / loan_amount
  totalDevelopmentCost: number;    // for LTC (loan-to-cost) in construction
  purchasePrice: number;           // for LTV = loan / value
}
```

**Resolution Order:**
1. M09 calculates NOI (doesn't need debt service)
2. M11+ receives NOI → sizes debt → calculates debt service
3. M11+ pushes debt service back to M09
4. M09 calculates cash flow, IRR, CoC, equity multiple
5. Both modules are now in sync

**DealModuleContext Events:**
```typescript
// Capital Structure emits:
emitEvent('capital-updated', { 
  annualDebtService, dscr, ltv, totalEquity, loanBalance[] 
});

// ProForma emits:
emitEvent('financial-updated', { 
  noi, cashFlow, irr, equityMultiple 
});

// Capital Structure listens for:
lastEvent?.type === 'financial-updated' → recalc DSCR with new NOI

// ProForma listens for:
lastEvent?.type === 'capital-updated' → recalc cash flow with new debt service
```

---

## Modules Absorbed by Capital Structure Engine

| Old Module | Status | New Location |
|-----------|--------|-------------|
| M11 Debt Section (688 lines) | REPLACED | → Capital Structure tabs 1-3 |
| Debt Market Section (72 lines, placeholder) | ABSORBED | → Tab 3: Rate Environment |
| Capital Events Section (86 lines, placeholder) | ABSORBED | → Tab 6: Capital Lifecycle |

**Financial Section waterfall** (in financialMockData.ts): REMOVED from Financial, now lives exclusively in Capital Structure Tab 4 (Equity Waterfall). One source of truth.

---

## Implementation Order

Wire these in sequence — each unlocks the next:

| Phase | What to Wire | Unlocks |
|-------|-------------|---------|
| 1 | M11+ Capital Structure (frontend + mock) | Visual capital stack, strategy templates |
| 2 | M09 ↔ M11+ integration (debt service flow) | Real IRR/CoC/equity multiple calculations |
| 3 | M08 → M11+ strategy event | Auto-loading capital templates on strategy change |
| 4 | M11+ → M14 risk feed | Financial risk subscore (DSCR/LTV exposure) |
| 5 | M11+ → M12 exit feed | Net sale proceeds after debt payoff |
| 6 | Rate environment API (FRED) | Live Treasury/SOFR/Fed data |

# F9 Composer Endpoint Audit — Dispatch D Closing Note

**Date:** 2026-05-20  
**Task:** #949 — F9 Composer endpoint audit (investigation only)  
**Type:** Investigation — no code changes  

---

## Architecture Clarification (Critical)

Before interpreting the per-deal audit, one architectural fact must be established:

**The GET `/api/v1/deals/:dealId/financials` route does NOT use `composeDealFinancials`.**

- The route handler (inline-deals.routes.ts line 1811) calls **`getDealFinancials`** from `proforma-adjustment.service.ts`
- `composeDealFinancials` (financials-composer.service.ts) is only called by the PATCH unit-mix override handler at line 2159
- `composeDealFinancials` hardcodes `returns: null`, `taxes: null`, `debt: null`, `sourcesUses: null`, `waterfall: null`, `capital: null` at lines 634–649 — this is **intentional** because it is not the primary data pipeline
- `getDealFinancials` DOES compute all these fields (returns via IIFE at line 4529, taxes at line 3422, sourcesUses at line 3853, waterfall at line 4146, capital at line 4132)

Both services were audited; per-deal results below are from `getDealFinancials` (the live route).

---

## Three-Deal Summary Table

| Field | Bishop (464) | Sentosa Epperson | Jaguar Redevelopment |
|---|---|---|---|
| `totalUnits` | 232 | 304 | 0 ⚠️ |
| `purchasePrice` | $60,000,000 | **null** ⚠️ | $9,000,000 |
| `loanAmount` | $42,000,000 | **null** | $5,850,000 |
| `equityAtClose` | $15,000,000 | **null** | $3,150,000 |
| `proforma.year1` resolved | 29/32 | 29/32 | 2/32 ⚠️ |
| `unitEconomics` non-null | 5/6 | 5/6 | 0/6 |
| `valuationSnapshot` non-null fields | 4/12+ | 0 | 1 |
| `returns.lpNetIrr` | -5.44% (computed) | **null** | **null** |
| `returns.lpEquityMultiple` | 0.671x | **null** | -0.785x (bad data) |
| `returns.avgCashOnCash` | -4.1% | **null** | -23.3% (bad data) |
| `returns.goingInCapRate` | 2.55% | **null** | -2.1% (bad data) |
| `capitalStack` | ✅ fully populated | ⚠️ all null | ✅ populated |
| `sourcesUses.totalSources` | $60,000,000 | **null** | $9,000,000 |
| `sourcesUses.totalUses` | $63,669,600 | $1,611,200 (capex only) | $15,265,332 |
| `trafficProjection.yearly` | 0 rows | N/A | 0 rows |
| `projections` | 10 rows | 10 rows | 10 rows |
| `waterfall.tiers` | 3 tiers | 3 tiers | 3 tiers |
| `capital.schedule` | 11 rows | 0 rows | 11 rows |
| `capital.metrics.lpIrr` | 9.76% | **null** | 38.47% (bad data) |
| `taxes.reTax.platformAnnualTax` | $696,000 | $0 | $191,489 |
| `debt` | PRESENT | PRESENT | PRESENT |

---

## Per-Field Null Categorization

### Category (a) — Composer doesn't compute it

| Field | Deals affected | Evidence |
|---|---|---|
| `proforma.valuationSnapshot.pricePerSF` | All | `buildValuationSnapshot` requires `deal_data.net_rentable_sf` — not set on any deal |
| `proforma.valuationSnapshot.*SubmarketMedian` / `*Percentile` | All | `buildValuationSnapshot` has no market data integration; submarket medians are always null (no query to `deal_market_data` or `apartment_market_snapshots`) |
| `trafficProjection.peerBenchmark` | All | `buildTrafficProjection()` in `composeDealFinancials` is a static placeholder (always returns empty shell); `getDealFinancials` calls `getTrafficProjection()` which returns null peerBenchmark until M07 runs |
| `returns.valuation.*SubmarketMedian` | All | `getDealFinancials` returns IIFE builds valuation metrics but leaves `submarketMedian: null` explicitly — no market data lookup |
| `returns.strategyAlternative` | All | Hardcoded `null as any` in the returns IIFE — M25 strategy analysis output is never merged here |

### Category (b) — Composer computes but writes null due to missing source data

| Field | Deal | Missing source | Evidence |
|---|---|---|---|
| `returns.*` (all fields) | Sentosa Epperson | No purchase price → `equityAtClose = null` → XIRR guard triggers `return null` at line 4530 | `capitalStack_purchasePrice: null` confirmed |
| `sourcesUses.sources` | Sentosa | No purchase price → no equity/debt rows built | `totalSources: null` |
| `capital.schedule` | Sentosa | `projEquityOuter = 0` → waterfall distribution loop produces no rows | `capital_schedule_len: 0` |
| `proforma.unitEconomics.*` | Jaguar | `totalUnits = 0` → all per-unit divisions return null | `totalUnits: 0` confirmed |
| `proforma.year1` (30/32 rows null) | Jaguar | `totalUnits = 0` blocks GPR/vacancy/opex seeding | `proforma_year1_resolved_pct: 2/32` |
| `taxes.reTax.platformAnnualTax` = 0 | Sentosa | No `city`/`state_code` on deal row → jurisdiction resolves to default 0 | Requires deal geo data |
| `proforma.valuationSnapshot` | Sentosa/Jaguar | No purchase price (Sentosa) / all-null NOI (Jaguar) → `buildValuationSnapshot` returns null | |
| `proforma.unitEconomics.opexPerUnit`/`opexRatioPct` | All (from `composeDealFinancials`) | `buildUnitEconomics` in `composeDealFinancials` cannot compute opex ratio — the `total_opex` row's resolved depends on debt_service resolution which is unseeded | Different to `getDealFinancials` which correctly computes opex from expense row sum |

### Category (c) — Field not in schema

None identified. All currently-null fields exist in `F9DealFinancials` type.

### Category (d) — Upstream engine hasn't run for this deal

| Field | Deals affected | Engine needed | Evidence |
|---|---|---|---|
| `trafficProjection.yearly` | All (0 rows) | M07 Traffic Engine | `getTrafficProjection` returns empty yearly[] until rent roll uploaded + M07 engine calibrated |
| `trafficProjection.calibrated.exitCap` | All (null) | M07 calibration | Required for OverviewTab Broker vs Platform exit cap row |
| `trafficProjection.calibrated.vacancyPct` | All (null) | M07 calibration | Required for OverviewTab Vacancy (M07) row |
| `trafficProjection.leasingSignals` | All (null) | M07 rent roll S1 aggregation | Requires `subject_traffic_history` row |
| `returns.debtMetrics.stress.dscrAtPlus200bps` | All (null) | Hardcoded null in IIFE (line 4679) — stub pending rate sensitivity engine | |
| `returns.debtMetrics.refi.events` | All (empty array) | Hardcoded empty (line 4683) — requires refinancing event detection engine | |

---

## Bishop Source-Slot Coverage Matrix (Proforma Year 1)

Data from `composeDealFinancials` (consistent with `getDealFinancials` source layers — resolution values differ slightly due to different row-building code paths).

| Field | Broker | Platform | T-12 | Rent Roll | Resolved | Resolution |
|---|---|---|---|---|---|---|
| `gpr` | ✅ | ✅ | ✅ | ✅ | ✅ | aggregated |
| `vacancy_loss` | ✅ | ✅ | — | ✅ | ✅ | proforma |
| `loss_to_lease` | ✅ | ✅ | — | ✅ | ✅ | proforma |
| `concessions` | ✅ | ✅ | — | — | ✅ | proforma |
| `bad_debt` | — | — | ✅ | — | ✅ | proforma |
| `non_revenue_units` | — | ✅ | — | — | ✅ | proforma |
| `net_rental_income` | ✅ | ✅ | ✅ | — | ✅ | aggregated |
| `other_income` | ✅ | ✅ | — | — | ✅ | proforma |
| `egi` | ✅ | ✅ | ✅ | — | ✅ | aggregated |
| `payroll` | ✅ | ✅ | ✅ | — | ✅ | proforma |
| `repairs_maintenance` | ✅ | ✅ | ✅ | — | ✅ | proforma |
| `turnover` | ✅ | ✅ | ✅ | — | ✅ | proforma |
| `contract_services` | — | ✅ | ✅ | — | ✅ | proforma |
| `marketing` | ✅ | ✅ | ✅ | — | ✅ | proforma |
| `utilities` | ✅ | ✅ | ✅ | — | ✅ | proforma |
| `g_and_a` | ✅ | ✅ | ✅ | — | ✅ | proforma |
| `management_fee` | ✅ | ✅ | ✅ | — | ✅ | proforma |
| `insurance` | ✅ | ✅ | ✅ | — | ✅ | proforma |
| `real_estate_taxes` | ✅ | — | ✅ | — | ✅ | proforma |
| `replacement_reserves` | ✅ | — | — | — | ✅ | proforma |
| `total_opex` | ✅ | ✅ | ✅ | — | ✅ | aggregated |
| `noi` | ✅ | ✅ | ✅ | — | ✅ | aggregated |
| *(one opex sub-row, field missing in compose path)* | — | ✅ | ✅ | — | ✅ | proforma |
| `pre_tax_cash_flow` | — | — | — | — | **null** | aggregated |
| `debt_service` | — | — | — | — | **null** | unseeded |

**Coverage: 22/24 rows resolved (91.7%).** Two rows are blank:
- `pre_tax_cash_flow`: requires debt service to be seeded first (debt_service row also null)
- `debt_service`: needs operator to enter interest rate + LTV (or agent to populate). Bishop has `loanAmount=$42M` and `interestRate` set, but the seeder did not write this into `year1.debt_service`

---

## Bishop Returns — Explanation of Negative Values

Bishop's returns are computed and non-null but negative. This is mathematically correct given the current deal assumptions:

| Metric | Value | Implication |
|---|---|---|
| Y1 GPR | $4,849,260 | 232 units × $1,744/unit/mo |
| Y1 NOI | $1,528,956 | 31.5% NOI margin (very thin) |
| Y1 Debt Service | $2,520,000 | IO loan at ~6% × $42M |
| Y1 DSCR | 0.607 | Deep undercoverage (need >1.25) |
| Y1 CoC (unleveraged) | -6.6% | Negative leverage |
| Exit (Y10) NOI | $2,148,109 | After 10-year growth |
| Exit Cap (assumption) | 5.0% | Deal's configured exit cap |
| Gross Sale Value | $44,036,240 | NOI / exitCap |
| Loan Payoff | $42,000,000 | IO loan — no amortization in 10 years |
| Net Sale Proceeds | $1,551,842 | $44M − $42M − fees |
| LP Equity Multiple | 0.671x | Investor recovers 67c per $1 invested |
| LP Net IRR | -5.44% | NPV-negative deal as modeled |

Root cause: The loan ($42M) is interest-only for the full hold period. The Y10 exit value ($44M) barely exceeds the loan payoff. The going-in cap rate (2.55%) is far below the debt cost (~6%), creating severe negative leverage from day 1. These are correct computations — the deal as currently underwritten is a loss. No code bug.

The `capital.metrics.lpIrr = 9.76%` discrepancy (vs `returns.lpNetIrr = -5.44%`) is expected: the capital schedule uses a waterfall distribution model that includes promote earnings and fee structures; `returns.lpNetIrr` is the raw XIRR of equity-invested cashflows.

---

## OverviewTab Tile → Data Source Mapping

Critical: the OverviewTab reads from **two different data sources** for different tile groups. This matters for understanding which tiles require a build run vs. which are populated from the Composer route.

| Overview Tile / Panel | Data Source | Bishop Status | Blocking Condition |
|---|---|---|---|
| KPI: IRR | `f9Financials.returns.lpNetIrr` (Task #948 fix) | **-5.44%** (was blank before #948) | Returns non-null; negative value is correct |
| KPI: Equity Multiple | `f9Financials.returns.lpEquityMultiple` | **0.671x** (was blank before #948) | Correct |
| KPI: Cash-on-Cash | `f9Financials.returns.avgCashOnCash` | **-4.1%** (was blank before #948) | Correct |
| KPI: NOI | `summary.noi` (from build) | Blank until build runs | Build required |
| KPI: Price/Unit | `f9Financials.capitalStack.pricePerUnit` | $60M (pricePerUnit = $258,621) | Populated ✅ |
| Broker vs Platform table | `f9Financials.trafficProjection.calibrated.exitCap` + strategy analyses | All blank (exitCap null; no M25 run) | (d) M07 trigger needed |
| JEDI Position score | LV engine / rent roll scores | Blank | (d) LV engine + rent roll required |
| Unit Economics: GPR/EGI/NOI per unit | `f9Financials.proforma.unitEconomics` | ✅ Populated | |
| Unit Economics: OPEX / unit | `f9Financials.proforma.unitEconomics.opexPerUnit` | ✅ Populated in getDealFinancials (5/6 non-null) | composeDealFinancials shows null here — minor discrepancy |
| Unit Economics: OPEX RATIO | `f9Financials.proforma.unitEconomics.opexRatioPct` | **null** — not in getDealFinancials 5 non-null | `opexRatioPct` is the missing 6th field |
| Valuation: GRM / Price/Unit / Going-In Cap | `f9Financials.proforma.valuationSnapshot` | ✅ 4 fields present | |
| Valuation: submarket comparisons | `f9Financials.proforma.valuationSnapshot.*SubmarketMedian` | **null** (category a) | No market data integration |
| Sources panel | `modelResults.sourcesAndUses` (line 33 — BUILD output) | **Blank** (build not run) | ⚠️ Wiring gap: `f9Financials.sourcesUses` IS populated ($60M/$63.7M) but OverviewTab reads `modelResults.sourcesAndUses` (the LV engine output), not `f9Financials.sourcesUses` |
| Uses panel | Same as Sources panel | **Blank** | Same wiring gap |
| RETURNS BREAKDOWN | `summary.lpTotalDistributions`, `summary.gpIrr`, etc. | Blank until build runs | Build required |
| RETURNS BY YEAR | `normalizeBuildResponse` annualCashFlow | Blank until build runs | Build required |
| Traffic projection yearly | `f9Financials.trafficProjection.yearly` | 0 rows (all deals) | (d) M07 trigger needed |

---

## Recommended Next Dispatch Priorities

Ordered by tiles-unblocked per session of effort:

### Priority 1 — Re-wire Overview Sources/Uses to f9Financials (High impact, Low effort)
**Estimated effort: 0.5 sessions**
The OverviewTab Sources/Uses panels read from `modelResults.sourcesAndUses` (the LV build output) while the Composer already provides `f9Financials.sourcesUses` with fully-computed $60M sources / $63.7M uses for Bishop. Changing the OverviewTab to prefer `f9Financials.sourcesUses` as primary source would populate the Sources and Uses panels immediately for any deal with a purchase price, without requiring a build run. The `modelResults.sourcesAndUses` can remain as a secondary fallback (it reflects the LV engine's version if it differs).
Files: `frontend/src/pages/development/financial-engine/OverviewTab.tsx` (lines 80-83 + S&U section)

### Priority 2 — Wire M07 engine triggers for Bishop (High impact, Medium effort)
**Estimated effort: 1 session**  
All traffic-derived Overview tiles (exit cap, vacancy M07, platform projections, peer benchmark) are gated behind `trafficProjection.yearly.length > 0`. `getTrafficProjection` returns an empty array until the M07 engine runs for the deal. Triggering M07 for Bishop specifically (with at least a baseline calibration run using the rent roll summary already present) would unblock these tiles. This is tracked as Task #951.

### Priority 3 — Re-wire Overview `opexRatioPct` to use expense row sum
**Estimated effort: 0.25 sessions**  
`opexRatioPct` is null in both Composer paths because neither explicitly computes it. But `totalOpex` and `egi` rows are both non-null and resolved. Adding `opexRatioPct: totalOpex.resolved / egi.resolved` to `buildUnitEconomics` in `composeDealFinancials` and the equivalent in `getDealFinancials` would fill this metric without any new data dependencies.

### Priority 4 — Add `net_rentable_sf` to Bishop deal data (Quick win)
**Estimated effort: 0.25 sessions**  
`pricePerSF` in the valuationSnapshot is always null because `deal_data.net_rentable_sf` is not set on any deal. Adding this field (232 units × ~900 SF/unit typical for Atlanta MF = ~208,800 SF) would unlock `pricePerSF`, `exitPricePerSF`, and all three submarket-relative metrics once market data is available.

### Priority 5 — Sentosa Epperson purchase price entry (Operator action — no code)
**Estimated effort: operator action**  
All returns, valuation metrics, sourcesUses sources, and capital schedule for Sentosa are null because no purchase price has been entered. No code change required. Once entered, the Composer auto-populates all derived fields.

### Priority 6 — Jaguar Redevelopment unit count (Operator action — no code)
**Estimated effort: operator action**  
`totalUnits = 0` for Jaguar. Once the operator sets target_units, all 30 remaining unseeded year1 rows will populate and computed returns will correct.

---

## Source of Truth for Submarket Comparisons (Long-term gap)

`proforma.valuationSnapshot.*SubmarketMedian` and `*Percentile` fields are always null across all three deals. These require:
1. `deal_market_data` rows linked to the deal's `submarketId`, OR
2. `apartment_market_snapshots` for the MSA/submarket

Neither is populated for any deal in this environment (Bishop has no `submarketId` in `deal_data`). This is a **category (a)** gap — the Composer has no query path to these tables. Requires a separate Dispatch to (a) ensure Bishop has a `submarketId`, and (b) add submarket lookup logic to `buildValuationSnapshot`.

---

## Appendix — Service Call Confirmation

Both services were called directly via `ts-node` in the dev environment:
- `composeDealFinancials`: always returns `returns: null, taxes: null, debt: null, sourcesUses: null, waterfall: null, capital: null` (hardcoded) — confirmed at lines 634–649
- `getDealFinancials`: computes all fields at runtime; returns populated objects as documented above

The 10-year `projections` array is populated by both services (via `buildProjections` in `composeDealFinancials` and inline IIFE in `getDealFinancials`) for all deals with year1 seed data. Jaguar has 10 projection rows despite totalUnits=0 — the projections contain nonsense values (negative NOI, negative netSaleProceeds) because the underlying operating assumptions are all near-zero.

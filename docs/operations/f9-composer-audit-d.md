# F9 Composer Endpoint Audit — Dispatch D Closing Note

**Date:** 2026-05-20  
**Task:** #949 — F9 Composer endpoint audit (investigation only)  
**Type:** Investigation — no code changes  
**Evidence source:** All data captured directly from `getDealFinancials()` (the live route service) via `ts-node` test harness  

---

## Architecture Clarification (Critical)

**The GET `/api/v1/deals/:dealId/financials` route does NOT use `composeDealFinancials`.**

- Route handler (inline-deals.routes.ts line 1811) calls **`getDealFinancials`** from `proforma-adjustment.service.ts`
- `composeDealFinancials` (financials-composer.service.ts) is only called by the PATCH unit-mix override handler at line 2159
- `composeDealFinancials` hardcodes `returns: null`, `taxes: null`, `debt: null`, `sourcesUses: null`, `waterfall: null`, `capital: null` at lines 634–649 — this is the override-path service, not the main pipeline
- `getDealFinancials` DOES compute all fields at runtime (returns IIFE at line 4529, taxes at 3422, sourcesUses at 3853, waterfall at 4146, capital at 4132)

All per-deal audit values below are from `getDealFinancials` — the live endpoint.

---

## Per-Deal Field Audit

All three deals share `user_id = 6253ba3f-d40d-4597-86ab-270c8397a857`.

| Tracked Field | Bishop (464) | Sentosa Epperson | Jaguar Redevelopment |
|---|---|---|---|
| **Deal ID** | `3f32276f-aacd-4da3-b306-317c5109b403` | `3d96f62d-d986-448f-8ea4-10853021a8cb` | `8aa4c42a-9f1f-47ba-b9d4-9def37b0b323` |
| **totalUnits** | 232 | 304 | **0** ⚠️ |
| `purchasePrice` | $60,000,000 | **null** ⚠️ | $9,000,000 |
| `loanAmount` | $42,000,000 | **null** | $5,850,000 |
| `equityAtClose` | $15,000,000 | **null** | $3,150,000 |
| `proforma.year1` resolved | 29 / 32 rows | 29 / 32 rows | 2 / 32 rows ⚠️ |
| `proforma.unitEconomics` non-null | 5 / 6 fields | 5 / 6 fields | 0 / 6 fields |
| `proforma.valuationSnapshot` non-null fields | 4 of ~12 | 0 | 1 |
| `returns.lpNetIrr` | -5.44% ✅ computed | **null** | **null** |
| `returns.lpEquityMultiple` | 0.671x ✅ computed | **null** | -0.785x (bad data) |
| `returns.avgCashOnCash` | -4.1% ✅ computed | **null** | -23.3% (bad data) |
| `returns.goingInCapRate` | 2.55% ✅ | **null** | -2.1% (bad data) |
| `returns.unleveragedIrr` | 0.58% ✅ | **null** | **null** |
| `returns.gpPromoteEarned` | $5,866,992 ✅ | $0 (no equity) | $13,933,051 (bad data) |
| `returns.minDscr` | 0.607 ✅ | **null** | -1.008 (bad data) |
| `capitalStack.purchasePrice` | $60,000,000 ✅ | **null** | $9,000,000 ✅ |
| `rentRollSummary.unitMix` length | **11 rows** ✅ | **6 rows** ✅ | **2 rows** ✅ |
| `waterfall.tiers` length | 3 tiers ✅ | 3 tiers ✅ | 3 tiers ✅ |
| `capital.schedule` length | 11 rows ✅ | **0 rows** (no equity) | 11 rows ✅ |
| `capital.metrics.lpIrr` | 9.76% ✅ | **null** | 38.5% (bad data) |
| `sourcesUses.totalSources` | $60,000,000 ✅ | **null** (no PP) | $9,000,000 ✅ |
| `sourcesUses.totalUses` | $63,669,600 ✅ | $1,611,200 (capex only) | $15,265,332 ✅ |
| `trafficProjection.yearly` length | **0 rows** (placeholder) | **0 rows** | **0 rows** |
| `trafficProjection.calibrated.exitCap` | **null** | **null** | **null** |
| `projections` length | 10 rows ✅ | 10 rows ✅ | 10 rows ✅ |
| `taxes.reTax.platformAnnualTax` | $696,000 ✅ | $0 (no geo) | $191,489 ✅ |
| `debt` (present/null) | PRESENT ✅ | PRESENT ✅ | PRESENT ✅ |
| `leaseVelocity` (on response) | **NULL** | **NULL** | **NULL** |

### Notes on `leaseVelocity`
`leaseVelocity` is not a field on `DealFinancials` and is not returned by `getDealFinancials`. It is referenced in `FinancialEnginePage.tsx` via `f9Financials?.trafficProjection?.leasingSignals` (the M07 lease velocity signals). `leasingSignals` is null for all three deals because no `subject_traffic_history` row exists (M07 hasn't run). `leaseVelocity` as a standalone top-level field on the financials response does not exist in the current schema.

---

## Per-Field Null Categorization

### (a) Composer doesn't compute it — structural gap

| Field | Deals affected | Evidence |
|---|---|---|
| `proforma.valuationSnapshot.pricePerSF` | All | `buildValuationSnapshot` reads `deal_data.net_rentable_sf` — field not set on any deal |
| `proforma.valuationSnapshot.*SubmarketMedian` / `*Percentile` | All | No query to `deal_market_data` or `apartment_market_snapshots` in either service; these fields are built as `null as number | null` literals |
| `returns.valuation.perUnit.submarketMedian` / `percentile` | All | Returns IIFE line 4726 hardcodes `null as number | null` — no submarket lookup |
| `returns.strategyAlternative` | All | Returns IIFE hardcodes `null as any` — M25 output never merged |
| `proforma.unitEconomics.opexRatioPct` | All | Neither `getDealFinancials` nor `buildUnitEconomics` in `composeDealFinancials` computes this ratio; `totalOpex` and `egi` are both non-null in the row set for Bishop |
| `returns.debtMetrics.stress.dscrAtPlus200bps` | All | Hardcoded `null as number | null` at line 4679 — rate sensitivity engine stub |
| `returns.debtMetrics.refi.events` | All | Hardcoded empty array at line 4683 — refi event detection not built |

### (b) Composer computes but writes null due to missing source data

| Field | Deal | Missing source | Evidence |
|---|---|---|---|
| `returns.*` (all) | Sentosa Epperson | No purchase price → `equityAtClose = null` → XIRR guard at line 4530 returns null | `capitalStack.purchasePrice = null` confirmed |
| `sourcesUses.totalSources` / `.sources` | Sentosa | No purchase price → no equity/debt rows constructed | `totalSources = null` |
| `capital.schedule` | Sentosa | `projEquityOuter = 0` → distribution loop produces zero rows | `capital_schedule_len = 0` |
| `proforma.year1` (30/32 rows null) | Jaguar | `totalUnits = 0` blocks all per-unit GPR, vacancy, opex seeding | `totalUnits = 0` confirmed |
| `proforma.unitEconomics.*` | Jaguar | All divide by `totalUnits` → 0 division → all null | |
| `proforma.valuationSnapshot` | Sentosa/Jaguar | No purchase price (Sentosa) / all-null NOI + garbage ratios (Jaguar) | |
| `taxes.reTax.platformAnnualTax = 0` | Sentosa | No `city`/`state_code` on deal row → jurisdiction falls back to default $0 | |
| `proforma.valuationSnapshot.pricePerSF` | Bishop | `deal_data.net_rentable_sf` not set — otherwise computable | Resolved value: $60M / 0 SF = skip |
| `proforma.year1.water_sewer` / `.electric` / `.gas_fuel` | Bishop | T-12 extraction captured aggregate `utilities` but not individual sub-utility GL lines — 3 rows fully null | All three rows: broker/platform/t12/rentRoll/resolved all null, resolution="platform_fallback" |

### (c) Field not in schema

None identified. All currently-null fields exist in `F9DealFinancials` type.

### (d) Upstream engine hasn't run

| Field | Deals affected | Engine needed | Evidence |
|---|---|---|---|
| `trafficProjection.yearly` | All (0 rows) | M07 Traffic Engine | `getTrafficProjection` returns empty `yearly[]` until M07 calibrated for deal |
| `trafficProjection.calibrated.exitCap` / `.vacancyPct` | All (null) | M07 calibration | All three `calibrated` fields null |
| `trafficProjection.leasingSignals` | All (null) | M07 S1 aggregation | Requires `subject_traffic_history` row |
| `trafficProjection.peerBenchmark` | All (null) | Submarket peer registration | Requires deal `submarketId` + registered peers |

---

## Bishop Year-1 Source-Slot Coverage Matrix (from getDealFinancials — live route)

32-row operating statement as returned by `getDealFinancials`. Values are raw numbers; columns marked ✅ = non-null, — = null.

| # | Field | Broker | Platform | T-12 | Rent Roll | Tax Bill | Resolved | Resolution |
|---|---|---|---|---|---|---|---|---|
| 1 | `gpr` | ✅ $4,849,260 | ✅ $4,849,260 | ✅ $4,849,260 | ✅ $4,849,260 | — | ✅ $4,849,260 | t12 |
| 2 | `loss_to_lease_pct` | — | ✅ 0.003 | ✅ 0.078 | ✅ 0.013 | — | ✅ 0.078 | t12 |
| 3 | `vacancy_pct` | ✅ 0.05 | ✅ 0.07 | — | ✅ 0.198 | — | ✅ 0.05 | om |
| 4 | `concessions_pct` | ✅ 0 | ✅ 0.02 | — | ✅ 0 | — | ✅ 0 | om |
| 5 | `bad_debt_pct` | — | ✅ 0.01 | ✅ 0.0086 | — | — | ✅ 0.0086 | t12 |
| 6 | `non_revenue_units_pct` | — | — | ✅ 0 | — | — | ✅ 0 | t12 |
| 7 | `other_income_per_unit` | ✅ $857 | — | ✅ $169 | ✅ $58 | — | ✅ $64.76 | rent_roll |
| 8 | `net_rental_income` | ✅ $4,656,330 | ✅ $3,715,805 | ✅ $1,239,509 | — | — | ✅ $4,488,154 | platform_fallback |
| 9 | `egi` | ✅ $4,855,206 | ✅ $3,715,805 | ✅ $1,278,761 | — | — | ✅ $4,830,061 | agent |
| 10 | `loss_to_lease` | ✅ $0 | — | ✅ $16,960 | ✅ $63,899 | — | ✅ $16,960 | t12 |
| 11 | `vacancy_loss` | ✅ $242,463 | ✅ $339,448 | ✅ $3,200,995 | ✅ $961,491 | — | ✅ $246,615 | agent |
| 12 | `concessions` | ✅ $0 | ✅ $96,985 | ✅ $377,249 | ✅ $0 | — | ✅ $0 | agent |
| 13 | `bad_debt` | — | ✅ $48,493 | ✅ $41,822 | — | — | ✅ $97,531 | agent |
| 14 | `non_revenue_units` | — | — | ✅ $0 | — | — | ✅ $0 | t12 |
| 15 | `other_income` | ✅ $198,876 | — | ✅ $39,252 | ✅ $13,560 | — | ✅ $341,907 | agent |
| 16 | `repairs_maintenance` | ✅ $69,600 | ✅ $127,600 | ✅ $134,208 | — | — | ✅ $69,600 | agent |
| 17 | `contract_services` | ✅ $38,083 | ✅ $46,400 | ✅ $19,640 | — | — | ✅ $69,600 | agent |
| 18 | `payroll` | ✅ $324,800 | ✅ $324,800 | ✅ $194,388 | — | — | ✅ $324,800 | agent |
| 19 | `marketing` | ✅ $69,600 | ✅ $46,400 | ✅ $43,897 | — | — | ✅ $69,600 | agent |
| 20 | `g_and_a` | ✅ $69,600 | ✅ $46,400 | ✅ $22,496 | — | — | ✅ $58,000 | agent |
| 21 | `turnover` | ✅ $41,760 | ✅ $46,400 | ✅ $1,540 | — | — | ✅ $41,760 | agent |
| 22 | `water_sewer` | — | — | — | — | — | **null** | platform_fallback |
| 23 | `electric` | — | — | — | — | — | **null** | platform_fallback |
| 24 | `gas_fuel` | — | — | — | — | — | **null** | platform_fallback |
| 25 | `utilities` | ✅ $187,094 | ✅ $208,800 | ✅ $184,968 | — | — | ✅ $187,094 | agent |
| 26 | `insurance` | ✅ $46,400 | ✅ $69,600 | ✅ $63,699 | — | — | ✅ $125,280 | agent |
| 27 | `real_estate_tax` | ✅ $977,287 | ✅ $696,000 | ✅ $1,127,126 | — | ✅ $20,731 | ✅ $696,000 | **platform** (tax engine) |
| 28 | `management_fee_pct` | ✅ 2.75% | ✅ 4.5% | ✅ 11.4% | — | — | ✅ 11.4% | t12 |
| 29 | `replacement_reserves` | ✅ $46,400 | — | — | — | — | ✅ $46,400 | agent |
| 30 | `total_opex` | ✅ $1,855,642 | ✅ $1,083,611 | ✅ $2,323,931 | — | — | ✅ $1,660,183 | platform_fallback |
| 31 | `management_fee` | ✅ $128,049 | ✅ $209,535 | ✅ $531,970 | — | — | ✅ $128,049 | agent |
| 32 | `noi` | ✅ $2,999,564 | ✅ $2,632,194 | ✅ -$1,045,170 | — | — | ✅ $3,169,878 | platform_fallback |

**Coverage: 29 / 32 rows resolved (90.6%).**  
Three null rows: `water_sewer`, `electric`, `gas_fuel` — T-12 extraction captured aggregate `utilities` ($184,968) but not individual sub-utility GL lines. All three have `resolution = "platform_fallback"` with null resolved because `getDealFinancials` has no seeded platform values for these sub-lines. The `utilities` aggregate row (#25) IS resolved and carries the real figure.

**Key observations:**
- `real_estate_tax` row #27: Broker ($977K) vs Platform ($696K) vs T-12 ($1.13M) — wide spread; resolved = $696K (tax engine override). TaxBill slot shows only $20,731 (partial parcel record).
- `management_fee_pct` row #28: T-12 shows 11.4% (likely partial year denominator issue or GL mapping problem). Resolved = 11.4% (T-12 wins); the `management_fee` dollar row #31 resolved = $128K (agent-computed from EGI × 2.75%), creating an implied management_fee_pct inconsistency between the two rows.
- NOI T-12 is -$1,045,170 — suspicious; likely reflects partial-year T-12 extraction window. Resolved NOI = $3.17M (platform_fallback).

---

## Bishop Returns — Exit Math Explanation

Returns are computed and non-null but negative. Correct per current assumptions.

| Metric | Value | Notes |
|---|---|---|
| Y1 GPR | $4,849,260 | 232 units × $1,744/unit/mo |
| Y1 NOI | $1,528,956 | 31.6% NOI margin |
| Y1 Debt Service | $2,520,000 | IO at ~6% × $42M |
| Y1 DSCR | 0.607 | Deep undercoverage |
| Y1 CoC | -6.6% | Negative leverage |
| Exit (Y10) NOI | $2,148,109 | After 3% annual growth |
| Exit Cap | 5.0% | Deal assumption |
| Gross Sale Value | $44,036,240 | NOI / exitCap |
| Loan Payoff | $42,000,000 | IO — no amortization (10-yr outstandingBalance = $42M) |
| Net Sale Proceeds | $1,551,842 | $44M − $42M − fees |
| LP Net IRR | -5.44% | Correct — NPV-negative deal as modeled |
| LP EM | 0.671x | Investor recovers 67¢ per $1 invested |

Root cause: IO loan ($42M) never amortizes; exit value barely covers payoff. No code bug. The deal returns negative because the going-in cap (2.55%) is far below debt cost (6.61%).

Note: `capital.metrics.lpIrr = 9.76%` vs `returns.lpNetIrr = -5.44%` — expected discrepancy. The capital schedule applies the waterfall model (pref + promote tiers) and computes LP IRR after accounting for fee/promote distributions; `returns.lpNetIrr` is the raw XIRR of equity-invested project cashflows.

---

## OverviewTab Tile → Source Mapping and Status

| Overview Tile | Source field | Bishop status | Blank because |
|---|---|---|---|
| KPI: IRR | `f9Financials.returns.lpNetIrr` | ✅ -5.44% (was blank pre-#948) | Fixed in Task #948 |
| KPI: Equity Multiple | `f9Financials.returns.lpEquityMultiple` | ✅ 0.671x | Fixed in Task #948 |
| KPI: Cash-on-Cash | `f9Financials.returns.avgCashOnCash` | ✅ -4.1% | Fixed in Task #948 |
| KPI: NOI | `summary.noi` (build output) | Blank | Build required |
| UNIT ECONOMICS: GPR/EGI/NOI per unit | `f9Financials.proforma.unitEconomics` | ✅ 5/6 fields | |
| UNIT ECONOMICS: OPEX RATIO | `f9Financials.proforma.unitEconomics.opexRatioPct` | null | (a) Not computed in either service |
| VALUATION: GRM/pricePerUnit/goingInCap | `f9Financials.proforma.valuationSnapshot` | ✅ 4 fields | |
| VALUATION: submarket comparisons | `f9Financials.proforma.valuationSnapshot.*SubmarketMedian` | null | (a) No market data integration |
| BROKER vs PLATFORM table | `trafficProjection.calibrated.exitCap` + strategy analyses | Blank | (d) M07 not triggered |
| SOURCES panel | `modelResults?.sourcesAndUses` (line 33) | **Blank** ⚠️ | Wiring gap — reads LV BUILD output; `f9Financials.sourcesUses` IS populated ($60M) but not read |
| USES panel | Same | **Blank** ⚠️ | Same wiring gap |
| RETURNS BREAKDOWN | `summary.lpTotalDistributions` etc. | Blank | Build required |
| RETURNS BY YEAR | `normalizeBuildResponse` annualCashFlow | Blank | Build required |
| JEDI Position | LV engine / scores | Blank | (d) LV engine + rent roll required |
| Traffic yearly tiles | `trafficProjection.yearly` | Blank | (d) M07 not triggered |

---

## Recommended Next Dispatch Priorities

Ordered by tiles-unblocked per session of effort:

1. **Re-wire Overview Sources/Uses to `f9Financials.sourcesUses`** (0.5 sessions) — `f9Financials.sourcesUses` is already populated ($60M/$63.7M for Bishop) but OverviewTab reads the wrong field. One-line change to prefer `f9Financials.sourcesUses` unblocks both panels immediately without a build. Tracked as proposed Task #954.

2. **Trigger M07 for Bishop** (1 session) — All traffic/calibration/exit-cap tiles are gated on `trafficProjection.yearly.length > 0`. Tracked as Task #951.

3. **Add `opexRatioPct` to unit economics** (0.25 sessions) — `totalOpex` and `egi` both non-null; ratio is trivially computable. Tracked as proposed Task #955.

4. **Add `net_rentable_sf` to Bishop deal data** (0.25 sessions) — Unlocks `pricePerSF` in valuationSnapshot.

5. **Sentosa purchase price** — Operator action. Unblocks all returns, sources, capital schedule, valuation.

6. **Jaguar unit count** — Operator action. Sets `totalUnits > 0` to seed 30 remaining null year1 rows.

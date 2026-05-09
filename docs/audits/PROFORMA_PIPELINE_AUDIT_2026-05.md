# ProForma Pipeline Audit — May 2026

**Status:** Audit only — no code changes in scope.
**Reference deal:** 464 Bishop, `deal_id = 3f32276f-aacd-4da3-b306-317c5109b403` (232 units)
**Primary API:** `GET /api/v1/proforma/:dealId` → `ProFormaAdjustmentService.getProFormaComputed()`
**Secondary API:** `GET /api/v1/deals/:dealId/financials` → `getDealFinancials()`
**Evidence base:** Static code analysis + live DB queries at 2026-05-09
**Date:** 2026-05-09

---

## 0 — Architecture Overview: Two Decoupled Systems

The ProForma pipeline is not a single pipeline. It is two fully independent systems
that share a deal ID but no data:

```
System A — proforma_assumptions table
  Route:    GET /api/v1/proforma/:dealId             proforma.routes.ts:130
  Service:  ProFormaAdjustmentService.getProFormaComputed()
  Shape:    { rentGrowth, vacancy, opexGrowth, exitCap, absorption }
            each as AssumptionValue { baseline, current, effective }
            + computed metrics from deterministic-model-runner
  Purpose:  News-driven M35 adjustment; AI Market Findings cards
  Bug:      runModel() called with hardcoded deal inputs (lines 169-182)

System B — deal_assumptions.year1 JSONB
  Route:    GET /api/v1/deals/:dealId/financials
  Service:  getDealFinancials() → proforma-seeder.service.ts
  Shape:    { year1Rows, capitalStack, trafficProjection, integrityChecks, ... }
            Every field is LayeredValue<T> with broker/t12/rent_roll/tax_bill/
            platform/override slots
  Purpose:  F9 Financial Engine — ProFormaSummaryTab and all 13 tabs
```

**Root architectural gap:** System A's `vacancy_current` (5.00%) is never read by
System B. System B's `year1.vacancy_pct.resolved` (19.83%) is never surfaced by
System A. For the same deal the operator sees two different vacancy figures depending
on which surface they look at. The two systems are never reconciled.

---

## 1 — Layer 1: Broker Audit Table

All `om` slot values queried live from `deal_assumptions.year1` for 464 Bishop.
Broker claims capsule: `deal_data.broker_claims.proforma` (extraction_om = true for
this deal). System A endpoint does NOT return year1 line items — it returns only the
5 proforma_assumptions scalars.

| Pro Forma Row | broker_claims.proforma field | DB: year1.FIELD.om | Surfaces via GET /api/v1/proforma/:dealId | Frontend renders broker layer | Root Cause of gap |
|---|---|---|---|---|---|
| GPR | `stabilizedGpr = 4,901,400` | **null** | No — wrong system | Platform_fallback shown; no broker badge | Seeder does not map `broker_claims.proforma.stabilizedGpr` into `year1.gpr.om` slot (BUG-11) |
| Vacancy % | `stabilizedVacancy = 0.05` | `0.05` ✓ | No | Rent_roll 19.83% displayed; OM badge present | System A vacancy (5%) and System B vacancy (19.83%) never reconciled (BUG-08) |
| Loss-to-Lease % | `lossToLease = 0` | `0` ✓ | No | T12 0.35% displayed; OM badge present | OM assumes no LTL; T12 shows 0.35% — no collision flag |
| Concessions % | `concessionsPct = 0` | `0` ✓ | No | T12 7.78% displayed; OM badge present | OM = 0%, T12 = 7.78% — material collision not flagged |
| Bad Debt % | `(null)` | `null` | No | T12 3.34% displayed | OM did not include bad debt; no om slot populated |
| Other Income/unit | `stabilizedOtherIncomeAnnual = 341,907 → $1,474/unit/yr` | `$307.76/unit/yr` ✓ | No | Rent-roll $75.34/unit/yr displayed | OM $1,474 vs resolved $75 — 19.6× discrepancy, no collision flag |
| Payroll | `payrollAnnual = 324,800` | `324,800` ✓ | No | Override $324,800 displayed | Clean — operator kept OM value |
| Repairs & Maintenance | `repairsMaintenanceAnnual = 69,600` | `69,600` ✓ | No | Override $69,600 displayed | Clean — operator kept OM value |
| Management Fee % | `managementFeePct = 0.0275` | `0.0275` ✓ | No | Override 2.50% displayed | Collision not flagged: OM 2.75% vs override 2.50% |
| Insurance | `insuranceAnnual = 46,400` | `46,400` ✓ | No | Override $46,400 displayed | T12 insurance = null; LV.warning present but silent in UI (BUG-09) |
| Real Estate Tax | `(null)` | `null` | No | T12 $1,127,126 displayed | OM did not provide RE tax; tax_bill = $20,731 (partial year) vs T12 $1,127,126 — 54× gap (BUG-05) |
| G&A | `gAndAAnnual = 69,600` | `69,600` ✓ | No | Platform_fallback shown | Platform slot null (BUG-01) |
| Marketing | `marketingAnnual = 69,600` | `69,600` ✓ | No | Platform_fallback shown | Platform slot null (BUG-01) |
| Utilities | `utilitiesAnnual = 187,094` | `187,094` ✓ | No | Platform_fallback shown | Platform slot null (BUG-01) |
| Replacement Reserves/unit | `replacementReservesPerUnit = 200 ($46,400/yr)` | `$46,400` ✓ | No | Override $250/unit ($58,000/yr) displayed | Operator increased above OM; no collision flag |
| EGI | `stabilizedEgi = 4,998,237` | No direct field | No | Computed = $3,615,849 | **COLLISION: −$1,382,388 (−27.7%) — not flagged** |
| NOI | `stabilizedNOI = 2,999,564` | `2,999,564` (om slot) | No | Resolved = $486,108 | **CRITICAL COLLISION: −$2,513,456 (−83.8%) — not flagged** |
| Total OpEx | `totalOpexAnnual = 1,998,673` | No direct field | No | Resolved = $3,129,741 | **COLLISION: +$1,131,068 (+56.6%) — not flagged** |

**Structural finding:** `GET /api/v1/proforma/:dealId` surfaces none of the broker
layer line items — it returns only the 5 market-positioning scalars from the
`proforma_assumptions` table. Three collisions between broker and resolved values
exceed the spec's "severe" threshold (>15% delta). None are flagged anywhere.

---

## 2 — Layer 2: Platform Per-Service Audit Matrix

| Module | Service / File | Endpoint or function called | Returns live data? | Used by System A? | Used by System B? | Notes |
|---|---|---|---|---|---|---|
| **M05** Market Intelligence | `proforma-adjustment.service.ts:1045` | `getMarketBaseline()` | **No — hardcoded** | Nominally yes | No | Returns literal constants with comment "For now, return reasonable defaults" (line 1049). No MSA query, no submarket lookup. rent_growth=3.5, vacancy=5.0, opexGrowth=2.8, exitCap=5.5, absorption=8.0 are all static. |
| **M04** Supply Pipeline | `proforma-adjustment.service.ts:1034` | `getCompetitiveSupply()` | Partial | No | No | Queries `properties` table for nearby pipeline units. Result assigned to `supplyPipelineUnits` inside `getMarketTightness()` context object. Never flows into any proforma field or proforma_assumptions row. |
| **M07** Traffic Engine | `trafficToProFormaService.ts:866` | `getTrafficProjection()` | Yes | Indirect | Yes | System B reads stored `traffic_projections` row at `getDealFinancials:1756`. Used as `M05_EQUILIBRIUM_MIN` vacancy floor (seeder line 2052). System A: `updateFromTrafficEngine()` (line 717) writes to `proforma_assumptions` — but for 464 Bishop baseline == current for all fields, meaning M07 has not yet fired an update. |
| **M14** Risk Assessment | None | None | N/A | No | No | No import of M14 service in `proforma-adjustment.service.ts` or `proforma-seeder.service.ts`. Risk score does not influence any proforma field. |
| **M35** Event Impact | `proforma.routes.ts:155` | `getM35ProformaAttribution()` | Yes (metadata) | Yes (appended) | No | Attribution object appended to System A response as `eventAttribution` key. Display metadata only — not fed back into any System B line item. Feedback loop (M35 → adjustment → re-seed) exists in code but has not fired for 464 Bishop. |
| **Tax Service** | `proforma-seeder.service.ts:2673` | `taxService.forecast(taxCtx)` | Yes | No | Partial | Called for Section C income tax / depreciation only. **Not called for the P&L real_estate_tax line item** — that line reads from T12 directly. `year1.real_estate_tax.platform` is always null. |
| **Insurance Service** | `proforma-seeder.service.ts:585` | `platformOpEx(platform.opex_per_unit_annual.insurance)` | No | No | No | `platform.opex_per_unit_annual.insurance` = null for 464 Bishop → `insurancePlatform = null`. LV.warning references "platform baseline" that does not exist. No benchmark data source wired. |
| **M15** Comp Engine | None | None | N/A | No | No | Exit cap baseline in `getMarketBaseline()` = hardcoded 5.5%. No comp transaction lookup. |
| **M22** Post-Close Intelligence | None | None | N/A | No | No | Tier 2 owned-portfolio actuals not implemented. `deal_monthly_actuals` table not read by either proforma system. `year1.FIELD.box_score` slot exists in schema but is always null. |

**Summary:** Of 9 upstream modules audited, only M07 delivers live data to System B
(vacancy floor calibration). M05, M04, M14, M15, M22 contribute zero live data to either
system. Tax service contributes to income tax (Section C) but not the P&L RE-tax line.
Insurance has no platform baseline at all.

---

## 3 — Layer 3: Data Quality — LayeredValue Resolution Audit

All values queried from `deal_assumptions.year1` JSONB for 464 Bishop at 2026-05-09.

| Field | Resolution label | Resolved value | Notable source values | Anomaly |
|---|---|---|---|---|
| `gpr` | `override` | $4,901,400 | t12=$4,876,535, rent_roll=$4,932,300, om=**null**, platform=**null** | OM GPR not mapped to om slot (BUG-11); platform null (BUG-01) |
| `vacancy_pct` | `rent_roll` | 19.83% | **t12=66.01%**, rent_roll=19.83%, om=5.00%, platform=**null** | T12 vacancy = 66% — impossible for occupied property; calculation error suspected (BUG-04) |
| `loss_to_lease_pct` | `t12` | 0.35% | rent_roll=1.32%, om=0%, platform=**null** | OM = 0%, T12 = 0.35% — no collision flag |
| `concessions_pct` | `t12` | 7.78% | rent_roll=0%, om=0%, platform=**null** | Material collision: OM = 0%, T12 = 7.78% — not flagged |
| `bad_debt_pct` | `t12` | 3.34% | om=**null**, platform=**null** | No OM or platform source |
| `payroll` | `override` | $324,800 | t12=$29,125, om=$324,800, platform=**null** | T12 payroll = $29,125 (partial year or miscategorised) |
| `repairs_maintenance` | `override` | $69,600 | t12=$4,090, om=$69,600, platform=**null** | T12 = $4,090 (partial year) |
| `management_fee_pct` | `override` | 2.50% | t12=11.42%, om=2.75%, platform=**null** | T12 mgmt fee = 11.42% — nonsensical; likely dollar amount divided by wrong base |
| `real_estate_tax` | `t12` | $1,127,126 | tax_bill=$20,731, platform=**null** | Tax bill 54× lower than T12; taxService not called for this P&L line (BUG-05) |
| `insurance` | `override` | $46,400 | **t12=null**, platform=**null**, warning logged | Warning "using platform baseline" but platform slot is also null (BUG-09) |
| `other_income_per_unit` | `rent_roll` | $75.34/unit/yr | t12=$169.19, om=$307.76, platform=**null** | OM 4× rent_roll — no collision flag |
| `replacement_reserves` | `override` | $58,000 ($250/unit) | om=$46,400 ($200/unit), t12=**null**, platform=**null** | T12 has no reserves line; operator increased above OM |
| `noi` | `platform_fallback` | $486,108 | om=$2,999,564, platform=**null** | NOI collision: broker $3.0M vs resolved $486K (−83.8%) |
| `egi` | `platform_fallback` | $3,615,849 | platform=**null** | EGI collision: broker $4,998,237 vs resolved $3,615,849 (−27.7%) |
| `total_opex` | `platform_fallback` | $3,129,741 | platform=**null** | OpEx collision: broker $1,998,673 vs resolved $3,129,741 (+56.6%) |

---

## 4 — Layer 4: Service Call Graph (System B)

Execution sequence for `GET /api/v1/deals/:dealId/financials`:

```
getDealFinancials(dealId)               proforma-adjustment.service.ts:1722
  ├─ parallel group 1
  │   ├─ proformaSeeder.seedProForma()  proforma-seeder.service.ts:~100
  │   │   ├─ reads deal_assumptions row (year1 JSONB)
  │   │   ├─ reads extraction capsules:
  │   │   │   t12, rent_roll, tax_bill, extraction_om, broker_claims
  │   │   ├─ per-field: resolve via FIELD_PRIORITIES (lines 136-148)
  │   │   │   resolve(field, platformValue, { t12, rent_roll, om,
  │   │   │            tax_bill, existingOverride })
  │   │   │   → platformValue = null for every field (BUG-01)
  │   │   ├─ taxService.forecast() for Section C only   line 2673
  │   │   └─ returns year1 LayeredValue JSONB
  │   │
  │   ├─ getTrafficProjection(pool, dealId, holdYears)  line 1756
  │   │   └─ reads traffic_projections table row
  │   │
  │   └─ [capitalStack, rentRollSummary, integrityChecks — parallel]
  │
  ├─ derives vacancy_pct via M07 formula               lines 2040-2085
  │   M05_EQUILIBRIUM_MIN = trafficProjection.calibrated.vacancyPct ?? 0.03
  │   (informational only — does not override year1.vacancy_pct.resolved)
  │
  └─ assembles F9DealFinancials response

proforma_assumptions table:              NOT READ by getDealFinancials()
  → System A's 5 scalars (rentGrowth, vacancy, opexGrowth, exitCap,
    absorption) are never consumed by System B.
```

---

## 5 — Layer 5: Computed Output Accuracy (System A)

`GET /api/v1/proforma/:dealId` calls `getProFormaComputed()` which feeds the
5 effective scalars into `runModel()`. **The model runs on hardcoded deal inputs:**

```typescript
// proforma-adjustment.service.ts:169-182
const modelAssumptions = {
  purchasePrice: 50_000_000,   // hardcoded — not deal.purchase_price
  units: 232,                  // hardcoded — not deal.total_units (happens to match 464 Bishop)
  marketRent: 1_850,           // hardcoded — not from rent_roll
  loanAmount: 35_000_000,      // hardcoded — not from capital stack
  rate: 0.055,                 // hardcoded — not from debt terms
  managementFee: 0.04,         // hardcoded — 464 Bishop override = 2.50%
  insurancePerUnit: 600,       // hardcoded — 464 Bishop = ~$200/unit
  payrollPerUnit: 2_500,       // hardcoded — 464 Bishop = ~$1,400/unit
  lpEquity: 14_000_000,        // hardcoded
  // ...
};
```

The 5 effective scalars (rg, vac, og, ec from proforma_assumptions) flow in correctly.
Everything else is a phantom deal. `computed.irr`, `computed.noiYear1`,
`computed.annualCashFlow` etc. are not 464 Bishop's financials. They are indicative
metrics computed on hardcoded assumptions. This is the root cause of BUG-02.

---

## 6 — Layer 6: Live Data Spot-Checks

Reference: `deal_id = 3f32276f-aacd-4da3-b306-317c5109b403`, queried 2026-05-09.

### Spot-check 1: System A Effective Resolution (`GET /api/v1/proforma/:dealId`)

Rule under test: `effective = user_override ?? current ?? baseline`

| Assumption | baseline | current | user_override | Expected effective | Actual DB value | Result |
|---|---|---|---|---|---|---|
| rentGrowth | 3.500% | 3.500% | none | 3.500% | 3.500% | ✓ Pass |
| vacancy | 5.00% | 5.00% | none | 5.00% | 5.00% | ✓ Pass |
| opexGrowth | 2.800% | 2.800% | none | 2.800% | 2.800% | ✓ Pass |
| exitCap | 5.500% | 5.500% | none | 5.500% | 5.500% | ✓ Pass |
| absorption | 8.00 | 8.00 | none | 8.00 | 8.00 | ✓ Pass |

**Resolution logic is correct.** However, for 464 Bishop every field has
`current == baseline` and delta == 0, meaning no M35 adjustment has ever fired.
Either M35 has no qualifying events for this deal, or the trigger path
(M35 event → `applyM35Adjustment()` → `proforma_assumptions` UPDATE) is not
executing. The adjustment mechanism exists in code but is dormant.

**Finding also:** System A vacancy_effective = 5.00% while System B
year1.vacancy_pct.resolved = 19.83% — a 14.83 percentage-point divergence for the
same deal, never surfaced to the operator (BUG-08).

### Spot-check 2: System B NOI Arithmetic (`GET /api/v1/deals/:dealId/financials`)

Rule under test: `NOI = EGI − Total OpEx`

| Field | DB resolved value | Source |
|---|---|---|
| EGI | $3,615,849.05 | year1.egi.resolved |
| Total OpEx | $3,129,741.08 | year1.total_opex.resolved |
| Expected NOI | $486,107.97 | EGI − OpEx |
| Actual NOI | $486,107.97 | year1.noi.resolved |

✓ **Pass — NOI arithmetic is internally consistent within System B.** The problem is
not the math but the inputs: EGI is derived from 19.83% vacancy (from rent_roll), while
System A presents 5% vacancy. The operator never sees a reconciliation between the two.

### Spot-check 3: Broker vs Resolved Collision Detection

Rule under test: collisions >15% delta should be flagged in API response.

| Metric | Broker claim (`broker_claims.proforma`) | System B resolved | Delta | Severity per spec |
|---|---|---|---|---|
| Vacancy % | 5.00% | 19.83% | +14.83 pp | Severe |
| EGI | $4,998,237 | $3,615,849 | −$1,382,388 (−27.7%) | **Severe** |
| Total OpEx | $1,998,673 | $3,129,741 | +$1,131,068 (+56.6%) | **Severe** |
| NOI | $2,999,564 | $486,108 | −$2,513,456 (−83.8%) | **Severe** |

✗ **Fail — zero collisions flagged in either system's API response.** The
`CollisionReport` interface defined in the CASHFLOW_AGENT_UNDERWRITING_SPEC
(`broker_value`, `delta_pct`, `magnitude`, `direction`, `narrative`) is not implemented
anywhere in the live codebase. The NOI divergence of −83.8% would be the most severe
collision in the platform's history for this deal and is completely invisible to the
operator.

---

## 7 — Layer 7: Frontend Mock Status

| Component | File:line | Status | Evidence |
|---|---|---|---|
| `ProFormaIntelligence` | `ProFormaIntelligence.tsx:19` | **100% mock** | `import { enhancedProFormaMockData } from './enhancedProFormaMockData'` — all intelligence cards from static fixture |
| Market Findings cards | Rendered by ProFormaIntelligence | Mock | Rent growth, vacancy, exit cap cards are hardcoded mock data; `GET /api/v1/proforma/:dealId` is not called |
| `ProFormaSummaryTab` | `ProFormaSummaryTab.tsx` | Live | Reads from `dealFinancials.year1` (System B) — real resolved data |
| Market baseline | `proforma-adjustment.service.ts:1050-1056` | **Hardcoded** | `getMarketBaseline()` returns literal constants; no MSA/submarket query |
| `runModel()` inputs | `proforma-adjustment.service.ts:169-182` | **Hardcoded** | purchasePrice, units, marketRent, loanAmount, rates are all static constants |

---

## 8 — Legacy vs Evidence-Tier Boundary

Current live code uses a **3-layer legacy model** (Broker / Platform / User).
The CASHFLOW_AGENT_UNDERWRITING_SPEC defines a **4-tier evidence model** with a
different authority order and richer provenance.

### Model Comparison

| Dimension | Legacy model (live code) | Evidence-tier model (spec) |
|---|---|---|
| **Layer count** | 3: Broker / Platform / User | 4: Tier 1 (deal own data) / Tier 2 (owned portfolio) / Tier 3 (platform) / Tier 4 (broker — reference only) |
| **Broker authority** | Layer 1 of 3 — used as a source | Tier 4 of 4 — collision reference, never authoritative |
| **T12 / Rent Roll / Tax Bill** | Named source slots in LayeredValue | Tier 1 — highest authority, "the number IS the number" |
| **Owned portfolio actuals** | Not implemented; `box_score` slot null | Tier 2 — second authority; institutional edge from M22 Post-Close |
| **Platform (M05/M07)** | `year1.FIELD.platform` slot — all null | Tier 3 — market-wide benchmarks; used when Tier 1 & 2 absent |
| **User override** | `year1.FIELD.override` — working | Maps to operator instruction; overrides all tiers |
| **Evidence provenance** | `LayeredValue.resolution` (string tag) | `Evidence { primary_tier, data_points[], reasoning, alternatives_considered[], collision? }` |
| **Confidence scoring** | Not present | `confidence: 'high' \| 'medium' \| 'low'` per derivation |
| **Collision detection** | Not implemented | `CollisionReport { broker_value, platform_value, delta_pct, magnitude, direction, narrative }` per field |
| **Agent attribution** | Not present | `agent_run_id`, `set_by`, `set_at` per field |
| **Tier 2 data source** | Not built | `deal_monthly_actuals` via M22 Post-Close Intelligence |

### Field-Level Resolution Rule Divergence

| Field | Legacy FIELD_PRIORITIES (seeder:136-148) | Evidence-tier spec rule |
|---|---|---|
| `real_estate_tax` | `['tax_bill', 't12']` | Always use `taxService.forecast()` per jurisdiction ruleset — never trust T12 if assessed value changed |
| `insurance` | `['t12']` | `insuranceService.forecast()` — spec says "never trust broker OM" in FL/CA; platform benchmark required |
| `vacancy_pct` | `['rent_roll', 't12', 'om']` | Tier 1 T12 → Tier 2 owned actuals → floor at M07 structural vacancy; M07 absorption curve in lease-up |
| `gpr` | `['override', 'rent_roll', 't12']` | Tier 1 rent_roll → Tier 2 owned comps → Tier 3 M05 submarket rent |
| `opex lines (each)` | `['override', 'om', 't12']` | Each line independently: Tier 1 T12 × growth; cross-validate with Tier 2 owned actuals; flag if T12 >20% below owned actuals |
| `exit_cap` | Not in FIELD_PRIORITIES (hardcoded 5.5%) | Tier 2 user's disposition comps → Tier 3 M15 transaction comps → rate environment |

### API Shape Divergence

| Attribute | Live `year1.FIELD` shape | Spec `UnderwritingValue` shape |
|---|---|---|
| `source` / `resolution` | String: `'t12' \| 'rent_roll' \| 'override' \| 'platform_fallback'` | String: `'agent:cashflow' \| 'tier1:t12' \| 'tier1:rent_roll' \| 'tier2:owned_asset' \| 'tier3:platform' \| 'tier4:broker' \| 'override'` |
| `evidence` | Not present | `{ primary_tier, data_points[], reasoning, alternatives_considered[] }` |
| `confidence` | Not present | `'high' \| 'medium' \| 'low'` |
| `collision` | Not present | `{ broker_value, platform_value, delta_pct, magnitude, direction, narrative }` |
| `agent_run_id` | Not present | `string` — traces field to agent invocation |
| `set_at` | `updated_at` (present) | `set_at` (equivalent) |

**Gap summary:** The live system correctly implements the structural skeleton of the
evidence-tier model (LayeredValue with multiple named source slots, resolution tag,
override chain). Missing: (a) Tier 2 owned-portfolio data, (b) full evidence provenance
objects, (c) confidence scoring, (d) collision detection at any severity level, and
(e) agent attribution. The `FIELD_PRIORITIES` map is the live resolution rule; the
spec's tier waterfall is aspirational and implemented nowhere.

---

## 9 — Bug Inventory

| ID | Severity | Component | File:line | Description | Fix complexity | Depends on |
|---|---|---|---|---|---|---|
| BUG-01 | P0 | proforma-seeder | `proforma-seeder.service.ts:185` | Platform slot is null for every year1 field. `field.platform = null` unconditionally. No module writes live platform data into any `year1.FIELD.platform` slot. | High — requires M05 integration | Blocks BUG-03, collision detection |
| BUG-02 | P0 | proforma-adjustment | `proforma-adjustment.service.ts:169-182` | `runModel()` called with hardcoded deal inputs (purchasePrice=50M, units=232, marketRent=$1,850, loanAmount=35M, rate=5.5%, etc.). Computed IRR/NOI/CoC are for a phantom deal, not the actual deal. | Medium — replace constants with live deal lookups | BUG-03 (needs real baselines too) |
| BUG-03 | P0 | proforma-adjustment | `proforma-adjustment.service.ts:1049` | `getMarketBaseline()` returns hardcoded constants. Comment: "For now, return reasonable defaults." No MSA/submarket query is made. System A baselines are static for every deal. | High — requires M05 live integration | Blocks BUG-01 (platform slots) |
| BUG-04 | P1 | proforma-seeder | Vacancy derivation logic | `year1.vacancy_pct.t12 = 0.6601` (66.0%) for 464 Bishop. Likely divides vacancy_loss_$ by monthly rent rather than computing vacant_units / total_units. Causes seeder to prefer rent_roll over T12 for this field. | Medium — fix vacancy_pct formula | Independent |
| BUG-05 | P1 | proforma-seeder | `proforma-seeder.service.ts:607` | RE tax: `tax_bill = $20,731` vs `t12 = $1,127,126` — 54× discrepancy. Tax bill appears to be extracted from a partial-year or pre-reassessment bill. `taxService.forecast()` is not called for the P&L real_estate_tax line (only Section C). | Medium — wire taxService for P&L RE-tax | Independent; `taxService` already imported |
| BUG-06 | P1 | architecture | None | NOI collision: broker $2,999,564 vs resolved $486,108 (−83.8%). EGI: −27.7%. OpEx: +56.6%. `CollisionReport` interface specified in CashFlow Agent spec is not implemented anywhere. | High — requires CashFlow Agent build | Task #672 (CashFlow Agent) |
| BUG-07 | P1 | frontend | `ProFormaIntelligence.tsx:19` | AI Market Findings cards (rent growth, vacancy, exit cap) import from `enhancedProFormaMockData`. Never call `GET /api/v1/proforma/:dealId`. | Low — replace mock import with API call | BUG-02 (need accurate computed values first) |
| BUG-08 | P1 | architecture | Both systems | System A vacancy_current = 5.00%; System B year1.vacancy_pct.resolved = 19.83% for the same deal. Two systems fully decoupled — operator sees different vacancies depending on surface viewed. | High — architectural decision required | BUG-01, BUG-03 |
| BUG-09 | P2 | proforma-seeder | `proforma-seeder.service.ts:592` | Insurance LV.warning: "No property insurance line in T12 — using platform baseline." Platform slot is also null. Warning references a fallback that does not exist. Silent failure. | Low — fix warning text; Medium — build platform benchmark | Insurance benchmark data source |
| BUG-10 | P2 | proforma-seeder | Collision logic | `other_income_per_unit.om` = $307.76 vs rent_roll = $75.34 (4× discrepancy). No collision flag produced. | High — requires CollisionReport | BUG-06 |
| BUG-11 | P2 | proforma-seeder | Broker capsule mapping | `year1.gpr.om = null` despite `broker_claims.proforma.stabilizedGpr = 4,901,400`. The seeder does not map the broker capsule GPR into the `gpr.om` LayeredValue slot. | Low — add mapping in seeder's broker capsule read | Independent |
| BUG-12 | P3 | proforma-adjustment | `proforma.routes.ts:155-163` | M35 `eventAttribution` appended to System A response but is display metadata only. Never produces a numeric change in System B. Feedback loop (M35 → `proforma_assumptions` UPDATE → year1 re-seed) exists in code but dormant for all tested deals. | Medium — verify M35 trigger wiring end-to-end | M35 event data, M35 trigger service |

---

## 10 — Summary Scorecard

| Layer | Status | Primary gaps |
|---|---|---|
| Broker layer (Layer 1) | ⚠️ Partial | GPR.om = null despite capsule; 3 severe collisions undetected; System A doesn't surface line items |
| Platform layer (Layer 2) | 🔴 Not implemented | All platform slots null; M05 hardcoded; M14/M15/M22 absent |
| T12 / Rent Roll (Layer 3) | 🟡 Partial | T12 vacancy = 66% (formula error); T12 insurance = null; partial-year T12 lines miscategorised |
| Tax bill (Layer 3) | 🟡 Partial | $20K bill vs $1.1M T12; taxService not called for P&L RE-tax line |
| Override layer | ✅ Working | Override resolution correct; operator values persist correctly |
| System A ↔ B coherence | 🔴 Broken | Same deal: vacancy 5% vs 19.83%; two systems never reconciled |
| Collision detection | 🔴 Not implemented | CollisionReport interface specified, not built; 3 severe collisions invisible |
| Frontend (AI cards) | 🔴 100% mock | ProFormaIntelligence renders static fixture; no live API call |
| M07 traffic → proforma | 🟡 Partial | Vacancy floor wired in System B; absorption scalar not linked to year1 fields |
| Evidence-tier model | 🔴 Gap | Tier 2 (owned portfolio), confidence scoring, agent attribution, CollisionReport all absent |

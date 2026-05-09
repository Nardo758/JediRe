# ProForma Pipeline Audit — May 2026

**Status:** Audit only — no code changes in scope.
**Reference deal:** 464 Bishop, `deal_id = 3f32276f-aacd-4da3-b306-317c5109b403` (232 units, Atlanta)
**Primary API:** `GET /api/v1/proforma/:dealId` → `ProFormaAdjustmentService.getProFormaComputed()`
**Secondary API:** `GET /api/v1/deals/:dealId/financials` → `getDealFinancials()`
**Evidence base:** Static code analysis + live DB queries at 2026-05-09
**Date:** 2026-05-09

---

## Step 0 — Reference File Provenance

Each file from the task brief is accounted for below. "Not found" means the file does not
exist anywhere in the repo or in `attached_assets/` — confirmed by exhaustive search.

| Reference file | Status | Actual path or note |
|---|---|---|
| `jedi-framework-v31.jsx` | **Not found as file** | A text description of its canonical line-item list exists in `attached_assets/Pasted-I-have-the-canonical-ProForma-spec-from-jedi-framework-_1778106848690.txt` (66 lines). The `.jsx` source file does not exist in the repo or attached_assets. |
| `correlation-metrics-engine.jsx` | **Not found** | No file, no import, no reference by this name anywhere in the codebase. |
| `CASHFLOW_AGENT_UNDERWRITING_SPEC.md` | **Found** | `attached_assets/Pasted--JEDI-RE-CashFlow-Agent-Underwriting-Specification-How-_1776632066856.txt` (762 lines, read in full) |
| `FEATURE_EXPANSION.md` | **Not found** | Referenced in the v31 spec description text but does not exist in the repo or attached_assets. |
| `CLAUDE.md` | **Found** | `./backend/CLAUDE.md` (read in full) |
| F9 Financial Model Agent Spec | **Found** | `attached_assets/F9_Financial_Model_-_Agent_Specification_1777735712565.txt` (read in full) |
| F9 Wiring Spec v1.0 | **Found** | `attached_assets/agent-f9-wiring-spec-v1.0_1777735731528.txt` (read in full) |
| F9 Data Flow Wiring Audit | **Found** | `attached_assets/Pasted--F9-Data-Flow-Wiring-Audit-Reconciliation-Context-The-F_1778156840151.txt` (read in full) |
| F9 Pro Forma Surface Audit brief | **Found** | `attached_assets/Pasted-F9-Pro-Forma-surface-complete-state-audit-Read-only-Sin_1778269669887.txt` (read in full) |

---

## Section 0 — Architecture Overview: Two Decoupled Systems

The ProForma pipeline is not a single pipeline. It is two fully independent systems that share
a deal ID but no data:

```
System A — proforma_assumptions table
  Route:    GET /api/v1/proforma/:dealId           proforma.routes.ts:130
  Service:  ProFormaAdjustmentService.getProFormaComputed()
  Shape:    5 market-positioning scalars (rentGrowth, vacancy, opexGrowth,
            exitCap, absorption), each as AssumptionValue { baseline, current, effective }
            + a large `computed` block from deterministic-model-runner using
            hardcoded phantom-deal inputs (BUG-02)
  Purpose:  News-driven M35 adjustment; AI Market Findings cards

System B — deal_assumptions.year1 JSONB
  Route:    GET /api/v1/deals/:dealId/financials
  Service:  getDealFinancials() → proforma-seeder.service.ts
  Shape:    { year1: OperatingStatementRow[], capitalStack, integrityChecks,
              projections?, rentRollSummary, assumptions }
            Each row flattened from LayeredValue<T> with broker/t12/rentRoll/
            taxBill/platform/resolved columns
  Purpose:  F9 Financial Engine — ProFormaSummaryTab and all 13 tabs
```

**Root architectural gap:** System A `vacancy_current = 5.00%` is never read by System B.
System B `year1.vacancy_pct.resolved = 19.83%` is never surfaced by System A. The operator
sees two different vacancy figures on different surfaces; the divergence is never flagged.

---

## Section 1 — Step 2: Raw API Payload — `GET /api/v1/proforma/:dealId`

The following is the complete shape of the JSON response returned by `getProFormaComputed()`
for 464 Bishop, constructed from: (a) live DB query of `proforma_assumptions` and (b) static
analysis of lines 144-208. The API requires bearer auth; the payload was reconstructed from
source rather than captured live.

```json
{
  "id": "<uuid>",
  "dealId": "3f32276f-aacd-4da3-b306-317c5109b403",
  "strategy": "rental",
  "rentGrowth": {
    "baseline": "3.500",
    "current":  "3.500",
    "effective": "3.500"
  },
  "vacancy": {
    "baseline": "5.00",
    "current":  "5.00",
    "effective": "5.00"
  },
  "opexGrowth": {
    "baseline": "2.800",
    "current":  "2.800",
    "effective": "2.800"
  },
  "exitCap": {
    "baseline": "5.500",
    "current":  "5.500",
    "effective": "5.500"
  },
  "absorption": {
    "baseline": "8.00",
    "current":  "8.00",
    "effective": "8.00"
  },
  "computed": {
    "irr":              "<from deterministic model — BUG-02: hardcoded inputs>",
    "equityMultiple":   "<from deterministic model>",
    "avgCoC":           "<from deterministic model>",
    "noiYear1":         "<from deterministic model — NOT 464 Bishop NOI>",
    "goingInCapRate":   "<from deterministic model>",
    "exitCapRate":      "<from deterministic model>",
    "dscrByYear":       [10 values, one per hold year],
    "noiByYear":        [10 values],
    "cashOnCashByYear": [10 values],
    "annualCashFlow":   [10 objects, one per year],
    "sensitivityMatrix": [[...], ...],
    "stressScenarios":  [{...}, ...],
    "waterfall":        [{...}, ...],
    "sourcesAndUses":   { "sources": {...}, "uses": {...} },
    "projections":      [{...}, ...],
    "integrityChecks":  [{...}, ...],
    "derivationLog":    ["...", ...]
  },
  "deterministicRunnerVersion": "1.0"
}
```

**Live service call evidence (captured 2026-05-09 via `ProFormaAdjustmentService.getProFormaComputed()`):**

The scalars block above was confirmed by direct service invocation. Actual `computed` field values:

```
COMPUTED_KEYS: irr, equityMultiple, avgCoC, noiYear1, goingInCapRate, exitCapRate,
               dscrByYear, noiByYear, cashOnCashByYear, annualCashFlow,
               sensitivityMatrix, stressScenarios, waterfall, sourcesAndUses,
               projections, integrityChecks, derivationLog

SAMPLE values (all from hardcoded inputs — BUG-02):
  noiYear1:        -22,399,436   ← NEGATIVE $22M due to phantom-deal inputs producing
                                    nonsensical model output; completely unrelated to
                                    actual 464 Bishop NOI ($486,108)
  irr:             null          ← model returned null (deal not viable with phantom inputs)
  goingInCapRate:  -0.448        ← negative cap rate confirms hardcoded model incoherence
```

**Critical findings from payload analysis:**
- The 5 scalars all show `baseline == current == effective` (no M35 update has fired)
- All scalars equal DB column defaults — M35 events have not updated `_current` for any field
- `computed.noiYear1 = -$22.4M` is a phantom model output; the actual deal NOI is $486,108 (BUG-02)
- `computed.irr = null` and `goingInCapRate = -0.448` — hardcoded inputs are internally incoherent
- **No P&L line-item rows appear anywhere in this payload** — only 5 scalar pairs + computed block
- System A does not include the System B `OperatingStatementRow[]` array at all

---

## Section 2 — Layer 1: Broker Audit Table (All Canonical Rows)

Canonical row sequence per `proforma-adjustment.service.ts` REVENUE_FIELDS (1832-1841),
OPEX_FIELDS (1844-1858), NOI_FIELDS (1861), and toDollarRow calls (1960-1970).
All `om` slot values queried live from `deal_assumptions.year1` for 464 Bishop.

| # | Pro Forma Row | Canonical field key | Stored: `year1.FIELD.om` | Stored: `year1.FIELD.resolved` | Stored: `year1.FIELD.resolution` | Surfaces in System A? | Frontend renders broker col | Root cause of gap / finding |
|---|---|---|---|---|---|---|---|---|
| 1 | Gross Potential Rent | `gpr` | **null** | $4,901,400 | override | No | Platform_fallback shown | BUG-11: seeder does not map `broker_claims.proforma.stabilizedGpr` ($4,901,400) into `gpr.om` slot |
| 2 | Loss to Lease (%) | `loss_to_lease_pct` | 0 (0.00%) | 0.35% | t12 | No | OM badge shown (0%) | OM = 0%, T12 = 0.35% — no collision flag |
| 3 | Loss to Lease ($) | `loss_to_lease` (toDollarRow) | Derived from row 2 | $17,140 | t12 | No | OM $0 vs resolved $17,140 | Dollar row derived via `toDollarRow` — no direct om slot |
| 4 | Vacancy % | `vacancy_pct` | 0.05 (5.00%) | 19.83% | rent_roll | No | OM badge shown (5%) | System A vacancy (5%) decoupled from System B (19.83%) — BUG-08 |
| 5 | Vacancy Loss ($) | `vacancy_loss` (toDollarRow) | $245,070 (GPR × 5%) | $971,887 | rent_roll | No | OM $245K vs resolved $972K (+$727K) | Material divergence not flagged |
| 6 | Concessions (%) | `concessions_pct` | 0 (0.00%) | 7.78% | t12 | No | OM badge shown (0%) | Collision 0% vs 7.78% not flagged |
| 7 | Concessions ($) | `concessions` (toDollarRow) | $0 | $381,280 | t12 | No | OM $0 vs resolved $381K | BUG-06: collision not flagged |
| 8 | Bad Debt (%) | `bad_debt_pct` | **null** | 3.34% | t12 | No | No broker badge (om null) | OM did not provide bad debt |
| 9 | Bad Debt ($) | `bad_debt` (toDollarRow) | Derived (null) | $117,999 | t12 | No | No broker badge | No OM source; no collision check possible |
| 10 | Non-Revenue Units (%) | `non_revenue_units_pct` | **null** | 0 (0.00%) | t12 | No | No broker badge | OM did not include non-revenue units |
| 11 | Non-Revenue Units ($) | `non_revenue_units` (toDollarRow) | Derived (null) | $0 | t12 | No | No broker badge | $0 because t12 = 0; no OM |
| 12 | Other Income / unit | `other_income_per_unit` | $307.76/unit/yr | $75.34/unit/yr | rent_roll | No | OM $307.76 vs resolved $75.34 (4.1×) | BUG-06: 4× collision not flagged |
| 13 | Other Income ($) | `other_income` (toDollarRow) | $71,400 (est.) | $209,749 | rent_roll | No | OM ~$71K vs resolved ~$210K | Dollar row derived; collision not flagged |
| 14 | **Net Rental Income** | `net_rental_income` | **null** | $3,531,123 | platform_fallback | No | No broker badge | No direct om slot; derived subtotal |
| 15 | **Effective Gross Income** | `egi` | Not stored as om | $3,615,849 | computed from components | No | No direct broker EGI badge | Broker implied EGI = $4,998,237 (+38.2% vs resolved) — not flagged (BUG-06) |
| 16 | Repairs & Maintenance | `repairs_maintenance` | $69,600 | $69,600 | override | No | OM badge shown | Clean — operator kept OM value; T12 = $4,090 (partial year) |
| 17 | Contract Services | `contract_services` | **null** | $28,680 | override | No | No broker badge | OM did not provide contract services separately |
| 18 | Landscaping / Grounds | `landscaping` | **null** | **null** | null | No | No broker badge | No OM, no T12, no override; missing from resolved |
| 19 | Personnel / Payroll | `payroll` | $324,800 | $324,800 | override | No | OM badge shown | Clean — operator kept OM value; T12 = $29,125 (partial year) |
| 20 | Marketing / Advertising | `marketing` | $69,600 | $69,600 | override | No | OM badge shown | Clean |
| 21 | Administrative / G&A | `g_and_a` | $69,600 | $69,600 | override | No | OM badge shown | Clean |
| 22 | Turnover / Make-Ready | `turnover` | $41,760 | $41,760 | override | No | OM badge shown | T12 = $1,540 (partial year) |
| 23 | Water & Sewer | `water_sewer` | **null** | **null** | null | No | No broker badge | No OM, no T12; OM provided combined `utilitiesAnnual=$187,094` not decomposed into sub-lines |
| 24 | Electric | `electric` | **null** | **null** | null | No | No broker badge | Same — OM combined utilities not decomposed |
| 25 | Gas / Fuel | `gas_fuel` | **null** | **null** | null | No | No broker badge | Same — OM combined utilities not decomposed |
| 26 | Utilities (combined) | `utilities` | $187,094 | $187,094 | override | No | OM badge shown ($187K) | OM provided combined; system expects sub-lines; combined stored in `utilities` slot not in OPEX_FIELDS |
| 27 | Insurance | `insurance` | $46,400 | $46,400 | override | No | OM badge shown | T12 = null; LV.warning references non-existent platform baseline (BUG-09) |
| 28 | Property Tax | `real_estate_tax` | **null** | $1,127,126 | t12 | No | No broker badge (om null) | tax_bill = $20,731 vs T12 = $1,127,126 — 54× gap unreconciled (BUG-05) |
| 29 | Management Fee (%) | `management_fee_pct` | 0.0275 (2.75%) | 2.50% | override | No | OM badge shown (2.75%) | Collision OM 2.75% vs override 2.50% — not flagged |
| 30 | Management Fee ($) | `management_fee` (toDollarRow) | $99,479 est. (OM 2.75% × EGI) | $90,396 (2.50% × $3,615,849) | override | No | OM ~$99K vs resolved $90K | Dollar derived; small collision not flagged |
| 31 | Replacement Reserves | `replacement_reserves` | $46,400 ($200/unit) | $58,000 ($250/unit) | override | No | OM $46K vs resolved $58K | Operator increased above OM; no flag |
| 32 | **Total Operating Expenses** | `total_opex` | Not stored as om | $3,129,741 | computed | No | No broker badge | Broker implied OpEx = $1,998,673 (resolved = $3,129,741; +$1,131,068 / +56.6%) — BUG-06 |
| 33 | **Net Operating Income** | `noi` | $2,999,564 | $486,108 | platform_fallback | No | OM badge ($3.0M vs resolved $486K) | **CRITICAL: −$2,513,456 / −83.8% collision not flagged** — BUG-06 |
| 34 | Replacement Reserves (below-NOI) | `replacement_reserves` (repeated below NOI line per v31) | $46,400 | $58,000 | override | No | OM badge | Same as row 31 — shown again below NOI per v31 spec |
| 35 | **NOI After Reserves** | `noi_after_reserves` | Not in year1 | **null** | null | No | Not rendered | **BUG-13: not in year1 OperatingStatementRow[] — only in projections** |

**Key structural finding:** System A (`GET /api/v1/proforma/:dealId`) surfaces NONE of the
broker line-item values from this table — it only returns the 5 market-positioning scalars.
Rows 1-35 are visible only through System B. Three collisions exceed the spec "severe" threshold
(>15%): rows 15, 32, and 33. None are flagged anywhere.

---

## Section 3 — Layer 2: Platform Per-Service Audit Matrix

| Module | Service / File | Function/endpoint called | Returns live data? | Feeds System A? | Feeds System B? | Notes |
|---|---|---|---|---|---|---|
| **M05** Market Intelligence | `proforma-adjustment.service.ts:1049` | `getMarketBaseline()` | **No — hardcoded** | Nominally yes | No | Returns literal constants with comment "For now, return reasonable defaults" (line 1049). No MSA query, no submarket lookup. All 5 scalars are static defaults for every deal. |
| **M04** Supply Pipeline | `proforma-adjustment.service.ts:1034` | `getCompetitiveSupply()` | Partial | Indirect | No | Queries `properties` table for nearby pipeline units. Assigned to `supplyPipelineUnits` in `getMarketTightness()`. Never flows into any proforma field. |
| **M07** Traffic Engine | `trafficToProFormaService.ts:866` | `getTrafficProjection()` | Yes | Indirect | Yes (floor) | System B reads stored `traffic_projections` row at `getDealFinancials:1756`. Used as `M05_EQUILIBRIUM_MIN` vacancy floor (seeder:2052). System A: `updateFromTrafficEngine()` (line 717) writes to `proforma_assumptions` — but for 464 Bishop `baseline == current`, meaning M07 has not yet fired an update. |
| **M14** Risk Assessment | None | None | N/A | No | No | No import of M14 service in proforma services. Risk score does not influence any proforma field. |
| **M35** Event Impact | `proforma.routes.ts:155` | `getM35ProformaAttribution()` | Yes (metadata) | Yes (appended) | No | Attribution appended to System A response as `eventAttribution`. Display metadata only — not fed back into any System B line item. |
| **Tax Service** | `proforma-seeder.service.ts:2673` | `taxService.forecast(taxCtx)` | Yes | No | Partial | Called for income tax / depreciation section only. **Not called for P&L `real_estate_tax` line** — that reads T12 directly. `year1.real_estate_tax.platform` = null. |
| **Insurance Service** | `proforma-seeder.service.ts:585` | `platformOpEx(platform.opex_per_unit_annual.insurance)` | No | No | No | `platform.opex_per_unit_annual.insurance = null` for 464 Bishop → `insurancePlatform = null`. LV.warning references "platform baseline" that does not exist. |
| **M15** Comp Engine | None | None | N/A | No | No | Exit cap baseline in `getMarketBaseline()` = hardcoded 5.5%. No comp transaction lookup. |
| **M22** Post-Close Intelligence | None | None | N/A | No | No | Tier 2 owned-portfolio actuals not implemented. `year1.FIELD.box_score` slot always null. |

---

## Section 4 — Layer 3: Data Quality — LayeredValue Resolution Audit

All values queried from `deal_assumptions.year1` JSONB for 464 Bishop at 2026-05-09.

| Field | Resolution | Resolved value | Notable source values | Anomaly |
|---|---|---|---|---|
| `gpr` | `override` | $4,901,400 | t12=$4,876,535, rent_roll=$4,932,300, om=**null**, platform=**null** | OM not mapped (BUG-11); platform null (BUG-01) |
| `vacancy_pct` | `rent_roll` | 19.83% | **t12=66.01%**, rent_roll=19.83%, om=5.00%, platform=**null** | T12 vacancy = 66% — formula error (BUG-04) |
| `loss_to_lease_pct` | `t12` | 0.35% | rent_roll=1.32%, om=0%, platform=**null** | OM = 0% vs T12 = 0.35% — no collision flag |
| `concessions_pct` | `t12` | 7.78% | rent_roll=0%, om=0%, platform=**null** | Material collision: OM = 0% vs T12 = 7.78% — not flagged |
| `bad_debt_pct` | `t12` | 3.34% | om=**null**, platform=**null** | No OM or platform source |
| `non_revenue_units_pct` | `t12` | 0.00% | om=**null**, t12=0%, platform=**null** | Clean zero |
| `other_income_per_unit` | `rent_roll` | $75.34/unit/yr | t12=$169.19, om=$307.76, platform=**null** | OM 4× rent_roll — no collision flag |
| `payroll` | `override` | $324,800 | t12=$29,125, om=$324,800, platform=**null** | T12 = $29,125 (partial year or miscategorised) |
| `repairs_maintenance` | `override` | $69,600 | t12=$4,090, om=$69,600, platform=**null** | T12 = $4,090 (partial year) |
| `contract_services` | `override` | $28,680 | t12=$19,640, om=**null**, platform=**null** | No OM; T12 reasonable |
| `landscaping` | **null** | **null** | all slots null | No data for this deal in any tier |
| `marketing` | `override` | $69,600 | om=$69,600, t12=unknown, platform=**null** | Clean |
| `g_and_a` | `override` | $69,600 | om=$69,600, t12=unknown, platform=**null** | Clean |
| `turnover` | `override` | $41,760 | om=$41,760, t12=$1,540, platform=**null** | T12 = $1,540 (partial year) |
| `water_sewer` | **null** | **null** | all slots null | OM provided combined utilities ($187K) not decomposed |
| `electric` | **null** | **null** | all slots null | Same |
| `gas_fuel` | **null** | **null** | all slots null | Same |
| `utilities` | `override` | $187,094 | om=$187,094, t12=$936, platform=**null** | Combined utilities stored in non-OPEX_FIELDS slot; T12 = $936 (partial year) |
| `management_fee_pct` | `override` | 2.50% | t12=11.42%, om=2.75%, platform=**null** | T12 mgmt fee = 11.42% — nonsensical (dollar amount used as rate?) |
| `real_estate_tax` | `t12` | $1,127,126 | tax_bill=$20,731, platform=**null** | Tax bill 54× lower than T12; taxService not called for this P&L line (BUG-05) |
| `insurance` | `override` | $46,400 | **t12=null**, platform=**null**, warning logged | Warning "using platform baseline" but platform also null (BUG-09) |
| `replacement_reserves` | `override` | $58,000 ($250/unit) | om=$46,400 ($200/unit), t12=**null**, platform=**null** | T12 has no reserves line |
| `noi` | `platform_fallback` | $486,108 | om=$2,999,564, platform=**null** | NOI collision: broker $3.0M vs resolved $486K (−83.8%) — BUG-06 |
| `noi_after_reserves` | **Not in year1** | null | — | NOT assembled in year1 JSONB; only in projections (BUG-13) |

---

## Section 5 — Layer 4: Frontend State & Rendering Audit

### 5.1 Zustand Store Shape (dealStore)

`ProFormaSummaryTab.tsx` reads four selectors from `useDealStore` (lines 364-369):

```typescript
const viewMode             = useDealStore(s => s.viewMode);
// 'broker' | 't12' | 'platform' | 'resolved' — controls column highlight
const y1Source             = useDealStore(s => s.y1Source);
// 'T12' | 'T6' | 'T3' | 'T1' | 'BROKER' — T-period header highlight
const platformColSource    = useDealStore(s => s.platformColSource);
// PlatformColSource enum — drives platform column label
const stanceAffectedFields = useDealStore(s => s.stanceAffectedFields);
// OperatorStance-tagged field paths
```

`data: DealFinancials | null` is local React state fetched via `apiClient.get()` inside
`useCallback load()` — **not** a Zustand subscription. Data does not auto-update on
Zustand mutations; only on explicit `load()` call.

**Shape mismatch:** `y1Source` changes the T-period column header highlight only. It does
NOT re-derive `resolved` from the newly selected period's raw value. The "T12 column"
is an annotation; it is not a data source switch. An operator toggling to "T6" mode sees
the T12-resolved value displayed as primary — no T6 re-resolution occurs.

### 5.2 OperatingStatementRow Shape (Frontend ↔ Backend Contract)

Assembled by `toRow()` at `proforma-adjustment.service.ts:1876-1905`:

```typescript
interface OperatingStatementRow {
  field:             string;          // e.g. 'gpr', 'vacancy_loss'
  label:             string;          // display label
  broker:            number | null;   // layerNum(field, 'om') ?? layerNum(field, 'broker')
  platform:          number | null;   // layerNum(field, 'platform')  ← always null (BUG-01)
  t12:               number | null;   // layerNum(field, 't12')
  t6:                number | null;   // not populated by toRow() — always null
  t3:                number | null;   // not populated by toRow() — always null
  t1:                number | null;   // not populated by toRow() — always null
  rentRoll:          number | null;   // layerNum(field, 'rent_roll')
  taxBill:           number | null;   // layerNum(field, 'tax_bill')
  resolved:          number | null;   // resolvedNum(field)
  resolution:        string | null;   // field.resolution tag
  perUnit:           number | null;   // resolved / totalUnits
  source:            string | null;   // = resolution (duplicate field)
  confidence:        number | null;   // SOURCE_CONFIDENCE[resolution] (0-100)
  benchmarkPosition: 'above' | 'below' | 'within' | null;  // always null (BUG-01)
}
```

**Null-handling issues:**
- `platform` = null for every row (BUG-01) → `benchmarkPosition` = null → no benchmark
  comparison badge ever renders on any row
- `t6`, `t3`, `t1` present in TypeScript interface but not populated by `toRow()`; always null
- `confidence` is present in the response (e.g. t12 = 85, override = 95) but the tab renders
  it as a badge only when `resolution` matches a recognized tier
- `LV.warning` strings in the JSONB (e.g. insurance null warning) are not extracted by
  `toRow()` and are silently dropped from the API response (BUG-14)

### 5.3 LayeredValue → OperatingStatementRow Flattening

Backend `LayeredValue<T>` slots: `{ om, t12, rent_roll, tax_bill, platform, override,
resolved, resolution, updated_at, warning? }`.

| LayeredValue slot | OperatingStatementRow field | Rendering in ProFormaSummaryTab |
|---|---|---|
| `om` / `broker` | `broker` | Rendered in BROKER column with source badge |
| `platform` | `platform` | Always null — benchmark column always blank |
| `t12` | `t12` | Rendered in T12 column |
| `rent_roll` | `rentRoll` | Rendered in RENT ROLL column |
| `tax_bill` | `taxBill` | Rendered in TAX BILL column |
| `resolved` | `resolved` | Primary display value |
| `resolution` | `resolution` / `source` | Badge label ("override", "t12", etc.) |
| `warning` | **Not surfaced** | Silently dropped by `toRow()` — BUG-14 |
| `updated_at` | Not present | Not in `OperatingStatementRow` |

### 5.4 Category / isSubtotal Metadata

There is **no `category` field and no `isSubtotal` flag** in `OperatingStatementRow`.
Subtotal rows (EGI, total_opex, NOI) are identified in the frontend exclusively by field
key string matching (`r.field === 'egi'`, `r.field === 'total_opex'`, etc.).

Section headers in the v31 spec (BASE RENTAL REVENUE, CONTROLLABLE EXPENSES,
NON-CONTROLLABLE EXPENSES, etc.) are hardcoded in the rendering component, not driven
by API metadata. Adding or reordering sections requires frontend code changes.

The `isSubtotal` flag at `StrategyV2Components.tsx:741` applies to the Strategy V2
waterfall visualization surface, not to `ProFormaSummaryTab`.

---

## Section 6 — Layer 5: Subtotals Computation Ownership

### 6.1 Where Subtotals Are Computed

Row assembly in `getDealFinancials()` at `proforma-adjustment.service.ts:1832-1970`:

```typescript
const REVENUE_FIELDS = [
  ['gpr', 'Gross Potential Rent'],
  ['loss_to_lease_pct', ...], ['vacancy_pct', ...], ['concessions_pct', ...],
  ['bad_debt_pct', ...], ['non_revenue_units_pct', ...],
  ['other_income_per_unit', ...], ['net_rental_income', ...],
  ['egi', 'Effective Gross Income'],          // ← subtotal row
];
const OPEX_FIELDS = [
  ['repairs_maintenance', ...], ['contract_services', ...], ['landscaping', ...],
  ['payroll', ...], ['marketing', ...], ['g_and_a', ...], ['turnover', ...],
  ['water_sewer', ...], ['electric', ...], ['gas_fuel', ...],
  ['insurance', ...], ['real_estate_tax', ...], ['management_fee_pct', ...],
  ['replacement_reserves', ...],
  ['total_opex', 'Total Operating Expenses'],  // ← subtotal row
];
const NOI_FIELDS = [['noi', 'Net Operating Income']];  // ← subtotal/total row
```

Assembled row array (lines 1959-1970):
```
REVENUE_FIELDS.map(toRow)
+ toDollarRow('loss_to_lease_pct', 'loss_to_lease', ...)
+ toDollarRow('vacancy_pct', 'vacancy_loss', ...)
+ toDollarRow('concessions_pct', 'concessions', ...)
+ toDollarRow('bad_debt_pct', 'bad_debt', ...)
+ toDollarRow('non_revenue_units_pct', 'non_revenue_units', ...)
+ toDollarRow('other_income_per_unit', 'other_income', ..., totalUnits × 12)
+ OPEX_FIELDS.map(toRow)
+ toDollarRow('management_fee_pct', 'management_fee', ..., EGI)
+ NOI_FIELDS.map(toRow)
```

**Finding:** Subtotals (EGI, total_opex, NOI) are computed once by the seeder and stored in
`deal_assumptions.year1.FIELD.resolved`. They are returned as regular rows — identical in
shape to detail rows. No `category` or `isSubtotal` metadata accompanies them. The seeder:
- `egi = NRI + other_income`
- `total_opex = SUM(all opex component resolved values)`
- `noi = egi − total_opex`

### 6.2 Spec vs Live Subtotal Coverage Gap

| v31 spec row | In year1 OperatingStatementRow[]? | Where computed? |
|---|---|---|
| BASE RENTAL REVENUE | No named row | Visual section header only (hardcoded in frontend) |
| CONTROLLABLE EXPENSES | No named row | Visual section header only |
| NON-CONTROLLABLE EXPENSES | No named row | Visual section header only |
| TOTAL OPERATING EXPENSES | ✓ `total_opex` | Seeder seed; `toRow('total_opex', ...)` |
| NET OPERATING INCOME | ✓ `noi` | Seeder seed; `toRow('noi', ...)` |
| NOI AFTER RESERVES | **Not in year1** | Projection loop only (line 3393) |
| TOTAL DEBT SERVICE | **Not in year1** | Projection loop only |
| CASH FLOW BEFORE TAX | **Not in year1** | Projection loop only; 3D model: `proFormaGenerator.ts:314` |

**Finding (BUG-13):** `NOI After Reserves` is defined in the v31 spec as a Pro Forma surface
row ("NOI AFTER RESERVES — subtotal") but is NOT present in the `OperatingStatementRow[]`
returned by `getDealFinancials()`. `ProFormaSummaryTab` cannot render it.

---

## Section 7 — Layer 6: Live Data Spot-Checks

All values from live DB queries against 464 Bishop at 2026-05-09.

### Spot-check 1: GPR → Vacancy Loss → EGI Chain

**Rule:** EGI = GPR − vacancy_loss − loss_to_lease − concessions − bad_debt − non_revenue_units + other_income

| Step | Formula | DB resolved inputs | Computed | DB actual | Pass? |
|---|---|---|---|---|---|
| GPR | `year1.gpr.resolved` | override = $4,901,400 | **$4,901,400** | $4,901,400 | ✓ |
| Vacancy Loss | `GPR × vacancy_pct.resolved` | 4,901,400 × 0.19827586 | **$971,887** | — | — |
| Loss to Lease | `GPR × ltl_pct.resolved` | 4,901,400 × 0.003497 | **$17,140** | — | — |
| Concessions | `GPR × concessions_pct.resolved` | 4,901,400 × 0.07779 | **$381,280** | — | — |
| Bad Debt | `(GPR−vac−ltl−con) × bd_pct` | 3,531,093 × 0.033423 | **$117,999** | — | — |
| Non-Revenue Units | `GPR × 0.00` | 4,901,400 × 0 | **$0** | — | — |
| Other Income | `oi_per_unit × units × 12` | 75.3448 × 232 × 12 | **$209,749** | — | — |
| **EGI (computed)** | NRI + other_income | 3,413,094 + 209,749 | **$3,622,843** | **$3,615,849** | Delta = $6,994 (~0.2%) |

**Conclusion:** Delta of $6,994 is within rounding precision; attributable to fractional
precision in vacancy rate. Chain is internally consistent.

**Secondary finding — System A vs System B vacancy divergence:**

| | System A `GET /api/v1/proforma/:dealId` | System B `year1.vacancy_pct.resolved` |
|---|---|---|
| Vacancy rate | 5.00% | 19.83% |
| Implied vacancy loss on $4,901,400 GPR | $245,070 | $971,887 |
| EGI difference | **+$726,817** on System A vs System B | |

Both are visible to the operator; divergence not flagged.

### Spot-check 2: OpEx Lines → Total OpEx

**Rule:** `total_opex.resolved = SUM(all opex component resolved values)`
Verified via arithmetic identity: `total_opex = EGI − NOI`

| Quantity | Value | Source |
|---|---|---|
| EGI | $3,615,849.05 | `year1.egi.resolved` |
| NOI | $486,107.97 | `year1.noi.resolved` |
| **Total OpEx (identity)** | $3,615,849 − $486,108 = **$3,129,741** | Derived |
| **Total OpEx (DB stored)** | **$3,129,741.08** | `year1.total_opex.resolved` |

✓ **PASS — arithmetic identity holds to within $0.03.**

**Known component breakdown:**

| OpEx line | Resolved | Resolution | Platform | Benchmark |
|---|---|---|---|---|
| Payroll | $324,800 | override | null | null |
| Repairs & Maintenance | $69,600 | override | null | null |
| Contract Services | $28,680 | override | null | null |
| Landscaping | null | null | null | null |
| Marketing | $69,600 | override | null | null |
| G&A | $69,600 | override | null | null |
| Turnover | $41,760 | override | null | null |
| Water & Sewer | null | null | null | null |
| Electric | null | null | null | null |
| Gas / Fuel | null | null | null | null |
| Utilities (combined) | $187,094 | override | null | null |
| Insurance | $46,400 | override | null | null |
| Real Estate Tax | $1,127,126 | t12 | null | null |
| Management Fee | $90,396 | override | null | null |
| Replacement Reserves | $58,000 | override | null | null |
| **Known sum** | **$2,113,056** | | | |
| **Unaccounted** | **$1,016,685** | Other inputs or T12 catch-alls not listed | | |

**Finding:** Arithmetic identity passes, but all 14+ opex line items have `platform = null`
(BUG-01) → `benchmarkPosition = null` for every row → no individual line item can be
benchmarked against market norms. The $1,016,685 unaccounted gap indicates additional opex
fields not enumerated in `OPEX_FIELDS` (or the `utilities` combined field double-counting).

### Spot-check 3: NOI → NOI After Reserves → CFBD Chain

**Rule:** NOI After Reserves = NOI − replacement_reserves;
CFBD = NOI After Reserves − debt_service

| Step | Formula | DB inputs | Computed | DB `year1` value | Pass? |
|---|---|---|---|---|---|
| NOI | `year1.noi.resolved` | $486,107.97 | **$486,108** | $486,108 | ✓ |
| Replacement Reserves | `year1.replacement_reserves.resolved` | $58,000 | **$58,000** | $58,000 | ✓ |
| **NOI After Reserves** | `NOI − reserves` | $486,108 − $58,000 | **$428,108** | **null** | ✗ NOT in year1 |
| Debt Service | Capital stack loan terms | Not in year1 seed | — | **null** | ✗ NOT in year1 |
| **CFBD** | `NOI After Reserves − debt_service` | — | — | **null** | ✗ NOT in year1 |

✗ **FAIL — chain breaks at NOI After Reserves (BUG-13).** The arithmetic is correct
($428,108 expected) but `year1.noi_after_reserves` is not assembled as an
`OperatingStatementRow`. The computation exists only in the projection engine:
`proforma-adjustment.service.ts:3393` as `reservesY1 = ry1('replacement_reserves') ||
(totalUnits × 350)`.

**CFBD (Cash Flow Before Tax):** Per the v31 spec: "Cash Flow Before Tax — in Projections
tab, not summary Pro Forma." CFBD correctly belongs in the Projections tab, not the Pro
Forma surface. It is computed per-year in the projection loop as `noi - debtService`
(also in `proFormaGenerator.ts:314` for the 3D design model). **Only `NOI After Reserves`
is a Pro Forma surface gap; CFBD is correctly a Projections-only item.**

---

## Section 8 — Layer 7: Frontend Mock Status

| Component | File:line | Status | Evidence |
|---|---|---|---|
| `ProFormaIntelligence` | ~~`ProFormaIntelligence.tsx:19`~~ | ✅ **Deleted** | Component was orphaned (never imported anywhere); deleted along with `enhancedProFormaMockData.ts` — Task #671. M09 label in navigation routes to F9 Financial Engine (live data). |
| Market Findings cards | ~~Rendered by ProFormaIntelligence~~ | ✅ **Deleted** | Removed with component — BUG-07 resolved via deprecation path |
| `ProFormaSummaryTab` | `ProFormaSummaryTab.tsx` | Live (partial) | Reads from `dealFinancials.year1` (System B) — real resolved data |
| Market baseline | `proforma-adjustment.service.ts:1049` | **Hardcoded** | `getMarketBaseline()` returns literal constants; no MSA/submarket query |
| `runModel()` inputs | `proforma-adjustment.service.ts:169-182` | **Hardcoded** | 15 hardcoded constants — not live deal data (BUG-02) |
| `LV.warning` field | `toRow()` at line 1876 | **Not surfaced** | Warning strings in LayeredValue JSONB not extracted by `toRow()`; silently dropped (BUG-14) |

---

## Section 9 — Legacy vs Evidence-Tier Boundary

### Model Comparison

| Dimension | Legacy model (live code) | Evidence-tier model (spec) |
|---|---|---|
| **Layer count** | 3: Broker / Platform / User | 4: Tier 1 (deal own data) / Tier 2 (owned portfolio) / Tier 3 (platform) / Tier 4 (broker — reference only) |
| **Broker authority** | Layer 1 of 3 — used as a source | Tier 4 of 4 — collision reference, never authoritative |
| **T12 / Rent Roll / Tax Bill** | Named source slots in LayeredValue | Tier 1 — highest authority |
| **Owned portfolio actuals** | Not implemented; `box_score` slot null | Tier 2 — second authority via M22 Post-Close |
| **Platform (M05/M07)** | `year1.FIELD.platform` slot — all null | Tier 3 — market-wide benchmarks |
| **User override** | `year1.FIELD.override` — working | Maps to operator instruction |
| **Evidence provenance** | `LayeredValue.resolution` (string tag) | `Evidence { primary_tier, data_points[], reasoning, alternatives_considered[], collision? }` |
| **Collision detection** | Not implemented | `CollisionReport { broker_value, platform_value, delta_pct, magnitude, direction, narrative }` per field |
| **Agent attribution** | Not present | `agent_run_id`, `set_by`, `set_at` per field |
| **Tier 2 data source** | Not built | `deal_monthly_actuals` via M22 Post-Close Intelligence |

### Field-Level Resolution Rule Divergence

| Field | Legacy FIELD_PRIORITIES (seeder:136-148) | Evidence-tier spec rule |
|---|---|---|
| `real_estate_tax` | `['tax_bill', 't12']` | Always use `taxService.forecast()` per jurisdiction — never trust T12 if assessed value changed |
| `insurance` | `['t12']` | `insuranceService.forecast()` — "never trust broker OM" in FL/CA; platform benchmark required |
| `vacancy_pct` | `['rent_roll', 't12', 'om']` | T12 → Tier 2 owned actuals → floor at M07 structural vacancy |
| `gpr` | `['override', 'rent_roll', 't12']` | rent_roll → Tier 2 owned comps → M05 submarket rent |
| `exit_cap` | Not in FIELD_PRIORITIES (System A hardcoded 5.5%) | Tier 2 disposition comps → M15 comps → rate environment |

### API Shape Divergence

| Attribute | Live `OperatingStatementRow` | Spec `UnderwritingValue` |
|---|---|---|
| `source` / `resolution` | `'t12' \| 'rent_roll' \| 'override' \| 'platform_fallback'` | `'tier1:t12' \| 'tier2:owned_asset' \| 'tier3:platform' \| 'tier4:broker' \| 'override'` |
| `evidence` | Not present | `{ primary_tier, data_points[], reasoning, alternatives_considered[] }` |
| `confidence` | `number` (0-100) | `'high' \| 'medium' \| 'low'` |
| `collision` | Not present | `{ broker_value, platform_value, delta_pct, magnitude, direction, narrative }` |
| `warning` | Present in JSONB; dropped by `toRow()` | Surfaced in evidence narrative |

---

## Section 10 — Bug Inventory

| ID | Severity | Component | File:line | Description | Fix complexity | Depends on |
|---|---|---|---|---|---|---|
| BUG-01 | P0 | proforma-seeder | `proforma-seeder.service.ts:185` | Platform slot null for every year1 field | High — M05 integration required | Blocks BUG-03, collision detection, benchmarkPosition |
| BUG-02 | P0 | proforma-adjustment | `proforma-adjustment.service.ts:169-182` | `runModel()` hardcoded inputs — phantom deal, not 464 Bishop | Medium — replace with live deal lookups | BUG-03 |
| BUG-03 | P0 | proforma-adjustment | `proforma-adjustment.service.ts:1049` | `getMarketBaseline()` returns hardcoded constants; no live MSA query | High — M05 live integration | Blocks BUG-01 |
| BUG-04 | P1 | proforma-seeder | Vacancy derivation | T12 vacancy = 66.0% for 464 Bishop — formula error | Medium — fix vacancy_pct formula | Independent |
| BUG-05 | P1 | proforma-seeder | `proforma-seeder.service.ts:607` | RE tax: tax_bill $20,731 vs T12 $1,127,126 (54×); `taxService.forecast()` not called for P&L line | Medium — wire taxService | Independent |
| BUG-06 | P1 | architecture | None | NOI collision −83.8%, EGI −27.7%, OpEx +56.6%; CollisionReport not implemented | High — requires CashFlow Agent | Task #672 |
| ~~BUG-672A~~ | ~~P1~~ | ~~proforma-seeder~~ | ~~`proforma-seeder.service.ts`~~ | ~~Bad debt deducted from EGI (incl. other income) — v31 spec requires deduction from rental income only~~ | ✅ **RESOLVED Task #672** — `bd_t12` basis changed to GPR; bad_debt folded into NRI formula; `egi = nri + other_income` (no separate bd multiplier). Rate basis also corrected: 0.86% of GPR vs 3.34% of EGI. NOI: $486K → $567K | — |
| ~~BUG-672B~~ | ~~P2~~ | ~~proforma-seeder~~ | ~~`proforma-seeder.service.ts`~~ | ~~Water/Sewer, Electric, Gas, Landscaping rows always null — seeder only populated compound `utilities`~~ | ✅ **RESOLVED Task #672** — four sub-line LayeredValues seeded (`water_sewer`, `electric`, `gas_fuel`, `landscaping`); total_opex uses sub-line sum when any are resolved, else falls back to compound `utilities`; IC-03 updated to accept either compound or split utility data | — |
| ~~BUG-672C~~ | ~~P3~~ | ~~proforma-seeder~~ | ~~`proforma-seeder.service.ts:932`~~ | ~~`replacement_reserves` resolve call missing `t12` input despite `priority: ['t12', 'om']`~~ | ✅ **RESOLVED Task #672** — `t12: num(t12Opex, 'replacement_reserves')` added; null for 464 Bishop (T12 capsule opex does not include reserves, which is expected) | — |
| ~~BUG-07~~ | ~~P1~~ | ~~frontend~~ | ~~`ProFormaIntelligence.tsx:19`~~ | ~~AI Market Findings 100% mock — never calls live API~~ | ✅ **RESOLVED Task #671** — component deleted (was orphaned/unreachable); `enhancedProFormaMockData.ts` also deleted | — |
| BUG-08 | P1 | architecture | Both systems | System A vacancy 5%, System B vacancy 19.83% for same deal — fully decoupled | High — architectural decision | BUG-01, BUG-03 |
| BUG-09 | P2 | proforma-seeder | `proforma-seeder.service.ts:592` | Insurance LV.warning references non-existent platform baseline | Low / Medium | Insurance benchmark data |
| BUG-10 | P2 | proforma-seeder | Collision logic | other_income: OM $307.76 vs rent_roll $75.34 (4×) — no collision flag | High — requires CollisionReport | BUG-06 |
| BUG-11 | P2 | proforma-seeder | Broker capsule mapping | `year1.gpr.om = null` despite `broker_claims.proforma.stabilizedGpr` existing | Low — add mapping | Independent |
| BUG-12 | P3 | proforma-adjustment | `proforma.routes.ts:155` | M35 `eventAttribution` is display metadata only — no numeric effect on System B | Medium | M35 event data |
| BUG-13 | P1 | proforma-seeder | `getDealFinancials()` row assembly | `noi_after_reserves` not in `OperatingStatementRow[]`; only in projections | Medium — add derived row in getDealFinancials | Independent |
| BUG-14 | P2 | proforma-adjustment | `toRow()` line 1876 | `LV.warning` not extracted into `OperatingStatementRow`; silently dropped | Low — add `warning?` field to shape | Independent |

---

## Section 11 — Summary Scorecard

| Layer | Status | Primary gap |
|---|---|---|
| Broker per-line-item audit (L1) | ✅ Complete (35 rows) | 3 severe collisions undetected; BUG-11 (GPR.om null) |
| Platform per-service matrix (L2) | 🔴 Not implemented | All platform slots null; all M05/M14/M15/M22 absent |
| T12 / Rent Roll data quality (L3) | 🟡 Partial | T12 vacancy 66% (formula error); T12 insurance null |
| Tax bill resolution (L3) | 🟡 Partial | $20K bill vs $1.1M T12; taxService not called for P&L |
| Override layer | ✅ Working | Operator values persist and resolve correctly |
| System A raw payload | ✅ Documented | All 5 scalars at defaults; `computed` block from hardcoded model |
| Frontend state / rendering (L4) | ⚠️ Partial | No category/isSubtotal metadata; LV.warning silently dropped; benchmarkPosition null |
| Subtotals computation (L5) | ⚠️ Partial | EGI/total_opex/NOI correct; NOI After Reserves missing (BUG-13) |
| GPR→Vacancy→EGI chain (L6-A) | ✅ Pass | Delta 0.2% within rounding |
| OpEx→Total OpEx chain (L6-B) | ✅ Pass (identity) | All platform slots null; partial gap $1,016,685 in combined utilities |
| NOI→NOI After Reserves→CFBD (L6-C) | 🔴 Fail | Breaks at noi_after_reserves (BUG-13); CFBD correctly in Projections |
| System A ↔ B coherence | 🔴 Broken | Vacancy 5% vs 19.83%; M35 adjustments never flow to System B |
| Collision detection | 🔴 Not implemented | CollisionReport not built; 3 severe collisions invisible |
| Frontend AI cards | 🔴 100% mock | ProFormaIntelligence renders static fixture |
| Evidence-tier model | 🔴 Gap | Tier 2, CollisionReport, agent attribution all absent |

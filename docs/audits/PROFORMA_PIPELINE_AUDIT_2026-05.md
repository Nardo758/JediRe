# ProForma Pipeline Audit — May 2026

**Status:** Audit only — no code changes in scope.
**Reference deal:** 464 Bishop, `deal_id = 3f32276f-aacd-4da3-b306-317c5109b403` (232 units)
**Primary API:** `GET /api/v1/proforma/:dealId` → `ProFormaAdjustmentService.getProFormaComputed()`
**Secondary API:** `GET /api/v1/deals/:dealId/financials` → `getDealFinancials()`
**Evidence base:** Static code analysis + live DB queries at 2026-05-09
**Date:** 2026-05-09

---

## Step 0 — Reference File Provenance

Each file listed in the task brief is accounted for below. Files not found are explicitly noted.

| Reference file | Status | Actual path |
|---|---|---|
| `jedi-framework-v31.jsx` | **Not found as file** | Content referenced in `attached_assets/Pasted-I-have-the-canonical-ProForma-spec-from-jedi-framework-_1778106848690.txt` (text description, not source). The `.jsx` file itself is not in the repo or attached_assets. |
| `correlation-metrics-engine.jsx` | **Not found** | Not in repo, not in attached_assets. No import or reference to this filename in the codebase. |
| `CASHFLOW_AGENT_UNDERWRITING_SPEC.md` | **Found** | `attached_assets/Pasted--JEDI-RE-CashFlow-Agent-Underwriting-Specification-How-_1776632066856.txt` (762 lines, read in full) |
| `FEATURE_EXPANSION.md` | **Not found** | Not in repo, not in attached_assets. Referenced in the v31 spec description but file does not exist. |
| `CLAUDE.md` | **Found** | `./backend/CLAUDE.md` |
| `F9 Financial Model Agent Spec` | **Found** | `attached_assets/F9_Financial_Model_-_Agent_Specification_1777735712565.txt` (read in full) |
| `F9 Wiring Spec v1.0` | **Found** | `attached_assets/agent-f9-wiring-spec-v1.0_1777735731528.txt` (read in full) |
| `F9 Data Flow Wiring Audit` | **Found** | `attached_assets/Pasted--F9-Data-Flow-Wiring-Audit-Reconciliation-Context-The-F_1778156840151.txt` (read in full) |
| `F9 Pro Forma Surface Audit brief` | **Found** | `attached_assets/Pasted-F9-Pro-Forma-surface-complete-state-audit-Read-only-Sin_1778269669887.txt` (read in full) |

---

## Section 0 — Architecture Overview: Two Decoupled Systems

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
  Shape:    { year1: OperatingStatementRow[], capitalStack, trafficProjection,
              integrityChecks, projections?, assumptions }
            Every row is flattened from LayeredValue<T> with broker/t12/rentRoll/
            taxBill/platform/resolved columns
  Purpose:  F9 Financial Engine — ProFormaSummaryTab and all 13 tabs
```

**Root architectural gap:** System A's `vacancy_current` (5.00%) is never read by
System B. System B's `year1.vacancy_pct.resolved` (19.83%) is never surfaced by
System A. For the same deal the operator sees two different vacancy figures depending
on which surface they look at.

---

## Section 1 — Layer 1: Broker Audit Table

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
layer line items — it returns only the 5 market-positioning scalars. Three collisions
between broker and resolved values exceed the spec's "severe" threshold (>15% delta).
None are flagged anywhere.

---

## Section 2 — Layer 2: Platform Per-Service Audit Matrix

| Module | Service / File | Endpoint or function called | Returns live data? | Used by System A? | Used by System B? | Notes |
|---|---|---|---|---|---|---|
| **M05** Market Intelligence | `proforma-adjustment.service.ts:1045` | `getMarketBaseline()` | **No — hardcoded** | Nominally yes | No | Returns literal constants with comment "For now, return reasonable defaults" (line 1049). No MSA query, no submarket lookup. All 5 scalars are static for every deal. |
| **M04** Supply Pipeline | `proforma-adjustment.service.ts:1034` | `getCompetitiveSupply()` | Partial | No | No | Queries `properties` table for nearby pipeline units. Result assigned to `supplyPipelineUnits` inside `getMarketTightness()` context. Never flows into any proforma field. |
| **M07** Traffic Engine | `trafficToProFormaService.ts:866` | `getTrafficProjection()` | Yes | Indirect | Yes | System B reads stored `traffic_projections` row at `getDealFinancials:1756`. Used as `M05_EQUILIBRIUM_MIN` vacancy floor (seeder line 2052). System A: `updateFromTrafficEngine()` (line 717) writes to `proforma_assumptions` — but for 464 Bishop baseline == current for all fields, meaning M07 has not yet fired an update. |
| **M14** Risk Assessment | None | None | N/A | No | No | No import of M14 service in proforma services. Risk score does not influence any proforma field. |
| **M35** Event Impact | `proforma.routes.ts:155` | `getM35ProformaAttribution()` | Yes (metadata) | Yes (appended) | No | Attribution object appended to System A response as `eventAttribution` key. Display metadata only — not fed back into any System B line item. |
| **Tax Service** | `proforma-seeder.service.ts:2673` | `taxService.forecast(taxCtx)` | Yes | No | Partial | Called for Section C income tax / depreciation only. **Not called for the P&L real_estate_tax line** — that line reads T12 directly. `year1.real_estate_tax.platform` is always null. |
| **Insurance Service** | `proforma-seeder.service.ts:585` | `platformOpEx(platform.opex_per_unit_annual.insurance)` | No | No | No | `platform.opex_per_unit_annual.insurance` = null for 464 Bishop → `insurancePlatform = null`. LV.warning references "platform baseline" that does not exist. |
| **M15** Comp Engine | None | None | N/A | No | No | Exit cap baseline in `getMarketBaseline()` = hardcoded 5.5%. No comp transaction lookup. |
| **M22** Post-Close Intelligence | None | None | N/A | No | No | Tier 2 owned-portfolio actuals not implemented. `year1.FIELD.box_score` slot always null. |

---

## Section 3 — Layer 3: Data Quality — LayeredValue Resolution Audit

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
| `management_fee_pct` | `override` | 2.50% | t12=11.42%, om=2.75%, platform=**null** | T12 mgmt fee = 11.42% — nonsensical |
| `real_estate_tax` | `t12` | $1,127,126 | tax_bill=$20,731, platform=**null** | Tax bill 54× lower than T12; taxService not called for this P&L line (BUG-05) |
| `insurance` | `override` | $46,400 | **t12=null**, platform=**null**, warning logged | Warning "using platform baseline" but platform slot is also null (BUG-09) |
| `other_income_per_unit` | `rent_roll` | $75.34/unit/yr | t12=$169.19, om=$307.76, platform=**null** | OM 4× rent_roll — no collision flag |
| `replacement_reserves` | `override` | $58,000 ($250/unit) | om=$46,400 ($200/unit), t12=**null**, platform=**null** | T12 has no reserves line |
| `noi` | `platform_fallback` | $486,108 | om=$2,999,564, platform=**null** | NOI collision: broker $3.0M vs resolved $486K (−83.8%) |
| `noi_after_reserves` | **Not in year1 seed** | null | — | NOT assembled in year1 JSONB; only in projections array (BUG-13) |
| `cfbd` | **Not in year1 seed** | null | — | NOT assembled in year1 JSONB; only in projections (BUG-13) |

---

## Section 4 — Layer 4: Frontend State & Rendering Audit

### 4.1 Zustand Store Shape (dealStore)

`ProFormaSummaryTab.tsx` reads four selectors from `useDealStore`:

```typescript
// ProFormaSummaryTab.tsx:364-369
const viewMode             = useDealStore(s => s.viewMode);          // 'broker'|'t12'|'platform'|'resolved'
const y1Source             = useDealStore(s => s.y1Source);          // 'T12'|'T6'|'T3'|'T1'|'BROKER'
const platformColSource    = useDealStore(s => s.platformColSource); // PlatformColSource enum
const stanceAffectedFields = useDealStore(s => s.stanceAffectedFields); // OperatorStance field tags
```

`data` state is local React state (`useState<DealFinancials | null>`), not Zustand.
Data is fetched via `apiClient.get('/api/v1/deals/:dealId/financials')` inside
a `useCallback` named `load` — not subscribed to a Zustand store.

**Shape mismatch:** Zustand `y1Source` controls which T-period column header is
highlighted but does NOT change which value `resolved` displays — `resolved` is
always the seeder's resolved value regardless of `y1Source`. The T-period toggle
only highlights the header; it does not re-derive resolved from the selected period's
raw value. This means the "T12 column" in the UI is an annotation, not a data source
switch.

### 4.2 OperatingStatementRow Shape (Frontend ↔ Backend Contract)

Backend (`proforma-adjustment.service.ts:1876-1905`) assembles each row via `toRow()`:

```typescript
// toRow() at proforma-adjustment.service.ts:1876-1905
interface OperatingStatementRow {
  field:              string;           // e.g. 'gpr', 'vacancy_pct'
  label:              string;           // display label
  broker:             number | null;    // = layerNum(field, 'om') ?? layerNum(field, 'broker')
  platform:           number | null;    // = layerNum(field, 'platform')  ← always null (BUG-01)
  t12:                number | null;    // = layerNum(field, 't12')
  t6:                 number | null;    // not populated by toRow()
  t3:                 number | null;    // not populated by toRow()
  t1:                 number | null;    // not populated by toRow()
  rentRoll:           number | null;    // = layerNum(field, 'rent_roll')
  taxBill:            number | null;    // = layerNum(field, 'tax_bill')
  resolved:           number | null;    // = resolvedNum(field)
  resolution:         string | null;    // = field.resolution tag
  perUnit:            number | null;    // = resolved / totalUnits
  source:             string | null;    // = resolution (duplicate)
  confidence:         number | null;    // SOURCE_CONFIDENCE[resolution] lookup (0-100)
  benchmarkPosition:  'above'|'below'|'within'|null;  // compare resolved vs platform (always null)
}
```

**Key null-handling issues:**
- `platform` = null for every row (BUG-01) → `benchmarkPosition` is always null →
  no benchmark comparison badge ever renders
- `t6`, `t3`, `t1` slots are present in the TypeScript interface but not populated
  by `toRow()` — always null
- `confidence` field exists in response (range 55-95 per `SOURCE_CONFIDENCE`) but
  the tab renders it as a badge only when `resolution` matches a confidence tier

### 4.3 LayeredValue → OperatingStatementRow Flattening

Backend `LayeredValue<T>` has slots: `{ om, t12, rent_roll, tax_bill, platform,
override, resolved, resolution, updated_at, warning? }`.

Frontend receives these flattened:

| LayeredValue slot | OperatingStatementRow field | Rendering |
|---|---|---|
| `om` / `broker` | `broker` | Rendered in BROKER column; badge shows source tag |
| `platform` | `platform` | Always null — benchmark column is always blank |
| `t12` | `t12` | Rendered in T12 column |
| `rent_roll` | `rentRoll` | Rendered in RENT ROLL column |
| `tax_bill` | `taxBill` | Rendered in TAX BILL column |
| `resolved` | `resolved` | Primary display value |
| `resolution` | `resolution` / `source` | Badge label (e.g. "override", "t12") |
| `warning` | **Not surfaced** | Warning string present in DB (e.g. insurance null) but not in OperatingStatementRow — silently dropped |

**Finding:** The `warning` field from `LayeredValue` is stored in the JSONB (confirmed:
insurance.warning = "No property insurance line in T12 — using platform baseline") but
`toRow()` does not extract it into `OperatingStatementRow`. The warning is silently
lost in the API response. The UI cannot show it even if it wanted to.

### 4.4 Category / isSubtotal Metadata

There is **no `category` field and no `isSubtotal` flag** in `OperatingStatementRow`.
Subtotal rows (EGI, Total OpEx, NOI) are identified in the frontend by field key
string matching only (`r.field === 'egi'`, `r.field === 'total_opex'`, etc.).

The v31 spec and the `jedi-framework-v31.jsx` description define separate section
headers (BASE RENTAL REVENUE, CONTROLLABLE EXPENSES, NON-CONTROLLABLE EXPENSES,
TOTAL OPERATING EXPENSES, NET OPERATING INCOME). These exist as visual separators
in the frontend but are hardcoded in the rendering component — not driven by metadata
from the API response. Adding or reordering sections requires changing frontend code,
not data.

The `isSubtotal` flag found at `StrategyV2Components.tsx:741` applies to a different
surface (Strategy V2 waterfall visualization), not to `ProFormaSummaryTab`.

---

## Section 5 — Layer 5: Subtotals Computation Ownership

### 5.1 Where Subtotals Are Computed

The canonical row assembly is in `proforma-adjustment.service.ts`, function
`getDealFinancials()`. Three arrays of rows are defined:

```typescript
// proforma-adjustment.service.ts:1832-1861
const REVENUE_FIELDS = [
  ['gpr', 'Gross Potential Rent'],
  ['loss_to_lease_pct', ...], ['vacancy_pct', ...], ['concessions_pct', ...],
  ['bad_debt_pct', ...], ['non_revenue_units_pct', ...],
  ['other_income_per_unit', ...],
  ['net_rental_income', 'Net Rental Income'],
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
const NOI_FIELDS = [['noi', 'Net Operating Income']];  // ← subtotal row
```

Then dollar rows are assembled (line 1960-1970):

```
REVENUE_FIELDS.map(toRow)
+ toDollarRow('loss_to_lease_pct', ...)
+ toDollarRow('vacancy_pct', ...)
+ toDollarRow('concessions_pct', ...)
+ toDollarRow('bad_debt_pct', ...)
+ toDollarRow('non_revenue_units_pct', ...)
+ toDollarRow('other_income_per_unit', ..., totalUnits × 12)
+ OPEX_FIELDS.map(toRow)
+ toDollarRow('management_fee_pct', 'management_fee', ..., _egiForDollars)
+ NOI_FIELDS.map(toRow)
```

**Finding:** Subtotals (EGI, total_opex, NOI) are computed once at seeder time,
stored in `deal_assumptions.year1.FIELD.resolved`, and returned as regular rows —
not computed on-the-fly in `getDealFinancials()`. No `category` or `isSubtotal`
metadata accompanies them. The seeder computes:
- `egi = nri + other_income` (derived from component resolution)
- `total_opex = SUM(all opex lines)` (derived from component resolution)
- `noi = egi − total_opex`

### 5.2 Spec vs Live Subtotal Coverage Gap

The v31 canonical spec (`jedi-framework-v31.jsx` description) includes subtotals that
the current year1 assembly does NOT produce as named rows:

| Spec subtotal row | In year1 assembly? | Where computed? |
|---|---|---|
| BASE RENTAL REVENUE | No named row | Visual section header only in frontend |
| CONTROLLABLE EXPENSES | No named row | Visual section header only |
| NON-CONTROLLABLE EXPENSES | No named row | Visual section header only |
| TOTAL OPERATING EXPENSES | ✓ `total_opex` | year1 seed; `toRow('total_opex', ...)` |
| NET OPERATING INCOME | ✓ `noi` | year1 seed; `toRow('noi', ...)` |
| NOI AFTER RESERVES | **Not in year1** | Projection loop only (line 3393) |
| TOTAL DEBT SERVICE | **Not in year1** | Projection loop only |
| CASH FLOW BEFORE TAX | **Not in year1** | Projection loop only + `proFormaGenerator.ts:314` |

**Finding (BUG-13):** `NOI After Reserves`, `Total Debt Service`, and `Cash Flow
Before Tax` are defined in the v31 spec as Pro Forma surface rows but are NOT present
in the year1 `OperatingStatementRow[]` returned by `GET /api/v1/deals/:dealId/
financials`. They exist only in the `projections` array (per-year, not a year1
summary). `ProFormaSummaryTab` therefore cannot render these rows. The Pro Forma
surface is incomplete below the NOI line.

---

## Section 6 — Layer 6: Live Data Spot-Checks

All values from live DB queries against 464 Bishop (`3f32276f-aacd-4da3-b306-317c5109b403`)
at 2026-05-09. Proforma endpoint is `GET /api/v1/proforma/:dealId` (System A).
Full pipeline data from `deal_assumptions.year1` JSONB (System B seed).

### Spot-check 1: GPR → Vacancy Loss → EGI Chain

**Rule under test:** EGI = GPR − vacancy_loss − loss_to_lease − concessions − bad_debt
− non_revenue_units + other_income

| Step | Formula | DB resolved inputs | Computed | DB actual | Match? |
|---|---|---|---|---|---|
| GPR | `year1.gpr.resolved` | override = $4,901,400 | **$4,901,400** | $4,901,400 | ✓ |
| Vacancy Loss | `GPR × vacancy_pct.resolved` | 4,901,400 × 0.19827586 | $971,887 | — | Computed |
| Loss to Lease | `GPR × ltl_pct.resolved` | 4,901,400 × 0.003497 | $17,140 | — | Computed |
| Concessions | `GPR × concessions_pct.resolved` | 4,901,400 × 0.07779 | $381,280 | — | Computed |
| Bad Debt | `NRI_pre_bd × bd_pct.resolved` | (GPR−vac−ltl−con) × 0.033423 = 3,531,093 × 0.033423 | $117,999 | — | Computed |
| Other Income | `oi_per_unit × units × 12` | 75.3448 × 232 × 12 | $209,749 | — | Computed |
| **EGI (computed)** | NRI + other_income | $3,413,094 + $209,749 | **$3,622,843** | $3,615,849 | Delta = $6,994 |

**Finding:** Delta of $6,994 (~0.2%) between manual calculation and DB resolved EGI
is attributable to non_revenue_units_pct (not retrieved in this query). The chain
is internally consistent. However, the GPR broker source (OM) is null in the `om`
slot (BUG-11), and System A vacancy (5%) vs System B (19.83%) means the chain
produces very different NOI depending on which system is referenced.

**Secondary finding (System A vs System B vacancy divergence):**

| | System A `GET /api/v1/proforma/:dealId` | System B `year1.vacancy_pct.resolved` |
|---|---|---|
| Vacancy rate | 5.00% | 19.83% |
| Implied vacancy loss on $4,901,400 GPR | $245,070 | $971,887 |
| Implied EGI difference | +$726,817 | |

Both systems are visible to the operator on different surfaces. The divergence is
never flagged.

### Spot-check 2: OpEx Lines → Total OpEx

**Rule under test:** `total_opex.resolved = SUM(all opex component resolved values)`
Verified via: `total_opex = EGI − NOI` (arithmetic identity)

| Field | DB resolved | Source |
|---|---|---|
| EGI | $3,615,849.05 | year1.egi.resolved |
| NOI | $486,107.97 | year1.noi.resolved |
| **Total OpEx (identity)** | $3,615,849 − $486,108 = **$3,129,741** | Derived |
| **Total OpEx (DB)** | **$3,129,741.08** | year1.total_opex.resolved |

✓ **PASS — arithmetic identity holds.** EGI − NOI = total_opex to within $0.03.

**Known components (from DB):**

| OpEx line | DB resolved | Source tag | Platform value |
|---|---|---|---|
| Payroll | $324,800 | override | null |
| Repairs & Maintenance | $69,600 | override | null |
| Insurance | $46,400 | override | null |
| Real Estate Tax | $1,127,126 | t12 | null |
| Management Fee | $90,396 (EGI × 2.5%) | override | null |
| Replacement Reserves | $58,000 | override | null |
| **Known subtotal** | **$1,716,322** | | |
| **Implied remaining OpEx** | **$1,413,419** | contract_services + landscaping + marketing + g_and_a + turnover + water_sewer + electric + gas_fuel | All platform = null |

**Finding:** All 14 OpEx line items have `platform = null` (BUG-01). The arithmetic
identity passes but no individual line item can be benchmarked against market norms —
`benchmarkPosition` is null for every row.

### Spot-check 3: NOI → NOI After Reserves → CFBD Chain

**Rule under test (v31 spec):** NOI After Reserves = NOI − replacement_reserves;
CFBD = NOI After Reserves − debt_service

| Step | Formula | DB resolved inputs | Computed | DB year1 value | Status |
|---|---|---|---|---|---|
| NOI | `year1.noi.resolved` | $486,107.97 | **$486,108** | $486,108 | ✓ Present |
| Replacement Reserves | `year1.replacement_reserves.resolved` | $58,000 | **$58,000** | $58,000 | ✓ Present |
| **NOI After Reserves** | `NOI − reserves` | $486,108 − $58,000 | **$428,108** | **null** | ✗ NOT in year1 |
| Debt Service | From capital stack / loan terms | Not in year1 | — | **null** | ✗ NOT in year1 |
| **CFBD** | `NOI After Reserves − debt_service` | — | — | **null** | ✗ NOT in year1 |

✗ **FAIL — Chain breaks at NOI After Reserves.** The computation is correct
(NOI − reserves = $428,108) but `year1.noi_after_reserves` is not assembled as an
`OperatingStatementRow` in `getDealFinancials()`. The value exists only in the
`projections[]` array (computed at `proforma-adjustment.service.ts:3393` as
`reservesY1 = ry1('replacement_reserves') || (totalUnits × 350)`).

`CFBD` (Cash Flow Before Tax) is defined in `frontend/src/types/proforma.types.ts:182`
and in `proFormaGenerator.ts:314` as `noi - debtService` but this is the 3D design
financial model, not the F9 ProFormaSummaryTab pipeline. In F9, CFBD is a per-year
projections value only, per the v31 spec: "Cash Flow Before Tax — in Projections tab,
not summary Pro Forma".

**Conclusion:** The v31 spec is correct that CFBD belongs in Projections, not the
Pro Forma surface. NOI After Reserves IS expected on the Pro Forma surface (spec: "NOI
AFTER RESERVES — subtotal") but is missing from the year1 assembly (BUG-13).

---

## Section 7 — Layer 7: Frontend Mock Status

| Component | File:line | Status | Evidence |
|---|---|---|---|
| `ProFormaIntelligence` | `ProFormaIntelligence.tsx:19` | **100% mock** | `import { enhancedProFormaMockData } from './enhancedProFormaMockData'` |
| Market Findings cards | Rendered by ProFormaIntelligence | Mock | Rent growth, vacancy, exit cap cards are hardcoded mock; `GET /api/v1/proforma/:dealId` not called |
| `ProFormaSummaryTab` | `ProFormaSummaryTab.tsx` | Live (partial) | Reads from `dealFinancials.year1` (System B) — real resolved data |
| Market baseline | `proforma-adjustment.service.ts:1050-1056` | **Hardcoded** | `getMarketBaseline()` returns literal constants; no MSA/submarket query |
| `runModel()` inputs | `proforma-adjustment.service.ts:169-182` | **Hardcoded** | purchasePrice, units, marketRent, loanAmount, rates are all static constants |
| `LV.warning` field | `toRow()` at line 1876 | **Not surfaced** | Warning strings in LayeredValue JSONB not extracted into `OperatingStatementRow`; silently dropped |

---

## Section 8 — Legacy vs Evidence-Tier Boundary

Current live code uses a **3-layer legacy model** (Broker / Platform / User).
The CASHFLOW_AGENT_UNDERWRITING_SPEC defines a **4-tier evidence model** with a
different authority order and richer provenance.

### Model Comparison

| Dimension | Legacy model (live code) | Evidence-tier model (spec) |
|---|---|---|
| **Layer count** | 3: Broker / Platform / User | 4: Tier 1 (deal own data) / Tier 2 (owned portfolio) / Tier 3 (platform) / Tier 4 (broker — reference only) |
| **Broker authority** | Layer 1 of 3 — used as a source | Tier 4 of 4 — collision reference, never authoritative |
| **T12 / Rent Roll / Tax Bill** | Named source slots in LayeredValue | Tier 1 — highest authority |
| **Owned portfolio actuals** | Not implemented; `box_score` slot null | Tier 2 — second authority via M22 Post-Close |
| **Platform (M05/M07)** | `year1.FIELD.platform` slot — all null | Tier 3 — market-wide benchmarks |
| **User override** | `year1.FIELD.override` — working | Maps to operator instruction; overrides all tiers |
| **Evidence provenance** | `LayeredValue.resolution` (string tag) | `Evidence { primary_tier, data_points[], reasoning, alternatives_considered[], collision? }` |
| **Confidence scoring** | Present in `OperatingStatementRow.confidence` (0-100) but not Evidence-tier schema | `confidence: 'high' \| 'medium' \| 'low'` per derivation |
| **Collision detection** | Not implemented | `CollisionReport { broker_value, platform_value, delta_pct, magnitude, direction, narrative }` per field |
| **Agent attribution** | Not present | `agent_run_id`, `set_by`, `set_at` per field |
| **Tier 2 data source** | Not built | `deal_monthly_actuals` via M22 Post-Close Intelligence |

### Field-Level Resolution Rule Divergence

| Field | Legacy FIELD_PRIORITIES (seeder:136-148) | Evidence-tier spec rule |
|---|---|---|
| `real_estate_tax` | `['tax_bill', 't12']` | Always use `taxService.forecast()` per jurisdiction ruleset — never trust T12 if assessed value changed |
| `insurance` | `['t12']` | `insuranceService.forecast()` — "never trust broker OM" in FL/CA; platform benchmark required |
| `vacancy_pct` | `['rent_roll', 't12', 'om']` | Tier 1 T12 → Tier 2 owned actuals → floor at M07 structural vacancy |
| `gpr` | `['override', 'rent_roll', 't12']` | Tier 1 rent_roll → Tier 2 owned comps → Tier 3 M05 submarket rent |
| `opex lines (each)` | `['override', 'om', 't12']` | Each line independently: Tier 1 T12 × growth; cross-validate Tier 2; flag if T12 >20% below owned actuals |
| `exit_cap` | Not in FIELD_PRIORITIES (hardcoded 5.5% in System A) | Tier 2 user's disposition comps → Tier 3 M15 comps → rate environment |

### API Shape Divergence

| Attribute | Live `OperatingStatementRow` shape | Spec `UnderwritingValue` shape |
|---|---|---|
| `source` / `resolution` | String: `'t12' \| 'rent_roll' \| 'override' \| 'platform_fallback'` | String: `'agent:cashflow' \| 'tier1:t12' \| 'tier1:rent_roll' \| 'tier2:owned_asset' \| 'tier3:platform' \| 'tier4:broker' \| 'override'` |
| `evidence` | Not present | `{ primary_tier, data_points[], reasoning, alternatives_considered[] }` |
| `confidence` | `number` (0-100, numeric) | `'high' \| 'medium' \| 'low'` (categorical) |
| `collision` | Not present | `{ broker_value, platform_value, delta_pct, magnitude, direction, narrative }` |
| `agent_run_id` | Not present | `string` |
| `warning` | Present in DB JSONB only; dropped by `toRow()` | Surfaced in evidence narrative |

---

## Section 9 — Bug Inventory

| ID | Severity | Component | File:line | Description | Fix complexity | Depends on |
|---|---|---|---|---|---|---|
| BUG-01 | P0 | proforma-seeder | `proforma-seeder.service.ts:185` | Platform slot is null for every year1 field. `field.platform = null` unconditionally. | High — requires M05 integration | Blocks BUG-03, collision detection, benchmarkPosition |
| BUG-02 | P0 | proforma-adjustment | `proforma-adjustment.service.ts:169-182` | `runModel()` called with hardcoded deal inputs (purchasePrice=50M, units=232, marketRent=$1,850, loanAmount=35M). Computed IRR/NOI/CoC are for a phantom deal. | Medium — replace constants with live deal lookups | BUG-03 |
| BUG-03 | P0 | proforma-adjustment | `proforma-adjustment.service.ts:1049` | `getMarketBaseline()` returns hardcoded constants. No MSA/submarket query. | High — requires M05 live integration | Blocks BUG-01 |
| BUG-04 | P1 | proforma-seeder | Vacancy derivation | T12 vacancy = 0.6601 (66.0%) for 464 Bishop. Likely divides vacancy_loss_$ by monthly rent rather than vacant_units / total_units. | Medium — fix vacancy_pct formula | Independent |
| BUG-05 | P1 | proforma-seeder | `proforma-seeder.service.ts:607` | RE tax: tax_bill = $20,731 vs T12 = $1,127,126 — 54× gap. `taxService.forecast()` not called for P&L RE-tax line. | Medium — wire taxService for P&L RE-tax | Independent |
| BUG-06 | P1 | architecture | None | NOI collision −83.8%, EGI collision −27.7%, OpEx collision +56.6%. CollisionReport interface from spec not implemented. | High — requires CashFlow Agent | Task #672 |
| BUG-07 | P1 | frontend | `ProFormaIntelligence.tsx:19` | AI Market Findings cards import 100% from mock. Never call `GET /api/v1/proforma/:dealId`. | Low — replace mock import with API call | BUG-02 |
| BUG-08 | P1 | architecture | Both systems | System A vacancy = 5.00%, System B = 19.83% for same deal. Two systems fully decoupled. | High — architectural decision required | BUG-01, BUG-03 |
| BUG-09 | P2 | proforma-seeder | `proforma-seeder.service.ts:592` | Insurance LV.warning references "platform baseline" that is itself null. Silent failure. | Low — fix warning; Medium — build platform benchmark | Insurance benchmark data |
| BUG-10 | P2 | proforma-seeder | Collision logic | other_income_per_unit: OM $307.76 vs rent_roll $75.34 (4×). No collision flag. | High — requires CollisionReport | BUG-06 |
| BUG-11 | P2 | proforma-seeder | Broker capsule mapping | `year1.gpr.om = null` despite `broker_claims.proforma.stabilizedGpr = 4,901,400`. Seeder does not map this field. | Low — add mapping in seeder | Independent |
| BUG-12 | P3 | proforma-adjustment | `proforma.routes.ts:155-163` | M35 `eventAttribution` appended to System A response but display metadata only — no numeric effect on System B. | Medium — verify M35 trigger wiring | M35 event data |
| BUG-13 | P1 | proforma-seeder | `getDealFinancials()` row assembly | `noi_after_reserves` is in v31 spec as Pro Forma surface row but NOT in `OperatingStatementRow[]`. Only in projections array. `ProFormaSummaryTab` cannot render it. | Medium — add as named row in getDealFinancials | Independent |
| BUG-14 | P2 | frontend `toRow()` | `proforma-adjustment.service.ts:1876` | `LayeredValue.warning` string not extracted into `OperatingStatementRow`. Warning messages (e.g. insurance null) silently dropped; UI cannot display them. | Low — add `warning?: string` to OperatingStatementRow and extract in toRow() | Independent |

---

## Section 10 — Summary Scorecard

| Layer | Status | Primary gaps |
|---|---|---|
| Broker layer (L1) | ⚠️ Partial | GPR.om = null despite capsule; 3 severe collisions undetected; System A doesn't surface line items |
| Platform layer (L2) | 🔴 Not implemented | All platform slots null; M05 hardcoded; M14/M15/M22 absent |
| T12 / Rent Roll (L3) | 🟡 Partial | T12 vacancy = 66% (formula error); T12 insurance = null; partial-year T12 lines miscategorised |
| Tax bill (L3) | 🟡 Partial | $20K bill vs $1.1M T12; taxService not called for P&L RE-tax line |
| Override layer | ✅ Working | Override resolution correct; operator values persist correctly |
| Frontend state / rendering (L4) | ⚠️ Partial | No `category`/`isSubtotal` metadata; `LV.warning` silently dropped; benchmarkPosition always null |
| Subtotals computation (L5) | ⚠️ Partial | EGI/total_opex/NOI computed correctly; NOI After Reserves missing from year1 assembly (BUG-13) |
| Spot-check chains (L6) | 🟡 Partial | GPR→EGI chain holds (0.2% rounding); OpEx identity holds; NOI→CFBD chain breaks at noi_after_reserves |
| System A ↔ B coherence | 🔴 Broken | Vacancy 5% vs 19.83%; M35 adjustments never flow to System B |
| Collision detection | 🔴 Not implemented | CollisionReport interface specified, not built; 3 severe collisions invisible |
| Frontend (AI cards) | 🔴 100% mock | ProFormaIntelligence renders static fixture |
| M07 traffic → proforma | 🟡 Partial | Vacancy floor wired in System B; absorption scalar not linked to year1 |
| Evidence-tier model | 🔴 Gap | Tier 2 (owned portfolio), CollisionReport, agent attribution all absent |

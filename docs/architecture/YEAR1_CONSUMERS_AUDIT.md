# deal_assumptions.year1 — Consumers Audit

**Scope:** Every code path that **reads** `deal_assumptions.year1` (any sub-key, any
layer slot — `om`, `t12`, `rent_roll`, `platform`, `override`, `resolved`).
**Out of scope:** writers, transitive consumers beyond one hop, fix work.
**Audited:** 2026-05-09

---

## Background — the data shape

`deal_assumptions.year1` is a JSONB column. At rest it is a
`ProFormaYear1Seed` object: one `LayeredValue<number>` per financial line.

```
year1 = {
  gpr:              { platform, t12, rent_roll, om, override, resolved, resolution },
  vacancy_pct:      { platform, t12, rent_roll, om, override, resolved, resolution },
  real_estate_tax:  { platform, t12, rent_roll, om, tax_bill, override, resolved, resolution },
  payroll:          { platform, t12, om, override, resolved, resolution },
  ...                                      (≈ 25 financial fields total)
  other_income_user_lines: [ { label, monthly, annual } ... ],
  _unit_count:      { resolved },          // metadata helper
}
```

Before the seed reaches any consumer it passes through one normalisation step
inside `getDealFinancials` / `financials-composer`:

Every `LayeredValue` is projected into an `OperatingStatementRow` (`OSRow`):

```ts
interface OSRow {
  field:       string           // snake_case key
  label:       string
  resolved:    number | null    // the winning value
  resolution:  string | null    // winning source name
  platform:    number | null
  t12:         number | null
  rent_roll:   number | null
  om:          number | null    // broker OM value
  override:    number | null
  t6, t3, t1: number | null    // trailing-actuals enrichment
}
```

Frontend components **never** query `deal_assumptions` directly. They receive
`DealFinancials.proforma.year1: OSRow[]` from the `/financials` API endpoint.

---

## Group A — Backend Service Paths

### A-1 · `backend/src/services/financials-composer.service.ts`

| | |
|---|---|
| **SQL** | `SELECT year1, source_type, source_date, updated_at FROM deal_assumptions WHERE deal_id = $1` (line 223) |
| **Retry read** | `SELECT year1 FROM deal_assumptions WHERE deal_id = $1 LIMIT 1` (line 235) — executed only when lazy-seed fires |
| **What is read** | Full `year1` JSONB object |
| **Slot access** | All slots of every field via `buildOSRows(year1Data, ...)`. Inside `buildOSRows`, each field's `platform`, `t12`, `rent_roll`, `om`, `override`, `resolved`, and `resolution` are mapped 1-to-1 onto the `OSRow` returned to callers. |
| **Downstream output** | Returns `proforma.year1: OSRow[]` inside the `DealFinancials` response. This is the **canonical source** for all frontend tabs and the export service. Also feeds `buildIntegrityChecks`, `buildUnitEconomics`, `buildValuationSnapshot`, `buildAssumptions`, `buildCapitalStack`. |
| **Broker-claims fallback** | **YES.** Also reads `deals.deal_data.broker_claims.proforma` and `deals.deal_data.extraction_om` independently. Those values are passed into `buildOSRows()` alongside `year1Data` so the `om` column in each `OSRow` is always populated from live `broker_claims.proforma` even when `year1.*.om` is null. The `om` slot in every `OSRow` comes from `brokerProforma`, NOT from `year1.gpr.om`. |

---

### A-2 · `backend/src/services/proforma-adjustment.service.ts` — `getDealFinancials`

| | |
|---|---|
| **SQL** | `SELECT year1, total_units, updated_at, exit_cap, rent_growth_yr1, rent_growth_stabilized, hold_period_years, interest_rate, ltv, avg_lease_term_months, per_year_overrides, ... FROM deal_assumptions WHERE deal_id = $1` (line 1740) |
| **What is read** | Full `year1` JSONB as `year1Seed: Record<string, unknown>` (line 1766) |
| **Slot access** | All slots for all fields via `lv(year1Seed, key)` → `resolvedNum()` / `layerNum()`. Specific multi-slot reads: |
| | — IC-01: `noi.resolved` **and** `noi.t12` (lines 1977-1979) |
| | — IC-02: `gpr.rent_roll` **and** `gpr.t12` (lines 1993-1995) |
| | — IC-04: `real_estate_tax.t12` **and** `real_estate_tax.tax_bill` (lines 2033-2035) |
| | — IC-03: `resolvedNum()` for 7 opex fields (lines 2013-2018) |
| | — GPR decomposition: `lv(year1Seed, 'gpr')` full LV (line 2186) |
| | — Tax comparison: `lv(year1Seed, 'real_estate_tax')` full LV (line 2561) |
| | — Replacement reserves: `lv(year1Seed, 'replacement_reserves')` (line 2705) |
| | — JEDI score seed: `ry1(k)` on all fields (line 3369) |
| | — Per-year pass 2: reads `*.override` + `*.resolution` for 8 Section-1/3 fields to surface user overrides into the projection grid (lines 2542-2548) |
| **Unit-mix mutation** | When `da:use_unit_mix_for_gpr` flag is set, `year1Seed.gpr` is mutated in-memory to inject a `unit_mix` layer and force `resolution = 'unit_mix'` before any downstream row is built (lines 1819-1826). |
| **Downstream output** | Returns `proforma: { year1: year1Rows, integrityChecks, unitEconomics, valuationSnapshot }` — the full `DealFinancials` contract consumed by all F9 tabs and the export service. |
| **Broker-claims fallback** | NO direct read. Broker-claims enrichment happened upstream in the composer; this function receives `year1Seed` from the DB. |

---

### A-3 · `backend/src/services/proforma-adjustment.service.ts` — `applyFinancialsOverride` readback

| | |
|---|---|
| **SQL** | `SELECT year1, per_year_overrides, total_units, avg_lease_term_months FROM deal_assumptions WHERE deal_id = $1` (line 4629) |
| **What is read** | `year1` immediately after `applyUserOverride` writes a new override slot |
| **Slot access** | `lv(seed, year1Key)` — reads the full `LayeredValue` for the just-overridden field and each derived field (`egi`, `noi`, `total_opex` when appropriate) (lines 4641-4652) |
| **Downstream output** | Returns `updatedCell` (LayeredValue JSON) and `affectedRows` back to the `PATCH /financials/override` response. Frontend refreshes that row's display from this payload — allows the cell to reflect the new resolution without a full page reload. |
| **Broker-claims fallback** | NO |

---

### A-4 · `backend/src/api/rest/deal-assumptions.routes.ts` — `mutateUserLines`

| | |
|---|---|
| **SQL** | `SELECT year1 FROM deal_assumptions WHERE deal_id = $1 FOR UPDATE` (line 1168) — row-locked for concurrent safety |
| **What is read** | `year1.other_income_user_lines` array (line 1182) |
| **Slot access** | Does **not** read any `LayeredValue` slots. Reads only the `other_income_user_lines` array of custom line objects `{ label, monthly, annual }`, mutates it (add / update / delete), then calls `recomputeDerived(year1)` which recalculates `other_income_per_unit`, `egi`, and `noi` derived fields within the seed before writing back. |
| **Downstream output** | Routes: `POST /user-lines` · `PATCH /user-lines/:id` · `DELETE /user-lines/:id`. Each returns `{ user_lines: [...], year1: <updated seed> }`. Frontend refreshes the Other Income sub-table from the response. |
| **Broker-claims fallback** | NO |

---

### A-5 · `backend/src/api/rest/inline-deals.routes.ts` — `GET /:dealId/proforma/year1`

| | |
|---|---|
| **SQL** | `SELECT year1, source_type, source_date, updated_at FROM deal_assumptions WHERE deal_id = $1` (line 1665) |
| **What is read** | Raw full `year1` JSONB — no transformation |
| **Slot access** | Returns the entire object as-is; caller sees all slots of all fields |
| **Downstream output** | Debug / raw-seed passthrough endpoint (`GET /api/v1/deals/:dealId/proforma/year1`). Returns `{ data: { year1, sourceType, seededAt, updatedAt } }`. No frontend tab calls this endpoint in production; used by diagnostic scripts and retrigger tooling. |
| **Broker-claims fallback** | NO |

---

### A-6 · `backend/src/services/proforma-seeder.service.ts` — `seedProFormaYear1` / `ensureDealAssumptionsSeeded` / `applyUserOverride`

| | |
|---|---|
| **SQL (seedProFormaYear1)** | `SELECT year1 FROM deal_assumptions WHERE deal_id = $1 LIMIT 1` (line 1043) |
| **SQL (ensureDealAssumptionsSeeded)** | `SELECT year1 FROM deal_assumptions WHERE deal_id = $1 LIMIT 1` (line 1127) |
| **SQL (applyUserOverride)** | `SELECT year1 FROM deal_assumptions WHERE deal_id = $1` (line 1170) |
| **What is read** | The existing seed, if any |
| **Slot access** | `ensureDealAssumptionsSeeded` reads only whether `year1 IS NOT NULL` to decide whether to skip re-seeding. `seedProFormaYear1` reads `*.override` + `*.resolution` for every field to extract user override layers before rebuilding the seed from extraction capsules — ensures a forceReseed does not clobber existing operator overrides. `applyUserOverride` reads the full seed, updates `field.override` and `field.resolved`, then writes back. |
| **Downstream output** | Writes (not consumed further). Listed here because the read precedes a write in the same transaction. |
| **Broker-claims fallback** | NO — broker_claims is read separately from `deals.deal_data` as an input to `buildSeed()`. |

---

### A-7 · `backend/src/services/financial-model-engine.service.ts` — `buildModel`

| | |
|---|---|
| **SQL** | `SELECT year1 FROM deal_assumptions WHERE deal_id = $1 LIMIT 1` (lines 606-607) |
| **What is read** | Full `year1` JSONB as `ProFormaYear1Seed` (line 610) |
| **Slot access** | Passes the entire seed to `buildEvidenceHintsFromSeed()`. Inside that function (see A-8), every field's `resolution`, `resolved`, and all source slots are read for source classification and collision detection. |
| **Downstream output** | `modelAssumptions._evidenceHints` and `modelAssumptions._collisionReport` — attached to the `ModelAssumptions` struct passed into `runModel()`. The deterministic model runner uses these to annotate each KPI's source/confidence in the model result returned to the F9 financial engine endpoint. |
| **Broker-claims fallback** | NO |

---

### A-8 · `backend/src/services/deterministic/proforma-assumptions-bridge.ts` — `buildEvidenceHintsFromSeed`

| | |
|---|---|
| **Input** | Receives `ProFormaYear1Seed` object from A-7 (not a DB read) |
| **What is read** | Named seed fields directly: `seed.noi`, `seed.gpr`, `seed.egi`, `seed.net_rental_income`, `seed.vacancy_pct`, `seed.loss_to_lease_pct`, `seed.concessions_pct`, `seed.bad_debt_pct`, `seed.other_income_per_unit`, `seed.real_estate_tax`, `seed.insurance`, `seed.management_fee_pct`, `seed.payroll`, `seed.repairs_maintenance`, `seed.utilities`, `seed.contract_services`, `seed.turnover`, `seed.g_and_a`, `seed.total_opex` (lines 137-158) |
| **Slot access** | For each field: reads `.resolution` to classify source/confidence. Then `detectCollisionsForField()` reads **all slots** (`platform`, `t12`, `rent_roll`, `om`, `tax_bill`, `override`, `resolved`) to detect cross-source disagreements. The `om` slot is therefore read here for collision detection even if it did not win the priority walk. |
| **Downstream output** | `{ hints: Record<field, { source, confidence, reasoning }>, collisions: CollisionEntry[] }` — embedded in the F9 model result under `_evidenceHints` / `_collisionReport`. Surfaced in the F9 Financial Engine's evidence panel and model run log. |
| **Broker-claims fallback** | NO — receives year1 seed only |

---

## Group B — Frontend Display Paths

All frontend components receive `DealFinancials.proforma.year1: OSRow[]` from the
`GET /api/v1/deals/:dealId/financials` API response. No frontend component issues
its own SQL. The `OSRow.om` field is the broker-OM value; it is populated by the
composer from `broker_claims.proforma`, not from `year1.*.om` in the seed.

---

### B-1 · `frontend/src/pages/development/financial-engine/ProFormaSummaryTab.tsx`

| | |
|---|---|
| **Access** | `const rows = data.proforma.year1` (line 613); `data.proforma.year1.find(r => r.field === 'concessions')` (line 430) |
| **Slots read** | **All four source columns** for every row: `row.om` · `row.t12` · `row.rent_roll` · `row.resolved`. Also `breakdown.total.om`, `.t12`, `.rent_roll` for the Other Income aggregate row (lines 1150-1159). Subtotal rows aggregate `broker`, `t12`, `platform` across grouped rows (lines 668-678). |
| **Downstream output** | F9 Pro Forma Summary tab — the four-column operating statement table. Columns: **Broker** (`row.om`) · **T-12** (`row.t12`) · **Rent Roll** (`row.rent_roll`) · **Resolved** (`row.resolved`). The `BROKER_VIEW` mode hides T-12 and Rent Roll columns, showing only `om` and `resolved`. |
| **Broker-claims fallback** | NO additional — `row.om` is the broker value already embedded in the OSRow by the composer |

---

### B-2 · `frontend/src/pages/development/financial-engine/ProjectionsTab.tsx`

| | |
|---|---|
| **Access** | `const pf1 = financials.proforma?.year1 ?? []` (line 1150); `const pfRow = (key) => pf1.find(r => r.field === key) ?? null` (line 1151) |
| **Slots read** | `pfRow(key)?.resolved` — primary source for every field's year-1 baseline. `pfRow(key)?.platform` — used as a peer-set fallback when no historical data exists. No direct read of `.om`, `.t12`, or `.rent_roll`. |
| **Downstream output** | Projections engine — year-1 seed values (resolved) for all revenue and expense lines. Projected forward by applying per-year growth rates for each of the hold years. Also drives confidence weights and peer-set comparison column. |
| **Broker-claims fallback** | NO |

---

### B-3 · `frontend/src/pages/development/financial-engine/ProjectionsHubTab.tsx`

| | |
|---|---|
| **Access** | `f9Financials.proforma?.year1?.find(r => r.field === 'gpr')` (line 110) |
| **Slots read** | `gprRow.resolved` only |
| **Downstream output** | Regime classifier banner (LEASE_UP / OCCUPANCY_RECOVERY / STABILIZED_MAINTENANCE). When `gpr.resolved` is available, derives implied market rent: `gpr.resolved / totalUnits / 12`. Displayed in the Projections Hub header and used to auto-populate the market-rent input. |
| **Broker-claims fallback** | NO |

---

### B-4 · `frontend/src/pages/development/financial-engine/OverviewTab.tsx`

| | |
|---|---|
| **Access** | `f9Financials?.proforma?.year1?.find(r => r.field === 'noi')?.resolved` (line 46) |
| **Slots read** | `noi.resolved` only |
| **Downstream output** | F9 Overview tab — going-in cap rate: `noi.resolved / purchasePrice`. Displayed in the Deal Overview KPI strip. |
| **Broker-claims fallback** | NO |

---

### B-5 · `frontend/src/pages/development/financial-engine/AssumptionsTab.tsx`

| | |
|---|---|
| **Access** | `y1(f, field)` helper → `f.proforma.year1.find(r => r.field === field)` (line 206); `const year1 = financials.proforma.year1` (line 1950); `year1.find(r => r.field === field)` (lines 1953, 1961) |
| **Slots read** | All slots: `resolved`, `resolution`, `platform`, `t12`, `rent_roll`, `om`, `override`, `t6`, `t3`, `t1`. The `buildRowDef()` function maps all of them into a `RowDef` displayed in the editable assumptions grid. Additionally reads `noi.platform` and `egi.platform` for the NOI identity cross-check (line 2388-2390). |
| **Downstream output** | F9 Assumptions tab — Sections 5 (Revenue) and 6 (Operating Expenses) editable row grids. Each cell shows resolved value; hovering or expanding reveals source breakdown. User edits enqueue a `PATCH /financials/override` call that writes back to `year1.*.override`. |
| **Broker-claims fallback** | NO |

---

### B-6 · `frontend/src/pages/development/FinancialEnginePage.tsx`

| | |
|---|---|
| **Access** | `ff.proforma.year1.find(r => r.field === field)?.resolved` via `getY1()` helper (line 812) |
| **Slots read** | `resolved` only, for any field name passed to `getY1()`. Used to extract NOI, GPR, and related KPIs. |
| **Downstream output** | Builds the summary payload sent to the **Cashflow Agent** when the user clicks "Run AI Analysis". The `getY1()` values are folded into the agent input context alongside capital stack and assumptions. This is the bridge between the frontend financial data and the AI agent tier. |
| **Broker-claims fallback** | NO |

---

## Group C — Agent / AI Consumers

### C-1 · `backend/src/agents/tools/fetch_assumptions.ts`

| | |
|---|---|
| **SQL** | Joins `deals` and `deal_assumptions`; selects `da.year1` among other scalar columns (line 95) |
| **What is read** | `year1` JSONB parsed into `Record<string, unknown>` (lines 116-119) |
| **Slot access** | Reads via `y1Val(year1, field)` helper which extracts `.resolved` from each `LayeredValue`: |
| | — `year1.vacancy_pct.resolved` → converted from decimal to percentage |
| | — `year1.management_fee_pct.resolved` → converted from decimal to percentage |
| | — `year1._unit_count.resolved` → unit count fallback |
| **Downstream output** | **Cashflow Agent tool input.** Returns structured assumptions JSON to the LLM (vacancy %, mgmt fee %, units, hold period, etc.) so the agent can perform deal analysis without recomputing from raw capsules. |
| **Broker-claims fallback** | **YES.** Falls back to `da.vacancy_pct` (legacy scalar column) when `year1.vacancy_pct.resolved` is null. Falls back to `da.management_fee_pct` legacy column for mgmt fee. |

---

### C-2 · `backend/src/services/financial-model-engine.service.ts` / `proforma-assumptions-bridge.ts` *(see A-7, A-8)*

Evidence hints from `year1` feed the deterministic model runner which produces KPI
annotations (`noiSource`, `confidence`) embedded in the model result returned to
the AI coordinator. The LLM agent receives these annotations as structured context.
`buildEvidenceHintsFromSeed` reads all slots including `.om` via
`detectCollisionsForField` — the `om` slot surfaces in collision warnings when the
broker OM value diverges materially from T-12 or rent-roll data.

---

## Group D — Export / Snapshot Paths

### D-1 · `backend/src/services/f9-financial-export.service.ts` — `buildProjectionsForExport` / `buildF9Workbook`

| | |
|---|---|
| **Input** | Receives `DealFinancials` object (not a DB read — data was already loaded by the `getDealFinancials` caller) |
| **What is read** | `proforma.year1.find(r => r.field === field)` via local `y1()` helper (line 42) |
| **Slots read** | `row.resolved ?? row.platform` for every field (line 43). Specifically reads: `gpr`, `loss_to_lease_pct`, `concessions_pct`, `bad_debt_pct`, `non_revenue_units_pct`, `other_income_per_unit`, `management_fee_pct`, `payroll`, `repairs_maintenance`, `turnover`, `contract_services`, `marketing`, `utilities`, `g_and_a`, `insurance`, `real_estate_tax`, `replacement_reserves`, `capex` (lines 63-97). Does **not** read `.om` directly. The comment at line 89 notes that `capex.resolved` may have been sourced from the OM layer, but the code reads `resolved`, not `om`. |
| **Downstream output** | **Excel workbook export** (`.xlsx`). Seeds Year-1 values across a `holdYears`-column projection sheet: Pro Forma · Traffic Projection · Assumptions tabs. |
| **Broker-claims fallback** | NO — reads from `OSRow.resolved` which may itself have been resolved from an OM-sourced value upstream |

---

## Summary matrix — which slots each consumer reads

| Consumer | `resolved` | `platform` | `t12` | `rent_roll` | `om` | `tax_bill` | `override` | `resolution` |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| A-1 financials-composer (buildOSRows) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| A-2 getDealFinancials (IC checks) | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ |
| A-3 applyFinancialsOverride readback | ✓ | — | — | — | — | — | ✓ | ✓ |
| A-4 mutateUserLines | — | — | — | — | — | — | — | — (reads `other_income_user_lines` only) |
| A-5 inline raw passthrough | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| A-6 seeder override preservation | — | — | — | — | — | — | ✓ | ✓ |
| A-7 financial-model-engine | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| A-8 proforma-assumptions-bridge | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| B-1 ProFormaSummaryTab | ✓ | ✓ | ✓ | ✓ | **✓ (direct render)** | — | — | — |
| B-2 ProjectionsTab | ✓ | ✓ | — | — | — | — | — | — |
| B-3 ProjectionsHubTab | ✓ | — | — | — | — | — | — | — |
| B-4 OverviewTab | ✓ | — | — | — | — | — | — | — |
| B-5 AssumptionsTab | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ |
| B-6 FinancialEnginePage | ✓ | — | — | — | — | — | — | — |
| C-1 fetch_assumptions (agent tool) | ✓ | — | — | — | — | — | — | — |
| D-1 f9-financial-export | ✓ | ✓ | — | — | — | — | — | — |

---

## Key finding — the `.om` slot specifically

The `.om` slot in `year1` is **populated by the seeder** from
`deals.deal_data.broker_claims.proforma.*` (e.g. `stabilizedGpr`, `payrollAnnual`,
`realEstateTaxAnnual`, `contractServicesAnnual`). It is:

- **Stored** in the JSONB seed but does **not** appear in `FIELD_PRIORITIES` for
  most revenue fields (`gpr`, `vacancy_pct`), meaning `.resolved` is typically set
  from `t12` or `rent_roll` — not from `.om` — even when `.om` is populated.
- **Directly rendered** by exactly **one** consumer: `ProFormaSummaryTab` renders
  `row.om` as the **Broker** column (line 1052). This is the only place a user sees
  the raw OM value side-by-side with other sources.
- **Read for collision detection** by `proforma-assumptions-bridge.ts`
  (`buildEvidenceHintsFromSeed` → `detectCollisionsForField`), which compares all
  active slots to flag cross-source disagreements.
- **Ignored** by all other consumers, which read only `resolved` (or `platform` as
  fallback). The export service, projections engine, agent tools, and overview KPIs
  all read `resolved`, which may have been sourced from `om` only for fields where
  `FIELD_PRIORITIES` includes `'om'` (e.g. `other_income`).
- **Independent of the display path**: `financials-composer` populates `OSRow.om`
  from live `broker_claims.proforma`, not from `year1.*.om`. If the seeder's
  `year1.gpr.om` is null but `broker_claims.proforma.stabilizedGpr` is populated,
  the Broker column still shows the correct value in the UI.

---

## Files referenced

| File | Role |
|---|---|
| `backend/src/services/financials-composer.service.ts` | Primary DB reader; builds OSRow[] from year1 |
| `backend/src/services/proforma-adjustment.service.ts` | getDealFinancials (full assembly); applyFinancialsOverride readback |
| `backend/src/api/rest/deal-assumptions.routes.ts` | mutateUserLines CRUD; PATCH override controller |
| `backend/src/api/rest/inline-deals.routes.ts` | Raw passthrough endpoint |
| `backend/src/services/proforma-seeder.service.ts` | Override-preservation read before re-seed; applyUserOverride |
| `backend/src/services/financial-model-engine.service.ts` | Evidence hints read for deterministic model |
| `backend/src/services/deterministic/proforma-assumptions-bridge.ts` | buildEvidenceHintsFromSeed; all-slot collision scan |
| `backend/src/agents/tools/fetch_assumptions.ts` | Cashflow Agent tool; reads vacancy_pct + mgmt_fee_pct resolved |
| `backend/src/services/f9-financial-export.service.ts` | Excel export; reads resolved+platform via y1() |
| `frontend/src/pages/development/financial-engine/ProFormaSummaryTab.tsx` | Renders om, t12, rent_roll, resolved columns |
| `frontend/src/pages/development/financial-engine/ProjectionsTab.tsx` | Reads resolved+platform as projection baseline |
| `frontend/src/pages/development/financial-engine/ProjectionsHubTab.tsx` | Reads gpr.resolved for regime classifier |
| `frontend/src/pages/development/financial-engine/OverviewTab.tsx` | Reads noi.resolved for cap rate KPI |
| `frontend/src/pages/development/financial-engine/AssumptionsTab.tsx` | Reads all slots for editable assumptions grid |
| `frontend/src/pages/development/FinancialEnginePage.tsx` | Reads resolved for AI agent payload |

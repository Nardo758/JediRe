# OM Extraction Coverage Audit — 464 Bishop

**Audit type:** Read-only gap analysis. No code changes.
**Deal:** 464 Bishop Street, Atlanta GA — 232 units
**Deal ID:** `3f32276f-aacd-4da3-b306-317c5109b403`
**Document:** 464 Bishop - Offering Memorandum.pdf (94 pages, Cushman & Wakefield)
**Parser confidence score:** 0.35–0.36 (low; OCR not triggered — text layer present)
**Audit date:** 2026-05-09

---

## 1. Source Data Inventory

Two separate OM data stores exist for this deal. Understanding which one drives the Pro Forma display is essential to gap classification.

| Store | Table / Column | Written by | Last updated | Purpose |
|---|---|---|---|---|
| **Store A** | `data_library_files.om_extraction` | `om-parser.ts` → `data-library.service.ts` | 2026-04-26 (multiple runs) | Permanent archive per uploaded file; seeded before expense-line schema existed |
| **Store B** | `deal_data.broker_claims` | `data-router.ts routeOM()` | 2026-05-03 | Live deal capsule; re-extracted after expense-line fields were added to the prompt |

**The Pro Forma display (financials-composer) reads exclusively from Store B.**
`financials-composer.service.ts:217-218` reads `dealData.broker_claims.proforma` for all broker column values.

Store A (data_library_files) is used only by legacy tooling and backfill scripts — it is not consulted at render time.

---

## 2. Claude Prompt Schema vs Actual Extraction

### 2a. `brokerProforma` block — what the Claude prompt asks for

The prompt at `om-parser.ts:312–342` defines the following fields and their extraction instructions.

| Prompt field | Instruction summary | Store A value (2026-04-26) | Store B value (2026-05-03) |
|---|---|---|---|
| `stabilizedVacancy` | Decimal, e.g. 0.05 = 5% | **0.05** | **0.05** |
| `lossToLease` | Decimal or null | **0** | **0** |
| `concessionsPct` | Decimal or null | **0** | **0** |
| `badDebtPct` | Decimal or null | null | null |
| `rentGrowthY1` | Decimal or null | null | null |
| `rentGrowthY2` | Decimal or null | null | null |
| `rentGrowthY3` | Decimal or null | null | null |
| `rentGrowthY4` | Decimal or null | null | null |
| `rentGrowthY5` | Decimal or null | null | null |
| `opexGrowth` | Decimal or null | null | null |
| `managementFeePct` | Decimal or null | **0.0275** | **0.0275** |
| `replacementReservesPerUnit` | Number or null | **200** | **200** |
| `exitCapRate` | Decimal or null | null | null |
| `holdPeriodYears` | Number or null | null | null |
| `goingInCapRate` | Decimal or null | null | null |
| `targetIRR` | Decimal or null | null | null |
| `stabilizedNOI` | Number or null | **2,999,564** | **2,999,564** |
| `yearOneNOI` | Number or null | null | null |
| `payrollAnnual` | Annual payroll from pro-forma | *(field absent — pre-schema)* | **324,800** |
| `insuranceAnnual` | Annual insurance | *(field absent — pre-schema)* | **46,400** |
| `utilitiesAnnual` | Annual utilities (combined) | *(field absent — pre-schema)* | **187,094** |
| `repairsMaintenanceAnnual` | Annual R&M | *(field absent — pre-schema)* | **69,600** |
| `turnoverAnnual` | Annual turnover/make-ready | *(field absent — pre-schema)* | **41,760** |
| `marketingAnnual` | Annual marketing & leasing | *(field absent — pre-schema)* | **69,600** |
| `gAndAAnnual` | Annual G&A / administrative | *(field absent — pre-schema)* | **69,600** |
| `contractServicesAnnual` | Annual contract services | *(field absent — pre-schema)* | **28,680** |
| `realEstateTaxesAnnual` | Annual real estate taxes | *(field absent — pre-schema)* | **977,287** |
| `totalOpexAnnual` | Total annual opex | *(field absent — pre-schema)* | **1,998,673** |

### 2b. Fields in Store B but NOT in the Claude prompt schema

The 2026-05-03 re-extraction returned additional fields that the LLM added unprompted. These passed through `routeOM()` verbatim (data-router stores `data.brokerProforma` as a raw object — no stripping). The TypeScript `OMBrokerProforma` interface does not define these fields, creating a schema-lag condition.

| Extra field in Store B | Value | Status |
|---|---|---|
| `stabilizedGpr` | **4,901,400** | Not in `OMBrokerProforma` interface; not in prompt schema |
| `stabilizedEgi` | **4,998,237** | Not in `OMBrokerProforma` interface; not in prompt schema |
| `stabilizedOtherIncomeAnnual` | **341,907** | Not in `OMBrokerProforma` interface; not in prompt schema |

These values are correct (Claude extracted them from the OM's stabilized pro forma income statement), but they are undeclared extras.

### 2c. `otherIncome` block — per-category monthly income

The prompt at `om-parser.ts:401–411` asks for per-category monthly ancillary income. This data is stored in `deal_data.extraction_om.other_income_monthly` (not in broker_claims.proforma).

| Category | Value in extraction_om | Notes |
|---|---|---|
| `parking` | null | Not separately disclosed in OM |
| `pet` | null | Not separately disclosed |
| `storage` | null | Not separately disclosed |
| `laundry` | null | Not separately disclosed |
| `rubs` | null | Not separately disclosed |
| `fees` | null | Not separately disclosed |
| `insurance_admin` | null | Not separately disclosed |
| `other` | null or sum | Aggregate other income route |

The OM discloses `stabilizedOtherIncomeAnnual = $341,907` as a single line (no per-category breakdown). The seeder routes this correctly into `other_income_total` via `bpOtherIncomeAnnual` in financials-composer:1467-1471.

---

## 3. Pro Forma Display Coverage — Row-by-Row

The table below maps each Pro Forma display row to its broker column value as rendered by `financials-composer.service.ts`. Gap codes are defined in §4.

### 3a. Revenue rows

| Pro Forma row | Field key | Broker column value | Gap code | Notes |
|---|---|---|---|---|
| Gross Potential Rent | `gpr` | **$4,901,400** | SCHEMA_LAG | `stabilizedGpr` is in Store B but not in `OMBrokerProforma` interface; financials-composer reads it at line 1454 via `brokerProforma?.stabilizedGpr`; works today because Store B is untyped at runtime |
| Vacancy Loss | `vacancy_loss` | **$245,070** (5% × GPR) | POPULATED | `stabilizedVacancy = 0.05`; derived as `bpVacPct × bpGpr` |
| Loss to Lease | `loss_to_lease` | **$0** | POPULATED (ZERO) | `lossToLease = 0`; renders as $0 in broker column — correct per OM |
| Concessions | `concessions` | **$0** | POPULATED (ZERO) | `concessionsPct = 0`; correct per OM |
| Bad Debt / Collection Loss | `bad_debt` | null | PARSER_FOUND_NULL | `badDebtPct` is in schema; Claude returned null; bishop OM does not publish a bad debt line in its stabilized pro forma |
| Non-Revenue Units | `non_revenue_units` | null | NOT_IN_OM | `OMBrokerProforma` has no NRU field; Bishop OM does not disclose NRU separately |
| Net Rental Income | `net_rental_income` | **$4,656,330** (derived) | POPULATED | Computed as `bpGpr - bpVacLoss - bpLtlDol - bpConcDol`; not stored as a standalone field |
| Other Income | `other_income` | **$341,907** | SCHEMA_LAG | `stabilizedOtherIncomeAnnual` is in Store B but not in interface; financials-composer reads it at line 1467 via `brokerProforma?.stabilizedOtherIncomeAnnual`; works today |
| Effective Gross Income | `egi` | **$4,998,237** (derived) | POPULATED | Computed as `bpNri + bpOtherIncomeAnnual`; also matches `stabilizedEgi = 4,998,237` (Store B) |

### 3b. Expense rows

| Pro Forma row | Field key | Broker column value | Gap code | Notes |
|---|---|---|---|---|
| Payroll / Personnel | `payroll` | **$324,800** | POPULATED | `payrollAnnual = 324800` in Store B; wired at composer:1500 and seeder bpPayroll |
| Repairs & Maintenance | `repairs_maintenance` | **$69,600** | POPULATED | `repairsMaintenanceAnnual = 69600` |
| Turnover / Make-Ready | `turnover` | **$41,760** | POPULATED | `turnoverAnnual = 41760` |
| Contract Services | `contract_services` | **$28,680** | POPULATED (DISPLAY) / SEEDER_GAP | financials-composer:1507 reads it correctly → broker=$28,680; **but** `proforma-seeder.service.ts:695` passes no `omVal` to `opexFromT12('contract', ...)` → `year1.contract_services.om = null` in the JSONB seed |
| Marketing & Leasing | `marketing` | **$69,600** | POPULATED | `marketingAnnual = 69600` |
| Utilities (combined) | `utilities` | **$187,094** | POPULATED | `utilitiesAnnual = 187094`; OM provides a single combined utilities line only |
| Water & Sewer | `water_sewer` | null | NOT_IN_OM | OM does not break out individual utility sub-lines; only combined utilities disclosed |
| Electric | `electric` | null | NOT_IN_OM | Same — combined utilities only |
| Gas / Fuel | `gas_fuel` | null | NOT_IN_OM | Same — combined utilities only |
| Landscaping / Grounds | `landscaping` | null | NOT_IN_OM | Not a separate OM line; likely rolled into Contract Services or R&M by broker |
| G&A / Administrative | `g_and_a` | **$69,600** | POPULATED | `gAndAAnnual = 69600` |
| Management Fee | `management_fee` | **$137,451** | POPULATED | Derived as `bpMgmtPct × bpEgi = 0.0275 × $4,998,237` |
| Insurance | `insurance` | **$46,400** | POPULATED | `insuranceAnnual = 46400` |
| Real Estate Taxes | `real_estate_taxes` | **$977,287** | POPULATED (DISPLAY) / SEEDER_GAP | financials-composer:1508 reads `realEstateTaxesAnnual` into `bpExpense['real_estate_taxes']` correctly → broker=$977,287; **but** `proforma-seeder.service.ts` has no `bpTax` variable → `year1.real_estate_tax.om = null` in JSONB seed |
| Replacement Reserves | `replacement_reserves` | **$46,400** | POPULATED | `replacementReservesPerUnit = 200`; scaled to 232 units = $46,400 |
| Amenities | `amenities` | null | NOT_IN_OM | Not in `OMBrokerProforma` schema; Bishop OM does not publish a standalone amenities opex line |
| Office | `office` | null | NOT_IN_OM | Not in schema; not in OM |
| HOA Dues | `hoa_dues` | null | NOT_IN_OM | Not in schema; not in OM |
| Personal Property Tax | `personal_property_tax` | null | NOT_IN_OM | Not in schema; not in OM |

### 3c. Subtotal / bottom-line rows

| Pro Forma row | Broker column value | Gap code | Notes |
|---|---|---|---|
| Total Operating Expenses | **$1,998,673** | POPULATED | `totalOpexAnnual = 1998673` in Store B; `bpTotalOpex` at composer:1511 |
| Net Operating Income | **$2,999,564** | POPULATED | `stabilizedNOI = 2999564`; `bpNOI` = yearOneNOI ?? stabilizedNOI |

### 3d. Return / assumption rows (not Pro Forma display rows — used elsewhere)

| Field | Extracted value | Notes |
|---|---|---|
| Going-in cap rate | null | Not in Bishop OM |
| Exit cap rate | null | Not in Bishop OM |
| Target IRR | null | Not in Bishop OM |
| Hold period years | null | Not in Bishop OM |
| Rent growth Y1–Y5 | null (all) | Not disclosed in OM |
| Opex growth | null | Not disclosed in OM |

---

## 4. Gap Code Definitions

| Code | Meaning |
|---|---|
| **POPULATED** | Extracted, wired, and showing a non-null value in the broker column |
| **POPULATED (ZERO)** | Extracted and wired; the value is legitimately $0 per the OM |
| **PARSER_FOUND_NULL** | Field is in the Claude prompt schema; LLM returned null because the value does not appear in the OM document |
| **NOT_IN_OM** | The OM document does not publish this line at all; no extraction gap — structural absence |
| **SCHEMA_LAG** | Value is correctly in Store B (broker_claims.proforma) and correctly read by financials-composer at runtime, but is not declared in the `OMBrokerProforma` TypeScript interface or Claude prompt schema — the interface has not caught up with the live prompt |
| **SEEDER_GAP** | Value is in Store B and displays correctly via financials-composer, but the proforma-seeder does not wire it into the `year1.FIELD.om` JSONB slot — `om` remains null in the stored seed |

---

## 5. Seeder JSONB Gaps (year1.FIELD.om vs display)

The financials-composer reads broker_claims.proforma directly at render time, so the Pro Forma display is correct. However, the proforma-seeder.service.ts writes a `year1` JSONB snapshot into `deal_assumptions.year1`. Some `om` slots in that snapshot are null even though the data exists in Store B. This matters for any code that reads the JSONB snapshot directly rather than going through the composer.

| year1 JSONB field | `.om` slot value | Root cause | Seeder location |
|---|---|---|---|
| `gpr.om` | **null** | No `bpGpr` variable in seeder; `stabilizedGpr` is a schema-lag extra field that the seeder has no knowledge of | seeder:447–465 — no `bpGpr = bpNum('stabilizedGpr')` |
| `contract_services.om` | **null** | `opexFromT12('contract', 'contract_services', ...)` at seeder:695 — fourth arg `omVal` is omitted (undefined → treated as null) | seeder:695 — `contractServicesAnnual` not read into a bp* var |
| `real_estate_tax.om` | **null** | No `bpTax` variable; no `opexFromT12('real_estate_taxes', 'real_estate_tax', ..., bpTax)` call | seeder:691–713 — `realEstateTaxesAnnual` not read |
| `other_income_per_unit.om` | **~$307.76/unit** | POPULATED — `stabilizedOtherIncomeAnnual` is wired via a separate code path in the seeder; see seeder:557–568 | Correct |
| `noi.om` | **$2,999,564** | POPULATED — `bpNOI = bpNum('yearOneNOI') ?? bpNum('stabilizedNOI')` | Correct |

**Seeder gaps are latent, not active display bugs.** The ProFormaSummaryTab goes through financials-composer which rebuilds broker values from Store B at request time, bypassing the stale `om` slots.

---

## 6. Findings Summary

### F-1 — Three undeclared schema-lag fields (SCHEMA_LAG)
**Severity:** Medium  
`stabilizedGpr`, `stabilizedEgi`, and `stabilizedOtherIncomeAnnual` exist in `deal_data.broker_claims.proforma` (Store B) and are correctly used by financials-composer to populate the GPR, EGI, and Other Income broker columns. However, they are not declared in the `OMBrokerProforma` TypeScript interface (`om-parser.ts:87–117`) nor in the Claude prompt schema (`om-parser.ts:312–342`). This is a type-safety and maintainability risk: any future typed access to `brokerProforma` will silently drop these fields, and new re-extractions on OM documents that are re-parsed through the typed path will strip them.

**Root cause:** The OM was re-extracted on 2026-05-03 with an updated LLM prompt that instructed Claude to return GPR, EGI, and other income total; the parser's TypeScript interface and Claude prompt schema were not updated to match.

---

### F-2 — Two seeder wiring gaps (SEEDER_GAP)
**Severity:** Low (no active display impact)  
`contractServicesAnnual` ($28,680) and `realEstateTaxesAnnual` ($977,287) are correctly in Store B and display correctly in the broker column via financials-composer. The seeder does not wire either into the corresponding `year1.*.om` JSONB slot, leaving those slots null. Any consumer reading the raw JSONB snapshot would see null where the OM data exists.

**Root cause for contract_services:** `proforma-seeder.service.ts:695` calls `opexFromT12('contract', 'contract_services', platformOpEx(...))` with only three arguments; the fourth `omVal` parameter is missing, so `om: null` in the resolve call.

**Root cause for real_estate_tax:** No `bpTax = bpNum('realEstateTaxesAnnual')` variable is declared in the seeder's broker proforma block (lines 447–465); no `opexFromT12('real_estate_taxes', 'real_estate_tax', ..., bpTax)` call exists.

---

### F-3 — GPR seeder gap (SEEDER_GAP + SCHEMA_LAG)
**Severity:** Low (no active display impact)  
`year1.gpr.om = null` because `stabilizedGpr` is not in the `OMBrokerProforma` interface and the seeder has no `bpGpr` variable. The display is correct because financials-composer reads `stabilizedGpr` directly from the untyped broker_claims.proforma at runtime.

---

### F-4 — Bad debt not in OM (PARSER_FOUND_NULL)
**Severity:** Informational  
`badDebtPct` is in the parser schema and prompt. Claude returned null. This is expected — broker OMs rarely disclose bad debt assumptions in the stabilized pro forma. No fix needed; the platform default fills the display value.

---

### F-5 — Utility sub-lines legitimately absent (NOT_IN_OM)
**Severity:** Informational  
Water & Sewer, Electric, Gas/Fuel are absent from the broker column because the 464 Bishop OM discloses only a combined utilities total ($187,094/yr). These sub-lines are not in the `OMBrokerProforma` schema and will not be populated for any OM that follows the typical broker pro forma format of a single utilities line.

---

### F-6 — Return assumptions not in OM (PARSER_FOUND_NULL)
**Severity:** Informational  
Going-in cap rate, exit cap rate, target IRR, hold period, rent growth Y1–Y5, and opex growth all returned null. Cushman & Wakefield's 464 Bishop OM does not publish explicit return assumptions in its pro forma; the financial analysis is pitched as a "price guidance TBD / call for offers" format. No fix needed.

---

## 7. Recommended Fixes (for a follow-on implementation ticket)

| Priority | Fix | Files |
|---|---|---|
| P1 | Add `stabilizedGpr`, `stabilizedEgi`, `stabilizedOtherIncomeAnnual` to `OMBrokerProforma` TypeScript interface and Claude prompt schema | `om-parser.ts:87–117`, `om-parser.ts:312–342` |
| P2 | Wire `bpTax = bpNum('realEstateTaxesAnnual')` into seeder and pass as 4th arg to `opexFromT12('real_estate_taxes', 'real_estate_tax', ..., bpTax)` | `proforma-seeder.service.ts:447–465, 695–713` |
| P3 | Wire `bpContract = bpNum('contractServicesAnnual')` into seeder and pass as 4th arg to `opexFromT12('contract', 'contract_services', ..., bpContract)` | `proforma-seeder.service.ts:447–465, 695` |
| P4 | Wire `bpGpr = bpNum('stabilizedGpr')` into seeder and pass as `om:` in `gpr` resolve call | `proforma-seeder.service.ts:447–465` (after P1 adds the field to the interface) |

P1 is prerequisite to P4 because once the field is declared in the typed interface, future re-extractions that go through the validator will include it.

P2 and P3 are independent of P1.

---

## 8. Data Cross-Check — Bishop OM vs Extracted Numbers

| Line | OM Source | Extracted | Match? |
|---|---|---|---|
| Stabilized Vacancy | Explicitly stated as 5.0% | 5.0% | ✓ |
| Loss to Lease | Explicitly $0 (at-market rent) | $0 | ✓ |
| Concessions | Explicitly $0 | $0 | ✓ |
| GPR | Pro forma income statement | $4,901,400 | ✓ |
| Other Income | Pro forma income statement | $341,907 | ✓ |
| EGI | Pro forma income statement | $4,998,237 | ✓ |
| Payroll | Detailed opex schedule | $324,800 | ✓ |
| R&M | Detailed opex schedule | $69,600 | ✓ |
| Turnover | Detailed opex schedule | $41,760 | ✓ |
| Contract Services | Detailed opex schedule | $28,680 | ✓ |
| Marketing | Detailed opex schedule | $69,600 | ✓ |
| G&A | Detailed opex schedule | $69,600 | ✓ |
| Utilities (combined) | Detailed opex schedule | $187,094 | ✓ |
| Insurance | Detailed opex schedule | $46,400 | ✓ |
| Real Estate Taxes | Detailed opex schedule | $977,287 | ✓ |
| Management Fee | 2.75% of EGI stated | 2.75% | ✓ |
| Replacement Reserves | $200/unit stated | $200/unit | ✓ |
| Total OpEx | Pro forma subtotal | $1,998,673 | ✓ |
| Stabilized NOI | Pro forma bottom line | $2,999,564 | ✓ |
| Management Fee % | Footnote / assumption table | 0.0275 | ✓ |
| Bad Debt | Not disclosed | null | ✓ (absent) |
| Exit Cap Rate | Not disclosed | null | ✓ (absent) |
| Rent Growth | Not disclosed | null | ✓ (absent) |

All disclosed numbers check out. Claude's extraction is accurate for the fields the OM publishes. The 0.35 confidence score reflects the OM's dense multi-column layout (not extraction errors) — the numeric extractions are clean.

---

*Audit performed by JEDI RE agent — 2026-05-09. Read-only; no code was modified.*

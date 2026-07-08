# SOURCE-TO-CAPSULE PIPELINE AUDIT

**Date:** 2026-07-08  
**Type:** Read-only audit — no fixes applied  
**Standing rules:** S1-01 file:line evidence throughout; per-hop verdict is WORKS / STUB / MOCK-INTERCEPTED / BROKEN  
**Scope:** Full create→upload→extract→render pipeline: Parts A (create), B (upload/extraction), C (OM), D (multi-year history), E (mock sweep)

---

## PART A — CREATE FLOW (platform_underwritten origin)

### A1. Entry Points per Surface

**Surface 1 — Chat / Telegram (revenue launch path)**

| Item | Detail | File:Line |
|---|---|---|
| Webhook handler | `handleTelegram()` → Telegram webhook receiver | `backend/src/services/chat/messageRouter.ts:53` |
| Intent routing | `UnifiedOrchestrator` + LLM `IntentClassifier` | `backend/src/services/orchestrator/unified-orchestrator.ts` |
| Structured commands | `dispatchAction()` — `ocl:<actionId>:<resourceId>` callbacks | `backend/src/services/notifications/openclaw-actions.ts:60` |
| Deal-creation agent tool | `create_deal_draft.ts:48` — creates draft with `email_intake` origin | `backend/src/agents/tools/create_deal_draft.ts:48` |
| Minimum input | Address (free text) or `ocl` action command | — |
| `platform_underwritten` assigned | **NO** — origin is `email_intake` / `prospect` | — |

**Surface 2 — Bloomberg Web App**

| Item | Detail | File:Line |
|---|---|---|
| REST endpoint | `POST /api/v1/deals` | — |
| Controller | `DealsController.create` | `backend/src/deals/deals.controller.ts:27` |
| Service | `DealsService.create` | `backend/src/deals/deals.service.ts:21` |
| Minimum input | `name`, `boundary` (GeoJSON polygon), `projectType` | `backend/src/deals/deals.service.ts:54-81` |
| `platform_underwritten` assigned | **NO** — `origin_class` is not a column in the deals INSERT | `backend/src/deals/deals.service.ts:59-82` |

**`origin_class` / `platform_underwritten` status:** `origin_class` is a fixture-only concept (`golden.types.ts:67`, `highlands.golden.ts:166`). The live `deals` INSERT (`deals.service.ts:59-82`) contains no `origin_class` column. The live code branches on `deal_archetype` (`proforma.routes.ts:209`). Architecture descriptions of a `platform_underwritten` lane have **no live DB backing.**

---

### A2. Assembly Chain (per-hop verdicts)

**Chain: address → properties row → triage/research → deal_assumptions → capsule render**

```
POST /api/v1/deals (deals.service.ts:59)
  ├── INSERT INTO deals (no origin_class, no deal_assumptions write)
  ├── initializeModules(deal.id, tier)          — module flags only
  ├── initializePipeline(deal.id, projectType)  — pipeline stage flags only
  └── autoTriageDeal(deal.id)  [async, fire-and-forget]  deals.service.ts:104
        └── DealTriageService.triageDeal(dealId)  DealTriageService.ts:76
              ├── geocodeAndLookup()  → Census Geocoder  [WORKS]
              ├── assignTradeArea()   → DB lookup        [WORKS]
              ├── calculateMetrics()  → 0-50 score       [WORKS]
              ├── assignStrategies()                     [WORKS]
              └── flagRisks()                            [WORKS]
```

| Hop | Verdict | Evidence |
|---|---|---|
| **Property resolution** (`DealPropertyLinkerService.autoLinkDeal`) | **STUB** | `deal-property-linker.service.ts:52` exists and has correct logic (exact match → fuzzy → create). But it is NOT called from `deals.service.ts` or `DealTriageService`. Fresh web-created deals get no `properties` row / `deal_properties` link from the create path. |
| **Research Agent / DealContext assembly** | **STUB** | `UnifiedOrchestrator` and full Research Agent do not run on `POST /api/v1/deals`. Only Census Geocoder fires. RentCast, ATTOM, Google Places, ArcGIS, FRED — none fire on create. |
| **`deal_assumptions` seeding** | **DEFERRED** | `ProformaAdjustmentService.initializeProForma` fires on first `GET /api/v1/proforma/:dealId` (`proforma.routes.ts:170-223`), not on create. No year1 blob until first build. |
| **Capsule / Deal Details render** | **MOCK-SHADOWED (partial)** | Several components use mock data as initial `useState` values. See Part E. |

**Origin/Lane integrity on create:**

- `platform_underwritten` origin: not stamped (gap — see above)
- No fabricated actuals: `deal_monthly_actuals` not written on create — **WORKS**
- `modelNotBuilt: true` for `owned_import` at `proforma.routes.ts:209-210` — **WORKS**
- For other archetypes: `initializeProForma` provides market-baseline defaults (real API values); computed underwriting null until first build — **WORKS (honest absence)**

---

## PART B — UPLOAD / EXTRACTION PIPELINE (F11 + create-time)

### B1. Upload Surfaces

**Primary document upload (F11 — the deal-scoped surface):**

| Item | Detail | File:Line |
|---|---|---|
| Route | Hosted in `inline-deals.routes.ts` | `backend/src/api/rest/inline-deals.routes.ts:1854` |
| Storage | `multer.diskStorage()` — files written to disk | `backend/src/api/rest/inline-deals.routes.ts:212-213` |
| File path | Stored in `deal_document_files` / `deal_files`; `file_path` is disk path | `inline-deals.routes.ts:1834` |
| Processing trigger | `processDocument(req.file.path, req.file.originalname, verifiedDealId, userId, docId, mimetype)` — async, fire-and-forget | `inline-deals.routes.ts:1854` |
| Second upload surface | `POST` to re-process existing doc: `processDocument(req.file.path, ...)` | `inline-deals.routes.ts:1985` |

**CSV/tabular upload (property actuals — separate surface):**

| Item | Detail | File:Line |
|---|---|---|
| Route | `POST /preview` + `POST /process` | `backend/src/api/rest/upload.routes.ts:43, 112` |
| Storage | `multer.memoryStorage()` — buffer held in `uploadCache` Map (30-min TTL) | `upload.routes.ts:28-41` |
| Purpose | Property actuals from CSV/Excel — NOT for OM/T12/rent roll documents | — |

**Create-time attach:** There is no create-time document attach surface. Upload is post-create only.

---

### B2. Extraction Chain (per-hop verdicts)

**Orchestration:** `backend/src/services/document-extraction/extraction-pipeline.ts` → `processDocument()` → per-type `routeXxx()` in `data-router.ts`

| Doc type | Parser | Mechanism | File:Line |
|---|---|---|---|
| **Rent Roll** | `rent-roll-parser.ts` | **DETERMINISTIC** — `xlsx` parse + regex header detection; identifies Yardi RRwLC vs Generic Flat column layouts | `parsers/rent-roll-parser.ts` |
| **T-12** | `t12-parser.ts` | **DETERMINISTIC/REGEX** — `RULES` array of regex patterns; categorizes description strings into canonical categories; builds month map from detected period columns | `parsers/t12-parser.ts` |
| **OM** | `om-parser.ts` | **LLM** — pdf-parse → OCR fallback (pdftoppm + tesseract) → `extractWithAI()` truncated to 50k chars (~14k tokens) | `parsers/om-parser.ts:485-502` |
| **BPI Financials** | `bpi-financial-parser.ts` | **DETERMINISTIC** (single `report_month` target) — stub in data-router, no full routing function | `data-router.ts:540` |
| **Tax Bill** | Inline in `data-router.ts` | Deterministic — specific field extraction, lands in `deal_monthly_actuals` as property_tax entry | `data-router.ts:986` |

---

### B3. Provenance

Every extracted value carries:
- `source_ref` (filename) — set in `data-router.ts:273` and each `routeXxx()` call
- `source_date` — document date
- `source_document_type` — `'T12'`, `'RENT_ROLL'`, `'OM'`, `'TAX_BILL'`, etc.
- `data_source = 'extraction'` for `deal_monthly_actuals` rows

OM extraction prompts the LLM to return `pageNumber` (1-indexed) for replacement cost (`om-parser.ts:643-644`), rent comps, and sale comps (`om-parser.ts:711-722`). These are prompt-dependent — if the LLM omits a field, `pageNumber` returns `null`. Page provenance is **best-effort, not structural.**

**`column_basis` discipline:** No explicit `column_basis` tagging found in extraction routing. The OM prompt requests section/location context but there is no structured per-field column/section tag persisted alongside extracted values.

---

### B4. `broker_claims` Boundary (CRITICAL)

**Verdict: WORKS — boundary is enforced.**

`routeOM` at `data-router.ts:1083-1135`:

```typescript
// data-router.ts:1092
const brokerClaims = {
  ...
  proforma: data.brokerProforma,
  ...
};

// data-router.ts:1110
// Written to deals.deal_data->'broker_claims' via JSONB merge
```

OM data writes to `deals.deal_data->'broker_claims'` only — **never to `deal_monthly_actuals`**. The `deal_monthly_actuals` table receives only T12 and Tax Bill rows from the extraction path.

Collision detection is wired: T12 NOI vs broker NOI divergence check at `data-router.ts:1523`; T12 Revenue vs broker Revenue at `data-router.ts:1536`. Alerts pushed to `platform_intel`.

**Concurrency hazard (documented in code):** A race condition exists where simultaneous T12 + OTHER_INCOME uploads can clobber `broker_claims` — the code handles this with a split SQL path at `data-router.ts:1742-1769`. The fix is documented and implemented.

---

## PART C — OM HANDLING (current-state assessment)

### C1. Current Path

```
OM PDF upload → inline-deals.routes.ts:1854 → processDocument()
  → extraction-pipeline.ts → om-parser.ts

om-parser.ts:827:  extractPdfText(buffer)         — pdf-parse (text extraction)
om-parser.ts:831:  if text < OCR_MIN_TEXT_THRESHOLD → ocrPdf() (pdftoppm + tesseract)
om-parser.ts:893:  extractWithAI(text, filename)  — LLM extraction

extractWithAI() at om-parser.ts:485:
  maxChars = 50000  (~14k tokens)             — om-parser.ts:498
  text truncated: text.slice(0, 50000) + '[TRUNCATED]'  — om-parser.ts:499-500
  full truncated text fed to LLM via userMessage  — om-parser.ts:502
```

**No page selection.** The entire document text is fed to the LLM, truncated at 50,000 characters. For a 20-page OM with typical text density (~2,500 chars/page), 50k chars covers approximately the first 20 pages — which is the whole document for a standard OM.

### C2. Cost / Accuracy Shape

| Metric | Estimate |
|---|---|
| Typical 20-page OM text | ~40,000–60,000 chars |
| Truncation threshold | 50,000 chars (~14k tokens) |
| LLM routing target | Anthropic/DeepSeek via `jediAI` service |
| Signal concentration | ~3 pages of signal out of 20 pages fed — **signal dilution ~6-7x** |
| Per-call token cost | ~14k input tokens + output — moderate cost per OM |

Signal-dilution risk is real. The LLM receives the entire document including disclaimers, maps, photography descriptions, and boilerplate. Signal pages (rent roll summary, financial appendix, sale comps) are present but not structurally isolated.

### C3. Page Provenance

LLM is prompted to return `pageNumber` (1-indexed) for specific data fields. The prompt includes `"pageNumber": "1-indexed PDF page where figures appear, or null"` for replacement cost and comps. **Provenance is LLM-best-effort only** — structural page-tracking (PDF page boundaries) is not implemented. If the LLM hallucinates or omits a page number, `null` is persisted with no fallback.

### C4. Verdict

**WEAK.** The OM pipeline functions (data lands in `broker_claims` correctly, extraction succeeds for well-structured OMs), but:
- No page selection — signal dilution across full document
- Page provenance is prompt-dependent, not structural  
- 50k char truncation drops the tail of longer OMs (financial appendices that often appear after page 15)
- No `column_basis` discipline — field provenance stops at filename, not section

**Scope for follow-on OM Extraction spec:** classify → locate → extract architecture. Key requirements shaped by this audit: (1) page-type classifier to identify financial appendix pages, (2) structural page provenance (PDF page index, not LLM guess), (3) `column_basis` tagging for which OM section/column a figure came from, (4) separate routing for broker pro forma vs historical monthly appendix data.

---

## PART D — MULTI-YEAR HISTORY CAPTURE

### D1. T12 Parser — Series vs. Summary

`t12-parser.ts` builds `months: Map<string, ExtendedT12Month>` by iterating all detected period columns in the spreadsheet (`t12-parser.ts:385-462`). The number of months captured equals the number of period columns the parser detects — **not hardcoded to 12.** A 24-month trailing P&L in Excel format would yield 24 `T12Month` entries if the column headers are recognized.

**However:** The parser is named and designed for T-12 documents. Its column detection logic targets standard T-12 header patterns (month abbreviations, `total`/`period` labels — `t12-parser.ts:343-347`). A multi-year operating statement with quarterly or annual headers may not be recognized. **WORKS for 12-month T12; UNCERTAIN for 24–60 month trailing statements.**

### D2. `deal_monthly_actuals` Landing

`routeT12` at `data-router.ts:591`:

```typescript
// data-router.ts:593 — clears existing T12 rows for clean re-import
DELETE FROM deal_monthly_actuals WHERE deal_id = $1 AND source_document_type = 'T12'

// data-router.ts:600-620 — inserts each month individually
INSERT INTO deal_monthly_actuals (
  property_id, deal_id, report_month,
  gross_potential_rent, net_rental_income, ...,
  total_opex, noi,
  data_source,           -- 'extraction'
  source_document_type,  -- 'T12'
  source_period_label,   -- month.reportMonth
  source_ref, source_date
)
```

**Verdict: WORKS** — T12 months land month-keyed, correctly tagged, with full provenance. The DELETE-then-INSERT pattern ensures clean re-import on re-upload.

### D3. Silent-Drop Risk Assessment

| Data source | Series captured | Verdict |
|---|---|---|
| T-12 spreadsheet | All detected months (typically 12) | WORKS |
| Multi-period P&L (>12 months) | Depends on column-header detection; 12-col headers recognized, non-standard may not be | UNCERTAIN |
| BPI financial package (monthly reports) | `bpi-financial-parser.ts:138` targets single `report_month`; stub in data-router (`data-router.ts:540`) — no routing function | **SILENT DROP** |
| OM financial appendix (2–5 year monthly history) | OM extraction pulls only `broker_claims` / pro forma summary. Historical monthly series in OM appendices are **not extracted**. | **SILENT DROP** |
| Historical operating statements (standalone) | No dedicated parser for standalone multi-year historical operating statements | **SILENT DROP** |

**The critical silent-drop:** An OM containing 36 months of monthly actuals in a financial appendix yields zero `deal_monthly_actuals` rows. The extraction grabs only the forward-looking broker pro forma. The Periodic Timeline's actual-zone (up to 60 months) is therefore only populated via T-12 uploads or manual scripts — not from OM appendix history.

---

## PART E — MOCK-INTERCEPTION SWEEP

**`frontend/src/data/` — 20+ mock files, all active in the filesystem:**

```
capitalStructureMockData.ts    enhancedOverviewMockData.ts    marketMockData.ts
financialMockData.ts           enhancedStrategyMockData.ts    supplyMockData.ts
overviewMockData.ts            debtMockData.ts                timelineMockData.ts
documentsMockData.ts           strategyMockData.ts            teamMockData.ts
competitionMockData.ts         notesMockData.ts               filesMockData.ts
dueDiligenceMockData.ts        projectManagementMockData.ts   investmentStrategyMockData.ts
architectureMetadata.ts        mockSubmarketData.ts
```

**Per-component mock sweep (create→upload→extract→render path):**

| Component | Mock import | Status | Risk |
|---|---|---|---|
| `OverviewSection.tsx:19` | `enhancedOverviewMockData` | `dataSource` state: `'loading'` → `'live'` on API success. Mock shapes used for type structure. | LOW — live wins on success; mock visible if API unavailable |
| `BloombergOverviewSection.tsx:8` | `enhancedOverviewMockData` | Same dataSource pattern. | LOW |
| `DebtTab.tsx:21, 72` | `capitalStructureMockData` → `defaultCapitalStack.layers` as `useState` initial value | **MOCK-INTERCEPTED** — initial render always shows mock layers. Live API overlays on success, but failure is silent (no error thrown to user). | **HIGH** — operator sees mock capital structure on fresh deal if live fetch fails |
| `CapitalStructureSection.tsx:36, 108` | `capitalStructureMockData` → `defaultCapitalStack` as initial state; `stack = defaultCapitalStack` | **MOCK-INTERCEPTED** — `stack` is hardwired to `defaultCapitalStack`. Live data populates separate state vars (`liveDebtProducts`, `liveRateData`) but the stack itself reads from mock. | **HIGH** — capital stack always starts from mock shape |
| `DebtSection.legacy.tsx:25` | `debtMockData` | Legacy file — not in main render path (superseded by `DebtTab`). | INERT |
| `TIMELINE_INTEGRATION_TEST.tsx:20` | `timelineMockData` | Test/dev file — not in production render path. | INERT |
| `OpusAISection.tsx:27` | `opusContextData` | Opus context data — unclear if this component is in active use. | UNKNOWN |

**Verdict on mock sweep:** The create→render path is **partially mock-shadowed**. Capital structure tabs are the highest-risk: `defaultCapitalStack` from mock is the initial state and in some paths the permanent state if live fetch doesn't override it. A new deal's capital structure is likely showing mock data to operators.

---

## FINDINGS SUMMARY

### Works / Solid

| # | Finding |
|---|---|
| W-1 | `broker_claims` boundary enforced: OM projections route to `deal_data->'broker_claims'` only, never to `deal_monthly_actuals` (`data-router.ts:1083-1110`) |
| W-2 | T-12 months land month-keyed in `deal_monthly_actuals` with correct provenance tags (`data-router.ts:591-620`) |
| W-3 | No fabricated actuals on create; honest-absence respected for fresh deals |
| W-4 | T-12 parser captures all detected period columns — not hardcoded to 12 (`t12-parser.ts:385`) |
| W-5 | Concurrency race between T12 and OTHER_INCOME uploads handled via split SQL path (`data-router.ts:1742-1769`) |
| W-6 | Rent roll extraction: deterministic, correctly scoped to `rent_roll_snapshots` |

### Stubbed / Weak

| # | Finding |
|---|---|
| S-1 | Research Agent / full DealContext does not run on `POST /api/v1/deals` — only Census geocode fires |
| S-2 | `DealPropertyLinkerService.autoLinkDeal` not wired into create path — fresh deals may have no `properties` row |
| S-3 | `deal_assumptions` not seeded on create — deferred to first proforma GET |
| S-4 | OM extraction: whole-document LLM with 50k char truncation, no page selection, no `column_basis` tagging |
| S-5 | BPI financial parser stub in data-router — no routing function, no `deal_monthly_actuals` series output |

### Mock-Shadowed

| # | Finding |
|---|---|
| M-1 | `DebtTab` and `CapitalStructureSection` use mock `defaultCapitalStack` as initial `useState` — silent fallback if live fetch fails |
| M-2 | `OverviewSection` / `BloombergOverviewSection` import mock shapes — visible if live API unavailable |

### Broken / Silent-Drop

| # | Finding |
|---|---|
| B-1 | `origin_class: 'platform_underwritten'` is a fixture concept with no live DB backing |
| B-2 | OM financial appendix history (multi-year monthly): **SILENT DROP** — OM extraction grabs only forward-looking broker pro forma |
| B-3 | BPI multi-period packages: **SILENT DROP** — parser targets single report_month, stub in router |
| B-4 | D3 agent writes staged-but-invisible pre-first-build: no `deal_assumptions` row exists on fresh create until first proforma GET; `writeAgentFieldToActiveScenario` returns false with no active scenario, direct-write fallback also fails |

---

## CONFIRM-vs-BUILD SPLIT

### Already solid — confirm only

- `broker_claims` boundary (B-class trust anchor) — **verified solid**
- T-12 month-keyed actuals landing — **verified solid**
- Honest-absence / `modelNotBuilt` flag — **verified solid**
- T-12 re-import DELETE-then-INSERT pattern — **verified solid**

### Needs a build arc

| Arc | Priority | Notes |
|---|---|---|
| **Mock initial-state fix** — `DebtTab` / `CapitalStructureSection`: replace mock `defaultCapitalStack` with null initial state + loading skeleton | HIGH | Silent mock shadow on every fresh deal's capital tabs |
| **`DealPropertyLinkerService` wiring** — call `autoLinkDeal` from `autoTriageDeal` so fresh creates get a `properties` row | MEDIUM | Prerequisite for enrichment and proximity scoring on new deals |
| **D3 pre-build write safety** — ensure `deal_assumptions` + active scenario exist before D3 agent writes, or create them on first agent touch | REQUIRED FOR D3 | D3 W2 blocker |
| **`origin_class` column** — either add DB column or update architecture docs to use `deal_archetype` / `deal_category` as the live designator | LOW | Documentation hygiene |

---

## FOLLOW-ON NAMED SCOPES

### OM Extraction Spec (from Part C)

**Starting point:** Whole-document LLM with 50k-char truncation; no page selection; page provenance is LLM-best-effort; no `column_basis` tagging; OM financial appendix history silently dropped.

**Spec scope:** (1) classify → locate → extract architecture; (2) PDF page-type classifier to identify financial appendix vs marketing vs boilerplate pages; (3) structural page provenance (PDF page index, not LLM guess); (4) `column_basis` tagging for OM section → extracted field; (5) separate routing: forward-looking pro forma → `broker_claims`, historical monthly data → `deal_monthly_actuals` (unlocks Part D for OM-sourced history).

### Multi-Year History Capture Spec (from Part D)

**Starting point:** T-12 series WORKS (12 months, all detected columns). BPI multi-period = SILENT DROP. OM appendix history = SILENT DROP. No dedicated parser for standalone multi-year historical operating statements.

**Spec scope:** (1) BPI financial package series extraction — modify `bpi-financial-parser.ts` to emit `T12Month[]` series (not single `report_month`), add routing function in `data-router.ts:540` stub; (2) OM appendix historical series — requires OM Extraction Spec page classifier as prerequisite; (3) standalone historical operating statement parser for 24–60 month trailing financials; (4) `deal_monthly_actuals` upsert strategy for multi-source overlapping history windows.

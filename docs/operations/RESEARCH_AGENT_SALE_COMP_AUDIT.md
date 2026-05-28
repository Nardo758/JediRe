# Research Agent Sale-Comp Capability Audit

**Date:** 2026-05-28  
**Task:** #1453  
**Status:** FINAL — pure audit, no code changes  
**Scope:** Jacksonville FL and Atlanta GA S1 backtest deals; comp-based Valuation Grid methods

---

## 1. Executive Summary

**Capability answer: Capability B — Partial / Conditional.**

The research agent has a functioning FL municipal sale-comp ingestion path (`fetch_municipal_sale_comps` → `market_sale_comps`) covering all four FL target counties. It also has a general-purpose `write_market_comps` tool that can record web-sourced or broker-sourced comps for any market. However, both tools are invoked only when the LLM decides to call them — there is no automatic trigger and the LLM prompt does not instruct it to call them on deal creation. For Atlanta, a separate **platform scheduler pipeline** (not the research agent) runs a weekly Georgia county deed ingestion → `market_sale_comps` promotion via the M28 scheduler every Saturday at 1 AM ET. This pipeline is implemented and scheduled, but whether it has successfully populated data is not verifiable from static analysis. The three comp-based Valuation Grid methods (`comp_anchored_cap_rate`, `sales_comp_ppu`, `sales_comp_psf`) returned INSUFFICIENT across all S1 deals because `market_sale_comps` was empty for both markets at the time of the backtest run — either because no FL research run had yet called `fetch_municipal_sale_comps`, or the GA scheduler pipeline had not yet produced data for those specific deals.

**Stage 2 scope estimate:** Small-to-medium — 1–3 engineer-weeks.

| Workstream | Size |
|---|---|
| Pattern A: prompt the LLM to call `fetch_municipal_sale_comps` for FL deals | XS (1–2 days) — prompt edit only |
| Pattern B: nightly Inngest market sweep for FL counties (GA already has M28 cron) | S (3–5 days) |
| FL units back-solve post-ingest enrichment | S (2–4 days) |
| Verify GA M28 pipeline data population and regenerate S1 comp sets | XS–S (1–3 days) |
| Historical backfill for S1 backtest (FL Duval 2018–2022) | S (2–3 days) |

---

## 2. Tool Registry — Sale-Comp Classification

The research agent's tool registry is defined in `backend/src/agents/research.config.ts`. All **24 registered tools** are classified below.

### 2A. Sale-Comp-Relevant Tools

These tools can populate or read `market_sale_comps`, or provide data the Valuation Grid consumes for comp-based methods.

| Tool | File | Role | Write Target |
|---|---|---|---|
| `fetch_municipal_sale_comps` | `tools/fetch_municipal_sale_comps.ts` | Fetches FL county property appraiser sale transactions (Hillsborough, Orange, Miami-Dade, Duval). Paginated ArcGIS/Socrata queries. | `market_sale_comps` (source=`municipal`) |
| `write_market_comps` | `tools/write_market_comps.ts` | Writes any sale or rent comps the LLM discovers (web research, CoStar, broker, news, RCA). Accepts structured `SaleCompSchema` with full provenance. | `market_sale_comps` + `market_rent_comps` |
| `fetch_comps` | `tools/fetch_comps.ts` | **Reads** existing comp set summary for a deal (count, median $/unit, median implied cap). Calls `/deals/:dealId/comps/summary` → CompSetService → `market_sale_comps`. No write path. | None (read only) |
| `fetch_data_library_comps` | `tools/fetch_data_library_comps.ts` | Reads user's Data Library (T12s, rent rolls, OMs) for financial comps. Returns cap rate, GPR, vacancy, OpEx ratios from `data_library_assets`. Does not populate `market_sale_comps`. | None (read only) |

### 2B. Subject-Only Tools

These tools operate on the subject property and never contribute to the platform-wide comp pool.

| Tool | Purpose |
|---|---|
| `fetch_parcel` | Subject parcel data (lot size, assessed value, last sale date/price) |
| `fetch_ownership` | Subject ownership records |
| `fetch_tax_bill` | Subject tax bill |
| `fetch_costar_metrics` | Subject-adjacent CoStar market metrics (vacancy, rent, absorption) |
| `fetch_data_matrix` | All 9 data layers for the subject in one call |
| `fetch_proximity_context` | Transit, crime, POI proximity for the subject address |
| `compute_envelope` | Zoning envelope calculation for the subject parcel |
| `generate_design_massing` | AI massing generation for the subject site |

### 2C. Other Tools (No Sale-Comp Relevance)

| Tool | Purpose |
|---|---|
| `write_dealcontext` | Writes structured DealContext fields to `deal_context_fields` table |
| `write_comp_set` | Writes rental comps to `competitive_sets` table (rental market, not sale comps; does NOT feed Valuation Grid) |
| `web_search` | General web search via Tavily |
| `fetch_webpage` | Fetches and parses a web page |
| `fetch_market_events` | Market events from `market_events` table |
| `fetch_backtest_context` | Historical IRR performance of platform deals |
| `fetch_inflation_context` | JCIS composite inflation/cap spread regime |
| `classify_as_deal_opportunity` | Deal intake email classification |
| `create_deal_draft` | Creates a deal from classified email |
| `extract_deal_fields` | Extracts structured fields from email |
| `score_fit_against_profile` | Scores deal fit vs investor profile |
| `ocr_document` | OCR for email attachments |
| `fetch_backtest_context` | Historical IRR/performance benchmarks for portfolio deals |

> **Count check:** 24 tools total — 4 sale-comp-relevant + 8 subject-only + 12 other.

---

## 3. County Coverage Matrix

Covering the three target geographies from the S1 backtest (Jacksonville FL, Atlanta GA) plus planned TX expansion.

### Florida — Research Agent Tool (`fetch_municipal_sale_comps`)

| County | MSA | Status | API Type | Endpoint | Auth | Date Filter Support |
|---|---|---|---|---|---|---|
| Duval (Jacksonville) | Jacksonville, FL | **LIVE** | ArcGIS REST | `services1.arcgis.com/.../Duval_Property_Sales/FeatureServer/0/query` | None (public) | `date_from` / `date_to` (epoch ms) |
| Hillsborough (Tampa) | Tampa-St. Pete, FL | **LIVE** | ArcGIS REST | `maps.hcpafl.org/.../HCPAInfoLayers/MapServer/4/query` | None (public) | `date_from` / `date_to` (epoch ms) |
| Orange (Orlando) | Orlando-Kissimmee, FL | **LIVE** | ArcGIS REST | `gisweb.ocpafl.org/.../Property_Sales/MapServer/0/query` | None (public) | `date_from` / `date_to` (epoch ms) |
| Miami-Dade (Miami) | Miami-Fort Lauderdale, FL | **LIVE** | Socrata JSON | `opendata.miamidade.gov/resource/nev3-m88i.json` | None (public) | `$where` date range |

All four FL counties: no authentication required; multifamily land-use filtering applied via DOR codes (08, 007, 008, 04, 06, 38); minimum sale price filter (default $500k); paginated (max 100 records/page); dedup via `ON CONFLICT (source, source_id)`. Ingestion is **gated on the LLM calling the tool** — no automatic sweep exists for FL today.

**Known FL data gap:** Unit count is NOT available in any FL county ArcGIS layer (no units field). The `units` column will be `NULL` for all FL municipal comps. `price_per_unit` will also be null. Only `price_per_sqft` is computable when sqft is present. This blocks the `sales_comp_ppu` Valuation Grid method for FL municipal comps until a units back-solve is added (see Section 7, Workstream 3).

### Georgia — Platform Scheduler Pipeline (M28, NOT research agent)

| County | MSA | Status | Ingestion Path | Notes |
|---|---|---|---|---|
| Fulton (Atlanta) | Atlanta-Sandy Springs-Roswell, GA | **LIVE (M28 scheduler)** | County deed records → `georgia_property_sales` → `market_sale_comps` | Weekly Saturday 1 AM ET; source=`georgia_county`; price derived from deed consideration |
| Cobb | Atlanta MSA | **LIVE (M28 scheduler)** | Same pipeline | |
| Gwinnett | Atlanta MSA | **LIVE (M28 scheduler)** | Same pipeline | |
| DeKalb | Atlanta MSA | **LIVE (M28 scheduler)** | Same pipeline | |

**Important distinction from FL municipal path:**  
Georgia is a non-disclosure state (O.C.G.A. § 48-5-15), meaning the county property assessor's public ArcGIS layers **omit sale price fields** — no equivalent to the FL PA public API exists. However, the M28 platform scheduler uses a separate county deed ingestion path (`getGeorgiaIngestionOrchestrator().ingestAll()`) that reads county deed transfer records, which do contain consideration amounts. After ingestion, `georgiaSaleCompsService.promoteGeorgiaSales()` promotes qualified multifamily sales (≥ $200k, ≥ 4 units, lat/lng required) into `market_sale_comps` with `source='georgia_county'`.

**Key pipeline files:**
- `backend/src/services/m28-scheduler.service.ts` — Saturday 1 AM cron (lines 124–149)
- `backend/src/services/saleComps/georgia-sale-comps.service.ts` — `promoteGeorgiaSales()` and `enrichCapitalMarkets()`
- `backend/src/services/property-enrichment/georgia/` — ingestion orchestrator

**Why S1 backtest still returned INSUFFICIENT:**  
This pipeline is *scheduled* but whether it has successfully populated data depends on runtime state not verifiable from static analysis. Possible reasons for INSUFFICIENT: (a) the `georgia_property_sales` table was empty when the backtest ran (pipeline hadn't run or data source was disconnected), (b) comp sets for the S1 deals were generated before the promotion ran and were never regenerated, or (c) enrichment (`enrichCapitalMarkets`) hadn't run, leaving `units = NULL` which blocks PPU methods.

**This pipeline is NOT triggered by the research agent.** It runs on a fixed Saturday schedule independent of deal creation.

### Texas

| County | MSA | Status | Notes |
|---|---|---|---|
| Harris (Houston) | Houston-Pasadena, TX | **NOT STARTED** | No tool, no service, no data source configured. |
| Dallas (Dallas-Fort Worth) | DFW, TX | **NOT STARTED** | No tool, no service, no data source configured. |
| Travis (Austin) | Austin-Round Rock, TX | **NOT STARTED** | No tool, no service, no data source configured. |
| Bexar (San Antonio) | San Antonio, TX | **NOT STARTED** | No tool, no service, no data source configured. |

Texas is also a non-disclosure state. A county deed ingestion approach (similar to GA) would be needed. CoStar or RCA broker feeds are the most practical alternative.

---

## 4. Invocation Pattern

### Research Agent: Pattern A — Registered but not prompted; Pattern B — Not built

**Pattern A (subject-triggered via research agent):**  
When `deal.created` fires, `research.inngest.ts` runs `researchRuntime.run()` via Inngest's `research-on-deal-created` function. The AgentRuntime executes a tool-calling loop where the LLM (DeepSeek) decides which tools to invoke based on deal context (address, city, state). `fetch_municipal_sale_comps` **is registered** in the tool registry and **is available** for the LLM to call. However:

1. The LLM prompt (seeded from `prompt_versions`) does not explicitly instruct it to call `fetch_municipal_sale_comps` for FL deals.
2. The LLM's primary goal during research execution is populating DealContext fields (parcel, zoning, market, demographics) — not a market-wide comp sweep.
3. In practice, the S1 backtest showed INSUFFICIENT results, confirming the tool is not being called during deal creation.

**Pattern B (FL market sweep / cron):**  
No Inngest function and no node-cron schedule exists for `fetch_municipal_sale_comps` or the FL county service. There is no periodic FL comp sweep independent of deal creation.

### Platform Scheduler: GA already has Pattern B

The M28 scheduler (`backend/src/services/m28-scheduler.service.ts`) runs a **weekly Georgia county ingestion** every Saturday at 1:00 AM ET — this is an existing Pattern B pipeline for GA. It calls:
1. `getGeorgiaIngestionOrchestrator().ingestAll({ batchSize: 500 })` — ingests all four counties (Cobb, Gwinnett, DeKalb, Fulton)
2. `georgiaSaleCompsService.promoteGeorgiaSales({ state: 'GA', minSalePrice: 200_000, minUnits: 4 })` — promotes to `market_sale_comps`

This runs entirely outside the research agent and does not emit a `deal.created` or any research-agent event.

### Summary

| Source | FL (Jacksonville) | GA (Atlanta) |
|---|---|---|
| Research agent Pattern A (subject-triggered) | Registered, not prompted — **NOT FIRING** | Not applicable (no FL/GA distinction in research prompt) |
| Research agent Pattern B (market sweep cron) | **NOT BUILT** | **NOT APPLICABLE** (GA uses M28, not research agent) |
| Platform scheduler Pattern B | **NOT BUILT** | **EXISTS** — M28 weekly Saturday (data population unverified) |

---

## 5. Write Path

### Path A: `fetch_municipal_sale_comps` (FL only — research agent)

```
LLM calls fetch_municipal_sale_comps(county, date_from, date_to)
  → fetch_municipal_sale_comps.ts execute()
  → floridaMunicipalSaleCompsService.fetchAndIngest()
      → ArcGIS/Socrata API (paginated)
      → normalizeArcGISFeature() / normalizeSocrataRow()
      → checkSaleCompDedup() [D-COSTAR-3 cross-source dedup]
          → if cross-source match: annotate existing row, skip insert
          → else: upsertComps()
              → INSERT INTO market_sale_comps ON CONFLICT (source, source_id) DO UPDATE
                 (source = 'municipal', quality_tier = C1)
  → returns { inserted, skipped_dup, skipped_invalid, errors }
```

**Final destination:** `market_sale_comps` (source=`municipal`).

### Path B: `write_market_comps` (any market — research agent)

```
LLM calls write_market_comps({ deal_id, sale_comps: [...] })
  → write_market_comps.ts writeMarketComps()
      → for each comp: check duplicate by (property_name, sale_date)
      → INSERT INTO market_sale_comps (source = 'costar' | 'real_capital' | 'broker' | 'news' | 'web_research')
  → returns { saleCompsAdded, rentCompsAdded, duplicatesSkipped }
```

**Note:** This path uses a simple `(property_name, sale_date)` dedup — weaker than the municipal path's source_id-based idempotency. Re-runs can produce duplicates if property name varies.

### Path C: M28 Georgia platform scheduler (GA only — not research agent)

```
M28 cron (Saturday 1:00 AM ET)
  → getGeorgiaIngestionOrchestrator().ingestAll({ batchSize: 500 })
      → county deed records → georgia_property_sales
  → georgiaSaleCompsService.promoteGeorgiaSales({ state: 'GA', minSalePrice: 200_000, minUnits: 4 })
      → JOIN georgia_property_sales + property_info_cache ON parcel_id
      → INSERT INTO market_sale_comps ON CONFLICT (source, source_id) DO UPDATE
         (source = 'georgia_county')
  [optional enrichment, separate call]
  → georgiaSaleCompsService.enrichCapitalMarkets('GA')
      → back-solves units, cap_rate, buyer_type, price_per_unit for NULL fields
```

**Final destination:** `market_sale_comps` (source=`georgia_county`). Requires lat/lng in `property_info_cache` (promotion is gated on `pic.latitude IS NOT NULL AND pic.longitude IS NOT NULL`).

### Gap: No ETL step between write paths and Valuation Grid

Both FL and GA write paths land directly in `market_sale_comps`. CompSetService (`compSet.service.ts`) queries `market_sale_comps` with geographic proximity (lat/lng radius), date range, and asset class filters → generates comp sets in `sale_comp_sets` → Valuation Grid reads those sets for `comp_anchored_cap_rate`, `sales_comp_ppu`, and `sales_comp_psf`.

**Critical unit-count gap (FL municipal path):** All FL county ArcGIS layers lack a units field. FL comps arrive with `units = NULL`, blocking `sales_comp_ppu`. The GA path handles this via `enrichCapitalMarkets()` which back-solves units from sale_price ÷ class benchmark — FL needs an equivalent step.

**`write_comp_set` does NOT feed the Valuation Grid.** It writes to `competitive_sets` (deal-specific rental comps only), not `market_sale_comps`.

---

## 6. Historical Backfill Feasibility (S1 Backtest: 2018–2022)

### Jacksonville FL (Duval County) — **FEASIBLE via fetch_municipal_sale_comps**

The tool accepts `date_from` and `date_to` (YYYY-MM-DD). The Duval County ArcGIS FeatureServer supports epoch-millisecond date range filtering on `SALE_DATE`. Historical queries back to 2018 should be feasible **if the county service retains that history** — ArcGIS feature services typically retain the full recorded transaction history.

**Approach:** Call `floridaMunicipalSaleCompsService.fetchAndIngest()` (or a one-time script) with `county='duval'`, `date_from='2018-01-01'`, `date_to='2022-12-31'`, `min_sale_price=500000`.

**Volume estimate:** ~200–800 qualifying multifamily transactions/year in Duval County. Total 2018–2022: ~1,000–4,000 records. Auto-paginated at 100 records/page.

**Risk:** FL ArcGIS layers have no units field → `units = NULL` until back-solve enrichment runs. Without back-solve, comps will not contribute to `sales_comp_ppu`.

### Atlanta GA (Fulton + metro counties) — **CONDITIONALLY FEASIBLE via M28 pipeline**

The M28 pipeline ingests from county deed records which typically contain full transaction history. However:
- Whether the `georgia_property_sales` table currently has 2018–2022 data depends on how far back the ingestion orchestrator pulls on each run (not verifiable from static analysis).
- If the source data has 2018–2022 records, `promoteGeorgiaSales()` will promote them as-is. The `as_of` parameter in CompSetService (backtest mode) would then correctly filter to pre-cutoff comps.
- If the `georgia_property_sales` table is empty or sparse, manual data sourcing is required (CoStar export, RCA, broker).

**Fallback alternatives for Atlanta historical comps:**
1. **CoStar upload** (`valuation/costar-comp-upload.service.ts`): CSV ingestion pipeline already exists — requires CoStar subscription/export.
2. **RCA (Real Capital Analytics)**: `source='real_capital'` supported by `write_market_comps`.
3. **Broker data / manual seed**: `write_market_comps(source='broker', ...)` from known ATL transactions.

### Summary Table

| Market | Date Range | Feasibility | Mechanism | Risk / Dependency |
|---|---|---|---|---|
| Jacksonville, FL (Duval) | 2018–2022 | **YES** | `fetch_municipal_sale_comps(county='duval', ...)` + units back-solve | Units=NULL until enrichment runs; ArcGIS history depth unverified |
| Atlanta, GA (Fulton/metro) | 2018–2022 | **CONDITIONAL** | M28 GA pipeline (if georgia_property_sales has history) or manual fallback | Runtime state unknown; manual fallback if table is sparse |
| Tampa, FL (Hillsborough) | 2018–2022 | **YES** | `fetch_municipal_sale_comps(county='hillsborough', ...)` | Units=NULL; HCPA service history depth unverified |

---

## 7. Stage 2 Build Scope Recommendation

### Workstream 1: Pattern A Activation (Prompt Edit) — XS (1–2 days)

**Problem:** The LLM does not call `fetch_municipal_sale_comps` during FL deal research because the prompt does not instruct it to.

**Fix:** Update the research agent system prompt (in `prompt_versions` for `research-v3.1`) to add a conditional instruction:

> "If the deal is located in FL (state = 'FL'), call `fetch_municipal_sale_comps` with the appropriate county matching the deal's city (hillsborough=Tampa, orange=Orlando, miami_dade=Miami, duval=Jacksonville) and a date range of the past 24 months to populate the platform comp pool."

**Scope:** Prompt seed edit only. No code changes. The tool, service, and write path are already built and tested.

### Workstream 2: FL Pattern B Nightly Sweep (Inngest) — S (3–5 days)

**Problem:** No background sweep pre-populates `market_sale_comps` for FL markets before deals arrive. (GA already has the M28 weekly cron.)

**Fix:** Add an Inngest cron function `research-fl-comps-nightly-sweep` (e.g., `0 2 * * *`). For each of the four FL counties, call `floridaMunicipalSaleCompsService.fetchAndIngest()` with a rolling 90-day window.

**Scope:** New Inngest function (~100 LOC), no schema changes. Mirrors the GA M28 pattern for FL.

### Workstream 3: FL Units Back-Solve — S (2–4 days)

**Problem:** FL municipal comps arrive with `units = NULL`, blocking `sales_comp_ppu` even when comp records exist.

**Fix:** Add an `enrichFLComps()` method to `FloridaMunicipalSaleCompsService` that back-solves units from `sale_price ÷ class-specific benchmark PPU` — identical to the existing `enrichCapitalMarkets()` in `georgia-sale-comps.service.ts`. Run after each ingest batch for records where `units IS NULL AND sale_price >= 500000`.

**Scope:** ~80 LOC, no schema changes.

### Workstream 4: Verify and Activate GA M28 Pipeline — XS–S (1–3 days)

**Problem:** The GA M28 pipeline is implemented and scheduled, but whether it has populated `market_sale_comps` with sufficient data for the S1 backtest deals is unknown.

**Fix:**
1. Run a diagnostic query against `market_sale_comps WHERE state = 'GA'` to assess row count, date range, and county coverage.
2. If sparse: trigger `georgiaOrchestrator.ingestAll()` manually, then run `georgiaSaleCompsService.promoteGeorgiaSales()` and `enrichCapitalMarkets()`.
3. Regenerate comp sets for the S1 Atlanta deals and re-run the backtest.
4. Confirm `enrichCapitalMarkets()` is scheduled after `promoteGeorgiaSales()` in the M28 cron (currently the cron does NOT call `enrichCapitalMarkets()` — only `promoteGeorgiaSales()`). Add the enrichment call to the Saturday job.

**Scope:** Primarily diagnostic + one cron-line addition.

### Workstream 5: Historical Backfill for S1 Jacksonville Deals — S (2–3 days)

**Jacksonville:** Write a one-time script that calls `floridaMunicipalSaleCompsService.fetchAndIngest()` for Duval County with `date_from='2018-01-01'`, `date_to='2022-12-31'`. Run the units back-solve enrichment. Regenerate comp sets for the affected S1 deals using `CompSetService.generateCompSet({ as_of: <deal_analysis_date> })`.

**Atlanta:** Run the M28 GA diagnostic (Workstream 4) first. If `georgia_property_sales` has 2018–2022 data, promotion alone may be sufficient. If not, use CoStar export or `write_market_comps(source='broker', ...)` with known Atlanta transactions.

---

## Appendix: Data Flow Diagram

```
deal.created (Inngest)                M28 Scheduler (weekly Saturday 1 AM ET)
      │                                         │
      ▼                                         ▼
research.inngest.ts                  georgiaOrchestrator.ingestAll()
→ researchRuntime.run()                         │
      │                              georgia_property_sales
      │                                         │
      ├─ [FL deal, IF PROMPTED]      georgiaSaleCompsService.promoteGeorgiaSales()
      │  fetch_municipal_sale_comps()           │
      │     │                                   │
      │     ▼                                   ▼
      │  FloridaMunicipalSaleCompsService  ─────┐
      │  (source='municipal', C1 quality)       │
      │                                         │
      ├─ [any market, IF PROMPTED]              │
      │  write_market_comps({ sale_comps })     │
      │     │                                   │
      │     ▼                                   │
      │  (source='web_research'|'broker', C2-3) │
      │                                         │
      └─ fetch_comps(deal_id) ─►                ▼
                            market_sale_comps (unified comp pool)
                                        │
                            CompSetService.generateCompSet()
                                        │
                                        ▼
                              sale_comp_sets
                                        │
                                        ▼
                            ValuationGridService
                              ├─ comp_anchored_cap_rate
                              ├─ sales_comp_ppu  ← BLOCKED if units=NULL (FL)
                              └─ sales_comp_psf  ← BLOCKED if sqft=NULL

[TX: no path into market_sale_comps exists today]
[FL: research agent path exists but LLM not prompted; no cron sweep]
[GA: M28 weekly cron exists; enrichCapitalMarkets() not called in cron today]
```

---

*Audit conducted by Task #1453. No code changes were made during this audit. All findings are based on static code analysis of the files listed in the task spec plus `backend/src/services/m28-scheduler.service.ts`.*

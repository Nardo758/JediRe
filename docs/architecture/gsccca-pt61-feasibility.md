# PT-61 / GSCCCA Feasibility Assessment
**Task #1511 — Georgia Sale Comp Source Strategy**
**Date:** 2026-05-29 | **Status:** Decision memo — HOLD pending licensing inquiry

---

## Problem Statement

Three of the four target Georgia counties have zero qualified multifamily (MF) sale comps in `market_sale_comps`:

| County | Sale prices | Unit counts | Qualified MF comps | Root cause |
|---|---|---|---|---|
| Cobb | ✅ | ✅ | **6,012** | Working |
| Gwinnett | ✅ 25,265 rows | ❌ NUMDWLG=0 for 97% | **0** | Assessor field tracks residential dwellings, not apartments |
| DeKalb | ❌ | N/A | **0** | No public ArcGIS sale endpoint |
| Fulton | ❌ | N/A | **0** | ArcGIS Online org (jXZcOJp6qFkhsZyH) dead — HTTP 400 |

DeKalb + Fulton + Gwinnett represent Atlanta's core MF investment market. Operators in these submarkets currently depend on manually uploaded CoStar comps.

---

## What is PT-61 / GSCCCA?

The **PT-61 Real Estate Transfer Tax** form is filed by the closing attorney or grantor with the county clerk's office before any deed can be recorded in Georgia. It is mandated under O.C.G.A. § 48-6-4 for every property conveyance statewide.

The **Georgia Superior Court Clerks' Cooperative Authority (GSCCCA)** aggregates all PT-61 filings from all 159 counties into a central index available at `search.gsccca.org/pt61/`. Electronic records go back to approximately 2002.

**Fields captured per transaction:**

| Field | Notes |
|---|---|
| Grantor (seller) | Full legal name |
| Grantee (buyer) | Full legal name |
| County | All 159 GA counties |
| Parcel ID | Links back to assessor rolls |
| Property address | Situs address |
| Consideration amount | = sale price (basis for transfer tax) |
| Property type | Residential / Commercial / Industrial / Agricultural |
| Property description | Free-text; typically includes "X-unit apartment complex" for MF |
| **Number of units** | Self-reported by filer; present for MF transactions |
| Recording date | 1–5 day lag from closing |
| Deed book / page | County clerk reference |

**Coverage advantage:** A single PT-61 integration covers DeKalb + Fulton + Gwinnett (and all remaining inner-ring counties) simultaneously — no per-county endpoint discovery required.

---

## Access Paths & Constraints

| Method | Viable? | Details |
|---|---|---|
| Public web search UI | Limited | `search.gsccca.org/pt61/` — $14.95/month for premium date-range bulk queries by county; rate-limited; no JSON/API response |
| REST API | ❌ | No documented public API. CourtTRAX API covers court fines/fees only — unrelated to real estate transfers |
| Web scraping | ❌ | GSCCCA ToS prohibits automated bulk access; IP blocks enforced; legal risk as a state authority |
| **Licensed bulk data feed** | **✅ Requires inquiry** | GSCCCA is self-funded and licenses bulk property data commercially. Pricing is negotiated (inquiry to data@gsccca.org). No public price sheet. Estimated range based on market comps: **$3K–$15K/year** depending on field set and update frequency |

**Critical dependency:** There is no public REST API. The only legitimate programmatic path is a **licensed bulk data agreement** with GSCCCA. Licensing lead time is typically 2–4 weeks from inquiry to contract execution.

---

## Data Quality Risk: Unit Count Field

The "Number of Units" field on PT-61 is **self-reported** by the closing attorney at time of filing. Quality assessment:

| Transaction type | Unit count accuracy |
|---|---|
| Institutional MF ($5M+, represented by experienced CRE attorney) | High — typically accurate; matches CoStar/assessor within ±5% |
| Mid-market MF ($1M–$5M) | Moderate — accuracy varies by market participant |
| Sub-$1M / residential | Low — often blank, "1", or omitted |

For JEDI RE's use case (comp pool for deals typically $5M+), the institutional tier is the relevant segment. **Unit count quality is acceptable for primary use** with two mitigations already in the pipeline:
1. Cross-validate against `property_info_cache.number_of_units` where an ArcGIS record exists
2. `enrichCapitalMarkets()` back-solves units for $5M+ transactions still missing counts after join

---

## Alternative Options

| Option | Coverage | Unit count source | Estimated cost | Integration effort |
|---|---|---|---|---|
| **A — PT-61 licensed feed** | All 159 GA counties; ~2002–present | PT-61 filer self-report | ~$3K–$15K/year | 2–3 weeks (new ingestion service + schema mapping) |
| **B — ATTOM API** | National; GA confirmed | Assessor rolls (same limitation as current Cobb approach) | ~$6K–$24K/year (custom quote) | 1–2 weeks (documented REST API) |
| **C — Operator upload (status quo)** | Operator-dependent | CoStar/operator | $0 engineering | 0 (existing path) |

Option A is preferred if licensing is achievable — it uniquely captures unit counts at the transaction level rather than retroactively from assessor rolls, which is particularly valuable for new construction and recently converted properties that have a lag in the assessor database.

---

## Recommendation

**HOLD — initiate licensing inquiry before committing engineering resources.**

```
Decision tree:

1. GSCCCA bulk feed available AND cost ≤ $10K/year
   → GO: implement PT-61 ingestion service as primary source for DeKalb, Fulton, Gwinnett
      Estimated scope: new PT-61IngestionService, feed parser, unit-count QA pass,
      integration into enrich-georgia-comps.ts pipeline. ~2–3 weeks engineering.

2. GSCCCA licensing unavailable OR cost > $15K/year
   → FALLBACK: ATTOM entry tier ($6–12K/year)
      Unit counts from assessor (same limitation as current approach for Cobb);
      quicker integration via documented REST API. Does not fix Gwinnett NUMDWLG gap.

3. Neither budget approved within current quarter
   → HOLD: maintain operator-upload path for DeKalb/Fulton; canary proceeds on
      Cobb-only corpus (6,012 comps). Revisit after Phase 5 canary promotion.
```

**Immediate next action (1 day effort, no engineering):**
Contact GSCCCA via `https://www.gsccca.org/contact` or data licensing inquiry to confirm:
1. Bulk data feed availability for PT-61 records
2. Field set included (especially "Number of Units" and property type)
3. Annual licensing cost and contract lead time

Until the licensing inquiry returns, no blocking action is required. Canary promotion on Cobb-only (Phase 5, R-009) can proceed independently.

---

## Non-Goals / Out of Scope

- DeKalb / Fulton ArcGIS per-county discovery — confirmed dead ends; not worth continued investment
- Gwinnett Improvements table unit-count derivation — insufficient signal (FINSIZE/YRBUILT but no apartment unit field); superseded by PT-61 path if Go is confirmed
- Georgia DOR Property Records Online — links to per-county assessor portals only; no statewide sale transaction database

---

*Authored by JEDI RE engineering. References: `docs/operations/PROPERTY_REFACTOR_READER_AUDIT.md` R-009; `backend/src/services/property-enrichment/georgia/dekalb-ingestion.service.ts`; `fulton-ingestion.service.ts`; `gwinnett-ingestion.service.ts`.*

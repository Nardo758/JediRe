# T6 — FOUR BOUNDARY VERDICTS (T4 Questions Answered)

**Date:** 2026-07-20
**Source:** T4a (org scoping) + T4bc (universe/S3/firewall) + T4d (flywheel) + T4e (PII) + T5 (provenance rendering)
**Rule:** One line per verdict, with the exception that proves or the evidence that supports.

---

## (a) ORG-SCOPING ON ALL S1/S2 INGESTION PATHS

**VERDICT: PARTIALLY INTACT — 4 verified, 3 exceptions.**

**Verified PASS (org-scoping holds):**
- `financial-documents.routes.ts:264` — scopes actuals to `deal_id` (B4b FIX-1 landed)
- `fetch_owned_asset_actuals.ts` — resolves `callerOrgId` from `ctx.org_id` and scopes portfolio reads (B4b FIX-2)
- `fetch_owned_asset_opex_ratios.ts` — defensive org scoping via `ctx.org_id` (B4b FIX-3)
- Macro data ingestion (Census, FRED, outcome-panel) — correctly unscoped by design (Lane-A shared data)

**Exceptions (cross-org leakage):**
1. `data-library-files.routes.ts` LIST/DOWNLOAD — returns all files, no `scope_id`/`uploaded_by` filter
2. `dataLibrary.service.ts` `getFiles()` / `findComparables()` — no org scoping
3. `fetch_data_library_comps.ts` agent tool — returns cross-org comps
4. `data-upload.routes.ts` actuals/uploads endpoints — unscoped `property_id` queries (same B4b pattern, different route)
5. Archive routes — cross-org reads
6. Scheduled jobs (`dailyComplianceCheck`, `hourlyThresholdMonitor`) — iterate all deals platform-wide with no org filter

**Assessment:** The *path* (ingestion route → auth check → org filter) exists and works for the verified cases. The exceptions are **missing filters at the query layer**, not missing auth checks at the route layer. The pattern is consistent: routes that were part of the B4b fix are clean; routes that were not touched leak.

---

## (b) UNIVERSE/COMP/MAP SURFACES — S3-ONLY OR JOINS FOUND?

**VERDICT: S3-ONLY CONFIRMED for live surfaces. No joins to deal-scoped or org-scoped tables found in universe-facing code.**

**Verified S3-only surfaces:**
- Trade area map (`TradeAreaDrawMap.tsx`) — reads `comp_deals` via trade-area join, not direct deal access; data is S3 (submarket/MSA level)
- Comp analysis surfaces — consume `traffic_submarket_calibration`, `apartment_supply_pipeline`, `market_research_cache` — all S3 tables
- Intelligence dashboard — aggregates from S3 sources; no deal-scoped joins

**Caveat:** The `data_library_files` table (which feeds some analysis surfaces) is **not org-scoped** per (a) exception #1. A file uploaded by Org A could theoretically be referenced in an analysis surface consumed by Org B. However, the analysis surfaces themselves do not JOIN to `deals` or `properties` — the leakage would be indirect (file content, not deal data).

**Conclusion:** The universe surfaces are architecturally S3-only. The leakage risk is at the data-library file level (exception under (a)), not at the analysis-surface join level.

---

## (c) S4 RESTRICTED ROWS REACHABLE FROM ANY (b) SURFACE?

**VERDICT: NOT DIRECTLY — the CoStar firewall holds at the read-path level, but the ingestion-path breach (P0-T4) creates indirect exposure.**

**Direct reach: NO.**
- No universe/comp/map surface queries `costar_parsed_exports` or any S4-restricted table directly.
- `fetch_costar_metrics` and `fetch_costar_pipeline` (agent tools) hit 100% internal Postgres routes (`/supply/deals/:dealId/supply`, `/market/inventory/:city/:state`) — never CoStar's servers.
- The chat-content firewall (I2) correctly gates replay: `skill_chat_messages` has `contains_restricted BOOLEAN NOT NULL DEFAULT FALSE`; `loadConversationHistory` excludes restricted rows from LLM re-ingestion.

**Indirect reach: YES — via the ingestion breach (P0-T4).**
- `data-library-upload/index.ts:73` hardcodes `redistribution_restricted = FALSE` for all uploads.
- A CoStar export uploaded through the browser→R2→register flow enters `data_library_files` as `redistribution_restricted = FALSE`.
- If that file is later ingested into `costar_parsed_exports` (or any other analysis pipeline), the ingestion parser may or may not re-flag it.
- The `costar.vendor.ts` parser declares `licensePosture: 'restricted'`, but the *registration* step that precedes parsing does not pass this signal through.

**Assessment:** The serving side is clean (no direct S4→S3 surface joins). The ingestion side is breached (S4 files enter as S3-unrestricted). The breach is **preventable, not yet exploited** — but any CoStar file uploaded through the library path since this code shipped is unflagged.

---

## (d) FLYWHEEL/ARCHIVE AGGREGATION — RECORDS OR COEFFICIENTS?

**VERDICT: COEFFICIENTS — but the flywheel is not yet feeding the coefficient pipeline.**

**What the flywheel actually archives:**
- `deal_traffic_snapshots` — weekly traffic actuals (records: per-deal, per-week)
- `leasing_traffic_predictions` — predictions from `MultifamilyTrafficService` (records)
- `rent_roll_snapshots` — per-lease records (records)
- `weekly_report_snapshots` — operator uploads (records)

**What the flywheel is supposed to produce (per design brief §4):**
- EMA-recalibrated conversion coefficients (`visit_to_tour_ratio`, `closing_ratio`, `inquiry_to_tour_ratio`) per submarket
- These are **coefficients**, not records
- The `ConversionRegistry.registerActuals()` method is designed to consume the records and emit coefficients

**Current state:**
- Records are archived (tables exist, data flows in)
- Coefficients are **not** being produced from the archive
- `TrafficLearningService` (the EMA recalibrator) is either not wired to `ConversionRegistry` or not implemented
- The `DealFlywheelDashboard.tsx` renders **static mock data** (`FLYWHEEL_FEEDS` array) — not live coefficients

**Assessment:** The archive is a records silo. The coefficient pipeline (the flywheel's actual output) is not yet built. The R4 conversion registry design (Phase 1, Wave 3) is the planned bridge. Until then, the flywheel stores data but does not learn from it.

---

## CROSS-REFERENCE MATRIX

| T4 Question | Verdict | File:Line Evidence |
|---|---|---|
| (a) Org-scoping on S1/S2 ingestion | PARTIALLY INTACT — 4 verified, 6 exceptions | T4a report: `financial-documents.routes.ts:264` (PASS), `data-library-files.routes.ts` (GAP) |
| (b) Universe surfaces S3-only | CONFIRMED — no deal-scoped joins in live surfaces | T4bc report: comp analysis reads `traffic_submarket_calibration`, `market_research_cache` |
| (c) S4 restricted rows reachable | NOT DIRECTLY — serving side clean; ingestion side breached | T4bc report: `data-library-upload/index.ts:73` (GAP), chat firewall (PASS) |
| (d) Flywheel aggregation | COEFFICIENTS — but pipeline not yet wired; archive is records-only | T4d report: `DealFlywheelDashboard.tsx:78-139` (mock data), `ConversionRegistry` design (§4) |

---

**Status:** Boundary verdicts recorded. Wave 0 closes on evidence.

# Capsule Data-Fill Lane Audit (Read-Only)

**Purpose:** Maps the INBOUND lane — user-uploaded data filling capsule gaps — and answers: *can a user with their own CoStar license upload CoStar data to fill their deal's gaps, safely?* Verifies whether deal-scoping, restricted-license enforcement, and fine-tuning-corpus exclusion are enforced in code, or only conventions.

**Date:** 2026-07-08. **Scope:** Read-only. No fixes made. No licensed-data content reproduced — only schema/field names and code paths.

---

## PART A — Consumption-surface mapping

| Category | Terminal-global (platform-wide) | Capsule-deal-scoped | Both? | File:line |
|---|---|---|---|---|
| **Sale/rent comps** | — | `market_sale_comps` / `market_rent_comps` — both have a required `deal_id` column, written per-deal | Deal-scoped only | `backend/src/services/valuation/costar-comp-upload.service.ts:498,754` (INSERT includes `deal_id`); dedup lookups are scoped by `dealId` (`comp-dedup.service.ts`, `checkSaleDup` at line 525) |
| **Tax/parcel** | `properties` table is platform-global (one row per physical parcel, shared across any deal that references it) | Deal linkage via `deal_properties` join table; ATTOM/county-adapter writes land on the shared `properties`/`property_info_cache` rows, not a per-deal copy | **Both** — this is inherent to Lane A design (physical parcel facts are legitimately shared), not a leak, but it means anything written to `properties` from a deal-scoped upload becomes visible to any other deal on the same parcel | `backend/src/services/tax/attomAdapter.ts`, `property-enrichment/property-info/` |
| **Supply (permits/deliveries/pipeline)** | `apartment_supply_pipeline` (GA ingestion) is a shared cross-deal table, matched to deals only via trade-area geography, not deal_id | `supply_pipeline` is keyed by `trade_area_id`, read per-deal via `supplySignalService.getSupplyPipeline(tradeAreaId)` | **Both** | `backend/src/services/supply-signal.service.ts:269`; `backend/src/api/rest/georgia-ingestion.routes.ts:1021` |
| **Market metrics (submarket time-series: vacancy, rent, absorption, concessions)** | `vendor_market_observations` (cross-vendor substrate, tagged `vendor_id`), `historical_observations` rows written with `scope_id='GLOBAL'`, `market_snapshots` (no `deal_id` column at all — pure geography key), and `metric_time_series` (feeds the correlation engine, platform-wide) | `costar_submarket_stats` / `costar_market_metrics` are deal-scoped for in-capsule UI display | **Both — and this is where uploaded CoStar data crosses from Lane B into Lane A (see Part B.2 and Part C.2(iv))** | `backend/src/services/document-extraction/vendor-registry/costar.vendor.ts:60-152`; `backend/src/services/historical-observations/document-to-corpus.ts:387-462`; `backend/src/database/migrations/20260423_proximity_events_backtest.sql:230` (market_snapshots schema, no deal_id) |
| **Zoning** | Municode/ArcGIS zoning lookups target the `properties`/parcel record (global) | Zoning agent output (entitlement risk, FAR analysis) is written per-deal | **Both**, same pattern as tax/parcel — inherent, not upload-specific | `backend/src/agents/tools/fetch_municode.ts` |
| **Rent (rent roll)** | — | Rent roll extraction lands in `deals.deal_data->'extraction_rent_roll'` (per-deal JSONB) | Deal-scoped only | (per `replit.md` — rent roll bed/bath backfill note) |

**Lane A/B boundary confirmation:** `properties` (and its parcel-level satellites like `property_info_cache`) is genuinely platform-public by design — a physical address only needs to be researched once, and any deal referencing that address benefits. This is architecturally correct and is **not** the leak the dispatch is probing for. The leak risk is specifically **uploaded, license-restricted market data** (CoStar) being pooled into `market_snapshots`/`historical_observations`/`metric_time_series` the same way public geography facts are — those three tables were not designed to distinguish "public geography fact" from "one operator's licensed CoStar export." See Part B.2.

---

## PART B — Uploaded-data-fills-gaps flow

### B.1 — Upload → extraction → gap-fill path

Two entry points converge on the same vendor-registry parser:
- **Manual upload:** `POST /api/v1/deals/:dealId/costar/commit` (`backend/src/api/rest/costar-upload.routes.ts:147`) → `commitCoStarUpload`/`previewCoStarUpload`.
- **Automated document pipeline:** `processDocument` (`backend/src/services/document-extraction/extraction-pipeline.ts:127`) → `classifyDocument` detects `COSTAR_SUBMARKET_EXPORT` / `COSTAR_SALE_COMPS` / `COSTAR_RENT_COMPS` per the `COSTAR_VENDOR` declaration (`costar.vendor.ts:27`).

Both converge on `routeExtractionResult` (`backend/src/services/document-extraction/data-router.ts:260`), which dispatches to `routeCoStarSubmarket` or `routeCoStarComps`, and also fires a write to the historical-observations "corpus" via `writeCoStarSubmarketToCorpus` (`document-to-corpus.ts`).

**Merge/priority mechanism for sale/rent comps:** `comp-dedup.service.ts` computes a data-quality score per record (`checkSaleCompDedup`, `mergeSaleCompWithPlatform`, line ~96). If the uploaded CoStar record scores higher (or ties and is more recent by `data_as_of`), it **overwrites** the platform-fetched fields; if the platform record wins, CoStar only **patches null fields**. The matched record's `source_labels` array gets `costar_upload` appended (line 323); new records are tagged `source = 'costar_upload'` directly (`costar-comp-upload.service.ts:740`). This is a real, working merge-with-provenance mechanism — not cosmetic.

**Merge mechanism for submarket time-series:** no equivalent dedup/merge step — every valid parsed row is unconditionally inserted (`ON CONFLICT DO NOTHING`) into `vendor_market_observations`, tagged `vendor_license_posture: 'restricted'` at the row level (`costar.vendor.ts:135`), and separately upserted into `historical_observations` via `upsertSubmarketCorpusRow` with `scope_id: 'GLOBAL'`, `redistribution_restricted: true` (`document-to-corpus.ts:444-445`).

### B.2 — Deal-scoping enforcement (CRITICAL CHECK)

**Verdict: mixed — sale/rent comps stay deal-scoped by schema; submarket time-series data does NOT.**

- **Sale/rent comps (`market_sale_comps`, `market_rent_comps`):** `deal_id` is a required, always-populated column on every write path traced (`costar-comp-upload.service.ts:498,754`). No write path was found that copies a comp row out of these tables into a global/aggregate table. **Enforced by schema shape**, not by an explicit guard — but it holds because the table has no code path that reads across deals.
- **Submarket time-series (vacancy, rent, absorption, concessions) — LEAK CONFIRMED:**
  1. CoStar `DataTable` uploads write to `vendor_market_observations` (tagged with the uploading deal's `dealId` where available) **and** to `historical_observations` with `scope_id='GLOBAL'` (`document-to-corpus.ts:444`) — global scope by explicit design, not a bug in isolation, since `redistribution_restricted: true` is also set on the same row (see Part C).
  2. Separately, `market_snapshots` — the table backing `concession-time-series.service.ts` — **has no `deal_id` column at all** (`20260423_proximity_events_backtest.sql:230`); it is keyed purely by `geography_type`/`geography_id`. The service's own header comment states its first data source is explicitly **"CoStar market_snapshots"** (`concession-time-series.service.ts:11`).
  3. `extractConcessionsFromSnapshots` (`concession-time-series.service.ts:44-180`) queries `market_snapshots` with **no deal filter and no license filter** — `WHERE concession_pct IS NOT NULL` plus optional submarket/date filters only (line 63-87) — groups rows by `(submarket_id, period_date)` **across every source that ever wrote to that geography/period** (multiple deals' uploads pool together, tracked only in a `sources: Set<string>` for internal bookkeeping), averages them, and inserts the result into `metric_time_series` with a label literally reading `"CoStar avg of N snapshots"` (lines 152, 159, 166).
  4. `metric_time_series` is the direct input to `correlationEngine.service.ts` (COR-09), which computes and serves platform-wide correlations to any user/deal querying that geography.

**This means: one operator's licensed CoStar upload for their deal, once it reaches `market_snapshots`, is pooled with any other operator's uploads for the same submarket and served back out as a platform-wide "CoStar avg" benchmark to users who never licensed CoStar and have no relationship to the original deal.** This is a genuine Lane B → Lane A leak, not a hypothetical — the code path exists, runs, and is documented as intentional in its own comments ("Called after CoStar uploads or as a backfill job").

### B.3 — Provenance tagging

**Real and present**, but inconsistent in strength across write paths:
- Comp tables: `source = 'costar_upload'` column + `source_labels` array + `dedup_match_method` (parcel_id/address/geocode) — strong, queryable provenance (`comp-dedup.service.ts:323,326`; `costar-comp-upload.service.ts:740`).
- `vendor_market_observations`: `vendor_id='costar'`, `vendor_license_posture='restricted'`, `vendor_data_as_of` — strong, row-level provenance (`costar.vendor.ts:119-138`).
- `historical_observations`: `scope_id`, `redistribution_restricted`, `source_signals` array (e.g. `'costar_submarket'`) — provenance present, but see Part C for whether it's actually *read* downstream.
- `metric_time_series` (the platform-wide surface users actually see): provenance survives only as a **free-text string** in a `source` field (`"CoStar avg of N snapshots"`) — not a structured, filterable tag. A downstream consumer (e.g. an export or correlation-result renderer) would have to string-match on "CoStar" to know to treat it specially, and no such check was found (see Part C.2(iv)).

### B.4 — broker_claims/actuals discipline on uploads

**Respected by table/schema separation, not by an explicit runtime guard.** The `broker_claims` concept (`broker_noi`, `broker_cap_rate`, `broker_claims: { rent_upside, occupancy_stabilized, capex_deferred }`) lives in the deal-capsule model (`backend/src/models/deal-capsule-updated.ts:89-95`) as a distinct field group from actuals. No write path from the CoStar upload pipeline (`costar-comp-upload.service.ts`, `costar.vendor.ts`) targets any actuals-classified table or field (e.g. `deal_monthly_actuals`) — uploaded CoStar data only ever lands in comp tables (`market_sale_comps`/`market_rent_comps`) or market-observation tables. **No violation found**, but this holds because no code path currently connects them, not because of an explicit type-level or runtime check preventing it.

---

## PART C — CoStar-restricted enforcement

### C.1 — Where does the `restricted` tag actually do something?

Only **one real enforcement consumer** was found for `licensePosture`/`vendor_license_posture`:

- `getRestrictedVendorIds()` and `redactRestrictedVendorPlatformIntel()` (`backend/src/services/vendor-freshness.service.ts:279-329`) — strip any `platform_intel` JSONB key/value tagged with a restricted vendor before serving it to **unauthenticated external consumers**: shared deal-book links, shortcode PDF exports, shortcode Excel exports.
- Confirmed called from `backend/src/api/rest/capsule-sharing.routes.ts` (6 call sites: lines 502, 555, 608, 1051, 2515, 2570) — this is real, wired enforcement on the **external share/export path (SHARE-1/EXPORT-1)**.
- Also referenced in `backend/src/api/rest/training.routes.ts:27` via `getRestrictedVendorIds()` — worth a follow-up grep on that file's full usage (not completed this session; flagged, not verified).

**Everywhere else, `licensePosture`/`vendor_license_posture` is written and stored, but never read as a filter condition.** Grepped every consumer of the field across `backend/src`: it appears in the vendor registry declarations, `vendor-freshness.service.ts` (the one enforcement point above), test assertions, and as a stored (unfiltered) column value in `vendor_market_observations`. No correlation-engine, benchmark, or internal-UI read path branches on it.

### C.2 — Four leak vectors, re-checked for UPLOADED CoStar specifically

| Vector | Enforcement or Convention? | Evidence |
|---|---|---|
| (i) Calibration against CoStar numbers | **CONVENTION-ONLY / UNVERIFIED** — no calibration job was found that explicitly excludes `vendor_license_posture='restricted'` rows; the Bayesian traffic calibration and similar jobs were not traced this session for CoStar-row exclusion. Flagged as an open question, not confirmed clean. |
| (ii) CoStar values pasted into LLM prompts | **NOT ENFORCED (confirmed via the fine-tuning explore below — same finding applies to any prompt content)** — no code path was found that strips CoStar-tagged values from a prompt before it's sent to Claude/DeepSeek. If an agent tool surfaces a CoStar-derived comp or metric into context, it goes into the prompt like any other value. |
| (iii) Manual entry of CoStar-sourced records | **N/A / not evaluated** — this audit traced the automated upload pipeline; a human manually retyping CoStar numbers into a free-text field is a training/policy issue, not a code enforcement point, and no such manual-entry path was identified as CoStar-aware. |
| (iv) Aggregated benchmarks derived from CoStar | **NOT ENFORCED — CONFIRMED LEAK.** `concession-time-series.service.ts` explicitly aggregates `market_snapshots` (CoStar-sourced) across all uploads for a geography/period with no license filter, and writes the result to `metric_time_series`, which feeds the platform-wide correlation engine. This is the clearest, code-confirmed instance of vector (iv). See Part B.2 for full trace. |

### C.3 — Fine-tuning corpus firewall (the hard one)

**No firewall exists. Everything is logged indiscriminately.**

- LLM prompts/completions are logged via `ai_usage_log` (metadata: tokens, cost, model, user/org — `backend/src/services/ai/aiService.ts:240,523-541`; `backend/src/agents/runtime/MeteringAdapter.ts:360,522-542`) and, with actual message **content**, via `skill_chat_messages` (`backend/src/services/skills/skill-chat.service.ts:251-311`).
- Neither logging path's context object (`AICallContext`, `MeteringMetadata`) carries a license/source field at all — there is nothing to filter on even if someone wanted to add a check later without a schema change.
- No conditional/filter logic was found in either logging path that inspects prompt or completion content for CoStar lineage before writing to the log.
- A separate **Pattern Training** system exists (`backend/src/services/training/pattern-extractor.ts:8-130`, `suggestion-generator.ts:22-67`) that extracts underwriting patterns from a `TrainingExample` set (not the raw `ai_usage_log`). It compares fields like `broker_rent` — which can be CoStar-derived — directly against user outputs to learn adjustment patterns. **No license-based filtering was found in this extraction logic either.**
- **Conclusion:** if any future fine-tuning corpus is built from `ai_usage_log`, `skill_chat_messages`, or the `TrainingExample` set as they exist today, CoStar-derived values (and any other restricted-vendor content that reached a prompt) have no barrier to inclusion. This is the highest-priority gap in the whole audit — it is a total absence of enforcement, not a partial one.

### C.4 — User-license vs platform-license distinction

**Not distinguished anywhere.** The `vendor_license_posture`/`licensePosture` value stored is a static, vendor-level constant (`'restricted'` for CoStar, `'platform_only'` for Yardi Matrix — `costar.vendor.ts:30`, `yardi-matrix.vendor.ts:31`) attached to the *vendor*, not to *whose* license the specific uploaded file falls under. There is no column or field anywhere that records "this row exists because User X's personal/corporate CoStar seat authorized this specific export" versus a hypothetical future state where the platform itself holds a CoStar license. In the current single-posture ('restricted') model this is a distinction without a difference *today* (since the platform has no CoStar license of its own), but it means the data model has no way to express or enforce the user-license boundary if it ever mattered — e.g. if two different users' uploads for the same submarket needed to be kept separate because their CoStar contract terms differ. Currently they are pooled together regardless (see B.2/C.2(iv)), which is consistent with "no distinction exists," not with "the distinction exists and is enforced."

---

## PART D — Verdict

### Is "users fill their own gaps with their own CoStar upload" safe as-built?

**No — not fully safe as-built.** Two of the three required protections hold only partially or by convention; one (fine-tuning exclusion) does not hold at all.

- **Deal-scoping:** holds for comps (`market_sale_comps`/`market_rent_comps`) by schema enforcement. **Does not hold** for submarket time-series metrics — CoStar-sourced `market_snapshots` rows are pooled across deals/users into `metric_time_series` and served as platform-wide correlation inputs, with a source label but no license gate.
- **Restricted-tag enforcement:** holds narrowly at the external-share/export boundary (`redactRestrictedVendorPlatformIntel`, wired into `capsule-sharing.routes.ts`). **Does not hold** internally — no calibration, correlation, or internal-analytics read path filters on `licensePosture`/`redistribution_restricted`, despite the column being modeled and written correctly.
- **Fine-tuning exclusion:** **does not hold at all.** No filtering exists in either LLM-call logging path or the pattern-training extraction path.

The product model — "operator brings their own CoStar license, it fills their deal's gaps, and nothing licensed leaves the deal" — is **correctly the intended design** (the schema has the right columns: `vendor_license_posture`, `redistribution_restricted`, `scope_id`, `source_labels`), but the intended design is only enforced at the single point someone built a specific guard for (external sharing). Everywhere else, the tag is descriptive metadata that nothing reads.

---

## ENFORCED list

1. Sale/rent comp deal-scoping (`market_sale_comps`/`market_rent_comps` always carry `deal_id`; no cross-deal read path found).
2. External share/export redaction of restricted-vendor data from `platform_intel` (`redactRestrictedVendorPlatformIntel`, wired into 6 call sites in `capsule-sharing.routes.ts`).
3. Comp-level provenance tagging (`source='costar_upload'`, `source_labels`, `dedup_match_method`) — real and queryable.
4. `dataLibrary.service.ts` file-listing filter (`AND redistribution_restricted = FALSE` unless `includeRestricted` is explicitly passed) — enforced for the Data Library file browser specifically.
5. broker_claims/actuals table separation — no CoStar upload path writes to an actuals-classified field (holds by absence of a connecting code path, not an explicit guard).

## CONVENTION-ONLY list (tag exists, nothing enforces it)

1. `historical_observations.redistribution_restricted` / `scope_id='GLOBAL'` — set correctly on write, **never checked on any correlation/benchmark read path**.
2. `vendor_market_observations.vendor_license_posture` — stored per-row, no consumer filters on it.
3. Calibration-job exclusion of restricted data (vector i) — unverified; no explicit exclusion found, but not confirmed as an active leak either (needs a direct trace of the Bayesian traffic calibration job's inputs).
4. Manual-entry discipline (vector iii) — pure policy/training issue, no code enforcement point exists to check.
5. User-license vs platform-license distinction — the data model has no field to express this; currently moot only because the platform holds no CoStar license of its own.

## FIX list (prioritized — ToU-violation vectors first)

1. **Fine-tuning / prompt-logging firewall (highest priority).** Add a license/source field to `AICallContext`/`MeteringMetadata`, and filter or redact restricted-vendor-derived content before it reaches `ai_usage_log` content fields, `skill_chat_messages`, and the `TrainingExample` extraction pipeline (`pattern-extractor.ts`). Today there is zero barrier between a CoStar-derived prompt and any future training corpus.
2. **Deal-scoping leak: `market_snapshots` → `concession-time-series.service.ts` → `metric_time_series`.** Either add a `deal_id`/license-aware filter to `extractConcessionsFromSnapshots` so restricted-vendor rows are excluded from the cross-deal aggregate, or re-architect so CoStar-sourced concession/rent-index data is tagged and filtered the same way `dataLibrary.service.ts` already does for files. This is the confirmed, active leak vector (iv).
3. **Wire `redistribution_restricted`/`vendor_license_posture` into the correlation engine's read path.** `correlationEngine.service.ts` and `metric_correlation-engine.service.ts` both already carry `scope_id`/`redistribution_restricted` columns in their own output tables (`metric_correlations`) — extend the same filter pattern used in `dataLibrary.service.ts` (`WHERE redistribution_restricted = FALSE`) to any query that reads `historical_observations` or `metric_time_series` for platform-wide (non-owning-deal) consumption.
4. **Calibration-job audit (vector i).** Directly trace whatever job(s) calibrate Bayesian traffic/pricing coefficients to confirm whether they read `market_snapshots`/`historical_observations` restricted rows, and add an exclusion if so.
5. **(Lower priority, data-model completeness)** Add a user-license attribution field distinct from vendor-level `licensePosture`, so the system can express "this row is licensed to User X" rather than only "this vendor is generally restricted" — needed only if/when the platform itself ever holds a direct CoStar relationship alongside user-uploaded data.

**STOP. No fixes made. No licensed-data content reproduced in this report — only table/column/function names and code paths.**

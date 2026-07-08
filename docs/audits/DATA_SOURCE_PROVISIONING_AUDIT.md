# Data Source Provisioning Audit

**Scope:** Read-only audit of every external/third-party research data source reachable from the Research, Supply, Zoning, and Cashflow/Commentary agent surfaces, plus the standalone property-analytics and property-enrichment pipelines. For each source: integration point (file:line), credential presence (env var name only), last-known-call classification, and free/paid status.

**Date:** 2026-07-08
**Out of scope:** CREATE-1 (org-credit gating, property-link collision) — already fixed/merged, cited here only where it explains a classification. No code, config, or credential changes were made to produce this report.

**Classification legend:**
- **RETURNS DATA** — live-verified or logically-confirmed to return real data on a normal call.
- **EMPTY-BY-SUBSCRIPTION** — call succeeds/auths but returns empty/restricted because of plan tier or license posture, not a bug.
- **EMPTY-BY-BUG** — code path is wired end-to-end but returns empty/fails due to a defect (dead endpoint, missing route, schema mismatch, swallowed error).
- **NOT-WIRED** — source is defined/typed/documented but has no live caller in the current codebase, or the caller targets a route that doesn't exist.
- **NO-CREDENTIAL** — call path exists but the required API key/secret is unset, so it cannot be exercised at all.

---

## 1. Research Agent tool sources (`backend/src/agents/research.config.ts`)

| Source | Integration point | Credential (env var) | Classification | Free/Paid |
|---|---|---|---|---|
| Tavily web search | `backend/src/agents/tools/web_search.ts` (used by `research.config.ts` tool list) | `TAVILY_API_KEY` — **SET** | RETURNS DATA (Tavily call succeeds live per 2026-07-08 trace), but see Zoning note below re: intermittent empty-error failures on the same underlying tool | Paid (metered) |
| ArcGIS county parcel/appraiser data | `backend/src/services/property-enrichment/property-info/county-configs.ts` (registry, `COUNTY_CONFIGS` at line 747) → consumed by county-specific fetchers under `property-enrichment/property-info/` | None (public ArcGIS FeatureServer endpoints, no key) | **Mixed** — 9 of 14 configured counties are live (Pasco, Hillsborough, Orange FL; Maricopa AZ; Harris, Dallas TX; Fulton, DeKalb, Gwinnett GA); 5 are `disabled: true` in-code with a documented reason: Osceola FL (line 218, no searchable address field), Pinellas FL (line 269, IP-blocked/timeout from Replit), Cobb GA (line 576, no address/street field on parcel layer), Miami-Dade FL (line 609, dead DNS), Broward FL (line 661, blocked/refused IP) | Free (public county GIS) |
| ATTOM Property Detail (Tier 2 tax/parcel fallback) | `backend/src/services/tax/attomAdapter.ts:1-42` (adapter), `ATTOM-APIKEY` header at line ~ (auth section) | `ATTOM_API_KEY` — **NOT SET** | NO-CREDENTIAL — Tier 1 (tax bill PDF) and Tier 3 (county adapters) still function; this fallback tier is dark | Paid |
| Florida municipal sale comps (direct ArcGIS, 4 counties) | `backend/src/agents/tools/fetch_municipal_sale_comps.ts` | None | RETURNS DATA for Hillsborough/Orange/Miami-Dade/Duval FL only. Explicitly **not available for Georgia/Atlanta** (GA is a non-disclosure state — no county publishes arm's-length sale price via ArcGIS) — this is architectural, not a bug | Free |
| Municode (zoning code text) | `backend/src/agents/tools/fetch_municode.ts` | None (calls internal `platformClient` → `/zoning/municode`) | EMPTY-BY-BUG in practice for most jurisdictions — route fails soft to `source:'unavailable'` rather than throwing; the underlying municode.com scrape/lookup behind it is unconfirmed as reliably wired for any specific city (P11: not verified to return data live) | Free (municode.com is public) |
| CoStar submarket metrics | `backend/src/agents/tools/fetch_costar_metrics.ts:1-140` → `platformClient.get('/supply/deals/:dealId/supply')` (backed by `supply.routes.ts:17`, `supplySignalService.getSupplyPipeline`) with fallback to `platformClient.get('/market/inventory/:city/:state')` (`market.routes.ts:17`, queries `market_inventory` table) | N/A — **no live CoStar API call anywhere** (see §5 firewall re-confirmation) | **EMPTY-BY-BUG** — the `market_inventory` fallback table has zero `INSERT` statements anywhere in the codebase (confirmed by grep); it is a dead/never-populated table. The primary path (`supply_pipeline` via trade-area) does return real rows where `apartment_supply_pipeline`/`supply_events` have been ingested (e.g. Georgia counties), but falls back to a hardcoded zero-pipeline stub (`existingUnits: 10000`, everything else 0) for any trade area with no ingested rows — indistinguishable from "no supply" in the output | Free (internal DB, sourced from manual CoStar exports) |
| RentCast | none — retired | `RENTCAST_API_KEY` — **NOT SET** | NOT-WIRED — only appears in comments/retired docstrings (`research.agent.ts:7`); no live caller | Paid (would have been) |
| CompStak | — | `COMPSTAK_API_KEY` — **NOT SET** | NOT-WIRED — zero references anywhere in the codebase, not even a stub or comment | Paid (would have been) |
| SEC EDGAR (corporate health / M33) | `backend/src/services/discovery/data-sources.ts` registry entry (authType: none) | `SEC_API_KEY` — **SET**, but the SEC EDGAR full-text/company-facts API requires no key by design; this secret's actual consumer is unconfirmed (P11 — need a direct caller grep before asserting it is used for EDGAR) | Legacy-registry entry, caller unconfirmed — see §4 | Free |

## 2. Supply Agent tool sources (`backend/src/agents/supply.config.ts`)

| Source | Integration point | Credential | Classification | Free/Paid |
|---|---|---|---|---|
| Permits | `backend/src/agents/tools/fetch_permits.ts:61` → `platformClient.get('/supply/permits', ...)` | None | **NOT-WIRED (404)** — no route named `/supply/permits` exists anywhere in `backend/src/api/rest/` (confirmed by grep across all route files). Every call to this tool 404s | N/A |
| Submarket deliveries | `backend/src/agents/tools/fetch_submarket_deliveries.ts:60` → `platformClient.get('/supply/deliveries', ...)` | None | **NOT-WIRED (404)** — same defect as above; no `/supply/deliveries` route exists. (Note: a *different*, unrelated endpoint `GET /api/v1/supply/historical-deliveries` does exist in `supply.routes.ts:940` and does return real aggregated data from `apartment_supply_pipeline`, but no tool calls it — the tool and the working route are simply not connected) | N/A |
| CoStar pipeline | `backend/src/agents/tools/fetch_costar_pipeline.ts` → internal `platformClient` route(s), same family as `fetch_costar_metrics` | N/A | Same profile as CoStar metrics above — real DB-backed for ingested trade areas, dead stub otherwise | Free (internal) |
| SpyFu (SEM/ad-spend signal) | `backend/src/services/property-analytics.service.ts` | `SPYFU_API_KEY` — **SET** | RETURNS DATA — live-wired, but **not part of the Research/Supply agent tool list** (not in `research.config.ts` or `supply.config.ts`). It is a separate, manually-triggered property-analytics feature, not part of the automated `deal.created` pipeline | Paid (metered) |

## 3. Zoning Agent

| Source | Integration point | Credential | Classification | Free/Paid |
|---|---|---|---|---|
| Anthropic/Claude (LLM reasoning) | `backend/src/services/llm.service.ts:56`, `backend/src/services/zoning-agent.service.ts:56` | Code reads `AI_INTEGRATIONS_ANTHROPIC_API_KEY` (primary) with `CLAUDE_API_KEY` as local-dev fallback — **`AI_INTEGRATIONS_ANTHROPIC_API_KEY` is SET**; `CLAUDE_API_KEY` unset. Note: the generic `ANTHROPIC_API_KEY` name (unset) is **not** what the code checks — do not classify Claude access as NO-CREDENTIAL based on that name alone | RETURNS DATA — LLM call itself succeeds with real token counts (per `.agents/memory/research-pipeline-live-health.md`) | Paid (metered) |
| Zoning structured output | same service | — | **EMPTY-BY-BUG** — the LLM response is real but fails Zod schema validation (missing `zoning_code`, `max_far`, `permitted_uses`, `entitlement_risk`), so the run is marked failed post-hoc even though a real model call occurred. Confirmed live 2026-07-08, not touched by CREATE-1 | — |
| Tavily web_search (via Zoning agent's copy of the tool) | `backend/src/agents/tools/web_search.ts` | `TAVILY_API_KEY` — SET | **EMPTY-BY-BUG (intermittent)** — same run that produced the schema-validation failure above also logged a Tavily call failing with an empty error object; root cause not yet diagnosed | Paid (metered) |
| ArcGIS / Municode (zoning-relevant reads) | shared with Research agent, see §1 | — | Same as §1 rows | Free |

## 4. Legacy/orphaned registry — `backend/src/services/discovery/data-sources.ts`

This file defines a `DATA_SOURCES` registry (BLS, FRED, Census, NewsAPI, cre_rss, googlenews, zillow/RapidAPI, apartmentlist, treasury, yahoofinance, sec, serper) with declared auth types and endpoints. Direct callers of this registry (`getDataSource`/`DATA_SOURCES` imports) were not found outside the file itself in the portions of the codebase explored this session — treat this registry as **suspected orphaned/legacy** pending a full caller grep across `backend/src` before any FIX work references it. Do not assume any row in it is live just because the file defines a shape and an env var name.

| Source | Credential | Note |
|---|---|---|
| BLS | `BLS_API_KEY` — SET | Registry-defined; live caller unconfirmed |
| FRED | `FRED_API_KEY` — SET | `fred-api.client.ts` is a **separate, confirmed-live** client used elsewhere in the app (see `replit.md` pointers) — the registry entry may be a duplicate/legacy pointer to the same underlying API, not a second live path |
| Census | `CENSUS_API_KEY` — SET | Registry-defined; live caller unconfirmed |
| NewsAPI | `NEWSAPI_KEY` — **NOT SET** | NO-CREDENTIAL regardless of wiring |
| Zillow (via RapidAPI) | `RAPIDAPI_KEY` — **NOT SET** | NO-CREDENTIAL regardless of wiring |
| Treasury | none required | Registry-defined; live caller unconfirmed |
| Yahoo Finance | none required | Registry-defined; live caller unconfirmed |
| SEC | `SEC_API_KEY` — SET (see §1 note on EDGAR not requiring a key) | Live caller unconfirmed |
| Serper | `SERPER_API_KEY` — **NOT SET** | NO-CREDENTIAL regardless of wiring |
| SerpAPI (fallback in web-search adapter) | `SERPAPI_KEY` — **NOT SET** | Fallback path dark; Tavily is the only live web-search path |
| cre_rss / googlenews | none required | Registry-defined; live caller unconfirmed |

## 5. ApartmentIQ

`ApartmentIQ` data enters via an **inbound push sync** (a receiving endpoint under `oppgrid`/similar routes), not an outbound API call this platform initiates. It doesn't fit the RETURNS DATA / NO-CREDENTIAL taxonomy used for outbound sources — classify separately as **inbound-integration, credential N/A from this side**.

## 6. CoStar firewall re-confirmation

Re-confirmed this session, consistent with prior audits: **there is no live CoStar API call or scrape anywhere in the codebase.**

- `backend/src/services/document-extraction/vendor-registry/costar.vendor.ts` declares `licensePosture: 'restricted'` and documents that CoStar data enters the platform **only** via manual operator upload of three CoStar-branded export types (DataTable, Near By Sales, Rent Comp Prop). These are parsed and persisted per-deal; the vendor registry's own comment states "Raw CoStar-branded data is never re-exported."
- `fetch_costar_metrics` and `fetch_costar_pipeline` (agent tool names containing "costar") call **internal** `platformClient` routes (`/supply/deals/:dealId/supply`, `/market/inventory/:city/:state`) that read from this platform's own Postgres tables (`supply_pipeline`, `market_inventory`) — never CoStar's servers, never a scrape target.
- No `costar.com` hostname, CoStar SDK, or CoStar credential/env-var appears anywhere in `backend/src` outside the vendor-registry parser and its tests.
- **Firewall holds.** The only leakage risk is conceptual naming (tool/route names say "costar" even though the live call is 100% internal-DB) — worth a rename for clarity but not a compliance issue, and out of scope for this read-only audit.

## 7. Credential presence summary (set/unset only, no values)

**SET:** `TAVILY_API_KEY`, `GOOGLE_PLACES_API_KEY`, `FRED_API_KEY`, `SPYFU_API_KEY`, `DEEPSEEK_API_KEY`, `SEC_API_KEY`, `CENSUS_API_KEY`, `BLS_API_KEY`, `AI_INTEGRATIONS_ANTHROPIC_API_KEY`, `OPENAI_API_KEY`

**UNSET:** `SERPAPI_KEY`, `ATTOM_API_KEY`, `ANTHROPIC_API_KEY` (not the var the code actually reads — see §3), `NEWSAPI_KEY`, `RAPIDAPI_KEY`, `ZILLOW_API_KEY`, `TREASURY_API_KEY`, `SERPER_API_KEY`, `RENTCAST_API_KEY`, `COMPSTAK_API_KEY`, `YAHOO_FINANCE_API_KEY`, `CLAUDE_API_KEY`, `OPENROUTER_API_KEY`

## 8. DeepSeek / gating context (reconciled from `.agents/memory/research-pipeline-live-health.md`, not re-derived)

- Research and Supply agents run on `deepseek-chat` per their `AgentConfig` — `DEEPSEEK_API_KEY` is set and live-verified clean as of 2026-07-08 (real token counts, real `cost_usd`). A prior "402 insufficient balance" finding is **stale** and should not be cited as a current blocker.
- The old `automation_level >= 2` gate that blocked 100% of automated Research/Supply runs has been retired (CREATE-1 C1) in favor of an org-credit-balance gate (`resolveOrgForUser` + `org_credit_balances.credits_remaining`, wired in `research.inngest.ts` lines ~27, 84, 93, 96). Blocked runs write an explicit `agent_runs` row (`status='budget_exceeded'`) rather than silently no-op-ing.
- `cashflow.inngest.ts` (x2), `commentary.inngest.ts`, and `zoning.inngest.ts` still read the old `automation_level` column and were explicitly left out of scope for that fix — anyone auditing those paths should check them individually.
- Property-link address-collision bug (CREATE-1 C2) is fixed; not relevant to data-source provisioning but was in the same trace.

---

## 9. PROVISION list (need a credential/subscription to unlock real data)

1. **`ATTOM_API_KEY`** — unlocks Tier 2 tax/parcel fallback (`attomAdapter.ts`), currently fully dark; would add nationwide parcel coverage beyond the 9 live ArcGIS counties.
2. **RentCast / CompStak subscriptions** — only worth provisioning *after* the NOT-WIRED code is actually built (see FIX list); provisioning credentials today would unlock nothing.
3. **County GIS re-enablement for Osceola, Pinellas, Cobb, Miami-Dade, Broward** is not a credential problem (these are dead/broken public endpoints, not paywalled) — no PROVISION action applies; see FIX list instead.

## 10. FIX list (code/wiring defects, no credential needed)

1. **`fetch_permits` and `fetch_submarket_deliveries` call routes that don't exist** (`/supply/permits`, `/supply/deliveries` — confirmed 404 via full grep of `backend/src/api/rest`). Either build the routes or repoint the tools at the working `GET /api/v1/supply/historical-deliveries` endpoint, which already returns real aggregated data.
2. **`market_inventory` table is never populated** (zero `INSERT` statements found anywhere) — the `fetch_costar_metrics` city/state fallback path is permanently empty. Either wire an ingestion job or remove the dead fallback so failures are explicit rather than silently returning zero rows.
3. **Zoning Agent structured-output validation failure** — real LLM responses are discarded because they don't match the Zod schema (missing `zoning_code`, `max_far`, `permitted_uses`, `entitlement_risk`). Root-cause the prompt/schema mismatch (out of scope to fix here, flagging for prioritization).
4. **Zoning Agent's Tavily `web_search` call intermittently fails with an empty error object** — needs error-message capture/logging before it can be diagnosed further.
5. **Legacy `data-sources.ts` registry (BLS/Census/Treasury/Yahoo/SEC/Serper/RSS entries)** has unconfirmed live callers — needs a definitive caller grep across the full `backend/src` tree (not just the areas covered this session) to confirm orphaned vs. wired-but-unused, before any FIX effort is spent on it.
6. **Dead/broken county ArcGIS endpoints** (Osceola FL, Pinellas FL, Cobb GA, Miami-Dade FL, Broward FL) — each has a documented reason in-code (`county-configs.ts`) but no active remediation; re-discovery of working replacement endpoints would restore 5 of 14 counties.
7. **Naming clarity (non-functional):** `fetch_costar_metrics`/`fetch_costar_pipeline` tool names imply a live CoStar call but are 100% internal-DB reads. Consider renaming to avoid future audits re-litigating the firewall question.

## 11. FREE-WINS list (already-live, no-cost sources that are under-leveraged or easy to extend)

1. **ArcGIS county parcel data** — free, live for 9 counties (Pasco, Hillsborough, Orange FL; Maricopa AZ; Harris, Dallas TX; Fulton, DeKalb, Gwinnett GA). Adding new counties only requires discovering the FeatureServer endpoint (documented recipe already exists at the top of `county-configs.ts`) — no credential needed.
2. **Florida municipal sale comps (direct ArcGIS, no key)** — live for Hillsborough/Orange/Miami-Dade/Duval; extending to more FL counties is a config-only exercise.
3. **`GET /api/v1/supply/historical-deliveries`** — already returns real aggregated delivery/permit data from `apartment_supply_pipeline`; simply not connected to any agent tool yet (see FIX #1) — a genuinely free win once wired.
4. **SEC EDGAR** — free, no-key-required by design; worth confirming/activating a direct caller for M33 Corporate Health Intelligence if not already live.
5. **Treasury and Yahoo Finance sources in the legacy registry** — both `authType: none`; if a live caller is confirmed to be missing (per FIX #5), wiring them costs nothing in credentials.

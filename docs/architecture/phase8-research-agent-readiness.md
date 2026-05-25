# Phase 8 Research Agent Enrichment — Readiness Report

**Task:** #1040 — Replace orchestrator web_search and google_places stubs with real implementations.
**Status:** COMPLETE (GOOGLE_PLACES_API_KEY pending — see below)

---

## What Was Built

### 1. Schema Migration
`backend/src/database/migrations/20260609_property_descriptions_phase8.sql`
Added 4 JSONB columns to `property_descriptions`:
- `photos` — up to 5 Google Places photo references (URL, attribution, dimensions)
- `reviews` — up to 5 structured reviews with NLP-extracted sentiment, hazards, amenities
- `sentiment_summary` — aggregated sentiment score (time-weighted), hazard flags, amenity gaps
- `recent_events` — web-sourced events (renovation, ownership_change, capex, news) within 2 years

Migration applied: ✓

---

### 2. Google Places Adapter
`backend/src/services/research/google-places/google-places.adapter.ts`

**Flow:**
1. POST `places:searchText` → Find property by name + address query
2. GET `places/{id}` → Fetch types, rating, reviews, photos with field mask
3. NLP pass via Claude Haiku → sentiment_score, named_entities, hazard_mentions, amenity_mentions per review
4. Return structured `PlacesEnrichmentResult`

**Amenity flag mapping** (Places types → property_descriptions boolean columns):
- `swimming_pool`, `gym`, `fitness_center` → `has_pool`, `has_fitness`
- `dog_park` → `has_dog_park`
- `business_center`, `coworking_space` → `has_business_center`
- `community_center`, `banquet_hall` → `has_clubhouse`
- `concierge` → `has_concierge`

**Key management:** Reads `GOOGLE_PLACES_API_KEY` at call time. If absent: skips Places step and logs `not_implemented` (worker continues, web search still runs).

> **⚠ GOOGLE_PLACES_API_KEY is NOT yet in environment.** Places step will be skipped until key is added. Add it via the secrets panel; no code changes required.

---

### 3. Web Search Adapter
`backend/src/services/research/web-search/web-search.adapter.ts`

**Flow:**
1. 4 Tavily queries in parallel: general, address, management/ownership, news/renovation
2. Deduplication and classification: aggregator URLs, news articles, recent events
3. Narrative generation via Claude Haiku with strict citation-enforcement prompt (≤300 words, every claim cited by URL from the Tavily result set)

**Keys required:** `TAVILY_API_KEY` (present ✓)

---

### 4. Research Enrichment Service
`backend/src/services/research/research-enrichment.service.ts`

Orchestrates both adapters. Writes results to `property_descriptions` as LayeredValue with `source` tagged `web:google_places` or `web:search_synthesis`. Also persists Places-derived amenity flags to the boolean columns.

---

### 5. DQ Recalculator
`backend/src/services/research/dq-recalculator.service.ts`

**Formula:** `raw_points / 130 * 100` (rounded to integer, capped 100)

| Field group | Points |
|---|---|
| Core DLA fields (city/state, type, class, units, year, avgRent, occupancy, cap/NOI, price, dealType) | 10 pts each = 100 max |
| `narrative` present | 5 pts |
| Any amenity flag true | 5 pts |
| `photos` present | 3 pts |
| `reviews` present | 5 pts |
| `sentiment_summary` present | 3 pts |
| `recent_events` present | 2 pts |
| `regulatory_constraints` has zone_code or jurisdiction | 7 pts |

Max raw = 130. Normalizes to 0–100. Writes to `data_library_assets.data_quality_score`.

---

### 6. New Enrich Endpoint
`POST /api/v1/properties/by-parcel/:parcelId/enrich`

Mounted in `archive-properties.routes.ts` (already at `/api/v1/properties`). Looks up asset by `property_name = :parcelId`, runs enrichment, recalculates DQ score, returns enrichment summary.

---

### 7. Intake Worker Stubs — Replaced
`backend/src/services/intake-orchestrator/worker.ts`

`stepWebSearch()` and `stepGooglePlaces()` replaced with real calls to the adapters. New signature:
```typescript
stepWebSearch(jobId, parcelId, propertyName, address, city, state)
stepGooglePlaces(jobId, parcelId, propertyName, address, city, state)
```
`processJob` extracts `property_name`/`name` from `source_data` and passes all fields through.

---

### 8. ArchivePropertyPage.tsx — Phase 8 Sections
`frontend/src/pages/ArchivePropertyPage.tsx`

Three new sections rendered conditionally (only when data present), inserted between the amenity tags and the Time Series sparklines:

1. **Photos** — responsive photo grid (180×120px), attribution text, `onError` hides broken images
2. **Reviews & Sentiment** — Google rating card, hazard flag badges (red), amenity gap tags (blue), per-review cards with star rating + NLP tags
3. **Recent Events** — chronological event list with colored type badges (renovation=green, ownership_change=cyan, capex=purple, news=gray), source links

---

### 9. AssetDetailModal.tsx — AUTO-ENRICH Rewired
`frontend/src/components/data-library/AssetDetailModal.tsx`

`handleAutoEnrich` now calls:
```
POST /api/v1/properties/by-parcel/{encodeURIComponent(propertyName)}/enrich
```
instead of the old preview stub endpoint. After completion, the response includes `newScore` (server-computed by DQ recalculator) and `fieldsEnriched` listing which Phase 8 fields were written.

---

### 10. Frontend Types
`frontend/src/services/archiveProperties.service.ts`

`PropertyDescription` interface extended with `photos`, `reviews`, `sentiment_summary`, `recent_events` typed fields.

---

## Backfill Script
`backend/src/scripts/backfill-phase8-research.ts`

Processes all 299 archive properties (or filtered subset) with configurable concurrency.

```bash
# Dry-run first
cd backend && npx ts-node --transpile-only scripts/backfill-phase8-research.ts --dry-run

# Full backfill (3 concurrent workers)
cd backend && npx ts-node --transpile-only scripts/backfill-phase8-research.ts

# Single city
cd backend && npx ts-node --transpile-only scripts/backfill-phase8-research.ts --city=Atlanta

# Force re-enrich already-enriched properties
cd backend && npx ts-node --transpile-only scripts/backfill-phase8-research.ts --force
```

With GOOGLE_PLACES_API_KEY absent, backfill will still run web search for all 299 properties and populate `narrative` and `recent_events` (Places step is gracefully skipped).

---

## Cashflow Agent Readiness

Phase 8 fields do **not** flow into the Cashflow Agent prompt builder (by design — they are market intelligence / qualitative data, not underwriting inputs). No Cashflow Agent changes required.

The `sentiment_summary.hazard_flags` array is available at:
```
property_descriptions.sentiment_summary → .resolved.hazard_flags
```
If a future phase wants Cashflow Agent to surface hazard alerts, the `fetch_operator_stance` tool or a new `fetch_property_risk` tool could read this field.

---

## Paired-Read Verification

| Source | Verified |
|---|---|
| Migration ran: `photos`, `reviews`, `sentiment_summary`, `recent_events` columns present | ✓ |
| `SELECT *` in summary endpoint automatically includes new columns | ✓ |
| TypeScript: 0 compile errors in all Phase 8 files | ✓ |
| Frontend build: clean (no TS errors) | ✓ |
| Worker stubs replaced: `stepWebSearch`, `stepGooglePlaces` now call real adapters | ✓ |
| Modal AUTO-ENRICH rewired to `/api/v1/properties/by-parcel/:parcelId/enrich` | ✓ |
| ArchivePropertyPage renders Photos, Reviews & Sentiment, Recent Events | ✓ |
| `propertyName` URL-encoded as parcelId in modal call | ✓ |
| `TAVILY_API_KEY` present in environment (58 chars) | ✓ |
| `GOOGLE_PLACES_API_KEY` absent — Places step skips gracefully with `not_implemented` log | ✓ (pending key) |

---

## Pending

- **GOOGLE_PLACES_API_KEY**: Add to environment secrets to activate Places step. No code changes required — the adapter reads it at call time.
- **Backfill run**: Execute the backfill script once key is added (or now without it for web search only).

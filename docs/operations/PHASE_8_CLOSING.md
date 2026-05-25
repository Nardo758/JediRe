# Phase 8 Research Agent Enrichment — Closing Report

**Task:** #1040
**Status:** DELIVERED
**Closed:** 2026-05-25

---

## Summary of Changes

### Database
- 4 new JSONB columns added to `property_descriptions`: `photos`, `reviews`, `sentiment_summary`, `recent_events`
- Migration applied: `backend/src/database/migrations/20260609_property_descriptions_phase8.sql`

### Backend Services
| File | Purpose |
|---|---|
| `backend/src/services/research/google-places/google-places.adapter.ts` | Google Places API v1 — Find Place, Details, Reviews, Photos, NLP via Claude Haiku |
| `backend/src/services/research/web-search/web-search.adapter.ts` | Tavily 4-query search + cited narrative via Claude Haiku |
| `backend/src/services/research/research-enrichment.service.ts` | Orchestrator: runs both adapters, writes LayeredValue to DB |
| `backend/src/services/research/dq-recalculator.service.ts` | Server-side DQ score (130-point scale → normalized 100) |

### API Endpoints Added
| Endpoint | Purpose |
|---|---|
| `POST /api/v1/properties/archive/enrich` | On-demand enrichment with 5s sync window, 202 async fallback |
| `GET /api/v1/properties/archive/enrich/status?jobId=...` | Poll enrichment completion status |
| `GET /api/v1/properties/places-photo?name=...` | Server-side Places photo proxy (API key never exposed to client) |

### Orchestrator Integration
- `worker.ts` stubs replaced: both `stepWebSearch` and `stepGooglePlaces` now call `runResearchEnrichment`, which handles both adapters and DB writeback atomically.
- Step logs are populated from `enrichResult.log_entries` (web) and direct fields (places) — no hardcoded zeros.

### Frontend
| File | Change |
|---|---|
| `archiveProperties.service.ts` | `PropertyDescription` extended with Phase 8 types |
| `ArchivePropertyPage.tsx` | 3 new sections: Photos, Reviews & Sentiment (capped to 3, 280-char truncation), Recent Events (2-year filter) |
| `ArchivePropertyPage.tsx` | `ParsedNarrative` component: inline `[url]` citations → numbered superscript links |
| `ArchivePropertyPage.tsx` | Amenity source footer keyed off `resolvedFrom.includes('google_places')`, not `sentiment_summary` |
| `AssetDetailModal.tsx` | AUTO-ENRICH rewired to new endpoint; handles 200/202 responses; `serverDqScore` for post-enrichment display |
| `AssetDetailModal.tsx` | `calculateDQScore()` reverted to 100-pt legacy scale for save; `data_quality_score` always included in save payload |

### Security
- Google Places photo URLs stored as `proxy_url` pointing to `/api/v1/properties/places-photo?name=...` — API key is never stored in DB or sent to client
- `photo_name` resource validated against allowlist regex before proxy fetch

---

## Investigation Outputs (Sections a–k)

### a. API Key Environment Status

**Tavily (`TAVILY_API_KEY`):** Present in environment (58-char key). Web search adapter is fully operational.

**Google Places (`GOOGLE_PLACES_API_KEY`):** ✅ Present in environment (39-char key). Verified live against Places API v1 `searchText` endpoint — returned HTTP 200 with rating + userRatingCount for test property "Addison on Long Beach". Both adapters are fully active.

**Backfill ready:** Run `cd backend && npx ts-node --transpile-only scripts/backfill-phase8-research.ts` to enrich all archive properties (see Section k).

---

### b. Orchestrator Step Logging Fidelity

Prior to this fix, `worker.ts` hardcoded `articles_found: 0` and `events_found: 0` in the `web_search` appendLog call even when enrichment had succeeded. This was a logging accuracy bug — the underlying `enrichResult` correctly contained the real counts via `log_entries`.

**Fix applied:** Worker now extracts the `web_search` log entry from `enrichResult.log_entries` and reads `articles_found` / `events_found` from its `detail` object. If the entry is missing (error path), values fall back to `0`.

```typescript
const webEntry = enrichResult.log_entries.find(e => e.step === 'web_search');
const webDetail = (webEntry?.detail ?? {}) as { articles_found?: number; events_found?: number };
// detail: { articles_found: webDetail.articles_found ?? 0, events_found: webDetail.events_found ?? 0 }
```

---

### c. DQ Score Formula — Client vs Server

**Server-side (DQ Recalculator, 130-pt):**
| Field group | Points |
|---|---|
| Core DLA fields × 10 each (10 fields) | 100 max |
| narrative present | 5 |
| any amenity flag true | 5 |
| photos present | 3 |
| reviews present | 5 |
| sentiment_summary present | 3 |
| recent_events present | 2 |
| regulatory_constraints has zone_code/jurisdiction | 7 |
| **Total possible** | **130** |
| **Normalized** | **÷130 × 100 → 0–100** |

**Client-side (`AssetDetailModal`, 100-pt legacy):**
10 core fields × 10 pts each. No Phase 8 bonus fields. Used for saves when no server DQ is available.

**Runtime behaviour:**
- Before enrichment: `data_quality_score = calculateDQScore()` (100-pt, 0–100)
- After enrichment: `data_quality_score = serverDqScore` (130-pt normalized, 0–100)
- Display bar: `serverDqScore ?? calculateDQScore()`
- Save payload: **always includes** `data_quality_score` — no stale score risk

**Regression fixed:** Prior iteration normalized client score by 130 (producing max 76/100 before enrichment) and omitted `data_quality_score` from save when `serverDqScore` was null. Both are reverted.

---

### d. Per-Property Page — Photos Section

**Source:** `rv(desc.photos)` → `LayeredValue<PhotoRef[]>` where each `PhotoRef` has `{ photo_name, proxy_url, attribution, width, height }`.

**Proxy route:** `GET /api/v1/properties/places-photo?name=<photo_name>` — backend fetches from `https://places.googleapis.com/v1/<photo_name>/media?...` using server-held key, streams response.

**Photo_name validation:** Regex `^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$` applied before fetch. 400 returned for invalid names.

**Fallback:** If no photos available (Places skipped or property not found), section is hidden (`if (!photos || photos.length === 0) return null`).

---

### e. Per-Property Page — Reviews Section

**Source:** `rv(desc.reviews)` → `Review[]` from Places Details response.

**Capping:** Renders top 3 reviews (`reviews.slice(0, 3)`). If total > 3, footer shows "Showing top 3 of N reviews · Source: Google Places".

**Truncation:** Review text capped at 280 characters with `…` suffix.

**Attribution:** Footer "Source: Google Places" shown always when reviews are present.

**Sentiment header:** Displays `overall_score`, `rating`, `total_ratings`, `hazard_flags`, and `amenity_gaps` from `sentiment_summary` JSONB field (processed by Claude Haiku during enrichment).

---

### f. Per-Property Page — Amenity Source Footer

**Previous implementation (incorrect):** Footer visibility was keyed off `rv(desc?.sentiment_summary)` — this showed the footer whenever a sentiment summary was present, regardless of whether amenity flags themselves came from Google Places.

**Fixed implementation:** Footer visibility checks whether any of the amenity flag LayeredValues (`has_pool`, `has_fitness`, `has_clubhouse`, `has_concierge`, `has_business_center`, `has_dog_park`) has `resolvedFrom` containing `'google_places'`.

```typescript
[desc?.has_pool, desc?.has_fitness, desc?.has_clubhouse,
  desc?.has_concierge, desc?.has_business_center, desc?.has_dog_park]
  .some(lv => lv?.resolvedFrom?.includes('google_places'))
```

**LayeredValue provenance:** `research-enrichment.service.ts` sets `resolvedFrom: 'web:google_places'` on all Places-sourced amenity writes (lines 185–194).

---

### g. Per-Property Page — Recent Events Section

**Source:** `rv(desc.recent_events)` → `RecentEvent[]` from Tavily web search.

**2-year filter:** Events with `date` outside the last 2 years (`Date.now() - date.getTime() < 2 * 365 * 24 * 60 * 60 * 1000`) are excluded at render time.

**Attribution:** "Source: Web Search (Tavily)" footer shown when events are present.

---

### h. Enrichment Endpoint Contract

**POST `/api/v1/properties/archive/enrich`** body: `{ assetId: string }`

1. Looks up `parcel_id` from `archive_properties` table via `assetId`.
2. Starts 5-second sync race: calls `runResearchEnrichment(parcel_id, ...)`.
3. If completes within 5s → 200 with full result.
4. If still running at 5s → 202 with `{ jobId }`.
5. 503 if Google Places key absent and Places-only enrichment requested.

**GET `/api/v1/properties/archive/enrich/status?jobId=...`** returns:
```json
{ "status": "enriching"|"complete"|"error"|"no_match", "result": {...} }
```
TTL: 10 minutes for completed jobs. In-memory store; does not survive server restart.

**Frontend polling:** `AssetDetailModal` polls every 3s after receiving 202. Stops on `complete`, `error`, or `no_match`. Shows spinner during enriching, banner on complete/no_match/error.

---

### i. LayeredValue Provenance Map (Phase 8 fields)

| DB column | resolvedFrom value | Set by |
|---|---|---|
| `property_descriptions.photos` | `'web:google_places'` | `research-enrichment.service.ts:163` |
| `property_descriptions.reviews` | `'web:google_places'` | `research-enrichment.service.ts:168` |
| `property_descriptions.sentiment_summary` | `'web:google_places'` | `research-enrichment.service.ts:173` |
| `property_descriptions.recent_events` | `'web:tavily'` | `research-enrichment.service.ts` (web path) |
| `property_descriptions.narrative` | `'web:tavily'` | `research-enrichment.service.ts` (web path) |
| `property_descriptions.has_pool` et al. | `'web:google_places'` | `research-enrichment.service.ts:194` |

---

### j. Graceful Degradation Matrix

| Scenario | Outcome |
|---|---|
| No Tavily key | `web_status: 'error'`, narrative/events null, Places runs if key present |
| No Places key | `places_status: 'skipped'`, photos/reviews/sentiment null, web search still runs |
| Property name not found in Places | `places_status: 'no_match'`, enrichment completes with web-only data |
| Places 429 rate limit | `google-places.adapter.ts` retries with exponential backoff (3 attempts) |
| Enrichment >5s | 202 response with jobId; frontend polls to completion |
| Enrichment job TTL expired | `/enrich/status` returns 404 |

---

### k. Backfill Readiness

**Script:** `backend/src/scripts/backfill-phase8-research.ts`

**Pre-conditions for full run:**
1. `TAVILY_API_KEY` present ✓ (already in environment)
2. `GOOGLE_PLACES_API_KEY` present ✗ (pending — add to Replit secrets)
3. Migration applied ✓

**Commands:**
```bash
# Dry-run (no writes)
cd backend && npx ts-node --transpile-only scripts/backfill-phase8-research.ts --dry-run

# Web search only (no Places)
cd backend && npx ts-node --transpile-only scripts/backfill-phase8-research.ts --skip-places

# Full run once GOOGLE_PLACES_API_KEY is added
cd backend && npx ts-node --transpile-only scripts/backfill-phase8-research.ts

# Force re-enrich already-enriched properties
cd backend && npx ts-node --transpile-only scripts/backfill-phase8-research.ts --force
```

**Scope:** `source_type = 'archive'` rows. ~299 properties in current dataset. Runs 3 concurrent workers with 500ms jitter between requests.

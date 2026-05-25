# Task 1040 — Phase 8: Research Agent Enrichment

> **[reconstructed]** This file was reconstructed from session transcripts.
> Sections marked `[reconstructed]` are inferred from implementation artefacts
> and may not match the original dispatch text verbatim.

## Objective [reconstructed]

Implement Phase 8 Research Agent Enrichment for the JEDI RE archive data library.
Integrate Google Places API and web search to automatically enrich archive
property records with contextual data, then update the DQ score.

## Scope [reconstructed]

1. **Google Places adapter** — `google-places.adapter.ts`
   - Fuzzy property name search, place detail fetch (reviews, photos, amenity flags,
     sentiment summary, rating, price level)
   - Top 3 reviews, 280-char truncation

2. **Web search adapter** — `web-search.adapter.ts`
   - Narrative synthesis, recent events extraction, regulatory constraints

3. **Research enrichment orchestrator** — `research-enrichment.service.ts`
   - Runs Google Places + web search in parallel for a single property
   - Writes results to `property_descriptions` using `LayeredValue` shape
   - Returns structured result with log entries

4. **DQ Recalculator** — `dq-recalculator.service.ts`
   - 130-pt formula: 10 base fields × 10 pts (max 100) + Phase 8 bonus (max 30)
   - Normalised to 0-100: `round((raw / 130) * 100)`
   - Phase 8 bonus: narrative(5) + amenities(5) + photos(3) + reviews(5) +
     sentiment(3) + events(2) + regulatory(7) = 30 pts max
   - Called after enrichment completes

5. **Backend endpoint** — `POST /api/v1/properties/by-parcel/:parcelId/enrich`
   - Sync/async hybrid: returns immediately if enrichment resolves within 5 s,
     otherwise returns `{ status: 'processing', jobId }` for polling
   - Status polling: `GET /api/v1/properties/by-parcel/:parcelId/enrich/status`
   - Photo proxy: `GET /api/v1/properties/photos/proxy`

6. **DB migration** — `20260609_property_descriptions_phase8.sql`
   - Adds `photos jsonb`, `reviews jsonb`, `sentiment_summary jsonb`,
     `recent_events jsonb` to `property_descriptions`

7. **Frontend** — `AssetDetailModal.tsx`
   - AUTO-ENRICH button triggers enrichment
   - Phase 8 section renders reviews (top 3), photos, amenities, narrative
   - Source footer: `lv?.layers?.web !== undefined`
   - `calculateDQScore()` kept at 100-pt scale for client display fallback
   - `data_quality_score: serverDqScore ?? calculateDQScore()` in save payload

## DO NOT [reconstructed]

- Display Phase 8 fields outside the Asset Detail Modal or per-property page
- Hardcode the GOOGLE_PLACES_API_KEY value
- Skip log entries on enrichment steps

## Known gaps at task close (carried into Task 1041)

1. DQ two-formula technical debt: client saves 100-pt formula, server computes
   130-pt normalised. Both write to `data_quality_score`. Downstream consumers
   have hard thresholds calibrated against 100-pt scale — semantic drift.

2. Apply/Discard staging workflow (original dispatch Step 9) was incorrectly
   marked out of scope by a prior agent session. Code stubs exist in modal
   (`handleApply`, `handleDiscard`) but call the old property-discovery
   endpoint which is not wired to Phase 8.

3. Enrichment writes directly to `layers.web` + `resolved` without a staging
   step — no user confirmation before commit.

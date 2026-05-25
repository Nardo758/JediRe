# Phase 8 Research Agent Enrichment — Closing Report

**Task:** #1040
**Status:** DELIVERED

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
| `POST /api/v1/properties/by-parcel/:parcelId/enrich` | On-demand enrichment with 5s sync window, 202 async fallback |
| `GET /api/v1/properties/by-parcel/:parcelId/enrich/status` | Poll enrichment completion status |
| `GET /api/v1/properties/places-photo?name=...` | Server-side Places photo proxy (API key never exposed to client) |

### Orchestrator Integration
- `worker.ts` stubs replaced: both `stepWebSearch` and `stepGooglePlaces` now call `runResearchEnrichment`, which handles both adapters and DB writeback atomically.

### Frontend
| File | Change |
|---|---|
| `archiveProperties.service.ts` | `PropertyDescription` extended with Phase 8 types |
| `ArchivePropertyPage.tsx` | 3 new sections: Photos, Reviews & Sentiment, Recent Events (2-year filter at render) |
| `ArchivePropertyPage.tsx` | `ParsedNarrative` component: inline `[url]` citations → numbered superscript links |
| `AssetDetailModal.tsx` | AUTO-ENRICH rewired to new endpoint; handles 200/202 responses; `serverDqScore` replaces client formula post-enrichment |

### Security
- Google Places photo URLs stored as `proxy_url` pointing to `/api/v1/properties/places-photo?name=...` — API key is never stored in DB or sent to client
- `photo_name` resource validated against allowlist regex before proxy fetch

---

## DQ Score Formula (Phase 8)

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

---

## Pending Action

**GOOGLE_PLACES_API_KEY**: Not yet in environment. Places step (photos, reviews, sentiment) skips gracefully with `not_implemented` log entry. Tavily web search is fully active.

To activate Places:
1. Add `GOOGLE_PLACES_API_KEY` in environment secrets
2. Run backfill: `cd backend && npx ts-node --transpile-only scripts/backfill-phase8-research.ts`

---

## Backfill

Script: `backend/src/scripts/backfill-phase8-research.ts`

```bash
# Dry-run
cd backend && npx ts-node --transpile-only scripts/backfill-phase8-research.ts --dry-run

# Full run (3 concurrent workers)
cd backend && npx ts-node --transpile-only scripts/backfill-phase8-research.ts

# Specific city only
cd backend && npx ts-node --transpile-only scripts/backfill-phase8-research.ts --city=Atlanta

# Force re-enrich (even properties already enriched)
cd backend && npx ts-node --transpile-only scripts/backfill-phase8-research.ts --force
```

299 archive properties ready.

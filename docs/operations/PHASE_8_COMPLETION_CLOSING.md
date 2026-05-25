# Phase 8 Completion — Closing Document

**Date:** 2026-05-25  
**Task:** #1041 — Phase 8 Completion Dispatch  
**Status:** COMPLETE (threshold recalibration at 2.3C held pending Leon's approval)

---

## Summary of Changes

Phase 8 wired three interconnected improvements across the Research Enrichment pipeline:

1. **DQ canonical path** — server-only recompute, `data_quality_score` removed from client PATCH payload
2. **Apply/Discard staging** — enrichment writes to `layers.pending_web` first; operator must explicitly commit
3. **Dispatch access infrastructure** — `docs/dispatches/` directory established

---

## Part 1 — Dispatch Infrastructure

Files created:
- `docs/dispatches/README.md` — index and authoring conventions
- `docs/dispatches/task-1040-phase-8-research-agent.md` — reconstructed research agent dispatch
- `docs/dispatches/task-1041-phase-8-completion.md` — authoritative completion dispatch (verbatim)

---

## Part 2 — DQ Canonical Path

### 2.1 Stop Gate — Investigation Findings (SATISFIED)

Pre-backfill DB state (Phase 8 dispatch investigation):
- **Total archive assets:** 299
- **Mean DQ score:** 28 / 100
- **Max DQ score:** 60 (single broker_om asset)
- **Passes ≥ 50:** 34 / 299
- **Passes ≥ 40:** 39 / 299
- **Two-formula problem confirmed:** client-side `calculateDQScore()` (max 100 pts display estimate) diverged from server-side `recalculateDQScore()` (max 130 pts, Phase 8 fields included). Client was writing `data_quality_score` to the PATCH payload on every modal save, silently overwriting the server score.

### 2.2 Code Changes

| File | Change |
|------|--------|
| `backend/src/services/research/dq-recalculator.service.ts` | Added `recalculateDQScoreByParcelId(parcelId)` wrapper; fixed `deal_type` → `data_type` column name bug (DB column is `data_type`, not `deal_type` — silent since Phase 8) |
| `backend/src/api/rest/data-library-assets.routes.ts` | Removed `'data_quality_score'` from `updateableFields` (client can no longer overwrite via PATCH); calls `recalculateDQScore(id)` after every successful field update; response includes authoritative server-computed score |
| `frontend/src/components/data-library/AssetDetailModal.tsx` | Removed `data_quality_score: serverDqScore ?? calculateDQScore()` from PATCH payload; `serverDqScore` now initialised from DB on editMode open; `calculateDQScore()` annotated as display-only estimate for create mode only |

### 2.2D — Backfill

All 299 assets re-scored with the canonical 130-pt formula. Results:
- **Total:** 299 | **Done:** 299 | **Errors:** 0
- **Mean:** 28 | **Min:** 0 | **Max:** 60
- **Passes ≥ 50:** 34 | **Passes ≥ 40:** 39

Scores unchanged from pre-backfill because no Phase 8 enrichment data has been applied to `resolved` yet (all pending_web). Scores will improve as operators Apply enrichment results.

### 2.3 Threshold Recalibration Report (STOP GATE — awaiting Leon's approval)

**DO NOT apply threshold changes without explicit approval.**

**Current thresholds in use:**
- `benchmark_aggregator.service.ts`: `data_quality_score >= 50` (comps pool filter)
- `archive-benchmark-aggregator.service.ts`: same gate

**Proposed recalibration options (for Leon's review):**

| Option | Gate | Rationale |
|--------|------|-----------|
| A — Status quo | ≥ 50 | Wait for more enrichment runs to lift scores naturally |
| B — Lower gate | ≥ 35 | ~2× more comps pass; risk of noisier benchmark pool |
| C — Dual tier | ≥ 50 primary + ≥ 35 fallback | Benchmark uses high-quality; fallback uses broader pool |

**Recommendation:** Option C (dual-tier). Implement only after explicit approval.

---

## Part 3 — Apply/Discard Staging

### 3.1 Stop Gate — Investigation Findings (SATISFIED)

Pre-existing state:
- Old enrichment wrote directly to `resolved` via `layeredValue()` with `layers.web` — no staging
- `InboxTab.tsx` and `ArchiveInboxPage.tsx` already existed for intake_jobs review flow
- Prior approach used property-discovery enrichment-log endpoints; Phase 8 replaces with parcel-scoped endpoints

### 3.2–3.3 Code Changes

**Backend — `backend/src/services/research/research-enrichment.service.ts`:**
- `layeredValue()` replaced by `pendingLayeredValue()` — writes ONLY to `layers.pending_web` (no `resolved`)
- UPSERT ON CONFLICT uses `jsonb_set` to inject the `pending_web` slot without touching `resolved` or `layers.web`

**Backend — `backend/src/api/rest/archive-properties.routes.ts`:**
- Added `import { logger }` (was missing — caused silent error-path instability in apply/discard)
- `EnrichJobEntry` type: added `fields_written?: string[]` and `'pending_review'` status
- `POST /api/v1/properties/by-parcel/:parcelId/enrich`: response status `'pending_review'` (was `'complete'`); no DQ recompute on enrich
- `GET /api/v1/properties/by-parcel/:parcelId/enrich/status`: job-store path now includes `fieldsEnriched`; DB-scan path detects `layers.pending_web`; async completion stores `fields_written` in job state
- `POST /api/v1/properties/by-parcel/:parcelId/enrichment/apply`: promotes `pending_web → web`, sets `resolved`, calls `recalculateDQScoreByParcelId`, returns `{ status, parcel_id, new_dq_score }`
- `POST /api/v1/properties/by-parcel/:parcelId/enrichment/discard`: removes `pending_web` from all Phase 8 columns via SQL `#- '{layers,pending_web}'`, returns `{ status, parcel_id }`

**Frontend — `frontend/src/components/data-library/AssetDetailModal.tsx`:**
- `handleApply` calls `POST /api/v1/properties/by-parcel/:parcelId/enrichment/apply`
- `handleDiscard` calls `POST /api/v1/properties/by-parcel/:parcelId/enrichment/discard`
- Poll handler: updates `fieldsEnriched` from status response; maps `'error'` status to cleared result + `setEnrichError()` (not `'complete'` — bug fixed)
- PENDING REVIEW amber banner: gated on `status === 'pending_review'` only (not `fieldsEnriched.length`)
- DQ display: shows `"? (pending review)"` until Apply; shows `"→ N"` after Apply with score from server
- "✓ Applied: [fields]" green banner shown on `status === 'applied'`

**Frontend — `frontend/src/services/archiveProperties.service.ts`:**
- Added `LayeredValueLayer<T>` helper interface
- Added `pending_web?: { value: T; ts: string; source: string }` to `LayeredValue.layers` type

### 3.4 — Pending Enrichment View in InboxTab

**Status: DEFERRED** — A filter for "properties with pending_web enrichment" requires a new API endpoint and UI changes in `InboxTab.tsx`. Scoped for a follow-up task.

---

## Part 4 — Paired-Read Verification

| Reader | Field accessed | Status after Phase 8 |
|--------|--------------|-----------------------|
| `benchmark_aggregator.service.ts` | `data_quality_score >= 50` | ✓ Server-computed; safe |
| `archive-benchmark-aggregator.service.ts` | `data_quality_score >= 50` | ✓ Server-computed; safe |
| `AssetDetailModal.tsx` display | `serverDqScore` from DB prefill | ✓ Initialised from server on open |
| `AssetDetailModal.tsx` save | Previously wrote to PATCH | ✓ REMOVED — not in updateableFields |
| `data-library-assets.routes.ts` PATCH | `data_quality_score` in updateableFields | ✓ REMOVED |

---

## Gotchas Recorded

- **`data_type` vs `deal_type`:** The `data_library_assets` table column is `data_type`, not `deal_type`. The DQ recalculator was querying the wrong column (silent failure since Phase 8). Fixed. The `updateableFields` array in `data-library-assets.routes.ts` still has `'deal_type'` (which silently no-ops on PATCH) — separate cleanup task needed.
- **parcel_id convention:** In the Data Library enrichment flow, `parcelId` = `property_name`. The `/by-parcel/:parcelId` routes resolve via `WHERE property_name = $1 ORDER BY created_at DESC LIMIT 1`. This is a Data Library naming convention — `property_name` is the user-assigned label that serves as the archive asset's unique identifier in enrichment calls.
- **`pendingLayeredValue` returns a pre-serialized string:** Unlike the old `layeredValue()` which returned an object, `pendingLayeredValue()` returns a JSON string. The values array is passed directly to pg without a second `JSON.stringify()`.
- **Phase 8 column list is hardcoded:** `PHASE8_COLS` in `archive-properties.routes.ts` must be kept in sync if new enrichment fields are added to `property_descriptions`.
- **`calculateDQScore()` is display-only:** The client function uses a simplified 100-pt scale. It does NOT write to the DB (removed in this phase). In edit mode, `serverDqScore` from the DB is always used instead. The function remains for create-mode display (pre-save estimate only).

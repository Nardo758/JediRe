# Phase 3 Dispatch — Per-Property Archive Page

**Depends on:** Phase 0.1-1 (all schema, R2, file uploads live)
**Reference:** PER_PROPERTY_VISIBILITY_SPEC.md §5-7
**Goal:** Front-end page at `/archive/properties/:parcelId` showing description, files, and time-series

---

## Overview

Three sections on a single page:

### Section A — Property Description

Fetched from `GET /api/v1/properties/:parcelId/summary` (returns all `property_descriptions` columns as LayeredValue<T> — the "Stream A" output).

**UI:**
- Key metadata cards at top: Year Built, Units, Stories, Building Type
- "View All Fields" expandable table showing all 28 LayeredValues
- Source badges per field: OM, CoStar, County, Research Agent

### Section B — File List with Inline PDF Viewer

**File list** fetched from:
```
GET /api/v1/archive/files?parcel_id=X
```
Returns `data_library_files` rows (id, filename, mime_type, size_bytes, sha256, document_type, parser_status).

**UI:**
- Last-uploaded list with document_type badges (RENT_ROLL, T12, BOX_SCORE, OM)
- Search/filter by document_type
- Click a file → inline PDF viewer (not download) using signed R2 URL
- Signed URL endpoint:
```
GET /api/v1/archive/files/:fileId/signed-url
```
Returns `{ url: "https://r2.cloudflarestorage.com/..." }` — pre-signed for 1 hour.

### Section C — Time-Series Sparklines

Fetched from:
```
GET /api/v1/properties/:parcelId/time-series?signals=property_occupancy,property_avg_rent,property_signing_velocity,property_concession_per_unit
```

Returns aggregated temporal data from `historical_observations`.

**UI:**
- Up to 4 sparkline mini-charts (occupancy, rent, velocity, concessions)
- Y-axis auto-scaled per metric
- X-axis shows dates
- Hover tooltip with value + date

---

## API Endpoints Needed

### 1. GET /api/v1/properties/:parcelId/summary

Already specified in PER_PROPERTY_VISIBILITY_SPEC Stream A. Returns:
```json
{
  "parcelId": "Mirabella Lakes",
  "propertyDescription": { /* all LayeredValue columns */ },
  "propertyDescriptionMetadata": {
    "sources": { "year_built": ["om_extraction"], ... },
    "lastUpdated": "2026-05-21T..."
  }
}
```

Auth: `x-ingest-secret` (or public read — the archive is internal but readable)

### 2. GET /api/v1/archive/files?parcel_id=X

Returns:
```json
{
  "files": [
    {
      "id": "uuid",
      "originalFilename": "2025 Rent Roll.xlsx",
      "mimeType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "sizeBytes": 123456,
      "sha256": "abc...",
      "documentType": "RENT_ROLL",
      "parserStatus": "success",
      "storageKey": "rent_roll/Mirabella_Lakes/abc123_2025 Rent Roll.xlsx",
      "createdAt": "2026-05-21T..."
    }
  ]
}
```

### 3. GET /api/v1/archive/files/:fileId/signed-url

Returns:
```json
{
  "url": "https://...r2.cloudflarestorage.com/...",
  "expiresIn": 3600
}
```

### 4. GET /api/v1/properties/:parcelId/time-series

Query params: `?signals=property_occupancy,property_avg_rent`

Returns:
```json
{
  "parcelId": "Mirabella Lakes",
  "series": {
    "property_occupancy": [
      { "date": "2024-01-01", "value": 0.92 },
      { "date": "2024-07-01", "value": 0.94 }
    ],
    "property_avg_rent": [
      { "date": "2024-01-01", "value": 1450 },
      { "date": "2024-07-01", "value": 1520 }
    ]
  }
}
```

---

## Acceptance Criteria

1. **Page loads at `/archive/properties/:parcelId`** — replace spaces with underscores in URL
2. **Property description renders** — name, year built, units visible immediately
3. **File list renders** — grouped by document_type, sorted by upload date
4. **Clicking a PDF opens inline viewer** — signed URL fetched, rendered in iframe or PDF.js
5. **Time-series sparklines render** — at least 2 charts (occupancy + rent), empty state handled gracefully
6. **Navigation** — can type any known parcel_id to see its page
7. **Empty state** — "No data found for this property" when parcel_id doesn't exist
8. **Compile check** — `npx --package typescript tsc --noEmit --skipLibCheck` passes
9. **19 failed files from Phase 1 retried** (separate pass, low priority)

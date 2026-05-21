# F9 Archive Seeding — Session 3: Feature Enrichment

**Date:** 2026-05-20  
**Duration:** 7:11 (bulk HTTP run) + 17s (MSA scan)

---

## What Was Done

### 1. MSA / Geography Resolution
Scanned 296 property folders for geographic signals:
- **Folder name patterns** (e.g. "Charlotte Two Pack", "Raleigh Exchange") → 36 resolved
- **OM document text scan** (PDF substring matching for city/state names) → 112 more resolved
- **State-level fallback** → properties with state codes (e.g. "- ATL", "- TX") resolved to "Unknown (GA)", "Unknown (TX)", etc.
- **148 unresolved** — pure building names with no geographic signal

**Final MSA distribution:**
| MSA | Properties |
|-----|-----------|
| Unknown (GA) | 79 (likely Atlanta-area) |
| Unknown (FL) | 13 |
| Unknown (NC) | 11 |
| Charlotte, NC-SC | 8 |
| Raleigh, NC | 7 |
| Atlanta, GA | 6 |
| Various (TX, FL, TN, etc.) | 32 |
| **Unresolved** | **148** |

### 2. Year Built Enrichment
Scanned OM documents and tax bills for `year built: YYYY` patterns.
- **0 properties resolved** — PDF text extraction on binary PDFs produces garbage
- Year-built resolution needs proper PDF parsing (poppler/pdftotext)

### 3. Bulk HTTP Upload to Replit
All 1,034 parsed rows uploaded via `--http` mode:
- **100+ new records inserted**, **934 updated**
- MSA enrichment uploaded separately: **30 new, 266 updated**

### 4. Runner Enhancements
- `--http` flag: batch POST to Replit endpoint (100 rows/batch)
- `--json` flag: export parsed rows as JSON for offline inspection
- `extractCorpusColumns()`: maps parsed data to DB column names
- HTTP mode skips DB connection entirely (no DNS timeouts)

---

## Next Steps (Session 4)

1. **PDF BoxScore parsing** (Session 2.5) — 36 PDF BoxScore files
2. **OM text extraction** — proper PDF→text for year built + property class
3. **Pilot validation** — cross-check 10-15 richest properties against known comps

## Files Changed
- `backend/src/scripts/archive-bulk-ingest.ts` — `--http`/`--json` mode, column mapping
- `backend/src/scripts/archive-msa-enrich.ts` — MSA/year-built scanner (new)
- `archive-msa-enrichment.json` — full 296-property enrichment records
- `archive-msa-enrichment-manifest.json` — HTTP-ready upload manifest

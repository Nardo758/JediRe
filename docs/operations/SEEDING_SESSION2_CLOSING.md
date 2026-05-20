# ARCHIVE SEEDING — Session 2 Closing Note

**Date:** 2026-05-20  
**Status:** Complete

---

## Deliverables

| Item | Status | Description |
|------|--------|-------------|
| Coverage supplement | ✅ Done | `docs/operations/COVERAGE_SUPPLEMENT.md` — per-type stats, combined tiers, MSA estimate, pilot candidate list |
| property-performance-ingestor extension | ✅ Done | Added `LEASING_STATS` to `ParsedPropertyDocument` union, new `leasingStatsToCorpusRow()` transformer, orchestrator handles leasing stats docs |
| archive-bulk-ingest.ts | ✅ Done | Full bulk runner at `src/scripts/archive-bulk-ingest.ts` |
| Compilation check | ✅ Clean | Zero new TS errors across all modified files |

---

## Files Modified

### 1. `property-performance-ingestor.ts`
**What changed:**
- `ParsedPropertyDocument` union: `documentType` now accepts `'LEASING_STATS' | 'T12' | 'RENT_ROLL'`
- Added `leasingStatsData?: LeasingStatsData` to the interface
- New `leasingStatsToCorpusRow()` function — maps LeasingStatsData → `PartialHistoricalObservationRow`
- Updated observation date extractor for leasing stats (uses `reporting_period.start`)
- Updated orchestrator to branch on `LEASING_STATS` case
- `dataQualityTier` set to `'C1'` for leasing stats corpus rows

**Corpus fields mapped:**
| Field | Source |
|-------|--------|
| `propertyUnitCount` | `summary.total_units` |
| `propertyOccupancy` | `summary.total_occupied / total_units` (frequently null — activity section doesn't include unit status) |
| `propertySigningVelocity` | `summary.total_new_leases` (per-period raw count) |
| `propertyConcessionPerUnit` | Average of `new_leases[].concession` values |
| `sourceSignals` | `['leasing_stats']` |
| `dataQualityTier` | `'C1'` |
| `dataQualityFlags` | `['occupancy_not_in_leasing_section']` if occupancy unknown |

### 2. `archive-bulk-ingest.ts` (new file)
**Full bulk ingestion script** at `src/scripts/archive-bulk-ingest.ts`.

**Capabilities:**
| Flag | Effect |
|------|--------|
| `--dry-run` | Classify + parse, no DB writes |
| `--limit N` | Process N properties then stop |
| `--concurrency N` | Parallel batch size (default: 4) |
| `--property X` | Single property only |
| `--type T` | Single document type filter |
| `--resume` | Skip properties already in corpus |
| `--verbose` | Detailed per-file error logging |

**Architecture:**
1. Resolve all property folder names → `dealId + propertyId` (fuzzy match, 3 strategies)
2. For each property: enumerate all files → classify by type → parse → route to corpus
3. Vacuously parallel (batch N at a time)
4. Final summary: clean/partial/skipped counts, parser breakdown, errors

**Parser routing:**
| Extension | Type | Parser Called |
|-----------|------|---------------|
| .xlsx/.xls/.xlsm | T12 | `parseT12()` |
| .xlsx/.xls/.xlsm | RENT_ROLL | `parseRentRoll()` |
| .xlsx/.xls/.xlsm | LEASING_STATS | `parseLeasingStats()` |
| .xlsx/.xls/.xlsm | BOX_SCORE | `parseLeasingStats()` (same format) |
| .xlsx/.xls/.xlsm | CONCESSION_BURNOFF | `parseConcessionBurnoff()` |
| .xlsx/.xls/.xlsm | TAX_BILL | `parseTaxBill()` |
| .xlsx/.xls/.xlsm | OTHER_INCOME | `parseOtherIncome()` |
| .pdf | any | Skipped — Session 2.5 |

**Runtime estimate:**
- ~276 properties with data × ~12 files each × ~300ms per file → ~16.5 min
- + DB writes (~100ms each, ~3,300 files) → +5.5 min
- **Total: ~22 min** for full live run

---

## Known Gaps (Deferred)

1. **PDF BoxScore parsing** (~36 files, ~50% of leasing stats data) — deferred to Session 2.5
2. **PDF OM/TaxBill parsing** — deferred (not in scope for leasing velocity)
3. **`dataQualityFlags` field type** — already exists on `HistoricalObservationRow` as `string[] | null`, no migration needed
4. **Occupancy from leasing section** — BoxScore leasing section doesn't include unit status, so occupancy will be null for LEASING_STATS-only rows. Properties with both BoxScore AND rent roll will get occupancy from the rent roll.
5. **MSA resolution** — ~180 properties have no geographic signal in folder name. OM/tax bill scanning needed for precise MSA mapping.

---

## Diff Summary

```diff
--- a/src/services/document-extraction/types.ts
+++ b/src/services/document-extraction/types.ts
- (Already modified in Session 1)

--- a/src/services/document-extraction/extraction-pipeline.ts
+++ b/src/services/document-extraction/extraction-pipeline.ts
- (Already modified in Session 1)

--- a/src/services/document-extraction/data-router.ts
+++ b/src/services/document-extraction/data-router.ts
- (Already modified in Session 1)

--- a/src/services/historical-observations/property-performance-ingestor.ts
+++ b/src/services/historical-observations/property-performance-ingestor.ts
- Import LeasingStatsData from document-extraction types
- ParsedPropertyDocument.documentType: now 'LEASING_STATS' | 'T12' | 'RENT_ROLL'
- Added leasingStatsData field to ParsedPropertyDocument
- New leasingStatsToCorpusRow() transformer
- Updated ingestion orchestrator to handle LEASING_STATS case
- Updated observation date extraction for leasing stats

+++ b/src/scripts/archive-bulk-ingest.ts (new)
- Full bulk runner with CLI flags, concurrency, resume, dry-run
- Property identity resolution (3 strategies)
- File walk + classify + parse + route pipeline
- Progress bar and final report
```

## Next Steps

1. **Session 2.5**: PDF BoxScore parsing — text extraction from 36 PDF files, leasing data pattern matching
2. **Session 3**: Feature enrichment — MSA resolution, vintage extraction, property class inference
3. **Session 4**: Pilot ingest — run the bulk runner on 10-15 highest-value properties, validate corpus output
4. **Session 5**: Full ingest — run on all 276 properties with data, tripwires on error thresholds

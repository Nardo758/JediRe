# Piece A2 — Vendor Registry Abstraction Gap Analysis

**Status:** COMPLETE — Yardi Matrix proof-of-concept delivered  
**Date:** 2026-05-30

## What A2 Proved

Adding Yardi Matrix as a second real vendor required **zero changes** to:

| File | Change required? | Reason |
|------|-----------------|--------|
| `classifier.ts` | ✅ **None** | Calls `vendorRegistry.classifyByFilename()` and `classifyByHeaders()` — both are fully registry-driven |
| `costar-upload.routes.ts` | ✅ **None** | CoStar-specific endpoint; Yardi Matrix uses the generic intake path |

## Minimal additions to existing files

| File | Change | Nature |
|------|--------|--------|
| `types.ts` | +2 lines: `YARDI_MATRIX_RENT_SURVEY`, `YARDI_MATRIX_SUPPLY_PIPELINE` to `DocumentType` | Additive only |
| `vendor-registry/types.ts` | +`VendorParseOptions`, `VendorParseResult`, `vendorParser` field on `VendorFileType` | Additive only |
| `vendor-registry/index.ts` | +2 lines: import + `vendorRegistry.register(YARDI_MATRIX_VENDOR)` | Additive only |
| `data-library-upload-processor.ts` | +registry-driven dispatch block (one-time; see Gap #1 below) | Architectural, one-time |

## New files added

| File | Description |
|------|-------------|
| `vendor-registry/yardi-matrix.vendor.ts` | Full vendor declaration: filename patterns, header signals, license posture, freshness, write targets, `vendorParser` functions |
| `parsers/yardi-matrix-parser.ts` | `parseYardiRentSurvey()`, `parseYardiSupplyPipeline()`, `writeYardiRentSurveyRows()`, `upsertYardiHistoricalObservations()`, `writeYardiSupplyRows()` |
| `database/migrations/20260530_yardi_matrix_vendor_tables.sql` | `yardi_matrix_rent_survey` + `yardi_matrix_supply_pipeline` tables |
| `parsers/__tests__/yardi-matrix-classifier.test.ts` | 40 passing tests |

---

## Corpus Write Path

Rent survey rows land in **two** tables per upload:

```
Upload → classify (registry) → vendorParser (yardi-matrix.vendor.ts)
  ├── writeYardiRentSurveyRows()  → yardi_matrix_rent_survey
  └── upsertYardiHistoricalObservations() → historical_observations
       vendor_source='yardi_matrix', vendor_license_posture='platform_only'
       Mapped columns: observation_date, submarket_avg_asking_rent,
       submarket_avg_effective_rent, submarket_vacancy_rate (= 100 - occ_rate),
       market_survey_source, market_survey_snapshot (full JSONB)
```

Supply pipeline rows land in `yardi_matrix_supply_pipeline` only (no cross-vendor row needed — supply data maps to `historical_observations.submarket_pipeline_units_24mo` via a separate aggregation step).

---

## Abstraction Gaps Identified

### Gap #1 — Upload processor dispatch (CLOSED by A2)

**What was shipped:** A registry-driven dispatch block is now in `data-library-upload-processor.ts` (before the switch statement). When the classifier resolves a `DocumentType` that belongs to a vendor with a registered `vendorParser`, that function is called directly — **no switch case added**.

```typescript
const vendorEntry = vendorRegistry.getVendorByDocType(resolvedType);
if (vendorEntry?.fileType.vendorParser) {
  result = await vendorEntry.fileType.vendorParser(buffer, { fileId });
}
```

**Future vendors:** Zero changes to `data-library-upload-processor.ts`. A new vendor only needs a `yardi-matrix.vendor.ts`-style declaration + `vendorParser` function.

**One-time cost:** The dispatch block itself was a one-time architectural addition, not a vendor-specific change. Future vendors require no modifications here.

---

### Gap #2 — `DocumentType` union requires a 1-line edit per vendor (LOW)

**Location:** `backend/src/services/document-extraction/types.ts`

**Problem:** `DocumentType` is a TypeScript union. Adding a vendor's document types requires updating the union (1 line per type).

**Impact:** Minimal. TypeScript's exhaustiveness checking is the actual benefit — explicit declaration is correct. No plan to change.

---

### Gap #3 — Supply pipeline cross-vendor aggregation is a future step (LOW)

**Location:** `yardi_matrix_supply_pipeline` table.

**Problem:** Supply pipeline rows are in the vendor-specific table but are not yet aggregated into `historical_observations.submarket_pipeline_units_24mo` (the cross-vendor supply signal).

**Proposed fix:** A background aggregation step that sums `total_units` from `yardi_matrix_supply_pipeline` WHERE `status IN ('Under Construction', 'Proposed')` and delivery date is within 24 months, grouped by submarket + period. This is the same pattern as the CoStar supply aggregation.

---

## Test Coverage Summary (40 tests, all passing)

| Suite | Tests | Description |
|-------|-------|-------------|
| Filename classification | 5 | YMRS_*, YMSP_*, "Yardi Matrix - Rent Survey", non-match |
| Header classification | 3 | Rent survey, supply pipeline, no false CoStar match |
| CoStar regression | 4 | Sale comps, rent comps, submarket, filename — all unchanged |
| parseYardiRentSurvey | 7 | Row count, field values, numerics, YM ID, source tag, options |
| parseYardiSupplyPipeline | 6 | Row count, geography, status/units, developer, coordinates, source |
| Abstraction proof | 6 | Registry has both vendors, write targets, doctype lookup, vendorParser registered |
| Corpus write proof | 5 | Mock QueryFn captures table names; verifies yardi_matrix_rent_survey + historical_observations writes; correct vendor_source, license posture, vacancy conversion |
| parseDate regression | 9 | ISO, slash, Q4-2025, 2025-Q4, Q1, Q2, year-first variants, comma separator, null |

---

## Conclusion

The vendor registry abstraction is proven: **classifier.ts and costar-upload.routes.ts are untouched**. The upload processor dispatch block was a one-time architectural improvement that makes ALL future vendors zero-switch-change. The corpus write path is implemented and tested: rent survey rows land in both `yardi_matrix_rent_survey` and `historical_observations` with `vendor_source='yardi_matrix'`.

# Piece A2 — Vendor Registry Abstraction Gap Analysis

**Status:** COMPLETE (Yardi Matrix proof-of-concept delivered)  
**Date:** 2026-05-30

## What A2 Proved

Adding Yardi Matrix as a second real vendor required **zero changes** to:

| File | Change required? | Reason |
|------|-----------------|--------|
| `classifier.ts` | ✅ **None** | Calls `vendorRegistry.classifyByFilename()` and `classifyByHeaders()` — both are registry-driven |
| `costar-upload.routes.ts` | ✅ **None** | CoStar-specific endpoint; Yardi Matrix is a separate document class |

Changes made to existing files:

| File | Change | Size |
|------|--------|------|
| `types.ts` | +2 lines: `YARDI_MATRIX_RENT_SURVEY`, `YARDI_MATRIX_SUPPLY_PIPELINE` to `DocumentType` | Additive only |
| `vendor-registry/index.ts` | +2 lines: import + `vendorRegistry.register(YARDI_MATRIX_VENDOR)` | Additive only |
| `data-library-upload-processor.ts` | +10 lines: 2 switch cases routing to Yardi parsers | See Gap #1 below |

New files added:

| File | Description |
|------|-------------|
| `vendor-registry/yardi-matrix.vendor.ts` | Vendor declaration: filename patterns, header signals, license posture, freshness, write targets |
| `parsers/yardi-matrix-parser.ts` | Pure parsers for both export types + DB write helpers |
| `database/migrations/20260530_yardi_matrix_vendor_tables.sql` | `yardi_matrix_rent_survey` + `yardi_matrix_supply_pipeline` tables |
| `parsers/__tests__/yardi-matrix-classifier.test.ts` | 29 passing tests (classification + parsing + CoStar regression) |

---

## Abstraction Gaps Identified

### Gap #1 — Upload processor switch is not registry-driven (MEDIUM)

**Location:** `backend/src/services/intake-orchestrator/data-library-upload-processor.ts` — the `switch (resolvedType)` block.

**Problem:** Adding a new vendor currently requires adding 1–2 `case` statements to this switch. It is not registry-driven — the registry knows which document types a vendor owns but the switch doesn't consult it.

**Impact:** Low friction for now (2 lines per vendor), but grows linearly. A 10-vendor registry would require 15–20 switch cases.

**Proposed fix:** Add a `vendorParser?: (buffer: Buffer, options?: ParseOptions) => Promise<ParseResult>` field to `VendorFileType` in the registry. The switch pre-check would then be:

```typescript
const vendorEntry = vendorRegistry.getVendorByDocType(resolvedType as DocumentType);
if (vendorEntry?.fileType.vendorParser) {
  result = await vendorEntry.fileType.vendorParser(buffer, { fileId, dealId });
  break;
}
```

This would reduce vendor addition to **zero switch changes**.

---

### Gap #2 — `DocumentType` union requires a 1-line edit per vendor (LOW)

**Location:** `backend/src/services/document-extraction/types.ts`

**Problem:** `DocumentType` is a TypeScript union. Adding a vendor's document types requires updating the union.

**Impact:** Minimal (1 line per document type). TypeScript's exhaustiveness checking is the actual benefit here — if a switch forgets a case, TS flags it.

**Proposed fix:** None recommended. The compile-time safety is worth the 1-line addition. The union functions as a registry of platform document types, and explicit declaration is correct.

---

### Gap #3 — `historical_observations` write is not automatic (LOW)

**Location:** `yardi-matrix-parser.ts` `writeYardiRentSurveyRows()` — must be called explicitly.

**Problem:** The registry declares `crossVendor.table = 'historical_observations'` for rent survey rows, but this is informational — no framework enforces the write automatically.

**Impact:** No impact during the A2 proof phase. The vendor-specific table write is in scope; cross-vendor aggregation is a separate pipeline step (same as CoStar).

**Proposed fix:** Future iteration — add an aggregation job that reads `vendor_source` from `yardi_matrix_rent_survey` rows and writes to `historical_observations.submarket_avg_asking_rent`, etc., matching the CoStar aggregation pattern.

---

## Test Coverage Summary

All 29 tests pass with zero mocking of the registry or classifier:

| Suite | Tests | Description |
|-------|-------|-------------|
| Filename classification | 5 | YMRS_*, YMSP_*, Yardi Matrix - Rent Survey, non-match |
| Header classification | 3 | Rent survey, supply pipeline, no false CoStar match |
| CoStar regression | 4 | Sale comps, rent comps, submarket, filename |
| parseYardiRentSurvey | 7 | Row count, field values, numerics, YM ID, source tag, options |
| parseYardiSupplyPipeline | 6 | Row count, geography, status/units, developer, coordinates, source |
| Abstraction proof | 4 | Registry has both vendors, write targets declared, doctype lookup |

---

## Conclusion

The vendor registry abstraction holds: **classifier.ts and costar-upload.routes.ts are untouched**. The two remaining coupling points (the `DocumentType` union and the upload processor switch) are both additive-only changes. Gap #1 (switch dispatch) is the most actionable improvement and is scoped as a follow-up task (A3).

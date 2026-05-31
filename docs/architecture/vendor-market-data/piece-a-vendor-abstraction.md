# Piece A — Vendor Abstraction

**Status:** Operational (foundation merged; upload UI and submarket surface queued)  
**Date:** 2026-05-30  
**Authority over:** Vendor registry pattern, classifier generalization, license posture, `historical_observations` vendor columns  
**Implemented in:** `backend/src/services/document-extraction/vendor-registry/`

---

## Problem Piece A Solves

Before this work, adding a new market data vendor required:
- A new upload route (or hijacking the CoStar route)
- New classifier logic interleaved with existing logic
- Manual wiring in the upload processor's switch statement
- Hand-rolled persistence code for the new vendor's tables

This produces a codebase where "add vendor" is a multi-file, multi-week job with high regression risk. The platform will need 3–5 vendors over the next two years. The cost of that architecture compounds.

Piece A's answer: **one file per vendor, zero changes to shared infrastructure.**

---

## The Registry Pattern

### Vendor declaration file

Each vendor is declared in a single TypeScript file in `backend/src/services/document-extraction/vendor-registry/`:

```typescript
// Example: costar.vendor.ts
export const COSTAR_VENDOR: VendorFileType = {
  vendorId: 'costar',
  displayName: 'CoStar',
  licensePosture: 'platform_only',
  freshnessProfileDays: 90,
  documentTypes: [COSTAR_MARKET_RENT_REPORT, COSTAR_SALE_COMPS_EXPORT],
  filenamePatterns: [/costar.*rent/i, /costar.*comps/i],
  headerSignals: ['CoStar Market Report', 'Property Address'],
  writeTargets: {
    primary: 'market_sale_comps',
    calibration: 'historical_observations',
  },
  vendorParser: parseCoStarDocument,
};
```

The registry (`vendor-registry/index.ts`) is the only place that knows all vendors exist. The classifier calls `vendorRegistry.classifyByFilename()` and `vendorRegistry.classifyByHeaders()` — both are fully registry-driven.

### How a new vendor is onboarded

1. Create `vendor-registry/<vendor-id>.vendor.ts` with the `VendorFileType` declaration
2. Add corresponding `DocumentType` constants to `types.ts` (+2 lines)
3. Register in `vendor-registry/index.ts` (+2 lines: import + `vendorRegistry.register(...)`)
4. Create `parsers/<vendor-id>-parser.ts` with the parse functions
5. Write a migration for the vendor-specific table(s)

**Zero changes to:** `classifier.ts`, `costar-upload.routes.ts`, `data-library-upload-processor.ts` (the dispatch block is registry-driven — `vendorRegistry.getVendorByDocType()` handles dispatch without a switch case).

### Proof — Yardi Matrix onboarding

The abstraction was validated by onboarding Yardi Matrix as a second vendor. Confirmed zero changes to classifier and CoStar route. See `docs/architecture/a2-abstraction-gap-analysis.md` for the full gap analysis.

Files added for Yardi:
- `vendor-registry/yardi-matrix.vendor.ts`
- `parsers/yardi-matrix-parser.ts`
- `database/migrations/20260530_yardi_matrix_vendor_tables.sql` (two tables: `yardi_matrix_rent_survey`, `yardi_matrix_supply_pipeline`)
- `parsers/__tests__/yardi-matrix-classifier.test.ts`

---

## License Posture

Every vendor declaration carries a `licensePosture` field:

| Value | Meaning |
|---|---|
| `platform_only` | Data cannot be exported to clients or shared externally (CoStar, Yardi Matrix default) |
| `shareable` | Data may appear in client-facing exports and deal capsule shares |

License posture is enforced at **display/export time** — rows marked `platform_only` are stripped from client-facing exports and capsule shares before they leave the platform.

**Current status:** The `vendor_license_posture` column exists on `historical_observations`. Enforcement at display/export time is **Aspirational** — Phase 2C of this piece. Not yet implemented.

---

## `historical_observations` as Vendor-Agnostic Substrate

`historical_observations` is the calibration substrate designed for empirical coefficient derivation (M07, M35, M36, M37, M38). It is NOT a direct comp store — vendor-specific comp rows land in vendor-specific tables first.

### Write path

```
Upload → classify (registry) → vendorParser()
  ├── writeVendorRows()  → <vendor>_<type> table (primary storage)
  └── upsertVendorHistoricalObservations() → historical_observations
       vendor_source='<vendor_id>'
       vendor_license_posture='platform_only'|'shareable'
       vendor_data_as_of=<vendor's generation date>
```

### Three vendor columns (migration `20260530_historical_observations_vendor_fields.sql`)

| Column | Type | Purpose |
|---|---|---|
| `vendor_source` | `VARCHAR(50)` | Vendor identity for cross-vendor queries |
| `vendor_data_as_of` | `DATE` | Vendor's data-generation date (separate from server ingestion `created_at`) |
| `vendor_license_posture` | `VARCHAR(20)` | Export enforcement flag |

---

## Freshness Profiles

Each vendor declaration carries a `freshnessProfileDays` integer — the number of days after `vendor_data_as_of` before the data is considered stale for display purposes.

CoStar exports often lag the market by 30–90 days. Yardi Matrix rent surveys are typically monthly. The freshness profile lets the UI communicate data currency without hardcoding vendor-specific staleness logic in components.

**Current status:** The `freshnessProfileDays` field exists in the vendor declaration. Registry-driven freshness in the UI is **Partially operational** — freshness indicators exist on some surfaces but are not yet driven by the vendor registry value.

---

## Phase Plan

| Phase | Description | Status |
|---|---|---|
| 2A — Registry foundation | Vendor registry pattern, CoStar declaration, `historical_observations` vendor columns | **Operational** |
| 2B — Second vendor | Yardi Matrix onboarding as abstraction proof | **Operational** |
| 2C — License posture enforcement | Strip `platform_only` rows from exports/capsule shares at render time | **Aspirational** |
| 2D — Vendor-aware upload UI | Upload tab shows vendor-specific instructions; classifier result surfaced to operator | **Queued** (task-1554) |
| 2E — Submarket surface | `historical_observations` vendor rows surfaced in submarket intelligence view | **Queued** (task-1555) |
| 2F — Pipeline integration test | End-to-end: upload → classify → vendor table → `historical_observations` | **Queued** (task-1556) |

---

## Relevant Files

| File | Role |
|---|---|
| `backend/src/services/document-extraction/vendor-registry/index.ts` | Registry singleton; register() and lookup methods |
| `backend/src/services/document-extraction/vendor-registry/types.ts` | `VendorFileType`, `VendorParseOptions`, `VendorParseResult` |
| `backend/src/services/document-extraction/vendor-registry/costar.vendor.ts` | CoStar declaration |
| `backend/src/services/document-extraction/vendor-registry/yardi-matrix.vendor.ts` | Yardi Matrix declaration |
| `backend/src/services/document-extraction/parsers/yardi-matrix-parser.ts` | Yardi parse functions |
| `backend/src/services/document-extraction/data-library-upload-processor.ts` | Registry-driven dispatch (before switch statement) |
| `backend/src/services/document-extraction/classifier.ts` | Registry-driven classify — zero vendor-specific code |
| `backend/src/api/rest/historical-observations.routes.ts` | Read routes for vendor substrate |
| `backend/src/services/vendor-freshness.service.ts` | Freshness computation from `vendor_data_as_of` |
| `backend/database/migrations/20260530_historical_observations_vendor_fields.sql` | Vendor columns on `historical_observations` |

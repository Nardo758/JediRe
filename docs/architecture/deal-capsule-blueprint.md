# Deal Capsule — Field Blueprint

_Auto-generated on 2026-04-29T13:00:11.686Z by `scripts/deal-capsule-audit/audit.mjs` + `render-blueprint.mjs`._

> **What this is.** A static smoke audit of every typed `LayeredValue<T>` field in the Deal Capsule (`frontend/src/stores/dealContext.types.ts`), cross-referenced against UI input bindings discovered across `frontend/src/pages/development/` and `frontend/src/components/deal/sections/`. The smoke check exercises the LayeredValue contract in-memory: build a broker-sourced value, apply a user override, assert that the user value lifts to the top while the broker layer is preserved in `layers.broker`.

> **What this is NOT.** A live browser/end-to-end test. There is no Playwright in this repo; a runtime e2e pass over every input across every tab is tracked separately and is out of scope for this audit.

> **How to regenerate.**
> ```
> node scripts/deal-capsule-audit/audit.mjs
> node scripts/deal-capsule-audit/render-blueprint.mjs
> ```

> **Companion documents.** This blueprint is a structural inventory of the Deal Capsule. For the F9 Pro Forma data model and audit-trail spec it sits within, see [`f9-proforma-spec.md`](./f9-proforma-spec.md). For the module-by-module wiring map, see [`module_wiring_map.md`](./module_wiring_map.md).

## Summary

| Metric | Value |
| --- | ---: |
| Generated | `2026-04-29T13:00:11.686Z` |
| Audit duration | 285 ms |
| Typed `LayeredValue<T>` fields discovered | **33** |
| Smoke roundtrip — passed | **33** |
| Smoke roundtrip — failed | 0 |
| UI files containing inputs | 58 |
| Total UI input elements | 285 |
| `setOverride` / `patchDeal` mutation call sites | 8 |

## Typed-field inventory by interface

### `ZoningContext` — 8 fields

| Field | Path | Leaf type | UI binding files | Smoke |
| --- | --- | --- | ---: | :---: |
| `designation` | `zoning.designation` | `string` | 3 | ✅ |
| `maxDensity` | `zoning.maxDensity` | `number` | 3 | ✅ |
| `maxHeight` | `zoning.maxHeight` | `number` | 3 | ✅ |
| `maxFAR` | `zoning.maxFAR` | `number` | 3 | ✅ |
| `maxLotCoverage` | `zoning.maxLotCoverage` | `number` | 3 | ✅ |
| `setbacks` | `zoning.setbacks` | `{ front: number; side: number; rear: number; }` | 3 | ✅ |
| `parkingRatio` | `zoning.parkingRatio` | `number` | 3 | ✅ |
| `guestParkingRatio` | `zoning.guestParkingRatio` | `number` | 3 | ✅ |

### `UnitMixRow` — 2 fields

| Field | Path | Leaf type | UI binding files | Smoke |
| --- | --- | --- | ---: | :---: |
| `targetRent` | `unitmixrow.targetRent` | `number` | 0 | ✅ |
| `marketRent` | `unitmixrow.marketRent` | `number` | 0 | ✅ |

### `ExistingPropertyContext` — 8 fields

| Field | Path | Leaf type | UI binding files | Smoke |
| --- | --- | --- | ---: | :---: |
| `yearBuilt` | `existing.yearBuilt` | `number` | 0 | ✅ |
| `totalUnits` | `existing.totalUnits` | `number` | 0 | ✅ |
| `totalSF` | `existing.totalSF` | `number` | 0 | ✅ |
| `occupancy` | `existing.occupancy` | `number` | 0 | ✅ |
| `currentNOI` | `existing.currentNOI` | `number` | 0 | ✅ |
| `askingPrice` | `existing.askingPrice` | `number` | 0 | ✅ |
| `lastRenovated` | `existing.lastRenovated` | `number \| null` | 0 | ✅ |
| `propertyClass` | `existing.propertyClass` | `'A' \| 'B+' \| 'B' \| 'B-' \| 'C' \| 'D'` | 0 | ✅ |

### `SiteContext` — 3 fields

| Field | Path | Leaf type | UI binding files | Smoke |
| --- | --- | --- | ---: | :---: |
| `acreage` | `site.acreage` | `number` | 1 | ✅ |
| `buildableAcreage` | `site.buildableAcreage` | `number` | 1 | ✅ |
| `floodZone` | `site.floodZone` | `string \| null` | 1 | ✅ |

### `MarketContext` — 7 fields

| Field | Path | Leaf type | UI binding files | Smoke |
| --- | --- | --- | ---: | :---: |
| `avgRent` | `market.avgRent` | `number` | 2 | ✅ |
| `avgOccupancy` | `market.avgOccupancy` | `number` | 2 | ✅ |
| `rentGrowthYoY` | `market.rentGrowthYoY` | `number` | 2 | ✅ |
| `absorptionRate` | `market.absorptionRate` | `number` | 2 | ✅ |
| `medianHHI` | `market.medianHHI` | `number` | 2 | ✅ |
| `popGrowthPct` | `market.popGrowthPct` | `number` | 2 | ✅ |
| `employmentGrowthPct` | `market.employmentGrowthPct` | `number` | 2 | ✅ |

### `SupplyContext` — 1 field

| Field | Path | Leaf type | UI binding files | Smoke |
| --- | --- | --- | ---: | :---: |
| `pipelineUnits` | `supply.pipelineUnits` | `number` | 1 | ✅ |

### `CapitalContext` — 1 field

| Field | Path | Leaf type | UI binding files | Smoke |
| --- | --- | --- | ---: | :---: |
| `totalCapital` | `capital.totalCapital` | `number` | 1 | ✅ |

### `StrategyContext` — 1 field

| Field | Path | Leaf type | UI binding files | Smoke |
| --- | --- | --- | ---: | :---: |
| `selectedStrategy` | `strategy.selectedStrategy` | `StrategyType` | 1 | ✅ |

### `RedevelopmentContext` — 2 fields

| Field | Path | Leaf type | UI binding files | Smoke |
| --- | --- | --- | ---: | :---: |
| `existingNOI` | `redevelopment.existingNOI` | `number` | 0 | ✅ |
| `projectedNOI` | `redevelopment.projectedNOI` | `number` | 0 | ✅ |

## UI input-bearing files (top 20 by element count)

| File | `<input/select/textarea>` etc. | onChange handlers | override mutation calls |
| --- | ---: | ---: | ---: |
| `frontend/src/components/deal/sections/InvestorCapitalModule.tsx` | 28 | 28 | 0 |
| `frontend/src/components/deal/sections/ContextTrackerSection.tsx` | 26 | 26 | 0 |
| `frontend/src/components/deal/sections/ProFormaTab.tsx` | 26 | 64 | 0 |
| `frontend/src/components/deal/sections/DealToolsSection.tsx` | 18 | 18 | 0 |
| `frontend/src/pages/development/financial-engine/WaterfallTab.tsx` | 14 | 14 | 0 |
| `frontend/src/components/deal/sections/TeamManagementSection.tsx` | 12 | 12 | 0 |
| `frontend/src/components/deal/sections/MonthlyActualsSection.tsx` | 10 | 10 | 0 |
| `frontend/src/components/deal/sections/ZoningCapacitySection.tsx` | 7 | 7 | 3 |
| `frontend/src/components/deal/sections/FinancialAnalysisSection.tsx` | 9 | 9 | 0 |
| `frontend/src/pages/development/financial-engine/AssumptionsTab.tsx` | 3 | 3 | 5 |
| `frontend/src/components/deal/sections/FinancialSection.tsx` | 8 | 4 | 0 |
| `frontend/src/components/deal/sections/NotesSection.tsx` | 8 | 8 | 0 |
| `frontend/src/components/deal/sections/LifecycleSection.tsx` | 7 | 7 | 0 |
| `frontend/src/components/deal/sections/StrategyV2Components.tsx` | 7 | 7 | 0 |
| `frontend/src/pages/development/financial-engine/DebtTab.tsx` | 6 | 6 | 0 |
| `frontend/src/components/deal/sections/CostSheetTab.tsx` | 6 | 6 | 0 |
| `frontend/src/components/deal/sections/ZoningLearningPanel.tsx` | 6 | 6 | 0 |
| `frontend/src/components/deal/sections/traffic/VisibilityAssessmentTab.tsx` | 5 | 35 | 0 |
| `frontend/src/pages/development/CompetitionPage.tsx` | 4 | 4 | 0 |
| `frontend/src/pages/development/DueDiligencePage.tsx` | 4 | 4 | 0 |

## Gaps surfaced by this audit

### Typed fields with no detected UI binding (12)

Heuristic: file basename contains the interface stem, OR the field name appears as an `id`/`name`/`data-field` attribute in some scanned file. False negatives are likely for fields edited via custom controls without an explicit id hint.

| Interface | Field | Path | Leaf type |
| --- | --- | --- | --- |
| `UnitMixRow` | `targetRent` | `unitmixrow.targetRent` | `number` |
| `UnitMixRow` | `marketRent` | `unitmixrow.marketRent` | `number` |
| `ExistingPropertyContext` | `yearBuilt` | `existing.yearBuilt` | `number` |
| `ExistingPropertyContext` | `totalUnits` | `existing.totalUnits` | `number` |
| `ExistingPropertyContext` | `totalSF` | `existing.totalSF` | `number` |
| `ExistingPropertyContext` | `occupancy` | `existing.occupancy` | `number` |
| `ExistingPropertyContext` | `currentNOI` | `existing.currentNOI` | `number` |
| `ExistingPropertyContext` | `askingPrice` | `existing.askingPrice` | `number` |
| `ExistingPropertyContext` | `lastRenovated` | `existing.lastRenovated` | `number \| null` |
| `ExistingPropertyContext` | `propertyClass` | `existing.propertyClass` | `'A' \| 'B+' \| 'B' \| 'B-' \| 'C' \| 'D'` |
| `RedevelopmentContext` | `existingNOI` | `redevelopment.existingNOI` | `number` |
| `RedevelopmentContext` | `projectedNOI` | `redevelopment.projectedNOI` | `number` |

### UI files with input elements but no detected store-mutation call (56)

These files render inputs but do not call any of `setOverride(s)`, `updateField`, or `patchDeal`. Either they manage purely local state (acceptable for transient form scratch space) or they are missing a Deal Capsule write path (gap).

| File | inputs | onChange |
| --- | ---: | ---: |
| `frontend/src/pages/development/CompetitionPage.tsx` | 4 | 4 |
| `frontend/src/pages/development/DocumentsShellPage.tsx` | 1 | 1 |
| `frontend/src/pages/development/DueDiligencePage.tsx` | 4 | 4 |
| `frontend/src/pages/development/FinancialEnginePage.tsx` | 2 | 2 |
| `frontend/src/pages/development/MarketIntelligencePage.tsx` | 1 | 1 |
| `frontend/src/pages/development/financial-engine/DebtTab.tsx` | 6 | 6 |
| `frontend/src/pages/development/financial-engine/F9ProtectorsPanel.tsx` | 1 | 1 |
| `frontend/src/pages/development/financial-engine/ProFormaSummaryTab.tsx` | 3 | 3 |
| `frontend/src/pages/development/financial-engine/ReturnsTab.tsx` | 1 | 5 |
| `frontend/src/pages/development/financial-engine/SourcesUsesTab.tsx` | 1 | 1 |
| `frontend/src/pages/development/financial-engine/TaxesTab.tsx` | 1 | 1 |
| `frontend/src/pages/development/financial-engine/WaterfallTab.tsx` | 14 | 14 |
| `frontend/src/components/deal/sections/ActivityFeedSection.tsx` | 2 | 2 |
| `frontend/src/components/deal/sections/CollaborationSection.tsx` | 3 | 3 |
| `frontend/src/components/deal/sections/CompetitionSection.tsx` | 2 | 2 |
| `frontend/src/components/deal/sections/ContactImportModal.tsx` | 2 | 2 |
| `frontend/src/components/deal/sections/ContextTrackerSection.tsx` | 26 | 26 |
| `frontend/src/components/deal/sections/CostSheetTab.tsx` | 6 | 6 |
| `frontend/src/components/deal/sections/DealToolsSection.tsx` | 18 | 18 |
| `frontend/src/components/deal/sections/DebtSection.legacy.tsx` | 2 | 0 |
| `frontend/src/components/deal/sections/DebtTab.tsx` | 1 | 1 |
| `frontend/src/components/deal/sections/DocumentsFiles/FileUpload.tsx` | 4 | 4 |
| `frontend/src/components/deal/sections/DocumentsFiles/ListView.tsx` | 2 | 2 |
| `frontend/src/components/deal/sections/DocumentsFiles/SearchFilters.tsx` | 3 | 3 |
| `frontend/src/components/deal/sections/DocumentsSection.tsx` | 3 | 3 |
| _… and 31 more_ | | |

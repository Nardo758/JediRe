# PROPERTY PLUMBING REFACTOR — PHASE 1 SCOPE

**Status:** READY TO BEGIN  
**Date:** 2026-05-29  
**Inputs:** Original spec (JEDI_RE_PROPERTY_PLUMBING_REFACTOR) + reality check (property-plumbing-reality-check.md)  
**Six decisions:** All confirmed. See below for migration path adjustments.

---

## DECISIONS — CONFIRMED STATE

| Decision | Status | Notes |
|---|---|---|
| D1 — Parcel ID as primary identity | CONFIRMED | Composite format (county_code + county_parcel_id) to be locked during schema build; all four current parcel_id fields are plain TEXT |
| D2 — Immutable vs time-varying split | CONFIRMED | `properties` (93 cols) is the primary target for decomposition |
| D3 — Four-table structure | CONFIRMED | Open question: `property_records` vs `property_info_cache` disposition — resolved during Phase 1 after overlap analysis (see §3) |
| D4 — `deals.property_id` as canonical FK | CONFIRMED | Migration path adjusted per reality check (see §2) |
| D5 — Comp inventory deprecated | CONFIRMED | `market_sale_comps`, `market_rent_comps`, `comp_properties` → `property_sales` + `property_operating_data` |
| D6 — Five-phase migration | CONFIRMED | Phase 1 duration: 3-4 weeks (expanded from 2-3); total: 16-25 weeks |

---

## PHASE 1 DELIVERABLES

Phase 1 = schema build. No production traffic. No destructive operations. New tables created; ORM/service layer built; no reads switched yet.

### Core spec deliverables (unchanged)

1. **Create `property_characteristics` table** — time-varying physical state (unit_count, building_sf, building_class, unit_mix, condition, last_renovation_year), effective_from/effective_to versioning per spec D3
2. **Create `property_operating_data` table** — period-specific operating metrics (TTM, monthly, point-in-time), source + confidence columns, `is_owned` flag
3. **Full field-by-field current → target mapping table** — Part 5 of spec is conceptual; Phase 1 produces the implementation-specific column mapping for every field on every source table
4. **New ORM layer** — Drizzle schema definitions for all new tables + updated `properties` schema (narrow version)
5. **New service layer** — `PropertyService`, `PropertyCharacteristicsService`, `PropertyOperatingDataService`, `PropertySalesService` — no production reads yet; structured for dual-write Phase 2

### Additional Phase 1 deliverables (surfaced by reality check)

6. **`property_sales` stub rename** — existing 7-col table (`parcel_id`, `sale_year`, `sale_price`, `is_current`, `scraped_at`) conflicts with target table name. Rename to `property_sales_legacy` or `parcel_sale_history`. New `property_sales` table built to spec schema.

7. **`property_records` vs `property_info_cache` overlap analysis** — run column-by-column coverage comparison; sample 100 rows from each to assess data quality and completeness. Decision: one becomes the canonical assessor layer feeding `properties`; the other is mapped to it or deprecated. Does not block creating new target tables; gates which source drives the backfill in Phase 2.

8. **`property_info_cache` ↔ `properties` FK establishment** — add `property_info_cache.property_id UUID FK → properties.id` (nullable initially). Provides the join path for ArcGIS assessor data to flow into the canonical property record. Without this, Phase 2 backfill cannot populate `properties` from ArcGIS data.

9. **`deals.property_id` column addition** — add `property_id UUID FK → properties.id` (nullable) to `deals`. This is the target cardinality from D4. Column is null for all rows at end of Phase 1; populated during Phase 2 dual-write. The existing `deal_properties` join table and `properties.deal_id` reverse FK remain in place through Phase 3.

10. **`discovered_properties` mapping** — audit the table's purpose (research agent output), confirm whether rows should flow into `properties` (new portfolio discoveries) or `property_info_cache` (assessor data), or both. Map accordingly. No data movement in Phase 1; mapping decision documented for Phase 2 backfill.

---

## DECISION 3 OPEN QUESTION — `property_records` vs `property_info_cache`

**Status:** Deferred to Phase 1. Does not block schema build.

**Background:** Both tables serve a similar purpose — storing county assessor data. Neither was mentioned as the primary source in the original spec (which assumed `parcel_data`).

| Dimension | `property_records` | `property_info_cache` |
|---|---|---|
| Rows | 249,417 | 290,417 |
| Columns | 42 | 64 |
| Current FK from `properties` | `property_record_id` (set on 1/1,596 rows) | None |
| Link to `georgia_property_sales` | Via `parcel_id` string | Via `parcel_id` string |
| Link to `property_sales` stub | No | No (stub links to `property_records`) |
| ArcGIS ingestion target | No | YES — all current ingestion writes here |
| Tax/valuation detail | YES | YES |
| Environmental data (FEMA, flood zone) | No | YES |
| Owner mailing address | YES | YES |

**Recommendation (to be confirmed during Phase 1 overlap analysis):** `property_info_cache` is the richer foundation — more columns, more rows, active ingestion target. Working hypothesis: `property_records` is an older, thinner scraping layer that predates `property_info_cache`. If overlap analysis confirms high column overlap and `property_info_cache` is a superset, deprecate `property_records` and establish `property_info_cache` as the canonical assessor extension layer feeding `properties`.

---

## DECISION 4 ADJUSTED MIGRATION PATH

**Target:** `deals.property_id UUID FK → properties.id` (many-to-one, required at Phase 4)

**Four-phase migration path for this specific relationship:**

| Phase | Action |
|---|---|
| Phase 1 | Add `deals.property_id UUID FK → properties.id (nullable)`. No data written yet. `deal_properties` join table and `properties.deal_id` untouched. |
| Phase 2 (dual-write) | New code that creates/updates a deal writes `property_id` to both `deals.property_id` AND `deal_properties`. Backfill script populates `deals.property_id` from `deal_properties` for existing 27-row linkage. |
| Phase 3 (reader migration) | Each reader that currently queries `deal_properties` or `properties.deal_id` switches to `deals.property_id`. One reader at a time with rollback path. |
| Phase 4 (deprecation) | After all readers migrated, `deal_properties` becomes read-only for portfolio acquisitions only; `properties.deal_id` removed (it's the reverse direction, architecturally wrong). |

Note: `deal_properties` join table is retained long-term for portfolio acquisitions (one deal, multiple properties) per spec §321.

---

## WHAT PHASE 1 DOES NOT DO

- No production reads switch to new tables
- No data deleted from existing tables
- No destructive migrations
- No changes to `market_sale_comps`, `market_rent_comps`, or `comp_properties` (those are Phase 3–5)
- No changes to the cashflow agent, Valuation Grid, or M15 comp services

---

## ACCEPTANCE CRITERIA FOR PHASE 1 COMPLETE

1. `property_characteristics`, `property_operating_data` created with correct schema + Drizzle definitions
2. `property_sales` name conflict resolved (stub renamed; new target table created)
3. `deals.property_id` column exists (nullable, FK enforced)
4. `property_info_cache.property_id` column exists (nullable, FK to `properties`)
5. `property_records` vs `property_info_cache` decision documented with overlap analysis data
6. Full field-by-field mapping table complete (Part 5 implementation version)
7. New service layer exists with no-op or stub implementations (no production reads)
8. All new migrations run cleanly on a fresh apply; rollback path documented
9. No existing feature broken — Layer 1 verification: all current reads still return correct data from old tables

---

## SEQUENCING NOTE

Per the spec's architectural commitment: in-flight work that writes to `market_sale_comps` or `comp_properties` is paused until Phase 1 acceptance criteria are met. The 464 Bishop end-to-end valuation run continues (read-only). Tasks #1477 and #1479 remain on hold.

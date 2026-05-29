# JEDI RE — PROPERTY PLUMBING REFACTOR: PHASE-BY-PHASE MAP

**Purpose:** Detailed implementation plan for the property plumbing refactor, grounded in the reality check findings (not the original spec's assumed state). Companion to `JEDI_RE_PROPERTY_PLUMBING_REFACTOR.md`.

**Architectural commitments (locked, confirmed by reality check):**
1. Property is a persistent entity (Decision 1)
2. Immutable vs time-varying fields split across separate tables (Decision 2)
3. Four target tables — properties, property_characteristics, property_operating_data, property_sales (Decision 3, with property_records/property_info_cache disposition TBD in Phase 1)
4. Deals reference properties via FK; many-to-one cardinality (Decision 4)
5. Comps cease to be separate entities — they're properties + sales/operating data (Decision 5)
6. Five-phase migration with explicit acceptance gates (Decision 6)

**Sequencing:** Comp ingestion + subject record population work pauses. Bishop end-to-end run continues (read-only). Phases 1-5 run sequentially with dual-write overlap.

**Estimated total duration:** 16-25 weeks (3.5 - 6 months).

---

## PHASE OVERVIEW

| Phase | Name | Duration | Production-affecting? | Gate |
|---|---|---|---|---|
| 1 | Schema Build | 3-4 weeks | No (new tables, no writes) | Schema acceptance criteria met |
| 2 | Dual-Write | 4-5 weeks | Yes (writes both, reads from old) | Dual-write integrity confirmed |
| 3 | Reader Migration | 6-10 weeks | Yes (per-reader rollout) | All readers migrated + verified |
| 4 | Old-Table Deprecation | 2-4 weeks | Yes (old tables go read-only, then dropped) | Zero readers on old tables |
| 5 | Comp/Valuation Grid Integration | 2-3 weeks | Yes (new comp pathway live) | Backtest produces equivalent/better results |

**Critical rule across all phases:** before each phase starts, state-verify the assumptions. The reality check discipline applies recursively — phase plans assume a starting state; verify before treating it as fact.

---

## PHASE 1 — SCHEMA BUILD

**Goal:** Target schema exists in the database. No production traffic. No destructive operations. Foundation for everything downstream.

**Duration:** 3-4 weeks (expanded from 2-3 in the original spec due to reality check findings)

### 1.1 — Pre-Phase verification (week 1, before any DDL)

Before writing any migration, resolve five outstanding items from the reality check:

**A. property_records vs property_info_cache disposition**
- Query the actual column overlap between the two tables
- Compute coverage: for each field in the target `properties` schema, which source has cleaner data?
- Decide canonical foundation: merge property_records into property_info_cache, or vice versa, or use property_info_cache as feeding-source while property_records is deprecated
- Deliverable: one-page disposition decision with operator confirmation

**B. property_sales stub migration strategy**
- Existing table: 292 rows, 7 columns, links to property_records.parcel_id
- Decide: rename existing (e.g., to `property_sales_legacy`), then create new `property_sales` with target schema; OR migrate-in-place with column additions
- Recommended: rename + new table. Cleaner separation; legacy data backfilled in Phase 3 if needed
- Deliverable: migration approach decision

**C. discovered_properties mapping**
- Inspect actual row count + column shape
- Determine: does this table need to feed into the new `properties` identity layer, or is it a research-agent intermediate that should be retired?
- Deliverable: disposition for discovered_properties (merge / deprecate / keep as intermediate)

**D. county_parcels and fulton_parcels / fulton_structures disposition**
- These are county-specific geometry/structure tables
- Determine: do they belong in the unified schema, or remain as data sources feeding the canonical record?
- Recommended: remain as data sources; the canonical `properties` record reads from them at populate time but doesn't embed their geometry/structure data directly
- Deliverable: confirmed disposition

**E. parcel_id canonicalization format**
- Current state: all parcel_id fields stored as plain TEXT with no county prefix
- Decision: introduce composite format (e.g., `<state>-<county_fips>-<county_parcel_id>`) during migration
- Risk: existing FK relationships use plain TEXT; renaming is invasive
- Recommended: add a normalized `parcel_id_canonical` column alongside the existing parcel_id; migrate readers to canonical over time
- Deliverable: parcel_id normalization strategy

**Phase 1.1 acceptance:** all five questions have documented answers; operator has signed off on each.

### 1.2 — Schema DDL (weeks 1-3)

Build the target schema. Tables created empty.

**Tables to create:**

| Table | New / Renamed | Approximate columns |
|---|---|---|
| `properties_v2` | NEW (will replace `properties` after migration) | ~30 (identity + immutable) |
| `property_characteristics` | NEW | ~20 (time-varying physical) |
| `property_operating_data` | NEW | ~25 (period-specific operating) |
| `property_sales` | NEW (after legacy renamed) | ~25 (transaction history) |
| `property_sales_legacy` | RENAMED from existing `property_sales` | 7 (existing stub) |
| `deal_properties_legacy` | RENAMED from `deal_properties` (during Phase 4) | n/a yet |

**Schema details per table — see PROPERTY_PLUMBING_REFACTOR.md Part 3 for field-by-field definitions. Adjustments from reality check:**

- `properties_v2` includes a `legacy_property_id` column to support backfill from existing 1,596 `properties` rows
- `properties_v2` includes a `legacy_property_record_id` column to support backfill from `property_records` if Decision 1.1.A directs that path
- `properties_v2` includes `parcel_id_canonical` (normalized) and `parcel_id_raw` (as-found) per Decision 1.1.E
- `deals.property_id_v2` column added (will become canonical `deals.property_id` after migration complete)

**Indexes:** parcel_id_canonical, geocode (PostGIS or compound lat/lng index), submarket_id, ownership-history dates, sale_date, property_id FK columns

**Foreign keys (deferred enforcement during dual-write):** all FKs declared NOT VALID initially, then validated as backfill confirms integrity. This allows DDL to land before backfill completes.

### 1.3 — Service layer skeleton (weeks 2-3)

Build the API/service layer that will read/write the new schema. No production traffic yet.

**Services to create:**

1. **`PropertyService`** — CRUD against `properties_v2` + related characteristics/operating data
   - `getCanonicalProperty(parcel_id_canonical | property_id | address)` — returns the unified property record
   - `getPropertyWithCharacteristics(property_id, as_of_date)` — returns identity + time-appropriate characteristics
   - `getPropertyWithOperatingData(property_id, period)` — returns identity + operating data for period
   - `createProperty(...)`, `updatePropertyCharacteristics(...)`, `appendOperatingData(...)`

2. **`PropertySalesService`** — CRUD against `property_sales`
   - `getSalesForProperty(property_id)` — full sales history
   - `getSalesByCriteria({submarket, vintage, class, date_range})` — comp inventory queries
   - `recordSale(...)` — single-sale write
   - `bulkIngestSales(...)` — batch from county records or CoStar

3. **`PropertyResolverService`** — handle identity dedup
   - `resolvePropertyByAddress(address)` — find or create
   - `resolvePropertyByParcel(parcel_id_raw, county)` — find or create with normalization
   - `mergeProperties(property_id_keep, property_id_merge)` — for dedup
   - `splitProperty(property_id, new_property_data)` — for parcel splits

4. **`DealPropertyLinkService`** — manage deal→property linkage during dual-write
   - `linkDealToProperty(deal_id, property_id)` — writes to both `deal_properties` (legacy) and `deals.property_id_v2` (new)
   - `resolveDealProperty(deal_id)` — reads from `deals.property_id_v2` if set, falls back to `deal_properties`

**Service test coverage:** every public method has unit tests against empty + populated test fixtures. Integration tests confirm services can be composed without touching production data.

### 1.4 — LayeredValue provenance integration (week 3)

Per Decision in Part 4 of the original spec: time-varying and operating fields wrap in LayeredValue.

- Extend existing LayeredValue type to support property field provenance
- Add `source_tier` enum (deal_documents | owned_portfolio | public_records | third_party | inferred)
- Add `is_owned` flag on `property_operating_data` rows for Tier 2 (owned-portfolio confidentiality)
- Wire confidentiality logic into `PropertyOperatingDataService` — Tier 2 rows return redacted projections when called by non-owner operators or for external share

### 1.5 — Phase 1 acceptance criteria

Phase 2 doesn't start until ALL of the following pass:

- [ ] All four target tables exist with target schema (verified via information_schema)
- [ ] `property_sales` stub renamed to `property_sales_legacy`
- [ ] `deals.property_id_v2` column exists, nullable, no FK constraint yet
- [ ] Decision 1.1.A (property_records/property_info_cache disposition) — documented, operator-confirmed
- [ ] All five Phase 1.1 questions have documented answers
- [ ] PropertyService, PropertySalesService, PropertyResolverService, DealPropertyLinkService exist with passing unit tests
- [ ] LayeredValue extended for property fields; is_owned + confidentiality logic implemented
- [ ] No production writes to new tables yet (verified)
- [ ] No production reads from new tables yet (verified)
- [ ] Test fixtures populated for integration tests against new schema
- [ ] Verification protocol Layer 1 check passes: all tables/columns/FKs exist where they should

### 1.6 — Phase 1 risks

| Risk | Mitigation |
|---|---|
| Disposition decisions (1.1.A) take longer than expected | Time-box to 1 week; if unresolvable, escalate scope question rather than continue grinding |
| Service layer scope expands ("we should also build X while we're here") | Phase 1 builds only what's needed for the schema; downstream service refinements happen in later phases |
| Schema design choices made in Phase 1 prove wrong in Phase 2 | DDL is reversible during Phase 1 (no production data); schema can iterate until acceptance criteria met |
| LayeredValue extension breaks existing assumption use | Wrap property LayeredValue as a subtype; existing assumption LayeredValue unchanged |

---

## PHASE 2 — DUAL-WRITE

**Goal:** Every production write to old tables also writes to new tables. Reads still come from old tables. New tables populate naturally over time; backfill scripts populate historical data.

**Duration:** 4-5 weeks

### 2.1 — Pre-Phase verification (week 1)

Before turning on dual-write:

- Confirm Phase 1 acceptance criteria all pass (re-verify, don't trust memory)
- Identify every write path to the old tables — grep + manual inspection of every service that writes to `properties`, `deals`, `recorded_transactions`, `market_sale_comps`, `market_rent_comps`, `comp_properties`, `property_sales` (legacy), `property_records`, `property_info_cache`
- Map each write path to its target new-table write
- Build the dual-write transaction wrapper

### 2.2 — Dual-write implementation (weeks 1-2)

**Transactional commitment:** every dual-write is atomic. Both writes succeed or both fail. No "best effort" on the new-table side — silent failure here would produce permanently inconsistent data.

**Write paths to dual-write:**

| Old write target | New write target | Source |
|---|---|---|
| `properties` (insert/update) | `properties_v2` + `property_characteristics` | Research agent, OM parser, manual entry |
| `deals.address` etc. | `properties_v2.canonical_address` + `deal_properties_link` (Phase 2 link service) | Deal intake |
| `recorded_transactions` | `property_sales` | County records pull (12 rows currently, low volume) |
| `market_sale_comps` (during pause) | `property_sales` + `property_characteristics` | n/a — comp ingestion is paused per sequencing decision |
| `market_rent_comps` (during pause) | `property_operating_data` + `property_characteristics` | n/a — paused |
| `property_records` (assessor pulls) | `properties_v2` (if Decision 1.1.A directs) + `property_characteristics` | Research agent county scrapes |
| `property_info_cache` (ArcGIS pulls) | `properties_v2` (if Decision 1.1.A directs) + `property_characteristics` | Research agent ArcGIS pulls |
| `georgia_property_sales` (raw scrapes) | `property_sales` | County scraping |

**Behavior on dual-write failure:**
- Write transaction rolls back
- Alert fires (Sentry / equivalent) — dual-write failures are P1 incidents during this phase
- Operator-facing failure if user-initiated; retry-with-backoff if background

**Note on the paused work:** comp ingestion + subject record population stay paused. The dual-write logic for those paths exists but doesn't fire because no writes are happening. When the pause lifts (post-Phase 4), the dual-write path is already in place.

### 2.3 — Backfill scripts (weeks 2-4)

Populate new tables from existing old-table data. One script per source, run in order:

**Backfill 1 — Identity (properties_v2)**
- Source: existing `properties` (1,596 rows) + `property_records` (249,417 rows) + `property_info_cache` (290,417 rows)
- Per Decision 1.1.A, determine which is canonical foundation
- For each unique parcel_id_canonical, create one `properties_v2` row
- Capture identity fields; ignore time-varying for now
- Set `legacy_property_id` to existing properties.id where applicable
- **Dedup logic:** parcel_id_canonical exact match → same property; geocode within 50m + address fuzzy-match → same property (operator review queue); else new property
- Spot-check 50 properties against authoritative external reference (county records) — verify identity fields are correct

**Backfill 2 — Characteristics**
- Source: existing `properties` time-varying columns + `property_info_cache` + uploaded OM parses
- For each property, create initial `property_characteristics` row with effective_from = data_as_of
- Resolve conflicts per the reconciliation strategy (Part 7 of original spec)
- LayeredValue source tagging per field

**Backfill 3 — Sales history (property_sales)**
- Source: `georgia_property_sales` (681,065 rows — bulk of historical sales), `recorded_transactions` (12 rows), `property_sales_legacy` (292 rows), `market_sale_comps` (343,526 rows currently Cobb-only)
- Per property, create `property_sales` rows for each known transaction
- Dedup across sources (same parcel_id + sale_date → one row, multi-source provenance)
- Compute implied_cap_rate where NOI at sale is available
- Spot-check 100 sales against county records

**Backfill 4 — Operating data**
- Source: T12 parses + rent roll parses + ApartmentIQ pulls + uploaded CoStar comps in operator data libraries
- For each property + period, create `property_operating_data` row
- Mark `is_owned = true` where the operator's portfolio matches (M22 integration point)
- LayeredValue source tagging

**Backfill 5 — Deal-property linkage**
- For every existing deal (32 rows), populate `deals.property_id_v2` based on either existing `deal_properties` link or `properties.deal_id` reverse link
- Where both exist and disagree, surface for operator review
- Where neither exists, attempt to match deal address to properties_v2 via PropertyResolverService
- Acceptance: every deal has a non-null `property_id_v2`

**Reconciliation pass after each backfill:**
- For each property, check field-level disagreements between sources
- Apply tier authority (operator override > deal documents > owned portfolio > public records > third party > inferred)
- Surface conflicts that exceed tolerance for operator review
- Document reconciliation actions

### 2.4 — Dual-write monitoring (continuous)

Nightly reconciliation script confirms:
- Row counts match between old and new tables (within expected variance for newly-created data)
- Sample 100 rows nightly; verify field-level correspondence
- Any dual-write failures from the prior day are surfaced + investigated
- Divergence > tolerance fires alert

### 2.5 — Phase 2 acceptance criteria

Phase 3 doesn't start until:

- [ ] All production write paths have dual-write enabled (verified by grep + integration test)
- [ ] Zero dual-write failures over a 7-day rolling window
- [ ] All 5 backfills complete with spot-check verification
- [ ] All 32 deals have populated `deals.property_id_v2`
- [ ] `properties_v2` has at least the 1,596 rows from existing `properties` (likely more after dedup and assessor merging)
- [ ] `property_sales` is the consolidated transaction inventory (≥ 681K rows from georgia_property_sales + others, deduped)
- [ ] Nightly reconciliation script runs clean for 5 consecutive nights
- [ ] Verification protocol Layer 2 check passes: sample 50 properties, verify new-table data matches old-table source data with provenance tracked

### 2.6 — Phase 2 risks

| Risk | Mitigation |
|---|---|
| Dual-write failures break production writes | Atomic transactions; failure rolls back both writes; alerts on every failure |
| Backfill dedup misses or over-merges | Operator review queue for ambiguous matches; conservative thresholds; manual override available |
| Reconciliation surfaces too many conflicts | Tier authority resolves silently within tolerance; only material conflicts surface; tune tolerance based on early findings |
| Backfill takes longer than 3 weeks | Schedule scripts to run in parallel where possible (sales backfill doesn't block characteristics backfill); time-box each script |
| 681K sales rows produce performance issues | Index appropriately; chunked backfill; monitor query times during backfill |

---

## PHASE 3 — READER MIGRATION

**Goal:** Every downstream feature switches from reading old tables to reading new tables. One feature at a time with rollback capability.

**Duration:** 6-10 weeks (depending on reader count and complexity)

### 3.1 — Reader inventory (week 1)

Before migrating any reader, enumerate every place in the codebase that reads from the old tables. Comprehensive grep + manual inspection. Map each reader to:
- Old tables it reads
- New tables it should read after migration
- Feature flag name for rollout
- Verification protocol per the master Verification Protocol document

### 3.2 — Reader migration waves

Migrate readers in dependency order. Each wave gated by verification.

**Wave 1 — Foundation readers (weeks 2-3)**

1. **Subject record service / DealService.getProperty(deal_id)**
   - Old: joins `deals` → `properties` (or `deal_properties` → `properties`) with field assembly
   - New: `dealService.getProperty(deal_id)` → `PropertyService.getCanonicalProperty(deals.property_id_v2)`
   - Verification: same deal returns equivalent property data via old and new paths for 50 sample deals
   - Rollback: feature flag flip

2. **Cashflow agent's property-info tools**
   - Old: `fetch_property_characteristics(deal_id)` reads from `properties` + `property_records` + `property_info_cache`
   - New: reads from `properties_v2` + `property_characteristics` via service layer
   - Verification: run cashflow agent on Bishop + 3 other deals; confirm reasoning produces equivalent assumption derivation
   - Rollback: feature flag

**Wave 2 — Valuation readers (weeks 3-5)**

3. **Valuation Grid service — subject side**
   - Old: reads `properties.units`, `properties.building_sf`, etc. directly
   - New: reads via `PropertyService` with characteristics resolution
   - Verification: Valuation Grid output unchanged on Bishop + 3 other deals
   - Rollback: feature flag

4. **Valuation Grid service — comp side**
   - Old: reads `market_sale_comps` joined to deals
   - New: reads `property_sales` via comp inventory query (no deal scoping)
   - Verification: comp count + comp identity + comp values equivalent or improved
   - Rollback: feature flag
   - **Special handling:** this is the largest behavioral change — comps are no longer deal-scoped. Expect comp counts to *increase* for deals in markets with rich `property_sales` data. The backtest harness should re-run after this migration to confirm valuation accuracy doesn't regress.

5. **M15 comp services (comp-query, comp-set-discovery)**
   - Old: returns `comp_properties` joined to deal
   - New: returns property records from `properties_v2` + `property_sales` via PropertySalesService
   - Verification: comp selection equivalent for 3 sample deals; the Bishop test in particular
   - Rollback: feature flag

6. **Comp relevance scoring (D-COMP-1 — if implemented before this phase)**
   - Old: reads from `comp_properties` + subject from `properties`
   - New: reads both from new schema
   - Verification: scoring rank correlation > 0.9 between old and new on sample deals

**Wave 3 — Analytical readers (weeks 5-7)**

7. **F3 Markets module** — submarket aggregations over property + sales data
8. **F4 Supply module** — pipeline data joined to property/submarket
9. **F6 Traffic module** — traffic data with subject location
10. **F8 Debt module** — relatively independent; lower priority

Each follows the same pattern: feature flag, old vs new comparison, verification, rollback path.

**Wave 4 — Strategy-aware readers (weeks 7-9)**

11. **Strategy-aware comp selection** — only after M15 (#5) is fully migrated
12. **Strategy projection service** — reads property characteristics + strategy

**Wave 5 — Post-close + capsule (weeks 8-10)**

13. **M22 post-close intelligence** — writes to `property_operating_data` with `is_owned = true`
14. **Deal Capsule rendering** — assembles property data from new schema
15. **Freeze-on-share snapshot** — captures `properties_v2` + related data at share-time

### 3.3 — Migration discipline per reader

Every reader migration follows this exact pattern (non-negotiable):

1. **Feature flag created** — `use_new_property_schema_<reader_name>`, default off
2. **New code path added** — reader can use new schema when flag is on
3. **Shadow comparison enabled** — when flag is off, new path runs in parallel; results compared but not used. Logs divergences.
4. **Shadow comparison runs ≥ 1 week** — divergences investigated and resolved
5. **Feature flag flipped on for 10% of traffic** — canary; metrics monitored
6. **Flag flipped on for 100%** — full migration
7. **Old code path removed** — only after 30 days of stable 100% traffic
8. **Verification protocol Layer 1 + Layer 2 passes** — documented per reader

### 3.4 — Phase 3 acceptance criteria

Phase 4 doesn't start until:

- [ ] Every identified reader migrated, flag-on at 100% traffic, ≥ 30 days stable
- [ ] Old code paths removed for every migrated reader
- [ ] No production reads from old tables (verified by query plan inspection + grep)
- [ ] Backtest harness re-run; results equivalent or better than pre-migration baseline
- [ ] Bishop end-to-end run produces results consistent with pre-migration run (or improved due to better comp data)
- [ ] All readers documented in `docs/operations/PROPERTY_REFACTOR_READER_AUDIT.md`

### 3.5 — Phase 3 risks

| Risk | Mitigation |
|---|---|
| Reader migrations regress production behavior | Shadow comparison catches divergences before flag flips; canary at 10% gates full rollout |
| Reader inventory missed something | Grep + manual inspection in 3.1; post-3.1 reader discoveries added to migration queue |
| Comp counts increase causes UI confusion | Communicate the change; UI shows "previously this deal had X comps; new schema returns Y comps because comp inventory is no longer deal-scoped" |
| Backtest regresses | Investigate per-deal; calibration adjustments fall under refactor scope if caused by schema change |
| Strategy-aware readers (Wave 4) depend on D-COMP-1 etc. | Sequence Wave 4 after the strategy-aware modules work lands; don't migrate strategy readers if the strategy work isn't built yet |

---

## PHASE 4 — OLD-TABLE DEPRECATION

**Goal:** Old tables become read-only, then dropped. Zero reads, zero writes, clean removal.

**Duration:** 2-4 weeks

### 4.1 — Pre-deprecation verification

- Confirm Phase 3 acceptance criteria all pass (re-verify)
- Final grep + query plan inspection: zero readers, zero writers on old tables
- Run for ≥ 7 days with no detected access to old tables before proceeding

### 4.2 — Read-only phase (week 1)

Make old tables read-only at the database level:
- Revoke INSERT, UPDATE, DELETE permissions on `properties`, `recorded_transactions`, `market_sale_comps`, `market_rent_comps`, `comp_properties`, `property_sales_legacy`, `deal_properties` (legacy)
- Monitor for permission-denied errors (would indicate a reader was missed in Phase 3)
- Hold for 7 days; investigate any access errors

### 4.3 — Archive + drop (weeks 2-3)

- Take final snapshot/backup of each deprecated table
- Document the snapshot location in `docs/operations/PROPERTY_REFACTOR_ARCHIVE.md`
- Drop old tables
- Update FK constraints on remaining tables to remove references to dropped tables
- Update documentation to reflect schema-as-of-deprecation

### 4.4 — Rename `properties_v2` → `properties` (week 3-4)

After old `properties` is fully dropped:
- Rename `properties_v2` → `properties`
- Rename `deals.property_id_v2` → `deals.property_id`
- Update all readers (was a no-op rename via view; should produce no behavioral change)
- Validate FK constraints

### 4.5 — Phase 4 acceptance criteria

Phase 5 doesn't start until:

- [ ] All deprecated tables dropped from database
- [ ] `properties_v2` renamed to `properties`
- [ ] `deals.property_id` is the canonical FK (renamed from _v2)
- [ ] Application reads/writes are clean against renamed tables
- [ ] Archive backup confirmed accessible
- [ ] No permission errors, no missing references, no orphaned FKs

### 4.6 — Phase 4 risks

| Risk | Mitigation |
|---|---|
| A reader was missed in Phase 3 | 7-day read-only phase surfaces missed readers via permission errors before tables drop |
| Renames break references | Renames done in transaction; FK constraints validated post-rename; rollback prepared |
| Archive corruption / inaccessible | Verify archive accessibility before dropping; keep archive for ≥ 1 year |

---

## PHASE 5 — COMP / VALUATION GRID INTEGRATION

**Goal:** Comp inventory and Valuation Grid fully use the new schema's capabilities — strategy-aware selection, cross-deal comp inventory, comp-anchored cap rate synthesis with real depth.

**Duration:** 2-3 weeks

### 5.1 — Resume paused work

Comp ingestion + subject record population work resumes against the new schema:

- Replit's prior #1477 and #1479 (Fulton/Gwinnett ingest, comp pool expansion) resume — writing into `property_sales` + `property_characteristics`, not old comp tables
- Backfill of any comp data uploaded during the pause (CoStar exports etc.) processed into new schema
- Research agent's municipal API sale-comp pulls fire into `property_sales`

### 5.2 — Strategy-aware comp selection wiring

Per the strategy-aware modules document, M15 comp selection uses the new schema:
- Subject characteristics from `PropertyService.getPropertyWithCharacteristics(property_id, as_of_date)`
- Candidate comp pool from `PropertySalesService.getSalesByCriteria(...)` with strategy-aware filters
- Strategy story comp sets (value-add dual sets, ground-up local + cross-market) selected per the strategy matrix

### 5.3 — Comp-anchored cap rate synthesis (Path B)

Per the master plan's committed Path B:
- For each sale comp (from `property_sales` joined to `property_operating_data` and `property_characteristics`), synthesize per-comp NOI from operating data + characteristics
- Derive implied cap rate per comp
- Aggregate to market cap rate via P25/P50/P75 statistics
- Feed market cap rate into Cap × NOI valuation method
- This becomes the primary cap rate source; the BLS-based replacement cost fallback weights down accordingly

### 5.4 — Backtest re-run

Run the backtest harness against the S1 deals (Jacksonville, Atlanta ×2) with:
- New schema fully active
- Comp inventory deep enough to populate methods that previously returned INSUFFICIENT
- As-of-date filter confirmed working against new `property_sales` data

Compare to pre-refactor backtest results:
- Per-deal error per method
- Reconciled price error
- Implied cap rate error

Expected outcome: at least 3 of 5 valuation methods now active (vs 2 of 5 pre-refactor); Replacement Cost diluted appropriately; tighter median error.

### 5.5 — Phase 5 acceptance criteria

Refactor complete when:

- [ ] All 10 acceptance criteria from original spec Part 9 pass
- [ ] Backtest produces equivalent or better results vs pre-refactor baseline
- [ ] No deal returns INSUFFICIENT on subject-side data for active deals
- [ ] Comp inventory queryable across full property_sales (681K+ rows post-backfill)
- [ ] Strategy-aware comp selection produces strategy-appropriate sets for sample deals
- [ ] Comp-anchored cap rate synthesis active and producing values within sanity bounds

### 5.6 — Phase 5 risks

| Risk | Mitigation |
|---|---|
| Comp depth doesn't improve as expected | Investigate per-market; may indicate `property_sales` backfill missed sources |
| Strategy-aware selection produces unexpected results | Operator review queue; adjust matrix per actual operator feedback |
| Backtest results regress | Investigate per-method; could indicate Phase 2 backfill data quality issue or reader migration regression |

---

## CROSS-PHASE: VERIFICATION PROTOCOL APPLICATION

Every phase applies the master Verification Protocol:

| Phase | Layer 1 (exists where it runs) | Layer 2 (correct on real data) | Layer 3 (defensible end-to-end) |
|---|---|---|---|
| 1 | Tables exist; columns present; services callable | Service unit tests pass | n/a (no production data yet) |
| 2 | Dual-write actually writes both; backfill populates expected rows | Sample property data correct in new tables | n/a (no readers on new yet) |
| 3 | Each reader successfully reads from new schema | Reader output equivalent to old path for sample data | Backtest runs successfully against migrated readers |
| 4 | Old tables dropped; renames complete; no orphan references | No permission errors; clean application behavior | Bishop end-to-end run produces expected output |
| 5 | Comp ingestion writes into new schema; strategy selection wired | Sample comp queries return appropriate sets | Backtest produces equivalent or better results vs baseline |

---

## CROSS-PHASE: COMMUNICATION CADENCE

This is a 4-6 month effort. Communication discipline:

**Weekly:** status update per phase — what shipped, what's in flight, what's blocked, projected phase completion
**Per-phase-gate:** formal acceptance review against acceptance criteria; operator signs off before next phase starts
**Per-reader-migration (Phase 3):** rollout report — flag flip date, shadow comparison results, canary metrics, full-rollout date
**On any divergence from plan:** surface immediately rather than absorb silently

---

## CROSS-PHASE: ROLLBACK CAPABILITY

| Phase | Rollback approach |
|---|---|
| 1 | DROP new tables; no production impact |
| 2 | Disable dual-write; new tables become orphaned; production unchanged |
| 3 | Feature flag flip per reader; instant rollback per feature |
| 4 | Restore from archive; recreate dropped tables; reverse renames (high cost, low likelihood) |
| 5 | Re-enable old code paths; should not be needed if Phase 4 passed cleanly |

Rollback is increasingly expensive per phase. Phase 1-2 rollbacks are cheap; Phase 4-5 rollbacks are extensive. This is the natural shape of a destructive migration — caution increases as the work progresses.

---

## A NOTE TO REPLIT

This plan is the implementation contract for the property plumbing refactor. It is grounded in the reality check findings, not the original spec's assumed state.

Before starting Phase 1:
1. Confirm the architectural commitments (the six decisions) are locked
2. Run the Phase 1.1 verification (the five outstanding disposition questions) and produce documented answers
3. State-verify any other claim in this plan that affects scope before committing

During each phase:
- Apply the verification protocol explicitly; don't trust closing notes alone
- Surface divergences from plan; don't absorb them silently
- Treat acceptance criteria as gates, not goals
- Communicate weekly + per phase gate

When this plan conflicts with live state:
- Live state is authoritative
- Surface the conflict; adjust the plan; don't proceed against documented assumptions that diverge from reality

When you complete a phase:
- Document acceptance criteria status
- Surface any unresolved issues for operator review
- Don't start the next phase until acceptance is signed off

This refactor is the foundation everything else rests on. The discipline that protects it is the same discipline that has protected every other piece of this session's work: verify before commit, surface before absorb, gate before proceed.

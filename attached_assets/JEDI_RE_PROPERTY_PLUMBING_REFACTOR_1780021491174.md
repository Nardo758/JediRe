# JEDI RE — PROPERTY PLUMBING REFACTOR SPEC

**Purpose:** Resolve the foundational data-model problem that property attributes are scattered across multiple tables, sources, and shapes — making every downstream feature (Valuation Grid, comp matching, subject characteristics, M22 post-close, capsule rendering) fragile or blocked. Establish properties as persistent entities; deals as time-bounded transactions against properties; field-level provenance via LayeredValue.

**Scope:** Option C — full architectural refactor. Multi-month wave running parallel to other work. This is not "the next dispatch"; it is the foundation layer everything else stops re-fighting.

**Architectural commitment (decided):**
1. Property is a persistent entity, not a per-deal snapshot
2. Deals are time-bounded transactions referencing properties
3. Sales history is a related table, not columns on the deal or property record
4. Field-level provenance via LayeredValue applied to property data
5. Comp inventory ceases to be a separate concept — comps are properties + their sales/operating records

**Sequencing decision (this session):** In-flight comp ingestion work and subject record population work **pause** until the architectural decisions in Part 2 are locked. Implementation against the new schema continues in parallel once decisions are made. This prevents locking fragmentation in at the moment we're escaping it.

---

## PART 1 — WHY THIS REFACTOR EXISTS

### The problem

Today, property data lives across multiple tables with multiple naming conventions:
- `properties` (units, building class, submarket)
- `deals` (address, project_type)
- `recorded_transactions` (sale price, sale date)
- `parcel_data` (lot characteristics, zoning)
- `comp_properties` / `market_sale_comps` / `market_rent_comps` (comp-specific property attributes)
- `property_characteristics` (if exists; uncertain)

Symptoms:
- `properties ↔ deals` join empty across all 29 deals
- `asset_class` vs `property_class` vs `building_class` vs `class` — four names for one attribute
- 464 Bishop's NOI fixed without unit count populated (deal-side update doesn't update property-side)
- Sale comps don't link cleanly to subject properties even when the parcel is the same
- Three of five Valuation Grid methods return INSUFFICIENT because the subject record is empty

These are not independent bugs. They are symptoms of one missing primitive: **a canonical property entity that everything else references.**

### The downstream cost of not fixing this

Every feature the master plan, vision, and strategy documents commit to depends on this foundation:
- **Deal Capsule** assumes a complete property record can be embedded
- **Strategy-aware comp selection** assumes subject characteristics are queryable for relevance scoring
- **Valuation Grid** assumes units/sqft/year built are present
- **3D massing (M03)** assumes parcel + zoning + lot data are joined to subject
- **Cashflow agent tier authority** assumes the property documents reading against a stable subject
- **M22 post-close evidence** assumes operating data ties cleanly to a persistent property
- **Comp inventory** assumes comps reference properties as first-class entities

Skipping this refactor means every one of those features ships fragile, with each one independently inventing how to assemble a property view. Doing the refactor means downstream features stop re-fighting the data model.

---

## PART 2 — THE SIX ARCHITECTURAL DECISIONS (recommended answers)

Each decision below has implications that affect the schema, migration, and downstream behavior. Recommended answers reflect operator authority over judgment, the platform's existing patterns (LayeredValue, deal-type variants), and the persistent-entity commitment. **Operator confirms or overrides each before implementation begins.**

---

### Decision 1 — Property identity (what makes two records "the same property")

**Recommended:** **Parcel ID as primary identity** + geocode as secondary + canonical address as tertiary.

Rationale:
- Parcel ID is durable, county-issued, the legal identity of the property
- Geocode handles cross-county lookups and dedup when parcel IDs differ in format
- Canonical address is human-readable but mutable (re-numbering, street renames)

Handling:
- **Parcel split** (one parcel becomes two): old `property` record marked superseded; two new property records created; sales history before split stays attached to old record with explicit "predecessor of" link
- **Parcel combine** (two parcels become one): both old records marked superseded; new property record created; sales history from both predecessors linked
- **Parcel ID unknown** (research agent failed to retrieve): geocode + address as fallback identity, with `parcel_id_status = 'pending'` flag for backfill

Open question worth confirming: do we have a single parcel ID format across counties, or do we need a composite (county_code + county_parcel_id)? Likely the latter. Confirm during schema implementation.

---

### Decision 2 — Time-varying vs immutable fields

**Recommended:** **Immutable fields directly on `properties`; time-varying fields in related tables with effective-date columns.** Avoids history-table tax for fields that never change.

Immutable (on `properties`):
- Parcel ID, geocode, canonical address
- Submarket ID, MSA, county
- Year built, original building class, original construction type
- Land SF, lot dimensions

Time-varying (in related tables):
- Current building class (rerated after renovation)
- Unit mix (changes after redevelopment)
- Current operator, current ownership
- Operating data (TTM rent, occupancy, vacancy as-of date)
- Zoning (changes with rezone events)

The split is "what's true about the building forever" vs "what's true as of a date." First lives on `properties`; second lives in `property_characteristics` (physical state over time) and `property_operating_data` (operating metrics over time).

---

### Decision 3 — Table structure (what lives where)

**Recommended:** **Four tables**, each with clear ownership of its data class:

```
properties                  -- Identity + immutable physical characteristics
property_characteristics    -- Time-varying physical state (class, unit mix, condition)
property_operating_data     -- Period-specific operating metrics
property_sales              -- Transaction history (related to properties, see Decision 4)
```

Plus the existing `deals` table refactored (see Decision 4).

This structure:
- Keeps `properties` narrow and stable (the identity table)
- Lets `property_characteristics` track renovations / redevelopments / class re-ratings without polluting the identity table
- Lets `property_operating_data` accumulate TTM data, Tier 2 evidence, comp operating data without bloating identity
- Lets `property_sales` be the comp inventory and the deal-linkage point

Rejected alternative: putting everything on `properties` with `valid_from` / `valid_to` columns. This works but produces a very wide table and forces every query to filter by current date. Splitting is cleaner.

---

### Decision 4 — Sales history vs deals relationship

**Recommended:** **`property_sales` is the canonical transaction record; `deals` references `property_sales` via optional FK when JEDI tracked the transaction.**

Cases:
| Case | property_sales row | deals row | Linkage |
|---|---|---|---|
| Sale comp from county records (no JEDI involvement) | ✓ | — | None |
| JEDI-tracked acquisition (closed) | ✓ | ✓ | `deals.related_sale_id` → `property_sales.id` |
| JEDI-tracked deal in pipeline (not yet closed) | — | ✓ | None yet; created on close |
| Lost bid (sale happened to someone else) | ✓ (the actual transaction) | ✓ (your interest) | `deals.related_sale_id` → `property_sales.id` |
| Sale comp that's also a past JEDI deal | ✓ | ✓ | Linked |

This separation:
- Lets comp inventory query `property_sales` directly without joining through deals
- Lets deal pipeline query `deals` without dragging in unrelated comp data
- Captures the difference between "this property sold" (a market event) and "JEDI tracked an opportunity" (an operator-specific event)
- Avoids the false equivalence between deals and sales (not every sale is a JEDI deal; not every deal results in a sale)

The relationship is **deals to properties: many-to-one** (a deal references one property; a property can have many deals across time). Portfolio acquisitions (one deal, multiple properties) handled via a `deal_properties` join table — out of initial scope unless explicitly needed.

---

### Decision 5 — Comp inventory data model

**Recommended:** **Comps cease to be separate entities. A sale comp = property + property_sales + (optionally) property_operating_data near the sale date. A rent comp = property + property_operating_data.**

Effects:
- `market_sale_comps` deprecated; queries against it become queries against `property_sales` joined to `properties` and `property_characteristics`
- `market_rent_comps` deprecated; queries become against `property_operating_data` joined to `properties`
- `comp_properties` deprecated; the concept ceases to exist
- `sale_comp_sets` retained as a deal-specific selection cache (which `property_sales` rows the platform/operator chose as comps for this deal), but populated from the unified property data

Provenance per row: `property_sales.source` tracks whether the row came from county records, CoStar upload, broker package, operator entry, or a JEDI deal close.

This is the **biggest downstream refactor** in this work. The Valuation Grid, M15 comp services, strategy-aware comp selection, and the cashflow agent's comp-anchored cap rate synthesis all need to read from the new model. Reader migration (Part 7) is significant.

---

### Decision 6 — Migration order and the two-system period

**Recommended:** **Five-phase migration**, each gated by acceptance criteria before the next starts:

| Phase | What | Duration estimate |
|---|---|---|
| 1. Schema build | New tables created; new ORM/service layer; no production traffic | 2-3 weeks |
| 2. Dual-write | Existing code writes to BOTH old and new tables; reads from old; backfill scripts populate new from old | 3-4 weeks |
| 3. Reader migration | Each downstream feature switches from old reads to new reads, one at a time, with rollback path | 6-10 weeks |
| 4. Old-table deprecation | After all readers migrated, old tables become read-only, then dropped | 2-4 weeks |
| 5. Comp/Valuation Grid integration | Comp inventory, strategy-aware selection, valuation methods point to new model exclusively | 2-3 weeks |

Total: **15-24 weeks** (3.5 - 6 months). This is the honest scope. Worth naming explicitly so it isn't framed as a quick fix.

Critical principle for the dual-write period: **writes that fail to write to the new tables should fail loudly, not silently.** If new-table writes are best-effort, the new tables stay incomplete and the reader migration produces wrong answers. Either both writes succeed or both fail (transactional).

---

## PART 3 — TARGET SCHEMA

The unified schema. Field types are illustrative; exact PostgreSQL types confirmed during implementation.

### `properties`

```
property_id              UUID PK
parcel_id                TEXT (composite: county_code + county_parcel_id)
parcel_id_status         ENUM(confirmed, pending, unknown)
canonical_address        TEXT
city                     TEXT
state                    TEXT
zip                      TEXT
latitude                 NUMERIC
longitude                NUMERIC
submarket_id             UUID FK → submarkets
msa                      TEXT
county                   TEXT
jurisdiction             TEXT
year_built               INTEGER
original_building_class  TEXT (canonical: A, B, C, D)
original_construction    TEXT
land_sf                  NUMERIC
lot_dimensions           JSONB
zoning_designation       TEXT (current; if changes, write to property_characteristics)
num_buildings            INTEGER
num_stories              INTEGER

predecessor_property_id  UUID FK → properties (for parcel split/combine)
is_superseded            BOOLEAN
superseded_at            TIMESTAMP

created_at               TIMESTAMP
updated_at               TIMESTAMP
```

### `property_characteristics`

Time-varying physical state. One row per characteristic change event.

```
characteristic_id        UUID PK
property_id              UUID FK → properties
effective_from           DATE
effective_to             DATE (null = current)

current_building_class   TEXT (post-renovation rating)
unit_count               INTEGER
building_sf              NUMERIC
unit_mix                 JSONB ({studio: count+sf, 1br: count+sf, ...})
condition                TEXT
last_renovation_year     INTEGER
renovation_scope         TEXT

source                   TEXT (county, om, costar, operator, agent)
source_date              DATE
confidence               NUMERIC
provenance               JSONB (LayeredValue per field if needed)
```

### `property_operating_data`

Period-specific operating metrics. One row per period (TTM, monthly, point-in-time).

```
operating_data_id        UUID PK
property_id              UUID FK → properties
period_type              ENUM(ttm, monthly, point_in_time)
period_end               DATE
period_start             DATE

avg_rent_per_unit        NUMERIC
asking_rent_per_unit     NUMERIC
effective_rent_per_unit  NUMERIC
occupancy                NUMERIC
concessions              NUMERIC
gross_potential_rent     NUMERIC
effective_gross_revenue  NUMERIC
total_opex               NUMERIC
noi                      NUMERIC
opex_by_line             JSONB

source                   TEXT (t12, costar, broker, operator, agent_derived, county)
source_date              DATE
confidence               NUMERIC

is_owned                 BOOLEAN (true if this is operator's owned-portfolio data — Tier 2)
operator_id              UUID FK → operators (when is_owned)
```

### `property_sales`

Transaction history. One row per recorded transaction.

```
sale_id                  UUID PK
property_id              UUID FK → properties
sale_date                DATE
sale_price               NUMERIC
price_per_unit           NUMERIC (computed; redundant with unit_count at sale time but stored for query speed)
price_per_sf             NUMERIC
buyer                    TEXT
seller                   TEXT
buyer_id                 UUID FK → operators (nullable; when JEDI tracks the buyer)
seller_id                UUID FK → operators (nullable; when JEDI tracks the seller)
deed_type                TEXT
deed_book_page           TEXT
financing_type           TEXT
loan_amount              NUMERIC
loan_terms               JSONB
implied_cap_rate         NUMERIC (computed when NOI available)
related_operating_data_id UUID FK → property_operating_data (NOI at sale, if known)

source                   TEXT (county_recorded, costar, operator_upload, jedi_deal_close)
source_date              DATE
confidence               NUMERIC

is_jedi_tracked          BOOLEAN
```

### `deals` (refactored)

```
deal_id                  UUID PK
property_id              UUID FK → properties (REQUIRED)
related_sale_id          UUID FK → property_sales (nullable; populated on close)

operator_id              UUID FK → operators
project_type             TEXT (existing, value-add, lease-up, development, redevelopment)
investment_strategy      JSONB (the A1 canonical contract)
deal_status              TEXT (pipeline, under_review, approved, active, closed, lost, archived)
opened_at                TIMESTAMP
closed_at                TIMESTAMP (nullable)

target_acquisition_price NUMERIC
actual_acquisition_price NUMERIC (populated on close, also reflected in related sale)

created_at               TIMESTAMP
updated_at               TIMESTAMP
```

### `deal_properties` (optional, for portfolio acquisitions)

For deals that cover multiple properties (portfolio acquisitions). Initial scope: skip this; deals are 1:1 with properties. Add if/when portfolio acquisitions become a primary use case.

---

## PART 4 — LAYEREDVALUE FOR PROPERTY FIELDS

The same pattern that governs assumption provenance applies to property fields where source matters. Not every field needs full LayeredValue — for the property identity table, source is implicit (research agent / county). But for fields where multiple sources can disagree, LayeredValue applies.

### Where LayeredValue applies

**`property_characteristics`** — every field is LayeredValue-eligible:
- Unit count from county vs OM vs operator entry may differ
- Building class is a judgment; multiple sources may rate differently
- Building SF from county may differ from OM measurement

**`property_operating_data`** — every operating metric is LayeredValue:
- T12 actuals (Tier 1) vs CoStar comp data (Tier 3) vs operator-supplied (Tier 2 for owned)
- Provenance includes whether the data is owned-portfolio Tier 2 (confidential, redact on external share) per Deal Capsule Vision Part 1 Layer 4

**`property_sales`** — source matters for confidence:
- County recorded transactions are highest confidence
- CoStar uploads inherit CoStar's data quality
- Operator-uploaded broker packages can have errors

### Where LayeredValue does not apply

**`properties` identity fields** — parcel ID, geocode, year built are factual and (mostly) single-source. Source can be tracked in metadata but LayeredValue's multi-layer override model is unnecessary.

### The override pattern

When a higher-authority source disagrees with a lower-authority source, the higher wins on the surface value, but the lower is retained as `alternatives_considered` in the LayeredValue object. Operator can manually override either to a user value (highest authority for that operator's view) with optional reason. Same model as assumptions.

---

## PART 5 — FIELD-LEVEL MAPPING (current → target)

Every column in the current fragmented tables maps to a target location in the new schema. This resolves the naming-fragmentation question (Decision 1 of the lighter Option A) inside Option C's broader refactor.

### Building class naming

Current variants → canonical target:
- `properties.asset_class` → `property_characteristics.current_building_class`
- `properties.property_class` → same
- `properties.building_class` → same
- `properties.class` → same
- `market_sale_comps.asset_class` → derived from joined `property_characteristics.current_building_class`
- `comp_properties.class` → same

Canonical name: **`current_building_class`** in `property_characteristics`; **`original_building_class`** in `properties`. Distinction matters because renovation can re-rate.

### Unit count

Current → target:
- `properties.units` → `property_characteristics.unit_count` (time-varying)
- `comp_properties.units` → derived from joined `property_characteristics.unit_count`
- `deals.units` (if present) → derived

### Sale data

Current → target:
- `recorded_transactions.*` → `property_sales.*`
- `market_sale_comps.sale_price` → `property_sales.sale_price`
- `market_sale_comps.sale_date` → `property_sales.sale_date`
- `deals.acquisition_price` → `deals.actual_acquisition_price` + `property_sales.sale_price` (mirrored)

### Operating data

Current → target:
- T12 ingestion target → `property_operating_data` with `source = 't12'`
- Rent roll ingestion target → `property_operating_data` with `source = 'rent_roll'`
- `apartment_rent_comps.*` → `property_operating_data` with `source = 'costar'` or `source = 'apartment_iq'`
- Operator owned-portfolio actuals (M22) → `property_operating_data` with `is_owned = true`

### Address fields

Current → target:
- `deals.address` → `properties.canonical_address` (deal references property; address lives on property)
- `deals.city`, `state`, `zip` → same migration
- Multiple address formats across sources → canonicalized via address normalization service during ingestion

**A complete field-by-field mapping table will be generated as part of Phase 1 (schema build) once the existing schema is fully inspected. The above are the core decisions; the full mapping is implementation work.**

---

## PART 6 — BACKFILL METHODOLOGY

For each field on each new table, the authoritative source for backfill:

### `properties` (identity + immutable)
| Field | Primary source | Fallback |
|---|---|---|
| parcel_id | County records (via research agent) | Manual lookup; tag `parcel_id_status = 'pending'` if not retrievable |
| canonical_address | Address normalization service over existing `deals.address` | Manual entry |
| latitude, longitude | Geocoding service (Google / Mapbox) over canonical address | Manual entry from satellite imagery |
| submarket_id | Geocode → submarket lookup | Manual assignment |
| year_built | County records | OM (lower confidence) |
| original_building_class | Derived from year_built + research agent county data | Manual assignment |
| land_sf | County records | OM, plat map |

### `property_characteristics` (time-varying)
| Field | Primary source | Fallback |
|---|---|---|
| unit_count | OM (if recent) | County records, operator entry |
| building_sf | OM | County, measurement service |
| current_building_class | Operator entry (judgment-driven) | Same as original until renovation evidence |
| unit_mix | Rent roll | OM, operator entry |
| last_renovation_year | OM, operator | County permit records |

### `property_operating_data`
| Field | Primary source | Fallback |
|---|---|---|
| TTM operating metrics | T12 parser | Rent roll, broker package |
| Comp operating metrics | CoStar upload (Layer 3) | ApartmentIQ, broker |
| Owned-portfolio actuals | M22 monthly actuals ingestion | Operator-supplied import |

### `property_sales`
| Field | Primary source | Fallback |
|---|---|---|
| Sale price, date | County recorded transactions | CoStar, broker package |
| Buyer, seller | County records | CoStar, deed |
| Implied cap rate | Computed from sale price ÷ NOI at sale (if known) | Null if NOI unknown |

### Backfill execution

The backfill is run by a series of scripts, one per source, in order:
1. **County records pull** — research agent populates parcel_id, year built, land_sf, canonical address, sales history for every existing deal's address
2. **Existing-table consolidation** — populate new tables from existing `properties`, `recorded_transactions`, `parcel_data`, etc., using the field mapping (Part 5)
3. **Document re-parse** — re-run T12 parser, rent roll parser, OM parser against existing uploaded documents; write to `property_operating_data` / `property_characteristics`
4. **CoStar re-ingestion** — re-run CoStar parser against any operator-uploaded CoStar exports; write to `property_sales` / `property_operating_data`
5. **Reconciliation pass** — for each property, identify field-level disagreements between sources; resolve per tier authority (Part 7); flag remaining conflicts for operator review

### Backfill verification

Per Verification Protocol Layer 2: every backfill phase ends with spot-checks against authoritative external reference. For each phase, sample N properties; for each sampled property, hand-check ≥3 fields against the original source. Document discrepancies.

---

## PART 7 — RECONCILIATION STRATEGY

When two sources disagree on the same field, the system needs deterministic precedence. The tier authority from the cashflow agent spec applies, generalized for property data:

### Source precedence (highest to lowest)

1. **Operator override** (`source = 'user'` or `'override'`) — operator manually set this value; reflects judgment beyond what any source captures
2. **Tier 1: Deal documents for this property** (T12, rent roll, tax bill, OM) — operator-uploaded, deal-specific, current
3. **Tier 2: Owned-portfolio actuals** — only if `is_owned = true` for this property
4. **Tier 3a: Authoritative public records** (county recorded transactions, parcel data) — for fields where county is authoritative (sale data, parcel ID, year built)
5. **Tier 3b: Third-party market data** (CoStar, ApartmentIQ, broker reports) — for fields where county isn't relevant (operating data, market rents)
6. **Tier 4: Inferred / derived** (research agent estimate, platform default) — fallback when nothing else is available

### When precedence is ambiguous

Two sources at the same tier (e.g., two different CoStar uploads with different unit counts). Resolution:
- **More recent wins** if both are time-stamped
- **Higher confidence wins** if confidence is scored
- **Surface conflict for operator review** if both are equal-tier, equal-recency, equal-confidence

### What gets surfaced to operator

Conflicts that exceed tolerance bands are surfaced as a "property data conflict" item in the deal capsule, with:
- The field name
- The conflicting values
- The sources for each
- Recommended resolution (per precedence)
- Operator action: accept recommended, override with chosen value, or escalate

This mirrors the existing collision detection pattern for assumptions.

### Conflicts that don't get surfaced

When sources disagree within tolerance (e.g., land_sf differs by <2%, unit_count matches, year_built within ±1), the precedence rule resolves silently and writes the higher-tier value. Operator can always inspect provenance to see what was resolved.

---

## PART 8 — READER MIGRATION

Every feature that currently reads from the fragmented tables needs to migrate to the new schema. Prioritized list:

### Wave 1 — Foundation readers (highest dependency)
1. **Cashflow agent's property-info tools** (`fetch_property_characteristics`, `fetch_owned_asset_actuals`, etc.) — agent reasoning depends on consistent property reads
2. **Subject record service** — the API/service that resolves "give me everything about property X" for the Deal Capsule

### Wave 2 — Valuation readers
3. **Valuation Grid service** — needs subject characteristics + comp `property_sales` for PPU, PSF, Cap×NOI methods
4. **M15 comp services** (`comp-query.service.ts`, `comp-set-discovery.service.ts`) — comp inventory queries
5. **Comp relevance scoring** (D-COMP-1) — needs subject characteristics + comp characteristics for scoring

### Wave 3 — Analytical readers
6. **F3 Markets module** — submarket-level aggregations over property data
7. **F4 Supply module** — pipeline data joined to property/submarket
8. **F6 Traffic module** — submarket traffic + property location
9. **F8 Debt module** — relatively independent; lower priority

### Wave 4 — Strategy-aware readers
10. **Strategy-aware comp selection** — once Wave 2 done, layer the strategy matrix on top
11. **Strategy projection service** — reads property characteristics + strategy to produce strategy-aware framing

### Wave 5 — Post-close + capsule
12. **M22 post-close intelligence** — writes to `property_operating_data` with `is_owned = true`
13. **Deal Capsule rendering** — assembles property data for the capsule's data layers
14. **Freeze-on-share snapshot** — captures property data at share-time per Capsule Vision Part 5

Each reader migration follows the verification protocol: Layer 1 (reads from new tables successfully) + Layer 2 (produces correct values vs spot-check baseline) + targeted regression test before old-table reads are removed.

---

## PART 9 — ACCEPTANCE CRITERIA

Refactor is complete when:

1. **One property, one identity.** Every physical real-world property in the platform has exactly one `properties` row. Duplicates eliminated via parcel ID / geocode / address dedup.

2. **Persistent across ownership changes.** A property acquired in 2018 and sold in 2024 has one `properties` row, two `property_sales` rows, and (for the JEDI-tracked deal) one `deals` row. No duplication on ownership change.

3. **Field-level provenance traceable.** For any property field, the operator can see what value is current, what source provided it, when, with what confidence. LayeredValue applied throughout for multi-source fields.

4. **Comp inventory unified.** `market_sale_comps`, `market_rent_comps`, `comp_properties` deprecated. All comp queries route through `property_sales` + `property_operating_data` joined to `properties`.

5. **Subject record never empty for an active deal.** Every `deals` row has a non-null `property_id`; every referenced property has populated identity + at least minimal `property_characteristics`. Valuation Grid never INSUFFICIENT due to missing subject data.

6. **Roundtrip integrity.** A property record exported (full LayeredValue, all related characteristics + sales + operating data) can be reimported into a clean environment and produce an identical record. The platform isn't secretly dependent on global state that doesn't travel.

7. **Backfill complete for all existing deals.** All 29+ deals have populated property records (identity + minimum characteristics). Any properties that couldn't be backfilled are explicitly flagged with `parcel_id_status = 'unknown'` and surfaced for operator review.

8. **No reader uses old tables.** All downstream features (cashflow agent, Valuation Grid, comp services, F3/F4/F6/F8 modules, capsule rendering) read from the new schema. Old tables are dropped (or kept as read-only archives if there's a regulatory reason to retain).

9. **Backtest integrity preserved.** The S1 backtest deals (Jacksonville, Atlanta ×2) produce equivalent or better Valuation Grid results after migration than before, with full property records populated and comp data flowing through `property_sales`.

10. **Dual-write period clean.** During Phase 2 dual-write, no rows are written to new tables that aren't also in old tables, and vice versa. Reconciliation script confirms this nightly during migration period.

---

## PART 10 — RISK REGISTER

| Risk | Mitigation |
|---|---|
| **Data loss during migration** | Dual-write period (no destructive operations until reader migration is complete); old tables retained as read-only archive for one quarter post-deprecation |
| **Dual-write race conditions** | Transactional writes — both succeed or both fail; monitoring alerts on dual-write divergence |
| **Reader confusion during transition** | Per-feature feature-flag for new vs old reads; rollback path within each reader migration; verification protocol Layer 1+2 before old reads removed |
| **Backfill produces wrong values** | Verification spot-checks against authoritative external sources at end of each backfill phase; reconciliation strategy surfaces conflicts; operator review for exceptions |
| **County records data quality** | Some counties have stale or incomplete records; backfill marks fields `parcel_id_status = 'pending'` and surfaces for operator override rather than guessing |
| **Address normalization edge cases** | Address normalization is a known hard problem (apartment vs property addresses, USPS vs colloquial, abbreviation variants); use existing service with fallback to operator review |
| **Refactor competing with in-flight work** | Sequencing decision: comp work and subject work pause until schema decisions locked; resume against new schema |
| **Scope creep ("while we're refactoring...")** | This spec defines scope; out-of-scope refinements (portfolio acquisitions, complex zoning history, etc.) are flagged for follow-up but not included |
| **Migration runs longer than 6 months** | Phase gates with explicit acceptance criteria; if a phase can't complete in 1.5× estimated time, surface scope question rather than continue grinding |
| **Property identity dedup misses or over-merges** | Manual review queue for properties where dedup confidence is below threshold; operator can split or merge |

---

## PART 11 — RELATIONSHIP TO OTHER DOCUMENTS

This refactor is the foundation everything else rests on. Updates to other documents on completion of each phase:

| Document | Update on phase complete |
|---|---|
| **Deal Capsule Vision** Part 9 (blockers) | Blocker 1 (data library CRUD) is independent of this refactor; Blocker 3 (subject record empty) is **resolved by Phase 4** of this refactor; Blocker 5 (comp inventory empty) is **resolved by Phase 5** |
| **Master Plan** D-DEAL-1, D-DEAL-2 | Folded into this refactor's Phase 2 (dual-write) and Phase 3 (backfill); the original D-DEAL dispatches are superseded |
| **Strategy-Aware Modules** comp selection matrix | Implementation against new schema after reader migration (Wave 4 in this doc); old `comp_properties` reads deprecated |
| **AI-Compute Audit** | Determinism guarantees easier on unified schema (one read path, one source of truth) |
| **Backtest Harness** | After refactor, backtest can rely on stable property records; pre-refactor backtest results retained as baseline; post-refactor results compared |
| **Verification Protocol** | Each phase's acceptance criteria run through Layer 1 + Layer 2 verification |

---

## A NOTE TO REPLIT

This is the foundation refactor. It's bigger than any single dispatch — it's a wave that runs 3-6 months and touches every downstream feature. The sequencing matters more than the speed.

Before Phase 1 begins:
1. Confirm the six architectural decisions in Part 2 with the operator (Leon)
2. State-verify the current schema against the assumed-current state in Parts 5+6 (P8 discipline — don't trust documentation; query the database)
3. Confirm in-flight work is paused per the sequencing decision: comp ingestion work and subject record population pause until Phase 1 schema is locked
4. Build the explicit field-by-field current → target mapping table (Part 5 is the conceptual decisions; the full mapping is Phase 1 implementation work)

During phases:
- Each phase has explicit acceptance criteria; the next phase doesn't start until they're met
- Verification protocol Layer 1+2 runs per phase
- Dual-write divergence monitored nightly during Phase 2
- Reader migrations are one-at-a-time with feature flags, not batched
- Risk register monitored; scope-questions surfaced rather than scope-drifted

Where this spec and live state diverge, live state is authoritative. Where the operator overrides a recommended answer in Part 2, the override is canonical. Where new requirements emerge during implementation, surface them — don't fold them into scope silently.

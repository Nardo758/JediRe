# JEDI RE — PIECE A: VENDOR ABSTRACTION AND INGESTION LAYER

**Purpose:** Generalize the CoStar three-doctype pattern into a vendor-agnostic registry. New market data vendors (Yardi Matrix, Berkadia, RealPage, ALN, Apartment Locator, and any future vendor) slot in by registering, not by re-architecting parsers/classifiers/corpus writers.

**Status:** Piece A of four (A, B, C, D). Companion to the Vendor Market Data Architecture overview.

**Predecessor work:** CoStar three-doctype dispatch (Task #1488-1491). The CoStar implementation is the worked example. Piece A extracts the pattern.

---

## THE PROBLEM PIECE A SOLVES

The CoStar three-doctype dispatch built:
- 3 new DocumentType enum values
- A classifier extended with CoStar-specific filename patterns + column signatures
- 3 dedicated parsers
- A router with hardcoded CoStar cases
- Corpus write logic for CoStar-specific tables
- Reuse of `costar-comp-upload.service.ts` for comp dedup

That work is good and necessary. But when Yardi Matrix becomes the next vendor:
- Yardi has its own DocumentType values
- The classifier needs Yardi-specific patterns
- New parsers for each Yardi file type
- Router cases hardcoded for Yardi
- Corpus write logic for Yardi tables (or shared tables, requiring schema changes)
- Yardi-specific dedup integration

Repeating this work per vendor produces parallel implementations that drift apart. Each new vendor becomes a CoStar-sized dispatch. The classifier gets harder to reason about. Corpus write logic accumulates per-vendor branches. License posture (CoStar restricts redistribution; Yardi has different terms; Berkadia has different terms) gets handled inconsistently.

Piece A solves this by extracting the pattern into a **vendor registry**.

---

## THE VENDOR REGISTRY PATTERN

### What a vendor registers

A vendor (CoStar, Yardi Matrix, Berkadia, etc.) registers a plugin that declares:

| Declaration | Example (CoStar) | Example (Yardi Matrix) |
|---|---|---|
| **Vendor identity** | `costar` | `yardi_matrix` |
| **File types this vendor produces** | DataTable, Near-By Sales, Rent Comp Properties, DataExport (out of scope) | Yardi Submarket Report, Yardi Rent Survey, Yardi Sale Trend Report |
| **Filename patterns per type** | `^DataTable\.xlsx$`, `^Near_By_Sales_PID_\d+\.xlsx$`, etc. | Yardi-specific patterns |
| **Column signature per type** | Required headers per file type (e.g., DataTable: Period, Vacancy Rate, Market Asking Rent/Unit, Market Cap Rate) | Yardi-specific signatures |
| **Parser function per type** | `parseCoStarSubmarket`, `parseCoStarSaleComps`, `parseCoStarRentComps` | `parseYardiSubmarket`, `parseYardiRentSurvey`, etc. |
| **Corpus write target per type** | `historical_observations` + `costar_submarket_stats` + `costar_market_metrics` for DataTable; `market_sale_comps` via `processCoStarUpload` for sale comps | Yardi-specific routing (may share corpus, may have separate tables) |
| **License posture** | Restricted redistribution; Tier 3b market data | Different terms; document explicitly |
| **Corpus tier per type** | M1 for submarket, C1 for comps | Same tier system, vendor-specific assignment |
| **Freshness profile per type** | Submarket time-series: monthly cadence, 30-90 day freshness window; Comp set: snapshot at upload, no expected refresh | Yardi cadence may differ |

The registry is the single place these declarations live. The classifier, parser dispatch, corpus writer, and license enforcement all consult the registry rather than hardcoding per-vendor logic.

### Where the registry lives

A new table or schema definition file:

```
vendor_registry
  vendor_id                TEXT PK         -- 'costar', 'yardi_matrix', 'berkadia', etc.
  display_name             TEXT            -- 'CoStar', 'Yardi Matrix', etc.
  license_posture          TEXT            -- 'restricted', 'open', etc.
  redistribution_notes     TEXT            -- License-specific notes
  created_at               TIMESTAMPTZ
  active                   BOOLEAN

vendor_file_types
  id                       UUID PK
  vendor_id                TEXT FK
  file_type_key            TEXT            -- 'submarket_export', 'sale_comps', 'rent_comps'
  filename_patterns        JSONB           -- Array of regex patterns
  column_signature         JSONB           -- Required headers + optional headers
  parser_module            TEXT            -- Module path to parser function
  corpus_tier              TEXT            -- 'M1', 'M2', 'C1', 'C2'
  freshness_window_days    INTEGER         -- Expected refresh cadence
  write_targets            JSONB           -- Array of {table, write_function} pairs
```

For environments where adding tables is heavy, the registry can be a TypeScript module exporting a constant registry object. The table-based approach is preferred long-term because operators can add new vendors without code deploys, but the module approach is fine for Phase 2 implementation.

---

## CLASSIFIER GENERALIZATION

The classifier currently has two-pass logic (filename then column signature) with hardcoded patterns per vendor. Generalizing:

```
classify(file):
  for vendor in vendor_registry:
    for file_type in vendor.file_types:
      if filename_matches(file, file_type.filename_patterns):
        if column_signature_matches(file, file_type.column_signature):
          return classification(vendor_id, file_type_key)
        else:
          # Filename matches but columns don't — malformed
          return MALFORMED(vendor_id, file_type_key, expected_columns)
  return UNKNOWN
```

This replaces the per-vendor if-else chain with a registry-driven loop. Adding Yardi means adding a row to `vendor_registry` and registering Yardi's file types — no classifier code changes.

**Operator override:** the existing upload UI dropdown (per CoStar dispatch spec §7.3) lists vendor + file type pairs from the registry rather than hardcoded enum values.

---

## PARSER DISPATCH GENERALIZATION

The router currently has hardcoded cases:
```
case COSTAR_SUBMARKET_EXPORT: → parseCoStarSubmarket → writeHistoricalObs + costar_submarket_stats + costar_market_metrics
case COSTAR_SALE_COMPS: → routeCoStarComps (delegates to processCoStarUpload)
case COSTAR_RENT_COMPS: → routeCoStarComps
```

Generalized:
```
route(classification, file_buffer):
  vendor_file_type = vendor_registry.get(classification.vendor_id, classification.file_type_key)
  parser = load_module(vendor_file_type.parser_module)
  parsed_rows = parser(file_buffer, classification.context)
  for target in vendor_file_type.write_targets:
    write_fn = load_module(target.write_function)
    write_fn(parsed_rows, target.table, vendor_metadata)
```

The router becomes vendor-agnostic. Per-vendor logic lives in the parser modules and the registry declarations.

---

## CORPUS WRITE TARGETS

A registry-aware corpus write layer needs to handle:

**Shared corpus writes (vendor-agnostic):**
- `historical_observations` rows tagged with `vendor_id` and `redistribution_restricted` per the file type's license posture
- Submarket-tier rows write with vendor's source identifier in the source field
- Comp-tier rows write with comp_for_subject_pid pattern (PID semantics may differ per vendor)

**Vendor-specific corpus writes (declared in registry):**
- CoStar DataTable also writes to `costar_submarket_stats` (deal-scoped) and `costar_market_metrics` (canonical)
- Yardi submarket reports may write to Yardi-specific tables OR to a new `vendor_submarket_metrics` table that's vendor-agnostic
- Berkadia surveys may write to a different target

The registry's `write_targets` declaration lets each vendor route to the right tables without the router knowing the specifics.

### A design decision worth surfacing

**Question:** should vendor-specific corpus tables (`costar_submarket_stats`, `costar_market_metrics`) continue to exist, or should they be consolidated into a vendor-agnostic `vendor_submarket_metrics` table?

**Tradeoffs:**
- **Keep vendor-specific tables:** Easier to maintain vendor-specific column quirks (CoStar has specific fields; Yardi has different fields). Current Task #1407 infrastructure stays intact.
- **Consolidate to vendor-agnostic:** Cleaner schema long-term, easier cross-vendor queries, but requires schema migration and probably means losing some vendor-specific column richness.

**Recommendation:** Keep vendor-specific tables for vendor-unique columns; add a vendor-agnostic `vendor_market_observations` table for cross-vendor reconciliation queries that Piece B will read from. Both writes happen at ingest time. This is dual-write, similar to the property refactor's Phase 2 pattern.

---

## LICENSE POSTURE ENFORCEMENT

Each vendor's license posture (registered in `vendor_registry.license_posture` and `redistribution_notes`) determines:

| Operation | Restricted vendor (CoStar, Yardi) | Open vendor (open-source data) |
|---|---|---|
| Internal display in deal capsule | ✓ Visible | ✓ Visible |
| Display in shared deal exports | ✓ Visible with watermark | ✓ Visible |
| Display in external client-facing reports | ⚠️ Aggregated form only (no raw rows) | ✓ Visible |
| Inclusion in benchmark/analytics aggregation | ✓ Used to compute aggregates | ✓ Used to compute aggregates |
| Direct row export to operator's other tools | ⚠️ Subject to vendor terms (operator's contract) | ✓ Allowed |
| AI training data inclusion | ✗ Forbidden | ✓ Allowed |

The platform enforces these rules at display/export time by reading the source vendor's license posture from `historical_observations.source` and `vendor_registry.license_posture`. Operators see clear provenance and the platform doesn't violate vendor terms by accident.

**Worth noting:** the license posture per-source is also a finding-relevant signal for agents (Piece C). When an agent's narrative cites "per CoStar Q2 data," the citation acknowledges the source; when the operator exports that narrative externally, the platform either redacts the source attribution or warns the operator.

---

## FRESHNESS PROFILES

Each file type registers an expected freshness window. The platform uses this for:

**1. Staleness flagging in the freshness indicator (per F-key triage Wave A):**
- CoStar DataTable: monthly cadence, fresh = <30 days, aging = 30-90 days, stale = >90 days
- CoStar comp set: snapshot at upload, fresh = <90 days, stale = >180 days (comp markets move)
- Yardi may differ; declares its own profile

**2. Refresh prompts to operators:**
- When a deal's CoStar data is >90 days old and the deal is actively being underwritten, the UI surfaces "CoStar data for this submarket is stale — consider uploading fresh export."

**3. Reconciliation precedence in Piece B:**
- When two vendors disagree, the fresher source typically wins (with explicit override available)

The freshness profile is per-file-type per-vendor, declared at registration time.

---

## PROPERTY REFACTOR FORWARD-COMPATIBILITY

Today: vendor data lands in current tables (`market_sale_comps`, `market_rent_comps`, `costar_submarket_stats`, etc.).

Post-property-refactor: vendor data should land in the unified property model (`property_sales`, `property_operating_data`, `property_characteristics`).

**The bridge:** the property refactor's Phase 2 dual-write mechanism handles the transition. Piece A's write targets continue to point at current tables; the refactor's dual-write mirrors writes forward to the unified model. Piece A doesn't need to wait for the refactor to complete.

**One forward-compatibility note:** the CoStar PID → JEDI property_id mapping (deferred in the CoStar dispatch) and the CoStar submarket → JEDI submarket_id mapping (deferred pending Deal Details audit, now informed by it) are both registry-relevant. When mapping services exist, they should be registered alongside the vendor — each vendor declares "here's how to resolve my identifiers to JEDI canonical identifiers."

---

## DEAL COMPLETENESS CONTRIBUTION

Piece A contributes to the unified deal completeness framework (Commitment 6 from the overview):

**Deal incompleteness signals that Piece A surfaces:**
- "No CoStar data uploaded for this submarket" — when an active deal in a CoStar-covered market has no recent DataTable
- "Yardi data missing" — for operators who consistently upload Yardi for other deals
- "Comp set stale" — when sale comps haven't been refreshed in >180 days
- "License-restricted data is being displayed in a context that should be redacted" — when the operator is exporting externally without the redaction step

These signals feed the deal completeness framework, which the UI uses to badge deals as fully/partially/minimally underwritten.

---

## IMPLEMENTATION SCOPE

**Phase 2A — Registry foundation (3-4 weeks):**
1. Create `vendor_registry` and `vendor_file_types` tables (or TypeScript module if preferred for Phase 2)
2. Migrate CoStar declarations from hardcoded patterns into the registry
3. Refactor classifier to be registry-driven (replaces hardcoded vendor patterns)
4. Refactor router to be registry-driven (replaces hardcoded vendor cases)
5. Verify CoStar three-doctype pipeline still works end-to-end after refactor

**Phase 2B — Yardi Matrix onboarding (2-3 weeks, primary test of abstraction):**
1. Acquire Yardi Matrix sample files
2. Build Yardi parser module
3. Register Yardi declarations
4. Test: classifier identifies Yardi files; router dispatches; parser produces rows; corpus writes succeed
5. Confirm no CoStar regression from Yardi being added

**Phase 2C — License enforcement (2 weeks):**
1. Add license-posture-aware display logic at deal capsule render
2. Add export-time redaction for restricted-vendor data
3. Add freshness-aware refresh prompts

**Phase 2D — Forward compatibility (concurrent with property refactor Phase 2):**
1. Wire mapping service registration (CoStar PID → JEDI property_id; submarket name → submarket_id)
2. Update write targets to dual-write to old and new schema during refactor transition

**Total estimated Piece A scope:** 9-12 weeks, runs in parallel with property refactor Phases 1-2.

---

## ACCEPTANCE CRITERIA

Piece A is complete when:

1. **CoStar declarations live in the registry, not hardcoded.** Classifier and router consult the registry; CoStar-specific code is reduced to the parser module and the registry declarations.
2. **Yardi Matrix successfully onboarded as the second vendor** with no changes to classifier, router, or corpus writer code — only registry declarations and a new parser module.
3. **License posture enforced at display/export time.** Restricted vendor data displays with provenance; external exports redact appropriately.
4. **Freshness profiles drive UI behavior.** Stale CoStar data triggers refresh prompts; freshness indicators across F-keys read from the registry's profiles.
5. **Vendor-agnostic `vendor_market_observations` table populated alongside vendor-specific tables** — provides the substrate for Piece B's cross-vendor reconciliation.
6. **CoStar PID and submarket mappings registered alongside the vendor** — when those mapping services exist, they're discoverable via the registry rather than scattered across the codebase.
7. **Deal completeness signals from Piece A integrated into the unified framework** — missing/stale vendor data appears in the deal completeness UI.

---

## RELATIONSHIP TO OTHER DOCUMENTS

| Document | How Piece A relates |
|---|---|
| Vendor Market Data Architecture (overview) | Piece A operationalizes Commitments 1, 6 (LayeredValue universality; deal completeness) |
| Piece B (Field-Level Reconciliation) | Piece A produces the substrate (`vendor_market_observations`) Piece B consumes |
| Piece C (Agent Synthesis Interface) | Piece A's vendor metadata (license posture, freshness, source identity) shows up in agent-authored findings |
| Piece D (Divergence as Quality Signal) | Piece A's vendor-aware tagging is the foundation for tracking per-vendor reliability over time |
| CoStar three-doctype dispatch | Piece A is the generalization of this dispatch's pattern |
| Property plumbing refactor | Piece A's write targets bridge old and new schema via the refactor's Phase 2 dual-write |
| F-key triage Wave A | Piece A's freshness profiles drive the freshness indicator pattern across F-keys |

---

## NOTE TO REPLIT

Three things worth being explicit about:

**First, the audit-first discipline applies recursively.** Before implementing Piece A, audit the current state of:
- How the CoStar classifier is currently structured (is the registry-pattern refactor invasive or surgical?)
- What `vendor_market_observations` schema would look like (what columns are vendor-agnostic vs vendor-specific?)
- License posture enforcement points in the existing UI/export pipeline (where does the redaction need to live?)

The audit produces the field-by-field implementation plan; Piece A as written is the architectural framing.

**Second, Yardi Matrix onboarding is the abstraction's stress test.** If Yardi onboards smoothly through the registry, the abstraction works. If Yardi reveals patterns the registry doesn't accommodate (e.g., Yardi exports include row-level metadata that doesn't fit CoStar's shape), the registry expands rather than producing a parallel implementation. Surface this if it happens.

**Third, the property refactor coupling means Phase 2D is concurrent, not sequential.** Piece A doesn't wait for the property refactor to complete. The dual-write mechanism in the refactor handles the schema transition transparently.

Per CLAUDE.md P8: state-verify every "currently exists" claim in this document against live code before treating as confirmed. The CoStar implementation (which Piece A generalizes from) is the most rapidly-evolving part of the codebase right now; check current state before refactoring.

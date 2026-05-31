TASK: Audit the Deal Details UI for end-to-end alignment with the
backend. For every UI section, trace its data dependencies through
the fetch calls, route handlers, services, and underlying data
sources. Surface misalignments, broken wiring, schema drift, cross-
surface inconsistencies, and root-cause classification for empty
or broken fields.

Read-only audit. No code changes. Single comprehensive output document.

═══════════════════════════════════════════════════════════════════════════
CONTEXT
═══════════════════════════════════════════════════════════════════════════

The Deal Details surface (F1-F12 + Validation Grid + Valuation Grid +
Document Library) is the platform's primary operator-facing view of
deal-level analysis. The previous Deal Details data audit
(docs/operations/DEAL_DETAILS_DATA_AUDIT.md) produced a 190-field
map with POPULATED/SPARSE/EMPTY/BROKEN/MISSING status across all
surfaces of 464 Bishop (deal_id 3f32276f-aacd-4da3-b306-317c5109b403).

This audit extends that work by examining the UI-to-backend wiring
that connects (or fails to connect) those fields to the backend.

Reference documents (in docs/architecture/ — verify current paths):
  - calculations-vs-assumptions.md (revised)
  - vendor-market-data/overview.md
  - vendor-market-data/piece-b-field-reconciliation.md
    (especially "Cross-surface read consistency" section)

═══════════════════════════════════════════════════════════════════════════
THE FIVE AUDIT DIMENSIONS
═══════════════════════════════════════════════════════════════════════════

For every UI section in Deal Details, audit five dimensions:

DIMENSION 1 — UI fetch call inventory
  - What fetch/API calls does this UI section make?
  - What endpoint does each call hit?
  - What query parameters / body does it pass?
  - When does it call (mount, refresh, user action)?

DIMENSION 2 — Route mount verification
  - Does the endpoint the UI calls actually exist as a registered route?
  - Is that route file mounted in the express router (per the audit's
    known issue: 85+ backend route files were unmounted)?
  - Does the route handler return 200 on a valid call, or 404/500?

DIMENSION 3 — Schema and contract alignment
  - What shape does the UI expect from the response (TypeScript types,
    inline destructuring, prop interfaces)?
  - What shape does the route handler actually return?
  - Where do they diverge (extra fields, missing fields, type mismatches,
    nested structure differences)?
  - Are LayeredValue fields handled correctly (UI consumes .resolved,
    or does it sometimes consume raw layers)?

DIMENSION 4 — Canonical source verification (cross-surface consistency)
  - For any logical value displayed in multiple places (NOI, market rent,
    vacancy, LTL, cap rate, IRR, equity multiple, etc.), do all consumers
    read from the same canonical source?
  - Per Piece B Commitment B.1, every logical value should have one
    canonical read path. Identify where this is violated.
  - Specific known instance: NOI displays $2,999,564 in Pro Forma but
    $840,231 in Valuation Grid (audit CF-01). Identify all similar
    cross-surface divergences.

DIMENSION 5 — Empty/broken root cause classification
  - The previous audit found 65 EMPTY fields and 19 BROKEN fields.
  - For each, classify the root cause:
      (a) Data doesn't exist in the database for this deal (genuine
          data gap)
      (b) Data exists but UI calls an unmounted route (wiring gap)
      (c) Data exists, route is mounted, but route handler logic is
          broken (handler gap)
      (d) Data exists, route works, but UI consumes wrong field path
          (consumer gap)
      (e) Data exists, route works, but UI's display logic filters/
          transforms it incorrectly (display gap)
      (f) Other (specify)

═══════════════════════════════════════════════════════════════════════════
DEAL DETAILS SURFACES TO AUDIT
═══════════════════════════════════════════════════════════════════════════

Cover every surface that appears in Deal Details. Use the previous
Deal Details audit's surface list as the foundation:

F-Key Surfaces:
  F1  — Overview
  F2  — Deal Capsule (and its sub-sections: subject, sources, summary)
  F2a — Validation Grid
  F3  — Markets
  F4  — Supply Pipeline
  F5  — Capital Structure
  F6  — Returns (LP/GP waterfall)
  F7  — Valuation Grid (all valuation methods)
  F8  — Decision
  F9  — Pro Forma (all 8 tabs: Overview, Assumptions, Pro Forma,
        Projections, Capital, Returns, Scenarios, Compare)
  F10 — Risks
  F11 — Comps
  F12 — Custom (any custom Opus-authored tabs)

Embedded grids and libraries (typically accessible across F-keys):
  Document Library
  Subject Property Header (the persistent property identity strip)
  Strategy verdict / Strategy stance indicator

For each surface, audit the five dimensions for every distinct data
section the surface displays. F9 has 8 tabs, so F9 alone produces
multiple sub-audits.

═══════════════════════════════════════════════════════════════════════════
INVESTIGATION METHOD
═══════════════════════════════════════════════════════════════════════════

For each surface:

STEP 1 — Identify the UI component file(s) that render the surface
  - Trace from the route in the frontend router (typically frontend/
    src/routes/ or frontend/src/pages/) down to the component tree
  - Note every leaf component that fetches data or consumes data
    from a parent fetch

STEP 2 — Inventory the fetch calls
  - Find every useQuery, useEffect with fetch, axios call, or
    equivalent
  - Note the endpoint, method, query params, body
  - Note the React Query key or equivalent cache key

STEP 3 — Map endpoint to backend route
  - Find the route handler file (backend/src/routes/ or equivalent)
  - Confirm the route is mounted in the express router
  - Note the controller/service the route delegates to
  - If route is NOT mounted, flag as wiring gap

STEP 4 — Trace through services to data source
  - From route handler, follow service calls to the underlying data
    query
  - Note the SQL query, the tables it reads from, any joins
  - Note where LayeredValue resolution happens (if applicable)
  - Note where calculations happen (Engine A's getDealFinancials,
    other computation services)

STEP 5 — Verify against 464 Bishop
  - For each data path, run it against 464 Bishop and document the
    actual value returned
  - Compare to what the UI displays (from previous audit's 190-field
    map)
  - Where they diverge, classify the cause per Dimension 5

STEP 6 — Cross-surface check
  - For logical values that appear in multiple surfaces (NOI, market
    rent, vacancy, LTL, etc.), document every place each value is
    displayed and the read path for each
  - Flag any divergent read paths per Dimension 4

═══════════════════════════════════════════════════════════════════════════
SPECIFIC THINGS TO SURFACE
═══════════════════════════════════════════════════════════════════════════

Beyond the per-surface documentation, surface these patterns
explicitly:

CROSS-SURFACE INCONSISTENCY INVENTORY
  - Every logical value that displays differently across surfaces
  - The read path each surface uses
  - The "correct" value (or note where correctness is ambiguous)
  - The architectural fix per Piece B Commitment B.1

UNMOUNTED ROUTE INVENTORY (subset relevant to Deal Details)
  - From the 85+ unmounted routes, identify which are referenced by
    Deal Details UI fetch calls
  - Categorize: ones that would unbreak UI features if mounted vs
    ones that are dead UI calling dead routes

DEAD UI CODE
  - UI components or fetch calls that reference endpoints that don't
    exist (not just unmounted — never implemented)
  - These are typically older features that were sketched but never
    finished; document so they can be removed or completed

SCHEMA DRIFT INVENTORY
  - UI types that expect fields the backend doesn't return
  - Backend response fields the UI doesn't consume (potential UX
    opportunities or dead backend code)
  - Type mismatches (UI expects number, backend returns string, etc.)
  - LayeredValue misuse (UI consuming .agent or .platform directly
    instead of .resolved, bypassing operator override)

LAYER 1 OVERRIDE PATH VERIFICATION
  - Per the F9 calc-vs-assumption doc's 6-point wiring checklist:
    for every agent-authored field displayed in Deal Details,
    verify Layer 1 (operator override) is wired
  - Specifically check: PATCH endpoint exists, UI affordance present,
    resolution chain selects override, reset-to-agent available,
    alertLevel fires on material divergence
  - Flag fields where override isn't wired (Task #1520 in progress
    for NOI; many others likely need similar wiring)

FRESHNESS INDICATOR COVERAGE
  - Per F-key triage Wave A, freshness indicators should appear on
    surfaces backed by data with cadence
  - Document which surfaces have them, which don't, and which are
    incomplete

COMPLETENESS SIGNALS
  - Per Piece C deal completeness framework: identify surfaces that
    silently degrade when required signals are missing (M07 not run,
    cashflow agent not run, etc.) rather than explicitly flagging
    incompleteness
  - These are the surfaces that need the "this analysis requires X"
    treatment

═══════════════════════════════════════════════════════════════════════════
KNOWN ANCHOR POINTS (USE AS STARTING POINTS, NOT CONSTRAINTS)
═══════════════════════════════════════════════════════════════════════════

The previous audit established these specific issues. Use them as
anchor points but expect to find more:

CF-01: NOI = $840,231 (Valuation Grid) vs $2,999,564 (Pro Forma)
  - Dimension 4 (canonical source) issue
  - Task #1520 in progress for the underlying fix

CF-02: per_year_overrides stored but ignored on projection fetch
  - Partially resolved by Task #1521 for GPR, other income, vacancy,
    OpEx
  - LTL still missing (Task #1536 pending)

CF-03/CF-07: deal_monthly_actuals has 24 shell rows, no writer
  - Likely UI calls a route that returns null/empty consistently
  - Investigate the read path AND the write path

CF-04: jedi_scores 0 rows
  - F1 dashboard and F8 decision tab missing JEDI score display
  - Verify whether UI is calling a route, route is mounted, scoring
    service exists but isn't triggered

CF-05: deal_market_intelligence 0 rows
  - F1 market context, F3 markets degraded
  - Verify the same chain as CF-04

CF-06: 5 tables empty (debt_schedule, waterfall_config, capex_items,
       risks, comparable_properties)
  - F5 Capital, F6 Returns, F10 Risks, F11 Comps may have UI-route
    misalignments that the audit needs to surface

CF-08: electric/gas_fuel resolve to null despite T12 present
  - LayeredValue resolution chain issue OR UI consuming wrong field
  - Dimension 3 (schema/contract) or Dimension 4 (canonical source)

CF-09: unit_mix_overrides stored but da:use_unit_mix_for_gpr flag
       not set, no UI
  - Backend supports it; UI doesn't expose the toggle
  - Dimension 1 (missing UI feature) AND Dimension 4 (cross-surface
    consistency when toggle is on vs off)

CF-10: deals.property_id is NULL for 464 Bishop
  - Property identity not linked
  - Affects every surface that reads through property identity
  - This is foundational and tracked separately by the property
    plumbing refactor

LP/GP wiring (resolved by Tasks #1522/#1523/#1525):
  - Verify these are actually working end-to-end in F5 DealTermsTab
    and F6 WaterfallTab
  - Confirm no UI gaps remain post-merge

═══════════════════════════════════════════════════════════════════════════
DELIVERABLE
═══════════════════════════════════════════════════════════════════════════

Single document: docs/operations/DEAL_DETAILS_UI_BACKEND_AUDIT.md

Structure:

1. EXECUTIVE SUMMARY
   - Total surfaces audited (count F-keys + sub-tabs + embedded grids)
   - Total UI fetch calls inventoried
   - Total endpoints referenced
   - Counts by category:
     * Mounted, working, correctly consumed (green)
     * Mounted, working, but cross-surface inconsistent (yellow)
     * Mounted, working, but schema drift exists (yellow)
     * Mounted, but returns incomplete/broken data (orange)
     * Unmounted route called by UI (red)
     * UI calls endpoint that doesn't exist (red)
     * UI dead code or sketched but unfinished (gray)
   - Top 5 most impactful misalignments (by operator-visible severity)

2. PER-SURFACE AUDIT
   - One section per F-key + sub-tab + embedded grid
   - Each section covers all 5 dimensions
   - Each section ends with a "what's broken / what's misaligned" summary

3. CROSS-SURFACE INCONSISTENCY INVENTORY
   - Table format: logical value | surfaces displaying it | read paths |
     resolved values | divergence?
   - Sorted by severity (operator-visible material divergences first)

4. UNMOUNTED ROUTE INVENTORY (Deal Details subset)
   - Routes the UI calls but that aren't mounted
   - The fix (mount the route vs remove the UI call)

5. DEAD UI CODE INVENTORY
   - UI components/fetches referencing endpoints that don't exist
   - Recommended disposition (remove, complete, or backfill)

6. SCHEMA DRIFT INVENTORY
   - UI-expected fields not returned by backend
   - Backend-returned fields not consumed by UI
   - Type mismatches and LayeredValue misuse

7. LAYER 1 OVERRIDE COVERAGE
   - Every agent-authored field with override wiring status
   - 6-point wiring checklist per field

8. FRESHNESS INDICATOR COVERAGE
   - Surfaces that should have indicators, do, or don't

9. COMPLETENESS SIGNAL COVERAGE
   - Surfaces that silently degrade when required signals missing
   - Per Piece C deal completeness framework

10. EMPTY/BROKEN ROOT CAUSE CLASSIFICATION
    - For each of the 65 EMPTY and 19 BROKEN fields from previous audit
    - Classified per Dimension 5 categories

11. ARCHITECTURAL PATTERN SYNTHESIS
    - What does the aggregate audit say about the platform's UI-backend
      alignment health?
    - Are there systemic patterns of misalignment (e.g., a particular
      kind of route consistently unmounted; a particular kind of UI
      pattern consistently consuming wrong field paths)?
    - What architectural commitments from Piece B specifically would
      these findings inform?

═══════════════════════════════════════════════════════════════════════════
OUT OF SCOPE
═══════════════════════════════════════════════════════════════════════════

- Don't fix anything you find. This is observation only.
- Don't propose new features or architectures. The architectural
  framework already exists (Pieces A-D); this audit informs which
  parts of that framework are most urgent.
- Don't audit surfaces outside Deal Details (Dashboard, Portfolio,
  Settings, etc. are separate audits if needed).
- Don't run dynamic tests beyond reading actual values for 464 Bishop.
  The audit is primarily static code analysis with one live deal as
  reference.
- Don't audit performance or scalability concerns; this audit is
  about correctness and alignment.

═══════════════════════════════════════════════════════════════════════════
TIMELINE EXPECTATION
═══════════════════════════════════════════════════════════════════════════

This is a significant audit. F-keys 1-12 each have multiple sections;
F9 alone has 8 tabs; the Validation Grid and Valuation Grid have
their own internal complexity. Realistic timeline: 1-2 weeks for a
thorough audit.

Pacing recommendation:
  Week 1: F1, F2, F2a, F3, F4, F5, F6 (the "first-half" surfaces)
  Week 2: F7, F8, F9, F10, F11, F12 + embedded grids + cross-surface
          inventory + synthesis sections

If scope expands materially (e.g., a particular surface turns out to
have far more complexity than expected), surface the expansion rather
than truncating.

Per CLAUDE.md P8: state-verify every claim against live code and live
data. The previous Deal Details audit's findings (10 CFs) are anchor
points; this audit may find additional findings, contradict some
prior findings, or confirm them. Where this audit's findings diverge
from prior assumptions, the live state is authoritative.

The output is the single most valuable artifact for understanding
Deal Details health. It informs:
  - Which Piece B priorities are operator-visible immediately
  - Which tasks need to be created beyond T-B1 (T-B2, T-B3, others)
  - Which UI components need refactoring vs. simple route mounting
  - Which surfaces are stable vs. fragile

Take the time the audit needs. A rushed audit produces partial
findings that mislead implementation; a thorough audit produces a
foundation for the next 6-12 months of UI work.

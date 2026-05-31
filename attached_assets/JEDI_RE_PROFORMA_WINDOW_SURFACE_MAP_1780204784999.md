# JEDI RE — PRO FORMA WINDOW ARCHITECTURE: SURFACE MAP

**Purpose:** Translate the Pro Forma window architectural commitment (Pro Forma = stabilized 12-month window, not acquisition Year 1) into surface-by-surface changes across the three surfaces involved.

**Status:** Phase 1A scope. Annual-granularity stabilization. Phase 1B (monthly curve + empirical concession reasoning) deferred pending correlation engine query infrastructure and historical_observations data density.

**Surface structure (verified 2026-05-31):**
- Top-level tabs: OVERVIEW → CONSOLE → PROJECTIONS → VALIDATION → CAPITAL → RETURNS → VALUATION → SCENARIOS → COMPARE → GOAL SEEK → ROADMAP
- CONSOLE sub-tabs: STANCE → DEAL TERMS → PRO FORMA → INPUTS → UNIT MIX → OTHER INCOME → TAX

**Architectural mapping:**
- "Inputs" surface = CONSOLE > INPUTS (operator-authored assumptions)
- "Pro Forma" surface = CONSOLE > PRO FORMA (operator-configured stabilized operating statement)
- "Projections" surface = PROJECTIONS top-level tab (derived multi-year output, read-oriented)

---

## §1 — THE COMMITMENT IN ONE SENTENCE

For Phase 1A: Pro Forma displays the 12-month operating statement for the first year in which projected vacancy reaches the stabilization threshold (default 5%) and remains at or below that threshold for the subsequent years of the hold period. The agent writes `stabilization_year` to the deal; CONSOLE > PRO FORMA derives from it; PROJECTIONS surfaces it (in Phase 2 visually; in Phase 1A as the year-1 anchor in Task #1639).

---

## §2 — CONSOLE > INPUTS (AssumptionsTab)

### Current behavior

CONSOLE > INPUTS is the operator-authored surface where assumptions are entered and overridden:
- Revenue assumptions: market rent, vacancy, concessions, bad debt, other income, rent growth
- OpEx assumptions: per-line per-unit values, OpEx growth, management fee, real estate tax, insurance
- Capital structure assumptions: LTV, interest rate, loan term, amortization, IO period
- Growth assumptions: rent growth, expense growth
- Exit assumptions: exit cap rate, hold period, selling costs

Each field has LayeredValue treatment (override / agent / extracted).

### What changes in Phase 1A

**New input field: Stabilization Threshold**
- Default value: 5% vacancy
- Operator-overridable (Layer 1)
- Display: number input with % suffix, label "Stabilization Target Vacancy"
- Placement: top of the INPUTS surface or in the Exit assumption group (operator's call — both make sense)
- LayeredValue treatment: Layer 1 = operator override; Layer 2 = platform default of 5%; Layer 3 = N/A (no broker source for this assumption)

**New informational element: Submarket Equilibrium Context**
- Display: small text adjacent to the Stabilization Threshold input
- Format: "Submarket equilibrium: X% (CoStar Q2 2026)" or similar
- Source: costar_submarket_stats or apartment_market_snapshots (Replit selects based on data flow)
- Behavior: informational only — does NOT override the threshold or modify any calculation
- Purpose: alerts operator when their target is significantly above or below submarket norms ("Atlanta Midtown typical equilibrium: 7%. Your 5% target is more aggressive than submarket average.")
- Edge case: when no submarket data exists, display "Submarket equilibrium: insufficient data"

> **Correction 4.1 (2026-05-31):** `costar_submarket_stats` existence is **INFERRED-NOT-VERIFIED**. The audit confirmed `apartment_market_snapshots` has city-level Atlanta data (34 rows, Feb–May 2026) but only 1 row each for "Midtown, GA" and "Buckhead, GA" — too sparse for equilibrium context. `costar_market_metrics` (a different table) exists but has 0 rows. `costar_submarket_stats` was not verified in the audit. Before implementing the submarket equilibrium context display, grep for `costar_submarket_stats` and verify: (a) does it exist, (b) what is the schema, (c) current row count. If it does not exist or has no data, the display must fall back to "Submarket equilibrium: insufficient data" — do not display city-level numbers labeled as submarket equilibrium. This verification should happen during Phase 1A implementation of this feature.

**Modified existing inputs: assumption categorization**

The existing assumptions don't change in mechanics, but Phase 1A makes their *temporal scope* explicit:

| Existing input | Phase 1A categorization | Why it matters |
|---|---|---|
| Market rent | Stabilized-state assumption | This is the rent at stabilization, not in-place |
| Vacancy % | Stabilized-state assumption | This is the equilibrium vacancy, not Year 1 vacancy |
| Concessions % | Lease-up assumption (transitional) | Phase 1B will refine to temporal profile |
| Rent growth | Post-stabilization assumption | Applies after the stabilization year |
| Expense growth | Post-stabilization assumption | Same |
| Exit cap rate | Exit assumption | Applies at hold end, unrelated to stabilization timing |
| Hold period | Structural | Bounds the stabilization search window |

The UI doesn't need to physically reorganize, but the labels/tooltips should reflect this. Operators currently entering "vacancy = 7%" should understand they're entering *stabilized* vacancy, and the lease-up vacancy is what the agent computes via M07 absorption signals.

### What stays the same

- Existing LayeredValue treatment for all current fields
- Existing per-year override mechanism (`per_year_overrides`)
- Existing operator override UI affordances
- F9 batch reasoning for the cashflow agent (the agent still reasons about these point assumptions; the stabilization-year output is a *new derived value*, not a replacement for existing assumption reasoning)

### Wiring notes

- Stabilization Threshold writes to `deal_assumptions.stabilization_threshold_pct` (new column or new key in existing JSONB — Replit selects)
- Submarket equilibrium read path: query costar_submarket_stats by submarket_id, return most recent observation
- The agent's stabilization-year computation reads the operator's threshold as input

---

## §3 — CONSOLE > PRO FORMA (ProFormaSummaryTab)

### Current behavior

CONSOLE > PRO FORMA displays a 12-month operating statement. Per the audit, it currently reads from `year1.*` LayeredValues which represent Year-1-from-acquisition values:
- Revenue lines (GPR, vacancy loss, concessions, EGI, other income)
- OpEx lines
- NOI computed via `getFieldValues` formula `egi − total_opex`
- For 464 Bishop: NOI = $840,231 (the in-place Year-1 figure)

### What changes in Phase 1A

**Primary change: Pro Forma derives from stabilization year, not Year 1**

The data source shifts:
- Current: read `year1.*` from `deal_assumptions.year1` JSONB
- Phase 1A: read the stabilization year's operating statement, where stabilization year is determined by `deal_assumptions.stabilization_year` (new field written by the Cashflow Agent)

For deals already stabilized at acquisition (Year 1 IS the stabilization year), the displayed values are identical to current behavior. For value-add and development deals, the displayed values are the projected operating statement for Year 2, 3, or whatever year the agent identifies as stabilized.

**New header element: Stabilization indicator**

At the top of the Pro Forma surface, display:
- Primary: "Stabilized: Year N (annual approximation)"
- Secondary tooltip or subtitle: "Monthly precision will be added in Phase 2. Currently the Pro Forma represents the projected operating statement for the first year in which vacancy reaches the stabilization threshold sustained through end of hold."
- Edge case: when `stabilization_year` is null (deal never stabilizes within hold period), display: "Pro Forma window undefined — deal does not reach stabilization. Override required."
- Edge case: when operator has overridden the stabilization year manually, display: "Stabilized: Year N (operator override)"

> **Correction 4.2 (2026-05-31):** The header display for stabilization year (phrasing above) is the architectural intent. Per Phase 1A task #1640 shipping, this header treatment is presumably implemented. The audit did not verify the exact phrasing used in the implementation. Verification step: confirm the actual header phrasing in the shipped implementation matches the intent above, and surface any divergence. Minor wording differences are operator preference, not architectural concerns requiring document revision.

**Operator override of stabilization year**

The operator must be able to manually anchor the Pro Forma to a specific year, overriding the agent's calculation. This handles:
- Deals that never reach threshold but operator wants to define Pro Forma anyway
- Deals where agent's stabilization-year answer doesn't match operator's view
- Edge cases like temporarily de-stabilizing renovations

Implementation:
- New field in CONSOLE > DEAL TERMS or CONSOLE > INPUTS: "Pro Forma Year (operator override)"
- LayeredValue: Layer 1 = operator override; Layer 2 = agent-computed `stabilization_year`; Layer 3 = N/A
- When override set: header reads "Stabilized: Year N (operator override)"

### What stays the same

- The 12-month operating statement structure (GPR → vacancy → EGI → OpEx → NOI flow)
- LayeredValue resolution for individual fields within the operating statement
- The NOI computation logic (per Task #1520 + Decision Item B's override-check-first guard)
- Display formatting, conditional rendering, and existing F9 Console infrastructure

### What does NOT change in Phase 1A

- Monthly trajectory visualization (Phase 2)
- Empirical concession-velocity reasoning (Phase 1B)
- Concession-and-rent temporal profile inputs (Phase 1B)
- The correlation engine queries against historical_observations (Phase 1B)

### Wiring notes

- The page reads `deal_assumptions.stabilization_year` to determine which year's data to display
- For Year N where N > 1: the data comes from the projections array (already computed by `buildProjectionsForExport`)
- Resolution chain: operator override > agent-computed > null (incomplete)
- When null, the surface shows the incomplete state, not a default fallback

---

## §4 — PROJECTIONS (ProjectionsHubTab, top-level tab)

### Current behavior

PROJECTIONS displays the multi-year hold-period view:
- Year-by-year columns for revenue lines, OpEx lines, NOI, cash flow
- Per-year override capability for projection-relevant fields
- Derived from `buildProjectionsForExport` which compounds Year 1 by growth rates

### What changes in Phase 1A

**Year-1 anchor change (Task #1639)**

Currently `buildProjectionsForExport` recomputes Year-1 NOI from scratch using component parts. Task #1639 (Issue A) anchors Year-1 NOI to the stored `year1.noi` value. This is the arithmetic fix shipping this week.

**No other visual changes in Phase 1A**

The stabilization year is computed by the Cashflow Agent and written to `deal_assumptions.stabilization_year`. The Projections tab continues to display year-by-year values without highlighting the stabilization year visually. The data IS available; the visual treatment is Phase 2.

This is deliberate. Phase 1A focuses on:
1. CONSOLE > PRO FORMA derives from the stabilization year (operator-visible improvement)
2. Year-1 anchor fix in Projections (arithmetic correction)

Phase 2 will add:
- Visual highlight of the stabilization year in the Projections grid
- "Lease-up phase" / "Stabilized" / "Post-stabilization" phase labels
- Eventually: monthly trajectory rendering with stabilization month band

### What stays the same in Phase 1A

- Year-by-year column structure
- Per-year override capability (including the pending LTL per-year override from #1536)
- All existing fields and their LayeredValue treatments
- The derivation chain from Inputs → projections array

### Wiring notes

- `deal_assumptions.stabilization_year` is readable by Projections but not visually surfaced in Phase 1A
- The agent's computation of stabilization_year reads from the projections array (the vacancy trajectory by year) — so Projections is both an upstream input and a downstream consumer of the stabilization computation

---

## §5 — DATA FLOW

```
Operator authors                Agent reasons              Surfaces display
─────────────────              ──────────────             ─────────────────

CONSOLE > INPUTS               Cashflow Agent             CONSOLE > PRO FORMA
  - Stabilization                                           reads stabilization_year
    threshold (5%)             reads:                       displays Year N operating
  - All assumptions              - vacancy projections      statement
  - (path, stabilized,             from projections
     post-stab labeled)           array                   PROJECTIONS top-level tab
                                 - stabilization            displays year-by-year
                                   threshold from            (Year-1 anchored via
                                   inputs                    #1639)
                                 - sustainment rule
                                                          
                               writes:
                                 - deal_assumptions.
                                   stabilization_year
                                 - alongside existing
                                   per-year vacancy
                                   reasoning
```

### Critical dependencies

The stabilization_year computation depends on:
1. The projections array having credible per-year vacancy values
2. The agent's M07 + assumption reasoning producing year-by-year vacancy
3. The stabilization threshold being readable from inputs
4. The hold period being defined (bounds the search)

If any of these are missing, `stabilization_year` is null and the deal is flagged incomplete.

---

## §6 — LAYEREDVALUE TREATMENT FOR NEW FIELDS

### `deal_assumptions.stabilization_threshold_pct`

| Layer | Source | Notes |
|---|---|---|
| Layer 1 | Operator override | Default UI affordance in CONSOLE > INPUTS |
| Layer 2 | Platform default | 5% |
| Layer 3 | N/A | No broker source for this assumption |

Resolution: override wins if set; otherwise platform default of 5%.

### `deal_assumptions.stabilization_year`

| Layer | Source | Notes |
|---|---|---|
| Layer 1 | Operator override | "Pro Forma Year" input — operator manually anchors |
| Layer 2 | Cashflow Agent computed | Agent's reasoning from projection vacancy trajectory + threshold |
| Layer 3 | N/A | Derived value, no broker source |

Resolution: override wins if set; agent's computed value otherwise; null if agent can't compute (deal doesn't stabilize).

### Submarket equilibrium context

Not a LayeredValue — it's a read-only display value sourced from `costar_submarket_stats.equilibrium_vacancy_pct` or equivalent. Refreshes when vendor data is uploaded.

---

## §7 — EDGE CASES (Phase 1A handling)

| Edge case | Detection | Handling |
|---|---|---|
| Deal never reaches threshold | Agent computes stabilization_year, finds no qualifying year in hold period | Write null to stabilization_year; flag deal as incomplete via Deal Completeness framework; CONSOLE > PRO FORMA displays "Pro Forma window undefined — override required" |
| Vacancy oscillates around threshold | Agent's qualifying-year check requires sustained at-or-below for subsequent hold years | If Year 3 qualifies but Year 4 oscillates above, Year 3 doesn't qualify; agent searches forward to next qualifying year. If no year qualifies, null. |
| Threshold doesn't fit deal | Operator can override threshold (Layer 1 in INPUTS) | Recompute stabilization_year based on operator threshold |
| Already stabilized at acquisition | Year 1 vacancy at or below threshold AND sustained | stabilization_year = 1; CONSOLE > PRO FORMA displays Year 1 (identical to current behavior for stabilized acquisitions) |
| Operator disagrees with agent's stabilization year | Operator override via "Pro Forma Year" input | Override wins; CONSOLE > PRO FORMA header reads "(operator override)" |

---

## §8 — INTERACTIONS WITH EXISTING FIXES

### Issue A (Task #1639) — Year-1 NOI arithmetic fix

Independent of Phase 1A. Ships this week. Closes the INPUTS-vs-Projections divergence in `buildProjectionsForExport`.

### Task #1520 — NOI override wiring (merged)

Resolved per Decision Item B (override-check-first guard in getFieldValue). The same Layer 1 override path applies to NOI computed for the stabilization year, not just acquisition Year 1.

### Decision Item A — FIELD_PRIORITIES agent layer

The new `stabilization_year` field has only Layer 1 + Layer 2 (no agent-vs-formula concern). The decision doesn't block Phase 1A.

### Decision Item B — NOI formula-vs-chain

Already resolved (override-check-first). The override path works for both acquisition-Year-1 NOI and stabilization-year NOI.

### LP/GP equity split

Unaffected. LP/GP reasoning operates on the full hold period, not Year-1-specific.

### Pieces A/B/C/D

Pro Forma window architecture is consistent with:
- Piece B Commitment B.1 (one canonical read path): the stabilization-year NOI IS the canonical Pro Forma NOI
- Piece C deal completeness framework: deals that don't stabilize are flagged via the same framework
- Piece A vendor abstraction: submarket equilibrium context reads from vendor-tagged data with provenance

---

## §9 — WHAT'S NOT IN PHASE 1A

To be explicit about deferred scope:

| Feature | Phase | Reason |
|---|---|---|
| Monthly granularity stabilization (instead of annual) | 1B | Requires correlation engine query against historical_observations + new agent tool |
| Empirical concession-velocity reasoning | 1B | Requires sufficient historical_observations data density per submarket |
| Concession-and-rent temporal profiles as inputs | 1B | Tied to agent's monthly trajectory reasoning |
| Visual stabilization year highlight in Projections | 2 | UI treatment that benefits from Phase 1A operational data |
| Phase labels in Projections (lease-up / stabilized / post-stab) | 2 | Same |
| Monthly trajectory rendering with stabilization month band | 2 | Final-state visualization once monthly granularity exists |
| Strategy-aware threshold (luxury 6-7%, student 2%, etc.) | Later | Requires more deal-type-specific data; universal 5% is V1 default |

---

## §10 — ACCEPTANCE CRITERIA FOR PHASE 1A

Phase 1A is complete when:

1. **CONSOLE > INPUTS displays the Stabilization Threshold input** (default 5%, operator-overridable, LayeredValue)
2. **CONSOLE > INPUTS displays submarket equilibrium context** alongside the threshold (informational only)
3. **The Cashflow Agent writes `deal_assumptions.stabilization_year`** based on the projections vacancy trajectory + threshold + sustainment rule
4. **CONSOLE > PRO FORMA reads from `stabilization_year`** and displays the 12-month operating statement for that year
5. **CONSOLE > PRO FORMA header shows the stabilization year** with the "annual approximation" qualifier
6. **Operator override of stabilization year is wired** as a Layer 1 path (Pro Forma Year input)
7. **The "never stabilizes" edge case flags incomplete** via the Deal Completeness framework
8. **The "already stabilized" edge case works** (Year 1 = stabilization year for qualifying deals)
9. **464 Bishop verification**: with current 19% vacancy and the agent's M07-based absorption reasoning, the stabilization year is computed; CONSOLE > PRO FORMA displays that year's stabilized NOI; verify the value aligns with the broker OM's $2,999,564 (or has a defensible reason for variance)
10. **Task #1639 (Issue A arithmetic fix) merged** and verified in Projections

---

## §11 — VERIFICATION

Per CLAUDE.md P8 and the §11 verification protocol lesson from the corpus: every claim in this map should be verifiable against either code or a specific task description before treating as canonical.

Specific verifications needed before Phase 1A implementation:
- Surface paths (CONSOLE > INPUTS, CONSOLE > PRO FORMA, PROJECTIONS) match current routing — verified by Replit's surface confirmation
- `deal_assumptions` schema can absorb `stabilization_threshold_pct` and `stabilization_year` (or accommodate via existing JSONB)
- Cashflow Agent's existing F9 batch reasoning can read the projections vacancy trajectory to produce the stabilization-year answer
- Submarket equilibrium source (costar_submarket_stats vs. apartment_market_snapshots) has current data for relevant submarkets

The map is target-state architecture. Implementation details will refine as Replit drafts the task and surfaces gaps.

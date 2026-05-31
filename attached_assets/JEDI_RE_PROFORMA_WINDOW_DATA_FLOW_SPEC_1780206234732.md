# JEDI RE — PRO FORMA WINDOW DATA FLOW SPEC

**Purpose:** Document the field-level data flow between CONSOLE > INPUTS, CONSOLE > PRO FORMA, and the PROJECTIONS top-level tab. For each field involved in the Pro Forma Window architecture, specify: where it's read from, where it's written to, what triggers recomputation, and the agent's role.

**Status:** Phase 1A annual granularity. Phase 1B will refine month-level flows when monthly trajectory reasoning ships.

**Companion to:** Surface Map (UI changes), Lifecycle State Machine (state definitions), Math Spec (formulas).

---

## §1 — DATA FLOW PRINCIPLES

Before specifying field-level flows, three principles govern the architecture:

**Principle 1 — One canonical read path per logical value.** (Piece B Commitment B.1.) Every field that's displayed has exactly one read path. Multiple surfaces displaying the same logical value MUST read from the same source. The path is the LayeredValue resolution chain or, where computation is involved, the canonical computation service.

**Principle 2 — Layer 1 override universally available.** (Piece B Commitment 5.) Every field the agent or platform authors has an operator override path. Override wins. The override path is wired regardless of whether the field is an assumption or a calculation.

**Principle 3 — Snapshot-at-ingestion preserves architectural simplicity.** (Vendor Architecture Commitment 2.) Per the Engine A audit, the platform reads from `deal_assumptions.year1` (the snapshot produced at upload/seeding time) rather than iterating raw transactional data at query time. The Pro Forma Window architecture preserves this — the agent's reasoning produces snapshot values that consumers read.

---

## §2 — NEW FIELDS IN PHASE 1A

Three new fields enter the data model in Phase 1A:

### Field: `stabilization_threshold_pct`

**Storage:** `deal_assumptions.stabilization_threshold_pct` (numeric, default 5%)

**Authoring path:**
- Layer 1: Operator override via CONSOLE > INPUTS input field
- Layer 2: Platform default (5%)
- Layer 3: N/A (no broker source)

**Write triggers:**
- Operator edits the threshold in CONSOLE > INPUTS → PATCH `/api/v1/deal-assumptions/:dealId/stabilization-threshold`
- Deal creation defaults to 5% if not specified

**Read consumers:**
- Cashflow Agent (for stabilization-year computation)
- CONSOLE > INPUTS display (to show the operator's current value)
- The submarket equilibrium context UI element (to compare against)

**Recomputation triggers:**
- When threshold changes, agent re-runs stabilization-year detection
- `stabilization_year` recomputes
- CONSOLE > PRO FORMA may re-render with different stabilization year

### Field: `stabilization_year`

**Storage:** `deal_assumptions.stabilization_year` (integer, nullable)

**Authoring path:**
- Layer 1: Operator override via CONSOLE > DEAL TERMS "Pro Forma Year" input
- Layer 2: Cashflow Agent computed from the stabilization-year detection algorithm
- Layer 3: N/A

**Write triggers:**
- Cashflow Agent reasoning run completes → writes computed value
- Operator overrides "Pro Forma Year" → writes override

**Read consumers:**
- CONSOLE > PRO FORMA (to determine which year's operating statement to display)
- CONSOLE > PRO FORMA header (to display "Stabilized: Year N")
- Deal completeness framework (null value → incomplete signal)
- Valuation Grid (to use stabilized-year NOI in cap-rate valuation method)

**Recomputation triggers:**
- Any input change that affects the vacancy trajectory: market rent, current vacancy, renovation pace, lease-up velocity, hold period, threshold, profile classification
- Operator override directly writes the value (no recomputation)

### Field: `lifecycle_profile`

**Storage:** `deal_assumptions.lifecycle_profile` (enum: 'STABILIZED' | 'VALUE_ADD' | 'DISTRESSED' | 'DEVELOPMENT')

**Authoring path:**
- Layer 1: Operator override via CONSOLE > DEAL TERMS "Deal Lifecycle Profile" selector
- Layer 2: Profile detection algorithm (from current occupancy + renovation budget + construction status)
- Layer 3: N/A

**Write triggers:**
- Profile detection runs at deal creation and on material input changes (occupancy, renovation budget, construction_months)
- Operator override

**Read consumers:**
- Cashflow Agent (to apply profile-specific pre-stabilization formulas)
- CONSOLE > PRO FORMA (to potentially display profile context)
- Math engine (Engine A or successor) to branch formulas

**Recomputation triggers:**
- Material change in detection inputs
- Operator override

---

## §3 — DATA FLOW: OPERATOR EDIT → SURFACES UPDATE

The typical operational sequence when an operator edits an input.

### Example flow — Operator changes market rent

```
Step 1: Operator edits market_rent_per_unit in CONSOLE > INPUTS
        UI sends PATCH /api/v1/deal-assumptions/:dealId/market-rent
        
Step 2: Backend writes year1.market_rent.override
        Updates LayeredValue layer; resolved value updates
        
Step 3: Backend triggers Cashflow Agent re-reasoning
        Agent reads updated market rent input
        Agent recomputes vacancy trajectory year-by-year
        Agent re-runs stabilization-year detection algorithm
        Agent writes new deal_assumptions.stabilization_year
        Agent re-runs pre-stab and at-stab formulas
        
Step 4: Backend triggers projection rebuild
        buildProjectionsForExport runs with new inputs
        Year-by-year P&L computed for hold period
        Stabilization year's operating statement is one row in the projection array
        
Step 5: Surfaces invalidate caches and re-fetch
        CONSOLE > INPUTS shows the new market rent value
        CONSOLE > PRO FORMA fetches the stabilization year's row from the projection array, displays it
        PROJECTIONS displays the updated year-by-year columns
        Validation Grid shows updated values
        
Step 6: Operator sees updated state
        Market rent change cascades to NOI, IRR, EM, Valuation Grid in one update
```

### Sequence guarantees

- All surfaces show the same value for any logical field (Principle 1)
- The agent re-reasons synchronously or via event-driven trigger (Principle 3 for snapshot freshness)
- The operator's edit always wins (Principle 2)

---

## §4 — DATA FLOW: AGENT REASONING → STABILIZATION YEAR

The flow when the Cashflow Agent computes the stabilization year (the new Phase 1A reasoning).

```
Step 1: Trigger
        Agent runs because: (a) deal created, (b) material input changed,
        (c) operator requested refresh, (d) scheduled re-reasoning
        
Step 2: Agent reads inputs
        - lifecycle_profile from deal_assumptions
        - current_occupancy from rent roll snapshot or deal_assumptions
        - market_rent_per_unit from CONSOLE > INPUTS (resolved value)
        - vacancy_target from deal_assumptions.stabilization_threshold_pct
        - profile-specific inputs (renovation_units_per_year, construction_months, etc.)
        - hold_period_years
        - rent_growth_pct, expense_growth_pct
        
Step 3: Agent applies profile-specific pre-stab formula
        For each year in 1..hold_period:
          Compute vacancy_year using profile formula
          Compute revenue lines, OpEx lines, NOI
          Apply concession and rent profile transitions
        Result: year-by-year P&L projection
        
Step 4: Agent runs stabilization-year detection algorithm
        Scans vacancy_year values
        Finds first year where vacancy ≤ threshold AND sustained for rest of hold
        Writes deal_assumptions.stabilization_year
        Or writes null if no year qualifies
        
Step 5: Agent runs formula consistency invariant check
        For stabilization_year N:
          Compute NOI_prestab(N) using pre-stab formula
          Compute NOI_stab using at-stab formula
          Check tolerance: |NOI_prestab(N) - NOI_stab| / NOI_stab < 5%
        If tolerance exceeded: flag for review
        
Step 6: Agent writes derived values
        Updates deal_assumptions with:
          - stabilization_year (or null)
          - lifecycle_profile (if newly classified)
          - per-year projection values via year1 + projections JSONB
          - invariant_check_status (passed/failed/skipped)
        
Step 7: Downstream consumers invalidate
        CONSOLE > PRO FORMA re-fetches and re-renders with new stabilization year
        Header updates "Stabilized: Year N"
        Validation Grid updates evidence chips
        Valuation Grid updates cap-rate-based valuation using new stabilized NOI
```

---

## §5 — FIELD-LEVEL READ/WRITE MAP

Per-field documentation of where the field lives, who writes it, who reads it.

### Revenue inputs

| Field | Storage | Writers | Readers | Override path |
|---|---|---|---|---|
| `market_rent_per_unit` | year1.market_rent_per_unit (LV) | CONSOLE > INPUTS, Cashflow Agent | All formulas, all surfaces | PATCH endpoint |
| `vacancy_pct` | year1.vacancy_pct (LV) | CONSOLE > INPUTS, Cashflow Agent | Profile formulas, PROJECTIONS | PATCH endpoint |
| `concessions_pct` | year1.concessions_pct (LV) | CONSOLE > INPUTS, Cashflow Agent | Profile formulas | PATCH endpoint |
| `bad_debt_pct` | year1.bad_debt_pct (LV) | CONSOLE > INPUTS | Profile formulas | PATCH endpoint |
| `other_income_per_unit` | year1.other_income_per_unit (LV) | CONSOLE > OTHER INCOME, Agent | Profile formulas | PATCH endpoint |

### OpEx inputs

| Field | Storage | Writers | Readers | Override path |
|---|---|---|---|---|
| Per-line per-unit OpEx | year1.[opex_line] (LV) | CONSOLE > INPUTS, Agent | Profile formulas | PATCH endpoint |
| Property tax | year1.real_estate_tax (LV) | Tax module, Agent | Profile formulas | PATCH endpoint |
| Insurance | year1.insurance (LV) | CONSOLE > INPUTS | Profile formulas | PATCH endpoint |
| Management fee % | year1.management_fee_pct (LV) | CONSOLE > INPUTS | Profile formulas | PATCH endpoint |
| Replacement reserves | year1.replacement_reserves (LV) | CONSOLE > INPUTS | Profile formulas | PATCH endpoint |

### Capital structure inputs

| Field | Storage | Writers | Readers | Override path |
|---|---|---|---|---|
| LTV / LTC | deal_assumptions.ltv | CONSOLE > DEAL TERMS or INPUTS | Debt service computation | PATCH endpoint |
| Interest rate | deal_assumptions.interest_rate | CONSOLE | Debt service | PATCH endpoint |
| Loan term | deal_assumptions.loan_term_years | CONSOLE | Debt service | PATCH endpoint |
| Hold period | deal_assumptions.hold_period_years | CONSOLE > DEAL TERMS | Stabilization-year search range, exit math | PATCH endpoint |

### Growth and exit inputs

| Field | Storage | Writers | Readers | Override path |
|---|---|---|---|---|
| `rent_growth_pct` | proforma_assumptions.rent_growth_current | CONSOLE > INPUTS, Agent | Post-stab formula, lease-up rent projection | PATCH endpoint |
| `expense_growth_pct` | proforma_assumptions.expense_growth_current | CONSOLE > INPUTS | Post-stab OpEx | PATCH endpoint |
| `exit_cap_rate` | year1.exit_cap (LV) | CONSOLE > INPUTS, Agent | Sale proceeds computation | PATCH endpoint |

### Phase 1A new fields

| Field | Storage | Writers | Readers | Override path |
|---|---|---|---|---|
| `stabilization_threshold_pct` | deal_assumptions.stabilization_threshold_pct | CONSOLE > INPUTS | Cashflow Agent | PATCH endpoint |
| `stabilization_year` | deal_assumptions.stabilization_year | Cashflow Agent (Layer 2), Operator (Layer 1) | CONSOLE > PRO FORMA, Valuation Grid, Deal Completeness | PATCH "Pro Forma Year" |
| `lifecycle_profile` | deal_assumptions.lifecycle_profile | Profile detection (Layer 2), Operator (Layer 1) | Cashflow Agent (formula branching), Math engine | PATCH "Deal Lifecycle Profile" |

> **Correction 3.2 (2026-05-31):** The three Phase 1A fields above (`stabilization_threshold_pct`, `stabilization_year`, `lifecycle_profile`) have been confirmed shipped in Phase 1A tasks #1640, #1644, #1645 (per audit verification). The field names and storage paths in `deal_assumptions` are consistent with what was built. These fields should be treated as **verified-against-implementation** rather than target-state.

### Derived (computed) fields

| Field | Storage | Writers | Readers | Override path |
|---|---|---|---|---|
| `year1.gpr.resolved` | LayeredValue resolved | Agent + getFieldValue | All formulas, all displays | Layer 1 override path |
| `year1.egi.resolved` | LayeredValue resolved | Agent + formula | All formulas, all displays | Override-check-first guard |
| `year1.noi.resolved` | LayeredValue resolved | Agent + formula | Pro Forma, Valuation Grid, F8 Decision | Override-check-first guard (Decision Item B) |
| `year1.total_opex.resolved` | LayeredValue resolved | Agent + formula | NOI computation | Layer 1 override path |
| `projections[year_n].noi` | projections array | buildProjectionsForExport | PROJECTIONS, F8 Decision, IRR/EM computation | per_year_overrides |

---

## §6 — DATA FLOW: PRO FORMA SURFACE RENDERING

How CONSOLE > PRO FORMA renders for any given deal in Phase 1A.

```
Step 1: User navigates to CONSOLE > PRO FORMA
        Frontend fetches /api/v1/deals/:dealId/financials
        
Step 2: Backend builds response
        getDealFinancials returns:
          - deal_assumptions (including stabilization_year, lifecycle_profile)
          - year1 LayeredValues (canonical 12-month operating statement)
          - projections array (year-by-year P&L for hold period)
        
Step 3: Frontend identifies which row to display
        Read deal_assumptions.stabilization_year
        If stabilization_year = 1:
          Display year1 LayeredValues directly
        If stabilization_year > 1:
          Display projections[stabilization_year - 1] row
        If stabilization_year = null:
          Display "Pro Forma window undefined" state
        
Step 4: Frontend renders operating statement
        For each line item:
          Read .resolved from the relevant data source
          Display value, provenance badge (override / agent / extracted)
        
Step 5: Frontend renders header
        Compute display string:
          if override: "Stabilized: Year N (operator override)"
          if agent: "Stabilized: Year N (annual approximation; monthly precision in Phase 2)"
          if null: "Pro Forma window undefined — override required"
        
Step 6: Frontend renders provenance trail
        Per existing F9 Pro Forma sub-tab behavior, each line has source badges
        Stabilization year context badges added for Phase 1A
```

### Edge case: stabilization_year changes while user is viewing

If the operator edits an input that causes the agent to re-run and stabilization_year changes from Year 3 to Year 4 while the user is on CONSOLE > PRO FORMA:

- Frontend cache invalidates
- Pro Forma re-renders with Year 4's data
- Header updates to "Stabilized: Year 4"
- Animation or notification surfaces the change ("Pro Forma window updated based on your input change")

Without this notification, the operator could see numbers change without understanding why.

---

## §7 — DATA FLOW: PROJECTIONS SURFACE RENDERING

How PROJECTIONS top-level tab renders for any given deal in Phase 1A.

```
Step 1: User navigates to PROJECTIONS top-level tab
        Frontend fetches /api/v1/deals/:dealId/financials
        Reads projections array
        
Step 2: Frontend renders year-by-year columns
        For each year 1..hold_period:
          Display revenue lines, OpEx lines, NOI from projections[year-1]
          Per existing PROJECTIONS UI behavior
        
Step 3: Phase 1A: Year-1 anchor (Task #1639)
        Year 1 NOI reads from year1.noi.resolved (the stored value)
        Not from buildProjectionsForExport's component-based recompute
        This closes the INPUTS-vs-Projections divergence
        
Step 4: Phase 1A: Stabilization year is computed but NOT visually highlighted
        deal_assumptions.stabilization_year is available in the response
        But PROJECTIONS UI doesn't visually distinguish it in Phase 1A
        Phase 2 will add the visual highlight
        
Step 5: Per-year overrides applied per existing behavior
        Operator can override any year's GPR, vacancy, OpEx lines via per_year_overrides
        Override resolution chain applies (Layer 1 > computed)
```

### Phase 2 changes (deferred)

- Visual highlight on the stabilization year column
- Phase labels (lease-up / stabilized / post-stab) on year headers
- Monthly view toggle (when monthly granularity ships)

---

## §8 — RECOMPUTATION TRIGGERS

Events that cause cascading recomputation.

### Trigger: Operator edits input in CONSOLE > INPUTS

Cascade:
1. Layer 1 override writes
2. LayeredValue resolved updates
3. Cashflow Agent re-reasoning queued (event-driven)
4. Agent computes new vacancy trajectory, new stabilization year
5. Projections rebuild
6. All surfaces invalidate caches
7. Re-fetch on next user interaction

### Trigger: Document upload (e.g., new T12)

Cascade:
1. Extraction pipeline writes new layer values (T12 layer specifically)
2. LayeredValue resolved may change if T12 layer wins
3. Cashflow Agent re-reasoning queued
4. Same as above from step 4

### Trigger: Vendor data upload (CoStar submarket export)

Cascade:
1. Vendor data writes to historical_observations and vendor-specific tables
2. Submarket equilibrium context may update for relevant submarkets
3. Cashflow Agent's reference data refreshes
4. If agent's reasoning produces different stabilization year given new submarket data, that updates

> **Correction 3.1 (2026-05-31):** Correlation engine data sources — the `CorrelationEngineService` queries `apartment_market_snapshots`, `apartment_trends`, and `metric_time_series`. It does **NOT** query `historical_observations`. The path described in Phase 1B critical dependencies (correlation engine queries against `historical_observations` for empirical concession-velocity reasoning) is a NEW query pattern that does not exist in the current engine. Building it requires: (1) data infrastructure — populate the relevant `historical_observations` columns at scale; (2) stabilization outcome tracking schema — currently no table records actual stabilization dates; (3) new query functions in `CorrelationEngineService` (~3 new methods, 1–2 days each, following `computePairCorrelation` patterns). Each of these is an independent prerequisite; all three must complete before Phase 1B value materializes. Phase 1B's data flow through the correlation engine is therefore a NEW path, not a refinement of existing queries.

### Trigger: Operator overrides stabilization year directly

Cascade:
1. deal_assumptions.stabilization_year writes (Layer 1)
2. NO agent re-reasoning needed (override wins)
3. CONSOLE > PRO FORMA invalidates and re-fetches
4. Header updates to show "(operator override)"

### Trigger: Operator overrides threshold

Cascade:
1. deal_assumptions.stabilization_threshold_pct writes (Layer 1)
2. Cashflow Agent re-reasoning queued
3. Agent re-runs detection with new threshold
4. New stabilization year computed
5. Pro Forma updates

---

## §9 — DEAL COMPLETENESS SIGNALS

The Pro Forma Window architecture contributes new signals to the Deal Completeness framework.

| Signal | Severity | Triggered when |
|---|---|---|
| `lifecycle_profile_unclassified` | Required | Detection algorithm cannot classify (insufficient inputs); no operator override set |
| `stabilization_year_null` | Required | Agent's detection algorithm finds no qualifying year; no operator override set |
| `formula_consistency_violated` | Recommended | Pre-stab and at-stab formulas diverge by >5% at the identified stabilization year |
| `stabilization_threshold_aggressive` | Optional | Operator's threshold is materially lower than submarket equilibrium (e.g., 5% target in a market with 9% equilibrium) |
| `current_occupancy_inconsistent_with_profile` | Recommended | Profile suggests one starting condition; actual current_occupancy doesn't match (e.g., classified as STABILIZED but current_occupancy = 75%) |

Each signal feeds the Deal Completeness UI surface and informs operators about analytical reliability.

---

## §10 — INTEGRATION WITH EXISTING TASKS

| Task | Relationship to Pro Forma Window data flow |
|---|---|
| Task #1520 (NOI override) | The override-check-first guard applies to the NOI computed for the stabilization year, not just Year 1 |
| Task #1521 (per-year overrides) | Continue to apply to projection years; the stabilization year is one of those projection years |
| Task #1536 (LTL per-year override) | Same — LTL trajectory feeds into pre-stab GPR computation for VALUE-ADD profile |
| Task #1639 (Year-1 anchor in buildProjectionsForExport) | Foundation for the data flow; without this, Pro Forma can't reliably read year1 NOI |
| Task #1574 (Deal Completeness framework) | Receives the new signals enumerated in §9 |
| T-B1 (Cross-surface read consistency) | The data flow described here IS T-B1's commitment applied to the Pro Forma Window architecture |

---

## §11 — VERIFICATION

Per CLAUDE.md P8 and P11: this data flow is target-state. State-verification needed before treating as canonical.

Specific verifications needed before Phase 1A implementation:
- The current `getDealFinancials` and `buildProjectionsForExport` services can produce the multi-year P&L the Pro Forma surface needs to read from
- The `deal_assumptions` JSONB structure can absorb the three new fields without schema migration (or migration is scoped explicitly)
- The Cashflow Agent's existing reasoning pipeline can be extended with the stabilization-year detection without architectural restructuring
- Surface re-fetch behavior on input change matches the data flow described (frontend caching, event-driven invalidation)
- The per_year_overrides mechanism's interaction with stabilization-year computation is consistent (an override on Year 3 NOI doesn't break the agent's stabilization-year detection)

---

## §11b — OWNED-PORTFOLIO DATA FLOW: PHASE CLASSIFICATION CORRECTION

> **Correction 3.3 (2026-05-31):** Owned-portfolio data feeding the CashFlow Agent was framed in earlier drafts as a Phase 1B enhancement. **This is incorrect.** The owned-portfolio → CashFlow Agent path already exists and is functional today (Phase 0):
>
> - `fetch_owned_asset_actuals` tool wired to agent — queries `deal_monthly_actuals` for TTM comparables
> - `fetch_owned_asset_opex_ratios` tool wired to agent — returns per-line OpEx from owned properties
> - Comparability scoring (submarket/asset class/vintage/units) operational
> - `value_add_programs_only=true` mode wired with archive P50 fallback
>
> The correct phase classification is:
>
> | Phase | Description | Status |
> |---|---|---|
> | **Phase 0 (existing)** | TTM comparable lookup from owned portfolio via `fetch_owned_asset_actuals` | Already operational; gaps in submarket matching (see Fix A in corrections document) |
> | **Phase 1A (shipped)** | Stabilization-year computation from existing agent reasoning; three new `deal_assumptions` fields | Shipped in tasks #1640, #1644, #1645 |
> | **Phase 1B (future)** | Empirical correlation-engine reasoning against populated `historical_observations` — concession-velocity coefficients, rent-positioning-velocity correlations | Data-blocked; see Correction 3.1 above |
>
> Phase 1B is specifically about adding NEW correlation-engine queries for empirical stabilization reasoning — it is separate from the existing TTM comparable lookup the agent already performs.

## §12 — WHAT THIS DOCUMENT IS NOT

- **Not a UI spec.** Surface Map covers UI.
- **Not the math formulas.** Math Spec covers formulas.
- **Not the lifecycle definition.** Lifecycle State Machine covers profiles and states.
- **Not an API spec.** Endpoint paths are illustrative; actual API design is implementation detail.
- **Not exhaustive.** Phase 1B will add more fields (monthly trajectory data, concession profile data, correlation engine queries). This document captures Phase 1A.

The four documents together describe the Pro Forma Window Architecture: UI changes (Surface Map), lifecycle structure (State Machine), formulas (Math Spec), data wiring (Data Flow Spec). Read all four for the complete picture.

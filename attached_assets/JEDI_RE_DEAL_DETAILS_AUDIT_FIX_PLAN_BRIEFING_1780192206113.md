# JEDI RE — DEAL DETAILS AUDIT FIX PLAN BRIEFING

**Purpose:** Translate the Deal Details UI/Backend audit (2026-05-31) findings into an impact-and-complexity inventory that informs prioritization. This document is a briefing for Replit's own task ranking, not a dispatch.

**Status:** Informational. Replit produces the task sequencing from this inventory using their implementation context.

**Source audit:** `docs/operations/DEAL_DETAILS_UI_BACKEND_AUDIT.md`

---

## ORGANIZING PRINCIPLES

The audit produced 19 BROKEN fields, 65 EMPTY fields, and structural findings across cross-surface consistency, schema drift, Layer 1 override coverage, freshness, and completeness signals. Rather than ranking 84+ individual findings, this briefing groups them by **underlying pattern** because most findings cluster into a small number of root causes.

Six patterns explain the audit's findings:

1. **Resolution-chain bypass** — formula short-circuits in `getFieldValues` override stored layers (NOI is the case; EGI and others likely affected)
2. **Compute trigger gaps** — services exist but no trigger fires at deal creation (JEDI score, market intelligence, risk analysis, module calibration)
3. **Route mounting gaps** — files exist but aren't wired in `index.replit.ts` (6 routes confirmed; 2 of them block operator-visible features)
4. **Ghost endpoints** — UI calls endpoints that have no handlers anywhere (2 confirmed; require decision: implement vs remove fetch)
5. **LayeredValue consumer leakage** — UI components read `.platform`/`.broker`/`.detected` directly, bypassing `.resolved` (4 components confirmed)
6. **Silent degradation** — surfaces fall back to placeholder data or empty state without signaling incompleteness (10+ surfaces)

Plus three structural findings that aren't field-level patterns:

A. **`FIELD_PRIORITIES` agent layer undocumented** — production resolution selects an `agent` layer that isn't declared in the spec
B. **Per-year override coverage incomplete** — Task #1521 fixed GPR/vacancy/OpEx/Other Income; LTL still pending (Task #1536)
C. **Property identity not linked for 464 Bishop** — `deals.property_id` NULL; surfaces fall back to join table; tracked separately by property refactor

---

## PATTERN 1 — RESOLUTION-CHAIN BYPASS

### Operator impact

This is the highest-leverage single fix in the audit. The NOI bypass cascades into:

- Going-in Cap Rate (F2a)
- NOI Margin / Expense Ratio (F3)
- Levered IRR, Unlevered IRR, Equity Multiple (F6)
- Sale Proceeds, Net Distribution Proceeds (F6)
- Sensitivity matrix (F10)
- Goal-seek results (F10)
- Strategy Verdict (F8)
- Cap Rate × NOI method in Valuation Grid (F7)
- Reconciled Valuation (F7)
- Hold Period Sensitivity (F6)

One fix unblocks 10+ operator-visible surfaces. The audit identified this in its "Top 5 most impactful misalignments" as P1.

### What needs to be decided before implementing

The fix has two architectural options (described in detail in the revised calc-vs-assumption doc, §"What about the NOI bug specifically"):

- **Option A** — teach `getFieldValues` formula to respect higher-confidence layers (`year1.noi.om` wins over formula when present)
- **Option B** — make `getFieldValues` consult stored layers first; formula is fallback only

Option B is more aligned with Piece B Commitment B.1; Option A preserves Engine A's computation authority. The architectural decision should be made before Task #1520 implements the override wiring, otherwise the override gets implemented but the formula still wins.

### Likely follow-up

The audit suggests "which other fields use formula-based computation in `getFieldValues` that may bypass their resolution chains?" EGI is the most likely candidate (`nri + other_income` per the audit's cross-surface inventory). A short follow-up audit would inventory all formula-based bypasses.

### Estimated complexity

- Decision: 1-2 days (architectural)
- Implementation: 1-2 weeks (formula refactor + NOI override wiring + verification on 464 Bishop)
- Follow-up audit on other formula bypasses: 2-3 days

---

## PATTERN 2 — COMPUTE TRIGGER GAPS

### Operator impact

The audit found 38 EMPTY fields fall in category (a) "data gap — genuine missing data." The pattern is consistent across them: a service exists and works, a table exists and is queryable, but no trigger fires to populate the table at deal creation or on any predictable schedule.

Affected systems and their downstream surfaces:

- **JEDI score** (CF-04) — F1 Overview tiles, F8 Decision verdict (F8 has a separate live derived verdict, but F1 stays empty)
- **Research Agent for market intelligence** (CF-05) — F1 market context strip, F8 market signal overlay
- **Risk Agent for deal risks** (CF-06) — F8 Decision risk flags, F10 Risk intelligence (currently shows placeholder defaults)
- **Module calibration (M05/M07/M35)** — `proforma_assumptions` stay at baseline scalars across all deals (Finding 2 in prior audit)
- **JEDI score history** — F8 score trend sparkline never populated
- **Debt schedule** — F5 Capital DebtTab empty; F6 Returns LP/GP IRR empty; F8 debt feasibility signal absent
- **Capex items** — F5 Sources & Uses incomplete for value-add deals
- **Comparable properties** — F11 Comps empty (though `sale_comp_set_members` now has 42 county comps, separate from this legacy table)

### Why this is a single workstream rather than 38 tasks

The underlying fix is consistent across cases: define when each trigger should fire (deal creation, document upload, periodic refresh, operator request), implement the trigger, surface completeness state when the trigger hasn't fired yet.

Treating it as 38 separate tasks produces 38 different decisions about triggering policy; treating it as one workstream produces a unified triggering framework that handles all cases.

### Estimated complexity

- Triggering framework design: 1 week
- First three triggers implemented (JEDI score, market intelligence, risk agent): 3-4 weeks
- Remaining triggers + completeness UI integration: 4-6 weeks
- Total workstream: 8-11 weeks

This is the longest-running pattern in the audit but produces the most across-the-board operator improvement.

---

## PATTERN 3 — ROUTE MOUNTING GAPS

### Specific routes and their impact

| Route file | Blocks | Fix complexity |
|---|---|---|
| `investor-capital.routes.ts` | LP/GP investor grid in F5 WaterfallTab (operator-visible, frequently used) | 1 day — one line in `index.replit.ts` |
| `demand-intelligence.routes.ts` | F4 supply/demand balance panel | 1 day — one line |
| `capsule-intelligence.routes.ts` | Advanced AI intelligence for deal capsules (no confirmed UI caller in Deal Details scope) | Defer pending caller identification |
| `reporting-package.routes.ts` | PDF / export generation (no Deal Details caller) | Defer — not blocking Deal Details |
| `zoning-comparator.routes.ts` | Cross-parcel zoning comparison (no Deal Details caller) | Defer — development workflow only |
| `audit.routes.ts` | System audit logs (no Deal Details caller) | Low priority |

### Why this is genuinely trivial

Two of the route mountings are literal one-line changes in `index.replit.ts`. They produce immediate operator-visible improvement. The audit's Section 11 calls these out as "should be mounted before other UI work in these surfaces."

The other four route mountings need decisions about whether they have legitimate callers; mounting them blindly risks exposing routes with no UI consumers.

### Estimated complexity

- Mount `investor-capital.routes.ts`: 1 day
- Mount `demand-intelligence.routes.ts`: 1 day
- Decide disposition of other 4 unmounted routes: 1-2 days investigation per route

---

## PATTERN 4 — GHOST ENDPOINTS

### Two confirmed cases

**Ghost endpoint 1 — `/balance-sheets`**
- Called by `CapitalHubTab.tsx` on mount
- No route handler exists anywhere in the codebase
- Returns 404 silently; balance sheet summary always empty
- Decision required: implement handler OR remove fetch and derive balance sheet from existing `financials` response

**Ghost endpoint 2 — `/roadmap` + `/timeline`**
- Called by `RoadmapTab.tsx` on mount
- No route handlers exist
- Tab is intended for development deals only; current behavior is broken on every load
- Decision required: implement handlers if the feature is intended, OR gate the tab behind `dealType === 'DEVELOPMENT'` and mark as "Coming soon" for non-development deals

### Why this is different from unmounted routes

Mounting an existing route is a one-line fix. Ghost endpoints require either implementing the handler (significant work) or removing the UI call (less work but loses the feature). The decision precedes the work.

### Estimated complexity

- Decisions: 1-2 days each
- Implementation if "implement":
  - Balance sheet handler (likely derivable from financials): 3-5 days
  - Roadmap + timeline handlers: 1-2 weeks (more complex; depends on intended feature)
- Implementation if "remove":
  - Each is 1-2 days of UI cleanup

---

## PATTERN 5 — LAYEREDVALUE CONSUMER LEAKAGE

### Specific components and lines

| Component | Lines | Misuse pattern |
|---|---|---|
| `AssumptionsTab.tsx` | 483, 775, 800 | Direct `row.platform`, `row.broker` reads |
| `OverviewTab.tsx` | 86, 309 | `row.platformRaw`, `row.brokerRaw` for collision detection |
| `DealTermsTab.tsx` | 1583-1610 | `lv.detected`, `lv.override` directly for label logic |
| `SourcesUsesTab.tsx` | 140 | `lv.platform` for Mezz amount fallback |

### Why this matters operationally

These components have operator override UI affordances. Operators set overrides; the resolution chain selects them; the canonical display path shows the override. But adjacent columns in the same components read direct layers, bypassing the resolution. The visual result: override input field updated, but the column displaying that value still shows the platform/broker raw layer. **Operators see their override succeed and then watch it not propagate to the adjacent display.** This is a fundamental confusion in the UX.

### What the fix looks like

The `useLayeredValue` hook and `getResolved()` helper already exist. The fix is replacing direct property access with these utilities. Each component is a localized refactor; no architectural changes needed.

### Estimated complexity

- Each component: 2-3 days
- All four components: 2 weeks
- Tests + verification: 1 week
- Total: 3 weeks

---

## PATTERN 6 — SILENT DEGRADATION

### Specific surfaces

The audit found 10+ surfaces that silently fall back to placeholder/empty state when underlying data is missing:

| Surface | What happens when data missing | Why this is operator-confusing |
|---|---|---|
| F10 Risk | Shows `defaultRiskCategories` placeholder | Operators can't distinguish computed risks from defaults |
| F11 Comps | Generic "Generate" CTA | Doesn't explain *why* comp set is empty |
| F8 Decision market overlay | Doesn't render | Operators don't know analysis hasn't run |
| F1 JEDI tiles | Shows "--" | No explanation of why score is missing |
| F9 Compare | Empty list | No prompt to create initial saved version |
| F2a Validation Grid evidence | Confidence chips silently disappear | Can't distinguish "no evidence" from "evidence fetch failed" |

### Why this is one workstream not 10 tasks

The Deal Completeness framework (Task #1574) is the architectural answer. It already exists for headline surfaces (CompletenesBadge, TrafficModule "M07 not run" panel, ValuationGrid CoStar warning). Extending the framework to additional surfaces is the same pattern: identify the required signal(s) for that surface, check the framework for the signal's state, render an explicit "not run" treatment when missing.

### Estimated complexity

- Per-surface signal registration + UI integration: 1-2 days each
- All 10+ surfaces: 4-6 weeks

This works well as a "running maintenance" workstream rather than a single big push — each surface improvement is independently shippable.

---

## STRUCTURAL FINDING A — `FIELD_PRIORITIES` AGENT LAYER UNDOCUMENTED

### Why this matters

The audit found that fields like `gpr`, `egi`, `payroll`, `g_and_a` carry `resolution: 'agent'` in production but the `FIELD_PRIORITIES` constant in `proforma-seeder.service.ts` doesn't declare the agent layer or its priority position. The audit calls this "undocumented and fragile."

This is foundational. Until the agent layer is either (a) formally added to `FIELD_PRIORITIES`, or (b) the agent is refactored to write to a documented layer, every Piece B and Piece C claim about Layer 1/Layer 2/Layer 3 priority is built on an unstable spec.

### Decision required

- **Option 1** — Add `agent` to `FIELD_PRIORITIES` with explicit priority position. Easier change; codifies current behavior.
- **Option 2** — Refactor the agent to write to a documented layer (e.g., `om` if the agent's authority is "extracted reasoning equivalent to OM" or a new declared layer). More invasive but produces cleaner architecture.

The decision affects every assumption made in Pieces B and C about resolution behavior. It should be made and ratified in the spec before substantial Piece B/C work proceeds.

### Estimated complexity

- Decision: 1-2 days
- Option 1 implementation: 1 week (add to spec, verify resolution code matches)
- Option 2 implementation: 3-4 weeks (refactor agent write paths, update consumers)

---

## STRUCTURAL FINDING B — PER-YEAR OVERRIDE COVERAGE INCOMPLETE

### Status

- Task #1521 fixed: GPR, vacancy, OpEx, Other Income per-year overrides
- Task #1536 pending: LTL per-year override
- Other fields: not audited for per-year coverage

### Required action

- Ship #1536 (LTL per-year override) as the tactical precursor to T-B1's LTL trajectory work
- Audit whether other projection-relevant fields need per-year override coverage (cap rate, growth rates, OpEx by line item beyond aggregate)

---

## STRUCTURAL FINDING C — PROPERTY IDENTITY NOT LINKED

### Status

The audit confirmed `deals.property_id = NULL` for 464 Bishop. Surfaces resolve via `deal_properties` join table fallback. This is tracked separately by the property plumbing refactor.

### No action in this fix plan

The property refactor handles this as its core scope. Listed here only for completeness.

---

## SUGGESTED CLUSTERING FOR PRIORITIZATION

If it helps Replit's task ranking, here's a way to cluster the findings by leverage:

**Cluster 1 — Immediate impact, low complexity:**
- Mount `investor-capital.routes.ts` (1 day)
- Mount `demand-intelligence.routes.ts` (1 day)
- Decide and implement ghost endpoint resolutions (1-2 weeks)

**Cluster 2 — High impact, moderate complexity:**
- Resolve NOI formula-vs-chain decision and implement Task #1520 (1-2 weeks)
- Inventory other formula-bypass cases (2-3 days)
- Decide and implement `FIELD_PRIORITIES` agent layer resolution (1-4 weeks depending on Option 1 vs 2)

**Cluster 3 — Sustained workstreams:**
- Compute trigger framework (8-11 weeks)
- Silent degradation pattern (4-6 weeks of running maintenance)
- LayeredValue consumer leakage cleanup (3 weeks)

**Cluster 4 — Already in flight or queued:**
- T-A through T-B1 (existing task batch)
- #1520 (NOI override; depends on Pattern 1 decision)
- #1536 (LTL per-year; needed before T-B1)
- #1537, #1538 (other tactical precursors)

The clusters aren't a sequence — they're a way to slot findings into existing or new workstreams. Replit knows which clusters fit best with current implementation context.

---

## WHAT THIS DOCUMENT IS NOT

To be explicit:

- **Not a dispatch.** Replit produces the task ranking and dispatches; this briefing supplies the inventory.
- **Not a complete fix list.** The audit's full findings (DEAL_DETAILS_UI_BACKEND_AUDIT.md) are the authoritative inventory; this briefing groups them by pattern for prioritization purposes.
- **Not architecturally prescriptive about patterns 2 or 6.** Both are workstreams that benefit from Replit's implementation judgment on sequencing and scope.
- **Not a substitute for the Pieces A-D architecture.** Many findings are addressed by Piece B (Pattern 1, Pattern 5), Piece C (Pattern 2, Pattern 6), or are foundational to the architecture's stability (Pattern 3, Pattern 4, Structural Finding A).

The audit informs which architectural commitments are most operator-urgent right now. Replit decides which to slot into the next sprint vs the next quarter.

---

## RELATIONSHIP TO OTHER DOCUMENTS

| Document | Relationship to this briefing |
|---|---|
| `DEAL_DETAILS_UI_BACKEND_AUDIT.md` | Source of all findings analyzed here |
| `JEDI_RE_F9_CALCULATIONS_VS_ASSUMPTIONS_REVISED.md` | Updated 2026-05-31 with corrected NOI bug diagnosis informed by this audit |
| `JEDI_RE_PIECE_B_FIELD_RECONCILIATION.md` | Updated 2026-05-31 with the four-problem framing (added formula bypass + agent layer gap) |
| `JEDI_RE_PIECE_C_AGENT_SYNTHESIS.md` | Deal Completeness framework operationalizes Pattern 6 |
| `JEDI_RE_DEAL_CAPSULE_VISION.md` | Capsule rendering inherits any per-surface completeness signal treatments |
| `DEAL_DETAILS_DATA_AUDIT.md` (prior) | Anchor for this audit; 65 EMPTY/19 BROKEN now classified by root cause |
| Reconciliation document (companion) | Tracks which patterns are operational, in-flight, or pending decision |

Per CLAUDE.md P8: this briefing represents the audit's findings as of 2026-05-31. As Replit's task work lands, the patterns' status changes. The reconciliation document tracks current state; this briefing remains as the historical inventory.

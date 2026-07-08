# SPEC — ProForma Composition Model: One Assumption Graph, Sparse Overlays, Tabs as Views
**Status:** Draft for operator ratification · 2026-07-03
**Extends:** `F9_UNDERWRITER_MODEL_SPEC.md`, `DEAL_SHAPING_ADDENDUM.md`, `M09_PROFORMA_SPEC.md`, `LINE_ITEM_UNDERWRITING_SCHEMA.md`
**Problem it kills:** bloated models — one tab per scenario, each a full copy of every input, assumptions scattered and drifting. In this model no assumption ever exists in two places, and tabs cost nothing.

## 1. The composition algebra
A rendered proforma = **engine( base ⊕ overlays, modules )**.

- **Base assumption set** — the deal's canonical assumptions. Exists once. Every field resolves through the provenance chain (`user > agent > engine-derived > platform_default`).
- **Overlays** — SPARSE deltas only. An overlay contains exclusively the fields that differ from base, each with its own provenance. Two overlay kinds, composable in fixed order:
  - `strategy` overlay (BTS / Flip / Rental / STR): exit model, reno capex, rent model, opex profile deltas
  - `structure` overlay (per DealShapeProposal candidate): capital stack, entry costs, situation cost line items, debt terms
- **Scenario** = (base ⊕ strategy ⊕ structure). A field unset in every overlay inherits base — live, not copied. Change base vacancy once; every scenario that didn't override it updates. Drift is impossible by construction.
- **Climate/scenario weights** are goal-seek payload (`targets`, `scenario_set`), never overlay fields — climate changes constraint values, not the math (per shaping addendum §3).

## 2. Two orthogonal dimensions — never conflate
WHO set a value (provenance layer) × WHERE it applies (base vs overlay) are independent. A cell is addressed (field, scenario) and resolves: overlay chain first (structure → strategy), then base; within whichever level defines it, normal provenance precedence applies. The UI badge shows both: "5.4% — agent, Flip overlay."

## 3. Edit semantics (the key UX rule)
An edit made while viewing a scenario tab writes to THAT scenario's strategy overlay by default, with a one-tap "apply to all strategies" promotion that moves it to base. Agent writes follow the same rule and must declare target (base vs named overlay) in the provenance record. No edit ever writes to a rendered tab — tabs have no storage.

## 4. Tabs are views
- A tab = a registered scenario (overlay refs + module config), rendered on demand by the engine. Nothing else persisted per tab. Add tab = create/activate scenario record; delete = deactivate (record persists for vintage/audit; render disappears).
- Agent adds/removes tabs by activating/deactivating scenarios through the same API as the human "+ Strategy" button, with rationale + evidence refs (per shaping Stage 2). User deactivation always wins.
- **Working-set cap:** max 4–6 active scenarios per deal (tier-configurable). Agent proposals beyond the cap queue as suggestions, not tabs. Archive is unlimited; the workspace is not.
- **Diff-first comparison:** because overlays are sparse, scenario comparison renders as "Flip differs from base in 7 assumptions: …" — the deltas ARE the comparison view. This is the anti-bloat payoff for comprehension, and it is the default comparison surface.

## 4b. The Factory Model — base chassis + assembled configuration
The ProForma is a FACTORY: every deal gets the same chassis, and the rest of the model is assembled deterministically from the deal's situation. The tab manifest is a derived config, never hand-curated content.

**Base chassis (every deal, always, in this order):**
| Tab | Content |
|---|---|
| **CHART** | The 15-year ribbon (actuals · gap · projection, boundary, event pins) — CHART-first per standing ruling |
| **PRO FORMA** | The M09 current → stabilized bridge; endpoints + situation modules rendered inline |
| **ASSUMPTIONS** | The assumption graph — progressive disclosure per §6 |
| **RETURNS** | Yearly table, IRR/EM/CoC, exit-month curve (sawtooth where debt clocks exist) |

The base tabs render the deal's PRIMARY strategy scenario. They are never duplicated per scenario.

**Dynamic layer (factory-assembled):**
- **+1 comparison tab per additional active scenario** (strategy or structure), within the working-set cap. Deactivation removes the tab, never the record.
- **Exhibit-class module tabs:** modules render INLINE in PRO FORMA by default; a module earns its own tab only when the ruleset marks it exhibit-class (multi-schedule content): e.g. FL-condo assessment/termination exhibit, cost-to-complete schedule, assumable-debt NPV exhibit, lender-recovery/DPO exhibit. Inline-vs-exhibit is a ruleset fact, not a per-deal judgment.
- **SHAPE tab:** appears iff a DealShapeProposal exists — diagnosis, ranked structures, document requests.
- **Origin-class variants:** `owned_import` renders the console-facing chassis (CHART + actuals-centric PRO FORMA; RETURNS reflects hold-to-date); `archive_import` renders CHART + historical record; neither fabricates absent phases (per lifecycle addendum §5).

**Factory contract (binding):** `manifest = derive(product_type, origin, situation_flags, active_scenarios, shape_proposal, module_ruleset)` — pure function, recomputed on input change, stored only as config. **Product type is the deepest axis: it selects the engine's REVENUE PHYSICS** — multifamily operations → turn-cohort engine; ground-up development → construction/absorption branch (+ `design_3d` assumption door); STR → ADR/occupancy/RevPAR mechanics; commercial (future) → lease-schedule cohorts with TI/LC and rollover. Physics selection is a ruleset fact (same discipline as jurisdiction logic — no `if (productType === ...)` sprawl outside the physics registry). Everything downstream of the monthly rows — debt, disposition, waterfall, sensitivity, invariants, ribbon, tri-tab identity — is product-agnostic and shared. Strategy changes assumptions (overlays); situation changes line items (modules); product type changes physics (engine member). The agent extends the manifest exclusively by changing the INPUTS (activating a scenario, flagging a situation) through the same doors as a user; neither agent nor user edits the manifest directly. A tab that cannot cite the input that summoned it does not render.

## 5. Situation modules (conditional line items)
The line-item schema is modular. A clean stabilized rental shows the minimal proforma. Situation flags (shaping §3.2 incl. cashflow_distress) activate modules deterministically via ruleset — assessment-payoff schedule (fl_condo), cost-to-complete (construction_default), assumption fee + debt-NPV exhibit (assumable_low_coupon), defeasance/yield-maintenance exit schedule, lien-payoff bridge (legal_title), code-upgrade trigger (casualty/FL 50% rule). Module activation: flag ⇒ module is ruleset fact; agent may propose non-obvious activations with rationale; user can force. Modules add engine line items + their input fields — fields which live in base/overlay like any other, NOT in a per-module input silo (no new scatter vector).

## 6. Progressive disclosure (input surface)
Default assumptions panel shows: (a) the solve's binding-constraint inputs, (b) the top-N sensitivity drivers (engine computes sensitivity; N≈8–10), (c) any field with an unresolved collision or below-tier source on a binding constraint (shaping §6). Everything else lives behind "All assumptions," grouped by module. The engine, not a designer, decides what's promoted — so the panel stays honest as the deal changes.

## 7. Vintage & lifecycle compatibility
A pinned vintage records: base + active overlay definitions + module config + hashes. Sparse overlays make vintages small and diffs across vintages meaningful ("between UW v1 and v2 the agent changed 3 fields in the structure overlay"). DealShapeProposal structures are structure overlays by construction — accepting a proposal activates its scenario; committing the deal pins it into the underwriting vintage.

## 8. Invariants (binding)
1. No assumption value is ever stored in more than one place; overlays store deltas only.
2. Tabs/scenarios persist definitions, never rendered numbers (derive-not-store).
3. Overlay writes carry full provenance incl. target declaration; agent writes route through resolve()/FIELD_PRIORITIES (D3 seam).
4. Module inputs are ordinary fields in the graph — modules never create parallel input stores.
5. The engine is the only renderer; every tab is the same engine with a different composition.
6. Working-set cap enforced in UI and API alike (agents use the same doors).

## 9. Out of scope
Cross-deal scenario templates ("my standard flip overlay") — v2, useful, needs Lane A/B ruling. Sensitivity-driven auto-promotion tuning. Scenario-tree branching beyond one strategy × one structure per tab.

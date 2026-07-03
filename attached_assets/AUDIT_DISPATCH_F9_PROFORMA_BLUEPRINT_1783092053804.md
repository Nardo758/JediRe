# AUDIT DISPATCH — F9 PRO FORMA BLUEPRINT: Complete Feature, Computation & Interaction Inventory

**Type:** READ-ONLY. No changes. Deliverable is a blueprint document: `docs/audits/F9_PROFORMA_BLUEPRINT.md`. Hard STOP at end.
**Repo:** `Nardo758/JediRe.git` · backend port 4000
**Purpose:** Before the chassis migration (P2) can be designed, every feature currently living in or around the ProForma must be inventoried so nothing is lost in rehoming. This is the rehoming map's raw material. The prior factory-impact audit (E1–E5) counted tabs and stores; this one goes INSIDE them.
**Standing rule (S1-01):** file:line per feature. A feature is "what a user can see or do," not a component name. Where D2 changed a file mid-flight, blueprint the CURRENT (post-D2) state and mark anything D2 removed.

## B1 · Feature census — every capability, per surface
Walk every ProForma-related surface (ProFormaSummaryTab, FinancialEnginePage tabs, ProFormaWithTrafficSection, terminal FinancialsTab, the Periodic Timeline modal, and any sub-tab bars found inside them). For EACH surface, enumerate:
1. **Displayed content:** every table, column set, metric, chart, badge, and label. For tables: the exact row/line-item list and column definitions (file:line of the definition source).
2. **Interactions:** every button, toggle, editable field, dropdown, drill-down, modal launch, export, and keyboard/F-key binding. Per interaction: what it does, what it calls (endpoint), and whether it mutates data.
3. **Conditional rendering:** anything that appears/disappears and its condition (deal state, feature flag, data presence, tier).
4. **Data sources:** which endpoint/store each displayed number comes from — and specifically whether it reads deal_financial_models, deal_assumptions, periodic_seed, or local state (this extends E2 to per-feature resolution).

## B2 · Computation census — every formula the ProForma surfaces depend on
1. From the deterministic runner (post-D2) and any remaining computation sites: enumerate every computed line item and derived metric (GPR→EGI→NOI chain, ratios, per-unit figures, returns, debt fields) with file:line and the formula in one line each.
2. Map each to its spec source (`M09_PROFORMA_SPEC.md`, `LINE_ITEM_UNDERWRITING_SCHEMA.md`, `CASHFLOW_AGENT_UNDERWRITING_SPEC.md`, `UNDERWRITING_ENGINE_RECLASSIFICATION_SPEC.md`). Three verdicts: **SPEC'D-AND-BUILT** / **BUILT-NO-SPEC** (code invented it — list for spec backfill) / **SPEC'D-NOT-BUILT** (spec promises it — list for gap register).
3. Flag any computation still living in the frontend (component-level math beyond display formatting) — each is a tri-tab-identity risk.

## B3 · Sub-tab & module reality inside the ProForma
1. The ProForma surface reportedly contains its own sub-tab bar (SubTabBar refs seen in prior work). Enumerate its sub-tabs, contents, and how they'd map to the chassis interiors (PRO FORMA sections vs RETURNS sections vs CHART views vs exhibit candidates).
2. Cross-reference the 25-module MODULE_REGISTRY catalogue: which modules have ANY rendered footprint on ProForma surfaces today vs. metadata-only.
3. Sources & Uses, debt schedule, sensitivity, waterfall: does each exist today anywhere (file:line), partially, or not at all? These are the four institutional-model sections the chassis plan assigns homes to — the blueprint must say what exists to rehome vs. build.

## B4 · Strategy & scenario touchpoints
Where does the 4-strategy model (BTS/Flip/Rental/STR) currently surface inside ProForma views (columns? toggles? separate computations?) — file:line. This determines what the scenario-overlay migration must preserve visually.

## B5 · Deliverable — the blueprint
`docs/audits/F9_PROFORMA_BLUEPRINT.md` structured as:
1. **Feature table:** feature → surface → data source → interactions → condition → file:line → proposed chassis home (PRO FORMA section / RETURNS / CHART view / ASSUMPTIONS / exhibit / Deal Details reference / RETIRE-candidate with reason).
2. **Computation table:** metric → formula → spec verdict → file:line.
3. **Gap register:** SPEC'D-NOT-BUILT items + BUILT-NO-SPEC items.
4. **Rehoming risks:** anything whose chassis home is ambiguous or contested — flag for operator decision rather than deciding.
Every "proposed home" is a RECOMMENDATION for operator review, not a plan of record. **STOP after the blueprint is written. No migration work.**

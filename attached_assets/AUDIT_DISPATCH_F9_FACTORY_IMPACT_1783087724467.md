# AUDIT DISPATCH — F9 Current Structure vs. Composition/Factory Model: Impact Evaluation

**Type:** READ-ONLY. No code, schema, or config changes. Deliverable is an impact map for operator review; the spec is NOT ratified until this lands. Hard STOP at end.
**Repo:** `Nardo758/JediRe.git` · backend port 4000
**Reference:** `PROFORMA_COMPOSITION_MODEL_SPEC.md` (incl. §4b factory model) — evaluate against it, do not implement it.
**Standing rule (S1-01):** file:line evidence per claim. Coordinate with D2 if it's mid-flight: this audit reads the same files D2 edits — evaluate against D2's TARGET state where they differ, and say which state each finding refers to.

## E1 · Current tab/surface inventory
1. Enumerate every tab, sub-tab, and panel currently rendered across the F9 Financial Engine surface (FinancialEnginePage + children) AND every other surface that renders proforma/financial content (DealDetailPage sections, AssetHub tabs, terminal FinancialsTab). Per item: component file:line, what data it reads (endpoint/store), whether it's always rendered or conditional (and on what).
2. Map each against the factory chassis: CHART / PRO FORMA / ASSUMPTIONS / RETURNS / dynamic. Verdict per current tab: **CHASSIS-EQUIVALENT** (maps to a base tab), **DYNAMIC-CANDIDATE** (should be summoned by an input), **DUPLICATE** (renders the same content as another surface), **ORPHAN** (cannot cite any input/flag/scenario that would summon it under the factory contract).
3. Count the total: current tab count vs. the factory-derived count for the same deals (Bishop, Highlands). The delta is the headline number.

## E2 · Assumption storage & input-surface census
1. Enumerate every place assumption VALUES are stored (deal_assumptions layers, per_year_overrides, periodic_seed inputs, any component-local state that survives navigation, any duplicated fields across tables). Per store: schema/file:line, which fields, provenance support (yes/partial/no).
2. Enumerate every UI surface where a user can INPUT an assumption. Per surface: which fields, which store it writes, whether writes carry provenance.
3. Verdict per store against invariant §8.1 (no value in two places): **CANONICAL / DELTA-COMPATIBLE** (could become an overlay) / **DUPLICATE-STORE** (violates; migration required) / **LOCAL-STATE-LEAK** (UI state acting as storage).
4. Specifically: how are the four strategies (BTS/Flip/Rental/STR) represented today — separate assumption copies, computed variants, or hardcoded logic? This determines whether strategy overlays are a migration or a greenfield.

## E3 · Module & conditional-rendering reality
1. What does module-wiring/module-registry.ts actually control today (file:line)? Does any current mechanism approximate "flag ⇒ module ⇒ line items/tab," or is all conditional rendering ad hoc per component?
2. Which of the spec's exhibit-class candidates (assessment exhibit, cost-to-complete, debt-NPV, lender-recovery) have ANY existing code/schema footprint vs. pure future?
3. Situation flags: does anything like the §3.2 taxonomy exist in DealContext today, or is S1's flag group the first?

## E4 · Blast radius & migration shape
For each gap found, classify: **CONFORMS** (no change) / **CLEAN MIGRATION** (mechanical, low risk) / **STRUCTURAL** (schema or store consolidation; needs its own gated dispatch) / **CONFLICT** (current behavior contradicts a spec invariant and someone depends on it — name the dependent). Estimate ordering constraints against the D2–D6/S-chain (e.g., "assumption-store consolidation must precede overlay work; can follow D2").

## E5 · Deliverable
One impact table: current element → factory verdict → gap class → migration cost (S/M/L) → sequencing constraint → risk note. Headline: current tab count vs factory count per reference deal; number of assumption stores vs. target of one-plus-overlays. Then STOP — spec ratification and any migration dispatches are operator decisions on this evidence.

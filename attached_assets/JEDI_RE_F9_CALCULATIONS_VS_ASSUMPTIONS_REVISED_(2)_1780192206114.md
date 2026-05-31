# JEDI RE — F9 PROFORMA: CALCULATIONS, ASSUMPTIONS, AND THE LAYEREDVALUE BOUNDARY

**Status:** Revised 2026-05-30. This document replaces the prior version that incorrectly framed the agent-vs-engine boundary as "agent never writes a calculated field." The Deal Details audit and operator clarification established that the agent legitimately authors values across both assumptions and calculations within the LayeredValue resolution chain. The boundary that matters is **operator override authority**, not which layer wrote first.

**Purpose:** Define how F9 ProForma fields are conceptually classified (assumption vs calculation), how the LayeredValue resolution chain applies uniformly across both, and what operator-override wiring is required for every agent-authored field.

**Audience:** Replit's implementation agent, future contributors, anyone making decisions about which fields agents may author and which controls operators must have.

---

## THE GOVERNING ARCHITECTURE

### LayeredValue is universal

Every field in JEDI RE that can come from more than one place is wrapped in a `LayeredValue<T>`. This applies to *both* assumptions and calculations — there is no separate mechanism for one vs the other.

The resolution chain evaluates layers in priority order:

| Layer | Source | Priority | Trust Rationale |
|---|---|---|---|
| **Layer 1** | Operator override | Highest | Human said so explicitly — overrides everything below |
| **Layer 2** | Agent / platform computation | Second | AI-computed or research-pulled; legitimate authority where reasoning applies |
| **Layer 3** | Broker / document extraction | Third | Values extracted from OM, T12, rent roll, tax bill; high-quality source data |

The resolution returns the highest-priority non-null value as `resolved`, tags it with `resolvedFrom` for the UI provenance badge, and sets an `alertLevel` if there's a material conflict between layers (e.g., operator override significantly disagrees with agent computation).

### OperatorStance is a separate dimension

OperatorStance answers a related but different question. The LayeredValue chain answers "what *is* the number?" OperatorStance answers "how should the agent *derive* the number?"

Stance changes (e.g., switching underwriting posture from conservative to aggressive, or changing rate environment from rising to neutral) trigger a re-blend of Layer 2 values using the same cached data. No new LLM call is required. This is the platform's reasoning-style configuration, orthogonal to the resolution chain.

---

## THE REAL BOUNDARY: OPERATOR OVERRIDE MUST ALWAYS BE WIRED

### What the prior doc framed wrong

The original version of this document said "the agent never writes a calculated field." That framing was incorrect. The agent legitimately writes to its layer for any field — assumption or calculation — where it has legitimate reasoning authority. Writing to the agent layer is the agent's role.

The actual boundary the platform requires is this:

> **Every field the agent authors must have a wired operator override path (Layer 1). If Layer 1 is missing for an agent-authored field, the operator cannot correct the agent's view, and the LayeredValue discipline silently degrades to "agent wins by default."**

The Deal Details audit caught this directly: NOI, EGI, GPR were being written to the agent layer correctly, but the Layer 1 operator override path for those same fields wasn't wired. The audit's Finding 1 — originally framed as "agent violating the calculation boundary" — is more accurately framed as "Layer 1 wiring missing for agent-authored fields." Task #1520 is closing this gap by wiring the override path.

### What this means in practice

The architectural rule (verified by the audit and by operator clarification):

1. **Any field that can be agent-authored should have a Layer 1 override surface in the UI.** Operators see the agent's value with a provenance badge; they can override it via PATCH endpoint to `year1[field].override` with optional reason.
2. **The resolution chain selects override over agent, agent over extraction, per priority.** Operators don't fight with the agent for authority — Layer 1 is unambiguously highest.
3. **Conflicts surface as alerts.** When operator override significantly disagrees with agent computation, the UI shows an `alertLevel` so the operator knows their decision diverges from the platform's reasoning.

This applies regardless of whether the field is conceptually an assumption (market rent, vacancy) or a calculation (NOI, EGI). Both go through the same LayeredValue mechanism and both require the override path to be wired.

---

## ASSUMPTION VS CALCULATION — A CONCEPTUAL DISTINCTION, NOT A BOUNDARY

Even though LayeredValue treats them uniformly, the conceptual distinction between assumptions and calculations is still useful. It tells the agent (and operators) how to *reason* about the field:

- **Assumption:** evidence-driven judgment from sources outside the proforma (market rent comps, vacancy from M07 traffic, OpEx per unit from owned-portfolio actuals). The agent reasons from evidence to a value.
- **Calculation:** derivation from other proforma fields via formula (NOI = EGR − OpEx, IRR from cash flow vector, DSCR from NOI / debt service). The agent computes from inputs.

This distinction is *reasoning guidance*, not an authority rule. The agent reasons evidentially for assumptions and computationally for calculations, but in both cases the agent writes to its layer and operator override sits above it.

---

## LAYER 2 (ASSUMPTION) FIELDS — AGENT REASONS FROM EVIDENCE

These are fields the agent derives by reasoning from evidence (per the tier-authority model: Tier 1 actuals → Tier 2 owned-portfolio → Tier 3 platform → conservative default). The agent's reasoning produces a value; the value writes to the agent layer; operator override sits above.

### Revenue assumptions

| Field | Unit | Batch | Evidence source |
|---|---|---|---|
| Market rent per unit | $/unit/mo | 6 | Comp-anchored: M15 rent comps + M05 + EC3 benchmark |
| Vacancy rate | % | 6 | T12 trailing + M07 absorption + submarket floor |
| Loss-to-lease | % | 6 | Rent roll (in-place vs market gap) |
| Concessions | % of GPR | 6 | Trailing + submarket concession environment |
| Bad debt | % of GPR | 6 | Trailing + submarket |
| Other income lines (7 items) | $/unit/mo | 6 | Rent roll / OM / submarket |
| Rent growth rate | % | 4 | M05 submarket trend + M28 macro + wage-growth cap |

### Operating expense assumptions

| Field | Unit | Batch | Status |
|---|---|---|---|
| OpEx lines (R&M, Turnover, Marketing, G&A, Contract Services, 4× utilities, Replacement Reserves) | $/unit/yr | 1 | DONE |
| Property tax | $/yr | 2 | DONE (Tax module) |
| Insurance | $/unit/yr | 2-adj | Has FL multiplier; confirm coverage |
| Management fee | % of EGR | 2-adj | Operator-specific |
| Expense growth rate | % | 4 | Inflation + submarket |

### Capital structure assumptions

| Field | Unit | Batch | Maps to |
|---|---|---|---|
| LTV/LTC | % | 3 | M11 (capital structure now in ProForma per F8 restructure) |
| Interest rate | % | 3 | M11 + rate environment |
| Loan term | years | 3 | M11 |
| Amortization period | years | 3 | M11 |
| Interest-only period | months | 3 | M11 |

### Exit assumptions

| Field | Unit | Batch | Maps to |
|---|---|---|---|
| Exit cap rate | % | 5 | M20 + comp cap rates + M28 macro spread |
| Hold period | years | 5 | M20 / operator |
| Selling costs | % of sale | 5 | Standard + jurisdiction |

### Acquisition / structural assumptions

| Field | Unit | Note |
|---|---|---|
| Purchase price | $ | OUTPUT of Valuation Grid, becomes input to returns |
| Renovation cost per unit | $/unit | Value-add only |
| Renovation premium per unit | $/unit/mo | Value-add only |
| Renovation pace | units/mo | Value-add only |

**Subject characteristics** (units, sqft, year built) are facts about the property, sourced from the unified property record per the property plumbing refactor. They aren't reasoned by the agent; the agent reads them.

---

## LAYER 2 (CALCULATION) FIELDS — AGENT COMPUTES FROM INPUTS

These fields are conceptually calculations — they have deterministic formulas from other fields. **The agent legitimately writes to the agent layer for these fields when it has a synthesized view.** The deterministic engine computation is one valid layer; the agent's computation is another; operator override sits above both.

### Revenue calculations

| Field | Formula | Notes |
|---|---|---|
| Gross Potential Rent (GPR) | `market_rent_per_unit × units × 12 × cumulative_growth` | Engine computes; agent may also write a synthesized view |
| Vacancy Loss $ | `GPR × vacancy_rate` | |
| Concessions $ | `GPR × concessions_pct` | |
| Bad Debt $ | `GPR × bad_debt_pct` | |
| Base Rental Revenue | `GPR − losses` | |
| Other Income $ (per line) | `per_unit × units × 12 × growth` | |
| Total Other Income | `Σ ancillary lines` | |
| **Effective Gross Revenue (EGR)** | `Base Rental + Total Other Income` | Engine computes; agent often writes synthesized view |
| Economic Occupancy | `actual_revenue / potential_gross_revenue` | |

### Expense calculations

| Field | Formula |
|---|---|
| OpEx line $ (per line) | `per_unit × units × growth` or `% of EGR` for mgmt fee |
| **Total Operating Expenses** | `Σ OpEx lines` |
| OpEx Ratio | `Total OpEx / EGR` |

### NOI and returns calculations

| Field | Formula |
|---|---|
| **Net Operating Income (NOI)** | `EGR − Total OpEx` |
| NOI Margin | `NOI / EGR` |
| Annual Debt Service | Computed from loan amount, rate, amort, IO schedule |
| Cash Flow After Debt (BTCF) | `NOI − Annual Debt Service` |
| DSCR | `NOI / Annual Debt Service` |
| Cash-on-Cash (Y1) | `BTCF / equity` |

### Exit / disposition calculations

| Field | Formula |
|---|---|
| Exit NOI | Year N forward-12mo NOI |
| Gross Sale Price | `Exit NOI / exit_cap_rate` |
| Selling Costs $ | `Gross Sale × selling_costs_pct` |
| Loan Payoff | Remaining balance at exit month |
| Net Disposition Proceeds | `Gross Sale − Selling Costs − Loan Payoff` |
| Total Distributions + Proceeds | Cumulative cash flow + net proceeds |
| Net Profit | `Total Distributions − Equity Invested` |
| **IRR** | Newton-Raphson solve on full cash-flow vector |
| **Equity Multiple** | `Total Distributions / Equity Invested` |
| Cumulative Return | Running sum of CF + exit value per year |

### Valuation calculations (Valuation Grid)

| Field | Formula |
|---|---|
| Cap Rate × NOI value | `NOI / market_cap_rate` |
| Sales Comp PPU value | `median_comp_PPU × units` |
| Sales Comp PSF value | `median_comp_PSF × building_sf` |
| GRM value | `median_comp_GRM × gross_rent` |
| GIM value | `median_comp_GIM × gross_income` |
| Per-Unit Benchmark value | `archive_PPU_P50 × units` |
| Replacement Cost value | `land + improvement cost` |
| Reconciled Purchase Price range | Weighted/median across active methods |

---

## CAP RATE — STILL A SPECIAL CASE

Cap rate deserves explicit treatment because it's the field most likely to be confused:

**Going-in cap rate (market cap rate for Cap×NOI valuation):**
- Derived from comp-anchored synthesis (Path B) — each comp's NOI synthesized from platform stats, implied cap rate per comp, aggregated to market via P25/P50/P75
- This is a *calculation* (deterministic aggregation of comp-implied rates)
- The agent may also contribute a synthesized view at the agent layer if its reasoning produces a different value
- Operator override sits above both

**Exit cap rate:**
- A forward-looking judgment — going-in cap + macro-adjusted spread + risk premium
- This is an *assumption* (Batch 5)
- The agent reasons about it; operator can override

These are different fields with different reasoning patterns, both wrapped in LayeredValue with operator override available.

---

## REQUIRED WIRING FOR AGENT-AUTHORED FIELDS

This replaces the "Forbidden agent actions" list from the prior version. The discipline isn't about restricting what the agent writes — it's about ensuring operator authority is always available alongside.

For every field the agent authors:

1. **Layer 1 operator override must be wired in the UI.** A PATCH endpoint exists to `year1[field].override` (or equivalent location for non-year1 fields). The UI surfaces an "Override" affordance on every agent-authored value.
2. **The resolution chain must select override over agent.** No silent agent-wins-by-default behavior.
3. **Conflicts surface as alerts.** When override significantly disagrees with agent value, `alertLevel` is set; UI shows the conflict.
4. **Provenance is visible.** The UI shows `resolvedFrom` so operators see which layer is currently winning.
5. **Reset-to-agent is always available.** Operators can clear an override and revert to the agent's value with one action.

The audit's CF-01 (NOI showing $840K in Valuation Grid) was caused by the Layer 1 override path not being wired for agent-authored Layer 1 calculation fields. Once wired (Task #1520), operators can correct the agent's NOI and the resolution chain selects their override.

---

## WHAT ABOUT THE NOI BUG SPECIFICALLY

**This section was revised 2026-05-31 after the Deal Details UI/Backend audit produced a more accurate diagnosis.**

The earlier framing — that Pro Forma shows correct NOI while Valuation Grid shows $840K — turned out to be wrong. The Deal Details UI/Backend audit confirmed both surfaces actually show $840K. They agree. The bug isn't cross-surface inconsistency; it's a deeper resolution-chain bypass:

- The OM extraction wrote `year1.noi.om = $2,999,564` to the LayeredValue chain — correctly capturing what the broker's OM stated
- The `getFieldValues` service in `ValuationGridService` (and the same pattern in `getDealFinancials`) uses a **computed-formula short-circuit** for NOI: `egi − total_opex`
- For 464 Bishop: `egi = $3,669,151`, `total_opex = $2,828,920`, formula produces $840,231
- The formula wins regardless of what `year1.noi.om` contains or what the resolution chain would select
- The OM-extracted $2.99M sits in the LayeredValue, untouched and unread

There are three architectural lessons here, replacing the earlier framing:

**Lesson 1 — Resolution-chain bypass is a class of bug separate from cross-surface inconsistency.** When a service computes a value via formula and the formula wins over the stored LayeredValue, the LayeredValue's other layers are silently bypassed. The audit found this for NOI; the same pattern likely affects EGI (`nri + other_income`) and possibly other computed fields. This is a different bug class than "two surfaces read different layers" — it's "one surface bypasses the layers entirely."

**Lesson 2 — The fix has two options, with implications for Piece B's architecture.**
- *Option A — Teach the formula to respect higher-confidence layers.* When `year1.noi.om` is present and the alternative is `platform_fallback`, the OM layer should win. This preserves the formula but adds layer-awareness.
- *Option B — Yield to the resolution chain when stored values come from non-fallback sources.* The service consults `getFieldValues` to compute the formula only as a final fallback; stored layers from OM, T12, agent, or operator override win first.

Option B is closer to Piece B Commitment B.1 ("one logical value, one canonical read path"). Option A preserves Engine A's role as a computation authority. The architectural decision is whether NOI's authoritative source is the formula or the resolution chain when both are present.

**Lesson 3 — Layer 1 override is still necessary but isn't the primary fix.** Even if Option A or B is implemented, operators need an override path for NOI. The audit confirmed the override path doesn't exist (`getFieldValues` formula always wins; no PATCH to NOI override; no UI affordance). Task #1520 wires this — but the formula-vs-chain decision precedes it.

Task #1520 should make both decisions: which option (A or B) governs the formula-vs-chain behavior, AND wire the Layer 1 override regardless. Otherwise the override gets implemented but the formula still wins, and the override has no visible effect.

**Class of bug warning:** the audit's finding implies a follow-up audit asking "which other fields use formula-based computation in `getFieldValues` that may bypass their resolution chains?" EGI is the most likely candidate. Every formula-bypass case is a potential silent override of stored layered values.

---

## HOW THIS DRIVES THE F9 BATCHES

The batches are still structured around assumptions because the *reasoning* differs (evidence-driven vs computational), but every batch now includes the discipline of wiring Layer 1 override for every field it touches:

| Batch | Assumptions covered | Required wiring per field |
|---|---|---|
| 1 — OpEx Simple | 10 OpEx per-unit | Override path wired ✓ |
| 2 — Tax | Property tax | Override path wired ✓ (Tax module) |
| 3 — Capital Structure (in ProForma) | LTV, rate, term, amort, IO | Override path required |
| 4 — Growth | Rent growth, expense growth | Override path required |
| 5 — Exit | Exit cap, hold, selling costs | Override path required |
| 6 — Revenue | Market rent, vacancy, concessions, other income | Override path required |
| 7 — Purchase Price | (Valuation Grid output) | Override path required |

The audit's findings (specifically CF-01, CF-08) point at fields where the override path is currently *not* wired. These are pre-requisites for the batches to complete cleanly.

---

## RECONCILIATION ACTION

Before treating this document as canonical:

1. Open `PROFORMA_CALCULATION_TEMPLATE.md` and confirm its enumerated assumption/calculation list. The 22-and-14 count from session memory hasn't been verified.
2. Confirm the LayeredValue priority order matches what's in code (`proforma-seeder.service.ts:297` FIELD_PRIORITIES constant) — **the Deal Details UI/Backend audit (2026-05-31) confirmed that the `agent` resolution layer is present in production but NOT documented in `FIELD_PRIORITIES`.** This is undocumented and fragile per the audit's Section 11 Finding 7. Either `FIELD_PRIORITIES` needs updating to declare the agent layer with explicit priority position, or the agent needs to be refactored to write to a documented layer.
3. Confirm OperatorStance re-blend behavior matches the description here (caches Layer 2, no new LLM call).
4. Where this doc and live state diverge, live state is authoritative.

This is a P8 state-verification step. Do it before the batches that depend on this boundary (Batch 6 Revenue, Batch 7 Purchase Price) fire.

---

## RELATIONSHIP TO OTHER DOCUMENTS

| Document | How this revision changes it |
|---|---|
| `JEDI_RE_AI_COMPUTE_DERIVATION_AUDIT.md` | The audit instrument's "smoking gun" framing (agent writing NOI/IRR violates boundary) is reframed. The agent writing NOI/IRR is correct; what was missing is operator override wiring. The audit's CONVERT verdicts should be re-evaluated under this framing. |
| `JEDI_RE_DEAL_CAPSULE_VISION.md` | Layer 1 override wiring becomes an explicit capsule acceptance criterion: every agent-authored field is operator-correctable. |
| `JEDI_RE_STRATEGY_AWARE_MODULES.md` | The "default-with-override" pattern in that doc is the same architectural commitment as Layer 1 wiring in this doc. Same principle, different surface. |
| `JEDI_RE_PROPERTY_PLUMBING_REFACTOR.md` | LayeredValue treatment of property fields per Part 4 of the refactor spec is consistent with this revised framing — every multi-source field has Layer 1 override available. |
| `DEAL_DETAILS_DATA_AUDIT.md` | Finding 1's diagnosis is reframed (Layer 1 wiring gap, not agent boundary violation). The 10 critical findings remain valid; their resolution path is "wire the override" not "constrain the agent." |

---

## NOTE TO REPLIT

When implementing any field the agent authors:

1. Confirm the LayeredValue structure exists in the source table
2. Confirm a PATCH endpoint exists to write to Layer 1 (`override`)
3. Confirm the UI surfaces the override affordance
4. Confirm the resolution chain selects override over agent
5. Confirm Reset-to-Agent is available
6. Confirm `alertLevel` fires when override and agent disagree materially

This is the discipline that prevents the audit's Finding 1 from recurring. It applies to every field — assumption or calculation — that any agent may author.

Per CLAUDE.md P8: state-verify the LayeredValue priority order, the FIELD_PRIORITIES constant contents, and the OperatorStance re-blend behavior against live code before treating this document's claims as confirmed.

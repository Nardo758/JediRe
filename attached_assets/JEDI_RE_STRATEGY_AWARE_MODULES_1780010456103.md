# JEDI RE — STRATEGY-AWARE MODULES ARCHITECTURE & MATRIX

**Purpose:** Define how F3 Markets, F4 Supply, F6 Traffic, and F8 Debt — plus comp selection threaded through all of them — read the deal's investment strategy and adapt their behavior to it. Companion to `JEDI_RE_MASTER_PLAN_FOR_REPLIT.md` and `JEDI_RE_DEAL_CAPSULE_VISION.md`.

**Why this exists:** The platform's modules currently behave the same regardless of deal strategy. M15 surfaces 20 rent comps when a value-add story needs the two that show the rent-ceiling gap. F3 surfaces generic market signals when a ground-up story needs supply-pipeline-adjusted absorption. This isn't four module-specific fine-tuning problems — it's one architectural gap: **no shared strategy concept that modules read to align their surfaces toward the same goal of value creation.**

**Calibration honesty:** My grounding is stronger on F3 Markets and comp selection (heavy session focus) than on F4 Supply, F6 Traffic, F8 Debt. The cells for the latter three reflect best-effort reasoning from the platform's module documentation; operator instincts should override mine where they conflict.

---

## PART 1 — THE GOVERNING PRINCIPLE

> **Platform proposes, operator disposes, system remembers.**

Three commitments form one architectural pattern:

1. **The platform makes a judgment call.** Given strategy, geography, deal type, and available data, the module proposes a strategy-appropriate default surface.
2. **The reasoning is transparent.** The operator sees *why* this is the default — what criteria were applied, what tier hierarchy was used, what was filtered out. No black-box "platform says trust me."
3. **The operator is in the driver's seat.** Every default has explicit adjustment affordances — expand, swap, exclude, override. Adjustments persist per deal and survive agent re-runs.

This is the same pattern that already governs assumptions (LayeredValue: broker > platform > user) and agent reasoning (Mandate v1.3: agent reasons, user overrides, overrides persist). Strategy-awareness extends the pattern to **what gets surfaced**, not just what value gets used.

### Why this matters

Strategy is a useful frame, but every deal has nuances the strategy concept can't capture:
- An off-market acquisition with unique buyer-seller dynamics
- A value-add where the renovation thesis is unconventional
- A ground-up in a submarket where supply data is incomplete
- An opportunistic deal that doesn't fit standard strategies

The default-with-transparent-override pattern lets the platform do the first pass so the operator spends judgment on the calls that actually need it. It also keeps the platform from feeling prescriptive — strategy frames the conversation, doesn't dictate it.

---

## PART 2 — WHERE STRATEGY LIVES (THE CONTRACT)

For modules to be strategy-aware, there has to be a canonical strategy contract they read. Two existing primitives:

### `investmentStrategy` (A1 canonical)
Per the EC1 work, `investmentStrategy` is the canonical field on the deal record. It carries the strategy type plus any sub-attributes. Modules read this field; they do not infer strategy from other signals.

### `resolveProjectType(deal)` (deterministic routing)
Per the cashflow agent spec, `resolveProjectType()` deterministically routes deals to variants (existing / value-add / lease-up / development / redevelopment). This routing also determines which deal-type variant of the ProForma fires. The same routing must thread through every module's strategy-aware behavior.

### The strategy taxonomy this document operates against

Four canonical strategies, each with the deal-type variant routing already in the platform:

| Strategy | Deal-type variant | Defining characteristic |
|---|---|---|
| **Stabilized / Core** | Existing | Mature property, in-place NOI, price discipline; value creation = spread trade or hold-for-yield |
| **Value-Add** | Existing (subtype) | In-place NOI + identifiable upside through renovation, repositioning, operational improvement |
| **Ground-Up Development** | Development | No existing property; value creation = entitlement + construction + lease-up |
| **Redevelopment** | Redevelopment | Existing property + substantial repositioning; phased current ops → repositioning → stabilized |

Lease-Up exists as a variant but is treated as a transition state of Ground-Up post-TCO, not a separate strategy.

**State verification needed (P8):** confirm `investmentStrategy` today carries enough information for modules to differentiate. If it's a flat enum without sub-attributes, the contract may need extending. Worth checking before treating strategy-aware modules as buildable against current state.

---

## PART 3 — THE ARCHITECTURAL SPLIT: SELECTION vs FRAMING

Strategy-awareness lives in two different places depending on what it affects:

### Selection — in the module
When strategy fundamentally changes *what data is returned*, the module handles it. Example: M15 comps. A value-add deal should not just hide the irrelevant comps from a flat list of 20 — it should *select* the rent-ceiling-gap pair as its primary comp set. The selection is module-level.

### Framing — in a projection layer
When strategy changes *how data is presented* without changing what's underneath, a projection layer between module output and UI handles it. Example: F3 Markets. The underlying submarket data is the same; what changes by strategy is which signals are surfaced as primary, which are collapsed, and which narrative framing is applied.

### Why both, not just one
- Pure module-level (everything strategy-aware in each module): four places to update strategy logic; modules become bloated; cross-cutting strategy refinements require touching every module.
- Pure projection-level (modules stay strategy-blind, projection does everything): doesn't work for selection — projection can't make M15 select the right comps if M15 already returned the wrong 20.

The split: **selection where strategy changes what data exists; framing where strategy changes what's emphasized.**

### What the projection layer looks like

A `StrategyProjection` service sits between module output and UI:

```
Module (M07 Traffic, etc.) → raw output
   ↓
StrategyProjection.project(rawOutput, deal.investmentStrategy)
   ↓
UI layer renders strategy-projected output
```

The projection service reads strategy + raw module output, returns the surfacing rules: which sections are primary vs collapsed, which signals are emphasized vs muted, what narrative frame applies. The UI consumes the projection.

Operator adjustments are captured at the projection layer and persisted to the deal — overriding the projection's defaults without modifying the underlying module logic.

---

## PART 4 — THE DEFAULT-WITH-OVERRIDE CONTRACT

Every strategy-aware surface follows the same three-part contract:

### 1. The default
What the platform proposes given strategy, geography, deal type, and available data. This is the starting state.

### 2. The reasoning
Visible to the operator. Three things must be answerable:
- *What was applied?* (criteria, tier hierarchy, strategy logic)
- *What was included?* (the items present in the default)
- *What was excluded and why?* (so the operator can override if the exclusion was wrong)

The third is non-negotiable. Without it, "the platform's default" feels like a black box, and operators can't tell whether to trust it.

### 3. The adjustment affordances
First-class actions, not workarounds. The operator can:
- **Expand** criteria (wider radius, broader vintage, additional tiers)
- **Add** specific items the system didn't surface (by address, by ID)
- **Swap** items within the surface
- **Exclude** items present in the default
- **Re-weight** how the surface composes (e.g., emphasize ceiling comps over in-place)
- **Reset to default** at any time

### How adjustments persist
Operator adjustments are stored as a deal-specific override on the projection defaults — same LayeredValue pattern as assumption overrides. They:
- Survive agent re-runs (per Mandate v1.3)
- Travel with the capsule
- Freeze on share (per Deal Capsule Vision Part 5)
- Are visible in the audit trail (who adjusted, when, why if reason provided)

---

## PART 5 — THE 4×4 MATRIX

Four strategies × four modules. Each cell specifies default behavior + reasoning + adjustment affordances. **Read F3 Markets cells with most confidence; F4 Supply / F6 Traffic / F8 Debt cells are best-effort reasoning that operator instinct should refine.**

### 5.1 — F3 MARKETS

| Strategy | Default surface | Reasoning shown | Adjustment affordances |
|---|---|---|---|
| **Stabilized** | Cap-rate environment (going-in + spread to risk-free); rent stability indicators; supply overhang risk for exit cap defense | "Showing cap-rate compression vs expansion signals because strategy = stabilized. Supply overhang risk surfaced because exit cap is the primary terminal value lever." | Toggle to alternative narrative frames (yield-on-cost emphasis; cap-rate-arbitrage emphasis); add/remove submarket indicators; expand geography |
| **Value-Add** | Rent-growth ceiling signals; renovation premium achievability per comp set; class-A delivery competition; rent-gap submarkets | "Surfacing rent-ceiling-gap signals because value creation = capturing untapped rent premium. Class-A deliveries surfaced as ceiling references, not as direct competition." | Override which deliveries count as ceiling vs competition; add submarkets for cross-market like-kind reference; re-weight rent-gap vs occupancy signals |
| **Ground-Up** | Absorption headroom; supply-constrained submarket signal; new-construction trade comps; entitlement-velocity benchmarks | "Showing supply-constrained submarket signal because strategy = ground-up; success requires absorption headroom. New-construction trade comps surfaced because exit thesis is new-product disposition." | Adjust supply horizon (12mo/24mo/36mo); change absorption baseline; add cross-market benchmarks for new-product cap rates |
| **Redevelopment** | Hybrid: rent-ceiling signals (value-add half) + absorption signal (ground-up half during repositioning); class-transition comp evidence | "Hybrid surface because redevelopment carries both value-add and ground-up risk profiles. Class-transition comps show whether other operators have successfully repositioned at this scale." | Adjust which phase's signals dominate (current ops vs repositioning vs stabilized); add transition-evidence comps manually |

### 5.2 — F4 SUPPLY

| Strategy | Default surface | Reasoning shown | Adjustment affordances |
|---|---|---|---|
| **Stabilized** | Supply overhang risk on exit cap; pipeline within X miles of subject by year of delivery; cap-rate impact estimate of supply | "Strategy = stabilized; primary supply concern is overhang depressing exit cap rate. Showing deliveries by year through hold + 24 months to capture exit-window competition." | Adjust radius; adjust hold horizon; toggle between unit-count vs SF view; add operator-known supply not in pipeline data |
| **Value-Add** | Competing supply that could cap rent growth during renovation; class-A deliveries setting upper rent bound; renovation-window supply timing | "Strategy = value-add; competing supply matters for rent-growth defense during renovation period. Class-A deliveries shown as the rent ceiling the renovation is chasing." | Distinguish competing-supply (same class) from ceiling-reference (different class) manually; adjust renovation horizon; exclude pipeline items not realistically competing |
| **Ground-Up** | Competing deliveries during your lease-up window; absorption-vs-supply balance per quarter; submarket pipeline saturation | "Strategy = ground-up; lease-up window is the existential risk. Showing supply timing relative to your projected TCO + 12mo absorption." | Adjust assumed TCO date; adjust assumed absorption pace; adjust pipeline confidence (which entitlements are likely to deliver vs slip) |
| **Redevelopment** | Phased view: competing supply during current ops, during repositioning, during stabilized exit; class-transition supply | "Strategy = redevelopment; supply impact varies by phase. Surfacing supply timed against your phased operations." | Adjust phase boundaries; manually flag pipeline items as competing-vs-noncompeting per phase |

### 5.3 — F6 TRAFFIC

| Strategy | Default surface | Reasoning shown | Adjustment affordances |
|---|---|---|---|
| **Stabilized** | Trade-area traffic stability over rolling 24mo; absorption confidence on baseline NOI; tenant retention indicators | "Strategy = stabilized; primary concern is whether traffic supports the in-place NOI baseline. Showing trailing 24mo stability + leading indicators of demand softening." | Adjust trailing window; toggle leading-indicator weights; exclude data series that don't apply to this submarket |
| **Value-Add** | Traffic trend in trade area (improving = supports renovation premium); demographic in-migration signals; renter-profile shift | "Strategy = value-add; traffic improvement supports the renovation premium thesis. Surfacing whether trade-area traffic is trending toward renovated-asset renters." | Adjust which renter-profile signals weight most; add demographic overlays manually |
| **Ground-Up** | Forward absorption forecast per M07 calibrated to subject submarket; demand-driver proximity (employment nodes, transit, retail); leasing-velocity benchmarks for comparable new deliveries | "Strategy = ground-up; absorption is the deterministic lease-up driver. Showing M07 forward forecast + demand-driver proximity + comparable-delivery velocity." | Adjust which demand drivers count; change absorption baseline source (M07 model vs operator-supplied); add comparable deliveries manually |
| **Redevelopment** | Trade-area traffic stability during current ops + demand-shift forecast for repositioned product; class-transition demand evidence | "Strategy = redevelopment; need both current-ops stability AND demand for the repositioned product. Surfacing both with phase markers." | Toggle phase focus; adjust how much weight to give current-class vs post-reposition demand signals |

### 5.4 — F8 DEBT

| Strategy | Default surface | Reasoning shown | Adjustment affordances |
|---|---|---|---|
| **Stabilized** | Agency / portfolio lender spread; DSCR through hold; rate-sensitivity analysis on exit refinance or exit cap | "Strategy = stabilized; debt math optimizes for DSCR through hold + rate environment at exit. Surfacing agency vs portfolio spread because stabilized deals typically tap agency markets." | Adjust hold horizon; change exit-refinance assumption; adjust DSCR threshold for sizing |
| **Value-Add** | Bridge-to-perm transition sizing; DSCR through renovation (often constrained); takeout-rate sensitivity; reserve sizing | "Strategy = value-add; debt structure typically bridge-to-perm because renovation period has DSCR weakness. Surfacing transition timing + takeout sensitivity." | Adjust renovation horizon affecting transition timing; change takeout-rate assumption; adjust reserve requirements |
| **Ground-Up** | Construction loan sizing; LTC vs LTV constraint binding; conversion-loan terms post-stabilization; construction-period interest reserve | "Strategy = ground-up; primary debt structure is construction loan + perm takeout. Surfacing LTC sizing + interest-reserve sizing." | Adjust construction timeline; change conversion-loan assumptions; adjust LTC vs LTV constraints |
| **Redevelopment** | Hybrid: bridge sizing for current ops + redevelopment + perm takeout post-stabilization; multi-phase DSCR | "Strategy = redevelopment; debt structure spans current-ops phase + redevelopment phase + stabilized phase. Surfacing phase-by-phase DSCR + bridge-to-perm timing." | Adjust phase boundaries; adjust bridge-vs-perm transition timing; modify DSCR threshold per phase |

---

## PART 6 — THE COMP SELECTION MATRIX (SEPARATE)

Comp selection threads through all four F-key modules — F3 references comp evidence, F4 uses comp deliveries, F6 uses comp lease-up velocity, F8 uses comp cap rates. So strategy-aware comp selection deserves its own matrix. **This is where the value-add ceiling-comp insight crystallizes.**

### The dual-set principle (value-add specifically)

Value-add deals are unique in that **one comp set isn't enough**. The strategy story requires showing:
- **In-place ceiling set** — current-condition comps proving the rent achievable at today's product spec
- **Renovation target set** — newer / renovated / different-class comps proving what the renovation premium is chasing

These two sets together tell the story: "we buy at X cap on in-place NOI, renovate to capture the gap between in-place and renovation-target rents, exit at Y." The gap between the two sets *is* the value creation thesis.

The renovation target set often violates the normal relevance score — newer vintage, different class, possibly different submarket. That's not a bug; it's the strategy. The platform's default should propose the ceiling references; the operator should be able to override which specific comps serve that role.

### The comp selection matrix per strategy

| Strategy | Default comp behavior | Reasoning shown | Adjustment affordances |
|---|---|---|---|
| **Stabilized** | One tightly-clustered comp set: trade area first → expand to submarket if <5 qualifying → expand to MSA if still <5; same class, ±10yr vintage, recent sales/leases | "Tight cluster because stabilized story is cap-rate convergence. Started in trade area, found N comps, used those because count ≥5." | Expand radius; expand vintage band; expand class match; add specific comps; exclude comps; re-rank |
| **Value-Add** | **Two sets:** (1) in-place ceiling — trade area, current-condition Class B; (2) renovation target — newer / renovated / Class A or B+ as appropriate. Both surface as primary content; the gap between them is the headline. | "Two sets because value-add story is the rent-ceiling gap. In-place ceiling shows achievable rent today; renovation target shows what the renovation premium is chasing." | Move comps between sets; manually add ceiling references from outside normal tier hierarchy; adjust which comps weight most heavily in each set |
| **Ground-Up** | Two sets: (1) recently-delivered comps in subject submarket (<3yr vintage) for lease-up velocity and achieved rent; (2) cross-market new-construction trade comps for exit cap reference | "Strategy = ground-up; story is new-product execution. Local recent deliveries prove lease-up; cross-market new-construction trades prove exit cap." | Expand vintage band; add cross-market deliveries manually; adjust which comps weight most for lease-up vs exit cap |
| **Redevelopment** | Two-or-three sets: (1) current-ops comps proving in-place value; (2) class-transition comps proving repositioning thesis; (3) optionally renovation target as in value-add | "Strategy = redevelopment; needs evidence for current ops + transition + stabilized state. Surfacing comps for each phase." | Move comps between sets; adjust transition-evidence comps manually |

### Geographic hierarchy threaded through

The trade area → submarket → MSA cascade still applies, but strategy modulates it:
- **Stabilized** — strict trade area preference; expansion is flagged with confidence decay
- **Value-add** — trade area for in-place set; the ceiling set may legitimately reach outside trade area to find renovated comps; that's not failure to find local comps, it's strategy-appropriate selection
- **Ground-up** — trade area + submarket for local deliveries; cross-MSA for new-construction trade comps (which is strategy-appropriate, not failure)
- **Redevelopment** — same hybrid logic as value-add

The reasoning shown to the operator must make this strategy-appropriate cascading explicit, not present cross-MSA comps as a "data gap" when they're actually the right reference.

### The "show all" affordance

Even with strategy-aware selection, operators sometimes want to see the broader pool to confirm the selection captured the right comps. Every strategy-aware comp surface should have a **"show all candidates"** affordance — expanding from the strategy-selected set (5-8 comps) to the broader candidate pool (20+ if applicable) with the strategy-selected ones highlighted. The operator can then confirm the selection or swap in alternates.

This is the "transparency" leg of the contract — operators can verify the default rather than trusting it blindly.

---

## PART 7 — THE PERSISTENCE MODEL

Operator adjustments to strategy-aware surfaces are first-class deal data, not session state.

### What persists
- **Selection overrides** (which comps are included/excluded, which sets they belong to)
- **Framing overrides** (which sections are primary vs collapsed in F3/F4/F6/F8)
- **Criteria overrides** (radius, vintage band, class match, recency window)
- **Re-weighting decisions** (e.g., "weight ceiling comps higher than in-place")
- **Manual additions** (comps, signals, indicators the operator added by hand)

### How it persists
Same LayeredValue pattern as assumptions, applied to surface configuration:
```
{
  "layer": "user",
  "value": <adjusted_selection_or_criteria>,
  "source": "operator_adjustment",
  "set_at": <timestamp>,
  "set_by": <user_id>,
  "reason": <optional>
}
```

### Behavior on agent re-run
Per Mandate v1.3: agent re-runs re-derive *defaults*; user adjustments survive on top. If the agent's new default contradicts a user adjustment, the conflict surfaces in the audit trail but the user adjustment holds. Operator can "reset to current default" explicitly.

### Behavior on share (per Deal Capsule Vision)
Strategy-aware surfaces with operator adjustments are part of the capsule's frozen state on share. Recipient sees the operator's curated comp set, not the platform's default. The reasoning panel shows what was adjusted and (optionally) why.

---

## PART 8 — WHAT THIS DOESN'T DO (HONEST LIMITS)

Strategy-awareness is a useful frame, not omniscience. The architecture should not pretend it captures everything.

### Cases strategy can't capture
- **Off-market acquisitions** with unique buyer-seller dynamics that distort price discovery
- **Unconventional value-add theses** (e.g., short-term rental conversion, condo deconversion, master-lease structures)
- **Opportunistic deals** that don't fit any standard strategy
- **Distressed acquisitions** where the underwriting story is more about basis than yield
- **Joint ventures** where capital structure assumptions are governed by partnership economics, not deal economics

For these, the platform should:
1. Apply the closest strategy as a starting frame
2. Make heavier use of the override affordances visible
3. Let the operator override the strategy frame itself at deal level (a "this is opportunistic, not stabilized" flag that adjusts how strict the strategy defaults are)

### Cases where strategy is contested
Some deals are genuinely between strategies — a stabilized property with a small renovation opportunity, or a partial redevelopment. The architecture should allow:
- **Multi-strategy view** — see how the deal looks framed as stabilized AND as value-add; compare the two
- **Strategy-mix configuration** — explicitly assign weights ("60% stabilized return, 40% value-add upside") that modulate the defaults proportionally

This is future scope, not Day 1. But the persistence model should be designed to allow it later — don't bake single-strategy assumptions into the override structure.

---

## PART 9 — IMPLEMENTATION SEQUENCING

### Wave 1 — Foundation (prerequisite)
1. **State-verify the strategy contract.** Confirm `investmentStrategy` carries enough information; extend if not. This gates everything else.
2. **Build the `StrategyProjection` service skeleton.** Empty projection — passes module output through unchanged. Establishes the architectural slot for strategy-aware framing.
3. **Add the operator-adjustment persistence layer.** LayeredValue-style overrides for surface configuration, stored per deal.

### Wave 2 — Comp selection (highest leverage)
4. **Implement strategy-aware comp selection in M15.** Per Part 6 matrix. Start with value-add (the two-set pattern) because the headline gap is most concrete there.
5. **Implement "show all candidates" affordance.** Operators can verify the default selection.
6. **Wire operator adjustments to comp selection persistence.**

### Wave 3 — Module-by-module strategy-aware framing
7. **F3 Markets** — first because grounding is strongest; validates the projection pattern
8. **F4 Supply** — next because supply data shape is similar to market data
9. **F6 Traffic** — leans on existing M07 calibration; mostly projection-layer work
10. **F8 Debt** — depends on M11 Capital Structure being audited (per Batch 3); sequence after that

### Wave 4 — Refinement
11. **Multi-strategy view** (future) — see deal framed as multiple strategies side-by-side
12. **Strategy-mix configuration** (future) — explicit weighting between strategies for hybrid deals
13. **Cross-module strategy consistency** — automated checks that strategy-aware modules are surfacing aligned signals (e.g., F3 says "rent growth supportive" while F4 says "supply overhang" — flag the tension)

---

## PART 10 — ACCEPTANCE CRITERIA

Strategy-awareness is realized when:

1. **Every F3/F4/F6/F8 surface reads `investmentStrategy` and adapts its default surface accordingly.** Operator sees different defaults on a stabilized deal vs a value-add deal vs a ground-up deal at the same address.
2. **Every strategy-aware surface shows reasoning visibly.** Operator can see what was applied, what was included, what was excluded, and why.
3. **Every strategy-aware surface has full adjustment affordances** per Part 4 — expand, add, swap, exclude, re-weight, reset.
4. **Operator adjustments persist per deal** and survive agent re-runs.
5. **The comp selection matrix functions per Part 6** — value-add surfaces both in-place and ceiling sets; ground-up surfaces local + cross-market sets; the dual-set pattern is the headline surface, not buried.
6. **Cross-cutting alignment is visible** — the operator sees that all four modules are aligned around the same strategy frame, telling a coherent story toward value creation, rather than four independent voices.
7. **Override frequency declines over time as defaults sharpen** — measured by analytics on how often operators adjust each default. High override rates on a default indicate the default is wrong; low override rates indicate it's calibrated.

When these hold, the platform's modules align toward the same goal — value creation per the deal's strategy — while preserving operator authority over the calls that need judgment.

---

## A NOTE TO REPLIT

When implementing any strategy-aware feature, the order of operations is:

1. **Read strategy** (`deal.investmentStrategy` + `resolveProjectType()`)
2. **Compute strategy-appropriate default** per the matrix above
3. **Surface reasoning** — what was applied, what was excluded
4. **Provide adjustment affordances** — every override path is first-class, not a workaround
5. **Persist adjustments** via the LayeredValue-style override layer
6. **Re-run resilience** — agent re-runs preserve adjustments

This pattern applies to F3, F4, F6, F8, M15 comp selection, and to any future strategy-aware surface added to the platform.

Per CLAUDE.md P8: state-verify `investmentStrategy` field structure and the existence of `resolveProjectType` routing before treating this document's assumptions as confirmed. Where the document and live state diverge, live state is authoritative.

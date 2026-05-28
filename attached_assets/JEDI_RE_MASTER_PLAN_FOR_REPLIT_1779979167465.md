# JEDI RE — MASTER PLAN FOR REPLIT

**Purpose:** Single planning document for Replit's agent to scope all remaining work toward a functioning F9 underwriting engine + Valuation Grid. Covers (1) the remaining task map, (2) comp selection methodology, (3) CoStar gap-fill architecture, (4) module → assumption mapping, (5) deal details mapping, and (6) gaps not yet named.

**How to use this document:** This is a planning contract, not an implementation spec. Each section ends with concrete dispatches. Per CLAUDE.md P8, state-verify against the actual database/codebase before executing any dispatch — several assumptions in this document need confirmation against live state. Per P9, reference existing modules rather than re-specifying their math, and align agent prompts in the same dispatch as canonical rule changes. Per P10, every data-dependent feature has three source layers (platform-derived, operator upload, graceful degradation).

---

## PART 1 — CURRENT STATE SNAPSHOT

### What's done

| Area | Status |
|---|---|
| F9 Batch 1 — OpEx Simple (10 assumptions) | Derivation logic shipped in `system.ts` §OpEx Derivation Protocol; verified, amended |
| F9 Batch 2 — Tax | Tax module already does the math; audited + 5 prompt gaps remediated (not re-derived) |
| Mandate v1.3 | Pre/post sub-field writes permitted under state-conditional rules |
| Tier 1 / Tier 2 validation | RegimeExpand source fix + 4 directional checks (V1–V4) live |
| Standing principles | P1–P10 in CLAUDE.md (P8 state verification, P9 batch integrity, P10 data sourcing hierarchy) |
| Valuation Grid v0.1 | Structurally built (service, routes, UI tab); blocked on column fix + empty data layer |

### Phase 2 entry conditions

| EC | Status | Note |
|---|---|---|
| EC1 — Strategy ↔ deal_type | SATISFIED | A1 canonical; bridge via Task #1233 |
| EC2 — Mandate lifted | SATISFIED | v1.3 live |
| EC3 — Market rent benchmarks | **UNCONFIRMED** | `mv_market_rent_benchmarks` claimed shipped but does NOT exist in DB — reconfirm |
| EC4 — F9 module map gaps | SATISFIED | 0 blockers; 10 deferred to Phase 2 |

### The 22 F9 assumptions — derivation logic status

| Batch | Assumptions | Maps to module | Status |
|---|---|---|---|
| Batch 1 — OpEx Simple | R&M, Turnover, Marketing, G&A, Contract Services, 4× utilities, Replacement Reserves (10) | M09 | DONE |
| Batch 2 — Tax | Property tax + reassessment + jurisdiction overlays | M09 Tax module | AUDITED + REMEDIATED |
| Batch 3 — Capital Structure | Debt amount, LTV/LTC, rate, term, amort, I/O period, DSCR (~7) | **M11 `capital-structure.service.ts` EXISTS** | NOT STARTED — likely audit, not from-scratch |
| Batch 4 — Growth | Rent growth, expense growth | M05 + M28 | NOT STARTED |
| Batch 5 — Exit | Exit cap, terminal value, hold period, disposition costs | M20 (needs service) | NOT STARTED |
| Batch 6 — Revenue | Market rent, vacancy, concessions, other income | M05 + M07 + EC3 | NOT STARTED — blocked by EC3 |
| Batch 7 — Purchase Price + reconciliation | Going-in price, cross-method reconciliation | Valuation Grid | NOT STARTED |

### Known infrastructure gaps (do not re-investigate; tracked)

- `mv_market_rent_benchmarks` — referenced but does not exist in DB
- `properties ↔ deals` join — empty across all 29 deals (no subject has units populated) — **foundational blocker for every Valuation Grid method except Operator Override**
- `sale_comp_sets` — empty (0 rows)
- `archive_assumption_benchmarks` — no `cap_rate` or `price_per_unit` rows
- Task #672 — T12 sub-line utility parsing not implemented
- Schema fragmentation — `asset_class` / `property_class` / `building_class` / `class` used inconsistently across comp tables

---

## PART 2 — COMP SELECTION METHODOLOGY

**The problem (operator-stated):** The platform lists endless rent and sale comps across trade area, submarket, and MSA. Operators want the *best* comps that tell the story of the opportunity — not an exhaustive dump.

**The principle:** Comp selection is a *narrowing and ranking* problem, not a *retrieval* problem. The platform already retrieves broadly (M15 `comp-query.service.ts` + `comp-set-discovery.service.ts`). What's missing is the selection + scoring + narrative layer on top.

### 2.1 The two lenses (already in platform — extend, don't rebuild)

The Dual Comp framework already distinguishes:

- **Competition Lens (Trade Area Comps):** properties competing for the SAME renter pool. Determines local market position — achievable rents, amenity requirements, who you're losing tenants to.
- **Like-Kind Lens (Cross-Market Comps):** benchmarks against comparable properties elsewhere. Determines whether the deal is priced right relative to its peer class nationally.

For *valuation* (sale comps), the equivalent split is:
- **Local sale comps:** recent trades in trade area / submarket → drives PPU, PSF, implied cap rate
- **Like-kind sale comps:** trades of similar asset class/vintage/size in comparable submarkets → fills the gap when local trade volume is thin

### 2.2 The comp quality tier system (already in platform — formalize)

The Historical Observations corpus already grades comps:

| Tier | Meaning | Confidence |
|---|---|---|
| S1/S2 | Subject property actuals | Highest |
| C1 | High-quality comp (REIT filing, full data) | High |
| C2 | Partial comp (broker email, single data point) | Medium |
| M1/M2 | Submarket aggregate (CoStar) | Context only |

**Selection rule:** prefer higher tiers. A comp set of 5 C1 comps beats 20 C2 comps. Surface tier mix in the comp set summary.

### 2.3 Comp selection scoring (NEW — this is the missing layer)

For a candidate comp pool, score each comp on relevance to the subject, then select the top N that "tell the story." Proposed relevance score:

```
comp_relevance =
    distance_decay      × W_dist      (closer to subject = higher)
  + recency_decay       × W_recency   (more recent sale/lease = higher)
  + asset_class_match   × W_class     (same class = 1.0; adjacent = 0.5)
  + size_similarity     × W_size      (unit count within ±30% = higher)
  + vintage_similarity  × W_vintage   (year built within ±10yr = higher)
  + data_quality_tier   × W_quality   (C1 > C2)
```

Weights are **strategy-aware** (see 2.4). Output: ranked comp list. Default surface = top 5–8 by relevance, with the rest available on "show all."

### 2.4 The "story" is strategy-dependent (the key insight)

What makes a comp tell the story of the opportunity depends on the deal's investment strategy. This threads `investmentStrategy` (A1 canonical) through comp selection:

| Strategy | Story the comps must tell | Selection emphasis |
|---|---|---|
| **Stabilized / Core** | "This asset is priced fairly vs recent trades of similar quality" | Recent local sale comps, same class, tight asset-class match. Cap rate convergence is the story. |
| **Value-Add** | "Comparable renovated assets achieve $X more rent; that delta is the upside" | Two comp sets: (a) current-condition comps proving the in-place ceiling, (b) renovated/repositioned comps proving the post-stabilization target. The *gap* between them is the story. |
| **Ground-Up Development** | "New product in this submarket leases at $X and trades at $Y cap" | Recently-delivered comps (vintage <3yr). Rent achievement on lease-up. Construction cost comps for replacement cost method. |
| **Redevelopment** | "Repositioned assets command a premium; here's the achievable post-reposition state" | Before/after pairs where available; post-renovation comps as the target state. |

This is why "endless comps" fails: a value-add deal needs the rent-ceiling-gap pattern surfaced, not a flat list. A stabilized deal needs cap-rate convergence, not renovation upside. **Comp selection must read strategy and select to tell that strategy's story.**

### 2.5 Pattern detection (already specced — wire to selection)

The platform already specs comp patterns (Rent Ceiling Gap, Amenity Arms Race, Vintage Cascade). These should *drive comp surfacing*: if a Rent Ceiling Gap is detected, surface the ceiling comp prominently. The pattern IS the story; the comps are evidence for it.

### 2.6 Geographic hierarchy logic (NEW — resolve the trade area / submarket / MSA question)

Don't show all three tiers flat. Use a cascade:

1. **Trade area first.** If ≥ 5 qualifying comps in the trade area, use those. The story is local.
2. **Expand to submarket** only if trade area comps < 5. Flag the expansion ("insufficient trade-area comps; widened to submarket").
3. **Expand to MSA / like-kind** only if submarket < 5. Flag again, lower confidence.
4. **Never silently mix tiers.** If the comp set spans trade area + submarket, label each comp's geographic source so the operator sees the blend.

### Part 2 dispatches

- **D-COMP-1:** Comp relevance scoring engine — add scoring layer on top of existing M15 retrieval. Inputs: subject characteristics + candidate pool. Output: ranked, tiered, geographically-labeled comp set.
- **D-COMP-2:** Strategy-aware comp story selection — read `investmentStrategy`, select comps to tell that strategy's story per the 2.4 matrix.
- **D-COMP-3:** Geographic cascade logic — trade area → submarket → MSA with explicit expansion flags and confidence decay.

---

## PART 3 — COSTAR GAP-FILL ARCHITECTURE (P10 IN PRACTICE)

**The principle (P10):** Every data-dependent feature has three source layers. When platform-derived data is sparse, operator upload (CoStar) fills the gap. This section maps how that works concretely.

### 3.1 The three layers for comp data

| Layer | Source | When it fires | Provenance tag |
|---|---|---|---|
| 1 — Platform | Research agent (municipal APIs, county records), M15 comp services, ApartmentIQ | Default; whenever platform coverage exists | `platform` |
| 2 — Operator upload | CoStar export → data library → ingestion | When platform comp count < threshold for the geography | `costar` / `operator` |
| 3 — Degradation | INSUFFICIENT badge + upload CTA | When neither layer has enough | n/a |

### 3.2 The ingestion path (NEW — needs building)

The operator-upload path is the gap. Required pieces:

1. **Upload UX** — operator uploads CoStar export (CSV/Excel) to the deal's data library, tagged by type (sale comps / rent comps / submarket performance).
2. **Parser per comp type** — maps CoStar columns to the canonical comp profile (Part 4 of the comp profile spec). CoStar exports have stable column structures; build a mapper per export type.
3. **Validation + dedup** — incoming CoStar comps validated against the comp profile schema; deduped against existing platform comps (by address/parcel/geocode) to avoid double-counting.
4. **Provenance tagging** — every ingested row tagged `source: costar`, `ingested_at`, `data_as_of` (CoStar's date, not ingest date — staleness matters).
5. **Merge into comp pool** — CoStar comps join the platform comp pool for the relevance scoring in Part 2. They compete on the same relevance score; CoStar's recency/quality determines whether they surface.

### 3.3 Reconciliation: platform comps vs CoStar comps

When both exist for the same geography:
- **Dedup by identity** (parcel ID > address match > geocode proximity). Same property from both sources → keep the higher-quality/more-recent record, note both sources saw it.
- **Don't prefer one source categorically.** A recent CoStar sale comp may beat a stale platform comp; a platform comp with full operating data may beat a thin CoStar row. Let the relevance score decide.
- **Surface the blend.** Comp set summary shows "8 comps: 5 platform, 3 CoStar."

### 3.4 Research agent should reduce CoStar dependency over time

Operator-flagged direction: the research agent should pull sale comps from municipal APIs (county recorded transactions — Hillsborough, Orange, Miami-Dade, Duval all expose sale price, date, parcel). As municipal coverage matures, CoStar becomes the gap-filler for markets where municipal feeds are thin, not the primary source. **CoStar is the bridge, not the destination.**

### Part 3 dispatches

- **D-COSTAR-1:** Comp upload UX + data library integration (file upload, type tagging).
- **D-COSTAR-2:** CoStar parser per type (sale comps, rent comps, submarket performance) → canonical comp profile mapping.
- **D-COSTAR-3:** Dedup + reconciliation engine (platform vs CoStar, identity matching, provenance).
- **D-COSTAR-4:** Research agent municipal API sale-comp integration (reduce CoStar dependency for FL primary markets).

---

## PART 4 — MODULE → ASSUMPTION MAPPING

**The goal:** Define, for each F9 assumption, which module(s) the agent consults and how it combines their outputs. This is the contract that makes agent reasoning auditable.

### 4.1 The bridge decomposition (already in M09 — this IS the mapping pattern)

M09 already decomposes every Pro Forma line item into a bridge:

```
Current → Stabilized = Δ_market + Δ_platform + Δ_operator + Δ_capex
                       (+ Δ_capacity for redevelopment)
```

Each Δ component sources from specific modules. This is the template for module → assumption mapping. Generalize it.

### 4.2 The mapping table (assumption → authoritative module → supporting modules)

| Assumption | Authoritative module | Supporting modules | Agent reasoning |
|---|---|---|---|
| Market rent | M05 Market Intel | M07 Traffic (demand), M15 Comps (rent comps), EC3 benchmark | Comp-anchored: rent comps set the band, M07 traffic confirms demand, M05 trends set growth |
| Vacancy | M05 + M07 | M06 Demand, M04 Supply | Trailing actuals primary; M07 absorption for lease-up; M04 supply pipeline as headwind |
| Rent growth | M05 + M28 Macro Cycle | Historical Observations corpus | Submarket trend + macro cycle position; empirical from corpus where available |
| OpEx (10 line items) | M09 Batch 1 protocol | Platform benchmarks (`line_item_benchmarks`) | DONE — trailing primary, platform validation, sigma check |
| Property tax | M09 Tax module | `fetch_tax_intel`, `fetch_jurisdiction_tax_forecast` | DONE — Two-Tool Protocol |
| Debt terms | **M11 Capital Structure** | M14 Risk (DSCR constraints) | Audit M11 first (P9.B) — likely integration spec, not from-scratch |
| Exit cap | M20 Exit Strategy (needs service) | M28 Macro, M05 comp cap rates | Going-in cap + macro-adjusted spread; comp-implied cap rates |
| Renovation premium | M08 Strategy Arbitrage | M22 capex schedule, M15 renovated comps | Value-add story: renovated comp rent − current comp rent |
| Absorption / lease-up | M07 + Lease Velocity Engine | M04 Supply, M06 Demand | Single source of truth for stabilized year |
| Cap rate (valuation) | **Comp-anchored synthesis** (committed) | M05, `archive_assumption_benchmarks` | Synthesize each comp's NOI from platform stats → implied cap rate per comp → aggregate |

### 4.3 Cross-module conflict resolution (NEW — needs a rule)

LayeredValue handles source layering *within* an assumption (broker > platform > user). But what happens when two *modules* disagree? E.g., M07 Traffic implies one absorption rate, M28 Macro implies another.

Proposed rule:
1. **Authoritative module wins by default** (per the 4.2 table).
2. **Supporting modules adjust within a band** — they can shift the authoritative value within a confidence range, not override it.
3. **Material disagreement surfaces, doesn't auto-resolve** — if supporting module diverges from authoritative by > threshold, flag it in the evidence trail for operator review (same pattern as M09 operator-vs-platform conflict surfacing).

### 4.4 The keystone cascade (already in platform — respect it)

`selectDevelopmentPath()` cascades M02 → M03 → M08 → M09 atomically. Module → assumption mapping must respect this: zoning constrains dev capacity constrains strategy constrains proforma. Don't let an assumption downstream contradict an upstream keystone gate.

### 4.5 Agent reasoning order (NEW — define the sequence)

The agent shouldn't consult modules randomly. Proposed order (dependency-driven):

1. **Deal details / subject characteristics** (Part 5) — must be complete first
2. **M02 Zoning → M03 Dev Capacity** (keystone, if development/redevelopment)
3. **M15 Comps** (comp set selection per Part 2)
4. **M05 Market Intel** (market context, growth)
5. **M07 Traffic + M04 Supply + M06 Demand** (demand/supply signals)
6. **M08 Strategy** (which play, given the above)
7. **M09 ProForma assembly** (the 22 assumptions, using all the above)
8. **M11 Capital Structure** (debt, given the proforma)
9. **M20 Exit** (disposition, given hold)
10. **M14 Risk + M25 JEDI Score** (assessment, given the full picture)
11. **Valuation Grid** (triangulation across methods)

### Part 4 dispatches

- **D-MOD-1:** Formalize the assumption → module mapping table as a config/contract the agent reads (not hardcoded reasoning).
- **D-MOD-2:** Cross-module conflict resolution rule + evidence-trail surfacing.
- **D-MOD-3:** Agent reasoning order as an explicit pipeline (respects keystone cascade).

---

## PART 5 — DEAL DETAILS MAPPING

**The problem:** The Valuation Grid data-flow surface showed all 29 deals have an empty `properties ↔ deals` join — no subject has units populated. Every method except Operator Override needs subject characteristics. **This is the foundational blocker.**

### 5.1 What the subject needs (minimum viable for valuation)

| Field | Used by | Source |
|---|---|---|
| units | PPU, Per-Unit Benchmark, Cap×NOI (per-unit math) | Deal intake, OM, county records |
| building_sf | PSF, Replacement Cost | Deal intake, OM, county records |
| year_built | Asset class derivation, vintage matching | County records, OM |
| building_class | Comp matching, benchmark lookup | Derived from year_built + condition, or operator-set |
| submarket_id | Comp geography, benchmark lookup | Geocode → submarket lookup |
| latitude/longitude | Comp proximity, trade area | Geocode from address |
| gross rent / NOI | Cap×NOI, GRM, GIM | Agent-derived (M09) or T12 |

### 5.2 The mapping problem

Deal details enter via multiple paths (chat intake, OM upload, manual entry, county pull) and must land in a consistent subject record. Right now they don't reach `properties`. Three things to resolve:

1. **Does a `properties` row get created on deal creation?** If not, every deal starts with an empty subject. Fix: create the row at intake, populate what's known, flag what's missing.
2. **What populates units/sqft/year_built?** Likely sources: county records (research agent), OM parse (document intelligence), operator manual entry. Map each field to its source priority (LayeredValue).
3. **The schema fragmentation** — `building_class` on `properties`, `asset_class` elsewhere. Pick a canonical name or build a derivation that maps consistently.

### 5.3 Subject data completeness gate

Before the Valuation Grid (or any module that needs subject characteristics) runs, check subject completeness. If units/sqft missing → surface "complete subject details to enable valuation" with the specific missing fields, not a generic error. This is P10 Layer 3 (graceful degradation) applied to the subject side.

### Part 5 dispatches

- **D-DEAL-1:** Diagnose why `properties ↔ deals` join is empty — is the row created at intake? Is `deal_id` populated? (Run for 464 Bishop first.)
- **D-DEAL-2:** Subject record population pipeline — map units/sqft/year_built/geocode to source priorities; populate at intake, backfill from county/OM where available.
- **D-DEAL-3:** Subject completeness gate — block valuation with specific missing-field guidance rather than generic failure.

---

## PART 6 — WHAT YOU'RE MISSING (gaps not named in the request)

You asked what else you're missing. Here's an honest list of things that aren't in the named scope but are load-bearing for the platform to actually work:

### 6.1 Comp set provenance and override
When the agent selects comps, the operator needs to see *why those comps* and be able to remove/add. Comp selection isn't just an algorithm output — it's an operator-tunable starting point. Without override, operators won't trust the auto-selection. **Add: comp set is operator-reviewable; selection criteria are exposed and tunable (radius, vintage band, class match, recency window).**

### 6.2 Staleness haircuts
A sale comp from 2021 in a 2026 valuation is stale. Stale comps need a recency haircut or exclusion, not equal weighting. CoStar `data_as_of` and platform `sale_date` both feed this. **Add: staleness decay in comp relevance scoring; configurable max-age threshold.**

### 6.3 Confidence propagation end-to-end
Sparse comps → wide implied cap rate band → lower Cap×NOI confidence → lower overall valuation confidence. This chain needs to propagate so the operator sees "valuation confidence: LOW (only 3 comps, wide spread)" not a false-precision point estimate. **Add: confidence propagation from comp count/quality through to the reconciled Purchase Price range.**

### 6.4 The feedback loop (platform learning)
When an operator overrides comp selection or an assumption, that's signal. The `learning_adjustments` table and M34 UI Intelligence exist for this. Without a feedback loop, the platform never improves from operator behavior. **Add (later phase): capture operator overrides as training signal; surface "operators in this submarket typically adjust X."**

### 6.5 Validation harness for comp selection
How do you know the comp selection is good? Backtest: take a known closed transaction, run comp selection as-of the sale date, see if the implied valuation matches the actual sale price. **Add: comp selection backtest against the S1 subject properties (Jacksonville, Atlanta ×2) where you have ground truth.**

### 6.6 EC3 reconciliation (immediate)
`mv_market_rent_benchmarks` doesn't exist but is referenced. Either it never shipped or shipped to a different DB. This blocks market-rent-dependent methods (GRM, GIM, comp NOI synthesis for the revenue side). **Resolve before Batch 6 and before comp-anchored cap rate synthesis can use the revenue half.**

### 6.7 Validation Grid vs Valuation Grid relationship
Two different surfaces, easily confused:
- **Validation Grid** = per-assumption source triangulation (is each assumption defensible?)
- **Valuation Grid** = per-method price triangulation (do the valuation methods agree?)
Both link to the same evidence base. **Add: explicit cross-link so an operator drilling into a Valuation Grid divergence can trace to the underlying assumption's Validation Grid entry.**

### 6.8 Deal-type variant routing through everything
Comp selection, module usage, assumptions, and valuation methods all vary by acquisition / value-add / ground-up / redevelopment. `resolveProjectType()` routes Deal Capsule variants; the same routing must thread through comp selection (Part 2.4) and module mapping (Part 4). **Ensure: project_type is read consistently at every selection/derivation decision point.**

### 6.9 Other income and unit mix
The 22-assumption inventory includes other income and unit-mix-driven revenue. These weren't in any batch explicitly. Confirm they're covered in Batch 6 (Revenue) or surface them as a gap.

### 6.10 The Sources & Uses / equity side
Valuation produces a Purchase Price. But the deal needs Sources & Uses (debt + equity sizing), which depends on the price + Capital Structure (M11). The Valuation Grid feeds S&U; confirm that handoff exists.

---

## PART 7 — RECOMMENDED SEQUENCING

This is the suggested order. Adjust per priority, but the dependencies are real.

### Wave A — Foundation (unblocks everything)
1. **D-DEAL-1** — diagnose properties↔deals join (start with 464 Bishop)
2. **EC3 reconciliation** — confirm/create `mv_market_rent_benchmarks`
3. **Valuation Grid column fix** — `p.asset_class` → `p.building_class`, `p.submarket` → `p.submarket_id`

### Wave B — Subject + comp data (makes valuation possible)
4. **D-DEAL-2** — subject record population pipeline
5. **D-COSTAR-1 + D-COSTAR-2** — comp upload + parser (lets operators fill gaps now)
6. **D-COMP-1** — comp relevance scoring engine

### Wave C — Comp intelligence (makes valuation good)
7. **D-COMP-2** — strategy-aware comp story selection
8. **D-COMP-3** — geographic cascade
9. **D-COSTAR-3** — dedup + reconciliation

### Wave D — Module reasoning (makes assumptions defensible)
10. **D-MOD-1 + D-MOD-2 + D-MOD-3** — assumption mapping, conflict resolution, reasoning order
11. **F9 Batch 3** — Capital Structure (audit M11 first per P9.B)

### Wave E — Complete the engine
12. **F9 Batches 4, 5, 7** — Growth, Exit, Purchase Price
13. **F9 Batch 6** — Revenue (after EC3 confirmed)
14. **Valuation Grid comp-anchored cap rate synthesis** (Path B — the committed architecture)

### Wave F — Polish + learning
15. **D-COSTAR-4** — research agent municipal sale comps
16. Confidence propagation (6.3), staleness haircuts (6.2), comp override (6.1)
17. Validation harness (6.5), feedback loop (6.4)

### Parallel / ongoing
- 464 Bishop end-to-end test (validates each wave against a real deal as it lands)

---

## APPENDIX — MODULE REFERENCE (grounded in current codebase)

| Code | Module | Service | Status |
|---|---|---|---|
| M01 | Deal Overview | `jedi-score.service.ts` | Live |
| M02 | Property & Zoning | `zoning.service.ts` + 12 zoning services | Live |
| M03 | Dev Capacity | `development-capacity.service.ts` | Live |
| M04 | Supply Pipeline | `supply-signal.service.ts` | Live |
| M05 | Market Intelligence | `marketResearchEngine.ts` + `apartmentMarketService.ts` | Live |
| M06 | Demand Intelligence | `demand-signal.service.ts` | Live |
| M07 | Traffic Engine | `trafficPredictionEngine.ts` + 6 traffic services | Live |
| M08 | Strategy Arbitrage | `strategy-arbitrage-engine.ts` | Live |
| M09 | ProForma | `proforma-generator.service.ts` + `proforma-adjustment.service.ts` | Live |
| M11 | Capital Structure | `capital-structure.service.ts` | **EXISTS — audit for Batch 3** |
| M14 | Risk | `risk-scoring.service.ts` | Live |
| M15 | Comps | `comp-query.service.ts` + `comp-set-discovery.service.ts` | **EXISTS — extend for Part 2** |
| M18 | Documents | `documentsFiles.service.ts` | Live |
| M20 | Exit Strategy | Needs service | NOT BUILT |
| M22 | Post-Close | Needs `deal_monthly_actuals` | Partial |
| M25 | JEDI Score | `jedi-score.service.ts` + `formula-engine.ts` | Live |
| M28 | Macro Cycle | Not started | NOT BUILT |

**Standing principles in play:** P8 (state-verify before executing), P9.A (align agent prompts in same dispatch), P9.B (reference existing module math, don't re-specify), P10 (three-layer data sourcing).

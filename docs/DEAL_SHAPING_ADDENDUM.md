# DEAL SHAPING ADDENDUM — SITUATION FLAGS → STRUCTURE, PRICE & HOLD PERIOD
**Date:** 2026-07-03
**Extends:** `RE_STRATEGIES_AND_SPECIAL_SITUATIONS_RESEARCH.md` §3.2, `F9_UNDERWRITER_MODEL_SPEC.md`, `M36_JOINT_DISTRIBUTION_ENGINE_SPEC.md` §5 (goal-seek flow), `M09_PROFORMA_SPEC.md`
**Governing invariant:** Agent diagnoses and shapes; engine solves. LLM never performs arithmetic. Price, DSCR, and hold-period math are engine outputs; situation interpretation and structure selection are agent judgment.

---

## 1. FLAG ADDITIONS TO §3.2 — CASHFLOW DISTRESS GROUP

The original enum treated debt distress as event-driven (maturity, breach, servicing transfer). It missed the *state* condition: **the asset is cash-flow negative at its current capital structure**. Add:

```
cashflow_distress:
  negative_dscr            # NOI < annual debt service (DSCR < 1.0) — asset bleeding monthly
  thin_dscr                # 1.0 ≤ DSCR < lender_min (typically 1.20–1.25) — no refi path at current NOI
  io_expiry_shock          # interest-only period ending; payment steps up 20–40%, flipping DSCR
  underwater_equity        # est_value < debt_balance — seller cannot transact without lender consent
  cash_in_refi             # refi possible only with fresh equity injection (proceeds gap > 0)
  negative_leverage        # cap_rate < debt_rate — levered return < unlevered; owner motivated but solvent
```

**Detection is fully deterministic** — this group requires zero new data sources:
```
est_NOI          ← T12 / extraction / platform rent model (existing)
est_debt_service ← loan_amount × vintage_rate_curve(origination_date, lender_type) × amort_profile
                   (ATTOM mortgage records + FRED historical rate curves — existing)
DSCR_current     = est_NOI / est_debt_service
DSCR_at_refi     = est_NOI / debt_service(current_market_rate, market_LTV × est_value)
proceeds_gap     = debt_balance − (market_LTV × est_value)
```
These are Research Agent `DealContext` fields computed by a deterministic service (same class as Task 6.12 assumption-collision service). The agent never computes DSCR; it *reads* the flags and reasons about them.

**Why this group matters more than the event flags:** `negative_dscr` is the *cause*; `maturity_wall`, `special_servicing`, `pre_foreclosure` are the *symptoms arriving on a schedule*. An asset with DSCR 0.85 and 14 months to maturity is a special situation *today* even though no event has fired. The flag set should let the agent see distress before it's public.

---

## 2. THE DEAL SHAPING PIPELINE (AGENT REASONING CHAIN)

Four stages. Stages 1–2 are agent judgment. Stages 3–4 are engine solves with agent-selected constraints. Output is a `DealShapeProposal` (§5).

### Stage 1 — DIAGNOSIS: locate the broken layer

Every distressed or special-situation deal has exactly one *primary* broken layer (others may be secondary). The agent's first job is triage:

| Broken layer | Test | Meaning |
|---|---|---|
| **ASSET** (NOI problem) | NOI below peer set at market occupancy — expense ratio, loss-to-lease, economic vacancy vs. submarket | Value is recoverable through operations → value-add / reposition pricing |
| **MARKET** (beta problem) | NOI in line with peers; whole submarket impaired (supply wave, demand shock) | Nothing to fix — discount is compensation for beta; underwrite the market recovery, not the operator |
| **CAPITAL STACK** (debt problem) | NOI fine (DSCR would clear at market debt on market value) but current stack broken — vintage LTV too high, rate shock, proceeds gap | Asset doesn't need fixing; the *stack* needs restructuring → capital-position entry or clean purchase at reset basis |
| **SELLER** (circumstance problem) | Asset and stack fine; owner-specific pressure (probate, 1031 clock, fund term, exhaustion) | Terms arbitrage — speed and certainty are the currency, not repositioning capacity |

**Diagnosis discipline:**
- The ASSET vs. MARKET distinction is the hardest call and the highest-value one. Calibration source: peer set from `apartment_market_snapshots` + owned-asset actuals (Highlands/Frisco/McKinney give real expense-ratio and occupancy baselines at 94–95% stabilized). If the subject's economic occupancy trails the peer set by >300bps at similar physical occupancy, it's operator failure (buyable alpha). If the peer set is also impaired, it's beta.
- Diagnosis must cite evidence: flag values + the specific `DealContext` fields that discriminate. "NOI problem because expense ratio 52% vs. peer median 43% (source: snapshot ids …)" — same evidence standard as everything else.
- Multi-layer deals exist (broken asset AND broken stack — the classic 2021-bridge-loan value-add that never executed). Agent tags primary + secondary; structure selection must address both.

### Stage 2 — STRUCTURE SELECTION: flags → feasible entry structures

The agent maps (diagnosis × flags × seller/lender posture) to a ranked set of feasible structures. This is a lookup discipline, not free-form creativity — the feasibility matrix below is the ruleset; agent judgment is in ranking and in reading counterparty posture.

| Situation signature | Feasible structures (ranked) | Price anchor (Stage 3 input) |
|---|---|---|
| `negative_dscr` + maturity <12mo + sponsor illiquid | (1) Note purchase / DPO from lender, (2) pre-foreclosure direct w/ lender payoff negotiation, (3) pref-equity w/ control rights (loan-to-own posture) | **Lender recovery math** — what clears the lender's expected foreclosure recovery net of time/cost, NOT seller basis |
| `cash_in_refi` + sponsor wants to hold | (1) Pref equity / rescue capital filling proceeds gap, (2) GP recap, (3) JV equity w/ promote reset | **Gap size + accrual math** — priced as structured credit, forced-sale rights are the real consideration |
| `underwater_equity` + cooperative lender | (1) Short sale, (2) DIL-concurrent note purchase, (3) assumption + discounted payoff | Lender recovery math |
| `io_expiry_shock` + DSCR flips negative at step-up | (1) Purchase before step-up (seller motivated by calendar), (2) note purchase if lender fatigued | Stabilized-value-minus-cost with calendar discount |
| `assumable_low_coupon` + DSCR >1.20 at assumption *(positive)* | (1) Assumption + seller carry on gap, (2) assumption + supplemental (HUD/agency), (3) assumption + pref | **Market value + NPV of below-market debt** — buyer can pay premium up to debt NPV; engine computes it (§3.3) |
| `tired_landlord` + no/low debt | (1) Seller financing (price-for-terms trade), (2) lease option, (3) conventional at speed discount | Seller's number on buyer's terms — engine solves max price *at seller-carry terms*, usually above cash-offer max |
| `probate` / `divorce` / `exchange_pressure` | (1) Cash/fast conventional, (2) as-is close, hard deposit | Speed discount to market — comp value × certainty discount |
| `structural_milestone` (FL condo) + assessment shock | (1) Individual-unit accumulation, (2) bulk purchase toward 80% termination threshold, (3) association-level buyout | Unit value − assessment payoff − carry-to-threshold − termination execution risk |
| `failed_lease_up` + market intact (Traffic Engine ramp says demand exists) | (1) Purchase from construction lender/sponsor at reset basis, (2) note purchase on construction loan | Cost-to-complete + lease-up carry vs. stabilized value; **Traffic Engine ramp is the underwriting spine** |
| ASSET-broken (mismanagement) + conventional seller | (1) Straight purchase priced off stabilized-minus-cost, (2) seller carry if basis-anchored seller | Stabilized value − cost-to-stabilize − required margin |
| MARKET-broken | (1) Straight purchase at beta discount, longer hold | Recovery-scenario DCF; hold period solved to recovery (§4) |

**Structure feasibility gates (hard rules, engine-checkable):**
- Note purchase requires lender willingness signal (special servicing transfer, marketed note, matured-unpaid status) — agent cannot propose it as primary without one.
- Assumption requires assumable loan type (agency/HUD/most CMBS yes; bank recourse usually no) — deterministic from lender type.
- Pref equity requires senior lender intercreditor consent — flag as execution risk, not blocker.
- FL condo bulk plays: FS 718.117 thresholds (80% approval / 5% blocking) are jurisdiction-ruleset facts, not agent recall.

### Stage 3 — PRICE: solved, never assumed

**Core discipline: purchase price is a goal-seek output.** The M36 §5 flow already solves assumptions/stack for target IRR at a given price. Deal shaping inverts it — extend the goal-seek contract:

```
POST /api/sigma/goal-seek
  body: {
    deal_id, 
    solve_for: "purchase_price",            # NEW — alongside existing "assumptions" mode
    structure: { …bundle or structure id }, # per Stage 2 candidate
    targets: { 
      levered_irr_min:  hurdle(strategy_risk_profile),   # from Part 1 spectrum: VA 13–15%, opportunistic 18%+
      dscr_min:         lender_floor(structure),
      coc_min:          tier_default | user_override,
      breakeven_occupancy_max: 0.85
    },
    situation_costs: [ … ],                 # deterministic line items from flags (§3.2)
    hold_period: "solve" | fixed_months,    # §4
    scenario_set: climate_conditioned       # §4.2
  }
  → { max_price, binding_constraint, price_by_anchor, sensitivity }
```

**Four price anchors — engine computes all four; the binding (lowest applicable) one governs; agent explains which and why:**

1. **Income anchor:** `stabilized_NOI / exit_cap − cost_to_stabilize − required_profit_margin` — the M09 bridge run backwards. Default anchor for ASSET-broken deals.
2. **Lender-recovery anchor:** `expected_foreclosure_recovery − lender_time_cost − buyer_certainty_premium` — governs note/DPO/short-sale structures. Seller basis is irrelevant here and the agent should say so.
3. **Replacement-cost anchor:** sanity ceiling — paying above replacement in a supply-elastic submarket (COR-08 permit velocity high) is flagged even if IRR pencils.
4. **Comp anchor:** transaction comps ± situation discount (speed/as-is/title) — reality check that the solve isn't hallucinating a price no seller accepts.

**Situation costs are deterministic engine line items** (never agent arithmetic): FL tax reassessment step-up (millage × price, jurisdiction ruleset), assessment payoffs, lien payoffs, code-upgrade triggers (FL 50% rule), cost-to-complete on broken construction, assumption fees, defeasance/yield-maintenance on exit. Agent's role: *detect that the cost applies*; ruleset + engine price it.

**NPV of assumable debt** (positive-situation pricing): engine computes `PV(market_rate_payments − assumed_rate_payments, remaining_term)` — that PV is the maximum justified premium over the no-assumption max price. This single computation is why `assumable_low_coupon` deals clear above ask in 2026 and the agent should present it explicitly.

### Stage 4 — HOLD PERIOD: solved from three clocks + climate

Hold period is the *joint solution* of three clocks, not a user default:

**Clock 1 — Value-creation clock (deterministic):** renovation pace × unit count, lease-up ramp (Lease Velocity Engine / Traffic Engine — existing precedence `user > agent > traffic_engine > platform_default(24mo)`), entitlement timeline for development plays. You cannot exit before the thesis completes without forfeiting the Δ.

**Clock 2 — Debt clock (deterministic):** 
- Bridge term + extensions defines the *maximum* hold at that structure (or a forced-refi node in the cash flow).
- Assumed low-coupon debt defines a *minimum* economic hold: exiting a 3.5% assumption with 6 years remaining forfeits the debt NPV unless the next buyer can assume — engine models both exit branches.
- Prepay structure (defeasance / yield maintenance / step-down) creates exit-cost cliffs — engine renders IRR-by-exit-month as a curve, and the prepay cliffs show up as sawtooth discontinuities the agent narrates.

**Clock 3 — Market clock (climate-conditioned, agent-weighted):**
- Supply pipeline delivery windows (COR-08, M04): exit before the wave lands or hold through it — never exit *into* it. rate_strategy_formula.md sell/abort signals apply here directly (pipeline >20% of stock in 24mo = urgent-sell class signal).
- Cap-rate trajectory: rate path scenarios (FRED-fed; M28 remains a gap — until it ships, use scenario bands, never the hardcoded 10% fallback for exit math).
- **Distress-supply competition (2026–27 specific):** the maturity wall puts forced sellers into the exit window through 2027. A deal bought into distress in 2026 exiting in 2027–28 competes with the tail of the wall; exiting 2029+ sells into post-clearing scarcity. This is a scenario weight in the exit-year distribution, not a hardcoded rule — climate inputs must be live, not baked.

**Engine contract:** evaluate IRR/EM across exit months 12–180 under the climate-conditioned scenario set (M36 Σ machinery); return the exit-window distribution (median-optimal month, IQR, and the sawtooth from Clock 2). **Agent contract:** pick the recommended window, narrate which clock binds, and state the kill condition that would shorten it ("abort-sale signals per rate_strategy_formula: transaction velocity −30% QoQ, DOM +40%").

---

## 3. CLIMATE CONDITIONING — WHAT "INVESTMENT CLIMATE" MEANS OPERATIONALLY

The agent does not have opinions about the climate; it reads climate *state* from platform signals and applies it at three defined seams:

| Climate input | Source | Seam where it applies |
|---|---|---|
| Rate level + path scenarios | FRED (DGS10, SOFR) — live | Debt pricing in structure candidates; exit-cap scenario bands; assumable-debt NPV |
| Cap-rate direction | Transaction-derived per submarket (CE signals) | Exit anchor scenarios (never point estimates) |
| Supply wave timing | COR-08, M04 pipeline | Hold-period Clock 3; replacement-cost anchor relevance |
| Demand momentum | COR-01/02, Traffic Engine | Lease-up ramp confidence; ASSET vs MARKET diagnosis |
| Distress-supply forecast | Maturity-vintage census of submarket (ATTOM loan origination cohorts, 2019–22 vintage >70% LTV) | Entry competition (more distress = lower entry anchors) AND exit competition (Clock 3) |
| Lender appetite | Debt-products API pricing (M36 §5 Step 3) | Structure feasibility + DSCR floors |
| Regulatory climate | M35 events (STR ordinances, Live Local, insurance) | Strategy availability gates per the existing matrix |

**Rule:** climate never changes the *math*; it changes the *scenario weights and constraint values* fed to the math. A hawkish rate scenario is a different `targets`/`scenario_set` payload, not a different formula.

---

## 4. OUTPUT CONTRACT — `DealShapeProposal`

The agent's terminal artifact per deal. Versioned like everything else: assumption set + snapshot hash, derivable on demand (version inputs, not outputs).

```typescript
interface DealShapeProposal {
  deal_id: string;
  diagnosis: {
    primary_broken_layer: 'ASSET' | 'MARKET' | 'CAPITAL_STACK' | 'SELLER';
    secondary?: BrokenLayer;
    evidence: EvidenceCitation[];          // flag values + DealContext field refs
  };
  situation_flags: SituationFlag[];        // §3.2 taxonomy incl. cashflow_distress group
  structures: RankedStructure[];           // per Stage 2, each with:
  //   structure_type, capital_stack, feasibility_gates_passed,
  //   solved_max_price, binding_constraint, price_by_anchor{income,lender,replacement,comp},
  //   situation_cost_line_items[],        // deterministic, engine-priced
  //   hold: { recommended_exit_window, binding_clock, irr_by_exit_month_ref, kill_conditions[] },
  //   returns: { irr_dist, em, coc_y1, dscr_min, breakeven_occ },
  //   execution_risks[], counterparty_requirements[]
  document_requests: DocumentRequest[];    // §6 — what the agent needs to firm up the solve
  climate_snapshot_hash: string;           // which climate state this was solved under
  assumption_set_hash: string;
  recommendation: { structure_id, one_paragraph_thesis, what_would_change_this[] };
}
```

**Surfacing:** chat (Surface 1) renders `recommendation` + top structure; web (Surface 2) renders the full ranked comparison — this is the natural v2 of the 4-strategy comparison matrix, one level deeper: not just *which strategy* but *which structure, at what price, held how long, and why this deal is available at all*.

---

## 6. DOCUMENT REQUIREMENTS LAYER — THE AGENT FLAGS WHAT IT'S MISSING

### 6.1 Generation mechanism (deterministic core, agent narration)

Every `DealContext` field carries a **source tier**:

```
platform_estimate < broker_claim < document_verified < owned_actuals
```

This is the existing LayeredValue source-badge system plus the `broker_claims` / `column_basis` discipline — an OM figure is a *claim* until a document verifies it. Document-request generation is then mechanical:

> **For each candidate structure, take the fields consumed by its binding constraint and price anchor. Every such field below `document_verified` generates a request.**

The *list* is deterministic (which fields feed which solve — no judgment, no hallucinated wishlists). The *agent's* contribution is prioritization, counterparty routing, and the "what happens without it" narration. This keeps the layer honest: the agent can never claim it needs a document that doesn't map to a solve input, and can never silently proceed on an unverified field that feeds a binding constraint without disclosing it. Extension of no-silent-stale-fallback: **no silent unverified inputs on binding constraints.**

### 6.2 Request tiers

| Tier | Definition | Effect on output |
|---|---|---|
| **T0 — Screen** | Platform data + OM sufficient | DealShapeProposal renders with wide bands, all prices labeled *indicative* |
| **T1 — Blocking** | Binding-constraint inputs unverified | Proposal renders but flags: "max price band ±X% until [doc] verifies [field]"; certain structures marked *not proposable* (a note purchase cannot be priced without the payoff statement — lender-recovery anchor has no verified inputs) |
| **T2 — Confirming/closing** | Standard diligence set (title commitment, estoppels, survey) | Doesn't move the solve; moves execution risk |

### 6.3 The request object

```typescript
interface DocumentRequest {
  doc: string;                     // "Payoff statement incl. per-diem and default interest"
  tier: 'T0' | 'T1' | 'T2';
  verifies: FieldRef[];            // DealContext fields it upgrades to document_verified
  unblocks: string;                // which anchor/constraint/structure it firms up
  without_it: string;              // deterministic consequence: band width, structure gate, confidence penalty
  typical_source: 'seller' | 'lender' | 'servicer' | 'association' | 'county' | 'court' | 'title_company' | 'borrower_counsel';
  structure_scope: StructureId[] | 'all';   // requests are structure-aware — picking structure A changes the T1 list
}
```

### 6.4 Document sets by category

**Universal set (every deal, any structure):** T12/T24 operating statements, current rent roll with lease dates, YTD financials, existing loan documents (note + all modifications), property tax bills, insurance policies + 5-yr loss runs, CapEx history, service contracts. These verify the M09 Current column — the left side of the bridge.

**Situation-conditioned sets (keyed to §3.2 flags):**

| Flag group | T1 documents | What they verify |
|---|---|---|
| `cashflow_distress` / debt distress | Note + all modifications and forbearances; **payoff statement** (per-diem, default interest, exit fees); rate cap confirmation + expiry; reserve/escrow balances; lender correspondence | Actual debt service (replaces the ATTOM×FRED *estimate* from §1), true payoff number, real maturity/extension terms — the entire lender-recovery anchor |
| `note_sale_available` / DPO | **Full loan file:** note, mortgage, complete assignment chain + allonges, lender's title policy, guaranty, payment history, servicing file, prior workout correspondence | Enforceability (a broken assignment chain kills the loan-to-own path), guaranty recourse, basis for DPO negotiation |
| `assumable_low_coupon` | Loan agreement assumption provisions; servicer assumption requirements + fee schedule; lender estoppel | Whether the NPV-of-debt premium is real; assumption cost as a situation line item |
| `special_servicing` | Servicer transfer notice; appraisal reduction / ASER notices; most recent servicer-ordered appraisal | Lender's own value marks — the strongest lender-recovery-anchor input available |
| `probate` | Death certificate; letters testamentary/administration; will; heir list; court authority to sell (if required) | Whether the counterparty can actually convey title, and on whose signature |
| `divorce` / `partnership_dispute` | Settlement agreement or court order authorizing sale; operating agreement (transfer restrictions, ROFR, buy-sell) | Signature authority; whether a ROFR torpedoes the deal post-LOI |
| `fl_condo_crisis` | **Milestone Phase 1/2 reports; SIRS + reserve schedule; special-assessment resolutions with per-unit amounts + payment status; 12–24mo board minutes; declaration (termination provisions, rental caps); estoppel letter; master insurance policy; Fannie eligibility status; engineer repair scope + contractor bids** | The entire assessment-payoff situation cost; termination-threshold feasibility (FS 718.117 mechanics live in the declaration, not just the statute); insurability |
| `environmental` | Phase I (current, <180 days for lender use); Phase II if recommended; NFA letters; tank closure reports; remediation cost estimates | Whether the environmental cost line is bounded or open-ended — open-ended = structure gate, not a price adjustment |
| `casualty` | Insurance claim file + adjuster reports; contractor rebuild estimates; municipality's 50%-rule determination | FL code-upgrade trigger math (deterministic once the determination exists); insurance-proceeds gap |
| `construction_default` / `failed_lease_up` | Approved plans + permit status; GC contract + change orders; lien waiver history; draw schedule vs. completion; cost-to-complete estimate; leasing traffic reports + concession log | Cost-to-complete anchor; whether the lease-up failure is product or market (feeds Stage 1 diagnosis directly) |
| `rollover_cliff` / retail | Full leases (co-tenancy, kick-out, exclusives); anchor sales reports; tenant estoppels; SNDAs | Whether the dark-anchor cascade is contractual or hypothetical |
| `regulated_rent_burnoff` | LURA / regulatory agreement with expiry; HAP contracts; LIHTC compliance file | The burn-off date that *is* the deal |
| `legal_title` cluster | Lien payoff letters per lien; code-enforcement case files + reduction-negotiation status; receivership orders; 363 sale orders + bid procedures | Gross-to-net price bridge; court timeline as a hold-period input |

### 6.5 Behavioral rules

1. **Requests ship with the proposal, not after it.** The DealShapeProposal always renders — on whatever tier of data exists — with the T1 list attached and bands honest about what's unverified. Never "upload documents first"; never false precision either.
2. **Each verified upload triggers a re-solve.** Document lands in the deal capsule (Lane B — user-licensed, deal-scoped, never written to shared corpus), extraction runs with `column_basis` tagging, affected fields upgrade tier, engine re-solves, bands tighten. The visible narrowing of the price band per document *is* the UX — it shows the user exactly what each document was worth.
3. **Broker OM never satisfies a T1 request.** OM figures populate `broker_claims`; a request for "T12" is a request for the *operator's* statement, and the collision between the two is surfaced (existing assumption-collision service, Task 6.12).
4. **Chat surfacing (Surface 1):** after the proposal, the agent emits a prioritized checklist — top 3–5 T1 items with one-line "why" each — phrased as what to ask the seller/broker/lender for. This is language a user forwards verbatim to a counterparty, which makes it a retention feature, not just a data-quality feature.

---

## 7. GAPS THIS EXPOSES (build-order candidates)

1. **`solve_for: purchase_price` mode** in the goal-seek endpoint — M36 §5 currently solves assumptions/stack at given price; the inversion is the missing half. Smallest high-leverage build.
2. **Vintage debt-service estimator** (deterministic service): ATTOM mortgage records × FRED historical curves → estimated DSCR/proceeds-gap per parcel. Powers the entire `cashflow_distress` flag group with existing data.
3. **Exit-month IRR curve** rendering (engine already computes per-month cash flows; needs the sweep + sawtooth surfacing).
4. **Structure feasibility ruleset files** (assumability by lender type, FS 718.117 thresholds, foreclosure process by state) — jurisdiction-ruleset architecture, zero hardcoded state logic.
5. **Distress-supply census** per submarket (loan-vintage cohort screen) — the RealCap-style 2019–22 >70% LTV screen as a standing CE-adjacent signal.
6. **Document-request generator** (deterministic): field→constraint dependency map + source-tier check → request list. Requires the solve-input dependency graph to be explicit, which M36's goal-seek contract already implies but doesn't expose.
7. **M28** remains the blocking gap for principled exit-cap scenarios — until it exists, the agent must present exit math as scenario bands and explicitly disclaim the point estimate.

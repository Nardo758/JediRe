================================================================
JEDI RE — F9 PRO FORMA ARCHITECTURE NOTES
================================================================
Compiled: April 2026 (revision 2)
Subject:  M09 wiring · event impact · F5 reshape · rent + opex
          forecast models · Gordon Growth · confidence bands ·
          position adjustment · revenue formula selection ·
          graceful degradation · save-driven versioning
================================================================

  Section 1.   F-key map
  Section 2.   M09 Pro Forma wiring corrections
  Section 3.   Event impact pathway
  Section 4.   F5 Strategy -> F9 structural mutation
  Section 5.   Rent terminology taxonomy
  Section 6.   Rent growth forecast — layered model
  Section 7.   OPEX growth forecast — layered model
  Section 8.   Gordon Growth coupling — cap rate validator
  Section 9.   Confidence intervals & refusal threshold
  Section 10.  Submarket position adjustment
  Section 11.  User-selectable revenue formula
  Section 12.  Graceful degradation & provenance schema
  Section 13.  Save-driven versioning
  Section 14.  Calibration TBDs
  Section 15.  Build sequencing
  Section 16.  Implementation notes


----------------------------------------------------------------
1. F-KEY MAP (current build)
----------------------------------------------------------------

  F1   Overview     M01
  F2   Zoning       M02
  F3   Market       M05  ★ required for M09
  F4   Supply       M04
  F5   Strategy     M08  ★ required + reshape driver
  F6   Traffic      M07  ◊ Construction-required
  F7   (unused / reserved)
  F8   Debt/Cap     M11  ⇄ two-pass with F9
  F9   Pro Forma    M09  (HUB)
  F10  Risk         M14  ⇄ two-pass with F9
  F11  Tools        utilities (chat, docs, settings)

  Backend feeders without F-key tabs:
    M03  Dev Capacity
    M06  Demand        (lives under F3)
    M15  Comp Set
    M18  Documents
    M19  News          (header banner)
    M26  Tax
    M27  Sale Comps
    M35  Events        (header banner)


----------------------------------------------------------------
2. M09 PRO FORMA WIRING — REGISTRY CORRECTIONS
----------------------------------------------------------------

ASYMMETRY TO FIX
The Module Registry sheet currently lists M09.receivesFrom as
"M02,M03,M04,M05,M06,M08" — but the following modules' feedsInto
arrays declare they push into M09:

  M07  Traffic
  M11  Debt/Cap
  M14  Risk
  M15  Comp Set
  M18  Documents
  M26  Tax
  M27  Sale Comps

ACTION: make M09.receivesFrom symmetric. Add the seven listed
modules.

BIDIRECTIONAL CYCLES TO FORMALIZE

  M11 ⇄ M09 (two-pass)
    1. M09 emits stub NOI with placeholder debt service
    2. M11 sizes debt against stub NOI (LTV / DSCR / debt yield)
    3. M11 returns loan terms (rate, term, IO period, amort)
    4. M09 recomputes cash flow with actual debt service
    5. Final NOI / IRR / EM produced
  Implemented in capital-structure-adapter.ts (476 lines).
  Formalize as event resolution order in module-registry.ts.

  M14 ⇄ M09 (two-pass)
    1. M14 contributes risk score on first pass
    2. M09 emits key_financials
    3. M14 recalculates execution risk on those financials

DEAL-TYPE CONDITIONAL INPUT
  M07 Traffic is REQUIRED for Construction (LEASE_UP) deals.
  Without absorption curve, M09 cannot produce credible Y1-Y3
  cash flow. For Stabilized assets, M07 supplies churn
  replacement (useful but not blocking).
  ACTION: add `requiredByDealType: ['Construction']` field to
  module-registry entry for M07.

PROPOSED BUT NOT WIRED
  M35 Event Impact Engine -> M09 via Correlation Engine pairings.
  See Section 3.

M18 -> M09 FIELD MAPPING (broker layer of LayeredValue<T>):
  broker_rent_psf
  broker_vacancy_pct
  broker_opex_psf
  broker_rent_growth_pct
  broker_exit_cap
  broker_capex_schedule
  broker_concession_assumption


----------------------------------------------------------------
3. EVENT IMPACT PATHWAY — NEWS/EVENTS -> ASSUMPTIONS
----------------------------------------------------------------

DATA FLOW

  M19 News + M35 Events
       |
       | (events stream)
       v
  Correlation Engine  (COR-01 ... COR-21+)
       |
       | (quantified % deltas, routed by target)
       |
       +---> F6 Traffic (M07) — adjusts lease velocity
       +---> F3 Market  (M05) — adjusts rent growth %
       +---> F10 Risk   (M14) — adjusts risk premium
       |                            |
       v                            v
  F9 Pro Forma — assumption layer
    GPR              <- absorption · occupancy
    Rent growth %    <- market signal
    Exit cap         <- risk premium spread

KEY INSIGHT
Events do NOT push values into M09 directly. They push into
upstream modules, which already feed M09 through the LayeredValue
contract. The platform layer on each assumption gets stamped
with provenance (see Section 12 for full schema).

PERSISTENCE
Store correlation outputs in `correlation_adjustments` JSONB
column on the deal — not in-memory only. Required for:
  - Audit trail
  - Post-close performance attribution (M22)
  - Defending platform values when broker numbers diverge

EXAMPLE COR PAIRINGS

  COR-01  supply pipeline pressure  ->  rent growth %
  COR-04  employment events          ->  absorbed demand units
  COR-07  news sentiment             ->  traffic intensity index
  COR-12  transit infrastructure     ->  cap rate compression
  ...     (17+ more)


----------------------------------------------------------------
4. F5 STRATEGY -> F9 STRUCTURAL MUTATION
----------------------------------------------------------------

M08's contract to M09 must include the TEMPLATE, not just values:

  M08_output = {
    recommended: "BTS",
    scores: {...},
    template: ProFormaTemplate.BTS,
    sections: [...],
    horizon: "24mo",
    periodicity: "monthly"
  }

F9 tab renderer reads `sections` and shows/hides accordingly.
proforma-generator.service.ts (367 lines) has the seam — template
list is hardcoded today; needs to be data-driven.

FOUR TEMPLATES

  BTS — Build-to-Sell — 24mo hold
    [✓] Acquisition cost stack
    [✓] Construction period · sources & uses
    [ ] Reno capex schedule
    [ ] Lease-up absorption curve
    [ ] Stabilized operating
    [ ] Daily ADR · seasonal occupancy
    [✓] Sale exit · proceeds waterfall
    [ ] Multi-year operating CF

  FLIP — 3-year hold
    [✓] Acquisition
    [✓] Light reposition capex (Y1 only)
    [✓] Stabilized operating (Y1-Y2)
    [ ] Lease-up absorption curve
    [✓] Sale exit (Y3)
    [ ] Multi-year operating CF (only 3 years)
    [ ] Daily ADR · seasonal occupancy

  RENTAL VALUE-ADD — 5-7yr hold
    [✓] Acquisition
    [ ] Construction
    [✓] Reno capex schedule
    [✓] Lease-up absorption curve
    [✓] Stabilized operating
    [ ] Daily ADR
    [✓] Sale exit
    [✓] Multi-year operating CF

  STR — Short-Term Rental — 10yr hold
    [✓] Acquisition
    [ ] Construction
    [ ] Reno capex
    [ ] Lease-up curve
    [✓] Stabilized operating (with seasonality)
    [✓] Daily ADR · seasonal occupancy
    [✓] Sale exit
    [✓] Multi-year operating CF

STORE WIRING
dealStore.ts needs a `proformaTemplate` slice that subscribes to
F5 changes. User overrides on hidden sections persist as
user-layer LayeredValue and re-emerge if strategy switches back
(extends survive-path-switches behavior already built for fields).


----------------------------------------------------------------
5. RENT TERMINOLOGY TAXONOMY
----------------------------------------------------------------

Industry-standard breakdown. The forecast model produces all of
these because each plugs into a different cash flow line.

  Gross Rent / Contract Rent
    The amount stated on the lease.

  Net Effective Rent
    Gross Rent minus the value of concessions.
    Used interchangeably with "Effective Rent" in industry.

  Concessions
    - One-time: upfront credit at lease signing
    - Recurring: monthly discount over lease life
    Both reduce net effective rent; one-time amortizes over
    initial term, recurring is direct subtraction each month.

  Market Rent
    What new leases sign at TODAY. Driven by submarket
    fundamentals + position adjustment (Section 10).

  In-Place Rent
    Current portfolio average across active leases. Sum of
    existing leases at their gross rates, divided by occupied
    units.

  Loss-to-Lease (LTL)
    Market Rent minus In-Place Rent. The gap between what
    you could get today vs what current leases are signed for.
    Captured one-time on turnover (Section 11 mark-to-market
    formula), not as smooth growth.

  New Lease Rent
    Achieved on new tenant signings. Usually = Market Rent
    in efficient markets.

  Renewal Rent
    Achieved on lease renewals. Often softer than new lease
    rent in tight markets, similar in soft markets.
    Interacts with renewal rate (the % of leases renewed
    rather than turned). Higher renewal rate = less
    mark-to-market churn = lower realized growth than
    market growth.

  +4% market growth × 80% renewal ≈ +1.2% realized in-place
  +4% market growth × 50% renewal ≈ +2.0% realized in-place


----------------------------------------------------------------
6. RENT GROWTH FORECAST — LAYERED MODEL
----------------------------------------------------------------

CPI is the LONG-RUN ANCHOR, not the forecast itself.
Using all-items CPI as the forecast is circular (CPI already
includes shelter). CPI shelter sub-index is the right anchor;
with a small asset-class spread (~30bps for multifamily over
30+ years).

FORMULA

  g(t) = w_m(t) * momentum
       + w_c(t) * cycle
       + w_a(t) * anchor
       + sum(event_deltas)
       + position(t)

Weights mean-revert toward anchor across forecast horizon:

  w_m(t):   high Y1, fades by Y3
  w_c(t):   peaks Y1-Y3
  w_a(t):   small early, dominates Y5+
  events:   episodic with per-pairing decay function
  position: see Section 10

FIVE COMPONENTS

  1. MOMENTUM
     Source:  M15 comp set
     Input:   12-month asking rent trend
     Decay:   weight fades Y1 -> Y3

  2. CYCLE POSITION
     Source:  M04 supply, M06 demand
     Input:   pressure index (-1 to +1)
     Profile: weight peaks Y1-Y3

  3. LONG-RUN ANCHOR
     Source:  BLS CPI shelter (NOT all-items)
     Input:   + asset-class spread
                Multifamily   ~30bps
                Retail/Office  more variable
                Industrial     hotter spread historically
     Profile: dominates Y5+ horizon

  4. EVENT DELTAS
     Source:  Correlation Engine (COR-XX firings)
     Input:   episodic % adjustments tied to specific events
     Decay:   per-pairing decay function

  5. POSITION ADJUSTMENT
     Source:  M15 mark-to-market + comp set position
     Input:   subject vs comp set spread
     Profile: see Section 10 (three modes)


----------------------------------------------------------------
7. OPEX GROWTH FORECAST — LAYERED MODEL
----------------------------------------------------------------

CRITICAL: OPEX is NOT one number. It's a stack of line items,
each with its own anchor and growth profile. Total OPEX growth
is the dollar-weighted average of line growth rates.

  total_opex_growth(t) = sum(line_share_i * line_growth_i(t))

LINE ITEM REFERENCE (typical multifamily)

  Line               | $ share  | Anchor                 | Special
  -------------------|----------|------------------------|----------------------
  Property tax       | 15-20%   | County millage         | FL 10% cap, reassess
  Insurance          | 15-25% * | Regional + reinsurance | FL hurricane premium
  Utilities          | 7-11%    | EIA + municipal rates  | Weather variance
  R&M                | 8-12%    | BLS PPI construction   | Asset age effect
  Mgmt fees          | 3-5%     | % of revenue           | Auto-couples to M09
  Payroll            | 12-16%   | BLS ECI by metro       | Local wage growth
  Marketing/leasing  | 2-4%     | Variable w/ vacancy    | Soft-market burn
  Admin / G&A        | 4-6%     | All-items CPI          | —
  Reserves           | 12-15%   | Per-unit + asset age   | Capex lifecycle

  * Florida coastal MF; non-coastal markets typically 5-8%.

LAYERED MODEL APPLIED PER LINE

  opex_line_growth(t) = w_m(t) * momentum (T12 actual or library)
                      + w_c(t) * cycle    (line-specific)
                      + w_a(t) * line_anchor
                      + sum(event_deltas) (line-specific COR firings)
                      + structural_overrides

The momentum component reads from `deal_monthly_actuals` when
available, falls back to library benchmarks when not (see
Section 12 — graceful degradation).

FIVE COMPONENTS (parallel to rent)

  1. MOMENTUM
     Source: M22 deal_monthly_actuals OR M18 T12 parser OR
             data library benchmark (graceful fallback)
     Input:  trailing 12mo actual line-item spend (or comp avg)
     Decay:  weight fades Y1 -> Y3

  2. CYCLE POSITION
     Source: line-specific cycle drivers
       - Insurance:  storm cycle, reinsurance hardening (M14)
       - Utilities:  energy commodity cycle
       - Payroll:    labor tightness (BLS regional)
       - R&M:        construction labor / materials (BLS PPI)
     Profile: cycle peaks vary by line

  3. LONG-RUN ANCHOR (per-line — see table above)
     Source: line-specific external feeds
       - Property tax:  county millage projections
       - Insurance:     NAIC regional, FL OIR rate filings
       - Utilities:     EIA Annual Energy Outlook
       - R&M:           BLS PPI construction
       - Payroll:       BLS ECI by metro
       - Mgmt:          % of revenue (auto from M09)
       - Marketing:     variable function of vacancy
       - Admin/G&A:     BLS CPI all-items
       - Reserves:      per-unit benchmark + age curve

  4. EVENT DELTAS
     Source: Correlation Engine (line-specific COR firings)
     Examples:
       - Hurricane event     -> insurance step jump
       - County millage hike -> property tax delta
       - Regional wage event -> payroll inflection
       - Energy shock        -> utilities Y1 deviation
     Decay: per-event decay tuned per line

  5. STRUCTURAL OVERRIDES (replaces "position" from rent model)
     Florida-specific mandates that override smooth growth:
       - Property tax 10% non-homestead cap (annual ceiling)
       - Reassessment on sale at purchase price (Y1 STEP)
       - Doc stamps + intangible taxes (one-time, deal close)
       - Insurance hurricane premium (regional surcharge)
       - 4% homestead cap (rare in commercial MF)

KEY DIFFERENCES FROM RENT GROWTH

  - Y1 STEP-FUNCTION for property tax reassessment-on-sale.
    Rent doesn't have this. Layered model must accommodate
    step changes, not just smooth growth curves.

  - Insurance cycle is much LUMPIER than rent. Single
    hurricane season can move insurance +20% in one renewal.
    Confidence band on insurance forecast should be visibly
    wider than rent.

  - Mgmt fees AUTO-COUPLE to revenue (no independent
    forecast). Pass through from M09 revenue line.

  - Reserves are partly platform-dictated (per-unit benchmark
    by asset age) — less subjective than other lines.

NOI GROWTH IDENTITY

  NOI_growth = (rent_growth - opex_growth * (1 - NOI_margin))
                                          / NOI_margin

  Example (FL multifamily, 60% NOI margin baseline):
    rent growth +3.0%, opex growth +5.2%
    NOI growth = (3.0% - 5.2% * 0.4) / 0.6 ≈ 1.5%

  This is why a "+3% rent growth" assumption with no OPEX
  model produces wildly optimistic NOI projections — Florida
  insurance alone can erase rent growth in single years.


----------------------------------------------------------------
8. GORDON GROWTH COUPLING — CAP RATE VALIDATOR
----------------------------------------------------------------

The Gordon Growth identity ties cap rate to growth assumption.
Brokers commonly stack "high growth + cap compression" without
realizing they're double-counting growth.

IDENTITY

  Value = NOI / (k - g)
        ⇒  Cap rate = k - g

  k  = required return (from RSS / risk model)
  g  = perpetuity growth rate (from forecast model)

Higher growth -> lower cap is justified (growth makes up for
lower yield). But you can't ALSO assume cap compression on top
of growth — that's claiming growth twice.

TYPICAL OVER-PROMISE PATTERN

  Going-in cap   5.5%    } at g=4%, implies k=9.5% going in
  Exit cap       5.0%    } at g=4%, implies k=9.0% at exit
  Rent growth   +4-5%   }

  Implied claim: risk dropped 50bps over hold period.
  For a stabilized asset with no operational change,
  this requires separate justification.

VALIDATOR PSEUDO-CODE

  function validateGordonGrowth(deal):
    k = deal.required_return            // from RSS / M14 risk
    g_terminal = layeredValue
                 .platform.rent_growth_pct.terminal
    implied_cap = k - g_terminal

    divergence_bps = (deal.exit_cap - implied_cap) * 100

    if divergence_bps < -25:
      return {
        flag: "GORDON_OVER_PROMISE",
        severity: "high",
        message: "Exit cap of {exit_cap}% is {|divergence|}bps
                  below Gordon-implied {implied_cap}% given
                  {g_terminal}% terminal growth. Reconcile:
                  lower growth, raise exit cap, or justify
                  k change."
      }

    if divergence_bps > 100:
      return {
        flag: "GORDON_CONSERVATIVE",
        severity: "info",
        message: "Exit cap is {divergence}bps above
                  Gordon-implied. Conservative — fine, but
                  check if you're leaving value on the table."
      }

    return { valid: true }

UI RULE
In F9 collision view, the warning surfaces as a banner next to
the exit cap field. User can click "show valid range" -> chart
with their assumption plotted on the (g, cap) plane.

K SOURCE
  k comes from the RSS / risk model (M14). For stabilized
  multifamily, k typically 8-10%. The platform persists k as
  a deal-level value with its own provenance.

CALIBRATION TBD
Threshold tuning for severity bands (-25bps "high",
+100bps "info") is a calibration parameter — backtest against
historical deal performance to refine.


----------------------------------------------------------------
9. CONFIDENCE INTERVALS & REFUSAL THRESHOLD
----------------------------------------------------------------

Two independent sources of uncertainty combine for any forecast.

  σ_total(t) = sqrt(σ_model(t)² + σ_sparsity(submarket)²)

  σ_model     = std of model residuals from backtesting
  σ_sparsity  = penalty for thin data in this submarket

PERCENTILE MATH

  P25(t) = forecast(t) - 0.674 * σ_total(t)
  P75(t) = forecast(t) + 0.674 * σ_total(t)
  P10(t) = forecast(t) - 1.282 * σ_total(t)
  P90(t) = forecast(t) + 1.282 * σ_total(t)

F9 COLLISION VIEW STATES

When user enters an override on a platform-forecast field:

  Override INSIDE P25-P75 band
    -> no flag, neutral display

  Override OUTSIDE P25-P75 but INSIDE P10-P90
    -> soft warning: "your assumption is in the bottom/top
       quartile of historically reasonable forecasts"

  Override OUTSIDE P10-P90
    -> hard warning + ask for justification note (stored
       with override in user layer)

REFUSAL THRESHOLDS

Platform should NOT forecast at all when:
  - Fewer than 5 stabilized comps in submarket
  - Submarket has less than 3 years of comp history
  - Asset class has no representation (first STR deal in market)

Refusal payload:
  {
    value: null,
    reason: "INSUFFICIENT_DATA",
    required: "min 5 comps + 3yr history",
    available: { comps: 2, history_years: 1.5 }
  }

When platform refuses:
  - F9 falls back to broker layer + user override only
  - F10 Risk bumps market-uncertainty risk score
  - User sees badge: "platform unable to forecast — proceed
    with caution"

PROVENANCE INFLUENCE
Inferred / library-default values (Section 12) carry inflated
σ_sparsity. Same forecast-vs-override logic applies but bands
are wider, so "outside" warnings fire less aggressively when
the underlying input is inferred rather than actual.


----------------------------------------------------------------
10. SUBMARKET POSITION ADJUSTMENT
----------------------------------------------------------------

"Position" = subject's quality / vintage premium or discount
relative to its comp set average.

EXAMPLES
  New-construction Class A in Class B submarket:
    +12% rent premium  ->  position = +0.12

  Old Class C in Class B submarket:
    -8% rent discount  ->  position = -0.08

THREE MODES

  MEAN-REVERTING (default)
    Premium / discount decays over time. New-construction
    premium erodes as competing supply delivers; deep
    discount closes as renovation programs proliferate.

      position_t = position_0 * exp(-t / half_life)

      subject_growth_t = submarket_growth_t
                       + (position_{t} - position_{t-1})

    Half-life calibrated by historical comp set data.
    Multifamily premium decay typically 4-5 years.
    Discount closure typically slower (renovation is slow).

  CONSTANT GAP
    Subject and submarket grow at same rate; gap maintained.
    Use when there's a structural reason the gap won't close
    (irreplaceable location, regulatory moat, unique amenity).

  WIDENING
    Rare. Justified only when subject has structural advantage
    that compounds (land-constrained submarket where new
    construction is impossible, so existing premium grows).

DEFAULT BEHAVIOR
Mean-reverting with 4.5yr half-life for premium decay,
6yr for discount closure. User can override mode + half-life
with justification note.

OWNERSHIP
M15 (comp set selection drives the submarket benchmark).
Surfaces as additive component to rent growth forecast in
M09. Especially important for newly-developed Class A —
without position decay, those deals look perpetually
outperformer-shaped.


----------------------------------------------------------------
11. USER-SELECTABLE REVENUE FORMULA
----------------------------------------------------------------

User picks among formula options for revenue projection. The
formula choice itself is a layered value at the deal level.

THREE OPTIONS

  SIMPLE
    revenue_t = units * rent_0 * (1 + g)^t

    Uniform growth. Fastest, least accurate. Use for quick
    screening or when detailed rent roll unavailable.

  MARK-TO-MARKET (recommended for deals with significant LTL)
    revenue_t = (in_place * in_place_rent * (1 + escalator)^t)
              + (turnover_t * market_rent_t * (1 + g(t))^t)

    where:
      in_place      = leases not turning in year t
      turnover_t    = leases turning over in year t
                    = total_units * (1 - renewal_rate)
      escalator     = annual lease bump on in-place leases
      market_rent_t = market rent forecast for year t
      g(t)          = market rent growth from layered model

    Captures one-time mark-to-market gain on turnover
    separately from trend growth.

  RENEWAL-AWARE (most detailed)
    revenue_t = (renewing * in_place_rent * (1 + g_renewal(t)))
              + (new_leases * market_rent * (1 + g_market(t)))

    where:
      g_renewal != g_market in tight markets
      g_renewal usually softer than g_market (concession-
        heavy renewals to retain tenants)
      requires per-unit lease tracking

    Best for stabilized portfolios with detailed rent roll
    and renewal history.

STORAGE

  deal.proforma.revenue_formula: LayeredValue<FormulaChoice>
    broker:   formula stated/implied in OM
    platform: recommended based on data availability + strategy
    user:     explicit override

FORMULA INFLUENCES UI

Each formula surfaces different fields in F9:
  Simple          -> rent + g only
  Mark-to-market  -> rent + g + renewal rate + escalator
  Renewal-aware   -> rent + g_market + g_renewal + churn schedule

Switching formula is a path-switch event (Section 4 wiring).
User overrides on hidden fields persist in user layer and
re-emerge if formula switches back.


----------------------------------------------------------------
12. GRACEFUL DEGRADATION & PROVENANCE SCHEMA
----------------------------------------------------------------

The platform must not block on missing actuals. Deals come in
with varying levels of disclosure. Each upload tier has its
own fallback path.

THREE UPLOAD TIERS

  RENT ROLL ONLY (most common at LOI stage)
    Available: in-place rent, loss-to-lease, unit count,
               unit mix, lease expiration ladder
    Fallback:  OPEX from data library expense comps.
               Property tax from county records + tax math.
               Insurance from owner-supplied or library
               regional benchmark (FL hurricane premium
               applied if coastal).
    Quality:   OPEX line items flagged INFERRED.

  T12 / FINANCIALS ONLY (rare without rent roll)
    Available: actual OPEX line items, NOI history
    Blocked:   rent dynamics blocked without unit count.
               Need basic property data (unit count, sf, age)
               to derive per-unit metrics.
    Fallback:  request property data from user. Once unit
               count known, derive per-unit metrics from T12.
    Quality:   FINANCIALS_ONLY — limited rent dynamics.

  OM ONLY (broker pitch stage, no underwriting docs)
    Available: broker-stated numbers
    Fallback:  agents create both Broker version (OM stated)
               and Platform version (independent derivation
               from library + market data).
    Display:   side-by-side in F9 collision view extended to
               whole-pro-forma comparison.
    User flow: pick which lines to accept from each ->
               creates third "user-curated" version.

PROVENANCED VALUE SCHEMA

Every assumption wraps in this richer schema (extends
LayeredValue<T>):

  interface ProvenancedValue<T> {
    value: T;
    source:
      | "actual_t12"            // highest confidence
      | "actual_rent_roll"
      | "owner_provided"
      | "broker_om"
      | "data_library_comp"     // inferred from library
      | "data_library_default"  // last-resort default
      | "platform_calculation";
    confidence: number;          // 0-1, source-weighted
    quality_flag:
      | "ACTUAL"
      | "INFERRED"
      | "ESTIMATED"
      | "DEFAULT";
    fill_method?: string;        // e.g.,
                                 // "regional_avg_class_b_2024"
    asOf: string;
    modelVersion?: string;
  }

QUALITY FLAGS DRIVE F9 UI

  ACTUAL    no badge, normal display
  INFERRED  light badge "from library comp"
  ESTIMATED yellow badge "estimated, request actuals"
  DEFAULT   orange badge "platform default, low confidence"

AGENT FILL-IN PASS

Before generating the proforma, an input completeness pass
runs:

  function buildProForma(deal):
    required_inputs = template.requiredFields
                      // depends on F5 strategy

    for field in required_inputs:
      if field is missing:
        filled_value = agent.fillFromLibrary(
                         field,
                         deal.context
                       )
        deal.assumptions[field] = {
          value: filled_value,
          source: "data_library_comp",
          confidence: 0.5,
          quality_flag: "INFERRED",
          fill_method: agent.method
        }

    // generate proforma with mixed actual + inferred values
    // F9 surfaces quality flags inline next to each cell

CONFIDENCE INTERACTION
Inferred / estimated values flow into Section 9 confidence
math via inflated σ_sparsity. Wider P25-P75 bands -> "outside
range" warnings fire less aggressively when the underlying
input was filled by the agent.

OPEX MOMENTUM IS NOT BLOCKED
Section 7's momentum component reads from
`deal_monthly_actuals` when available, falls back to library
benchmarks (with reduced confidence) when not. The migration
is an UPGRADE for accuracy, not a critical-path blocker.


----------------------------------------------------------------
13. SAVE-DRIVEN VERSIONING
----------------------------------------------------------------

Versioning happens at user save events, not on every keystroke.

TRIGGERS
  - User types "save" in chat
  - User clicks Save button in F9
  - Model prompts user to save (after threshold of unsaved
    changes, or on navigation away)

FLOW

  User makes changes
    -> "unsaved changes" indicator appears
  User saves
    -> snapshot LayeredValue state of all assumptions
    -> stamp model versions of each component
    -> write to deal_versions table:
         {
           deal_id, version_number, timestamp, user_id,
           layered_state_snapshot,
           model_versions: {
             rent_growth: "v3.2",
             opex: "v2.1",
             cap_rate: "v1.4",
             ...
           },
           override_divergences: [
             { field, user_value, platform_value,
               divergence, justification_note }
           ]
         }
    -> "saved at HH:MM" indicator replaces unsaved marker

AUDIT TRAIL = SAVED VERSIONS ONLY
User can browse version history in F9 ("compare to v3") and
see diff between any two saved states.

OVERRIDE DIVERGENCE
At save time, the platform records every field where user
overrode the platform value. Stored alongside the version
snapshot. Used by M22 post-close attribution to score
"which user overrides turned out to be right" and feed
back into model retraining.

NO AUTO-SAVE
Changes don't auto-persist. Closing the deal without saving
loses unsaved changes (with confirmation prompt). This is the
intentional trade-off for clean version history.


----------------------------------------------------------------
14. CALIBRATION TBDS
----------------------------------------------------------------

Architecture is decided. These are empirical / parameter
tunings that need backtesting:

  - Asset-class spread values for the rent anchor (multifamily,
    retail, office, industrial). Calibrate from historical
    BLS CPI shelter vs realized rent growth by asset class.

  - Position decay half-life by asset class and submarket type.
    Default 4.5yr for premium, 6yr for discount.

  - Confidence interval residual variance (σ_model). Backtest
    layered model against historical deal performance.

  - Sparsity penalty function (σ_sparsity). Empirical curve
    of forecast accuracy vs comp count.

  - Gordon Growth severity thresholds (currently -25bps "high",
    +100bps "info"). Tune from broker pitch over-promise data.

  - Specific COR pairings priority order. Which 5-10 to
    implement first based on event frequency × impact size.

  - Required-return (k) formula in RSS / risk model. Currently
    referenced from M14; the formula itself is on the roadmap
    (Gordon-adjusted risk premium item).

  - Per-line OPEX cycle drivers. The "cycle" component for
    insurance, utilities, payroll, etc. needs concrete
    mappings to external indicators.

  - Renewal rate baseline by asset class and market type.
    Default values for when rent roll history doesn't exist.


----------------------------------------------------------------
15. BUILD SEQUENCING
----------------------------------------------------------------

TIER 0  Load-bearing — implement first
  - Provenance schema + LayeredValue extension (Section 12)
  - Rent terminology decomposition (Section 5)
  - OPEX line-item structure (Section 7)
  - Mark-to-market revenue formula (Section 11)
  - Module registry symmetry fix (Section 2)
  - F5 -> F9 template selection (Section 4)

TIER 1  Protectors — guard against over-promise
  - Gordon Growth validator (Section 8)
  - Confidence band -> F9 collision view (Section 9)
  - Layered rent growth model wiring (Section 6)
  - Layered OPEX growth model wiring (Section 7)

TIER 2  Data quality + audit
  - Save-driven versioning + override audit (Section 13)
  - Agent fill-in pass + quality flags (Section 12)
  - Correlation Engine -> JSONB persistence (Section 3)
  - `deal_monthly_actuals` migration (upgrade, not blocker)

TIER 3  Refinement
  - Position adjustment with calibrated half-lives (Section 10)
  - Renewal-aware revenue formula (Section 11)
  - Per-strategy template tuning (BTS / Flip / V-Add / STR)
  - Refusal threshold tuning (Section 9)
  - Asset-class spread calibration (Section 14)


----------------------------------------------------------------
16. IMPLEMENTATION NOTES
----------------------------------------------------------------

LAYERED VALUE PATTERN (with provenance)
  See Section 12 for full ProvenancedValue<T> schema.
  Resolution order: user > platform > broker
  User overrides survive path switches (formula change,
  strategy change, field hide/show).

DEALSTORE AS MESSAGE BUS
  Modules subscribe to dealStore slices. No direct cross-module
  imports. Slices to add:
    - proformaTemplate    (subscribes to F5 changes)
    - revenueFormula      (subscribes to F9 internal config)
    - confidenceBands     (computed from forecast + sparsity)
    - validationFlags     (Gordon Growth, override warnings)

CORRELATION ENGINE PERSISTENCE
  Store outputs in `correlation_adjustments` JSONB column
  on deal:

    {
      cor_id: "COR-04",
      event_id: "rivian_hq_relocation_2026",
      target_module: "M05",
      target_field: "rent_growth_pct",
      delta_value: 0.008,
      confidence: 0.74,
      decay_function: "exponential_24mo",
      applied_at: "2026-04-28T..."
    }

MODEL VERSIONING
  Tied to save events (Section 13). Every saved version stamps
  current model versions of each component:
    - modelVersion       (e.g., "rent_growth_v3.2")
    - asOf               (timestamp)
    - input_snapshot_id  (re-derivation reproducible)
  Rollover policy: tag each released model version, never
  mutate in place. Allows comparing user override divergence
  across model versions for retraining.

DECAY FUNCTIONS
  Standard library:
    - exponential(half_life_months)
    - linear(start, zero_at)
    - step_then_decay(step_size, hold_months, half_life)
    - constant   (no decay — for structural overrides)
  Each component (and each event delta) references one.

REQUIRED-BY-DEAL-TYPE ENUM
  Add to module-registry entries:

    requiredByDealType?:
      ("Stabilized" | "Construction" | "Redevelopment")[]

  M07 example:
    requiredByDealType: ["Construction"]

AGENT FILL-IN PASS
  Runs before proforma generation. Walks required fields
  for the active F5 template. Missing fields filled from
  data library with provenance + confidence + quality flag.
  See Section 12 for pseudo-code.

REFUSAL HANDLING
  When platform forecast layer is null (data sparsity),
  F9 falls back to broker + user only. F10 Risk bumps
  market-uncertainty score. UI shows badge, doesn't block
  underwriting.

================================================================
END OF NOTES — revision 2
================================================================
> See also: [Deal Capsule Field Blueprint](./deal-capsule-blueprint.md)

# ROADMAP MODE — VALUE CREATION PLAN SPEC v1.0

**Module:** Cash Flow Agent — Roadmap Mode (new mode, complements existing Underwrite Mode)
**Status:** Draft v1.0
**Owner:** Leon / JEDI RE
**Pairs with:** `CASHFLOW_AGENT_PROMPT_PATCH_V4.md`, `M09_PROFORMA_SPEC.md`, `M36_Joint_Distribution_Engine_Spec.md`, `M22 Post-Close Intelligence`
**Target executor:** Architecture handoff to Claude Code; subsequent Replit integration for UI surfaces
**Build window:** 3 sessions to MVP; 1 additional session for value-add comp comparison feature

---

## 1. PURPOSE

Standard underwriting models are **descriptive**: given assumptions, produce a Pro Forma and IRR. Sensitivity tables are **diagnostic**: show how IRR varies with input swings. Neither answers the question an operator actually asks at acquisition:

> "What specific actions, in what order, with what evidence, get me from current state to my target return?"

Roadmap Mode answers exactly this. It is **prescriptive**: it produces an ordered, year-by-year operational plan with timing, evidence, and impact estimates, validated against the target return outcome.

The defining example is the value-add comp comparison. Two similarly built properties in the same submarket; one rents $300/unit/mo higher. The Pro Forma model tells you the gap exists. Roadmap Mode tells you (a) what the higher-rent comp did to get there, (b) the ordered plan to replicate it on the subject, (c) the evidence supporting each action's impact, and (d) whether the full plan reconciles to the target IRR.

---

## 2. WHAT ROADMAP MODE IS

A different output mode of the same Cash Flow Agent. Triggered by:
- Explicit user request: "build me a roadmap to 15% IRR on this deal"
- Capsule tier setting: roadmap mode is auto-enabled for value-add and redevelopment deals at Principal+ tier
- API flag: `mode: 'roadmap'` in agent invocation

Shares infrastructure with Underwrite Mode:
- Same tool registry (27 tools)
- Same DealContext input
- Same analog-anchored forecasting framework
- Same posture awareness framework
- Same M36 plausibility check on the final assumption set

Differs in output:
- Output is an **ordered action sequence**, not a Pro Forma snapshot
- Each action carries timing, impact, evidence, confidence, dependencies
- Year-by-year trajectory shown as cumulative impact accumulation
- Final reconciliation against target return

---

## 3. INPUT CONTRACT

```typescript
RoadmapInput {
  deal_id: string,
  target_return: {
    metric: "irr" | "equity_multiple" | "noi_growth_3yr" | "cash_on_cash_y3",
    value: number,
    hold_years: number
  },
  constraints?: {
    max_capex_budget?: number,
    max_debt_terms?: { rate: number, ltv: number },
    sponsor_excluded_actions?: string[],   // e.g., ["unit_add", "amenity_reno"]
    must_include_actions?: string[]         // e.g., ["tax_appeal"]
  },
  sponsor_capabilities?: {
    in_house_pm: boolean,
    renovation_experience: "low" | "medium" | "high",
    leasing_strategy_change_capability: boolean
  }
}
```

If `target_return.value` is unspecified, default to the sponsor's hurdle from their portfolio history (`fetch_owned_asset_actuals` median IRR-on-similar-deal) + 200bps stretch.

---

## 4. OUTPUT CONTRACT

```typescript
RoadmapOutput {
  meta: {
    deal_id: string,
    target_return: {...},
    achievability_status: "achievable" | "achievable_with_stretch" | "achievable_only_with_overrides" | "not_achievable",
    achievability_reasoning: string
  },

  baseline_proforma: {
    description: "What this deal yields with NO value-add actions, holding posture-modulated assumptions",
    irr: number,
    equity_multiple: number,
    noi_path: number[]   // Y1-Y_exit
  },

  target_proforma: {
    description: "Pro Forma values required to hit target_return",
    irr: number,
    equity_multiple: number,
    noi_path_required: number[]
  },

  gap_analysis: {
    total_noi_gap: number,            // sum of NOI lift required Y1-Y_exit
    gap_by_bucket: {
      revenue_lift: number,
      expense_reduction: number,
      other_income_lift: number,
      debt_optimization: number,
      capex_value_add: number,
      exit_timing_lift: number
    }
  },

  roadmap_actions: RoadmapAction[],   // ordered, timed, evidenced

  yearly_trajectory: YearlyTrajectory[],

  plausibility_check: {
    m36_d_value: number,
    classification: "within_distribution" | "stretch" | "aggressive" | "implausible",
    notes: string
  },

  comp_comparison?: CompComparison    // Optional — populated when run as comp-driven roadmap
}

RoadmapAction {
  id: string,
  action_name: string,                // e.g., "tax_assessment_appeal", "RUBS_implementation", "amenity_reposition"
  category: enum,                     // revenue | expense | other_income | debt | capex | exit
  timing: {
    start_month: number,              // months from acquisition close
    duration_months: number,
    impact_starts_month: number,      // can lag start_month (e.g., capex takes time to complete)
    impact_fully_realized_month: number
  },
  expected_impact: {
    annualized_dollar_impact_at_full_realization: number,
    affected_line_items: string[],    // e.g., ["proforma.opex.property_tax"]
    confidence: "high" | "medium" | "low"
  },
  evidence: {
    archive_success_rate: number,     // % of analog cohort deals where this action achieved its target lift
    archive_n: number,
    archive_p50_actual_lift: number,  // historical actual lift
    archive_p25_p75_actual_lift: [number, number],
    cohort_match_criteria: string,
    market_signal_support: string[]   // e.g., ["M07 absorption strong", "comp set RUBS implementation common"]
  },
  cost: {
    upfront_capital: number,
    operating_cost_change: number,    // per year
    one_time_disruption: number       // e.g., legal fees, consultant fees
  },
  dependencies: string[],              // action IDs that must complete first
  risks: string[]                      // named risks that could undermine the action
}

YearlyTrajectory {
  year: number,
  actions_active: string[],            // action IDs running in this year
  posture_classification: string,      // from posture framework
  noi_baseline: number,                // what NOI would be with no actions
  noi_with_roadmap: number,            // what NOI is with actions accumulated through this year
  noi_lift_this_year: number,
  noi_lift_cumulative: number,
  primary_lift_drivers: { action_id: string, dollar_contribution: number }[]
}

CompComparison {
  reference_comp: { property_id: string, name: string },
  observed_differences: {
    category: "physical" | "operational" | "pricing" | "ancillary" | "tenant_mix",
    description: string,
    rent_or_noi_attribution: number   // estimated dollar contribution to comp's higher performance
  }[],
  replicable_differences: string[],    // which differences are within sponsor's control to replicate
  non_replicable_differences: string[], // which are structural/locational
  replicability_score: number          // 0-100: how much of comp's premium is reachable
}
```

---

## 5. DERIVATION FLOW

### Step 1 — Baseline Pro Forma (no value-add)

Run Cash Flow Agent in Underwrite Mode with:
- All Δ_operator set to zero
- All Δ_capex set to zero (other than required maintenance reserves)
- Posture assessment retained (market-driven posture still applies)
- Renovation premium = 0

Output: baseline_proforma. This is "what happens if buyer does nothing operational, just owns it through market drift and analog cohort baseline."

### Step 2 — Target Pro Forma (solve for target return)

Call `goal_seek_target_irr` (M36) with:
- Target return metric and value
- Hold period
- Constraints (debt terms, exit cap forecast)

Returns: assumption set required to hit target. This is target_proforma — NOT a recommended set of assumptions, but the *minimum required* values per line item.

### Step 3 — Gap Analysis

Compute gap between baseline and target across the standard buckets:
- **Revenue lift**: gap on GPR (rent growth, vacancy, concession reduction)
- **Expense reduction**: gap on controllable OpEx
- **Other income lift**: gap on ancillary, RUBS, parking, pet, fees
- **Debt optimization**: gap on debt cost (refinance, refi sensitivity)
- **Capex value-add**: gap that requires physical improvement
- **Exit timing/cap**: gap on exit cap rate (timing or trajectory)

Output: gap_by_bucket with dollar values per Y1-Y_exit.

### Step 4 — Action Inventory and Sizing

For each bucket, generate candidate actions. Pull from the **Action Library** (a curated knowledge base of operational actions with typical impact bands, evidence requirements, and tool integrations).

Each action gets:
- Expected impact band (P25, P50, P75) from `fetch_archive_achievement_vs_assumption` filtered to deals that took this action
- Cost and disruption profile
- Dependencies (e.g., "RUBS implementation requires meter installation capex; tax appeal requires recent assessment to be appealable")
- Sponsor capability fit (some actions require in-house PM, others can be vendor-managed)

If subject is in posture-defense during a year, exclude offense-only actions for that year (e.g., aggressive RUBS launch during a heavy concession environment).

### Step 5 — Action Sequencing

Order actions by:
1. **Dependencies** (foundational actions first — tax appeal can run independently; amenity reno requires capex budget allocation; lease strategy change requires PM transition)
2. **Time-to-impact** (quick wins early — tax appeal, parking fee implementation, vendor rebids in Y1; longer-cycle items like full amenity reno in Y1-Y2 with impact in Y2-Y3)
3. **Posture alignment** (offense-mode actions concentrated in offense years)
4. **Capital staging** (don't front-load all capex into Y1; sequence to operating cash flow availability)

### Step 6 — Year-by-Year Trajectory Assembly

For each year:
- List active actions
- Compute NOI lift from each active action (interpolating between impact_starts_month and impact_fully_realized_month)
- Aggregate to year-level NOI lift
- Add to baseline NOI to produce projected NOI for that year

### Step 7 — Reconciliation and Achievability Assessment

Sum the year-by-year roadmap NOI path and compare to target_proforma NOI path required.

Achievability classification:
- **Achievable** — full roadmap meets or exceeds target with each action at P50 lift, M36 d < 1.5
- **Achievable with stretch** — full roadmap meets target only if multiple actions hit P75 lift; M36 d 1.5-2.5
- **Achievable only with overrides** — requires user-supplied assumptions outside archive distribution
- **Not achievable** — even at P75 for every action, gap exceeds target; recommend lower target, longer hold, or different deal

If "not achievable," produce specific guidance: "Target 15% IRR is not achievable at current pricing. Maximum reachable IRR with full operational roadmap at P75 execution is 11.4%. To hit 15%, either negotiate price down by ~$4.2M or extend hold to 7 years to capture additional rent growth and exit cap compression."

### Step 8 — M36 Plausibility Check

Call `evaluate_plausibility` on the final target Pro Forma assumption set. If d > 2.5, flag the roadmap as aggressive even if individually each action is defensible.

### Step 9 — Comp Comparison (optional, value-add specific)

If a reference comp is specified (or auto-selected as the highest-rent comparable in the comp set):

- Pull comp data: physical specs, amenity package, ancillary fee structure, rent positioning, expense ratios where available
- Decompose comp's rent premium attribution: how much from amenities, how much from interior condition, how much from leasing strategy, how much from tenant mix, how much from pricing discipline
- Classify each difference as replicable (within sponsor capability + capex budget) or non-replicable (structural, locational, irreversible)
- Compute replicability_score: percentage of comp premium that is theoretically reachable
- Map replicable differences onto roadmap actions

This is the answer to "two similarly built properties in same submarket, one rents higher — why and how do I get there?"

---

## 6. THE ACTION LIBRARY

The library is a curated knowledge base of operational actions. Each entry:

```typescript
ActionLibraryEntry {
  id: string,
  name: string,
  category: enum,
  description: string,
  applicability: {
    deal_types: enum[],              // which deal types this applies to
    asset_classes: enum[],
    requires_posture: enum[]         // which postures this action is appropriate for
  },
  impact_band: {
    p25_pct: number,                 // P25 percent lift on affected line items (from archive)
    p50_pct: number,
    p75_pct: number,
    affected_lines: string[]
  },
  cost_profile: {
    typical_upfront: number,         // typical capital required
    typical_operating: number,
    sensitivity_to_property_size: "fixed" | "per_unit" | "per_sqft"
  },
  duration: {
    typical_start_lag: number,       // months from acquisition to start
    typical_duration: number,
    typical_impact_lag: number       // months from start to first impact
  },
  evidence_query: string,            // archive query template to fetch achievement data
  dependencies: string[],
  risks: string[]
}
```

### Initial Library Set (MVP — 20 actions)

**Revenue lift:**
1. Loss-to-lease burn-off acceleration (aggressive renewals at market on turning units)
2. RUBS implementation (utility billback to residents)
3. Interior renovation premium capture
4. Amenity reposition premium capture
5. Leasing strategy change (revenue management software adoption)
6. Rent comp repositioning (selective premium pricing on high-demand units)

**Expense reduction:**
7. Property tax assessment appeal
8. Insurance reshop (multi-property pooling)
9. Vendor contract rebid (R&M, landscaping, cleaning)
10. Management transition (in-house from third-party, or vice versa)
11. Energy efficiency capex (LED, water savers, smart thermostats)
12. Payroll restructuring (centralized leasing, regional service)

**Other income lift:**
13. Pet rent and pet deposit implementation
14. Parking fee implementation or restructure
15. Storage/locker fee implementation
16. Trash valet service implementation
17. Smart home/tech fee implementation
18. Common area amenity fees (pool cabanas, etc.)

**Debt optimization:**
19. Supplemental financing or refinance to lower rate
20. Mezzanine paydown to reduce blended cost

**Capex value-add:** (subset of above with capex tagging)

**Exit timing:** (this is a passive action — timing the exit to a forecasted cap rate trough, not an operational action)

### Library Maintenance

Library entries calibrate from archive:
- Nightly job: for each library action, query `deal_underwriting_snapshots` and `deal_monthly_actuals` (post-M22) to compute actual P25/P50/P75 impact bands
- Library entries update with empirical bands as archive grows
- New action types added as user behavior and archive coverage warrant (e.g., new technology adoption, new fee types)

---

## 7. INTEGRATION WITH EXISTING MODULES

### M08 Strategy Arbitrage
M08 selects the highest-scoring strategy. Roadmap mode operates *within* a chosen strategy — it produces the value creation plan for that strategy. M08 says "value-add rental holds best score for this deal"; Roadmap mode says "and here's the specific year-by-year plan to execute the value-add rental strategy to target IRR."

### M09 Pro Forma
The target_proforma in Roadmap output IS a Pro Forma — it occupies the same field catalog. The Pro Forma tab can render either:
- Standard Pro Forma (Underwrite Mode output), OR
- Target Pro Forma (Roadmap Mode output) with the roadmap action list rendered below

### M22 Post-Close Intelligence
Critical pairing. Once M22 is live with `deal_monthly_actuals`, Roadmap Mode gains a feedback loop:
- At acquisition: roadmap produced with action list and expected impacts
- During hold: actuals tracked vs. each action's expected impact
- Quarterly: roadmap re-validated; actions falling behind get flagged
- At exit: roadmap actual vs. plan archived for future calibration

This is how the platform learns which actions actually work at the per-asset level.

### M14 Risk Scoring
Roadmap actions carry risk profiles. M14 ingests roadmap output to elevate risk score when:
- Roadmap relies on > 5 actions hitting P75 to achieve target
- Roadmap classified "achievable with stretch" or worse
- Specific actions with known high execution failure rates (e.g., management transition during lease-up)

### M25 JEDI Score
JEDI Score gains a new sub-score: **Roadmap Achievability**
- High: target return achievable with roadmap at action-level P50 execution
- Medium: requires P75 on multiple actions
- Low: requires overrides or not achievable
- Modulates overall JEDI Score downward when low

### Sensitivity Tab
Sensitivity tab today shows "if IRR is X, target achieved." Roadmap mode replaces this with action-level sensitivity:
- Per action: impact on IRR if action delivers at P25 vs P50 vs P75
- Tornado chart of action sensitivity, sorted by IRR impact magnitude
- "Which action is most fragile?" surfaces

---

## 8. UI RENDERING

### Roadmap tab in F9 (new F-key, likely F8 if available)

**Top section — Achievability banner:**
- Target return + classification (achievable / stretch / overrides required / not achievable)
- Baseline IRR vs Target IRR vs Roadmap-projected IRR
- Headline: "Achievable. Roadmap projects 14.8% IRR vs target 15%. Closes gap with 8 named actions over 5-year hold."

**Middle section — Year-by-year trajectory:**
- Stacked bar chart per year showing NOI lift by action
- Hover any bar segment → action details popup
- Posture color strip below chart (green/yellow/red per year)

**Lower section — Action list:**
- Ordered table: Timing | Action | Bucket | Expected $Lift | Confidence | Evidence button
- Click any action → side panel with evidence, archive cohort stats, cost profile, risks, dependencies
- Filter by bucket, by year, by confidence level

**Side panel — Comp Comparison (when applicable):**
- Reference comp summary (image, key stats, rent comparison)
- Observed differences (physical, operational, pricing) with attribution
- Replicability score
- Mapped roadmap actions that close each difference

---

## 9. BUILD PHASES

### Phase 1 — Core derivation engine (1 session)
- Implement baseline + target proforma generation
- Implement gap_analysis decomposition
- Implement action_inventory pull from initial library set (20 actions)
- Implement sequencing logic
- Implement reconciliation and achievability classification

### Phase 2 — Action Library (1 session)
- Build 20 initial library entries
- Implement library entry schema
- Wire evidence_query templates to archive
- Implement library-loading hooks for agent

### Phase 3 — UI rendering (1 session)
- Roadmap tab in F9
- Year-by-year trajectory visualization
- Action list table with evidence panels

### Phase 4 — Comp Comparison module (1 additional session)
- Implement comp difference detection
- Implement replicability classification
- Implement comp comparison rendering in side panel
- Auto-select reference comp logic (highest-rent comp in comp set, or user-specified)

### Phase 5 — M22 feedback loop (deferred, gated on M22)
- Track roadmap action actuals vs. expected
- Quarterly re-validation
- Library entry calibration from realized outcomes

---

## 10. ACCEPTANCE CRITERIA

The Roadmap Mode is V1-complete when:

1. Agent invocation with `mode: 'roadmap'` returns the full RoadmapOutput schema
2. Baseline and target Pro Forma both render in F9
3. Gap analysis decomposition is visible and decomposes total NOI gap into 6 named buckets
4. Action list contains at least 5 ordered actions for a typical value-add deal
5. Each action has populated evidence (archive cohort stats), timing, expected impact, cost, and dependencies
6. Year-by-year trajectory visualization renders with posture color strip
7. Achievability classification is computed and correct based on whether the roadmap closes the gap
8. M36 plausibility check is called on the target assumption set
9. For value-add deals, comp comparison module operates and produces replicability score
10. UI navigation between baseline, target, and roadmap views is fluid

---

## 11. ON CONSUMER FRAMING

This capability has a sharp product story. Today the user buys an underwriting model that confirms numbers. With Roadmap Mode, they buy:

> "An institutional-grade value creation plan, generated in 4 minutes, that says 'here are 8 specific actions in this order, with archive evidence on each, that get you from current state to 15% IRR. Three of these actions are heavily evidenced — your comparable assets achieved them. Two are aggressive and require execution discipline. The plan is achievable but tight; if you slip on actions 3 or 5, the deal is a 12% IRR instead.'"

This is what real estate has been missing: not better forecasting, but a delivery plan for the forecast. The model becomes a coach, not just a calculator.

---

## 12. OPEN QUESTIONS

### Q1: Action library curation governance
Who maintains the library? Hand-curated initially, calibrated from archive over time. As archive grows, do new actions get auto-added (clustering similar actions from actuals data)? Or stay hand-curated for quality?

**Recommendation:** hand-curated for v1. Auto-suggestion of new entries based on archive clustering in v2, with human approval gate.

### Q2: Comp comparison auto-selection
Which comp gets selected as the "reference comp" when user doesn't specify? Options:
- Highest-rent in comp set
- Highest NOI-yield in comp set
- Most similar physical specs with highest performance metric
- User explicitly chooses from a list

**Recommendation:** user explicitly chooses, with a curated "top 3 reference candidates" surfaced. Auto-selection feels presumptuous on a high-stakes analytical output.

### Q3: Roadmap freezing and audit
When a roadmap is generated, should it freeze as part of the deal record? If sponsor closes a deal on the basis of a roadmap, that roadmap is the operational contract. Subsequent re-runs may produce different roadmaps as platform learns.

**Recommendation:** roadmaps freeze at deal close. Subsequent quarterly re-runs (post-M22) produce *variance reports* against the frozen roadmap, not new roadmaps. New roadmap generation requires explicit user trigger and is timestamped distinctly.

### Q4: Single-action sensitivity vs roadmap-level sensitivity
Sensitivity analysis on individual actions (already specced in Section 7) vs. sensitivity on the full roadmap. Different views. Do we support both?

**Recommendation:** both. Action-level sensitivity surfaces fragile actions; roadmap-level sensitivity (e.g., "if I delay everything by 6 months due to market conditions") shows trajectory risk.

### Q5: Posture as a constraint on action selection
Posture framework excludes offense actions in defense years. But what about *forced* posture overrides? "I know it's defense year 1 but I want to launch RUBS anyway because the sponsor has done it during absorption windows before."

**Recommendation:** allow user override with explicit warning and require additional evidence reference. Don't make posture a hard block; make it a strong default with override possible.

# COMPETITIVE INTELLIGENCE ENGINE — PLATFORM-WIDE SPEC v1.0.1

**Status:** Draft v1.0.1 — reconciliation patch applied
**Owner:** Leon / JEDI RE
**Module designation:** M-prefixed (next available, suggest M37 or per current numbering)
**Purpose:** Establish the platform's archive-driven opportunity and risk detection engine that runs across every deal and surfaces findings the underwriting alone does not.

**Pairs with:**
- `proFormaMathEngine.ts` v1.1 (subject-side values are consumed from corrected snapshots)
- The platform's source residual convention (v1.1 or current), which defines residual source taxonomy and cohort filtering rules
- The Other Income reasoning method spec (current version) which covers the agent's per-method underwriting logic and the bidirectional integration with CIE via Method 5
- The canonical Cash Flow Agent system prompt — the current production version including analog cohort anchoring and posture-per-year reasoning. CIE runs as a separate post-pass and does not bloat the agent prompt. The agent prompt's Other Income reasoning section reads CIE findings from DealContext; no other agent-prompt changes are required for CIE integration.
- The Roadmap mode specification (when authored), which curates CIE findings into ordered action plans
- M22 Post-Close Intelligence (M22 actuals power capex estimates in findings)

---

## 1. PURPOSE

The platform's Cash Flow Agent produces an underwriting — a projected stabilized state. That answers "what does this deal look like as modeled."

It does not answer "what is this deal missing relative to comparable deals." A sponsor reviewing their own underwriting sees what they currently model. They don't see what other sponsors monetized on similar assets. They don't see fees they could be charging, expense categories they're overspending on, or refinancing opportunities sitting in their debt structure.

The Competitive Intelligence Engine (CIE) fills this gap. It runs as a separate post-pass after the agent's underwriting and compares the subject deal's state — both current and projected — against archive cohort distributions. Where the subject is materially out-of-distribution in a direction implying opportunity or risk, CIE produces a structured finding.

These findings are the value-creation visibility layer that distinguishes JEDI RE from individual deal review. A sponsor looking at their deal in isolation sees what they model. A sponsor looking at their deal against archive cohort sees what comparable deals have achieved or avoided. That second view is the strategic intelligence the platform's positioning promises.

---

## 2. ARCHITECTURE — SEPARATE POST-PASS

CIE runs after the Cash Flow Agent's `cashflowPostProcess` completes. Sequencing:

```
1. Cash Flow Agent run → produces output.proforma_fields
2. cashflowPostProcess:
   2a. evidence normalization (existing)
   2b. math engine validation/correction (existing)
   2c. CIE pass (NEW)
3. Snapshot persisted with both proforma_fields and ci_findings
```

The CIE pass:
1. Reads the corrected snapshot (subject's current state + agent's stabilized projection)
2. For each of the ~25-30 finding types, queries archive cohort and computes the comparison
3. Produces structured findings, ranked by severity and impact
4. Writes findings to `deal_underwriting_snapshots.ci_findings` (JSONB array)
5. Surfaces high-severity findings to the F9 Pro Forma and Deal Capsule alert systems

**Why separate post-pass instead of agent-integrated:**
- Agent prompt stays focused on producing the projection
- Engine has access to BOTH current state AND projected stabilized state for comparison
- Findings persist independently of agent re-runs
- Engine can compare against cohort at multiple points (acquisition vs stabilization, year-by-year)
- Findings are durable artifacts the sponsor interacts with over the deal lifecycle (accept/decline/defer)

---

## 3. UNIVERSAL FINDING SHAPE

Every finding, regardless of domain or type, conforms to this shape:

```typescript
export interface CompetitiveIntelligenceFinding {
  finding_id: string;       // see Section 3.1 below for composition rule
  deal_id: string;
  run_id: string;
  created_at: string;

  // Classification
  domain: 'revenue' | 'opex' | 'capex' | 'debt' | 'operating' | 'exit';
  finding_type: string;                          // e.g. 'missing_ancillary_category'
  severity: 'opportunity_major' | 'opportunity_minor' | 'risk_major' | 'risk_minor' | 'informational';

  // Subject state (what the deal currently is or projects)
  subject: {
    field_path: string;                          // canonical Pro Forma path
    current_value: number | null;                // null when "missing X" finding
    projected_value: number | null;              // agent's stabilized projection
    current_state_description: string;
  };

  // Cohort comparison
  cohort: {
    cohort_query_params: {
      asset_class: string;
      vintage_band: [number, number];
      submarket_match_level: 'exact_submarket' | 'msa_class' | 'broader';
      unit_count_band: [number, number];
      strategy_match: string;                    // 'value_add', 'stabilized', etc.
    };
    cohort_n: number;
    cohort_match_quality: 'high' | 'medium' | 'low';
    distribution: {
      p10: number;
      p25: number;
      p50: number;
      p75: number;
      p90: number;
    };
    presence_pct?: number;                        // for "missing X" findings: % of cohort that has this category
    achievement_realized?: {                      // from fetch_archive_achievement_vs_assumption when available
      p25: number;
      p50: number;
      p75: number;
    };
  };

  // The finding itself
  finding: {
    direction: 'subject_below_cohort' | 'subject_above_cohort' | 'subject_missing' | 'subject_unique' | 'subject_at_extreme';
    gap_magnitude: number;
    gap_significance: 'within_p25_p75' | 'at_p10_p90_band' | 'outside_p10_p90' | 'unique_to_subject';
  };

  // Action characterization
  action: {
    type: 'operational' | 'capex' | 'financial' | 'strategic';
    estimated_annual_impact: number;              // signed: positive = revenue lift or expense save
    estimated_capex_required: number;             // 0 for operational
    estimated_payback_months: number | null;      // null when capex = 0 (immediate)
    implementation_difficulty: 'low' | 'medium' | 'high';
    capex_source: 'm22_actuals' | 'archive_cohort_typical' | 'estimated' | 'not_applicable';
    capex_evidence: string;
  };

  // Evidence and rationale
  evidence_narrative: string;
  comparable_deals_referenced: string[];          // deal IDs from cohort with achievement data
  confidence: 'high' | 'medium' | 'low';
  confidence_rationale: string;

  // Sponsor interaction state
  sponsor_state: 'unreviewed' | 'accepted' | 'declined' | 'deferred';
  sponsor_reason?: string;                        // populated on decline
  sponsor_action_taken?: string;                  // populated on accept (e.g., "pulled into proforma year 2")
  sponsor_reviewed_at?: string;
}
```

### 3.1 finding_id composition

`finding_id` is a deterministic string composed from three components:

```typescript
function computeFindingId(
  deal_id: string,
  finding_type: string,
  field_path: string,
): string {
  return `${deal_id}:${finding_type}:${field_path}`;
}
```

This composition guarantees that:

1. **Same finding across runs has the same id.** Re-running CIE on the same deal produces the same `finding_id` for the same `(finding_type, field_path)` combination. The persistence layer upserts rather than inserts.

2. **Sponsor state persists.** When a sponsor accepts, declines, or defers a finding, that state is keyed to the `finding_id`. Re-runs update the row's findings data (current values, cohort comparison) without disturbing the `sponsor_state`, `sponsor_reason`, or `sponsor_reviewed_at` fields.

3. **Cross-deal uniqueness.** Different deals produce different `finding_id`s even for the same `finding_type` and `field_path`. Findings are scoped to their deal.

**Composite field paths for findings spanning multiple fields:**

Some findings span multiple fields (e.g., a `term_structure_mismatch` debt finding spans loan type, rate, term, and prepayment penalty). For these, use a synthetic composite `field_path`:

| Finding type | Composite field_path |
|---|---|
| `term_structure_mismatch` | `loan_terms.composite` |
| `disposition_channel_mismatch` | `exit_strategy.composite` |
| `staffing_model_mismatch` | `operating_model.staffing_composite` |
| `compliance_program_gap` | `operating_model.compliance_composite` |

The composite suffix (`.composite` or `.{aspect}_composite`) makes the synthetic path visually distinct from real field paths. Composite paths are documented in each finding type's library entry.

**Database upsert pattern:**

```sql
INSERT INTO deal_underwriting_snapshots_ci_findings (...)
VALUES (...)
ON CONFLICT (finding_id) DO UPDATE
SET
  subject = EXCLUDED.subject,
  cohort = EXCLUDED.cohort,
  finding = EXCLUDED.finding,
  action = EXCLUDED.action,
  evidence_narrative = EXCLUDED.evidence_narrative,
  confidence = EXCLUDED.confidence,
  -- DO NOT overwrite sponsor_state, sponsor_reason, sponsor_reviewed_at
  -- DO NOT overwrite sponsor_action_taken
  updated_at = NOW();
```

The upsert preserves sponsor decision state across re-runs. The finding's analytical content (current values, cohort comparison, action estimates) refreshes; the sponsor's relationship to the finding persists.

---

## 4. SIX DOMAINS WITH FINDING TYPE LIBRARIES

Each domain has a defined set of finding types. The library can grow over time; v1.0 ships with the high-value subset.

### 4.1 Revenue domain

| Finding Type | Trigger | Direction | Typical Action Type |
|---|---|---|---|
| `missing_ancillary_category` | Cohort presence ≥ 50% on category; subject has none | subject_missing | capex or operational |
| `underpriced_ancillary_fee` | Subject rate < cohort P25; gap > $10/unit/mo | subject_below_cohort | operational |
| `low_ancillary_adoption_rate` | Subject adoption < cohort P25; gap > 20 ppt | subject_below_cohort | operational |
| `persistent_loss_to_lease` | Subject loss-to-lease > cohort P75 by > 200 bps | subject_above_cohort | operational |
| `excess_concession_structure` | Subject concession days > cohort P75 by > 0.5 months | subject_above_cohort | operational |
| `vacancy_persistence` | Subject vacancy > cohort P75 controlling for class/vintage/submarket | subject_above_cohort | operational |
| `rent_growth_lag` | Subject TTM rent growth < cohort TTM growth by > 200 bps | subject_below_cohort | operational |

### 4.2 OpEx domain

| Finding Type | Trigger | Direction | Typical Action Type |
|---|---|---|---|
| `expense_category_overspend` | Subject category per-unit > cohort P75 | subject_above_cohort | operational |
| `expense_category_underspend` | Subject category per-unit < cohort P25 | subject_below_cohort | operational (risk: deferred maintenance) |
| `vendor_cost_anomaly` | Specific vendor categories (contract services, landscaping, security) at cohort P85+ | subject_above_cohort | operational (bid opportunity) |
| `payroll_structure_inefficiency` | Subject payroll per unit > cohort P75 controlling for unit count, amenity level, class | subject_above_cohort | operational |
| `utility_cost_anomaly` | Specific utility line (electric common, water, gas) at cohort P85+ | subject_above_cohort | capex (efficiency upgrade) |
| `insurance_overpayment` | Subject insurance per unit > cohort P75 for same submarket/class/vintage | subject_above_cohort | operational (re-bid) |
| `management_fee_premium` | Subject mgmt fee % > cohort P75 for similar size/sponsor structure | subject_above_cohort | strategic (renegotiate) |
| `tax_assessment_anomaly` | Subject effective tax rate > cohort P75 for similar jurisdiction/value | subject_above_cohort | strategic (appeal) |

### 4.3 Capex domain

| Finding Type | Trigger | Direction | Typical Action Type |
|---|---|---|---|
| `underinvested_system` | Subject capex on specific system (roof, HVAC, plumbing) < cohort P25 for vintage | subject_below_cohort | risk (future expense) |
| `excess_renovation_scope` | Subject per-unit renovation > cohort P75 without amenity/class justification | subject_above_cohort | strategic (scope review) |
| `missing_modernization` | Cohort norm includes specific amenity overhaul (e.g., package room, smart home); subject doesn't | subject_missing | capex |
| `reserve_inadequacy` | Subject reserves per unit < cohort P25 for vintage and condition | subject_below_cohort | risk |
| `scope_phasing_mismatch` | Subject phases differ materially from cohort phasing for same scope | subject_unique | strategic |

### 4.4 Debt domain

| Finding Type | Trigger | Direction | Typical Action Type |
|---|---|---|---|
| `rate_inefficiency` | Subject all-in rate > cohort P75 for similar LTV/DSCR/term | subject_above_cohort | financial (refi opportunity) |
| `term_structure_mismatch` | Subject debt type (floating/fixed) inverted from cohort norm in current rate env | subject_unique | strategic |
| `prepayment_penalty_trap` | Subject prepayment structure more restrictive than cohort P75 | subject_above_cohort | strategic |
| `ltv_below_norm` | Subject LTV < cohort P25 for similar strategy/sponsor | subject_below_cohort | financial (recap opportunity) |
| `dscr_below_norm` | Subject DSCR > cohort P75 implies under-leverage | subject_above_cohort | financial |

### 4.5 Operating model domain

| Finding Type | Trigger | Direction | Typical Action Type |
|---|---|---|---|
| `staffing_model_mismatch` | Subject FTE/unit ratio different from cohort by > 25% | subject_unique | operational |
| `software_stack_obsolescence` | Subject uses property management software cohort migrated away from | subject_unique | operational |
| `compliance_program_gap` | Cohort norm includes specific compliance program (e.g., Fair Housing audit cadence); subject doesn't | subject_missing | strategic |

### 4.6 Exit domain

| Finding Type | Trigger | Direction | Typical Action Type |
|---|---|---|---|
| `hold_period_misalignment` | Subject planned hold differs from cohort median by > 18 months | subject_unique | strategic |
| `exit_cap_assumption_gap` | Subject's underwritten exit cap outside cohort P10-P90 for similar product at projected exit date | subject_at_extreme | strategic |
| `disposition_channel_mismatch` | Cohort disposed via specific channel (1031 buyer pool, institutional, syndication); subject planning different | subject_unique | strategic |
| `cap_rate_compression_overconfidence` | Subject assumes cap rate compression beyond cohort realized achievement | subject_at_extreme | risk |

---

## 5. SEVERITY CLASSIFICATION

Severity is computed deterministically per finding, not subjectively. The rules:

```typescript
function classifySeverity(
  finding: CIFinding,
): 'opportunity_major' | 'opportunity_minor' | 'risk_major' | 'risk_minor' | 'informational' {

  const annualImpact = Math.abs(finding.action.estimated_annual_impact);
  const direction = finding.finding.direction;
  const gapSignificance = finding.finding.gap_significance;

  // Direction determines opportunity vs risk
  const isOpportunity = (
    (direction === 'subject_missing' && finding.action.estimated_annual_impact > 0) ||
    (direction === 'subject_below_cohort' && finding.domain === 'revenue') ||
    (direction === 'subject_above_cohort' && finding.domain === 'opex') ||
    (direction === 'subject_above_cohort' && finding.domain === 'debt') ||
    (direction === 'subject_below_cohort' && finding.domain === 'debt' && finding.finding_type === 'ltv_below_norm')
  );

  const isRisk = (
    (direction === 'subject_below_cohort' && finding.domain === 'capex' && finding.finding_type === 'underinvested_system') ||
    (direction === 'subject_below_cohort' && finding.domain === 'opex' && finding.finding_type === 'expense_category_underspend') ||
    (direction === 'subject_at_extreme' && finding.domain === 'exit') ||
    (finding.finding_type === 'reserve_inadequacy')
  );

  if (isOpportunity) {
    if (annualImpact >= 50000 && gapSignificance !== 'within_p25_p75') return 'opportunity_major';
    if (annualImpact >= 15000) return 'opportunity_minor';
    return 'informational';
  }

  if (isRisk) {
    if (gapSignificance === 'outside_p10_p90' || annualImpact >= 50000) return 'risk_major';
    if (gapSignificance === 'at_p10_p90_band' || annualImpact >= 15000) return 'risk_minor';
    return 'informational';
  }

  return 'informational';
}
```

Severity thresholds:
- **Major**: ≥ $50k annual impact OR outside cohort P10-P90
- **Minor**: ≥ $15k annual impact OR at cohort P10-P90 band
- **Informational**: below thresholds; surfaced in detail view but not in alert summary

These thresholds are property-size-aware. The cleaner implementation reads thresholds per cohort size — a small property might have $15k thresholds, a large property $100k thresholds. v1.0 ships with absolute thresholds; v2.0 makes them adaptive.

---

## 6. COHORT QUERY AND FILTERING

The CIE uses `fetch_archive_assumption_distribution` (existing) with strict comparable filtering rules consistent with the line-item investigation matrix.

### Filtering rules (per cohort query)

Required matches:
- Asset class (Class A, B, C — strict)
- Strategy type (acquisition_valueadd, acquisition_stabilized, development, redevelopment, lease_up)
- Vintage band: within ±10 years of subject (broaden to ±15 if n < 8)
- Submarket: same submarket required; broaden to MSA-class if n < 8

Soft preferred:
- Unit count band: ±50% of subject
- Hold period stage: at least 24 months post-acquisition for achievement data
- Operator scale band (sponsor portfolio size): within 0.5x to 2x subject's sponsor

Cohort confidence levels:
- **High** confidence: all required matches plus all soft preferred matches, n ≥ 8
- **Medium** confidence: all required matches, at least one soft preferred match, n ≥ 5
- **Low** confidence: required matches only, n ≥ 3 (broadening documented)

If n < 3 even after broadening, CIE does not produce a finding for that field. The cohort is too sparse to be meaningful.

### Source filtering — exclude residuals

Per the Source Residual Convention v1.1, cohort distributions exclude residual-derived values. The query filters on source types ending in `_residual`, `_uncategorized`, `_unreconciled`. This prevents the cohort from being polluted with platform-inferred values masquerading as broker assertions.

### Filtering for present-state vs achievement-state

Cohort comparisons can target two different time points:
- **Present-state cohort**: comparable deals at acquisition state — used to detect current-state gaps (e.g., "subject has no RUBS; 78% of comparable acquisition-state deals have RUBS")
- **Achievement-state cohort**: comparable deals at stabilization post-implementation — used to detect projection gaps (e.g., "subject projects Pet income at $8/unit/mo by Y3; cohort achieved $22 at similar stabilization point")

The finding's `cohort.achievement_realized` field is populated when achievement-state cohort data is available. This is what powers the "comparable deals actually achieved X" overlay.

---

## 7. ACTION CHARACTERIZATION

Each finding includes an `action` object with implementation estimates. Capex sourcing is the hardest part.

### 7.1 Capex sourcing — priority order with graceful degradation

For each finding requiring a capex estimate, the engine consults sources in priority order. The chain **degrades gracefully** — if a higher-priority source returns null for the relevant comparable, the chain falls through to the next source automatically. No flag flip or feature toggle is required.

**Priority chain:**

1. **M22 actuals (priority #1).** When `deal_monthly_actuals` has data for comparable deals that recently implemented the same change, M22 returns the actual capex spend per category. Highest fidelity.

2. **Archive cohort typical (priority #2).** When M22 returns null (no comparable M22 actuals exist yet, or M22 isn't populated for this category), the chain falls through to archive cohort. Returns median capex per category per unit count across archive deals where the change was implemented.

3. **Estimated by category (priority #3).** When both M22 and archive cohort return null (rare — usually a brand-new finding type), the chain falls through to platform default estimates. Each finding type carries a default capex range in its library entry.

**Phase 1 behavior — what to expect when M22 has no data:**

At Phase 1 of the CIE rollout, M22 (`deal_monthly_actuals` table) is not yet fully populated for most finding types. The capex chain behaves as follows:

- M22 returns null → chain falls through to archive cohort
- Archive cohort returns data → finding gets capex estimate from cohort
- Finding's `capex_source` field is set to `'archive_cohort_typical'`
- Confidence is medium (typical for cohort-sourced estimates)

This is the **default expected behavior at Phase 1**. The CIE Phase 1 build is NOT blocked on M22 readiness. M22 is consulted, returns null, chain proceeds. The implementer does NOT need to wire a flag, feature toggle, or conditional — the priority chain's null handling does the right thing automatically.

**Phase 5 behavior — what improves when M22 matures:**

As M22 actuals accumulate over time, more findings get sourced from priority #1 (M22 actuals) instead of priority #2 (archive cohort). The `capex_source` field shifts from `'archive_cohort_typical'` to `'m22_actuals'` for those findings. Confidence rises from medium to high. This shift happens automatically per the priority chain — no CIE-side code change is required.

Capex source is recorded on the finding so sponsors can see the basis. M22-sourced findings carry higher confidence; estimated findings carry lower confidence.

### Operational findings — no capex

Operational findings (repricing, adoption rate tightening, vendor renegotiation, staffing) have `capex_required: 0` and `payback_months: null`. They surface with implementation difficulty rather than payback. Examples:

- "Pet rent at $18 vs cohort P50 of $32 — operational difficulty: low (one-time rate change on lease renewal)"
- "Contract services at cohort P85 — operational difficulty: medium (vendor bid process, 60-90 days)"

### Annual impact computation

For each finding:
- **Missing category**: `revenue at cohort P50 adoption × cohort P50 rate × applicable units × 12`
- **Underpriced fee**: `(cohort P50 rate - current rate) × current adoption × applicable units × 12`
- **Low adoption**: `current rate × (cohort P50 adoption - current adoption) × applicable units × 12`
- **Expense overspend**: `(current per-unit spend - cohort P50 per-unit spend) × unit count × 12` (signed positive = savings opportunity)
- **Refi opportunity**: `current annual interest - projected annual interest at cohort rate`
- Etc.

Each impact calculation is deterministic given the cohort data. No "judgment call" estimates.

---

## 8. SPONSOR INTERACTION MODEL

CIE findings are durable artifacts. Sponsors interact with each one through a defined lifecycle:

### Lifecycle states

1. **`unreviewed`** — finding just produced, awaiting sponsor attention
2. **`accepted`** — sponsor agrees with the opportunity; takes action
3. **`declined`** — sponsor disagrees or chooses not to pursue
4. **`deferred`** — sponsor acknowledges but defers to later decision

### Decline reason capture

Declined findings require a reason. Categorized for platform learning:

- `not_in_scope` — the action is real but outside the deal's strategy
- `brand_inconsistent` — the platform's typical action conflicts with sponsor's brand or operating model
- `tried_before` — sponsor has tried this and it didn't work for this submarket/asset
- `cohort_match_wrong` — sponsor disputes the cohort comparison
- `capex_too_high` — the implementation cost exceeds the sponsor's tolerance even with positive payback
- `other` — sponsor explains in free text

These decline reasons feed back into CIE's calibration. If a specific finding type is declined for "tried_before" by multiple sponsors in similar submarkets, the platform should adjust how aggressively it surfaces that finding type.

### Accept → action linkage

Accepted findings link to a downstream action — typically a Pro Forma adjustment or a Roadmap item:

- Accept "missing RUBS" → adds RUBS to the proforma stabilized year breakdown with appropriate capex schedule
- Accept "underpriced pet rent" → adjusts pet rent assumption in the Pro Forma
- Accept "refi opportunity" → adds refi action to Roadmap with timing

The Pro Forma adjustment is automatic when accepted. The sponsor reviews the resulting Pro Forma change and confirms or refines.

### Defer with timing

Deferred findings carry an optional timing target:
- `defer_until_year_2` — pulled into Roadmap action at Y2
- `defer_until_refi` — pulled when refi decision arises
- `defer_until_lease_up_complete` — sequence-dependent

Deferred findings re-surface when their timing condition is met.

---

## 9. UI SURFACING

CIE findings appear in three surfaces:

### 9.1 Pro Forma surface — opportunity panel per line item

Below each Pro Forma line item, a collapsible panel shows findings related to that line item:

```
NET OPERATING INCOME  $2,021,935
└─ Opportunities (3)
    ├─ 🟢 Missing RUBS (+$67,200/yr, capex $278,400, payback 49 mo)  [Review]
    ├─ 🟡 Underpriced Pet rent (+$18,400/yr, operational)             [Review]
    └─ 🔴 Contract Services overspend (-$24,500/yr, operational)      [Review]
```

Click "Review" opens the finding's detail panel with cohort distribution chart, comparable deals referenced, action characterization, and accept/decline/defer buttons.

### 9.2 Deal Capsule — opportunity dashboard

A new tab on the Deal Capsule: **"Opportunities"** — shows all findings ranked by severity and impact. Filters by domain, severity, action type. The strategic overview.

The Opportunities tab is what the sponsor reviews periodically as the deal progresses. New findings can appear over time as:
- M22 actuals reveal new comparable benchmarks
- Archive cohort grows
- Market conditions change (e.g., refi opportunity emerges with rate compression)

### 9.3 F9 Pro Forma evidence drawer — comparable overlay

When the sponsor opens the evidence drawer on any Pro Forma cell, the drawer includes a "Comparable deals" section showing cohort distribution and what comparable deals achieved. This is CIE data surfaced contextually, not as separate findings but as ambient intelligence in the evidence experience.

---

## 10. INTEGRATION WITH ROADMAP MODE

CIE findings are the universal action library for Roadmap.

When the sponsor invokes Roadmap mode and specifies a target return (e.g., "I need 18% IRR"), the Roadmap engine:

1. Queries all CIE findings for the deal
2. Filters to findings in `unreviewed` or `accepted` state
3. Ranks by impact ÷ payback × confidence × implementation feasibility
4. Sequences into an ordered action plan respecting timing constraints (e.g., refi action requires existing debt term completion)
5. Computes projected IRR at each step
6. Stops at the action that brings projected IRR ≥ target

The Roadmap doesn't generate actions independently. It curates CIE's findings into a sequence. This means:
- CIE coverage determines Roadmap capability
- Adding new finding types to CIE expands Roadmap's library automatically
- Sponsor decline patterns on CIE findings inform Roadmap sequencing (declined findings drop out)

This is the symbiotic architecture: CIE detects, Roadmap orchestrates. Each is meaningful independently; together they're the value-creation engine.

---

## 11. IMPLEMENTATION PHASES

### Phase 1 — Framework (3-4 sessions)
- Universal finding shape and database schema
- Severity classification function
- Cohort query and filtering logic (uses existing `fetch_archive_assumption_distribution`)
- Capex sourcing priority chain (M22 → archive cohort → estimated)
- Annual impact computation per finding type
- CI pass invocation in `cashflowPostProcess` (the new step 2c)
- Persistence of `ci_findings` JSONB on snapshots

### Phase 2 — High-value finding types (3-5 sessions)
Ship Phase 2 in two waves:

**Wave A — Revenue and OpEx (1 session per domain, 2 sessions total):**
- All 7 revenue finding types
- All 8 opex finding types

**Wave B — Capex, Debt, Operating, Exit (1 session per domain pair):**
- Capex finding types (5)
- Debt finding types (5)
- Operating finding types (3)
- Exit finding types (4)

Total: ~25-30 finding types across 5 build sessions. Each session validates its findings against a known deal where the answer is independently verifiable.

### Phase 3 — UI surfacing (2 sessions)
- Pro Forma opportunity panels per line item
- Deal Capsule Opportunities tab
- Evidence drawer comparable overlay
- Sponsor interaction model (accept/decline/defer with reason capture)

### Phase 4 — Roadmap integration (3 sessions)
- Roadmap engine reads from CI findings
- Sequencing logic
- IRR projection per step
- Target return optimization
- Roadmap UI

### Phase 5 — Calibration loop (ongoing, no explicit build)

This is not a discrete build phase but an ongoing behavior of the system. Three calibration dynamics operate automatically:

1. **Sponsor decline pattern feedback.** When specific finding types accumulate decline reasons (e.g., `not_in_scope` for missing-amenity findings on Class C deals), CIE's severity classification thresholds adjust to surface those findings less aggressively for similar deals in the future. This adjustment is data-driven and requires no manual threshold tuning.

2. **M22 capex sourcing maturation.** As M22 (`deal_monthly_actuals`) accumulates comparable deals' actual implementation spend, more findings shift their `capex_source` from `archive_cohort_typical` to `m22_actuals`. This is automatic per the priority chain (Section 7.1); no code change required.

3. **Cohort growth.** As the platform processes more deals, archive cohort distributions improve their statistical power. Findings that previously carried medium confidence due to thin cohort (n = 4–7) shift to high confidence as cohort matches grow (n ≥ 8).

Phase 5 is the ambient calibration the platform performs as it operates. It does not gate Phase 1, 2, 3, or 4 readiness. The CIE is fully functional from Phase 1 with cohort-sourced capex and medium confidence; Phase 5's improvements are progressive enhancements over time.

Total: 8-10 focused sessions for full v1.0 platform-wide CIE. Phase 1 + Wave A of Phase 2 + Phase 3 is the minimum viable ship (5-7 sessions); Roadmap depends on enough finding types existing to be useful, so Wave B and Phase 4 follow.

---

## 12. ACCEPTANCE CRITERIA — v1.0 MVP

1. CI pass invoked in `cashflowPostProcess` after math engine correction
2. Universal finding shape persisted as JSONB on `deal_underwriting_snapshots`
3. Severity classification deterministic and tested
4. Cohort query honors source residual filtering and comparable filtering rules
5. Capex sourcing priority chain implemented (M22 → archive → estimated)
6. At least 15 finding types implemented across revenue and opex domains
7. Pro Forma opportunity panels render for line items with findings
8. Deal Capsule Opportunities tab renders all findings with filter and sort
9. Sponsor accept/decline/defer with reason capture wired end-to-end
10. Accepted "missing category" finding automatically adjusts Pro Forma stabilized year
11. On 464 Bishop test run, CIE produces at least 5 findings consistent with the deal's actual state
12. No regression on existing cashflow agent behavior or math engine validation

---

## 13. CONNECTION TO PRIOR SPECS

CIE composes with every existing platform convention:

- **Math engine v1.1** (`proFormaMathEngine.ts`): CIE reads from corrected snapshots; never operates on uncorrected raw agent output
- **Source residual convention (v1.1 or current)**, which defines residual source taxonomy and cohort filtering rules: CIE cohort queries exclude residual sources; findings about residual fields are surfaced with that context
- **Other Income reasoning method spec (current version)**, which covers the agent's per-method underwriting logic and the bidirectional integration with CIE via Method 5: CIE supersedes Method 5 as standalone archive-cohort projection; the Other Income spec's Section 2.5 documents the active CIE consumption path; Section 6.3 documents bidirectional integration
- **Floor-plan grid (UI v1.2)**: CIE findings on per-floor-plan rents flow through the grid's evidence pills
- **Canonical Cash Flow Agent system prompt** (current production version): agent prompt does not need to know about CIE; engine runs post-pass, agent stays focused on projection; no agent-prompt changes required for CIE integration
- **Line-item investigation matrix Pass 1**: each cell's "Common Pitfalls" section can reference relevant CIE findings as the platform-level safety net

This is the pattern: CIE consumes the platform's existing intelligence and produces actionable findings on top. It doesn't replace anything; it adds a strategic visibility layer.

---

## 14. STRATEGIC POSITIONING

The platform-wide CIE is what makes the JEDI RE thesis ("treat properties like financial instruments with peer comparison") operational. Without CIE:

- Sponsors see their own underwriting
- Comparison is implicit, manual, dependent on the sponsor's own analytical depth
- The platform produces projections but doesn't surface opportunities the projections miss

With CIE:

- Every deal has a structured opportunity inventory
- The inventory grows over time as M22 actuals and archive cohort deepen
- Sponsors operate from a curated action library, not their own memory
- LP committees see findings explicitly characterized as opportunities accepted, declined, or deferred — a defensible audit trail of value-creation reasoning
- The platform becomes the institutional memory of "what comparable sponsors did on similar deals"

This is the layer that distinguishes JEDI RE from spreadsheet underwriting plus broker network. Individual sponsors have limited memory and limited peer visibility. The platform has the archive. CIE surfaces that asymmetry as actionable opportunity.

### Note on cross-references in this spec

References to other platform specs use behavioral descriptions rather than filenames where possible. This makes references durable across filename consolidation, version bumps, and document renaming. References to code files (`.ts`, `.tsx`) use filenames because code has specific import paths that are contractual.

When implementing the CIE, follow the spec by behavior, not by hunting for specific filenames. If a referenced behavior isn't in the file you expect, search for the behavior — it may have been consolidated or moved.

---

## 15. OPEN QUESTIONS

### Q1: How frequently does CIE re-run?
On every agent run? On a daily cron? On sponsor request? Findings can become stale as market conditions change.

**Recommendation:** re-run on every agent run (since it's part of postProcess). Additionally, a daily cron re-runs CIE for deals where market conditions have shifted (rate change, comp set update, M22 actuals new).

### Q2: How does CIE handle sponsor portfolio context?
A finding "implement RUBS" may be correct cohort-wise but inconsistent with the sponsor's stated brand strategy. CIE should be able to filter findings by sponsor preferences.

**Recommendation:** sponsor profile carries flags like `avoids_rubs`, `avoids_pet_fees`, `preferred_renovation_scope_tier`. CIE filters findings against these. Surfaced as "filtered out per sponsor preference" so the operator can audit.

### Q3: How are findings de-duplicated across re-runs?
If CIE produces "missing RUBS" on run 1 and the sponsor declines it, then CIE re-runs — does it produce the finding again?

**Recommendation:** findings persist with stable `finding_id` based on `deal_id + finding_type + field_path`. Re-runs update existing findings rather than creating new ones. Sponsor's decline state persists across runs.

### Q4: M22 actuals — when does CIE start using them?
M22 is gated on `deal_monthly_actuals` table being populated. Until M22 has depth, CIE uses archive cohort fallback.

**Recommendation:** CIE works fully without M22 — archive cohort is sufficient for v1.0. M22 integration is a Phase 5 enhancement that improves capex sourcing confidence.

### Q5: Multi-property portfolio findings?
A sponsor's portfolio of 12 deals might have findings that are coherent across deals (e.g., 8 of 12 properties missing RUBS — portfolio-wide opportunity).

**Recommendation:** v1.0 is per-deal. Portfolio aggregation is v2.0 — a separate "Portfolio Opportunities" view that aggregates findings across the sponsor's deals.

---

## 16. CHANGELOG

**v1.0.1 (current)**
- Filename references replaced with behavioral descriptions for all doc references (code file references unchanged)
- `finding_id` composition defined explicitly (`deal_id:finding_type:field_path`) in new Section 3.1
- Composite `field_path` values defined for findings spanning multiple fields
- Database upsert pattern specified with `sponsor_state` preservation
- M22 graceful degradation clarified in Section 7.1 — priority chain handles null fallback automatically; CIE Phase 1 is NOT blocked on M22 readiness
- Phase 5 description reframed as ongoing ambient calibration rather than discrete build phase
- Cross-reference note added to Section 14

**v1.0**
- Initial draft — six domains, universal finding shape, severity classification, cohort query rules, sponsor interaction model, Roadmap integration, implementation phases

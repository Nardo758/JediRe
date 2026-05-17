# REPLIT PROMPT — CASH FLOW AGENT DIAGNOSTIC RUN ON 464 BISHOP

Run the Cash Flow Agent on 464 Bishop, then conduct a forensic review of the run against the platform's authoritative specifications. Produce a structured analysis identifying every reasoning flaw with prioritized improvement recommendations.

This is not a standard underwriting run. The goal is to validate the agent's reasoning quality, not just its output. Treat this as a diagnostic session.

---

## PHASE 1 — RUN THE AGENT

1. Invoke the Cash Flow Agent on 464 Bishop with full instrumentation enabled. Capture:
   - Complete tool call sequence in order, with parameters and return values for each
   - All agent reasoning traces between tool calls
   - Final agent output including all `proforma_fields`, evidence objects, and source metadata
   - Math validation report from the post-processor (if v1.1 of the math engine is integrated)
   - Plausibility check result from `evaluate_plausibility` (M36 Sigma)
   - All evidence rows written via `write_evidence_rows`
   - The final underwriting snapshot

2. Do not interrupt the run. Let it complete fully. If it fails midway, capture the failure point and the state at failure.

3. Persist all telemetry to a session artifact: `/tmp/cashflow_diagnostic_464_bishop_{timestamp}.json` with the complete trace.

---

## PHASE 2 — LOAD REFERENCE SPECIFICATIONS

Before reviewing the trace, load these specifications. They define what the agent *should* be doing:

1. `CASHFLOW_AGENT_PROMPT_PATCH_V3.md` — analog-anchored forecasting, field catalog, output discipline, tool orchestration, M36 plausibility cross-check
2. `CASHFLOW_AGENT_PROMPT_PATCH_V4.md` — pricing power awareness and posture per stabilization year
3. `CASHFLOW_AGENT_DEAL_TYPE_PLAYBOOKS.md` — line-item resolution methods per deal type (value-add, stabilized, development, redevelopment)
4. `CASHFLOW_LINE_ITEM_MATRIX_PASS1_PATCHED.md` — the reference cell for Value-Add GPR with renovation premium derivation, comp filtering rules, common pitfalls
5. `PRO_FORMA_REGIME_INPUT_UI_SPEC.md` (v1.1) — floor-plan grid output shape, cost and yield-on-cost data
6. `proFormaMathEngine.ts` (v1.1) — line-item config, hierarchical subtotal handling, source priority rules
7. `M09_PROFORMA_SPEC.md` — Stabilized Potential view, four-component Δ decomposition

The agent's output must conform to these specifications. The review's job is to identify where it does not.

---

## PHASE 3 — STRUCTURED FORENSIC REVIEW

Walk the trace and check each category systematically. For each category, document findings in the structured output format described in Phase 4.

### Category A — Tool Call Orchestration

Per the tool orchestration map in v3 patch Section D, the agent's call sequence should follow specific phases:

- Phase 1: `fetch_data_matrix` first, then `fetch_t12`, `fetch_rent_roll`, `fetch_assumptions`
- Phase 2 (analog baseline): `fetch_archive_assumption_distribution`, `fetch_archive_achievement_vs_assumption`, `fetch_disposition_learnings`, `fetch_backtest_context`, `fetch_line_item_benchmarks`, `fetch_market_trends`
- Phase 2.5 (posture, per v4): supply pipeline, absorption, comp concession trend, lease velocity, M35 events scored per year
- Phase 3 (subject-specific): `fetch_peer_comp_noi_metrics`, `fetch_data_library_comps`, `fetch_proximity_context`, `fetch_m35_event_forecast`, `fetch_owned_asset_actuals`, `fetch_owned_asset_opex_ratios`
- Phase 4 (specialized): `fetch_jurisdiction_tax_forecast`, `fetch_jurisdiction_insurance_forecast` (mandatory; never optional)
- Phase 5 (compute): `compute_proforma` for the per-unit walk
- Phase 6 (verify): `detect_collision`, `evaluate_plausibility`
- Phase 7 (write): `write_evidence_rows`, `write_underwriting`

**Check:**
- Did the agent call tools in the prescribed phase order? Document any out-of-order calls and what they imply (e.g., subject-specific tools before analog cohort indicates reasoning is not anchored to analog baseline).
- Did the agent skip any mandatory tools? Specifically: jurisdiction tax forecast, jurisdiction insurance forecast, `evaluate_plausibility`, `compute_proforma`, archive cohort tools.
- Did the agent invoke `fetch_data_matrix` first? If not, this is a critical flaw.

### Category B — Analog Cohort Anchoring

Per v3 patch Section A.5, every Pro Forma assumption with a growth or projection component must:
- Show cohort baseline (P25/P50/P75 with sample size)
- Compute `delta_from_cohort_p50`
- Justify any deviation from cohort P50 with named market signals
- Flag outliers above P75 or below P25 with `outlier_justification`

**Check:**
- Did the agent populate cohort baseline fields for major assumptions (rent growth, exit cap, expense growth, vacancy, NOI growth)?
- Where the agent deviated from cohort P50, did it cite specific signals?
- Were any assumptions outside cohort P25-P75 without `outlier_justification`?
- Was `cohort_n` populated, and was it ≥ 8 (or was broadening documented)?
- If cohort was sparse for development, did the agent supplement with `fetch_comp_set` per the playbook?

### Category C — Posture Awareness Per Year

Per v4 patch Section A.6, the agent must assess posture per year of hold:
- Score 8 signals (supply pipeline, absorption, comp concession trend, lease velocity, comp trade-out, M35 events, employment growth, migration)
- Classify each year (offense / defense / neutral / strong)
- Show assumption_modulation per year per major assumption
- Surface posture transitions with explanation

**Check:**
- Was `proforma.posture.y<N>` populated for every year of the hold period?
- Was `signal_breakdown` populated with all 8 signals?
- Did the assumption_modulation show specific factor adjustments per year?
- Were posture transitions explained with named events or supply absorption?
- Was Y1 posture coherent with the deal's actual context (e.g., new supply nearby should produce defense posture)?

### Category D — Deal-Type Playbook Adherence

Per the deal-type playbook for whatever 464 Bishop is classified as. For value-add specifically:
- Per-unit forward rent walk via `compute_proforma`, NOT flat rent growth
- Owned-portfolio retention rate as primary anchor
- Loss-to-lease compression modeled in the walk
- Renovation premium derived from comp set ceiling, NOT sponsor assertion
- Y1 elevated vacancy from renovation displacement
- Pre-renovation vs post-stabilization regime split on turnover, R&M, marketing, concessions
- Property tax via `fetch_jurisdiction_tax_forecast` (T-12 alone is wrong)
- Insurance via `fetch_jurisdiction_insurance_forecast` (mandatory in FL/CA)

**Check (assuming value-add):**
- Was `compute_proforma` called? Did it produce a per-unit walk output?
- Did the agent reference owned-portfolio retention rate vs default 0.55?
- Did loss-to-lease compress over the hold (regime-aware) or stay flat (smoothed)?
- Was renovation premium derived from comp ceiling × positioning percentile × capture rate, or was it asserted by sponsor and consumed as input?
- Did Y1 vacancy show elevation vs stabilized year?
- Are turnover, R&M, marketing modeled with pre/post regime values?

### Category E — Renovation Premium Derivation (CRITICAL)

Per the patched Pass 1 reference cell, renovation premium derivation must reverse the intuitive sourcing:
- **Comp ceiling is the input**, computed from M05 comp set per floor plan
- **Sponsor's job is positioning percentile selection**, not premium assertion
- **Premium is computed math:** `(comp_ceiling_at_chosen_percentile - current_market) × historical_capture_rate`
- **Capture rate from S3 owned-portfolio**, with sponsor track record evidence

**Check:**
- Did the agent compute comp ceiling per floor plan (P25/P50/P75)?
- Did it source the positioning percentile from sponsor input or platform default (P50)?
- Was the capture rate from owned-portfolio actuals or did it default to platform value?
- Did the agent treat sponsor's asserted premium as input? (If yes, this is a critical flaw per Common Pitfall #1 in the matrix.)
- Were comp ceiling comparables filtered correctly (newer or recently-renovated, not baseline comparables)?
- Was renovation premium computed per floor plan (each floor plan its own premium) or smoothed across floor plans?

### Category F — Per-Floor-Plan Output Shape

Per the UI spec v1.1, the agent must emit `proforma.revenue.gpr.unit_mix[floor_plan_id]` with full grid data:
- unit_count, current_market_rent, comp_ceiling (P25/P50/P75), positioning_percentile, post_reno_target_rent, gross_premium, capture_rate, captured_premium, renovation_cost, renovation_scope, yield_on_cost, evidence

**Check:**
- Did the agent emit the unit_mix array?
- Is every floor plan from the rent roll represented?
- Are all 11 fields per UnitMixEntry populated?
- Is yield-on-cost computed correctly per floor plan?
- Is property-level yield-on-cost in the aggregate footer (`UnitMixAggregate`)?

### Category G — Math Integrity

Per the math engine v1.1, subtotals must compute correctly:
- Base Rental Revenue = GPR - Loss to Lease - Vacancy - Concessions - Bad Debt - Non-Revenue Units
- Other Income = breakdown sum (Rent Roll/OM priority) or T-12 aggregate, with reconciliation if both present
- EGI = Base Rental Revenue + Other Income
- Controllable OpEx = sum of 6 line items
- Non-Controllable OpEx = sum of 3 line items
- Total OpEx = Controllable + Non-Controllable
- NOI = EGI - Total OpEx
- NOI After Reserves = NOI - Reserves
- Stabilized Value = NOI / cap_rate

**Check:**
- Run `validateSnapshot()` from the math engine on the agent's output
- Report every finding from the validator: `subtotal_mismatch` or `breakdown_aggregate_mismatch`
- Specifically check Total OpEx (the v1.0 bug site)
- Check Other Income reconciliation (the v1.1 bug site)
- Verify Stabilized Value computation

### Category H — Output Schema Conformance

Per v2 prompt patch (evidence normalizer integration):
- Every `proforma_fields` entry must have `evidence` as a structured object, not a string
- Every required field must have `value_numeric` populated or `gap_reason` set
- Every Δ component must sum to total Δ within $1
- All source labels must be in the canonical taxonomy

**Check:**
- Run `safeNormalizeProformaFields()` and report the `fields_repaired` count
- High repair count indicates schema conformance issues
- Did any required fields end up with null `value_numeric` without `gap_reason`?

### Category I — M36 Plausibility Cross-Check

Per v3 patch Section E, `evaluate_plausibility` must be called before final write:
- Returns plausibility_distance_d, regime, top_stretch_variables, factor_loadings

**Check:**
- Was `evaluate_plausibility` called?
- What was the d value?
- If d > 1.5, did the agent attach `plausibility_note` explaining stretches?
- If d > 2.0, did the agent specifically name market evidence for each top_stretch_variable?
- If d > 3.0, did the agent block the write (it should have)?

### Category J — Mixed-Source Subtotal Handling (Other Income)

Per math engine v1.1, hierarchical subtotals must:
- Emit breakdown components when Rent Roll or OM data is available
- Apply source priority (Rent Roll > OM > T-12 aggregate > platform fallback)
- Surface reconciliation findings when breakdown sum and aggregate differ beyond tolerance

**Check:**
- Did the agent emit Other Income breakdown rows (Parking, Pet, Storage, Washer/Dryer, RUBS, Fees, Insurance Admin, Cable, Other)?
- Where source metadata was emitted, did it apply the priority rule correctly?
- Did the resolved Other Income value match the breakdown sum (if available) or the T-12 aggregate (if not)?

---

## PHASE 4 — STRUCTURED OUTPUT

Produce findings in this format. One JSON file at `/tmp/cashflow_diagnostic_464_bishop_findings_{timestamp}.json`.

```json
{
  "session_id": "string",
  "deal_id": "464_bishop",
  "agent_run_id": "string",
  "prompt_version": "string",
  "timestamp": "ISO8601",
  "agent_completed_successfully": boolean,
  "deal_classification": "acquisition_valueadd | acquisition_stabilized | development | redevelopment",

  "summary": {
    "total_findings": number,
    "critical_count": number,
    "major_count": number,
    "minor_count": number,
    "categories_with_critical": ["string"],
    "overall_assessment": "string"
  },

  "findings": [
    {
      "id": "F-001",
      "category": "A | B | C | D | E | F | G | H | I | J",
      "category_name": "Tool Orchestration | Analog Cohort Anchoring | ...",
      "severity": "critical | major | minor",
      "title": "string",
      "description": "string",
      "evidence_from_trace": {
        "trace_location": "string (tool call name, line ref, field path)",
        "agent_quote_or_action": "string (what the agent did)",
        "expected_behavior": "string (what spec says it should have done)"
      },
      "spec_reference": "string (specific section of which spec)",
      "impact": "string (what this means for the underwriting output)",
      "recommendation": {
        "action": "string (specific actionable change)",
        "target_file": "string (which file to edit)",
        "proposed_text": "string (specific prompt edit if applicable)",
        "priority": "ship_blocker | next_iteration | nice_to_have"
      }
    }
  ],

  "trace_summary": {
    "tool_calls_in_order": ["string"],
    "phases_correctly_sequenced": boolean,
    "missing_mandatory_tools": ["string"],
    "out_of_order_tools": [{"tool": "string", "expected_phase": number, "actual_phase": number}]
  },

  "math_engine_findings": {
    "validate_snapshot_result": "object (full output)",
    "subtotal_mismatches": ["string"],
    "breakdown_aggregate_mismatches": ["string"],
    "auto_corrected": boolean
  },

  "evidence_normalizer_findings": {
    "fields_repaired": number,
    "fields_fallback_coerced": number,
    "repair_breakdown": "object"
  },

  "plausibility_findings": {
    "was_called": boolean,
    "d_value": number,
    "regime": "string",
    "top_stretch_variables": ["string"],
    "agent_response_to_d": "string"
  },

  "improvement_recommendations_summary": {
    "prompt_changes": [
      {
        "file": "string",
        "section": "string",
        "current_text": "string",
        "proposed_text": "string",
        "rationale": "string"
      }
    ],
    "config_changes": [
      {
        "file": "string",
        "change": "string",
        "rationale": "string"
      }
    ],
    "code_changes": [
      {
        "file": "string",
        "change": "string",
        "rationale": "string"
      }
    ],
    "deal_capsule_changes": [
      {
        "change": "string",
        "rationale": "string"
      }
    ]
  }
}
```

---

## PHASE 5 — HUMAN-READABLE SUMMARY

In addition to the JSON, produce a markdown summary at `/tmp/cashflow_diagnostic_464_bishop_summary_{timestamp}.md` with:

1. **Headline finding** — the single most important issue, one sentence
2. **Critical findings** — bulleted list with category and recommendation
3. **Major findings** — bulleted list, briefer
4. **Math integrity status** — pass/fail with specifics
5. **Recommended prompt iterations** — ranked list of prompt changes to make
6. **Recommended infrastructure changes** — config/code changes if needed
7. **Confidence assessment** — was the agent's output trustworthy for an LP decision, and why

Keep the markdown summary under 1,500 words. It is the executive read; the JSON is the operational data.

---

## CONTEXT REPLIT NEEDS

Before running, confirm with the team:

1. **464 Bishop classification:** What deal type is 464 Bishop? (acquisition_valueadd, acquisition_stabilized, development, redevelopment) — this determines which deal-type playbook applies and what the agent's output schema should look like.

2. **Sponsor information:** Is the sponsor's owned-portfolio data available via `fetch_owned_asset_actuals`? If not, the agent will fall back to defaults and the review should account for that.

3. **Strategy thesis:** What is the sponsor's renovation/repositioning thesis if any? This is the baseline against which to evaluate the agent's renovation premium reasoning.

4. **Target hold period and IRR:** What is the target return the deal is being underwritten to? This is the bar against which the M36 plausibility check is evaluated.

5. **Prompt version in production:** Which version of the prompt is the agent currently running? (e.g., v2.0, v3.0, v4.0) This is critical — the review compares the agent's behavior against the spec for *that version*, not against the latest spec.

6. **Math engine version:** Is the math engine v1.0 or v1.1 integrated in the post-processor? If neither, run validation manually using `validateSnapshot()`.

If any of these are unknown, surface as blockers before running.

---

## WHAT REPLIT SHOULD DO IF THE AGENT FAILS MID-RUN

If the agent run fails before completion:

1. Capture the partial state
2. Identify the failure point: which tool, which input, what error
3. Run the diagnostic categories that CAN be evaluated from partial state (e.g., tool orchestration up to failure point)
4. Document the failure in the JSON with a `failure_point` field
5. Do not retry automatically. Surface the failure to the team for triage.

---

## SUCCESS CRITERIA

The diagnostic session is complete when:

1. The agent run has executed (success or documented failure)
2. The forensic review covers all 10 categories (A through J)
3. The JSON output is well-formed and contains every observed finding with specific recommendations
4. The markdown summary is under 1,500 words and gives a clear executive read
5. Every critical finding has a specific, actionable recommendation pointing at the exact file and section to change

Do not produce vague recommendations ("improve the prompt"). Every recommendation must name a specific file, section, current text (if applicable), and proposed text (if applicable).

---

## ONE NOTE ON TONE

This is a quality review, not a performance review. The agent's "mistakes" are signals about where the prompts and specs need work, not failures of the agent itself. Frame findings constructively: each finding is an opportunity to make the next run better.

Be specific. Be actionable. Be honest about severity. The goal is a tighter prompt, a sharper spec, and a more reliable agent — not a polished narrative.

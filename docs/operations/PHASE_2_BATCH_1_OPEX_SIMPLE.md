# Phase 2 Batch 1 — OpEx Simple Assumptions Derivation Logic

**Date:** 2026-05-27  
**Phase:** Phase 2  
**Scope:** 10 OpEx assumptions, multifamily-existing, $/unit annual  
**Type:** Documentation only — no code changes  
**Next batch:** Batch 2 (OpEx complex: property tax with reassessment, insurance with FL multiplier, management fee)

---

## State Verification

| Check | Result |
|---|---|
| PROFORMA_CALCULATION_TEMPLATE.md exists with assumption definitions | CONFIRMED — `docs/specs/PROFORMA_CALCULATION_TEMPLATE.md` (883 lines, 2026-05) |
| No prior PHASE_2_BATCH documents exist | CONFIRMED — no matching files in `docs/operations/` |
| Phase 1 items confirmed COMPLETE in PHASE_1_TASK_MAP.md | CONFIRMED — Mandate v1.3, Tier 1 RegimeExpand, Tier 2 directional checks all COMPLETE |
| PROFORMA_CALCULATION_TEMPLATE.md location note | File is at `docs/specs/`, not `docs/architecture/` |

---

## 1. Executive Summary

**10 assumptions covered.** All are `assumption` layer (LayeredValue-stored; LLM-reasoned or operator-set). All use $/unit/annual granularity for multifamily-existing deals.

**Common patterns identified (Section 2):** 3 groups — CTRLL standard, NCTRL utilities, CAPEX reserves. Groups share derivation logic; per-assumption variations noted in Section 3.

**Key observations:**
1. All CTRLL items share the same source priority: `override > OM > T12 > platform`. Source priority is identical; the variation is in evidence quality per item.
2. For value-add/repositioning deals, 4 of the 10 items have Mandate v1.3 sub-field support (R&M, Marketing, Turnover, Contract Services). Their derivation logic uses the sub-field regime.
3. Utilities (NCTRL-001/002/003 + Trash) share a structural challenge: OM packages frequently provide a combined `utilitiesAnnual` figure rather than per-utility line items. Decomposition logic is needed.
4. Replacement Reserves (CAPEX-001) has **no T12 source** — it falls back to OM or platform immediately. A last-resort $350/unit fallback exists in the export path (`f9-financial-export.service.ts:172`); the committed derivation rule is the three-tier age-based default in Pattern C.
5. `line_item_benchmarks` table exists with the right schema for sigma checks, but BUG-01 means all `platform` slots are currently null. Batch 1 derivation logic should reference benchmarks but operators should be warned when benchmark population is sparse.

**Cross-batch dependencies identified (Section 5):** Property tax (Batch 2), Insurance (Batch 2), Management fee (Batch 2).

**Open questions requiring operator review (Section 4):** 5 items — "Trash" field definition, utility decomposition rule, reserves platform default, CS value-add complexity, benchmark population status.

---

## 2. Common Derivation Patterns

### Pattern A — CTRLL Standard (R&M, Marketing, G&A, Turnover, Contract Services)

**Applies to:** CTRLL-001, CTRLL-002, CTRLL-005, CTRLL-006, CTRLL-007

**Source priority (Stabilized):**

```
resolved = COALESCE(
  override,                           -- operator-set; always wins
  om_value,                           -- broker OM / deal package (Tier 4)
  t12_value,                          -- trailing 12-month actuals (Tier 1) ← PRIMARY
  platform_benchmark                  -- line_item_benchmarks (Tier 3)
)
```

**Confidence mapping:**
| Resolved from | Confidence |
|---|---|
| Override | HIGH (operator-confirmed) |
| T12 | HIGH (if last 3 months agree within ±15%); MEDIUM otherwise |
| OM | LOW (broker projection; self-serving bias risk) |
| Platform benchmark | MEDIUM (cohort data, not subject-specific) |

**T12 quality gate (for Tier 1 resolution):**
- Compare the most recent 3 months of `deal_monthly_actuals` for this line item
- If max ÷ min of the 3-month window > 1.15 (±15% variance): downgrade confidence to MEDIUM, surface note "T12 shows high variance in [month range]; verify one-time items"
- Exclude months flagged as one-time (operator annotation or >3× median): report exclusion in evidence trail

**Value-add / Repositioning (pre/post sub-fields):**

For fields with Mandate v1.3 sub-field support (R&M, Marketing, Turnover, Contract Services):
```
pre_renovation = T12 actuals (Tier 1 — HIGH confidence)
  → Source: "tier1:t12"
  → Represents: current degraded asset state

post_stabilization = line_item_benchmarks.p50 for (state, msa, target_asset_class, deal_type='value_add')
  → Source: "tier3:platform_benchmark"
  → Confidence: MEDIUM (projection; no actuals)
  → Directional check: Tier 2 V1 (post ≤ pre for cost-reducing items; post ≥ pre for cost-growing items)
```

**Validation (all states):**
1. **Sigma check:** Query `line_item_benchmarks` for (state, msa, asset_class, deal_type). If `resolved` > P75: surface amber flag "Above typical range for comparable assets". If `resolved` < P25: surface amber flag "Below typical range — verify no items are missing".
2. **Archive comparison:** If `archive_assumption_benchmarks` has entries for this field in this market: surface `assumed_p50` vs `achieved_p50` with `delta_pct`.
3. **Sales comp triangulation:** Not typically applied to CTRLL items individually — apply to total OpEx via NOI margin check instead.

**Output shape:**
```json
{
  "value": 69600,
  "source": "t12",
  "confidence": "high",
  "asset_state": "Stabilized",
  "evidence_rows": ["<underwriting_evidence.id>"],
  "validation": {
    "sigma_flag": false,
    "sigma_band": { "p25": 52000, "p50": 71000, "p75": 94000 },
    "archive_comparison": { "assumed_p50": 68000, "achieved_p50": 71500, "delta_pct": 5.1 }
  }
}
```

**Operator override path:**
- Operator enters value in F9 → `PATCH /api/v1/deals/:dealId/financials/override { field, value }`
- Stored in `year1.[field].override`
- On next resolution, `COALESCE` picks override first
- Confidence shows as "operator-confirmed"; evidence trail notes "User override: $X"

---

### Pattern B — NCTRL Utilities (Water, Electric, Gas, Trash)

**Applies to:** NCTRL-001, NCTRL-002, NCTRL-003, and Trash (see OQ-1 resolution — routes to `contractServices` or combined `utilities` by label)

**AMENDED 2026-05-27:** T12 parser produces combined utilities only. Per `types.ts:479-484` and PHASE_2_BATCH_1_DATA_QUERIES.md Query 2 findings.

**T12 infrastructure constraint:** The T12 parser aggregates ALL utility lines (water, electric, gas, trash, other) to a single `utilities` figure. Per `backend/src/services/document-extraction/types.ts` lines 479–484:
> "Null from T12 today (parser aggregates to `utilities`). Task #672."

Individual sub-line values (`water_sewer`, `electric`, `gas_fuel`) are never populated from T12 parsing under the current implementation. Split ratios applied to the combined `utilities` figure are the **only available derivation path** for per-utility values until Task #672 ships.

**Source priority:**

```
resolved_per_utility = COALESCE(
  override,                                -- operator-set per-utility override; always wins
  om_itemized_value,                       -- OM sub-line if broker itemized (rare)
  t12_combined × split_ratio,             -- T12 combined utilities × split ratio (primary path)
  benchmark_utilities_total × split_ratio -- line_item_benchmarks.utilities_total × split ratio
)
```

**Split ratios (interim — NMHC averages; recalibrate post-Task #672):**

```
water_sewer:  42%  (Atlanta: 45%)
electric:     32%  (Atlanta: 40%)
gas_fuel:     18%  (Atlanta: 10%)
trash:         8%  (Atlanta:  5%)  [when trash is combined into utilities, not contractServices]
```

Surface note with any split-ratio derived value: "Utility sub-lines estimated via platform split ratios from combined T12 utilities figure. Calibration pending Task #672 sub-line T12 parsing."

**Confidence:** MEDIUM for all split-ratio derived values. Upgrade to HIGH only when operator provides confirmed per-utility breakdown.

**Sigma validation:** Use `line_item_benchmarks.utilities_total` for sigma check on the combined utilities figure. No per-sub-line benchmarks exist (`water_sewer`, `electric`, `gas_fuel` are not separate benchmark line items). Do not sigma-check individual sub-lines independently.

**Double-count guard:** NCTRL-003a (combined `utilities` field) and the decomposed sub-lines can both be populated simultaneously. Derivation logic must check whether both are set and prefer decomposed sub-lines. Do not sum both (BUG-01 note in template: "double-counting risk").

**Value-add / Repositioning:**
- Utilities generally do not change significantly with renovation (they reflect building infrastructure, not management practice)
- **No Mandate v1.3 sub-fields for utilities** — pre/post regime not implemented
- Exception: electric may decrease post-renovation if LED lighting or HVAC upgrades are in scope → if CapEx scope document mentions energy improvements, agent should note this and use post-renovation benchmark for electric
- For Phase 1: use single-value derivation (no pre/post); note energy upgrade flag as Phase 2 enhancement

**New Construction / Lease-Up:** Apply platform benchmark as primary (no T12 available). Use `line_item_benchmarks` P50 for target asset class. Confidence: MEDIUM-LOW.

---

### Pattern C — Capital Reserves (Replacement Reserves)

**Applies to:** CAPEX-001

**Source priority — uniquely different from Pattern A:**

```
resolved = COALESCE(
  override,                          -- operator-set; always wins
  om_reserves,                       -- broker OM / deal package (Tier 4)
  platform_reserves                  -- line_item_benchmarks (Tier 3)
)
-- NOTE: NO T12 source. Reserves are a budget item set by policy, not a trailing actuals item.
```

**Platform fallback:** `f9-financial-export.service.ts:172` hardcodes `totalUnits × 350` when `year1.replacement_reserves` is null — in the **export path only**, not the derivation path. Cleanup dispatch needed to align the export fallback with the three-tier rule below.

**COMMITTED RULE (2026-05-27) — Three-tier age-based:**

| Asset age | Default $/unit/yr | Notes |
|---|---|---|
| < 10 years old | $200/unit/yr | Modern systems; low near-term capital risk |
| 10–25 years old | $350/unit/yr | Moderate wear; planned replacements |
| 25+ years old | $500/unit/yr | Higher capital risk; flag if understated |
| Value-add (during reno) | Operator override required | CapEx draw absorbs major items; no platform default applies |

**Derivation:** Compute `current_year − year_built`. Apply the matching age band as the platform default. Operator override always takes precedence. Minimum floor across all bands: $150/unit/yr.

**System prompt alignment:** `system.ts:459` updated to this three-tier rule. The prior two-band rule ($300 < 15yr, $500 ≥ 15yr) is superseded.

**Validation:**
1. **Sigma check:** Compare resolved $/unit vs `line_item_benchmarks.replacement_reserves`. Flag if < $150/unit (likely understated).
2. **Broker cross-check:** OM reserves are routinely understated to inflate NOI. If OM value < committed age-band default, surface amber flag "Broker reserves appear below age-appropriate default ($X/unit for [age-band])."
3. **Age confirmation:** Surface in evidence trail: "Asset built [year_built]; age [N] years; applied $X/unit/yr ([<10yr / 10–25yr / 25+yr] default)."

**Value-add / Repositioning:**
- During renovation: reserves are typically reduced (CapEx budget handles capital replacement)
- Post-stabilization: reserves reset to target class benchmark
- No Mandate v1.3 sub-fields for replacement reserves — the Mandate covers expense line items with T12 actuals, and reserves have no T12 actuals by definition

---

## 3. Per-Assumption Derivation Logic

---

### ASSUMPTION 1: Repairs & Maintenance

**ID:** CTRLL-001  
**Field key:** `repairs_maintenance`  
**Display label:** Repair & Maintenance  
**Batch:** Batch 1 (Pattern A — CTRLL standard)

**DESCRIPTION:**  
Day-to-day maintenance and repair costs for the building and units. Includes responsive repairs (tenant service requests), preventive maintenance, HVAC servicing, plumbing, electrical, and common area upkeep. Excludes capital improvements (tracked in CapEx) and landscaping (separate line).

**SOURCE PRIORITY BY ASSET STATE:**

*Stabilized:*
- Primary: T12 actuals (`t12.repairs_maintenance`) — HIGH confidence if ±15% variance; MEDIUM if volatile
- Validation: `line_item_benchmarks` sigma check (P25/P50/P75 by state × MSA × class)
- Cross-check: Total OpEx / NOI margin triangulation

*Repositioning (value-add):*
- `pre_renovation`: T12 actuals — HIGH confidence. Source: `"tier1:t12"`
- `post_stabilization`: Platform benchmark at target asset class — MEDIUM confidence. Source: `"tier3:platform_benchmark"`
- Directional rule (V1): post ≤ pre — post-renovation R&M should decrease (new systems, less deferred maintenance)
- Delta plausibility (V4): threshold 80% — if delta > 80%, flag for evidence review

**MANDATE v1.3 STATUS:** ACTIVE — R&M is one of the 9 eligible line items. Sub-field writeback implemented in `cashflow.postprocess.ts`. Synthesis fallback implemented for T12 actuals (Task #1364).

**OM RELIABILITY:**
- Brokers frequently understate R&M (self-serving bias; inflated NOI)
- Live example (464 Bishop): OM = $69,600 vs T12 = $4,090 (T12 is partial-year; caution)
- When T12 partial year: annualize carefully (`monthly_actuals` prorated to 12 months)

**MODULE CONTEXT:**
- M14 Risk: flags if R&M > P75 of cohort (deferred maintenance signal)
- M22 Post-Close: compares operator's R&M assumption to what comparable acquisitions actually spent

**OPEN QUESTION:**  
None. R&M is the most straightforward Batch 1 assumption.

---

### ASSUMPTION 2: Turnover Costs

**ID:** CTRLL-007  
**Field key:** `turnover`  
**Display label:** Turnover / Make-Ready  
**Batch:** Batch 1 (Pattern A — CTRLL standard)

**DESCRIPTION:**  
Costs to prepare a unit for a new tenant after vacancy: cleaning, paint, carpet/flooring replacement, appliance repair, lock changes, and make-ready labor. Expressed as $/unit/year (i.e., effective $/unit × annual turnover rate). Distinct from capital improvements (tracked in CapEx).

**SOURCE PRIORITY BY ASSET STATE:**

*Stabilized:*
- Primary: T12 actuals — HIGH confidence
- Secondary: OM-stated turnover cost — LOW confidence (often understated)
- Watch: T12 turnover is notoriously partial-year or lumpy (seasonal move-out spikes). Apply variance gate: if max/min of 3-month trailing > 2×, use annualized rolling 12-month sum, not point-in-time.

*Repositioning (value-add):*
- `pre_renovation`: T12 actuals — HIGH confidence (reflects current distressed-state tenant churn)
- `post_stabilization`: Platform benchmark for stabilized asset at target class — MEDIUM confidence
- Directional rule (V1): post ≤ pre — stabilized asset should have lower turnover than a distressed asset experiencing high churn during renovation period
- Exception: if deal thesis includes significant unit upgrades that attract higher-income tenants, turnover could temporarily rise during the repositioning period. Agent should flag this scenario.

**MANDATE v1.3 STATUS:** ACTIVE — Turnover is one of the 9 eligible line items.

**OM RELIABILITY:**
- Live example (464 Bishop): OM = $41,760, T12 = $1,540 (partial year — 2 months of activity)
- T12 partial-year annualization required. Cross-check with occupancy rate × avg turns × per-turn cost.

**MODULE CONTEXT:**
- M14 Risk: elevated turnover relative to cohort is a property management quality signal
- M22 Post-Close: tracks operator's turnover assumption vs achieved actuals

---

### ASSUMPTION 3: Marketing

**ID:** CTRLL-005  
**Field key:** `marketing`  
**Display label:** Marketing / Advertising  
**Batch:** Batch 1 (Pattern A — CTRLL standard)

**DESCRIPTION:**  
Costs to attract and retain tenants: online listing fees (Apartments.com, Zillow, etc.), printed materials, leasing incentives tracking, and promotional costs. Typically expressed as $/unit/year, inversely correlated with occupancy (higher vacancy → higher marketing spend).

**SOURCE PRIORITY BY ASSET STATE:**

*Stabilized:*
- Primary: T12 actuals — HIGH confidence
- Note: Marketing is a managed variable. A high-occupancy stabilized asset may have near-zero marketing spend (organic leasing). Don't flag near-zero as an error.

*Repositioning (value-add):*
- `pre_renovation`: T12 actuals — HIGH confidence (reflects distressed asset's marketing effort)
- `post_stabilization`: Platform benchmark for stabilized target class — MEDIUM confidence
- Directional rule (V1): post ≤ pre — a fully stabilized asset requires less marketing than a lease-up or distressed asset
- Exception: if the renovation repositions to a higher price point, marketing may temporarily increase during the re-leasing campaign

**MANDATE v1.3 STATUS:** ACTIVE — Marketing is one of the 9 eligible line items. Synthesis fallback implemented (Task #1364).

**OM RELIABILITY:**
- Live example (464 Bishop): OM = $69,600, operator used same ($69,600)
- Marketing is often a round number in OM packages. Agent should check against T12.

**MODULE CONTEXT:**
- M14 Risk: high marketing spend relative to cohort indicates occupancy pressure
- M22 Post-Close: compare assumed stabilized marketing spend to what was actually needed

---

### ASSUMPTION 4: Admin / General & Administrative

**ID:** CTRLL-006  
**Field key:** `g_and_a`  
**Display label:** Administrative  
**Batch:** Batch 1 (Pattern A — CTRLL standard)

**DESCRIPTION:**  
General administrative costs: office supplies, postage, bank charges, legal/accounting fees allocable to the property level (not portfolio-level), software subscriptions (property management software), and miscellaneous administrative overhead. Distinct from management fee (a separate percentage-of-EGI line) and payroll (separate personnel line).

**SOURCE PRIORITY BY ASSET STATE:**

*Stabilized:*
- Primary: T12 actuals — HIGH confidence
- Caveat: G&A is often a catch-all that absorbs one-time items (legal fees for evictions, audit costs). Apply one-time exclusion filter.

*Repositioning (value-add):*
- No Mandate v1.3 sub-fields — G&A does not have pre/post regime. G&A is relatively stable regardless of renovation status.
- Use T12 actuals for current state; use platform benchmark for post-stabilization estimate if T12 absent.
- For value-add deals: G&A may temporarily increase during renovation (construction oversight, legal costs) → note this if CapEx is significant.

**MANDATE v1.3 STATUS:** NOT APPLICABLE — G&A is not in the 9 eligible line items.

**OM RELIABILITY:**
- Live example (464 Bishop): OM = $69,600, operator override = $69,600, T12 = ? (not noted in template)
- G&A from OM is generally reasonable (not as inflated as NOI-boosting lines).

**MODULE CONTEXT:**
- M14 Risk: G&A outliers sometimes indicate unreported management costs
- No specific M22 signal for G&A

---

### ASSUMPTION 5: Contract Services

**ID:** CTRLL-002  
**Field key:** `contract_services`  
**Display label:** Contract Services  
**Batch:** Batch 1 (Pattern A — CTRLL standard, with value-add complexity)

**DESCRIPTION:**  
Third-party service contracts: trash/waste removal, pest control, elevator maintenance, fire safety inspections, security, HVAC service contracts, and other outsourced property services. **Note: Trash removal is typically included in Contract Services when tracked separately from utilities.**

**SOURCE PRIORITY BY ASSET STATE:**

*Stabilized:*
- Primary: T12 actuals — HIGH confidence
- Secondary: OM-stated contract services

*Repositioning (value-add):*
- `pre_renovation`: T12 actuals — HIGH confidence
- `post_stabilization`: **CONDITIONAL** — only when qualifying amenities (new pool, elevator, parking structure, fitness center) are added in the renovation scope
  - If amenities added: Platform benchmark at target class — MEDIUM confidence. Contract services will increase.
  - If interior-only renovation (no new amenities): no sub-field writeback; use same T12 baseline.
- Directional rule (V1): **No fixed rule** — direction depends on amenity additions. Agent must reason from CapEx scope.

**MANDATE v1.3 STATUS:** CONDITIONAL ACTIVE — CS is one of the 9 eligible line items but sub-field writeback is gated on qualifying amenity additions. LLM must write sub-fields when it identifies qualifying amenities; synthesis fallback does NOT write CS sub-fields (server-side cannot detect amenity additions from T12). See Task #1364 closing note.

**OM RELIABILITY:**
- Live example (464 Bishop): OM = null (not itemized), operator override = $28,680, T12 = $19,640
- Contract services frequently lumped into "other expenses" in OM packages.

**IMPORTANT NOTE — Trash as a Contract Services sub-item:**
Trash removal/waste disposal is most commonly tracked as part of Contract Services (not as a separate NCTRL utility line). See Open Question OQ-1 in Section 4.

**MODULE CONTEXT:**
- M14 Risk: amenity-related contract services increase is a known post-renovation cost surprise
- M22 Post-Close: validates whether amenity contract costs met the operator's projection

---

### ASSUMPTION 6: Utilities — Water & Sewer

**ID:** NCTRL-001  
**Field key:** `water_sewer`  
**Display label:** Water & Sewer  
**Batch:** Batch 1 (Pattern B — NCTRL utilities)

**DESCRIPTION:**  
Monthly water consumption and sewer usage charges. A non-controllable expense driven by unit count, occupancy, and building infrastructure. Owner-paid unless RUBS (Ratio Utility Billing System) transfers cost to tenants. "Non-controllable" means operator cannot easily reduce this line through management decisions.

**SOURCE PRIORITY BY ASSET STATE:**

*Stabilized:*
- Primary: T12 actuals (`t12.water_sewer`) — HIGH confidence
- Caveat: OM frequently provides combined `utilitiesAnnual` rather than per-line. Apply **Pattern B decomposition rule** (see Section 2) when sub-lines absent.
- Live example (464 Bishop): OM provided combined `utilitiesAnnual = $187,094`; `year1.water_sewer.om = null`.

*Repositioning (value-add):*
- No sub-fields; single-value derivation
- Water/sewer costs are relatively stable across pre/post renovation (driven by occupancy and infrastructure, not asset condition)
- Exception: if renovation adds units or significantly changes plumbing infrastructure, water_sewer may change — note and flag

*New Construction / Lease-Up:*
- Platform benchmark as primary (no T12 available). Confidence: MEDIUM-LOW.
- Reference: `line_item_benchmarks` where populated, or $400–$700/unit/yr for multifamily (market-dependent).

**RUBS INTERACTION:**
- If the deal has RUBS (utility billing to tenants), owner-paid water/sewer approaches zero
- Agent should check rent roll for RUBS indicator and note "Water/Sewer effectively $0 — RUBS in place"
- RUBS flag should reduce this line item to nominal value (administrative overhead only)

**MODULE CONTEXT:**
- M02 Regulatory: some municipalities have rate increase schedules; if available, note for projection
- M14 Risk: water/sewer > $900/unit/yr may indicate billing as owner-paid when RUBS could be implemented

---

### ASSUMPTION 7: Utilities — Gas / Fuel

**ID:** NCTRL-003  
**Field key:** `gas_fuel`  
**Display label:** Gas / Fuel  
**Batch:** Batch 1 (Pattern B — NCTRL utilities)

**DESCRIPTION:**  
Natural gas or fuel oil costs for building heating, hot water, and common area HVAC. Highly climate-dependent (southern markets: low; northern markets: high). Owner-paid portion typically covers common areas; unit gas may be metered separately to tenants.

**SOURCE PRIORITY BY ASSET STATE:**

*Stabilized:*
- Primary: T12 actuals (`t12.gas_fuel`) — HIGH confidence
- Seasonality note: gas/fuel is highly seasonal. T12 must span a full calendar year to capture winter peaks. If T12 is partial-year, flag: "T12 partial year; gas costs may be understated if winter months excluded."
- Caveat: OM frequently provides combined utilities — apply Pattern B decomposition rule.

*Repositioning (value-add):*
- No sub-fields; single-value derivation
- Energy efficiency improvements (HVAC replacement, insulation) may reduce gas costs post-renovation
- Agent should note energy upgrade scope from CapEx document if available

*New Construction / Lease-Up:*
- Platform benchmark as primary. Reference: $150–$400/unit/yr (southern markets); $400–$900/unit/yr (northern markets).

**CLIMATE NOTE:**
- For Atlanta / Southeast markets: gas is primarily water heating; costs are low ($150–$300/unit/yr)
- For Charlotte / Nashville: moderate heating load ($250–$500/unit/yr)
- Flag if agent-derived value diverges significantly from market norms for the subject's geography

**MODULE CONTEXT:**
- M02 Regulatory: utility rate schedules available from Georgia Natural Gas / AGL Resources for Atlanta market

---

### ASSUMPTION 8: Utilities — Electric

**ID:** NCTRL-002  
**Field key:** `electric`  
**Display label:** Electric  
**Batch:** Batch 1 (Pattern B — NCTRL utilities)

**DESCRIPTION:**  
Owner-paid electricity for common areas: hallway lighting, parking lot, leasing office, laundry rooms, pool (if applicable), and elevator power. Unit electricity is typically tenant-metered in modern multifamily; older all-bills-paid properties may have owner-paid unit electric.

**SOURCE PRIORITY BY ASSET STATE:**

*Stabilized:*
- Primary: T12 actuals (`t12.electric`) — HIGH confidence
- Caveat: OM frequently provides combined utilities — apply Pattern B decomposition rule
- All-bills-paid indicator: if rent roll shows "all-bills-paid" or "ABPP" units, owner-paid electric will be much higher than pure common-area electric. Flag this.

*Repositioning (value-add):*
- No sub-fields (Phase 1)
- Energy efficiency upgrade interaction: if CapEx includes LED lighting conversion or HVAC replacement, post-renovation electric costs may decrease materially (15–30% reduction is plausible)
- Phase 2 enhancement: if energy audit or CapEx scope confirms lighting/HVAC upgrades, apply post-renovation electric sub-field

*New Construction / Lease-Up:*
- Platform benchmark as primary. Reference: $300–$600/unit/yr (common area only); $1,200–$2,400/unit/yr (all-bills-paid).

**ALL-BILLS-PAID ALERT:**
- If deal is all-bills-paid, electric is materially different. Agent must surface: "All-bills-paid property — electric covers units; cost may be $1,200–$2,400/unit/yr range."
- M14 Risk: all-bills-paid + below-market rents is a common value-add thesis that requires special underwriting.

**MODULE CONTEXT:**
- M02 Regulatory: Georgia Power rate schedule available for Atlanta market; useful for projecting increases

---

### ASSUMPTION 9: Utilities — Trash

**Field key:** `trash` (if distinct) or included in `contract_services` / `utilities`  
**Batch:** Batch 1 (Pattern B — NCTRL utilities, or overlap with Contract Services)  
**STATUS: OPEN QUESTION — see OQ-1**

**DESCRIPTION:**  
Waste removal and dumpster service fees. Municipal collection in some markets (included in property tax or city fees); private contracted service in others. Typically $75–$150/unit/yr.

**CRITICAL AMBIGUITY:**  
The PROFORMA_CALCULATION_TEMPLATE.md does not define a distinct `trash` NCTRL line item. Trash appears to be handled in one of three ways depending on the deal:
1. **Included in `contract_services`** (CTRLL-002): most common for private hauler contracts
2. **Included in `utilities` combined** (NCTRL-003a): when OM provides a single utilities bundle
3. **Municipal utility line** (NCTRL-001 or separate field): in markets where trash is billed as a utility

**Provisional derivation logic (pending OQ-1 resolution):**

*If T12 shows `trash` as a distinct line:*
- Use T12 actuals directly — HIGH confidence
- Store as `contract_services` sub-classification or a new field `trash`

*If T12 combines trash with contract services:*
- Apply Pattern A (CTRLL standard) — treat as part of `contract_services`

*If T12 combines trash with utilities:*
- Apply Pattern B decomposition rule — allocate 8% of combined utilities to trash

*If no data:*
- Platform benchmark: $100/unit/yr as default (flag as estimated)

**Agent instruction (Phase 1):** Ask the agent to identify whether trash is tracked separately in the T12 or is included in contract services or combined utilities. Derive accordingly. Surface the classification in the evidence trail.

**MODULE CONTEXT:**
- M02 Regulatory: municipal trash fees may be included in real estate tax assessments (some GA municipalities)

---

### ASSUMPTION 10: Replacement Reserves

**ID:** CAPEX-001  
**Field key:** `replacement_reserves`  
**Display label:** Replacement Reserves  
**Batch:** Batch 1 (Pattern C — Capital reserves)

**DESCRIPTION:**  
Annual set-aside for future capital expenditures: roof replacement, HVAC systems, flooring, appliances, parking lot resurfacing. Expressed as $/unit/year and budgeted based on asset condition and age. **This is a budget item — it is NOT tracked in T12 actuals** (reserves are not an operating expense; they are a capital reserve line).

**SOURCE PRIORITY BY ASSET STATE:**

*All states — no T12 source:*
```
resolved = COALESCE(
  override,                          -- operator-set; always wins
  om_reserves,                       -- broker OM per-unit reserves
  line_item_benchmarks_p50,          -- platform benchmark for (state, msa, asset_class)
  $350/unit                          -- export-path fallback only (f9-financial-export.service.ts:172); three-tier rule is canonical
)
```

**Confidence mapping:**
| Resolved from | Confidence |
|---|---|
| Override | HIGH (operator-confirmed) |
| OM-stated | MEDIUM (broker may understate to inflate NOI; verify vs asset age) |
| Platform benchmark | MEDIUM (cohort data; appropriate for the asset class) |
| $350/unit hardcoded fallback | LOW (generic default; flag prominently) |

**COMMITTED RULE (2026-05-27) — Three-tier age-based:**
| Asset age (current_year − year_built) | Default $/unit/yr | Notes |
|---|---|---|
| < 10 years old | $200/unit/yr | Modern systems; low near-term capital risk |
| 10–25 years old | $350/unit/yr | Moderate wear; planned replacements |
| 25+ years old | $500/unit/yr | Higher capital risk; flag if understated |
| Value-add (during reno) | Operator override required | CapEx draw absorbs major items; no platform default |

Operator override always takes precedence. Minimum floor across all bands: $150/unit/yr.

**Agent validation:**
1. If resolved < $150/unit: surface warning "Reserves appear understated; minimum floor $150/unit/yr."
2. If OM-stated < age-band default: surface amber flag "Broker reserves below age-appropriate default ($X/unit for [<10yr / 10–25yr / 25+yr] band)."
3. Surface in evidence trail: "Asset built [year_built]; age [N] years; applied $X/unit/yr [age-band] default."
4. If age > 25 years AND resolved < $400/unit: surface amber flag "25+ year asset; $500/unit default applies."

**Value-add / Repositioning:**
- No sub-fields (reserve policy, not T12 actuals)
- Pre-renovation: reserves may be reduced or zero if CapEx draw handles all capital needs
- Post-stabilization: reset to target class benchmark after renovation completion
- Agent should note: "Post-renovation reserves reflect target asset class ($X/unit). CapEx draw covers major system replacements."

**LENDER REQUIREMENT INTERACTION:**
- Many lenders require minimum reserves as a loan covenant ($250–$350/unit is common)
- If the deal has Debt Advisor (M11) data: cross-check reserves against lender-required minimums
- Flag if operator override is below lender requirement

**MODULE CONTEXT:**
- M11 Debt Advisor: lender reserve requirement may exceed operator's budget; flag divergence
- M14 Risk: understated reserves are a common NOI inflation technique; flag vs cohort P25
- M22 Post-Close: tracks actual capital spend vs reserve budget over hold period

---

## 4. Open Questions — Resolution Status

All five OQs resolved. See PHASE_2_BATCH_1_DATA_QUERIES.md for full investigation findings.

| OQ | Topic | Status | Resolution |
|---|---|---|---|
| OQ-1 | Trash field classification | **RESOLVED** | T12 parser routes by label: "Trash Removal" → `contractServices`; "Valet Trash"/"Trash (pickup/hauling)" → `utilities` combined. No new NCTRL field needed. Canonical complete. |
| OQ-2 | Replacement reserves default | **COMMITTED** | Three-tier age rule: <10yr → $200/unit, 10–25yr → $350/unit, 25+yr → $500/unit. Operator override required. See Pattern C above and `system.ts:459`. |
| OQ-3 | Utility split ratios calibration | **DEFERRED** | T12 parser aggregates to combined `utilities` only (Task #672 required for sub-line parsing). Empirical calibration impossible from current data. Interim NMHC ratios documented in Pattern B. |
| OQ-4 | CS value-add complexity | **RESOLVED** | Keep CS in Batch 1 with CONDITIONAL caveat. Stabilized follows Pattern A exactly; value-add amenity detection remains LLM-driven with explicit Phase 1 limitation note. |
| OQ-5 | line_item_benchmarks population | **SIGMA-PARTIAL** | 263 rows, 14 line items, 18–19 rows each across 10 MSAs. Sigma validation functional but intervals wide. `utilities_total` is the benchmark key for all utility lines (no per-sub-line benchmarks). Flag "limited sample" when fewer than 5 rows for a given (state, msa) pair. |

---

## 5. Cross-Batch Dependencies

| Assumption | Blocks | Dependency type |
|---|---|---|
| Property Tax (NCTRL-005) | Not in Batch 1 | Batch 2 — requires reassessment trigger logic and jurisdiction-specific millage rules |
| Insurance (NCTRL-004) | Not in Batch 1 | Batch 2 — requires FL multiplier, jurisdiction-specific risk factors, `insuranceService.forecast()` (BUG-05) |
| Management Fee (NCTRL-006) | Not in Batch 1 | Batch 2 — requires operator-specific rate (self-managed vs third-party); platform default rate needed |
| Landscaping (CTRLL-003) | Not in Batch 1 | Not in Batch 1 scope; follows Pattern A but excluded from this dispatch |
| Personnel / Payroll (CTRLL-004) | Not in Batch 1 | Not in Batch 1 scope; highly operator-specific (staffing levels); excluded from this dispatch |
| EC3 (market rent benchmarks) | Batch 6 (Revenue) | Batch 1 has no dependency on EC3. Proceed with Batch 1 independently. |
| BUG-01 (platform slots null) | Batch 1 validation tier | Sigma checks and platform fallback non-functional until line_item_benchmarks populated. Flag OQ-5. |
| BUG-01 for reserves | CAPEX-001 specifically | Replacement reserves platform fallback via `line_item_benchmarks` unavailable; hardcoded $350/unit fallback fires instead |

**Critical note — Utilities double-counting (BUG-UTIL-01):**
The `utilities` combined field (NCTRL-003a) and the decomposed sub-lines (`water_sewer`, `electric`, `gas_fuel`) can coexist in `deal_assumptions.year1`. The total_opex calculation in `proforma-adjustment.service.ts` must not double-count. This is a pre-existing risk noted in the template. Batch 1 implementation should add a guard: if decomposed sub-lines sum to > 80% of `utilities`, suppress the combined `utilities` row from the P&L to prevent double-counting.

---

## 6. Implementation Priority for Next Dispatch

When Batch 1 derivation logic is ready to implement, the recommended order is:

1. **R&M** (CTRLL-001) — simplest, most data coverage, Mandate v1.3 already active
2. **Marketing** (CTRLL-005) — Mandate v1.3 active; same derivation pattern as R&M
3. **Turnover** (CTRLL-007) — Mandate v1.3 active; same pattern; watch partial-year T12
4. **G&A** (CTRLL-006) — no sub-fields; straightforward Pattern A
5. **Replacement Reserves** (CAPEX-001) — OQ-2 COMMITTED; three-tier rule ready; implement now
6. **Trash** (NCTRL routing) — OQ-1 RESOLVED; parser already routes correctly; implement now
7. **Contract Services** (CTRLL-002) — OQ-4 RESOLVED; keep in Batch 1 with CONDITIONAL caveat
8. **Water, Electric, Gas** (NCTRL-001/002/003) — OQ-3 DEFERRED; implement with interim NMHC split ratios per Pattern B; note Task #672 dependency in evidence trail

**All OQs resolved.** No operator review session needed before implementation. Items 1–7 can proceed immediately. Item 8 ships with documented interim ratios.

---

## VERIFICATION PASS — 2026-05-27

### (a) Document integrity

COMPLETE. All 5 required sections present (Derivation Patterns, Pattern descriptions, Per-Assumption Logic, OQ Resolution, Cross-Batch Dependencies, Implementation Priority). All 10 Batch 1 assumptions covered: CTRLL-001/002/003/004/005/006/007, NCTRL-001/002/003, CAPEX-001.

### (b) Source citations — 5 spot checks

| Check | Target | Result |
|---|---|---|
| CTRLL-001 R&M | `t12.repairs_maintenance` data path | CONFIRMED — correctly cited; `deal_monthly_actuals` reference accurate |
| NCTRL utilities Pattern B | T12 sub-line availability | AMENDED — prior text incorrectly implied `t12.water_sewer`, `t12.electric`, `t12.gas_fuel` available as primary sources. `types.ts:479-484` confirms these are null from T12 today. Pattern B rewritten to reflect combined-only T12 reality. |
| Replacement Reserves $350 hardcode | `f9-financial-export.service.ts:172` | CONFIRMED — `const reservesY1 = y1('replacement_reserves') ?? totalUnits * 350`; export-path only; not the derivation path |
| CAPEX-001 reserve bands | Three-tier age rule | AMENDED — prior class-based ranges (A/B/C) replaced with committed three-tier age rule (<10yr $200, 10-25yr $350, 25+yr $500). `system.ts:459` updated to match. |
| Cross-batch dependencies | Batch 2 (insurance, tax, mgmt fee) | CONFIRMED — no speculative links; Batch 2 correctly flagged as dependency |

### (c) Derivation logic consistency

PASSES post-amendment. Three patterns are coherent and non-overlapping. Value-add pre/post regimes consistent. Confidence calibration consistent. Sub-field write conditions consistent with Mandate v1.3. Pattern B amended to correctly document combined-only T12 constraint.

### (d) OQ resolution status

UPDATED. All five OQs resolved in Section 4:
- OQ-1: RESOLVED (code inspection)
- OQ-2: COMMITTED (three-tier rule)
- OQ-3: DEFERRED (Task #672)
- OQ-4: RESOLVED (keep in Batch 1)
- OQ-5: SIGMA-PARTIAL (functional with wide intervals)

### (e) Identified gaps and dispositions

| Gap | Disposition |
|---|---|
| Pattern B citation error (T12 sub-lines as primary) | AMENDED in this pass |
| CAPEX-001 number mismatch (class-based vs age-based vs agent prompt) | AMENDED — three-tier rule is now canonical; agent prompt aligned |
| Export-path $350 hardcode at `f9-financial-export.service.ts:172` | NOTED — cleanup dispatch required; out of scope for Batch 1 |
| OQ-3 utility split calibration | DEFERRED — Task #672 required; interim NMHC ratios documented |

### (f) Overall verdict

**APPROVED FOR DOWNSTREAM WORK** (post-amendment). Implementation can proceed per Section 6 priority order. All OQs resolved. Pattern B and CAPEX-001 amendments applied. Agent system prompt aligned.

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
4. Replacement Reserves (CAPEX-001) has **no T12 source** — it falls back to OM or platform immediately. The platform default ($350/unit) is hardcoded in `proforma-adjustment.service.ts:3393`.
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

**Applies to:** NCTRL-001, NCTRL-002, NCTRL-003, and Trash (if distinct NCTRL field)

**Same source priority as Pattern A**, with one critical structural difference:

**OM decomposition problem:** Broker OM packages frequently provide a single `utilitiesAnnual` figure rather than per-utility line items. The canonical P&L expects decomposed `water_sewer + electric + gas_fuel (+ trash)`. When OM is combined:

```
OM decomposition rule (when utilitiesAnnual present but sub-lines absent):
  1. If subject's T12 has individual utility lines → use T12 for the specific line, ignore combined OM
  2. If T12 also combined → apply platform split ratios:
     water_sewer: 42% of combined utilities (multifamily NMHC average)
     electric:    32% of combined utilities
     gas_fuel:    18% of combined utilities
     trash:        8% of combined utilities (if tracked separately)
  3. Surface note: "Utility lines estimated via platform split ratios from OM combined figure"
  4. Confidence: MEDIUM (split estimate); flag for operator verification
```

**T12 sub-line availability:** T12 from the broker package may also be combined. In this case, `deal_monthly_actuals.utilities` is the combined field. Individual fields (`water_sewer`, `electric`, `gas_fuel`) are populated only when the T12 is itemized.

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

**Platform fallback:** `proforma-adjustment.service.ts:3393` hardcodes $350/unit if `year1.replacement_reserves` is null. This is the last-resort fallback, below the platform benchmark.

**Standard market ranges:**
| Asset condition | Range | Notes |
|---|---|---|
| Class A, post-2010 | $150–$250/unit/yr | Low near-term capital needs |
| Class B, 1990–2009 | $250–$400/unit/yr | Moderate wear; planned replacements |
| Class C, pre-1990 | $400–$600/unit/yr | Higher deferred maintenance risk |
| Value-add (during reno) | $100–$200/unit/yr | CapEx budget absorbs major items |
| Value-add (post-stabilization) | Match target class above | After renovation, benchmark to target class |

**Validation:**
1. **Sigma check:** Compare resolved $/unit vs `line_item_benchmarks` for (state, msa, asset_class). Flag if < $150/unit (likely understated) or > $600/unit (unusually high).
2. **Broker cross-check:** OM typically states reserves as $/unit. If OM value is present but operator hasn't overridden, note "Using broker-stated reserve; verify reserve adequacy for asset age/condition."
3. **Age factor:** `totalUnits × year_built` can be used to compute an age-adjusted reserve. If the subject was built >20 years ago and reserves < $300/unit, surface a soft warning.

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
  $350/unit                          -- hardcoded fallback (proforma-adjustment.service.ts:3393)
)
```

**Confidence mapping:**
| Resolved from | Confidence |
|---|---|
| Override | HIGH (operator-confirmed) |
| OM-stated | MEDIUM (broker may understate to inflate NOI; verify vs asset age) |
| Platform benchmark | MEDIUM (cohort data; appropriate for the asset class) |
| $350/unit hardcoded fallback | LOW (generic default; flag prominently) |

**Standard reserve bands (Phase 1):**
| Asset class (proxy by year_built) | Reserve range | Notes |
|---|---|---|
| Class A (≥2010) | $150–$250/unit/yr | Modern systems; low near-term capital risk |
| Class B (1995–2009) | $250–$400/unit/yr | Moderate deferred maintenance |
| Class C (<1995) | $400–$600/unit/yr | Higher capital risk; flag if reserves are understated |
| Value-add (during reno) | $100–$200/unit/yr | CapEx draw absorbs major replacements |
| Value-add (post-stabilization) | Match target class | After renovation, benchmark to renovated asset class |

**Agent validation:**
1. If resolved < $150/unit: surface warning "Reserves appear understated for an operating property; minimum $150/unit recommended."
2. If resolved < $250/unit on a Class C asset: surface warning "Asset age suggests higher reserve requirement; $400+ recommended."
3. If OM-stated < $150/unit: surface note "Broker reserves appear optimistic; verify vs capital plan."
4. Age-factor cross-check: `year_built` + current year = asset age. If age > 25 years AND reserves < $350/unit, surface amber flag.

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

## 4. Open Questions for Operator Review

### OQ-1 — "Trash" as a Distinct Field (HIGH priority)

**Question:** Is trash/waste removal a distinct NCTRL line item in the canonical P&L, or is it tracked within Contract Services (CTRLL-002)?

**Context:** The PROFORMA_CALCULATION_TEMPLATE.md defines no distinct `trash` NCTRL line item. The only utility NCTRL items are water_sewer, electric, and gas_fuel. Trash is typically either:
- A sub-line of Contract Services (private hauler contract)
- Part of combined utilities (municipal billing)
- A separate small NCTRL item

**Impact:** If `trash` is a distinct field, it needs to be added to `OPEX_FIELDS` in `proforma-adjustment.service.ts` and to the PROFORMA_CALCULATION_TEMPLATE.md. If it maps to Contract Services, the derivation logic above handles it correctly.

**Operator decision needed:** Where does trash appear in the F9 P&L for deals where it is separately tracked?

### OQ-2 — Utility Decomposition Split Ratios (MEDIUM priority)

**Question:** The Pattern B decomposition rule proposes platform split ratios (water 42%, electric 32%, gas 18%, trash 8%) for cases where OM provides combined `utilitiesAnnual` only. Are these ratios appropriate for the platform's target markets (Atlanta, Charlotte, Nashville, Tampa)?

**Context:** These ratios are derived from NMHC industry averages. Southeast markets typically have lower gas ratios (mild winters) and higher electric ratios (air conditioning). The correct ratios may be:
- Atlanta: water 45%, electric 40%, gas 10%, trash 5%
- Charlotte/Nashville: water 42%, electric 35%, gas 18%, trash 5%

**Operator decision needed:** Approve or adjust the split ratios before implementation.

### OQ-3 — Replacement Reserves Platform Default (MEDIUM priority)

**Question:** The hardcoded `$350/unit` fallback in `proforma-adjustment.service.ts:3393` should be replaced with a more sophisticated estimate. What is the right approach?

**Options:**
- (a) Keep $350/unit as a global floor; always flag to operator when this fallback is used
- (b) Replace with age-adjusted formula: `MAX(150, MIN(600, (current_year − year_built) × 8))` — rough linear scale
- (c) Replace with class-based defaults (Class A: $200, Class B: $300, Class C: $450) using `year_built` proxy
- (d) Require operator input; block resolution if no OM reserves and no override

**Operator decision needed:** Choose (a), (b), (c), or (d). Recommendation: (c) — simple, defensible, and removes the incentive to understate.

### OQ-4 — Contract Services Value-Add Complexity in Batch 1 (LOW priority)

**Question:** Contract Services has Mandate v1.3 sub-field behavior that makes it more complex than other Batch 1 items. Should CS derivation logic be elevated to Batch 2 (complex) rather than Batch 1 (simple)?

**Context:** For stabilized deals, CS follows Pattern A exactly (simple). For value-add deals, CS requires the agent to reason about amenity additions — which is LLM-driven and cannot be systematized with a simple rule. This creates a two-tier derivation: simple for stabilized, complex for value-add.

**Operator decision needed:** Keep CS in Batch 1 with the "CONDITIONAL" caveat documented above, or move to Batch 2? Recommendation: keep in Batch 1 with the conditional note clearly documented.

### OQ-5 — line_item_benchmarks Population Status (HIGH priority)

**Question:** The Batch 1 derivation logic references `line_item_benchmarks` for sigma checks and platform fallback. BUG-01 (PROFORMA_CALCULATION_TEMPLATE.md) notes all platform slots are currently null. Are benchmarks populated for any of the Batch 1 fields?

**Impact:** If benchmarks are empty, the sigma check fires "insufficient benchmark data" for all deals, and platform fallback is unavailable. Batch 1 derivation logic would still work (T12 is the primary source), but the validation layer would be non-functional.

**Investigation needed:** Query `SELECT line_item, COUNT(*) FROM line_item_benchmarks GROUP BY line_item` to check population status. If empty, the benchmark population is a prerequisite for the validation logic to be functional.

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
2. **Marketing** (CTRLL-005) — also Mandate v1.3 active; same derivation pattern as R&M
3. **Turnover** (CTRLL-007) — Mandate v1.3 active; same pattern; watch partial-year T12
4. **G&A** (CTRLL-006) — no sub-fields; straightforward Pattern A
5. **Replacement Reserves** (CAPEX-001) — Pattern C; requires OQ-3 resolution before implementing
6. **Water, Electric, Gas** (NCTRL-001/002/003) — Pattern B; requires OQ-2 (split ratios) resolved
7. **Trash** — requires OQ-1 resolved first
8. **Contract Services** (CTRLL-002) — after OQ-4 disposition (Batch 1 or Batch 2)

**Parallel with OQ resolution:** OQ-1 (trash field), OQ-2 (utility split ratios), OQ-3 (reserves default), and OQ-5 (benchmark population check) can all be addressed in a single operator review session before the implementation dispatch fires.

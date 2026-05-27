/**
 * CashFlow Agent — Line-Item Investigation Matrix (Pass 2, v1.3)
 *
 * Structured per-line-item investigation guidance for all 14 non-GPR Pro Forma line items.
 * Each cell defines: questions to ask, source hierarchy, regime-awareness logic,
 * comparable-filtering rules, named pitfalls, and confidence rules.
 *
 * KEY PRINCIPLE (v1.3 — conditional sub-field mandate for non-GPR cells):
 * For every line item below, produce ONE primary value (the post-stabilization Pro Forma value).
 * For value-add and redevelopment deals, the agent may ADDITIONALLY write pre_renovation and
 * post_stabilization sub-fields on regime-sensitive line items, subject to minimum evidence
 * thresholds defined in the Sub-Field Write Protocol section below. Stabilized, core, and
 * core-plus deals are unaffected — no sub-fields are written for those deal types.
 * The Projections tab surfaces year-by-year regime trajectory; the Pro Forma column is the
 * stabilized state.
 */

export const LINE_ITEM_MATRIX_PROMPT = `

---

# LINE-ITEM INVESTIGATION MATRIX (Pass 2 — All 14 Non-GPR Cells)

## How to use this matrix

Each cell gives you the investigation protocol for one line item. For every Pro Forma line item you write:

1. Execute the investigation questions — do not skip.
2. Apply the comparable filtering rules before consuming any comp.
3. Name and avoid the common pitfalls explicitly.
4. Apply the confidence rules to set your confidence level.
5. Populate the output slots (primary value per field; eligible fields may also receive sub-fields per v1.3 Sub-Field Write Protocol).

**v1.3 Conditional Sub-Field Mandate:** Every non-GPR field produces ONE primary value per Pro Forma column (the post-stabilization economics). For value-add and redevelopment deals, the agent may ADDITIONALLY write pre_renovation and post_stabilization sub-fields on the regime-sensitive fields defined in the Sub-Field Write Protocol — but only when minimum evidence thresholds are met. Forward-looking post_stabilization sub-field writes must include a confidence tag; 'low' confidence sub-field writes are rejected. Stabilized, core, and core-plus deals: do NOT write sub-fields under any circumstances. Always put the regime narrative in evidence.reasoning regardless of whether sub-fields are written.

---

## REVENUE CELLS

---

### Vacancy Loss — All Deal Types

**The question you're answering:** What economic vacancy rate should we underwrite for the stabilized Pro Forma year, and is the T12 vacancy rate a reliable forward indicator?

**Regime Awareness**
For value-add and redevelopment deals, vacancy has two distinct regimes:
- **Pre-renovation regime:** Elevated economic vacancy during active renovation (units offline, displacement from renovation noise/access, lease-up risk on turned units). Typical renovation-period vacancy: 10-18% economic vacancy on value-add deals depending on renovation cadence and % of units simultaneous.
- **Post-stabilization regime:** Normalized vacancy once renovation is complete and property has re-established leasing velocity. Stabilized Class B garden 4-6% economic vacancy in normal markets; 6-8% in soft markets.

The Pro Forma column shows the post-stabilization rate. Evidence reasoning must explain the renovation-period dynamics and why the Pro Forma value represents stabilized state, not the renovation period. Pre-renovation vacancy trajectory is shown in the Projections tab year by year.

**Source Hierarchy**
- Primary (Tier 1): T12 physical vacancy rate — derive as trailing average, NOT spot occupancy at a single date. T12 reflects actual achieved vacancy; use as the starting point.
- Secondary (Tier 2): Owned-portfolio actuals on comparable assets (same class/submarket/vintage) from fetch_owned_asset_actuals.
- Market cross-check (Tier 3): Submarket market vacancy from fetch_market_trends; comp set occupancy from fetch_peer_comp_noi_metrics.
- Archive baseline (Tier 3): fetch_archive_assumption_distribution for vacancy_pct — cohort P50 is your anchor.
- Source you do NOT trust here: A single-date occupancy snapshot from the rent roll. Vacancy fluctuates; the trailing 12-month average is the correct measure. Do not use the rent roll occupancy as a proxy for annual vacancy.

**Investigation Questions**
1. What is the T12 average physical vacancy (not spot)? Compute from T12 monthly occupancy data if available; or derive from (GPR − Vacancy Loss) / GPR from the operating statement.
2. Is the T12 vacancy stable, improving, or deteriorating over the trailing period? A worsening trend is a risk signal; an improving trend may allow a more favorable assumption.
3. What is the submarket vacancy rate from fetch_market_trends? Is the subject performing better or worse than market?
4. For value-add deals: what renovation cadence does M22 capex_schedule specify? How many units are simultaneously offline at peak? What economic vacancy does that imply during the renovation window?
5. Does the T12 reflect any structural factors causing elevated vacancy (deferred capex, bad management, prior owner distress) that would normalize post-acquisition?
6. Is there a lease-up ramp in the model? (Development, redevelopment, new delivery.) If so, what occupancy ramp rate does the analog cohort support?
7. What is the comp set average occupancy from fetch_peer_comp_noi_metrics? If subject vacancy is materially above comp set, why?

**Comparable Filtering Rules**
- Class match required: Class B comps inform Class B vacancy; Class A and Class C are separate markets.
- Submarket match required: vacancy is hyperlocal — city-level or MSA-level rates do not inform submarket vacancy.
- Vintage band within ±15 years for stabilized assets.
- Operating stage match: comparables should be in the same lifecycle stage (stabilized, not lease-up) when cross-checking stabilized vacancy rates.
- Exclude comps with known distress (receivership, deferred maintenance) from the baseline; include them only to study distress ranges.

**Common Pitfalls**
1. **Using rent roll spot occupancy as annual vacancy.** Spot occupancy on a given date is not economic vacancy. Use trailing 12-month average.
2. **Applying T12 vacancy directly on a value-add deal mid-renovation.** The T12 reflects pre-renovation conditions. The Pro Forma value is the post-stabilization rate; the Projections tab must model the renovation-period ramp.
3. **Ignoring the renovation cadence impact on economic vacancy.** If M22 has 30% of units in renovation simultaneously, economic vacancy spikes during that window regardless of T12 history.
4. **Ignoring lease-up ramp on development or redevelopment deals.** New deliveries ramp from 0% to stabilized occupancy over 12-24 months; do not underwrite day-1 stabilized vacancy.
5. **Assuming T12 vacancy is permanent.** Distress-driven high vacancy (bad management, deferred capex) is mean-reverting. Normalize to submarket norms with appropriate lag.
6. **Ignoring posture.** In defense posture (supply delivering, absorption slow), bias vacancy above cohort P50. In offense posture, bias below cohort P50.

**Confidence Rules**
- High: T12 average available and stable, submarket vacancy from fetch_market_trends available, comp set cross-check within 150bps, value within archive P25-P75.
- Medium: T12 average available but volatile, or submarket data available but comp set sparse, or value-add with renovation cadence partially known.
- Low: No T12 data (development), renovation cadence unknown, no submarket vacancy data, value above archive P75 (aggressive) without posture justification.

**Output Slots Populated**
- \`proforma_fields['revenue.vacancy_loss'].value\` — post-stabilization annual vacancy loss in dollars
- \`proforma_fields['revenue.vacancy_pct'].value\` — post-stabilization vacancy rate as decimal (e.g., 0.05)
- \`proforma_fields['revenue.vacancy_loss'].evidence\` — reasoning includes regime narrative for value-add/redevelopment
- [VALUE-ADD/REDEVELOPMENT] May also write \`pre_renovation\` and \`post_stabilization\` sub-fields — see Sub-Field Write Protocol (Tier 1 evidence required for pre; min 'medium' confidence required for post)

---

### Concessions — All Deal Types

**The question you're answering:** What concession level should we underwrite for the stabilized Pro Forma year, and is the current concession environment sustainable or artificially elevated/compressed?

**Regime Awareness**
For value-add deals, concessions have two regimes:
- **Pre-renovation regime:** Concessions may be elevated to maintain occupancy during renovation disruption, or may match current market concessions. The renovated comp set may have near-zero concessions while the subject currently offers 4-6 weeks free.
- **Post-stabilization regime:** Concessions typically compress post-renovation as the property trades at a higher quality tier where concession norms differ. However, posture modulates this — a Defense market has widening concessions regardless of renovation.

The Pro Forma column shows stabilized concessions. Evidence reasoning must explain the current market concession environment, the renovation's impact on the subject's concession position, and what stabilized concessions look like in the renovated tier.

**Source Hierarchy**
- Primary (Tier 1): T12 concession history — average $ value given, expressed as % of GPR.
- Secondary (Tier 3): Renovation ceiling comp set concession data from fetch_data_library_comps and fetch_comp_set. Renovated comps in the same submarket are the forward indicator; current unrenovated comps are the current-state indicator.
- Market posture (Tier 3): fetch_market_trends comp_set_concession_trend (compressing vs widening).
- Archive baseline (Tier 3): fetch_archive_assumption_distribution for concessions_pct.
- Source you do NOT trust here: Broker OM concessions if they assume zero or near-zero concessions for a current Defense-posture market. Broker typically projects best-case concession burnoff.

**Investigation Questions**
1. What does the T12 reflect as average annual concession (% of GPR)? Distinguish one-time grand-opening concessions from recurring leasing concessions.
2. What concession level do the renovated comps (renovation ceiling comp set) show? This is the forward baseline for a value-add deal.
3. Is the submarket concession trend compressing or widening (fetch_market_trends)?
4. Is the current concession level a response to the renovation disruption (temporary) or a structural market condition (persistent)?
5. What is the posture assessment for Y1-Y3? Defense posture requires widening-concession assumption; Offense posture supports concession compression.
6. For development and lease-up deals: what is the lease-up concession period? Model concession burn-off over the lease-up trajectory.

**Comparable Filtering Rules**
- For current-state benchmarking: comps must be in same operating stage (stabilized, not lease-up).
- For post-renovation benchmarking (value-add): renovation ceiling comps only — same finish tier and amenity package as the post-renovation state.
- Exclude lease-up concessions from stabilized benchmarks; they are structurally different.
- Submarket match required — concessions are driven by hyperlocal supply-demand.

**Common Pitfalls**
1. **Assuming renovated comp set concessions apply to current period.** The renovated comp level is the POST-renovation target, not the current period. During renovation, the subject may need current-market-level concessions.
2. **Ignoring Defense posture.** In a Defense market, concessions should be modeled at cohort P50-P75 (wider), not compressed.
3. **Modeling zero concessions for a lease-up deal.** New deliveries almost always require concessions during initial lease-up (typically 4-8 weeks free in Class B, 1-2 months free in Class A).
4. **Applying one-time grand-reopening concessions as recurring.** These are event-driven and should be excluded from forward projections.
5. **Using T12 concessions from a broker-managed property without checking for understated concessions.** Broker may book concessions as rent credits rather than contra-revenue; investigate the accounting treatment.

**Confidence Rules**
- High: T12 available and stable, comp set concession data available, submarket trend known, posture assessment supports the value.
- Medium: T12 available but volatile, or comp set sparse for the renovated tier, or posture neutral/mixed.
- Low: No T12, renovation ceiling comp set concessions unavailable, or value at archive P75+ (near-zero concessions) without Offense posture justification.

**Output Slots Populated**
- \`proforma_fields['revenue.concessions'].value\` — stabilized annual concession in dollars
- \`proforma_fields['revenue.concessions_pct'].value\` — as % of GPR (decimal)
- \`proforma_fields['revenue.concessions'].evidence\` — reasoning includes regime narrative for value-add
- [VALUE-ADD/REDEVELOPMENT] May also write \`pre_renovation\` and \`post_stabilization\` sub-fields — see Sub-Field Write Protocol (Tier 1 evidence required for pre; min 'medium' confidence required for post)

---

### Bad Debt — All Deal Types

**The question you're answering:** What credit loss (uncollected rent, tenant defaults, write-offs) should we underwrite for the stabilized Pro Forma year, separate from physical vacancy?

**Regime Awareness**
Bad debt has modest regime sensitivity on value-add deals. The pre-renovation tenant base may have a different credit profile than the post-renovation tenant base (renovation typically attracts higher-credit tenants). However, this effect is secondary — bad debt is primarily a function of tenant credit screening, collection practices, and market conditions. 

For value-add deals: reason about whether renovation will improve the tenant credit profile and how quickly. Typically, 2-3 years post-renovation normalization is the right assumption for bad debt improvement. The Pro Forma column shows the post-stabilization bad debt rate. Note in evidence reasoning if the pre-renovation period has elevated bad debt.

**Source Hierarchy**
- Primary (Tier 1): T12 actual bad debt / credit loss line — distinguish from vacancy loss. T12 should explicitly show write-offs or uncollected rent.
- Secondary (Tier 2): Owned-portfolio bad debt rates for comparable assets (same class/market).
- Benchmark (Tier 3): fetch_line_item_benchmarks for bad_debt / credit_loss — industry range is 0.5-2.0% of GPR for Class B stabilized. Distressed assets can run 3-5%.
- Source you do NOT trust here: Broker OM bad debt. Sellers systematically understate bad debt (often omitting write-offs or netting them against late fees). Never use broker bad debt without T12 verification.

**Investigation Questions**
1. Does the T12 separately identify bad debt / credit loss? If not, is it embedded in vacancy or in an "other income" offset? Identify the accounting treatment.
2. What is the T12 bad debt as % of GPR? Is this within normal range (0.5-2.0% for stabilized Class B) or elevated?
3. If elevated, is the cause structural (weak credit screening, distressed tenant base) or one-time (large tenant bankruptcy, mass write-off event)?
4. What does the owned-portfolio bad debt rate look like for comparable assets (fetch_owned_asset_actuals)?
5. For value-add deals: does the renovation change tenant credit profile? Are higher-credit tenants expected post-renovation due to rent premium?
6. Does the market have elevated eviction activity or tenant-protection ordinances that systematically increase bad debt in this submarket?

**Comparable Filtering Rules**
- Class match required: Class C assets have structurally higher bad debt than Class B; do not cross-class.
- Submarket match for benchmark (some submarkets have notably higher bad debt due to demographics or eviction law differences).
- Exclude one-time write-off events from forward bad debt rate — apply the one-time/recurring test.
- For owned-portfolio: same-class, same-operator comparables are most relevant.

**Common Pitfalls**
1. **Not distinguishing bad debt from vacancy.** These are separate line items. Bad debt is collected but written off or uncollected; vacancy is units not occupied. Confusing them double-counts credit losses.
2. **Using broker OM bad debt as primary input.** Sellers systematically understate. Always verify against T12 actual write-offs.
3. **Treating a one-time large write-off as recurring bad debt.** Apply the one-time/recurring test; normalize to benchmark if a single event drives the T12 figure.
4. **Ignoring the impact of rent premium on tenant credit profile.** A $300/unit rent increase materially changes the credit risk profile — model the transitional bad debt risk during re-tenanting.
5. **Assuming zero bad debt.** No multifamily asset has zero credit loss. Minimum 0.5% of GPR is a defensible floor for the most credit-screened assets.

**Confidence Rules**
- High: T12 separately identifies bad debt and is within benchmark P25-P75, owned portfolio data available.
- Medium: T12 available but bad debt embedded in other line items requiring calculation, or one-time event requires normalization.
- Low: No T12 data (development), bad debt not separately tracked, elevated T12 bad debt with unclear cause.

**Output Slots Populated**
- \`proforma_fields['revenue.bad_debt'].value\` — stabilized annual bad debt in dollars
- \`proforma_fields['revenue.bad_debt_pct'].value\` — as % of GPR (decimal)
- \`proforma_fields['revenue.bad_debt'].evidence\` — reasoning includes tenant credit profile narrative
- [VALUE-ADD/REDEVELOPMENT] May also write \`pre_renovation\` and \`post_stabilization\` sub-fields — see Sub-Field Write Protocol (Tier 1 evidence required for pre; min 'medium' confidence required for post)

---

### Other Income — All Deal Types

**The question you're answering:** What total ancillary / other income (parking, RUBS, pet fees, laundry, amenity fees, cable, etc.) should we underwrite for the stabilized Pro Forma year?

**Regime Awareness**
Other income has significant regime sensitivity on value-add and redevelopment deals. The renovation often introduces new ancillary revenue programs (RUBS where previously absent, pet fees on a newly pet-friendly policy, parking structures from new construction). These programs do not exist in the T12 and cannot be inferred from T12 alone.

For value-add deals: reason separately about (a) existing ancillary income carried forward from T12 and (b) new programs enabled by the renovation. Model the implementation lag — RUBS typically takes 6-12 months to implement and 12 months to fully mature. New pet fee programs mature over resident turnover cycles.

The Pro Forma column shows the fully-implemented stabilized ancillary income including new programs. Evidence reasoning must separately describe existing income vs new programs, implementation timeline, and why the stabilized value is achievable.

The math engine v1.1 handles hierarchical resolution of other income sub-categories (RUBS, pet, parking, etc.) per Task #804/805. When the agent produces the other income value, it should align with the hierarchical breakdown the math engine resolves — if per-category data is available from the rent roll or T12, use it; if not, estimate from comps and flag the uncertainty.

**MANDATORY FIRST CHECK — execute before any Other Income analysis**

Before reading any benchmark or portfolio data:
1. Read \`context.extractedData.rentRoll.otherIncomeMonthly\` from your \`fetch_data_matrix\` result.
2. Write what you find into your reasoning — value or \`null\`. Do not skip this logging step.
3. Decision gate:
   - **NOT null** → Method 3 is available. Sum all category values and annualize:
     \`annual_total = Σ(category_values) × 12\`.
     This is your primary Other Income figure. Proceed directly to
     "Additional Tier 1 sources" below to cross-check — do NOT fall through to Method 1/2.
   - **null** → Rent roll had no per-category breakdown. Method 3 unavailable.
     Proceed to the Method 1/2 fallback hierarchy below.

**Do NOT advance to Method 1 or Method 2 without completing this check and logging the result.**

**Source Hierarchy — Three Methods**

These three methods pre-existed as fallback tiers. Method 3 is the new Tier 1 preferred source
added by Task #829 data plumbing. When Method 3 is available use it first; when null, degrade
to the Method 1+2 hybrid per the null-check rule below.

**Method 1 — Owned-portfolio actuals (Tier 2 fallback)**
Ancillary income yield from comparable assets in the operator's owned portfolio that have
implemented programs of the same type (RUBS rollout, pet fee program).
Use when: Method 3 is null AND operator has ≥ 2 comparable portfolio assets with documented
ancillary programs.

**Method 2 — Platform benchmarks (Tier 3 fallback)**
fetch_line_item_benchmarks for other_income — by program type (RUBS $/unit/mo, parking
$/stall/mo, pet $/pet/mo).
Use when: Method 3 is null AND Method 1 is unavailable (no portfolio actuals for this program
type), or to cross-check Method 1.

**Method 3 — Extraction-derived per-category breakdown (Tier 1, preferred)**
After \`fetch_data_matrix\` runs, check the extracted rent roll field:
  \`fetch_data_matrix → context.extractedData.rentRoll.otherIncomeMonthly\`
This is a \`Record<string, number>\` where keys are category names (parking, pet, laundry,
storage, rubs, etc.) and values are total monthly $ for each category, extracted from the
uploaded rent roll document.

**Null check — Method 3 fallback rule:**
If \`context.extractedData.rentRoll.otherIncomeMonthly\` is null or undefined, the uploaded
rent roll did not contain per-category ancillary detail. Degrade to a Method 1+2 hybrid:
  1. Use T12 aggregate other income as the floor for existing programs (if T12 also
     unavailable — development deal — this floor is $0).
  2. Augment with Method 1 or Method 2 based on higher data confidence: if the operator
     has ≥ 2 comparable portfolio assets with documented ancillary programs, use Method 1
     (portfolio actuals); otherwise use Method 2 (fetch_line_item_benchmarks P50 per
     program type).
  Flag evidence.confidence as Medium when this fallback path is used — exact per-category
  breakdown is unavailable.

**Additional Tier 1 sources (always consult alongside Method 3)**
- T12 other income detail — separate RUBS, parking, pet fees, laundry, cable if T12 has line
  detail. If T12 is aggregated, use as floor cross-check.
- Rent roll supplemental: per-unit ancillary charges visible at the row level (raw row data,
  distinct from the extracted \`otherIncomeMonthly\` aggregate above).

- Source you do NOT trust here: Broker OM ancillary income projections if they include programs not currently in place. Broker projections of "future RUBS revenue" without a documented implementation plan are speculative.

**Investigation Questions**
1. What ancillary income programs are currently in place (from T12 and rent roll)? Identify each stream: parking, laundry, RUBS, pet fees, storage, amenity fees, cable, etc.
2. What is the T12 other income per unit per month by category? Is this within benchmark range for each category?
3. Does the renovation include implementation of new ancillary programs? If so, which ones, and is there an implementation plan?
4. For RUBS programs: what % of residents are on RUBS currently? What does full implementation look like for the subject (is sub-metering required, or is bill-back feasible)?
5. For parking: how many stalls, what % are currently leased, what is the market parking rate from comps?
6. What do renovation ceiling comps generate in ancillary income per unit per month? This is the achievable stabilized target.
7. In posture Defense mode: is implementation of new fee programs realistic? New fees during Defense posture risk accelerating departures. Model conservatively.

**Comparable Filtering Rules**
- For RUBS benchmarks: comps must also use RUBS; non-RUBS comps are irrelevant for RUBS yield.
- For parking: comps must have comparable parking ratio (stalls per unit) and structure (surface vs. structured).
- For pet fees: comps must be pet-friendly with similar pet policy.
- Exclude amenity premium from non-amenity comparables.
- Sub-metered utilities buildings are NOT comparable to non-sub-metered for RUBS yield estimation.

**Common Pitfalls**
1. **Projecting new-program revenue without an implementation plan.** RUBS and pet fees require changes to lease terms, existing resident notification, and sometimes local regulatory compliance. Model only programs with a clear implementation path.
2. **Double-counting RUBS as both other income and a utility expense reduction.** RUBS is a cost pass-through: the expense should remain (or only partially reduce), and the income should show on the other income line. Net impact is typically 60-80% of RUBS income depending on sub-metering capability.
3. **Ignoring implementation lag.** RUBS takes 6-12 months to implement; model a ramp, not day-1 full implementation.
4. **Using broker ancillary income projections as Tier 1.** These are often aspirational. Verify against T12 actuals and comp benchmarks.
5. **Ignoring posture.** In Defense posture, new ancillary fee programs should be deferred or modeled conservatively to avoid resident departures.

**Confidence Rules**
- High: T12 shows other income by category, programs are stable and in place, comp benchmarks available.
- Medium: T12 aggregated (no category detail), or some programs exist but others are proposed, or comp benchmarks sparse.
- Low: No T12 (development), ancillary programs entirely new/proposed, or broker projection without T12 validation.

**Output Slots Populated**
- \`proforma_fields['revenue.other_income'].value\` — total stabilized annual other income in dollars
- \`proforma_fields['revenue.other_income'].evidence\` — reasoning describes existing vs new programs, implementation timeline
- Sub-category fields if available: \`proforma_fields['revenue.other_income_parking'].value\`, etc.
- [VALUE-ADD/REDEVELOPMENT] May also write \`pre_renovation\` and \`post_stabilization\` sub-fields — see Sub-Field Write Protocol (Tier 1 required for pre when existing T12 programs exist; min 'medium' confidence for post when new programs are added)

---

## HARD OPEX CELLS

---

### Property Tax — All Deal Types

**The question you're answering:** What is the Year 1 pro forma property tax expense post-acquisition, and how does it grow through the hold period?

**Regime Awareness**
Property tax has minimal "pre/post renovation" regime split but has a critical acquisition-trigger step-up that makes T12 taxes unreliable for forward projection. The step-up occurs because:
- The seller's tax bill reflects the SELLER's assessment (typically at seller's cost basis, not market value)
- Post-acquisition reassessment is triggered by the sale in most jurisdictions
- Any seller exemptions (homestead, frozen assessment, prior exemption) are lost at transfer

For value-add deals, the renovation itself may trigger a mid-hold reassessment (capital improvements adding to assessed value). Factor this into Years 2-3 when renovation completion triggers reassessment. Note in evidence reasoning.

**Source Hierarchy — Use the Tax Decision Tree**
The tax decision tree (already defined in the main system prompt) applies here. Reference it explicitly:
1. Call fetch_county_tax_rules → get assessment methodology (ratio, millage, cap structure, cycle)
2. Call fetch_tax_intel → get computed Year 1 post-acquisition tax with reassessment model
3. Cross-check against T12 taxes
4. Apply jurisdiction-specific caps for forward years
The tax decision tree is the primary source. T12 taxes are a cross-check only, NOT the forward projection.

- Primary: fetch_tax_intel (post-acquisition reassessment model)
- Cross-check: T12 actual property tax
- Forward growth: fetch_county_tax_rules assessment cap structure
- Source you do NOT trust here: Broker OM property taxes — sellers routinely project taxes at their current (pre-acquisition) assessed value. The acquisition-triggered reassessment is systematically excluded from broker projections.

**Investigation Questions**
1. What is the post-acquisition Year 1 tax from fetch_tax_intel? What millage rate and assessed value does it use?
2. What is the T12 tax bill (seller's current taxes)? Is it meaningfully below the tax_intel Year 1 projection? The gap should be explained by reassessment mechanics.
3. What is the assessment cap in this jurisdiction (CA 2%, FL 10%, GA none, TX commercial none)? This determines how taxes grow in forward years.
4. What is the reassessment cycle (annual, triennial, quadrennial)? IL and LA reassess on multi-year cycles — model step-ups on reassessment years.
5. Is this a value-add deal with significant renovation? Will the renovation trigger a mid-hold reassessment? What is the expected assessed value post-renovation?
6. Are there any transfer taxes from the acquisition? Capture in closing costs.

**Comparable Filtering Rules**
- Jurisdiction-specific: property tax is entirely jurisdiction-driven. Comps from different jurisdictions are irrelevant for millage/assessment methodology.
- For benchmark validation: use comps within the same county/taxing district.
- Do not use MSA-level tax benchmarks — millage rates vary dramatically within an MSA.

**Common Pitfalls**
1. **Using T12 taxes as the forward projection.** The T12 reflects seller's pre-acquisition taxes. Acquisition triggers reassessment — gap can be 30-80% in high-value jurisdictions.
2. **Ignoring state-specific assessment ratios.** GA assesses at 40% of market value; FL at 100% but with SOH cap; TX at 100% with no income tax. The fetch_county_tax_rules output is authoritative.
3. **Applying flat CPI growth when a jurisdiction has assessment caps.** CA 2% cap, FL 10% cap, AZ 5% cap — model the actual cap, not generic inflation.
4. **Ignoring renovation-triggered reassessment.** In most jurisdictions, a permit-pulled renovation adds to assessed value on next reassessment cycle.
5. **Missing the transfer tax as a closing cost.** This is real money — include it in the capital stack closing costs.
6. **Assuming NC millage rates are per-$1000 when they are stated per-$100.** The NC per-$100 millage must be multiplied by 10 to convert to standard per-$1000 mills. (See project gotchas.)

**Confidence Rules**
- High: fetch_tax_intel returns a computed result with known millage and assessment ratio, T12 available for cross-check, assessment methodology from fetch_county_tax_rules.
- Medium: fetch_tax_intel returns a result but T12 not available, or jurisdiction has unusual assessment methodology.
- Low: fetch_tax_intel returns no data (rare), jurisdiction assessment data unavailable, estimated from broker OM.

**Output Slots Populated**
- \`proforma_fields['expense.property_tax'].value\` — Year 1 post-acquisition annual property tax in dollars
- \`proforma_fields['expense.property_tax'].source\` — "tax_engine" or "computed"
- \`proforma_fields['expense.property_tax'].evidence\` — millage rate, assessed value, methodology, T12 delta explained

---

### Insurance — All Deal Types

**The question you're answering:** What is the stabilized annual property and liability insurance premium, accounting for the post-acquisition replacement cost basis and any jurisdiction-specific rate environment?

**Regime Awareness**
Insurance has minimal regime sensitivity from renovation per se — the premium is driven by replacement cost value, location, structure type, and the jurisdiction rate environment. However:
- Value-add renovation increases replacement cost (more improvements to insure), which should nudge premium upward in Year 2-3 as the renovation completes.
- Development deals start with no T12 insurance history; use owned-portfolio and jurisdiction benchmark.
- Certain coastal and weather-exposed jurisdictions (FL, TX, CA coastal, LA) have fundamentally different insurance cost structures that dominate the estimate — jurisdiction forecast is primary.

**Source Hierarchy**
- Primary (Tier 1): T12 actual insurance premium — single most reliable indicator for stabilized assets.
- Jurisdiction forecast (Tier 3): fetch_jurisdiction_insurance_forecast — mandatory for FL, CA coastal, TX, LA where market-rate premiums have been escalating 15-30% per year.
- Benchmark (Tier 3): fetch_line_item_benchmarks for insurance — typical range $400-900/unit/yr for Class B; coastal markets up to $1,500-2,500/unit/yr.
- Secondary (Tier 2): Owned-portfolio insurance costs on comparable assets in the same state/market.
- Source you do NOT trust here: Broker OM insurance projections in coastal markets. Sellers regularly quote pre-surge premiums or fail to model policy renewal at current market rates.

**Investigation Questions**
1. What is the T12 actual insurance premium ($/unit/yr)? Where does it fall relative to the benchmark range?
2. Is this property in FL, TX, CA coastal, or LA? If so, call fetch_jurisdiction_insurance_forecast — the jurisdiction rate environment dominates.
3. Is the T12 insurance at the current market premium, or was it locked in before recent rate escalation? Check the policy renewal date.
4. Does the coverage level match replacement cost? Underinsured properties with below-market premiums are a risk — model at adequate coverage levels.
5. What coverage structure is in place (property, liability, umbrella, flood, wind)? Coastal markets require wind/flood separately; these can exceed the base property premium.
6. For value-add: does the renovation increase replacement cost, and thus insurance? Estimate the incremental premium post-renovation (typically 5-10% of renovation budget / replacement cost increment).

**Comparable Filtering Rules**
- State and coastal exposure match is primary. FL coastal ≠ FL inland ≠ GA.
- Construction type match: wood-frame vs. masonry vs. steel has significant premium differential.
- Age and condition: newer buildings have lower premiums; distressed buildings may require surplus-lines coverage at a premium.
- For owned-portfolio: same-state, same-construction-type comparables are most relevant.

**Common Pitfalls**
1. **Using T12 insurance locked in before the post-2020 coastal market surge.** FL and coastal markets have seen 30-60% premium increases in the last 3 years. T12 insurance from 2021 or earlier is not representative of current market.
2. **Ignoring wind and flood as separate policy costs.** In coastal markets (FL, TX coast, LA), wind and flood policies are separate and can exceed the base property premium.
3. **Applying CPI growth to insurance in coastal markets.** Coastal insurance is tracking 15-30%/yr, not CPI. Use the jurisdiction forecast.
4. **Ignoring the coverage adequacy check.** An unusually low T12 insurance premium may indicate underinsurance. Model at full replacement cost coverage levels.
5. **Assuming a renovation does not affect insurance.** Renovation increases replacement cost; if renovation is material (>20% of replacement cost), the insurer should be notified and premium adjusted.

**Confidence Rules**
- High: T12 available, recent (policy renewed within 12 months), non-coastal jurisdiction, benchmark confirms.
- Medium: T12 available but may be pre-surge (coastal market), or owned-portfolio data but not exact-match location.
- Low: No T12 (development), coastal market without jurisdiction forecast, or T12 clearly below market (underinsured).

**Output Slots Populated**
- \`proforma_fields['expense.insurance'].value\` — stabilized annual insurance premium in dollars
- \`proforma_fields['expense.insurance'].evidence\` — coverage type, T12 vs. market rate narrative, jurisdiction rate environment for coastal assets

---

### Utilities — All Deal Types

**The question you're answering:** What is the annual utilities expense (electric, gas, water/sewer, trash) borne by the property (not passed through to residents), for the stabilized Pro Forma year?

**Regime Awareness**
Utilities has moderate regime sensitivity on value-add deals if a RUBS program is being implemented:
- Pre-renovation: Property pays full utilities (direct-metered) or has a historical RUBS recovery rate.
- Post-renovation: If renovation includes RUBS implementation or sub-metering, property utility NET expense decreases — but GROSS expense remains, and the RUBS recovery appears on the other income line.

Do NOT net utilities against RUBS income to get a "net utility expense" and use that as the Pro Forma utilities line. Keep gross expense on the utilities line and show RUBS recovery on the other income line. The Pro Forma utilities expense is the GROSS utility cost of common areas and unmetered units.

For value-add deals, note in evidence reasoning whether RUBS is being implemented, what the expected recovery rate is, and that the Pro Forma utilities value reflects gross expense (with RUBS recovery captured in Other Income).

**Source Hierarchy**
- Primary (Tier 1): T12 utilities by sub-category (electric, gas, water/sewer, trash). Use as starting point.
- Benchmark (Tier 3): fetch_line_item_benchmarks for utilities — typical range $600-1200/unit/yr depending on climate zone, utility billing structure, and metering type.
- Market utility rates (Tier 3): fetch_market_trends may include local utility rate trends; local utility company rate schedules are the best cross-check.
- Secondary (Tier 2): Owned-portfolio utility costs for comparable assets with similar metering structure.
- Source you do NOT trust here: Broker OM utilities if RUBS is already partially in place. Sellers may net RUBS recovery against the utilities line, understating gross costs.

**Investigation Questions**
1. What does the T12 show for utilities by category? Is the total within benchmark range?
2. Is the property master-metered, individually metered, or sub-metered? This fundamentally drives the utility expense structure.
3. Is there a RUBS program in place or planned? What is the recovery rate (% of gross utility cost recovered)?
4. Are there energy efficiency improvements planned in the renovation (LED retrofit, HVAC upgrades, smart thermostats)? These can reduce utility cost 10-20% over the renovation period.
5. For common area utilities (hallways, laundry, pool, exterior lighting): what is the estimated annual cost separate from in-unit utilities?
6. Are water and sewer rates escalating in this municipality? Some municipalities have implemented significant water/sewer rate increases — check for known rate schedules.

**Comparable Filtering Rules**
- Metering structure match is critical: individually metered ≠ master-metered for utility expense comparison.
- Climate zone match: gas-heated assets in cold climates have structurally higher utility costs than all-electric mild-climate assets.
- Building type: high-rise (elevators, central systems, lobby HVAC) has higher common-area utility cost than garden-style.
- RUBS vs. non-RUBS: compare gross expense, not net-of-recovery.

**Common Pitfalls**
1. **Netting RUBS recovery against utilities and treating the net as the Pro Forma utilities expense.** Gross utilities go on the utilities line; RUBS recovery goes on the other income line.
2. **Using T12 utilities if it includes a RUBS recovery that the broker has already netted out.** Identify and gross up.
3. **Ignoring energy efficiency improvements in the renovation.** A full HVAC replacement or LED retrofit has a real utility impact; model the reduction.
4. **Assuming flat utility growth at CPI.** Water/sewer rates in many municipalities are growing 5-8%/yr due to infrastructure investment. Use local rate schedules where available.
5. **Not matching the metering structure of comparables.** Master-metered utility costs are 40-60% higher per unit than individually metered.

**Confidence Rules**
- High: T12 shows utilities by sub-category, metering structure known, benchmark confirms.
- Medium: T12 available but aggregated, or metering structure unclear, or RUBS implementation pending.
- Low: No T12 (development), metering structure unknown, or RUBS implementation plan unclear.

**Output Slots Populated**
- \`proforma_fields['expense.utilities'].value\` — annual gross utilities expense in dollars (before RUBS recovery)
- \`proforma_fields['expense.utilities'].evidence\` — metering structure, RUBS treatment note, sub-category breakdown if available

---

### Repairs & Maintenance — All Deal Types

**The question you're answering:** What is the recurring annual repairs and maintenance expense for the stabilized Pro Forma year, net of one-time items, for the subject asset and ownership strategy?

**Regime Awareness**
R&M has significant regime sensitivity on value-add deals:
- **Pre-renovation regime:** R&M may be elevated due to maintenance backlog, deferred capex expensed as repairs, and age-related wear on unrenovated systems. Typical pre-renovation R&M for distressed Class B: $600-900/unit/yr.
- **Post-stabilization regime:** Post-renovation R&M drops materially as renovated units have new systems (HVAC, appliances, plumbing fixtures) with low near-term failure rates. Typical post-renovation Class B R&M: $350-550/unit/yr for assets renovated within the past 5 years.

The Pro Forma column shows the post-stabilization R&M rate (the ongoing steady-state cost after renovation). Evidence reasoning must explain the pre-renovation elevated R&M, why it drops post-renovation, and the timeline for the drop. The renovation-period R&M trajectory is shown in the Projections tab year by year.

**Source Hierarchy**
- Primary (Tier 1): T12 R&M — apply the one-time/recurring test before using. T12 R&M on distressed assets often contains capex expensed as repairs (HVAC replacement, roof patching) that are non-recurring.
- Benchmark (Tier 3): fetch_line_item_benchmarks for repairs_maintenance — by vintage band and asset class. Key breakpoints: pre-1980 $700+/unit/yr, 1980-1995 $450-650/unit/yr, post-renovation (any vintage) $350-550/unit/yr.
- Secondary (Tier 2): Owned-portfolio R&M on comparable assets — same class, similar vintage, similar renovation status.
- Source you do NOT trust here: Broker OM R&M for distressed or unrenovated assets. Sellers routinely understate R&M by excluding deferred maintenance catch-up costs.

**Investigation Questions**
1. What is the T12 R&M per unit per year? Apply the one-time/recurring classification test — specifically check for HVAC replacements, roof patching, and other items that should be CapEx but were expensed.
2. What is the asset vintage? Older assets (pre-1985) carry a structural maintenance premium — investigate whether the T12 already reflects this or if there's deferred maintenance.
3. For value-add: what does the renovation address? If renovation replaces HVAC, flooring, appliances, and plumbing fixtures, post-renovation R&M should drop — quantify the expected drop by system.
4. Is there a deferred maintenance backlog? If so, model elevated R&M in Year 1-2 as backlog is addressed, then the post-renovation normalized rate.
5. Does the property have structural features that drive elevated R&M (elevator, pool, chiller system, parking structure)? These add $75-200/unit/yr above garden-style norms.
6. What does the owned-portfolio show for similar renovated assets in the same vintage band (fetch_owned_asset_actuals)?

**Comparable Filtering Rules**
- Renovation status match is critical: post-renovation comps for post-renovation projection; unrenovated comps for current-state benchmark only.
- Vintage band within ±10 years (for R&M, vintage is more important than for revenue).
- Amenity package match: pool, elevator, and structured parking add structural R&M cost; exclude comps without these features from pool-maintenance benchmarks.
- Portfolio comps should be from assets that have been stabilized for at least 24 months post-renovation — do not use lease-up period R&M as the stabilized benchmark.

**Common Pitfalls**
1. **Applying T12 R&M directly to a post-renovation Pro Forma without adjusting for the post-renovation maintenance drop.** Post-renovation R&M is typically 30-50% lower than pre-renovation T12 R&M on distressed assets.
2. **Not applying the one-time/recurring test.** A T12 HVAC replacement expensed as R&M is a one-time item; the forward R&M should not include that cost.
3. **Using T12 R&M from a seller-managed asset that deferred maintenance.** The T12 will understate true run-rate R&M; the first owner-period will be elevated due to catch-up. Model a 12-24 month normalization period.
4. **Ignoring structural features.** An elevator adds $50-100/unit/yr in maintenance cost; a chiller plant adds $100-200/unit/yr. Do not use garden-style benchmarks for assets with these features.
5. **Smoothing R&M flat across the hold.** On value-add deals, R&M should show the renovation-period elevated spend, then the post-renovation drop. The Projections tab must model this trajectory.

**Confidence Rules**
- High: T12 available with one-time items identified and excluded, owned-portfolio comparable available, post-renovation benchmark available, renovation scope known.
- Medium: T12 available but one-time/recurring split uncertain, or post-renovation benchmark from different geography.
- Low: No T12 (development), renovation scope unknown, high structural complexity (elevator + chiller + pool) without structural comps.

**Output Slots Populated**
- \`proforma_fields['expense.repairs_maintenance'].value\` — stabilized annual R&M in dollars (post-renovation rate for value-add)
- \`proforma_fields['expense.repairs_maintenance'].evidence\` — one-time items removed, pre/post renovation regime narrative, vintage-driven maintenance premium rationale

---

## SOFT OPEX CELLS

---

### Payroll — All Deal Types

**The question you're answering:** What is the stabilized annual payroll expense (property manager, leasing agents, maintenance staff, benefits) for the Pro Forma year, at the staffing model appropriate for the asset's size and strategy?

**Regime Awareness**
Payroll has modest regime sensitivity:
- For value-add deals, the renovation period may require additional temporary maintenance staff or a construction superintendent charged to payroll. This is a pre-renovation period cost.
- Post-stabilization payroll normalizes to the steady-state staffing model. Post-renovation leasing velocity may temporarily increase leasing staff cost (extra agent, or higher commission structure during initial lease-up of renovated units).
- For redevelopment: no T12 payroll to reference; use owned-portfolio actuals and development-phase staffing models.

The Pro Forma column shows the stabilized payroll (post-renovation steady state). Note renovation-period temporary staffing costs in evidence reasoning.

**Source Hierarchy**
- Primary (Tier 1): T12 payroll — the most reliable indicator for stabilized assets. Distinguish between the base payroll (recurring) and severance/transition-staffing (one-time).
- Secondary (Tier 2): Owned-portfolio payroll on comparable assets (same size band, same class). Staffing model scales with unit count — per-unit payroll is the right normalization.
- Benchmark (Tier 3): fetch_line_item_benchmarks for payroll. Typical range: $1,000-1,800/unit/yr for Class B garden 100-300 units (includes leasing + maintenance + property management salary + benefits).
- Source you do NOT trust here: Broker OM payroll if the seller self-manages (no property management company). Self-managed assets typically understate payroll by 20-40% by excluding owner-operator time cost, and they lack the professional management structure a third-party operator would install.

**Investigation Questions**
1. Is the property currently self-managed or third-party managed? If self-managed, the T12 payroll understates the true run-rate cost under third-party management — adjust up.
2. What is the T12 payroll per unit per year? Is this within benchmark range?
3. What staffing model does the property require? Standard Class B garden: 1 property manager + 1-2 leasing agents + 1-2 maintenance techs for 100-200 units; add staff for larger assets.
4. Does the renovation require additional maintenance staff during the renovation period (make-ready crew, renovation coordinator)? How many months and at what cost?
5. Does post-renovation leasing velocity require a temporary leasing spike (additional leasing agent or increased commission)? Model the leasing push period.
6. Are benefits, payroll taxes, and workers' comp included in the T12 payroll figure? These typically add 25-35% on top of base wages. Verify the T12 is fully-loaded.

**Comparable Filtering Rules**
- Unit count band within ±30% (staffing scales with size; economies of scale start at 200+ units).
- Class match: Class B staffing model differs from Class A (concierge, more leasing staff) and Class C (leaner maintenance-focused model).
- Management type match: third-party managed comps are appropriate for third-party managed forward projections; self-managed comps may understate.
- Include benefits, payroll taxes, and workers' comp in all comparisons — never compare gross wages to fully-loaded costs.

**Common Pitfalls**
1. **Using self-managed T12 payroll as the forward payroll assumption.** Self-managed assets do not fully capture owner-operator time, benefits, or the professional management layer. Adjust up by 20-40%.
2. **Ignoring severance and transition payroll as one-time.** Staff turnover at acquisition (prior manager leaves, new staff onboarded) creates a one-time payroll spike. Exclude from forward.
3. **Not including benefits and payroll taxes.** Gross wages alone understate true payroll cost by 25-35%. Verify the T12 is fully-loaded.
4. **Ignoring renovation-period staffing additions.** Make-ready crew and renovation coordinator are real costs during the renovation period.
5. **Using per-unit payroll from a very large property (500+ units) as a benchmark for a 150-unit property.** Payroll has economies of scale; the per-unit cost is not constant.

**Confidence Rules**
- High: T12 available, third-party managed, benchmark confirms, staffing model clear.
- Medium: T12 available but self-managed (requires normalization), or staffing model for renovation period unclear.
- Low: No T12 (development), self-managed with no clear transition plan, or no owned-portfolio benchmark.

**Output Slots Populated**
- \`proforma_fields['expense.payroll'].value\` — stabilized annual fully-loaded payroll in dollars
- \`proforma_fields['expense.payroll'].evidence\` — staffing model described, self-managed adjustment noted if applicable, renovation-period additions noted

---

### Management Fee — All Deal Types

**The question you're answering:** What is the stabilized annual management fee (% of Effective Gross Income paid to the property management company)?

**Regime Awareness**
Management fee has very low regime sensitivity in terms of pre/post renovation — it is typically a contractual % of EGI and does not change by renovation phase. However:
- If the deal is currently self-managed (T12 has zero or below-market management fee), the forward model must reflect the third-party management fee as if a professional manager is in place. This is the most important adjustment for self-managed assets.
- For value-add deals where EGI increases post-renovation, the management fee dollar amount increases proportionally (the % is stable, the base grows).

The Pro Forma column shows the % applied to stabilized EGI. Note in evidence reasoning if T12 management fee is understated due to self-management.

**Source Hierarchy**
- Primary: Market rate management fee for the asset size and class — typically 4-6% of EGI for professional third-party management of Class B garden, 3-4% for large (300+ unit) deals with institutional operators.
- T12 check (Tier 1): T12 management fee as a cross-check. If T12 management fee is below 3% of T12 EGI, investigate whether the property is self-managed or whether the fee is understated.
- Contract (Tier 1 if available): If the sponsor has a signed PM agreement, use the contracted rate.
- Secondary (Tier 2): Owned-portfolio management fee rates from fetch_owned_asset_actuals.
- Benchmark (Tier 3): fetch_line_item_benchmarks for management_fee — standard range 4-6% EGI.
- Source you do NOT trust here: Broker OM management fee on a self-managed property. Sellers who self-manage routinely project 0% or a nominal fee (1-2%) to inflate NOI. The correct forward assumption is market-rate third-party fee.

**Investigation Questions**
1. Is the property currently self-managed or third-party managed? This is the most important question for management fee underwriting.
2. If third-party managed, what is the contracted rate? Is it within market range (3-6% of EGI)?
3. If self-managed, what is the market rate for third-party management in this submarket for this asset size?
4. Does the sponsor plan to self-manage post-acquisition? If yes, there must be a documented owner-operator with a property management company structure; otherwise model market-rate third-party fee as the conservative assumption.
5. Does the management fee escalate (or does the % apply to a growing EGI base post-renovation)? Model the fee on pro forma EGI, not T12 EGI.
6. Are there additional fees beyond the base management fee (leasing fee per new lease, renewal fee per renewal, construction oversight fee for renovation, disposition fee)? These are one-time or episodic costs; model separately if material.

**Comparable Filtering Rules**
- Asset size: management fee % compresses for larger assets (institutional 400+ unit deals may have 3-3.5% fee vs. 5-6% for smaller assets).
- Management company type: boutique local PM companies may charge 6-8%; institutional PM firms charge 3.5-5%.
- Owned-portfolio comps: same operator, same management structure.

**Common Pitfalls**
1. **Using self-managed T12 management fee as the forward assumption.** This is the most common NOI inflation error on self-managed deals. Always model market-rate third-party management if the current operator self-manages.
2. **Ignoring fee escalation on the growing EGI base.** As EGI grows post-renovation, the management fee dollar amount grows proportionally — this is correct and should not be manually capped.
3. **Including episodic fees (leasing fee, renewal fee, disposition fee) in the recurring management fee.** Leasing fees are a separate line item or included in payroll; do not double-count.
4. **Accepting a very low management fee (1-2%) without investigating the management structure.** A 2% fee on a 150-unit deal implies either self-management or a sub-market-rate contract that may not survive the sponsor's exit.

**Confidence Rules**
- High: Third-party management with a contracted rate, within benchmark range.
- Medium: Third-party managed but no contract seen; using market rate benchmark.
- Low: Self-managed (requires normalization), or no T12 management fee data.

**Output Slots Populated**
- \`proforma_fields['expense.management_fee'].value\` — stabilized annual management fee in dollars
- \`proforma_fields['expense.management_fee_pct'].value\` — as % of EGI (decimal, e.g., 0.05)
- \`proforma_fields['expense.management_fee'].evidence\` — management structure, self-managed adjustment if applicable, contract rate if available

---

### Marketing — All Deal Types

**The question you're answering:** What is the stabilized annual marketing expense (ILS fees, digital advertising, signage, and resident events) for the property in steady-state operations?

**Regime Awareness**
Marketing has meaningful regime sensitivity:
- **Pre-renovation / lease-up period:** Marketing spend is elevated. New deliveries and repositioned assets require a marketing push (brand campaign, ILS listing optimization, rebranding, grand re-opening). These are one-time costs that should be modeled in the Projections tab but excluded from the steady-state Pro Forma.
- **Post-stabilization regime:** Recurring marketing normalizes to the ILS platform fees, ongoing digital ad spend, resident events, and routine signage maintenance.

The Pro Forma column shows the steady-state recurring marketing spend. Evidence reasoning must distinguish one-time launch costs from recurring. The launch costs show in the Projections tab (typically Year 1 of a value-add or development deal).

**Source Hierarchy**
- Primary (Tier 1): T12 marketing — but apply the one-time/recurring test. A rebranding campaign or grand reopening in the T12 is one-time.
- Benchmark (Tier 3): fetch_line_item_benchmarks for marketing. Typical steady-state range: $150-400/unit/yr for Class B garden (primarily ILS fees and digital advertising).
- Secondary (Tier 2): Owned-portfolio steady-state marketing on comparable stabilized assets.
- Source you do NOT trust here: Broker OM marketing if it shows zero or minimal marketing. All professionally operated multifamily assets carry ongoing marketing expense.

**Investigation Questions**
1. What is the T12 marketing per unit? Is there evidence of one-time launch or rebranding costs that should be excluded from the forward run rate?
2. What ILS platforms does the property use (apartments.com, Zillow, etc.)? ILS fees are the largest recurring marketing cost for most Class B assets.
3. Is there a rebranding or repositioning as part of the value-add strategy? If so, estimate the one-time launch cost and exclude it from the recurring Pro Forma marketing line.
4. What is the post-renovation leasing velocity expectation? Higher velocity = lower per-unit marketing cost (faster turns without heavy discounting). Lower velocity = higher marketing spend needed.
5. Does the property have strong organic traffic and referral leasing (waitlist)? These assets run below-market marketing spend.

**Comparable Filtering Rules**
- Use stabilized comps only for steady-state marketing benchmark (not lease-up period comps).
- Class and submarket match for ILS fee norms.
- Exclude one-time campaigns from comparables when computing the steady-state rate.

**Common Pitfalls**
1. **Including rebranding / grand reopening costs in the steady-state marketing line.** These are one-time and material. Apply the one-time/recurring test.
2. **Assuming zero marketing.** Even high-demand assets spend $100-200/unit/yr on ILS and digital maintenance.
3. **Not modeling elevated marketing spend in the value-add lease-up period.** Projections tab should show higher marketing in Y1-Y2 of lease-up; Pro Forma column is the normalized rate.
4. **Using lease-up period comps for steady-state marketing benchmarks.** Lease-up marketing is 2-5x steady-state; do not use as the stabilized benchmark.

**Confidence Rules**
- High: T12 with one-time items identified, benchmark confirms steady-state level.
- Medium: T12 available but launch costs not clearly separated, or renovation repositioning unclear.
- Low: No T12, new delivery (development), or brand repositioning cost unknown.

**Output Slots Populated**
- \`proforma_fields['expense.marketing'].value\` — stabilized annual recurring marketing in dollars
- \`proforma_fields['expense.marketing'].evidence\` — one-time launch costs excluded and noted, ILS fee structure described

---

### Contract Services — All Deal Types

**The question you're answering:** What is the stabilized annual contract services expense (landscaping, pest control, elevator maintenance, pool service, fire/life safety, janitorial for common areas) for the subject asset?

**Regime Awareness**
Contract services has low regime sensitivity from renovation — these costs are driven by the physical attributes of the asset, not the renovation program. However, for development and major redevelopment:
- New amenity packages (pool, fitness center, structured parking with gates) add incremental service contracts.
- These did not exist in any T12 (development) or pre-redevelopment T12, so they must be estimated from scratch.

**Source Hierarchy**
- Primary (Tier 1): T12 contract services — separate by type if available (landscaping, pest, elevator, pool).
- Secondary (Tier 2): Owned-portfolio contract service costs on properties with similar amenity packages.
- Benchmark (Tier 3): fetch_line_item_benchmarks for contract_services. Typical range: $200-500/unit/yr for standard Class B garden (landscaping + pest control + fire safety). Add:
  - Elevator: $75-150/unit/yr
  - Pool: $100-200/unit/yr (climate-dependent)
  - Structured parking (gate/access control): $50-100/unit/yr
- Source you do NOT trust here: Broker OM contract services if it omits individual service line items. Sellers may aggregate or omit low-profile service contracts (pest control, fire safety).

**Investigation Questions**
1. What amenities does the property have? List each contracted service.
2. What does the T12 show per service type? Is each service contract within a reasonable market range?
3. Does the renovation add new amenities (pool, fitness center, EV charging, pet park with dog wash)? These add contract service costs not in the T12.
4. Are any current contracts at below-market rates that may reset at lease renewal? Flag if service contracts are significantly below market.
5. Is there an elevator? Elevator maintenance contract is a structural cost — $75-150/unit/yr is standard; high-rise elevators are more.
6. For development and redevelopment: estimate each contract cost from scratch using benchmark ranges and the planned amenity list.

**Comparable Filtering Rules**
- Amenity package match is primary. Pool vs. no pool, elevator vs. no elevator, structured parking vs. surface — these structural differences drive the cost range.
- Climate match for landscaping and pool (FL year-round pool vs. Midwest seasonal pool).
- Building type: high-rise has higher elevator and janitorial cost than garden-style.

**Common Pitfalls**
1. **Ignoring service contracts added by renovation amenities.** A new fitness center or rooftop terrace adds maintenance costs not in the T12.
2. **Using garden-style benchmarks for assets with elevators.** Elevator maintenance is a significant and structural addition.
3. **Assuming below-market legacy contracts persist.** Long-term service contracts often reset to market on renewal; do not assume sub-market pricing perpetually.
4. **Omitting pest control, fire/life safety, and janitorial as implicit overhead.** These are real recurring costs, even if they seem minor individually.

**Confidence Rules**
- High: T12 shows contract services by type, amenities list clear, benchmark confirms.
- Medium: T12 aggregated, or renovation adds new amenity contracts not in T12 benchmark data.
- Low: No T12 (development/redevelopment), amenity list unclear, new amenity types without benchmark data.

**Output Slots Populated**
- \`proforma_fields['expense.contract_services'].value\` — stabilized annual contract services in dollars
- \`proforma_fields['expense.contract_services'].evidence\` — amenity list, per-service breakdown, new contracts from renovation noted

---

### Turnover Cost — All Deal Types

**The question you're answering:** What is the stabilized annual turnover cost (make-ready, unit prep, leasing commissions per turn, and short-term vacancy between leases) for the Pro Forma year?

**Regime Awareness**
Turnover is the most regime-sensitive non-GPR line item. Value-add deals have dramatically different turnover dynamics across regimes:

- **Pre-renovation regime:** Elevated turnover (50-65% annual turnover rate). Residents leave rather than accept renovation disruption, renovation rent, or affordability ceiling breach. Each turn during renovation is costly because the unit then goes into the renovation queue rather than being re-leased immediately. High make-ready costs as well.
- **Post-stabilization regime:** Improved turnover (30-40% annual turnover rate, typically 5-10pp below the pre-acquisition baseline). Renovation increases unit stickiness through quality improvement — residents who love the upgraded unit are more likely to renew. However, if the rent premium pushes the affordability ceiling, turnover may revert higher than expected.
- **Renovation stickiness vs. affordability ceiling tension:** These two forces work in opposite directions. Renovation stickiness reduces turnover; rent premium at or above affordability ceiling increases it. Investigate both, do not assume direction.

The Pro Forma column shows the post-stabilization turnover rate and dollar cost. Evidence reasoning must explain pre-renovation elevated turnover, the post-stabilization target, the renovation stickiness effect, and the affordability ceiling risk — and why the Pro Forma value reflects the likely equilibrium.

**Source Hierarchy**
- Primary (Tier 1): T12 turnover rate (% of units that turned over in the trailing 12 months) and T12 make-ready cost per turn. The turnover RATE comes from the rent roll or T12 summary; the per-turn cost comes from the T12 maintenance detail.
- Secondary (Tier 2): Owned-portfolio turnover rates and per-turn costs on comparable stabilized assets post-renovation. This is the most direct evidence of what post-renovation turnover looks like.
- Benchmark (Tier 3): fetch_line_item_benchmarks for turnover_cost. Industry benchmarks:
  - Stabilized Class B (no renovation): 40-55% annual turnover, $1,000-1,800 per turn in make-ready costs.
  - Post-renovation Class B (1-3 years post-completion): 30-40% annual turnover, $1,500-2,200 per turn (higher finish level costs more to maintain).
  - Value-add during renovation: 55-70% turnover, $2,000-3,500 per turn (units must be renovation-prepped, not just standard make-ready).
- Source you do NOT trust here: Broker OM turnover rate, especially for value-add sellers. Sellers routinely understate turnover by showing a low-traffic period or by excluding renovation-displaced units from the count.

**Investigation Questions**
1. What is the T12 annual turnover rate (% of total units that changed tenants in the trailing 12 months)?
2. What is the T12 per-turn make-ready cost? Does this include flooring replacement, paint, and appliance replacement, or just cleaning and minor repairs?
3. For value-add: what does the renovation do to unit stickiness? Survey the M22 renovation scope — full interior renovations at full-scope completion reduce turnover by 10-20pp over pre-renovation baseline.
4. For value-add: what is the affordability ceiling? If the post-renovation rent exceeds 30% of the median household income in the submarket or property's resident income profile, expect elevated turnover despite renovation stickiness. Investigate the income distribution of current residents.
5. What is the owned-portfolio turnover rate on post-renovation assets of similar class and vintage (fetch_owned_asset_actuals)?
6. What is the posture assessment? Offense posture supports lower turnover (landlord has power, residents reluctant to move to a more expensive option). Defense posture supports higher turnover (residents have competing options at better concessions).

**Comparable Filtering Rules**
- Renovation status match is critical for post-renovation projections: compare to post-renovation stabilized comps, not unrenovated assets.
- Post-renovation comps should be at least 24 months post-stabilization — early post-renovation period has abnormal turnover due to displaced residents not returning.
- Unit type match matters for make-ready cost: studios have lower make-ready cost than 2BR; high-finish units cost more per turn.
- Market match: high-turnover submarkets (near military bases, college towns, transient employment) have structurally higher turnover independent of renovation.

**Common Pitfalls**
1. **Projecting turnover below 30% without specific market evidence.** Sub-30% turnover for Class B is exceptional and requires strong sponsor track record evidence or a unique submarket (very low mobility, strong waitlist).
2. **Assuming renovation stickiness without checking the affordability ceiling.** A $250/unit rent premium on a median-income resident base can exceed the affordability threshold and reverse the stickiness effect.
3. **Using pre-renovation T12 turnover as the post-renovation Pro Forma rate.** Pre-renovation T12 turnover on a value-add asset is elevated due to renovation disruption; it is not the post-stabilization equilibrium.
4. **Not accounting for turnover cost escalation on a higher-finish post-renovation unit.** Higher finish levels cost more per turn (hardwood floors vs. vinyl, stainless vs. white appliances, etc.).
5. **Smoothing turnover flat across the hold.** The Projections tab should show elevated renovation-period turnover (50-65%), then the post-stabilization drop. The Pro Forma column is the stabilized rate.

**Confidence Rules**
- High: T12 turnover rate available, owned-portfolio post-renovation comps available, affordability ceiling analyzed, posture supports the rate.
- Medium: T12 available but renovation-period disruption makes it unrepresentative; owned-portfolio comps from different geography or vintage.
- Low: No T12 (development), owned-portfolio turnover data unavailable, affordability ceiling analysis not possible (income data missing), renovation scope unclear.

**Output Slots Populated**
- \`proforma_fields['expense.turnover'].value\` — stabilized annual turnover cost in dollars (rate × per-turn cost × total units)
- \`proforma_fields['expense.turnover_rate'].value\` — stabilized turnover rate as decimal (e.g., 0.35)
- \`proforma_fields['expense.turnover'].evidence\` — pre-renovation regime described, post-stabilization target explained, stickiness vs. affordability ceiling analysis included
- [VALUE-ADD/REDEVELOPMENT] May also write \`pre_renovation\` and \`post_stabilization\` sub-fields — see Sub-Field Write Protocol (Tier 1 turnover rate required for pre; min 'medium' confidence for post with stickiness analysis completed)

---

### CapEx Reserve — All Deal Types

**The question you're answering:** What annual capital expenditure reserve (replacement reserve) should we underwrite for the stabilized Pro Forma year to reflect the expected ongoing capital needs of the asset?

**Regime Awareness**
CapEx reserve has a clear regime distinction on value-add deals:
- **During renovation:** The renovation itself IS the capital expenditure. Do not double-count renovation capex as both the renovation budget (tracked in M22 capex_schedule) and an annual reserve expense.
- **Post-renovation / stabilized regime:** After renovation completion, the reserve should reflect the normalized ongoing capital replacement needs of a now-renovated asset. Renovated assets have meaningfully lower reserve needs in the near term because major systems have just been replaced.

The Pro Forma column shows the post-renovation stabilized reserve (the ongoing reserve on the renovated asset). The renovation budget is tracked separately in M22 capex_schedule and the capital stack / Sources & Uses.

Important: distinguish "capital expenditure reserve" (the annual reserve for ongoing capex) from "renovation budget" (the specific M22 program). These must not be conflated.

**Source Hierarchy**
- Primary (Tier 1): T12 capital reserve line if separately tracked. Note: many T12s commingle reserve with R&M or do not separately show reserves. If not separately shown, derive from age and asset condition.
- Age-based reserve schedule (Tier 3): Industry standard replacement reserve schedules by asset age:
  - Post-renovation (0-5 years): $150-250/unit/yr (low near-term capex need, systems just replaced)
  - 5-15 years since renovation: $250-400/unit/yr (systems aging, some replacements expected)
  - Pre-renovation or 15+ years: $400-700/unit/yr (significant near-term capex expected)
  - High-rise or complex amenity packages: add $100-200/unit/yr for elevator, HVAC, and structural components
- Secondary (Tier 2): Owned-portfolio reserve spending actuals on comparable assets by vintage and renovation status.
- Archive (Tier 3): fetch_archive_assumption_distribution for replacement_reserves.
- Source you do NOT trust here: Broker OM replacement reserves. Sellers routinely understate reserves (or set them at the minimum lender requirement of $250-300/unit/yr regardless of actual asset needs) to inflate NOI.

**Investigation Questions**
1. Does the T12 separately track a replacement reserve contribution? If so, is it commingled with operating R&M?
2. What is the renovation scope from M22? After renovation, what major systems have been replaced (HVAC, roof, windows, plumbing, electrical)? Each replaced system resets that system's replacement timeline.
3. What systems have NOT been replaced by the renovation? These systems still age during the hold period and may require capital during or after the hold.
4. What is the remaining useful life of major non-replaced systems (roof, HVAC, elevators, electrical panels)?
5. What does the lender require for the replacement reserve escrow? This is a minimum floor, not the actual reserve need.
6. For development: use $150-250/unit/yr for years 1-5 of a new-build; nothing is worn out yet.

**Comparable Filtering Rules**
- Renovation status is the dominant filter: post-renovation benchmarks for post-renovation Pro Formas; pre-renovation benchmarks only for pre-renovation assessments.
- Asset age and vintage: newer post-renovation assets have lower near-term reserve needs.
- Structural complexity: high-rise and assets with elevators, chillers, or structured parking require higher reserves.
- Do not use lender-mandated reserve requirements as the market benchmark — lenders set minimums, not actuarially correct reserve levels.

**Common Pitfalls**
1. **Double-counting renovation capex and replacement reserve.** The renovation budget is tracked in M22 capex_schedule. The replacement reserve is the ONGOING annual contribution post-renovation. Do not add both to the Pro Forma operating cost.
2. **Using pre-renovation reserve levels in a post-renovation Pro Forma.** Renovated assets have materially lower near-term reserve needs.
3. **Setting the reserve at the lender minimum ($250/unit/yr) regardless of actual needs.** Some older assets with partially-renovated systems need $500-700/unit/yr.
4. **Treating reserve contributions as actual cash outflows when not escrowed.** Note whether the reserve is a physical escrow (affects cash flow directly) or a pro forma deduction (convention). Lenders often require escrowed reserves.
5. **Not identifying which systems are NOT replaced by the renovation.** A $25k/unit renovation that replaces flooring, paint, and appliances but leaves the original HVAC (1985) and roof (2004) still has meaningful capex risk.

**Confidence Rules**
- High: T12 reserve tracked separately, renovation scope from M22 clearly defines what was replaced, owned-portfolio actuals available.
- Medium: T12 does not separately track reserve (embedded in R&M or absent), renovation scope known but not all systems addressed.
- Low: No T12 (development), renovation scope not from M22 (unknown what was replaced), high structural complexity without benchmarks.

**Output Slots Populated**
- \`proforma_fields['expense.replacement_reserves'].value\` — stabilized annual replacement reserve in dollars (post-renovation rate for value-add)
- \`proforma_fields['expense.replacement_reserves'].evidence\` — renovation scope noted (what was replaced), remaining system risk identified, regime narrative included for value-add
- [VALUE-ADD/REDEVELOPMENT] May write \`post_stabilization\` sub-field only (post-renovation reserve rate distinct from T12; pre variation is minimal) — see Sub-Field Write Protocol

---

## CROSS-CELL GUIDANCE

### Regime Output Protocol (v1.3 — applies to all non-GPR cells)

For each non-GPR line item, apply this output protocol:

1. **Derive the post-stabilization value** — this is the single number for the Pro Forma column.
2. **Document the regime narrative in evidence.reasoning** — for value-add and redevelopment deals, always explain:
   - The pre-renovation regime value and what drives it
   - The post-stabilization target and what drives the shift
   - The transition rationale (why does the property get from pre-reno to post-stab on this line item?)
3. **Write ONE primary value to proforma_fields** — for stabilized/core/core-plus deals, no sub-fields. For value-add/redevelopment, also write pre_renovation and post_stabilization sub-fields on eligible fields per the Sub-Field Write Protocol when evidence thresholds are met.
4. **Flag the Projections tab for year-by-year trajectory** — note in evidence that pre-renovation regime year-by-year values are modeled in the Projections tab.

Example evidence.reasoning format for value-add turnover:
"PRE-RENOVATION REGIME: T12 turnover 58% — consistent with active renovation disruption (M22 capex_schedule shows 40% of units in renovation simultaneously). Per-turn make-ready cost elevated at $2,100 due to renovation prep requirements. POST-STABILIZATION REGIME: Projecting 35% stabilized turnover (post-renovation target). Renovation stickiness (full interior refresh at $28k/unit): +10pp improvement vs. typical Class B turnover baseline of 45%. Affordability ceiling check: post-renovation rent $1,680/mo vs. submarket median HH income $58k → 34.7% income burden, within typical threshold; moderate risk but within range. Pro Forma value $245,000 reflects 180 units × 35% turnover rate × $3,889 per-turn fully-loaded cost (make-ready + leasing + short-term vacancy). Year-by-year trajectory in Projections tab: Y1 65%, Y2 50%, Y3 35% (stabilized), Y4-Y5 33%."

### Per-Field Self-Check Before Writing Output

Before writing any line item to proforma_fields, verify:
[ ] Post-stabilization value is the single output (not a pre/post pair)
[ ] T12 one-time/recurring classification was applied
[ ] Comparable filtering rules were honored (renovation status, class, submarket)
[ ] Named pitfalls were checked and avoided or explicitly addressed
[ ] Confidence level set per confidence rules
[ ] Evidence reasoning includes regime narrative for value-add/redevelopment
[ ] For value-add: v1.3 sub-field protocol applied — eligible fields have pre_renovation and post_stabilization sub-keys written with evidence-threshold check; confidence tag included on all post_stabilization writes; no sub-fields written for stabilized/core deals

---

## SUB-FIELD WRITE PROTOCOL (v1.3 — value-add and redevelopment deals only)

This protocol governs when and how the agent writes pre_renovation and post_stabilization
sub-fields alongside the primary value in proforma_fields. These sub-fields populate the
RegimeExpand UI component so operators can see the full pre-to-post-stabilization arc.

### Eligibility gate

Only execute this protocol when ALL of the following are true:
- Deal type is value-add OR redevelopment
- The line item field is in the eligible set (see table below)
- The regime split is material: pre and post values differ by more than 5%

For stabilized, core, core-plus, and development deals: skip this protocol entirely.

### Eligible fields

| Field key                     | pre_renovation? | post_stabilization? | Minimum evidence for pre |
|------------------------------|-----------------|---------------------|--------------------------|
| revenue.vacancy_loss          | Yes             | Yes                 | Tier 1 (T12 vacancy data)|
| revenue.concessions           | Yes             | Yes                 | Tier 1 (T12 concession history) |
| revenue.bad_debt              | Yes             | Yes                 | Tier 1 (T12 bad debt / credit loss line) |
| revenue.other_income          | Yes             | Yes                 | Tier 1 (T12 other income categories) |
| expense.repairs_maintenance   | Yes             | Yes                 | Tier 1 (T12 R&M spend) |
| expense.marketing             | Yes             | Yes                 | Tier 1 or 2 |
| expense.contract_services     | Yes             | Yes                 | Tier 1 (T12 contract services) |
| expense.turnover              | Yes             | Yes                 | Tier 1 (T12 turnover rate AND per-turn cost) |
| expense.replacement_reserves  | No              | Yes                 | N/A (post only) |

### Evidence threshold rules

**pre_renovation sub-field:**
- Requires Tier 1 evidence (T12 or rent roll actual for this specific line item)
- OR Tier 2 evidence (owned-portfolio actuals for a comparable pre-renovation asset)
- If evidence is only Tier 3 or Tier 4: do NOT write pre_renovation; include the value in evidence.reasoning only

**post_stabilization sub-field:**
- Always requires a confidence tag ('high', 'medium', or 'low')
- Confidence 'low': do NOT write post_stabilization; keep value in evidence.reasoning only
- Confidence 'medium' or 'high': write the sub-field

### Sub-field format (write this structure under the primary field object)

\`\`\`
proforma_fields['revenue.vacancy_loss'] = {
  value: <post-stab dollar value>,         // primary value — unchanged
  source: "agent:cashflow",
  evidence: { ... },                        // evidence object — unchanged
  "pre_renovation": {
    "value": <pre-renovation dollar amount>,
    "confidence": "high" | "medium",        // confidence in the pre-reno estimate
    "source": "tier1:t12" | "tier2:owned_asset" | ...,
    "note": "<brief narrative: what drives this value, regime context>"
  },
  "post_stabilization": {
    "value": <post-stabilization dollar amount>,   // should equal or closely match primary value
    "confidence": "high" | "medium",              // REQUIRED — 'low' is rejected
    "source": "tier3:market_comp" | "tier2:owned_asset" | ...,
    "note": "<brief narrative: stabilization target, comp evidence, transition rationale>"
  }
}
\`\`\`

### Partial writes are acceptable

You may write only pre_renovation, only post_stabilization, or both — based on what evidence
supports. Do not fabricate a sub-field value to complete a pair.

---

## REGIME TRAJECTORY WRITE PROTOCOL (Pass 3 — value-add and development/redevelopment deals only)

After writing all 14 stabilized Pro Forma line items in Pass 2, execute this pass for deals
where evidence.reasoning documents a regime transition (renovation or lease-up).

### Purpose

The Projections tab engine (buildProjectionsForExport) uses per-year overrides from
deal_assumptions.per_year_overrides to populate regime-sensitive line items year-by-year.
When you write these overrides, your evidence.reasoning narrative becomes live numbers in the
Projections tab — not just audit-trail text.

Four per-year JSONB keys are consumed by the Projections tab engine:

| JSONB key pattern              | Meaning                                                          | Unit         |
|-------------------------------|------------------------------------------------------------------|--------------|
| turnover_ratio:yr{n}          | Turnover-rate multiplier vs Y1 stabilized base                  | decimal (×)  |
| repairs_multiplier:yr{n}      | R&M multiplier vs Y1 stabilized base                            | decimal (×)  |
| concessions_pct:yr{n}         | Concession loss as % of GPR (overrides burn-off accumulator)    | decimal (%)  |
| marketing_multiplier:yr{n}    | Marketing multiplier vs Y1 stabilized base                      | decimal (×)  |

When these keys are absent, the engine uses computed defaults from computeRegimeRamp():
- value_add: turnover 1.60→1.20 during reno period, repairs 1.25→1.10, concessions 1.40→1.10
- lease_up:  marketing 1.75→1.20 during lease-up, turnover 0.20→0.60
- stabilized: all multipliers 1.0

Write per-year overrides only when your evidence supports a trajectory that differs materially
(>10%) from the engine defaults above. If your evidence supports the defaults, omit these keys
and let the engine drive — do not write redundant values.

### How to derive the per-year values

For each regime-sensitive year (renovation period Y1-Y{N} or lease-up period Y1-Y{M}):

1. **Turnover multiplier**: Use the per-year turnover rate from evidence.reasoning
   (e.g., "Y1 65%, Y2 50%, Y3 35% stabilized") and express as a multiplier vs Y1 stabilized.
   - Example: Y1 stabilized = 35%; renovation-year rate = 58% → multiplier = 58/35 = 1.657
   - Write as: turnover_ratio:yr1 = 1.657, turnover_ratio:yr2 = 1.43 (= 50/35)

2. **Repairs multiplier**: Use the regime R&M rate vs stabilized rate from evidence.reasoning.
   - Typical value-add range: 1.15–1.40 during renovation (deferred maintenance catch-up)
   - Express as multiplier: (renovation-period R&M) / (Y1 stabilized R&M)

3. **Concessions % of GPR**: Use the per-year concession rate from evidence.reasoning.
   - Regime concessions for value-add: typically 3–7% during renovation, 0–2% stabilized
   - Write as decimal: 0.05 = 5% of GPR

4. **Marketing multiplier**: Use the per-year marketing intensity from evidence.reasoning.
   - Lease-up: 1.50–2.00× during active lease-up; 1.10–1.25× in first stabilized year
   - Value-add: 1.10–1.25× during renovation (displaced-unit re-leasing)

### Write protocol

Use the PATCH /deals/{dealId}/financials/override endpoint (field = per_year_overrides key,
year = N) to write each per-year value. Write only regime years (1 through renovation/lease-up
period length). Do NOT write post-stabilization years — the engine defaults to 1.0 (neutral).

Also write the scalar renovation period length so the engine uses your assessed period, not the
M07 signal default:
- Key: renovation_period_years:yr1 = {integer years, e.g. 2}

### Example (value-add, 2-year renovation, evidence states Y1 55% turnover, Y2 42%):

stabilized turnover rate = 32% (from Pro Forma line item)
Y1 multiplier = 55/32 = 1.719 → write turnover_ratio:yr1 = 1.719
Y2 multiplier = 42/32 = 1.313 → write turnover_ratio:yr2 = 1.313
No Y3+ writes needed (engine defaults to 1.0 post-renovation)

Also write: renovation_period_years:yr1 = 2 (confirms 2-year renovation period to engine)

### When NOT to write regime overrides

- Stabilized acquisition deals with no renovation: skip this pass entirely
- When your evidence does not contain per-year regime rates: do not fabricate values
- When the computed engine defaults are within 10% of your assessment: omit and let engine drive
- When the deal is a simple core-plus or core deal: skip this pass
`;

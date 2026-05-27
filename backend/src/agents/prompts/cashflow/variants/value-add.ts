/**
 * CashFlow Agent — Variant Prompt: Value-Add
 *
 * Deal type: value-add renovation play with unit upgrades and rent premium.
 * Focus: renovation timeline, rent premium underwriting, lease-up risk.
 */

export const CASHFLOW_VARIANT_VALUE_ADD = `
## Deal Type: Value-Add

You are underwriting a VALUE-ADD multifamily asset. The renovation plan and achievable
rent premium are the highest-risk assumptions — evidence them rigorously.

### Key Assumptions for Value-Add Deals

**Current In-Place Rents (Pre-Renovation):** T-12 actuals or Rent Roll (Tier 1).
Owned asset pre/post renovation comparables (Tier 2) for premium validation.

**Stabilized Rents (Post-Renovation):** REQUIRE peer comp evidence for renovated comps.
Flag as collision if broker OM premium > 15% above renovated comp average.

**Renovation Budget & Timeline:**
  • Capital schedule from deal docs (Tier 1) if available
  • Owned portfolio renovation cost actuals per unit (Tier 2)
  • Conservative: add 15% contingency to any budget not supported by Tier 1

**Lease-Up Ramp:**
  • Model renovation velocity: typical 20-30% of units/yr for occupied asset rehabs
  • Economic vacancy during renovation: 10-15% unless docs specify otherwise
  • Stabilization period: 18-36 months is typical; flag if broker OM assumes < 12 months

**OpEx:** Use T-12 for pre-renovation period. After renovation, scale to renovated-unit
norms from owned portfolio (Tier 2). Payroll typically increases 5-10% post-renovation.

**Exit Cap:** Value-add exit cap should reflect STABILIZED asset quality post-renovation.
Apply 50bps spread over target market cap rate for renovated assets.

### Pre/Post Sub-Field Write Protocol (Value-Add — v1.3)

For value-add and redevelopment deals, you may write pre_renovation and post_stabilization
sub-fields alongside the primary value on eligible regime-sensitive line items. These sub-fields
populate the RegimeExpand component so operators can see the full pre-to-post-stabilization arc.

**Eligible fields and evidence thresholds:**

| Field (proforma_fields key)    | pre_renovation allowed?       | post_stabilization allowed?          |
|-------------------------------|-------------------------------|--------------------------------------|
| revenue.vacancy_loss           | Yes — Tier 1 required         | Yes — min 'medium' confidence        |
| revenue.concessions            | Yes — Tier 1 required         | Yes — min 'medium' confidence        |
| revenue.bad_debt               | Yes — Tier 1 required         | Yes — min 'medium' confidence        |
| revenue.other_income           | Yes — Tier 1 required         | Yes — min 'medium' confidence        |
| expense.repairs_maintenance    | Yes — Tier 1 required         | Yes — min 'medium' confidence        |
| expense.marketing              | Yes — Tier 1 or 2             | Yes — min 'medium' confidence        |
| expense.contract_services      | Yes — Tier 1 required         | Yes — min 'medium' confidence        |
| expense.turnover               | Yes — Tier 1 required (T12 turnover rate must be known) | Yes — min 'medium' confidence |
| expense.replacement_reserves   | No (pre variation is minimal) | Yes — min 'medium' confidence        |

**Sub-field format:**
\`\`\`json
{
  "revenue.vacancy_loss": {
    "value": 125000,
    "source": "agent:cashflow",
    "evidence": { ... },
    "pre_renovation": {
      "value": 210000,
      "confidence": "high",
      "source": "tier1:t12",
      "note": "T12 average during active renovation period (10-15% units offline)"
    },
    "post_stabilization": {
      "value": 125000,
      "confidence": "medium",
      "source": "tier3:market_comp",
      "note": "Stabilized Class B target 4.7% vacancy; 12 renovated comp set average 4.2-5.1%"
    }
  }
}
\`\`\`

**Rejection rules (do NOT write the sub-field if any of these apply):**
- pre_renovation: no Tier 1 or Tier 2 evidence available for the pre-renovation state
- post_stabilization: confidence is 'low' — regime economics too uncertain to tag separately
- Either: deal is stabilized, core, or core-plus (sub-fields are value-add/redevelopment only)
- Either: the pre and post values are within 5% of each other (no meaningful regime split)

**When evidence is insufficient for a sub-field:** keep the reasoning in evidence.reasoning only;
do not write the sub-field key. A partial write (pre only, or post only) is acceptable when
evidence supports one regime but not the other.

### Collision Priority for Value-Add Deals
Focus collision detection on: rent premium vs. renovated comps, renovation budget vs.
portfolio actuals, lease-up timeline vs. broker OM assumptions.

### Line-Item Matrix Cross-References (Value-Add Specific)

The following line items are highest-regime-sensitivity for value-add deals. Apply the
corresponding investigation cell from the LINE-ITEM INVESTIGATION MATRIX for each:

**Vacancy (HIGH PRIORITY — apply matrix cell):**
Apply the Vacancy matrix cell. For value-add, the Pro Forma column shows post-stabilization
economic vacancy (target: 4-7% for stabilized Class B). Do NOT use T12 vacancy directly —
T12 reflects the pre-renovation regime (elevated due to renovation disruption and unit
displacement). The Projections tab models the renovation-period ramp (10-15% economic
vacancy during renovation → normalized stabilized rate). Evidence reasoning must explain the
pre-renovation regime, the renovation-period ramp, and the post-stabilization target.

**Concessions (HIGH PRIORITY — apply matrix cell):**
Apply the Concessions matrix cell. For value-add, the renovated comp set concession level is
the post-renovation target. The subject currently may be running 4-8 weeks free (pre-reno
environment); the stabilized Pro Forma should reflect the concession level of the renovated
tier. Flag if posture is Defense — concessions may remain elevated even post-renovation.

**Turnover Cost (HIGHEST REGIME SENSITIVITY — apply matrix cell with full detail):**
Apply the Turnover matrix cell with its full investigation protocol. This is the single
most regime-sensitive non-GPR line item for value-add deals.
  • Pre-renovation: 50-65% annual turnover; residents leave during renovation disruption
  • Post-stabilization: 30-40% target; renovation stickiness reduces turnover by 10-20pp
  • REQUIRED: analyze the renovation stickiness vs. affordability ceiling tension:
    - Calculate post-renovation rent burden on resident income profile
    - If post-reno rent > 30% of median HH income in submarket → elevated turnover risk
    - If renovation is full interior at $25k+/unit → maximum stickiness
  • Pro Forma column = stabilized (post-renovation) turnover rate × per-turn cost × units
  • Evidence reasoning MUST include regime narrative (pre-reno 50-65%, post-stab 30-40%,
    stickiness analysis, affordability ceiling check)

**R&M (HIGH PRIORITY — apply matrix cell):**
Apply the R&M matrix cell. For value-add, T12 R&M is the PRE-renovation rate and should
NOT be used directly. Post-renovation R&M drops 30-50% vs pre-renovation T12 because
renovated systems (HVAC, appliances, plumbing) have low near-term failure rates. Apply the
one-time/recurring test to T12 R&M before using as any baseline. Pro Forma column =
post-renovation normalized rate.

**CapEx Reserve (apply matrix cell):**
Apply the CapEx Reserve matrix cell. Post-renovation reserve = $150-250/unit/yr (renovated
systems, low near-term capex). Do NOT add renovation budget (tracked in M22 capex_schedule)
to the Pro Forma reserve line — double-counting is a common error on value-add deals.

**Other Income (apply matrix cell):**
Apply the Other Income matrix cell. For value-add, distinguish (a) existing ancillary programs
carried forward and (b) new programs enabled by renovation (RUBS, pet fees, parking
optimization). New programs have implementation lag — model 6-12 months for RUBS maturation.

**v1.2 Single-Value Output Mandate:**
For ALL non-GPR line items above, produce ONE value per Pro Forma column (the post-stabilization
economics). Put the pre-renovation regime narrative in evidence.reasoning. Do NOT output
pre_renovation or post_stabilization sub-fields. The Projections tab carries the year-by-year
trajectory.
`;

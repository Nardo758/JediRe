# Proforma Line-Item Anchor Registry (M36 Addendum, Part 2)

**Status:** Design doc — not yet implemented  
**Extends:** M36_Macro_Anchored_Mean_Addendum.md  
**Why separate?** The M36 sigma engine anchors affect *plausibility scoring*. The proforma line-item anchors affect *what the model projects*. They use the same macro data but for different purposes and with different timing rules.

---

## 1. The Core Insight

Every line item on a proforma has three dimensions:

1. **Anchor** — What macro or local variable drives its base value over time
2. **Timing** — When does the value change? (annual Jan 1, at close, on reassessment, at renovation completion)
3. **Trigger** — What event causes a reset/recomputation? (sale, refinance, renovation, property tax reassessment)

Right now all line items just inflate at a single `expenseGrowthRate`. That's wrong for insurance (driven by climate + state regulation), wrong for taxes (driven by assessment cycle + millage rate changes), wrong for management (driven by wage growth + occupancy).

---

## 2. Line-Item Anchor Design

### Proforma Line Item (example rows)
| Row ID | Name | Category |
|--------|------|----------|
| rent_income | Gross Rent Income | Revenue |
| other_income | Other Income | Revenue |
| vacancy_loss | Vacancy & Concessions | Revenue |
| gross_potential | Gross Potential Rent | Revenue |
| effective_gross | Effective Gross Income | Revenue |
| mgmt_fees | Management Fees | Operating Expenses |
| insurance | Insurance | Operating Expenses |
| taxes | Property Taxes | Operating Expenses |
| utilities | Utilities | Operating Expenses |
| repairs_maint | Repairs & Maintenance | Operating Expenses |
| reserves | Replacement Reserves | Operating Expenses |
| capex | Capital Expenditures | Capex |
| total_opex | Total Operating Expenses | Operating Expenses |
| noi | Net Operating Income | Summary |

### Anchor Definition

```typescript
interface ProformaAnchorConfig {
  /** Which proforma line item this applies to */
  lineItemId: string;
  
  /** Primary driver:
   *  'macro_series' -> FRED/BLS series + structural premium
   *  'fixed_rate'   -> contract/regulatory fixed percentage
   *  'local_index'  -> county/MSA-specific index (e.g., tax assessment ratio)
   *  'prev_year_plus_premium' -> last year's value × (1 + premium)
   *  'per_unit_fixed' -> fixed dollar amount per unit (from underwriting)
   */
  anchorType: 'macro_series' | 'fixed_rate' | 'local_index' | 'prev_year_plus_premium' | 'per_unit_fixed';
  
  /** FRED/BLS series ID (for macro_series anchor) */
  macroSeriesId?: string;
  
  /** Structural premium over anchor */
  premium: number;
  
  /** Timing config */
  timing: {
    /** How the value changes:
     *  'annual_step'  -> grows by `rate` each year on `effectiveDate`
     *  'locked'       -> stays at first-year value forever
     *  'trigger_once' -> changes once on trigger event, then grows
     *  'cycle'        -> changes on a schedule (e.g., every 3 years)
     *  'market'       -> re-evaluated by agent
     */
    changeType: 'annual_step' | 'locked' | 'trigger_once' | 'cycle' | 'market';
    
    /** When the first-year value takes effect (relative to close):
     *  'at_close'  -> value is known and locked at acquisition
     *  'at_close_plus_1mo' -> takes effect 1 month after close
     *  'next_calendar_year' -> doesn't change until next Jan 1
     *  'next_assessment'   -> changes at next county reassessment date
     *  'fixed_date:YYYY-MM-DD' -> specific calendar date
     */
    effectiveDate: string;
    
    /** For cycle type: how many years between changes */
    cycleYears?: number;
  };
  
  /** Trigger events that can force a recomputation */
  triggers: {
    onSale?: boolean;       // Reset on sale/acquisition
    onRefinance?: boolean;  // Reset on refinancing
    onRenovation?: boolean; // Reset on renovation completion
    onReassessment?: boolean; // Reset when county reassesses
  };
  
  /** State-specific overrides (keys are state abbreviations) */
  stateOverrides?: Record<string, {
    anchorType?: string;
    macroSeriesId?: string;
    premium?: number;
    timingChange?: string;
    effectiveDate?: string;
    triggers?: { onSale?: boolean };
    /** Example: GA reassessment on sale, FL no, CA prop 13 caps */
    note?: string;
  }>;
  
  /** Geography-specific modifiers (MSA or county level) */
  geoModifier?: {
    /** Coast/storm-zone multiplier for insurance (1.0 = national avg) */
    insuranceZoneMultiplier?: number;
    /** Tax burden index relative to national avg */
    taxBurdenIndex?: number;
  };
  
  /** Description for UI display */
  description: string;
}

/**
 * State-level override examples for property taxes:
 * 
 * State | Reassessment on sale? | Annual cap? | Next change
 * ------|----------------------|-------------|-------------
 * GA    | Yes (on sale)        | No          | On close triggers new basis
 * FL    | No (Save Our Homes)  | 3%          | On close, but capped growth
 * CA    | Prop 13              | 2%          | Only on sale or new construction
 * TX    | Yes (annual)         | 10%         | On sale resets to market value
 * NY    | Yes (annual)         | No          | On sale, 1-year lag
 * IL    | Yes (triennial)      | No          | On sale, next triennial
 * NC    | Yes (on sale + 4/8yr)| No          | At close, next county reval
 */
```

---

## 3. Timing Model

The proforma engine doesn't just apply an inflation rate to every line item. It computes each year's value from scratch based on the anchor, timing, and trigger state.

### Example: Property Taxes in Georgia

```
Year 0 (acquisition year - trailing T12):
  taxes = $100,000  (seller's last known bill)

Year 1 (close occurs March 2026):
  IF close date > county tax bill issuance date (typically Oct 2025):
    taxes = seller's bill for 2025 = $100,000  (locked until next bill)
  ELSE:
    taxes = $100,000 × (1 + county levy change %)
  
  Wait... but GA reassesses on sale. So:
  IF close_date between Jan 1 and tax_bill_issuance_date:
    taxes = assessed_value × millage_rate  (new basis effective immediately)
  ELSE:
    taxes = seller's 2025 bill  (locked until 2026 bill)
    Year 2 = 2026 bill = assessed_value × millage_rate

Year 2+:
  taxes = prev_year_taxes × (1 + county_levy_change_%)
  WHERE county_levy_change_% comes from:
    - Historical county millage rate trends (local_index)
    - Or macro anchor: CPI property insurance & taxes component + premium
```

### Example: Insurance in Florida

```
Year 0 (acquisition):
  insurance = $800/unit (from underwriting, market quote)

Year 1+:
  insurance = prev_year × (1 + insurance_growth_rate)
  WHERE insurance_growth_rate comes from:
    - PPI insurance carriers + IO factor
    - Multiplied by Florida coastal zone factor (1.3-1.8×)
    - Capped by state regulation if applicable
```

### Example: Management Fees

```
Year 0:
  mgmt_fees = effective_gross_income × mgmt_fee_rate (5-6%)

Year 1+:
  mgmt_fee_rate = mgmt_fee_rate_yr0 × (1 + wage_growth_anchor)
  WHERE wage_growth_anchor comes from:
    - ECI Wages (local MSA labor market proxy)
    - Or negotiated contract rate (locked for term)
```

---

## 4. Integration Points

### Agent Prompt Integration

The cashflow agent's prompt should include the anchor registry. When an agent underwrites:

```yaml
# Inside cashflow agent prompt:
proforma_anchor_context:
  insurance:
    anchor: CPI insurance component + climate zone factor
    timing: annual step, but Florida has 3% statutory cap on rate increases
    current_macro_value: 4.2% PPI insurance carriers
  taxes:
    anchor: local assessment cycle + millage rate trends
    timing: state-dependent — GA reassesses on sale, CA Prop 13 caps at 2%
    active_state_rules: Georgia reassessment within 6 months of sale
  management:
    anchor: ECI wages (MSA-specific if available)
    timing: annual step, negotiable in management contract
  state_lookup: GA
```

The agent uses this to:
1. Determine which macro series to fetch for each line item
2. Apply timing rules (e.g., "taxes won't change until next assessment cycle")
3. Produce realistic year-over-year projections per line item
4. Flag when default assumptions conflict with state law

### Frontend Display

Each line item in the proforma gets a small indicator:
- 🔗 icon → hover shows: "Anchored to [macro series] + [premium]"
- 🕒 icon → hover shows: "Next change: [trigger event or date]"
- State law note → small text: "GA reassesses on sale: taxes will reset at close"
- Click to override → user can set a fixed growth rate, bypassing anchor

### M36 Sigma Engine Interaction

The sigma engine uses these line-item anchors differently:
- **Plausibility**: checks whether the aggregate expense growth rate implied by the line-item anchors is consistent with the macro environment
- **Goal-seeking**: when solving for a target IRR, the solver adjusts assumptions at the anchor level (e.g., raise insurance premium, not just bloat "expense growth")
- **Sensitivity**: "What if insurance grows at 8% instead of 4%?" is computed by replacing the anchor's premium

---

## 5. Implementation Priority

| Phase | Items | Depends on |
|-------|-------|-----------|
| **B1** | Anchor registry data model + migration (line_item_anchors table, state_rules table) | None (new schema) |
| **B2** | Proforma engine refactor — each line item reads its anchor config and computes Y1,Y2,Y3 values | B1 |
| **B3** | State-level rules table — per-state reassessment rules, insurance caps, tax caps | B1 |
| **B4** | Agent prompt augmentation — include anchor context + state rules in underwriting prompt | B1+B2 |
| **B5** | Frontend indicators — hyperlink icons, hover tooltips, override buttons | B2 |
| **B6** | Sensitivity analysis — "what if insurance" scenarios | B2+B5 |

---

## 6. Open Questions

1. **Anchor resolution order:** If a metric has a macro anchor AND a state override AND a geo modifier, the precedence is: state override → geo modifier → macro anchor → fallback. Agreed?

2. **Tax assessment data source:** County-level millage rates and reassessment schedules aren't in FRED. We need a local data library (or manually seeded table with known rules). Do we seed per-county or per-state (with county defaults)?

3. **Agent override authority:** If the agent underwrites and says "insurance will grow 3% not 4%," does the anchor system accept the override or flag the divergence? I say: override is fine, but the agent should write its rationale ("I have a local quote from Travelers at 3.5% growth locked for 3 years").

4. **Multi-year anchored projections vs single-year plausibility:** The sigma engine scores a single assumption set. The proforma projects 5-10 years. The anchor feeds both — but the 10-year projection's uncertainty compounds. Should the sigma engine's plausibility check also validate the *trajectory* (e.g., if insurance grows 8%/yr for 10 years, the terminal value is unrealistic)?

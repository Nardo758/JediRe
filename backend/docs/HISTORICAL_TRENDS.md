# Historical Trends Tracking

Track year-over-year taxes and sale prices for comprehensive trend analysis and market insights.

## Why This Matters

Most real estate analysis underestimates post-acquisition tax liability. Brokers often show current taxes (based on outdated assessments), but when you buy at today's market price, **the county reassesses and your taxes jump**.

Example:
- **Broker OM shows**: $45K/year in taxes (based on 2018 sale of $2.2M)
- **You're buying at**: $3.2M
- **County will reassess to**: ~$2.9M (92% ratio)
- **Your actual tax**: ~$54K/year (+20% surprise!)

This system captures historical reassessment patterns so you can budget accurately and avoid return-killing surprises.

## Overview

The deal capsule now tracks historical data in `PlatformIntel` layer:
- **Tax History**: Year-over-year assessed values and tax amounts
- **Sale History**: Historical sale prices with transaction details

## Data Structure

### Historical Taxes
```typescript
historical_taxes?: Array<{
  year: number;                      // Tax year
  assessed_value: number;            // Assessed property value
  tax_amount: number;                // Total tax paid
  millage_rate?: number;             // Optional: tax rate (mills)
  reassessment_trigger?: string;     // 'sale' | 'construction' | 'renovation' | 'appeal' | 'scheduled'
  linked_sale_date?: string;         // ISO date if triggered by sale
  linked_construction_event?: string; // Description if triggered by construction
  construction_completion_date?: string; // ISO date when construction completed
}>
```

### Construction Events
```typescript
construction_events?: Array<{
  event_type: string;                // 'new_construction' | 'major_renovation' | 'addition' | 'conversion'
  completion_date: string;           // Certificate of Occupancy date
  description: string;               // "Added 12 units, 15K sqft"
  cost?: number;                     // Total construction cost
  units_added?: number;              // Units added
  sqft_added?: number;               // Square footage added
  pre_construction_assessment?: number;
  post_construction_assessment?: number;
}>
```

### Historical Sales
```typescript
historical_sales?: Array<{
  sale_date: string;           // ISO date string
  sale_price: number;          // Transaction price
  price_per_unit?: number;     // Optional: per-unit pricing
  buyer?: string;              // Buyer name
  seller?: string;             // Seller name
  sale_type?: string;          // 'arms_length' | 'distressed' | 'family_transfer' | 'other'
}>
```

## Usage

### 1. Add Historical Data to a Deal

```typescript
import { DealCapsule } from '../models/deal-capsule-updated';

const capsule: DealCapsule = {
  // ... other fields
  platform_intel: {
    // ... other platform intel
    
    historical_taxes: [
      { year: 2021, assessed_value: 2500000, tax_amount: 45000 },
      { year: 2022, assessed_value: 2700000, tax_amount: 48000 },
      { year: 2023, assessed_value: 2900000, tax_amount: 52000 },
      { year: 2024, assessed_value: 3100000, tax_amount: 55500 },
    ],
    
    historical_sales: [
      {
        sale_date: '2018-06-15',
        sale_price: 2200000,
        price_per_unit: 110000,
        buyer: 'ABC Investments LLC',
        seller: 'Original Owner',
        sale_type: 'arms_length'
      },
      {
        sale_date: '2023-11-20',
        sale_price: 3000000,
        price_per_unit: 150000,
        buyer: 'Current Seller',
        seller: 'ABC Investments LLC',
        sale_type: 'arms_length'
      }
    ]
  }
};
```

### 2. Analyze Trends

```typescript
import { analyzeDealTrends, formatTrendSummary } from '../utils/historical-trends';

const trends = analyzeDealTrends(capsule.platform_intel);

console.log(formatTrendSummary(trends));
```

**Output:**
```
📊 Tax Trends (4 years):
  • YoY Growth: 7.5%
  • CAGR: 7.3%
  • Latest: $55,500 (2024)

💰 Sale Price Trends (2 sales):
  • YoY Appreciation: 6.4%
  • CAGR: 6.4%
  • Latest: $3,000,000
  • Avg Hold: 5.4 years

🔄 Reassessment Pattern (2 events):
  • Avg Lag: 8 months post-sale
  • Assessment Ratio: 92% of sale price
  • Avg Tax Increase: +24.5%
  • Predictability: High ✓

📋 Reassessment Events:
  • 2018: Sold $2200K → assessed 2019 (+22% tax)
  • 2023: Sold $3000K → assessed 2024 (+27% tax)

💡 Insights:
  • Property taxes increasing rapidly at 7.5% YoY - factor into expense projections
  • Strong historical appreciation at 6.4% YoY - active market
  • Predictable reassessment pattern: 8 mo lag, 92% of sale price

🚩 Flags:
  • Taxes growing faster than values (tax: 7.5% vs appreciation: 6.4%) - margin compression risk
  • Large tax spikes after sales (avg +25%) - factor into acquisition budget
```

### 3. Access Individual Trend Components

```typescript
const { tax_trend, sale_trend, insights, flags } = trends;

// Tax trend details
if (tax_trend) {
  console.log(`Tax CAGR: ${tax_trend.compound_annual_growth_rate}%`);
  console.log(`Trend direction: ${tax_trend.trend_direction}`);
  console.log(`Volatility: ${tax_trend.volatility}%`);
}

// Sale trend details
if (sale_trend) {
  console.log(`Price CAGR: ${sale_trend.compound_annual_growth_rate}%`);
  console.log(`Avg hold period: ${sale_trend.avg_hold_period_years} years`);
  console.log(`Latest sale: ${sale_trend.latest_sale.price}`);
}
```

## Reassessment Tracking

One of the most critical insights: **how much do taxes jump after a sale or construction completion?**

Counties reassess properties after two major triggers:

1. **Sale** - Property transfers at market price → county reassesses to sale price
2. **Construction** - New building/major renovation completes → county reassesses to improved value

Historical reassessment patterns help you:

1. **Predict post-acquisition taxes** accurately
2. **Budget for the tax spike** in your acquisition model
3. **Identify "tax holiday" windows** (slow-reassessing counties)
4. **Flag aggressive reassessment jurisdictions**

### Reassessment Event Tracking

The system automatically links sales to subsequent tax reassessments and captures:

```typescript
{
  sale_date: "2020-06-15",
  sale_price: 2500000,
  pre_sale_assessment: 1800000,      // Assessment before sale
  post_sale_assessment: 2400000,     // Assessment after sale
  reassessment_year: 2021,           // When county reassessed
  reassessment_lag_months: 7,        // Time between sale and reassessment
  reassessment_ratio: 0.96,          // 96% of sale price
  tax_increase_amount: 10500,        // Dollar increase
  tax_increase_percent: 23.3         // Percent increase
}
```

### Reassessment Pattern Analysis

Aggregate multiple events to predict future behavior:

```typescript
{
  events_analyzed: 3,
  avg_reassessment_lag_months: 8,
  avg_reassessment_ratio: 0.92,     // County assesses at 92% of sale price
  avg_tax_increase_percent: 28.5,
  predictable: true                  // Low variance = reliable predictions
}
```

### Construction-Triggered Reassessment

**Critical for development deals!**

When you complete construction, the county reassesses from:
- Land value (or old building value)
- → Land + new construction value

Example:
```typescript
{
  event_type: "new_construction",
  completion_date: "2022-08-15",        // CO date
  description: "Built 24-unit apartment",
  cost: 4500000,                         // Construction cost
  pre_construction_assessment: 800000,   // Land value
  post_construction_assessment: 4200000, // County assessed at 93% of cost
  
  // Linked to tax record:
  reassessment_lag_months: 5,            // 5 months after CO
  tax_increase_percent: 425,             // +425% tax spike!
  construction_cost_ratio: 0.93          // Assessed at 93% of construction cost
}
```

### Post-Construction Tax Prediction (Development Deals)

Use historical construction patterns to predict stabilized tax liability:

```typescript
import { predictPostConstructionTax } from '../utils/historical-trends';

const prediction = predictPostConstructionTax(
  4500000,              // Construction cost
  800000,               // Land value
  14800,                // Current tax (land only)
  reassessmentEvents,   // Historical construction events
  18.5                  // Millage rate
);

// Result:
{
  estimated_post_construction_assessment: 4985000,  // Land + 93% of construction cost
  estimated_post_construction_tax: 92222,           // New annual tax
  tax_increase_amount: 77422,                       // +$77K/year!
  tax_increase_percent: 523,                        // +523%
  confidence: "high",
  methodology: "Based on 2 historical construction reassessments (avg 93% of construction cost)"
}
```

**Why this matters:**
- Broker pro formas often show land taxes only
- Reality: taxes jump 300-500% after construction
- Must budget stabilized taxes from Year 1, not land taxes

### Post-Acquisition Tax Prediction (Acquisition Deals)

Use the pattern to estimate your tax liability after acquisition:

```typescript
import { predictPostAcquisitionTax } from '../utils/historical-trends';

const prediction = predictPostAcquisitionTax(
  3000000,              // Your acquisition price
  45000,                // Current tax amount
  2100000,              // Current assessed value
  reassessmentPattern,  // Historical pattern
  18.5                  // Current millage rate (optional)
);

// Result:
{
  estimated_new_assessment: 2760000,     // 92% of $3M
  estimated_new_tax: 51060,              // New annual tax
  tax_increase_amount: 6060,             // +$6,060/year
  tax_increase_percent: 13.5,            // +13.5%
  confidence: "high",                    // Based on 3+ events
  methodology: "Based on 3 historical reassessments (avg ratio: 92.0%)"
}
```

## Key Metrics

### Tax Trend Analysis
- **YoY Growth**: Average year-over-year tax increase
- **CAGR**: Compound annual growth rate of taxes
- **Trend Direction**: `increasing` | `decreasing` | `stable`
- **Volatility**: Standard deviation of YoY changes (higher = more unpredictable)

### Sale Trend Analysis
- **YoY Appreciation**: Average year-over-year price increase
- **CAGR**: Compound annual growth rate of sale prices
- **Trend Direction**: `appreciating` | `depreciating` | `stable`
- **Avg Hold Period**: Average years between sales
- **Volatility**: Standard deviation of price changes

## Automated Insights

The trend analyzer automatically generates:

### Insights (Positive Signals)
- Rapid tax increases → factor into projections
- Strong appreciation → active market
- Healthy fundamentals → both metrics trending up

### Flags (Red Flags)
- Tax volatility > 10% → unpredictable expenses
- Aggressive tax increases > 8% YoY → return impact
- Declining values → market weakness
- Price volatility > 15% → uncertain exit
- Short hold periods < 2 years → flipping activity
- Taxes outpacing appreciation → margin compression
- **Fast reassessment < 6 months** → immediate tax hit after closing
- **Large tax spikes > 30%** → factor into acquisition budget
- **Inconsistent reassessment pattern** → uncertain projections

## Integration Points

### Financial Module
Use trends to:
- Adjust tax expense projections
- Model appreciation scenarios
- Stress-test exit pricing assumptions
- Calculate historical IRR

### Market Research Module
Compare property trends to:
- Submarket averages
- Asset class benchmarks
- Regional growth patterns

### Due Diligence Module
Flag concerns like:
- Unusual tax spikes (appeals? reassessments?)
- Short hold periods (flipping? issues?)
- Price depreciation (market decline? property issues?)

## Data Sources

Historical data typically sourced from:
- **County Tax Assessor** (tax history)
- **MLS / Public Records** (sale history)
- **Title Companies** (ownership chain)
- **CoStar / Yardi Matrix** (commercial data)

## Best Practices

1. **Minimum Data Points**: At least 2-3 years for meaningful trends
2. **Filter Non-Arms-Length**: Exclude family transfers, distressed sales for appreciation analysis
3. **Tax Appeals**: Note any appeals or reassessments that distort trends
4. **Market Context**: Compare property trends to broader market trends
5. **Update Regularly**: Refresh data annually for current deals

## Example Use Cases

### Use Case 1: Pro Forma Validation
```typescript
const trends = analyzeDealTrends(capsule.platform_intel);

if (trends.tax_trend && trends.tax_trend.avg_yoy_growth > 5) {
  console.warn(`Use ${trends.tax_trend.avg_yoy_growth}% tax escalation in pro forma`);
}
```

### Use Case 2: Exit Strategy
```typescript
if (trends.sale_trend) {
  const projected_exit = trends.sale_trend.latest_sale.price * 
    Math.pow(1 + (trends.sale_trend.compound_annual_growth_rate / 100), 5);
  
  console.log(`5-year projected exit: $${projected_exit.toLocaleString()}`);
}
```

### Use Case 3: Red Flag Detection
```typescript
if (trends.flags.length > 0) {
  console.log('⚠️ Trend-based concerns:');
  trends.flags.forEach(flag => console.log(`  - ${flag}`));
}
```

### Use Case 4: Accurate Tax Budgeting
```typescript
const trends = analyzeDealTrends(capsule.platform_intel);

if (trends.reassessment_pattern) {
  const askingPrice = 3200000;
  const currentTax = capsule.platform_intel.latest_tax_amount || 48000;
  const currentAssessment = capsule.platform_intel.latest_assessed_value || 2500000;
  
  const taxPrediction = predictPostAcquisitionTax(
    askingPrice,
    currentTax,
    currentAssessment,
    trends.reassessment_pattern,
    capsule.platform_intel.current_millage_rate
  );
  
  console.log(`📊 Post-Acquisition Tax Estimate:`);
  console.log(`  Current: $${currentTax.toLocaleString()}/year`);
  console.log(`  After acquisition: $${taxPrediction.estimated_new_tax.toLocaleString()}/year`);
  console.log(`  Increase: +$${taxPrediction.tax_increase_amount.toLocaleString()} (+${taxPrediction.tax_increase_percent.toFixed(1)}%)`);
  console.log(`  Confidence: ${taxPrediction.confidence}`);
  console.log(`  Method: ${taxPrediction.methodology}`);
  
  // Update pro forma with accurate tax expense
  financial_assumptions.year_1_tax = taxPrediction.estimated_new_tax;
}
```

**Output:**
```
📊 Post-Acquisition Tax Estimate:
  Current: $48,000/year
  After acquisition: $56,160/year
  Increase: +$8,160 (+17.0%)
  Confidence: high
  Method: Based on 3 historical reassessments (avg ratio: 91.0%)
```

### Use Case 5: Development Pro Forma Taxes
```typescript
const trends = analyzeDealTrends(capsule.platform_intel);

// Get construction events
const constructionEvents = trends.reassessment_events.filter(
  e => e.trigger_type === 'construction'
);

if (constructionEvents.length > 0) {
  const landValue = 1200000;
  const constructionCost = 6000000;
  const currentLandTax = 22200;
  
  const taxPrediction = predictPostConstructionTax(
    constructionCost,
    landValue,
    currentLandTax,
    trends.reassessment_events,
    18.5
  );
  
  console.log(`🏗️ Development Tax Analysis:`);
  console.log(`  Land tax (current): $${currentLandTax.toLocaleString()}/year`);
  console.log(`  Stabilized tax (post-construction): $${taxPrediction.estimated_post_construction_tax.toLocaleString()}/year`);
  console.log(`  Tax spike: +$${taxPrediction.tax_increase_amount.toLocaleString()} (+${taxPrediction.tax_increase_percent.toFixed(0)}%)`);
  console.log(`  Method: ${taxPrediction.methodology}`);
  
  // Use in development pro forma
  development_assumptions.stabilized_tax = taxPrediction.estimated_post_construction_tax;
  
  // Important: model tax ramp-up during lease-up
  const lagMonths = constructionEvents[0].reassessment_lag_months;
  console.log(`\n  ⏱️ Tax reassessment expected ${lagMonths} months after CO`);
  console.log(`     → Use land tax for first ${lagMonths} months of lease-up`);
  console.log(`     → Then ramp to stabilized tax`);
}
```

**Output:**
```
🏗️ Development Tax Analysis:
  Land tax (current): $22,200/year
  Stabilized tax (post-construction): $123,050/year
  Tax spike: +$100,850 (+454%)
  Method: Based on 2 historical construction reassessments (avg 91% of construction cost)

  ⏱️ Tax reassessment expected 6 months after CO
     → Use land tax for first 6 months of lease-up
     → Then ramp to stabilized tax
```

## Future Enhancements

- Market comp trending (not just subject property)
- Rent roll trend analysis (historical occupancy/rates)
- Operating expense trending
- Correlation analysis (taxes vs rents vs values)
- Predictive modeling (forecast next year's taxes/values)

---

**Questions?** See the trend analysis utilities in `backend/src/utils/historical-trends.ts`

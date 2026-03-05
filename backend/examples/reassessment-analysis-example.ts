/**
 * Example: Reassessment Analysis for Deal Underwriting
 * 
 * Shows how to use historical reassessment patterns to predict
 * post-acquisition tax liability and avoid underwriting surprises.
 */

import {
  analyzeDealTrends,
  predictPostAcquisitionTax,
  formatTrendSummary,
} from '../src/utils/historical-trends';

// Example deal with historical data
const dealWithHistory = {
  platform_intel: {
    // Historical tax records (from county assessor)
    historical_taxes: [
      {
        year: 2018,
        assessed_value: 1950000,
        tax_amount: 36075,
        millage_rate: 18.5,
        reassessment_trigger: 'sale',
        linked_sale_date: '2018-06-15',
      },
      {
        year: 2019,
        assessed_value: 2145000, // County reassessed after 2018 sale
        tax_amount: 39683,
        millage_rate: 18.5,
        reassessment_trigger: 'sale',
        linked_sale_date: '2018-06-15',
      },
      {
        year: 2020,
        assessed_value: 2188000,
        tax_amount: 40478,
        millage_rate: 18.5,
      },
      {
        year: 2021,
        assessed_value: 2232000,
        tax_amount: 41292,
        millage_rate: 18.5,
      },
      {
        year: 2022,
        assessed_value: 2277000,
        tax_amount: 42125,
        millage_rate: 18.5,
      },
      {
        year: 2023,
        assessed_value: 2323000,
        tax_amount: 42976,
        millage_rate: 18.5,
      },
      {
        year: 2024,
        assessed_value: 2760000, // County reassessed after 2023 sale
        tax_amount: 51060,
        millage_rate: 18.5,
        reassessment_trigger: 'sale',
        linked_sale_date: '2023-11-20',
      },
    ],

    // Historical sales (from MLS / public records)
    historical_sales: [
      {
        sale_date: '2018-06-15',
        sale_price: 2200000,
        price_per_unit: 110000,
        buyer: 'ABC Investments LLC',
        seller: 'Original Owner',
        sale_type: 'arms_length',
      },
      {
        sale_date: '2023-11-20',
        sale_price: 3000000,
        price_per_unit: 150000,
        buyer: 'Current Seller',
        seller: 'ABC Investments LLC',
        sale_type: 'arms_length',
      },
    ],
  },
};

// Current deal parameters
const ASKING_PRICE = 3200000;
const CURRENT_TAX = 51060; // Based on 2024 assessment
const CURRENT_ASSESSMENT = 2760000;
const CURRENT_MILLAGE = 18.5;

console.log('═══════════════════════════════════════════════════');
console.log('📊 REASSESSMENT ANALYSIS EXAMPLE');
console.log('═══════════════════════════════════════════════════\n');

// Step 1: Analyze all trends
console.log('STEP 1: Analyze Historical Trends\n');
const trends = analyzeDealTrends(dealWithHistory.platform_intel);

console.log(formatTrendSummary(trends));
console.log('\n');

// Step 2: Examine reassessment pattern
if (trends.reassessment_pattern) {
  console.log('═══════════════════════════════════════════════════');
  console.log('STEP 2: Reassessment Pattern Analysis\n');
  
  console.log(`Events analyzed: ${trends.reassessment_pattern.events_analyzed}`);
  console.log(`Average lag: ${trends.reassessment_pattern.avg_reassessment_lag_months} months`);
  console.log(`Assessment ratio: ${(trends.reassessment_pattern.avg_reassessment_ratio * 100).toFixed(1)}% of sale price`);
  console.log(`Average tax increase: +${trends.reassessment_pattern.avg_tax_increase_percent.toFixed(1)}%`);
  console.log(`Predictable: ${trends.reassessment_pattern.predictable ? 'Yes ✓' : 'No ⚠️'}`);
  console.log('\n');

  // Step 3: Event-by-event breakdown
  console.log('═══════════════════════════════════════════════════');
  console.log('STEP 3: Event-by-Event Breakdown\n');
  
  trends.reassessment_events.forEach((event, idx) => {
    console.log(`Event ${idx + 1}:`);
    console.log(`  Sale Date: ${event.sale_date}`);
    console.log(`  Sale Price: $${event.sale_price.toLocaleString()}`);
    console.log(`  Pre-Sale Assessment: $${event.pre_sale_assessment.toLocaleString()}`);
    console.log(`  Post-Sale Assessment: $${event.post_sale_assessment.toLocaleString()}`);
    console.log(`  Reassessment Year: ${event.reassessment_year}`);
    console.log(`  Lag: ${event.reassessment_lag_months} months`);
    console.log(`  Assessment Ratio: ${(event.reassessment_ratio * 100).toFixed(1)}%`);
    console.log(`  Tax Increase: +$${event.tax_increase_amount.toLocaleString()} (+${event.tax_increase_percent.toFixed(1)}%)`);
    console.log('');
  });

  // Step 4: Predict post-acquisition tax
  console.log('═══════════════════════════════════════════════════');
  console.log('STEP 4: Post-Acquisition Tax Prediction\n');
  
  const prediction = predictPostAcquisitionTax(
    ASKING_PRICE,
    CURRENT_TAX,
    CURRENT_ASSESSMENT,
    trends.reassessment_pattern,
    CURRENT_MILLAGE
  );

  console.log(`Acquisition Price: $${ASKING_PRICE.toLocaleString()}`);
  console.log(`Current Tax (2024): $${CURRENT_TAX.toLocaleString()}/year`);
  console.log('');
  console.log('PREDICTED POST-ACQUISITION:');
  console.log(`  New Assessment: $${prediction.estimated_new_assessment.toLocaleString()}`);
  console.log(`  New Tax: $${prediction.estimated_new_tax.toLocaleString()}/year`);
  console.log(`  Increase: +$${prediction.tax_increase_amount.toLocaleString()} (+${prediction.tax_increase_percent.toFixed(1)}%)`);
  console.log(`  Confidence: ${prediction.confidence.toUpperCase()}`);
  console.log(`  Methodology: ${prediction.methodology}`);
  console.log('');

  // Step 5: Pro forma impact
  console.log('═══════════════════════════════════════════════════');
  console.log('STEP 5: Pro Forma Impact\n');

  const brokerTaxAssumption = CURRENT_TAX; // What broker shows
  const accurateTaxAssumption = prediction.estimated_new_tax; // What you'll actually pay
  const annualCashFlowImpact = brokerTaxAssumption - accurateTaxAssumption;
  
  console.log('BROKER PRO FORMA:');
  console.log(`  Tax Expense: $${brokerTaxAssumption.toLocaleString()}/year`);
  console.log('');
  console.log('ACCURATE PRO FORMA:');
  console.log(`  Tax Expense: $${accurateTaxAssumption.toLocaleString()}/year`);
  console.log('');
  console.log('IMPACT ON RETURNS:');
  console.log(`  Annual Cash Flow Hit: -$${Math.abs(annualCashFlowImpact).toLocaleString()}`);
  console.log(`  10-Year NPV Impact: ~-$${Math.abs(annualCashFlowImpact * 8.5).toLocaleString()} (assuming 8% discount rate)`);
  console.log('');

  // Step 6: Recommendations
  console.log('═══════════════════════════════════════════════════');
  console.log('STEP 6: Recommendations\n');

  if (prediction.confidence === 'high') {
    console.log('✅ USE PREDICTED TAX in pro forma');
    console.log(`   → $${prediction.estimated_new_tax.toLocaleString()}/year (${prediction.confidence} confidence)`);
  } else {
    console.log('⚠️  CONSERVATIVE ASSUMPTION recommended');
    console.log(`   → Use $${prediction.estimated_new_tax.toLocaleString()}/year as baseline`);
    console.log('   → Add 10% buffer for uncertainty');
  }
  console.log('');

  if (trends.reassessment_pattern.avg_reassessment_lag_months < 6) {
    console.log('🚨 County reassesses quickly!');
    console.log('   → Budget for immediate tax increase in Year 1');
  } else if (trends.reassessment_pattern.avg_reassessment_lag_months > 12) {
    console.log('💡 County slow to reassess');
    console.log(`   → Potential ${trends.reassessment_pattern.avg_reassessment_lag_months}-month "tax holiday"`);
    console.log('   → Ramp tax expense in pro forma (current rate for first year)');
  }
  console.log('');

  if (prediction.tax_increase_percent > 20) {
    console.log('⚠️  Significant tax increase expected');
    console.log(`   → +${prediction.tax_increase_percent.toFixed(0)}% is material to returns`);
    console.log('   → Consider tax appeal strategy post-acquisition');
  }
}

console.log('═══════════════════════════════════════════════════');

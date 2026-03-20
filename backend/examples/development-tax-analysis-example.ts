/**
 * Example: Development Deal Tax Analysis
 * 
 * Shows how to use construction reassessment patterns to build
 * accurate development pro formas with proper tax modeling.
 */

import {
  analyzeDealTrends,
  predictPostConstructionTax,
  formatTrendSummary,
} from '../src/utils/historical-trends';

// Example: Ground-up development with historical construction data
const developmentDeal = {
  platform_intel: {
    // Historical tax records
    historical_taxes: [
      {
        year: 2020,
        assessed_value: 750000, // Land only
        tax_amount: 13875,
        millage_rate: 18.5,
      },
      {
        year: 2021,
        assessed_value: 4050000, // After construction complete
        tax_amount: 74925,
        millage_rate: 18.5,
        reassessment_trigger: 'construction',
        linked_construction_event: 'Built 20-unit apartment building',
        construction_completion_date: '2020-09-15',
      },
      {
        year: 2022,
        assessed_value: 4131000,
        tax_amount: 76424,
        millage_rate: 18.5,
      },
      {
        year: 2023,
        assessed_value: 4214000,
        tax_amount: 77959,
        millage_rate: 18.5,
      },
    ],

    // Construction events
    construction_events: [
      {
        event_type: 'new_construction',
        completion_date: '2020-09-15',
        description: 'Built 20-unit apartment building',
        cost: 3600000,
        units_added: 20,
        sqft_added: 24000,
        pre_construction_assessment: 750000,
        post_construction_assessment: 4050000,
      },
    ],
  },
};

// Proposed development project
const LAND_ACQUISITION = 1500000;
const CONSTRUCTION_COST = 7200000;
const TOTAL_PROJECT = LAND_ACQUISITION + CONSTRUCTION_COST;
const CURRENT_LAND_TAX = 27750; // $1.5M land @ 18.5 mills
const MILLAGE_RATE = 18.5;

console.log('═══════════════════════════════════════════════════');
console.log('🏗️ DEVELOPMENT TAX ANALYSIS EXAMPLE');
console.log('═══════════════════════════════════════════════════\n');

console.log('PROJECT OVERVIEW:');
console.log(`  Land Acquisition: $${LAND_ACQUISITION.toLocaleString()}`);
console.log(`  Construction Cost: $${CONSTRUCTION_COST.toLocaleString()}`);
console.log(`  Total Project Cost: $${TOTAL_PROJECT.toLocaleString()}`);
console.log(`  Current Land Tax: $${CURRENT_LAND_TAX.toLocaleString()}/year`);
console.log('\n');

// Step 1: Analyze historical trends
console.log('═══════════════════════════════════════════════════');
console.log('STEP 1: Historical Construction Pattern Analysis\n');

const trends = analyzeDealTrends(developmentDeal.platform_intel);
console.log(formatTrendSummary(trends));
console.log('\n');

// Step 2: Predict post-construction tax
console.log('═══════════════════════════════════════════════════');
console.log('STEP 2: Post-Construction Tax Prediction\n');

const prediction = predictPostConstructionTax(
  CONSTRUCTION_COST,
  LAND_ACQUISITION,
  CURRENT_LAND_TAX,
  trends.reassessment_events,
  MILLAGE_RATE
);

console.log('STABILIZED TAX ESTIMATE:');
console.log(`  Land Value: $${LAND_ACQUISITION.toLocaleString()}`);
console.log(
  `  Estimated Construction Assessment: $${(prediction.estimated_post_construction_assessment - LAND_ACQUISITION).toLocaleString()}`
);
console.log(
  `  Total Assessed Value: $${prediction.estimated_post_construction_assessment.toLocaleString()}`
);
console.log('');
console.log(`  Current Tax (land only): $${CURRENT_LAND_TAX.toLocaleString()}/year`);
console.log(
  `  Stabilized Tax (post-construction): $${prediction.estimated_post_construction_tax.toLocaleString()}/year`
);
console.log(
  `  Tax Increase: +$${prediction.tax_increase_amount.toLocaleString()} (+${prediction.tax_increase_percent.toFixed(0)}%)`
);
console.log(`  Confidence: ${prediction.confidence.toUpperCase()}`);
console.log(`  Methodology: ${prediction.methodology}`);
console.log('\n');

// Step 3: Model tax ramp-up during lease-up
console.log('═══════════════════════════════════════════════════');
console.log('STEP 3: Tax Ramp-Up Modeling\n');

const constructionEvents = trends.reassessment_events.filter(
  e => e.trigger_type === 'construction'
);

if (constructionEvents.length > 0) {
  const avgLag = Math.round(
    constructionEvents.reduce((sum, e) => sum + e.reassessment_lag_months, 0) /
      constructionEvents.length
  );

  console.log(`Based on historical pattern, county reassesses ~${avgLag} months after CO.`);
  console.log('');
  console.log('PRO FORMA TAX SCHEDULE:');
  console.log('');

  // Assume 18-month construction period
  const constructionMonths = 18;
  const leaseUpMonths = 12;
  const totalMonths = constructionMonths + leaseUpMonths;

  let runningMonth = 0;
  let year = 1;
  const monthlyLandTax = CURRENT_LAND_TAX / 12;
  const monthlyStabilizedTax = prediction.estimated_post_construction_tax / 12;

  console.log(`Year 1 (Months 1-12): Construction phase`);
  console.log(`  Tax: $${CURRENT_LAND_TAX.toLocaleString()} (land only)`);
  console.log('');

  runningMonth = 12;

  console.log(`Year 2 (Months 13-24):`);
  const coMonth = constructionMonths; // Month 18 = CO
  const reassessmentMonth = coMonth + avgLag; // Month 18 + 5 = Month 23

  if (reassessmentMonth <= 24) {
    const monthsAtLandRate = reassessmentMonth - 12;
    const monthsAtStabilizedRate = 24 - reassessmentMonth;
    const year2Tax =
      monthsAtLandRate * monthlyLandTax + monthsAtStabilizedRate * monthlyStabilizedTax;

    console.log(`  Months 13-${reassessmentMonth - 1}: Land tax ($${monthlyLandTax.toLocaleString()}/mo)`);
    console.log(`  Month ${reassessmentMonth}: County reassesses! 🚨`);
    console.log(
      `  Months ${reassessmentMonth}-24: Stabilized tax ($${monthlyStabilizedTax.toLocaleString()}/mo)`
    );
    console.log(`  Total Year 2 Tax: $${Math.round(year2Tax).toLocaleString()}`);
  } else {
    console.log(`  Entire year: Land tax ($${CURRENT_LAND_TAX.toLocaleString()})`);
    console.log(`  County reassesses in Year 3, Month ${reassessmentMonth - 24}`);
  }
  console.log('');

  console.log(`Year 3+ (Stabilized):`);
  console.log(
    `  Tax: $${prediction.estimated_post_construction_tax.toLocaleString()}/year`
  );
  console.log('');
}

// Step 4: Pro forma comparison
console.log('═══════════════════════════════════════════════════');
console.log('STEP 4: Pro Forma Comparison\n');

const naiveApproach = CURRENT_LAND_TAX * 3; // Just use land tax for 3 years
const accurateApproach =
  CURRENT_LAND_TAX + // Year 1
  (CURRENT_LAND_TAX * 0.75 + prediction.estimated_post_construction_tax * 0.25) + // Year 2 (blended)
  prediction.estimated_post_construction_tax; // Year 3

console.log('❌ NAIVE APPROACH (land tax only):');
console.log(`  3-Year Tax Total: $${naiveApproach.toLocaleString()}`);
console.log('');

console.log('✅ ACCURATE APPROACH (with reassessment modeling):');
console.log(`  3-Year Tax Total: $${Math.round(accurateApproach).toLocaleString()}`);
console.log('');

const difference = accurateApproach - naiveApproach;
console.log(`💰 DIFFERENCE: $${Math.round(difference).toLocaleString()}`);
console.log(`   → Naive approach underestimates by $${Math.round(difference / 1000).toFixed(0)}K over 3 years`);
console.log('');

// Step 5: NPV Impact
console.log('═══════════════════════════════════════════════════');
console.log('STEP 5: NPV Impact on Returns\n');

const annualCashFlowHit = prediction.tax_increase_amount;
const discountRate = 0.08;
const holdPeriod = 10;

// NPV of annual cash flow hit
let npvImpact = 0;
for (let year = 3; year <= holdPeriod; year++) {
  npvImpact += annualCashFlowHit / Math.pow(1 + discountRate, year);
}

console.log(`Annual Cash Flow Hit: -$${annualCashFlowHit.toLocaleString()}/year (Years 3-10)`);
console.log(`NPV of Tax Underestimation: -$${Math.round(npvImpact).toLocaleString()}`);
console.log(`  (@ ${(discountRate * 100).toFixed(0)}% discount rate over ${holdPeriod} years)`);
console.log('');

const projectEquity = TOTAL_PROJECT * 0.35; // Assume 35% equity
const returnImpact = (npvImpact / projectEquity) * 100;

console.log(`🎯 IMPACT ON EQUITY RETURNS:`);
console.log(`  Equity Investment: $${projectEquity.toLocaleString()}`);
console.log(`  NPV Hit as % of Equity: ${returnImpact.toFixed(1)}%`);
console.log('');

if (returnImpact > 5) {
  console.log('⚠️  MATERIAL IMPACT - Missing this tax spike could kill the deal!');
} else {
  console.log('✓  Impact is modest but should still be modeled accurately.');
}
console.log('');

// Step 6: Recommendations
console.log('═══════════════════════════════════════════════════');
console.log('STEP 6: Pro Forma Recommendations\n');

console.log('📋 CHECKLIST:');
console.log('');
console.log(`✓ Use stabilized tax of $${prediction.estimated_post_construction_tax.toLocaleString()}/year`);
console.log(`✓ Model ${constructionEvents[0]?.reassessment_lag_months || 6}-month lag from CO to reassessment`);
console.log('✓ Show blended tax during Year 2 lease-up period');
console.log('✓ Include tax appeal strategy if assessment seems high');
console.log('✓ Verify current millage rate (may change over hold period)');
console.log('');

console.log('💡 PRO TIP:');
console.log(
  '  Historical construction cost ratio is a strong predictor, but always verify:'
);
console.log('  1. County assessment methodology (cost vs income vs sales comp)');
console.log('  2. Recent appeals in the submarket');
console.log('  3. Whether new construction gets special treatment');
console.log('');

console.log('═══════════════════════════════════════════════════');

/**
 * Historical Trends Analysis Utilities
 * Calculate YoY trends, growth rates, and statistical insights from historical data
 */

export interface TaxTrend {
  years_analyzed: number;
  avg_yoy_growth: number; // Average year-over-year growth rate
  total_growth: number; // Total growth from first to last year
  compound_annual_growth_rate: number;
  latest_year: number;
  latest_assessed_value: number;
  latest_tax_amount: number;
  trend_direction: 'increasing' | 'decreasing' | 'stable';
  volatility: number; // Standard deviation of YoY changes
}

export interface SaleTrend {
  sales_count: number;
  years_spanned: number;
  avg_yoy_appreciation: number;
  total_appreciation: number;
  compound_annual_growth_rate: number;
  latest_sale: {
    date: string;
    price: number;
    price_per_unit?: number;
  };
  earliest_sale: {
    date: string;
    price: number;
    price_per_unit?: number;
  };
  avg_hold_period_years?: number;
  trend_direction: 'appreciating' | 'depreciating' | 'stable';
  volatility: number;
}

export interface ReassessmentEvent {
  trigger_type: 'sale' | 'construction';
  trigger_date: string;
  trigger_value?: number; // Sale price or construction cost
  pre_event_assessment: number;
  post_event_assessment: number;
  reassessment_year: number;
  reassessment_lag_months: number;
  reassessment_ratio?: number; // For sales: new_assessment / sale_price
  construction_cost_ratio?: number; // For construction: assessment_increase / construction_cost
  tax_increase_amount: number;
  tax_increase_percent: number;
  event_description: string;
}

export interface ReassessmentPattern {
  events_analyzed: number;
  avg_reassessment_lag_months: number;
  avg_reassessment_ratio: number; // How close to sale price does county assess?
  avg_tax_increase_percent: number;
  predictable: boolean; // Low variance = predictable
  next_acquisition_tax_estimate?: number; // Projected tax after current asking price
}

export interface CombinedTrends {
  tax_trend: TaxTrend | null;
  sale_trend: SaleTrend | null;
  reassessment_pattern: ReassessmentPattern | null;
  reassessment_events: ReassessmentEvent[];
  insights: string[];
  flags: string[]; // Red flags from trend analysis
}

/**
 * Calculate tax assessment trends
 */
export function analyzeTaxTrends(
  historical_taxes: Array<{ year: number; assessed_value: number; tax_amount: number }>
): TaxTrend | null {
  if (!historical_taxes || historical_taxes.length < 2) {
    return null;
  }

  // Sort by year
  const sorted = [...historical_taxes].sort((a, b) => a.year - b.year);
  
  // Calculate YoY growth rates
  const yoyGrowthRates: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const growth = ((curr.assessed_value - prev.assessed_value) / prev.assessed_value) * 100;
    yoyGrowthRates.push(growth);
  }

  const avgYoyGrowth = yoyGrowthRates.reduce((sum, rate) => sum + rate, 0) / yoyGrowthRates.length;
  
  const firstValue = sorted[0].assessed_value;
  const lastValue = sorted[sorted.length - 1].assessed_value;
  const totalGrowth = ((lastValue - firstValue) / firstValue) * 100;
  
  const yearsSpanned = sorted[sorted.length - 1].year - sorted[0].year;
  const cagr = yearsSpanned > 0 
    ? (Math.pow(lastValue / firstValue, 1 / yearsSpanned) - 1) * 100 
    : 0;

  // Determine trend direction
  let trend_direction: 'increasing' | 'decreasing' | 'stable';
  if (avgYoyGrowth > 2) {
    trend_direction = 'increasing';
  } else if (avgYoyGrowth < -2) {
    trend_direction = 'decreasing';
  } else {
    trend_direction = 'stable';
  }

  // Calculate volatility (standard deviation)
  const mean = avgYoyGrowth;
  const squaredDiffs = yoyGrowthRates.map(rate => Math.pow(rate - mean, 2));
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / yoyGrowthRates.length;
  const volatility = Math.sqrt(variance);

  return {
    years_analyzed: sorted.length,
    avg_yoy_growth: avgYoyGrowth,
    total_growth: totalGrowth,
    compound_annual_growth_rate: cagr,
    latest_year: sorted[sorted.length - 1].year,
    latest_assessed_value: sorted[sorted.length - 1].assessed_value,
    latest_tax_amount: sorted[sorted.length - 1].tax_amount,
    trend_direction,
    volatility,
  };
}

/**
 * Calculate sale price trends
 */
export function analyzeSaleTrends(
  historical_sales: Array<{
    sale_date: string;
    sale_price: number;
    price_per_unit?: number;
    sale_type?: string;
  }>
): SaleTrend | null {
  if (!historical_sales || historical_sales.length < 2) {
    return null;
  }

  // Filter out non-arms-length transactions for trend analysis
  const armsLengthSales = historical_sales.filter(
    s => !s.sale_type || s.sale_type === 'arms_length'
  );

  if (armsLengthSales.length < 2) {
    return null;
  }

  // Sort by date
  const sorted = [...armsLengthSales].sort(
    (a, b) => new Date(a.sale_date).getTime() - new Date(b.sale_date).getTime()
  );

  // Calculate YoY appreciation rates
  const yoyAppreciation: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const appreciation = ((curr.sale_price - prev.sale_price) / prev.sale_price) * 100;
    yoyAppreciation.push(appreciation);
  }

  const avgYoyAppreciation = yoyAppreciation.reduce((sum, rate) => sum + rate, 0) / yoyAppreciation.length;

  const firstPrice = sorted[0].sale_price;
  const lastPrice = sorted[sorted.length - 1].sale_price;
  const totalAppreciation = ((lastPrice - firstPrice) / firstPrice) * 100;

  const firstDate = new Date(sorted[0].sale_date);
  const lastDate = new Date(sorted[sorted.length - 1].sale_date);
  const yearsSpanned = (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  
  const cagr = yearsSpanned > 0
    ? (Math.pow(lastPrice / firstPrice, 1 / yearsSpanned) - 1) * 100
    : 0;

  // Calculate average hold period
  let avgHoldPeriod: number | undefined;
  if (sorted.length > 1) {
    const holdPeriods = [];
    for (let i = 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1].sale_date);
      const curr = new Date(sorted[i].sale_date);
      const years = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
      holdPeriods.push(years);
    }
    avgHoldPeriod = holdPeriods.reduce((sum, y) => sum + y, 0) / holdPeriods.length;
  }

  // Determine trend direction
  let trend_direction: 'appreciating' | 'depreciating' | 'stable';
  if (avgYoyAppreciation > 2) {
    trend_direction = 'appreciating';
  } else if (avgYoyAppreciation < -2) {
    trend_direction = 'depreciating';
  } else {
    trend_direction = 'stable';
  }

  // Calculate volatility
  const mean = avgYoyAppreciation;
  const squaredDiffs = yoyAppreciation.map(rate => Math.pow(rate - mean, 2));
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / yoyAppreciation.length;
  const volatility = Math.sqrt(variance);

  return {
    sales_count: sorted.length,
    years_spanned: yearsSpanned,
    avg_yoy_appreciation: avgYoyAppreciation,
    total_appreciation: totalAppreciation,
    compound_annual_growth_rate: cagr,
    latest_sale: {
      date: sorted[sorted.length - 1].sale_date,
      price: sorted[sorted.length - 1].sale_price,
      price_per_unit: sorted[sorted.length - 1].price_per_unit,
    },
    earliest_sale: {
      date: sorted[0].sale_date,
      price: sorted[0].sale_price,
      price_per_unit: sorted[0].price_per_unit,
    },
    avg_hold_period_years: avgHoldPeriod,
    trend_direction,
    volatility,
  };
}

/**
 * Analyze reassessment events triggered by sales or construction
 */
export function analyzeReassessmentEvents(
  historical_taxes: Array<{
    year: number;
    assessed_value: number;
    tax_amount: number;
    reassessment_trigger?: string;
    linked_sale_date?: string;
    linked_construction_event?: string;
    construction_completion_date?: string;
  }>,
  historical_sales?: Array<{
    sale_date: string;
    sale_price: number;
  }>,
  construction_events?: Array<{
    event_type: string;
    completion_date: string;
    description: string;
    cost?: number;
    pre_construction_assessment?: number;
    post_construction_assessment?: number;
  }>
): { events: ReassessmentEvent[]; pattern: ReassessmentPattern | null } {
  const events: ReassessmentEvent[] = [];

  // Process sale-triggered reassessments
  if (historical_sales) {
    for (const sale of historical_sales) {
      const saleDate = new Date(sale.sale_date);
      const saleYear = saleDate.getFullYear();

      // Find the tax record just before the sale
      const preSaleTax = historical_taxes
        .filter(t => t.year < saleYear)
        .sort((a, b) => b.year - a.year)[0];

      // Find the first tax record after the sale that shows an increase
      const postSaleTaxes = historical_taxes
        .filter(t => t.year >= saleYear)
        .sort((a, b) => a.year - b.year);

      let postSaleTax = null;
      for (const tax of postSaleTaxes) {
        // Look for significant increase (>5%) or explicit link
        if (
          tax.linked_sale_date === sale.sale_date ||
          (preSaleTax && tax.assessed_value > preSaleTax.assessed_value * 1.05)
        ) {
          postSaleTax = tax;
          break;
        }
      }

      if (preSaleTax && postSaleTax) {
        const reassessmentDate = new Date(postSaleTax.year, 0, 1);
        const lagMonths =
          (reassessmentDate.getTime() - saleDate.getTime()) /
          (1000 * 60 * 60 * 24 * 30.44);

        const taxIncrease = postSaleTax.tax_amount - preSaleTax.tax_amount;
        const taxIncreasePercent = (taxIncrease / preSaleTax.tax_amount) * 100;

        events.push({
          trigger_type: 'sale',
          trigger_date: sale.sale_date,
          trigger_value: sale.sale_price,
          pre_event_assessment: preSaleTax.assessed_value,
          post_event_assessment: postSaleTax.assessed_value,
          reassessment_year: postSaleTax.year,
          reassessment_lag_months: Math.round(lagMonths),
          reassessment_ratio: postSaleTax.assessed_value / sale.sale_price,
          tax_increase_amount: taxIncrease,
          tax_increase_percent: taxIncreasePercent,
          event_description: `Sale at $${(sale.sale_price / 1000).toFixed(0)}K`,
        });
      }
    }
  }

  // Process construction-triggered reassessments
  if (construction_events) {
    for (const construction of construction_events) {
      const completionDate = new Date(construction.completion_date);
      const completionYear = completionDate.getFullYear();

      // Find the tax record just before construction completed
      const preConstructionTax = historical_taxes
        .filter(t => t.year < completionYear)
        .sort((a, b) => b.year - a.year)[0];

      // Find the first tax record after construction that shows an increase
      const postConstructionTaxes = historical_taxes
        .filter(t => t.year >= completionYear)
        .sort((a, b) => a.year - b.year);

      let postConstructionTax = null;
      for (const tax of postConstructionTaxes) {
        // Look for significant increase or explicit link
        if (
          tax.construction_completion_date === construction.completion_date ||
          (preConstructionTax && tax.assessed_value > preConstructionTax.assessed_value * 1.1)
        ) {
          postConstructionTax = tax;
          break;
        }
      }

      if (preConstructionTax && postConstructionTax) {
        const reassessmentDate = new Date(postConstructionTax.year, 0, 1);
        const lagMonths =
          (reassessmentDate.getTime() - completionDate.getTime()) /
          (1000 * 60 * 60 * 24 * 30.44);

        const taxIncrease = postConstructionTax.tax_amount - preConstructionTax.tax_amount;
        const taxIncreasePercent = (taxIncrease / preConstructionTax.tax_amount) * 100;

        const assessmentIncrease =
          postConstructionTax.assessed_value - preConstructionTax.assessed_value;

        events.push({
          trigger_type: 'construction',
          trigger_date: construction.completion_date,
          trigger_value: construction.cost,
          pre_event_assessment: preConstructionTax.assessed_value,
          post_event_assessment: postConstructionTax.assessed_value,
          reassessment_year: postConstructionTax.year,
          reassessment_lag_months: Math.round(lagMonths),
          construction_cost_ratio: construction.cost
            ? assessmentIncrease / construction.cost
            : undefined,
          tax_increase_amount: taxIncrease,
          tax_increase_percent: taxIncreasePercent,
          event_description: construction.description,
        });
      }
    }
  }

  // Calculate pattern if we have enough events
  let pattern: ReassessmentPattern | null = null;
  if (events.length > 0) {
    const avgLagMonths =
      events.reduce((sum, e) => sum + e.reassessment_lag_months, 0) / events.length;
    const avgRatio =
      events.reduce((sum, e) => sum + e.reassessment_ratio, 0) / events.length;
    const avgTaxIncrease =
      events.reduce((sum, e) => sum + e.tax_increase_percent, 0) / events.length;

    // Check if pattern is predictable (low variance in ratios)
    const ratioVariance =
      events.reduce((sum, e) => sum + Math.pow(e.reassessment_ratio - avgRatio, 2), 0) /
      events.length;
    const predictable = Math.sqrt(ratioVariance) < 0.1; // Std dev < 10%

    pattern = {
      events_analyzed: events.length,
      avg_reassessment_lag_months: Math.round(avgLagMonths),
      avg_reassessment_ratio: avgRatio,
      avg_tax_increase_percent: avgTaxIncrease,
      predictable,
    };
  }

  return { events, pattern };
}

/**
 * Predict post-construction tax liability (for development deals)
 */
export function predictPostConstructionTax(
  construction_cost: number,
  land_value: number,
  current_tax_amount: number,
  construction_events: ReassessmentEvent[],
  current_millage_rate?: number
): {
  estimated_post_construction_assessment: number;
  estimated_post_construction_tax: number;
  tax_increase_amount: number;
  tax_increase_percent: number;
  confidence: 'high' | 'medium' | 'low';
  methodology: string;
} {
  // Filter to construction-triggered events only
  const constructionEvents = construction_events.filter(e => e.trigger_type === 'construction');

  let estimated_assessment: number;
  let confidence: 'high' | 'medium' | 'low';
  let methodology: string;

  if (constructionEvents.length >= 2) {
    // Use historical construction cost ratio
    const avgCostRatio =
      constructionEvents
        .filter(e => e.construction_cost_ratio)
        .reduce((sum, e) => sum + (e.construction_cost_ratio || 0), 0) /
      constructionEvents.filter(e => e.construction_cost_ratio).length;

    const assessmentIncrease = construction_cost * avgCostRatio;
    estimated_assessment = land_value + assessmentIncrease;
    confidence = 'high';
    methodology = `Based on ${constructionEvents.length} historical construction reassessments (avg ${(avgCostRatio * 100).toFixed(0)}% of construction cost)`;
  } else if (current_millage_rate) {
    // Use conservative assumption: county assesses at 80% of total cost
    estimated_assessment = land_value + construction_cost * 0.8;
    confidence = 'medium';
    methodology = 'Assuming 80% assessment ratio for new construction (limited historical data)';
  } else {
    // Very conservative: assume full cost
    estimated_assessment = land_value + construction_cost;
    confidence = 'low';
    methodology = 'Conservative estimate: full construction cost added to land value';
  }

  // Calculate new tax
  let estimated_new_tax: number;
  if (current_millage_rate) {
    estimated_new_tax = estimated_assessment * (current_millage_rate / 1000);
  } else {
    // Proportional estimate (fallback)
    estimated_new_tax = current_tax_amount * 2.5; // Rough multiplier for typical development
  }

  const tax_increase_amount = estimated_new_tax - current_tax_amount;
  const tax_increase_percent = (tax_increase_amount / current_tax_amount) * 100;

  return {
    estimated_post_construction_assessment: estimated_assessment,
    estimated_post_construction_tax: estimated_new_tax,
    tax_increase_amount,
    tax_increase_percent,
    confidence,
    methodology,
  };
}

/**
 * Predict post-acquisition tax liability
 */
export function predictPostAcquisitionTax(
  asking_price: number,
  current_tax_amount: number,
  current_assessed_value: number,
  reassessment_pattern: ReassessmentPattern | null,
  current_millage_rate?: number
): {
  estimated_new_assessment: number;
  estimated_new_tax: number;
  tax_increase_amount: number;
  tax_increase_percent: number;
  confidence: 'high' | 'medium' | 'low';
  methodology: string;
} {
  let estimated_new_assessment: number;
  let confidence: 'high' | 'medium' | 'low';
  let methodology: string;

  if (reassessment_pattern && reassessment_pattern.predictable) {
    // Use historical reassessment ratio
    estimated_new_assessment = asking_price * reassessment_pattern.avg_reassessment_ratio;
    confidence = 'high';
    methodology = `Based on ${reassessment_pattern.events_analyzed} historical reassessments (avg ratio: ${(reassessment_pattern.avg_reassessment_ratio * 100).toFixed(1)}%)`;
  } else if (current_millage_rate) {
    // Assume full reassessment to asking price
    estimated_new_assessment = asking_price * 0.85; // Conservative 85% ratio
    confidence = 'medium';
    methodology = 'Assuming 85% assessment ratio (no historical pattern available)';
  } else {
    // Use proportional increase
    const proportionalIncrease = asking_price / current_assessed_value;
    estimated_new_assessment = current_assessed_value * proportionalIncrease;
    confidence = 'low';
    methodology = 'Proportional estimate (limited data)';
  }

  // Calculate new tax
  let estimated_new_tax: number;
  if (current_millage_rate) {
    estimated_new_tax = estimated_new_assessment * (current_millage_rate / 1000);
  } else {
    // Use proportional method
    estimated_new_tax =
      current_tax_amount * (estimated_new_assessment / current_assessed_value);
  }

  const tax_increase_amount = estimated_new_tax - current_tax_amount;
  const tax_increase_percent = (tax_increase_amount / current_tax_amount) * 100;

  return {
    estimated_new_assessment,
    estimated_new_tax,
    tax_increase_amount,
    tax_increase_percent,
    confidence,
    methodology,
  };
}

/**
 * Generate insights from combined trends
 */
export function generateTrendInsights(
  tax_trend: TaxTrend | null,
  sale_trend: SaleTrend | null,
  reassessment_pattern: ReassessmentPattern | null,
  reassessment_events: ReassessmentEvent[]
): { insights: string[]; flags: string[] } {
  const insights: string[] = [];
  const flags: string[] = [];

  // Tax trend insights
  if (tax_trend) {
    if (tax_trend.avg_yoy_growth > 5) {
      insights.push(
        `Property taxes increasing rapidly at ${tax_trend.avg_yoy_growth.toFixed(1)}% YoY - factor into expense projections`
      );
    }
    
    if (tax_trend.volatility > 10) {
      flags.push(`High tax volatility (${tax_trend.volatility.toFixed(1)}%) - unpredictable expense trajectory`);
    }

    if (tax_trend.trend_direction === 'increasing' && tax_trend.avg_yoy_growth > 8) {
      flags.push(`Aggressive tax assessment increases (${tax_trend.avg_yoy_growth.toFixed(1)}% YoY) - may impact returns`);
    }
  }

  // Sale trend insights
  if (sale_trend) {
    if (sale_trend.avg_yoy_appreciation > 10) {
      insights.push(
        `Strong historical appreciation at ${sale_trend.avg_yoy_appreciation.toFixed(1)}% YoY - active market`
      );
    }

    if (sale_trend.trend_direction === 'depreciating') {
      flags.push(`Property values declining (${sale_trend.avg_yoy_appreciation.toFixed(1)}% YoY) - market weakness signal`);
    }

    if (sale_trend.volatility > 15) {
      flags.push(`High price volatility (${sale_trend.volatility.toFixed(1)}%) - uncertain exit pricing`);
    }

    if (sale_trend.avg_hold_period_years && sale_trend.avg_hold_period_years < 2) {
      flags.push(`Short avg hold period (${sale_trend.avg_hold_period_years.toFixed(1)} yrs) - potential flipping activity`);
    }
  }

  // Separate sale vs construction events
  const saleEvents = reassessment_events.filter(e => e.trigger_type === 'sale');
  const constructionEvents = reassessment_events.filter(e => e.trigger_type === 'construction');

  // Reassessment pattern insights
  if (reassessment_pattern) {
    if (saleEvents.length > 0 && reassessment_pattern.predictable) {
      insights.push(
        `Predictable reassessment pattern: ${reassessment_pattern.avg_reassessment_lag_months} mo lag, ${(reassessment_pattern.avg_reassessment_ratio * 100).toFixed(0)}% of sale price`
      );
    } else if (reassessment_events.length > 0 && !reassessment_pattern.predictable) {
      flags.push('Inconsistent reassessment pattern - tax projections uncertain');
    }

    if (reassessment_pattern.avg_tax_increase_percent > 30) {
      flags.push(
        `Large tax spikes after sales (avg +${reassessment_pattern.avg_tax_increase_percent.toFixed(0)}%) - factor into acquisition budget`
      );
    }

    if (reassessment_pattern.avg_reassessment_lag_months > 18) {
      insights.push(
        `County slow to reassess (${reassessment_pattern.avg_reassessment_lag_months} mo avg) - potential tax holiday window`
      );
    } else if (reassessment_pattern.avg_reassessment_lag_months < 6) {
      flags.push(
        `County reassesses quickly (${reassessment_pattern.avg_reassessment_lag_months} mo avg) - immediate tax impact after closing`
      );
    }
  }

  // Construction-specific insights
  if (constructionEvents.length > 0) {
    const avgConstructionTaxIncrease =
      constructionEvents.reduce((sum, e) => sum + e.tax_increase_percent, 0) /
      constructionEvents.length;

    if (avgConstructionTaxIncrease > 100) {
      flags.push(
        `Construction triggers major tax increases (avg +${avgConstructionTaxIncrease.toFixed(0)}%) - critical for development pro formas`
      );
    } else {
      insights.push(
        `Construction reassessment pattern: avg +${avgConstructionTaxIncrease.toFixed(0)}% tax increase upon completion`
      );
    }

    // Check if we have cost ratios
    const eventsWithCostRatio = constructionEvents.filter(e => e.construction_cost_ratio);
    if (eventsWithCostRatio.length > 0) {
      const avgCostRatio =
        eventsWithCostRatio.reduce((sum, e) => sum + (e.construction_cost_ratio || 0), 0) /
        eventsWithCostRatio.length;

      insights.push(
        `County assesses new construction at ~${(avgCostRatio * 100).toFixed(0)}% of construction cost`
      );
    }

    const avgConstructionLag =
      constructionEvents.reduce((sum, e) => sum + e.reassessment_lag_months, 0) /
      constructionEvents.length;

    if (avgConstructionLag < 6) {
      flags.push(
        `County reassesses quickly after construction (${Math.round(avgConstructionLag)} mo) - plan for immediate tax spike`
      );
    } else if (avgConstructionLag > 12) {
      insights.push(
        `County slow to reassess after construction (${Math.round(avgConstructionLag)} mo) - extended stabilization window`
      );
    }
  }

  // Cross-trend insights
  if (tax_trend && sale_trend) {
    // Tax growth exceeding appreciation
    if (tax_trend.avg_yoy_growth > sale_trend.avg_yoy_appreciation + 3) {
      flags.push(
        `Taxes growing faster than values (tax: ${tax_trend.avg_yoy_growth.toFixed(1)}% vs appreciation: ${sale_trend.avg_yoy_appreciation.toFixed(1)}%) - margin compression risk`
      );
    }

    // Both growing healthily
    if (tax_trend.trend_direction === 'increasing' && sale_trend.trend_direction === 'appreciating') {
      insights.push('Healthy market fundamentals - both taxes and values trending up');
    }
  }

  return { insights, flags };
}

/**
 * Analyze all historical trends for a deal
 */
export function analyzeDealTrends(platform_intel: {
  historical_taxes?: Array<{
    year: number;
    assessed_value: number;
    tax_amount: number;
    reassessment_trigger?: string;
    linked_sale_date?: string;
    linked_construction_event?: string;
    construction_completion_date?: string;
  }>;
  historical_sales?: Array<{
    sale_date: string;
    sale_price: number;
    price_per_unit?: number;
    sale_type?: string;
  }>;
  construction_events?: Array<{
    event_type: string;
    completion_date: string;
    description: string;
    cost?: number;
    pre_construction_assessment?: number;
    post_construction_assessment?: number;
  }>;
}): CombinedTrends {
  const tax_trend = platform_intel.historical_taxes
    ? analyzeTaxTrends(platform_intel.historical_taxes)
    : null;

  const sale_trend = platform_intel.historical_sales
    ? analyzeSaleTrends(platform_intel.historical_sales)
    : null;

  // Analyze reassessment events (sales + construction)
  let reassessment_pattern: ReassessmentPattern | null = null;
  let reassessment_events: ReassessmentEvent[] = [];

  if (platform_intel.historical_taxes) {
    const result = analyzeReassessmentEvents(
      platform_intel.historical_taxes,
      platform_intel.historical_sales,
      platform_intel.construction_events
    );
    reassessment_pattern = result.pattern;
    reassessment_events = result.events;
  }

  const { insights, flags } = generateTrendInsights(
    tax_trend,
    sale_trend,
    reassessment_pattern,
    reassessment_events
  );

  return {
    tax_trend,
    sale_trend,
    reassessment_pattern,
    reassessment_events,
    insights,
    flags,
  };
}

/**
 * Format trends for display
 */
export function formatTrendSummary(trends: CombinedTrends): string {
  const parts: string[] = [];

  if (trends.tax_trend) {
    parts.push(`📊 Tax Trends (${trends.tax_trend.years_analyzed} years):`);
    parts.push(`  • YoY Growth: ${trends.tax_trend.avg_yoy_growth.toFixed(1)}%`);
    parts.push(`  • CAGR: ${trends.tax_trend.compound_annual_growth_rate.toFixed(1)}%`);
    parts.push(`  • Latest: $${trends.tax_trend.latest_tax_amount.toLocaleString()} (${trends.tax_trend.latest_year})`);
    parts.push('');
  }

  if (trends.sale_trend) {
    parts.push(`💰 Sale Price Trends (${trends.sale_trend.sales_count} sales):`);
    parts.push(`  • YoY Appreciation: ${trends.sale_trend.avg_yoy_appreciation.toFixed(1)}%`);
    parts.push(`  • CAGR: ${trends.sale_trend.compound_annual_growth_rate.toFixed(1)}%`);
    parts.push(`  • Latest: $${trends.sale_trend.latest_sale.price.toLocaleString()}`);
    if (trends.sale_trend.avg_hold_period_years) {
      parts.push(`  • Avg Hold: ${trends.sale_trend.avg_hold_period_years.toFixed(1)} years`);
    }
    parts.push('');
  }

  if (trends.reassessment_pattern) {
    parts.push(`🔄 Reassessment Pattern (${trends.reassessment_pattern.events_analyzed} events):`);
    parts.push(`  • Avg Lag: ${trends.reassessment_pattern.avg_reassessment_lag_months} months post-sale`);
    parts.push(`  • Assessment Ratio: ${(trends.reassessment_pattern.avg_reassessment_ratio * 100).toFixed(0)}% of sale price`);
    parts.push(`  • Avg Tax Increase: +${trends.reassessment_pattern.avg_tax_increase_percent.toFixed(1)}%`);
    parts.push(`  • Predictability: ${trends.reassessment_pattern.predictable ? 'High ✓' : 'Low ⚠️'}`);
    parts.push('');
  }

  if (trends.reassessment_events.length > 0) {
    const saleEvents = trends.reassessment_events.filter(e => e.trigger_type === 'sale');
    const constructionEvents = trends.reassessment_events.filter(
      e => e.trigger_type === 'construction'
    );

    if (saleEvents.length > 0) {
      parts.push('📋 Sale-Triggered Reassessments:');
      saleEvents.forEach(event => {
        const eventYear = new Date(event.trigger_date).getFullYear();
        parts.push(
          `  • ${eventYear}: ${event.event_description} → assessed ${event.reassessment_year} (+${event.tax_increase_percent.toFixed(0)}% tax)`
        );
      });
      parts.push('');
    }

    if (constructionEvents.length > 0) {
      parts.push('🏗️ Construction-Triggered Reassessments:');
      constructionEvents.forEach(event => {
        const eventYear = new Date(event.trigger_date).getFullYear();
        const costRatioStr = event.construction_cost_ratio
          ? ` at ${(event.construction_cost_ratio * 100).toFixed(0)}% of cost`
          : '';
        parts.push(
          `  • ${eventYear}: ${event.event_description} → assessed ${event.reassessment_year}${costRatioStr} (+${event.tax_increase_percent.toFixed(0)}% tax)`
        );
      });
      parts.push('');
    }
  }

  if (trends.insights.length > 0) {
    parts.push('💡 Insights:');
    trends.insights.forEach(insight => parts.push(`  • ${insight}`));
    parts.push('');
  }

  if (trends.flags.length > 0) {
    parts.push('🚩 Flags:');
    trends.flags.forEach(flag => parts.push(`  • ${flag}`));
  }

  return parts.join('\n');
}

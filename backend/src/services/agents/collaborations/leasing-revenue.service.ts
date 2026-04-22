/**
 * Leasing → Revenue Management Collaboration
 * 
 * Leasing reports traffic/conversion data → Revenue Management adjusts pricing
 * 
 * Key Handoffs:
 * - Traffic up + conversion down → Lower rents to capture demand
 * - Wait list forming → Push rents higher
 * - Unit types sitting → Targeted concessions
 * - Lease expiration clustering → Stagger renewals
 * 
 * @version 1.0.0
 * @date 2026-04-22
 */

import Anthropic from '@anthropic-ai/sdk';
import { query } from '../../../database/connection';
import { logger } from '../../../utils/logger';

// ============================================================================
// TYPES
// ============================================================================

export interface LeasingMetrics {
  dealId: string;
  propertyId?: string;
  period: string; // e.g., "2026-W16"
  
  // Traffic
  totalTraffic: number;
  qualifiedLeads: number;
  tours: number;
  applications: number;
  
  // Conversion
  tourToAppRate: number;
  appToLeaseRate: number;
  overallConversionRate: number;
  
  // Velocity
  avgDaysToLease: number;
  leasesThisPeriod: number;
  cancellationsThisPeriod: number;
  
  // Occupancy
  currentOccupancy: number;
  preLeasedUnits: number;
  availableUnits: number;
  waitListCount: number;
  
  // By unit type
  unitTypeMetrics?: {
    unitType: string;
    available: number;
    daysOnMarket: number;
    askingRent: number;
    effectiveRent: number;
    conversionRate: number;
  }[];
}

export interface PricingRecommendation {
  id: string;
  dealId: string;
  generatedAt: Date;
  
  // Overall assessment
  demandSignal: 'strong' | 'moderate' | 'weak';
  pricingPower: 'increase' | 'hold' | 'decrease';
  urgency: 'immediate' | 'next_week' | 'monitor';
  
  // Rent adjustments
  rentAdjustments: {
    unitType: string;
    currentRent: number;
    recommendedRent: number;
    changePercent: number;
    rationale: string;
    effectiveDate: string;
  }[];
  
  // Concession recommendations
  concessionRecommendations: {
    unitType?: string;
    concessionType: 'none' | 'move_in_special' | 'free_month' | 'reduced_deposit' | 'gift_card';
    amount?: number;
    duration?: string;
    rationale: string;
  }[];
  
  // Renewal strategy
  renewalStrategy: {
    targetRenewalRate: number;
    recommendedIncreasePercent: number;
    expirationRiskUnits: number;
    staggeringRecommendation?: string;
  };
  
  // Projected impact
  projectedImpact: {
    revenueChangeMonthly: number;
    occupancyChangeExpected: number;
    noiImpactAnnualized: number;
  };
  
  summaryForRevenueManager: string;
}

// ============================================================================
// ANTHROPIC CLIENT
// ============================================================================

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ============================================================================
// LEASING → REVENUE MANAGEMENT SERVICE
// ============================================================================

class LeasingRevenueService {
  
  /**
   * Leasing reports metrics, Revenue Management generates pricing recommendations
   */
  async analyzeAndRecommend(metrics: LeasingMetrics, userId: string): Promise<PricingRecommendation> {
    const { dealId } = metrics;
    
    logger.info('Revenue Management analyzing leasing metrics', { dealId, occupancy: metrics.currentOccupancy });
    
    // Get historical comparison
    const historical = await this.getHistoricalMetrics(dealId);
    
    // Get comp set pricing if available
    const compPricing = await this.getCompSetPricing(dealId);
    
    // Generate AI recommendations
    const aiAnalysis = await this.getAIRecommendations(metrics, historical, compPricing);
    
    const recommendation: PricingRecommendation = {
      id: `pricing_rec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      dealId,
      generatedAt: new Date(),
      demandSignal: aiAnalysis.demandSignal || this.assessDemandSignal(metrics),
      pricingPower: aiAnalysis.pricingPower || 'hold',
      urgency: aiAnalysis.urgency || 'monitor',
      rentAdjustments: aiAnalysis.rentAdjustments || [],
      concessionRecommendations: aiAnalysis.concessionRecommendations || [],
      renewalStrategy: aiAnalysis.renewalStrategy || {
        targetRenewalRate: 55,
        recommendedIncreasePercent: 3,
        expirationRiskUnits: 0,
      },
      projectedImpact: aiAnalysis.projectedImpact || {
        revenueChangeMonthly: 0,
        occupancyChangeExpected: 0,
        noiImpactAnnualized: 0,
      },
      summaryForRevenueManager: aiAnalysis.summaryForRevenueManager || 'Analysis complete',
    };
    
    // Store and notify
    await this.storeRecommendation(recommendation);
    await this.notifyRevenueManager(dealId, userId, recommendation);
    
    return recommendation;
  }

  /**
   * Assess demand signal from metrics
   */
  private assessDemandSignal(metrics: LeasingMetrics): 'strong' | 'moderate' | 'weak' {
    const { currentOccupancy, waitListCount, overallConversionRate, totalTraffic } = metrics;
    
    // Strong: high occupancy + wait list OR high conversion
    if ((currentOccupancy > 95 && waitListCount > 5) || overallConversionRate > 0.4) {
      return 'strong';
    }
    
    // Weak: low occupancy + low traffic + low conversion
    if (currentOccupancy < 90 && totalTraffic < 20 && overallConversionRate < 0.15) {
      return 'weak';
    }
    
    return 'moderate';
  }

  /**
   * Get historical metrics for comparison
   */
  private async getHistoricalMetrics(dealId: string): Promise<any[]> {
    try {
      const result = await query(
        `SELECT * FROM deal_leasing_metrics 
         WHERE deal_id = $1 
         ORDER BY period DESC 
         LIMIT 12`,
        [dealId]
      );
      return result.rows;
    } catch (error) {
      return [];
    }
  }

  /**
   * Get comp set pricing if available
   */
  private async getCompSetPricing(dealId: string): Promise<any> {
    try {
      const result = await query(
        `SELECT cs.*, c.name as comp_name, c.avg_rent, c.occupancy
         FROM competitive_sets cs
         JOIN comps c ON c.comp_set_id = cs.id
         WHERE cs.deal_id = $1
         LIMIT 10`,
        [dealId]
      );
      return result.rows;
    } catch (error) {
      return [];
    }
  }

  /**
   * Get AI recommendations
   */
  private async getAIRecommendations(metrics: LeasingMetrics, historical: any[], compPricing: any[]): Promise<any> {
    const prompt = `You are a real estate Revenue Manager optimizing rent pricing based on leasing data.

CURRENT LEASING METRICS:
- Period: ${metrics.period}
- Total Traffic: ${metrics.totalTraffic}
- Qualified Leads: ${metrics.qualifiedLeads}
- Tours: ${metrics.tours}
- Applications: ${metrics.applications}

CONVERSION:
- Tour to App Rate: ${(metrics.tourToAppRate * 100).toFixed(1)}%
- App to Lease Rate: ${(metrics.appToLeaseRate * 100).toFixed(1)}%
- Overall Conversion: ${(metrics.overallConversionRate * 100).toFixed(1)}%

OCCUPANCY:
- Current: ${(metrics.currentOccupancy * 100).toFixed(1)}%
- Pre-leased: ${metrics.preLeasedUnits} units
- Available: ${metrics.availableUnits} units
- Wait List: ${metrics.waitListCount}

VELOCITY:
- Avg Days to Lease: ${metrics.avgDaysToLease}
- Leases This Period: ${metrics.leasesThisPeriod}
- Cancellations: ${metrics.cancellationsThisPeriod}

${metrics.unitTypeMetrics ? `UNIT TYPE BREAKDOWN:\n${metrics.unitTypeMetrics.map(u => 
  `- ${u.unitType}: ${u.available} avail, ${u.daysOnMarket} DOM, $${u.askingRent} asking, ${(u.conversionRate * 100).toFixed(0)}% conv`
).join('\n')}` : ''}

${historical.length > 0 ? `HISTORICAL (prior 4 weeks):\n${historical.slice(0, 4).map((h: any) => 
  `- ${h.period}: ${h.total_traffic} traffic, ${(h.overall_conversion_rate * 100).toFixed(1)}% conv, ${(h.current_occupancy * 100).toFixed(1)}% occ`
).join('\n')}` : ''}

${compPricing.length > 0 ? `COMP SET:\n${compPricing.map((c: any) => 
  `- ${c.comp_name}: $${c.avg_rent} avg rent, ${(c.occupancy * 100).toFixed(0)}% occ`
).join('\n')}` : ''}

Provide pricing recommendations in JSON:
{
  "demandSignal": "strong|moderate|weak",
  "pricingPower": "increase|hold|decrease",
  "urgency": "immediate|next_week|monitor",
  "rentAdjustments": [
    {
      "unitType": "<unit type or 'all'>",
      "currentRent": <$>,
      "recommendedRent": <$>,
      "changePercent": <%>,
      "rationale": "<why>",
      "effectiveDate": "<when>"
    }
  ],
  "concessionRecommendations": [
    {
      "unitType": "<unit type or null for all>",
      "concessionType": "none|move_in_special|free_month|reduced_deposit|gift_card",
      "amount": <$ if applicable>,
      "duration": "<e.g., 'through April'>",
      "rationale": "<why>"
    }
  ],
  "renewalStrategy": {
    "targetRenewalRate": <%>,
    "recommendedIncreasePercent": <%>,
    "expirationRiskUnits": <count>,
    "staggeringRecommendation": "<if clustering is an issue>"
  },
  "projectedImpact": {
    "revenueChangeMonthly": <$>,
    "occupancyChangeExpected": <% points>,
    "noiImpactAnnualized": <$>
  },
  "summaryForRevenueManager": "<2-3 sentence executive summary>"
}

Consider:
- High traffic + low conversion = price too high OR sales execution issue
- Wait list = pricing power exists, push rents
- Specific unit types lagging = targeted concessions
- Seasonal patterns
- Comp positioning`;

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2500,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content.find(b => b.type === 'text')?.text || '{}';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      return JSON.parse(jsonMatch?.[0] || '{}');
    } catch (error) {
      logger.warn('AI pricing analysis failed', { error });
      return {};
    }
  }

  /**
   * Store recommendation
   */
  private async storeRecommendation(rec: PricingRecommendation): Promise<void> {
    try {
      await query(
        `INSERT INTO agent_collaboration_pricing_recommendations
         (id, deal_id, demand_signal, pricing_power, urgency, rent_adjustments,
          concession_recommendations, renewal_strategy, projected_impact, summary, generated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          rec.id, rec.dealId, rec.demandSignal, rec.pricingPower, rec.urgency,
          JSON.stringify(rec.rentAdjustments), JSON.stringify(rec.concessionRecommendations),
          JSON.stringify(rec.renewalStrategy), JSON.stringify(rec.projectedImpact),
          rec.summaryForRevenueManager, rec.generatedAt,
        ]
      );
    } catch (error) {
      logger.warn('Failed to store pricing recommendation', { error });
    }
  }

  /**
   * Notify revenue manager / property manager
   */
  private async notifyRevenueManager(dealId: string, userId: string, rec: PricingRecommendation): Promise<void> {
    // Notify if there are actionable recommendations
    if (rec.urgency === 'monitor' && rec.rentAdjustments.length === 0) {
      return;
    }

    const severity = rec.urgency === 'immediate' ? 'warning' : 'info';

    try {
      await query(
        `INSERT INTO agent_notifications 
         (user_id, deal_id, agent_id, type, title, message, channels)
         VALUES ($1, $2, 'property_manager', $3, $4, $5, '["in_app"]')`,
        [
          userId, dealId, severity,
          `Pricing Update: ${rec.pricingPower.toUpperCase()} Recommended`,
          rec.summaryForRevenueManager,
        ]
      );
    } catch (error) {
      logger.warn('Failed to notify revenue manager', { error });
    }
  }

  /**
   * Store leasing metrics (called by Leasing agent)
   */
  async storeMetrics(metrics: LeasingMetrics): Promise<void> {
    try {
      await query(
        `INSERT INTO deal_leasing_metrics
         (deal_id, period, total_traffic, qualified_leads, tours, applications,
          tour_to_app_rate, app_to_lease_rate, overall_conversion_rate,
          avg_days_to_lease, leases_this_period, cancellations_this_period,
          current_occupancy, preleased_units, available_units, wait_list_count,
          unit_type_metrics, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW())
         ON CONFLICT (deal_id, period) DO UPDATE SET
           total_traffic = EXCLUDED.total_traffic,
           qualified_leads = EXCLUDED.qualified_leads,
           tours = EXCLUDED.tours,
           applications = EXCLUDED.applications,
           tour_to_app_rate = EXCLUDED.tour_to_app_rate,
           app_to_lease_rate = EXCLUDED.app_to_lease_rate,
           overall_conversion_rate = EXCLUDED.overall_conversion_rate,
           avg_days_to_lease = EXCLUDED.avg_days_to_lease,
           leases_this_period = EXCLUDED.leases_this_period,
           cancellations_this_period = EXCLUDED.cancellations_this_period,
           current_occupancy = EXCLUDED.current_occupancy,
           preleased_units = EXCLUDED.preleased_units,
           available_units = EXCLUDED.available_units,
           wait_list_count = EXCLUDED.wait_list_count,
           unit_type_metrics = EXCLUDED.unit_type_metrics`,
        [
          metrics.dealId, metrics.period, metrics.totalTraffic, metrics.qualifiedLeads,
          metrics.tours, metrics.applications, metrics.tourToAppRate, metrics.appToLeaseRate,
          metrics.overallConversionRate, metrics.avgDaysToLease, metrics.leasesThisPeriod,
          metrics.cancellationsThisPeriod, metrics.currentOccupancy, metrics.preLeasedUnits,
          metrics.availableUnits, metrics.waitListCount, JSON.stringify(metrics.unitTypeMetrics || []),
        ]
      );
    } catch (error) {
      logger.warn('Failed to store leasing metrics', { error });
    }
  }

  /**
   * Get pricing recommendation history
   */
  async getPricingHistory(dealId: string): Promise<PricingRecommendation[]> {
    const result = await query(
      `SELECT * FROM agent_collaboration_pricing_recommendations WHERE deal_id = $1 ORDER BY generated_at DESC LIMIT 20`,
      [dealId]
    );
    return result.rows.map(row => ({
      id: row.id,
      dealId: row.deal_id,
      generatedAt: row.generated_at,
      demandSignal: row.demand_signal,
      pricingPower: row.pricing_power,
      urgency: row.urgency,
      rentAdjustments: row.rent_adjustments,
      concessionRecommendations: row.concession_recommendations,
      renewalStrategy: row.renewal_strategy,
      projectedImpact: row.projected_impact,
      summaryForRevenueManager: row.summary,
    }));
  }
}

export const leasingRevenueService = new LeasingRevenueService();
export default leasingRevenueService;

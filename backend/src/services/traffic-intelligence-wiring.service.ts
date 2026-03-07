/**
 * Traffic Intelligence Wiring Service
 * Connects M05 Market Intel, M02 Supply, and M07 Traffic Engine
 * Implements comp-based traffic for new developments
 */

import { pool } from '../database';
import { logger } from '../utils/logger';
import { trafficCompAdjustmentService } from './traffic-comp-adjustment.service';

export interface MarketIntelligenceData {
  demographics: {
    renterDemandFunnel: {
      demandPool: string;
      captureRate: string;
      incomeQualified: string;
    };
    submarket: {
      name: string;
      avg_occupancy: number;
      total_units: number;
      avg_rent: number;
    };
  };
  economy: {
    employers: Array<{
      name: string;
      employees: string;
      statusText: string;
      demandImpact: string;
    }>;
    developmentPipeline: Array<{
      project: string;
      type: string;
      impact: string;
      timeline?: string;
    }>;
  };
  news: Array<{
    type: string;
    category: string;
    headline: string;
    date: string;
  }>;
}

export interface DynamicTrafficFactors {
  demandFactor: number;
  supplyFactor: number;
  digitalFactor: number;
  demandReasoning: string;
  supplyReasoning: string;
  digitalReasoning: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

export class TrafficIntelligenceWiringService {

  /**
   * Fetch market intelligence for a deal from deal_data JSONB
   */
  async getMarketIntelligence(dealId: string): Promise<MarketIntelligenceData | null> {
    try {
      const result = await pool.query(`
        SELECT deal_data->'market_intelligence'->'data' as market_intel
        FROM deals
        WHERE id = $1
      `, [dealId]);

      if (result.rows.length === 0 || !result.rows[0].market_intel) {
        logger.warn(`No market intelligence found for deal ${dealId}`);
        return null;
      }

      return result.rows[0].market_intel as MarketIntelligenceData;
    } catch (err) {
      logger.error('Error fetching market intelligence:', err);
      return null;
    }
  }

  /**
   * Calculate Demand Factor from M05 Market Intelligence
   * Based on: demand pool, employer moves, submarket occupancy, news sentiment
   */
  calculateDemandFactor(marketIntel: MarketIntelligenceData, targetUnits: number): {
    factor: number;
    reasoning: string;
  } {
    try {
      const demandFunnel = marketIntel.demographics?.renterDemandFunnel;
      const employers = marketIntel.economy?.employers || [];
      const occupancy = marketIntel.demographics?.submarket?.avg_occupancy || 90;
      
      // Base: Demand pool ratio
      const demandPool = parseInt(demandFunnel?.demandPool?.replace(/,/g, '') || '0');
      const demandPoolRatio = demandPool / targetUnits;
      let demandFactor = Math.min(1.20, 1.0 + Math.max(0, demandPoolRatio - 1.0) * 0.05);
      
      let reasoning = `Demand pool: ${demandPool} renters for ${targetUnits} units (${demandPoolRatio.toFixed(1)}x). `;
      
      // Boost: Major employer inbound moves
      const inboundJobs = employers
        .filter(e => e.statusText?.includes('relocation inbound'))
        .reduce((sum, e) => {
          const match = e.demandImpact?.match(/\+(\d+)/);
          return sum + (match ? parseInt(match[1]) : 0);
        }, 0);
      
      if (inboundJobs > 0) {
        const employerBoost = Math.min(0.10, inboundJobs / 1000 * 0.02);
        demandFactor += employerBoost;
        reasoning += `Major employers bringing ${inboundJobs} HH (+${(employerBoost*100).toFixed(1)}%). `;
      }
      
      // Boost: High occupancy (supply-constrained market)
      if (occupancy > 90) {
        const occBoost = (occupancy - 90) * 0.01;
        demandFactor += occBoost;
        reasoning += `Tight submarket (${occupancy.toFixed(1)}% occ) adds ${(occBoost*100).toFixed(1)}%. `;
      }
      
      // News sentiment (last 30 days)
      const cutoff = Date.now() - 30*24*60*60*1000;
      const recentDemandNews = (marketIntel.news || []).filter(n => 
        n.type === 'DEMAND' && new Date(n.date).getTime() > cutoff
      ).length;
      
      if (recentDemandNews > 0) {
        const newsBoost = Math.min(0.05, recentDemandNews * 0.01);
        demandFactor += newsBoost;
        reasoning += `${recentDemandNews} demand events (+${(newsBoost*100).toFixed(1)}%). `;
      }
      
      const finalFactor = Math.min(1.25, Math.max(1.0, Math.round(demandFactor * 100) / 100));
      return { factor: finalFactor, reasoning: reasoning.trim() };

    } catch (err) {
      logger.error('Error calculating demand factor:', err);
      return { factor: 1.05, reasoning: 'Fallback: No market intelligence data available.' };
    }
  }

  /**
   * Calculate Supply Factor from M02 Supply Intelligence (via M05 pipeline data)
   * Based on: pipeline supply, current occupancy, nearby competition, news
   */
  calculateSupplyFactor(marketIntel: MarketIntelligenceData): {
    factor: number;
    reasoning: string;
  } {
    try {
      const pipeline = marketIntel.economy?.developmentPipeline || [];
      const submarket = marketIntel.demographics?.submarket;
      
      // Base: Pipeline supply ratio (inverse effect)
      const pipelineUnits = pipeline.reduce((sum, proj) => {
        const match = proj.impact?.match(/(\d+)\s+units/i);
        return sum + (match ? parseInt(match[1]) : 0);
      }, 0);
      
      const existingUnits = submarket?.total_units || 30000;
      const supplyRatio = pipelineUnits / existingUnits;
      let supplyFactor = 1.0 - (supplyRatio * 1.0);
      
      let reasoning = `Pipeline: ${pipelineUnits} units vs ${existingUnits} existing (${(supplyRatio*100).toFixed(1)}% impact). `;
      
      // Boost: High current occupancy (less immediate competition)
      if (submarket && submarket.avg_occupancy > 90) {
        supplyFactor += 0.02;
        reasoning += `High occupancy (${submarket.avg_occupancy}%) reduces competitive pressure (+2%). `;
      }
      
      // News sentiment (last 90 days)
      const cutoff = Date.now() - 90*24*60*60*1000;
      const recentSupplyNews = (marketIntel.news || []).filter(n => 
        n.type === 'SUPPLY' && new Date(n.date).getTime() > cutoff
      ).length;
      
      if (recentSupplyNews > 0) {
        const newsPenalty = recentSupplyNews * 0.005;
        supplyFactor -= newsPenalty;
        reasoning += `${recentSupplyNews} supply announcements (-${(newsPenalty*100).toFixed(1)}%). `;
      }
      
      const finalFactor = Math.max(0.85, Math.min(1.0, Math.round(supplyFactor * 100) / 100));
      return { factor: finalFactor, reasoning: reasoning.trim() };

    } catch (err) {
      logger.error('Error calculating supply factor:', err);
      return { factor: 0.97, reasoning: 'Fallback: No supply intelligence data available.' };
    }
  }

  /**
   * Calculate Digital Factor
   * For new developments: based on infrastructure news, BeltLine proximity, market transactions
   */
  calculateDigitalFactor(marketIntel: MarketIntelligenceData, isNewDevelopment: boolean): {
    factor: number;
    reasoning: string;
  } {
    try {
      // Base: New construction boost
      let digitalFactor = isNewDevelopment ? 1.10 : 1.00;
      let reasoning = isNewDevelopment 
        ? 'New construction baseline (+10%). ' 
        : 'Existing property baseline. ';
      
      // Infrastructure events (transit, amenities)
      const infraNews = (marketIntel.news || []).filter(n => 
        n.type === 'INFRASTRUCTURE' && 
        ['transit_expansion', 'amenity', 'amenities'].includes(n.category)
      );
      
      if (infraNews.length > 0) {
        const infraBoost = Math.min(0.05, infraNews.length * 0.015);
        digitalFactor += infraBoost;
        reasoning += `${infraNews.length} infrastructure projects (BeltLine, etc.) add ${(infraBoost*100).toFixed(1)}%. `;
      }
      
      // Economic strength (transactions indicate market interest)
      const recentSales = (marketIntel.news || []).filter(n => 
        n.type === 'ECONOMIC' && n.category === 'transactions'
      );
      
      if (recentSales.length > 0) {
        const transBoost = Math.min(0.04, recentSales.length * 0.01);
        digitalFactor += transBoost;
        reasoning += `${recentSales.length} major transactions (+${(transBoost*100).toFixed(1)}% market confidence). `;
      }
      
      const finalFactor = Math.min(1.25, Math.round(digitalFactor * 100) / 100);
      return { factor: finalFactor, reasoning: reasoning.trim() };

    } catch (err) {
      logger.error('Error calculating digital factor:', err);
      return { factor: 1.03, reasoning: 'Fallback: No digital intelligence data available.' };
    }
  }

  /**
   * Get dynamic traffic factors for a deal
   * Wires M05 Market Intel → M07 Traffic Engine
   */
  async getDynamicFactors(dealId: string, targetUnits: number): Promise<DynamicTrafficFactors> {
    try {
      // Check if new development
      const dealInfo = await pool.query(`
        SELECT development_type FROM deals WHERE id = $1
      `, [dealId]);
      
      const isNewDevelopment = dealInfo.rows[0]?.development_type === 'new';

      // Fetch market intelligence
      const marketIntel = await this.getMarketIntelligence(dealId);

      if (!marketIntel) {
        logger.warn(`No market intelligence for deal ${dealId}, using fallback factors`);
        return {
          demandFactor: 1.05,
          supplyFactor: 0.97,
          digitalFactor: 1.03,
          demandReasoning: 'No market intelligence data available (fallback)',
          supplyReasoning: 'No supply data available (fallback)',
          digitalReasoning: 'No digital data available (fallback)',
          confidence: 'LOW'
        };
      }

      // Calculate dynamic factors
      const demand = this.calculateDemandFactor(marketIntel, targetUnits);
      const supply = this.calculateSupplyFactor(marketIntel);
      const digital = this.calculateDigitalFactor(marketIntel, isNewDevelopment);

      // Determine confidence
      let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
      if (marketIntel.economy.employers.length >= 3 && 
          marketIntel.economy.developmentPipeline.length >= 3) {
        confidence = 'HIGH';
      } else if (marketIntel.economy.employers.length < 2) {
        confidence = 'LOW';
      }

      logger.info(`Dynamic traffic factors for deal ${dealId}: Demand ${demand.factor}x, Supply ${supply.factor}x, Digital ${digital.factor}x (${confidence})`);

      return {
        demandFactor: demand.factor,
        supplyFactor: supply.factor,
        digitalFactor: digital.factor,
        demandReasoning: demand.reasoning,
        supplyReasoning: supply.reasoning,
        digitalReasoning: digital.reasoning,
        confidence
      };

    } catch (err) {
      logger.error('Error getting dynamic factors:', err);
      return {
        demandFactor: 1.05,
        supplyFactor: 0.97,
        digitalFactor: 1.03,
        demandReasoning: 'Error fetching data (fallback)',
        supplyReasoning: 'Error fetching data (fallback)',
        digitalReasoning: 'Error fetching data (fallback)',
        confidence: 'LOW'
      };
    }
  }

  /**
   * Get baseline traffic for new development using comp-based model
   */
  async getBaselineTrafficForNewDevelopment(dealId: string): Promise<{
    weeklyTraffic: number;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    compsCount: number;
    reasoning: string;
  }> {
    try {
      const compResult = await trafficCompAdjustmentService.generateCompBasedTraffic(dealId);

      const reasoning = `Based on ${compResult.compsUsed.length} comparable properties within 1 mile. ` +
        `Baseline avg: ${compResult.baselineTraffic}/week. ` +
        `Location-adjusted: ${compResult.adjustedTraffic}/week. ` +
        `Top adjustment: ${compResult.adjustments[0]?.reasoning || 'N/A'}`;

      return {
        weeklyTraffic: compResult.adjustedTraffic,
        confidence: compResult.confidence,
        compsCount: compResult.compsUsed.length,
        reasoning
      };

    } catch (err) {
      logger.error('Error getting comp-based traffic:', err);
      
      // Fallback to formula-based
      const dealData = await pool.query(`
        SELECT target_units FROM deals WHERE id = $1
      `, [dealId]);
      
      const units = dealData.rows[0]?.target_units || 230;
      const fallbackTraffic = Math.round((units / 290) * 11);

      return {
        weeklyTraffic: fallbackTraffic,
        confidence: 'LOW',
        compsCount: 0,
        reasoning: `Fallback formula: (${units} units / 290) × 11 = ${fallbackTraffic} tours/week. No comps found.`
      };
    }
  }

  /**
   * Monthly adjustment factors (time-based variation)
   * Microsoft move-in Month 7-12, BeltLine opening Month 20+
   */
  getMonthlyAdjustments(monthIndex: number): {
    demandAdj: number;
    supplyAdj: number;
    digitalAdj: number;
  } {
    let demandAdj = 1.0;
    let supplyAdj = 1.0;
    let digitalAdj = 1.0;

    // Microsoft move-in boost (Months 7-12: Q2 2027)
    if (monthIndex >= 7 && monthIndex <= 12) {
      demandAdj += 0.05;
    }

    // BeltLine opening boost (Month 20+: late 2028)
    if (monthIndex >= 20) {
      demandAdj += 0.03;
      digitalAdj += 0.02;
    }

    // Pipeline delivery impact (Buckhead Tower Month 12)
    if (monthIndex >= 12 && monthIndex < 18) {
      supplyAdj -= 0.03;
    }

    // Multiple projects impact (Month 18-24)
    if (monthIndex >= 18 && monthIndex < 24) {
      supplyAdj -= 0.02;
    }

    // Grand opening digital boost (Months 1-3)
    if (monthIndex <= 3) {
      digitalAdj += 0.05;
    }

    // Time decay
    if (monthIndex > 18) {
      const decay = Math.max(0.95, 1.0 - (monthIndex - 18) * 0.005);
      demandAdj *= decay;
    }

    if (monthIndex > 9) {
      const digitalDecay = Math.max(0.90, 1.0 - (monthIndex - 9) * 0.01);
      digitalAdj *= digitalDecay;
    }

    return {
      demandAdj: Math.round(demandAdj * 100) / 100,
      supplyAdj: Math.round(supplyAdj * 100) / 100,
      digitalAdj: Math.round(digitalAdj * 100) / 100
    };
  }
}

export const trafficIntelligenceWiringService = new TrafficIntelligenceWiringService();

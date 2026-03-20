import { pool } from '../database';
import { PropertyAnalyticsService } from './property-analytics.service';
import type { DomainTrend } from './property-analytics.service';
import { logger } from '../utils/logger';

export interface TrendPattern {
  name: string;
  icon: string;
  confidence: number;
  condition: string;
  action: string;
  timeline: string;
  signals_used: string[];
}

export interface TrendPatternInput {
  digital_momentum_pct: number;
  yoy_aadt_growth_pct: number;
  seasonal_deviation?: number;
  digital_share?: number;
}

export class TrendPatternDetector {
  detectPatterns(input: TrendPatternInput): TrendPattern[] {
    const detected: TrendPattern[] = [];

    const dm = input.digital_momentum_pct;
    const aadt = input.yoy_aadt_growth_pct;

    if (dm > 25 && Math.abs(aadt) <= 5) {
      detected.push({
        name: 'DEMAND_SURGE',
        icon: '🚀',
        confidence: Math.min(95, 60 + Math.abs(dm - 25)),
        condition: 'Digital momentum > +25% QoQ AND AADT YoY stable',
        action: 'Acquire NOW — physical traffic increase follows in 2-4 months',
        timeline: '2-4 months',
        signals_used: ['digital_momentum', 'yoy_aadt_growth'],
      });
    }

    if (dm > 15 && aadt > 5) {
      detected.push({
        name: 'MOMENTUM_CONFIRMED',
        icon: '✅',
        confidence: Math.min(95, 65 + Math.min(dm, 30) + Math.min(aadt, 15)),
        condition: 'Digital > +15% AND AADT YoY > +5%',
        action: 'High-confidence buy — both signals confirm demand',
        timeline: 'Immediate',
        signals_used: ['digital_momentum', 'yoy_aadt_growth'],
      });
    }

    if (dm < -5 && Math.abs(aadt) <= 5) {
      detected.push({
        name: 'DIGITAL_DIVERGENCE',
        icon: '⚠️',
        confidence: Math.min(90, 55 + Math.abs(dm)),
        condition: 'Digital declining AND AADT stable',
        action: 'Early warning — investigate within 60 days',
        timeline: '60 days',
        signals_used: ['digital_momentum', 'yoy_aadt_growth'],
      });
    }

    if (dm < -15 && aadt < -3) {
      detected.push({
        name: 'MARKET_EXHAUSTION',
        icon: '🔴',
        confidence: Math.min(95, 60 + Math.abs(dm) + Math.abs(aadt)),
        condition: 'Digital < -15% AND AADT YoY declining',
        action: 'SELL SIGNAL — structural demand shift',
        timeline: 'Immediate',
        signals_used: ['digital_momentum', 'yoy_aadt_growth'],
      });
    }

    if (detected.length === 0) {
      const withinNorm = Math.abs(dm) <= 10 && Math.abs(aadt) <= 10;
      detected.push({
        name: 'SEASONAL_NOISE',
        icon: '⏸️',
        confidence: withinNorm ? 80 : 50,
        condition: 'Both within ±10% of seasonal norms',
        action: 'Hold — normal market cycle, no action',
        timeline: 'Next quarter review',
        signals_used: ['digital_momentum', 'yoy_aadt_growth'],
      });
    }

    return detected;
  }

  async detectPatternsForProperty(propertyId: string): Promise<TrendPattern[]> {
    let digitalMomentumPct = 0;
    let yoyAadtGrowthPct = 0;

    try {
      const analyticsService = new PropertyAnalyticsService(pool);
      const domainTrend = await analyticsService.getDomainTrend(propertyId);
      if (domainTrend) {
        digitalMomentumPct = domainTrend.momentum_pct;
      }
    } catch (err: any) {
      logger.debug(`[TrendPatternDetector] Domain trend fetch failed for ${propertyId}: ${err.message}`);
    }

    try {
      const stationResult = await pool.query(
        `SELECT primary_adt_station_id FROM property_traffic_context WHERE property_id = $1`,
        [propertyId]
      );
      const stationId = stationResult.rows[0]?.primary_adt_station_id;
      if (stationId) {
        const adtResult = await pool.query(
          `SELECT adt, measurement_year FROM adt_counts
           WHERE station_id = $1 ORDER BY measurement_year DESC LIMIT 2`,
          [stationId]
        );
        if (adtResult.rows.length >= 2) {
          const currentAadt = adtResult.rows[0].adt || 0;
          const priorAadt = adtResult.rows[1].adt || 0;
          if (priorAadt > 0) {
            yoyAadtGrowthPct = ((currentAadt - priorAadt) / priorAadt) * 100;
          }
        }
      }
    } catch (err: any) {
      logger.debug(`[TrendPatternDetector] AADT YoY fetch failed for ${propertyId}: ${err.message}`);
    }

    let digitalShare: number | undefined;
    try {
      const selfResult = await pool.query(
        `SELECT monthly_organic_clicks FROM property_website_analytics
         WHERE property_id = $1 AND is_comp_proxy = false
         ORDER BY period_end DESC LIMIT 1`,
        [propertyId]
      );
      const selfClicks = selfResult.rows[0]?.monthly_organic_clicks || 0;
      if (selfClicks > 0) {
        const compResult = await pool.query(
          `SELECT COALESCE(SUM(competitor_organic_clicks), 0) as total_comp_clicks
           FROM property_digital_competitors WHERE property_id = $1`,
          [propertyId]
        );
        const totalCompClicks = Number(compResult.rows[0]?.total_comp_clicks) || 0;
        const totalMarket = selfClicks + totalCompClicks;
        if (totalMarket > 0) {
          digitalShare = selfClicks / totalMarket;
        }
      }
    } catch {
    }

    return this.detectPatterns({
      digital_momentum_pct: digitalMomentumPct,
      yoy_aadt_growth_pct: yoyAadtGrowthPct,
      digital_share: digitalShare,
    });
  }

  async detectPatternsForDeal(dealId: string): Promise<{ patterns: TrendPattern[]; property_id: string | null }> {
    let propertyId: string | null = null;

    try {
      const dealResult = await pool.query(
        `SELECT property_id FROM deals WHERE id = $1`,
        [dealId]
      );
      if (dealResult.rows.length > 0 && dealResult.rows[0].property_id) {
        propertyId = dealResult.rows[0].property_id;
      }
    } catch {}

    if (!propertyId) {
      try {
        const propLookup = await pool.query(
          `SELECT id FROM properties WHERE deal_id = $1 LIMIT 1`,
          [dealId]
        );
        if (propLookup.rows.length > 0) {
          propertyId = propLookup.rows[0].id;
        }
      } catch {}
    }

    if (!propertyId) {
      return {
        patterns: this.detectPatterns({
          digital_momentum_pct: 0,
          yoy_aadt_growth_pct: 0,
        }),
        property_id: null,
      };
    }

    const patterns = await this.detectPatternsForProperty(propertyId);
    return { patterns, property_id: propertyId };
  }
}

export const trendPatternDetector = new TrendPatternDetector();

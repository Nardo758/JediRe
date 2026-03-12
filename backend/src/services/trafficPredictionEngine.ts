/**
 * JEDI RE Traffic Prediction Engine
 * Property-Level Foot Traffic Predictions
 * 
 * Converts market-level demand (from Market Research Engine V2)
 * into property-specific weekly walk-ins predictions
 * 
 * Key Formula: 1 new job = 0.45 units housing demand = 15 retail trips/week
 */

import { pool } from '../database';
import marketResearchEngine from './marketResearchEngine';
import { trafficLearning } from './trafficLearningService';
import type { LearnedRates } from './trafficLearningService';
import { PropertyAnalyticsService } from './property-analytics.service';
import type { DomainTrend } from './property-analytics.service';
import { trendPatternDetector } from './trend-pattern-detector';
import type { TrendPattern } from './trend-pattern-detector';
import { getDotTemporalProfilesService } from './dot-temporal-profiles.service';
import type { TemporalMultiplierResult } from './dot-temporal-profiles.service';

export interface DataSourceSignals {
  visibility?: {
    overall_score: number;
    capture_rate: number;
    tier: string;
    is_estimated?: boolean;
    component_scores?: Record<string, number>;
  };
  traffic_context?: {
    primary_adt: number;
    primary_road_name: string;
    primary_road_classification: string;
    primary_adt_distance_m?: number;
    secondary_adt?: number;
    secondary_road_classification?: string;
    secondary_adt_distance_m?: number;
    google_realtime_factor: number;
    trend_direction: string;
    trend_pct: number;
    effective_base_adt?: number;
    distance_decay_primary?: number;
    distance_decay_secondary?: number;
    road_class_weight_primary?: number;
    road_class_weight_secondary?: number;
    frontage_type?: string;
    frontage_factor?: number;
    total_exposure?: number;
    temporal_adjusted_adt?: number;
    temporal_source?: 'fdot_profile' | 'google_realtime' | 'default';
    directional_factor?: number;
    property_direction?: 'inbound' | 'outbound';
    temporal_profile_available?: boolean;
    d_factor_available?: boolean;
    hourly_distribution?: Record<string, number>;
  };
  web_traffic?: {
    sessions: number;
    users: number;
    bounce_rate: number;
    score: number;
    is_comp_proxy: boolean;
    proxy_source_count?: number;
    organic_value?: number;
    organic_keywords?: number;
    paid_keywords?: number;
    domain_strength?: number;
    digital_share?: number;
    trend_momentum?: number;
    trend_direction?: string;
  };
  trajectory?: {
    traffic_trajectory: number;
    trend_momentum: number;
    trend_direction: string;
    digital_momentum: number;
    yoy_aadt_growth: number;
    seasonal_deviation: number;
  };
  market_intel?: {
    supply_demand_ratio?: number;
    absorption_rate?: number;
    avg_days_to_lease?: number;
    rent_comp_avg?: number;
    concession_rate?: number;
  };
  data_quality: {
    sources_connected: number;
    total_sources: number;
    confidence_level: 'High' | 'Moderate' | 'Low';
    missing_sources: string[];
  };
}

// ============================================================================
// v2 Prediction: Full 7-Metric Funnel
// ============================================================================

export interface TrafficPredictionV2 extends TrafficPrediction {
  // v2 funnel metrics
  in_person_tours: number;
  applications: number;
  net_leases: number;
  occupancy_pct: number;
  effective_rent: number;
  closing_ratio: number;

  // Conversion rates used
  rates: {
    tour_rate: number;
    app_rate: number;
    lease_rate: number;
  };

  // v2 metadata
  funnel_breakdown: {
    traffic_to_tours: number;
    tours_to_apps: number;
    apps_to_leases: number;
    occupancy_modifier: number;
    seasonal_factor: number;
  };

  confidence_v2: {
    score: number;
    tier: 'Low' | 'Medium' | 'High';
    data_weeks: number;
    per_metric: Record<string, number>;
  };
}

interface Property {
  id: string;
  property_name: string;
  address: string;
  latitude: number;
  longitude: number;
  city: string;
  state: string;
  submarket_id: string;
  
  // Physical attributes
  adt?: number;  // Average Daily Traffic
  is_corner: boolean;
  frontage_feet?: number;
  setback_feet?: number;
  road_type?: string;  // 'arterial', 'collector', 'local', 'main_street'
  sidewalk_score?: number;  // 0-100
  signage_score?: number;  // 0-100
  entrance_score?: number;  // 0-100
  
  // Demographics (ring analysis)
  residential_units_400m?: number;  // Quarter mile
  residential_units_800m?: number;  // Half mile
  employment_count_400m?: number;   // Workers nearby
  
  // Transit access
  nearest_transit_distance_feet?: number;
  transit_daily_riders?: number;
  
  // Property type
  property_type?: string;
  has_retail: boolean;
  retail_sf?: number;
  suitable_for_restaurant: boolean;
  near_office_district: boolean;
  
  // Competitive context
  competitor_count_500m?: number;
}

export interface ConversionChainRates {
  visibility_capture_rate: number;
  apartment_seeker_pct: number;
  stop_probability: number;
  combined_rate: number;
  source: 'visibility_assessment' | 'submarket_calibrated' | 'default';
}

export interface HourlyWalkInPotential {
  hour: number;
  directional_volume: number;
  walk_in_potential: number;
}

export interface DailyBreakdown {
  day: string;
  dow_factor: number;
  walk_ins: number;
}

export interface PhysicalTrafficScore {
  score: number;
  adt_percentile: number;
  walkins_percentile: number;
  adt_component: number;
  walkins_component: number;
  submarket_property_count: number;
  submarket_id: string;
}

interface TrafficPrediction {
  property_id: string;
  deal_id?: string;
  prediction_week: number;
  prediction_year: number;
  
  weekly_walk_ins: number;
  daily_average: number;
  peak_hour_estimate: number;
  
  breakdown: {
    physical_factors: number;
    market_demand_factors: number;
    supply_demand_adjustment: number;
    base_before_adjustment: number;
    effective_base_adt?: number;
    distance_decay?: number;
    road_class_weight?: number;
    frontage_factor?: number;
    multi_segment_exposure?: number;
    temporal_adjusted_adt?: number;
    temporal_source?: 'fdot_profile' | 'google_realtime' | 'default';
    directional_factor?: number;
    hourly_distribution?: Record<string, number>;
    traffic_trajectory?: number;
    trend_momentum?: number;
    trend_direction?: string;
  };

  conversion_chain?: ConversionChainRates;
  hourly_potential?: HourlyWalkInPotential[];
  daily_breakdown?: DailyBreakdown[];
  physical_traffic_score?: PhysicalTrafficScore;
  
  temporal_patterns: {
    weekday_avg: number;
    weekend_avg: number;
    weekday_total: number;
    weekend_total: number;
    peak_day: string;
    peak_hour: string;
  };
  
  confidence: {
    score: number;
    tier: 'High' | 'Medium' | 'Low';
    breakdown: Record<string, number>;
  };
  
  market_context: {
    submarket: string;
    market_condition: string;
    foot_traffic_index: number;
    supply_demand_ratio: number;
  };
  
  detected_patterns?: TrendPattern[];
  
  model_version: string;
  prediction_date: Date;
}

export class TrafficPredictionEngine {
  
  private readonly MODEL_VERSION = '1.2.0';
  private readonly JOBS_TO_UNITS_MULTIPLIER = 0.45;
  private readonly JOBS_TO_RETAIL_TRIPS = 15;

  private readonly ROAD_CLASS_WEIGHT: Record<string, number> = {
    'interstate': 0.3,
    'expressway': 0.4,
    'freeway': 0.4,
    'arterial': 0.7,
    'principal_arterial': 0.7,
    'minor_arterial': 0.7,
    'collector': 0.9,
    'major_collector': 0.9,
    'minor_collector': 0.9,
    'local': 1.0,
    'main_street': 1.0,
  };

  private readonly FRONTAGE_FACTOR: Record<string, number> = {
    'corner': 1.4,
    'main': 1.0,
    'side_street': 0.7,
    'interior': 0.4,
  };

  private readonly DEFAULT_VISIBILITY_CAPTURE_RATE = 0.04;
  private readonly DEFAULT_APARTMENT_SEEKER_PCT = 0.02;
  private readonly DEFAULT_STOP_PROBABILITY = 0.15;
  private readonly LEASING_HOURS_START = 9;
  private readonly LEASING_HOURS_END = 18;

  private readonly DOW_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  private getConversionChainRates(
    signals: DataSourceSignals,
    submarketId?: string,
  ): ConversionChainRates {
    let captureRate = this.DEFAULT_VISIBILITY_CAPTURE_RATE;
    let source: ConversionChainRates['source'] = 'default';

    if (signals.visibility && signals.visibility.capture_rate > 0) {
      captureRate = signals.visibility.capture_rate;
      source = 'visibility_assessment';
    }

    const seekerPct = this.DEFAULT_APARTMENT_SEEKER_PCT;
    const stopProb = this.DEFAULT_STOP_PROBABILITY;

    return {
      visibility_capture_rate: captureRate,
      apartment_seeker_pct: seekerPct,
      stop_probability: stopProb,
      combined_rate: captureRate * seekerPct * stopProb,
      source,
    };
  }

  private async calculateHourlyWalkInPotential(
    effectiveBaseAdt: number,
    roadClass: string,
    state: string,
    direction: 'inbound' | 'outbound',
    conversionRates: ConversionChainRates,
    month: number,
    region?: string,
  ): Promise<HourlyWalkInPotential[]> {
    const temporalService = getDotTemporalProfilesService(pool);
    const results: HourlyWalkInPotential[] = [];

    const seasonalFactor = await temporalService.getSeasonalFactor(roadClass, state, month, region);

    for (let hour = this.LEASING_HOURS_START; hour < this.LEASING_HOURS_END; hour++) {
      const hourlyPct = await temporalService.getHourlyFactor(roadClass, state, hour, region);
      const directionalFactor = await temporalService.getDirectionalSplit(roadClass, state, hour, direction, region);

      const hourlyVolume = effectiveBaseAdt * hourlyPct * seasonalFactor;
      const directionalVolume = hourlyVolume * directionalFactor;
      const walkInPotential = directionalVolume
        * conversionRates.visibility_capture_rate
        * conversionRates.apartment_seeker_pct
        * conversionRates.stop_probability;

      results.push({
        hour,
        directional_volume: Math.round(directionalVolume * 100) / 100,
        walk_in_potential: Math.round(walkInPotential * 1000) / 1000,
      });
    }

    return results;
  }

  private async calculateDailyBreakdown(
    hourlyPotential: HourlyWalkInPotential[],
    roadClass: string,
    state: string,
    region?: string,
  ): Promise<DailyBreakdown[]> {
    const temporalService = getDotTemporalProfilesService(pool);
    const baseDayWalkins = hourlyPotential.reduce((sum, h) => sum + h.walk_in_potential, 0);
    const results: DailyBreakdown[] = [];

    for (let dow = 0; dow < 7; dow++) {
      const dowFactor = await temporalService.getDowFactor(roadClass, state, dow, region);
      const dayName = this.DOW_NAMES[dow];

      let adjustedWalkins = baseDayWalkins * dowFactor;
      if (dow === 6) {
        adjustedWalkins *= 1.15;
      }

      results.push({
        day: dayName,
        dow_factor: Math.round(dowFactor * 1000) / 1000,
        walk_ins: Math.round(adjustedWalkins * 100) / 100,
      });
    }

    return results;
  }

  private calculateDistanceDecay(distanceMeters: number): number {
    const distanceMiles = distanceMeters / 1609;
    return Math.max(0.5, 1 - (distanceMiles * 0.15));
  }

  private getRoadClassWeight(classification: string): number {
    const normalized = this.normalizeRoadClass(classification);
    return this.ROAD_CLASS_WEIGHT[normalized] ?? 0.9;
  }

  private normalizeRoadClass(classification: string): string {
    const cl = (classification || '').toLowerCase().replace(/[\s-]+/g, '_');
    if (cl.includes('interstate') || cl.includes('i_')) return 'interstate';
    if (cl.includes('expressway') || cl.includes('freeway')) return 'expressway';
    if (cl.includes('principal') && cl.includes('arterial')) return 'arterial';
    if (cl.includes('arterial')) return 'arterial';
    if (cl.includes('major') && cl.includes('collector')) return 'collector';
    if (cl.includes('collector') || cl.includes('minor')) return 'collector';
    if (cl.includes('local') || cl.includes('residential')) return 'local';
    if (cl.includes('main') || cl.includes('downtown') || cl.includes('urban')) return 'main_street';
    return 'collector';
  }

  private getFrontageFactor(frontageType: string): number {
    return this.FRONTAGE_FACTOR[(frontageType || 'main').toLowerCase()] ?? 1.0;
  }

  private mapToFdotRoadClass(normalized: string): string {
    const mapping: Record<string, string> = {
      'interstate': 'interstate',
      'expressway': 'interstate',
      'arterial': 'urban_arterial',
      'collector': 'urban_collector',
      'local': 'local',
      'main_street': 'urban_arterial',
    };
    return mapping[normalized] || 'urban_arterial';
  }

  private calculateMultiSegmentExposure(
    primaryAdt: number,
    primaryDistanceM: number,
    primaryClassification: string,
    secondaryAdt?: number,
    secondaryDistanceM?: number,
    secondaryClassification?: string,
  ): { totalExposure: number; segments: Array<{ adt: number; decay: number; weight: number; contribution: number }> } {
    const segments: Array<{ adt: number; decay: number; weight: number; contribution: number }> = [];

    const primaryDecay = this.calculateDistanceDecay(primaryDistanceM);
    const primaryWeight = this.getRoadClassWeight(primaryClassification);
    const primaryContribution = primaryAdt * primaryDecay * primaryWeight;
    segments.push({ adt: primaryAdt, decay: primaryDecay, weight: primaryWeight, contribution: primaryContribution });

    if (secondaryAdt && secondaryAdt > 0 && secondaryDistanceM !== undefined) {
      const secondaryDecay = this.calculateDistanceDecay(secondaryDistanceM);
      const secondaryWeight = this.getRoadClassWeight(secondaryClassification || 'collector');
      const secondaryContribution = secondaryAdt * secondaryDecay * secondaryWeight;
      segments.push({ adt: secondaryAdt, decay: secondaryDecay, weight: secondaryWeight, contribution: secondaryContribution });
    }

    const totalExposure = segments.reduce((sum, s) => sum + s.contribution, 0);
    return { totalExposure, segments };
  }

  private calculateEffectiveBaseAdt(
    primaryAdt: number,
    primaryDistanceM: number,
    primaryClassification: string,
    frontageType: string,
    secondaryAdt?: number,
    secondaryDistanceM?: number,
    secondaryClassification?: string,
  ): { effectiveBaseAdt: number; totalExposure: number; frontageFactor: number; segments: Array<{ adt: number; decay: number; weight: number; contribution: number }> } {
    const { totalExposure, segments } = this.calculateMultiSegmentExposure(
      primaryAdt, primaryDistanceM, primaryClassification,
      secondaryAdt, secondaryDistanceM, secondaryClassification,
    );
    const frontageFactor = this.getFrontageFactor(frontageType);
    const effectiveBaseAdt = totalExposure * frontageFactor;
    return { effectiveBaseAdt, totalExposure, frontageFactor, segments };
  }

  async loadDataSourceSignals(propertyId: string): Promise<DataSourceSignals> {
    const missing: string[] = [];
    let sourcesConnected = 0;

    let visibility: DataSourceSignals['visibility'];
    try {
      const vr = await pool.query(
        `SELECT overall_visibility_score, visibility_tier,
                positional_score, sightline_score, setback_score,
                signage_score, transparency_score, entrance_score,
                obstruction_penalty, assessment_method
         FROM property_visibility WHERE property_id = $1`,
        [propertyId]
      );
      if (vr.rows.length > 0) {
        const v = vr.rows[0];
        const score = v.overall_visibility_score || 50;
        const captureRate = 0.05 + (score / 100) * 0.15;
        visibility = {
          overall_score: score,
          capture_rate: Math.round(captureRate * 1000) / 1000,
          tier: v.visibility_tier || 'Fair',
          is_estimated: v.assessment_method === 'auto_estimated',
          component_scores: {
            positional: v.positional_score,
            sightline: v.sightline_score,
            setback: v.setback_score,
            signage: v.signage_score,
            transparency: v.transparency_score,
            entrance: v.entrance_score,
            obstruction_penalty: v.obstruction_penalty,
          },
        };
        sourcesConnected++;
      } else {
        missing.push('visibility');
      }
    } catch { missing.push('visibility'); }

    let traffic_context: DataSourceSignals['traffic_context'];
    let propertyState = 'FL';
    let propertyDirection: 'inbound' | 'outbound' = 'inbound';
    try {
      const tr = await pool.query(
        `SELECT ptc.primary_adt, ptc.primary_road_name, ptc.primary_road_classification,
                ptc.primary_adt_distance_m,
                ptc.secondary_adt, ptc.secondary_adt_distance_m, ptc.secondary_road_name,
                ptc.secondary_adt_station_id,
                ptc.google_realtime_factor, ptc.trend_direction, ptc.trend_pct,
                p.frontage_type, p.state,
                sec_adt.road_classification AS secondary_road_classification
         FROM property_traffic_context ptc
         LEFT JOIN properties p ON p.id = ptc.property_id
         LEFT JOIN adt_counts sec_adt ON sec_adt.station_id = ptc.secondary_adt_station_id
         WHERE ptc.property_id = $1`,
        [propertyId]
      );
      if (tr.rows.length > 0) {
        const t = tr.rows[0];
        propertyState = t.state || 'FL';
        const primaryAdt = t.primary_adt || 0;
        const primaryDistanceM = t.primary_adt_distance_m != null ? Number(t.primary_adt_distance_m) : undefined;
        const primaryClassification = t.primary_road_classification || '';
        const secondaryAdt = t.secondary_adt || undefined;
        const secondaryDistanceM = t.secondary_adt_distance_m != null ? Number(t.secondary_adt_distance_m) : undefined;
        const secondaryClassification = t.secondary_road_classification || '';
        const frontageType = t.frontage_type || 'main';

        let effectiveBaseAdt: number | undefined;
        let distanceDecayPrimary: number | undefined;
        let distanceDecaySecondary: number | undefined;
        let roadClassWeightPrimary: number | undefined;
        let roadClassWeightSecondary: number | undefined;
        let frontageFactor: number | undefined;
        let totalExposure: number | undefined;

        if (primaryAdt > 0) {
          const result = this.calculateEffectiveBaseAdt(
            primaryAdt,
            primaryDistanceM !== undefined ? primaryDistanceM : 500,
            primaryClassification, frontageType,
            secondaryAdt,
            secondaryDistanceM,
            secondaryClassification,
          );
          effectiveBaseAdt = Math.round(result.effectiveBaseAdt);
          totalExposure = Math.round(result.totalExposure);
          frontageFactor = result.frontageFactor;
          if (result.segments.length > 0) {
            distanceDecayPrimary = Math.round(result.segments[0].decay * 1000) / 1000;
            roadClassWeightPrimary = result.segments[0].weight;
          }
          if (result.segments.length > 1) {
            distanceDecaySecondary = Math.round(result.segments[1].decay * 1000) / 1000;
            roadClassWeightSecondary = result.segments[1].weight;
          }
        }

        let temporalAdjustedAdt: number | undefined;
        let temporalSource: 'fdot_profile' | 'google_realtime' | 'default' = 'default';
        let directionalFactor: number | undefined;
        let temporalProfileAvailable = false;
        let dFactorAvailable = false;
        let hourlyDistribution: Record<string, number> | undefined;

        if (effectiveBaseAdt && effectiveBaseAdt > 0) {
          try {
            const temporalService = getDotTemporalProfilesService(pool);
            const now = new Date();
            const currentHour = now.getHours();
            const currentDow = now.getDay();
            const currentMonth = now.getMonth() + 1;
            const roadClassNorm = this.normalizeRoadClass(primaryClassification);
            const roadClassForProfile = this.mapToFdotRoadClass(roadClassNorm);

            const multiplierResult = await temporalService.getTemporalMultiplier(
              roadClassForProfile, propertyState, currentHour, currentDow, currentMonth
            );

            const dSplit = await temporalService.getDirectionalSplit(
              roadClassForProfile, propertyState, currentHour, propertyDirection
            );

            const fullHourly = await temporalService.getFullHourlyDistribution(
              roadClassForProfile, propertyState
            );

            temporalProfileAvailable = multiplierResult.source === 'fdot_profile';
            dFactorAvailable = dSplit !== 0.5;
            directionalFactor = Math.round(dSplit * 1000) / 1000;

            temporalAdjustedAdt = Math.round(
              effectiveBaseAdt * multiplierResult.combined * dSplit
            );

            if (temporalProfileAvailable) {
              temporalSource = 'fdot_profile';
            } else if (Number(t.google_realtime_factor) !== 1.0) {
              temporalSource = 'google_realtime';
              temporalAdjustedAdt = Math.round(effectiveBaseAdt * Number(t.google_realtime_factor));
            }

            if (fullHourly) {
              hourlyDistribution = {};
              for (const [k, v] of Object.entries(fullHourly)) {
                hourlyDistribution[k] = v as number;
              }
            }
          } catch (err) {
            if (Number(t.google_realtime_factor) !== 1.0) {
              temporalSource = 'google_realtime';
              temporalAdjustedAdt = Math.round(effectiveBaseAdt * Number(t.google_realtime_factor));
            }
          }
        }

        traffic_context = {
          primary_adt: primaryAdt,
          primary_road_name: t.primary_road_name || '',
          primary_road_classification: primaryClassification,
          primary_adt_distance_m: primaryDistanceM,
          secondary_adt: secondaryAdt,
          secondary_road_classification: secondaryClassification || undefined,
          secondary_adt_distance_m: secondaryDistanceM,
          google_realtime_factor: Number(t.google_realtime_factor) || 1.0,
          trend_direction: t.trend_direction || 'stable',
          trend_pct: Number(t.trend_pct) || 0,
          effective_base_adt: effectiveBaseAdt,
          distance_decay_primary: distanceDecayPrimary,
          distance_decay_secondary: distanceDecaySecondary,
          road_class_weight_primary: roadClassWeightPrimary,
          road_class_weight_secondary: roadClassWeightSecondary,
          frontage_type: frontageType,
          frontage_factor: frontageFactor,
          total_exposure: totalExposure,
          temporal_adjusted_adt: temporalAdjustedAdt,
          temporal_source: temporalSource,
          directional_factor: directionalFactor,
          property_direction: propertyDirection,
          temporal_profile_available: temporalProfileAvailable,
          d_factor_available: dFactorAvailable,
          hourly_distribution: hourlyDistribution,
        };
        sourcesConnected++;
      } else {
        missing.push('street_traffic');
      }
    } catch { missing.push('street_traffic'); }

    let web_traffic: DataSourceSignals['web_traffic'];
    try {
      let wr = await pool.query(
        `SELECT sessions, users, bounce_rate, is_comp_proxy, proxy_source_properties,
                device_breakdown
         FROM property_website_analytics
         WHERE property_id = $1
         ORDER BY period_end DESC LIMIT 1`,
        [propertyId]
      );

      if (wr.rows.length === 0) {
        try {
          const propRow = await pool.query(
            `SELECT website FROM properties WHERE id = $1`, [propertyId]
          );
          const website = propRow.rows[0]?.website;
          if (website) {
            const analyticsService = new PropertyAnalyticsService(pool);
            const existingConn = await analyticsService.getDomainConnection(propertyId);
            if (!existingConn) {
              await analyticsService.connectPropertyDomain(propertyId, website);
            }
            await analyticsService.fetchPropertyWebTraffic(propertyId);
            wr = await pool.query(
              `SELECT sessions, users, bounce_rate, is_comp_proxy, proxy_source_properties,
                      device_breakdown
               FROM property_website_analytics
               WHERE property_id = $1
               ORDER BY period_end DESC LIMIT 1`,
              [propertyId]
            );
          }
        } catch { }
      }

      if (wr.rows.length > 0) {
        const w = wr.rows[0];
        const sessions = w.sessions || 0;
        const db = w.device_breakdown || {};
        const domainStrength = db.domain_strength || 0;
        const rawScore = Math.min(100, Math.round(
          (sessions >= 5000 ? 95 : sessions >= 3000 ? 85 : sessions >= 1500 ? 70 : sessions >= 500 ? 50 : sessions >= 100 ? 30 : 10) * 0.6
          + domainStrength * 0.4
        ));
        web_traffic = {
          sessions,
          users: w.users || 0,
          bounce_rate: 0,
          score: rawScore,
          is_comp_proxy: w.is_comp_proxy || false,
          proxy_source_count: w.is_comp_proxy
            ? (w.proxy_source_properties || []).length
            : undefined,
          organic_value: db.organic_value || 0,
          organic_keywords: db.organic_keywords || 0,
          paid_keywords: db.paid_keywords || 0,
          domain_strength: domainStrength,
        };
        sourcesConnected++;
      } else {
        missing.push('website_traffic');
      }
    } catch { missing.push('website_traffic'); }

    let market_intel: DataSourceSignals['market_intel'];
    try {
      const mr = await pool.query(
        `SELECT market_data FROM apartment_market_data
         WHERE property_id = $1 OR deal_id = $1
         ORDER BY updated_at DESC LIMIT 1`,
        [propertyId]
      );
      if (mr.rows.length > 0 && mr.rows[0].market_data) {
        const md = typeof mr.rows[0].market_data === 'string'
          ? JSON.parse(mr.rows[0].market_data) : mr.rows[0].market_data;
        market_intel = {
          supply_demand_ratio: md.supply_demand_ratio,
          absorption_rate: md.absorption_rate,
          avg_days_to_lease: md.avg_days_to_lease,
          rent_comp_avg: md.rent_comp_avg,
          concession_rate: md.concession_rate,
        };
        sourcesConnected++;
      } else {
        missing.push('market_intel');
      }
    } catch { missing.push('market_intel'); }

    let trajectory: DataSourceSignals['trajectory'];
    try {
      const analyticsService = new PropertyAnalyticsService(pool);
      const domainTrend = await analyticsService.getDomainTrend(propertyId);

      const digitalMomentum = domainTrend ? domainTrend.momentum_pct / 100 : 0;

      let yoyAadtGrowth = 0;
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
              yoyAadtGrowth = (currentAadt - priorAadt) / priorAadt;
            }
          }
        }
      } catch { }

      let seasonalDeviation = 0;
      try {
        const temporalService = getDotTemporalProfilesService(pool);
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const roadClassForProfile = this.mapToFdotRoadClass(
          this.normalizeRoadClass(traffic_context?.primary_road_classification || 'Arterial')
        );
        const seasonalFactor = await temporalService.getSeasonalFactor(
          roadClassForProfile,
          propertyState,
          currentMonth
        );
        seasonalDeviation = seasonalFactor - 1.0;
      } catch { }

      const trafficTrajectory =
        digitalMomentum * 0.5 +
        yoyAadtGrowth * 0.3 +
        seasonalDeviation * 0.2;

      const trendDirection = domainTrend ? domainTrend.direction : 'stable';

      trajectory = {
        traffic_trajectory: Math.round(trafficTrajectory * 1000) / 1000,
        trend_momentum: domainTrend ? domainTrend.momentum_pct : 0,
        trend_direction: trendDirection,
        digital_momentum: Math.round(digitalMomentum * 1000) / 1000,
        yoy_aadt_growth: Math.round(yoyAadtGrowth * 1000) / 1000,
        seasonal_deviation: Math.round(seasonalDeviation * 1000) / 1000,
      };

      if (web_traffic && domainTrend) {
        web_traffic.trend_momentum = domainTrend.momentum_pct;
        web_traffic.trend_direction = domainTrend.direction;
      }

      sourcesConnected++;
    } catch {
      missing.push('trajectory');
    }

    const confidenceLevel: DataSourceSignals['data_quality']['confidence_level'] =
      sourcesConnected >= 3 ? 'High' : sourcesConnected >= 2 ? 'Moderate' : 'Low';

    return {
      visibility,
      traffic_context,
      web_traffic,
      trajectory,
      market_intel,
      data_quality: {
        sources_connected: sourcesConnected,
        total_sources: 5,
        confidence_level: confidenceLevel,
        missing_sources: missing,
      },
    };
  }

  private calculatePercentileRank(value: number, allValues: number[]): number {
    if (allValues.length === 0) return 50;
    const sorted = [...allValues].sort((a, b) => a - b);
    let countBelow = 0;
    for (const v of sorted) {
      if (v < value) countBelow++;
    }
    const percentile = (countBelow / sorted.length) * 100;
    return Math.round(Math.min(100, Math.max(0, percentile)));
  }

  private async calculatePhysicalTrafficScore(
    propertyId: string,
    submarketId: string,
    effectiveBaseAdt: number,
    weeklyWalkins: number,
  ): Promise<PhysicalTrafficScore> {
    let submarketAdts: number[] = [];
    let submarketWalkins: number[] = [];
    let submarketCount = 0;

    try {
      const adtResult = await pool.query(
        `SELECT ptc.property_id,
                ptc.primary_adt,
                ptc.primary_adt_distance_m,
                ptc.primary_road_classification,
                ptc.secondary_adt,
                ptc.secondary_adt_distance_m,
                p.frontage_type
         FROM property_traffic_context ptc
         JOIN properties p ON p.id = ptc.property_id
         WHERE p.submarket_id = $1 AND ptc.primary_adt > 0`,
        [submarketId]
      );

      for (const row of adtResult.rows) {
        const pAdt = row.primary_adt || 0;
        const pDist = row.primary_adt_distance_m || 0;
        const pClass = row.primary_road_classification || '';
        const sAdt = row.secondary_adt || undefined;
        const sDist = row.secondary_adt_distance_m || undefined;
        const ft = row.frontage_type || 'main';

        if (pAdt > 0) {
          const result = this.calculateEffectiveBaseAdt(
            pAdt, pDist, pClass, ft, sAdt, sDist, '',
          );
          submarketAdts.push(result.effectiveBaseAdt);
        }
      }
      submarketCount = adtResult.rows.length;
    } catch {}

    try {
      const walkinsResult = await pool.query(
        `SELECT tp.weekly_walk_ins
         FROM traffic_predictions tp
         JOIN properties p ON p.id = tp.property_id
         WHERE p.submarket_id = $1
         AND tp.weekly_walk_ins > 0
         ORDER BY tp.prediction_year DESC, tp.prediction_week DESC`,
        [submarketId]
      );

      const seen = new Set<number>();
      for (const row of walkinsResult.rows) {
        const ww = Number(row.weekly_walk_ins);
        if (ww > 0 && !seen.has(ww)) {
          submarketWalkins.push(ww);
          seen.add(ww);
        }
      }
    } catch {}

    if (submarketAdts.length === 0) {
      submarketAdts = [effectiveBaseAdt];
    }
    if (submarketWalkins.length === 0) {
      submarketWalkins = [weeklyWalkins];
    }

    const adtPercentile = this.calculatePercentileRank(effectiveBaseAdt, submarketAdts);
    const walkinsPercentile = this.calculatePercentileRank(weeklyWalkins, submarketWalkins);

    const adtComponent = (adtPercentile / 100) * 0.6;
    const walkinsComponent = (walkinsPercentile / 100) * 0.4;
    const score = Math.round((adtComponent + walkinsComponent) * 100);

    return {
      score,
      adt_percentile: adtPercentile,
      walkins_percentile: walkinsPercentile,
      adt_component: Math.round(adtComponent * 100),
      walkins_component: Math.round(walkinsComponent * 100),
      submarket_property_count: Math.max(submarketCount, submarketWalkins.length),
      submarket_id: submarketId,
    };
  }

  async predictTraffic(propertyId: string, targetWeek?: number): Promise<TrafficPrediction> {
    console.log(`🚶 Predicting traffic for property ${propertyId}`);
    
    const startTime = Date.now();
    
    const property = await this.loadProperty(propertyId);
    
    const marketResearch = await marketResearchEngine.getCachedReport(propertyId, 24);
    
    if (!marketResearch) {
      throw new Error('Market research required for traffic prediction. Generate market report first.');
    }

    const signals = await this.loadDataSourceSignals(propertyId);

    if (signals.traffic_context && signals.traffic_context.primary_adt > 0) {
      property.adt = signals.traffic_context.effective_base_adt || signals.traffic_context.primary_adt;
      property.road_type = this.mapRoadClassification(signals.traffic_context.primary_road_classification);
    }
    
    const physicalTraffic = this.calculatePhysicalTraffic(property);

    let captureOverride: number | undefined;
    if (signals.visibility) {
      captureOverride = signals.visibility.capture_rate;
    }
    
    const demandTraffic = this.translateDemandToTraffic(property, marketResearch);
    
    let baseTraffic = (physicalTraffic * 0.60) + (demandTraffic * 0.40);

    if (captureOverride !== undefined) {
      const streetPedestrians = this.calculateStreetPedestrians(property);
      const generatorTraffic = (
        this.calculateResidentialWalkins(property) +
        this.calculateWorkerWalkins(property) +
        this.calculateTransitWalkins(property)
      );
      const visibilityPhysical = (streetPedestrians * captureOverride) + generatorTraffic;
      baseTraffic = (visibilityPhysical * 0.60) + (demandTraffic * 0.40);
    }

    if (signals.traffic_context) {
      const tc = signals.traffic_context;
      if (tc.temporal_profile_available && tc.temporal_adjusted_adt !== undefined) {
        const temporalRatio = tc.effective_base_adt && tc.effective_base_adt > 0
          ? tc.temporal_adjusted_adt / tc.effective_base_adt
          : 1.0;
        baseTraffic *= Math.max(0.3, Math.min(3.0, temporalRatio));
      } else if (tc.google_realtime_factor !== 1.0) {
        baseTraffic *= tc.google_realtime_factor;
      }
    }

    if (signals.web_traffic && signals.web_traffic.score > 0) {
      const domainBoost = (signals.web_traffic.domain_strength || 0) / 100 * 0.05;
      const digitalDemandMultiplier = 1.0 + (signals.web_traffic.score / 100) * 0.15 + domainBoost;
      baseTraffic *= digitalDemandMultiplier;
    }
    
    const adjusted = this.applySupplyDemandAdjustment(
      baseTraffic,
      marketResearch.supply_analysis,
      marketResearch.employment_impact
    );
    
    const calibrated = await this.applyCalibrations(
      adjusted.traffic,
      property,
      marketResearch
    );
    
    const conversionChain = this.getConversionChainRates(signals, property.submarket_id);

    let hourlyPotential: HourlyWalkInPotential[] | undefined;
    let dailyBreakdown: DailyBreakdown[] | undefined;
    let conversionWeeklyWalkins: number | undefined;

    try {
      const effectiveAdt = signals.traffic_context?.effective_base_adt || signals.traffic_context?.primary_adt || 0;
      if (effectiveAdt > 0) {
        const roadClass = signals.traffic_context?.primary_road_classification || 'Arterial';
        const propState = property.state || 'FL';
        const direction = (signals.traffic_context?.property_direction) || 'inbound';
        const now = new Date();
        const currentMonth = now.getMonth() + 1;

        hourlyPotential = await this.calculateHourlyWalkInPotential(
          effectiveAdt, roadClass, propState, direction,
          conversionChain, currentMonth,
        );

        dailyBreakdown = await this.calculateDailyBreakdown(
          hourlyPotential, roadClass, propState,
        );

        conversionWeeklyWalkins = dailyBreakdown.reduce((sum, d) => sum + d.walk_ins, 0);
      }
    } catch {
    }

    // Step 8: Calculate temporal patterns
    const temporal = this.calculateTemporalSplit(calibrated, property);

    if (dailyBreakdown && dailyBreakdown.length === 7) {
      const weekdayDays = dailyBreakdown.filter(d => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(d.day));
      const weekendDays = dailyBreakdown.filter(d => ['Sat', 'Sun'].includes(d.day));
      const wdTotal = weekdayDays.reduce((s, d) => s + d.walk_ins, 0);
      const weTotal = weekendDays.reduce((s, d) => s + d.walk_ins, 0);

      temporal.weekday_total = Math.round(wdTotal);
      temporal.weekend_total = Math.round(weTotal);
      temporal.weekday_avg = Math.round(wdTotal / 5);
      temporal.weekend_avg = Math.round(weTotal / 2);

      const peakEntry = dailyBreakdown.reduce((best, d) => d.walk_ins > best.walk_ins ? d : best, dailyBreakdown[0]);
      temporal.peak_day = peakEntry.day === 'Sun' ? 'Sunday'
        : peakEntry.day === 'Mon' ? 'Monday'
        : peakEntry.day === 'Tue' ? 'Tuesday'
        : peakEntry.day === 'Wed' ? 'Wednesday'
        : peakEntry.day === 'Thu' ? 'Thursday'
        : peakEntry.day === 'Fri' ? 'Friday'
        : 'Saturday';
    }
    
    // Step 9: Calculate confidence
    const confidence = await this.calculateConfidence(property, marketResearch);
    
    // Step 10: Get current week/year
    const { week, year } = targetWeek 
      ? { week: targetWeek, year: new Date().getFullYear() }
      : this.getCurrentWeek();

    const finalWeeklyWalkins = conversionWeeklyWalkins !== undefined
      ? Math.round(Math.max(conversionWeeklyWalkins, calibrated * 0.1))
      : Math.round(calibrated);

    const peakHourWalkin = hourlyPotential && hourlyPotential.length > 0
      ? Math.round(Math.max(...hourlyPotential.map(h => h.walk_in_potential)) * 100) / 100
      : Math.round(calibrated / 7 / 10);

    let physicalTrafficScore: PhysicalTrafficScore | undefined;
    try {
      const effectiveAdt = signals.traffic_context?.effective_base_adt || signals.traffic_context?.primary_adt || 0;
      if (property.submarket_id && effectiveAdt > 0) {
        physicalTrafficScore = await this.calculatePhysicalTrafficScore(
          propertyId,
          property.submarket_id,
          effectiveAdt,
          finalWeeklyWalkins,
        );
      }
    } catch {}
    
    // Step 11: Build prediction object
    const prediction: TrafficPrediction = {
      property_id: propertyId,
      prediction_week: week,
      prediction_year: year,
      
      weekly_walk_ins: finalWeeklyWalkins,
      daily_average: Math.round(finalWeeklyWalkins / 7),
      peak_hour_estimate: peakHourWalkin,
      
      breakdown: {
        physical_factors: Math.round(physicalTraffic),
        market_demand_factors: Math.round(demandTraffic),
        supply_demand_adjustment: adjusted.multiplier,
        base_before_adjustment: Math.round(baseTraffic),
        effective_base_adt: signals.traffic_context?.effective_base_adt,
        distance_decay: signals.traffic_context?.distance_decay_primary,
        road_class_weight: signals.traffic_context?.road_class_weight_primary,
        frontage_factor: signals.traffic_context?.frontage_factor,
        multi_segment_exposure: signals.traffic_context?.total_exposure,
        temporal_adjusted_adt: signals.traffic_context?.temporal_adjusted_adt,
        temporal_source: signals.traffic_context?.temporal_source,
        directional_factor: signals.traffic_context?.directional_factor,
        hourly_distribution: signals.traffic_context?.hourly_distribution,
        traffic_trajectory: signals.trajectory?.traffic_trajectory,
        trend_momentum: signals.trajectory?.trend_momentum,
        trend_direction: signals.trajectory?.trend_direction,
      },

      conversion_chain: conversionChain,
      hourly_potential: hourlyPotential,
      daily_breakdown: dailyBreakdown,
      physical_traffic_score: physicalTrafficScore,
      
      temporal_patterns: temporal,
      
      confidence,
      
      market_context: {
        submarket: marketResearch.submarket_name,
        market_condition: adjusted.condition,
        foot_traffic_index: physicalTrafficScore?.score ?? (marketResearch.demand_indicators?.properties_in_market || 100),
        supply_demand_ratio: marketResearch.supply_analysis?.future_supply_ratio || 1.0
      },
      
      model_version: this.MODEL_VERSION,
      prediction_date: new Date()
    };

    try {
      const digitalMomentumPct = signals.trajectory?.trend_momentum || 0;
      const yoyAadtGrowthPct = (signals.trajectory?.yoy_aadt_growth || 0) * 100;
      prediction.detected_patterns = trendPatternDetector.detectPatterns({
        digital_momentum_pct: digitalMomentumPct,
        yoy_aadt_growth_pct: yoyAadtGrowthPct,
        seasonal_deviation: signals.trajectory?.seasonal_deviation,
        digital_share: signals.web_traffic?.digital_share,
      });
    } catch {
      prediction.detected_patterns = trendPatternDetector.detectPatterns({
        digital_momentum_pct: 0,
        yoy_aadt_growth_pct: 0,
      });
    }
    
    // Step 12: Save prediction to database
    await this.savePrediction(prediction);
    
    const duration = Date.now() - startTime;
    console.log(`✅ Traffic prediction generated in ${duration}ms: ${prediction.weekly_walk_ins} weekly walk-ins`);
    
    return prediction;
  }
  
  /**
   * Calculate traffic from physical location attributes
   */
  private calculatePhysicalTraffic(property: Property): number {
    // Component 1: Street pedestrian volume
    const streetPedestrians = this.calculateStreetPedestrians(property);
    
    // Component 2: Capture rate (what % of pedestrians enter)
    const captureRate = this.calculateCaptureRate(property);
    
    // Component 3: Traffic from nearby generators
    const generatorTraffic = (
      this.calculateResidentialWalkins(property) +
      this.calculateWorkerWalkins(property) +
      this.calculateTransitWalkins(property)
    );
    
    // Total physical traffic
    const total = (streetPedestrians * captureRate) + generatorTraffic;
    
    return Math.max(0, total);
  }
  
  private calculateStreetPedestrians(property: Property): number {
    if (!property.adt) return 0;
    
    // Conversion rates: vehicles → pedestrians
    const conversionRates: Record<string, number> = {
      'arterial': 0.02,
      'collector': 0.05,
      'local': 0.08,
      'main_street': 0.15
    };
    
    const baseRate = conversionRates[property.road_type || 'collector'] || 0.03;
    
    // Adjust for sidewalk quality
    const sidewalkMultiplier = 0.5 + ((property.sidewalk_score || 50) / 100) * 1.5;
    
    const dailyPedestrians = property.adt * baseRate * sidewalkMultiplier;
    return dailyPedestrians * 7;  // Weekly
  }
  
  private calculateCaptureRate(property: Property): number {
    const baseRate = 0.05;  // 5% of pedestrians enter
    
    // Frontage bonus (wider = more visible)
    const frontageMultiplier = 1.0 + Math.min((property.frontage_feet || 50) / 100, 1.0);
    
    // Corner premium
    const cornerMultiplier = property.is_corner ? 1.4 : 1.0;
    
    // Setback penalty
    const setbackPenalty = Math.max(0.5, 1.0 - ((property.setback_feet || 10) / 50));
    
    // Signage and entrance factors
    const visibilityMultiplier = 0.7 + ((property.signage_score || 50) / 100) * 0.6;
    const entranceMultiplier = 0.8 + ((property.entrance_score || 50) / 100) * 0.4;
    
    const captureRate = (
      baseRate *
      frontageMultiplier *
      cornerMultiplier *
      setbackPenalty *
      visibilityMultiplier *
      entranceMultiplier
    );
    
    return Math.min(captureRate, 0.25);  // Cap at 25%
  }
  
  private calculateResidentialWalkins(property: Property): number {
    const unitsQuarterMile = property.residential_units_400m || 0;
    const unitsHalfMile = property.residential_units_800m || 0;
    
    // Closer residents visit more often
    const weeklyTrips = {
      quarter_mile: 2.5,
      half_mile: 0.8
    };
    
    return (
      unitsQuarterMile * weeklyTrips.quarter_mile +
      unitsHalfMile * weeklyTrips.half_mile
    );
  }
  
  private calculateWorkerWalkins(property: Property): number {
    const workers = property.employment_count_400m || 0;
    const visitRate = 0.15;  // 15% of workers visit weekly
    const visitsPerWorker = 1.5;
    
    return workers * visitRate * visitsPerWorker;
  }
  
  private calculateTransitWalkins(property: Property): number {
    if (!property.nearest_transit_distance_feet || property.nearest_transit_distance_feet > 2000) {
      return 0;  // Too far
    }
    
    const dailyRiders = property.transit_daily_riders || 0;
    const distanceDecay = Math.max(0, 1 - (property.nearest_transit_distance_feet / 2000));
    const captureRate = 0.08 * distanceDecay;
    
    return dailyRiders * 7 * captureRate;
  }
  
  /**
   * Translate market demand to property traffic
   * Uses Market Research Engine V2 output
   */
  private translateDemandToTraffic(property: Property, marketResearch: any): number {
    // Component 1: Employment-driven traffic
    const employmentTraffic = this.calculateEmploymentTraffic(
      marketResearch.employment_impact,
      property
    );
    
    // Component 2: Population growth traffic
    const populationTraffic = this.calculatePopulationTraffic(
      marketResearch.per_capita,
      property
    );
    
    // Component 3: Retail demand traffic
    const retailTraffic = this.calculateRetailDemandTraffic(
      marketResearch.supply_analysis,
      property
    );
    
    // Component 4: Market traffic multiplier
    const marketMultiplier = (marketResearch.demand_indicators?.properties_in_market || 100) / 100;
    
    const totalDemandTraffic = (
      employmentTraffic +
      populationTraffic +
      retailTraffic
    ) * marketMultiplier;
    
    return Math.max(0, totalDemandTraffic);
  }
  
  private calculateEmploymentTraffic(employmentImpact: any, property: Property): number {
    if (!employmentImpact) return 0;
    
    // From Market Research V2: total units demand from news
    const totalJobsAdded = employmentImpact.total_jobs_from_news || 0;
    
    if (totalJobsAdded <= 0) return 0;
    
    // Convert jobs to retail trips
    // 1 job = 15 weekly retail trips (lunch, shopping, after-work)
    const totalRetailTrips = totalJobsAdded * this.JOBS_TO_RETAIL_TRIPS;
    
    // This property's share of submarket traffic
    const propertyShare = this.calculatePropertyShare(property);
    
    return totalRetailTrips * propertyShare;
  }
  
  private calculatePopulationTraffic(perCapita: any, property: Property): number {
    if (!perCapita) return 0;
    
    const population = perCapita.population || 0;
    
    // Assume each person makes 3 weekly retail trips
    const weeklyTripsPerPerson = 3.0;
    const totalTrips = population * weeklyTripsPerPerson;
    
    // This property's share
    const propertyShare = this.calculatePropertyShare(property);
    
    return totalTrips * propertyShare * 0.1;  // Only 10% of population shops in this specific area
  }
  
  private calculateRetailDemandTraffic(supplyAnalysis: any, property: Property): number {
    if (!property.has_retail || !supplyAnalysis) return 0;
    
    // More available units = more people moving in = more retail traffic
    const availableUnits = supplyAnalysis.available_units_now || 0;
    
    // Each occupied unit generates ~10 weekly retail trips
    const tripsPerUnit = 10;
    const newRetailTraffic = availableUnits * tripsPerUnit;
    
    const propertyShare = this.calculatePropertyShare(property);
    
    return newRetailTraffic * propertyShare;
  }
  
  private calculatePropertyShare(property: Property): number {
    // Simple model: assume property captures 2-5% of submarket traffic
    // This should be enhanced with actual competitive analysis
    
    let baseShare = 0.03;  // 3% default
    
    // Corner properties capture more
    if (property.is_corner) baseShare *= 1.5;
    
    // Larger frontage = more capture
    if (property.frontage_feet && property.frontage_feet > 100) {
      baseShare *= 1.3;
    }
    
    // Fewer competitors = higher share
    if (property.competitor_count_500m && property.competitor_count_500m < 5) {
      baseShare *= 1.4;
    }
    
    return Math.min(baseShare, 0.10);  // Cap at 10%
  }
  
  /**
   * Apply supply-demand dynamics
   */
  private applySupplyDemandAdjustment(
    baseTraffic: number,
    supplyAnalysis: any,
    employmentImpact: any
  ): { traffic: number; multiplier: number; condition: string } {
    
    // Factor 1: Supply-demand ratio from zoning
    const futureSupplyRatio = supplyAnalysis?.future_supply_ratio || 100;
    
    // Undersupplied market = traffic premium
    let scarcityMultiplier = 1.0;
    if (futureSupplyRatio < 150) {  // Less than 150% future supply
      scarcityMultiplier = 1.2;  // 20% boost
    } else if (futureSupplyRatio > 250) {  // More than 250% future supply
      scarcityMultiplier = 0.85;  // 15% reduction
    }
    
    // Factor 2: Employment demand coverage
    const demandCoverage = employmentImpact?.demand_absorption_vs_future || 0;
    
    // Strong employment demand boosts traffic
    let demandMultiplier = 1.0;
    if (demandCoverage > 150) {  // Demand exceeds supply by 50%+
      demandMultiplier = 1.15;
    } else if (demandCoverage < 50) {  // Weak demand
      demandMultiplier = 0.90;
    }
    
    const finalMultiplier = scarcityMultiplier * demandMultiplier;
    const adjustedTraffic = baseTraffic * finalMultiplier;
    
    const condition = 
      finalMultiplier > 1.15 ? 'STRONG DEMAND' :
      finalMultiplier < 0.95 ? 'WEAK DEMAND' : 'BALANCED';
    
    return {
      traffic: adjustedTraffic,
      multiplier: Math.round(finalMultiplier * 100) / 100,
      condition
    };
  }
  
  /**
   * Apply calibration factors from validation
   */
  private async applyCalibrations(
    baseTraffic: number,
    property: Property,
    marketResearch: any
  ): Promise<number> {
    
    // Load active calibration factors
    const factors = await pool.query(`
      SELECT factor_type, factor_key, multiplier
      FROM traffic_calibration_factors
      WHERE is_active = TRUE
      AND (effective_until IS NULL OR effective_until >= CURRENT_DATE)
    `);
    
    let calibrated = baseTraffic;
    
    for (const factor of factors.rows) {
      // Apply relevant factors
      if (factor.factor_type === 'global') {
        calibrated *= factor.multiplier;
      }
      else if (factor.factor_type === 'property_type' && factor.factor_key === property.property_type) {
        calibrated *= factor.multiplier;
      }
      else if (factor.factor_type === 'submarket' && factor.factor_key === property.submarket_id) {
        calibrated *= factor.multiplier;
      }
    }
    
    return calibrated;
  }
  
  /**
   * Calculate temporal patterns
   */
  private calculateTemporalSplit(
    weeklyTotal: number,
    property: Property
  ): TrafficPrediction['temporal_patterns'] {
    
    // Weekday vs weekend split by property type
    const weekdayPct = property.property_type === 'office' ? 0.80 :
                       property.property_type === 'restaurant' ? 0.60 :
                       property.property_type === 'retail' ? 0.65 : 0.70;
    
    const weekdayTotal = weeklyTotal * weekdayPct;
    const weekendTotal = weeklyTotal * (1 - weekdayPct);
    
    const weekdayAvg = weekdayTotal / 5;
    const weekendAvg = weekendTotal / 2;
    
    // Peak patterns
    const peakDay = property.property_type === 'restaurant' ? 'Saturday' : 'Friday';
    const peakHour = property.property_type === 'restaurant' ? '7:00 PM - 8:00 PM' : '12:00 PM - 1:00 PM';
    
    return {
      weekday_avg: Math.round(weekdayAvg),
      weekend_avg: Math.round(weekendAvg),
      weekday_total: Math.round(weekdayTotal),
      weekend_total: Math.round(weekendTotal),
      peak_day: peakDay,
      peak_hour: peakHour
    };
  }
  
  /**
   * Calculate prediction confidence
   */
  private async calculateConfidence(
    property: Property,
    marketResearch: any
  ): Promise<TrafficPrediction['confidence']> {
    
    // Factor 1: Do we have validation data for similar properties?
    const validationCount = await pool.query(`
      SELECT COUNT(*) as count
      FROM validation_properties vp
      JOIN properties p ON vp.property_id = p.id
      WHERE p.submarket_id = $1
      AND vp.is_active = TRUE
    `, [property.submarket_id]);
    
    const validationConfidence = Math.min(validationCount.rows[0].count / 5, 1.0);
    
    // Factor 2: Market research confidence
    const marketConfidence = marketResearch.data_quality?.confidence_level === 'HIGH' ? 0.9 :
                             marketResearch.data_quality?.confidence_level === 'MEDIUM' ? 0.7 : 0.5;
    
    // Factor 3: Data completeness
    const hasADT = property.adt && property.adt > 0;
    const hasDemographics = property.residential_units_400m && property.residential_units_400m > 0;
    const dataCompleteness = ((hasADT ? 0.5 : 0) + (hasDemographics ? 0.5 : 0));
    
    // Combined confidence
    const overallConfidence = (
      validationConfidence * 0.40 +
      marketConfidence * 0.35 +
      dataCompleteness * 0.25
    );
    
    const tier = overallConfidence >= 0.75 ? 'High' :
                 overallConfidence >= 0.50 ? 'Medium' : 'Low';
    
    return {
      score: Math.round(overallConfidence * 100) / 100,
      tier,
      breakdown: {
        validation_data: Math.round(validationConfidence * 100) / 100,
        market_research: Math.round(marketConfidence * 100) / 100,
        data_completeness: Math.round(dataCompleteness * 100) / 100
      }
    };
  }
  
  /**
   * Save prediction to database
   */
  private async savePrediction(prediction: TrafficPrediction): Promise<void> {
    await pool.query(`
      INSERT INTO traffic_predictions (
        property_id,
        deal_id,
        prediction_week,
        prediction_year,
        weekly_walk_ins,
        daily_average,
        peak_hour_estimate,
        physical_traffic_component,
        demand_traffic_component,
        supply_demand_multiplier,
        base_before_adjustment,
        weekday_avg,
        weekend_avg,
        weekday_total,
        weekend_total,
        peak_day,
        peak_hour,
        confidence_score,
        confidence_tier,
        confidence_breakdown,
        submarket_id,
        foot_traffic_index,
        supply_demand_ratio,
        model_version,
        prediction_details
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25
      )
      ON CONFLICT (property_id, prediction_week, prediction_year)
      DO UPDATE SET
        weekly_walk_ins = EXCLUDED.weekly_walk_ins,
        daily_average = EXCLUDED.daily_average,
        confidence_score = EXCLUDED.confidence_score,
        updated_at = NOW()
    `, [
      prediction.property_id,
      prediction.deal_id || null,
      prediction.prediction_week,
      prediction.prediction_year,
      prediction.weekly_walk_ins,
      prediction.daily_average,
      prediction.peak_hour_estimate,
      prediction.breakdown.physical_factors,
      prediction.breakdown.market_demand_factors,
      prediction.breakdown.supply_demand_adjustment,
      prediction.breakdown.base_before_adjustment,
      prediction.temporal_patterns.weekday_avg,
      prediction.temporal_patterns.weekend_avg,
      prediction.temporal_patterns.weekday_total,
      prediction.temporal_patterns.weekend_total,
      prediction.temporal_patterns.peak_day,
      prediction.temporal_patterns.peak_hour,
      prediction.confidence.score,
      prediction.confidence.tier,
      JSON.stringify(prediction.confidence.breakdown),
      prediction.market_context.submarket,
      prediction.market_context.foot_traffic_index,
      prediction.market_context.supply_demand_ratio,
      prediction.model_version,
      JSON.stringify(prediction)
    ]);
  }
  
  /**
   * Load property data
   */
  private async loadProperty(propertyId: string): Promise<Property> {
    const result = await pool.query(`
      SELECT * FROM properties WHERE id = $1
    `, [propertyId]);
    
    if (result.rows.length === 0) {
      throw new Error(`Property ${propertyId} not found`);
    }
    
    return result.rows[0];
  }
  
  /**
   * v2: Predict full 7-metric leasing funnel for a property
   *
   * Uses learned conversion rates (EMA-calibrated from uploads) instead of
   * v1's static multipliers. Adds occupancy feedback loop and seasonal index.
   *
   * Formula chain:
   *   traffic(w) = baseline × seasonal(w) × occ_modifier
   *   tours = traffic × tour_rate(season)
   *   apps = tours × app_rate(season)
   *   net_leases = apps × lease_rate(season) × occ_modifier
   *   occupancy = prev + (move_ins - move_outs) / units
   *   eff_rent = current × (1 + growth)^t × concession(occ)
   *   closing_ratio = net_leases / traffic
   */
  async predictTrafficV2(
    propertyId: string,
    options?: {
      targetWeek?: number;
      totalUnits?: number;
      currentOccupancy?: number;
      currentEffRent?: number;
    }
  ): Promise<TrafficPredictionV2> {
    console.log(`🚦 v2 prediction for property ${propertyId}`);
    const startTime = Date.now();

    // Step 1: Run v1 base prediction (traffic + physical score)
    const v1 = await this.predictTraffic(propertyId, options?.targetWeek);

    // Step 2: Load learned rates
    const rates = await trafficLearning.getOrCreateLearnedRates(propertyId);

    // Step 3: Determine season from current week
    const { week } = options?.targetWeek
      ? { week: options.targetWeek }
      : this.getCurrentWeek();
    const season = this.getSeasonFromWeek(week);

    // Step 4: Get seasonal-adjusted conversion rates
    const tourRate = rates.tour_rate_seasonal?.[season] || rates.tour_rate;
    const appRate = rates.app_rate_seasonal?.[season] || rates.app_rate;
    const leaseRate = rates.lease_rate_seasonal?.[season] || rates.lease_rate;

    // Step 5: Apply seasonal index to traffic
    let seasonalFactor = 1.0;
    if (rates.seasonal_index?.length === 52 && week >= 1 && week <= 52) {
      seasonalFactor = rates.seasonal_index[week - 1] || 1.0;
    }
    const adjustedTraffic = Math.max(1, Math.round(v1.weekly_walk_ins * seasonalFactor));

    // Step 6: Occupancy feedback loop
    const currentOcc = options?.currentOccupancy || rates.stabilized_occupancy || 95.0;
    const occModifier = currentOcc < 90 ? 1.3 : currentOcc > 96 ? 0.7 : 1.0;

    // Step 7: Full funnel prediction
    const tours = Math.max(0, Math.round(adjustedTraffic * tourRate));
    const apps = Math.max(0, Math.round(tours * appRate));
    const netLeases = Math.max(0, Math.round(apps * leaseRate * occModifier));

    // Step 8: Occupancy projection (next week)
    const totalUnits = options?.totalUnits || 290;
    const avgWeeklyMoveOuts = totalUnits * 0.50 / 52;
    const nextOcc = Math.min(98, Math.max(85,
      currentOcc + (netLeases - avgWeeklyMoveOuts) / totalUnits * 100
    ));

    // Step 9: Effective rent projection
    const currentRent = options?.currentEffRent || 1808;
    const rentGrowth = rates.effective_rent_growth_rate || 0.032;
    const concessionFactor = nextOcc > 95 ? 1.0 : nextOcc > 90 ? 0.97 : 0.92;
    const effRent = Math.round(currentRent * concessionFactor);

    // Step 10: Closing ratio
    const closingRatio = adjustedTraffic > 0
      ? Math.round(netLeases / adjustedTraffic * 1000) / 10
      : 0;

    // Step 11: v2 confidence (based on data volume)
    const { score: confScore, tier: confTier } = trafficLearning.getConfidenceScore(rates.data_weeks);

    const v2: TrafficPredictionV2 = {
      ...v1,
      weekly_walk_ins: adjustedTraffic,
      daily_average: Math.round(adjustedTraffic / 7),
      model_version: '2.0.0',

      // v2 funnel
      in_person_tours: tours,
      applications: apps,
      net_leases: netLeases,
      occupancy_pct: Math.round(nextOcc * 10) / 10,
      effective_rent: effRent,
      closing_ratio: closingRatio,

      rates: { tour_rate: tourRate, app_rate: appRate, lease_rate: leaseRate },

      funnel_breakdown: {
        traffic_to_tours: tourRate,
        tours_to_apps: appRate,
        apps_to_leases: leaseRate,
        occupancy_modifier: occModifier,
        seasonal_factor: seasonalFactor,
      },

      confidence_v2: {
        score: confScore,
        tier: confTier,
        data_weeks: rates.data_weeks,
        per_metric: {
          traffic: Math.min(confScore + 5, 100),
          tours: rates.data_weeks >= 4 ? confScore : confScore - 15,
          apps: rates.data_weeks >= 8 ? confScore : confScore - 20,
          net_leases: confScore,
          occupancy: Math.min(confScore + 10, 100),
          effective_rent: Math.min(confScore + 10, 100),
        },
      },
    };

    // Step 12: Save v2 columns alongside v1
    await this.savePredictionV2(v2);

    const duration = Date.now() - startTime;
    console.log(`✅ v2 prediction in ${duration}ms: ${adjustedTraffic} walk-ins → ${tours} tours → ${apps} apps → ${netLeases} leases | occ: ${nextOcc}%`);

    return v2;
  }

  /**
   * Save v2 funnel columns to prediction row
   */
  private async savePredictionV2(pred: TrafficPredictionV2): Promise<void> {
    await pool.query(`
      UPDATE traffic_predictions SET
        in_person_tours = $1, applications = $2, net_leases = $3,
        occupancy_pct = $4, effective_rent = $5, closing_ratio = $6,
        tour_rate = $7, app_rate = $8, lease_rate = $9,
        model_version_v2 = '2.0.0',
        funnel_breakdown = $10,
        updated_at = NOW()
      WHERE property_id = $11
        AND prediction_week = $12
        AND prediction_year = $13
    `, [
      pred.in_person_tours, pred.applications, pred.net_leases,
      pred.occupancy_pct, pred.effective_rent, pred.closing_ratio,
      pred.rates.tour_rate, pred.rates.app_rate, pred.rates.lease_rate,
      JSON.stringify(pred.funnel_breakdown),
      pred.property_id, pred.prediction_week, pred.prediction_year,
    ]);
  }

  private mapRoadClassification(classification: string): string {
    const cl = (classification || '').toLowerCase();
    if (cl.includes('arterial') || cl.includes('principal')) return 'arterial';
    if (cl.includes('collector') || cl.includes('minor')) return 'collector';
    if (cl.includes('local') || cl.includes('residential')) return 'local';
    if (cl.includes('main') || cl.includes('downtown') || cl.includes('urban')) return 'main_street';
    return 'collector';
  }

  private getSeasonFromWeek(week: number): string {
    if (week < 9 || week >= 49) return 'winter';
    if (week < 22) return 'spring';
    if (week < 35) return 'summer';
    return 'fall';
  }

  /**
   * Get current week number
   */
  private getCurrentWeek(): { week: number; year: number } {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const diff = now.getTime() - start.getTime();
    const oneWeek = 1000 * 60 * 60 * 24 * 7;
    const week = Math.ceil(diff / oneWeek);

    return { week, year: now.getFullYear() };
  }
}

export default new TrafficPredictionEngine();

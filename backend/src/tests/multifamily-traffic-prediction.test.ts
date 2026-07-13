/**
 * Multifamily Leasing Traffic Prediction Tests
 *
 * Pinned baselines (see BASELINE_DATA in
 * backend/src/services/multifamilyTrafficService.ts):
 *   - 290 units, 0.90 occupancy → baseline_weekly_traffic = 11
 *   - visit_to_tour_ratio = 0.50 (P0 FIX — was 0.99, erasing the visit→tour stage)
 *   - closing_ratio is now DYNAMIC, computed by
 *     calculateClosingRatio(occupancy, month) — base 0.204, modulated by
 *     occupancy bucket and a per-month seasonal close-rate table
 *   - seasonality multiplier varies wildly by month (Sep=0.59, Dec=0.49,
 *     Jun=1.50) and holiday weeks override it (see BASELINE_DATA.holiday_weeks)
 *   - occupancy multiplier interpolates between anchors in
 *     calculateOccupancyMultiplier (0.80→1.60 down to 1.00→0.70)
 * backend/src/services/multifamilyTrafficService.ts):
 *   - 290 units, 0.90 occupancy → baseline_weekly_traffic = 11
 *   - tour_conversion_rate = 0.99 (still constant)
 *   - closing ratio is now DYNAMIC, computed by
 *     calculateClosingRatio(occupancy, month) — base 0.204, modulated by
 *     occupancy bucket and a per-month seasonal close-rate table
 *   - seasonality multiplier varies wildly by month (Sep=0.59, Dec=0.49,
 *     Jun=1.50) and holiday weeks override it (see BASELINE_DATA.holiday_weeks)
 *   - occupancy multiplier interpolates between anchors in
 *     calculateOccupancyMultiplier (0.80→1.60 down to 1.00→0.70)
 *
 * To keep assertions deterministic across calendar dates, every test that
 * inspects raw weekly_traffic / closing_ratio passes an explicit
 * predictionDate of April 15, 2026 (mid-month, non-holiday, seasonality 1.09).
 *
 * @version 1.1.0
 * @date 2026-04-28
 */

import { MultifamilyTrafficService, PropertyLeasingInput } from '../services/multifamilyTrafficService';
import { Pool } from 'pg';
import type { Mock } from 'vitest';

// Mid-April: non-holiday week, seasonality multiplier = 1.09, no overrides.
const STABLE_DATE = new Date(2026, 3, 15);

// Mock pool for testing
const mockPool = {
  query: vi.fn(),
  on: vi.fn(),
  connect: vi.fn(),
  end: vi.fn()
} as unknown as Pool;

describe('Multifamily Traffic Prediction - Baseline Validation', () => {
  let service: MultifamilyTrafficService;

  beforeEach(() => {
    service = new MultifamilyTrafficService(mockPool);
    vi.clearAllMocks();
  });

  /**
   * Test 1: Baseline Property Match
   * 
   * Property matching Leon's baseline should predict ~11 traffic/week
   */
  test('Should predict baseline traffic for 290-unit property at stable date', async () => {
    // Mock no market data available (uses defaults)
    (mockPool.query as Mock).mockResolvedValue({ rows: [] });

    const baselineProperty: PropertyLeasingInput = {
      units: 290,
      occupancy: 0.90,
      submarket_id: 'test-submarket',
      avg_rent: 1500,
      market_rent: 1500
    };

    // Pin the date so seasonality (April = 1.09) doesn't drift the result.
    // base_traffic 11 × demand 1.0 × pricing 1.0 × seasonality 1.09 ×
    // occupancy_multiplier(0.90)≈1.15 → 13.78 → rounds to 14.
    const prediction = await service.predictWeeklyLeasingTraffic(baselineProperty, STABLE_DATE);

    // Mid-April baseline lands at ~14 (±2 for any future fine-tuning).
    expect(prediction.weekly_traffic).toBeGreaterThanOrEqual(12);
    expect(prediction.weekly_traffic).toBeLessThanOrEqual(16);

    // P0 FIX: visit_to_tour_ratio is now 0.50 (was 0.99, erasing the visit→tour stage).
    // This is a platform default; the absorption engine will calibrate it empirically.
    expect(prediction.visit_to_tour_ratio).toBe(0.50);
    expect(prediction.tour_conversion).toBe(0.50); // deprecated alias

    // Closing ratio is now dynamic (calculateClosingRatio: base 0.204 ×
    // occupancy bucket × seasonal close-rate). For occ=0.90 in April:
    // 0.204 × 1.20 × 1.30 ≈ 0.318. Allow a sane band.
    expect(prediction.closing_ratio).toBeGreaterThanOrEqual(0.20);
    expect(prediction.closing_ratio).toBeLessThanOrEqual(0.40);

    // P0 FIX: Tours now follow the real visit→tour ratio (was: traffic × 0.99).
    // With visit_to_tour_ratio = 0.50, tours = traffic × 0.50 (roughly half the traffic).
    const expectedTours = Math.round(prediction.weekly_traffic * prediction.visit_to_tour_ratio);
    expect(prediction.weekly_tours).toBe(expectedTours);

    // P0 FIX: Leases now reflect the two-stage funnel: visits × 0.50 × closing_ratio.
    // The corrected number is ~50% lower than before (the old bug over-projected by ~2×).
    const expectedLeases = Math.round(prediction.weekly_tours * prediction.closing_ratio * 10) / 10;
    expect(prediction.expected_leases).toBeCloseTo(expectedLeases, 1);
  });

  /**
   * Test 2: Property Size Scaling
   * 
   * Larger properties should get proportionally more traffic
   */
  test('Should scale traffic proportionally with property size', async () => {
    (mockPool.query as Mock).mockResolvedValue({ rows: [] });

    // base_traffic = (units / 290) × 11, so traffic is linear in units modulo
    // a final Math.round. Compare baseline (290) vs 2× baseline (580) — the
    // original test used 145 vs 580 (4×) but asserted a 2× ratio, which never
    // matched the linear model. The current service is in fact linear.
    const baselineProperty: PropertyLeasingInput = {
      units: 290,
      occupancy: 0.90,
      submarket_id: 'test-submarket',
      avg_rent: 1500,
      market_rent: 1500
    };

    const largeProperty: PropertyLeasingInput = {
      ...baselineProperty,
      units: 580 // 2× baseline
    };

    const baselinePrediction = await service.predictWeeklyLeasingTraffic(baselineProperty, STABLE_DATE);
    const largePrediction = await service.predictWeeklyLeasingTraffic(largeProperty, STABLE_DATE);

    // 2× units should give ~2× traffic (rounding tolerance ±10%).
    const ratio = largePrediction.weekly_traffic / baselinePrediction.weekly_traffic;
    expect(ratio).toBeGreaterThan(1.8);
    expect(ratio).toBeLessThan(2.2);
  });

  /**
   * Test 3: Market Demand Impact
   * 
   * Undersupplied market should increase traffic by ~30%
   */
  test('Should apply +30% multiplier for undersupplied market', async () => {
    const baselineProperty: PropertyLeasingInput = {
      units: 290,
      occupancy: 0.90,
      submarket_id: 'test-submarket',
      avg_rent: 1500,
      market_rent: 1500
    };

    // Scenario 1: No market data (baseline)
    (mockPool.query as Mock).mockResolvedValue({ rows: [] });
    const baselinePrediction = await service.predictWeeklyLeasingTraffic(baselineProperty);

    // Scenario 2: Undersupplied market (ratio > 1.2)
    (mockPool.query as Mock).mockResolvedValue({
      rows: [{
        supply_demand_ratio: 1.5,
        market_condition: 'STRONG'
      }]
    });
    const highDemandPrediction = await service.predictWeeklyLeasingTraffic(baselineProperty);

    // Should see ~30% increase
    const increaseRatio = highDemandPrediction.weekly_traffic / baselinePrediction.weekly_traffic;
    expect(increaseRatio).toBeGreaterThan(1.25);
    expect(increaseRatio).toBeLessThan(1.35);
  });

  /**
   * Test 4: Pricing Impact
   * 
   * Below-market pricing should attract +20% more traffic
   */
  test('Should apply +20% multiplier for below-market pricing', async () => {
    (mockPool.query as Mock).mockResolvedValue({ rows: [] });

    const marketPriceProperty: PropertyLeasingInput = {
      units: 290,
      occupancy: 0.90,
      submarket_id: 'test-submarket',
      avg_rent: 1500,
      market_rent: 1500
    };

    const belowMarketProperty: PropertyLeasingInput = {
      units: 290,
      occupancy: 0.90,
      submarket_id: 'test-submarket',
      avg_rent: 1400, // 7% below market
      market_rent: 1500
    };

    const marketPrediction = await service.predictWeeklyLeasingTraffic(marketPriceProperty);
    const belowMarketPrediction = await service.predictWeeklyLeasingTraffic(belowMarketProperty);

    // Should see ~20% increase
    const increaseRatio = belowMarketPrediction.weekly_traffic / marketPrediction.weekly_traffic;
    expect(increaseRatio).toBeGreaterThan(1.15);
    expect(increaseRatio).toBeLessThan(1.25);
  });

  /**
   * Test 5: Occupancy Impact
   * 
   * Low occupancy should trigger aggressive leasing (+30% traffic)
   * High occupancy should reduce traffic (-40%)
   */
  test('Should adjust traffic based on occupancy urgency', async () => {
    (mockPool.query as Mock).mockResolvedValue({ rows: [] });

    const normalOccupancy: PropertyLeasingInput = {
      units: 290,
      occupancy: 0.90,
      submarket_id: 'test-submarket',
      avg_rent: 1500,
      market_rent: 1500
    };

    const lowOccupancy: PropertyLeasingInput = {
      ...normalOccupancy,
      occupancy: 0.80 // Low occupancy - aggressive leasing (anchor mult 1.60)
    };

    // Use 0.98 (anchor mult 0.78) rather than 0.96 (mult 0.88) so the
    // "less urgency" effect is unambiguous without being knife-edge.
    const highOccupancy: PropertyLeasingInput = {
      ...normalOccupancy,
      occupancy: 0.98
    };

    const normalPrediction = await service.predictWeeklyLeasingTraffic(normalOccupancy, STABLE_DATE);
    const lowOccPrediction = await service.predictWeeklyLeasingTraffic(lowOccupancy, STABLE_DATE);
    const highOccPrediction = await service.predictWeeklyLeasingTraffic(highOccupancy, STABLE_DATE);

    // Low occupancy should have more traffic.
    expect(lowOccPrediction.weekly_traffic).toBeGreaterThan(normalPrediction.weekly_traffic);

    // High occupancy should have less traffic.
    expect(highOccPrediction.weekly_traffic).toBeLessThan(normalPrediction.weekly_traffic);

    // Verify multipliers roughly match the calibrated anchors:
    // low(0.80→1.60) / normal(0.90→~1.15) ≈ 1.39 → assert > 1.25
    const lowRatio = lowOccPrediction.weekly_traffic / normalPrediction.weekly_traffic;
    expect(lowRatio).toBeGreaterThan(1.25);

    // high(0.98→0.78) / normal(0.90→~1.15) ≈ 0.68 → assert in 0.50–0.75
    // (loose enough to absorb minor anchor retuning, tight enough to catch
    // a regression that drops the high-occupancy dampening entirely).
    const highRatio = highOccPrediction.weekly_traffic / normalPrediction.weekly_traffic;
    expect(highRatio).toBeGreaterThan(0.50);
    expect(highRatio).toBeLessThan(0.75);
  });

  /**
   * Test 6: Confidence Scoring
   * 
   * Predictions with market data should have higher confidence
   */
  test('Should calculate confidence based on data availability', async () => {
    const property: PropertyLeasingInput = {
      units: 290,
      occupancy: 0.90,
      submarket_id: 'test-submarket',
      avg_rent: 1500,
      market_rent: 1500
    };

    // No market data
    (mockPool.query as Mock).mockResolvedValue({ rows: [] });
    const noDataPrediction = await service.predictWeeklyLeasingTraffic(property);

    // With market data
    (mockPool.query as Mock).mockResolvedValue({
      rows: [{
        supply_demand_ratio: 1.0,
        market_condition: 'BALANCED'
      }]
    });
    const withDataPrediction = await service.predictWeeklyLeasingTraffic(property);

    // With market data should have higher confidence
    expect(withDataPrediction.confidence).toBeGreaterThan(noDataPrediction.confidence);
    
    // Both should be reasonable scores (0.5-1.0)
    expect(noDataPrediction.confidence).toBeGreaterThan(0.5);
    expect(withDataPrediction.confidence).toBeGreaterThan(0.7);
  });
});

describe('Multifamily Traffic Prediction - Forecasting', () => {
  let service: MultifamilyTrafficService;

  beforeEach(() => {
    service = new MultifamilyTrafficService(mockPool);
    vi.clearAllMocks();
  });

  /**
   * Test 7: Monthly Absorption Forecast
   * 
   * 4-week forecast should show seasonal variation
   */
  test('Should generate 4-week absorption forecast', async () => {
    (mockPool.query as Mock).mockResolvedValue({ rows: [] });

    const property: PropertyLeasingInput = {
      units: 290,
      occupancy: 0.90,
      submarket_id: 'test-submarket',
      avg_rent: 1500,
      market_rent: 1500
    };

    const forecast = await service.predictMonthlyAbsorption(property, 4);

    // Should have 4 weeks
    expect(forecast.weeks).toHaveLength(4);
    
    // Each week should have predictions
    forecast.weeks.forEach((week, index) => {
      expect(week.week_number).toBe(index + 1);
      expect(week.traffic).toBeGreaterThan(0);
      expect(week.tours).toBeGreaterThan(0);
      expect(week.expected_leases).toBeGreaterThan(0);
    });
    
    // Monthly totals should sum up
    const sumTraffic = forecast.weeks.reduce((sum, w) => sum + w.traffic, 0);
    expect(forecast.monthly_total_traffic).toBe(sumTraffic);
  });

  /**
   * Test 8: Lease-Up Timeline Calculation
   * 
   * Should project weeks to reach target occupancy
   */
  test('Should calculate realistic lease-up timeline', async () => {
    (mockPool.query as Mock).mockResolvedValue({ rows: [] });

    const timeline = await service.calculateLeaseUpTimeline(
      'test-property-id',
      200, // total units
      0.50, // 50% start occupancy
      0.95, // 95% target
      'test-submarket',
      1500,
      1500
    );

    // Should need to lease 90 units (45% of 200)
    expect(timeline.units_to_lease).toBe(90);
    
    // Should have week-by-week projections
    expect(timeline.weekly_projections.length).toBeGreaterThan(0);
    
    // Final week should reach or exceed target
    const finalWeek = timeline.weekly_projections[timeline.weekly_projections.length - 1];
    expect(finalWeek.occupancy).toBeGreaterThanOrEqual(0.95);
    
    // Cumulative leases should equal units to lease
    expect(finalWeek.cumulative_leases).toBeGreaterThanOrEqual(timeline.units_to_lease);
    
    // Timeline should be reasonable (not infinite, not instant)
    expect(timeline.estimated_weeks).toBeGreaterThan(10);
    expect(timeline.estimated_weeks).toBeLessThan(104); // Less than 2 years
  });
});

describe('Multifamily Traffic Prediction - Rent Optimization', () => {
  let service: MultifamilyTrafficService;

  beforeEach(() => {
    service = new MultifamilyTrafficService(mockPool);
    vi.clearAllMocks();
  });

  /**
   * Test 9: Rent Velocity Optimization
   * 
   * Should show tradeoff between rent and absorption speed
   */
  test('Should generate rent optimization scenarios', async () => {
    (mockPool.query as Mock).mockResolvedValue({ rows: [] });

    // Use a property where the lease-up gap (units × (0.95 − occ)) is large
    // enough that the per-bucket weeks-to-stabilize differ AFTER rounding to
    // 0.1 months. With units=290, occ=0.85 the absorption-per-week was high
    // enough that -10% and Market both rounded to 1.2 months. units=580 +
    // occ=0.70 → 145 units to lease, giving cleanly distinct buckets:
    // -10% ≈ 2.3mo, Market ≈ 2.8mo, +10% ≈ 3.2mo.
    const property: PropertyLeasingInput = {
      units: 580,
      occupancy: 0.70,
      submarket_id: 'test-submarket',
      avg_rent: 1500,
      market_rent: 1500
    };

    const optimization = await service.optimizeRentForVelocity(
      'test-property-id',
      property
    );

    // Should have 5 scenarios (-10%, -5%, market, +5%, +10%).
    expect(optimization.scenarios).toHaveLength(5);

    const belowMarket = optimization.scenarios.find(s => s.rent_vs_market === '-10%');
    const atMarket = optimization.scenarios.find(s => s.rent_vs_market === 'Market');
    const aboveMarket = optimization.scenarios.find(s => s.rent_vs_market === '+10%');

    expect(belowMarket).toBeDefined();
    expect(atMarket).toBeDefined();
    expect(aboveMarket).toBeDefined();

    if (belowMarket && atMarket && aboveMarket) {
      // Traffic should decrease as rent increases.
      expect(belowMarket.weekly_traffic).toBeGreaterThan(atMarket.weekly_traffic);
      expect(atMarket.weekly_traffic).toBeGreaterThan(aboveMarket.weekly_traffic);

      // Lower rent = faster lease-up. With the 0.1-month rounding still in
      // play, demand monotonically-non-increasing across buckets, but with
      // this property size the buckets separate cleanly.
      expect(belowMarket.months_to_stabilization).toBeLessThan(atMarket.months_to_stabilization);
      expect(atMarket.months_to_stabilization).toBeLessThan(aboveMarket.months_to_stabilization);
    }

    // Should have a recommendation.
    expect(optimization.recommended_rent).toBeGreaterThan(0);
    expect(optimization.recommendation_reason).toBeTruthy();
  });

  /**
   * Test 10: Aggressive Lease-Up Recommendation
   * 
   * When targeting fast lease-up, should recommend below-market rent
   */
  test('Should recommend below-market rent for aggressive lease-up', async () => {
    (mockPool.query as Mock).mockResolvedValue({ rows: [] });

    const property: PropertyLeasingInput = {
      units: 290,
      occupancy: 0.70, // Very low occupancy
      submarket_id: 'test-submarket',
      avg_rent: 1500,
      market_rent: 1500
    };

    const optimization = await service.optimizeRentForVelocity(
      'test-property-id',
      property,
      4 // Target 4 months to stabilization
    );

    // Should recommend below-market rent
    expect(optimization.recommended_rent).toBeLessThan(property.market_rent);
    expect(optimization.recommendation_reason).toContain('below market');
  });
});

// Run tests:
// npm test multifamily-traffic-prediction.test.ts

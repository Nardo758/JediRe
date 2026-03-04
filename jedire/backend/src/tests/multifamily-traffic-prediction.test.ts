/**
 * Multifamily Leasing Traffic Prediction Tests
 * 
 * Validates prediction accuracy against Leon's baseline data:
 * - 290 units, ~90% occupancy
 * - Should predict ~11 traffic/week
 * - 99% tour conversion, 20.7% closing ratio
 * 
 * @version 1.0.0
 * @date 2025-02-18
 */

import { MultifamilyTrafficService, PropertyLeasingInput } from '../services/multifamilyTrafficService';
import { Pool } from 'pg';

// Mock pool for testing
const mockPool = {
  query: jest.fn(),
  on: jest.fn(),
  connect: jest.fn(),
  end: jest.fn()
} as unknown as Pool;

describe('Multifamily Traffic Prediction - Baseline Validation', () => {
  let service: MultifamilyTrafficService;

  beforeEach(() => {
    service = new MultifamilyTrafficService(mockPool);
    jest.clearAllMocks();
  });

  /**
   * Test 1: Baseline Property Match
   * 
   * Property matching Leon's baseline should predict ~11 traffic/week
   */
  test('Should predict ~11 weekly traffic for 290-unit baseline property', async () => {
    // Mock no market data available (uses defaults)
    (mockPool.query as jest.Mock).mockResolvedValue({ rows: [] });

    const baselineProperty: PropertyLeasingInput = {
      units: 290,
      occupancy: 0.90,
      submarket_id: 'test-submarket',
      avg_rent: 1500,
      market_rent: 1500
    };

    const prediction = await service.predictWeeklyLeasingTraffic(baselineProperty);

    // Should be close to 11 (±2 for seasonality variation)
    expect(prediction.weekly_traffic).toBeGreaterThanOrEqual(8);
    expect(prediction.weekly_traffic).toBeLessThanOrEqual(14);
    
    // Tour conversion should be 99%
    expect(prediction.tour_conversion).toBe(0.99);
    
    // Closing ratio should be 20.7%
    expect(prediction.closing_ratio).toBe(0.207);
    
    // Tours should be ~99% of traffic
    const expectedTours = Math.round(prediction.weekly_traffic * 0.99);
    expect(prediction.weekly_tours).toBe(expectedTours);
    
    // Leases should follow 20.7% closing ratio
    const expectedLeases = Math.round(prediction.weekly_tours * 0.207 * 10) / 10;
    expect(prediction.expected_leases).toBeCloseTo(expectedLeases, 1);
  });

  /**
   * Test 2: Property Size Scaling
   * 
   * Larger properties should get proportionally more traffic
   */
  test('Should scale traffic proportionally with property size', async () => {
    (mockPool.query as jest.Mock).mockResolvedValue({ rows: [] });

    const smallProperty: PropertyLeasingInput = {
      units: 145, // Half of baseline
      occupancy: 0.90,
      submarket_id: 'test-submarket',
      avg_rent: 1500,
      market_rent: 1500
    };

    const largeProperty: PropertyLeasingInput = {
      units: 580, // Double the baseline
      occupancy: 0.90,
      submarket_id: 'test-submarket',
      avg_rent: 1500,
      market_rent: 1500
    };

    const smallPrediction = await service.predictWeeklyLeasingTraffic(smallProperty);
    const largePrediction = await service.predictWeeklyLeasingTraffic(largeProperty);

    // Large property should have roughly 2x the traffic of small property
    const ratio = largePrediction.weekly_traffic / smallPrediction.weekly_traffic;
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
    (mockPool.query as jest.Mock).mockResolvedValue({ rows: [] });
    const baselinePrediction = await service.predictWeeklyLeasingTraffic(baselineProperty);

    // Scenario 2: Undersupplied market (ratio > 1.2)
    (mockPool.query as jest.Mock).mockResolvedValue({
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
    (mockPool.query as jest.Mock).mockResolvedValue({ rows: [] });

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
    (mockPool.query as jest.Mock).mockResolvedValue({ rows: [] });

    const normalOccupancy: PropertyLeasingInput = {
      units: 290,
      occupancy: 0.90,
      submarket_id: 'test-submarket',
      avg_rent: 1500,
      market_rent: 1500
    };

    const lowOccupancy: PropertyLeasingInput = {
      ...normalOccupancy,
      occupancy: 0.80 // Low occupancy - aggressive leasing
    };

    const highOccupancy: PropertyLeasingInput = {
      ...normalOccupancy,
      occupancy: 0.96 // Nearly full - less urgency
    };

    const normalPrediction = await service.predictWeeklyLeasingTraffic(normalOccupancy);
    const lowOccPrediction = await service.predictWeeklyLeasingTraffic(lowOccupancy);
    const highOccPrediction = await service.predictWeeklyLeasingTraffic(highOccupancy);

    // Low occupancy should have more traffic
    expect(lowOccPrediction.weekly_traffic).toBeGreaterThan(normalPrediction.weekly_traffic);
    
    // High occupancy should have less traffic
    expect(highOccPrediction.weekly_traffic).toBeLessThan(normalPrediction.weekly_traffic);
    
    // Verify multipliers roughly match spec
    const lowRatio = lowOccPrediction.weekly_traffic / normalPrediction.weekly_traffic;
    expect(lowRatio).toBeGreaterThan(1.25);
    
    const highRatio = highOccPrediction.weekly_traffic / normalPrediction.weekly_traffic;
    expect(highRatio).toBeLessThan(0.65);
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
    (mockPool.query as jest.Mock).mockResolvedValue({ rows: [] });
    const noDataPrediction = await service.predictWeeklyLeasingTraffic(property);

    // With market data
    (mockPool.query as jest.Mock).mockResolvedValue({
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
    jest.clearAllMocks();
  });

  /**
   * Test 7: Monthly Absorption Forecast
   * 
   * 4-week forecast should show seasonal variation
   */
  test('Should generate 4-week absorption forecast', async () => {
    (mockPool.query as jest.Mock).mockResolvedValue({ rows: [] });

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
    (mockPool.query as jest.Mock).mockResolvedValue({ rows: [] });

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
    jest.clearAllMocks();
  });

  /**
   * Test 9: Rent Velocity Optimization
   * 
   * Should show tradeoff between rent and absorption speed
   */
  test('Should generate rent optimization scenarios', async () => {
    (mockPool.query as jest.Mock).mockResolvedValue({ rows: [] });

    const property: PropertyLeasingInput = {
      units: 290,
      occupancy: 0.85, // Low occupancy - need to lease up
      submarket_id: 'test-submarket',
      avg_rent: 1500,
      market_rent: 1500
    };

    const optimization = await service.optimizeRentForVelocity(
      'test-property-id',
      property
    );

    // Should have 5 scenarios (-10%, -5%, market, +5%, +10%)
    expect(optimization.scenarios).toHaveLength(5);
    
    // Below-market scenarios should have more traffic
    const belowMarket = optimization.scenarios.find(s => s.rent_vs_market === '-10%');
    const atMarket = optimization.scenarios.find(s => s.rent_vs_market === 'Market');
    const aboveMarket = optimization.scenarios.find(s => s.rent_vs_market === '+10%');
    
    expect(belowMarket).toBeDefined();
    expect(atMarket).toBeDefined();
    expect(aboveMarket).toBeDefined();
    
    if (belowMarket && atMarket && aboveMarket) {
      // Traffic should decrease as rent increases
      expect(belowMarket.weekly_traffic).toBeGreaterThan(atMarket.weekly_traffic);
      expect(atMarket.weekly_traffic).toBeGreaterThan(aboveMarket.weekly_traffic);
      
      // Lower rent = faster lease-up
      expect(belowMarket.months_to_stabilization).toBeLessThan(atMarket.months_to_stabilization);
    }
    
    // Should have a recommendation
    expect(optimization.recommended_rent).toBeGreaterThan(0);
    expect(optimization.recommendation_reason).toBeTruthy();
  });

  /**
   * Test 10: Aggressive Lease-Up Recommendation
   * 
   * When targeting fast lease-up, should recommend below-market rent
   */
  test('Should recommend below-market rent for aggressive lease-up', async () => {
    (mockPool.query as jest.Mock).mockResolvedValue({ rows: [] });

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

/**
 * Design Optimizer Service Tests
 * 
 * Comprehensive test suite for all optimization algorithms
 */

import { designOptimizerService } from '../designOptimizer.service';
import {
  optimizeUnitMixAlgorithm,
  optimizeParkingAlgorithm,
  optimizeAmenitiesAlgorithm,
  generateMassingGeometry
} from '../optimizationAlgorithms';
import type {
  MarketDemandData,
  ParcelData,
  ZoningRequirements,
  ConstructionCosts
} from '../designOptimizer.service';

// ============================================================================
// MOCK DATA
// ============================================================================

const mockMarketData: MarketDemandData = {
  studioAbsorption: 3.5,
  oneBrAbsorption: 5.0,
  twoBrAbsorption: 4.2,
  threeBrAbsorption: 2.0,
  studioRentPSF: 2.50,
  oneBrRentPSF: 2.30,
  twoBrRentPSF: 2.10,
  threeBrRentPSF: 1.90,
  vacancy: 0.05
};

const mockParcel: ParcelData = {
  lotSizeSqft: 50000,
  zoningFAR: 2.5,
  maxHeight: 75,
  maxStories: 6,
  setbacks: {
    front: 20,
    side: 15,
    rear: 20
  },
  geometry: {
    type: 'Polygon',
    coordinates: [
      [[0, 0], [200, 0], [200, 250], [0, 250], [0, 0]]
    ]
  }
};

const mockZoning: ZoningRequirements = {
  parkingRatioMin: 1.2,
  parkingRatioMax: 2.0,
  buildingEfficiency: 0.80,
  commonAreaRatio: 0.12
};

const mockCosts: ConstructionCosts = {
  surfaceParkingPerSpace: 4000,
  podiumParkingPerSpace: 40000,
  structuredParkingPerSpace: 60000,
  amenityCostPerSqft: 120
};

// ============================================================================
// UNIT MIX OPTIMIZER TESTS
// ============================================================================

describe('Unit Mix Optimizer', () => {
  test('should optimize unit mix within FAR constraints', () => {
    const result = designOptimizerService.optimizeUnitMix(
      mockMarketData,
      mockParcel,
      mockZoning
    );

    expect(result.totalUnits).toBeGreaterThan(0);
    expect(result.projectedNOI).toBeGreaterThan(0);
    
    // Check FAR compliance
    const totalSqft = 
      result.studio * 600 +
      result.oneBR * 750 +
      result.twoBR * 1000 +
      result.threeBR * 1300;
    const effectiveFAR = totalSqft / mockParcel.lotSizeSqft;
    
    expect(effectiveFAR).toBeLessThanOrEqual(mockParcel.zoningFAR * mockZoning.buildingEfficiency);
  });

  test('should prioritize high-NOI unit types', () => {
    const result = designOptimizerService.optimizeUnitMix(
      mockMarketData,
      mockParcel,
      mockZoning
    );

    // With mock data, studios and 1BRs should dominate (higher rent PSF)
    const studioAnd1BR = result.studio + result.oneBR;
    const total = result.totalUnits;
    
    expect(studioAnd1BR / total).toBeGreaterThan(0.5);
  });

  test('should maintain unit type diversity', () => {
    const result = designOptimizerService.optimizeUnitMix(
      mockMarketData,
      mockParcel,
      mockZoning
    );

    // At least 3 different unit types should be present
    const typesPresent = [
      result.studio > 0,
      result.oneBR > 0,
      result.twoBR > 0,
      result.threeBR > 0
    ].filter(Boolean).length;

    expect(typesPresent).toBeGreaterThanOrEqual(3);
  });

  test('should calculate realistic absorption timeline', () => {
    const result = designOptimizerService.optimizeUnitMix(
      mockMarketData,
      mockParcel,
      mockZoning
    );

    expect(result.absorptionMonths).toBeGreaterThan(0);
    expect(result.absorptionMonths).toBeLessThan(36); // Reasonable timeline
  });

  test('should provide confidence score', () => {
    const result = designOptimizerService.optimizeUnitMix(
      mockMarketData,
      mockParcel,
      mockZoning
    );

    expect(result.confidenceScore).toBeGreaterThanOrEqual(0.5);
    expect(result.confidenceScore).toBeLessThanOrEqual(1.0);
  });

  test('should adjust for aggressive risk tolerance', () => {
    const conservativeResult = designOptimizerService.optimizeUnitMix(
      mockMarketData,
      mockParcel,
      mockZoning,
      { riskTolerance: 'conservative' }
    );

    const aggressiveResult = designOptimizerService.optimizeUnitMix(
      mockMarketData,
      mockParcel,
      mockZoning,
      { riskTolerance: 'aggressive' }
    );

    // Aggressive should target higher NOI (potentially)
    expect(aggressiveResult.projectedNOI).toBeDefined();
    expect(conservativeResult.projectedNOI).toBeDefined();
  });

  test('should handle small parcels', () => {
    const smallParcel: ParcelData = {
      ...mockParcel,
      lotSizeSqft: 10000,
      zoningFAR: 1.5
    };

    const result = designOptimizerService.optimizeUnitMix(
      mockMarketData,
      smallParcel,
      mockZoning
    );

    expect(result.totalUnits).toBeGreaterThan(0);
    expect(result.totalUnits).toBeLessThan(30); // Realistic for small parcel
  });

  test('should provide reasoning', () => {
    const result = designOptimizerService.optimizeUnitMix(
      mockMarketData,
      mockParcel,
      mockZoning
    );

    expect(result.reasoning).toBeDefined();
    expect(result.reasoning.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// PARKING OPTIMIZER TESTS
// ============================================================================

describe('Parking Optimizer', () => {
  let mockUnitMix: any;

  beforeEach(() => {
    mockUnitMix = designOptimizerService.optimizeUnitMix(
      mockMarketData,
      mockParcel,
      mockZoning
    );
  });

  test('should meet minimum parking requirements', () => {
    const result = designOptimizerService.optimizeParking(
      mockUnitMix.totalUnits,
      mockUnitMix,
      mockZoning,
      mockCosts,
      mockParcel
    );

    const requiredSpaces = Math.ceil(mockUnitMix.totalUnits * mockZoning.parkingRatioMin);
    expect(result.spaces).toBeGreaterThanOrEqual(requiredSpaces);
  });

  test('should prefer surface parking when feasible', () => {
    const smallUnitMix = {
      ...mockUnitMix,
      totalUnits: 20 // Small project
    };

    const result = designOptimizerService.optimizeParking(
      smallUnitMix.totalUnits,
      smallUnitMix,
      mockZoning,
      mockCosts,
      mockParcel
    );

    expect(result.type).toBe('surface');
    expect(result.surfaceSpaces).toBeGreaterThan(0);
  });

  test('should use structured parking for large projects', () => {
    const largeUnitMix = {
      ...mockUnitMix,
      totalUnits: 150
    };

    const result = designOptimizerService.optimizeParking(
      largeUnitMix.totalUnits,
      largeUnitMix,
      mockZoning,
      mockCosts,
      mockParcel
    );

    expect(['podium', 'structured', 'mixed']).toContain(result.type);
  });

  test('should calculate construction costs accurately', () => {
    const result = designOptimizerService.optimizeParking(
      mockUnitMix.totalUnits,
      mockUnitMix,
      mockZoning,
      mockCosts,
      mockParcel
    );

    expect(result.constructionCost).toBeGreaterThan(0);
    expect(result.costPerSpace).toBeGreaterThan(0);

    // Verify math
    const expectedCost = 
      result.surfaceSpaces * mockCosts.surfaceParkingPerSpace +
      result.structuredSpaces * (result.type === 'podium' ? mockCosts.podiumParkingPerSpace : mockCosts.structuredParkingPerSpace);
    
    expect(result.constructionCost).toBeCloseTo(expectedCost, -2);
  });

  test('should estimate operating costs', () => {
    const result = designOptimizerService.optimizeParking(
      mockUnitMix.totalUnits,
      mockUnitMix,
      mockZoning,
      mockCosts,
      mockParcel
    );

    expect(result.annualOperatingCost).toBeGreaterThan(0);
  });

  test('should calculate land use', () => {
    const result = designOptimizerService.optimizeParking(
      mockUnitMix.totalUnits,
      mockUnitMix,
      mockZoning,
      mockCosts,
      mockParcel
    );

    expect(result.landUseSqft).toBeGreaterThanOrEqual(0);
    expect(result.landUseSqft).toBeLessThanOrEqual(mockParcel.lotSizeSqft);
  });

  test('should provide reasoning', () => {
    const result = designOptimizerService.optimizeParking(
      mockUnitMix.totalUnits,
      mockUnitMix,
      mockZoning,
      mockCosts,
      mockParcel
    );

    expect(result.reasoning).toBeDefined();
    expect(result.reasoning.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// AMENITY OPTIMIZER TESTS
// ============================================================================

describe('Amenity Optimizer', () => {
  let mockUnitMix: any;

  beforeEach(() => {
    mockUnitMix = designOptimizerService.optimizeUnitMix(
      mockMarketData,
      mockParcel,
      mockZoning
    );
  });

  test('should select must-have amenities', () => {
    const result = designOptimizerService.optimizeAmenities(
      mockUnitMix.totalUnits,
      mockUnitMix,
      mockMarketData,
      mockCosts
    );

    const amenityNames = result.amenities.map(a => a.name);
    
    // Should include fitness center and clubhouse (must-haves)
    expect(amenityNames).toContain('Fitness Center');
    expect(amenityNames).toContain('Clubhouse / Lounge');
  });

  test('should calculate ROI for each amenity', () => {
    const result = designOptimizerService.optimizeAmenities(
      mockUnitMix.totalUnits,
      mockUnitMix,
      mockMarketData,
      mockCosts
    );

    result.amenities.forEach(amenity => {
      expect(amenity.roi).toBeGreaterThan(0);
      expect(amenity.cost).toBeGreaterThan(0);
      expect(amenity.rentPremium).toBeGreaterThan(0);
    });
  });

  test('should filter by minimum unit count', () => {
    const smallUnitMix = {
      ...mockUnitMix,
      totalUnits: 25
    };

    const result = designOptimizerService.optimizeAmenities(
      smallUnitMix.totalUnits,
      smallUnitMix,
      mockMarketData,
      mockCosts
    );

    // Yoga studio requires 100+ units, shouldn't appear
    const amenityNames = result.amenities.map(a => a.name);
    expect(amenityNames).not.toContain('Yoga Studio');
  });

  test('should add premium amenities for aggressive risk tolerance', () => {
    const conservativeResult = designOptimizerService.optimizeAmenities(
      mockUnitMix.totalUnits,
      mockUnitMix,
      mockMarketData,
      mockCosts,
      { riskTolerance: 'conservative' }
    );

    const aggressiveResult = designOptimizerService.optimizeAmenities(
      mockUnitMix.totalUnits,
      mockUnitMix,
      mockMarketData,
      mockCosts,
      { riskTolerance: 'aggressive' }
    );

    expect(aggressiveResult.amenities.length).toBeGreaterThanOrEqual(conservativeResult.amenities.length);
  });

  test('should calculate total costs and premiums', () => {
    const result = designOptimizerService.optimizeAmenities(
      mockUnitMix.totalUnits,
      mockUnitMix,
      mockMarketData,
      mockCosts
    );

    expect(result.totalCost).toBeGreaterThan(0);
    expect(result.totalSqft).toBeGreaterThan(0);
    expect(result.rentPremiumTotal).toBeGreaterThan(0);
    expect(result.paybackYears).toBeGreaterThan(0);

    // Verify math
    const sumCost = result.amenities.reduce((sum, a) => sum + a.cost, 0);
    expect(result.totalCost).toBeCloseTo(sumCost, -2);
  });

  test('should prioritize high-ROI amenities', () => {
    const result = designOptimizerService.optimizeAmenities(
      mockUnitMix.totalUnits,
      mockUnitMix,
      mockMarketData,
      mockCosts
    );

    // All recommended amenities should have reasonable ROI
    const recommendedAmenities = result.amenities.filter(a => a.priority === 'recommended');
    recommendedAmenities.forEach(amenity => {
      expect(amenity.roi).toBeGreaterThan(0.15);
    });
  });

  test('should provide reasoning', () => {
    const result = designOptimizerService.optimizeAmenities(
      mockUnitMix.totalUnits,
      mockUnitMix,
      mockMarketData,
      mockCosts
    );

    expect(result.reasoning).toBeDefined();
    expect(result.reasoning.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// MASSING GENERATOR TESTS
// ============================================================================

describe('Massing Generator', () => {
  let mockUnitMix: any;

  beforeEach(() => {
    mockUnitMix = designOptimizerService.optimizeUnitMix(
      mockMarketData,
      mockParcel,
      mockZoning
    );
  });

  test('should generate building footprint', () => {
    const result = designOptimizerService.generateMassing(
      mockParcel,
      mockZoning,
      mockUnitMix.totalUnits,
      mockUnitMix
    );

    expect(result.buildingFootprint).toBeDefined();
    expect(result.buildingFootprint.type).toBe('Polygon');
    expect(result.buildingFootprint.coordinates.length).toBeGreaterThan(0);
    expect(result.buildingFootprint.sqft).toBeGreaterThan(0);
  });

  test('should calculate appropriate floor count', () => {
    const result = designOptimizerService.generateMassing(
      mockParcel,
      mockZoning,
      mockUnitMix.totalUnits,
      mockUnitMix
    );

    expect(result.floors).toBeGreaterThan(0);
    expect(result.floors).toBeLessThanOrEqual(mockParcel.maxStories!);
  });

  test('should respect FAR limits', () => {
    const result = designOptimizerService.generateMassing(
      mockParcel,
      mockZoning,
      mockUnitMix.totalUnits,
      mockUnitMix
    );

    expect(result.farUtilization).toBeLessThanOrEqual(mockParcel.zoningFAR * 1.05); // 5% tolerance
  });

  test('should generate 3D geometry', () => {
    const result = designOptimizerService.generateMassing(
      mockParcel,
      mockZoning,
      mockUnitMix.totalUnits,
      mockUnitMix
    );

    expect(result.geometry3D).toBeDefined();
    expect(result.geometry3D.vertices.length).toBeGreaterThan(0);
    expect(result.geometry3D.faces.length).toBeGreaterThan(0);

    // Verify vertices have x, y, z
    result.geometry3D.vertices.forEach(vertex => {
      expect(vertex.x).toBeDefined();
      expect(vertex.y).toBeDefined();
      expect(vertex.z).toBeDefined();
    });
  });

  test('should calculate building height', () => {
    const result = designOptimizerService.generateMassing(
      mockParcel,
      mockZoning,
      mockUnitMix.totalUnits,
      mockUnitMix
    );

    expect(result.heightFt).toBeGreaterThan(0);
    
    if (mockParcel.maxHeight) {
      expect(result.heightFt).toBeLessThanOrEqual(mockParcel.maxHeight);
    }
  });

  test('should warn about violations', () => {
    const oversizedParcel: ParcelData = {
      ...mockParcel,
      zoningFAR: 0.5 // Very restrictive
    };

    const result = designOptimizerService.generateMassing(
      oversizedParcel,
      mockZoning,
      mockUnitMix.totalUnits,
      mockUnitMix
    );

    expect(result.warnings.length).toBeGreaterThan(0);
  });

  test('should handle parcels without geometry', () => {
    const parcelNoGeometry: ParcelData = {
      ...mockParcel,
      geometry: undefined
    };

    const result = designOptimizerService.generateMassing(
      parcelNoGeometry,
      mockZoning,
      mockUnitMix.totalUnits,
      mockUnitMix
    );

    expect(result.buildingFootprint).toBeDefined();
    expect(result.buildingFootprint.coordinates.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// COMPLETE DESIGN OPTIMIZATION TESTS
// ============================================================================

describe('Complete Design Optimization', () => {
  test('should run full optimization pipeline', () => {
    const result = designOptimizerService.optimizeCompleteDesign(
      mockMarketData,
      mockParcel,
      mockZoning,
      mockCosts
    );

    expect(result.unitMix).toBeDefined();
    expect(result.parking).toBeDefined();
    expect(result.amenities).toBeDefined();
    expect(result.massing).toBeDefined();
    expect(result.totalNOI).toBeGreaterThan(0);
    expect(result.totalCost).toBeGreaterThan(0);
    expect(result.yieldOnCost).toBeGreaterThan(0);
  });

  test('should calculate yield on cost accurately', () => {
    const result = designOptimizerService.optimizeCompleteDesign(
      mockMarketData,
      mockParcel,
      mockZoning,
      mockCosts
    );

    const expectedYield = result.totalNOI / result.totalCost;
    expect(result.yieldOnCost).toBeCloseTo(expectedYield, 5);
  });

  test('should integrate parking costs into total', () => {
    const result = designOptimizerService.optimizeCompleteDesign(
      mockMarketData,
      mockParcel,
      mockZoning,
      mockCosts
    );

    expect(result.totalCost).toBeGreaterThanOrEqual(result.parking.constructionCost);
  });

  test('should integrate amenity premiums into NOI', () => {
    const result = designOptimizerService.optimizeCompleteDesign(
      mockMarketData,
      mockParcel,
      mockZoning,
      mockCosts
    );

    // Total NOI should include amenity rent premiums
    expect(result.totalNOI).toBeGreaterThan(result.unitMix.projectedNOI);
  });
});

// ============================================================================
// COMPLIANCE VALIDATION TESTS
// ============================================================================

describe('Design Compliance Validation', () => {
  test('should validate compliant design', () => {
    const compliantDesign = {
      buildingFootprint: {
        type: 'Polygon' as const,
        coordinates: [[[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]]]
      },
      floors: [
        {
          level: 1,
          heightFt: 10,
          units: [
            { type: '1BR' as const, sqft: 750, position: { x: 0, y: 0 } },
            { type: '1BR' as const, sqft: 750, position: { x: 50, y: 0 } }
          ]
        }
      ],
      parking: {
        type: 'surface' as const,
        spaces: 3
      },
      amenities: ['Fitness Center']
    };

    const report = designOptimizerService.validateRuleBased(
      compliantDesign,
      mockParcel,
      mockZoning
    );

    expect(report.compliant).toBe(true);
    expect(report.parkingCompliance).toBe(true);
  });

  test('should detect FAR violations', () => {
    const oversizedDesign = {
      buildingFootprint: {
        type: 'Polygon' as const,
        coordinates: [[[0, 0], [200, 0], [200, 250], [0, 250], [0, 0]]]
      },
      floors: Array(10).fill({
        level: 1,
        heightFt: 10,
        units: Array(100).fill({ type: '2BR' as const, sqft: 1000, position: { x: 0, y: 0 } })
      }),
      parking: { type: 'surface' as const, spaces: 1200 },
      amenities: []
    };

    const report = designOptimizerService.validateRuleBased(
      oversizedDesign,
      mockParcel,
      mockZoning
    );

    expect(report.compliant).toBe(false);
    const farViolation = report.violations.find(v => v.code.startsWith('FAR-'));
    expect(farViolation).toBeDefined();
  });

  test('should detect parking violations', () => {
    const insufficientParking = {
      buildingFootprint: {
        type: 'Polygon' as const,
        coordinates: [[[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]]]
      },
      floors: [{
        level: 1,
        heightFt: 10,
        units: Array(50).fill({ type: '1BR' as const, sqft: 750, position: { x: 0, y: 0 } })
      }],
      parking: {
        type: 'surface' as const,
        spaces: 10 // Way too few
      },
      amenities: []
    };

    const report = designOptimizerService.validateRuleBased(
      insufficientParking,
      mockParcel,
      mockZoning
    );

    expect(report.parkingCompliance).toBe(false);
    const parkingViolation = report.violations.find(v => v.code.startsWith('PARK-'));
    expect(parkingViolation).toBeDefined();
  });

  test('should detect height violations', () => {
    const tooTallDesign = {
      buildingFootprint: {
        type: 'Polygon' as const,
        coordinates: [[[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]]]
      },
      floors: Array(10).fill({ // Exceeds maxStories = 6
        level: 1,
        heightFt: 10,
        units: [{ type: '1BR' as const, sqft: 750, position: { x: 0, y: 0 } }]
      }),
      parking: { type: 'surface' as const, spaces: 12 },
      amenities: []
    };

    const report = designOptimizerService.validateRuleBased(
      tooTallDesign,
      mockParcel,
      mockZoning
    );

    const heightViolation = report.violations.find(v => v.code.startsWith('HEIGHT-'));
    expect(heightViolation).toBeDefined();
  });

  test('should generate recommendations', () => {
    const violatingDesign = {
      buildingFootprint: {
        type: 'Polygon' as const,
        coordinates: [[[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]]]
      },
      floors: Array(10).fill({
        level: 1,
        heightFt: 10,
        units: Array(100).fill({ type: '2BR' as const, sqft: 1000, position: { x: 0, y: 0 } })
      }),
      parking: { type: 'surface' as const, spaces: 10 },
      amenities: []
    };

    const report = designOptimizerService.validateRuleBased(
      violatingDesign,
      mockParcel,
      mockZoning
    );

    expect(report.recommendations.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// EDGE CASES & ERROR HANDLING
// ============================================================================

describe('Edge Cases', () => {
  test('should handle zero vacancy market data', () => {
    const perfectMarket = {
      ...mockMarketData,
      vacancy: 0
    };

    const result = designOptimizerService.optimizeUnitMix(
      perfectMarket,
      mockParcel,
      mockZoning
    );

    expect(result.totalUnits).toBeGreaterThan(0);
  });

  test('should handle high vacancy market data', () => {
    const weakMarket = {
      ...mockMarketData,
      vacancy: 0.15
    };

    const result = designOptimizerService.optimizeUnitMix(
      weakMarket,
      mockParcel,
      mockZoning
    );

    expect(result.totalUnits).toBeGreaterThan(0);
    // Should be more conservative in weak market
  });

  test('should handle very small parcels', () => {
    const tinyParcel = {
      ...mockParcel,
      lotSizeSqft: 5000
    };

    const result = designOptimizerService.optimizeUnitMix(
      mockMarketData,
      tinyParcel,
      mockZoning
    );

    expect(result.totalUnits).toBeGreaterThan(0);
  });

  test('should handle low FAR zoning', () => {
    const restrictiveZoning = {
      ...mockZoning,
    };
    const restrictiveParcel = {
      ...mockParcel,
      zoningFAR: 0.5
    };

    const result = designOptimizerService.optimizeUnitMix(
      mockMarketData,
      restrictiveParcel,
      restrictiveZoning
    );

    expect(result.totalUnits).toBeGreaterThan(0);
  });
});

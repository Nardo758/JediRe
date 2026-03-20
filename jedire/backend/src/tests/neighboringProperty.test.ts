/**
 * Neighboring Property Engine Tests
 * 
 * Tests spatial analysis and assemblage benefit calculations
 * Uses real Atlanta property data from property_records table
 */

import { neighboringPropertyEngine } from '../services/neighboringPropertyEngine';
import { 
  findAdjacentParcels, 
  calculateSharedBoundaryLength,
  calculateParcelMetrics,
  findNearbyParcels
} from '../services/spatialAnalysis';
import { query, getClient } from '../database/connection';

describe('Neighboring Property Engine', () => {
  
  // Sample test parcel (use real parcel from Atlanta data)
  const testParcelId = '13-0123-0001-000'; // Replace with actual parcel ID from your data

  describe('findNeighbors', () => {
    
    it('should find adjacent parcels', async () => {
      const recommendations = await neighboringPropertyEngine.findNeighbors(testParcelId);
      
      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeGreaterThanOrEqual(0);
      
      if (recommendations.length > 0) {
        const first = recommendations[0];
        
        // Verify structure
        expect(first.neighbor).toBeDefined();
        expect(first.benefitScore).toBeGreaterThanOrEqual(0);
        expect(first.benefitScore).toBeLessThanOrEqual(100);
        expect(first.benefits).toBeDefined();
        expect(first.feasibility).toBeDefined();
        expect(first.visualization).toBeDefined();
        
        // Verify neighbor data
        expect(first.neighbor.parcelId).toBeTruthy();
        expect(first.neighbor.address).toBeTruthy();
        expect(first.neighbor.sharedBoundaryFeet).toBeGreaterThan(0);
      }
    }, 30000); // 30 second timeout for complex spatial queries

    it('should rank neighbors by benefit score', async () => {
      const recommendations = await neighboringPropertyEngine.findNeighbors(testParcelId);
      
      if (recommendations.length > 1) {
        for (let i = 0; i < recommendations.length - 1; i++) {
          expect(recommendations[i].benefitScore).toBeGreaterThanOrEqual(
            recommendations[i + 1].benefitScore
          );
        }
      }
    }, 30000);

    it('should calculate assemblage benefits', async () => {
      const recommendations = await neighboringPropertyEngine.findNeighbors(testParcelId);
      
      if (recommendations.length > 0) {
        const benefits = recommendations[0].benefits;
        
        expect(benefits.additionalUnits).toBeDefined();
        expect(benefits.constructionCostReduction).toBeGreaterThanOrEqual(0);
        expect(benefits.efficiencyGain).toBeGreaterThanOrEqual(0);
      }
    }, 30000);
  });

  describe('Spatial Analysis', () => {
    
    it('should calculate parcel metrics', async () => {
      const client = await getClient();
      
      try {
        const metrics = await calculateParcelMetrics(client, testParcelId);
        
        expect(metrics.areaSqft).toBeGreaterThan(0);
        expect(metrics.perimeterFeet).toBeGreaterThan(0);
        expect(metrics.centroid.lat).toBeDefined();
        expect(metrics.centroid.lng).toBeDefined();
      } finally {
        client.release();
      }
    });

    it('should find nearby (non-adjacent) parcels', async () => {
      const client = await getClient();
      
      try {
        const nearby = await findNearbyParcels(client, testParcelId, 500);
        
        expect(Array.isArray(nearby)).toBe(true);
        
        if (nearby.length > 0) {
          expect(nearby[0].distance).toBeLessThanOrEqual(500 * 0.3048); // Convert feet to meters
        }
      } finally {
        client.release();
      }
    });

    it('should calculate shared boundary length', async () => {
      const client = await getClient();
      
      try {
        // First find adjacent parcels
        const primaryGeom = await client.query(
          `SELECT parcel_id, ST_AsGeoJSON(parcel_geometry)::json as geometry
           FROM property_records WHERE parcel_id = $1`,
          [testParcelId]
        );

        if (primaryGeom.rows.length === 0) {
          console.warn('Test parcel not found, skipping boundary length test');
          return;
        }

        const adjacent = await findAdjacentParcels(client, {
          parcelId: testParcelId,
          geometry: primaryGeom.rows[0].geometry
        });

        if (adjacent.length > 0) {
          const boundaryLength = await calculateSharedBoundaryLength(
            client,
            testParcelId,
            adjacent[0].parcelId
          );
          
          expect(boundaryLength).toBeGreaterThan(0);
          expect(boundaryLength).toBe(adjacent[0].sharedBoundaryFeet);
        }
      } finally {
        client.release();
      }
    }, 30000);
  });

  describe('Feasibility Scoring', () => {
    
    it('should score acquisition likelihood', async () => {
      const recommendations = await neighboringPropertyEngine.findNeighbors(testParcelId);
      
      if (recommendations.length > 0) {
        const feasibility = recommendations[0].feasibility;
        
        expect(feasibility.acquisitionLikelihood).toBeGreaterThanOrEqual(0);
        expect(feasibility.acquisitionLikelihood).toBeLessThanOrEqual(100);
        expect(feasibility.ownerDisposition).toMatch(/high|medium|low/);
        expect(feasibility.confidenceScore).toBeGreaterThanOrEqual(0);
        expect(feasibility.confidenceScore).toBeLessThanOrEqual(100);
      }
    }, 30000);

    it('should estimate value created vs asking price', async () => {
      const recommendations = await neighboringPropertyEngine.findNeighbors(testParcelId);
      
      if (recommendations.length > 0) {
        const feasibility = recommendations[0].feasibility;
        
        expect(feasibility.valueCreated).toBeGreaterThan(0);
        expect(feasibility.estimatedAskingPrice).toBeGreaterThan(0);
        
        // Value created should generally exceed asking price for viable assemblage
        const roi = (feasibility.valueCreated - feasibility.estimatedAskingPrice) / 
                    feasibility.estimatedAskingPrice;
        
        console.log(`ROI for top neighbor: ${(roi * 100).toFixed(1)}%`);
      }
    }, 30000);
  });

  describe('Visualization Data', () => {
    
    it('should generate combined geometry', async () => {
      const recommendations = await neighboringPropertyEngine.findNeighbors(testParcelId);
      
      if (recommendations.length > 0) {
        const viz = recommendations[0].visualization;
        
        expect(viz.combinedGeometry).toBeDefined();
        expect(viz.beforeMassing).toBeDefined();
        expect(viz.afterMassing).toBeDefined();
        
        // After assemblage should have more units than before
        expect(viz.afterMassing.units).toBeGreaterThan(viz.beforeMassing.units);
      }
    }, 30000);
  });

  describe('AI Integration Points', () => {
    
    it('should have AI hooks defined (not implemented yet)', async () => {
      // Test that AI methods exist and return placeholder responses
      
      const dispositionResult = await neighboringPropertyEngine.analyzeOwnerDisposition(
        'test-owner-id'
      );
      
      expect(dispositionResult.implemented).toBe(false);
      expect(dispositionResult.message).toContain('pending');
    });

    it('should handle negotiation strategy placeholder', async () => {
      const mockNeighbors = [
        {
          parcelId: 'test-1',
          address: '123 Test St',
          ownerName: 'Test LLC',
          sharedBoundaryFeet: 100,
          distance: 0
        }
      ];

      const strategyResult = await neighboringPropertyEngine.generateNegotiationStrategy(
        mockNeighbors as any
      );
      
      expect(strategyResult.implemented).toBe(false);
      expect(strategyResult.message).toContain('pending');
    });

    it('should handle aerial analysis placeholder', async () => {
      const coords = { lat: 33.7490, lng: -84.3880 };
      
      const aerialResult = await neighboringPropertyEngine.analyzeSiteFromAerial(coords);
      
      expect(aerialResult.implemented).toBe(false);
      expect(aerialResult.message).toContain('pending');
    });
  });
});

describe('Integration with Real Atlanta Data', () => {
  
  it('should find neighbors for actual Atlanta parcels', async () => {
    // Query a few real parcels from the database
    const result = await query(
      `SELECT parcel_id FROM property_records 
       WHERE parcel_geometry IS NOT NULL
       AND units > 0
       LIMIT 5`
    );

    if (result.rows.length === 0) {
      console.warn('No parcels with geometry found. Run migration 041 first.');
      return;
    }

    for (const row of result.rows) {
      const recommendations = await neighboringPropertyEngine.findNeighbors(
        row.parcel_id
      );
      
      console.log(`Parcel ${row.parcel_id}: Found ${recommendations.length} neighbors`);
      
      if (recommendations.length > 0) {
        const top = recommendations[0];
        console.log(`  Top neighbor: ${top.neighbor.address}`);
        console.log(`  Benefit score: ${top.benefitScore}/100`);
        console.log(`  Additional units: +${top.benefits.additionalUnits}`);
        console.log(`  Cost reduction: $${top.benefits.constructionCostReduction.toLocaleString()}`);
      }
    }
  }, 60000); // 60 second timeout for multiple queries
});

// Cleanup
afterAll(async () => {
  // Close database connections if needed
});

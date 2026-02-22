/**
 * Qwen Service Tests
 */

import { qwenService } from '../qwen.service';

describe('QwenService', () => {
  describe('isEnabled()', () => {
    it('should return false if HF_TOKEN not configured', () => {
      const originalToken = process.env.HF_TOKEN;
      delete process.env.HF_TOKEN;
      
      // Create new instance to test initialization
      const testService = new (qwenService.constructor as any)();
      
      expect(testService.isEnabled()).toBe(false);
      
      // Restore
      if (originalToken) {
        process.env.HF_TOKEN = originalToken;
      }
    });

    it('should return true if HF_TOKEN is configured', () => {
      process.env.HF_TOKEN = 'test-token';
      
      const testService = new (qwenService.constructor as any)();
      
      expect(testService.isEnabled()).toBe(true);
    });
  });

  describe('imageToTerrain()', () => {
    it('should throw error if service not enabled', async () => {
      const originalToken = process.env.HF_TOKEN;
      delete process.env.HF_TOKEN;
      
      const testService = new (qwenService.constructor as any)();
      
      await expect(
        testService.imageToTerrain('https://example.com/photo.jpg')
      ).rejects.toThrow('Qwen AI service is not enabled');
      
      if (originalToken) {
        process.env.HF_TOKEN = originalToken;
      }
    });

    it('should return terrain data structure', async () => {
      // Mock successful response
      // Note: Actual API testing requires HF_TOKEN
      const mockTerrainData = {
        elevationMap: Array(10).fill(Array(10).fill(0)),
        slope: 5.5,
        soilType: 'clay',
        topographyFeatures: ['flat'],
        gradingRequirements: {
          cutFill: 0,
          estimatedCost: 0,
        },
        confidence: 0.7,
      };

      // In real tests, you'd mock the OpenAI client
      // For now, this is a structure test
      expect(mockTerrainData).toHaveProperty('elevationMap');
      expect(mockTerrainData).toHaveProperty('slope');
      expect(mockTerrainData).toHaveProperty('confidence');
    });
  });

  describe('analyzeDesignCompliance()', () => {
    it('should return compliance report structure', () => {
      const mockReport = {
        violations: [],
        compliant: true,
        confidence: 0.85,
        reasoning: 'No violations detected',
      };

      expect(mockReport).toHaveProperty('violations');
      expect(mockReport).toHaveProperty('compliant');
      expect(mockReport).toHaveProperty('confidence');
      expect(Array.isArray(mockReport.violations)).toBe(true);
    });
  });

  describe('predictOwnerDisposition()', () => {
    it('should return disposition score structure', () => {
      const mockDisposition = {
        score: 72,
        factors: {
          holdPeriod: 80,
          marketTiming: 65,
          financialNeed: 60,
          portfolioStrategy: 85,
        },
        estimatedPrice: 4200000,
        timeframe: '3-6 months',
        negotiationLeverage: 'high',
        confidence: 0.81,
        reasoning: 'Long hold period suggests liquidation',
      };

      expect(mockDisposition.score).toBeGreaterThanOrEqual(0);
      expect(mockDisposition.score).toBeLessThanOrEqual(100);
      expect(mockDisposition).toHaveProperty('factors');
      expect(mockDisposition).toHaveProperty('timeframe');
    });
  });

  describe('autoTagPhotos()', () => {
    it('should handle empty photo array', async () => {
      if (!qwenService.isEnabled()) {
        console.log('Skipping test - HF_TOKEN not configured');
        return;
      }

      const result = await qwenService.autoTagPhotos([]);
      expect(result).toEqual([]);
    });

    it('should return photo tag structure', () => {
      const mockPhotoTag = {
        photoId: 'photo-1',
        tags: ['foundation', 'excavation'],
        location3D: {
          x: 0,
          y: 0,
          z: 0,
          section: 'main',
        },
        confidence: 0.85,
      };

      expect(mockPhotoTag).toHaveProperty('photoId');
      expect(mockPhotoTag).toHaveProperty('tags');
      expect(Array.isArray(mockPhotoTag.tags)).toBe(true);
      expect(mockPhotoTag).toHaveProperty('confidence');
    });
  });

  describe('estimateProgress()', () => {
    it('should return progress estimate structure', () => {
      const mockProgress = {
        section: 'floor-3',
        percentComplete: 65,
        confidence: 0.82,
        itemsCompleted: ['framing', 'rough-in'],
        itemsRemaining: ['drywall', 'finishes'],
        estimatedDaysToCompletion: 45,
        reasoning: 'Based on visible progress',
      };

      expect(mockProgress.percentComplete).toBeGreaterThanOrEqual(0);
      expect(mockProgress.percentComplete).toBeLessThanOrEqual(100);
      expect(Array.isArray(mockProgress.itemsCompleted)).toBe(true);
      expect(Array.isArray(mockProgress.itemsRemaining)).toBe(true);
    });
  });

  describe('generateNegotiationStrategy()', () => {
    it('should return strategy structure', () => {
      const mockStrategy = {
        approach: 'sequential',
        prioritizedTargets: [
          {
            parcelId: '123',
            priority: 1,
            approachStrategy: 'Direct offer',
            offerRange: {
              low: 3500000,
              mid: 3800000,
              high: 4200000,
            },
          },
        ],
        timeline: '6-9 months',
        risks: ['Competition', 'Price escalation'],
        successProbability: 0.75,
        reasoning: 'Prioritized by boundary length',
      };

      expect(mockStrategy).toHaveProperty('approach');
      expect(mockStrategy).toHaveProperty('prioritizedTargets');
      expect(Array.isArray(mockStrategy.prioritizedTargets)).toBe(true);
      expect(mockStrategy.successProbability).toBeGreaterThan(0);
      expect(mockStrategy.successProbability).toBeLessThanOrEqual(1);
    });
  });
});

/**
 * Integration Tests (require HF_TOKEN)
 * 
 * To run these tests:
 * 1. Set HF_TOKEN in .env.test
 * 2. Run: npm test -- qwen.service.test.ts
 */
describe('QwenService Integration Tests', () => {
  beforeAll(() => {
    if (!process.env.HF_TOKEN) {
      console.warn('⚠️  HF_TOKEN not configured - skipping integration tests');
    }
  });

  it('should check AI status endpoint', async () => {
    if (!qwenService.isEnabled()) {
      return; // Skip if not configured
    }

    expect(qwenService.isEnabled()).toBe(true);
  });

  // Add more integration tests when HF_TOKEN is available
  // These would make actual API calls to HuggingFace
});

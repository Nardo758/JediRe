/**
 * Qwen API Routes Tests
 */

import request from 'supertest';
import express, { Application } from 'express';
import qwenRoutes from '../qwen.routes';

// Mock the qwenService
jest.mock('../../../services/qwen.service', () => ({
  qwenService: {
    isEnabled: jest.fn(() => true),
    imageToTerrain: jest.fn(),
    analyzeDesignCompliance: jest.fn(),
    analyzeSiteFromAerial: jest.fn(),
    predictOwnerDisposition: jest.fn(),
    autoTagPhotos: jest.fn(),
    estimateProgress: jest.fn(),
    generateNegotiationStrategy: jest.fn(),
  },
}));

import { qwenService } from '../../../services/qwen.service';

describe('Qwen API Routes', () => {
  let app: Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/ai', qwenRoutes);
    
    // Reset mocks
    jest.clearAllMocks();
  });

  describe('GET /status', () => {
    it('should return AI service status when enabled', async () => {
      (qwenService.isEnabled as jest.Mock).mockReturnValue(true);

      const response = await request(app)
        .get('/api/v1/ai/status')
        .expect(200);

      expect(response.body).toHaveProperty('enabled', true);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('model');
    });

    it('should return disabled status when HF_TOKEN not configured', async () => {
      (qwenService.isEnabled as jest.Mock).mockReturnValue(false);

      const response = await request(app)
        .get('/api/v1/ai/status')
        .expect(200);

      expect(response.body.enabled).toBe(false);
    });
  });

  describe('POST /image-to-terrain', () => {
    it('should return 503 when AI service not available', async () => {
      (qwenService.isEnabled as jest.Mock).mockReturnValue(false);

      const response = await request(app)
        .post('/api/v1/ai/image-to-terrain')
        .send({ imageUrl: 'https://example.com/photo.jpg' })
        .expect(503);

      expect(response.body).toHaveProperty('error', 'AI service not available');
    });

    it('should return 400 when no image provided', async () => {
      (qwenService.isEnabled as jest.Mock).mockReturnValue(true);

      const response = await request(app)
        .post('/api/v1/ai/image-to-terrain')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should return terrain data on success', async () => {
      (qwenService.isEnabled as jest.Mock).mockReturnValue(true);
      (qwenService.imageToTerrain as jest.Mock).mockResolvedValue({
        elevationMap: Array(10).fill(Array(10).fill(0)),
        slope: 5.5,
        soilType: 'clay',
        topographyFeatures: ['flat'],
        gradingRequirements: { cutFill: 0, estimatedCost: 0 },
        confidence: 0.8,
      });

      const response = await request(app)
        .post('/api/v1/ai/image-to-terrain')
        .send({ imageUrl: 'https://example.com/photo.jpg' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('elevationMap');
      expect(response.body.data).toHaveProperty('confidence');
    });
  });

  describe('POST /analyze-compliance', () => {
    it('should return 400 when design3D missing', async () => {
      (qwenService.isEnabled as jest.Mock).mockReturnValue(true);

      const response = await request(app)
        .post('/api/v1/ai/analyze-compliance')
        .send({ renderUrl: 'https://example.com/render.png' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should return compliance report on success', async () => {
      (qwenService.isEnabled as jest.Mock).mockReturnValue(true);
      (qwenService.analyzeDesignCompliance as jest.Mock).mockResolvedValue({
        violations: [],
        compliant: true,
        confidence: 0.87,
        reasoning: 'No violations detected',
      });

      const response = await request(app)
        .post('/api/v1/ai/analyze-compliance')
        .send({
          design3D: { totalUnits: 287, stories: 8 },
          renderUrl: 'https://example.com/render.png',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('compliant');
    });
  });

  describe('POST /analyze-aerial', () => {
    it('should return 400 when coords missing', async () => {
      (qwenService.isEnabled as jest.Mock).mockReturnValue(true);

      const response = await request(app)
        .post('/api/v1/ai/analyze-aerial')
        .send({ satelliteUrl: 'https://example.com/sat.jpg' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should return site context on success', async () => {
      (qwenService.isEnabled as jest.Mock).mockReturnValue(true);
      (qwenService.analyzeSiteFromAerial as jest.Mock).mockResolvedValue({
        adjacentParcels: [],
        infrastructure: { utilities: [], access: [] },
        marketContext: { submarket: 'Test', competitiveProjects: 0 },
        confidence: 0.75,
      });

      const response = await request(app)
        .post('/api/v1/ai/analyze-aerial')
        .send({
          coords: { lat: 33.7490, lng: -84.3880 },
          satelliteUrl: 'https://example.com/sat.jpg',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('adjacentParcels');
    });
  });

  describe('POST /owner-disposition', () => {
    it('should return 400 when ownerProfile missing', async () => {
      (qwenService.isEnabled as jest.Mock).mockReturnValue(true);

      const response = await request(app)
        .post('/api/v1/ai/owner-disposition')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should return disposition score on success', async () => {
      (qwenService.isEnabled as jest.Mock).mockReturnValue(true);
      (qwenService.predictOwnerDisposition as jest.Mock).mockResolvedValue({
        score: 72,
        factors: { holdPeriod: 80, marketTiming: 65, financialNeed: 60, portfolioStrategy: 85 },
        estimatedPrice: 4200000,
        timeframe: '3-6 months',
        negotiationLeverage: 'high',
        confidence: 0.81,
        reasoning: 'Test reasoning',
      });

      const response = await request(app)
        .post('/api/v1/ai/owner-disposition')
        .send({
          ownerProfile: {
            id: 'owner-123',
            name: 'Test Owner',
            properties: 5,
            avgHoldPeriod: 10,
            acquisitionHistory: [],
          },
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('score');
    });
  });

  describe('POST /auto-tag-photos', () => {
    it('should return 400 when no photos provided', async () => {
      (qwenService.isEnabled as jest.Mock).mockReturnValue(true);

      const response = await request(app)
        .post('/api/v1/ai/auto-tag-photos')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should return photo tags on success', async () => {
      (qwenService.isEnabled as jest.Mock).mockReturnValue(true);
      (qwenService.autoTagPhotos as jest.Mock).mockResolvedValue([
        {
          photoId: 'photo-1',
          tags: ['foundation', 'excavation'],
          confidence: 0.85,
        },
      ]);

      const response = await request(app)
        .post('/api/v1/ai/auto-tag-photos')
        .send({
          photos: [
            { id: 'photo-1', url: 'https://example.com/photo.jpg', uploadedAt: new Date().toISOString() },
          ],
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('POST /estimate-progress', () => {
    it('should return 400 when no photos provided', async () => {
      (qwenService.isEnabled as jest.Mock).mockReturnValue(true);

      const response = await request(app)
        .post('/api/v1/ai/estimate-progress')
        .send({ section: 'floor-3' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should return progress estimate on success', async () => {
      (qwenService.isEnabled as jest.Mock).mockReturnValue(true);
      (qwenService.estimateProgress as jest.Mock).mockResolvedValue({
        section: 'floor-3',
        percentComplete: 65,
        confidence: 0.82,
        itemsCompleted: ['framing', 'rough-in'],
        itemsRemaining: ['drywall', 'finishes'],
        estimatedDaysToCompletion: 45,
        reasoning: 'Test reasoning',
      });

      const response = await request(app)
        .post('/api/v1/ai/estimate-progress')
        .send({
          photos: [
            { id: 'photo-1', url: 'https://example.com/photo.jpg', uploadedAt: new Date().toISOString() },
          ],
          section: 'floor-3',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('percentComplete');
    });
  });

  describe('POST /negotiation-strategy', () => {
    it('should return 400 when neighbors array missing', async () => {
      (qwenService.isEnabled as jest.Mock).mockReturnValue(true);

      const response = await request(app)
        .post('/api/v1/ai/negotiation-strategy')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should return strategy on success', async () => {
      (qwenService.isEnabled as jest.Mock).mockReturnValue(true);
      (qwenService.generateNegotiationStrategy as jest.Mock).mockResolvedValue({
        approach: 'sequential',
        prioritizedTargets: [],
        timeline: '6-9 months',
        risks: [],
        successProbability: 0.75,
        reasoning: 'Test reasoning',
      });

      const response = await request(app)
        .post('/api/v1/ai/negotiation-strategy')
        .send({
          neighbors: [
            {
              parcelId: '123',
              address: '127 Main St',
              ownerName: 'Test Owner',
              assessedValue: 3800000,
              distance: 0,
            },
          ],
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('approach');
    });
  });
});

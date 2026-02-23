/**
 * Competition Analysis Routes Tests
 */

import request from 'supertest';
import { app } from '../../../index';

describe('Competition Analysis API', () => {
  const testDealId = 'test-deal-123';
  const authToken = 'test-auth-token'; // Replace with actual test token

  describe('GET /api/v1/deals/:dealId/competitors', () => {
    it('should return competitors with default filters', async () => {
      const response = await request(app)
        .get(`/api/v1/deals/${testDealId}/competitors`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.competitors).toBeDefined();
      expect(Array.isArray(response.body.competitors)).toBe(true);
    });

    it('should apply distance filter', async () => {
      const response = await request(app)
        .get(`/api/v1/deals/${testDealId}/competitors`)
        .query({ distanceRadius: 0.5 })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      // All competitors should be within 0.5 miles
      response.body.competitors.forEach((comp: any) => {
        expect(parseFloat(comp.distance)).toBeLessThanOrEqual(0.5);
      });
    });

    it('should filter by same vintage', async () => {
      const response = await request(app)
        .get(`/api/v1/deals/${testDealId}/competitors`)
        .query({ sameVintage: true })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/v1/deals/:dealId/advantage-matrix', () => {
    it('should return advantage matrix', async () => {
      const response = await request(app)
        .get(`/api/v1/deals/${testDealId}/advantage-matrix`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.matrix).toBeDefined();
      expect(response.body.matrix.overallScore).toBeDefined();
      expect(response.body.matrix.features).toBeDefined();
      expect(Array.isArray(response.body.matrix.features)).toBe(true);
    });

    it('should calculate advantage points correctly', async () => {
      const response = await request(app)
        .get(`/api/v1/deals/${testDealId}/advantage-matrix`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const matrix = response.body.matrix;
      const totalPoints = matrix.features.reduce(
        (sum: number, feature: any) => sum + feature.advantagePoints,
        0
      );

      expect(totalPoints).toBe(matrix.overallScore);
    });
  });

  describe('GET /api/v1/deals/:dealId/waitlist-properties', () => {
    it('should return waitlist properties', async () => {
      const response = await request(app)
        .get(`/api/v1/deals/${testDealId}/waitlist-properties`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.properties).toBeDefined();
      expect(Array.isArray(response.body.properties)).toBe(true);

      // Each property should have waitlist data
      response.body.properties.forEach((prop: any) => {
        expect(prop.waitlistCount).toBeDefined();
        expect(prop.occupancy).toBeGreaterThan(90); // High occupancy
      });
    });
  });

  describe('GET /api/v1/deals/:dealId/aging-competitors', () => {
    it('should return aging competitors', async () => {
      const response = await request(app)
        .get(`/api/v1/deals/${testDealId}/aging-competitors`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.competitors).toBeDefined();

      // All should be 15+ years old
      const currentYear = new Date().getFullYear();
      response.body.competitors.forEach((comp: any) => {
        const age = currentYear - parseInt(comp.yearBuilt);
        expect(age).toBeGreaterThanOrEqual(15);
      });
    });

    it('should calculate potential premium', async () => {
      const response = await request(app)
        .get(`/api/v1/deals/${testDealId}/aging-competitors`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      response.body.competitors.forEach((comp: any) => {
        expect(comp.potentialPremium).toBeDefined();
        expect(comp.potentialPremium).toBeGreaterThan(0);
      });
    });
  });

  describe('GET /api/v1/deals/:dealId/competition-insights', () => {
    it('should return AI insights', async () => {
      const response = await request(app)
        .get(`/api/v1/deals/${testDealId}/competition-insights`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.insights).toBeDefined();
      expect(typeof response.body.insights).toBe('string');
      expect(response.body.insights.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/v1/deals/:dealId/competition-export', () => {
    it('should export CSV', async () => {
      const response = await request(app)
        .get(`/api/v1/deals/${testDealId}/competition-export`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect('Content-Type', /csv/);

      expect(response.text).toContain('Property');
      expect(response.text).toContain('Units');
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent deal', async () => {
      const response = await request(app)
        .get('/api/v1/deals/non-existent-deal/competitors')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBeFalsy();
    });

    it('should require authentication', async () => {
      await request(app)
        .get(`/api/v1/deals/${testDealId}/competitors`)
        .expect(401);
    });
  });
});

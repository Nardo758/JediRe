/**
 * Competition Analysis Routes Tests
 *
 * The original suite required a fully-booted express app, JWT-issuing auth, and
 * a seeded `test-deal-123` row. None of that is available in a unit-test run,
 * so we instead mount the router on a minimal express app and mock the two
 * boundaries the handlers touch:
 *   - `requireAuth` (so we can test both authed and unauthed paths)
 *   - `getClient` from the database connection (so we control SQL responses)
 *
 * That covers request shape, auth gating, and the 404/400 branches of the deal
 * lookup — the parts of the routes that don't require real Postgres data.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';

vi.mock('../../../middleware/auth', () => {
  return {
    requireAuth: vi.fn((req: any, _res: any, next: any) => {
      req.user = { userId: 'test-user', email: 't@example.com', role: 'analyst' };
      next();
    }),
  };
});

vi.mock('../../../database/connection', () => ({
  getClient: vi.fn(),
}));

vi.mock('../../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import request from 'supertest';
import express, { type Application } from 'express';
import competitionRoutes from '../competition.routes';
import { requireAuth } from '../../../middleware/auth';
import { getClient } from '../../../database/connection';
import { errorHandler } from '../../../middleware/errorHandler';

interface MockClient {
  query: Mock;
  release: Mock;
}

function makeMockClient(queryImpl: Mock): MockClient {
  return {
    query: queryImpl,
    release: vi.fn(),
  };
}

function buildApp(): Application {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/deals', competitionRoutes);
  app.use(errorHandler);
  return app;
}

describe('Competition Analysis API', () => {
  const testDealId = 'test-deal-123';
  let app: Application;

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: authed
    (requireAuth as Mock).mockImplementation((req: any, _res: any, next: any) => {
      req.user = { userId: 'test-user', email: 't@example.com', role: 'analyst' };
      next();
    });
    app = buildApp();
  });

  describe('Auth gating', () => {
    it('should return 401 when requireAuth rejects the request', async () => {
      (requireAuth as Mock).mockImplementation((_req: any, res: any) => {
        res.status(401).json({ error: 'Unauthorized' });
      });

      const response = await request(app)
        .get(`/api/v1/deals/${testDealId}/competitors`)
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Unauthorized');
    });
  });

  describe('GET /:dealId/competitors', () => {
    it('should return 404 when the deal does not exist', async () => {
      const queryMock = vi.fn().mockResolvedValueOnce({ rows: [] });
      (getClient as Mock).mockResolvedValue(makeMockClient(queryMock));

      const response = await request(app)
        .get(`/api/v1/deals/${testDealId}/competitors`)
        .expect(404);

      expect(response.body.statusCode).toBe(404);
      expect(response.body.message).toMatch(/Deal not found/i);
    });

    it('should return 400 when the deal has no boundary polygon', async () => {
      const queryMock = vi.fn().mockResolvedValueOnce({
        rows: [{ latitude: null, longitude: null, units: 200, year_built: '2020', property_class: 'multifamily' }],
      });
      (getClient as Mock).mockResolvedValue(makeMockClient(queryMock));

      const response = await request(app)
        .get(`/api/v1/deals/${testDealId}/competitors`)
        .expect(400);

      expect(response.body.statusCode).toBe(400);
      expect(response.body.message).toMatch(/boundary polygon/i);
    });

    it('should return competitors when the deal exists', async () => {
      const queryMock = vi.fn()
        .mockResolvedValueOnce({
          rows: [{
            latitude: 33.749,
            longitude: -84.388,
            units: 200,
            year_built: '2020',
            property_class: 'multifamily',
          }],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'pr-1',
              name: '100 Main St',
              address: '100 Main St',
              units: 180,
              year_built: '2019',
              owner_name: 'Acme',
              appraised_value: 25000000,
              lat: 33.75,
              lng: -84.39,
              distance: 0.4,
            },
          ],
        });
      (getClient as Mock).mockResolvedValue(makeMockClient(queryMock));

      const response = await request(app)
        .get(`/api/v1/deals/${testDealId}/competitors`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.competitors)).toBe(true);
      expect(response.body.competitors).toHaveLength(1);
      expect(response.body.competitors[0]).toMatchObject({
        id: 'pr-1',
        units: 180,
        yearBuilt: '2019',
      });
      expect(response.body.totalFound).toBe(1);
    });

    it('should release the pg client even when the deal lookup fails', async () => {
      const release = vi.fn();
      const queryMock = vi.fn().mockResolvedValueOnce({ rows: [] });
      (getClient as Mock).mockResolvedValue({ query: queryMock, release });

      await request(app)
        .get(`/api/v1/deals/${testDealId}/competitors`)
        .expect(404);

      expect(release).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET /:dealId/advantage-matrix', () => {
    it('should return 404 when the deal does not exist', async () => {
      const queryMock = vi.fn().mockResolvedValueOnce({ rows: [] });
      (getClient as Mock).mockResolvedValue(makeMockClient(queryMock));

      const response = await request(app)
        .get(`/api/v1/deals/${testDealId}/advantage-matrix`)
        .expect(404);

      expect(response.body.statusCode).toBe(404);
      expect(response.body.message).toMatch(/Deal not found/i);
    });

    it('should return matrix where overallScore equals 5 + sum(advantagePoints)', async () => {
      const queryMock = vi.fn()
        .mockResolvedValueOnce({
          rows: [{
            latitude: 33.749,
            longitude: -84.388,
            units: 200,
            year_built: String(new Date().getFullYear()),
          }],
        })
        .mockResolvedValueOnce({ rows: [] });
      (getClient as Mock).mockResolvedValue(makeMockClient(queryMock));

      const response = await request(app)
        .get(`/api/v1/deals/${testDealId}/advantage-matrix`)
        .expect(200);

      expect(response.body.success).toBe(true);
      const matrix = response.body.matrix;
      expect(matrix).toBeDefined();
      expect(Array.isArray(matrix.features)).toBe(true);
      const totalPoints = matrix.features.reduce(
        (sum: number, f: any) => sum + f.advantagePoints,
        0,
      );
      expect(matrix.overallScore).toBe(Math.min(10, Math.max(1, 5 + totalPoints)));
    });
  });

  describe('GET /:dealId/aging-competitors', () => {
    it('should only return properties at least 15 years old with positive premium', async () => {
      const currentYear = new Date().getFullYear();
      const queryMock = vi.fn()
        .mockResolvedValueOnce({
          rows: [{ latitude: 33.749, longitude: -84.388 }],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'old-1',
              name: '900 Old Rd',
              address: '900 Old Rd',
              units: 120,
              year_built: String(currentYear - 22),
              appraised_value: 8000000,
              lat: 33.75,
              lng: -84.39,
              distance: 0.6,
            },
          ],
        });
      (getClient as Mock).mockResolvedValue(makeMockClient(queryMock));

      const response = await request(app)
        .get(`/api/v1/deals/${testDealId}/aging-competitors`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.competitors).toHaveLength(1);
      const comp = response.body.competitors[0];
      const age = currentYear - parseInt(comp.yearBuilt);
      expect(age).toBeGreaterThanOrEqual(15);
      expect(comp.potentialPremium).toBeGreaterThan(0);
    });
  });
});

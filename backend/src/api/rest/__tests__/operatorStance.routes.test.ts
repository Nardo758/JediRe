/**
 * OperatorStance REST Route Contract Tests
 *
 * Exercises the four stance endpoints via supertest with all service-layer
 * dependencies mocked. Validates HTTP status codes and response payload shapes
 * without requiring a real database.
 *
 *   GET  /:dealId/stance
 *   PUT  /:dealId/stance
 *   POST /:dealId/stance/reset
 *   GET  /:dealId/stance/affected-fields
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import request from 'supertest';
import express, { type Application, type Request, type Response, type NextFunction } from 'express';

// ── Mock all service dependencies before import ───────────────────────────────

vi.mock('../../../database/connection', () => ({
  getPool: vi.fn(() => ({ query: vi.fn() })),
  getDb: vi.fn(() => ({ query: vi.fn() })),
}));

vi.mock('../../../services/operatorStance.service', () => ({
  getStanceForDeal: vi.fn(),
  saveStance: vi.fn(),
  resetStance: vi.fn(),
  computeAffectedFields: vi.fn(),
  applyStanceToFinancials: vi.fn(() => []),
}));

// Mock requireAuth to inject a synthetic user (bypasses JWT validation)
vi.mock('../../../middleware/auth', () => ({
  requireAuth: (req: Request, _res: Response, next: NextFunction) => {
    (req as any).user = { userId: 'user-test-123', email: 'test@jedi.re' };
    next();
  },
}));

// Heavy route file — mock all collaborating services it imports
vi.mock('../../../services/proforma-adjustment.service', () => ({
  getDealFinancials: vi.fn(),
  applyFinancialsOverride: vi.fn(),
}));
vi.mock('../../../services/proforma-seeder.service', () => ({
  seedProFormaYear1: vi.fn(),
}));
vi.mock('../../../services/f9-financial-export.service', () => ({
  buildF9Workbook: vi.fn(),
  buildProjectionsForExport: vi.fn(),
}));
vi.mock('../../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import dealAssumptionsRouter from '../deal-assumptions.routes';
import {
  getStanceForDeal,
  saveStance,
  resetStance,
  computeAffectedFields,
} from '../../../services/operatorStance.service';

// ── Fixture helpers ───────────────────────────────────────────────────────────

const DEAL_ID = 'deal-abc-123';

function marketStanceFixture(overrides = {}) {
  return {
    underwritingPosture: 'MARKET' as const,
    rateEnvironment: 'NEUTRAL' as const,
    cyclePosition: 'MID_CYCLE' as const,
    expenseGrowthPosture: 'MARKET' as const,
    defaulted: true,
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function affectedFieldFixture(fieldPath: string, deltaBps: number, source: 'snapshot' | 'rules' = 'rules') {
  return { fieldPath, deltaBps, trace: `${fieldPath}:${deltaBps}bps`, source };
}

// ── Test setup ────────────────────────────────────────────────────────────────

describe('OperatorStance REST Routes', () => {
  let app: Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/deals', dealAssumptionsRouter);
    vi.clearAllMocks();
  });

  // ── GET /:dealId/stance ───────────────────────────────────────────────────

  describe('GET /:dealId/stance', () => {
    it('200 — returns stance object for authenticated user', async () => {
      (getStanceForDeal as Mock).mockResolvedValue(marketStanceFixture());

      const res = await request(app)
        .get(`/api/v1/deals/${DEAL_ID}/stance`)
        .expect(200);

      expect(res.body).toHaveProperty('stance');
      expect(res.body.stance).toHaveProperty('underwritingPosture', 'MARKET');
      expect(res.body.stance).toHaveProperty('defaulted', true);
      expect(getStanceForDeal).toHaveBeenCalledWith(DEAL_ID, 'user-test-123');
    });

    it('404 — when deal not found', async () => {
      (getStanceForDeal as Mock).mockRejectedValue(new Error('Deal not found'));

      const res = await request(app)
        .get(`/api/v1/deals/${DEAL_ID}/stance`)
        .expect(404);

      expect(res.body).toHaveProperty('error');
    });

    it('500 — on unexpected service error', async () => {
      (getStanceForDeal as Mock).mockRejectedValue(new Error('DB connection refused'));

      const res = await request(app)
        .get(`/api/v1/deals/${DEAL_ID}/stance`)
        .expect(500);

      expect(res.body).toHaveProperty('error');
    });
  });

  // ── PUT /:dealId/stance ───────────────────────────────────────────────────

  describe('PUT /:dealId/stance', () => {
    it('200 — returns updated stance + reblendTriggered flag', async () => {
      const updatedStance = marketStanceFixture({ underwritingPosture: 'CONSERVATIVE', defaulted: false });
      (saveStance as Mock).mockResolvedValue(updatedStance);

      const res = await request(app)
        .put(`/api/v1/deals/${DEAL_ID}/stance`)
        .send({ underwritingPosture: 'CONSERVATIVE' })
        .expect(200);

      expect(res.body).toHaveProperty('stance');
      expect(res.body).toHaveProperty('reblendTriggered', true);
      expect(res.body.stance.underwritingPosture).toBe('CONSERVATIVE');
      expect(saveStance).toHaveBeenCalledWith(DEAL_ID, 'user-test-123', { underwritingPosture: 'CONSERVATIVE' });
    });

    it('400 — on invalid stance field value', async () => {
      (saveStance as Mock).mockRejectedValue(new Error('Invalid stance: underwritingPosture must be one of …'));

      const res = await request(app)
        .put(`/api/v1/deals/${DEAL_ID}/stance`)
        .send({ underwritingPosture: 'BANANA' })
        .expect(400);

      expect(res.body).toHaveProperty('error');
    });

    it('404 — when deal not found during save', async () => {
      (saveStance as Mock).mockRejectedValue(new Error('Deal not found'));

      await request(app)
        .put(`/api/v1/deals/${DEAL_ID}/stance`)
        .send({ underwritingPosture: 'CONSERVATIVE' })
        .expect(404);
    });

    it('200 — partial update (only rateEnvironment) accepted', async () => {
      const updatedStance = marketStanceFixture({ rateEnvironment: 'HIGHER_FOR_LONGER', defaulted: false });
      (saveStance as Mock).mockResolvedValue(updatedStance);

      const res = await request(app)
        .put(`/api/v1/deals/${DEAL_ID}/stance`)
        .send({ rateEnvironment: 'HIGHER_FOR_LONGER' })
        .expect(200);

      expect(res.body.stance.rateEnvironment).toBe('HIGHER_FOR_LONGER');
    });
  });

  // ── POST /:dealId/stance/reset ────────────────────────────────────────────

  describe('POST /:dealId/stance/reset', () => {
    it('200 — returns MARKET-defaulted stance + reset message', async () => {
      (resetStance as Mock).mockResolvedValue(marketStanceFixture({ defaulted: true }));

      const res = await request(app)
        .post(`/api/v1/deals/${DEAL_ID}/stance/reset`)
        .expect(200);

      expect(res.body).toHaveProperty('stance');
      expect(res.body).toHaveProperty('message');
      expect(res.body.stance.defaulted).toBe(true);
      expect(res.body.stance.underwritingPosture).toBe('MARKET');
      expect(resetStance).toHaveBeenCalledWith(DEAL_ID, 'user-test-123');
    });

    it('404 — when deal not found on reset', async () => {
      (resetStance as Mock).mockRejectedValue(new Error('Deal not found'));

      await request(app)
        .post(`/api/v1/deals/${DEAL_ID}/stance/reset`)
        .expect(404);
    });
  });

  // ── GET /:dealId/stance/affected-fields ───────────────────────────────────

  describe('GET /:dealId/stance/affected-fields', () => {
    it('200 — returns affectedFields array + totalModulatedFields + stance summary', async () => {
      (getStanceForDeal as Mock).mockResolvedValue(
        marketStanceFixture({ underwritingPosture: 'CONSERVATIVE', defaulted: false }),
      );
      (computeAffectedFields as Mock).mockResolvedValue([
        affectedFieldFixture('rentGrowth', -25, 'rules'),
        affectedFieldFixture('exitCapRate', 50, 'snapshot'),
        affectedFieldFixture('vacancy', 100, 'rules'),
      ]);

      const res = await request(app)
        .get(`/api/v1/deals/${DEAL_ID}/stance/affected-fields`)
        .expect(200);

      expect(res.body).toHaveProperty('affectedFields');
      expect(res.body).toHaveProperty('totalModulatedFields', 3);
      expect(res.body).toHaveProperty('stance');
      expect(res.body.stance).toHaveProperty('underwritingPosture', 'CONSERVATIVE');
      expect(res.body.affectedFields).toHaveLength(3);
    });

    it('200 — MARKET defaults → empty affectedFields, totalModulatedFields=0', async () => {
      (getStanceForDeal as Mock).mockResolvedValue(marketStanceFixture({ defaulted: true }));
      (computeAffectedFields as Mock).mockResolvedValue([]);

      const res = await request(app)
        .get(`/api/v1/deals/${DEAL_ID}/stance/affected-fields`)
        .expect(200);

      expect(res.body.affectedFields).toHaveLength(0);
      expect(res.body.totalModulatedFields).toBe(0);
    });

    it('200 — affectedFields include source tag (snapshot | rules)', async () => {
      (getStanceForDeal as Mock).mockResolvedValue(
        marketStanceFixture({ underwritingPosture: 'CONSERVATIVE', defaulted: false }),
      );
      (computeAffectedFields as Mock).mockResolvedValue([
        affectedFieldFixture('rentGrowth', -25, 'snapshot'),
        affectedFieldFixture('exitCapRate', 50, 'rules'),
      ]);

      const res = await request(app)
        .get(`/api/v1/deals/${DEAL_ID}/stance/affected-fields`)
        .expect(200);

      const sources = res.body.affectedFields.map((f: any) => f.source);
      expect(sources).toContain('snapshot');
      expect(sources).toContain('rules');
    });

    it('404 — when deal not found', async () => {
      (getStanceForDeal as Mock).mockRejectedValue(new Error('Deal not found'));

      await request(app)
        .get(`/api/v1/deals/${DEAL_ID}/stance/affected-fields`)
        .expect(404);
    });
  });
});

/**
 * PATCH /:dealId/purchase-price — Route Contract Tests (Task #617)
 *
 * Validates the strict payload contract and dual-write semantics for the
 * purchase-price endpoint WITHOUT a real database (all db calls are mocked).
 *
 * Key scenarios:
 *   - Valid payload → 200 success
 *   - Extra body fields (e.g. closeDate piggybacking) → 400
 *   - Missing / non-numeric purchasePrice → 400
 *   - Non-positive / non-finite purchasePrice → 400
 *   - Unauthorised deal (ownership check fails) → 403
 *
 * Run: npx vitest run backend/src/api/rest/__tests__/purchasePrice.routes.test.ts
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import request from 'supertest';
import express, { type Application, type Request, type Response, type NextFunction } from 'express';

// ── Mock DB before any route import ──────────────────────────────────────────

const mockPoolQuery = vi.fn();

vi.mock('../../../database/connection', () => ({
  getPool:  vi.fn(() => ({ query: mockPoolQuery })),
  getDb:    vi.fn(() => ({ query: mockPoolQuery })),
}));

vi.mock('../../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

vi.mock('../../../middleware/auth', () => ({
  requireAuth: (req: Request, _res: Response, next: NextFunction) => {
    (req as any).user = { userId: 'user-test-999', email: 'test@jedi.re' };
    next();
  },
}));

// ── Load router after mocks ───────────────────────────────────────────────────

let app: Application;

beforeEach(async () => {
  vi.clearAllMocks();

  // Default: deal ownership check passes
  mockPoolQuery.mockResolvedValue({ rows: [{ id: 'deal-abc' }], rowCount: 1 });

  const { default: router } = await import('../deal-assumptions.routes');
  app = express();
  app.use(express.json());
  app.use('/', router);
});

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('PATCH /:dealId/purchase-price — payload validation (Task #617)', () => {
  const DEAL_ID = 'deal-abc';
  const url = `/${DEAL_ID}/purchase-price`;

  it('returns 200 for a valid purchasePrice payload', async () => {
    const res = await request(app)
      .patch(url)
      .send({ purchasePrice: 12_500_000 });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 400 when extra fields are present alongside purchasePrice', async () => {
    const res = await request(app)
      .patch(url)
      .send({ purchasePrice: 10_000_000, closeDate: '2026-06-01' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Unexpected field/i);
    expect(res.body.error).toContain('closeDate');
  });

  it('returns 400 when ONLY an extra field is sent (no purchasePrice)', async () => {
    const res = await request(app)
      .patch(url)
      .send({ closeDate: '2026-06-01' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Unexpected field/i);
  });

  it('returns 400 when purchasePrice is absent', async () => {
    const res = await request(app)
      .patch(url)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/purchasePrice/);
  });

  it('returns 400 when purchasePrice is a string', async () => {
    const res = await request(app)
      .patch(url)
      .send({ purchasePrice: '12500000' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/purchasePrice/);
  });

  it('returns 400 when purchasePrice is zero', async () => {
    const res = await request(app)
      .patch(url)
      .send({ purchasePrice: 0 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/positive/i);
  });

  it('returns 400 when purchasePrice is negative', async () => {
    const res = await request(app)
      .patch(url)
      .send({ purchasePrice: -5_000_000 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/positive/i);
  });

  it('returns 400 when purchasePrice is Infinity', async () => {
    const res = await request(app)
      .patch(url)
      .send({ purchasePrice: 1e309 });
    expect(res.status).toBe(400);
  });

  it('returns 403 when deal ownership check fails', async () => {
    // Override: first call (ownership check) returns empty rows; second call would be the UPDATE
    mockPoolQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = await request(app)
      .patch(url)
      .send({ purchasePrice: 10_000_000 });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/Not authorized/i);
  });

  it('calls pool.query with both deal_data and budget in the UPDATE when payload is valid', async () => {
    await request(app)
      .patch(url)
      .send({ purchasePrice: 8_000_000 });

    // Second call is the dual-write UPDATE (first is the ownership SELECT)
    const updateCall = (mockPoolQuery as Mock).mock.calls[1];
    expect(updateCall).toBeDefined();
    const [sql, params] = updateCall as [string, unknown[]];
    expect(sql).toMatch(/deal_data/);
    expect(sql).toMatch(/budget/);
    expect(params[1]).toBe(8_000_000);
  });
});

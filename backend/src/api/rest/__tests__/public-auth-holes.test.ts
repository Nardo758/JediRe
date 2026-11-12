/**
 * Anonymous refusal and cross-org isolation for the public-auth holes
 * closed in this change (dev-login, metric store, deal financials, agent
 * runs, capsules, paid jobs, deal files, operations writes, portfolio totals).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.hoisted(() => {
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://test:test@127.0.0.1:5432/jedire_test';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-unit-tests-only-32b';
  process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-for-unit-tests-32';
});

vi.mock('../../../database/connection', () => ({
  getPool: () => ({
    query: vi.fn().mockResolvedValue({ rows: [] }),
    connect: vi.fn(),
  }),
  query: vi.fn().mockResolvedValue({ rows: [] }),
}));

vi.mock('../../../services/ai/orgCreditService', () => ({
  resolveOrgForUser: vi.fn(async () => 'org-a'),
}));

vi.mock('rss-parser', () => ({
  default: class RssParser {
    parseURL() { return Promise.resolve({ items: [] }); }
  },
}));

vi.mock('../../../services/deal-scoping.service', () => ({
  assertDealOrgAccess: vi.fn(async () => null),
  resolveCallerOrg: vi.fn(async () => 'org-a'),
  dealListWhereClause: vi.fn(),
}));

import request from 'supertest';
import express from 'express';
import { isDevLoginAllowed } from '../../../auth/dev-login-policy';
import { isPublicApiV1Path } from '../../../auth/public-api-paths';
import { isSeriesVisibleToOrg } from '../../../services/metric-series-access';
import { generateAccessToken } from '../../../auth/jwt';
import { query } from '../../../database/connection';
import authRouter from '../inline-auth.routes';
import timeSeriesRoutes from '../time-series.routes';
import documentsFilesRoutes from '../documentsFiles.routes';
import { createCapsuleRoutes } from '../capsule.routes';
import scheduledRefreshRoutes from '../scheduled-refresh.routes';
import designAgentRoutes from '../design-agent.routes';
import sourceDocumentsRoutes from '../source-documents.routes';
import financialModelRoutes from '../financial-model.routes';

function appWith(mount: (app: express.Express) => void, user?: { userId: string }) {
  const app = express();
  app.use(express.json());
  if (user) {
    app.use((req, _res, next) => {
      (req as any).user = { ...user, email: 'a@example.com', role: 'analyst' };
      next();
    });
  }
  mount(app);
  return app;
}

describe('dev-login opt-in', () => {
  const base = { ...process.env };

  beforeEach(() => {
    process.env = { ...base };
    delete process.env.ALLOW_DEV_LOGIN;
    delete process.env.REPL_ID;
    delete process.env.REPLIT_DEPLOYMENT;
    delete process.env.NODE_ENV;
  });

  it('is off by default', () => {
    expect(isDevLoginAllowed()).toBe(false);
  });

  it('cannot be enabled in production or on a hosted build', () => {
    process.env.ALLOW_DEV_LOGIN = '1';
    process.env.NODE_ENV = 'production';
    expect(isDevLoginAllowed()).toBe(false);
    process.env.NODE_ENV = 'development';
    process.env.REPLIT_DEPLOYMENT = '1';
    expect(isDevLoginAllowed()).toBe(false);
    delete process.env.REPLIT_DEPLOYMENT;
    process.env.REPL_ID = 'repl-staging';
    expect(isDevLoginAllowed()).toBe(false);
  });

  it('refuses an anonymous request unless the local opt-in is on', async () => {
    const app = appWith((a) => a.use('/api/v1/auth', authRouter));
    const denied = await request(app).get('/api/v1/auth/dev-login');
    expect(denied.status).toBe(404);
    expect(denied.body.token).toBeUndefined();

    process.env.ALLOW_DEV_LOGIN = '1';
    process.env.NODE_ENV = 'production';
    const hosted = await request(app).get('/api/v1/auth/dev-login');
    expect(hosted.status).toBe(404);
    expect(hosted.body.token).toBeUndefined();
  });
});

describe('public API floor', () => {
  it('does not treat the metric store or capsule mutations as public', () => {
    expect(isPublicApiV1Path('GET', '/time-series/metrics')).toBe(false);
    expect(isPublicApiV1Path('GET', '/capsules')).toBe(false);
    expect(isPublicApiV1Path('POST', '/capsules')).toBe(false);
    expect(isPublicApiV1Path('GET', '/capsules/11111111-1111-1111-1111-111111111111')).toBe(false);
    expect(isPublicApiV1Path('GET', '/capsules/' + 'ab'.repeat(32))).toBe(true);
  });
});

describe('metric store', () => {
  it('hides another org private series and keeps public market series', () => {
    const noi = {
      source: 'portfolio_actuals',
      metric_id: 'PORT_NOI',
      scope_id: 'org:org-b',
      org_id: 'org-b',
    };
    expect(isSeriesVisibleToOrg(noi, 'org-a')).toBe(false);
    expect(isSeriesVisibleToOrg(noi, null)).toBe(false);
    expect(isSeriesVisibleToOrg(noi, 'org-b')).toBe(true);
    expect(isSeriesVisibleToOrg({
      source: 'fred',
      metric_id: 'RATE_SOFR',
      scope_id: 'GLOBAL',
      redistribution_restricted: false,
    }, 'org-a')).toBe(true);
    expect(isSeriesVisibleToOrg({
      source: 'portfolio_actuals',
      metric_id: 'PORT_NOI',
      scope_id: 'GLOBAL',
    }, 'org-a')).toBe(false);
  });

  it('refuses an anonymous read', async () => {
    const app = appWith((a) => a.use('/api/v1/time-series', timeSeriesRoutes));
    const res = await request(app).get('/api/v1/time-series/metrics');
    expect(res.status).toBe(401);
    expect(query).not.toHaveBeenCalled();
  });

  it('scopes an authenticated read to the caller org and excludes private sources', async () => {
    (query as unknown as ReturnType<typeof vi.fn>).mockClear();
    const token = generateAccessToken({ userId: 'user-a', email: 'a@example.com', role: 'analyst' });
    const app = appWith((a) => a.use('/api/v1/time-series', timeSeriesRoutes));
    const res = await request(app)
      .get('/api/v1/time-series/data')
      .query({ metric_id: 'PORT_NOI' })
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const sql = String((query as unknown as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0]);
    const params = (query as unknown as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1];
    expect(sql).toContain('portfolio_actuals');
    expect(sql).toContain('org_id');
    expect(params).toContain('org-a');
  });
});

describe('deal access on financial, file, capsule, and paid routes', () => {
  it('refuses an anonymous file upload and another org', async () => {
    const anon = appWith((a) => a.use('/api/v1', documentsFilesRoutes));
    expect((await request(anon).post('/api/v1/deals/deal-b/files')).status).toBe(401);

    const other = appWith((a) => a.use('/api/v1', documentsFilesRoutes), { userId: 'user-a' });
    const res = await request(other).get('/api/v1/deals/deal-b/files');
    expect(res.status).toBe(404);
  });

  it('refuses an anonymous source-document list and another org', async () => {
    const anon = appWith((a) => a.use('/api/v1/deals', sourceDocumentsRoutes));
    expect((await request(anon).get('/api/v1/deals/deal-b/source-documents')).status).toBe(401);

    const other = appWith((a) => a.use('/api/v1/deals', sourceDocumentsRoutes), { userId: 'user-a' });
    expect((await request(other).get('/api/v1/deals/deal-b/documents/doc-1/download')).status).toBe(404);
  });

  it('refuses another org building a financial model', async () => {
    const token = generateAccessToken({ userId: 'user-a', email: 'a@example.com', role: 'analyst' });
    const app = appWith((a) => a.use('/api/v1/financial-model', financialModelRoutes));
    const res = await request(app)
      .post('/api/v1/financial-model/build')
      .set('Authorization', `Bearer ${token}`)
      .send({ dealId: 'deal-b' });
    expect(res.status).toBe(404);
  });

  it('refuses anonymous capsule list and create', async () => {
    const pool = { query: vi.fn() };
    const app = appWith((a) => a.use('/api/v1/capsules', createCapsuleRoutes(pool as any)));
    expect((await request(app).get('/api/v1/capsules')).status).toBe(401);
    expect((await request(app).post('/api/v1/capsules').send({ property_address: '1 Main', deal_data: {} })).status).toBe(401);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('refuses anonymous paid job triggers', async () => {
    const refresh = appWith((a) => a.use('/api/v1/scheduled-refresh', scheduledRefreshRoutes));
    expect((await request(refresh).post('/api/v1/scheduled-refresh/run')).status).toBe(401);

    const design = appWith((a) => a.use('/api/v1/design-agent', designAgentRoutes));
    expect((await request(design).post('/api/v1/design-agent/generate').send({ prompt: 'tower' })).status).toBe(401);

    const georgia = await import('../georgia-ingestion.routes');
    const geo = appWith((a) => a.use('/api/v1/georgia', georgia.default));
    expect((await request(geo).post('/api/v1/georgia/ingest').send({})).status).toBe(401);
  });

  it('refuses anonymous and cross-org deal status changes and owned-asset writes', async () => {
    const lifecycle = await import('../lifecycle.routes');
    const anonLife = appWith((a) => a.use('/api/v1/lifecycle', lifecycle.default));
    expect((await request(anonLife).post('/api/v1/lifecycle/deal-b/status').send({ status: 'SOLD' })).status).toBe(401);

    const otherLife = appWith((a) => a.use('/api/v1/lifecycle', lifecycle.default), { userId: 'user-a' });
    expect((await request(otherLife).post('/api/v1/lifecycle/deal-b/status').send({ status: 'SOLD' })).status).toBe(404);

    const operations = await import('../operations.routes');
    const anonOps = appWith((a) => a.use('/api/v1/operations', operations.default));
    expect((await request(anonOps).post('/api/v1/operations/deal-b/actuals').send({})).status).toBe(401);
    const otherOps = appWith((a) => a.use('/api/v1/operations', operations.default), { userId: 'user-a' });
    expect((await request(otherOps).post('/api/v1/operations/deal-b/monthly-actuals').send({})).status).toBe(404);

    const leasing = await import('../leasing-traffic.routes');
    const anonLease = appWith((a) => a.use('/api/v1/leasing-traffic', leasing.default));
    expect((await request(anonLease).post('/api/v1/leasing-traffic/weekly-report/upload').send({ dealId: 'deal-b' })).status).toBe(401);
  });

  it('scopes portfolio totals to the caller org', async () => {
    (query as unknown as ReturnType<typeof vi.fn>).mockClear();
    (query as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      rows: [{
        total_assets: 0,
        total_units: 0,
        avg_occupancy: 0,
        portfolio_noi_all_time: 0,
        avg_monthly_noi: 0,
      }],
    });
    const token = generateAccessToken({ userId: 'user-a', email: 'a@example.com', role: 'analyst' });
    const portfolio = await import('../portfolio.routes');
    const app = appWith((a) => a.use('/api/v1/portfolio', portfolio.default));
    const res = await request(app)
      .get('/api/v1/portfolio/metrics')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const sql = String((query as unknown as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0]);
    const params = (query as unknown as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1];
    expect(sql).toContain('org_id');
    expect(params).toContain('org-a');
    expect(params).toContain('user-a');
  });
});

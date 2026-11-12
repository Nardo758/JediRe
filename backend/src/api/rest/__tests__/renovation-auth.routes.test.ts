/**
 * Renovation routes take the acting user from the authenticated session.
 * A client user id and the old demo-user fallback have no effect.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'renovation-auth-test-secret';

import request from 'supertest';
import express, { type Application } from 'express';
import { createRenovationRoutes } from '../renovation.routes';
import { generateAccessToken } from '../../../auth/jwt';
import { requireAuth } from '../../../middleware/auth';

const OWNER = '11111111-1111-4111-8111-111111111111';
const SPOOF = '22222222-2222-4222-8222-222222222222';
const DEAL = '33333333-3333-4333-8333-333333333333';

type SqlCall = { sql: string; params: unknown[] };

function bearer(userId: string): string {
  return `Bearer ${generateAccessToken({
    userId,
    email: 'owner@example.com',
    role: 'analyst',
  })}`;
}

function callsOf(query: Mock): SqlCall[] {
  return query.mock.calls.map((args) => ({
    sql: String(args[0]),
    params: (args[1] as unknown[]) ?? [],
  }));
}

function paramsInclude(calls: SqlCall[], value: unknown): boolean {
  return calls.some((call) => call.params.some((param) => param === value));
}

function appFor(pool: { query: Mock }, authenticate = true): Application {
  const app = express();
  app.use(express.json());
  const routes = createRenovationRoutes(pool as never);
  if (authenticate) {
    app.use('/api/v1/deals/:dealId/renovation', requireAuth, routes);
  } else {
    app.use('/api/v1/deals/:dealId/renovation', routes);
  }
  return app;
}

describe('renovation session identity', () => {
  let query: Mock;
  let app: Application;

  function mockQueries(opts: {
    deal?: { organization_id: string | null; user_id: string | null } | null;
  }) {
    query.mockImplementation(async (sql: string) => {
      const text = String(sql);
      if (text.includes('organization_id') && text.includes('FROM deals')) {
        if (!opts.deal) return { rows: [], rowCount: 0 };
        return { rows: [opts.deal], rowCount: 1 };
      }
      if (text.includes('FROM deals')) {
        return {
          rows: [{
            id: DEAL,
            name: 'Test Deal',
            year_renovated: 1998,
            deal_data: { currentRent: 1500 },
            data: null,
            project_type: 'multifamily',
            target_units: 100,
          }],
          rowCount: 1,
        };
      }
      if (text.includes('deal_capex_items')) return { rows: [], rowCount: 0 };
      if (text.includes('strategy_overrides') && text.includes('SELECT')) return { rows: [], rowCount: 0 };
      if (text.includes('DELETE FROM strategy_overrides')) return { rows: [], rowCount: 1 };
      if (text.includes('INSERT INTO strategy_overrides')) return { rows: [], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });
  }

  beforeEach(() => {
    query = vi.fn();
    app = appFor({ query });
  });

  it('rejects an unauthenticated read and does not fall back to demo-user', async () => {
    const bare = appFor({ query }, false);
    const res = await request(bare)
      .get(`/api/v1/deals/${DEAL}/renovation`)
      .query({ user_id: 'demo-user' })
      .set('x-user-id', SPOOF);

    expect(res.status).toBe(401);
    expect(query).not.toHaveBeenCalled();
  });

  it('returns 404 when the deal does not exist', async () => {
    mockQueries({ deal: null });
    const res = await request(app)
      .get(`/api/v1/deals/${DEAL}/renovation`)
      .set('Authorization', bearer(OWNER));

    expect(res.status).toBe(404);
  });

  it('returns 403 when the caller does not own the deal', async () => {
    mockQueries({ deal: { organization_id: null, user_id: SPOOF } });
    const res = await request(app)
      .get(`/api/v1/deals/${DEAL}/renovation`)
      .query({ user_id: SPOOF })
      .set('Authorization', bearer(OWNER))
      .set('x-user-id', SPOOF);

    expect(res.status).toBe(403);
    expect(paramsInclude(callsOf(query), 'demo-user')).toBe(false);
  });

  it('returns renovation data for the deal creator', async () => {
    mockQueries({ deal: { organization_id: null, user_id: OWNER } });
    const res = await request(app)
      .get(`/api/v1/deals/${DEAL}/renovation`)
      .query({ user_id: 'demo-user' })
      .set('Authorization', bearer(OWNER))
      .set('x-user-id', SPOOF);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.dealId).toBe(DEAL);
    expect(paramsInclude(callsOf(query), SPOOF)).toBe(false);
    expect(paramsInclude(callsOf(query), 'demo-user')).toBe(false);
  });

  it('records a premium override as the session user', async () => {
    mockQueries({ deal: { organization_id: null, user_id: OWNER } });
    const res = await request(app)
      .post(`/api/v1/deals/${DEAL}/renovation/premium`)
      .query({ user_id: SPOOF })
      .set('Authorization', bearer(OWNER))
      .set('x-user-id', 'demo-user')
      .send({ tierId: 'light', manualPremium: 0.12, userId: SPOOF });

    expect(res.status).toBe(200);
    expect(res.body.data.tierId).toBe('light');
    const insert = callsOf(query).find((call) => call.sql.includes('INSERT INTO strategy_overrides'));
    expect(insert?.params[2]).toBe(OWNER);
    expect(paramsInclude(callsOf(query), SPOOF)).toBe(false);
    expect(paramsInclude(callsOf(query), 'demo-user')).toBe(false);
  });

  it('rejects an unauthenticated premium write', async () => {
    const bare = appFor({ query }, false);
    const res = await request(bare)
      .post(`/api/v1/deals/${DEAL}/renovation/premium`)
      .send({ tierId: 'light', userId: 'demo-user' });

    expect(res.status).toBe(401);
    expect(query).not.toHaveBeenCalled();
  });
});

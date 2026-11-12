/**
 * Deal capsule identity: the acting user comes from the authenticated session.
 * Client-supplied user ids (body, query, x-user-id) are ignored. Unauthenticated
 * requests are rejected. The capsule bridge has no demo-user fallback.
 * Public shortcode share reads stay anonymous and scoped to that share.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'capsule-auth-test-secret';

const { db } = vi.hoisted(() => ({
  db: {
    query: vi.fn(async () => ({ rows: [] as unknown[] })),
    connect: vi.fn(),
  },
}));

vi.mock('../../../database/connection', () => ({
  getPool: () => db,
}));

import request from 'supertest';
import express, { type Application } from 'express';
import { createCapsuleRoutes } from '../capsule.routes';
import { createDealCapsuleBridge } from '../capsule-bridge.routes';
import sharingRouter from '../capsule-sharing.routes';
import dealSharesRoutes from '../deal-shares.routes';
import { generateAccessToken } from '../../../auth/jwt';
import { requireAuth } from '../../../middleware/auth';

const OWNER = '11111111-1111-4111-8111-111111111111';
const SPOOF = '22222222-2222-4222-8222-222222222222';
const DEAL = '33333333-3333-4333-8333-333333333333';
const CAPSULE = '44444444-4444-4444-8444-444444444444';

type SqlCall = { sql: string; params: unknown[] };

function bearer(userId: string): string {
  const token = generateAccessToken({
    userId,
    email: 'owner@example.com',
    role: 'analyst',
  });
  return `Bearer ${token}`;
}

function spoofHeaders(userId: string): Record<string, string> {
  return {
    Authorization: bearer(userId),
    'x-user-id': SPOOF,
  };
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

function capsuleApp(pool: { query: Mock; connect: Mock }): Application {
  const app = express();
  app.use(express.json());
  // Production puts /api/v1/capsules on the public allowlist, which sets
  // bypassAuth and skips the auth floor. The router must still require a session.
  app.use((_req, res, next) => {
    res.locals.bypassAuth = true;
    next();
  });
  app.use('/api/v1/capsules', createCapsuleRoutes(pool as never));
  return app;
}

function bridgeApp(pool: { query: Mock }, authenticate = true): Application {
  const app = express();
  app.use(express.json());
  const bridge = createDealCapsuleBridge(pool as never);
  if (authenticate) {
    app.use('/api/v1/deals/:dealId/capsule', requireAuth, bridge);
  } else {
    app.use('/api/v1/deals/:dealId/capsule', bridge);
  }
  return app;
}

function sharingApp(): Application {
  const app = express();
  app.use(express.json());
  app.use((_req, res, next) => {
    res.locals.bypassAuth = true;
    next();
  });
  app.use('/api/v1', sharingRouter);
  return app;
}

describe('capsule route session identity', () => {
  let query: Mock;
  let app: Application;

  beforeEach(() => {
    query = vi.fn(async (sql: string) => {
      if (String(sql).includes('COUNT')) return { rows: [{ count: '1' }] };
      if (String(sql).includes('INSERT INTO deal_capsules')) {
        return { rows: [{ id: CAPSULE, user_id: OWNER, property_address: '1 Main' }] };
      }
      if (String(sql).includes('FROM deal_capsules')) {
        return { rows: [{ id: CAPSULE, user_id: OWNER, property_address: '1 Main', deal_data: {} }] };
      }
      if (String(sql).includes('capsule_summary')) {
        return { rows: [{ id: CAPSULE, user_id: OWNER }] };
      }
      return { rows: [] };
    });
    const pool = { query, connect: vi.fn() };
    app = capsuleApp(pool);
  });

  it('rejects an unauthenticated create even when the body supplies a user id', async () => {
    const res = await request(app)
      .post('/api/v1/capsules')
      .set('x-user-id', SPOOF)
      .send({
        user_id: SPOOF,
        property_address: '1 Main',
        deal_data: { city: 'Atlanta' },
      });

    expect(res.status).toBe(401);
    expect(query).not.toHaveBeenCalled();
  });

  it('creates a capsule for the session user and ignores a spoofed user id', async () => {
    const res = await request(app)
      .post('/api/v1/capsules?user_id=' + SPOOF)
      .set(spoofHeaders(OWNER))
      .send({
        user_id: SPOOF,
        property_address: '1 Main',
        deal_data: { city: 'Atlanta' },
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.capsule.user_id).toBe(OWNER);

    const insert = callsOf(query).find((call) => call.sql.includes('INSERT INTO deal_capsules'));
    expect(insert?.params[0]).toBe(OWNER);
    expect(paramsInclude(callsOf(query), SPOOF)).toBe(false);
    expect(paramsInclude(callsOf(query), 'demo-user')).toBe(false);
  });

  it('lists only the session user capsules when the query names someone else', async () => {
    const res = await request(app)
      .get('/api/v1/capsules')
      .query({ user_id: SPOOF })
      .set(spoofHeaders(OWNER));

    expect(res.status).toBe(200);
    expect(res.body.capsules).toEqual([{ id: CAPSULE, user_id: OWNER }]);
    const listed = callsOf(query).filter((call) => call.sql.includes('capsule_summary') || call.sql.includes('COUNT'));
    expect(listed.length).toBeGreaterThan(0);
    for (const call of listed) {
      expect(call.params).toContain(OWNER);
      expect(call.params).not.toContain(SPOOF);
    }
  });

  it('returns the owner capsule and does not use the query user id', async () => {
    const res = await request(app)
      .get(`/api/v1/capsules/${CAPSULE}`)
      .query({ user_id: SPOOF })
      .set(spoofHeaders(OWNER));

    expect(res.status).toBe(200);
    expect(res.body.capsule.id).toBe(CAPSULE);
    const read = callsOf(query).find((call) => call.sql.includes('FROM deal_capsules'));
    expect(read?.params).toEqual([CAPSULE, OWNER]);
  });

  it('shares a capsule as the session user, not the body user id', async () => {
    const res = await request(app)
      .post(`/api/v1/capsules/${CAPSULE}/share`)
      .set(spoofHeaders(OWNER))
      .send({
        user_id: SPOOF,
        shared_with: 'lender@example.com',
        permission_tier: 'view',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const ownership = callsOf(query).find((call) => call.sql.includes('FROM deal_capsules'));
    expect(ownership?.params).toEqual([CAPSULE, OWNER]);
    const shareInsert = callsOf(query).find((call) => call.sql.includes('INSERT INTO capsule_shares'));
    expect(shareInsert?.params[1]).toBe(OWNER);
    expect(paramsInclude(callsOf(query), SPOOF)).toBe(false);
  });
});

describe('deal capsule bridge session identity', () => {
  let query: Mock;
  let app: Application;

  function mockDealQueries(opts: {
    deal?: { organization_id: string | null; user_id: string | null } | null;
    member?: boolean;
    existingCapsule?: boolean;
  }) {
    query.mockImplementation(async (sql: string, params: unknown[] = []) => {
      const text = String(sql);
      if (text.includes('organization_members')) {
        return { rows: opts.member ? [{ ok: 1 }] : [] };
      }
      if (text.includes('organization_id') && text.includes('FROM deals')) {
        if (!opts.deal) return { rows: [] };
        return { rows: [opts.deal] };
      }
      if (text.includes('FROM deals WHERE id')) {
        return {
          rows: [{
            id: DEAL,
            user_id: opts.deal?.user_id ?? OWNER,
            name: 'Test Deal',
            address: '1 Main',
            project_type: 'multifamily',
            status: 'discovery',
            deal_data: {},
            boundary: null,
          }],
        };
      }
      if (text.includes("deal_data->>'deal_id'") && text.includes('SELECT')) {
        if (!opts.existingCapsule) return { rows: [] };
        return {
          rows: [{
            id: CAPSULE,
            user_id: OWNER,
            property_address: '1 Main',
            asset_class: 'multifamily',
            status: 'DISCOVER',
            deal_data: { deal_id: DEAL },
            platform_intel: {},
            user_adjustments: {},
            jedi_score: 0,
          }],
        };
      }
      if (text.includes('INSERT INTO deal_capsules')) {
        return {
          rows: [{
            id: CAPSULE,
            user_id: params[1],
            property_address: '1 Main',
            asset_class: 'multifamily',
            status: 'DISCOVER',
            deal_data: {},
            platform_intel: {},
            user_adjustments: {},
            jedi_score: 0,
          }],
        };
      }
      if (text.includes('INSERT INTO proforma_assumptions')) {
        return {
          rows: [{
            id: 'proforma-1',
            deal_id: DEAL,
            vacancy_current: 5,
            rent_growth_current: 3,
            exit_cap_current: 6,
          }],
        };
      }
      if (text.includes('FROM proforma_assumptions')) {
        return { rows: [] };
      }
      return { rows: [] };
    });
  }

  beforeEach(() => {
    query = vi.fn();
    app = bridgeApp({ query });
  });

  it('rejects an unauthenticated read and does not fall back to demo-user', async () => {
    const bare = bridgeApp({ query }, false);
    const res = await request(bare)
      .get(`/api/v1/deals/${DEAL}/capsule`)
      .query({ user_id: 'demo-user' })
      .set('x-user-id', SPOOF);

    expect(res.status).toBe(401);
    expect(query).not.toHaveBeenCalled();
    expect(paramsInclude(callsOf(query), 'demo-user')).toBe(false);
  });

  it('returns 404 when the deal does not exist', async () => {
    mockDealQueries({ deal: null });
    const res = await request(app)
      .get(`/api/v1/deals/${DEAL}/capsule`)
      .set('Authorization', bearer(OWNER));

    expect(res.status).toBe(404);
    expect(callsOf(query).some((call) => call.sql.includes('INSERT'))).toBe(false);
  });

  it('returns 403 when the caller does not own an unorganized deal', async () => {
    mockDealQueries({ deal: { organization_id: null, user_id: SPOOF } });
    const res = await request(app)
      .get(`/api/v1/deals/${DEAL}/capsule`)
      .query({ user_id: SPOOF })
      .set(spoofHeaders(OWNER));

    expect(res.status).toBe(403);
    expect(callsOf(query).some((call) => call.sql.includes('INSERT'))).toBe(false);
  });

  it('returns 403 when the caller is not a member of the deal organization', async () => {
    mockDealQueries({
      deal: { organization_id: 'org-1', user_id: OWNER },
      member: false,
    });
    const res = await request(app)
      .post(`/api/v1/deals/${DEAL}/capsule/seed`)
      .set(spoofHeaders(OWNER))
      .send({ source: 'zoning', data: { far: 2 }, userId: SPOOF });

    expect(res.status).toBe(403);
    expect(paramsInclude(callsOf(query), SPOOF)).toBe(false);
    expect(paramsInclude(callsOf(query), 'demo-user')).toBe(false);
  });

  it('creates the capsule for the session user and ignores a spoofed user id', async () => {
    mockDealQueries({ deal: { organization_id: null, user_id: OWNER } });
    const res = await request(app)
      .get(`/api/v1/deals/${DEAL}/capsule`)
      .query({ user_id: 'demo-user' })
      .set(spoofHeaders(OWNER));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.capsule.id).toBe(CAPSULE);

    const insert = callsOf(query).find((call) => call.sql.includes('INSERT INTO deal_capsules'));
    expect(insert?.params[1]).toBe(OWNER);
    expect(paramsInclude(callsOf(query), SPOOF)).toBe(false);
    expect(paramsInclude(callsOf(query), 'demo-user')).toBe(false);
  });
});

describe('capsule share and fork identity', () => {
  let app: Application;

  beforeEach(() => {
    db.query.mockReset();
    db.query.mockResolvedValue({ rows: [] });
    db.connect.mockReset();
    app = sharingApp();
  });

  it('serves a public shortcode share without login, scoped to that share', async () => {
    db.query.mockImplementation(async (sql: string, params: unknown[] = []) => {
      const text = String(sql);
      if (text.includes('FROM capsule_external_shares') && text.includes('shortcode')) {
        expect(params[0]).toBe('abc1234');
        return {
          rows: [{
            share_id: 'share-1',
            capsule_id: CAPSULE,
            share_type: 'external_view',
            access_token: 'hash',
            allow_document_download: false,
            allow_agent_interaction: false,
            expires_at: null,
            recipient_email: null,
            preview_text: 'A share',
            preview_metadata: null,
            capsule_snapshot: null,
            show_attribution_override: null,
            sender_display_name: 'Sender',
            overlay_data: {},
          }],
        };
      }
      if (text.includes('FROM deal_capsules WHERE id')) {
        expect(params).toEqual([CAPSULE]);
        return {
          rows: [{
            id: CAPSULE,
            property_address: '1 Main',
            asset_class: 'multifamily',
            status: 'DISCOVER',
            jedi_score: 8,
            collision_score: null,
            deal_data: { deal_id: DEAL },
            platform_intel: { market_rent: 1 },
            user_adjustments: {},
            module_outputs: {},
            created_at: '2026-01-01T00:00:00.000Z',
          }],
        };
      }
      if (text.includes('user_branding_settings')) {
        return { rows: [{ tier: 'scout', company_name: null, logo_url: null, show_attribution: true }] };
      }
      return { rows: [] };
    });

    const res = await request(app)
      .get('/api/v1/shares/abc1234')
      .query({ user_id: SPOOF })
      .set('x-user-id', SPOOF);

    expect(res.status).toBe(200);
    expect(res.body.shortcode).toBe('abc1234');
    expect(res.body.capsule.id).toBe(CAPSULE);
    expect(res.body.capsule.property_address).toBe('1 Main');
    expect(paramsInclude(callsOf(db.query), SPOOF)).toBe(false);
  });

  it('rejects an unauthenticated fork even when the body names a user', async () => {
    const res = await request(app)
      .post('/api/v1/shares/abc1234/fork')
      .set('x-user-id', SPOOF)
      .send({ userId: SPOOF, user_id: 'demo-user' });

    expect(res.status).toBe(401);
    expect(db.query).not.toHaveBeenCalled();
  });

  it('forks a share into the session user account and ignores a spoofed user id', async () => {
    const clientQuery = vi.fn(async (sql: string, params: unknown[] = []) => {
      const text = String(sql);
      if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') return { rows: [] };
      if (text.includes('INSERT INTO deals')) {
        expect(params[0]).toBe(OWNER);
        return { rows: [{ id: 'new-deal', name: '1 Main' }] };
      }
      if (text.includes('INSERT INTO deal_capsules')) {
        expect(params[0]).toBe(OWNER);
        return { rows: [{ id: 'new-capsule' }] };
      }
      return { rows: [] };
    });
    db.connect.mockResolvedValue({ query: clientQuery, release: vi.fn() });
    db.query.mockImplementation(async (sql: string) => {
      const text = String(sql);
      if (text.includes('FROM capsule_external_shares')) {
        return {
          rows: [{
            share_id: 'share-1',
            capsule_id: CAPSULE,
            share_type: 'external_view',
            expires_at: null,
          }],
        };
      }
      if (text.includes('FROM deal_capsules')) {
        return {
          rows: [{
            property_address: '1 Main',
            asset_class: 'multifamily',
            jedi_score: 1,
            collision_score: null,
            deal_data: { deal_id: DEAL },
            platform_intel: {},
            user_adjustments: {},
            module_outputs: {},
          }],
        };
      }
      if (text.includes('forked_from_share')) return { rows: [] };
      return { rows: [] };
    });

    const res = await request(app)
      .post('/api/v1/shares/abc1234/fork')
      .query({ user_id: SPOOF })
      .set(spoofHeaders(OWNER))
      .send({ userId: SPOOF, user_id: 'demo-user' });

    expect(res.status).toBe(201);
    expect(res.body.deal_id).toBe('new-deal');
    expect(res.body.capsule_id).toBe('new-capsule');
    expect(res.body.already_existed).toBe(false);
    expect(paramsInclude(callsOf(db.query), SPOOF)).toBe(false);
    expect(paramsInclude(callsOf(db.query), 'demo-user')).toBe(false);
    const clientCalls = clientQuery.mock.calls.map((args) => ({
      sql: String(args[0]),
      params: (args[1] as unknown[]) ?? [],
    }));
    expect(paramsInclude(clientCalls, SPOOF)).toBe(false);
    expect(paramsInclude(clientCalls, 'demo-user')).toBe(false);
  });

  it('creates an external share for the session user and ignores a body user id', async () => {
    db.query.mockImplementation(async (sql: string, params: unknown[] = []) => {
      const text = String(sql);
      if (text.includes('FROM deal_capsules') && text.includes('dc.user_id = $2')) {
        expect(params).toEqual([CAPSULE, OWNER]);
        return {
          rows: [{
            id: CAPSULE,
            property_address: '1 Main',
            asset_class: 'multifamily',
            status: 'DISCOVER',
            jedi_score: 1,
            collision_score: null,
            deal_data: {},
            platform_intel: {},
            user_adjustments: {},
            module_outputs: {},
            created_at: '2026-01-01T00:00:00.000Z',
            sender_display_name: 'Owner',
            subscription_tier: 'scout',
          }],
        };
      }
      if (text.includes('INSERT INTO capsule_external_shares')) {
        expect(params[1]).toBe(OWNER);
        return { rows: [{ share_id: 'share-1', created_at: '2026-01-01T00:00:00.000Z' }] };
      }
      return { rows: [] };
    });

    const res = await request(app)
      .post(`/api/v1/${CAPSULE}/share/external`)
      .set(spoofHeaders(OWNER))
      .send({
        user_id: SPOOF,
        userId: 'demo-user',
        share_mode: 'shareable_link',
        share_type: 'external_view',
      });

    expect(res.status).toBe(201);
    expect(res.body.share_id).toBe('share-1');
    expect(paramsInclude(callsOf(db.query), SPOOF)).toBe(false);
    expect(paramsInclude(callsOf(db.query), 'demo-user')).toBe(false);
  });

  it('resolves a capsule to its deal for the session owner', async () => {
    db.query.mockImplementation(async (sql: string, params: unknown[] = []) => {
      if (String(sql).includes("deal_data->>'deal_id'")) {
        expect(params).toEqual([CAPSULE, OWNER]);
        return { rows: [{ deal_id: DEAL }] };
      }
      return { rows: [] };
    });

    const res = await request(app)
      .get(`/api/v1/${CAPSULE}/resolve-deal`)
      .query({ user_id: SPOOF })
      .set(spoofHeaders(OWNER));

    expect(res.status).toBe(200);
    expect(res.body.deal_id).toBe(DEAL);
  });
});

describe('deal share management session identity', () => {
  let app: Application;

  beforeEach(() => {
    db.query.mockReset();
    db.query.mockResolvedValue({ rows: [] });
    db.connect.mockReset();
    app = express();
    app.use(express.json());
    app.use('/api/v1/deals', dealSharesRoutes);
  });

  it('rejects an unauthenticated share list', async () => {
    const res = await request(app)
      .get(`/api/v1/deals/${DEAL}/shares`)
      .query({ user_id: SPOOF })
      .set('x-user-id', 'demo-user');

    expect(res.status).toBe(401);
    expect(db.query).not.toHaveBeenCalled();
  });

  it('lists the owner shares and ignores a spoofed user id', async () => {
    db.query.mockImplementation(async (sql: string, params: unknown[] = []) => {
      const text = String(sql);
      if (text.includes('FROM deal_capsules')) {
        expect(params).toEqual([DEAL, OWNER]);
        return { rows: [{ id: CAPSULE }] };
      }
      if (text.includes('FROM capsule_external_shares')) {
        return {
          rows: [{
            share_id: 'share-1',
            share_type: 'external_view',
            share_status: 'active',
          }],
        };
      }
      return { rows: [] };
    });

    const res = await request(app)
      .get(`/api/v1/deals/${DEAL}/shares`)
      .query({ user_id: SPOOF })
      .set(spoofHeaders(OWNER));

    expect(res.status).toBe(200);
    expect(res.body.capsule_id).toBe(CAPSULE);
    expect(res.body.shares).toHaveLength(1);
    expect(paramsInclude(callsOf(db.query), SPOOF)).toBe(false);
  });
});

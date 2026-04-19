/**
 * PlatformClient — Backend API client for agent dogfooding.
 *
 * Agents call the platform API under their own service-account identity
 * using platformClient.as({ agentId, runId }). This ensures all writes go
 * through the same auth/audit stack as user-initiated actions.
 *
 * Exception: write_dealcontext calls the service directly (see CLAUDE.md
 * "write_dealcontext exception" for rationale).
 *
 * Usage:
 *   const client = platformClient.as({ agentId: 'research', runId: run.id });
 *   const parcel = await client.get('/parcels/lookup', { address, county });
 */

import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';

// ── Agent UUIDs (must match agent_auth.routes.ts + DB seeds) ─────

const AGENT_USER_IDS: Record<string, string> = {
  research:   '00000000-0000-0000-0000-000000000001',
  zoning:     '00000000-0000-0000-0000-000000000002',
  supply:     '00000000-0000-0000-0000-000000000003',
  cashflow:   '00000000-0000-0000-0000-000000000004',
  commentary: '00000000-0000-0000-0000-000000000005',
};

const AGENT_CAPABILITIES: Record<string, string[]> = {
  research:   ['read:all', 'write:deal_context'],
  zoning:     ['read:zoning', 'read:parcels', 'write:zoning_analysis'],
  supply:     ['read:permits', 'read:costar', 'write:supply_analysis'],
  cashflow:   ['read:financials', 'write:projections'],
  commentary: ['read:market_data', 'read:economic', 'write:market_commentary'],
};

// ── Agent-scoped HTTP client ──────────────────────────────────────

export class AgentApiClient {
  private token: string;
  private baseUrl: string;

  constructor(agentId: string, runId?: string) {
    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-this';
    const userId = AGENT_USER_IDS[agentId];

    if (!userId) {
      throw new Error(`Unknown agentId for platformClient.as(): "${agentId}"`);
    }

    this.token = jwt.sign(
      {
        userId,
        email: `${agentId}@agents.jediplatform.internal`,
        role: 'agent',
        user_type: 'agent',
        agent_id: agentId,
        capabilities: AGENT_CAPABILITIES[agentId] ?? [],
        agent_run_id: runId,
      },
      jwtSecret,
      { expiresIn: '1h', issuer: 'jedire-api', audience: 'jedire-client' } as jwt.SignOptions
    );

    // Prefer explicit env var; fallback to localhost in dev
    this.baseUrl =
      process.env.PLATFORM_API_BASE_URL ??
      `http://localhost:${process.env.PORT ?? 4000}/api/v1`;
  }

  async get<T = unknown>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(path, this.baseUrl);
    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    }

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`PlatformClient GET ${path} → ${res.status}: ${body}`);
    }

    return res.json() as Promise<T>;
  }

  async post<T = unknown>(path: string, body: unknown): Promise<T> {
    const url = new URL(path, this.baseUrl);

    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`PlatformClient POST ${path} → ${res.status}: ${text}`);
    }

    return res.json() as Promise<T>;
  }
}

// ── Factory singleton ─────────────────────────────────────────────

class PlatformClientFactory {
  /**
   * Return an API client scoped to a specific agent identity.
   *
   * @param agentId  - one of the 5 Layer 1 agent IDs
   * @param runId    - optional agent_run_id for request tracing
   */
  as({ agentId, runId }: { agentId: string; runId?: string }): AgentApiClient {
    logger.debug('platformClient.as()', { agentId, runId });
    return new AgentApiClient(agentId, runId);
  }
}

export const platformClient = new PlatformClientFactory();

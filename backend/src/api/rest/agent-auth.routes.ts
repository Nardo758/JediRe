/**
 * Agent Auth Routes
 * Internal-only endpoint for issuing scoped service-account JWTs to agents.
 *
 * POST /api/v1/auth/agent-token
 *
 * This endpoint is for platform-internal use only. It issues short-lived tokens
 * for the five Layer 1 agent service accounts so they can call the platform API
 * as themselves (dogfooding pattern from AGENT_PLATFORM_SPEC.md).
 *
 * Security: Protected by a shared internal secret (AGENT_INTERNAL_SECRET env var).
 * Do NOT expose this endpoint to external clients.
 */

import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../../utils/logger';

const router = Router();

const AGENT_CONFIGS: Record<string, { email: string; capabilities: string[] }> = {
  research: {
    email: 'research@agents.jediplatform.internal',
    capabilities: ['read:all', 'write:deal_context', 'web:search'],
  },
  zoning: {
    email: 'zoning@agents.jediplatform.internal',
    capabilities: ['read:zoning', 'read:parcels', 'write:zoning_analysis', 'web:search'],
  },
  supply: {
    email: 'supply@agents.jediplatform.internal',
    capabilities: ['read:permits', 'read:costar', 'write:supply_analysis'],
  },
  cashflow: {
    email: 'cashflow@agents.jediplatform.internal',
    capabilities: ['read:financials', 'write:projections'],
  },
  commentary: {
    email: 'commentary@agents.jediplatform.internal',
    capabilities: ['read:market_data', 'read:economic', 'write:market_commentary', 'web:search'],
  },
};

const AGENT_USER_IDS: Record<string, string> = {
  research: '00000000-0000-0000-0000-000000000001',
  zoning:   '00000000-0000-0000-0000-000000000002',
  supply:   '00000000-0000-0000-0000-000000000003',
  cashflow: '00000000-0000-0000-0000-000000000004',
  commentary:'00000000-0000-0000-0000-000000000005',
};

/**
 * POST /api/v1/auth/agent-token
 * Issue a scoped 1h JWT for an agent service account.
 * Requires the X-Agent-Internal-Secret header.
 */
router.post('/agent-token', (req: Request, res: Response) => {
  const internalSecret = req.headers['x-agent-internal-secret'] as string;
  const expectedSecret = process.env.AGENT_INTERNAL_SECRET;

  if (!expectedSecret || internalSecret !== expectedSecret) {
    res.status(403).json({ error: 'Forbidden', message: 'Invalid internal secret' });
    return;
  }

  const { agent_id } = req.body as { agent_id?: string };

  if (!agent_id || !AGENT_CONFIGS[agent_id]) {
    res.status(400).json({
      error: 'Bad Request',
      message: `Unknown agent_id: ${agent_id}. Must be one of: ${Object.keys(AGENT_CONFIGS).join(', ')}`,
    });
    return;
  }

  const config = AGENT_CONFIGS[agent_id];
  const userId = AGENT_USER_IDS[agent_id];

  const payload = {
    userId,
    email: config.email,
    role: 'agent',
    user_type: 'agent' as const,
    agent_id,
    capabilities: config.capabilities,
  };

  const jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-this';

  const token = jwt.sign(payload, jwtSecret, {
    expiresIn: '1h',
    issuer: 'jedire-api',
    audience: 'jedire-client',
  } as jwt.SignOptions);

  logger.info(`Issued agent token for ${agent_id}`);

  res.json({
    access_token: token,
    token_type: 'Bearer',
    expires_in: 3600,
    agent_id,
    capabilities: config.capabilities,
  });
});

export default router;

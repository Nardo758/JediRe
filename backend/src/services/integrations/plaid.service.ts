/**
 * Plaid Integration Service
 * 
 * Handles identity verification and bank account verification through Plaid.
 * Follows the Stripe-like wrapper pattern for credential management.
 */

import { query } from '../../database/connection';
import { logger } from '../../utils/logger';
import { decrypt, encrypt } from '../../utils/encryption';
import {
  PlaidLinkToken,
  PlaidVerification,
  CreatePlaidVerificationRequest,
  IntegrationCredentials,
} from './types';

// ─── Credential Management ────────────────────────────────────────────

/**
 * Get Plaid credentials for an organization
 */
async function getCredentials(organizationId: string): Promise<IntegrationCredentials | null> {
  const result = await query(
    `SELECT credentials_encrypted, environment, config
     FROM org_integrations 
     WHERE organization_id = $1 AND provider = 'plaid' AND status = 'active'`,
    [organizationId]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0] as Record<string, unknown>;
  return row.credentials_encrypted 
    ? JSON.parse(decrypt(row.credentials_encrypted as string))
    : null;
}

/**
 * Save/update Plaid credentials for an organization
 */
export async function saveCredentials(
  organizationId: string,
  credentials: IntegrationCredentials,
  environment: 'sandbox' | 'production' = 'sandbox'
): Promise<void> {
  const credentialsEncrypted = encrypt(JSON.stringify({
    clientId: credentials.clientId,
    secret: credentials.secret,
  }));

  await query(
    `INSERT INTO org_integrations (
      organization_id, provider, credentials_encrypted, environment, status
    ) VALUES ($1, 'plaid', $2, $3, 'active')
    ON CONFLICT (organization_id, provider) DO UPDATE SET
      credentials_encrypted = EXCLUDED.credentials_encrypted,
      environment = EXCLUDED.environment,
      status = 'active',
      updated_at = NOW()`,
    [organizationId, credentialsEncrypted, environment]
  );

  logger.info('[plaid] Saved credentials', { organizationId, environment });
}

// ─── API Client ───────────────────────────────────────────────────────

/**
 * Make authenticated request to Plaid API
 */
async function plaidRequest<T>(
  organizationId: string,
  endpoint: string,
  body: Record<string, unknown>
): Promise<T> {
  const creds = await getCredentials(organizationId);
  if (!creds) {
    throw new Error('Plaid not configured for this organization');
  }

  // Check environment from org settings
  const envResult = await query(
    `SELECT environment FROM org_integrations WHERE organization_id = $1 AND provider = 'plaid'`,
    [organizationId]
  );
  const environment = envResult.rows[0]?.environment ?? 'sandbox';

  const baseUrl = environment === 'production'
    ? 'https://production.plaid.com'
    : 'https://sandbox.plaid.com';

  const response = await fetch(`${baseUrl}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: creds.clientId,
      secret: creds.secret,
      ...body,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    logger.error('[plaid] API error', { status: response.status, error });
    throw new Error(`Plaid API error: ${(error as { error_message?: string }).error_message || response.status}`);
  }

  return response.json() as Promise<T>;
}

// ─── Link Token (for Plaid Link UI) ───────────────────────────────────

/**
 * Create a Link token for identity verification
 */
export async function createLinkTokenForIdentity(
  organizationId: string,
  userId: string,
  redirectUri?: string
): Promise<PlaidLinkToken> {
  const response = await plaidRequest<{
    link_token: string;
    expiration: string;
  }>(
    organizationId,
    '/link/token/create',
    {
      user: { client_user_id: userId },
      client_name: 'JediRE',
      products: ['identity_verification'],
      identity_verification: {
        template_id: 'idv_template_id', // Configure per org
      },
      country_codes: ['US'],
      language: 'en',
      redirect_uri: redirectUri,
    }
  );

  return {
    linkToken: response.link_token,
    expiration: new Date(response.expiration),
  };
}

/**
 * Create a Link token for bank account verification
 */
export async function createLinkTokenForBankAccount(
  organizationId: string,
  userId: string,
  redirectUri?: string
): Promise<PlaidLinkToken> {
  const response = await plaidRequest<{
    link_token: string;
    expiration: string;
  }>(
    organizationId,
    '/link/token/create',
    {
      user: { client_user_id: userId },
      client_name: 'JediRE',
      products: ['auth'],
      country_codes: ['US'],
      language: 'en',
      redirect_uri: redirectUri,
    }
  );

  return {
    linkToken: response.link_token,
    expiration: new Date(response.expiration),
  };
}

// ─── Identity Verification ────────────────────────────────────────────

/**
 * Create an identity verification request
 */
export async function createVerification(
  organizationId: string,
  request: CreatePlaidVerificationRequest,
  requestedBy?: string
): Promise<string> {
  // Create link token for the verification
  const linkResponse = await plaidRequest<{
    link_token: string;
    identity_verification: { id: string };
  }>(
    organizationId,
    '/link/token/create',
    {
      user: {
        client_user_id: `${organizationId}_${Date.now()}`,
        email_address: request.subjectEmail,
        name: { given_name: request.subjectName.split(' ')[0], family_name: request.subjectName.split(' ').slice(1).join(' ') || '' },
      },
      client_name: 'JediRE',
      products: ['identity_verification'],
      country_codes: ['US'],
      language: 'en',
    }
  );

  const verificationId = linkResponse.identity_verification?.id || `idv_${Date.now()}`;

  // Store in database
  await query(
    `INSERT INTO identity_verifications (
      organization_id, deal_id, provider, external_verification_id,
      subject_type, subject_name, subject_email,
      verification_type, status, requested_by
    ) VALUES ($1, $2, 'plaid', $3, $4, $5, $6, $7, 'pending', $8)`,
    [
      organizationId,
      request.dealId,
      verificationId,
      request.subjectType,
      request.subjectName,
      request.subjectEmail,
      request.verificationType,
      requestedBy,
    ]
  );

  logger.info('[plaid] Created verification', {
    organizationId,
    verificationId,
    subjectType: request.subjectType,
  });

  return verificationId;
}

/**
 * Get verification status
 */
export async function getVerificationStatus(
  organizationId: string,
  verificationId: string
): Promise<PlaidVerification> {
  const response = await plaidRequest<{
    id: string;
    status: string;
    user: { email_address: string; legal_name?: string };
    steps: { status: string; name: string }[];
  }>(
    organizationId,
    '/identity_verification/get',
    { identity_verification_id: verificationId }
  );

  // Map Plaid status to our status
  const statusMap: Record<string, PlaidVerification['status']> = {
    active: 'in_progress',
    success: 'completed',
    failed: 'failed',
    expired: 'failed',
    pending_review: 'in_progress',
  };

  return {
    verificationId: response.id,
    status: statusMap[response.status] || 'pending',
    verificationType: 'identity',
    subjectName: response.user.legal_name || '',
    result: response.status === 'success' ? {
      verified: true,
    } : undefined,
  };
}

/**
 * Handle webhook event from Plaid
 */
export async function handleWebhook(
  organizationId: string,
  event: {
    webhook_type: string;
    webhook_code: string;
    identity_verification_id?: string;
    status?: string;
    error?: { error_code: string; error_message: string };
  }
): Promise<void> {
  // Log event
  await query(
    `INSERT INTO integration_events (
      organization_id, provider, event_type, event_id, payload
    ) VALUES ($1, 'plaid', $2, $3, $4)`,
    [
      organizationId,
      `${event.webhook_type}.${event.webhook_code}`,
      event.identity_verification_id,
      JSON.stringify(event),
    ]
  );

  // Update verification status
  if (event.identity_verification_id) {
    const statusMap: Record<string, string> = {
      STATUS_UPDATED: event.status || 'in_progress',
      STEP_COMPLETED: 'in_progress',
      VERIFICATION_EXPIRED: 'failed',
    };

    const newStatus = statusMap[event.webhook_code];
    if (newStatus) {
      await query(
        `UPDATE identity_verifications 
         SET status = $1,
             completed_at = CASE WHEN $1 IN ('completed', 'failed') THEN NOW() ELSE completed_at END
         WHERE external_verification_id = $2`,
        [newStatus === 'success' ? 'completed' : newStatus, event.identity_verification_id]
      );
    }
  }

  logger.info('[plaid] Processed webhook', {
    organizationId,
    webhookType: event.webhook_type,
    webhookCode: event.webhook_code,
  });
}

/**
 * Get all verifications for a deal
 */
export async function getVerificationsForDeal(dealId: string): Promise<{
  id: string;
  subjectType: string;
  subjectName: string;
  subjectEmail: string;
  verificationType: string;
  status: string;
  requestedAt: Date;
  completedAt: Date | null;
}[]> {
  const result = await query(`
    SELECT id, subject_type, subject_name, subject_email, 
           verification_type, status, requested_at, completed_at
    FROM identity_verifications
    WHERE deal_id = $1
    ORDER BY requested_at DESC
  `, [dealId]);

  return (result.rows as Record<string, unknown>[]).map(row => ({
    id: String(row.id),
    subjectType: String(row.subject_type),
    subjectName: String(row.subject_name),
    subjectEmail: String(row.subject_email ?? ''),
    verificationType: String(row.verification_type),
    status: String(row.status),
    requestedAt: new Date(row.requested_at as string),
    completedAt: row.completed_at ? new Date(row.completed_at as string) : null,
  }));
}

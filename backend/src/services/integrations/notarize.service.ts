/**
 * Notarize Integration Service
 * 
 * Handles remote online notarization through Notarize.com API.
 * Follows the Stripe-like wrapper pattern for credential management.
 */

import { query } from '../../database/connection';
import { logger } from '../../utils/logger';
import { decrypt, encrypt } from '../../utils/encryption';
import {
  NotarizeSession,
  CreateNotarizeSessionRequest,
  IntegrationCredentials,
} from './types';

// ─── Credential Management ────────────────────────────────────────────

/**
 * Get Notarize credentials for an organization
 */
async function getCredentials(organizationId: string): Promise<IntegrationCredentials | null> {
  const result = await query(
    `SELECT credentials_encrypted, environment
     FROM org_integrations 
     WHERE organization_id = $1 AND provider = 'notarize' AND status = 'active'`,
    [organizationId]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0] as Record<string, unknown>;
  const creds = row.credentials_encrypted 
    ? JSON.parse(decrypt(row.credentials_encrypted as string))
    : null;
  
  return creds ? { ...creds, environment: row.environment } : null;
}

/**
 * Save/update Notarize credentials for an organization
 */
export async function saveCredentials(
  organizationId: string,
  credentials: IntegrationCredentials,
  environment: 'sandbox' | 'production' = 'sandbox'
): Promise<void> {
  const credentialsEncrypted = encrypt(JSON.stringify({
    apiKey: credentials.apiKey,
    organizationId: credentials.organizationId,
  }));

  await query(
    `INSERT INTO org_integrations (
      organization_id, provider, credentials_encrypted, environment, status
    ) VALUES ($1, 'notarize', $2, $3, 'active')
    ON CONFLICT (organization_id, provider) DO UPDATE SET
      credentials_encrypted = EXCLUDED.credentials_encrypted,
      environment = EXCLUDED.environment,
      status = 'active',
      updated_at = NOW()`,
    [organizationId, credentialsEncrypted, environment]
  );

  logger.info('[notarize] Saved credentials', { organizationId, environment });
}

// ─── API Client ───────────────────────────────────────────────────────

/**
 * Make authenticated request to Notarize API
 */
async function notarizeRequest<T>(
  organizationId: string,
  method: string,
  endpoint: string,
  body?: unknown
): Promise<T> {
  const creds = await getCredentials(organizationId);
  if (!creds) {
    throw new Error('Notarize not configured for this organization');
  }

  const baseUrl = creds.environment === 'production'
    ? 'https://api.notarize.com/v1'
    : 'https://sandbox-api.notarize.com/v1';

  const response = await fetch(`${baseUrl}${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${creds.apiKey}`,
      'Content-Type': 'application/json',
      'X-Organization-Id': creds.organizationId || '',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error('[notarize] API error', { status: response.status, error });
    throw new Error(`Notarize API error: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

// ─── Session Operations ───────────────────────────────────────────────

/**
 * Create a notarization session
 */
export async function createSession(
  organizationId: string,
  request: CreateNotarizeSessionRequest,
  createdBy?: string
): Promise<string> {
  // Upload document first
  const documentResponse = await notarizeRequest<{ id: string }>(
    organizationId,
    'POST',
    '/documents',
    {
      name: request.documentName,
      file: request.documentBase64,
    }
  );

  // Create notarization session
  const sessionResponse = await notarizeRequest<{
    id: string;
    status: string;
    meeting_url?: string;
  }>(
    organizationId,
    'POST',
    '/sessions',
    {
      document_id: documentResponse.id,
      notarization_type: request.notarizationType,
      signer: {
        name: request.participantName,
        email: request.participantEmail,
      },
    }
  );

  const sessionId = sessionResponse.id;

  // Store in our database (using signing_envelopes table for consistency)
  await query(
    `INSERT INTO signing_envelopes (
      organization_id, deal_id, provider, external_envelope_id,
      envelope_type, subject, status, created_by
    ) VALUES ($1, $2, 'notarize', $3, 'notarization', $4, $5, $6)`,
    [
      organizationId,
      request.dealId,
      sessionId,
      `Notarization: ${request.documentName}`,
      sessionResponse.status,
      createdBy,
    ]
  );

  // Store participant as recipient
  const envelopeResult = await query(
    `SELECT id FROM signing_envelopes WHERE external_envelope_id = $1`,
    [sessionId]
  );
  
  await query(
    `INSERT INTO signing_recipients (
      envelope_id, recipient_type, name, email, status
    ) VALUES ($1, 'in_person_signer', $2, $3, 'created')`,
    [envelopeResult.rows[0]?.id, request.participantName, request.participantEmail]
  );

  logger.info('[notarize] Created session', {
    organizationId,
    sessionId,
    dealId: request.dealId,
  });

  return sessionId;
}

/**
 * Get session status
 */
export async function getSessionStatus(
  organizationId: string,
  sessionId: string
): Promise<NotarizeSession> {
  const response = await notarizeRequest<{
    id: string;
    status: string;
    signer: { name: string; email: string };
    document: { id: string };
    scheduled_at?: string;
    completed_at?: string;
    notarized_document_url?: string;
  }>(
    organizationId,
    'GET',
    `/sessions/${sessionId}`
  );

  const statusMap: Record<string, NotarizeSession['status']> = {
    created: 'pending',
    scheduled: 'scheduled',
    in_progress: 'in_progress',
    completed: 'completed',
    cancelled: 'cancelled',
  };

  return {
    sessionId: response.id,
    status: statusMap[response.status] || 'pending',
    participantName: response.signer.name,
    participantEmail: response.signer.email,
    documentId: response.document.id,
    scheduledAt: response.scheduled_at ? new Date(response.scheduled_at) : undefined,
    completedAt: response.completed_at ? new Date(response.completed_at) : undefined,
    notarizedDocumentUrl: response.notarized_document_url,
  };
}

/**
 * Get session meeting URL (for signer to join)
 */
export async function getSessionMeetingUrl(
  organizationId: string,
  sessionId: string
): Promise<string> {
  const response = await notarizeRequest<{ meeting_url: string }>(
    organizationId,
    'GET',
    `/sessions/${sessionId}/meeting`
  );

  return response.meeting_url;
}

/**
 * Cancel a session
 */
export async function cancelSession(
  organizationId: string,
  sessionId: string,
  reason?: string
): Promise<void> {
  await notarizeRequest(
    organizationId,
    'POST',
    `/sessions/${sessionId}/cancel`,
    { reason }
  );

  // Update our database
  await query(
    `UPDATE signing_envelopes 
     SET status = 'voided', voided_at = NOW()
     WHERE external_envelope_id = $1`,
    [sessionId]
  );

  logger.info('[notarize] Cancelled session', { organizationId, sessionId });
}

/**
 * Handle webhook event from Notarize
 */
export async function handleWebhook(
  organizationId: string,
  event: {
    event_type: string;
    session_id: string;
    status?: string;
    completed_at?: string;
    notarized_document_url?: string;
  }
): Promise<void> {
  // Log event
  await query(
    `INSERT INTO integration_events (
      organization_id, provider, event_type, event_id, payload
    ) VALUES ($1, 'notarize', $2, $3, $4)`,
    [organizationId, event.event_type, event.session_id, JSON.stringify(event)]
  );

  // Update envelope status
  if (event.status) {
    await query(
      `UPDATE signing_envelopes 
       SET status = $1,
           completed_at = CASE WHEN $1 = 'completed' THEN NOW() ELSE completed_at END,
           updated_at = NOW()
       WHERE external_envelope_id = $2`,
      [event.status, event.session_id]
    );
  }

  // Update recipient if completed
  if (event.status === 'completed') {
    await query(
      `UPDATE signing_recipients sr
       SET status = 'signed', signed_at = NOW()
       FROM signing_envelopes se
       WHERE sr.envelope_id = se.id 
         AND se.external_envelope_id = $1`,
      [event.session_id]
    );
  }

  logger.info('[notarize] Processed webhook', {
    organizationId,
    eventType: event.event_type,
    sessionId: event.session_id,
  });
}

/**
 * Get all notarization sessions for a deal
 */
export async function getSessionsForDeal(dealId: string): Promise<{
  id: string;
  subject: string;
  status: string;
  participantName: string;
  participantEmail: string;
  createdAt: Date;
  completedAt: Date | null;
}[]> {
  const result = await query(`
    SELECT 
      se.id, se.subject, se.status, se.created_at, se.completed_at,
      sr.name as participant_name, sr.email as participant_email
    FROM signing_envelopes se
    LEFT JOIN signing_recipients sr ON sr.envelope_id = se.id
    WHERE se.deal_id = $1 AND se.provider = 'notarize'
    ORDER BY se.created_at DESC
  `, [dealId]);

  return (result.rows as Record<string, unknown>[]).map(row => ({
    id: String(row.id),
    subject: String(row.subject ?? ''),
    status: String(row.status),
    participantName: String(row.participant_name ?? ''),
    participantEmail: String(row.participant_email ?? ''),
    createdAt: new Date(row.created_at as string),
    completedAt: row.completed_at ? new Date(row.completed_at as string) : null,
  }));
}

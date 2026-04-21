/**
 * DocuSign Integration Service
 * 
 * Handles document signing through DocuSign API.
 * Follows the Stripe-like wrapper pattern for credential management.
 */

import { query } from '../../database/connection';
import { logger } from '../../utils/logger';
import { decrypt, encrypt } from '../../utils/encryption';
import {
  DocuSignEnvelope,
  CreateEnvelopeRequest,
  IntegrationCredentials,
} from './types';

// ─── Credential Management ────────────────────────────────────────────

/**
 * Get DocuSign credentials for an organization
 */
async function getCredentials(organizationId: string): Promise<IntegrationCredentials | null> {
  const result = await query(
    `SELECT credentials_encrypted, access_token_encrypted, refresh_token_encrypted, 
            token_expires_at, environment, config
     FROM org_integrations 
     WHERE organization_id = $1 AND provider = 'docusign' AND status = 'active'`,
    [organizationId]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0] as Record<string, unknown>;
  const credentials = row.credentials_encrypted 
    ? JSON.parse(decrypt(row.credentials_encrypted as string))
    : {};

  return {
    ...credentials,
    accessToken: row.access_token_encrypted ? decrypt(row.access_token_encrypted as string) : undefined,
    refreshToken: row.refresh_token_encrypted ? decrypt(row.refresh_token_encrypted as string) : undefined,
    environment: row.environment as string,
    accountId: (row.config as Record<string, string>)?.accountId,
  };
}

/**
 * Save/update DocuSign credentials for an organization
 */
export async function saveCredentials(
  organizationId: string,
  credentials: IntegrationCredentials,
  environment: 'sandbox' | 'production' = 'sandbox'
): Promise<void> {
  const credentialsEncrypted = encrypt(JSON.stringify({
    clientId: credentials.clientId,
    clientSecret: credentials.clientSecret,
    accountId: credentials.accountId,
  }));

  const accessTokenEncrypted = credentials.accessToken 
    ? encrypt(credentials.accessToken) 
    : null;
  const refreshTokenEncrypted = credentials.refreshToken 
    ? encrypt(credentials.refreshToken) 
    : null;

  await query(
    `INSERT INTO org_integrations (
      organization_id, provider, credentials_encrypted, 
      access_token_encrypted, refresh_token_encrypted,
      environment, config, status
    ) VALUES ($1, 'docusign', $2, $3, $4, $5, $6, 'active')
    ON CONFLICT (organization_id, provider) DO UPDATE SET
      credentials_encrypted = EXCLUDED.credentials_encrypted,
      access_token_encrypted = EXCLUDED.access_token_encrypted,
      refresh_token_encrypted = EXCLUDED.refresh_token_encrypted,
      environment = EXCLUDED.environment,
      status = 'active',
      updated_at = NOW()`,
    [
      organizationId,
      credentialsEncrypted,
      accessTokenEncrypted,
      refreshTokenEncrypted,
      environment,
      JSON.stringify({ accountId: credentials.accountId }),
    ]
  );

  logger.info('[docusign] Saved credentials', { organizationId, environment });
}

// ─── API Client ───────────────────────────────────────────────────────

/**
 * Make authenticated request to DocuSign API
 */
async function docuSignRequest<T>(
  organizationId: string,
  method: string,
  endpoint: string,
  body?: unknown
): Promise<T> {
  const creds = await getCredentials(organizationId);
  if (!creds || !creds.accessToken) {
    throw new Error('DocuSign not configured for this organization');
  }

  const baseUrl = creds.environment === 'production'
    ? 'https://na4.docusign.net/restapi/v2.1'
    : 'https://demo.docusign.net/restapi/v2.1';

  const url = `${baseUrl}/accounts/${creds.accountId}${endpoint}`;

  const response = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${creds.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error('[docusign] API error', { status: response.status, error });
    throw new Error(`DocuSign API error: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

// ─── Envelope Operations ──────────────────────────────────────────────

/**
 * Create and send an envelope for signing
 */
export async function createEnvelope(
  organizationId: string,
  request: CreateEnvelopeRequest,
  createdBy?: string
): Promise<string> {
  // Build DocuSign envelope definition
  const envelopeDefinition = {
    emailSubject: request.subject,
    emailBlurb: request.message,
    status: 'sent', // Send immediately
    documents: request.documents.map((doc, idx) => ({
      documentId: String(idx + 1),
      name: doc.name,
      documentBase64: doc.base64Content,
      fileExtension: doc.fileExtension,
    })),
    recipients: {
      signers: request.signers.map((signer, idx) => ({
        email: signer.email,
        name: signer.name,
        recipientId: String(idx + 1),
        routingOrder: signer.routingOrder ?? idx + 1,
        tabs: {
          signHereTabs: [{ documentId: '1', pageNumber: '1', xPosition: '100', yPosition: '100' }],
        },
      })),
      carbonCopies: request.ccRecipients?.map((cc, idx) => ({
        email: cc.email,
        name: cc.name,
        recipientId: String(100 + idx),
        routingOrder: 99,
      })) ?? [],
    },
  };

  // Send to DocuSign
  const response = await docuSignRequest<{ envelopeId: string }>(
    organizationId,
    'POST',
    '/envelopes',
    envelopeDefinition
  );

  const envelopeId = response.envelopeId;

  // Store in our database
  await query(
    `INSERT INTO signing_envelopes (
      organization_id, deal_id, provider, external_envelope_id,
      envelope_type, subject, message, documents, status, sent_at, created_by
    ) VALUES ($1, $2, 'docusign', $3, $4, $5, $6, $7, 'sent', NOW(), $8)`,
    [
      organizationId,
      request.dealId,
      envelopeId,
      request.envelopeType,
      request.subject,
      request.message,
      JSON.stringify(request.documents.map((d, i) => ({ name: d.name, documentId: String(i + 1) }))),
      createdBy,
    ]
  );

  // Store recipients
  const envelopeResult = await query(
    `SELECT id FROM signing_envelopes WHERE external_envelope_id = $1`,
    [envelopeId]
  );
  const internalEnvelopeId = envelopeResult.rows[0]?.id;

  for (const signer of request.signers) {
    await query(
      `INSERT INTO signing_recipients (
        envelope_id, recipient_type, routing_order, name, email, status
      ) VALUES ($1, 'signer', $2, $3, $4, 'sent')`,
      [internalEnvelopeId, signer.routingOrder ?? 1, signer.name, signer.email]
    );
  }

  logger.info('[docusign] Created envelope', { organizationId, envelopeId, dealId: request.dealId });

  return envelopeId;
}

/**
 * Get envelope status
 */
export async function getEnvelopeStatus(
  organizationId: string,
  envelopeId: string
): Promise<DocuSignEnvelope> {
  const response = await docuSignRequest<{
    envelopeId: string;
    status: string;
    emailSubject: string;
    sentDateTime: string;
    completedDateTime?: string;
    recipients: {
      signers: {
        recipientId: string;
        email: string;
        name: string;
        status: string;
        signedDateTime?: string;
        routingOrder: string;
      }[];
    };
  }>(
    organizationId,
    'GET',
    `/envelopes/${envelopeId}`
  );

  return {
    envelopeId: response.envelopeId,
    status: response.status as DocuSignEnvelope['status'],
    subject: response.emailSubject,
    documents: [],
    recipients: response.recipients.signers.map(s => ({
      recipientId: s.recipientId,
      recipientType: 'signer' as const,
      routingOrder: parseInt(s.routingOrder),
      name: s.name,
      email: s.email,
      status: s.status as 'created' | 'sent' | 'delivered' | 'signed' | 'declined',
      signedAt: s.signedDateTime ? new Date(s.signedDateTime) : undefined,
    })),
    sentAt: response.sentDateTime ? new Date(response.sentDateTime) : undefined,
    completedAt: response.completedDateTime ? new Date(response.completedDateTime) : undefined,
  };
}

/**
 * Handle webhook event from DocuSign
 */
export async function handleWebhook(
  organizationId: string,
  event: {
    event: string;
    data: {
      envelopeId: string;
      envelopeSummary?: {
        status: string;
        completedDateTime?: string;
      };
      recipientId?: string;
      recipientEmail?: string;
      status?: string;
      signedDateTime?: string;
    };
  }
): Promise<void> {
  const { envelopeId } = event.data;

  // Log event
  await query(
    `INSERT INTO integration_events (
      organization_id, provider, event_type, event_id, payload
    ) VALUES ($1, 'docusign', $2, $3, $4)`,
    [organizationId, event.event, envelopeId, JSON.stringify(event)]
  );

  // Update envelope status
  if (event.data.envelopeSummary) {
    await query(
      `UPDATE signing_envelopes 
       SET status = $1, 
           completed_at = CASE WHEN $1 = 'completed' THEN NOW() ELSE completed_at END,
           updated_at = NOW()
       WHERE external_envelope_id = $2`,
      [event.data.envelopeSummary.status, envelopeId]
    );
  }

  // Update recipient status
  if (event.data.recipientEmail && event.data.status) {
    await query(
      `UPDATE signing_recipients sr
       SET status = $1,
           signed_at = CASE WHEN $1 = 'signed' THEN NOW() ELSE signed_at END
       FROM signing_envelopes se
       WHERE sr.envelope_id = se.id 
         AND se.external_envelope_id = $2
         AND sr.email = $3`,
      [event.data.status, envelopeId, event.data.recipientEmail]
    );
  }

  logger.info('[docusign] Processed webhook', { 
    organizationId, 
    event: event.event, 
    envelopeId 
  });
}

/**
 * Get all envelopes for a deal
 */
export async function getEnvelopesForDeal(dealId: string): Promise<{
  id: string;
  envelopeType: string;
  subject: string;
  status: string;
  sentAt: Date | null;
  completedAt: Date | null;
  signerCount: number;
  signedCount: number;
}[]> {
  const result = await query(`
    SELECT 
      se.id, se.envelope_type, se.subject, se.status, se.sent_at, se.completed_at,
      COUNT(sr.id) as signer_count,
      COUNT(sr.id) FILTER (WHERE sr.status = 'signed') as signed_count
    FROM signing_envelopes se
    LEFT JOIN signing_recipients sr ON sr.envelope_id = se.id AND sr.recipient_type = 'signer'
    WHERE se.deal_id = $1
    GROUP BY se.id
    ORDER BY se.created_at DESC
  `, [dealId]);

  return (result.rows as Record<string, unknown>[]).map(row => ({
    id: String(row.id),
    envelopeType: String(row.envelope_type ?? ''),
    subject: String(row.subject ?? ''),
    status: String(row.status),
    sentAt: row.sent_at ? new Date(row.sent_at as string) : null,
    completedAt: row.completed_at ? new Date(row.completed_at as string) : null,
    signerCount: Number(row.signer_count ?? 0),
    signedCount: Number(row.signed_count ?? 0),
  }));
}

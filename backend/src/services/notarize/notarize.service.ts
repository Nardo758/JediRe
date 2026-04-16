import { getPool } from '../../database/connection';
import type { NotarizeProvider, NotarizeSessionRequest } from './provider.interface';
import { NotarizeComAdapter } from './notarize-com.adapter';
import { logActivity, type LogActivityParams } from '../activity-log.service';

let providerInstance: NotarizeProvider | null = null;

function getProvider(): NotarizeProvider {
  if (!providerInstance) {
    providerInstance = new NotarizeComAdapter();
  }
  return providerInstance;
}

export interface InitiateClosingParams {
  dealId: string;
  userId: string;
  documentIds: string[];
  signers: Array<{ name: string; email: string; phone?: string; role?: string }>;
  scheduledAt?: string;
}

export async function initiateClosing(params: InitiateClosingParams) {
  const pool = getPool();
  const provider = getProvider();

  const dealResult = await pool.query(
    'SELECT id, name, pipeline_stage, org_id, user_id FROM deals WHERE id = $1',
    [params.dealId],
  );
  if (dealResult.rows.length === 0) {
    throw new Error('Deal not found');
  }
  const deal = dealResult.rows[0];

  const existingSession = await pool.query(
    "SELECT id, status FROM notarize_sessions WHERE deal_id = $1 AND status NOT IN ('completed', 'cancelled', 'failed') ORDER BY created_at DESC LIMIT 1",
    [params.dealId],
  );
  if (existingSession.rows.length > 0) {
    throw new Error(`Active notarization session already exists (status: ${existingSession.rows[0].status})`);
  }

  const docResult = await pool.query(
    'SELECT id, original_filename, filename FROM deal_files WHERE deal_id = $1 AND id = ANY($2::uuid[])',
    [params.dealId, params.documentIds],
  );
  const documents = docResult.rows.map((d: any) => ({
    id: d.id,
    name: d.original_filename || d.filename,
  }));

  if (documents.length === 0) {
    throw new Error('No valid documents found for notarization');
  }

  const callbackUrl = `${process.env.BASE_URL || 'https://localhost:4000'}/api/v1/webhooks/notarize`;

  let providerResponse;
  let providerSessionId = null;
  let sessionStatus = 'initiated';
  let errorMessage = null;

  try {
    const request: NotarizeSessionRequest = {
      dealId: params.dealId,
      documents,
      signers: params.signers,
      scheduledAt: params.scheduledAt,
      callbackUrl,
    };
    providerResponse = await provider.createSession(request);
    providerSessionId = providerResponse.providerSessionId;
    sessionStatus = providerResponse.status || 'initiated';
  } catch (err: any) {
    sessionStatus = 'provider_error';
    errorMessage = err.message;
    console.error('[Notarize] Provider create session error:', err.message);
  }

  const sessionResult = await pool.query(
    `INSERT INTO notarize_sessions
      (deal_id, org_id, provider, provider_session_id, status, document_ids, document_names,
       initiated_by, signer_count, error_message, scheduled_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [
      params.dealId,
      deal.org_id || null,
      provider.name,
      providerSessionId,
      sessionStatus,
      params.documentIds,
      documents.map(d => d.name),
      params.userId,
      params.signers.length,
      errorMessage,
      params.scheduledAt || null,
    ],
  );
  const session = sessionResult.rows[0];

  const signerInserts = params.signers.map((s, i) => {
    const providerSigner = providerResponse?.signers?.[i];
    return pool.query(
      `INSERT INTO notarize_signers (session_id, provider_signer_id, name, email, phone, role, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        session.id,
        providerSigner?.providerSignerId || null,
        s.name,
        s.email,
        s.phone || null,
        s.role || 'signer',
        providerSigner?.status || 'pending',
      ],
    );
  });
  const signerResults = await Promise.all(signerInserts);
  const signers = signerResults.map(r => r.rows[0]);

  try {
    await logActivity({
      dealId: params.dealId,
      orgId: deal.org_id || undefined,
      userId: params.userId,
      userName: 'system',
      action: 'notarize_initiated',
      entityType: 'notarize_session',
      entityId: session.id,
      metadata: {
        provider: provider.name,
        documentCount: documents.length,
        signerCount: params.signers.length,
        status: sessionStatus,
      },
    });
  } catch {}

  return { session, signers, providerResponse };
}

export async function getSessionStatus(dealId: string) {
  const pool = getPool();
  const provider = getProvider();

  const sessionResult = await pool.query(
    "SELECT * FROM notarize_sessions WHERE deal_id = $1 ORDER BY created_at DESC LIMIT 1",
    [dealId],
  );
  if (sessionResult.rows.length === 0) return null;
  const session = sessionResult.rows[0];

  const signersResult = await pool.query(
    'SELECT * FROM notarize_signers WHERE session_id = $1 ORDER BY created_at',
    [session.id],
  );

  if (session.provider_session_id && !['completed', 'cancelled', 'failed'].includes(session.status)) {
    try {
      const providerStatus = await provider.getSessionStatus(session.provider_session_id);

      for (const ps of providerStatus.signers) {
        await pool.query(
          `UPDATE notarize_signers
           SET status = $1, kba_verified = $2, id_verified = $3, signed_at = $4, updated_at = NOW()
           WHERE session_id = $5 AND (provider_signer_id = $6 OR email = $7)`,
          [ps.status, ps.kbaVerified, ps.idVerified, ps.signedAt || null, session.id, ps.providerSignerId, ps.email],
        );
      }

      const verifiedCount = providerStatus.signers.filter(s => s.kbaVerified || s.idVerified).length;
      const completedCount = providerStatus.signers.filter(s => s.status === 'completed' || s.signedAt).length;

      await pool.query(
        `UPDATE notarize_sessions
         SET status = $1, signers_verified = $2, signers_completed = $3,
             notary_name = $4, notary_commission = $5, notary_state = $6,
             recording_url = $7, updated_at = NOW()
         WHERE id = $8`,
        [
          providerStatus.status,
          verifiedCount,
          completedCount,
          providerStatus.notary?.name || session.notary_name,
          providerStatus.notary?.commission || session.notary_commission,
          providerStatus.notary?.state || session.notary_state,
          providerStatus.recordingUrl || session.recording_url,
          session.id,
        ],
      );

      const refreshed = await pool.query('SELECT * FROM notarize_sessions WHERE id = $1', [session.id]);
      const refreshedSigners = await pool.query('SELECT * FROM notarize_signers WHERE session_id = $1 ORDER BY created_at', [session.id]);
      return { session: refreshed.rows[0], signers: refreshedSigners.rows };
    } catch (err: any) {
      console.error('[Notarize] Status refresh error:', err.message);
    }
  }

  return { session, signers: signersResult.rows };
}

export async function cancelSession(dealId: string, userId: string, reason?: string) {
  const pool = getPool();
  const provider = getProvider();

  const sessionResult = await pool.query(
    "SELECT * FROM notarize_sessions WHERE deal_id = $1 AND status NOT IN ('completed', 'cancelled', 'failed') ORDER BY created_at DESC LIMIT 1",
    [dealId],
  );
  if (sessionResult.rows.length === 0) {
    throw new Error('No active notarization session found');
  }
  const session = sessionResult.rows[0];

  if (session.provider_session_id) {
    try {
      await provider.cancelSession(session.provider_session_id, reason);
    } catch (err: any) {
      console.error('[Notarize] Provider cancel error:', err.message);
    }
  }

  await pool.query(
    `UPDATE notarize_sessions
     SET status = 'cancelled', cancelled_at = NOW(), cancel_reason = $1, updated_at = NOW()
     WHERE id = $2`,
    [reason || 'Cancelled by user', session.id],
  );

  try {
    await logActivity({
      dealId,
      orgId: session.org_id || undefined,
      userId,
      userName: 'system',
      action: 'notarize_cancelled',
      entityType: 'notarize_session',
      entityId: session.id,
      metadata: { reason },
    });
  } catch {}

  return { success: true, sessionId: session.id };
}

export async function getCertificate(dealId: string) {
  const pool = getPool();
  const provider = getProvider();

  const sessionResult = await pool.query(
    "SELECT * FROM notarize_sessions WHERE deal_id = $1 AND status = 'completed' ORDER BY completed_at DESC LIMIT 1",
    [dealId],
  );
  if (sessionResult.rows.length === 0) {
    throw new Error('No completed notarization session found');
  }
  const session = sessionResult.rows[0];

  if (session.certificate_url) {
    return { certificateUrl: session.certificate_url, sessionId: session.id };
  }

  if (session.provider_session_id) {
    try {
      const cert = await provider.downloadCertificate(session.provider_session_id);
      await pool.query(
        'UPDATE notarize_sessions SET certificate_url = $1, updated_at = NOW() WHERE id = $2',
        [cert.certificateUrl, session.id],
      );
      return { certificateUrl: cert.certificateUrl, documentUrls: cert.documentUrls, sessionId: session.id };
    } catch (err: any) {
      throw new Error(`Failed to download certificate: ${err.message}`);
    }
  }

  throw new Error('No provider session ID for certificate download');
}

export async function handleWebhook(eventType: string, payload: any, signature?: string) {
  const pool = getPool();
  const provider = getProvider();

  if (!signature) {
    console.warn('[Notarize] Missing webhook signature header');
    throw new Error('Missing webhook signature');
  }

  const isValid = provider.verifyWebhookSignature(JSON.stringify(payload), signature);
  if (!isValid) {
    console.warn('[Notarize] Invalid webhook signature');
    throw new Error('Invalid webhook signature');
  }

  const providerSessionId = payload.session_id || payload.id;

  let sessionId: string | null = null;
  if (providerSessionId) {
    const sess = await pool.query(
      'SELECT id FROM notarize_sessions WHERE provider_session_id = $1',
      [providerSessionId],
    );
    sessionId = sess.rows[0]?.id || null;
  }

  await pool.query(
    `INSERT INTO notarize_webhooks (provider, event_type, provider_session_id, session_id, payload, signature)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    ['notarize', eventType, providerSessionId, sessionId, JSON.stringify(payload), signature || null],
  );

  if (!sessionId) {
    console.warn('[Notarize] Webhook for unknown session:', providerSessionId);
    return { processed: false };
  }

  const sessionResult = await pool.query('SELECT * FROM notarize_sessions WHERE id = $1', [sessionId]);
  const session = sessionResult.rows[0];
  if (!session) return { processed: false };

  switch (eventType) {
    case 'signer.verified':
    case 'participant.verified': {
      const signerEmail = payload.participant?.email || payload.signer?.email;
      if (signerEmail) {
        await pool.query(
          `UPDATE notarize_signers SET kba_verified = TRUE, id_verified = TRUE, status = 'verified',
             verification_method = $1, updated_at = NOW()
           WHERE session_id = $2 AND email = $3`,
          [payload.verification_method || 'kba', sessionId, signerEmail],
        );
        const verifiedCount = await pool.query(
          "SELECT COUNT(*) as cnt FROM notarize_signers WHERE session_id = $1 AND (kba_verified = TRUE OR id_verified = TRUE)",
          [sessionId],
        );
        await pool.query(
          'UPDATE notarize_sessions SET signers_verified = $1, status = $2, updated_at = NOW() WHERE id = $3',
          [parseInt(verifiedCount.rows[0].cnt), 'in_progress', sessionId],
        );
      }
      break;
    }

    case 'signer.completed':
    case 'participant.signed': {
      const signerEmail = payload.participant?.email || payload.signer?.email;
      if (signerEmail) {
        await pool.query(
          `UPDATE notarize_signers SET status = 'completed', signed_at = NOW(), updated_at = NOW()
           WHERE session_id = $1 AND email = $2`,
          [sessionId, signerEmail],
        );
        const completedCount = await pool.query(
          "SELECT COUNT(*) as cnt FROM notarize_signers WHERE session_id = $1 AND status = 'completed'",
          [sessionId],
        );
        await pool.query(
          'UPDATE notarize_sessions SET signers_completed = $1, updated_at = NOW() WHERE id = $2',
          [parseInt(completedCount.rows[0].cnt), sessionId],
        );
      }
      break;
    }

    case 'session.completed': {
      await pool.query(
        `UPDATE notarize_sessions
         SET status = 'completed', completed_at = NOW(),
             recording_url = COALESCE($1, recording_url),
             certificate_url = COALESCE($2, certificate_url),
             notary_name = COALESCE($3, notary_name),
             notary_commission = COALESCE($4, notary_commission),
             notary_state = COALESCE($5, notary_state),
             updated_at = NOW()
         WHERE id = $6`,
        [
          payload.recording_url || null,
          payload.certificate_url || null,
          payload.notary?.name || null,
          payload.notary?.commission || null,
          payload.notary?.state || null,
          sessionId,
        ],
      );

      await pool.query(
        "UPDATE notarize_signers SET status = 'completed', signed_at = COALESCE(signed_at, NOW()), updated_at = NOW() WHERE session_id = $1",
        [sessionId],
      );

      await pool.query(
        "UPDATE deals SET pipeline_stage = 'post_close', updated_at = NOW() WHERE id = $1",
        [session.deal_id],
      );

      try {
        await logActivity({
          dealId: session.deal_id,
          orgId: session.org_id || undefined,
          userId: session.initiated_by || 'system',
          userName: 'system',
          action: 'notarize_completed',
          entityType: 'notarize_session',
          entityId: sessionId,
          metadata: {
            notaryName: payload.notary?.name,
            documentCount: session.document_ids?.length || 0,
          },
        });

        await logActivity({
          dealId: session.deal_id,
          orgId: session.org_id || undefined,
          userId: session.initiated_by || '00000000-0000-0000-0000-000000000000',
          userName: 'system',
          action: 'pipeline_advanced',
          entityType: 'deal',
          entityId: session.deal_id,
          metadata: {
            from: 'execution',
            to: 'post_close',
            trigger: 'notarize_session_completed',
          },
        });
      } catch {}
      break;
    }

    case 'session.failed': {
      await pool.query(
        `UPDATE notarize_sessions SET status = 'failed', error_message = $1, updated_at = NOW() WHERE id = $2`,
        [payload.error || payload.reason || 'Session failed', sessionId],
      );

      try {
        await logActivity({
          dealId: session.deal_id,
          orgId: session.org_id || undefined,
          userId: session.initiated_by || 'system',
          userName: 'system',
          action: 'notarize_failed',
          entityType: 'notarize_session',
          entityId: sessionId,
          metadata: { error: payload.error || payload.reason },
        });
      } catch {}
      break;
    }

    default:
      console.log(`[Notarize] Unhandled webhook event: ${eventType}`);
  }

  await pool.query(
    'UPDATE notarize_webhooks SET processed = TRUE, processed_at = NOW() WHERE provider_session_id = $1 AND event_type = $2 AND processed = FALSE',
    [providerSessionId, eventType],
  );

  return { processed: true, sessionId };
}

export async function getSessionHistory(dealId: string) {
  const pool = getPool();
  const result = await pool.query(
    `SELECT ns.*, 
       json_agg(json_build_object(
         'id', nsg.id, 'name', nsg.name, 'email', nsg.email,
         'status', nsg.status, 'kba_verified', nsg.kba_verified,
         'id_verified', nsg.id_verified, 'signed_at', nsg.signed_at, 'role', nsg.role
       ) ORDER BY nsg.created_at) as signers
     FROM notarize_sessions ns
     LEFT JOIN notarize_signers nsg ON nsg.session_id = ns.id
     WHERE ns.deal_id = $1
     GROUP BY ns.id
     ORDER BY ns.created_at DESC`,
    [dealId],
  );
  return result.rows;
}

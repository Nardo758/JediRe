/**
 * OpenClaw action dispatcher.
 *
 * Channel-agnostic: takes a (channel, senderId, actionId, resourceId?) tuple
 * from either the Telegram callback handler or the Twilio inbound webhook,
 * verifies the sender is authorized for that channel, runs the action, and
 * returns a plain-text confirmation/error message to send back.
 *
 * v1 actions perform real work:
 *   - approve  : marks the deal as approved + writes a deal_activity row
 *   - dismiss  : writes a deal_activity row recording the dismissal
 *   - rerun    : re-triggers the JEDI Score analysis (fire-and-forget; the
 *                completion notifier will fan out when it finishes)
 *
 * All side-effects are recorded against a synthetic SYSTEM_USER_ID with the
 * channel + sender id captured in metadata, because OpenClaw senders
 * (Telegram chat ids, phone numbers) are not first-class JediRe users.
 */

import { pool } from '../../database';
import { logger } from '../../utils/logger';
import { telegramChannel } from './channels/telegram';
import { twilioChannel } from './channels/twilio';
import type { ActionDispatchResult, ChannelName, NotificationChannel } from './types';

/**
 * Synthetic system user used for activity rows that originate from OpenClaw.
 * Matches the seeded agent user from the agent platform foundation migration
 * (see backend/src/db/migrations/20260419_010_agent_platform_foundation.sql).
 */
const OPENCLAW_SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';

function getChannel(name: ChannelName): NotificationChannel {
  switch (name) {
    case 'telegram': return telegramChannel;
    case 'twilio': return twilioChannel;
  }
}

/**
 * Authorize + execute. Caller (the inbound webhook handler) is responsible
 * for using the returned `message` to reply to the sender via the same
 * channel — this function does not itself send replies.
 */
export async function dispatchAction(input: {
  channel: ChannelName;
  senderId: string;
  actionId: string;
  resourceId?: string;
}): Promise<ActionDispatchResult> {
  const { channel, senderId, actionId, resourceId } = input;

  const ch = getChannel(channel);
  if (!ch.isAuthorized(senderId)) {
    logger.warn('OpenClaw action denied', { channel, senderId, actionId });
    return {
      ok: false,
      message: 'You are not authorized to invoke this action.',
    };
  }

  try {
    switch (actionId) {
      case 'approve':
        return await handleApprove(resourceId, channel, senderId);
      case 'dismiss':
        return await handleDismiss(resourceId, channel, senderId);
      case 'rerun':
      case 'rerun_agent':
        return await handleRerun(resourceId, channel, senderId);
      default:
        return {
          ok: false,
          message: `Unknown action: ${actionId}`,
        };
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'unknown error';
    logger.error('OpenClaw action handler threw', {
      channel,
      actionId,
      resourceId,
      error: message,
    });
    return {
      ok: false,
      message: `Action failed: ${message}`,
    };
  }
}

// ─── Handlers ───────────────────────────────────────────────────────────────

async function handleApprove(
  resourceId: string | undefined,
  channel: ChannelName,
  senderId: string,
): Promise<ActionDispatchResult> {
  if (!resourceId) {
    return { ok: false, message: 'Approve requires a resource id (e.g. "approve abc123").' };
  }

  // Update the deal's status to 'approved' and record an activity row. We use
  // a single transaction so an existing approved deal still gets an audit
  // trail entry and we never end up with a status update without a log line.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const updated = await client.query(
      `UPDATE deals
          SET status = 'approved', updated_at = NOW()
        WHERE id = $1
        RETURNING id, name`,
      [resourceId],
    );
    if (updated.rowCount === 0) {
      await client.query('ROLLBACK');
      return { ok: false, message: `Deal ${resourceId} not found.` };
    }
    await client.query(
      `INSERT INTO deal_activity (deal_id, user_id, action_type, description, metadata)
       VALUES ($1, $2, 'openclaw_approved', $3, $4)`,
      [
        resourceId,
        OPENCLAW_SYSTEM_USER_ID,
        `Approved via OpenClaw (${channel})`,
        JSON.stringify({ channel, senderId }),
      ],
    );
    await client.query('COMMIT');
    logger.info('OpenClaw approve action committed', { resourceId, channel, senderId });
    return {
      ok: true,
      message: `Approved ${updated.rows[0].name || resourceId}.`,
      editOriginal: true,
    };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

async function handleDismiss(
  resourceId: string | undefined,
  channel: ChannelName,
  senderId: string,
): Promise<ActionDispatchResult> {
  // Persist the dismissal as an activity row (idempotent — multiple dismisses
  // are allowed and are simply additional audit entries). We don't fail the
  // action if the deal id doesn't exist or wasn't a real deal id (some
  // notifications carry non-deal resource ids), since "dismiss" is essentially
  // an acknowledgement.
  if (resourceId) {
    try {
      await pool.query(
        `INSERT INTO deal_activity (deal_id, user_id, action_type, description, metadata)
         SELECT $1, $2, 'openclaw_dismissed', $3, $4
          WHERE EXISTS (SELECT 1 FROM deals WHERE id = $1)`,
        [
          resourceId,
          OPENCLAW_SYSTEM_USER_ID,
          `Dismissed via OpenClaw (${channel})`,
          JSON.stringify({ channel, senderId }),
        ],
      );
    } catch (err: unknown) {
      // Don't fail dismiss because of a logging hiccup — the user still wants
      // the visual ack on their phone.
      logger.warn('OpenClaw dismiss: activity log insert failed', {
        resourceId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  logger.info('OpenClaw dismiss action recorded', { resourceId, channel, senderId });
  return {
    ok: true,
    message: resourceId ? `Dismissed ${resourceId}.` : 'Dismissed.',
    editOriginal: true,
  };
}

async function handleRerun(
  resourceId: string | undefined,
  channel: ChannelName,
  senderId: string,
): Promise<ActionDispatchResult> {
  if (!resourceId) {
    return { ok: false, message: 'Rerun requires a resource id (e.g. "rerun <deal-id>").' };
  }

  // Fetch deal details + boundary GeoJSON so we can hand them to the analysis
  // service. If the deal doesn't exist or has no boundary we fail loudly so
  // the user sees a useful error in the reply, not a silent no-op.
  const dealRow = await pool.query(
    `SELECT id, name, target_units, budget,
            ST_AsGeoJSON(boundary) AS boundary_geojson
       FROM deals
      WHERE id = $1`,
    [resourceId],
  );
  if (dealRow.rowCount === 0) {
    return { ok: false, message: `Deal ${resourceId} not found.` };
  }
  const deal = dealRow.rows[0];
  if (!deal.boundary_geojson) {
    return {
      ok: false,
      message: `Deal ${deal.name || resourceId} has no boundary defined yet — cannot run analysis.`,
    };
  }

  // Log the rerun request as activity so the audit trail captures who
  // triggered it and from which channel.
  await pool.query(
    `INSERT INTO deal_activity (deal_id, user_id, action_type, description, metadata)
     VALUES ($1, $2, 'openclaw_rerun_triggered', $3, $4)`,
    [
      resourceId,
      OPENCLAW_SYSTEM_USER_ID,
      `Re-run analysis triggered via OpenClaw (${channel})`,
      JSON.stringify({ channel, senderId }),
    ],
  );

  // Fire-and-forget the analysis. The completion notifier
  // (notifyAnalysisComplete) will fan out when it's done, so we return
  // immediately with a confirmation. Any error is logged but doesn't block
  // the reply — the user already knows the rerun was queued.
  void runAnalysisAsync({
    dealId: deal.id,
    dealName: deal.name,
    boundary: JSON.parse(deal.boundary_geojson),
    targetUnits: deal.target_units ?? undefined,
    budget: deal.budget ?? undefined,
  });

  logger.info('OpenClaw rerun action dispatched', { resourceId, channel, senderId });
  return {
    ok: true,
    message: `Re-running analysis for ${deal.name || resourceId}. You'll get a notification when it finishes.`,
    editOriginal: true,
  };
}

/**
 * Kick off the analysis in the background. Imported lazily to avoid a
 * top-level import cycle (dealAnalysis.ts already imports the notifier
 * which lives next door to this file).
 */
async function runAnalysisAsync(input: {
  dealId: string;
  dealName: string;
  boundary: unknown;
  targetUnits?: number;
  budget?: number;
}): Promise<void> {
  try {
    const { DealAnalysisService } = await import('../dealAnalysis');
    const service = new DealAnalysisService(pool);
    await service.analyzeDeal(input as Parameters<typeof service.analyzeDeal>[0]);
  } catch (err: unknown) {
    logger.error('OpenClaw rerun: analysis failed', {
      dealId: input.dealId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

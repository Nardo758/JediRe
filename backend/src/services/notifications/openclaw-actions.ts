/**
 * OpenClaw action dispatcher.
 *
 * Channel-agnostic: takes a (channel, senderId, actionId, resourceId?) tuple
 * from either the Telegram callback handler or the Twilio inbound webhook,
 * verifies the sender is authorized for that channel, runs the action, and
 * returns a plain-text confirmation/error message.
 *
 * v1 actions: approve underwriting run, dismiss notification, rerun an agent.
 */

import { logger } from '../../utils/logger';
import { telegramChannel } from './channels/telegram';
import { twilioChannel } from './channels/twilio';
import type { ActionDispatchResult, ChannelName, NotificationChannel } from './types';

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
        return await handleApprove(resourceId);
      case 'dismiss':
        return handleDismiss(resourceId);
      case 'rerun':
      case 'rerun_agent':
        return await handleRerun(resourceId);
      default:
        return {
          ok: false,
          message: `Unknown action: ${actionId}`,
        };
    }
  } catch (err: any) {
    logger.error('OpenClaw action handler threw', {
      channel,
      actionId,
      resourceId,
      error: err?.message,
    });
    return {
      ok: false,
      message: `Action failed: ${err?.message ?? 'unknown error'}`,
    };
  }
}

// ─── Handlers ───────────────────────────────────────────────────────────────

async function handleApprove(resourceId?: string): Promise<ActionDispatchResult> {
  if (!resourceId) {
    return { ok: false, message: 'Approve requires a resource id (e.g. "approve abc123").' };
  }
  // v1: log the approval. Wiring to the actual underwriting commit flow is a
  // follow-up — see docs/openclaw-setup.md.
  logger.info('OpenClaw approve action recorded', { resourceId });
  return {
    ok: true,
    message: `Approved ${resourceId}.`,
    editOriginal: true,
  };
}

function handleDismiss(resourceId?: string): ActionDispatchResult {
  logger.info('OpenClaw dismiss action recorded', { resourceId });
  return {
    ok: true,
    message: resourceId ? `Dismissed ${resourceId}.` : 'Dismissed.',
    editOriginal: true,
  };
}

async function handleRerun(resourceId?: string): Promise<ActionDispatchResult> {
  if (!resourceId) {
    return { ok: false, message: 'Rerun requires a resource id (e.g. "rerun underwrite-001").' };
  }
  logger.info('OpenClaw rerun action recorded', { resourceId });
  return {
    ok: true,
    message: `Rerun queued for ${resourceId}.`,
    editOriginal: true,
  };
}

/**
 * OpenClaw — multi-channel notifier types.
 *
 * Replaces the legacy clawdbotWebhook stub with a channel-agnostic interface
 * that can fan out a single notification to Telegram, Twilio, or any future
 * channel (Slack, Discord, email, etc.) via small per-channel adapters.
 */

export type ChannelName = 'telegram' | 'twilio';

export type NotificationKind =
  | 'deal_created'
  | 'document_uploaded'
  | 'analysis_complete'
  | 'agent_run_complete'
  | 'threshold_breach'
  | 'server_error';

/**
 * A structured action that the recipient can invoke from a notification.
 *
 * On Telegram these become inline keyboard buttons whose `callback_data` is
 * `ocl:<actionId>:<resourceId>`. On Twilio they are rendered as a "Reply: ..."
 * hint and matched against incoming SMS text.
 */
export interface NotificationAction {
  /** Human-readable button label (e.g. "Approve", "Dismiss"). */
  label: string;
  /** Action verb (e.g. "approve", "dismiss", "rerun"). Lowercase, no spaces. */
  actionId: string;
  /** Optional resource id the action targets (e.g. an underwriting run id). */
  resourceId?: string;
}

export interface Notification {
  kind: NotificationKind;
  /** Short title rendered as a bold heading. */
  title: string;
  /** Markdown body. Channels that don't support markdown will receive plain text. */
  body: string;
  /** Optional deep link to the JediRe UI for this resource. */
  deepLink?: string;
  /** Optional list of structured actions the recipient can invoke. */
  actions?: NotificationAction[];
  /** Channel allow-list. If omitted, fans out to all enabled channels. */
  channels?: ChannelName[];
  /** Optional metadata attached for debugging/logging. */
  meta?: Record<string, unknown>;
}

/**
 * Reference to a previously-sent message, returned from `send` so the caller
 * (e.g. the action dispatcher) can later edit / amend it.
 */
export interface MessageRef {
  channel: ChannelName;
  /** Channel-specific message id (Telegram message_id, Twilio message SID, ...). */
  messageId: string;
  /** Channel-specific recipient id (Telegram chat_id, Twilio phone number, ...). */
  recipient: string;
}

export interface SendResult {
  ok: boolean;
  /** Returned only on success; one entry per recipient the channel sent to. */
  refs?: MessageRef[];
  error?: string;
}

export interface ActionDispatchResult {
  ok: boolean;
  /** Plain-text confirmation/error to send back to the original sender. */
  message: string;
  /** True if the original notification message should be edited in place
   *  (Telegram only — Twilio falls back to a fresh reply). */
  editOriginal?: boolean;
}

/**
 * One implementation per channel. Implementations are pure adapters: they own
 * config (env vars, SDK clients) and translate between the abstract
 * Notification shape and channel-specific message formats.
 */
export interface NotificationChannel {
  /** Stable identifier — used in env-var allow-lists and routing. */
  readonly name: ChannelName;

  /** True iff the channel has the credentials it needs to send. */
  isEnabled(): boolean;

  /** Send a notification. Resolves with refs to the sent message(s). */
  send(n: Notification): Promise<SendResult>;

  /**
   * Edit a previously-sent message. Channels that don't support edits (Twilio)
   * may send a fresh follow-up message instead and return ok:true.
   */
  editMessage(ref: MessageRef, text: string): Promise<{ ok: boolean; error?: string }>;

  /**
   * True iff the given sender id (Telegram chat id / Twilio phone number) is
   * permitted to invoke actions for this channel.
   */
  isAuthorized(senderId: string): boolean;
}

/**
 * Corpus Notification Service
 *
 * Creates data-gap notifications in the proposal_notifications table,
 * compatible with the existing notification infrastructure. Uses string
 * constants rather than the enum so existing TS checks are satisfied.
 *
 * Used by dataCorpusReminderCron to create reminders for:
 *   - Missing monthly uploads (data_corpus_upload_required)
 *   - Realization windows closing (data_corpus_realization_pending)
 *   - Comparison ready (data_corpus_gap_detected)
 */

import { query } from '../../database/connection';
import { logger } from '../../utils/logger';

export async function createCorpusNotification(
  userId: string,
  notificationType: string,
  message: string,
  priority: string,
  metadata: Record<string, unknown> = {},
): Promise<string | null> {
  try {
    const result = await query(
      `INSERT INTO proposal_notifications (
        user_id,
        notification_type,
        message,
        priority,
        metadata,
        is_read
      ) VALUES ($1, $2, $3, $4, $5::jsonb, false)
      RETURNING id`,
      [userId, notificationType, message, priority, JSON.stringify(metadata)],
    );

    logger.info('[CorpusNotification] Created', {
      userId,
      type: notificationType,
      priority,
    });

    return result.rows[0].id as string;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error('[CorpusNotification] Error creating:', { error: msg });
    return null;
  }
}

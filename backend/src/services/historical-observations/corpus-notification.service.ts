/**
 * Corpus Notification Service
 *
 * Creates data-gap notifications in deal_notifications, compatible with the
 * existing notification infrastructure. Requires dealId because
 * deal_notifications.deal_id is NOT NULL.
 *
 * Deduplication: skips insert if a notification of the same type for the
 * same user × deal already exists today (prevents cron-retry duplicates).
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
  dealId: string,
  notificationType: string,
  message: string,
  metadata: Record<string, unknown> = {},
): Promise<string | null> {
  try {
    // Same-day deduplication: don't create a duplicate if one already exists
    // for this user × deal × type today. Prevents cron-retry spam (retries: 2).
    const dedupResult = await query(
      `SELECT id FROM deal_notifications
       WHERE user_id = $1
         AND deal_id = $2
         AND type = $3
         AND created_at >= CURRENT_DATE
       LIMIT 1`,
      [userId, dealId, notificationType],
    );

    if (dedupResult.rows.length > 0) {
      logger.debug('[CorpusNotification] Skipped duplicate', {
        userId,
        dealId,
        type: notificationType,
      });
      return dedupResult.rows[0].id as string;
    }

    const result = await query(
      `INSERT INTO deal_notifications (
        deal_id,
        user_id,
        type,
        message,
        metadata,
        read
      ) VALUES ($1, $2, $3, $4, $5::jsonb, false)
      RETURNING id`,
      [dealId, userId, notificationType, message, JSON.stringify(metadata)],
    );

    logger.info('[CorpusNotification] Created', {
      userId,
      dealId,
      type: notificationType,
    });

    return result.rows[0].id as string;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error('[CorpusNotification] Error creating:', { error: msg });
    return null;
  }
}

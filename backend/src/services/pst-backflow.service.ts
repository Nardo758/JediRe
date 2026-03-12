import { query } from '../database/connection';
import { logger } from '../utils/logger';

export async function backflowPstToEmails(uploadId: string, userId: string): Promise<{ inserted: number }> {
  let accountResult = await query(
    `SELECT id FROM email_accounts WHERE provider = 'pst_import' AND user_id = $1 LIMIT 1`,
    [userId]
  );

  if (accountResult.rows.length === 0) {
    accountResult = await query(
      `INSERT INTO email_accounts (user_id, email_address, provider, is_primary, sync_enabled)
       VALUES ($1, 'pst-import@jedire.com', 'pst_import', false, false)
       RETURNING id`,
      [userId]
    );
  }

  const accountId = accountResult.rows[0].id;

  const result = await query(
    `INSERT INTO emails (
      email_account_id, user_id, external_id, subject, from_name, from_address,
      to_addresses, body_preview, body_text, is_read, is_flagged, has_attachments, received_at, created_at
    )
    SELECT
      $1,
      $2,
      'pst-' || pei.id::text,
      pei.subject,
      CASE WHEN pei.sender LIKE '%<%' THEN TRIM(SPLIT_PART(pei.sender, '<', 1)) ELSE pei.sender END,
      CASE
        WHEN pei.sender LIKE '%<%>%' THEN TRIM(BOTH '<>' FROM SUBSTRING(pei.sender FROM '<([^>]+)>'))
        WHEN pei.sender LIKE '%@%' THEN pei.sender
        ELSE 'unknown@pst-import.local'
      END,
      pei.recipients,
      LEFT(pei.raw_body, 500),
      pei.raw_body,
      true,
      pei.has_signal,
      pei.has_attachments,
      COALESCE(pei.email_date, pei.created_at)::timestamp without time zone,
      NOW()
    FROM pst_email_imports pei
    JOIN data_uploads du ON du.id = pei.upload_id AND du.user_id = $2
    WHERE pei.upload_id = $3
      AND NOT EXISTS (SELECT 1 FROM emails e WHERE e.external_id = 'pst-' || pei.id::text)`,
    [accountId, userId, uploadId]
  );

  const inserted = result.rowCount || 0;
  logger.info(`PST backflow: inserted ${inserted} emails for upload ${uploadId}, user ${userId}`);
  return { inserted };
}

export async function backflowAllPstForUser(userId: string): Promise<{ inserted: number }> {
  const uploads = await query(
    `SELECT id FROM data_uploads WHERE user_id = $1 AND file_type = 'pst'`,
    [userId]
  );

  let totalInserted = 0;
  for (const upload of uploads.rows) {
    const result = await backflowPstToEmails(upload.id, userId);
    totalInserted += result.inserted;
  }

  return { inserted: totalInserted };
}

export async function runStartupPstBackflow(): Promise<void> {
  const usersWithPst = await query(
    `SELECT DISTINCT user_id FROM data_uploads WHERE file_type = 'pst'`
  );

  if (usersWithPst.rows.length === 0) {
    logger.info('PST backflow: no users with PST uploads found');
    return;
  }

  let totalInserted = 0;
  for (const row of usersWithPst.rows) {
    const result = await backflowAllPstForUser(row.user_id);
    totalInserted += result.inserted;
  }

  logger.info(`PST startup backflow complete: ${totalInserted} new emails backflowed for ${usersWithPst.rows.length} user(s)`);
}

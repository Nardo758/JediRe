/**
 * One-time re-encryption script for user_email_accounts tokens.
 *
 * Safe to re-run: already-encrypted rows are skipped (idempotent).
 * Run AFTER setting GMAIL_TOKEN_ENCRYPTION_KEY:
 *
 *   cd backend && npx ts-node --transpile-only src/scripts/encrypt-gmail-tokens.ts
 */

import 'dotenv/config';
import { Pool } from 'pg';
import { encryptToken, isEncrypted } from '../services/gmail-sync/token-encryption';
import { logger } from '../utils/logger';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

interface AccountRow {
  id: string;
  email_address: string;
  access_token: string | null;
  refresh_token: string | null;
}

async function main() {
  logger.info('[encrypt-gmail-tokens] Starting Gmail token re-encryption');

  const { rows } = await pool.query<AccountRow>(
    'SELECT id, email_address, access_token, refresh_token FROM user_email_accounts'
  );

  logger.info(`[encrypt-gmail-tokens] Found ${rows.length} account(s)`);

  let encrypted = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of rows) {
    try {
      const newAccess = row.access_token && !isEncrypted(row.access_token)
        ? encryptToken(row.access_token)
        : row.access_token;

      const newRefresh = row.refresh_token && !isEncrypted(row.refresh_token)
        ? encryptToken(row.refresh_token)
        : row.refresh_token;

      const changed =
        newAccess !== row.access_token ||
        newRefresh !== row.refresh_token;

      if (!changed) {
        skipped++;
        logger.info(`[encrypt-gmail-tokens] SKIP ${row.email_address} — already encrypted`);
        continue;
      }

      await pool.query(
        'UPDATE user_email_accounts SET access_token = $1, refresh_token = $2, updated_at = NOW() WHERE id = $3',
        [newAccess, newRefresh, row.id]
      );
      encrypted++;
      logger.info(`[encrypt-gmail-tokens] ENCRYPTED ${row.email_address}`);
    } catch (err: any) {
      errors++;
      logger.error(`[encrypt-gmail-tokens] ERROR on ${row.email_address}: ${err.message}`);
    }
  }

  logger.info('[encrypt-gmail-tokens] Done', { encrypted, skipped, errors });
  await pool.end();
  process.exit(errors > 0 ? 1 : 0);
}

main().catch((err) => {
  logger.error('[encrypt-gmail-tokens] Fatal:', err);
  process.exit(1);
});

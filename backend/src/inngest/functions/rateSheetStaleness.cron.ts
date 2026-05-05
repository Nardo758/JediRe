/**
 * Inngest Cron: Rate Sheet Staleness Check
 *
 * Fires every Sunday at 03:00 UTC.
 * Queries `rate_sheet_versions` for active sheets where valid_through is
 * within 30 days of NOW(). For each stale sheet found, creates an
 * `agent_runs` record with status='pending' so the Research Agent can
 * queue a re-verification pass.
 *
 * Architecture:
 *   Step 1 — Query rate_sheet_versions for expiring active sheets
 *   Step 2 — For each expiring sheet, insert agent_runs review task
 *   Step 3 — Log summary
 *
 * The `valid_through` column is optional in rate_sheet_versions. Sheets
 * without a valid_through value are skipped (treated as perpetually valid
 * until manually deprecated).
 *
 * Agent task payload stored in agent_runs.input:
 *   { task: 'rate_sheet_review', jurisdiction, year, current_version,
 *     valid_through, triggered_by: 'staleness_cron' }
 */

import { inngest } from '../../lib/inngest';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';

const STALENESS_WINDOW_DAYS = 30;

interface ExpiringSheet {
  jurisdiction: string;
  year: number;
  version: string;
  valid_through: string | null;
  days_until_expiry: number | null;
}

export const rateSheetStalenessCron = inngest.createFunction(
  {
    id: 'rate-sheet-staleness-check',
    name: 'Tax: weekly rate sheet staleness check',
    triggers: [{ cron: '0 3 * * 0' }], // Every Sunday at 03:00 UTC
    retries: 2,
  },
  async ({ step }) => {
    // ── Step 1: Find expiring active rate sheets ────────────────────────────
    const expiringSheets = await step.run('find-expiring-sheets', async () => {
      try {
        // Only query if valid_through column exists (migration guard)
        const columnCheck = await query(
          `SELECT column_name
             FROM information_schema.columns
            WHERE table_name = 'rate_sheet_versions'
              AND column_name = 'valid_through'`,
        );

        if (columnCheck.rows.length === 0) {
          // valid_through column not yet in schema — skip silently
          logger.info('[RateSheetStaleness] valid_through column not present — skipping');
          return [] as ExpiringSheet[];
        }

        const res = await query(
          `SELECT
             jurisdiction,
             year,
             version,
             valid_through::text,
             EXTRACT(EPOCH FROM (valid_through - NOW())) / 86400 AS days_until_expiry
           FROM rate_sheet_versions
           WHERE status = 'active'
             AND valid_through IS NOT NULL
             AND valid_through < NOW() + INTERVAL '${STALENESS_WINDOW_DAYS} days'
           ORDER BY valid_through ASC`,
        );
        return res.rows as ExpiringSheet[];
      } catch (err: any) {
        logger.warn('[RateSheetStaleness] query failed', { err: err?.message });
        return [] as ExpiringSheet[];
      }
    });

    if (expiringSheets.length === 0) {
      logger.info('[RateSheetStaleness] No expiring sheets found');
      return { checked: 0, tasksCreated: 0 };
    }

    // ── Step 2: Create agent review tasks ──────────────────────────────────
    const tasksCreated = await step.run('create-review-tasks', async () => {
      let created = 0;
      for (const sheet of expiringSheets) {
        try {
          await query(
            `INSERT INTO agent_runs
               (id, agent_id, agent_version, prompt_version,
                deal_id, user_id, triggered_by, trigger_context,
                status, input, tokens_in, tokens_out, cost_usd, started_at)
             VALUES (gen_random_uuid(), 'research', '1.0', 'rate_sheet_review_v1',
                     NULL, NULL, 'cron', NULL,
                     'pending', $1::jsonb, 0, 0, 0, NOW())`,
            [
              JSON.stringify({
                task: 'rate_sheet_review',
                jurisdiction: sheet.jurisdiction,
                year: sheet.year,
                current_version: sheet.version,
                valid_through: sheet.valid_through,
                days_until_expiry: sheet.days_until_expiry != null
                  ? Math.round(sheet.days_until_expiry)
                  : null,
                triggered_by: 'staleness_cron',
              }),
            ],
          );
          created++;
          logger.info('[RateSheetStaleness] Review task created', {
            jurisdiction: sheet.jurisdiction,
            year: sheet.year,
            days_until_expiry: sheet.days_until_expiry,
          });
        } catch (err: any) {
          logger.warn('[RateSheetStaleness] Failed to create task', {
            jurisdiction: sheet.jurisdiction,
            err: err?.message,
          });
        }
      }
      return created;
    });

    // ── Step 3: Log summary ────────────────────────────────────────────────
    await step.run('log-summary', async () => {
      logger.info('[RateSheetStaleness] Cron complete', {
        sheetsChecked: expiringSheets.length,
        tasksCreated,
        jurisdictions: expiringSheets.map(s => `${s.jurisdiction}-${s.year}`),
      });
    });

    return {
      checked: expiringSheets.length,
      tasksCreated,
    };
  },
);

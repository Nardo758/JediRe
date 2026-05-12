/**
 * Weekly Corpus Digest Cron — Inngest
 *
 * Runs every Monday at 09:00 UTC.
 * Aggregates data-gap status across the operator's full portfolio and emits
 * one DATA_CORPUS_WEEKLY_DIGEST in-app notification per user.
 *
 * Per HISTORICAL_OBSERVATIONS_SPEC.md §9.4.
 */

import { inngest } from '../../lib/inngest';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';
import { createCorpusNotification } from '../../services/historical-observations/corpus-notification.service';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PortfolioGapSummary {
  totalDeals: number;
  dealsWithCurrentData: number;
  dealsWithStaleData: number;
  dealsMissingData: number;
  dealsWithPendingRealization: number;
}

interface DealSummaryRow {
  dealId: string;
  dealName: string;
  userId: string;
  parcelId: string;
  lastUpload: Date | null;
  daysSince: number;
  hasPendingRealization: boolean;
}

// ─── Query ───────────────────────────────────────────────────────────────────

async function buildPortfolioDigest(): Promise<Map<string, { userId: string; summary: PortfolioGapSummary; dealRows: DealSummaryRow[] }>> {
  const sql = `
    SELECT
      d.id          AS deal_id,
      d.name        AS deal_name,
      d.user_id,
      COALESCE(p.parcel_id, dp.property_id::text) AS parcel_id,
      (
        SELECT MAX(observation_date)
        FROM historical_observations ho
        WHERE ho.parcel_id = COALESCE(p.parcel_id, dp.property_id::text)
          AND ho.is_subject_property = TRUE
      ) AS last_upload,
      (
        SELECT EXISTS (
          SELECT 1 FROM historical_observations ho2
          WHERE ho2.parcel_id = COALESCE(p.parcel_id, dp.property_id::text)
            AND ho2.is_subject_property = TRUE
            AND ho2.realized_rent_change_t12 IS NULL
            AND ho2.observation_date <= (NOW() - INTERVAL '11 months')
        )
      ) AS has_pending_realization
    FROM deals d
    JOIN deal_properties dp ON dp.deal_id = d.id
    LEFT JOIN properties p ON p.id = dp.property_id
    WHERE d.status IN ('active', 'underwriting', 'due_diligence', 'owned', 'portfolio', 'closed', 'closed_won')
      AND d.archived_at IS NULL
      AND d.user_id IS NOT NULL
    ORDER BY d.user_id, d.name
  `;

  const result = await query(sql);
  const now = new Date();

  const byUser = new Map<string, { userId: string; summary: PortfolioGapSummary; dealRows: DealSummaryRow[] }>();

  for (const row of result.rows) {
    const userId = row.user_id as string;
    const lastUpload: Date | null = row.last_upload ? new Date(row.last_upload as string) : null;
    const daysSince = lastUpload
      ? Math.floor((now.getTime() - lastUpload.getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    const dealRow: DealSummaryRow = {
      dealId: row.deal_id as string,
      dealName: row.deal_name as string,
      userId,
      parcelId: row.parcel_id as string,
      lastUpload,
      daysSince,
      hasPendingRealization: row.has_pending_realization as boolean,
    };

    if (!byUser.has(userId)) {
      byUser.set(userId, {
        userId,
        summary: {
          totalDeals: 0,
          dealsWithCurrentData: 0,
          dealsWithStaleData: 0,
          dealsMissingData: 0,
          dealsWithPendingRealization: 0,
        },
        dealRows: [],
      });
    }

    const entry = byUser.get(userId)!;
    entry.dealRows.push(dealRow);
    entry.summary.totalDeals++;

    if (!lastUpload) {
      entry.summary.dealsMissingData++;
    } else if (daysSince <= 35) {
      entry.summary.dealsWithCurrentData++;
    } else {
      entry.summary.dealsWithStaleData++;
    }

    if (dealRow.hasPendingRealization) {
      entry.summary.dealsWithPendingRealization++;
    }
  }

  return byUser;
}

function buildDigestMessage(userId: string, summary: PortfolioGapSummary, dealRows: DealSummaryRow[]): string {
  const parts: string[] = [`Weekly corpus digest — ${summary.totalDeals} deal(s) tracked.`];

  if (summary.dealsWithCurrentData > 0) {
    parts.push(`${summary.dealsWithCurrentData} current.`);
  }
  if (summary.dealsWithStaleData > 0) {
    parts.push(`${summary.dealsWithStaleData} stale (>35 days since last upload).`);
  }
  if (summary.dealsMissingData > 0) {
    parts.push(`${summary.dealsMissingData} missing data entirely.`);
  }
  if (summary.dealsWithPendingRealization > 0) {
    parts.push(`${summary.dealsWithPendingRealization} with T+12 realization windows closing.`);
  }

  return parts.join(' ');
}

// ─── Cron Function ───────────────────────────────────────────────────────────

export const weeklyCorpusDigestCron = inngest.createFunction(
  {
    id: 'weekly-corpus-digest',
    name: 'Historical Obs: weekly portfolio corpus digest',
    triggers: [{ cron: '0 9 * * 1' }], // Every Monday at 09:00 UTC
    retries: 2,
  },
  async ({ step }) => {
    const result = await step.run('generate-weekly-digest', async () => {
      logger.info('[WeeklyCorpusDigest] Starting weekly digest run');

      let byUser: Map<string, { userId: string; summary: PortfolioGapSummary; dealRows: DealSummaryRow[] }>;
      try {
        byUser = await buildPortfolioDigest();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error('[WeeklyCorpusDigest] Portfolio query failed', { error: msg });
        return { status: 'error', error: msg };
      }

      let usersNotified = 0;
      let notificationsSent = 0;
      const errors: string[] = [];

      for (const [userId, { summary, dealRows }] of byUser) {
        if (summary.totalDeals === 0) continue;

        // Only send digest when there are actionable gaps
        const hasGaps =
          summary.dealsMissingData > 0 ||
          summary.dealsWithStaleData > 0 ||
          summary.dealsWithPendingRealization > 0;

        if (!hasGaps) continue;

        // Use first deal as the notification's deal anchor (deal_notifications
        // requires a deal_id; we pick the most urgent deal).
        const urgentDeal =
          dealRows.find((d) => !d.lastUpload) ??
          dealRows.find((d) => d.daysSince > 60) ??
          dealRows[0];

        if (!urgentDeal) continue;

        try {
          const message = buildDigestMessage(userId, summary, dealRows);
          await createCorpusNotification(
            userId,
            urgentDeal.dealId,
            'data_corpus_weekly_digest',
            message,
            {
              totalDeals: summary.totalDeals,
              dealsWithCurrentData: summary.dealsWithCurrentData,
              dealsWithStaleData: summary.dealsWithStaleData,
              dealsMissingData: summary.dealsMissingData,
              dealsWithPendingRealization: summary.dealsWithPendingRealization,
              dealSummaries: dealRows.map((d) => ({
                dealId: d.dealId,
                dealName: d.dealName,
                lastUpload: d.lastUpload?.toISOString() ?? null,
                daysSince: d.daysSince,
                hasPendingRealization: d.hasPendingRealization,
              })),
            },
          );
          usersNotified++;
          notificationsSent++;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`userId=${userId}: ${msg}`);
          logger.error('[WeeklyCorpusDigest] Failed to notify user', { userId, error: msg });
        }
      }

      logger.info('[WeeklyCorpusDigest] Run complete', {
        usersNotified,
        notificationsSent,
        errors: errors.length,
      });

      return {
        status: 'ok',
        usersNotified,
        notificationsSent,
        errors,
      };
    });

    return result;
  },
);

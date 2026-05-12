/**
 * Data Corpus Reminder Service — Inngest Cron
 *
 * Runs on the first business day of each month (cron: 0 9 1 * *).
 * Evaluates every subject property's corpus health and creates
 * reminder notifications for operators.
 *
 * Per the spec (Section 9), trigger conditions:
 *
 *   Trigger 1 — Missing monthly performance row (DATA_CORPUS_UPLOAD_REQUIRED)
 *     Condition: last upload >35 days ago, current month missing
 *     Priority: MEDIUM → HIGH at 60+ days → URGENT at 90+
 *
 *   Trigger 2 — Realization window closing (DATA_CORPUS_REALIZATION_PENDING)
 *     Condition: row from 11 months ago needs T+12, but current month not uploaded
 *     Priority: HIGH
 *
 *   Trigger 3 — Predicted vs realized comparison ready (DATA_CORPUS_GAP_DETECTED)
 *     Condition: a product deal_analysis exists ≈ observation_date, and
 *     realized_rent_change_t12 was recently computed
 *     Priority: LOW (informational)
 *
 * @see HISTORICAL_OBSERVATIONS_SPEC.md Section 9
 */

import { inngest } from '../../lib/inngest';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';
import { createCorpusNotification } from '../../services/historical-observations/corpus-notification.service';

// ─── Constants ──────────────────────────────────────────────────────────────

const UPLOAD_MEDIUM_THRESHOLD_DAYS = 35;
const UPLOAD_HIGH_THRESHOLD_DAYS = 60;
const UPLOAD_URGENT_THRESHOLD_DAYS = 90;

// ─── Types ──────────────────────────────────────────────────────────────────

interface SubjectProperty {
  dealId: string;
  dealName: string;
  propertyId: string;
  parcelId: string;
  submarketId: string | null;
}

interface CorpusStatus {
  lastUploadDate: Date | null;
  daysSinceUpload: number;
  currentMonthMissing: boolean;
  pendingT12Realization: { rowDate: Date; monthsAgo: number } | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isBusinessDay(date: Date): boolean {
  const day = date.getDay();
  return day !== 0 && day !== 6;
}

function nthBusinessDayOfMonth(year: number, month: number, n: number): Date {
  let count = 0;
  const d = new Date(Date.UTC(year, month, 1));
  while (count < n) {
    if (isBusinessDay(d)) count++;
    if (count < n) d.setUTCDate(d.getUTCDate() + 1);
  }
  return d;
}

async function findSubjectProperties(): Promise<SubjectProperty[]> {
  const sql = `
    SELECT
      d.id AS deal_id,
      d.name AS deal_name,
      dp.property_id,
      COALESCE(p.parcel_id, dp.property_id) AS parcel_id,
      p.submarket_id
    FROM deals d
    JOIN deal_properties dp ON dp.deal_id = d.id
    LEFT JOIN properties p ON p.id = dp.property_id
    WHERE d.status IN ('active', 'underwriting', 'due_diligence', 'closed')
      AND dp.property_id IS NOT NULL
    ORDER BY d.name
  `;
  const result = await query(sql);
  return result.rows.map((r: Record<string, unknown>) => ({
    dealId: r.deal_id as string,
    dealName: r.deal_name as string,
    propertyId: r.property_id as string,
    parcelId: r.parcel_id as string,
    submarketId: (r.submarket_id as string | null) ?? null,
  }));
}

async function getCorpusStatus(parcelId: string): Promise<CorpusStatus> {
  // Most recent observation
  const lastSql = `
    SELECT observation_date::TEXT
    FROM historical_observations
    WHERE parcel_id = $1 AND is_subject_property = TRUE
    ORDER BY observation_date DESC
    LIMIT 1
  `;
  const lastResult = await query(lastSql, [parcelId]);
  const lastUploadDate: Date | null = lastResult.rows[0]?.observation_date
    ? new Date(lastResult.rows[0].observation_date as string)
    : null;

  const now = new Date();
  const daysSinceUpload = lastUploadDate
    ? Math.floor((now.getTime() - lastUploadDate.getTime()) / (1000 * 60 * 60 * 24))
    : 999;

  // Check if current month's row exists
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth();
  const firstOfCurrent = new Date(Date.UTC(currentYear, currentMonth, 1));
  const firstOfNext = new Date(Date.UTC(currentYear, currentMonth + 1, 1));

  const currentSql = `
    SELECT COUNT(*) AS cnt
    FROM historical_observations
    WHERE parcel_id = $1
      AND observation_date >= $2::DATE
      AND observation_date < $3::DATE
      AND is_subject_property = TRUE
  `;
  const currentResult = await query(currentSql, [
    parcelId,
    firstOfCurrent.toISOString().slice(0, 10),
    firstOfNext.toISOString().slice(0, 10),
  ]);
  const currentMonthMissing = Number(currentResult.rows[0]?.cnt) === 0;

  // Check for pending T+12 realization windows
  const pendingSql = `
    SELECT observation_date::TEXT,
           EXTRACT(MONTH FROM AGE(NOW(), observation_date)) AS months_ago
    FROM historical_observations
    WHERE parcel_id = $1
      AND is_subject_property = TRUE
      AND realized_rent_change_t12 IS NULL
      AND observation_date <= (NOW() - INTERVAL '11 months')
      AND observation_date >= (NOW() - INTERVAL '14 months')
    ORDER BY observation_date DESC
    LIMIT 1
  `;
  const pendingResult = await query(pendingSql, [parcelId]);
  let pendingT12Realization: { rowDate: Date; monthsAgo: number } | null = null;
  if (pendingResult.rows[0]) {
    pendingT12Realization = {
      rowDate: new Date(pendingResult.rows[0].observation_date as string),
      monthsAgo: Number(pendingResult.rows[0].months_ago),
    };
  }

  return { lastUploadDate, daysSinceUpload, currentMonthMissing, pendingT12Realization };
}

async function getDealTeamUserIds(dealId: string): Promise<string[]> {
  const sql = `
    SELECT user_id FROM deal_team_members WHERE deal_id = $1 AND status = 'active' AND user_id IS NOT NULL
    UNION
    SELECT user_id FROM deals WHERE id = $1 AND user_id IS NOT NULL
  `;
  const result = await query(sql, [dealId]);
  return result.rows
    .map((r: Record<string, unknown>) => r.user_id as string)
    .filter(Boolean);
}

function uploadActionUrl(dealId: string, propertyId: string, month: string): string {
  return `/deals/${dealId}/upload?propertyId=${propertyId}&month=${month}`;
}

function monthName(date: Date): string {
  return date.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
}

// ─── Trigger 1 ───────────────────────────────────────────────────────────────

async function checkUploadRequired(prop: SubjectProperty, status: CorpusStatus, userIds: string[]): Promise<void> {
  if (!status.currentMonthMissing) return;
  if (status.daysSinceUpload <= UPLOAD_MEDIUM_THRESHOLD_DAYS && status.lastUploadDate != null) return;

  const now = new Date();
  const currentMonthName = monthName(now);
  let priority = 'medium';
  let urgencyNote = '';

  if (status.daysSinceUpload >= UPLOAD_URGENT_THRESHOLD_DAYS) {
    priority = 'urgent';
    urgencyNote = ' — urgently needed to keep predictions calibrated';
  } else if (status.daysSinceUpload >= UPLOAD_HIGH_THRESHOLD_DAYS) {
    priority = 'high';
    urgencyNote = ' — needed soon';
  }

  const lastStr = status.lastUploadDate
    ? `${monthName(status.lastUploadDate)} (${status.daysSinceUpload} days ago)`
    : 'never';

  for (const userId of userIds) {
    await createCorpusNotification(
      userId,
      prop.dealId,
      'data_corpus_upload_required',
      `Upload ${prop.dealName}'s ${currentMonthName} performance${urgencyNote}. Last upload: ${lastStr}.`,
      {
        propertyId: prop.propertyId,
        parcelId: prop.parcelId,
        actionUrl: uploadActionUrl(prop.dealId, prop.propertyId, currentMonthName),
        daysSinceUpload: status.daysSinceUpload,
        priority,
      },
    );
  }

  logger.info('[CorpusReminder] Upload required sent', {
    dealId: prop.dealId,
    propertyId: prop.propertyId,
    daysSinceUpload: status.daysSinceUpload,
    priority,
  });
}

// ─── Trigger 2 ───────────────────────────────────────────────────────────────

async function checkRealizationPending(prop: SubjectProperty, status: CorpusStatus, userIds: string[]): Promise<void> {
  if (!status.pendingT12Realization) return;

  const rowMonth = monthName(status.pendingT12Realization.rowDate);
  const now = new Date();
  const currentMonthName = monthName(now);

  for (const userId of userIds) {
    await createCorpusNotification(
      userId,
      prop.dealId,
      'data_corpus_realization_pending',
      `${prop.dealName}: ${rowMonth} prediction's T+12 window is closing. Upload ${currentMonthName} to close the realization window.`,
      {
        propertyId: prop.propertyId,
        parcelId: prop.parcelId,
        rowObservationDate: status.pendingT12Realization.rowDate.toISOString().slice(0, 10),
      },
    );
  }

  logger.info('[CorpusReminder] Realization pending sent', {
    dealId: prop.dealId,
    propertyId: prop.propertyId,
    rowObservationDate: status.pendingT12Realization.rowDate.toISOString().slice(0, 10),
  });
}

// ─── Trigger 1a — CoStar submarket staleness ─────────────────────────────────

async function checkCoStarStaleness(prop: SubjectProperty, userIds: string[]): Promise<void> {
  if (!prop.submarketId) return;

  const sql = `
    SELECT
      MAX(observation_date)::DATE AS last_refresh,
      (NOW()::DATE - MAX(observation_date)::DATE) AS days_stale
    FROM historical_observations
    WHERE submarket_id = $1
      AND geography_level = 'submarket'
      AND 'costar' = ANY(source_signals)
  `;
  const result = await query(sql, [prop.submarketId]);
  if (!result.rows[0]?.last_refresh) return; // no CoStar data yet — not a staleness issue

  const dayStale = Number(result.rows[0].days_stale);
  if (dayStale <= 60) return;

  const priority = dayStale > 90 ? 'medium' : 'low';
  const msg = `CoStar data for ${prop.submarketId} hasn't refreshed in ${dayStale} days. Upload the latest CoStar export to keep submarket context current.`;

  for (const userId of userIds) {
    await createCorpusNotification(userId, prop.dealId, 'data_corpus_gap_detected', msg, {
      trigger: '1a',
      submarketId: prop.submarketId,
      daysSinceRefresh: dayStale,
      priority,
    });
  }

  logger.info('[CorpusReminder] CoStar staleness sent', {
    dealId: prop.dealId,
    submarketId: prop.submarketId,
    dayStale,
    priority,
  });
}

// ─── Trigger 1b — Comp performance gap ───────────────────────────────────────

async function checkCompGap(prop: SubjectProperty, userIds: string[]): Promise<void> {
  if (!prop.submarketId) return;

  const sql = `
    SELECT
      COUNT(DISTINCT parcel_id)::int AS n_stale_comps,
      MIN(max_obs)::DATE             AS oldest_update
    FROM (
      SELECT parcel_id, MAX(observation_date) AS max_obs
      FROM historical_observations
      WHERE submarket_id = $1
        AND geography_level = 'parcel'
        AND is_subject_property = FALSE
        AND data_quality_tier IN ('C1', 'C2')
      GROUP BY parcel_id
      HAVING (NOW()::DATE - MAX(observation_date)::DATE) > 180
    ) stale
  `;
  const result = await query(sql, [prop.submarketId]);
  const nStale = Number(result.rows[0]?.n_stale_comps) || 0;
  if (nStale === 0) return;

  const oldestUpdate = result.rows[0]?.oldest_update ?? null;
  const msg = `Comp set for ${prop.submarketId} hasn't been refreshed recently. ${nStale} tracked comp(s) have no observation in >180 days. Last update: ${oldestUpdate ?? 'unknown'}.`;

  for (const userId of userIds) {
    await createCorpusNotification(userId, prop.dealId, 'data_corpus_gap_detected', msg, {
      trigger: '1b',
      submarketId: prop.submarketId,
      nStaleComps: nStale,
      oldestUpdate,
      priority: 'low',
    });
  }

  logger.info('[CorpusReminder] Comp gap sent', {
    dealId: prop.dealId,
    submarketId: prop.submarketId,
    nStale,
  });
}

// ─── Trigger 3 ───────────────────────────────────────────────────────────────

async function checkComparisonReady(prop: SubjectProperty, _status: CorpusStatus, userIds: string[]): Promise<void> {
  const sql = `
    SELECT observation_date::TEXT, realized_rent_change_t12
    FROM historical_observations
    WHERE parcel_id = $1
      AND is_subject_property = TRUE
      AND realized_rent_change_t12 IS NOT NULL
      AND updated_at >= (NOW() - INTERVAL '24 hours')
    ORDER BY observation_date DESC
    LIMIT 3
  `;

  try {
    const result = await query(sql, [prop.parcelId]);
    for (const row of result.rows) {
      const obsDate = new Date(row.observation_date as string);
      const rentChange = Number(row.realized_rent_change_t12);
      if (isNaN(rentChange)) continue;

      const pctStr = (rentChange * 100).toFixed(1);
      const sign = rentChange >= 0 ? '+' : '';

      for (const userId of userIds) {
        await createCorpusNotification(
          userId,
          prop.dealId,
          'data_corpus_gap_detected',
          `${prop.dealName}: Rent change T+12 from ${monthName(obsDate)} was ${sign}${pctStr}%. Prediction comparison available.`,
          {
            propertyId: prop.propertyId,
            parcelId: prop.parcelId,
            observationDate: obsDate.toISOString().slice(0, 10),
            realizedRentChangeT12: rentChange,
          },
        );
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn('[CorpusReminder] Comparison check query failed (non-fatal)', {
      parcelId: prop.parcelId,
      error: msg,
    });
  }
}

// ─── Cron Function ───────────────────────────────────────────────────────────

export const dataCorpusReminderCron = inngest.createFunction(
  {
    id: 'data-corpus-reminder',
    name: 'Historical Obs: monthly data gap reminder',
    triggers: [
      { cron: '0 12 1 * *' },  // 1st of month 12:00 UTC
      { cron: '0 12 2 * *' },  // fallback if 1st was weekend
      { cron: '0 12 3 * *' },  // fallback if 1st was Sat → Mon is 3rd
    ],
    retries: 2,
  },
  async ({ step }) => {
    const result = await step.run('process-all-subject-properties', async () => {
      logger.info('[DataCorpusReminder] Starting monthly reminder run');

      const now = new Date();
      const firstBusinessDay = nthBusinessDayOfMonth(
        now.getUTCFullYear(), now.getUTCMonth(), 1,
      );
      const isTriggerDay =
        now.toISOString().slice(0, 10) === firstBusinessDay.toISOString().slice(0, 10);

      if (!isTriggerDay) {
        logger.info('[DataCorpusReminder] Not trigger day, skipping', {
          today: now.toISOString().slice(0, 10),
          nextRun: firstBusinessDay.toISOString().slice(0, 10),
        });
        return { status: 'skipped', reason: 'Not trigger day' };
      }

      const properties = await findSubjectProperties();
      logger.info('[DataCorpusReminder] Found subject properties', { count: properties.length });

      // Track submarket IDs notified this run to avoid duplicating 1a/1b
      // notifications when multiple portfolio properties share the same submarket.
      const notifiedSubmarkets = new Set<string>();

      for (const prop of properties) {
        try {
          const status = await getCorpusStatus(prop.parcelId);
          const userIds = await getDealTeamUserIds(prop.dealId);
          if (userIds.length === 0) continue;

          await checkUploadRequired(prop, status, userIds);
          await checkRealizationPending(prop, status, userIds);
          await checkComparisonReady(prop, status, userIds);

          // Triggers 1a + 1b fire once per unique submarket per run
          if (prop.submarketId && !notifiedSubmarkets.has(prop.submarketId)) {
            await checkCoStarStaleness(prop, userIds);
            await checkCompGap(prop, userIds);
            notifiedSubmarkets.add(prop.submarketId);
          }
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);
          logger.error('[DataCorpusReminder] Failed processing property', {
            dealId: prop.dealId,
            propertyId: prop.propertyId,
            error: errMsg,
          });
        }
      }

      logger.info('[DataCorpusReminder] Run complete', {
        propertiesChecked: properties.length,
      });

      return { status: 'ok', propertiesChecked: properties.length };
    });

    return result;
  },
);

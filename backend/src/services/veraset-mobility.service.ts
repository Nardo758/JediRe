/**
 * VerasetMobilityService — Stub for Veraset mobility data ingestion
 *
 * When the paid subscription deal is active (veraset_subscriptions.is_active = TRUE),
 * this service ingests foot-traffic and mobility data into the
 * historical_observations mobility_* columns.
 *
 * Gated by subscription status. All methods return early with a skip reason
 * when the subscription is inactive.
 *
 * @see DATA_LIBRARY_INVENTORY.md §12 — External signal columns
 * @see HISTORICAL_OBSERVATIONS_SPEC.md
 */

import { query } from '../database/connection';
import { logger } from '../utils/logger';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface VerasetSubscription {
  id: string;
  msaId: string;
  msaName: string | null;
  isActive: boolean;
  subscriptionTier: string | null;
  monthlyQuota: number | null;
  quotaUsedThisMonth: number;
  quotaResetsAt: Date | null;
  apiKeyEncrypted: string | null;
  apiEndpoint: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface VerasetIngestResult {
  status: 'completed' | 'skipped' | 'failed';
  rowsInserted: number;
  rowsUpdated: number;
  message: string;
  error?: string;
}

export interface VerasetMobilityPayload {
  msaId: string;
  observationDate: string; // YYYY-MM-DD
  visitsMonthly: number;
  uniqueVisitors: number;
  visitsPerSqFt?: number;
  poiCount?: number;
  topPoiCategories?: string[];
  // Raw API response stub — expand when real schema is known
  rawSummary?: Record<string, unknown>;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class VerasetMobilityService {
  /**
   * Check whether a given MSA has an active Veraset subscription.
   */
  async isActiveForMsa(msaId: string): Promise<boolean> {
    try {
      const result = await query(
        'SELECT is_active FROM veraset_subscriptions WHERE msa_id = $1',
        [msaId],
      );
      if (result.rows.length === 0) return false;
      return result.rows[0].is_active === true;
    } catch (err) {
      logger.error('[VerasetMobilityService] isActiveForMsa failed', { msaId, error: err });
      return false;
    }
  }

  /**
   * Get subscription details for an MSA.
   */
  async getSubscription(msaId: string): Promise<VerasetSubscription | null> {
    try {
      const result = await query(
        'SELECT * FROM veraset_subscriptions WHERE msa_id = $1',
        [msaId],
      );
      if (result.rows.length === 0) return null;
      const row = result.rows[0];
      return {
        id: row.id,
        msaId: row.msa_id,
        msaName: row.msa_name,
        isActive: row.is_active,
        subscriptionTier: row.subscription_tier,
        monthlyQuota: row.monthly_quota,
        quotaUsedThisMonth: row.quota_used_this_month ?? 0,
        quotaResetsAt: row.quota_resets_at ? new Date(row.quota_resets_at) : null,
        apiKeyEncrypted: row.api_key_encrypted,
        apiEndpoint: row.api_endpoint,
        notes: row.notes,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
      };
    } catch (err) {
      logger.error('[VerasetMobilityService] getSubscription failed', { msaId, error: err });
      return null;
    }
  }

  /**
   * Ingest mobility data for an MSA.
   *
   * GATED: returns skipped if subscription is inactive.
   * When active, this is a stub — it logs the intent and creates a job row.
   * Replace with real Veraset API calls when the deal is active and API
   * credentials are configured.
   */
  async ingestDailyMobility(
    msaId: string,
    payload: VerasetMobilityPayload,
  ): Promise<VerasetIngestResult> {
    const active = await this.isActiveForMsa(msaId);
    if (!active) {
      return {
        status: 'skipped',
        rowsInserted: 0,
        rowsUpdated: 0,
        message: `Veraset subscription inactive for ${msaId} — ingest skipped. Activate in veraset_subscriptions table.`,
      };
    }

    // Insert a job log row
    const jobResult = await query(
      `INSERT INTO veraset_ingest_jobs (msa_id, job_type, status, metadata, started_at)
       VALUES ($1, 'daily_mobility', 'running', $2, NOW()) RETURNING id`,
      [msaId, JSON.stringify({ payloadSummary: payload.rawSummary })],
    );
    const jobId = jobResult.rows[0]?.id as string;

    try {
      // ─── STUB: Real Veraset API call goes here ─────────────────────────────
      // When the deal is active:
      //   1. Decrypt apiKeyEncrypted
      //   2. Call Veraset API (apiEndpoint + /v1/foot-traffic or equivalent)
      //   3. Map response to historical_observations mobility_* columns
      //   4. Upsert via ON CONFLICT (msa_id, observation_date, geography_level)
      //
      // For now, we log the intent and return a success placeholder.
      logger.info('[VerasetMobilityService] ingestDailyMobility stub — would call API', {
        msaId,
        jobId,
        observationDate: payload.observationDate,
        visitsMonthly: payload.visitsMonthly,
      });

      // Example upsert (commented out — enable when real data arrives):
      //
      // await query(
      //   `INSERT INTO historical_observations (
      //      msa_id, observation_date, observation_window, geography_level,
      //      mobility_visits_monthly, mobility_unique_visitors, mobility_visits_psf,
      //      source_signals
      //    ) VALUES ($1, $2, 'monthly', 'msa', $3, $4, $5, ARRAY['veraset'])
      //    ON CONFLICT (msa_id, observation_date, geography_level)
      //    DO UPDATE SET
      //      mobility_visits_monthly = EXCLUDED.mobility_visits_monthly,
      //      mobility_unique_visitors = EXCLUDED.mobility_unique_visitors,
      //      mobility_visits_psf = EXCLUDED.mobility_visits_psf,
      //      source_signals = array_append_unique(historical_observations.source_signals, 'veraset'),
      //      updated_at = NOW()`,
      //   [msaId, payload.observationDate, payload.visitsMonthly, payload.uniqueVisitors, payload.visitsPerSqFt],
      // );

      // Update job log to completed
      await query(
        `UPDATE veraset_ingest_jobs
         SET status = 'completed', completed_at = NOW(), rows_inserted = 0, rows_updated = 0
         WHERE id = $1`,
        [jobId],
      );

      return {
        status: 'completed',
        rowsInserted: 0,
        rowsUpdated: 0,
        message: 'Stub completed — no real API call (subscription active but implementation pending).',
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('[VerasetMobilityService] ingestDailyMobility failed', { msaId, jobId, error: msg });

      await query(
        `UPDATE veraset_ingest_jobs
         SET status = 'failed', completed_at = NOW(), error_message = $2
         WHERE id = $1`,
        [jobId, msg],
      );

      return {
        status: 'failed',
        rowsInserted: 0,
        rowsUpdated: 0,
        message: 'Ingest failed — see veraset_ingest_jobs for details.',
        error: msg,
      };
    }
  }

  /**
   * Run a full backfill for an MSA.
   *
   * GATED by subscription status. Stub — creates a job log but does not
   * fetch historical data until the deal is active.
   */
  async runBackfill(msaId: string, months = 24): Promise<VerasetIngestResult> {
    const active = await this.isActiveForMsa(msaId);
    if (!active) {
      return {
        status: 'skipped',
        rowsInserted: 0,
        rowsUpdated: 0,
        message: `Veraset subscription inactive for ${msaId} — backfill skipped.`,
      };
    }

    const jobResult = await query(
      `INSERT INTO veraset_ingest_jobs (msa_id, job_type, status, metadata, started_at)
       VALUES ($1, 'backfill', 'running', $2, NOW()) RETURNING id`,
      [msaId, JSON.stringify({ requestedMonths: months })],
    );
    const jobId = jobResult.rows[0]?.id as string;

    logger.info('[VerasetMobilityService] runBackfill stub — would fetch historical data', {
      msaId,
      jobId,
      months,
    });

    await query(
      `UPDATE veraset_ingest_jobs
       SET status = 'completed', completed_at = NOW()
       WHERE id = $1`,
      [jobId],
    );

    return {
      status: 'completed',
      rowsInserted: 0,
      rowsUpdated: 0,
      message: `Stub backfill completed for ${months} months — no real data fetched yet.`,
    };
  }

  /**
   * Get all active subscriptions (for cron / batch jobs).
   */
  async getActiveSubscriptions(): Promise<VerasetSubscription[]> {
    try {
      const result = await query(
        'SELECT * FROM veraset_subscriptions WHERE is_active = TRUE ORDER BY msa_id',
      );
      return result.rows.map((row) => ({
        id: row.id,
        msaId: row.msa_id,
        msaName: row.msa_name,
        isActive: row.is_active,
        subscriptionTier: row.subscription_tier,
        monthlyQuota: row.monthly_quota,
        quotaUsedThisMonth: row.quota_used_this_month ?? 0,
        quotaResetsAt: row.quota_resets_at ? new Date(row.quota_resets_at) : null,
        apiKeyEncrypted: row.api_key_encrypted,
        apiEndpoint: row.api_endpoint,
        notes: row.notes,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
      }));
    } catch (err) {
      logger.error('[VerasetMobilityService] getActiveSubscriptions failed', { error: err });
      return [];
    }
  }
}

// ─── Singleton export ───────────────────────────────────────────────────────

export const verasetMobilityService = new VerasetMobilityService();

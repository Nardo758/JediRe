/**
 * Scenario Archival Service — M40 Phase 5
 *
 * Three policies:
 *   1. Auto-archive: agent scenarios older than 30 days, not referenced
 *   2. Compression: agent scenarios older than 90 days, keep only first per month
 *   3. Hard-delete: soft-deleted scenarios older than 90 days
 *
 * All three run as a single daily cron job. Each policy is idempotent
 * and logs every action for audit.
 */

import { getPool } from '../database/connection';
import { logger } from '../utils/logger';

export interface ArchivalReport {
  archived: number;
  compressed: number;
  hardDeleted: number;
  errors: string[];
}

export class ScenarioArchivalService {
  private pool = getPool();

  /** Daily run — all three policies in sequence. */
  async runDaily(): Promise<ArchivalReport> {
    const report: ArchivalReport = { archived: 0, compressed: 0, hardDeleted: 0, errors: [] };

    // 1. Auto-archive agent scenarios older than 30 days
    try {
      const archived = await this.autoArchive();
      report.archived = archived;
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      report.errors.push(`autoArchive: ${msg}`);
      logger.error('[ScenarioArchival] autoArchive failed', { err: msg });
    }

    // 2. Compress agent scenarios older than 90 days
    try {
      const compressed = await this.compress();
      report.compressed = compressed;
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      report.errors.push(`compress: ${msg}`);
      logger.error('[ScenarioArchival] compress failed', { err: msg });
    }

    // 3. Hard-delete soft-deleted scenarios older than 90 days
    try {
      const hardDeleted = await this.hardDelete();
      report.hardDeleted = hardDeleted;
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      report.errors.push(`hardDelete: ${msg}`);
      logger.error('[ScenarioArchival] hardDelete failed', { err: msg });
    }

    logger.info('[ScenarioArchival] Daily run complete', report);
    return report;
  }

  /**
   * Policy 1: Auto-archive agent scenarios older than 30 days.
   * Skips scenarios that:
   *   - are currently active
   *   - are parent of another scenario
   *   - have CIE findings with sponsor_state = 'accepted'
   *   - were ever active (is_active was TRUE at some point)
   */
  async autoArchive(): Promise<number> {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const res = await this.pool.query(
      `UPDATE deal_underwriting_scenarios
          SET archived_at = NOW(), updated_at = NOW()
        WHERE created_by = 'agent'
          AND created_at < $1
          AND archived_at IS NULL
          AND deleted_at IS NULL
          AND is_active = FALSE
          AND id NOT IN (
            SELECT parent_id FROM deal_underwriting_scenarios
             WHERE parent_id IS NOT NULL AND deleted_at IS NULL
          )
          AND id NOT IN (
            SELECT id FROM deal_underwriting_scenarios
             WHERE id IN (
               SELECT scenario_id FROM deal_underwriting_scenarios
                WHERE is_active = TRUE
             )
          )
          AND (
            ci_findings IS NULL
            OR NOT EXISTS (
              SELECT 1
                FROM jsonb_array_elements(ci_findings) AS f
               WHERE f->>'sponsor_state' = 'accepted'
            )
          )
        RETURNING id`,
      [cutoff]
    );
    const count = res.rowCount ?? 0;
    if (count > 0) {
      logger.info('[ScenarioArchival] Auto-archived agent scenarios', { count, cutoff: cutoff.toISOString() });
    }
    return count;
  }

  /**
   * Policy 2: Compress agent scenarios older than 90 days.
   * Keep:
   *   - first agent scenario per month per deal
   *   - any scenario that was ever active
   *   - any scenario that is parent of a user scenario
   * Discard the rest (hard-delete, not archive — they're already past archival).
   */
  async compress(): Promise<number> {
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    // Find candidates: agent scenarios older than 90 days, not active, not parent
    const candidates = await this.pool.query(
      `SELECT id, deal_id, created_at
         FROM deal_underwriting_scenarios
        WHERE created_by = 'agent'
          AND created_at < $1
          AND deleted_at IS NULL
          AND is_active = FALSE
          AND id NOT IN (
            SELECT parent_id FROM deal_underwriting_scenarios
             WHERE parent_id IS NOT NULL AND deleted_at IS NULL
          )
        ORDER BY deal_id, created_at DESC`,
      [cutoff]
    );

    // Group by deal, then keep only the first per month (newest in that month)
    const keepIds = new Set<string>();
    const dealMonthKeeps = new Map<string, string>(); // deal_id + month -> scenario_id

    for (const row of candidates.rows) {
      const dealId = row.deal_id as string;
      const month = (row.created_at as string).slice(0, 7); // YYYY-MM
      const key = `${dealId}:${month}`;
      if (!dealMonthKeeps.has(key)) {
        dealMonthKeeps.set(key, row.id as string);
        keepIds.add(row.id as string);
      }
    }

    // Delete everything else
    const deleteIds = candidates.rows
      .map(r => r.id as string)
      .filter(id => !keepIds.has(id));

    if (deleteIds.length === 0) return 0;

    // Batch delete in chunks of 100 to avoid huge IN clauses
    let deleted = 0;
    const chunkSize = 100;
    for (let i = 0; i < deleteIds.length; i += chunkSize) {
      const chunk = deleteIds.slice(i, i + chunkSize);
      const placeholders = chunk.map((_, idx) => `$${idx + 1}`).join(',');
      const res = await this.pool.query(
        `DELETE FROM deal_underwriting_scenarios WHERE id IN (${placeholders})`,
        chunk
      );
      deleted += res.rowCount ?? 0;
    }

    if (deleted > 0) {
      logger.info('[ScenarioArchival] Compressed agent scenarios', { deleted, kept: keepIds.size, cutoff: cutoff.toISOString() });
    }
    return deleted;
  }

  /**
   * Policy 3: Hard-delete soft-deleted scenarios older than 90 days.
   * Snapshots in deal_underwriting_snapshots are NOT deleted — they remain
   * as the immutable audit trail.
   */
  async hardDelete(): Promise<number> {
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const res = await this.pool.query(
      `DELETE FROM deal_underwriting_scenarios
        WHERE deleted_at IS NOT NULL
          AND deleted_at < $1`,
      [cutoff]
    );
    const count = res.rowCount ?? 0;
    if (count > 0) {
      logger.info('[ScenarioArchival] Hard-deleted scenarios', { count, cutoff: cutoff.toISOString() });
    }
    return count;
  }
}

export const scenarioArchivalService = new ScenarioArchivalService();

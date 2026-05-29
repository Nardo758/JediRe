/**
 * Phase 3 — Shadow Comparison Service
 *
 * Logs divergences between the old and new code paths for each reader.
 * Used during the "shadow" and "canary" flag states to verify that the
 * new path produces equivalent results before it serves live traffic.
 *
 * Writes to `property_reader_shadow_log`. Failures to write are
 * swallowed (shadow logging must never break a production request).
 *
 * Usage pattern:
 *
 *   const flag = DEAL_RESOLVE_FLAG();
 *   const oldResult = await oldPath(dealId);
 *
 *   if (shouldRunShadow(flag)) {
 *     const newResult = await newPath(dealId).catch(e => null);
 *     await shadowService.log({
 *       readerId: 'deal_resolve',
 *       entityId: dealId,
 *       field: 'propertyId',
 *       oldValue: oldResult?.propertyId ?? null,
 *       newValue: newResult?.propertyId ?? null,
 *     });
 *   }
 *
 *   return shouldUseNewPath(flag) ? newResult : oldResult;
 */

import { query } from '../../database/connection';

export interface ShadowLogEntry {
  readerId: string;
  entityId: string;
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

function stringify(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return JSON.stringify(v);
}

export class Phase3ShadowService {
  /**
   * Log a single field comparison between old and new code paths.
   * Swallows all errors — shadow logging must never affect production.
   */
  async log(entry: ShadowLogEntry): Promise<void> {
    const oldStr = stringify(entry.oldValue);
    const newStr = stringify(entry.newValue);
    const match = oldStr === newStr;

    try {
      await query(
        `INSERT INTO property_reader_shadow_log
           (reader_id, entity_id, field, old_value, new_value, match)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [entry.readerId, entry.entityId, entry.field, oldStr, newStr, match]
      );
    } catch {
      // Shadow logging failure must not break production requests.
    }
  }

  /**
   * Log a batch of field comparisons in a single INSERT.
   * Use this when comparing multiple fields for a single entity.
   */
  async logBatch(readerId: string, entityId: string, fields: Record<string, { old: unknown; new: unknown }>): Promise<void> {
    const entries = Object.entries(fields);
    if (entries.length === 0) return;

    const rows = entries.map(([field, { old: oldV, new: newV }]) => {
      const oldStr = stringify(oldV);
      const newStr = stringify(newV);
      return { field, oldStr, newStr, match: oldStr === newStr };
    });

    try {
      const valuePlaceholders = rows
        .map((_, i) => `($1, $2, $${3 + i * 4}, $${4 + i * 4}, $${5 + i * 4}, $${6 + i * 4})`)
        .join(', ');

      const params: unknown[] = [readerId, entityId];
      for (const r of rows) {
        params.push(r.field, r.oldStr, r.newStr, r.match);
      }

      await query(
        `INSERT INTO property_reader_shadow_log
           (reader_id, entity_id, field, old_value, new_value, match)
         VALUES ${valuePlaceholders}`,
        params
      );
    } catch {
      // Shadow logging failure must not break production requests.
    }
  }

  /**
   * Get divergence summary for a reader over the last N days.
   * Used for monitoring and promotion decisions.
   */
  async getDivergenceSummary(
    readerId: string,
    days = 7
  ): Promise<{ total: number; diverged: number; divergenceRate: number; fields: Record<string, number> }> {
    const result = await query(
      `SELECT
         COUNT(*)::int                            AS total,
         COUNT(*) FILTER (WHERE NOT match)::int   AS diverged,
         field,
         COUNT(*) FILTER (WHERE NOT match)::int   AS field_diverged
       FROM property_reader_shadow_log
       WHERE reader_id = $1
         AND created_at >= NOW() - ($2 || ' days')::interval
       GROUP BY field`,
      [readerId, days]
    );

    let total = 0;
    let diverged = 0;
    const fields: Record<string, number> = {};

    for (const row of result.rows) {
      total += Number(row.total);
      diverged += Number(row.diverged);
      if (Number(row.field_diverged) > 0) {
        fields[row.field as string] = Number(row.field_diverged);
      }
    }

    return {
      total,
      diverged,
      divergenceRate: total > 0 ? diverged / total : 0,
      fields,
    };
  }

  /**
   * Check if a reader is clean (zero divergences) for the last N days.
   * Used by the promotion gate: must be clean for ≥ 7 days before canary.
   */
  async isClean(readerId: string, days = 7): Promise<boolean> {
    const summary = await this.getDivergenceSummary(readerId, days);
    return summary.diverged === 0 && summary.total > 0;
  }
}

export const phase3ShadowService = new Phase3ShadowService();

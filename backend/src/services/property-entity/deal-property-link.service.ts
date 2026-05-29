/**
 * DealPropertyLinkService
 * Phase 1 — Property Plumbing Refactor
 *
 * Manages the deal → property relationship during the Phase 2 dual-write
 * transition period. Writes to both:
 *   - deals.property_id (new canonical FK, Phase 1 addition)
 *   - deal_properties (legacy join table, 27 rows, kept alive until Phase 4)
 *
 * Resolution: reads from deals.property_id first (new), falls back to
 * deal_properties (legacy) if property_id is null. This means the moment
 * deals.property_id is populated for a deal, the legacy path is bypassed
 * automatically — no flag flip needed per deal.
 *
 * Phase 4: once all readers are off deal_properties and the join table
 * is confirmed empty of active references, deal_properties is dropped
 * and this service's write to it is removed.
 */

import { query } from '../../database/connection';

export interface DealPropertyLink {
  dealId: string;
  propertyId: string;
  source: 'new_fk' | 'legacy_join_table';
}

export class DealPropertyLinkService {
  /**
   * Resolve the canonical property for a deal.
   * Reads deals.property_id first; falls back to deal_properties join.
   * Returns null if neither yields a result.
   */
  async resolveDealProperty(dealId: string): Promise<DealPropertyLink | null> {
    // New FK path first
    const newResult = await query(
      `SELECT property_id FROM deals WHERE id = $1 AND property_id IS NOT NULL`,
      [dealId]
    );
    if (newResult.rows.length > 0) {
      return {
        dealId,
        propertyId: newResult.rows[0].property_id as string,
        source: 'new_fk',
      };
    }

    // Legacy join table fallback
    const legacyResult = await query(
      `SELECT property_id FROM deal_properties WHERE deal_id = $1 LIMIT 1`,
      [dealId]
    );
    if (legacyResult.rows.length > 0) {
      return {
        dealId,
        propertyId: legacyResult.rows[0].property_id as string,
        source: 'legacy_join_table',
      };
    }

    return null;
  }

  /**
   * Link a deal to a property via dual-write.
   * Writes deals.property_id (new) AND deal_properties (legacy) atomically.
   * Both writes succeed or both fail — no partial state.
   *
   * Idempotent: if the link already exists with the same propertyId,
   * this is a no-op.
   */
  async linkDealToProperty(dealId: string, propertyId: string): Promise<void> {
    await query('BEGIN');
    try {
      // Write new FK
      await query(
        `UPDATE deals SET property_id = $2, updated_at = NOW()
         WHERE id = $1 AND (property_id IS NULL OR property_id = $2)`,
        [dealId, propertyId]
      );

      // Write legacy join table (upsert — deal_properties may already have a row)
      await query(
        `INSERT INTO deal_properties (deal_id, property_id)
         VALUES ($1, $2)
         ON CONFLICT (deal_id, property_id) DO NOTHING`,
        [dealId, propertyId]
      );

      await query('COMMIT');
    } catch (err) {
      await query('ROLLBACK');
      throw err;
    }
  }

  /**
   * Bulk-resolve property IDs for a list of deals in a single query.
   * Reads deals.property_id only (new FK path). Use this after Phase 2
   * backfill confirms all deals have property_id populated.
   *
   * Returns a map of dealId → propertyId (only deals with a non-null link).
   */
  async bulkResolveDealProperties(dealIds: string[]): Promise<Map<string, string>> {
    if (dealIds.length === 0) return new Map();
    const result = await query(
      `SELECT id AS deal_id, property_id
       FROM deals
       WHERE id = ANY($1) AND property_id IS NOT NULL`,
      [dealIds]
    );
    const map = new Map<string, string>();
    for (const row of result.rows) {
      map.set(row.deal_id as string, row.property_id as string);
    }
    return map;
  }

  /**
   * Audit: return all deals that do NOT yet have deals.property_id populated.
   * Used by the Phase 2 backfill script to find work remaining.
   */
  async getUnlinkedDeals(): Promise<{ dealId: string; legacyPropertyId: string | null }[]> {
    const result = await query(
      `SELECT d.id AS deal_id, dp.property_id AS legacy_property_id
       FROM deals d
       LEFT JOIN deal_properties dp ON dp.deal_id = d.id
       WHERE d.property_id IS NULL
       ORDER BY d.created_at`
    );
    return result.rows.map((row) => ({
      dealId: row.deal_id as string,
      legacyPropertyId: (row.legacy_property_id as string) ?? null,
    }));
  }
}

export const dealPropertyLinkService = new DealPropertyLinkService();

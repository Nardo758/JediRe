/**
 * WS-3 Layers 1+2 — Forward Supply API
 *
 * GET  /api/v1/deals/:dealId/forward-supply
 *   Returns the projected multifamily development capacity within fixed 3mi
 *   and 5mi rings around the deal's coordinates.
 *
 * GET  /api/v1/deals/:dealId/submarkets
 *   Returns all submarkets available for linking, scoped to the deal's MSA
 *   when determinable, otherwise the full catalogue.  Each entry includes a
 *   generated slug used as the submarket_id value stored on the property row.
 *
 * PATCH /api/v1/deals/:dealId/submarket
 *   Body: { submarketId: string | null }
 *   Persists the analyst's submarket choice to the deal's `properties` row.
 *   Pass null to unlink.  Returns { success: true, rowsUpdated: number }.
 *
 * Status codes:
 *   200 — success
 *   400 — invalid request body
 *   404 — no deal / no linked property row
 *   500 — unexpected server error
 */

import { Router } from 'express';
import { getPool } from '../../database/connection';
import { ForwardSupplyService } from '../../services/forward-supply.service';
import { logger } from '../../utils/logger';

const router = Router();

// ── helpers ──────────────────────────────────────────────────────────────────

/** Derive a stable slug from a submarket name (e.g. "West Midtown" → "west-midtown"). */
function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// ── GET /api/v1/deals/:dealId/forward-supply ─────────────────────────────────

router.get('/:dealId/forward-supply', async (req, res) => {
  const { dealId } = req.params;
  try {
    const service = new ForwardSupplyService(getPool());
    const result = await service.compute(dealId);

    if (!result.metadata.dealFound) {
      return res.status(404).json({ success: false, error: `Deal not found: ${dealId}` });
    }

    return res.json({ success: true, ...result });
  } catch (err) {
    logger.error('[forward-supply] error', { dealId, err });
    return res.status(500).json({ success: false, error: 'Failed to compute forward supply' });
  }
});

// ── GET /api/v1/deals/:dealId/submarkets ─────────────────────────────────────

router.get('/:dealId/submarkets', async (req, res) => {
  const { dealId } = req.params;
  try {
    const pool = getPool();

    // Attempt to scope by the deal's MSA so the list stays relevant.
    // Falls back to the full catalogue when no MSA is determinable.
    const result = await pool.query<{
      id: number;
      name: string;
      msa_id: number | null;
      deal_msa_id: number | null;
    }>(
      `SELECT
         s.id,
         s.name,
         s.msa_id,
         p.msa_id AS deal_msa_id
       FROM submarkets s
       LEFT JOIN (
         SELECT p.msa_id
         FROM properties p
         WHERE p.deal_id = $1
         LIMIT 1
       ) p ON true
       ORDER BY s.name`,
      [dealId],
    );

    const dealMsaId = result.rows[0]?.deal_msa_id ?? null;
    const rows = dealMsaId
      ? result.rows.filter((r) => r.msa_id === dealMsaId)
      : result.rows;

    // If MSA-scoped returns empty (no match), return full catalogue
    const finalRows = rows.length > 0 ? rows : result.rows;

    return res.json({
      success: true,
      submarkets: finalRows.map((r) => ({
        id: r.id,
        name: r.name,
        slug: nameToSlug(r.name),
      })),
    });
  } catch (err) {
    logger.error('[forward-supply] submarkets list error', { dealId, err });
    return res.status(500).json({ success: false, error: 'Failed to list submarkets' });
  }
});

// ── PATCH /api/v1/deals/:dealId/submarket ────────────────────────────────────

router.patch('/:dealId/submarket', async (req, res) => {
  const { dealId } = req.params;
  const { submarketId } = req.body as { submarketId?: unknown };

  // submarketId must be a non-empty string or explicitly null to unlink
  if (submarketId !== null && (typeof submarketId !== 'string' || submarketId.trim() === '')) {
    return res.status(400).json({
      success: false,
      error: 'submarketId must be a non-empty string or null',
    });
  }

  const newValue = submarketId === null ? null : (submarketId as string).trim();

  try {
    const pool = getPool();

    // Update the property row(s) linked to this deal.
    // When multiple properties exist (rare), all are updated for consistency.
    const result = await pool.query<{ rows_updated: string }>(
      `WITH updated AS (
         UPDATE properties
         SET submarket_id = $2
         WHERE deal_id = $1
         RETURNING id
       )
       SELECT COUNT(*)::text AS rows_updated FROM updated`,
      [dealId, newValue],
    );

    const rowsUpdated = parseInt(result.rows[0]?.rows_updated ?? '0', 10);

    if (rowsUpdated === 0) {
      // No property row linked to this deal yet — return a descriptive 404.
      return res.status(404).json({
        success: false,
        error: 'No property row found for this deal. Create a property record first.',
      });
    }

    logger.info('[forward-supply] submarket linked', { dealId, submarketId: newValue, rowsUpdated });
    return res.json({ success: true, rowsUpdated });
  } catch (err) {
    logger.error('[forward-supply] submarket patch error', { dealId, err });
    return res.status(500).json({ success: false, error: 'Failed to update submarket' });
  }
});

export default router;

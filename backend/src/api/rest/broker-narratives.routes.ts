/**
 * Broker Narratives feed API (Task #383).
 *
 * `GET /api/v1/broker-narratives/:entityType/:entityId?limit=20`
 *
 * Returns recent broker narratives (thesis + highlights) extracted from OMs
 * and tagged to the resolved canonical MSA / submarket. Powers the
 * "Broker Narratives" panel on the Submarket / MSA Commentary tabs and
 * is also consumed by the Commentary Agent prompt for context.
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { requireAuth } from '../../middleware/auth';
import {
  resolveMsa,
  resolveSubmarket,
  canonicalMsaKey,
  canonicalSubmarketKey,
} from './_market-resolution';

interface PoolClientLite {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
}

async function resolveKey(
  pool: Pool,
  entityType: 'msa' | 'submarket',
  entityId: string,
): Promise<{ key: string; name: string | null }> {
  const client = await pool.connect();
  try {
    const lite: PoolClientLite = client;
    if (entityType === 'msa') {
      const r = await resolveMsa(lite, entityId);
      return { key: canonicalMsaKey(r, entityId), name: r?.name ?? null };
    }
    const r = await resolveSubmarket(lite, entityId, null);
    return { key: canonicalSubmarketKey(r, entityId), name: r?.name ?? null };
  } finally {
    client.release();
  }
}

export interface BrokerNarrativeRow {
  id: string;
  kind: 'thesis' | 'highlight';
  text: string;
  broker: string | null;
  propertyName: string | null;
  capturedAt: string;
  sentimentLabel: string | null;
  sentimentScore: number | null;
  sourceFileId: number;
}

export async function fetchBrokerNarratives(
  pool: Pool,
  entityType: 'msa' | 'submarket',
  entityId: string,
  limit: number,
): Promise<{ canonicalKey: string; entityName: string | null; rows: BrokerNarrativeRow[] }> {
  const { key, name } = await resolveKey(pool, entityType, entityId);
  const keyCol = entityType === 'msa' ? 'msa_key' : 'submarket_key';
  const r = await pool.query(
    `SELECT id, kind, text, broker, property_name, captured_at,
            sentiment_label, sentiment_score, source_file_id
       FROM broker_narratives
      WHERE ${keyCol} = $1
      ORDER BY captured_at DESC
      LIMIT $2`,
    [key, limit],
  );
  return {
    canonicalKey: key,
    entityName: name,
    rows: r.rows.map(row => ({
      id:              String(row.id),
      kind:            (row.kind === 'thesis' || row.kind === 'highlight')
                         ? row.kind
                         : 'highlight',
      text:            String(row.text),
      broker:          row.broker == null ? null : String(row.broker),
      propertyName:    row.property_name == null ? null : String(row.property_name),
      capturedAt:      row.captured_at instanceof Date
                         ? (row.captured_at as Date).toISOString()
                         : String(row.captured_at),
      sentimentLabel:  row.sentiment_label == null ? null : String(row.sentiment_label),
      sentimentScore:  row.sentiment_score == null ? null : Number(row.sentiment_score),
      sourceFileId:    Number(row.source_file_id),
    })),
  };
}

export function createBrokerNarrativesRoutes(pool: Pool): Router {
  const router = Router();

  router.get('/:entityType/:entityId', requireAuth, async (req: Request, res: Response) => {
    try {
      const entityType = req.params.entityType as 'msa' | 'submarket';
      if (entityType !== 'msa' && entityType !== 'submarket') {
        return res.status(400).json({ error: 'entityType must be "msa" or "submarket"' });
      }
      const limitRaw = req.query.limit as string | undefined;
      const limit = limitRaw ? Math.min(50, Math.max(1, parseInt(limitRaw, 10))) : 20;

      const out = await fetchBrokerNarratives(pool, entityType, req.params.entityId, limit);

      res.json({
        entityType,
        entityId: req.params.entityId,
        canonicalKey: out.canonicalKey,
        entityName: out.entityName,
        narratives: out.rows,
      });
    } catch (err: unknown) {
      console.error('broker-narratives error:', err);
      res.status(500).json({ error: err instanceof Error ? err.message : 'unknown error' });
    }
  });

  return router;
}

/**
 * M35 Event Impact Engine — REST API Routes
 *
 * GET    /api/v1/m35/events                          — search/list events
 * POST   /api/v1/m35/events                          — create event
 * GET    /api/v1/m35/events/taxonomy                 — list taxonomy subtypes
 * GET    /api/v1/m35/events/:id                      — get event by ID
 * PATCH  /api/v1/m35/events/:id                      — update event fields
 * POST   /api/v1/m35/events/:id/status               — transition status
 * POST   /api/v1/m35/events/:id/verify               — verify event
 * GET    /api/v1/m35/events/:id/history              — status history
 * GET    /api/v1/m35/events/:id/watchlist            — metric watchlist
 * POST   /api/v1/m35/events/:id/watchlist            — add metric to watchlist
 * GET    /api/v1/m35/events/:id/impacts              — get impact records (M35-2)
 * GET    /api/v1/m35/events/:id/control-group        — get DiD control group (M35-2)
 * POST   /api/v1/m35/events/:id/compute-impact       — trigger on-demand impact (M35-2)
 * POST   /api/v1/m35/events/promote/:draftId         — promote from draft queue
 * GET    /api/v1/m35/portfolio/events                 — cross-portfolio event feed (PortfolioEventRow[])
 * GET    /api/v1/m35/deals/:dealId/events            — events affecting a deal
 * GET    /api/v1/m35/submarkets/:id/active-forecasts — active events for submarket
 * POST   /api/v1/m35/impact-job/run                  — manually trigger nightly job (M35-2)
 */

import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { getPool } from '../database/connection';
import {
  createEvent,
  getEventById,
  searchEvents,
  updateEvent,
  transitionStatus,
  verifyEvent,
  getStatusHistory,
  getWatchlist,
  addWatchlistMetric,
  getTaxonomy,
  getEventsByDeal,
  getActiveEventsBySubmarket,
  promoteFromDraftQueue,
  type CreateEventInput,
  type M35EventStatus,
} from '../services/m35-events.service';
import {
  computeEventImpact,
  getEventImpacts,
  getEventControlGroup,
  runImpactMeasurementJob,
} from '../services/m35-impact.service';
import { m35CausalityService } from '../services/m35-causality.service';
import { m35TrafficApiService } from '../services/m35-traffic-api.service';

const router = Router();

interface AuthRequest extends Request {
  user?: any;
}

function callerEmail(req: Request): string | undefined {
  return (req as AuthRequest).user?.email;
}

type ForecastStatusLabel = 'ahead' | 'behind' | 'on_pace' | 'no_data';

interface ForecastEnrichment {
  forecastStatus: ForecastStatusLabel;
  maxDivergencePct: number | null;
}

async function batchForecastStatus(eventIds: string[]): Promise<Map<string, ForecastEnrichment>> {
  if (eventIds.length === 0) return new Map();
  const pool = getPool();
  const rows = await pool.query<{ event_id: string; status_label: string; divergence_pct: string | null }>(
    `SELECT event_id, status_label, divergence_pct
     FROM forecast_actuals_tracking
     WHERE event_id = ANY($1::uuid[])
     ORDER BY checked_at DESC`,
    [eventIds],
  );
  const grouped = new Map<string, ForecastEnrichment>();
  for (const row of rows.rows) {
    const entry = grouped.get(row.event_id);
    const div = row.divergence_pct != null ? Math.abs(parseFloat(row.divergence_pct)) : null;
    if (!entry) {
      grouped.set(row.event_id, {
        forecastStatus: (row.status_label as ForecastStatusLabel) || 'no_data',
        maxDivergencePct: div,
      });
    } else {
      if (div != null && (entry.maxDivergencePct == null || div > entry.maxDivergencePct)) {
        entry.maxDivergencePct = div;
      }
    }
  }
  return grouped;
}

// ─── Taxonomy ─────────────────────────────────────────────────────────────────

router.get('/events/taxonomy', async (req: Request, res: Response) => {
  try {
    const category = req.query.category as string | undefined;
    const taxonomy = await getTaxonomy(category as any);
    res.json({ items: taxonomy, total: taxonomy.length });
  } catch (err: any) {
    logger.error('[M35 Events] taxonomy error', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Search / list ────────────────────────────────────────────────────────────

router.get('/events', async (req: Request, res: Response) => {
  try {
    const {
      msaId, msaIds, submarketId, category, subtype, status,
      scope, minConfidence, isVerified, fromDate, toDate,
      limit, offset,
    } = req.query;

    const parsedMsaIds = msaIds
      ? String(msaIds).split(',').map(s => s.trim()).filter(Boolean)
      : undefined;

    const result = await searchEvents({
      msaId:          parsedMsaIds ? undefined : (msaId as string),
      msaIds:         parsedMsaIds,
      submarketId:    submarketId as string,
      category:       category as any,
      subtype:        subtype as string,
      status:         status ? (Array.isArray(status) ? status as any : [status]) as any : undefined,
      scope:          scope as any,
      minConfidence:  minConfidence ? parseFloat(String(minConfidence)) : undefined,
      isVerified:     isVerified !== undefined ? isVerified === 'true' : undefined,
      fromDate:       fromDate as string,
      toDate:         toDate as string,
      limit:          limit ? parseInt(String(limit), 10) : undefined,
      offset:         offset ? parseInt(String(offset), 10) : undefined,
    });

    res.json(result);
  } catch (err: any) {
    logger.error('[M35 Events] search error', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/events/feed', async (req: Request, res: Response) => {
  try {
    const userEmail = callerEmail(req);
    if (!userEmail) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const pool = getPool();
    const limitVal = req.query.limit ? parseInt(String(req.query.limit), 10) : 20;

    const dealRows = await pool.query(
      `SELECT DISTINCT d.deal_data->>'msaId' AS msa_id
       FROM deals d
       WHERE d.deal_data->>'msaId' IS NOT NULL
         AND (d.status IS NULL OR d.status NOT IN ('archived','closed'))
         AND (d.created_by = $1 OR d.deal_data->>'createdBy' = $1 OR d.user_id = $1)
       LIMIT 50`,
      [userEmail],
    );

    const msaIds = dealRows.rows
      .map((r: { msa_id: string }) => r.msa_id as string)
      .filter(Boolean);

    if (msaIds.length === 0) {
      res.json({ items: [], total: 0 });
      return;
    }

    const feedStatuses: M35EventStatus[] = ['announced', 'in_progress', 'materialized'];
    const result = await searchEvents({
      msaIds,
      status:  feedStatuses,
      limit:   limitVal,
      offset:  0,
    });

    const items = result.items ?? [];
    const forecastMap = await batchForecastStatus(items.map(e => String(e.id)));
    const enriched = items.map(e => ({
      ...e,
      forecastStatus: forecastMap.get(String(e.id))?.forecastStatus ?? 'no_data',
      maxDivergencePct: forecastMap.get(String(e.id))?.maxDivergencePct ?? null,
    }));

    res.json({ items: enriched, total: result.total ?? enriched.length });
  } catch (err: unknown) {
    logger.error('[M35 Events] feed error', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

/**
 * GET /api/v1/m35/portfolio/events
 *
 * Returns a PortfolioEventRow[] — one entry per (deal × event) pair where
 * the event's msaId matches the deal's msaId. Includes updatedAt from the
 * key_events.updated_at column so the frontend DATA AS OF timestamp works
 * with live API data instead of demo fallback data.
 *
 * Impact deltas (irrDelta, rentGrowthDelta) are sourced from event_impacts
 * where available; otherwise they default to 0.
 */
router.get('/portfolio/events', async (req: Request, res: Response) => {
  try {
    const userEmail = callerEmail(req);
    if (!userEmail) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const pool = getPool();

    // 1. Fetch the user's active deals with msaId + deal name
    const dealRows = await pool.query<{
      deal_id: string;
      deal_name: string;
      msa_id: string;
      msa_name: string | null;
      submarket_id: string | null;
      submarket_name: string | null;
    }>(
      `SELECT
         d.id                                   AS deal_id,
         COALESCE(d.deal_data->>'name', d.deal_data->>'address', 'Unnamed Deal') AS deal_name,
         d.deal_data->>'msaId'                  AS msa_id,
         d.deal_data->>'msaName'                AS msa_name,
         d.deal_data->>'submarketId'            AS submarket_id,
         d.deal_data->>'submarketName'          AS submarket_name
       FROM deals d
       WHERE d.deal_data->>'msaId' IS NOT NULL
         AND (d.status IS NULL OR d.status NOT IN ('archived','closed'))
         AND (d.created_by = $1 OR d.deal_data->>'createdBy' = $1 OR d.user_id = $1)
       LIMIT 50`,
      [userEmail],
    );

    if (dealRows.rows.length === 0) {
      res.json([]);
      return;
    }

    // 2. Collect distinct msaIds and fetch relevant events
    const msaIdSet = new Set(dealRows.rows.map(r => r.msa_id).filter(Boolean));
    const msaIds = [...msaIdSet];

    const feedStatuses: M35EventStatus[] = ['announced', 'in_progress', 'materialized'];
    const eventsResult = await searchEvents({
      msaIds,
      status: feedStatuses,
      limit: 100,
      offset: 0,
    });
    const events = eventsResult.items ?? [];

    if (events.length === 0) {
      res.json([]);
      return;
    }

    // 3. Pull attributed impact deltas from event_impacts for rent_growth_yoy
    const eventIds = events.map(e => String(e.id));
    let impactMap: Map<string, { irrDelta: number; rentGrowthDelta: number }> = new Map();
    try {
      const impactRows = await pool.query<{
        event_id: string;
        attributed_delta: string | null;
        metric_key: string;
      }>(
        `SELECT event_id::text, metric_key, attributed_delta
         FROM event_impacts
         WHERE event_id = ANY($1::uuid[])
           AND metric_key IN ('rent_growth_yoy', 'effective_rent_growth', 'irr')
         ORDER BY computed_at DESC`,
        [eventIds],
      );
      for (const row of impactRows.rows) {
        if (!impactMap.has(row.event_id)) {
          impactMap.set(row.event_id, { irrDelta: 0, rentGrowthDelta: 0 });
        }
        const entry = impactMap.get(row.event_id)!;
        const delta = parseFloat(String(row.attributed_delta ?? '0')) || 0;
        if (row.metric_key === 'irr') {
          entry.irrDelta = delta;
        } else {
          entry.rentGrowthDelta = delta;
        }
      }
    } catch (impactErr: unknown) {
      logger.warn('[M35 Events] portfolio/events: could not load event_impacts, defaulting to 0', {
        error: impactErr instanceof Error ? impactErr.message : String(impactErr),
      });
    }

    // 4. Cross-join events × deals on msaId and assemble portfolio rows
    const rows: Array<{
      eventId: string;
      eventName: string;
      category: string;
      scope: string;
      magnitude: number;
      irrDelta: number;
      rentGrowthDelta: number;
      propertyId: string;
      propertyName: string;
      submarket: string;
      msa: string;
      status: string;
      triggerAt: string;
      peakAt: string;
      updatedAt: string;
    }> = [];

    for (const event of events) {
      const matchingDeals = dealRows.rows.filter(d => d.msa_id === event.msaId);
      const impacts = impactMap.get(String(event.id)) ?? { irrDelta: 0, rentGrowthDelta: 0 };

      // Map event status to portfolio display status
      let portfolioStatus: string;
      if (event.status === 'materialized') {
        portfolioStatus = impacts.irrDelta > 0 ? 'AHEAD' : (impacts.irrDelta < 0 ? 'BEHIND' : 'ON PACE');
      } else if (event.status === 'in_progress') {
        portfolioStatus = 'ON PACE';
      } else {
        portfolioStatus = 'PRE-EVENT';
      }

      const triggerAt = event.announcedDate
        ? (() => {
            const d = new Date(event.announcedDate);
            const q = Math.ceil((d.getMonth() + 1) / 3);
            return `${d.getFullYear()}-Q${q}`;
          })()
        : 'TBD';
      const peakAt = event.materializationDate
        ? (() => {
            const d = new Date(event.materializationDate);
            const q = Math.ceil((d.getMonth() + 1) / 3);
            return `${d.getFullYear()}-Q${q}`;
          })()
        : 'TBD';

      for (const deal of matchingDeals) {
        rows.push({
          eventId:         String(event.id),
          eventName:       event.name,
          category:        event.category,
          scope:           event.scope,
          magnitude:       event.magnitudeScore ?? 2,
          irrDelta:        impacts.irrDelta,
          rentGrowthDelta: impacts.rentGrowthDelta,
          propertyId:      deal.deal_id,
          propertyName:    deal.deal_name,
          submarket:       deal.submarket_name ?? event.submarketName ?? '',
          msa:             deal.msa_name ?? event.msaName ?? event.msaId ?? '',
          status:          portfolioStatus,
          triggerAt,
          peakAt,
          updatedAt:       event.updatedAt,
        });
      }
    }

    // Deduplicate by eventId+propertyId and limit to 50
    const seen = new Set<string>();
    const deduped = rows.filter(r => {
      const key = `${r.eventId}:${r.propertyId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 50);

    res.json(deduped);
  } catch (err: unknown) {
    logger.error('[M35 Events] portfolio/events error', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

router.get('/events/:id/related', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const event = await getEventById(req.params.id);
    if (!event) { res.status(404).json({ error: 'Event not found' }); return; }

    const rawRows = await pool.query<{ raw_payload: Record<string, unknown> | null }>(
      `SELECT raw_payload FROM key_events WHERE id = $1`,
      [req.params.id],
    );
    const rawPayload = rawRows.rows[0]?.raw_payload;
    const explicitIds: string[] = Array.isArray(rawPayload?.relatedEventIds)
      ? (rawPayload!.relatedEventIds as string[]).filter(id => typeof id === 'string')
      : [];

    let rows: Array<{ id: string; name: string; category: string; status: string; scope: string }>;

    if (explicitIds.length > 0) {
      const res2 = await pool.query<{ id: string; name: string; category: string; status: string; scope: string }>(
        `SELECT id, name, category, status, scope FROM key_events
         WHERE id = ANY($1::uuid[]) AND status NOT IN ('cancelled','reversed')`,
        [explicitIds],
      );
      rows = res2.rows;
    } else {
      const conditions: string[] = [`id <> $1`, `status NOT IN ('cancelled','reversed')`];
      const values: unknown[] = [req.params.id];
      let i = 2;
      if (event.msaId) { conditions.push(`msa_id = $${i}`); values.push(event.msaId); i++; }
      const res2 = await pool.query<{ id: string; name: string; category: string; status: string; scope: string }>(
        `SELECT id, name, category, status, scope FROM key_events
         WHERE ${conditions.join(' AND ')}
         ORDER BY magnitude_score DESC, announced_date DESC NULLS LAST
         LIMIT 8`,
        values,
      );
      rows = res2.rows;
    }

    const related = rows.map(r => ({
      id:           r.id,
      name:         r.name,
      category:     r.category,
      status:       r.status,
      relationship: explicitIds.includes(r.id) ? 'explicit_link' : (event.category === r.category ? 'same_category' : 'co_located'),
    }));

    res.json({ items: related, total: related.length });
  } catch (err: unknown) {
    logger.error('[M35 Events] related error', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// ─── Create ───────────────────────────────────────────────────────────────────

router.post('/events', async (req: Request, res: Response) => {
  try {
    const input: CreateEventInput = {
      ...req.body,
      createdBy: callerEmail(req) ?? req.body.createdBy,
    };

    if (!input.category) { res.status(400).json({ error: 'category is required' }); return; }
    if (!input.name)     { res.status(400).json({ error: 'name is required' }); return; }
    if (!input.scope)    { res.status(400).json({ error: 'scope is required' }); return; }

    const event = await createEvent(input);
    res.status(201).json(event);
  } catch (err: any) {
    logger.error('[M35 Events] create error', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Get by ID ────────────────────────────────────────────────────────────────

router.get('/events/:id', async (req: Request, res: Response) => {
  try {
    const event = await getEventById(req.params.id);
    if (!event) { res.status(404).json({ error: 'Event not found' }); return; }
    res.json(event);
  } catch (err: any) {
    logger.error('[M35 Events] get error', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Update ───────────────────────────────────────────────────────────────────

router.patch('/events/:id', async (req: Request, res: Response) => {
  try {
    const event = await updateEvent({ id: req.params.id, ...req.body });
    if (!event) { res.status(404).json({ error: 'Event not found' }); return; }
    res.json(event);
  } catch (err: any) {
    logger.error('[M35 Events] update error', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Status transition ────────────────────────────────────────────────────────

router.post('/events/:id/status', async (req: Request, res: Response) => {
  try {
    const { status, reason } = req.body;
    if (!status) { res.status(400).json({ error: 'status is required' }); return; }

    const result = await transitionStatus(
      req.params.id,
      status as M35EventStatus,
      { reason, changedBy: callerEmail(req) }
    );

    // Forecast lifecycle (generate/invalidate) is handled inside transitionStatus()
    res.json(result);
  } catch (err: any) {
    if (err.message.includes('Invalid status transition') || err.message.includes('not found')) {
      res.status(400).json({ error: err.message });
    } else {
      logger.error('[M35 Events] status transition error', err);
      res.status(500).json({ error: err.message });
    }
  }
});

// ─── Verify ───────────────────────────────────────────────────────────────────

router.post('/events/:id/verify', async (req: Request, res: Response) => {
  try {
    const verifiedBy = callerEmail(req) ?? req.body.verifiedBy ?? 'unknown';
    const event = await verifyEvent(req.params.id, verifiedBy, req.body.confidence);
    res.json(event);
  } catch (err: any) {
    logger.error('[M35 Events] verify error', err);
    res.status(err.message.includes('not found') ? 404 : 500).json({ error: err.message });
  }
});

// ─── Status history ───────────────────────────────────────────────────────────

router.get('/events/:id/history', async (req: Request, res: Response) => {
  try {
    const history = await getStatusHistory(req.params.id);
    res.json({ items: history, total: history.length });
  } catch (err: any) {
    logger.error('[M35 Events] history error', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Metric watchlist ─────────────────────────────────────────────────────────

router.get('/events/:id/watchlist', async (req: Request, res: Response) => {
  try {
    const watchlist = await getWatchlist(req.params.id);
    res.json({ items: watchlist, total: watchlist.length });
  } catch (err: any) {
    logger.error('[M35 Events] watchlist get error', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/events/:id/watchlist', async (req: Request, res: Response) => {
  try {
    const { metricKey, displayName } = req.body;
    if (!metricKey) { res.status(400).json({ error: 'metricKey is required' }); return; }
    const item = await addWatchlistMetric(
      req.params.id, metricKey, displayName,
      callerEmail(req)
    );
    res.status(201).json(item);
  } catch (err: any) {
    logger.error('[M35 Events] watchlist add error', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Promote from draft queue ─────────────────────────────────────────────────

router.post('/events/promote/:draftId', async (req: Request, res: Response) => {
  try {
    const event = await promoteFromDraftQueue(
      req.params.draftId,
      req.body?.overrides ?? {},
      callerEmail(req)
    );
    res.status(201).json(event);
  } catch (err: any) {
    logger.error('[M35 Events] promote error', err);
    res.status(err.message.includes('not found') ? 404 : 500).json({ error: err.message });
  }
});

// ─── Deal events ──────────────────────────────────────────────────────────────

router.get('/deals/:dealId/events', async (req: Request, res: Response) => {
  try {
    const events = await getEventsByDeal(req.params.dealId);
    const forecastMap = await batchForecastStatus(events.map(e => e.id));
    const enriched = events.map(e => ({
      ...e,
      forecastStatus: forecastMap.get(e.id)?.forecastStatus ?? 'no_data',
      maxDivergencePct: forecastMap.get(e.id)?.maxDivergencePct ?? null,
    }));
    res.json({ items: enriched, total: enriched.length });
  } catch (err: unknown) {
    logger.error('[M35 Events] deal events error', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// ─── Deal events context (banner + sensitivity + attributions) ────────────────

router.get('/deals/:dealId/events-context', async (req: Request, res: Response) => {
  try {
    const pool = getPool();

    // Resolve deal's MSA — prefer explicit msaId on deal_data, fall back to city
    const dealRes = await pool.query(`
      SELECT d.id, d.name,
        COALESCE(d.deal_data->>'msaId', lower(trim(d.city))) AS msa_id
      FROM deals d WHERE d.id = $1 LIMIT 1
    `, [req.params.dealId]);

    const deal = dealRes.rows[0];
    const msaId = deal?.msa_id ?? null;

    let events: any[] = [];
    if (msaId) {
      const evRes = await pool.query(`
        SELECT ke.* FROM key_events ke
        WHERE ke.msa_id = $1
          AND ke.status NOT IN ('cancelled','reversed')
        ORDER BY ke.magnitude_score DESC, ke.announced_date DESC NULLS LAST
        LIMIT 20
      `, [msaId]);
      events = evRes.rows;
    }

    // Compute sensitivity from avg magnitude_score
    let sensitivityScore = 0;
    let sensitivity = 'LOW';
    if (events.length > 0) {
      const avgMag = events.reduce((s, e) => s + Number(e.magnitude_score || 2), 0) / events.length;
      sensitivityScore = Math.min(1, avgMag / 5);
      sensitivity = avgMag >= 3.5 ? 'HIGH' : avgMag >= 2.5 ? 'MEDIUM' : 'LOW';
    }

    // Compute concentration (top event share of total magnitude)
    let concentration = null;
    if (events.length > 0) {
      const totalMag = events.reduce((s, e) => s + Number(e.magnitude_score || 1), 0);
      const top = events[0];
      const topShare = Number(top.magnitude_score || 1) / totalMag;
      concentration = {
        topEventName:  top.name,
        irrShare:      topShare,
        isConcentrated: topShare > 0.30,
      };
    }

    // Inline attributions: generate synthetic attribution from magnitude + default metrics
    const ATTRIBUTION_METRICS = ['rent_growth_yoy', 'cap_rate', 'absorption', 'permits'];
    const inlineAttributions: Record<string, any[]> = {};
    ATTRIBUTION_METRICS.forEach(metric => {
      inlineAttributions[metric] = events.slice(0, 2).map(ev => ({
        eventId:    ev.id,
        eventName:  ev.name,
        metricKey:  metric,
        delta:      Number((Number(ev.magnitude_score || 2) * 0.5 * (ev.scope === 'msa' ? 0.8 : 1.0)).toFixed(2)),
        unit:       metric.endsWith('rate') || metric.endsWith('yoy') ? 'pp' : '',
        baseline:   3.2,
        total:      3.2 + Number((Number(ev.magnitude_score || 2) * 0.5).toFixed(2)),
        confidence: Number(ev.confidence || 0.55),
      }));
    });

    // Fetch news items linked to these events via news_item_ids
    const allNewsIds: string[] = [];
    for (const ev of events) {
      const ids = Array.isArray(ev.news_item_ids) ? ev.news_item_ids : [];
      for (const id of ids) {
        if (typeof id === 'string' && !allNewsIds.includes(id)) allNewsIds.push(id);
      }
    }

    const newsItemMap = new Map<string, object>();
    if (allNewsIds.length > 0) {
      const placeholders = allNewsIds.map((_, i) => `$${i + 1}`).join(', ');
      const newsRes = await pool.query(
        `SELECT id, title, summary, source_url, source_name, published_at, relevance_score
         FROM news_items WHERE id IN (${placeholders})`,
        allNewsIds
      );
      for (const row of newsRes.rows) {
        newsItemMap.set(row.id, {
          id:            row.id,
          title:         row.title,
          summary:       row.summary ?? null,
          sourceUrl:     row.source_url ?? null,
          sourceName:    row.source_name ?? null,
          publishedAt:   row.published_at ? new Date(row.published_at).toISOString() : null,
          relevanceScore: row.relevance_score !== null ? parseFloat(row.relevance_score) : null,
        });
      }
    }

    // Fallback: for events with no linked news_item_ids, auto-surface related
    // articles by date proximity (±90 days) and optional category match.
    // Results are flagged isInferred: true so the UI can differentiate.
    const fallbackNewsMap = new Map<string, object[]>(); // ev.id → inferred articles
    const eventsNeedingFallback = events.filter(ev => {
      const ids = Array.isArray(ev.news_item_ids) ? ev.news_item_ids : [];
      return ids.length === 0;
    });

    if (eventsNeedingFallback.length > 0) {
      // One broad query: fetch news items scoped to the deal's MSA.
      // news_items carries an optional deal_id; we join through deals to get msaId.
      // Items with deal_id IS NULL are treated as MSA-agnostic (global) and always included.
      const fallbackPool = await pool.query(
        `SELECT ni.id, ni.title, ni.summary, ni.source_url, ni.source_name,
                ni.published_at, ni.relevance_score, ni.category
         FROM news_items ni
         LEFT JOIN deals d ON d.id = ni.deal_id
         WHERE ni.published_at IS NOT NULL
           AND (
             ni.deal_id IS NULL
             OR d.deal_data->>'msaId' = $1
           )
         ORDER BY ni.relevance_score DESC NULLS LAST, ni.published_at DESC
         LIMIT 100`,
        [msaId]
      );
      const candidatePool = fallbackPool.rows;

      for (const ev of eventsNeedingFallback) {
        const evDate = ev.announced_date ?? ev.materialization_date;
        const evTime = evDate ? new Date(evDate as string).getTime() : null;
        const evCategory: string | null = (ev.category as string) ?? null;

        // Filter candidates by date proximity (±90 days) when an event date is known
        const dateFiltered = evTime
          ? candidatePool.filter(item => {
              const itemTime = new Date(item.published_at).getTime();
              return Math.abs(evTime - itemTime) <= 90 * 24 * 60 * 60 * 1000;
            })
          : candidatePool;

        // Further filter by category if both the event and news item have one
        const categoryFiltered = (evCategory && dateFiltered.some(i => i.category))
          ? dateFiltered.filter(i => !i.category || (i.category as string).toUpperCase() === evCategory.toUpperCase())
          : dateFiltered;

        const top3 = (categoryFiltered.length > 0 ? categoryFiltered : dateFiltered).slice(0, 3);
        if (top3.length > 0) {
          fallbackNewsMap.set(ev.id as string, top3.map(row => ({
            id:            row.id,
            title:         row.title,
            summary:       row.summary ?? null,
            sourceUrl:     row.source_url ?? null,
            sourceName:    row.source_name ?? null,
            publishedAt:   row.published_at ? new Date(row.published_at).toISOString() : null,
            relevanceScore: row.relevance_score !== null ? parseFloat(row.relevance_score) : null,
            isInferred:    true,
          })));
        }
      }
    }

    const enrichedEvents = events.map(ev => {
      const ids: string[] = Array.isArray(ev.news_item_ids) ? ev.news_item_ids : [];
      const directNews = ids.map(id => newsItemMap.get(id)).filter(Boolean);
      // Use explicit news items when available; otherwise fall back to inferred articles
      const newsItems = directNews.length > 0
        ? directNews
        : (fallbackNewsMap.get(ev.id as string) ?? []);
      return {
        id:                 ev.id as string,
        name:               ev.name as string,
        category:           ev.category as string,
        subtype:            ev.subtype as string | undefined,
        status:             ev.status as string,
        description:        ev.description as string | undefined,
        scope:              ev.scope as string,
        msaId:              ev.msa_id as string | undefined,
        msaName:            ev.msa_name as string | undefined,
        submarketId:        ev.submarket_id as string | undefined,
        submarketName:      ev.submarket_name as string | undefined,
        magnitudeScore:     parseFloat(ev.magnitude_score ?? '2'),
        confidence:         parseFloat(ev.confidence ?? '0.5'),
        isVerified:         Boolean(ev.is_verified),
        announcedDate:      ev.announced_date ? new Date(ev.announced_date as string).toISOString() : undefined,
        materializationDate: ev.materialization_date ? new Date(ev.materialization_date as string).toISOString() : undefined,
        ingestionSource:    ev.ingestion_source as string | undefined,
        sourceUrl:          ev.source_url as string | undefined,
        updatedAt:          ev.updated_at ? new Date(ev.updated_at as string).toISOString() : undefined,
        newsItems,
      };
    });

    res.json({
      dealId: req.params.dealId,
      msaId,
      events: enrichedEvents,
      sensitivity,
      sensitivityScore,
      concentration,
      inlineAttributions,
      totalActiveEvents: enrichedEvents.length,
    });
  } catch (err: any) {
    logger.error('[M35 Events] events-context error', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Submarket active forecasts ───────────────────────────────────────────────

// NOTE: /submarkets/:id/active-forecasts is served by m35-forecasts.routes.ts
// (mounted earlier in index.replit.ts). The events router no longer registers it
// to avoid duplicate route confusion and stale empty-forecasts responses.

// ─── Impact records (M35-2) ───────────────────────────────────────────────────

router.get('/events/:id/impacts', async (req: Request, res: Response) => {
  try {
    const impacts = await getEventImpacts(req.params.id);
    res.json({ items: impacts, total: impacts.length });
  } catch (err: any) {
    logger.error('[M35 Events] get impacts error', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/events/:id/control-group', async (req: Request, res: Response) => {
  try {
    const group = await getEventControlGroup(req.params.id);
    res.json({ items: group, total: group.length });
  } catch (err: any) {
    logger.error('[M35 Events] get control-group error', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/events/:id/compute-impact', async (req: Request, res: Response) => {
  try {
    const records = await computeEventImpact(req.params.id);
    res.json({ computed: records.length, items: records });
  } catch (err: any) {
    logger.error('[M35 Events] compute-impact error', err);
    res.status(err.message.includes('not found') ? 404 : 500).json({ error: err.message });
  }
});

// ─── Nightly job — manual trigger (M35-2) ─────────────────────────────────────

router.post('/impact-job/run', async (req: Request, res: Response) => {
  try {
    const result = await runImpactMeasurementJob();
    res.json(result);
  } catch (err: any) {
    logger.error('[M35 Events] impact-job error', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Causality Analysis (M35 ↔ Correlation Engine) ────────────────────────────
//
// GET  /api/v1/m35/events/:id/causality          — per-event causality verdict
// POST /api/v1/m35/events/:id/causality          — force-refresh (bypass cache)
// GET  /api/v1/m35/msa/:msaId/causality          — all events in an MSA
// GET  /api/v1/m35/msa/:msaId/pipeline-signal    — T-07 event_pipeline_signal

router.get('/events/:id/causality', async (req: Request, res: Response) => {
  try {
    const report = await m35CausalityService.analyzeEventCausality(req.params.id, false);
    res.json(report);
  } catch (err: any) {
    logger.error('[M35 Causality] get error', err);
    res.status(err.message.includes('not found') ? 404 : 500).json({ error: err.message });
  }
});

router.post('/events/:id/causality', async (req: Request, res: Response) => {
  try {
    const report = await m35CausalityService.analyzeEventCausality(req.params.id, true);
    res.json(report);
  } catch (err: any) {
    logger.error('[M35 Causality] refresh error', err);
    res.status(err.message.includes('not found') ? 404 : 500).json({ error: err.message });
  }
});

router.get('/msa/:msaId/causality', async (req: Request, res: Response) => {
  try {
    const report = await m35CausalityService.analyzeMSACausality(req.params.msaId);
    res.json(report);
  } catch (err: any) {
    logger.error('[M35 Causality] MSA causality error', err);
    res.status(500).json({ error: err.message });
  }
});

// T-07 event_pipeline_signal (6th component added by spec §3.1)
router.get('/msa/:msaId/pipeline-signal', async (req: Request, res: Response) => {
  try {
    const horizon = parseInt(req.query.horizon as string || '18', 10);
    const signal = await m35TrafficApiService.computeEventPipelineSignal(
      { msaId: req.params.msaId },
      horizon
    );
    const pipeline = await m35TrafficApiService.getPipelineEvents({
      location: { msaId: req.params.msaId },
      radiusMi: 50,
      window: {
        start: new Date(),
        end: new Date(Date.now() + horizon * 30 * 24 * 60 * 60 * 1000),
      },
    });
    res.json({ signal, pipelineEvents: pipeline, horizonMonths: horizon });
  } catch (err: any) {
    logger.error('[M35 Traffic API] pipeline-signal error', err);
    res.status(500).json({ error: err.message });
  }
});

// Active events for M07 calibration job (mechanism A-C)
router.get('/msa/:msaId/active-events', async (req: Request, res: Response) => {
  try {
    const windowMonths = parseInt(req.query.windowMonths as string || '24', 10);
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - windowMonths);
    const events = await m35TrafficApiService.getActiveEvents({
      location: { msaId: req.params.msaId },
      radiusMi: 50,
      window: { start, end },
    });
    res.json({ items: events, total: events.length });
  } catch (err: any) {
    logger.error('[M35 Traffic API] active-events error', err);
    res.status(500).json({ error: err.message });
  }
});

// Playbook lookup for Lease-Up mechanism D
router.get('/playbook/:eventType', async (req: Request, res: Response) => {
  try {
    const playbook = await m35TrafficApiService.getPlaybook(req.params.eventType);
    if (!playbook) return res.status(404).json({ error: 'No playbook found for this event type' });
    res.json(playbook);
  } catch (err: any) {
    logger.error('[M35 Traffic API] playbook error', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;

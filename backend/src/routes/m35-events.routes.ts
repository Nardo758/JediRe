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
 * POST   /api/v1/m35/events/promote/:draftId         — promote from draft queue
 * GET    /api/v1/m35/deals/:dealId/events            — events affecting a deal
 * GET    /api/v1/m35/submarkets/:id/active-forecasts — active events for submarket
 */

import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
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

const router = Router();

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
      msaId, submarketId, category, subtype, status,
      scope, minConfidence, isVerified, fromDate, toDate,
      limit, offset,
    } = req.query;

    const result = await searchEvents({
      msaId:          msaId as string,
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

// ─── Create ───────────────────────────────────────────────────────────────────

router.post('/events', async (req: Request, res: Response) => {
  try {
    const input: CreateEventInput = {
      ...req.body,
      createdBy: (req as any).user?.email ?? req.body.createdBy,
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
      { reason, changedBy: (req as any).user?.email }
    );
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
    const verifiedBy = (req as any).user?.email ?? req.body.verifiedBy ?? 'unknown';
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
      (req as any).user?.email
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
      (req as any).user?.email
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
    res.json({ items: events, total: events.length });
  } catch (err: any) {
    logger.error('[M35 Events] deal events error', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Submarket active forecasts (shell — full impl in Task #187) ──────────────

router.get('/submarkets/:id/active-forecasts', async (req: Request, res: Response) => {
  try {
    const events = await getActiveEventsBySubmarket(req.params.id);
    // Task #185/187 will attach forecast impacts here — returning events only for now
    res.json({ items: events, forecasts: [], total: events.length });
  } catch (err: any) {
    logger.error('[M35 Events] submarket forecasts error', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;

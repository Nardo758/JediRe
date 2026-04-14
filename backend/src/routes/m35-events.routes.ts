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
 * GET    /api/v1/m35/deals/:dealId/events            — events affecting a deal
 * GET    /api/v1/m35/submarkets/:id/active-forecasts — active events for submarket
 * POST   /api/v1/m35/impact-job/run                  — manually trigger nightly job (M35-2)
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
import {
  computeEventImpact,
  getEventImpacts,
  getEventControlGroup,
  runImpactMeasurementJob,
} from '../services/m35-impact.service';
import { m35CausalityService } from '../services/m35-causality.service';
import { m35TrafficApiService } from '../services/m35-traffic-api.service';

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

// ─── Deal events context (banner + sensitivity + attributions) ────────────────

router.get('/deals/:dealId/events-context', async (req: Request, res: Response) => {
  try {
    const pool = getPool();

    // Resolve deal's MSA
    const dealRes = await pool.query(`
      SELECT d.id, d.name, d.deal_data->>'msaId' AS msa_id_from_deal
      FROM deals d WHERE d.id = $1 LIMIT 1
    `, [req.params.dealId]);

    const deal = dealRes.rows[0];
    const msaId = deal?.msa_id_from_deal ?? null;

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
    } else {
      // Fallback: return all non-cancelled events ordered by magnitude
      const evRes = await pool.query(`
        SELECT ke.* FROM key_events ke
        WHERE ke.status NOT IN ('cancelled','reversed')
        ORDER BY ke.magnitude_score DESC, ke.announced_date DESC NULLS LAST
        LIMIT 20
      `);
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

    res.json({
      dealId: req.params.dealId,
      msaId,
      events,
      sensitivity,
      sensitivityScore,
      concentration,
      inlineAttributions,
      totalActiveEvents: events.length,
    });
  } catch (err: any) {
    logger.error('[M35 Events] events-context error', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Submarket active forecasts ───────────────────────────────────────────────

router.get('/submarkets/:id/active-forecasts', async (req: Request, res: Response) => {
  try {
    const events = await getActiveEventsBySubmarket(req.params.id);
    res.json({ items: events, forecasts: [], total: events.length });
  } catch (err: any) {
    logger.error('[M35 Events] submarket forecasts error', err);
    res.status(500).json({ error: err.message });
  }
});

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
